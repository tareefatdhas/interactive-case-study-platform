'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderWelcomeEmail, renderAfterClassReportEmail, renderWeeklyDigestEmail } = require('./email');

test('welcome email has one clear first-class action', () => {
  const email = renderWelcomeEmail({ recipientName: 'Tareef' });
  assert.equal(email.subject, 'Welcome to Classfully');
  assert.match(email.html, /Create your first class/);
  assert.match(email.text, /Plan one useful moment/);
  assert.doesNotMatch(email.text, /Worth carrying forward/);
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
