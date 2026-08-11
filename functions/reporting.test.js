'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { collectSessionMetrics, collectWeeklyMetrics } = require('./reporting');

test('collects live attendance, responses, and unresolved questions without student details', () => {
  const metrics = collectSessionMetrics({
    session: { studentsJoined: ['1', '2', '3'] },
    liveRoom: {
      attendanceClaims: { a: { status: 'participated' }, b: { status: 'claimed' }, c: { status: 'participated' } },
      responses: { run1: { a: { optionIndex: 0 }, c: { optionIndex: 1 } } },
      welcomeResponses: { 1: { a: { mood: 'steady' } } },
      studentQuestions: { a: { q1: { id: 1 } }, c: { q2: { id: 2 } } },
      recognizedQuestions: { 1: true },
    },
    legacyResponses: [],
  });
  assert.equal(metrics.attendance, 3);
  assert.equal(metrics.participantCount, 2);
  assert.equal(metrics.participationRate, 67);
  assert.equal(metrics.responseCount, 3);
  assert.equal(metrics.openQuestions, 1);
  assert.deepEqual(metrics.metrics.map((metric) => metric.label), ['Attendance', 'Participation', 'Responses', 'Questions']);
});

test('omits metrics that were not collected', () => {
  const metrics = collectSessionMetrics({ session: {}, liveRoom: {}, legacyResponses: [] });
  assert.deepEqual(metrics.metrics, []);
  assert.doesNotMatch(metrics.insightBody, /Not tracked|Not asked/);
});

test('weekly digest combines completed session summaries', () => {
  const weekly = collectWeeklyMetrics([
    { courseId: 'a', attendance: 100, participationRate: 80, responseCount: 160, openQuestions: 2 },
    { courseId: 'a', attendance: 90, participationRate: 60, responseCount: 100, openQuestions: 0 },
  ]);
  assert.deepEqual(weekly.metrics.map((metric) => metric.value), ['2', '190', '70%', '260']);
  assert.match(weekly.insightBody, /2 questions remain open/);
});
