import type { CSSProperties } from 'react';
import type { SessionInteraction } from '@/types';

export type MoodKey = 'energized' | 'steady' | 'tired' | 'overwhelmed' | 'private';

export type Counts = Record<MoodKey, number>;

export type OnboardingStep = 0 | 1 | 2 | 3 | 4;

export type LiveInteraction = {
  id: string;
  type: 'pulse' | 'poll' | 'quiz' | 'open-response';
  label: string;
  title: string;
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  explanation?: string;
  resultVisibility?: 'live' | 'after-reveal' | 'instructor-only';
  plannedTime?: string;
};

export type InteractionResponse = {
  id: string;
  runId: string;
  interactionId: string;
  optionIndex?: number;
  text?: string;
};

export type InteractionResults = {
  runId: string;
  open: boolean;
  responseCount: number;
  optionCounts: number[];
  writtenResponses: Array<{ id: string; text: string }>;
  revealed: boolean;
  sharedResponseId: string | null;
};

export type LiveQuestion = {
  id: number;
  initials: string;
  ago: string;
  question: string;
  votes: number;
};

export type LiveSessionContext = {
  sessionId?: string;
  ownerUid?: string;
  instructorName?: string;
  sessionCode: string;
  courseCode: string;
  courseName: string;
  sessionTitle: string;
};

export type LessonDisplayState = {
  session: LiveSessionContext;
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
    label: 'Quiz',
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
  return {
    runId: `${interaction.id}-${Date.now()}`,
    open: true,
    responseCount: 0,
    optionCounts: interaction.options?.map(() => 0) ?? [],
    writtenResponses: [],
    revealed: interaction.resultVisibility === 'live',
    sharedResponseId: null,
  };
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
          ? 'Quiz'
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
      resultVisibility: interaction.resultVisibility
        || (type === 'quiz' ? 'after-reveal' : type === 'open-response' ? 'instructor-only' : 'live'),
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
