/**
 * Hybrid Session Management
 * Uses Realtime Database for live features and Firestore for persistence
 */

import { 
  createLiveSession,
  updateSessionStatus,
  subscribeToLiveSession,
  joinLiveSession,
  addLiveResponse,
  endLiveSession
} from './realtime';
import {
  createSession as createFirestoreSession,
  updateSession as updateFirestoreSession,
  getSession as getFirestoreSession
} from './firestore';
import type { Session } from '@/types';

// Create a session in both databases
export const createHybridSession = async (sessionData: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>) => {
  // 1. Create persistent session in Firestore
  const sessionId = await createFirestoreSession(sessionData);
  
  // 2. Create live session in Realtime Database
  await createLiveSession(sessionId, {
    status: {
      active: false,
      currentSection: 0,
      releasedSections: [0]
    }
  });
  
  return sessionId;
};

// Start a session (activate live features)
export const startHybridSession = async (sessionId: string) => {
  // 1. Update Firestore
  await updateFirestoreSession(sessionId, {
    active: true,
    startedAt: new Date()
  });
  
  // 2. Update Realtime Database
  await updateSessionStatus(sessionId, {
    active: true,
    currentSection: 0
  });
};

// End a session (archive live data)
export const endHybridSession = async (sessionId: string) => {
  // 1. Update Firestore
  await updateFirestoreSession(sessionId, {
    active: false,
    endedAt: new Date()
  });
  
  // 2. End live session and archive
  await endLiveSession(sessionId);
};

// Subscribe to live session updates
export const subscribeToHybridSession = (
  sessionId: string,
  onLiveUpdate: (liveData: any) => void,
  onPersistentUpdate?: (session: Session | null) => void
) => {
  // Subscribe to live updates
  const unsubscribeLive = subscribeToLiveSession(sessionId, onLiveUpdate);
  
  // Optionally subscribe to persistent data changes
  let unsubscribePersistent: (() => void) | undefined;
  if (onPersistentUpdate) {
    // You could add a Firestore subscription here if needed
    // For now, we'll rely mostly on live data
  }
  
  return () => {
    unsubscribeLive();
    unsubscribePersistent?.();
  };
};

// Student joins (hybrid approach)
export const studentJoinHybrid = async (
  sessionId: string, 
  studentId: string, 
  studentName: string
) => {
  // 1. Update Firestore session (for persistence)
  const session = await getFirestoreSession(sessionId);
  if (session) {
    const studentsJoined = session.studentsJoined || [];
    if (!studentsJoined.includes(studentId)) {
      await updateFirestoreSession(sessionId, {
        studentsJoined: [...studentsJoined, studentId]
      });
    }
  }
  
  // 2. Update Realtime Database (for live presence)
  await joinLiveSession(sessionId, studentId, studentName);
};

// Add response (hybrid approach)
export const addHybridResponse = async (
  sessionId: string,
  studentId: string,
  questionId: string,
  content: string
) => {
  // 1. Add to Realtime Database for immediate display
  const liveResponseId = await addLiveResponse(sessionId, studentId, questionId, content);
  
  // 2. Add to Firestore for persistence and assessment
  // (You can keep your existing createResponse function)
  // const persistentResponseId = await createResponse({
  //   sessionId,
  //   studentId,
  //   questionId,
  //   content,
  //   submittedAt: new Date()
  // });
  
  return liveResponseId;
};

export default {
  createHybridSession,
  startHybridSession,
  endHybridSession,
  subscribeToHybridSession,
  studentJoinHybrid,
  addHybridResponse
};
