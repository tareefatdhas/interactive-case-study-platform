import {
  get,
  off,
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  type Database,
  type DataSnapshot,
} from 'firebase/database';
import { auth, realtimeDb } from './config';
import { ensureStudentAnonymousAuth, studentRealtimeDb } from './student-config';
import { STUDENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacy';
import type {
  InteractionResponse,
  LessonDisplayState,
  LiveSessionContext,
} from '@/app/live/live-data';

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

export type AttendanceStatus = 'claimed' | 'participated' | 'confirmed' | 'excused';

export type StoredAttendanceClaim = {
  studentUid: string;
  studentNumber: string;
  status: AttendanceStatus;
  joinedAt: number;
  updatedAt: number;
  participatedAt?: number;
  privacyNoticeVersion?: string;
  privacyNoticeAcknowledgedAt?: number;
};

export type LiveJoinRecord = {
  sessionId: string;
  ownerUid: string;
  sessionCode: string;
  courseCode: string;
  courseName: string;
  sessionTitle: string;
  instructorName: string;
  status: 'live' | 'ended';
  expiresAt: number;
};

type LiveClassroomMeta = LiveSessionContext & {
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

export async function claimStudentAttendance(ownerUid: string, sessionId: string, rawStudentNumber: string) {
  const student = await ensureStudentAnonymousAuth();
  const studentNumber = normalizeStudentNumber(rawStudentNumber);
  if (studentNumber.length < 3) throw new Error('Enter your student number.');

  const claimRef = ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/attendanceClaims/${student.uid}`);
  const result = await runTransaction(claimRef, (current: StoredAttendanceClaim | null) => {
    const now = Date.now();
    if (current?.status === 'participated' && current.studentNumber !== studentNumber) return;
    return {
      studentUid: student.uid,
      studentNumber,
      status: current?.status || 'claimed',
      joinedAt: current?.joinedAt || now,
      updatedAt: now,
      privacyNoticeVersion: STUDENT_PRIVACY_NOTICE_VERSION,
      privacyNoticeAcknowledgedAt: now,
      ...(current?.participatedAt ? { participatedAt: current.participatedAt } : {}),
    } satisfies StoredAttendanceClaim;
  });

  const claim = result.snapshot.val() as StoredAttendanceClaim | null;
  if (!result.committed || !claim || claim.studentNumber !== studentNumber) {
    throw new Error('This device has already participated under another student number. Use your original device or ask your instructor for help.');
  }
  return claim;
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
    return { ...current, status: 'participated', participatedAt: now, updatedAt: now } satisfies StoredAttendanceClaim;
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
    ownerUid: instructor.uid,
    sessionCode: session.sessionCode,
    courseCode: session.courseCode,
    courseName: session.courseName || '',
    sessionTitle: session.sessionTitle,
    instructorName: session.instructorName || 'Your instructor',
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
    submittedAt: Date.now(),
  } as StoredLiveResponse);
  await set(
    ref(studentRealtimeDb, `${roomPath(ownerUid, sessionId)}/responses/${response.runId}/${student.uid}`),
    { ...storedResponse, submittedAt: serverTimestamp() },
  );
  await markCurrentStudentParticipated(ownerUid, sessionId).catch(() => undefined);
  return storedResponse;
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
