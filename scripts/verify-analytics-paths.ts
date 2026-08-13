import assert from 'node:assert/strict';
import {
  bucketDuration,
  bucketParticipants,
  buildPageLocation,
  failureReason,
  isMeasuredPath,
  isStudentSurface,
  normalizePath,
} from '../src/lib/analytics/config';

const origin = 'https://classfully.com';

// Record identifiers collapse to route templates, so reports have one row per
// route instead of one per session, class, or course.
assert.equal(normalizePath('/session/8QK2ZP'), '/session/[code]');
assert.equal(normalizePath('/dashboard/sessions/abc123'), '/dashboard/sessions/[id]');
assert.equal(normalizePath('/dashboard/sessions/abc123/presentation'), '/dashboard/sessions/[id]/presentation');
assert.equal(normalizePath('/dashboard/case-studies/xyz789'), '/dashboard/case-studies/[id]');
assert.equal(normalizePath('/dashboard/case-studies/xyz789/edit'), '/dashboard/case-studies/[id]/edit');
assert.equal(normalizePath('/dashboard/classes/course-1'), '/dashboard/classes/[id]');
assert.equal(normalizePath('/teams/course-1'), '/teams/[courseId]');

// Static routes that sit where a dynamic segment would are left alone.
assert.equal(normalizePath('/dashboard/sessions/new'), '/dashboard/sessions/new');
assert.equal(normalizePath('/dashboard/case-studies/new'), '/dashboard/case-studies/new');
assert.equal(normalizePath('/dashboard/case-studies/generate'), '/dashboard/case-studies/generate');

// Blog slugs stay intact: per-article traffic is the point of tracking them.
assert.equal(normalizePath('/blog/interactive-lecture-without-rebuilding-slides'), '/blog/interactive-lecture-without-rebuilding-slides');
assert.equal(normalizePath('/pricing/'), '/pricing');
assert.equal(normalizePath('/'), '/');

// Campaign parameters survive. Everything else is dropped, including the
// Firebase UID and session id that live-classroom URLs carry.
assert.equal(
  buildPageLocation('/join', new URLSearchParams('code=8QK2ZP&utm_source=linkedin&utm_medium=social'), origin),
  'https://classfully.com/join?utm_source=linkedin&utm_medium=social',
);
assert.equal(
  buildPageLocation('/live', new URLSearchParams('sessionId=abc123'), origin),
  'https://classfully.com/live',
);
assert.equal(
  buildPageLocation('/live/student', new URLSearchParams('sessionId=abc&ownerUid=uid_1'), origin),
  'https://classfully.com/live/student',
);
assert.equal(
  buildPageLocation('/dashboard/settings', new URLSearchParams('billing=success&email=someone@example.edu'), origin),
  'https://classfully.com/dashboard/settings?billing=success',
);

// In-lesson surfaces are never measured. The instructor console is.
assert.equal(isMeasuredPath('/live/student'), false);
assert.equal(isMeasuredPath('/live/display'), false);
assert.equal(isMeasuredPath('/live/remote'), false);
assert.equal(isMeasuredPath('/session/8QK2ZP'), false);
assert.equal(isMeasuredPath('/live'), true);
assert.equal(isMeasuredPath('/join'), true);
assert.equal(isMeasuredPath('/'), true);

// The join page is measured but still labels the visitor as a student, which is
// what lets marketing reports exclude a lecture hall.
assert.equal(isStudentSurface('/join'), true);
assert.equal(isStudentSurface('/live/student'), true);
assert.equal(isStudentSurface('/session/8QK2ZP'), true);
assert.equal(isStudentSurface('/students'), false);
assert.equal(isStudentSurface('/dashboard'), false);

// Counts and durations report as bands, so a small class is not identifiable.
assert.equal(bucketParticipants(0), '0');
assert.equal(bucketParticipants(1), '1-9');
assert.equal(bucketParticipants(30), '30-59');
assert.equal(bucketParticipants(240), '120+');
assert.equal(bucketDuration(4 * 60_000), '0-5m');
assert.equal(bucketDuration(45 * 60_000), '30-60m');
assert.equal(bucketDuration(180 * 60_000), '120m+');

// Failure reasons are stable codes, never raw messages that could carry an
// email address or a class code.
assert.equal(failureReason({ code: 'auth/email-already-in-use' }), 'auth_email_already_in_use');
assert.equal(failureReason('class_not_found'), 'class_not_found');
assert.equal(failureReason(new Error('No account for someone@example.edu')), 'error');
assert.equal(failureReason(undefined), 'unknown');

console.log('Analytics path, redaction, and bucketing rules verified.');
