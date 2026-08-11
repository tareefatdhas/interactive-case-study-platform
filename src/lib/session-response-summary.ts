import type { SessionInteraction, SessionInteractionRun } from '@/types';
import type { InstructorClassroomRecords, StoredLiveResponse } from '@/lib/firebase/live-classroom';

type ResponseRuns = InstructorClassroomRecords['responses'];

const NON_STUDENT_BENCHMARK_TYPES = new Set<SessionInteraction['type']>([
  'timer',
  'spin-wheel',
  'group-work',
]);

export type InteractionParticipation = {
  runId: string;
  interactionId: string;
  title: string;
  round: number;
  responseCount: number;
  participationPercent: number;
  isBenchmark: boolean;
};

export type SessionParticipationSummary = {
  benchmarkResponseCount: number;
  averageParticipationPercent: number;
  interactions: InteractionParticipation[];
};

function responseCountForRun(
  responses: StoredLiveResponse[],
  interaction?: SessionInteraction,
) {
  if (interaction?.type === 'group-work') {
    return new Set(responses.map((response) => response.teamId || response.studentUid)).size;
  }
  return responses.length;
}

export function countClassroomResponses(responseRuns: ResponseRuns) {
  return Object.values(responseRuns).reduce(
    (total, runResponses) => total + Object.keys(runResponses || {}).length,
    0,
  );
}

export function reconcileInteractionRuns(
  savedRuns: SessionInteractionRun[] = [],
  responseRuns: ResponseRuns = {},
  interactions: SessionInteraction[] = [],
) {
  const interactionsById = new Map(interactions.map((interaction) => [interaction.id, interaction]));
  const savedRunsById = new Map(savedRuns.map((run) => [run.id, run]));
  const reconciledRuns = savedRuns.map((run) => {
    const responses = Object.values(responseRuns[run.id] || {});
    if (!responses.length) return run;
    const canonicalCount = responseCountForRun(responses, interactionsById.get(run.interactionId));
    return canonicalCount > run.responseCount ? { ...run, responseCount: canonicalCount } : run;
  });

  Object.entries(responseRuns).forEach(([runId, responseMap]) => {
    if (savedRunsById.has(runId)) return;
    const responses = Object.values(responseMap || {});
    if (!responses.length) return;
    const interactionId = responses[0].interactionId;
    const timestamps = responses
      .map((response) => response.submittedAt)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const startedAt = timestamps[0] || Date.now();
    const endedAt = timestamps[timestamps.length - 1] || startedAt;
    reconciledRuns.push({
      id: runId,
      interactionId,
      startedAt,
      updatedAt: endedAt,
      endedAt,
      status: 'completed',
      responseCount: responseCountForRun(responses, interactionsById.get(interactionId)),
    });
  });

  return reconciledRuns.sort((a, b) => a.startedAt - b.startedAt);
}

export function interactionRunSummariesDiffer(
  savedRuns: SessionInteractionRun[] = [],
  reconciledRuns: SessionInteractionRun[] = [],
) {
  if (savedRuns.length !== reconciledRuns.length) return true;
  const reconciledById = new Map(reconciledRuns.map((run) => [run.id, run]));
  return savedRuns.some((run) => {
    const reconciled = reconciledById.get(run.id);
    return !reconciled || reconciled.responseCount !== run.responseCount;
  });
}

export function getSessionParticipationSummary(
  runs: SessionInteractionRun[] = [],
  interactions: SessionInteraction[] = [],
): SessionParticipationSummary {
  const interactionsById = new Map(interactions.map((interaction) => [interaction.id, interaction]));
  const eligibleRuns = runs
    .filter((run) => {
      const interaction = interactionsById.get(run.interactionId);
      return !interaction || !NON_STUDENT_BENCHMARK_TYPES.has(interaction.type);
    })
    .sort((a, b) => a.startedAt - b.startedAt);
  const benchmarkResponseCount = Math.max(0, ...eligibleRuns.map((run) => run.responseCount));
  const roundsByInteraction = new Map<string, number>();
  const participation = eligibleRuns.map((run) => {
    const round = (roundsByInteraction.get(run.interactionId) || 0) + 1;
    roundsByInteraction.set(run.interactionId, round);
    const interaction = interactionsById.get(run.interactionId);
    return {
      runId: run.id,
      interactionId: run.interactionId,
      title: interaction?.title || 'Unplanned interaction',
      round,
      responseCount: run.responseCount,
      participationPercent: benchmarkResponseCount > 0
        ? Math.round((run.responseCount / benchmarkResponseCount) * 100)
        : 0,
      isBenchmark: benchmarkResponseCount > 0 && run.responseCount === benchmarkResponseCount,
    };
  });
  const averageParticipationPercent = participation.length > 0
    ? Math.round(participation.reduce((total, item) => total + item.participationPercent, 0) / participation.length)
    : 0;

  return {
    benchmarkResponseCount,
    averageParticipationPercent,
    interactions: participation,
  };
}
