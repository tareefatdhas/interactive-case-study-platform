'use client';

import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Teacher, TeacherNotificationPreferences } from '@/types';
import { auth, db } from './config';
import { COLLECTIONS } from './firestore';

export const DEFAULT_NOTIFICATION_PREFERENCES: TeacherNotificationPreferences = {
  afterClassReport: true,
  weeklyCourseDigest: true,
  productNews: false,
};

function normalizePreferences(
  preferences?: Partial<TeacherNotificationPreferences>,
): TeacherNotificationPreferences {
  return {
    afterClassReport: preferences?.afterClassReport ?? DEFAULT_NOTIFICATION_PREFERENCES.afterClassReport,
    weeklyCourseDigest: preferences?.weeklyCourseDigest ?? DEFAULT_NOTIFICATION_PREFERENCES.weeklyCourseDigest,
    productNews: preferences?.productNews ?? DEFAULT_NOTIFICATION_PREFERENCES.productNews,
  };
}

export async function getTeacherNotificationPreferences(): Promise<TeacherNotificationPreferences> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in again to manage your email reports.');

  const snapshot = await getDoc(doc(db, COLLECTIONS.TEACHERS, user.uid));
  if (!snapshot.exists()) throw new Error('Your instructor profile could not be found.');

  const teacher = snapshot.data() as Teacher;
  return normalizePreferences(teacher.notificationPreferences);
}

export async function saveTeacherNotificationPreferences(
  preferences: TeacherNotificationPreferences,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in again to manage your email reports.');

  await updateDoc(doc(db, COLLECTIONS.TEACHERS, user.uid), {
    notificationPreferences: normalizePreferences(preferences),
    updatedAt: serverTimestamp(),
  });
}
