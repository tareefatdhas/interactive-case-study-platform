'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { accessSnapshot, canCreateCourse } = require('./billing');

test('pilot includes six live sessions and one active course', () => {
  const access = accessSnapshot({ plan: 'pilot', pilotSessionsUsed: 2 });
  assert.equal(access.sessionsRemaining, 4);
  assert.equal(access.canStartSession, true);
  assert.equal(access.limits.activeCourses, 1);
  assert.equal(access.limits.studentsPerCourse, 200);
  assert.equal(canCreateCourse(access, 0), true);
  assert.equal(canCreateCourse(access, 1), false);
});

test('pilot stops new live sessions after six without removing course access', () => {
  const access = accessSnapshot({ plan: 'pilot', pilotSessionsUsed: 6 });
  assert.equal(access.sessionsRemaining, 0);
  assert.equal(access.canStartSession, false);
});

test('paid plans have unlimited sessions while active', () => {
  const access = accessSnapshot({ plan: 'instructor_term', status: 'active', pilotSessionsUsed: 6 });
  assert.equal(access.paid, true);
  assert.equal(access.sessionsRemaining, null);
  assert.equal(access.canStartSession, true);
  assert.equal(access.limits.activeCourses, 5);
});

test('past-due subscriptions keep a short grace period', () => {
  const now = Date.UTC(2026, 7, 12);
  assert.equal(accessSnapshot({
    plan: 'instructor_annual',
    status: 'past_due',
    graceEndsAt: now + 60_000,
    pilotSessionsUsed: 6,
  }, now).canStartSession, true);
  assert.equal(accessSnapshot({
    plan: 'instructor_annual',
    status: 'past_due',
    graceEndsAt: now - 1,
    pilotSessionsUsed: 6,
  }, now).canStartSession, false);
});

test('canceling at period end keeps paid access until that date', () => {
  const now = Date.UTC(2026, 7, 12);
  assert.equal(accessSnapshot({
    plan: 'instructor_term',
    status: 'canceled',
    currentPeriodEnd: now + 60_000,
    pilotSessionsUsed: 6,
  }, now).paid, true);
  assert.equal(accessSnapshot({
    plan: 'instructor_term',
    status: 'canceled',
    currentPeriodEnd: now - 1,
    pilotSessionsUsed: 6,
  }, now).paid, false);
});

test('institution workspaces do not impose course or student limits', () => {
  const access = accessSnapshot({ plan: 'institution', status: 'active' });
  assert.equal(access.limits.activeCourses, null);
  assert.equal(access.limits.studentsPerCourse, null);
  assert.equal(canCreateCourse(access, 200), true);
});
