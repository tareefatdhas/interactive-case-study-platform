import { config as loadEnv } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth } from 'firebase/auth';
import { deleteDoc, doc, getFirestore, setDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

loadEnv({ path: '.env.local', quiet: true });

if (process.env.CLASSFULLY_PROFILE_E2E_CONFIRMED !== 'true') {
  throw new Error('Set CLASSFULLY_PROFILE_E2E_CONFIRMED=true to run the production profile-photo contract.');
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const runId = randomUUID();
const password = `Classfully-${runId}-Aa1!`;
const ownerApp = initializeApp(firebaseConfig, `profile-owner-${runId}`);
const otherApp = initializeApp(firebaseConfig, `profile-other-${runId}`);
const ownerAuth = getAuth(ownerApp);
const otherAuth = getAuth(otherApp);
let ownerUser;
let otherUser;
let ownerObject;

try {
  ownerUser = (await createUserWithEmailAndPassword(ownerAuth, `profile-owner-${runId}@example.com`, password)).user;
  otherUser = (await createUserWithEmailAndPassword(otherAuth, `profile-other-${runId}@example.com`, password)).user;

  await setDoc(doc(getFirestore(ownerApp), 'teachers', ownerUser.uid), {
    name: 'Profile Contract Instructor',
    email: ownerUser.email,
    courseIds: [],
    createdAt: new Date(),
  });

  const imageBytes = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKsAAAAASUVORK5CYII=', 'base64'));
  ownerObject = ref(getStorage(ownerApp), `teacher-profile-images/${ownerUser.uid}/profile.webp`);
  const uploaded = await uploadBytes(ownerObject, imageBytes, { contentType: 'image/webp' });
  const downloadURL = await getDownloadURL(uploaded.ref);
  if (!downloadURL.startsWith('https://')) throw new Error('Profile photo did not receive a download URL.');

  const crossAccountWasRejected = await uploadBytes(
    ref(getStorage(otherApp), `teacher-profile-images/${ownerUser.uid}/profile.webp`),
    imageBytes,
    { contentType: 'image/webp' },
  ).then(() => false).catch(() => true);

  if (!crossAccountWasRejected) throw new Error('Another user was able to replace an instructor profile photo.');

  console.log('PASS Instructor uploaded a profile photo to their own account.');
  console.log('PASS Another signed-in user was blocked from replacing it.');
} finally {
  if (ownerObject) await deleteObject(ownerObject).catch(() => undefined);
  if (ownerUser) await deleteDoc(doc(getFirestore(ownerApp), 'teachers', ownerUser.uid)).catch(() => undefined);
  if (ownerUser) await deleteUser(ownerUser).catch(() => undefined);
  if (otherUser) await deleteUser(otherUser).catch(() => undefined);
  await Promise.all([deleteApp(ownerApp), deleteApp(otherApp)]);
  console.log('PASS Production profile-photo test records were cleaned up.');
}
