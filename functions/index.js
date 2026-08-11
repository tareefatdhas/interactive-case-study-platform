'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { renderWelcomeEmail, renderAfterClassReportEmail, renderWeeklyDigestEmail } = require('./email');
const { collectSessionMetrics, collectWeeklyMetrics } = require('./reporting');
const { RETENTION_DAYS, collectExpiredRooms } = require('./retention');

initializeApp();

const postmarkServerToken = defineSecret('POSTMARK_SERVER_TOKEN');
const FUNCTION_REGION = 'asia-southeast1';
const EMAIL_FROM = 'Classfully <no-reply@classfully.com>';
const EMAIL_REPLY_TO = 'tareef@happily.ai';
const DELIVERY_COLLECTION = 'emailDeliveries';

function notificationPreferences(teacher = {}) {
  return {
    afterClassReport: teacher.notificationPreferences?.afterClassReport ?? true,
    weeklyCourseDigest: teacher.notificationPreferences?.weeklyCourseDigest ?? true,
    productNews: teacher.notificationPreferences?.productNews ?? false,
  };
}

function timestampToDate(value) {
  if (value?.toDate) return value.toDate();
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(timestampToDate(value));
}

async function claimDelivery(deliveryId, details) {
  const firestore = getFirestore();
  const deliveryRef = firestore.collection(DELIVERY_COLLECTION).doc(deliveryId);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(deliveryRef);
    const current = snapshot.data();
    const updatedAt = current?.updatedAt?.toMillis?.() || 0;
    const activeClaim = current?.status === 'sending' && Date.now() - updatedAt < 15 * 60 * 1000;
    if (current?.status === 'sent' || activeClaim) return false;
    transaction.set(deliveryRef, {
      ...details,
      status: 'sending',
      attemptCount: FieldValue.increment(1),
      updatedAt: Timestamp.now(),
      createdAt: current?.createdAt || Timestamp.now(),
    }, { merge: true });
    return true;
  });
}

async function sendPostmarkEmail(email, options) {
  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': postmarkServerToken.value(),
    },
    body: JSON.stringify({
      From: EMAIL_FROM,
      To: options.to,
      ReplyTo: EMAIL_REPLY_TO,
      Subject: email.subject,
      HtmlBody: email.html,
      TextBody: email.text,
      MessageStream: 'outbound',
      Tag: options.tag,
      TrackOpens: false,
      TrackLinks: 'None',
      Metadata: options.metadata,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ErrorCode) {
    throw new Error(`Postmark rejected ${options.tag}: ${payload?.Message || response.statusText}`);
  }
  return payload;
}

async function deliverEmail({ deliveryId, teacherId, to, email, tag, metadata = {} }) {
  const claimed = await claimDelivery(deliveryId, { teacherId, recipient: to, type: tag, metadata });
  if (!claimed) {
    console.log(`Classfully email ${deliveryId} was already sent or is currently sending.`);
    return null;
  }
  const deliveryRef = getFirestore().collection(DELIVERY_COLLECTION).doc(deliveryId);
  try {
    const result = await sendPostmarkEmail(email, { to, tag, metadata });
    await deliveryRef.set({
      status: 'sent',
      postmarkMessageId: result.MessageID,
      submittedAt: result.SubmittedAt,
      sentAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });
    return result;
  } catch (error) {
    await deliveryRef.set({
      status: 'failed',
      error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown email error',
      updatedAt: Timestamp.now(),
    }, { merge: true });
    throw error;
  }
}

async function loadSessionReport(sessionId, session) {
  const [liveSnapshot, responseSnapshot] = await Promise.all([
    getDatabase().ref(`liveV2/${session.teacherId}/${sessionId}`).get().catch(() => null),
    getFirestore().collection('responses').where('sessionId', '==', sessionId).get(),
  ]);
  const metrics = collectSessionMetrics({
    session,
    liveRoom: liveSnapshot?.val() || {},
    legacyResponses: responseSnapshot.docs.map((document) => document.data()),
  });
  return {
    sessionId,
    courseId: session.courseId || null,
    courseCode: session.courseCode || 'CLASSFULLY',
    courseName: session.courseName || 'Closed session report',
    sessionTitle: session.title || session.caseStudyTitle || 'Class session',
    endedAt: session.endedAt,
    ...metrics,
  };
}

exports.sendInstructorWelcome = onDocumentCreated(
  {
    document: 'teachers/{teacherId}',
    region: FUNCTION_REGION,
    secrets: [postmarkServerToken],
    retry: true,
  },
  async (event) => {
    const teacher = event.data?.data();
    if (!teacher?.email) return;
    const teacherId = event.params.teacherId;
    await deliverEmail({
      deliveryId: `welcome_${teacherId}`,
      teacherId,
      to: teacher.email,
      email: renderWelcomeEmail({ recipientName: teacher.name || 'there' }),
      tag: 'instructor-welcome',
      metadata: { teacherId },
    });
  },
);

exports.sendAfterClassReport = onDocumentUpdated(
  {
    document: 'sessions/{sessionId}',
    region: FUNCTION_REGION,
    secrets: [postmarkServerToken],
    retry: true,
  },
  async (event) => {
    const before = event.data?.before.data() || {};
    const session = event.data?.after.data() || {};
    const closedNow = session.active === false && session.endedAt && (before.active !== false || !before.endedAt);
    if (!closedNow || !session.teacherId) return;

    const teacherSnapshot = await getFirestore().collection('teachers').doc(session.teacherId).get();
    const teacher = teacherSnapshot.data();
    if (!teacher?.email || !notificationPreferences(teacher).afterClassReport) return;

    const sessionId = event.params.sessionId;
    const report = await loadSessionReport(sessionId, session);
    const email = renderAfterClassReportEmail({
      recipientName: teacher.name || 'there',
      courseCode: report.courseCode,
      courseName: report.courseName,
      sessionTitle: report.sessionTitle,
      sessionDate: formatDate(report.endedAt),
      metrics: report.metrics,
      insightTitle: report.insightTitle,
      insightBody: report.insightBody,
      actions: report.actions,
      dashboardUrl: `https://classfully.com/dashboard/sessions/${sessionId}`,
    });
    await deliverEmail({
      deliveryId: `after-class_${sessionId}_${session.teacherId}`,
      teacherId: session.teacherId,
      to: teacher.email,
      email,
      tag: 'after-class-report',
      metadata: { teacherId: session.teacherId, sessionId },
    });
  },
);

exports.sendWeeklyInstructorDigests = onSchedule(
  {
    schedule: 'every monday 08:00',
    timeZone: 'Asia/Bangkok',
    region: FUNCTION_REGION,
    timeoutSeconds: 540,
    memory: '512MiB',
    secrets: [postmarkServerToken],
    retryCount: 2,
  },
  async () => {
    const firestore = getFirestore();
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const periodKey = start.toISOString().slice(0, 10);
    const sessionSnapshot = await firestore.collection('sessions')
      .where('endedAt', '>=', Timestamp.fromDate(start))
      .where('endedAt', '<', Timestamp.fromDate(end))
      .get();
    const byTeacher = new Map();
    sessionSnapshot.docs.forEach((document) => {
      const session = document.data();
      if (!session.teacherId || session.active !== false) return;
      const sessions = byTeacher.get(session.teacherId) || [];
      sessions.push({ sessionId: document.id, session });
      byTeacher.set(session.teacherId, sessions);
    });

    for (const [teacherId, sessions] of byTeacher.entries()) {
      const teacherSnapshot = await firestore.collection('teachers').doc(teacherId).get();
      const teacher = teacherSnapshot.data();
      if (!teacher?.email || !notificationPreferences(teacher).weeklyCourseDigest) continue;
      const reports = await Promise.all(sessions.map(({ sessionId, session }) => loadSessionReport(sessionId, session)));
      if (!reports.length) continue;
      const weekly = collectWeeklyMetrics(reports);
      const email = renderWeeklyDigestEmail({
        recipientName: teacher.name || 'there',
        weekLabel: `Week of ${formatDate(start)}`,
        ...weekly,
      });
      await deliverEmail({
        deliveryId: `weekly_${periodKey}_${teacherId}`,
        teacherId,
        to: teacher.email,
        email,
        tag: 'weekly-instructor-digest',
        metadata: { teacherId, periodKey, sessionCount: String(reports.length) },
      });
    }
  },
);

exports.purgeExpiredClassroomData = onSchedule(
  {
    schedule: 'every day 03:00',
    timeZone: 'Asia/Bangkok',
    region: 'asia-southeast1',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async () => {
    const database = getDatabase();
    const liveSnapshot = await database.ref('liveV2').get();
    const expiredRooms = collectExpiredRooms(liveSnapshot.val());

    const updates = {};
    for (const room of expiredRooms) {
      updates[`liveV2/${room.ownerUid}/${room.sessionId}`] = null;
      if (!room.sessionCode) continue;

      const joinCode = room.sessionCode.replace(/[^a-z0-9]/gi, '').toUpperCase();
      const joinSnapshot = await database.ref(`liveJoinCodes/${joinCode}`).get();
      const joinRecord = joinSnapshot.val();
      if (joinRecord?.ownerUid === room.ownerUid && joinRecord?.sessionId === room.sessionId) {
        updates[`liveJoinCodes/${joinCode}`] = null;
      }
    }

    if (Object.keys(updates).length > 0) {
      await database.ref().update(updates);
    }

    await getFirestore().collection('retentionDeletionLogs').add({
      ranAt: FieldValue.serverTimestamp(),
      policyDays: RETENTION_DAYS,
      deletedRoomCount: expiredRooms.length,
      deletedRooms: expiredRooms.map(({ ownerUid, sessionId, lastRecordedAt }) => ({
        ownerUid,
        sessionId,
        lastRecordedAt,
      })),
    });

    console.log(`Classfully retention completed. Deleted ${expiredRooms.length} classroom rooms.`);
  },
);
