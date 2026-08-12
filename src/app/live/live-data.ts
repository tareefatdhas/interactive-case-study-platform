import type { CSSProperties } from 'react';
import type { SessionInteraction } from '@/types';

export type MoodKey = 'energized' | 'steady' | 'tired' | 'overwhelmed' | 'private';

export type Counts = Record<MoodKey, number>;

export type OnboardingStep = 0 | 1 | 2 | 3 | 4;

export type LiveInteraction = {
  id: string;
  type: 'pulse' | 'poll' | 'quiz' | 'open-response' | 'word-cloud' | 'peer-learning' | 'team-formation' | 'group-work' | 'timer' | 'spin-wheel';
  label: string;
  title: string;
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  explanation?: string;
  speedBonusEnabled?: boolean;
  speedBonusSeconds?: number;
  maxSpeedBonusPoints?: number;
  durationMinutes?: number;
  discussionMinutes?: number;
  groupSize?: number;
  teamTags?: string[];
  requireTeamTag?: boolean;
  wheelSource?: 'students' | 'teams' | 'custom';
  wheelItems?: string[];
  wheelItemColors?: string[];
  wheelRemoveSelected?: boolean;
  resultVisibility?: 'live' | 'after-reveal' | 'instructor-only';
  plannedTime?: string;
};

export type InteractionResponse = {
  id: string;
  runId: string;
  interactionId: string;
  optionIndex?: number;
  text?: string;
  teamId?: string;
  teamName?: string;
  teamDescription?: string;
  teamTag?: string;
};

export type LiveTeam = {
  id: string;
  name: string;
  description?: string;
  tag?: string;
  color?: 'violet' | 'blue' | 'teal' | 'green' | 'gold' | 'coral' | 'pink' | 'navy';
  creatorUid?: string;
  memberCount?: number;
  members?: Array<{
    studentUid: string;
    studentNumber?: string;
    displayName?: string;
  }>;
};

export type InteractionResults = {
  runId: string;
  startedAt: number;
  open: boolean;
  responseCount: number;
  optionCounts: number[];
  writtenResponses: Array<{ id: string; text: string }>;
  revealed: boolean;
  sharedResponseId: string | null;
  phase?: 'respond' | 'discuss' | 'respond-again' | 'work' | 'complete';
  firstResponseCount?: number;
  firstOptionCounts?: number[];
  wheelItems?: string[];
  wheelItemColors?: string[];
  wheelSelectedIndex?: number | null;
  wheelSelectedLabel?: string | null;
  wheelSpinCount?: number;
  wheelRotation?: number;
  wheelHistory?: string[];
};

export type WordCloudItem = {
  key: string;
  label: string;
  count: number;
  strength: number;
};

export type LiveQuestion = {
  id: number;
  initials: string;
  ago: string;
  question: string;
  votes: number;
  source?: 'instructor' | 'student';
};

export type LiveTimer = {
  id: string;
  label: string;
  durationSeconds: number;
  endsAt: number;
};

export type LiveSessionContext = {
  sessionId?: string;
  courseId?: string;
  ownerUid?: string;
  instructorName?: string;
  sessionCode: string;
  courseCode: string;
  rewardScopeId?: string;
  courseName: string;
  sessionTitle: string;
};

export type LessonDisplayState = {
  session: LiveSessionContext;
  lobbyOpen: boolean;
  connectedStudents: number;
  counts: Counts;
  comparisonCounts: Counts;
  incomingMood: MoodKey | null;
  paused: boolean;
  playingHistory: boolean;
  selectedWeek: number;
  showComparison: boolean;
  onboardingStep: OnboardingStep;
  onboardingRunId: number;
  onboardingMoodCounts: Counts;
  activeInteraction: LiveInteraction | null;
  interactionResults: InteractionResults | null;
  featuredQuestionId: number | null;
  questions: LiveQuestion[];
  teams: LiveTeam[];
  timer?: LiveTimer | null;
  updatedAt: number;
};

export const DEMO_SESSION: LiveSessionContext = {
  sessionCode: '482 916',
  courseCode: 'ECON 302',
  courseName: 'Intermediate Microeconomics',
  sessionTitle: 'Week 6 · Platform strategy',
};

export const DEMO_LIVE_INTERACTIONS: LiveInteraction[] = [
  {
    id: 'arrival-pulse',
    type: 'pulse',
    label: 'Pulse',
    title: 'Arrival pulse',
    prompt: 'How are you arriving today?',
    options: ['Energized', 'Steady', 'A little tired', 'Overwhelmed', 'Prefer not to say'],
    resultVisibility: 'live',
    plannedTime: 'Start of class',
  },
  {
    id: 'network-effects-check',
    type: 'poll',
    label: 'Poll',
    title: 'Concept check',
    prompt: 'Where do network effects become most fragile?',
    options: ['Low switching costs', 'Single-provider dependency', 'Rapid user growth', 'Broad interoperability'],
    resultVisibility: 'after-reveal',
    plannedTime: 'After topic 1',
  },
  {
    id: 'network-effects-quiz',
    type: 'quiz',
    label: 'Knowledge check',
    title: 'Knowledge check',
    prompt: 'Which condition makes a network most vulnerable to collapse?',
    options: ['Low acquisition cost', 'Dependence on one critical provider', 'Rapid category growth', 'Many compatible providers'],
    correctOptionIndex: 1,
    explanation: 'A network becomes fragile when one critical provider can interrupt value for everyone else.',
    resultVisibility: 'after-reveal',
    plannedTime: 'After the example',
  },
  {
    id: 'muddiest-point',
    type: 'open-response',
    label: 'Short response',
    title: 'Muddiest point',
    prompt: 'What is still unclear before we move on?',
    resultVisibility: 'instructor-only',
    plannedTime: 'Before the case',
  },
  {
    id: 'platform-word-cloud',
    type: 'word-cloud',
    label: 'Word cloud',
    title: 'One-word association',
    prompt: 'What one word best describes a healthy platform?',
    resultVisibility: 'live',
    plannedTime: 'Open the discussion',
  },
  {
    id: 'peer-explain',
    type: 'peer-learning',
    label: 'Peer learning',
    title: 'Think, pair, answer again',
    prompt: 'Which condition makes a network most fragile?',
    options: ['Low switching costs', 'One critical provider', 'Rapid user growth', 'Broad interoperability'],
    correctOptionIndex: 1,
    discussionMinutes: 2,
    resultVisibility: 'after-reveal',
    plannedTime: 'After the concept check',
  },
  {
    id: 'team-setup',
    type: 'team-formation',
    label: 'Form teams',
    title: 'Choose your team direction',
    prompt: 'Create a team name, add a short description, and choose the tag that best fits your work.',
    groupSize: 4,
    teamTags: ['Student life', 'Healthy living', 'Family support'],
    requireTeamTag: true,
    resultVisibility: 'live',
    plannedTime: 'Before group work',
  },
  {
    id: 'group-application',
    type: 'group-work',
    label: 'Group work',
    title: 'Apply the idea',
    prompt: 'In groups of four, choose a platform and identify its most fragile dependency.',
    groupSize: 4,
    durationMinutes: 8,
    resultVisibility: 'instructor-only',
    plannedTime: 'Application',
  },
  {
    id: 'quiet-work',
    type: 'timer',
    label: 'Clock',
    title: 'Quiet thinking time',
    prompt: 'Write down one example you would be ready to explain.',
    durationMinutes: 3,
    resultVisibility: 'live',
    plannedTime: 'Before discussion',
  },
  {
    id: 'discussion-wheel',
    type: 'spin-wheel',
    label: 'Spin the wheel',
    title: 'Choose the next discussion lens',
    prompt: 'Which lens should we use for the next example?',
    wheelSource: 'custom',
    wheelItems: ['Customer value', 'Network effects', 'Switching costs', 'Market tipping', 'Governance'],
    wheelRemoveSelected: true,
    resultVisibility: 'instructor-only',
    plannedTime: 'Discussion',
  },
];

export const LESSON_CHANNEL = 'living-seminar-live-lesson';
export const LESSON_STORAGE_KEY = 'living-seminar-display-state';

export function formatSessionCode(sessionCode: string) {
  const normalized = sessionCode.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
  return normalized.length > 3 ? `${normalized.slice(0, 3)} ${normalized.slice(3)}` : normalized;
}

export const EMPTY_ONBOARDING_COUNTS: Counts = {
  energized: 0,
  steady: 0,
  tired: 0,
  overwhelmed: 0,
  private: 0,
};

export const DEFAULT_LIVE_QUESTIONS: LiveQuestion[] = [
  {
    id: 1,
    initials: 'A',
    ago: 'Just now',
    question: 'Can indirect effects make a network more fragile than direct effects?',
    votes: 18,
  },
  {
    id: 2,
    initials: 'B',
    ago: '2 min ago',
    question: 'Does interoperability always reduce winner-take-all dynamics?',
    votes: 11,
  },
  {
    id: 3,
    initials: 'C',
    ago: '4 min ago',
    question: 'What real-world cases show network effects increasing systemic risk?',
    votes: 6,
  },
];

export const MOODS: Array<{
  key: MoodKey;
  label: string;
  color: string;
}> = [
  { key: 'energized', label: 'Energized', color: '#7057e8' },
  { key: 'steady', label: 'Steady', color: '#2f73df' },
  { key: 'tired', label: 'A little tired', color: '#e3b628' },
  { key: 'overwhelmed', label: 'Overwhelmed', color: '#ef7359' },
  { key: 'private', label: 'Prefer not to say', color: '#9298a5' },
];

export const HISTORY: Array<{ date: string; lesson: string; counts: Counts }> = [
  {
    date: 'Today',
    lesson: 'Platform strategy',
    counts: { energized: 27, steady: 70, tired: 34, overwhelmed: 12, private: 5 },
  },
  {
    date: 'Aug 1',
    lesson: 'Network effects',
    counts: { energized: 31, steady: 77, tired: 29, overwhelmed: 8, private: 3 },
  },
  {
    date: 'Jul 25',
    lesson: 'Market structure',
    counts: { energized: 24, steady: 73, tired: 35, overwhelmed: 11, private: 5 },
  },
  {
    date: 'Jul 18',
    lesson: 'Demand & supply',
    counts: { energized: 35, steady: 71, tired: 27, overwhelmed: 9, private: 6 },
  },
];

export function total(counts: Counts) {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

export function percent(value: number, counts: Counts) {
  const count = total(counts);
  return count ? Math.round((value / count) * 100) : 0;
}

export function createInteractionResults(interaction: LiveInteraction): InteractionResults {
  const startedAt = Date.now();
  return {
    runId: `${interaction.id}-${startedAt}`,
    startedAt,
    open: interaction.type !== 'timer' && interaction.type !== 'spin-wheel',
    responseCount: 0,
    optionCounts: interaction.options?.map(() => 0) ?? [],
    writtenResponses: [],
    revealed: interaction.resultVisibility === 'live',
    sharedResponseId: null,
    phase: interaction.type === 'group-work' ? 'work' : 'respond',
    wheelItems: interaction.type === 'spin-wheel' ? interaction.wheelItems || [] : undefined,
    wheelSelectedIndex: interaction.type === 'spin-wheel' ? null : undefined,
    wheelSelectedLabel: interaction.type === 'spin-wheel' ? null : undefined,
    wheelSpinCount: interaction.type === 'spin-wheel' ? 0 : undefined,
    wheelRotation: interaction.type === 'spin-wheel' ? 0 : undefined,
    wheelHistory: interaction.type === 'spin-wheel' ? [] : undefined,
  };
}

export function buildWordCloudItems(
  responses: Array<{ id: string; text: string }> = [],
  limit = 36,
): WordCloudItem[] {
  const terms = new Map<string, { label: string; count: number; firstSeen: number }>();

  responses.forEach((response, index) => {
    const label = response.text
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .replace(/^[\s.,!?;:'\"“”‘’()[\]{}]+|[\s.,!?;:'\"“”‘’()[\]{}]+$/g, '')
      .trim()
      .slice(0, 48);
    if (!label) return;
    const key = label.toLocaleLowerCase();
    const existing = terms.get(key);
    if (existing) existing.count += 1;
    else {
      const readableLabel = label === label.toLocaleUpperCase()
        ? `${label.charAt(0).toLocaleUpperCase()}${label.slice(1).toLocaleLowerCase()}`
        : `${label.charAt(0).toLocaleUpperCase()}${label.slice(1)}`;
      terms.set(key, { label: readableLabel, count: 1, firstSeen: index });
    }
  });

  const ranked = Array.from(terms.entries())
    .sort(([, a], [, b]) => b.count - a.count || a.firstSeen - b.firstSeen)
    .slice(0, limit);
  const maximum = Math.max(1, ...ranked.map(([, value]) => value.count));

  return ranked.map(([key, value]) => ({
    key,
    label: value.label,
    count: value.count,
    strength: maximum === 1
      ? 0.26
      : 0.22 + 0.78 * ((value.count - 1) / (maximum - 1)),
  }));
}

export function prepareLiveInteractions(interactions: SessionInteraction[] = []): LiveInteraction[] {
  return interactions.flatMap((interaction) => {
    if (interaction.type === 'case-study') return [];
    const type = interaction.type === 'reflection' ? 'open-response' : interaction.type;
    const label = type === 'pulse'
      ? 'Pulse'
      : type === 'poll'
        ? 'Poll'
        : type === 'quiz'
          ? 'Knowledge check'
          : type === 'word-cloud'
            ? 'Word cloud'
            : type === 'peer-learning'
              ? 'Peer learning'
              : type === 'team-formation'
                ? 'Form teams'
              : type === 'group-work'
                ? 'Group work'
                : type === 'timer'
                  ? 'Clock'
                  : type === 'spin-wheel'
                    ? 'Spin the wheel'
                  : 'Short response';

    return [{
      id: interaction.id,
      type,
      label,
      title: interaction.title,
      prompt: interaction.prompt,
      options: interaction.options,
      correctOptionIndex: interaction.correctOptionIndex,
      explanation: interaction.explanation,
      speedBonusEnabled: interaction.speedBonusEnabled,
      speedBonusSeconds: interaction.speedBonusSeconds,
      maxSpeedBonusPoints: interaction.maxSpeedBonusPoints,
      durationMinutes: interaction.durationMinutes,
      discussionMinutes: interaction.discussionMinutes,
      groupSize: interaction.groupSize,
      teamTags: interaction.teamTags,
      requireTeamTag: interaction.requireTeamTag,
      wheelSource: interaction.wheelSource,
      wheelItems: interaction.wheelItems,
      wheelRemoveSelected: interaction.wheelRemoveSelected,
      resultVisibility: interaction.resultVisibility
        || (type === 'quiz' || type === 'peer-learning' ? 'after-reveal' : type === 'open-response' || type === 'group-work' ? 'instructor-only' : 'live'),
      plannedTime: interaction.plannedTime || 'During class',
    } satisfies LiveInteraction];
  });
}

export function resultPercent(value: number, responseCount: number) {
  return responseCount ? Math.round((value / responseCount) * 100) : 0;
}

export function dotStyle(index: number, color: string) {
  const lifts = [-5, 2, 5, -2, 3, -4, 4, 0, -3];
  const scales = [0.78, 1.02, 1.18, 0.91, 1.1, 0.84, 1.2, 0.96, 1.08];

  return {
    '--dot-color': color,
    '--dot-lift': `${lifts[index % lifts.length]}px`,
    '--dot-scale': scales[index % scales.length],
  } as CSSProperties;
}
