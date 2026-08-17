import { httpsCallable } from 'firebase/functions';
import { functions } from './config';
import type { SignalAvatar } from '@/lib/gamification';

export type InstructorMomentumStudent = {
  id: string;
  seminarPoints: number;
  classScore: number;
  classRun: number;
  longestRun: number;
  sessionsParticipated: number;
  alias: string;
  avatar: SignalAvatar;
  leaderboardOptIn: boolean;
  team: { id: string; name: string; color: string } | null;
};

export type InstructorMomentumTeam = {
  id: string;
  name: string;
  color: string;
  activeMembers: number;
  score: number;
  eligible: boolean;
};

export type InstructorMomentumBoard = {
  students: InstructorMomentumStudent[];
  teams: InstructorMomentumTeam[];
  updatedAt: number;
};

const boardCall = httpsCallable<{ courseId: string }, InstructorMomentumBoard>(functions, 'getInstructorMomentumBoard');

export async function getInstructorMomentumBoard(courseId: string) {
  return (await boardCall({ courseId })).data;
}
