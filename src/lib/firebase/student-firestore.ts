import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { studentDb } from './student-config';
import type {
  CaseStudy,
  Session,
  Student,
  Response,
} from '@/types';

// Collections - same as main firestore
export const COLLECTIONS = {
  CASE_STUDIES: 'casestudies',
  SESSIONS: 'sessions',
  STUDENTS: 'students',
  RESPONSES: 'responses',
  STUDENT_GRADES: 'studentGrades',
  TEACHERS: 'teachers',
  COURSES: 'courses'
} as const;

// Student-specific functions using the student database instance

export const getSessionByCodeStudent = async (sessionCode: string): Promise<Session | null> => {
  const q = query(
    collection(studentDb, COLLECTIONS.SESSIONS),
    where('sessionCode', '==', sessionCode)
  );
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  // Filter active sessions in JavaScript temporarily
  const activeSessions = querySnapshot.docs.filter(doc => doc.data().active === true);
  if (activeSessions.length === 0) {
    return null;
  }
  
  const docData = activeSessions[0];
  return { id: docData.id, ...docData.data() } as Session;
};

export const getCaseStudyStudent = async (id: string): Promise<CaseStudy | null> => {
  const docRef = doc(studentDb, COLLECTIONS.CASE_STUDIES, id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as CaseStudy;
  }
  return null;
};

export const getStudentByStudentIdStudent = async (studentId: string): Promise<Student | null> => {
  const q = query(
    collection(studentDb, COLLECTIONS.STUDENTS),
    where('studentId', '==', studentId)
  );
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  const docData = querySnapshot.docs[0];
  return { id: docData.id, ...docData.data() } as Student;
};

export const createStudentStudent = async (student: Omit<Student, 'id' | 'createdAt'>) => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(studentDb, COLLECTIONS.STUDENTS), {
    ...student,
    createdAt: now
  });
  return docRef.id;
};

export const joinSessionStudent = async (sessionId: string, studentId: string) => {
  console.log('STUDENT JOIN: Student', studentId, 'joining session', sessionId);
  
  // Update the session document to add student to studentsJoined array
  const sessionRef = doc(studentDb, COLLECTIONS.SESSIONS, sessionId);
  const sessionDoc = await getDoc(sessionRef);
  
  if (!sessionDoc.exists()) {
    throw new Error('Session not found');
  }
  
  const sessionData = sessionDoc.data() as Session;
  const studentsJoined = sessionData.studentsJoined || [];
  
  if (!studentsJoined.includes(studentId)) {
    await updateDoc(sessionRef, {
      studentsJoined: [...studentsJoined, studentId],
      lastActivityAt: new Date()
    });
    console.log('STUDENT JOIN: Added to studentsJoined array');
  } else {
    console.log('STUDENT JOIN: Already in studentsJoined array');
  }
};

export const getResponsesByStudentStudent = async (studentId: string, sessionId: string): Promise<Response[]> => {
  const q = query(
    collection(studentDb, COLLECTIONS.RESPONSES),
    where('studentId', '==', studentId),
    where('sessionId', '==', sessionId)
  );
  const querySnapshot = await getDocs(q);
  const responses = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Response[];
  
  // Sort in JavaScript as temporary workaround
  return responses.sort((a, b) => {
    const aTime = a.submittedAt?.toDate?.() || new Date(0);
    const bTime = b.submittedAt?.toDate?.() || new Date(0);
    return aTime.getTime() - bTime.getTime(); // ascending order
  });
};

export const createResponseStudent = async (response: Omit<Response, 'id' | 'submittedAt'>) => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(studentDb, COLLECTIONS.RESPONSES), {
    ...response,
    submittedAt: now
  });
  return docRef.id;
};

// Real-time subscription for session updates
export const subscribeToSessionStudent = (sessionId: string, callback: (session: Session | null) => void) => {
  const docRef = doc(studentDb, COLLECTIONS.SESSIONS, sessionId);
  
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as Session);
    } else {
      callback(null);
    }
  });
};