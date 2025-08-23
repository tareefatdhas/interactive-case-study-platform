import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  QuerySnapshot,
  DocumentData,
  WriteBatch,
  writeBatch
} from 'firebase/firestore';
import { db } from './config';
import type {
  CaseStudy,
  Session,
  Student,
  Response,
  StudentGrade,
  Teacher,
  Course
} from '@/types';

// Collections
export const COLLECTIONS = {
  CASE_STUDIES: 'casestudies',
  SESSIONS: 'sessions',
  STUDENTS: 'students',
  RESPONSES: 'responses',
  STUDENT_GRADES: 'studentGrades',
  TEACHERS: 'teachers',
  COURSES: 'courses'
} as const;

// Case Studies
export const createCaseStudy = async (caseStudy: Omit<CaseStudy, 'id' | 'createdAt' | 'updatedAt'>) => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTIONS.CASE_STUDIES), {
    ...caseStudy,
    createdAt: now,
    updatedAt: now
  });
  return docRef.id;
};

export const getCaseStudy = async (id: string): Promise<CaseStudy | null> => {
  const docRef = doc(db, COLLECTIONS.CASE_STUDIES, id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as CaseStudy;
  }
  return null;
};

export const updateCaseStudy = async (id: string, caseStudy: Partial<Omit<CaseStudy, 'id' | 'createdAt'>>) => {
  const docRef = doc(db, COLLECTIONS.CASE_STUDIES, id);
  const now = Timestamp.now();
  await updateDoc(docRef, {
    ...caseStudy,
    updatedAt: now
  });
};

export const getCaseStudiesByTeacher = async (teacherId: string): Promise<CaseStudy[]> => {
  const q = query(
    collection(db, COLLECTIONS.CASE_STUDIES),
    where('teacherId', '==', teacherId)
    // Temporarily removed orderBy until Firestore index is built
    // orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  const caseStudies = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as CaseStudy[];
  
  // Sort in JavaScript as temporary workaround
  return caseStudies.sort((a, b) => {
    const aTime = a.createdAt?.toDate?.() || new Date(0);
    const bTime = b.createdAt?.toDate?.() || new Date(0);
    return bTime.getTime() - aTime.getTime();
  });
};

// Sessions
export const createSession = async (session: Omit<Session, 'id' | 'createdAt'>) => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTIONS.SESSIONS), {
    ...session,
    createdAt: now
  });
  return docRef.id;
};

export const getSession = async (id: string): Promise<Session | null> => {
  const docRef = doc(db, COLLECTIONS.SESSIONS, id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Session;
  }
  return null;
};

export const getSessionByCode = async (sessionCode: string): Promise<Session | null> => {
  const q = query(
    collection(db, COLLECTIONS.SESSIONS),
    where('sessionCode', '==', sessionCode)
    // Temporarily removed second where clause until index builds
    // where('active', '==', true)
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
  
  const doc = activeSessions[0];
  return { id: doc.id, ...doc.data() } as Session;
};

export const updateSession = async (id: string, updates: Partial<Session>) => {
  const docRef = doc(db, COLLECTIONS.SESSIONS, id);
  await updateDoc(docRef, updates);
};

export const deleteSession = async (id: string) => {
  const docRef = doc(db, COLLECTIONS.SESSIONS, id);
  await deleteDoc(docRef);
};

export const endSession = async (id: string) => {
  const docRef = doc(db, COLLECTIONS.SESSIONS, id);
  await updateDoc(docRef, {
    active: false,
    endedAt: new Date()
  });
};

export const getSessionsByTeacher = async (teacherId: string): Promise<Session[]> => {
  const q = query(
    collection(db, COLLECTIONS.SESSIONS),
    where('teacherId', '==', teacherId),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Session[];
};

export const updateSessionActivity = async (sessionId: string) => {
  const docRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
  await updateDoc(docRef, {
    lastActivityAt: new Date()
  });
};

export const releaseNextSection = async (sessionId: string, nextSectionIndex: number) => {
  const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
  const sessionDoc = await getDoc(sessionRef);
  
  if (!sessionDoc.exists()) {
    throw new Error('Session not found');
  }
  
  const sessionData = sessionDoc.data() as Session;
  const releasedSections = sessionData.releasedSections || [];
  
  // Add the new section to released sections if not already there
  if (!releasedSections.includes(nextSectionIndex)) {
    await updateDoc(sessionRef, {
      releasedSections: [...releasedSections, nextSectionIndex],
      currentReleasedSection: nextSectionIndex,
      lastActivityAt: new Date()
    });
  }
};

export const checkAndTimeoutInactiveSessions = async () => {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
  // Get all active sessions first, then filter in JavaScript
  const q = query(
    collection(db, COLLECTIONS.SESSIONS),
    where('active', '==', true)
  );
  
  const querySnapshot = await getDocs(q);
  const batch = writeBatch(db);
  let timeoutCount = 0;
  
  querySnapshot.docs.forEach(doc => {
    const data = doc.data();
    const lastActivity = data.lastActivityAt?.toDate?.() || data.createdAt?.toDate?.() || new Date(0);
    
    if (lastActivity < thirtyMinutesAgo) {
      batch.update(doc.ref, {
        active: false,
        endedAt: new Date()
      });
      timeoutCount++;
    }
  });
  
  if (timeoutCount > 0) {
    await batch.commit();
    console.log(`Timed out ${timeoutCount} inactive sessions`);
  }
};

export const joinSession = async (sessionId: string, studentId: string) => {
  const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
  const sessionDoc = await getDoc(sessionRef);
  
  if (sessionDoc.exists()) {
    const sessionData = sessionDoc.data() as Session;
    const studentsJoined = sessionData.studentsJoined || [];
    
    if (!studentsJoined.includes(studentId)) {
      await updateDoc(sessionRef, {
        studentsJoined: [...studentsJoined, studentId],
        lastActivityAt: new Date()
      });
    } else {
      // Update activity even if student already joined
      await updateSessionActivity(sessionId);
    }
  }
};

// Students
export const createStudent = async (student: Omit<Student, 'id' | 'createdAt'>) => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTIONS.STUDENTS), {
    ...student,
    createdAt: now
  });
  return docRef.id;
};

export const getStudent = async (id: string): Promise<Student | null> => {
  const docRef = doc(db, COLLECTIONS.STUDENTS, id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Student;
  }
  return null;
};

export const getStudentByStudentId = async (studentId: string): Promise<Student | null> => {
  const q = query(
    collection(db, COLLECTIONS.STUDENTS),
    where('studentId', '==', studentId)
  );
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Student;
};

export const getStudentsByIds = async (studentIds: string[]): Promise<Student[]> => {
  if (studentIds.length === 0) return [];
  
  // First, try to get by studentId field (for readable IDs)
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < studentIds.length; i += batchSize) {
    const batch = studentIds.slice(i, i + batchSize);
    const q = query(
      collection(db, COLLECTIONS.STUDENTS),
      where('studentId', 'in', batch)
    );
    batches.push(getDocs(q));
  }
  
  const results = await Promise.all(batches);
  const students: Student[] = [];
  
  results.forEach(querySnapshot => {
    querySnapshot.docs.forEach(doc => {
      students.push({ id: doc.id, ...doc.data() } as Student);
    });
  });
  
  // If no students found by studentId, try by document ID (fallback for legacy data)
  if (students.length === 0) {
    const docBatches = [];
    for (let i = 0; i < studentIds.length; i += batchSize) {
      const batch = studentIds.slice(i, i + batchSize);
      const docPromises = batch.map(id => getDoc(doc(db, COLLECTIONS.STUDENTS, id)));
      docBatches.push(Promise.all(docPromises));
    }
    
    const docResults = await Promise.all(docBatches);
    docResults.forEach(docArray => {
      docArray.forEach(docSnap => {
        if (docSnap.exists()) {
          students.push({ id: docSnap.id, ...docSnap.data() } as Student);
        }
      });
    });
  }
  
  return students;
};

// Responses
export const createResponse = async (response: Omit<Response, 'id' | 'submittedAt'>) => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTIONS.RESPONSES), {
    ...response,
    submittedAt: now
  });
  
  // Update session activity when student submits response
  await updateSessionActivity(response.sessionId);
  
  return docRef.id;
};

export const getResponsesBySession = async (sessionId: string): Promise<Response[]> => {
  const q = query(
    collection(db, COLLECTIONS.RESPONSES),
    where('sessionId', '==', sessionId),
    orderBy('submittedAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Response[];
};

export const getResponsesByStudent = async (studentId: string, sessionId: string): Promise<Response[]> => {
  const q = query(
    collection(db, COLLECTIONS.RESPONSES),
    where('studentId', '==', studentId),
    where('sessionId', '==', sessionId)
    // Temporarily removed orderBy until index builds
    // orderBy('submittedAt', 'asc')
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

export const updateResponse = async (id: string, updates: Partial<Response>) => {
  const docRef = doc(db, COLLECTIONS.RESPONSES, id);
  await updateDoc(docRef, updates);
};

// Student Grades
export const updateStudentGrade = async (studentGrade: Omit<StudentGrade, 'id'>) => {
  const q = query(
    collection(db, COLLECTIONS.STUDENT_GRADES),
    where('studentId', '==', studentGrade.studentId),
    where('courseId', '==', studentGrade.courseId)
  );
  const querySnapshot = await getDocs(q);
  
  const now = Timestamp.now();
  const gradeData = {
    ...studentGrade,
    lastUpdated: now
  };
  
  if (querySnapshot.empty) {
    const docRef = await addDoc(collection(db, COLLECTIONS.STUDENT_GRADES), gradeData);
    return docRef.id;
  } else {
    const docRef = querySnapshot.docs[0].ref;
    await updateDoc(docRef, gradeData);
    return docRef.id;
  }
};

export const getStudentGrades = async (courseId: string): Promise<StudentGrade[]> => {
  const q = query(
    collection(db, COLLECTIONS.STUDENT_GRADES),
    where('courseId', '==', courseId),
    orderBy('lastUpdated', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as StudentGrade[];
};

// Real-time listeners
export const subscribeToSession = (sessionId: string, callback: (session: Session | null) => void) => {
  const docRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
  
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as Session);
    } else {
      callback(null);
    }
  });
};

export const subscribeToSessionResponses = (sessionId: string, callback: (responses: Response[]) => void) => {
  const q = query(
    collection(db, COLLECTIONS.RESPONSES),
    where('sessionId', '==', sessionId)
    // Temporarily removed orderBy until Firestore index is built
    // orderBy('submittedAt', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const responses = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Response[];
    
    // Sort in JavaScript as temporary workaround
    const sortedResponses = responses.sort((a, b) => {
      const aTime = a.submittedAt?.toDate?.() || new Date(0);
      const bTime = b.submittedAt?.toDate?.() || new Date(0);
      return bTime.getTime() - aTime.getTime();
    });
    
    callback(sortedResponses);
  });
};

// Utility functions
export const generateSessionCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const calculateStudentProgress = (responses: Response[], totalQuestions: number) => {
  return {
    completed: responses.length,
    total: totalQuestions,
    percentage: totalQuestions > 0 ? (responses.length / totalQuestions) * 100 : 0
  };
};