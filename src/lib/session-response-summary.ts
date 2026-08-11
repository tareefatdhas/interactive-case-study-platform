import type { SessionInteraction, SessionInteractionRun } from '@/types';
import type { InstructorClassroomRecords, StoredLiveResponse } from '@/lib/firebase/live-classroom';

type ResponseRuns = InstructorClassroomRecords['responses'];

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
