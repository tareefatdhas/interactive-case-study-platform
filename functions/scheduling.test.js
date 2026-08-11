'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidTimeZone, isWeeklyDigestSendTime, localPeriodKey } = require('./scheduling');

test('recognizes 8 AM Monday in each instructor timezone', () => {
  assert.equal(isWeeklyDigestSendTime(new Date('2026-08-10T01:05:00Z'), 'Asia/Bangkok'), true);
  assert.equal(isWeeklyDigestSendTime(new Date('2026-08-10T12:05:00Z'), 'America/New_York'), true);
  assert.equal(isWeeklyDigestSendTime(new Date('2026-08-10T08:05:00Z'), 'Europe/London'), false);
});

test('uses the instructor local date for the delivery key', () => {
  assert.equal(localPeriodKey(new Date('2026-08-10T01:05:00Z'), 'Asia/Bangkok'), '2026-08-10');
  assert.equal(localPeriodKey(new Date('2026-08-10T03:05:00Z'), 'America/New_York'), '2026-08-09');
});

test('rejects missing or invalid timezones', () => {
  assert.equal(isValidTimeZone('Asia/Bangkok'), true);
  assert.equal(isValidTimeZone('Not/A_Timezone'), false);
  assert.equal(isWeeklyDigestSendTime(new Date(), undefined), false);
});
