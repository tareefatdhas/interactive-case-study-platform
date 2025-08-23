import { ref, push, set, update, onValue, off, remove, get } from 'firebase/database';
import { realtimeDb } from './config';

// Realtime Database structure:
// /sessions/{sessionId}/
//   - status: { active: boolean, currentSection: number, releasedSections: number[] }
//   - students: { [studentId]: { name: string, joinedAt: timestamp, present: boolean } }
//   - responses: { [responseId]: { studentId, questionId, content, timestamp } }
//   - activity: { lastActivity: timestamp, teacherPresent: boolean }

export interface LiveSession {
  status: {
    active: boolean;
    currentSection: number;
    releasedSections: number[];
    startedAt?: number;
    endedAt?: number;
  };
  students: Record<string, {
    name: string;
    joinedAt: number;
    present: boolean;
    lastSeen: number;
  }>;
  responses: Record<string, {
    studentId: string;
    questionId: string;
    content: string;
    timestamp: number;
  }>;
  activity: {
    lastActivity: number;
    teacherPresent: boolean;
  };
}

// Session Management
export const createLiveSession = async (sessionId: string, initialData: Partial<LiveSession>) => {
  const sessionRef = ref(realtimeDb, `sessions/${sessionId}`);
  const defaultSession: LiveSession = {
    status: {
      active: false,
      currentSection: 0,
      releasedSections: [0]
    },
    students: {},
    responses: {},
    activity: {
      lastActivity: Date.now(),
      teacherPresent: false
    },
    ...initialData
  };
  
  await set(sessionRef, defaultSession);
  return sessionId;
};

export const updateSessionStatus = async (sessionId: string, status: Partial<LiveSession['status']>) => {
  const statusRef = ref(realtimeDb, `sessions/${sessionId}/status`);
  await update(statusRef, status);
  
  // Update activity timestamp
  const activityRef = ref(realtimeDb, `sessions/${sessionId}/activity/lastActivity`);
  await set(activityRef, Date.now());
};

export const releaseNextSection = async (sessionId: string, sectionIndex: number) => {
  const sessionRef = ref(realtimeDb, `sessions/${sessionId}`);
  
  // Get current released sections
  return new Promise<void>((resolve, reject) => {
    onValue(sessionRef, (snapshot) => {
      const data = snapshot.val() as LiveSession;
      if (data) {
        const releasedSections = [...(data.status.releasedSections || [])];
        if (!releasedSections.includes(sectionIndex)) {
          releasedSections.push(sectionIndex);
        }
        
        update(ref(realtimeDb, `sessions/${sessionId}/status`), {
          currentSection: sectionIndex,
          releasedSections
        }).then(() => resolve()).catch(reject);
      }
    }, { onlyOnce: true });
  });
};

// Student Management
export const joinLiveSession = async (sessionId: string, studentId: string, studentName: string) => {
  const studentRef = ref(realtimeDb, `sessions/${sessionId}/students/${studentId}`);
  await set(studentRef, {
    name: studentName,
    joinedAt: Date.now(),
    present: true,
    lastSeen: Date.now()
  });
};

export const updateStudentPresence = async (sessionId: string, studentId: string, present: boolean) => {
  const studentRef = ref(realtimeDb, `sessions/${sessionId}/students/${studentId}`);
  await update(studentRef, {
    present,
    lastSeen: Date.now()
  });
};

// Response Management
export const addLiveResponse = async (
  sessionId: string, 
  studentId: string, 
  questionId: string, 
  content: string
) => {
  const responsesRef = ref(realtimeDb, `sessions/${sessionId}/responses`);
  const newResponseRef = push(responsesRef);
  
  await set(newResponseRef, {
    studentId,
    questionId,
    content,
    timestamp: Date.now()
  });
  
  return newResponseRef.key;
};

// Real-time Subscriptions
export const subscribeToLiveSession = (
  sessionId: string, 
  callback: (session: LiveSession | null) => void
) => {
  const sessionRef = ref(realtimeDb, `sessions/${sessionId}`);
  
  onValue(sessionRef, (snapshot) => {
    const data = snapshot.val() as LiveSession | null;
    callback(data);
  });
  
  // Return unsubscribe function
  return () => off(sessionRef);
};

export const subscribeToSessionStatus = (
  sessionId: string,
  callback: (status: LiveSession['status'] | null) => void
) => {
  const statusRef = ref(realtimeDb, `sessions/${sessionId}/status`);
  
  onValue(statusRef, (snapshot) => {
    callback(snapshot.val());
  });
  
  return () => off(statusRef);
};

export const subscribeToLiveResponses = (
  sessionId: string,
  callback: (responses: Record<string, LiveSession['responses'][string]>) => void
) => {
  const responsesRef = ref(realtimeDb, `sessions/${sessionId}/responses`);
  
  onValue(responsesRef, (snapshot) => {
    callback(snapshot.val() || {});
  });
  
  return () => off(responsesRef);
};

export const subscribeToStudentPresence = (
  sessionId: string,
  callback: (students: Record<string, LiveSession['students'][string]>) => void
) => {
  const studentsRef = ref(realtimeDb, `sessions/${sessionId}/students`);
  
  onValue(studentsRef, (snapshot) => {
    callback(snapshot.val() || {});
  });
  
  return () => off(studentsRef);
};

// Cleanup
export const endLiveSession = async (sessionId: string) => {
  await updateSessionStatus(sessionId, {
    active: false,
    endedAt: Date.now()
  });
  
  // Optionally archive data to Firestore here
  // const sessionData = await get(ref(realtimeDb, `sessions/${sessionId}`));
  // await archiveSessionToFirestore(sessionId, sessionData.val());
  
  // Remove from Realtime Database after archiving
  // await remove(ref(realtimeDb, `sessions/${sessionId}`));
};
