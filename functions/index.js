'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { RETENTION_DAYS, collectExpiredRooms } = require('./retention');

initializeApp();

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
