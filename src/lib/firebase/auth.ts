import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';
import type { AuthUser, Teacher } from '@/types';
import { COLLECTIONS } from './firestore';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const toTeacherAuthUser = (user: User, teacher: Teacher): AuthUser => ({
  uid: user.uid,
  email: user.email!,
  role: 'teacher',
  name: teacher.name,
});

export const signInTeacher = async (email: string, password: string): Promise<AuthUser> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Check if user is a teacher
  const teacherDoc = await getDoc(doc(db, COLLECTIONS.TEACHERS, user.uid));
  
  if (!teacherDoc.exists()) {
    await signOut(auth);
    throw new Error('Access denied. Teacher account required.');
  }
  
  const teacherData = teacherDoc.data() as Teacher;
  
  return toTeacherAuthUser(user, teacherData);
};

export const signInTeacherWithGoogle = async (): Promise<AuthUser> => {
  const userCredential = await signInWithPopup(auth, googleProvider);
  const user = userCredential.user;

  if (!user.email) {
    await signOut(auth);
    throw new Error('Your Google account did not provide an email address. Try another account.');
  }

  const teacherRef = doc(db, COLLECTIONS.TEACHERS, user.uid);
  const teacherSnapshot = await getDoc(teacherRef);

  if (teacherSnapshot.exists()) {
    return toTeacherAuthUser(user, teacherSnapshot.data() as Teacher);
  }

  const name = user.displayName?.trim() || user.email.split('@')[0];
  const teacherData = {
    email: user.email,
    name,
    courseIds: [],
    createdAt: new Date(),
  };

  try {
    await setDoc(teacherRef, teacherData);
  } catch (error) {
    const isNewUser = getAdditionalUserInfo(userCredential)?.isNewUser;

    try {
      if (isNewUser) {
        await user.delete();
      } else {
        await signOut(auth);
      }
    } catch (cleanupError) {
      console.error('Failed to clean up Google sign-in:', cleanupError);
    }

    throw error;
  }

  return {
    uid: user.uid,
    email: user.email,
    role: 'teacher',
    name,
  };
};

export const getGoogleSignInErrorMessage = (
  error: unknown,
  fallback = 'We could not continue with Google. Please try again.',
): string => {
  const code = typeof error === 'object' && error && 'code' in error
    ? String(error.code)
    : '';

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in was closed before it finished.';
  }

  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.';
  }

  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already uses this email. Sign in with your email and password instead.';
  }

  if (code === 'auth/unauthorized-domain') {
    return 'Google sign-in is not configured for this web address yet. Contact Classfully support.';
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is temporarily unavailable. Continue with email instead.';
  }

  return error instanceof Error && error.message ? error.message : fallback;
};

export const signUpTeacher = async (
  email: string, 
  password: string, 
  name: string
): Promise<AuthUser> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Update the user's display name
  await updateProfile(user, { displayName: name });
  
  // Create teacher document
  try {
    await setDoc(doc(db, COLLECTIONS.TEACHERS, user.uid), {
      email,
      name,
      courseIds: [],
      createdAt: new Date()
    });
  } catch (error: unknown) {
    // Clean up by deleting the auth user since teacher doc creation failed
    try {
      await user.delete();
    } catch (deleteError) {
      console.error('Failed to clean up auth user:', deleteError);
    }
    throw error;
  }
  
  return {
    uid: user.uid,
    email: user.email!,
    role: 'teacher',
    name
  };
};

export const signOutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const resetPassword = async (email: string): Promise<void> => {
  const response = await fetch('/api/auth/password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error || 'We could not send the reset email. Please try again.');
  }
};

export const onAuthChange = (callback: (user: AuthUser | null) => void): () => void => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Check if user is a teacher
      const teacherDoc = await getDoc(doc(db, COLLECTIONS.TEACHERS, user.uid));
      
      if (teacherDoc.exists()) {
        const teacherData = teacherDoc.data() as Teacher;
        callback({
          uid: user.uid,
          email: user.email!,
          role: 'teacher',
          name: teacherData.name
        });
      } else {
        // If not a teacher, sign them out
        await signOut(auth);
        callback(null);
      }
    } else {
      callback(null);
    }
  });
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
