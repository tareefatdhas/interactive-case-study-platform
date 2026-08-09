'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RETENTION_DAYS, collectExpiredRooms } = require('./retention');

test('collects rooms older than the retention window', () => {
  const now = Date.UTC(2026, 7, 9, 8);
  const old = now - (RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000;
  const recent = now - (RETENTION_DAYS - 1) * 24 * 60 * 60 * 1000;

  const result = collectExpiredRooms({
    teacherA: {
      expiredSession: { meta: { sessionCode: 'ABC123', updatedAt: old } },
      currentSession: { meta: { sessionCode: 'DEF456', updatedAt: recent } },
    },
  }, now);

  assert.deepEqual(result, [{
    ownerUid: 'teacherA',
    sessionId: 'expiredSession',
    sessionCode: 'ABC123',
    lastRecordedAt: old,
  }]);
});

test('ignores malformed rooms instead of deleting uncertain records', () => {
  const result = collectExpiredRooms({ teacherA: { missingTimestamp: { meta: {} } } });
  assert.deepEqual(result, []);
});
