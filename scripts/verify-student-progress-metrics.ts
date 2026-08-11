import assert from 'node:assert/strict';
import { Timestamp } from 'firebase/firestore';
import { countPlayedParticipationOpportunities, selectDefaultProgressCourseId } from '../src/lib/student-progress-metrics';
import type { Course, Session, SessionInteraction, SessionInteractionRun } from '../src/types';
import type { StoredLiveResponse } from '../src/lib/firebase/live-classroom';

const interactions: SessionInteraction[] = [
  { id: 'played', type: 'poll', title: 'Played poll', prompt: 'Choose one' },
  { id: 'unused', type: 'quiz', title: 'Unused quiz', prompt: 'Choose one' },
  { id: 'timer', type: 'timer', title: 'Group work', prompt: 'Work together' },
];

const runs: SessionInteractionRun[] = [
  { id: 'played-run', interactionId: 'played', startedAt: 100, updatedAt: 200, endedAt: 200, status: 'completed', responseCount: 1 },
  { id: 'unused-run', interactionId: 'unused', startedAt: 210, updatedAt: 220, endedAt: 220, status: 'completed', responseCount: 0 },
  { id: 'timer-run', interactionId: 'timer', startedAt: 230, updatedAt: 300, endedAt: 300, status: 'completed', responseCount: 1 },
];

const response = (runId: string, interactionId: string, studentUid: string, submittedAt: number): StoredLiveResponse => ({
  id: `${runId}-${studentUid}`,
  runId,
  interactionId,
  studentUid,
  optionIndex: 0,
  submittedAt,
});

const responseRuns = {
  'played-run': { a: response('played-run', 'played', 'a', 150) },
  'timer-run': { a: response('timer-run', 'timer', 'a', 260) },
};

assert.equal(countPlayedParticipationOpportunities({ runs, interactions, responseRuns, studentUid: 'b', joinedAt: 50 }), 1, 'Only the played response moment should count.');
assert.equal(countPlayedParticipationOpportunities({ runs, interactions, responseRuns, studentUid: 'b', joinedAt: 205 }), 0, 'A student should not be docked for a moment that ended before they joined.');
assert.equal(countPlayedParticipationOpportunities({ runs, interactions, responseRuns, studentUid: 'a', joinedAt: 205 }), 1, 'A submitted response should always count as its own opportunity.');
assert.equal(countPlayedParticipationOpportunities({ runs: [runs[1]], interactions, responseRuns: {}, studentUid: 'b', joinedAt: 50 }), 0, 'A zero-response run is not a played participation moment.');

const course = (id: string, code: string, createdAt: number): Course => ({
  id,
  code,
  name: `${code} course`,
  teacherId: 'teacher',
  studentIds: [],
  createdAt: Timestamp.fromMillis(createdAt),
});
const classroom = (id: string, courseId: string, startedAt: number): Session => ({
  id,
  courseId,
  sessionCode: id,
  sessionType: 'standalone',
  teacherId: 'teacher',
  active: false,
  studentsJoined: ['student'],
  releasedSections: [],
  currentReleasedSection: -1,
  createdAt: Timestamp.fromMillis(startedAt - 10),
  startedAt: Timestamp.fromMillis(startedAt),
});
const oldCourse = course('old-course', 'OLD101', 10);
const currentCourse = course('current-course', 'NOW201', 20);
const courseSessions = [classroom('old-session', oldCourse.id, 100), classroom('current-session', currentCourse.id, 500)];

assert.equal(selectDefaultProgressCourseId([oldCourse, currentCourse], courseSessions), currentCourse.id, 'The most recently taught class should be the default.');
assert.equal(selectDefaultProgressCourseId([oldCourse, currentCourse], courseSessions, oldCourse.id), oldCourse.id, 'A class supplied in the URL should remain selected.');
assert.equal(selectDefaultProgressCourseId([oldCourse, currentCourse], courseSessions, 'all'), 'all', 'An explicit all-classes view should remain available.');

console.log('Student progress participation metrics verified.');
