import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';
import type { AuthUser, Teacher } from '@/types';
import { COLLECTIONS } from './firestore';

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
  
  return {
    uid: user.uid,
    email: user.email!,
    role: 'teacher',
    name: teacherData.name
  };
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
  } catch (error: any) {
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
  await sendPasswordResetEmail(auth, email);
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