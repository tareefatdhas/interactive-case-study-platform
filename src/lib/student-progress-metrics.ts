import type { Course, Session, SessionInteraction, SessionInteractionRun } from '@/types';
import type { StoredLiveResponse } from '@/lib/firebase/live-classroom';

type ResponseRuns = Record<string, Record<string, StoredLiveResponse>>;

const NON_PARTICIPATION_TYPES = new Set<SessionInteraction['type']>([
  'timer',
  'spin-wheel',
  'group-work',
]);

type ParticipationOpportunityInput = {
  runs?: SessionInteractionRun[];
  interactions?: SessionInteraction[];
  responseRuns?: ResponseRuns;
  studentUid?: string;
  joinedAt?: number;
};

function sessionTimestamp(session: Session) {
  return session.startedAt?.toMillis?.()
    || session.endedAt?.toMillis?.()
    || session.createdAt?.toMillis?.()
    || 0;
}

export function selectDefaultProgressCourseId(
  courses: Course[],
  sessions: Session[],
  requestedCourseId?: string | null,
) {
  if (requestedCourseId === 'all') return 'all';
  if (requestedCourseId && courses.some((course) => course.id === requestedCourseId)) return requestedCourseId;

  const latestCourse = [...courses].sort((a, b) => {
    const latestHeldSession = (course: Course) => sessions
      .filter((session) => (
        session.courseId === course.id || (!session.courseId && session.courseCode === course.code)
      ) && (session.startedAt || session.endedAt || session.active || (session.studentsJoined?.length || 0) > 0))
      .reduce((latest, session) => Math.max(latest, sessionTimestamp(session)), 0);
    const aTime = latestHeldSession(a) || a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
    const bTime = latestHeldSession(b) || b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  })[0];

  return latestCourse?.id || 'all';
}

export function countPlayedParticipationOpportunities({
  runs = [],
  interactions = [],
  responseRuns = {},
  studentUid,
  joinedAt,
}: ParticipationOpportunityInput) {
  const interactionsById = new Map(interactions.map((interaction) => [interaction.id, interaction]));
  const playedRuns = new Map<string, SessionInteractionRun>();

  runs.forEach((run) => {
    const interaction = interactionsById.get(run.interactionId);
    const recordedResponseCount = Object.keys(responseRuns[run.id] || {}).length;
    const hasResponseEvidence = run.responseCount > 0 || recordedResponseCount > 0;
    if (!interaction
      || NON_PARTICIPATION_TYPES.has(interaction.type)
      || !Number.isFinite(run.startedAt)
      || run.startedAt <= 0
      || !hasResponseEvidence) return;
    playedRuns.set(run.id, run);
  });

  Object.entries(responseRuns).forEach(([runId, runResponses]) => {
    if (playedRuns.has(runId)) return;
    const responses = Object.values(runResponses || {});
    const firstResponse = responses[0];
    const interaction = firstResponse ? interactionsById.get(firstResponse.interactionId) : undefined;
    if (!firstResponse || !interaction || NON_PARTICIPATION_TYPES.has(interaction.type)) return;
    const timestamps = responses.map((response) => response.submittedAt).filter(Number.isFinite);
    if (!timestamps.length) return;
    const startedAt = Math.min(...timestamps);
    const endedAt = Math.max(...timestamps);
    playedRuns.set(runId, {
      id: runId,
      interactionId: interaction.id,
      startedAt,
      updatedAt: endedAt,
      endedAt,
      status: 'completed',
      responseCount: responses.length,
    });
  });

  const opportunityIds = new Set<string>();
  playedRuns.forEach((run, runId) => {
    const studentResponded = Boolean(studentUid && responseRuns[runId]?.[studentUid]);
    const runWasAvailableAfterJoining = joinedAt === undefined
      || joinedAt <= (run.endedAt || run.updatedAt || run.startedAt);
    if (studentResponded || runWasAvailableAfterJoining) opportunityIds.add(runId);
  });

  if (studentUid) {
    Object.entries(responseRuns).forEach(([runId, runResponses]) => {
      const response = runResponses[studentUid];
      const interaction = response ? interactionsById.get(response.interactionId) : undefined;
      if (response && (!interaction || !NON_PARTICIPATION_TYPES.has(interaction.type))) opportunityIds.add(runId);
    });
  }

  return opportunityIds.size;
}
