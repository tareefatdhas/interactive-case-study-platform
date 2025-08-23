import { ref, set, update, onValue, off } from 'firebase/database';
import { studentRealtimeDb } from './student-config';

// Student-specific Realtime Database functions that use the student auth context

export const joinLiveSessionStudent = async (sessionId: string, studentId: string, studentName: string) => {
  const studentRef = ref(studentRealtimeDb, `sessions/${sessionId}/students/${studentId}`);
  await set(studentRef, {
    name: studentName,
    joinedAt: Date.now(),
    present: true,
    lastSeen: Date.now()
  });
};

export const updateStudentPresenceStudent = async (sessionId: string, studentId: string, present: boolean) => {
  const studentRef = ref(studentRealtimeDb, `sessions/${sessionId}/students/${studentId}`);
  await update(studentRef, {
    present,
    lastSeen: Date.now()
  });
};

export const addLiveResponseStudent = async (
  sessionId: string, 
  studentId: string, 
  questionId: string, 
  content: string
) => {
  const responseRef = ref(studentRealtimeDb, `sessions/${sessionId}/responses/${studentId}_${questionId}_${Date.now()}`);
  
  await set(responseRef, {
    studentId,
    questionId,
    content,
    timestamp: Date.now()
  });
  
  return responseRef.key;
};

export const subscribeToSessionStatusStudent = (
  sessionId: string,
  callback: (status: any) => void
) => {
  const statusRef = ref(studentRealtimeDb, `sessions/${sessionId}/status`);
  
  onValue(statusRef, (snapshot) => {
    callback(snapshot.val());
  });
  
  return () => off(statusRef);
};
