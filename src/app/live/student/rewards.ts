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
};

export const COURSE_REWARDS: CourseReward[] = [
  {
    id: 'case-choice',
    name: 'Choose a class example',
    description: 'Suggest the case or market the class applies next.',
    pointsRequired: 70,
  },
  {
    id: 'deadline-pass',
    name: 'One-day deadline pass',
    description: 'Valid on one eligible low-stakes assignment.',
    pointsRequired: 120,
  },
  {
    id: 'extra-credit',
    name: 'Small extra-credit reward',
    description: 'A small course-capped bonus after instructor approval.',
    pointsRequired: 150,
  },
];

export function createInitialRewardState(demo = false): StudentRewardState {
  return {
    seminarPoints: demo ? 86 : 0,
    classScore: demo ? 18 : 0,
    classRun: demo ? 3 : 0,
    longestRun: demo ? 3 : 0,
    alias: 'Quiet Comet',
    ledger: demo ? [
      {
        id: 'demo-reflection',
        eventKey: 'demo:reflection',
        balance: 'seminar',
        amount: 5,
        label: 'Post-class reflection',
        createdAt: Date.now() - 86_400_000,
      },
      {
        id: 'demo-question',
        eventKey: 'demo:question',
        balance: 'seminar',
        amount: 3,
        label: 'Question discussed',
        createdAt: Date.now() - 172_800_000,
      },
    ] : [],
    redemptions: [],
  };
}

function storageKey(scope: string) {
  return `living-seminar-rewards:${scope}`;
}

export function loadRewardState(scope: string, demo = false): StudentRewardState {
  if (typeof window === 'undefined') return createInitialRewardState(demo);
  const stored = window.localStorage.getItem(storageKey(scope));
  if (!stored) return createInitialRewardState(demo);
  try {
    const parsed = JSON.parse(stored) as Omit<StudentRewardState, 'redemptions'> & { redemptions?: Array<RewardRedemption & { cost?: number }> };
    return {
      ...createInitialRewardState(demo),
      ...parsed,
      redemptions: (parsed.redemptions || []).map((redemption) => ({
        ...redemption,
        pointsRequired: redemption.pointsRequired ?? redemption.cost ?? 0,
      })),
    } as StudentRewardState;
  } catch {
    return createInitialRewardState(demo);
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
