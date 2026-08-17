export type LeaderboardVisibility = 'off' | 'private-neighborhood' | 'public-aliases';
export type TeamBoardVisibility = 'off' | 'private' | 'public';
export type ProjectorMomentumMode = 'collective' | 'teams' | 'individuals';

export type SignalForm = 'orb' | 'pebble' | 'prism' | 'bloom';
export type SignalPalette = 'violet' | 'ocean' | 'mint' | 'sun' | 'coral' | 'midnight';
export type SignalFace = 'calm' | 'bright' | 'curious' | 'focused';
export type SignalOrbit = 'ring' | 'satellites' | 'trail' | 'none';

export type SignalAvatar = {
  form: SignalForm;
  palette: SignalPalette;
  face: SignalFace;
  orbit: SignalOrbit;
};

export type CourseMotivationConfig = {
  enabled: boolean;
  pointsEnabled: boolean;
  classRunsEnabled: boolean;
  avatarsEnabled: boolean;
  individualBoard: LeaderboardVisibility;
  teamBoard: TeamBoardVisibility;
  projectorMode: ProjectorMomentumMode;
  collectiveGoal: number;
};

export type MotivationContribution = {
  id: string;
  points: number;
  sessionsParticipated: number;
  eligibleSessions: number;
  optedIn?: boolean;
};

export type TeamMomentumInput = {
  id: string;
  name: string;
  members: MotivationContribution[];
};

export const DEFAULT_SIGNAL_AVATAR: SignalAvatar = {
  form: 'orb',
  palette: 'violet',
  face: 'curious',
  orbit: 'ring',
};

export const DEFAULT_COURSE_MOTIVATION: CourseMotivationConfig = {
  enabled: true,
  pointsEnabled: true,
  classRunsEnabled: true,
  avatarsEnabled: true,
  individualBoard: 'private-neighborhood',
  teamBoard: 'private',
  projectorMode: 'collective',
  collectiveGoal: 100,
};

export const SIGNAL_PALETTES: Record<SignalPalette, { primary: string; secondary: string; glow: string; ink: string }> = {
  violet: { primary: '#5146e5', secondary: '#9d96ff', glow: '#dedbff', ink: '#101a38' },
  ocean: { primary: '#3276df', secondary: '#82b6ff', glow: '#d9eaff', ink: '#10224a' },
  mint: { primary: '#2e9b72', secondary: '#7bd0ad', glow: '#dff5ea', ink: '#123d31' },
  sun: { primary: '#c88712', secondary: '#f4c65e', glow: '#fff1c9', ink: '#553a0b' },
  coral: { primary: '#df664e', secondary: '#f5a18f', glow: '#ffe3dc', ink: '#5b241a' },
  midnight: { primary: '#101a38', secondary: '#546080', glow: '#dfe3ee', ink: '#fffefa' },
};

export const SIGNAL_FORMS: SignalForm[] = ['orb', 'pebble', 'prism', 'bloom'];
export const SIGNAL_FACES: SignalFace[] = ['calm', 'bright', 'curious', 'focused'];
export const SIGNAL_ORBITS: SignalOrbit[] = ['ring', 'satellites', 'trail', 'none'];

export function motivationConfig(value?: Partial<CourseMotivationConfig> | null): CourseMotivationConfig {
  return {
    ...DEFAULT_COURSE_MOTIVATION,
    ...(value || {}),
    collectiveGoal: Math.min(500, Math.max(20, Number(value?.collectiveGoal) || DEFAULT_COURSE_MOTIVATION.collectiveGoal)),
  };
}

export function safeSignalAvatar(value?: Partial<SignalAvatar> | null): SignalAvatar {
  return {
    form: SIGNAL_FORMS.includes(value?.form as SignalForm) ? value!.form! : DEFAULT_SIGNAL_AVATAR.form,
    palette: Object.hasOwn(SIGNAL_PALETTES, value?.palette || '') ? value!.palette! : DEFAULT_SIGNAL_AVATAR.palette,
    face: SIGNAL_FACES.includes(value?.face as SignalFace) ? value!.face! : DEFAULT_SIGNAL_AVATAR.face,
    orbit: SIGNAL_ORBITS.includes(value?.orbit as SignalOrbit) ? value!.orbit! : DEFAULT_SIGNAL_AVATAR.orbit,
  };
}

export function normalizeAlias(value: string, fallback = 'Quiet Comet') {
  const clean = value.replace(/[^\p{L}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 28);
  return clean.length >= 2 ? clean : fallback;
}

export function participationRate(contribution: MotivationContribution) {
  if (contribution.eligibleSessions <= 0) return 0;
  return Math.min(1, Math.max(0, contribution.sessionsParticipated / contribution.eligibleSessions));
}

export function contributionMomentum(contribution: MotivationContribution) {
  // Standing follows the point contract directly. Attendance is shown as a
  // separate class run so students can understand exactly what moved each
  // measure and are not ranked by circumstances outside the activity itself.
  return Math.round(Math.max(0, contribution.points));
}

export function teamMomentum(team: TeamMomentumInput) {
  const activeMembers = team.members.filter((member) => member.sessionsParticipated > 0 || member.points > 0);
  if (activeMembers.length === 0) return { score: 0, activeMembers: 0, eligible: false };
  const average = activeMembers.reduce((sum, member) => sum + contributionMomentum(member), 0) / activeMembers.length;
  return {
    score: Math.round(average),
    activeMembers: activeMembers.length,
    eligible: activeMembers.length >= 2,
  };
}

export function collectiveProgress(current: number, goal: number) {
  const safeGoal = Math.max(1, goal);
  return Math.min(100, Math.max(0, Math.round((current / safeGoal) * 100)));
}

export function privateNeighborhood<T extends MotivationContribution>(students: T[], studentId: string, radius = 2) {
  const ranked = students
    .map((student) => ({ ...student, momentum: contributionMomentum(student) }))
    .sort((left, right) => right.momentum - left.momentum || left.id.localeCompare(right.id));
  const index = ranked.findIndex((student) => student.id === studentId);
  if (index < 0) return [];
  return ranked.slice(Math.max(0, index - radius), Math.min(ranked.length, index + radius + 1));
}
