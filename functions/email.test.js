'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderWelcomeEmail, renderTeachingTeamWelcomeEmail, renderAfterClassReportEmail, renderWeeklyDigestEmail } = require('./email');

test('welcome email has one clear first-class action', () => {
  const email = renderWelcomeEmail({ recipientName: 'Tareef' });
  assert.equal(email.subject, 'Welcome to Classfully');
  assert.match(email.html, /Create your first class/);
  assert.match(email.text, /Plan one useful moment/);
  assert.doesNotMatch(email.text, /Worth carrying forward/);
});

test('co-instructor welcome opens the shared course instead of creating one', () => {
  const email = renderTeachingTeamWelcomeEmail({
    recipientName: 'Ari',
    role: 'co-instructor',
    scope: 'course',
    courseName: 'Platform Strategy',
    courseCode: 'ECON 302',
    ctaUrl: 'https://classfully.com/dashboard/classes/course-1',
  });
  assert.equal(email.subject, 'Welcome to Platform Strategy');
  assert.match(email.text, /Open the shared course/);
  assert.match(email.text, /plan sessions, run class, and review student progress/i);
  assert.doesNotMatch(email.text, /Create your first class/);
});

test('progress-viewer welcome only promises review access', () => {
  const email = renderTeachingTeamWelcomeEmail({
    recipientName: 'Sam',
    role: 'progress-viewer',
    scope: 'workspace',
    ctaUrl: 'https://classfully.com/dashboard/progress',
  });
  assert.match(email.text, /Review student progress/);
  assert.match(email.text, /teaching controls stay with the instructors/i);
  assert.doesNotMatch(email.text, /run class/i);
});

test('after-class report renders only collected metrics', () => {
  const email = renderAfterClassReportEmail({
    recipientName: 'Tareef',
    courseCode: 'ECON 302',
    courseName: 'Microeconomics',
    sessionTitle: 'Platform strategy',
    sessionDate: 'August 11, 2026',
    metrics: [
      { label: 'Attendance', value: '102', note: 'students present', color: 'green' },
      { label: 'Participation', value: '99%', note: 'contributed', color: 'violet' },
    ],
    insightTitle: 'Most of the room contributed.',
    insightBody: '101 of 102 students submitted a response.',
    actions: [],
    dashboardUrl: 'https://classfully.com/dashboard/sessions/example',
  });
  assert.match(email.html, /width="50%"/);
  assert.doesNotMatch(email.html, /Confidence/);
  assert.doesNotMatch(email.html, /Not tracked/);
});

test('weekly digest uses one useful review action', () => {
  const email = renderWeeklyDigestEmail({
    recipientName: 'Maya',
    weekLabel: 'Week of August 10, 2026',
    metrics: [{ label: 'Sessions', value: '3', note: 'completed', color: 'violet' }],
    insightTitle: 'The week now has a pattern.',
    insightBody: 'Three sessions added to the record.',
    actions: [{ title: 'Plan from the pattern', body: 'Choose what to repeat next.' }],
  });
  assert.equal(email.subject, 'Your Classfully week, at a glance');
  assert.match(email.html, /Open your teaching review/);
});
