import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, type User } from 'firebase/auth';
import { deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';

loadEnv({ path: '.env.local', quiet: true });

test.skip(process.env.CLASSFULLY_LIVE_E2E_CONFIRMED !== 'true', 'Requires explicit production Firebase test acknowledgement.');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig, `course-source-ui-${Date.now()}`);
const auth = getAuth(app);
const db = getFirestore(app);
const courseId = `source-ui-course-${randomUUID()}`;
const email = `classfully-source-ui-${Date.now()}@example.com`;
const password = `Classfully-${randomUUID()}-A1!`;
let teacher: User;
let createdSessionId = '';

test.beforeAll(async () => {
  teacher = (await createUserWithEmailAndPassword(auth, email, password)).user;
  await setDoc(doc(db, 'teachers', teacher.uid), {
    email,
    name: 'Course source interface check',
    courseIds: [courseId],
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'courses', courseId), {
    teacherId: teacher.uid,
    code: 'SRC UI',
    name: 'Course source interface check',
    createdAt: serverTimestamp(),
  });
});

test.afterAll(async () => {
  if (createdSessionId) await Promise.allSettled([deleteDoc(doc(db, 'sessions', createdSessionId))]);
  await Promise.allSettled([
    deleteDoc(doc(db, 'courses', courseId)),
    deleteDoc(doc(db, 'teachers', teacher.uid)),
  ]);
  await Promise.allSettled([deleteUser(teacher)]);
  await deleteApp(app);
});

test('instructor saves a course source and carries it into a session', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/dashboard/);

  await page.goto(`/dashboard/classes/${courseId}`);
  await page.getByRole('button', { name: /Interactions/ }).click();
  await expect(page.getByRole('heading', { name: 'Course sources' })).toBeVisible();
  await page.getByRole('button', { name: 'Add course source' }).click();
  await page.getByLabel('Source title').fill('Week 4 network effects notes');
  await page.getByPlaceholder('Paste the part of the course material you want available when planning sessions.').fill('Direct network effects occur when the value of a service grows as more people participate. Indirect network effects connect complementary groups and products. Ask students to compare the two patterns.');
  await page.getByRole('button', { name: 'Save course source' }).click();
  await expect(page.getByText('Week 4 network effects notes')).toBeVisible();

  const savedCourse = await getDoc(doc(db, 'courses', courseId));
  expect(savedCourse.data()?.courseSources?.[0]?.title).toBe('Week 4 network effects notes');

  await page.goto(`/dashboard/sessions/new?courseId=${courseId}`);
  await page.getByLabel('Session title').fill('Session backed by course material');
  await page.getByText('Draft activities with AI').click();
  await page.getByRole('button', { name: /Week 4 network effects notes/ }).click();
  await expect(page.getByRole('button', { name: 'Draft activities' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save session' }).click();
  await page.waitForURL((url) => /\/dashboard\/sessions\/[^/?#]+/.test(url.pathname) && !url.pathname.endsWith('/new'));
  createdSessionId = page.url().split('/dashboard/sessions/')[1]?.split(/[?#]/)[0] || '';

  const savedSession = await getDoc(doc(db, 'sessions', createdSessionId));
  expect(savedSession.data()?.courseSourceIds).toEqual([savedCourse.data()?.courseSources?.[0]?.id]);
});
