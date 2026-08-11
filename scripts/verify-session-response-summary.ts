import assert from 'node:assert/strict';
import {
  countClassroomResponses,
  interactionRunSummariesDiffer,
  reconcileInteractionRuns,
} from '../src/lib/session-response-summary';
import type { SessionInteraction, SessionInteractionRun } from '../src/types';
import type { StoredLiveResponse } from '../src/lib/firebase/live-classroom';

const response = (
  id: string,
  runId: string,
  interactionId: string,
  submittedAt: number,
  extra: Partial<StoredLiveResponse> = {},
): StoredLiveResponse => ({ id, runId, interactionId, studentUid: id, submittedAt, ...extra });

const interactions = [
  { id: 'poll-1', type: 'poll', title: 'Poll', prompt: 'Choose one' },
  { id: 'group-1', type: 'group-work', title: 'Group work', prompt: 'Work together' },
] satisfies SessionInteraction[];

const savedRuns = [{
  id: 'run-1',
  interactionId: 'poll-1',
  startedAt: 100,
  updatedAt: 100,
  status: 'completed',
  responseCount: 0,
}] satisfies SessionInteractionRun[];

const responseRuns = {
  'run-1': {
    studentA: response('studentA', 'run-1', 'poll-1', 110),
    studentB: response('studentB', 'run-1', 'poll-1', 120),
  },
  'run-2': {
    studentA: response('studentA-2', 'run-2', 'group-1', 210, { teamId: 'team-a' }),
    studentB: response('studentB-2', 'run-2', 'group-1', 220, { teamId: 'team-a' }),
  },
};

const reconciled = reconcileInteractionRuns(savedRuns, responseRuns, interactions);
assert.equal(reconciled.length, 2, 'a response run missing from Firestore should be reconstructed');
assert.equal(reconciled.find((run) => run.id === 'run-1')?.responseCount, 2, 'stored responses should replace a stale zero count');
assert.equal(reconciled.find((run) => run.id === 'run-2')?.responseCount, 1, 'group work should count participating teams');
assert.equal(countClassroomResponses(responseRuns), 4, 'the session total should count individual submissions');
assert.equal(interactionRunSummariesDiffer(savedRuns, reconciled), true, 'a repaired summary should be detected for persistence');

const alreadyCorrect = [{ ...savedRuns[0], responseCount: 3 }];
const preserved = reconcileInteractionRuns(alreadyCorrect, { 'run-1': responseRuns['run-1'] }, interactions);
assert.equal(preserved[0].responseCount, 3, 'a durable summary must not be reduced when live records are incomplete');
assert.equal(interactionRunSummariesDiffer(alreadyCorrect, preserved), false, 'an unchanged summary should not trigger a write');

console.log('Session response reconciliation checks passed.');
