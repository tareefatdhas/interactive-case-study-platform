'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');
const { defineSecret, defineString } = require('firebase-functions/params');
const { HttpsError, onCall, onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const Stripe = require('stripe');
const { createHash } = require('node:crypto');
const { renderWelcomeEmail, renderAfterClassReportEmail, renderWeeklyDigestEmail } = require('./email');
const { collectSessionMetrics, collectWeeklyMetrics } = require('./reporting');
const { isWeeklyDigestSendTime, localPeriodKey } = require('./scheduling');
const { RETENTION_DAYS, collectExpiredRooms } = require('./retention');
const { accessSnapshot, canCreateCourse } = require('./billing');
const { sendPurchase } = require('./analytics');

initializeApp();

const postmarkServerToken = defineSecret('POSTMARK_SERVER_TOKEN');
const stripeRestrictedKey = defineSecret('STRIPE_RESTRICTED_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const stripeTermPriceId = defineSecret('STRIPE_TERM_PRICE_ID');
const stripeAnnualPriceId = defineSecret('STRIPE_ANNUAL_PRICE_ID');
const stripeBillingEnabled = defineString('STRIPE_BILLING_ENABLED', { default: 'false' });
// Server-side purchase reporting. Both must be set or the webhook simply skips
// it; see docs/analytics-tracking-plan.md for creating the API secret.
const ga4ApiSecret = defineSecret('GA4_API_SECRET');
const ga4MeasurementId = defineString('GA4_MEASUREMENT_ID', { default: '' });
const FUNCTION_REGION = 'asia-southeast1';
const EMAIL_FROM = 'Classfully <no-reply@classfully.com>';
const EMAIL_REPLY_TO = 'tareef@happily.ai';
const DELIVERY_COLLECTION = 'emailDeliveries';
const APP_URL = 'https://classfully.com';

function requireInstructor(request) {
  if (!request.auth?.uid || request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('unauthenticated', 'Sign in with your instructor account to continue.');
  }
  return request.auth.uid;
}

function stripeClient() {
  const key = stripeRestrictedKey.value();
  if (!key) throw new HttpsError('failed-precondition', 'Billing setup is not finished yet. Try again after Stripe is connected.');
  return new Stripe(key, { apiVersion: '2026-06-24.dahlia' });
}

function cleanString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function billingPayload(teacher, usage = {}) {
  const access = accessSnapshot(teacher?.billing);
  return {
    plan: access.plan,
    effectivePlan: access.effectivePlan,
    status: access.status,
    paid: access.paid,
    hasBillingAccount: Boolean(access.stripeCustomerId),
    pilotSessionsUsed: access.pilotSessionsUsed,
    sessionsRemaining: access.sessionsRemaining,
    canStartSession: access.canStartSession,
    cancelAtPeriodEnd: access.cancelAtPeriodEnd,
    currentPeriodEnd: access.currentPeriodEnd?.toDate?.()?.toISOString?.() || access.currentPeriodEnd || null,
    graceEndsAt: access.graceEndsAt?.toDate?.()?.toISOString?.() || access.graceEndsAt || null,
    limits: access.limits,
    usage,
    billingEnabled: stripeBillingEnabled.value() === 'true',
  };
}

function planFromPriceId(priceId) {
  if (priceId && priceId === stripeTermPriceId.value()) return 'instructor_term';
  if (priceId && priceId === stripeAnnualPriceId.value()) return 'instructor_annual';
  return null;
}

function stripeStatus(status) {
  if (['active', 'trialing', 'past_due', 'unpaid', 'canceled', 'paused', 'incomplete', 'incomplete_expired'].includes(status)) return status;
  return 'inactive';
}

function dateTimestamp(seconds) {
  return Number.isFinite(seconds) ? Timestamp.fromMillis(seconds * 1000) : null;
}

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

function formatDate(value, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone,
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

async function instructorUsage(teacherId) {
  const firestore = getFirestore();
  const [courses, sessions] = await Promise.all([
    firestore.collection('courses').where('teacherId', '==', teacherId).get(),
    firestore.collection('sessions').where('teacherId', '==', teacherId).get(),
  ]);
  const activeCourses = courses.docs.filter((document) => document.data().archived !== true);
  const studentIds = new Set();
  activeCourses.forEach((document) => (document.data().studentIds || []).forEach((studentId) => studentIds.add(studentId)));
  return {
    activeCourses: activeCourses.length,
    totalCourses: courses.size,
    totalSessions: sessions.size,
    studentsAcrossCourses: studentIds.size,
  };
}

exports.getInstructorBilling = onCall(
  { region: FUNCTION_REGION, cors: ['https://classfully.com', /localhost:\d+$/] },
  async (request) => {
    const teacherId = requireInstructor(request);
    const teacherSnapshot = await getFirestore().collection('teachers').doc(teacherId).get();
    if (!teacherSnapshot.exists) throw new HttpsError('not-found', 'Your instructor profile could not be found.');
    return billingPayload(teacherSnapshot.data(), await instructorUsage(teacherId));
  },
);

exports.createBillingCheckout = onCall(
  {
    region: FUNCTION_REGION,
    cors: ['https://classfully.com', /localhost:\d+$/],
    secrets: [stripeRestrictedKey, stripeTermPriceId, stripeAnnualPriceId],
  },
  async (request) => {
    const teacherId = requireInstructor(request);
    if (stripeBillingEnabled.value() !== 'true') {
      throw new HttpsError('failed-precondition', 'Checkout is almost ready. Stripe still needs to be connected.');
    }
    const requestedPlan = request.data?.plan;
    if (!['instructor_term', 'instructor_annual'].includes(requestedPlan)) {
      throw new HttpsError('invalid-argument', 'Choose a teaching term or annual plan.');
    }
    // Carried through Stripe so the webhook can report the purchase against the
    // visit that earned it. Absent whenever analytics is off or blocked, which
    // must never stop a checkout.
    const gaClientId = cleanString(request.data?.gaClientId, 64);
    const gaSessionId = cleanString(request.data?.gaSessionId, 32);
    const priceId = requestedPlan === 'instructor_term' ? stripeTermPriceId.value() : stripeAnnualPriceId.value();
    if (!priceId) throw new HttpsError('failed-precondition', 'That plan has not been connected to Stripe yet.');

    const firestore = getFirestore();
    const teacherRef = firestore.collection('teachers').doc(teacherId);
    const teacherSnapshot = await teacherRef.get();
    const teacher = teacherSnapshot.data();
    if (!teacher?.email) throw new HttpsError('not-found', 'Your instructor email could not be found.');
    if (accessSnapshot(teacher.billing).paid) {
      throw new HttpsError('already-exists', 'You already have an active Classfully plan. Manage it from your billing page.');
    }
    if (teacher.billing?.stripeSubscriptionId && !['canceled', 'incomplete_expired'].includes(teacher.billing?.status)) {
      throw new HttpsError('failed-precondition', 'A billing plan already exists for this account. Open billing to update it.');
    }

    const stripe = stripeClient();
    let customerId = teacher.billing?.stripeCustomerId || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: teacher.email,
        name: teacher.name || undefined,
        metadata: { firebaseUid: teacherId },
      });
      customerId = customer.id;
      await teacherRef.set({
        billing: { ...(teacher.billing || {}), stripeCustomerId: customerId, updatedAt: Timestamp.now() },
      }, { merge: true });
    }

    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const suffix = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      client_reference_id: teacherId,
      metadata: {
        firebaseUid: teacherId,
        classfullyPlan: requestedPlan,
        ...(gaClientId ? { gaClientId } : {}),
        ...(gaSessionId ? { gaSessionId } : {}),
      },
      subscription_data: { metadata: { firebaseUid: teacherId, classfullyPlan: requestedPlan } },
      success_url: `${APP_URL}/dashboard/settings?billing=success#billing`,
      cancel_url: `${APP_URL}/dashboard/settings?billing=cancelled#billing`,
      integration_identifier: `classfully_${suffix}`,
    }, { idempotencyKey: `checkout_${teacherId}_${requestedPlan}_${Date.now().toString().slice(0, -4)}` });

    if (!session.url) throw new HttpsError('internal', 'Stripe did not return a checkout page. Try again.');
    return { url: session.url };
  },
);

exports.createBillingPortal = onCall(
  {
    region: FUNCTION_REGION,
    cors: ['https://classfully.com', /localhost:\d+$/],
    secrets: [stripeRestrictedKey],
  },
  async (request) => {
    const teacherId = requireInstructor(request);
    if (stripeBillingEnabled.value() !== 'true') {
      throw new HttpsError('failed-precondition', 'Billing management is not connected yet.');
    }
    const teacher = (await getFirestore().collection('teachers').doc(teacherId).get()).data();
    const customerId = teacher?.billing?.stripeCustomerId;
    if (!customerId) throw new HttpsError('failed-precondition', 'There is no paid billing account to manage yet.');
    const portal = await stripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL}/dashboard/settings#billing`,
    });
    return { url: portal.url };
  },
);

exports.createInstructorCourse = onCall(
  { region: FUNCTION_REGION, cors: ['https://classfully.com', /localhost:\d+$/] },
  async (request) => {
    const teacherId = requireInstructor(request);
    const name = cleanString(request.data?.name, 120);
    const code = cleanString(request.data?.code, 24).toUpperCase();
    const term = cleanString(request.data?.term, 80);
    const sourceCourseId = cleanString(request.data?.sourceCourseId, 160);
    if (!name || !code || !/^[A-Z0-9][A-Z0-9 ._/-]*$/.test(code)) {
      throw new HttpsError('invalid-argument', 'Add a class name and a short class code.');
    }

    const firestore = getFirestore();
    const teacherRef = firestore.collection('teachers').doc(teacherId);
    const coursesRef = firestore.collection('courses');
    const existingSnapshot = await coursesRef.where('teacherId', '==', teacherId).get();
    const activeCourses = existingSnapshot.docs.filter((document) => document.data().archived !== true);
    if (existingSnapshot.docs.some((document) => document.data().code?.trim().toUpperCase() === code)) {
      throw new HttpsError('already-exists', 'That class code is already in use. Choose a different code.');
    }
    const teacher = (await teacherRef.get()).data();
    if (!canCreateCourse(teacher?.billing, activeCourses.length)) {
      throw new HttpsError('resource-exhausted', 'Your current plan includes one active class. Archive it or choose a plan that supports more classes.');
    }

    const courseRef = coursesRef.doc();
    const starterInteractions = Array.isArray(request.data?.interactionTemplates) ? request.data.interactionTemplates.slice(0, 40) : [];
    await courseRef.set({
      name,
      code,
      ...(term ? { term } : {}),
      ...(sourceCourseId ? { sourceCourseId } : {}),
      teacherId,
      studentIds: [],
      interactionTemplates: starterInteractions,
      archived: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { courseId: courseRef.id };
  },
);

exports.startInstructorSession = onCall(
  { region: FUNCTION_REGION, cors: ['https://classfully.com', /localhost:\d+$/] },
  async (request) => {
    const teacherId = requireInstructor(request);
    const sessionId = cleanString(request.data?.sessionId, 160);
    if (!sessionId) throw new HttpsError('invalid-argument', 'Choose the session you want to start.');
    const firestore = getFirestore();
    const teacherRef = firestore.collection('teachers').doc(teacherId);
    const sessionRef = firestore.collection('sessions').doc(sessionId);

    return firestore.runTransaction(async (transaction) => {
      const [teacherSnapshot, sessionSnapshot] = await Promise.all([
        transaction.get(teacherRef),
        transaction.get(sessionRef),
      ]);
      if (!teacherSnapshot.exists || !sessionSnapshot.exists) throw new HttpsError('not-found', 'That session could not be found.');
      const session = sessionSnapshot.data();
      if (session.teacherId !== teacherId) throw new HttpsError('permission-denied', 'This session belongs to another instructor.');
      const teacher = teacherSnapshot.data();
      const access = accessSnapshot(teacher.billing);
      if (session.startedAt || session.billingSessionClaimedAt) {
        if (!session.active) transaction.update(sessionRef, { active: true, lastActivityAt: Timestamp.now() });
        return { alreadyCounted: true, billing: billingPayload(teacher) };
      }
      if (!access.canStartSession) {
        throw new HttpsError('resource-exhausted', 'Your six-session pilot is complete. Choose a plan to start another live class.');
      }

      const now = Timestamp.now();
      transaction.update(sessionRef, { active: true, startedAt: now, lastActivityAt: now, billingSessionClaimedAt: now });
      if (!access.paid) {
        transaction.set(teacherRef, {
          billing: {
            ...(teacher.billing || {}),
            plan: 'pilot',
            status: 'pilot',
            pilotSessionsUsed: access.pilotSessionsUsed + 1,
            updatedAt: now,
          },
        }, { merge: true });
      }
      return { alreadyCounted: false, billing: billingPayload({ ...teacher, billing: { ...(teacher.billing || {}), pilotSessionsUsed: access.paid ? access.pilotSessionsUsed : access.pilotSessionsUsed + 1 } }) };
    });
  },
);

exports.claimStudentAttendance = onCall(
  { region: FUNCTION_REGION, cors: ['https://classfully.com', /localhost:\d+$/] },
  async (request) => {
    const studentUid = request.auth?.uid;
    if (!studentUid || request.auth.token?.firebase?.sign_in_provider !== 'anonymous') {
      throw new HttpsError('unauthenticated', 'Join from the student class page to continue.');
    }
    const ownerUid = cleanString(request.data?.ownerUid, 160);
    const sessionId = cleanString(request.data?.sessionId, 160);
    const studentNumber = cleanString(request.data?.studentNumber, 32).toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9._-]/g, '');
    const studentDisplayName = cleanString(request.data?.studentDisplayName, 60).replace(/\s+/g, ' ');
    const requestedMode = cleanString(request.data?.participationMode, 32);
    if (!ownerUid || !sessionId) throw new HttpsError('invalid-argument', 'This class link is incomplete.');

    const firestore = getFirestore();
    const teacherRef = firestore.collection('teachers').doc(ownerUid);
    const sessionRef = firestore.collection('sessions').doc(sessionId);
    const sessionSnapshot = await sessionRef.get();
    const session = sessionSnapshot.data();
    if (!sessionSnapshot.exists || session?.teacherId !== ownerUid || session?.active !== true) {
      throw new HttpsError('failed-precondition', 'This class is not open for students right now.');
    }
    const participationMode = ['course-record', 'session-name', 'anonymous'].includes(session.participationMode)
      ? session.participationMode
      : 'course-record';
    if (requestedMode && requestedMode !== participationMode) throw new HttpsError('failed-precondition', 'The instructor changed how this class is joining. Refresh and try again.');
    if (participationMode === 'course-record' && studentNumber.length < 3) throw new HttpsError('invalid-argument', 'Enter your student number.');
    if (participationMode === 'session-name' && studentDisplayName.length < 2) throw new HttpsError('invalid-argument', 'Enter a name or nickname.');
    const courseId = session.courseId || `session_${sessionId}`;
    const participantKey = participationMode === 'course-record' ? studentNumber : studentUid;
    const memberHash = createHash('sha256').update(`${ownerUid}:${courseId}:${participantKey}`).digest('hex');
    const memberRef = firestore.collection('billingCourseStudents').doc(courseId).collection('members').doc(memberHash);
    const counterRef = firestore.collection('billingCourseStudents').doc(courseId);

    if (participationMode === 'course-record') {
      await firestore.runTransaction(async (transaction) => {
        const [teacherSnapshot, memberSnapshot, counterSnapshot] = await Promise.all([
          transaction.get(teacherRef),
          transaction.get(memberRef),
          transaction.get(counterRef),
        ]);
        const teacher = teacherSnapshot.data();
        const access = accessSnapshot(teacher?.billing);
        const currentCount = Math.max(0, Number(counterSnapshot.data()?.studentCount) || 0);
        const limit = access.limits.studentsPerCourse;
        if (!memberSnapshot.exists && limit !== null && currentCount >= limit) {
          throw new HttpsError('resource-exhausted', 'This class has reached its student limit. Ask your instructor for help.');
        }
        if (!memberSnapshot.exists) {
          transaction.set(memberRef, { teacherId: ownerUid, courseId, firstJoinedAt: Timestamp.now() });
          transaction.set(counterRef, { teacherId: ownerUid, courseId, studentCount: currentCount + 1, updatedAt: Timestamp.now() }, { merge: true });
        }
      });
    } else {
      const [teacherSnapshot, attendanceSnapshot] = await Promise.all([
        teacherRef.get(),
        getDatabase().ref(`liveV2/${ownerUid}/${sessionId}/attendanceClaims`).once('value'),
      ]);
      const access = accessSnapshot(teacherSnapshot.data()?.billing);
      const limit = access.limits.studentsPerCourse;
      const attendance = attendanceSnapshot.val() || {};
      if (!attendance[studentUid] && limit !== null && Object.keys(attendance).length >= limit) {
        throw new HttpsError('resource-exhausted', 'This class has reached its student limit. Ask your instructor for help.');
      }
    }

    const claimRef = getDatabase().ref(`liveV2/${ownerUid}/${sessionId}/attendanceClaims/${studentUid}`);
    const result = await claimRef.transaction((current) => {
      const now = Date.now();
      if (current?.status === 'participated' && current.participationMode !== participationMode) return;
      return {
        studentUid,
        participationMode,
        ...(participationMode === 'course-record' ? { studentNumber } : {}),
        ...(participationMode === 'session-name' && studentDisplayName ? { studentDisplayName } : participationMode === 'course-record' && studentDisplayName ? { studentDisplayName } : {}),
        status: current?.status || 'claimed',
        joinedAt: current?.joinedAt || now,
        updatedAt: now,
        ...(participationMode !== 'anonymous' ? { privacyNoticeVersion: '2026-08-08', privacyNoticeAcknowledgedAt: now } : {}),
        ...(current?.participatedAt ? { participatedAt: current.participatedAt } : {}),
      };
    }, undefined, false);
    const claim = result.snapshot.val();
    if (!result.committed || claim?.participationMode !== participationMode || (participationMode === 'course-record' && claim?.studentNumber !== studentNumber)) {
      throw new HttpsError('already-exists', 'This device has already joined this session another way. Refresh the page or ask your instructor for help.');
    }
    return claim;
  },
);

async function teacherForStripeCustomer(customerId, metadata = {}) {
  const firestore = getFirestore();
  const firebaseUid = metadata.firebaseUid;
  if (firebaseUid) return firestore.collection('teachers').doc(firebaseUid);
  const snapshot = await firestore.collection('teachers').where('billing.stripeCustomerId', '==', customerId).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0].ref;
}

async function applyStripeSubscription(subscription, eventCreatedAt = 0) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;
  const item = subscription.items?.data?.[0];
  const plan = subscription.metadata?.classfullyPlan || planFromPriceId(item?.price?.id);
  if (!plan) throw new Error(`Unknown Classfully price ${item?.price?.id || 'without an ID'}.`);
  const teacherRef = await teacherForStripeCustomer(customerId, subscription.metadata || {});
  if (!teacherRef) throw new Error(`No Classfully instructor found for Stripe customer ${customerId}.`);
  const teacherSnapshot = await teacherRef.get();
  const currentBilling = teacherSnapshot.data()?.billing || {};
  if (eventCreatedAt && Number(currentBilling.lastStripeEventCreated || 0) > eventCreatedAt) return;
  const status = stripeStatus(subscription.status);
  const periodEndSeconds = item?.current_period_end || subscription.current_period_end;
  const graceEndsAt = status === 'past_due'
    ? currentBilling.status === 'past_due' && currentBilling.graceEndsAt
      ? currentBilling.graceEndsAt
      : Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000)
    : null;
  await teacherRef.set({
    billing: {
      ...currentBilling,
      plan,
      status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: item?.price?.id || null,
      currentPeriodEnd: dateTimestamp(periodEndSeconds),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      graceEndsAt,
      lastStripeEventCreated: eventCreatedAt || currentBilling.lastStripeEventCreated || 0,
      updatedAt: Timestamp.now(),
    },
  }, { merge: true });
}

exports.stripeBillingWebhook = onRequest(
  { region: FUNCTION_REGION, secrets: [stripeRestrictedKey, stripeWebhookSecret, stripeTermPriceId, stripeAnnualPriceId, ga4ApiSecret], cors: false },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).send('Method not allowed');
      return;
    }
    const signature = request.headers['stripe-signature'];
    if (!signature) {
      response.status(400).send('Missing Stripe signature');
      return;
    }
    let event;
    try {
      event = stripeClient().webhooks.constructEvent(request.rawBody, signature, stripeWebhookSecret.value());
    } catch (error) {
      console.warn('Stripe webhook signature rejected.', error instanceof Error ? error.message : error);
      response.status(400).send('Invalid signature');
      return;
    }

    const eventRef = getFirestore().collection('stripeWebhookEvents').doc(event.id);
    const claimed = await getFirestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(eventRef);
      const current = snapshot.data();
      const updatedAt = current?.updatedAt?.toMillis?.() || 0;
      const activeClaim = current?.status === 'processing' && Date.now() - updatedAt < 15 * 60 * 1000;
      if (current?.status === 'processed' || activeClaim) return false;
      transaction.set(eventRef, { type: event.type, status: 'processing', updatedAt: Timestamp.now() }, { merge: true });
      return true;
    });
    if (!claimed) {
      response.status(200).json({ received: true, duplicate: true });
      return;
    }

    try {
      if (event.type.startsWith('customer.subscription.')) {
        await applyStripeSubscription(event.data.object, event.created);
      } else if (event.type === 'checkout.session.completed' && event.data.object.subscription) {
        const subscription = typeof event.data.object.subscription === 'string'
          ? await stripeClient().subscriptions.retrieve(event.data.object.subscription)
          : event.data.object.subscription;
        await applyStripeSubscription(subscription, event.created);
        // After the subscription is applied, and never allowed to fail the
        // webhook: a retry would re-run the write that already succeeded.
        await sendPurchase(event.data.object, {
          measurementId: ga4MeasurementId.value(),
          apiSecret: ga4ApiSecret.value(),
        });
      }
      await eventRef.set({ status: 'processed', processedAt: Timestamp.now(), updatedAt: Timestamp.now() }, { merge: true });
      response.status(200).json({ received: true });
    } catch (error) {
      await eventRef.set({ status: 'failed', error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown webhook error', updatedAt: Timestamp.now() }, { merge: true });
      console.error(`Stripe webhook ${event.id} failed.`, error);
      response.status(500).send('Webhook processing failed');
    }
  },
);

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
      sessionDate: formatDate(report.endedAt, teacher.timeZone || 'UTC'),
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
    schedule: '5 * * * *',
    timeZone: 'UTC',
    region: FUNCTION_REGION,
    timeoutSeconds: 540,
    memory: '512MiB',
    secrets: [postmarkServerToken],
    retryCount: 2,
  },
  async (event) => {
    const firestore = getFirestore();
    const now = event.scheduleTime ? new Date(event.scheduleTime) : new Date();
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const teacherSnapshot = await firestore.collection('teachers').get();

    for (const teacherDocument of teacherSnapshot.docs) {
      const teacherId = teacherDocument.id;
      const teacher = teacherDocument.data();
      if (!teacher?.email || !teacher.timeZone || !notificationPreferences(teacher).weeklyCourseDigest) continue;
      if (!isWeeklyDigestSendTime(now, teacher.timeZone)) continue;

      const periodKey = localPeriodKey(now, teacher.timeZone);
      if (!periodKey) continue;
      const sessionSnapshot = await firestore.collection('sessions').where('teacherId', '==', teacherId).get();
      const sessions = sessionSnapshot.docs
        .map((document) => ({ sessionId: document.id, session: document.data() }))
        .filter(({ session }) => {
          const endedAt = timestampToDate(session.endedAt);
          return session.active === false && session.endedAt && endedAt >= start && endedAt < now;
        });
      if (!sessions.length) continue;

      const reports = await Promise.all(sessions.map(({ sessionId, session }) => loadSessionReport(sessionId, session)));
      const weekly = collectWeeklyMetrics(reports);
      const email = renderWeeklyDigestEmail({
        recipientName: teacher.name || 'there',
        weekLabel: `Week of ${formatDate(start, teacher.timeZone)}`,
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
