import {
  get,
  off,
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type Database,
  type DataSnapshot,
} from 'firebase/database';
import { auth, realtimeDb } from './config';
import { ensureStudentAnonymousAuth, studentAuth, studentRealtimeDb } from './student-config';
import { httpsCallable } from 'firebase/functions';
import { studentFunctions } from './student-config';
import type {
  InteractionResponse,
  LessonDisplayState,
  LiveQuestion,
  LiveSessionContext,
} from '@/app/live/live-data';
import type { SessionParticipationMode } from '@/types';
import { getQuestionPointRule, type QuestionPointRuleKey } from '@/app/live/student/rewards';

export type StoredLiveResponse = InteractionResponse & {
  studentUid: string;
  submittedAt: number;
};

export type StoredWelcomeResponse = {
  runId: number;
  mood: keyof LessonDisplayState['onboardingMoodCounts'];
  studentUid: string;
  submittedAt: number;
};

export type StoredStudentQuestion = {
  id: number;
  question: string;
  studentUid: string;
  submittedAt: number;
};

export type StoredQuestionPointClaim = {
  type: QuestionPointRuleKey;
  questionId: number;
  amount: number;
  label: string;
  createdAt: number;
};

export type AttendanceStatus = 'claimed' | 'participated' | 'confirmed' | 'excused';

export type StoredAttendanceClaim = {
  studentUid: string;
  participationMode?: SessionParticipationMode;
  studentNumber?: string;
  studentDisplayName?: string;
  status: AttendanceStatus;
  joinedAt: number;
  updatedAt: number;
  participatedAt?: number;
  privacyNoticeVersion?: string;
  privacyNoticeAcknowledgedAt?: number;
};

export type InstructorClassroomRecords = {
  attendance: Record<string, StoredAttendanceClaim>;
  responses: Record<string, Record<string, StoredLiveResponse>>;
  studentQuestions: Record<string, Record<string, StoredStudentQuestion>>;
  questionVotes: Record<string, Record<string, true>>;
  dismissedQuestions: Record<string, true>;
  recognizedQuestions: Record<string, true>;
};

type InstructorClassroomArchive = {
  createdAt: number;
  reason: 'session-reset';
  responses?: Record<string, Record<string, StoredLiveResponse>>;
  welcomeResponses?: Record<string, Record<string, StoredWelcomeResponse>>;
  studentQuestions?: Record<string, Record<string, StoredStudentQuestion>>;
  questionVotes?: Record<string, Record<string, true>>;
  dismissedQuestions?: Record<string, true>;
  questionPointClaims?: Record<string, Record<string, StoredQuestionPointClaim>>;
  recognizedQuestions?: Record<string, true>;
};

export type LiveJoinRecord = {
  sessionId: string;
  courseId?: string;
  ownerUid: string;
  sessionCode: string;
  courseCode: string;
  rewardScopeId?: string;
  courseName: string;
  sessionTitle: string;
  instructorName: string;
  participationMode?: SessionParticipationMode;
  status: 'live' | 'ended';
  expiresAt: number;
};

export type LiveClassroomMeta = LiveSessionContext & {
  ownerUid: string;
  status: 'live' | 'ended';
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

function roomPath(ownerUid: string, sessionId: string) {
  return `liveV2/${ownerUid}/${sessionId}`;
}

function cleanFirebaseValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeFirebaseList<T>(value: T[] | Record<string, T> | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function normalizePublicState(state: LessonDisplayState): LessonDisplayState {
  return {
    ...state,
    questions: normalizeFirebaseList(state.questions),
    teams: normalizeFirebaseList(state.teams),
    interactionResults: state.interactionResults ? {
      ...state.interactionResults,
      optionCounts: normalizeFirebaseList(state.interactionResults.optionCounts),
      writtenResponses: normalizeFirebaseList(state.interactionResults.writtenResponses),
    } : null,
  };
}

function joinCodePath(sessionCode: string) {
  return `liveJoinCodes/${sessionCode.replace(/[^a-z0-9]/gi, '').toUpperCase()}`;
}

export function normalizeStudentNumber(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9._-]/g, '').slice(0, 32);
}

export function normalizeStudentDisplayName(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 60);
}

export async function claimStudentAttendance(
  ownerUid: string,
  sessionId: string,
  rawStudentNumber: string,
  rawDisplayName = '',
  participationMode: SessionParticipationMode = 'course-record',
) {
  await ensureStudentAnonymousAuth();
  const studentNumber = normalizeStudentNumber(rawStudentNumber);
  const studentDisplayName = normalizeStudentDisplayName(rawDisplayName);
  if (participationMode === 'course-record' && studentNumber.length < 3) throw new Error('Enter your student number.');
  if (participationMode === 'session-name' && studentDisplayName.length < 2) throw new Error('Enter a name or nickname.');
  const callable = httpsCallable<{
    ownerUid: string;
    sessionId: string;
    studentNumber: string;
    studentDisplayName: string;
    participationMode: SessionParticipationMode;
  }, StoredAttendanceClaim>(studentFunctions, 'claimStudentAttendance');
  return (await callable({ ownerUid, sessionId, studentNumber, studentDisplayName, participationMode })).data;
}

export async function getCurrentStudentAttendance(ownerUid: string, sessionId: string): Promise<StoredAttendanceClaim | null> {
  const student = await ensureStudentAnonymousAuth();
  const snapshot = await get(ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/attendanceClaims/${student.uid}`));
  return snapshot.val() as StoredAttendanceClaim | null;
}

export async function deleteInstructorClassroomData(ownerUid: string, sessionId: string) {
  const instructor = auth.currentUser;
  if (!instructor || instructor.isAnonymous || instructor.uid !== ownerUid) throw new Error('Instructor sign-in required.');

  const metaSnapshot = await get(ref(realtimeDb, `${roomPath(ownerUid, sessionId)}/meta`));
  const meta = metaSnapshot.val() as LiveClassroomMeta | null;
  await set(ref(realtimeDb, roomPath(ownerUid, sessionId)), null);
  if (meta?.sessionCode) await set(ref(realtimeDb, joinCodePath(meta.sessionCode)), null);
}

async function markCurrentStudentParticipated(ownerUid: string, sessionId: string) {
  const student = await ensureStudentAnonymousAuth();
  const claimRef = ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/attendanceClaims/${student.uid}`);
  await runTransaction(claimRef, (current: StoredAttendanceClaim | null) => {
    if (!current || current.status !== 'claimed') return current;
    const now = Date.now();
    return { ...current, participationMode: current.participationMode || 'course-record', status: 'participated', participatedAt: now, updatedAt: now } satisfies StoredAttendanceClaim;
  });
}

export function subscribeToInstructorAttendance(
  ownerUid: string,
  sessionId: string,
  callback: (claims: Record<string, StoredAttendanceClaim>) => void,
) {
  const claimsRef = ref(realtimeDb, `${roomPath(ownerUid, sessionId)}/attendanceClaims`);
  onValue(claimsRef, (snapshot) => callback(snapshot.val() || {}));
  return () => off(claimsRef);
}

export async function initializeInstructorClassroom(
  sessionId: string,
  session: LiveSessionContext,
  initialState: LessonDisplayState,
) {
  const instructor = auth.currentUser;
  if (!instructor || instructor.isAnonymous) throw new Error('Instructor sign-in required.');

  const metaRef = ref(realtimeDb, `${roomPath(instructor.uid, sessionId)}/meta`);
  const priorMetaSnapshot = await get(metaRef);
  const priorMeta = priorMetaSnapshot.val() as LiveClassroomMeta | null;
  const result = await runTransaction(metaRef, (current: LiveClassroomMeta | null) => {
    if (current && current.ownerUid !== instructor.uid) return;
    const now = Date.now();
    return {
      ...(current || {}),
      ...session,
      ownerUid: instructor.uid,
      status: 'live',
      createdAt: current?.createdAt || now,
      updatedAt: now,
      expiresAt: current?.expiresAt && current.expiresAt > now ? current.expiresAt : now + 12 * 60 * 60 * 1000,
    } satisfies LiveClassroomMeta;
  }, { applyLocally: false });

  const meta = result.snapshot.val() as LiveClassroomMeta | null;
  if (!result.committed || meta?.ownerUid !== instructor.uid) {
    throw new Error('This classroom belongs to another instructor.');
  }

  const joinRecord: LiveJoinRecord = {
    sessionId,
    ...(session.courseId ? { courseId: session.courseId } : {}),
    ownerUid: instructor.uid,
    sessionCode: session.sessionCode,
    courseCode: session.courseCode,
    ...(session.rewardScopeId ? { rewardScopeId: session.rewardScopeId } : {}),
    courseName: session.courseName || '',
    sessionTitle: session.sessionTitle,
    instructorName: session.instructorName || 'Your instructor',
    participationMode: session.participationMode || 'course-record',
    status: 'live',
    expiresAt: meta.expiresAt,
  };
  await set(ref(realtimeDb, joinCodePath(session.sessionCode)), joinRecord);

  const publicStateRef = ref(realtimeDb, `${roomPath(instructor.uid, sessionId)}/publicState`);
  const publicStateSnapshot = await get(publicStateRef);
  if (priorMeta?.status === 'live' && priorMeta.expiresAt > Date.now() && publicStateSnapshot.exists()) {
    return normalizePublicState(publicStateSnapshot.val() as LessonDisplayState);
  }

  await publishInstructorState(instructor.uid, sessionId, initialState);
  return initialState;
}

export async function endInstructorClassroom(ownerUid: string, sessionId: string) {
  const instructor = auth.currentUser;
  if (!instructor || instructor.isAnonymous || instructor.uid !== ownerUid) throw new Error('Instructor sign-in required.');
  await settleQuestionPointClaims(ownerUid, sessionId).catch((error) => {
    const reason = error instanceof Error ? error.message : 'Unknown database response';
    console.warn(`Final question points were not settled. Class ending will continue. ${reason}`);
  });
  const metaRef = ref(realtimeDb, `${roomPath(ownerUid, sessionId)}/meta`);
  const currentSnapshot = await get(metaRef);
  const current = currentSnapshot.val() as LiveClassroomMeta | null;
  if (!current || current.ownerUid !== ownerUid) {
    throw new Error('The live classroom record could not be found.');
  }
  const meta = { ...current, status: 'ended', updatedAt: Date.now() } satisfies LiveClassroomMeta;
  await set(metaRef, meta);
  const verifiedMeta = (await get(metaRef)).val() as LiveClassroomMeta | null;
  if (verifiedMeta?.status !== 'ended') {
    throw new Error('The live classroom could not be ended. Try again before closing the instructor screen.');
  }
  if (meta.sessionCode) {
    const joinRef = ref(realtimeDb, joinCodePath(meta.sessionCode));
    const joinSnapshot = await get(joinRef);
    const joinRecord = joinSnapshot.val() as LiveJoinRecord | null;
    if (joinRecord?.ownerUid === ownerUid && joinRecord.sessionId === sessionId) {
      await set(joinRef, { ...joinRecord, status: 'ended' });
    }
  }
}

async function settleQuestionPointClaims(ownerUid: string, sessionId: string) {
  const basePath = roomPath(ownerUid, sessionId);
  const [metaSnapshot, questionsSnapshot, votesSnapshot, claimsSnapshot, recognizedSnapshot] = await Promise.all([
    get(ref(realtimeDb, `${basePath}/meta`)),
    get(ref(realtimeDb, `${basePath}/studentQuestions`)),
    get(ref(realtimeDb, `${basePath}/questionVotes`)),
    get(ref(realtimeDb, `${basePath}/questionPointClaims`)),
    get(ref(realtimeDb, `${basePath}/recognizedQuestions`)),
  ]);
  const meta = metaSnapshot.val() as LiveClassroomMeta | null;
  if ((meta?.participationMode || 'course-record') !== 'course-record') return;
  const questionsByStudent = (questionsSnapshot.val() || {}) as Record<string, Record<string, StoredStudentQuestion>>;
  const votesByQuestion = (votesSnapshot.val() || {}) as Record<string, Record<string, true>>;
  const claimsByStudent = (claimsSnapshot.val() || {}) as Record<string, Record<string, StoredQuestionPointClaim>>;
  const recognizedQuestions = (recognizedSnapshot.val() || {}) as Record<string, true>;
  const updates: Record<string, StoredQuestionPointClaim> = {};
  const now = Date.now();

  const addClaim = (studentUid: string, type: QuestionPointRuleKey, questionId: number) => {
    const rule = getQuestionPointRule(type);
    if (claimsByStudent[studentUid]?.[rule.id]) return;
    updates[`${basePath}/questionPointClaims/${studentUid}/${rule.id}`] = {
      type,
      questionId,
      amount: rule.amount,
      label: rule.label,
      createdAt: now,
    };
  };

  Object.entries(questionsByStudent).forEach(([studentUid, questionMap]) => {
    const questions = Object.values(questionMap || {}).sort((a, b) => a.submittedAt - b.submittedAt);
    if (!questions.length) return;
    addClaim(studentUid, 'asked', questions[0].id);

    const strongestQuestion = [...questions].sort((a, b) => {
      const aVotes = Object.values(votesByQuestion[String(a.id)] || {}).filter(Boolean).length;
      const bVotes = Object.values(votesByQuestion[String(b.id)] || {}).filter(Boolean).length;
      return bVotes - aVotes;
    })[0];
    const strongestVoteCount = Object.values(votesByQuestion[String(strongestQuestion.id)] || {}).filter(Boolean).length;
    if (strongestVoteCount >= 2) addClaim(studentUid, 'supported', strongestQuestion.id);
    if (strongestVoteCount >= 5) addClaim(studentUid, 'helpedRoom', strongestQuestion.id);

    const discussedQuestion = questions.find((question) => recognizedQuestions[String(question.id)] === true);
    if (discussedQuestion) addClaim(studentUid, 'discussed', discussedQuestion.id);
  });

  if (Object.keys(updates).length) await update(ref(realtimeDb), updates);
}

export async function resetInstructorClassroom(
  ownerUid: string,
  sessionId: string,
  resetState: LessonDisplayState,
) {
  const instructor = auth.currentUser;
  if (!instructor || instructor.isAnonymous || instructor.uid !== ownerUid) {
    throw new Error('Instructor sign-in required.');
  }

  const basePath = roomPath(ownerUid, sessionId);
  const now = Date.now();
  const archiveId = `reset-${now}`;
  const resetResult = await runTransaction(ref(realtimeDb, basePath), (currentValue) => {
    const current = currentValue as (Record<string, unknown> & {
      meta?: LiveClassroomMeta;
      archives?: Record<string, InstructorClassroomArchive>;
      responses?: InstructorClassroomArchive['responses'];
      welcomeResponses?: InstructorClassroomArchive['welcomeResponses'];
      studentQuestions?: InstructorClassroomArchive['studentQuestions'];
      questionVotes?: InstructorClassroomArchive['questionVotes'];
      dismissedQuestions?: InstructorClassroomArchive['dismissedQuestions'];
      questionPointClaims?: InstructorClassroomArchive['questionPointClaims'];
      recognizedQuestions?: InstructorClassroomArchive['recognizedQuestions'];
    }) | null;
    if (!current?.meta || current.meta.ownerUid !== ownerUid) return;

    const expiresAt = Math.max(current.meta.expiresAt || 0, now + 12 * 60 * 60 * 1000);
    const {
      responses,
      welcomeResponses,
      studentQuestions,
      questionVotes,
      dismissedQuestions,
      questionPointClaims,
      recognizedQuestions,
      ...roomWithoutCollectedData
    } = current;
    const archive = cleanFirebaseValue({
      createdAt: now,
      reason: 'session-reset',
      responses: responses || {},
      welcomeResponses: welcomeResponses || {},
      studentQuestions: studentQuestions || {},
      questionVotes: questionVotes || {},
      dismissedQuestions: dismissedQuestions || {},
      questionPointClaims: questionPointClaims || {},
      recognizedQuestions: recognizedQuestions || {},
    } satisfies InstructorClassroomArchive);

    return {
      ...roomWithoutCollectedData,
      archives: { ...(current.archives || {}), [archiveId]: archive },
      publicState: cleanFirebaseValue({ ...resetState, updatedAt: now }),
      meta: { ...current.meta, status: 'live', updatedAt: now, expiresAt },
    };
  }, { applyLocally: false });

  if (!resetResult.committed) throw new Error('The live classroom record could not be found.');
  const meta = resetResult.snapshot.child('meta').val() as LiveClassroomMeta | null;
  if (meta?.sessionCode) {
    await update(ref(realtimeDb, joinCodePath(meta.sessionCode)), {
      status: 'live',
      expiresAt: meta.expiresAt,
    });
  }
  return archiveId;
}

export async function getInstructorClassroomRecords(
  ownerUid: string,
  sessionId: string,
  options: { includeDiscussion?: boolean } = {},
): Promise<InstructorClassroomRecords> {
  const instructor = auth.currentUser;
  if (!instructor || instructor.isAnonymous || instructor.uid !== ownerUid) {
    throw new Error('Instructor sign-in required.');
  }
  // Read the protected branches directly. Realtime Database rules are not
  // filters, so reading their parent room is denied even when the instructor
  // is allowed to read each branch.
  const basePath = roomPath(ownerUid, sessionId);
  const [attendanceSnapshot, responsesSnapshot, archivesSnapshot, questionsSnapshot, votesSnapshot, dismissedSnapshot, recognizedSnapshot] = await Promise.all([
    get(ref(realtimeDb, `${basePath}/attendanceClaims`)),
    get(ref(realtimeDb, `${basePath}/responses`)).catch((error) => {
      console.error('Live responses could not be loaded for review:', error);
      return null;
    }),
    get(ref(realtimeDb, `${basePath}/archives`)).catch((error) => {
      console.warn('Archived classroom records could not be loaded for review:', error);
      return null;
    }),
    options.includeDiscussion ? get(ref(realtimeDb, `${basePath}/studentQuestions`)).catch(() => null) : Promise.resolve(null),
    options.includeDiscussion ? get(ref(realtimeDb, `${basePath}/questionVotes`)).catch(() => null) : Promise.resolve(null),
    options.includeDiscussion ? get(ref(realtimeDb, `${basePath}/dismissedQuestions`)).catch(() => null) : Promise.resolve(null),
    options.includeDiscussion ? get(ref(realtimeDb, `${basePath}/recognizedQuestions`)).catch(() => null) : Promise.resolve(null),
  ]);
  const responses = (responsesSnapshot?.val() || {}) as Record<string, Record<string, StoredLiveResponse>>;
  const archives = (archivesSnapshot?.val() || {}) as Record<string, InstructorClassroomArchive>;
  const studentQuestions = (questionsSnapshot?.val() || {}) as Record<string, Record<string, StoredStudentQuestion>>;
  const questionVotes = (votesSnapshot?.val() || {}) as Record<string, Record<string, true>>;
  const dismissedQuestions = (dismissedSnapshot?.val() || {}) as Record<string, true>;
  const recognizedQuestions = (recognizedSnapshot?.val() || {}) as Record<string, true>;
  Object.values(archives).forEach((archive) => {
    Object.entries(archive.responses || {}).forEach(([runId, runResponses]) => {
      responses[runId] = { ...(responses[runId] || {}), ...runResponses };
    });
    Object.entries(archive.studentQuestions || {}).forEach(([studentUid, questions]) => {
      studentQuestions[studentUid] = { ...(studentQuestions[studentUid] || {}), ...questions };
    });
    Object.entries(archive.questionVotes || {}).forEach(([questionId, voters]) => {
      questionVotes[questionId] = { ...(questionVotes[questionId] || {}), ...voters };
    });
    Object.assign(dismissedQuestions, archive.dismissedQuestions || {});
    Object.assign(recognizedQuestions, archive.recognizedQuestions || {});
  });
  return {
    attendance: (attendanceSnapshot.val() || {}) as Record<string, StoredAttendanceClaim>,
    responses,
    studentQuestions,
    questionVotes,
    dismissedQuestions,
    recognizedQuestions,
  };
}

export async function publishInstructorState(ownerUid: string, sessionId: string, state: LessonDisplayState) {
  const instructor = auth.currentUser;
  if (!instructor || instructor.isAnonymous || instructor.uid !== ownerUid) throw new Error('Instructor sign-in required.');
  await set(ref(realtimeDb, `${roomPath(ownerUid, sessionId)}/publicState`), cleanFirebaseValue(state));
}

export async function getLiveClassroomByCode(sessionCode: string) {
  await ensureStudentAnonymousAuth();
  const snapshot = await get(ref(studentRealtimeDb, joinCodePath(sessionCode)));
  const classroom = snapshot.val() as LiveJoinRecord | null;
  if (!classroom || classroom.status !== 'live' || classroom.expiresAt < Date.now()) return null;
  return classroom;
}

export async function getStudentClassroomMeta(ownerUid: string, sessionId: string) {
  await ensureStudentAnonymousAuth();
  const snapshot = await get(ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/meta`));
  return snapshot.exists() ? snapshot.val() as LiveClassroomMeta : null;
}

function subscribeToPublicState(
  database: Database,
  ownerUid: string,
  sessionId: string,
  callback: (state: LessonDisplayState | null) => void,
) {
  const stateRef = ref(database, `${roomPath(ownerUid, sessionId)}/publicState`);
  onValue(
    stateRef,
    (snapshot) => {
      const state = snapshot.val() as LessonDisplayState | null;
      callback(state ? normalizePublicState(state) : null);
    },
    () => callback(null),
  );
  return () => off(stateRef);
}

export function subscribeToInstructorPublicState(
  ownerUid: string,
  sessionId: string,
  callback: (state: LessonDisplayState | null) => void,
) {
  return subscribeToPublicState(realtimeDb, ownerUid, sessionId, callback);
}

export async function subscribeToStudentPublicState(
  ownerUid: string,
  sessionId: string,
  callback: (state: LessonDisplayState | null) => void,
) {
  await ensureStudentAnonymousAuth();
  return subscribeToPublicState(studentRealtimeDb, ownerUid, sessionId, callback);
}

export async function subscribeToStudentConnection(
  callback: (connected: boolean) => void,
) {
  await ensureStudentAnonymousAuth();
  const connectedRef = ref(studentRealtimeDb, '.info/connected');
  onValue(connectedRef, (snapshot) => callback(snapshot.val() === true));
  return () => off(connectedRef);
}

export async function submitStudentInteractionResponse(
  ownerUid: string,
  sessionId: string,
  response: InteractionResponse,
) {
  const student = await ensureStudentAnonymousAuth();
  const answer = typeof response.optionIndex === 'number'
    ? { optionIndex: response.optionIndex }
    : { text: response.text?.trim().slice(0, 280) || '' };
  const storedResponse: StoredLiveResponse = cleanFirebaseValue({
    id: `${response.runId}:${student.uid}`,
    runId: response.runId,
    interactionId: response.interactionId,
    studentUid: student.uid,
    ...answer,
    teamId: response.teamId?.trim().slice(0, 80),
    teamName: response.teamName?.trim().slice(0, 48),
    teamDescription: response.teamDescription?.trim().slice(0, 160),
    teamTag: response.teamTag?.trim().slice(0, 48),
    submittedAt: Date.now(),
  } as StoredLiveResponse);
  const responseRef = ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/responses/${response.runId}/${student.uid}`);
  const result = await runTransaction(responseRef, (current) => current || {
    ...storedResponse,
    submittedAt: serverTimestamp(),
  });
  await markCurrentStudentParticipated(ownerUid, sessionId).catch(() => undefined);
  return (result.snapshot.val() || storedResponse) as StoredLiveResponse;
}

export async function submitStudentWelcomeResponse(
  ownerUid: string,
  sessionId: string,
  runId: number,
  mood: keyof LessonDisplayState['onboardingMoodCounts'],
) {
  const student = await ensureStudentAnonymousAuth();
  const response: StoredWelcomeResponse = {
    runId,
    mood,
    studentUid: student.uid,
    submittedAt: Date.now(),
  };
  await set(
    ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/welcomeResponses/${runId}/${student.uid}`),
    { ...response, submittedAt: serverTimestamp() },
  );
  await markCurrentStudentParticipated(ownerUid, sessionId).catch(() => undefined);
  return response;
}

export function subscribeToInstructorResponses(
  ownerUid: string,
  sessionId: string,
  runId: string,
  callback: (responses: Record<string, StoredLiveResponse>) => void,
) {
  const responsesRef = ref(realtimeDb, `${roomPath(ownerUid, sessionId)}/responses/${runId}`);
  onValue(responsesRef, (snapshot) => callback(snapshot.val() || {}));
  return () => off(responsesRef);
}

export function subscribeToInstructorWelcomeResponses(
  ownerUid: string,
  sessionId: string,
  runId: number,
  callback: (responses: Record<string, StoredWelcomeResponse>) => void,
) {
  const responsesRef = ref(realtimeDb, `${roomPath(ownerUid, sessionId)}/welcomeResponses/${runId}`);
  onValue(responsesRef, (snapshot) => callback(snapshot.val() || {}));
  return () => off(responsesRef);
}

export function subscribeToInstructorQuestionVotes(
  ownerUid: string,
  sessionId: string,
  callback: (counts: Record<number, number>) => void,
) {
  const votesRef = ref(realtimeDb, `${roomPath(ownerUid, sessionId)}/questionVotes`);
  onValue(votesRef, (snapshot) => {
    const voteMap = (snapshot.val() || {}) as Record<string, Record<string, true>>;
    const counts: Record<number, number> = {};
    Object.entries(voteMap).forEach(([questionId, voters]) => {
      counts[Number(questionId)] = Object.keys(voters || {}).length;
    });
    callback(counts);
  });
  return () => off(votesRef);
}

export async function getStudentQuestionVotes(ownerUid: string, sessionId: string, questionIds: number[]) {
  const student = await ensureStudentAnonymousAuth();
  const votes = await Promise.all(questionIds.map(async (questionId) => {
    const snapshot = await get(
      ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/questionVotes/${questionId}/${student.uid}`),
    );
    return snapshot.val() === true ? questionId : null;
  }));
  return votes.filter((questionId): questionId is number => questionId !== null);
}

export async function setStudentQuestionVote(
  ownerUid: string,
  sessionId: string,
  questionId: number,
  voted: boolean,
) {
  const student = await ensureStudentAnonymousAuth();
  await set(
    ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/questionVotes/${questionId}/${student.uid}`),
    voted ? true : null,
  );
}

export async function getCurrentStudentQuestionIds(ownerUid: string, sessionId: string): Promise<number[]> {
  const student = await ensureStudentAnonymousAuth();
  const snapshot = await get(
    ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/studentQuestions/${student.uid}`),
  );
  const questions = (snapshot.val() || {}) as Record<string, StoredStudentQuestion>;
  return Object.values(questions)
    .map((question) => question.id)
    .filter((questionId): questionId is number => typeof questionId === 'number');
}

export async function submitStudentQuestion(ownerUid: string, sessionId: string, rawQuestion: string): Promise<LiveQuestion> {
  const student = await ensureStudentAnonymousAuth();
  const question = rawQuestion.trim().replace(/\s+/g, ' ').slice(0, 180);
  if (!question) throw new Error('Write a question before sending it.');
  const id = Date.now() * 100 + Math.floor(Math.random() * 100);
  const submittedAt = Date.now();
  const storedQuestion: StoredStudentQuestion = {
    id,
    question,
    studentUid: student.uid,
    submittedAt,
  };
  await set(
    ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/studentQuestions/${student.uid}/${id}`),
    storedQuestion,
  );
  return { id, initials: 'Q', ago: 'Just now', question, votes: 0, source: 'student' };
}

export async function claimStudentQuestionPoints(
  ownerUid: string,
  sessionId: string,
  type: QuestionPointRuleKey,
  questionId: number,
) {
  const student = await ensureStudentAnonymousAuth();
  const rule = getQuestionPointRule(type);
  const claim: StoredQuestionPointClaim = {
    type,
    questionId,
    amount: rule.amount,
    label: rule.label,
    createdAt: Date.now(),
  };
  const claimRef = ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/questionPointClaims/${student.uid}/${rule.id}`);
  const result = await runTransaction(claimRef, (current: StoredQuestionPointClaim | null) => current ? undefined : claim, { applyLocally: false });
  return {
    claim: (result.snapshot.val() || claim) as StoredQuestionPointClaim,
    created: result.committed,
    eventId: rule.id,
  };
}

export function subscribeToStudentQuestionPointClaims(
  ownerUid: string,
  sessionId: string,
  callback: (claims: Record<string, StoredQuestionPointClaim>) => void,
) {
  const student = studentAuth.currentUser;
  if (!student) throw new Error('Student sign-in required.');
  const claimsRef = ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/questionPointClaims/${student.uid}`);
  onValue(claimsRef, (snapshot) => callback(snapshot.val() || {}), () => callback({}));
  return () => off(claimsRef);
}

export async function setInstructorQuestionRecognized(ownerUid: string, sessionId: string, questionId: number) {
  const instructor = auth.currentUser;
  if (!instructor || instructor.isAnonymous || instructor.uid !== ownerUid) throw new Error('Instructor sign-in required.');
  await set(ref(realtimeDb, `${roomPath(ownerUid, sessionId)}/recognizedQuestions/${questionId}`), true);
}

export function subscribeToInstructorStudentQuestions(
  ownerUid: string,
  sessionId: string,
  callback: (questions: LiveQuestion[]) => void,
) {
  const questionsRef = ref(realtimeDb, `${roomPath(ownerUid, sessionId)}/studentQuestions`);
  const dismissedRef = ref(realtimeDb, `${roomPath(ownerUid, sessionId)}/dismissedQuestions`);
  let byStudent: Record<string, Record<string, StoredStudentQuestion>> = {};
  let dismissedQuestions: Record<string, true> = {};
  let questionsLoaded = false;
  let dismissedLoaded = false;

  const emit = () => {
    if (!questionsLoaded || !dismissedLoaded) return;
    const questions = Object.values(byStudent)
      .flatMap((studentQuestions) => Object.values(studentQuestions || {}))
      .filter((question) => typeof question?.id === 'number' && typeof question?.question === 'string')
      .filter((question) => dismissedQuestions[String(question.id)] !== true)
      .sort((a, b) => b.submittedAt - a.submittedAt)
      .map((question) => ({
        id: question.id,
        initials: 'Q',
        ago: 'Just now',
        question: question.question,
        votes: 0,
        source: 'student' as const,
      }));
    callback(questions);
  };

  onValue(questionsRef, (snapshot) => {
    byStudent = (snapshot.val() || {}) as Record<string, Record<string, StoredStudentQuestion>>;
    questionsLoaded = true;
    emit();
  });
  onValue(dismissedRef, (snapshot) => {
    dismissedQuestions = (snapshot.val() || {}) as Record<string, true>;
    dismissedLoaded = true;
    emit();
  });
  return () => {
    off(questionsRef);
    off(dismissedRef);
  };
}

export async function setInstructorQuestionDismissed(
  ownerUid: string,
  sessionId: string,
  questionId: number,
  dismissed: boolean,
) {
  const instructor = auth.currentUser;
  if (!instructor || instructor.isAnonymous || instructor.uid !== ownerUid) {
    throw new Error('Instructor sign-in required.');
  }
  await set(
    ref(realtimeDb, `${roomPath(ownerUid, sessionId)}/dismissedQuestions/${questionId}`),
    dismissed ? true : null,
  );
}

export function subscribeToInstructorPresence(
  ownerUid: string,
  sessionId: string,
  callback: (connectedStudents: number) => void,
) {
  const presenceRef = ref(realtimeDb, `${roomPath(ownerUid, sessionId)}/presence`);
  onValue(presenceRef, (snapshot) => {
    const presence = (snapshot.val() || {}) as Record<string, Record<string, { connected?: boolean }>>;
    callback(Object.values(presence).filter((connections) => (
      Object.values(connections || {}).some((connection) => connection.connected)
    )).length);
  });
  return () => off(presenceRef);
}

export function subscribeToInstructorDisplayPresence(
  ownerUid: string,
  sessionId: string,
  callback: (connected: boolean) => void,
) {
  const presenceRef = ref(realtimeDb, `${roomPath(ownerUid, sessionId)}/displayPresence`);
  onValue(presenceRef, (snapshot) => {
    const presence = (snapshot.val() || {}) as Record<string, Record<string, { connected?: boolean }>>;
    callback(Object.values(presence).some((connections) => (
      Object.values(connections || {}).some((connection) => connection.connected)
    )));
  });
  return () => off(presenceRef);
}

async function joinAnonymousPresence(path: string) {
  const user = await ensureStudentAnonymousAuth();
  const connectionId = crypto.randomUUID();
  const presenceRef = ref(studentRealtimeDb, `${path}/${user.uid}/${connectionId}`);
  const connectedRef = ref(studentRealtimeDb, '.info/connected');
  let stopped = false;

  const handleConnection = async (snapshot: DataSnapshot) => {
    if (!snapshot.val() || stopped) return;
    await onDisconnect(presenceRef).remove();
    if (stopped) return;
    await set(presenceRef, { connected: true, joinedAt: Date.now(), lastSeen: Date.now() });
  };

  onValue(connectedRef, handleConnection);
  return () => {
    stopped = true;
    off(connectedRef, 'value', handleConnection);
    set(presenceRef, null).catch(() => undefined);
  };
}

export async function joinStudentPresence(ownerUid: string, sessionId: string) {
  return joinAnonymousPresence(`${roomPath(ownerUid, sessionId)}/presence`);
}

export async function joinDisplayPresence(ownerUid: string, sessionId: string) {
  return joinAnonymousPresence(`${roomPath(ownerUid, sessionId)}/displayPresence`);
}

export async function getStudentResponse(ownerUid: string, sessionId: string, runId: string) {
  const student = await ensureStudentAnonymousAuth();
  const responseSnapshot = await get(ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/responses/${runId}/${student.uid}`));
  return responseSnapshot.val() as StoredLiveResponse | null;
}

export async function getStudentWelcomeResponse(ownerUid: string, sessionId: string, runId: number) {
  const student = await ensureStudentAnonymousAuth();
  const responseSnapshot = await get(ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/welcomeResponses/${runId}/${student.uid}`));
  return responseSnapshot.val() as StoredWelcomeResponse | null;
}
