'use strict';

const PILOT_SESSION_LIMIT = 6;
const PLAN_LIMITS = Object.freeze({
  pilot: { activeCourses: 1, studentsPerCourse: 200, liveSessions: PILOT_SESSION_LIMIT },
  instructor_term: { activeCourses: 5, studentsPerCourse: 300, liveSessions: null },
  instructor_annual: { activeCourses: 5, studentsPerCourse: 300, liveSessions: null },
  institution: { activeCourses: null, studentsPerCourse: null, liveSessions: null },
});

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBilling(billing = {}) {
  const plan = Object.hasOwn(PLAN_LIMITS, billing.plan) ? billing.plan : 'pilot';
  const status = typeof billing.status === 'string' ? billing.status : 'pilot';
  return {
    plan,
    status,
    pilotSessionsUsed: Math.max(0, Number(billing.pilotSessionsUsed) || 0),
    stripeCustomerId: billing.stripeCustomerId || null,
    stripeSubscriptionId: billing.stripeSubscriptionId || null,
    currentPeriodEnd: billing.currentPeriodEnd || null,
    graceEndsAt: billing.graceEndsAt || null,
    cancelAtPeriodEnd: Boolean(billing.cancelAtPeriodEnd),
  };
}

function hasPaidAccess(billing, now = Date.now()) {
  if (billing.plan === 'institution' && billing.status === 'active') return true;
  if (!['instructor_term', 'instructor_annual'].includes(billing.plan)) return false;
  if (['active', 'trialing'].includes(billing.status)) return true;
  if (billing.status === 'past_due' && timestampMillis(billing.graceEndsAt) > now) return true;
  if (billing.status === 'canceled' && timestampMillis(billing.currentPeriodEnd) > now) return true;
  return false;
}

function accessSnapshot(rawBilling, now = Date.now()) {
  const billing = normalizeBilling(rawBilling);
  const paid = hasPaidAccess(billing, now);
  const effectivePlan = paid ? billing.plan : 'pilot';
  const limits = PLAN_LIMITS[effectivePlan];
  const sessionsRemaining = limits.liveSessions === null
    ? null
    : Math.max(0, limits.liveSessions - billing.pilotSessionsUsed);

  return {
    ...billing,
    effectivePlan,
    paid,
    limits,
    sessionsRemaining,
    canStartSession: paid || sessionsRemaining > 0,
  };
}

function canCreateCourse(rawBilling, activeCourseCount, now = Date.now()) {
  const access = accessSnapshot(rawBilling, now);
  return access.limits.activeCourses === null || activeCourseCount < access.limits.activeCourses;
}

module.exports = {
  PILOT_SESSION_LIMIT,
  PLAN_LIMITS,
  accessSnapshot,
  canCreateCourse,
  hasPaidAccess,
  normalizeBilling,
  timestampMillis,
};
