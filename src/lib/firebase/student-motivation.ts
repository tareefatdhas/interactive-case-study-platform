import { httpsCallable } from 'firebase/functions';
import { studentFunctions } from './student-config';
import type { SignalAvatar } from '@/lib/gamification';

export type StoredStudentMotivationProfile = {
  seminarPoints: number;
  classScore: number;
  classRun: number;
  longestRun: number;
  sessionsParticipated: number;
  alias: string;
  avatar: SignalAvatar;
  leaderboardOptIn: boolean;
};

export type StudentMotivationStanding = {
  individualMode: 'off' | 'private-neighborhood' | 'public-aliases';
  selfRank: number | null;
  activeStudents: number;
  students: Array<{ rank: number; isYou: boolean; alias: string; avatar: SignalAvatar; points: number | null }>;
  teamMode: 'off' | 'private' | 'public';
  teams: Array<{ id: string; name: string; color: string; activeMembers: number; score: number; eligible: boolean; isYourTeam: boolean; rank: number }>;
  updatedAt: number;
};

const profileCall = httpsCallable<{ ownerUid: string; sessionId: string }, StoredStudentMotivationProfile>(studentFunctions, 'getStudentMotivationProfile');
const standingCall = httpsCallable<{ ownerUid: string; sessionId: string }, StudentMotivationStanding>(studentFunctions, 'getStudentMotivationStanding');
const updateCall = httpsCallable<{ ownerUid: string; sessionId: string; alias: string; avatar: SignalAvatar; leaderboardOptIn: boolean }, StoredStudentMotivationProfile>(studentFunctions, 'updateStudentMotivationProfile');
const claimCall = httpsCallable<{ ownerUid: string; sessionId: string; runId: string; kind: 'response' | 'correct' | 'prediction' | 'room-read'; optionIndex?: number }, StoredStudentMotivationProfile>(studentFunctions, 'claimStudentMotivationEvent');
const claimQuestionCall = httpsCallable<{ ownerUid: string; sessionId: string; eventId: string }, StoredStudentMotivationProfile>(studentFunctions, 'claimStudentMotivationQuestionEvent');

const PENDING_CLAIMS_KEY = 'classfully-pending-motivation-claims:v1';

type PendingClaim = {
  id: string;
  ownerUid: string;
  sessionId: string;
  createdAt: number;
} & (
  | { type: 'activity'; runId: string; kind: 'response' | 'correct' | 'prediction' | 'room-read'; optionIndex?: number }
  | { type: 'question'; eventId: string }
);

function readPendingClaims() {
  if (typeof window === 'undefined') return [] as PendingClaim[];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PENDING_CLAIMS_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    const oldestAllowed = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return value.filter((item): item is PendingClaim => Boolean(item && typeof item === 'object' && 'id' in item && 'createdAt' in item && Number(item.createdAt) >= oldestAllowed)).slice(-40);
  } catch {
    return [];
  }
}

function savePendingClaims(claims: PendingClaim[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PENDING_CLAIMS_KEY, JSON.stringify(claims.slice(-40)));
}

function isRetryableClaimError(error: unknown) {
  const code = String((error as { code?: unknown } | null)?.code || '');
  return ![
    'functions/invalid-argument',
    'functions/failed-precondition',
    'functions/permission-denied',
    'functions/unauthenticated',
    'functions/not-found',
  ].includes(code);
}

function queueClaim(claim: PendingClaim) {
  const claims = readPendingClaims();
  if (!claims.some((item) => item.id === claim.id)) savePendingClaims([...claims, claim]);
}

export async function getStudentMotivationProfile(ownerUid: string, sessionId: string) {
  return (await profileCall({ ownerUid, sessionId })).data;
}

export async function getStudentMotivationStanding(ownerUid: string, sessionId: string) {
  return (await standingCall({ ownerUid, sessionId })).data;
}

export async function updateStudentMotivationProfile(ownerUid: string, sessionId: string, profile: Pick<StoredStudentMotivationProfile, 'alias' | 'avatar' | 'leaderboardOptIn'>) {
  return (await updateCall({ ownerUid, sessionId, ...profile })).data;
}

export async function claimStudentMotivationEvent(ownerUid: string, sessionId: string, runId: string, kind: 'response' | 'correct' | 'prediction' | 'room-read', optionIndex?: number) {
  try {
    return (await claimCall({ ownerUid, sessionId, runId, kind, ...(optionIndex === undefined ? {} : { optionIndex }) })).data;
  } catch (error) {
    if (isRetryableClaimError(error)) queueClaim({ id: `${ownerUid}:${sessionId}:${runId}:${kind}`, type: 'activity', ownerUid, sessionId, runId, kind, ...(optionIndex === undefined ? {} : { optionIndex }), createdAt: Date.now() });
    throw error;
  }
}

export async function claimStudentMotivationQuestionEvent(ownerUid: string, sessionId: string, eventId: string) {
  try {
    return (await claimQuestionCall({ ownerUid, sessionId, eventId })).data;
  } catch (error) {
    if (isRetryableClaimError(error)) queueClaim({ id: `${ownerUid}:${sessionId}:question:${eventId}`, type: 'question', ownerUid, sessionId, eventId, createdAt: Date.now() });
    throw error;
  }
}

export async function flushPendingStudentMotivationClaims(ownerUid: string, sessionId: string) {
  const claims = readPendingClaims();
  if (!claims.length) return null;
  const retained: PendingClaim[] = [];
  let latestProfile: StoredStudentMotivationProfile | null = null;
  for (const claim of claims) {
    if (claim.ownerUid !== ownerUid || claim.sessionId !== sessionId) {
      retained.push(claim);
      continue;
    }
    try {
      latestProfile = claim.type === 'activity'
        ? (await claimCall({ ownerUid, sessionId, runId: claim.runId, kind: claim.kind, ...(claim.optionIndex === undefined ? {} : { optionIndex: claim.optionIndex }) })).data
        : (await claimQuestionCall({ ownerUid, sessionId, eventId: claim.eventId })).data;
    } catch (error) {
      if (isRetryableClaimError(error)) retained.push(claim);
    }
  }
  savePendingClaims(retained);
  return latestProfile;
}
