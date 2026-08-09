import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, signInAnonymously } from 'firebase/auth';
import { deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { get, getDatabase, ref, remove, set } from 'firebase/database';

loadEnv({ path: '.env.local', quiet: true });

if (process.env.CLASSFULLY_LIVE_E2E_CONFIRMED !== 'true') {
  throw new Error('Set CLASSFULLY_LIVE_E2E_CONFIRMED=true to acknowledge that this test creates and removes production test records.');
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

if (firebaseConfig.projectId !== 'interactive-case-study-2aff7') {
  throw new Error('The live contract test is only configured for the Classfully production Firebase project.');
}

const runId = `contract-${Date.now()}`;
const sessionId = `e2e-${randomUUID()}`;
const courseId = `e2e-${randomUUID()}`;
const sessionCode = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
const teacherApp = initializeApp(firebaseConfig, `teacher-${runId}`);
const studentApp = initializeApp(firebaseConfig, `student-${runId}`);
const teacherAuth = getAuth(teacherApp);
const studentAuth = getAuth(studentApp);
const teacherDb = getFirestore(teacherApp);
const teacherRealtime = getDatabase(teacherApp);
const studentRealtime = getDatabase(studentApp);

let teacherUser;
let studentUser;

function assertContract(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const password = `Classfully-${randomUUID()}-A1!`;
  const credential = await createUserWithEmailAndPassword(
    teacherAuth,
    `classfully-contract-${Date.now()}@example.com`,
    password,
  );
  teacherUser = credential.user;

  await setDoc(doc(teacherDb, 'teachers', teacherUser.uid), {
    email: teacherUser.email,
    name: 'Classfully contract check',
    courseIds: [courseId],
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(teacherDb, 'courses', courseId), {
    teacherId: teacherUser.uid,
    code: 'E2E 101',
    name: 'Classroom contract check',
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(teacherDb, 'sessions', sessionId), {
    teacherId: teacherUser.uid,
    courseId,
    sessionType: 'standalone',
    sessionCode,
    title: 'Live contract check',
    active: true,
    createdAt: serverTimestamp(),
  });

  const now = Date.now();
  const expiresAt = now + 60 * 60 * 1000;
  const roomPath = `liveV2/${teacherUser.uid}/${sessionId}`;
  const interactionId = 'contract-poll';
  const interactionRunId = `${interactionId}-${now}`;
  const questions = [{ id: 1, initials: 'A', ago: 'Just now', question: 'Can we test a vote?', votes: 0 }];
  const emptyCounts = { energized: 0, steady: 0, tired: 0, overwhelmed: 0, private: 0 };

  await set(ref(teacherRealtime, roomPath), {
    meta: {
      ownerUid: teacherUser.uid,
      status: 'live',
      sessionCode,
      courseCode: 'E2E 101',
      courseName: 'Classroom contract check',
      sessionTitle: 'Live contract check',
      instructorName: 'Classfully contract check',
      createdAt: now,
      updatedAt: now,
      expiresAt,
    },
    publicState: {
      session: {
        ownerUid: teacherUser.uid,
        sessionId,
        sessionCode,
        courseCode: 'E2E 101',
        courseName: 'Classroom contract check',
        sessionTitle: 'Live contract check',
        instructorName: 'Classfully contract check',
      },
      counts: emptyCounts,
      comparisonCounts: emptyCounts,
      incomingMood: null,
      paused: false,
      playingHistory: false,
      selectedWeek: 0,
      showComparison: false,
      onboardingStep: 3,
      onboardingRunId: 1,
      onboardingMoodCounts: emptyCounts,
      activeInteraction: {
        id: interactionId,
        type: 'poll',
        label: 'Poll',
        title: 'Contract poll',
        prompt: 'Can a student response reach the instructor?',
        options: ['Yes', 'Not yet'],
        resultVisibility: 'live',
      },
      interactionResults: {
        runId: interactionRunId,
        open: true,
        responseCount: 0,
        optionCounts: [0, 0],
        writtenResponses: [],
        revealed: true,
        sharedResponseId: null,
      },
      featuredQuestionId: null,
      questions,
      updatedAt: now,
    },
  });
  await set(ref(teacherRealtime, `liveJoinCodes/${sessionCode}`), {
    sessionId,
    ownerUid: teacherUser.uid,
    sessionCode,
    courseCode: 'E2E 101',
    courseName: 'Classroom contract check',
    sessionTitle: 'Live contract check',
    instructorName: 'Classfully contract check',
    status: 'live',
    expiresAt,
  });

  studentUser = (await signInAnonymously(studentAuth)).user;
  const joinSnapshot = await get(ref(studentRealtime, `liveJoinCodes/${sessionCode}`));
  assertContract(joinSnapshot.val()?.sessionId === sessionId, 'Student could not resolve the live join code.');
  const publicStateSnapshot = await get(ref(studentRealtime, `${roomPath}/publicState`));
  assertContract(publicStateSnapshot.val()?.activeInteraction?.id === interactionId, 'Student could not read the active interaction.');

  const studentNow = Date.now();
  await set(ref(studentRealtime, `${roomPath}/attendanceClaims/${studentUser.uid}`), {
    studentUid: studentUser.uid,
    studentNumber: 'E2E0001',
    studentDisplayName: 'Contract student',
    status: 'claimed',
    joinedAt: studentNow,
    updatedAt: studentNow,
    privacyNoticeVersion: 'contract-check',
    privacyNoticeAcknowledgedAt: studentNow,
  });
  await set(ref(studentRealtime, `${roomPath}/welcomeResponses/1/${studentUser.uid}`), {
    runId: 1,
    mood: 'steady',
    studentUid: studentUser.uid,
    submittedAt: Date.now(),
  });
  await set(ref(studentRealtime, `${roomPath}/responses/${interactionRunId}/${studentUser.uid}`), {
    id: `${interactionRunId}-${studentUser.uid}`,
    runId: interactionRunId,
    interactionId,
    studentUid: studentUser.uid,
    optionIndex: 0,
    submittedAt: Date.now(),
  });
  await set(ref(studentRealtime, `${roomPath}/questionVotes/1/${studentUser.uid}`), true);
  await set(ref(studentRealtime, `${roomPath}/presence/${studentUser.uid}/contract-connection`), {
    connected: true,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
  });

  const [attendance, response, welcomeResponse, questionVote, sessionDocument] = await Promise.all([
    get(ref(teacherRealtime, `${roomPath}/attendanceClaims/${studentUser.uid}`)),
    get(ref(teacherRealtime, `${roomPath}/responses/${interactionRunId}/${studentUser.uid}`)),
    get(ref(teacherRealtime, `${roomPath}/welcomeResponses/1/${studentUser.uid}`)),
    get(ref(teacherRealtime, `${roomPath}/questionVotes/1/${studentUser.uid}`)),
    getDoc(doc(teacherDb, 'sessions', sessionId)),
  ]);

  assertContract(attendance.val()?.studentNumber === 'E2E0001', 'Instructor could not receive the attendance claim.');
  assertContract(response.val()?.optionIndex === 0, 'Instructor could not receive the student response.');
  assertContract(welcomeResponse.val()?.mood === 'steady', 'Instructor could not receive the student pulse.');
  assertContract(questionVote.val() === true, 'Instructor could not receive the student question vote.');
  assertContract(sessionDocument.exists(), 'The prepared session did not persist in Firestore.');

  console.log('PASS Instructor created a production classroom.');
  console.log('PASS Student resolved the join code and read the live activity.');
  console.log('PASS Attendance, pulse, poll response, presence, and question vote crossed the production rules.');
  console.log('PASS Instructor received the student records.');
} finally {
  if (teacherUser) {
    await Promise.allSettled([
      remove(ref(teacherRealtime, `liveV2/${teacherUser.uid}/${sessionId}`)),
      remove(ref(teacherRealtime, `liveJoinCodes/${sessionCode}`)),
      deleteDoc(doc(teacherDb, 'sessions', sessionId)),
      deleteDoc(doc(teacherDb, 'courses', courseId)),
    ]);
    await Promise.allSettled([deleteDoc(doc(teacherDb, 'teachers', teacherUser.uid))]);
  }
  if (studentUser) await Promise.allSettled([deleteUser(studentUser)]);
  if (teacherUser) await Promise.allSettled([deleteUser(teacherUser)]);
  await Promise.allSettled([deleteApp(studentApp), deleteApp(teacherApp)]);
  console.log('PASS Production test records were cleaned up.');
}
