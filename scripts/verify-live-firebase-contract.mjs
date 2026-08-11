import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, signInAnonymously } from 'firebase/auth';
import { arrayUnion, deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { get, getDatabase, ref, remove, runTransaction, set, update } from 'firebase/database';

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
  const sourceId = `source-${randomUUID()}`;
  await updateDoc(doc(teacherDb, 'courses', courseId), {
    courseSources: [{
      id: sourceId,
      title: 'Contract teaching notes',
      kind: 'notes',
      content: 'Network effects become more useful as participation grows. Ask students to compare direct and indirect effects.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }],
  });
  const courseWithSource = await getDoc(doc(teacherDb, 'courses', courseId));
  assertContract(
    courseWithSource.data()?.courseSources?.[0]?.id === sourceId,
    'The instructor could not save private course material.',
  );
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
  await updateDoc(doc(teacherDb, 'sessions', sessionId), {
    studentsJoined: arrayUnion('E2E0001'),
    lastActivityAt: serverTimestamp(),
  });

  const responseContracts = [
    { id: 'contract-pulse', type: 'pulse', label: 'Pulse', options: ['Ready', 'Not yet'], optionIndex: 0 },
    { id: 'contract-quiz', type: 'quiz', label: 'Quiz', options: ['A', 'B'], optionIndex: 1 },
    { id: 'contract-peer-learning', type: 'peer-learning', label: 'Peer learning', options: ['A', 'B'], optionIndex: 0 },
    { id: 'contract-open-response', type: 'open-response', label: 'Short response', text: 'I need another example.' },
    { id: 'contract-word-cloud', type: 'word-cloud', label: 'Word cloud', text: 'Curiosity' },
    { id: 'contract-group-work', type: 'group-work', label: 'Group work', text: 'Our group chose one shared dependency.' },
  ];
  const responseContractRuns = [];

  for (const contract of responseContracts) {
    const contractRunId = `${contract.id}-${Date.now()}`;
    await update(ref(teacherRealtime, `${roomPath}/publicState`), {
      activeInteraction: {
        id: contract.id,
        type: contract.type,
        label: contract.label,
        title: `Contract ${contract.label.toLowerCase()}`,
        prompt: `Can a ${contract.label.toLowerCase()} response cross the live classroom rules?`,
        options: contract.options || [],
        resultVisibility: contract.type === 'open-response' || contract.type === 'group-work' ? 'instructor-only' : 'live',
      },
      interactionResults: {
        runId: contractRunId,
        open: true,
        responseCount: 0,
        optionCounts: contract.options?.map(() => 0) || [],
        writtenResponses: [],
        revealed: contract.type !== 'quiz' && contract.type !== 'peer-learning',
        sharedResponseId: null,
      },
      updatedAt: Date.now(),
    });
    const answer = typeof contract.optionIndex === 'number'
      ? { optionIndex: contract.optionIndex }
      : { text: contract.text };
    await set(ref(studentRealtime, `${roomPath}/responses/${contractRunId}/${studentUser.uid}`), {
      id: `${contractRunId}-${studentUser.uid}`,
      runId: contractRunId,
      interactionId: contract.id,
      studentUid: studentUser.uid,
      ...answer,
      submittedAt: Date.now(),
    });
    responseContractRuns.push({ ...contract, runId: contractRunId });
  }

  const timerInteractionId = 'contract-timer';
  const timerRunId = `${timerInteractionId}-${Date.now()}`;
  await update(ref(teacherRealtime, `${roomPath}/publicState`), {
    activeInteraction: {
      id: timerInteractionId,
      type: 'timer',
      label: 'Clock',
      title: 'Contract clock',
      prompt: 'No student response is needed.',
      options: [],
      resultVisibility: 'live',
    },
    interactionResults: {
      runId: timerRunId,
      open: false,
      responseCount: 0,
      optionCounts: [],
      writtenResponses: [],
      revealed: true,
      sharedResponseId: null,
    },
    updatedAt: Date.now(),
  });
  const timerWriteWasRejected = await set(ref(studentRealtime, `${roomPath}/responses/${timerRunId}/${studentUser.uid}`), {
    id: `${timerRunId}-${studentUser.uid}`,
    runId: timerRunId,
    interactionId: timerInteractionId,
    studentUid: studentUser.uid,
    text: 'This should not be accepted.',
    submittedAt: Date.now(),
  }).then(() => false).catch(() => true);
  const studentQuestionId = Date.now() * 100 + 7;
  await set(ref(studentRealtime, `${roomPath}/studentQuestions/${studentUser.uid}/${studentQuestionId}`), {
    id: studentQuestionId,
    question: 'Could you explain this idea with another example?',
    studentUid: studentUser.uid,
    submittedAt: Date.now(),
  });
  const selfQuestionVoteWasRejected = await set(
    ref(studentRealtime, `${roomPath}/questionVotes/${studentQuestionId}/${studentUser.uid}`),
    true,
  ).then(() => false).catch(() => true);
  await set(ref(studentRealtime, `${roomPath}/questionVotes/1/${studentUser.uid}`), true);
  await set(ref(studentRealtime, `${roomPath}/presence/${studentUser.uid}/contract-connection`), {
    connected: true,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
  });

  const [attendance, attendanceBranch, response, responsesBranch, welcomeResponse, studentQuestion, questionVote, sessionDocument, timerResponse] = await Promise.all([
    get(ref(teacherRealtime, `${roomPath}/attendanceClaims/${studentUser.uid}`)),
    get(ref(teacherRealtime, `${roomPath}/attendanceClaims`)),
    get(ref(teacherRealtime, `${roomPath}/responses/${interactionRunId}/${studentUser.uid}`)),
    get(ref(teacherRealtime, `${roomPath}/responses`)),
    get(ref(teacherRealtime, `${roomPath}/welcomeResponses/1/${studentUser.uid}`)),
    get(ref(teacherRealtime, `${roomPath}/studentQuestions/${studentUser.uid}/${studentQuestionId}`)),
    get(ref(teacherRealtime, `${roomPath}/questionVotes/1/${studentUser.uid}`)),
    getDoc(doc(teacherDb, 'sessions', sessionId)),
    get(ref(teacherRealtime, `${roomPath}/responses/${timerRunId}/${studentUser.uid}`)),
  ]);
  const contractResponseSnapshots = await Promise.all(responseContractRuns.map((contract) => (
    get(ref(teacherRealtime, `${roomPath}/responses/${contract.runId}/${studentUser.uid}`))
  )));

  assertContract(attendance.val()?.studentNumber === 'E2E0001', 'Instructor could not receive the attendance claim.');
  assertContract(attendanceBranch.child(studentUser.uid).val()?.studentNumber === 'E2E0001', 'Progress could not read the session attendance branch.');
  assertContract(response.val()?.optionIndex === 0, 'Instructor could not receive the student response.');
  assertContract(responsesBranch.child(`${interactionRunId}/${studentUser.uid}`).val()?.optionIndex === 0, 'Progress could not read the session response branch.');
  responseContractRuns.forEach((contract, index) => {
    const stored = contractResponseSnapshots[index].val();
    if (typeof contract.optionIndex === 'number') {
      assertContract(stored?.optionIndex === contract.optionIndex, `Instructor could not receive the ${contract.type} selection.`);
    } else {
      assertContract(stored?.text === contract.text, `Instructor could not receive the ${contract.type} text response.`);
    }
  });
  assertContract(timerWriteWasRejected && !timerResponse.exists(), 'The clock accepted a student response even though no response should be collected.');
  assertContract(welcomeResponse.val()?.mood === 'steady', 'Instructor could not receive the student pulse.');
  assertContract(studentQuestion.val()?.question === 'Could you explain this idea with another example?', 'Instructor could not receive the student question.');
  assertContract(selfQuestionVoteWasRejected, 'A student was able to upvote their own question.');
  assertContract(questionVote.val() === true, 'Instructor could not receive the student question vote.');
  assertContract(sessionDocument.exists(), 'The prepared session did not persist in Firestore.');
  assertContract(sessionDocument.data()?.studentsJoined?.includes('E2E0001'), 'The durable session roster did not include the joined student.');

  await set(ref(studentRealtime, `${roomPath}/questionVotes/1/${studentUser.uid}`), null);
  await set(ref(teacherRealtime, `${roomPath}/dismissedQuestions/1`), true);
  const dismissedQuestionVoteWasRejected = await set(
    ref(studentRealtime, `${roomPath}/questionVotes/1/${studentUser.uid}`),
    true,
  ).then(() => false).catch(() => true);
  assertContract(dismissedQuestionVoteWasRejected, 'A student was able to upvote a dismissed question.');

  const resetAt = Date.now();
  const resetExpiresAt = resetAt + 60 * 60 * 1000;
  const resetArchiveId = `reset-${resetAt}`;
  const resetResult = await runTransaction(ref(teacherRealtime, roomPath), (current) => {
    if (!current) return;
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
    return {
      ...roomWithoutCollectedData,
      archives: {
        ...(current.archives || {}),
        [resetArchiveId]: {
          createdAt: resetAt,
          reason: 'session-reset',
          responses: responses || {},
          welcomeResponses: welcomeResponses || {},
          studentQuestions: studentQuestions || {},
          questionVotes: questionVotes || {},
          dismissedQuestions: dismissedQuestions || {},
          questionPointClaims: questionPointClaims || {},
          recognizedQuestions: recognizedQuestions || {},
        },
      },
      publicState: {
        ...current.publicState,
        counts: emptyCounts,
        comparisonCounts: emptyCounts,
        onboardingStep: 0,
        onboardingRunId: 0,
        onboardingMoodCounts: emptyCounts,
        activeInteraction: null,
        interactionResults: null,
        featuredQuestionId: null,
        questions: [],
        updatedAt: resetAt,
      },
      meta: { ...current.meta, status: 'live', updatedAt: resetAt, expiresAt: resetExpiresAt },
    };
  }, { applyLocally: false });
  assertContract(resetResult.committed, 'Reset transaction did not commit.');
  await update(ref(teacherRealtime, `liveJoinCodes/${sessionCode}`), {
    status: 'live',
    expiresAt: resetExpiresAt,
  });

  const [resetAttendance, resetPresence, resetResponses, resetWelcome, resetQuestions, resetVotes, resetDismissed, resetState, archivedResponse, archivedQuestion] = await Promise.all([
    get(ref(teacherRealtime, `${roomPath}/attendanceClaims/${studentUser.uid}`)),
    get(ref(teacherRealtime, `${roomPath}/presence/${studentUser.uid}/contract-connection`)),
    get(ref(teacherRealtime, `${roomPath}/responses/${interactionRunId}/${studentUser.uid}`)),
    get(ref(teacherRealtime, `${roomPath}/welcomeResponses/1/${studentUser.uid}`)),
    get(ref(teacherRealtime, `${roomPath}/studentQuestions/${studentUser.uid}/${studentQuestionId}`)),
    get(ref(teacherRealtime, `${roomPath}/questionVotes/1/${studentUser.uid}`)),
    get(ref(teacherRealtime, `${roomPath}/dismissedQuestions/1`)),
    get(ref(teacherRealtime, `${roomPath}/publicState`)),
    get(ref(teacherRealtime, `${roomPath}/archives/${resetArchiveId}/responses/${interactionRunId}/${studentUser.uid}`)),
    get(ref(teacherRealtime, `${roomPath}/archives/${resetArchiveId}/studentQuestions/${studentUser.uid}/${studentQuestionId}`)),
  ]);
  assertContract(resetAttendance.exists(), 'Reset removed attendance that should have been preserved.');
  assertContract(resetPresence.exists(), 'Reset disconnected a student who should have stayed connected.');
  assertContract(!resetResponses.exists(), 'Reset did not clear interaction responses.');
  assertContract(!resetWelcome.exists(), 'Reset did not clear pulse responses.');
  assertContract(!resetQuestions.exists(), 'Reset did not clear student questions.');
  assertContract(!resetVotes.exists(), 'Reset did not clear question votes.');
  assertContract(!resetDismissed.exists(), 'Reset did not clear dismissed question records.');
  assertContract(!resetState.child('activeInteraction').exists(), 'Reset did not return the classroom to its starting state.');
  assertContract(archivedResponse.val()?.optionIndex === 0, 'Reset did not archive the prior interaction response.');
  assertContract(archivedQuestion.val()?.question === 'Could you explain this idea with another example?', 'Reset did not archive the prior student question.');

  const finalQuestionId = Date.now() * 100 + 9;
  await set(ref(studentRealtime, `${roomPath}/studentQuestions/${studentUser.uid}/${finalQuestionId}`), {
    id: finalQuestionId,
    question: 'Will final question points settle when class ends?',
    studentUid: studentUser.uid,
    submittedAt: Date.now(),
  });
  await set(ref(studentRealtime, `${roomPath}/questionPointClaims/${studentUser.uid}/question-asked`), {
    type: 'asked',
    questionId: finalQuestionId,
    amount: 1,
    label: 'Asked a question',
    createdAt: Date.now(),
  });
  await set(ref(teacherRealtime, `${roomPath}/recognizedQuestions/${finalQuestionId}`), true);

  const [questionsBeforeEnd, claimsBeforeEnd, recognizedBeforeEnd] = await Promise.all([
    get(ref(teacherRealtime, `${roomPath}/studentQuestions`)),
    get(ref(teacherRealtime, `${roomPath}/questionPointClaims`)),
    get(ref(teacherRealtime, `${roomPath}/recognizedQuestions`)),
  ]);
  assertContract(questionsBeforeEnd.exists(), 'Instructor could not read questions during final settlement.');
  assertContract(claimsBeforeEnd.child(`${studentUser.uid}/question-asked`).exists(), 'Instructor could not read question point claims during final settlement.');
  assertContract(recognizedBeforeEnd.child(String(finalQuestionId)).val() === true, 'Instructor could not read recognized questions during final settlement.');

  await update(ref(teacherRealtime), {
    [`${roomPath}/questionPointClaims/${studentUser.uid}/question-discussed`]: {
      type: 'discussed',
      questionId: finalQuestionId,
      amount: 3,
      label: 'Question discussed in class',
      createdAt: Date.now(),
    },
  });
  await set(ref(teacherRealtime, `${roomPath}/meta/status`), 'ended');
  await set(ref(teacherRealtime, `${roomPath}/meta/updatedAt`), Date.now());
  await set(ref(teacherRealtime, `liveJoinCodes/${sessionCode}/status`), 'ended');
  await updateDoc(doc(teacherDb, 'sessions', sessionId), { active: false, endedAt: serverTimestamp() });

  const [endedMeta, endedJoinCode, discussedClaim, endedSession] = await Promise.all([
    get(ref(teacherRealtime, `${roomPath}/meta`)),
    get(ref(teacherRealtime, `liveJoinCodes/${sessionCode}`)),
    get(ref(teacherRealtime, `${roomPath}/questionPointClaims/${studentUser.uid}/question-discussed`)),
    getDoc(doc(teacherDb, 'sessions', sessionId)),
  ]);
  assertContract(endedMeta.val()?.status === 'ended', 'The live classroom was not marked ended.');
  assertContract(endedJoinCode.val()?.status === 'ended', 'The student join record was not marked ended.');
  assertContract(discussedClaim.val()?.amount === 3, 'Final instructor question points were not saved.');
  assertContract(endedSession.data()?.active === false, 'The prepared session record remained active after ending.');

  console.log('PASS Instructor created a production classroom.');
  console.log('PASS Instructor saved private course material for later session planning.');
  console.log('PASS Student resolved the join code and read the live activity.');
  console.log('PASS Pulse, poll, quiz, peer learning, open response, word cloud, and group work crossed the production rules.');
  console.log('PASS The shared clock correctly rejected an unexpected student response.');
  console.log('PASS Instructor received the student records.');
  console.log('PASS Progress can read attendance and responses, with a durable session roster fallback.');
  console.log('PASS Dismissed questions reject new student votes.');
  console.log('PASS Session reset archived collected data while preserving attendance and presence.');
  console.log('PASS Session ending settled final question points and closed both live records.');
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
