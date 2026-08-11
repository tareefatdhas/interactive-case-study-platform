import type { RewardKind } from '@/types';

export type RewardBalance = 'seminar' | 'score';

export type RewardLedgerEntry = {
  id: string;
  eventKey: string;
  balance: RewardBalance;
  amount: number;
  label: string;
  createdAt: number;
};

export type RewardRedemption = {
  id: string;
  rewardId: string;
  rewardName: string;
  pointsRequired: number;
  status: 'pending' | 'approved' | 'declined';
  requestedAt: number;
};

export type StudentRewardState = {
  seminarPoints: number;
  classScore: number;
  classRun: number;
  longestRun: number;
  alias: string;
  ledger: RewardLedgerEntry[];
  redemptions: RewardRedemption[];
};

export type CourseReward = {
  id: string;
  name: string;
  description: string;
  pointsRequired: number;
  kind?: RewardKind;
  limitPerStudent?: number;
};

export const POINT_RULES = {
  participation: {
    pulse: 1,
    poll: 2,
    quiz: 2,
    'peer-learning': 2,
    'word-cloud': 2,
    'open-response': 3,
    'group-work': 5,
  },
  privatePrediction: 1,
  roomRead: 3,
  correctQuizAnswer: KNOWLEDGE_CHECK_CORRECT_POINTS,
  strongSecondAnswer: 6,
  questions: {
    asked: { id: 'question-asked', amount: 1, label: 'Asked a question' },
    supported: { id: 'question-upvotes-2', amount: 2, label: 'Question supported by classmates', threshold: 2 },
    helpedRoom: { id: 'question-upvotes-5', amount: 3, label: 'Question helped the room', threshold: 5 },
    discussed: { id: 'question-discussed', amount: 3, label: 'Question discussed in class' },
  },
} as const;

export type QuestionPointRuleKey = keyof typeof POINT_RULES.questions;

export function getQuestionPointRule(key: QuestionPointRuleKey) {
  return POINT_RULES.questions[key];
}

export function getParticipationPoints(type: string) {
  return POINT_RULES.participation[type as keyof typeof POINT_RULES.participation] || 0;
}

export function createInitialRewardState(): StudentRewardState {
  return {
    seminarPoints: 0,
    classScore: 0,
    classRun: 0,
    longestRun: 0,
    alias: 'Quiet Comet',
    ledger: [],
    redemptions: [],
  };
}

function storageKey(scope: string) {
  // Demo builds previously seeded invented progress. Keep demo storage on a new
  // key so those values cannot be mistaken for student activity.
  return scope.startsWith('demo:')
    ? `classfully-rewards:v2:${scope}`
    : `living-seminar-rewards:${scope}`;
}

export function loadRewardState(scope: string): StudentRewardState {
  if (typeof window === 'undefined') return createInitialRewardState();
  const stored = window.localStorage.getItem(storageKey(scope));
  if (!stored) return createInitialRewardState();
  try {
    const parsed = JSON.parse(stored) as Omit<StudentRewardState, 'redemptions'> & { redemptions?: Array<RewardRedemption & { cost?: number }> };
    return {
      ...createInitialRewardState(),
      ...parsed,
      redemptions: (parsed.redemptions || []).map((redemption) => ({
        ...redemption,
        pointsRequired: redemption.pointsRequired ?? redemption.cost ?? 0,
      })),
    } as StudentRewardState;
  } catch {
    return createInitialRewardState();
  }
}

export function saveRewardState(scope: string, state: StudentRewardState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(scope), JSON.stringify(state));
}

export function applyReward(
  state: StudentRewardState,
  reward: Omit<RewardLedgerEntry, 'id' | 'createdAt'>,
): { state: StudentRewardState; entry: RewardLedgerEntry | null } {
  if (state.ledger.some((entry) => entry.eventKey === reward.eventKey)) {
    return { state, entry: null };
  }

  const entry: RewardLedgerEntry = {
    ...reward,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  return {
    entry,
    state: {
      ...state,
      seminarPoints: state.seminarPoints + (entry.balance === 'seminar' ? entry.amount : 0),
      classScore: state.classScore + (entry.balance === 'score' ? entry.amount : 0),
      ledger: [entry, ...state.ledger].slice(0, 60),
    },
  };
}

export function requestCourseReward(
  state: StudentRewardState,
  reward: CourseReward,
): StudentRewardState {
  if (state.seminarPoints < reward.pointsRequired) return state;
  if (state.redemptions.some((redemption) => redemption.rewardId === reward.id && redemption.status === 'pending')) return state;
  return {
    ...state,
    redemptions: [{
      id: crypto.randomUUID(),
      rewardId: reward.id,
      rewardName: reward.name,
      pointsRequired: reward.pointsRequired,
      status: 'pending',
      requestedAt: Date.now(),
    }, ...state.redemptions],
  };
}
import { KNOWLEDGE_CHECK_CORRECT_POINTS } from '@/lib/knowledge-check-scoring';
