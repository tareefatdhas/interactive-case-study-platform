import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { studentDb } from './student-config';
import type {
  CaseStudy,
  Session,
  Student,
  Response,
  Highlight,
  StudentProgress,
  StudentOverallProgress,
} from '@/types';
import { normalizeStudentId } from '@/lib/utils';

// Collections - same as main firestore
export const COLLECTIONS = {
  CASE_STUDIES: 'casestudies',
  SESSIONS: 'sessions',
  STUDENTS: 'students',
  RESPONSES: 'responses',
  STUDENT_GRADES: 'studentGrades',
  TEACHERS: 'teachers',
  COURSES: 'courses',
  HIGHLIGHTS: 'highlights',
  STUDENT_PROGRESS: 'studentProgress',
  STUDENT_OVERALL_PROGRESS: 'studentOverallProgress'
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
  // Always search by normalized ID to prevent duplicates
  const normalizedId = normalizeStudentId(studentId);
  
  const q = query(
    collection(studentDb, COLLECTIONS.STUDENTS),
    where('studentIdNormalized', '==', normalizedId)
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
  const normalizedId = normalizeStudentId(student.studentId);
  
  const docRef = await addDoc(collection(studentDb, COLLECTIONS.STUDENTS), {
    ...student,
    studentIdNormalized: normalizedId, // Add normalized ID for searching
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

// Highlights functions
export const createHighlightStudent = async (highlight: Omit<Highlight, 'id' | 'createdAt'>) => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(studentDb, COLLECTIONS.HIGHLIGHTS), {
    ...highlight,
    createdAt: now
  });
  return docRef.id;
};

export const getHighlightsByStudentStudent = async (studentId: string, sessionId: string): Promise<Highlight[]> => {
  const q = query(
    collection(studentDb, COLLECTIONS.HIGHLIGHTS),
    where('studentId', '==', studentId),
    where('sessionId', '==', sessionId)
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Highlight[];
};

export const updateHighlightStudent = async (highlightId: string, updates: Partial<Highlight>) => {
  const docRef = doc(studentDb, COLLECTIONS.HIGHLIGHTS, highlightId);
  await updateDoc(docRef, updates);
};

export const deleteHighlightStudent = async (highlightId: string) => {
  const docRef = doc(studentDb, COLLECTIONS.HIGHLIGHTS, highlightId);
  await updateDoc(docRef, { deleted: true }); // Soft delete
};

// Realtime subscription for a student's highlights in a session
export const subscribeToHighlightsByStudentStudent = (
  studentId: string,
  sessionId: string,
  callback: (highlights: Highlight[]) => void
) => {
  const qRef = query(
    collection(studentDb, COLLECTIONS.HIGHLIGHTS),
    where('studentId', '==', studentId),
    where('sessionId', '==', sessionId)
  );

  return onSnapshot(qRef, (snapshot) => {
    const data = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() })) 
      .filter(highlight => !(highlight as any).deleted) as Highlight[]; // Filter out soft-deleted highlights
    callback(data);
  });
};

// Popular highlights function for students - gets aggregated data from all students
export const getPopularHighlightsBySessionStudent = async (sessionId: string): Promise<Highlight[]> => {
  const q = query(
    collection(studentDb, COLLECTIONS.HIGHLIGHTS),
    where('sessionId', '==', sessionId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(highlight => !(highlight as any).deleted) as Highlight[]; // Filter out soft-deleted highlights
};

// Subscribe to popular highlights for a session (student view - read-only)
export const subscribeToPopularHighlightsBySessionStudent = (
  sessionId: string,
  callback: (highlights: Highlight[]) => void
) => {
  const q = query(
    collection(studentDb, COLLECTIONS.HIGHLIGHTS),
    where('sessionId', '==', sessionId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const highlights = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(highlight => !(highlight as any).deleted) as Highlight[]; // Filter out soft-deleted highlights
    callback(highlights);
  });
};

// Student Progress functions
export const updateStudentProgressStudent = async (
  studentId: string,
  sessionId: string,
  updates: Partial<StudentProgress>
) => {
  const progressId = `${sessionId}_${studentId}`;
  const docRef = doc(studentDb, COLLECTIONS.STUDENT_PROGRESS, progressId);
  const now = Timestamp.now();
  
  await updateDoc(docRef, {
    ...updates,
    lastActive: now
  }).catch(async () => {
    // Document doesn't exist, create it
    await addDoc(collection(studentDb, COLLECTIONS.STUDENT_PROGRESS), {
      studentId,
      sessionId,
      sectionsCompleted: 0,
      questionsAnswered: 0,
      totalPoints: 0,
      maxPoints: 0,
      currentLevel: 1,
      xp: 0,
      streak: 0,
      timeSpentReading: 0,
      lastActive: now,
      ...updates
    });
  });
};

export const getStudentProgressStudent = async (studentId: string, sessionId: string): Promise<StudentProgress | null> => {
  const q = query(
    collection(studentDb, COLLECTIONS.STUDENT_PROGRESS),
    where('studentId', '==', studentId),
    where('sessionId', '==', sessionId)
  );
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  const doc = querySnapshot.docs[0];
  return { ...doc.data() } as StudentProgress;
};

export const getLeaderboardStudent = async (sessionId: string, limit: number = 10): Promise<StudentProgress[]> => {
  const q = query(
    collection(studentDb, COLLECTIONS.STUDENT_PROGRESS),
    where('sessionId', '==', sessionId)
  );
  const querySnapshot = await getDocs(q);
  
  const progress = querySnapshot.docs.map(doc => ({
    ...doc.data()
  })) as StudentProgress[];
  
  // Sort by total points descending, then by sections completed
  return progress
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return b.sectionsCompleted - a.sectionsCompleted;
    })
    .slice(0, limit)
    .map((student, index) => ({
      ...student,
      rank: index + 1
    }));
};

// Overall Progress Functions
export const updateStudentOverallProgressStudent = async (
  studentId: string,
  updates: Partial<StudentOverallProgress>
) => {
  const docRef = doc(studentDb, COLLECTIONS.STUDENT_OVERALL_PROGRESS, studentId);
  const now = Timestamp.now();
  
  await updateDoc(docRef, {
    ...updates,
    lastActive: now
  }).catch(async () => {
    // Document doesn't exist, create it
    await setDoc(docRef, {
      studentId,
      totalSessions: 0,
      totalSectionsCompleted: 0,
      totalQuestionsAnswered: 0,
      totalPointsEarned: 0,
      totalMaxPoints: 0,
      overallLevel: 1,
      totalXP: 0,
      longestStreak: 0,
      totalTimeSpent: 0,
      averageScore: 0,
      sessionsCompleted: 0,
      totalHighlights: 0,
      firstSessionDate: now,
      lastActive: now,
      ...updates
    });
  });
};

export const getStudentOverallProgressStudent = async (studentId: string): Promise<StudentOverallProgress | null> => {
  const docRef = doc(studentDb, COLLECTIONS.STUDENT_OVERALL_PROGRESS, studentId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return { ...docSnap.data() } as StudentOverallProgress;
};

export const calculateAndUpdateOverallProgress = async (studentId: string) => {
  // Get all progress records for this student across all sessions
  const q = query(
    collection(studentDb, COLLECTIONS.STUDENT_PROGRESS),
    where('studentId', '==', studentId)
  );
  const querySnapshot = await getDocs(q);
  
  const allProgress = querySnapshot.docs.map(doc => ({
    ...doc.data()
  })) as StudentProgress[];
  
  if (allProgress.length === 0) {
    return;
  }
  
  // Get all highlights for this student
  const highlightsQuery = query(
    collection(studentDb, COLLECTIONS.HIGHLIGHTS),
    where('studentId', '==', studentId)
  );
  const highlightsSnapshot = await getDocs(highlightsQuery);
  const totalHighlights = highlightsSnapshot.docs.length;
  
  // Calculate overall statistics
  const totalSessions = allProgress.length;
  const totalSectionsCompleted = allProgress.reduce((sum, p) => sum + p.sectionsCompleted, 0);
  const totalQuestionsAnswered = allProgress.reduce((sum, p) => sum + p.questionsAnswered, 0);
  const totalPointsEarned = allProgress.reduce((sum, p) => sum + p.totalPoints, 0);
  const totalMaxPoints = allProgress.reduce((sum, p) => sum + p.maxPoints, 0);
  const totalXP = allProgress.reduce((sum, p) => sum + p.xp, 0);
  const longestStreak = Math.max(...allProgress.map(p => p.streak));
  const totalTimeSpent = allProgress.reduce((sum, p) => sum + p.timeSpentReading, 0);
  
  // Calculate average score
  const averageScore = totalMaxPoints > 0 ? (totalPointsEarned / totalMaxPoints) * 100 : 0;
  
  // Calculate overall level (every 500 points = 1 level)
  const overallLevel = Math.floor(totalPointsEarned / 500) + 1;
  
  // Count completed sessions (sessions where student completed all available sections)
  // This would need more complex logic to determine if all released sections were completed
  const sessionsCompleted = allProgress.filter(p => p.sectionsCompleted > 0).length;
  
  // Find first session date
  const firstSessionDate = allProgress.reduce((earliest, p) => {
    return p.lastActive.seconds < earliest.seconds ? p.lastActive : earliest;
  }, allProgress[0].lastActive);
  
  const overallProgress: Partial<StudentOverallProgress> = {
    totalSessions,
    totalSectionsCompleted,
    totalQuestionsAnswered,
    totalPointsEarned,
    totalMaxPoints,
    overallLevel,
    totalXP,
    longestStreak,
    totalTimeSpent,
    averageScore: Math.round(averageScore * 10) / 10,
    sessionsCompleted,
    totalHighlights,
    firstSessionDate
  };
  
  await updateStudentOverallProgressStudent(studentId, overallProgress);
  return overallProgress;
};

export const getOverallLeaderboardStudent = async (limit: number = 10): Promise<StudentOverallProgress[]> => {
  const q = query(
    collection(studentDb, COLLECTIONS.STUDENT_OVERALL_PROGRESS),
    orderBy('totalPointsEarned', 'desc'),
    orderBy('totalSectionsCompleted', 'desc')
  );
  const querySnapshot = await getDocs(q);
  
  const progress = querySnapshot.docs.map(doc => ({
    ...doc.data()
  })) as StudentOverallProgress[];
  
  return progress
    .slice(0, limit)
    .map((student, index) => ({
      ...student,
      rank: index + 1
    }));
};