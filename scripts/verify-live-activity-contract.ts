import assert from 'node:assert/strict';
import {
  createInteractionResults,
  createPublicInteraction,
  createPublicInteractionResults,
  interactionAcceptsResponses,
  prepareLiveInteractions,
  shouldShowClassDistribution,
  summarizeInteractionResponses,
  type InteractionResults,
  type LiveInteraction,
} from '../src/app/live/live-data';
import type { SessionInteraction, SessionInteractionType } from '../src/types';

const types: SessionInteractionType[] = [
  'pulse',
  'poll',
  'quiz',
  'open-response',
  'word-cloud',
  'peer-learning',
  'team-formation',
  'group-work',
  'timer',
  'spin-wheel',
  'reflection',
  'case-study',
];

const interactions: SessionInteraction[] = types.map((type, index) => ({
  id: `${type}-${index}`,
  type,
  title: `${type} title`,
  prompt: `${type} prompt`,
  options: ['A', 'B', 'C'],
  correctOptionIndex: 1,
  explanation: 'Because B is correct.',
  resultVisibility: type === 'poll' ? 'live' : undefined,
  caseStudyId: type === 'case-study' ? 'case-1' : undefined,
}));

const prepared = prepareLiveInteractions(interactions);
assert.equal(prepared.length, types.length, 'No planned activity should silently disappear from the live plan.');
assert.equal(prepared.find((item) => item.id.startsWith('reflection-'))?.label, 'Reflection');
assert.equal(prepared.find((item) => item.type === 'case-study')?.caseStudyId, 'case-1');

const byType = (type: LiveInteraction['type']) => {
  const interaction = prepared.find((item) => item.type === type);
  assert.ok(interaction, `${type} should be prepared for the live classroom.`);
  return interaction;
};

assert.equal(byType('pulse').resultVisibility, 'instructor-only');
assert.equal(byType('quiz').resultVisibility, 'after-reveal');
assert.equal(byType('peer-learning').resultVisibility, 'after-reveal');
assert.equal(byType('open-response').resultVisibility, 'instructor-only');
assert.equal(byType('group-work').resultVisibility, 'instructor-only');
assert.equal(byType('word-cloud').resultVisibility, 'live');
assert.equal(byType('team-formation').resultVisibility, 'live');

assert.equal(interactionAcceptsResponses(byType('timer')), false);
assert.equal(interactionAcceptsResponses(byType('spin-wheel')), false);
assert.equal(interactionAcceptsResponses(byType('case-study')), false);
assert.equal(interactionAcceptsResponses(byType('poll')), true);

const populatedResults = (interaction: LiveInteraction, revealed: boolean): InteractionResults => ({
  ...createInteractionResults(interaction),
  revealed,
  responseCount: 3,
  optionCounts: [1, 2, 0],
  firstResponseCount: 3,
  firstOptionCounts: [2, 1, 0],
  writtenResponses: [
    { id: 'student-a', text: 'First thought' },
    { id: 'student-b', text: 'Second thought' },
  ],
  sharedResponseId: 'student-b',
});

const pulse = byType('pulse');
const publicPulse = createPublicInteractionResults(pulse, populatedResults(pulse, false));
assert.deepEqual(publicPulse?.optionCounts, pulse.options?.map(() => 0));
assert.equal(publicPulse?.responseCount, 3, 'The projector may show pulse participation without exposing answers.');

const livePoll = byType('poll');
const publicLivePoll = createPublicInteractionResults(livePoll, populatedResults(livePoll, true));
assert.equal(shouldShowClassDistribution(livePoll, publicLivePoll!), true);
assert.deepEqual(publicLivePoll?.optionCounts, [1, 2, 0]);

const heldPoll: LiveInteraction = { ...livePoll, resultVisibility: 'after-reveal' };
const hiddenPoll = createPublicInteractionResults(heldPoll, populatedResults(heldPoll, false));
assert.deepEqual(hiddenPoll?.optionCounts, [0, 0, 0]);
const revealedPoll = createPublicInteractionResults(heldPoll, populatedResults(heldPoll, true));
assert.deepEqual(revealedPoll?.optionCounts, [1, 2, 0]);

const quiz = byType('quiz');
const hiddenQuizResults = populatedResults(quiz, false);
const publicQuiz = createPublicInteraction(quiz, hiddenQuizResults);
assert.equal(publicQuiz?.correctOptionIndex, undefined);
assert.equal(publicQuiz?.explanation, undefined);
assert.deepEqual(createPublicInteractionResults(quiz, hiddenQuizResults)?.optionCounts, [0, 0, 0]);
assert.equal(createPublicInteraction(quiz, populatedResults(quiz, true))?.correctOptionIndex, 1);

const openResponse = byType('open-response');
const publicOpenResponse = createPublicInteractionResults(openResponse, populatedResults(openResponse, false));
assert.ok(publicOpenResponse);
assert.deepEqual(publicOpenResponse?.writtenResponses, [{ id: `shared-${publicOpenResponse.runId}-1`, text: 'Second thought' }]);
assert.equal(publicOpenResponse?.sharedResponseId, `shared-${publicOpenResponse.runId}-1`);

const wordCloud = byType('word-cloud');
const publicWordCloud = createPublicInteractionResults(wordCloud, populatedResults(wordCloud, true));
assert.equal(publicWordCloud?.writtenResponses.length, 2);
assert.ok(publicWordCloud?.writtenResponses.every((response) => response.id.startsWith(`word-${publicWordCloud.runId}-`)));

const groupWork = byType('group-work');
const groupSummary = summarizeInteractionResponses(groupWork, [
  { id: 'team-a-first', runId: 'group-run', interactionId: groupWork.id, studentUid: 'student-a', submittedAt: 10, text: 'First team answer', teamId: 'team-a', teamName: 'Bright Sparks' },
  { id: 'team-a-duplicate', runId: 'group-run', interactionId: groupWork.id, studentUid: 'student-b', submittedAt: 20, text: 'Duplicate team answer', teamId: 'team-a', teamName: 'Bright Sparks' },
  { id: 'team-b-first', runId: 'group-run', interactionId: groupWork.id, studentUid: 'student-c', submittedAt: 30, text: 'Second team answer', teamId: 'team-b', teamName: 'Market Makers' },
]);
assert.equal(groupSummary.responseCount, 2, 'Saved-team group work counts one submission per team.');
assert.deepEqual(groupSummary.submittedTeamIds, ['team-a', 'team-b']);
assert.deepEqual(groupSummary.writtenResponses.map((response) => response.text), ['Second team answer', 'First team answer']);
const privateGroupResults = { ...populatedResults(groupWork, false), ...groupSummary, sharedResponseId: 'team-a-first' };
const publicGroupWork = createPublicInteractionResults(groupWork, privateGroupResults);
assert.equal(publicGroupWork?.writtenResponses.length, 1, 'Group responses stay private until the instructor shares one.');
assert.deepEqual(publicGroupWork?.writtenResponses[0], { id: `shared-${publicGroupWork?.runId}-1`, text: 'First team answer', teamName: 'Bright Sparks' });

console.log('PASS All offered activity types have an explicit live-classroom contract.');
console.log('PASS Public projector data follows live, reveal, private, and curated-response rules.');
