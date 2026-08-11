import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth } from 'firebase/auth';
import { jsPDF } from 'jspdf';

loadEnv({ path: '.env.local', quiet: true });

if (process.env.CLASSFULLY_LIVE_E2E_CONFIRMED !== 'true') {
  throw new Error('Set CLASSFULLY_LIVE_E2E_CONFIRMED=true to acknowledge that this test creates and removes a production test account.');
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const apiUrl = process.env.COURSE_SOURCE_API_URL || 'http://127.0.0.1:3000/api/extract-course-source';
const app = initializeApp(firebaseConfig, `source-api-${Date.now()}`);
const auth = getAuth(app);
let user;

try {
  user = (await createUserWithEmailAndPassword(
    auth,
    `classfully-source-api-${Date.now()}@example.com`,
    `Classfully-${randomUUID()}-A1!`,
  )).user;
  const token = await user.getIdToken();

  const pdf = new jsPDF();
  pdf.setFontSize(18);
  pdf.text('Network Effects', 20, 25);
  pdf.setFontSize(11);
  pdf.text('Direct network effects occur when a service becomes more valuable as more people participate.', 20, 42, { maxWidth: 165 });
  pdf.text('Ask students to compare direct and indirect network effects using a university marketplace.', 20, 62, { maxWidth: 165 });
  const file = new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' });
  const form = new FormData();
  form.set('file', file, 'network-effects.pdf');

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `PDF extraction returned ${response.status}.`);
  if (!payload.content?.toLowerCase().includes('network effects')) {
    throw new Error('The PDF extraction response did not contain the teaching content.');
  }
  if (payload.fileName !== 'network-effects.pdf' || payload.extractedWithAi !== true) {
    throw new Error('The PDF extraction response did not preserve its source metadata.');
  }
  console.log('PASS An authenticated instructor uploaded a PDF through the real API.');
  console.log('PASS The teaching text and source metadata came back ready to save.');
} finally {
  if (user) await Promise.allSettled([deleteUser(user)]);
  await deleteApp(app);
  console.log('PASS Course-source API test account was cleaned up.');
}
