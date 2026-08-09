'use strict';

const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

function collectExpiredRooms(liveRooms, now = Date.now()) {
  const cutoff = now - RETENTION_MS;
  const expired = [];

  for (const [ownerUid, ownerRooms] of Object.entries(liveRooms || {})) {
    if (!ownerRooms || typeof ownerRooms !== 'object') continue;

    for (const [sessionId, room] of Object.entries(ownerRooms)) {
      if (!room || typeof room !== 'object') continue;
      const meta = room.meta && typeof room.meta === 'object' ? room.meta : {};
      const lastRecordedAt = Number(meta.updatedAt || meta.createdAt || 0);
      if (!Number.isFinite(lastRecordedAt) || lastRecordedAt <= 0 || lastRecordedAt >= cutoff) continue;

      expired.push({
        ownerUid,
        sessionId,
        sessionCode: typeof meta.sessionCode === 'string' ? meta.sessionCode : '',
        lastRecordedAt,
      });
    }
  }

  return expired;
}

module.exports = { RETENTION_DAYS, collectExpiredRooms };
