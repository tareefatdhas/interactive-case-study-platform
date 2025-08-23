import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Same Firebase config but using a different app name for students
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://interactive-case-study-2aff7-default-rtdb.asia-southeast1.firebasedatabase.app/`,
};

// Log config in development
if (process.env.NODE_ENV === 'development') {
  console.log('Student Firebase Config loaded for project:', firebaseConfig.projectId);
}

// Create a separate Firebase app instance for students
const studentApp = initializeApp(firebaseConfig, 'student-app');

// Export student-specific instances
export const studentDb = getFirestore(studentApp);
export const studentAuth = getAuth(studentApp);
export const studentRealtimeDb = getDatabase(studentApp);

export default studentApp;