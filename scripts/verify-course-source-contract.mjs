import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, signInAnonymously } from 'firebase/auth';
import { deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

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
};

if (firebaseConfig.projectId !== 'interactive-case-study-2aff7') {
  throw new Error('The course-source contract test is only configured for the Classfully production Firebase project.');
}

const runId = `${Date.now()}-${randomUUID()}`;
const courseId = `source-course-${randomUUID()}`;
const sessionId = `source-session-${randomUUID()}`;
const sourceId = `source-${randomUUID()}`;
const teacherApp = initializeApp(firebaseConfig, `source-teacher-${runId}`);
const studentApp = initializeApp(firebaseConfig, `source-student-${runId}`);
const teacherAuth = getAuth(teacherApp);
const studentAuth = getAuth(studentApp);
const teacherDb = getFirestore(teacherApp);
const studentDb = getFirestore(studentApp);

let teacherUser;
let studentUser;

const assertContract = (condition, message) => {
  if (!condition) throw new Error(message);
};

try {
  teacherUser = (await createUserWithEmailAndPassword(
    teacherAuth,
    `classfully-source-${Date.now()}@example.com`,
    `Classfully-${randomUUID()}-A1!`,
  )).user;

  await setDoc(doc(teacherDb, 'teachers', teacherUser.uid), {
    email: teacherUser.email,
    name: 'Course source contract check',
    courseIds: [courseId],
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(teacherDb, 'courses', courseId), {
    teacherId: teacherUser.uid,
    code: 'SRC 101',
    name: 'Source contract course',
    createdAt: serverTimestamp(),
  });

  const source = {
    id: sourceId,
    title: 'Network effects teaching notes',
    kind: 'notes',
    content: 'Direct network effects connect value to participation. Indirect effects connect complementary groups.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await updateDoc(doc(teacherDb, 'courses', courseId), { courseSources: [source] });
  await setDoc(doc(teacherDb, 'sessions', sessionId), {
    teacherId: teacherUser.uid,
    courseId,
    title: 'Source-backed session',
    courseSourceIds: [sourceId],
    interactions: [],
    createdAt: serverTimestamp(),
  });

  const [savedCourse, savedSession] = await Promise.all([
    getDoc(doc(teacherDb, 'courses', courseId)),
    getDoc(doc(teacherDb, 'sessions', sessionId)),
  ]);
  assertContract(savedCourse.data()?.courseSources?.[0]?.content === source.content, 'The saved course source could not be read back.');
  assertContract(savedSession.data()?.courseSourceIds?.[0] === sourceId, 'The planned session did not keep its selected source.');

  studentUser = (await signInAnonymously(studentAuth)).user;
  const privateReadWasRejected = await getDoc(doc(studentDb, 'courses', courseId))
    .then(() => false)
    .catch(() => true);
  assertContract(privateReadWasRejected, 'A student could read the instructor-only course source.');

  console.log('PASS Instructor saved a reusable course source.');
  console.log('PASS A session kept its selected source reference.');
  console.log('PASS Student access to the private source was rejected.');
} finally {
  if (teacherUser) {
    await Promise.allSettled([
      deleteDoc(doc(teacherDb, 'sessions', sessionId)),
      deleteDoc(doc(teacherDb, 'courses', courseId)),
    ]);
    await Promise.allSettled([deleteDoc(doc(teacherDb, 'teachers', teacherUser.uid))]);
  }
  if (studentUser) await Promise.allSettled([deleteUser(studentUser)]);
  if (teacherUser) await Promise.allSettled([deleteUser(teacherUser)]);
  await Promise.allSettled([deleteApp(studentApp), deleteApp(teacherApp)]);
  console.log('PASS Course-source test records were cleaned up.');
}
