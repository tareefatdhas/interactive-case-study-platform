import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './config';
import { ensureStudentAnonymousAuth, studentDb } from './student-config';
import type { RewardDefinition, RewardKind, RewardRequest, RewardRequestStatus } from '@/types';

const REWARD_DEFINITIONS = 'rewardDefinitions';
const REWARD_REQUESTS = 'rewardRequests';

function requireInstructor() {
  const instructor = auth.currentUser;
  if (!instructor || instructor.isAnonymous) throw new Error('Instructor sign-in required.');
  return instructor;
}

export async function getRewardDefinitionsByTeacher(teacherId: string): Promise<RewardDefinition[]> {
  const snapshot = await getDocs(query(collection(db, REWARD_DEFINITIONS), where('teacherId', '==', teacherId)));
  return snapshot.docs
    .map((rewardDoc) => ({ id: rewardDoc.id, ...rewardDoc.data() } as RewardDefinition))
    .sort((a, b) => a.pointsRequired - b.pointsRequired);
}

export async function createRewardDefinition(input: {
  courseId: string;
  courseCode: string;
  name: string;
  description: string;
  pointsRequired: number;
  kind: RewardKind;
  limitPerStudent?: number;
}): Promise<string> {
  const instructor = requireInstructor();
  const now = Timestamp.now();
  const rewardDoc = await addDoc(collection(db, REWARD_DEFINITIONS), {
    ...input,
    teacherId: instructor.uid,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  return rewardDoc.id;
}

export async function updateRewardDefinition(rewardId: string, updates: Partial<Pick<RewardDefinition, 'name' | 'description' | 'pointsRequired' | 'kind' | 'limitPerStudent' | 'enabled'>>): Promise<void> {
  requireInstructor();
  await updateDoc(doc(db, REWARD_DEFINITIONS, rewardId), { ...updates, updatedAt: Timestamp.now() });
}

export async function deleteRewardDefinition(rewardId: string): Promise<void> {
  requireInstructor();
  await deleteDoc(doc(db, REWARD_DEFINITIONS, rewardId));
}

export async function getRewardRequestsForInstructor(teacherId: string): Promise<RewardRequest[]> {
  const snapshot = await getDocs(query(collection(db, REWARD_REQUESTS), where('teacherId', '==', teacherId)));
  return snapshot.docs
    .map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() } as RewardRequest))
    .sort((a, b) => (b.requestedAt?.toMillis?.() || 0) - (a.requestedAt?.toMillis?.() || 0));
}

export async function reviewRewardRequest(requestId: string, status: Exclude<RewardRequestStatus, 'pending'>, instructorNote?: string): Promise<void> {
  requireInstructor();
  await updateDoc(doc(db, REWARD_REQUESTS, requestId), {
    status,
    reviewedAt: Timestamp.now(),
    instructorNote: instructorNote?.trim() || '',
  });
}

export async function getAvailableRewardsForStudent(teacherId: string, courseIdOrCode: string): Promise<RewardDefinition[]> {
  await ensureStudentAnonymousAuth();
  // Keep this to a single-field query so a pilot classroom does not depend on
  // deploying a new composite Firestore index before rewards can load.
  const snapshot = await getDocs(query(collection(studentDb, REWARD_DEFINITIONS), where('teacherId', '==', teacherId)));
  return snapshot.docs
    .map((rewardDoc) => ({ id: rewardDoc.id, ...rewardDoc.data() } as RewardDefinition))
    .filter((reward) => reward.enabled && (reward.courseId === courseIdOrCode || reward.courseCode === courseIdOrCode))
    .sort((a, b) => a.pointsRequired - b.pointsRequired);
}

export async function getStudentRewardRequests(teacherId: string, courseIdOrCode: string): Promise<RewardRequest[]> {
  const student = await ensureStudentAnonymousAuth();
  const snapshot = await getDocs(query(collection(studentDb, REWARD_REQUESTS), where('authorUid', '==', student.uid)));
  return snapshot.docs
    .map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() } as RewardRequest))
    .filter((request) => request.teacherId === teacherId && (request.courseId === courseIdOrCode || request.courseCode === courseIdOrCode))
    .sort((a, b) => (b.requestedAt?.toMillis?.() || 0) - (a.requestedAt?.toMillis?.() || 0));
}

export async function requestReward(input: {
  teacherId: string;
  courseId: string;
  courseCode: string;
  studentNumber: string;
  studentDisplayName?: string;
  reward: RewardDefinition;
  pointsAtRequest: number;
}): Promise<string> {
  const student = await ensureStudentAnonymousAuth();
  const existing = await getStudentRewardRequests(input.teacherId, input.courseId);
  if (existing.some((request) => request.rewardId === input.reward.id && (request.status === 'pending' || request.status === 'approved'))) {
    throw new Error('You already have an active request for this reward.');
  }
  const usedCount = existing.filter((request) => request.rewardId === input.reward.id && request.status === 'used').length;
  if (usedCount >= (input.reward.limitPerStudent || 1)) {
    throw new Error('You have already used the available limit for this reward.');
  }
  if (input.pointsAtRequest < input.reward.pointsRequired) {
    throw new Error(`You need ${input.reward.pointsRequired - input.pointsAtRequest} more points to request this reward.`);
  }
  const requestDoc = await addDoc(collection(studentDb, REWARD_REQUESTS), {
    authorUid: student.uid,
    teacherId: input.teacherId,
    courseId: input.courseId,
    courseCode: input.courseCode,
    studentNumber: input.studentNumber,
    ...(input.studentDisplayName ? { studentDisplayName: input.studentDisplayName } : {}),
    rewardId: input.reward.id,
    rewardName: input.reward.name,
    pointsRequired: input.reward.pointsRequired,
    pointsAtRequest: input.pointsAtRequest,
    status: 'pending',
    requestedAt: Timestamp.now(),
  });
  return requestDoc.id;
}
