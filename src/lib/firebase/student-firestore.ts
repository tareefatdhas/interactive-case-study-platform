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
import { studentDb, studentAuth } from './student-config';
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

export const getSessionStudent = async (id: string): Promise<Session | null> => {
  const docRef = doc(studentDb, COLLECTIONS.SESSIONS, id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Session;
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
  
  // Check for highlight-based achievements
  try {
    // Update session metrics to include new highlight count
    await updateSessionMetricsStudent(highlight.studentId, highlight.sessionId);
    
    // Import achievement checker and trigger highlight achievements
    const AchievementChecker = (await import('./achievement-checker')).default;
    
    // Get session details to find teacher info using student database
    const session = await getSessionStudent(highlight.sessionId);
    
    if (session) {
      const context = {
        studentId: highlight.studentId,
        sessionId: highlight.sessionId,
        teacherId: session.teacherId,
        courseId: undefined // Would need to be passed in or derived
      };
      
      await AchievementChecker.onHighlightCreated(context);
    }
  } catch (error) {
    // Handle Firebase permission errors gracefully
    if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
      console.debug('Achievement checking skipped due to permissions (expected for anonymous users)');
    } else {
      console.error('Error checking achievements after highlight creation:', error);
    }
  }
  
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
    // Document doesn't exist, create it with the specific ID to prevent duplicates
    await setDoc(docRef, {
      studentId,
      sessionId,
      authorUid: studentAuth.currentUser?.uid, // Store Firebase Auth UID for security rules
      sectionsCompleted: 0,
      questionsAnswered: 0,
      totalPoints: 0,
      maxPoints: 0,
      currentLevel: 1,
      xp: 0,
      streak: 0,
      timeSpentReading: 0,
      correctAnswers: 0,
      highlightsCreated: 0,
      totalUniqueWords: 0,
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
  
  const progressDoc = querySnapshot.docs[0];
  const progress = { ...progressDoc.data() } as StudentProgress;
  
  // Fetch student name if not already included
  if (!progress.studentName) {
    try {
      const student = await getStudentByStudentIdStudent(studentId);
      if (student) {
        progress.studentName = student.name || student.studentId;
      }
    } catch (error) {
      console.error('Failed to fetch student name for progress:', error);
    }
  }
  
  return progress;
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
  
  // Deduplicate by studentId - keep the entry with the highest points for each student
  const deduplicatedProgress = progress.reduce((acc, current) => {
    const existing = acc.find(p => p.studentId === current.studentId);
    if (!existing) {
      acc.push(current);
    } else {
      // Replace if current has higher points, or same points but more sections completed
      if (current.totalPoints > existing.totalPoints || 
          (current.totalPoints === existing.totalPoints && current.sectionsCompleted > existing.sectionsCompleted)) {
        const index = acc.findIndex(p => p.studentId === current.studentId);
        acc[index] = current;
      }
    }
    return acc;
  }, [] as StudentProgress[]);
  
  // Sort by total points descending, then by sections completed
  const sortedProgress = deduplicatedProgress
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

  // Fetch student names for all students in the leaderboard
  const studentIds = sortedProgress.map(p => p.studentId);
  const studentNames = new Map<string, string>();
  
  if (studentIds.length > 0) {
    try {
      // Batch fetch student documents - try both document IDs and studentId fields
      const batchSize = 10;
      for (let i = 0; i < studentIds.length; i += batchSize) {
        const batch = studentIds.slice(i, i + batchSize);
        
        // First try to get by document ID
        const docPromises = batch.map(id => getDoc(doc(studentDb, COLLECTIONS.STUDENTS, id)));
        const docResults = await Promise.all(docPromises);
        
        const remainingIds: string[] = [];
        docResults.forEach((docSnap, index) => {
          if (docSnap.exists()) {
            const studentData = docSnap.data() as Student;
            studentNames.set(batch[index], studentData.name || studentData.studentId || batch[index]);
          } else {
            remainingIds.push(batch[index]);
          }
        });
        
        // For IDs not found as document IDs, try to find by studentId field
        if (remainingIds.length > 0) {
          const q = query(
            collection(studentDb, COLLECTIONS.STUDENTS),
            where('studentId', 'in', remainingIds)
          );
          const querySnapshot = await getDocs(q);
          querySnapshot.docs.forEach(doc => {
            const studentData = doc.data() as Student;
            studentNames.set(studentData.studentId, studentData.name || studentData.studentId);
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch student names for leaderboard:', error);
    }
  }
  
  // Add student names to the progress data
  return sortedProgress.map(progress => ({
    ...progress,
    studentName: studentNames.get(progress.studentId) || `Student ${progress.studentId.slice(-4)}`
  }));
};

/**
 * Calculate and update session-level metrics for achievements
 */
export const updateSessionMetricsStudent = async (
  studentId: string,
  sessionId: string
) => {
  try {
    // Get all responses for this student in this session
    const responsesQuery = query(
      collection(studentDb, 'responses'),
      where('studentId', '==', studentId),
      where('sessionId', '==', sessionId)
    );
    const responsesSnapshot = await getDocs(responsesQuery);
    const sessionResponses = responsesSnapshot.docs.map(doc => doc.data());
    
    // Calculate correct answers for this session
    const correctAnswers = sessionResponses.filter(r => 
      r.points !== undefined && r.maxPoints !== undefined && r.points === r.maxPoints
    ).length;
    
    // Calculate unique words for this session
    const { countUniqueWordsInResponses } = await import('@/lib/utils/textAnalysis');
    const responseTexts = sessionResponses.map(r => r.response || '').filter(text => text.trim().length > 0);
    const totalUniqueWords = countUniqueWordsInResponses(responseTexts);
    
    // Get highlights count for this session
    const highlightsQuery = query(
      collection(studentDb, COLLECTIONS.HIGHLIGHTS),
      where('studentId', '==', studentId),
      where('sessionId', '==', sessionId)
    );
    const highlightsSnapshot = await getDocs(highlightsQuery);
    const highlightsCreated = highlightsSnapshot.docs.length;
    
    // Update the session progress with new metrics
    await updateStudentProgressStudent(studentId, sessionId, {
      correctAnswers,
      highlightsCreated,
      totalUniqueWords
    });
    
    return {
      correctAnswers,
      highlightsCreated,
      totalUniqueWords
    };
  } catch (error) {
    console.error('Error updating session metrics:', error);
    return {
      correctAnswers: 0,
      highlightsCreated: 0,
      totalUniqueWords: 0
    };
  }
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
      authorUid: studentAuth.currentUser?.uid, // Store Firebase Auth UID for security rules
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
      totalCorrectAnswers: 0,
      totalUniqueWordsUsed: 0,
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
  
  const progress = { ...docSnap.data() } as StudentOverallProgress;
  
  // Fetch student name if not already included
  if (!progress.studentName) {
    try {
      const student = await getStudentByStudentIdStudent(studentId);
      if (student) {
        progress.studentName = student.name || student.studentId;
      }
    } catch (error) {
      console.error('Failed to fetch student name for overall progress:', error);
    }
  }
  
  return progress;
};

export const calculateAndUpdateOverallProgress = async (studentId: string) => {
  try {
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

  // FIRST: Deduplicate progress records by sessionId and studentId
  // Keep the record with the highest totalPoints for each session
  const deduplicatedProgress = allProgress.reduce((acc, current) => {
    const key = `${current.sessionId}_${current.studentId}`;
    const existing = acc.get(key);
    
    if (!existing) {
      acc.set(key, current);
    } else {
      // Keep the record with higher points, or more recent lastActive if points are equal
      if (current.totalPoints > existing.totalPoints || 
          (current.totalPoints === existing.totalPoints && 
           current.lastActive.seconds > existing.lastActive.seconds)) {
        acc.set(key, current);
      }
    }
    return acc;
  }, new Map<string, StudentProgress>());
  
  const uniqueProgress = Array.from(deduplicatedProgress.values());
  
  // Get unique session IDs from deduplicated progress
  const sessionIds = [...new Set(uniqueProgress.map(p => p.sessionId))];
  
  // Check which sessions are still active using student Firebase context
  // If we can't check session status due to permissions, we'll use all progress data
  let filteredProgress = uniqueProgress;
  
  try {
    const sessionStatuses = await Promise.all(
      sessionIds.map(async (sessionId) => {
        try {
          const sessionRef = doc(studentDb, 'sessions', sessionId);
          const sessionSnap = await getDoc(sessionRef);
          
          if (sessionSnap.exists()) {
            const sessionData = sessionSnap.data();
            return { sessionId, active: sessionData.active ?? false };
          } else {
            return { sessionId, active: false }; // Session doesn't exist
          }
        } catch (error) {
          console.warn(`Failed to get session ${sessionId} status:`, error);
          return { sessionId, active: true }; // Assume active if can't fetch to be conservative
        }
      })
    );
    
    const activeSessionIds = new Set(
      sessionStatuses.filter(s => s.active).map(s => s.sessionId)
    );
    
    // Filter deduplicated progress to only include active sessions
    filteredProgress = uniqueProgress.filter(p => activeSessionIds.has(p.sessionId));
    
    console.log(`Filtered progress: ${filteredProgress.length} active sessions out of ${uniqueProgress.length} total`);
  } catch (error) {
    console.warn('Failed to check session statuses, using all progress data:', error);
    // Use all deduplicated progress if we can't check session status
    filteredProgress = uniqueProgress;
  }
  
  if (filteredProgress.length === 0) {
    // No active sessions with progress, but don't delete overall progress
    // Just update with minimal data
    const minimalProgress: Partial<StudentOverallProgress> = {
      totalSessions: 0,
      totalSectionsCompleted: 0,
      totalQuestionsAnswered: 0,
      totalPointsEarned: 0,
      totalMaxPoints: 0,
      overallLevel: 1,
      totalXP: 0,
      averageScore: 0,
      sessionsCompleted: 0,
      totalHighlights: 0,
      totalCorrectAnswers: 0,
      totalUniqueWordsUsed: 0
    };
    
    await updateStudentOverallProgressStudent(studentId, minimalProgress);
    return minimalProgress;
  }
  
  // Get highlights for this student, filtered by active sessions
  let totalHighlights = 0;
  try {
    const highlightsQuery = query(
      collection(studentDb, COLLECTIONS.HIGHLIGHTS),
      where('studentId', '==', studentId)
    );
    const highlightsSnapshot = await getDocs(highlightsQuery);
    const allHighlights = highlightsSnapshot.docs.map(doc => doc.data());
    const activeHighlights = allHighlights.filter(h => activeSessionIds.has((h as any).sessionId));
    totalHighlights = activeHighlights.length;
  } catch (error) {
    console.warn('Failed to fetch highlights for overall progress, using count from filtered progress:', error);
    // Fallback: estimate from progress records
    totalHighlights = filteredProgress.reduce((sum, p) => sum + (p.highlightsCreated || 0), 0);
  }

  // Get responses for this student, filtered by active sessions
  let totalCorrectAnswers = 0;
  let totalUniqueWordsUsed = 0;
  
  try {
    const responsesQuery = query(
      collection(studentDb, 'responses'),
      where('studentId', '==', studentId)
    );
    const responsesSnapshot = await getDocs(responsesQuery);
    const allResponses = responsesSnapshot.docs.map(doc => doc.data());
    const activeResponses = allResponses.filter(r => activeSessionIds.has((r as any).sessionId));
    
    // Calculate total correct answers from active sessions only
    totalCorrectAnswers = activeResponses.filter(r => 
      r.points !== undefined && r.maxPoints !== undefined && r.points === r.maxPoints
    ).length;
    
    // Calculate total unique words used across active session responses
    const { countUniqueWordsInResponses } = await import('@/lib/utils/textAnalysis');
    const responseTexts = activeResponses.map(r => r.response || '').filter(text => text.trim().length > 0);
    totalUniqueWordsUsed = countUniqueWordsInResponses(responseTexts);
  } catch (error) {
    console.warn('Failed to fetch responses for overall progress, using counts from filtered progress:', error);
    // Fallback: estimate from progress records
    totalCorrectAnswers = filteredProgress.reduce((sum, p) => sum + (p.correctAnswers || 0), 0);
    totalUniqueWordsUsed = filteredProgress.reduce((sum, p) => sum + (p.totalUniqueWords || 0), 0);
  }
  
  // Calculate overall statistics from active sessions only
  const totalSessions = filteredProgress.length;
  const totalSectionsCompleted = filteredProgress.reduce((sum, p) => sum + p.sectionsCompleted, 0);
  const totalQuestionsAnswered = filteredProgress.reduce((sum, p) => sum + p.questionsAnswered, 0);
  const totalPointsEarned = filteredProgress.reduce((sum, p) => sum + p.totalPoints, 0);
  const totalMaxPoints = filteredProgress.reduce((sum, p) => sum + p.maxPoints, 0);
  const totalXP = filteredProgress.reduce((sum, p) => sum + p.xp, 0);
  const longestStreak = Math.max(...filteredProgress.map(p => p.streak));
  const totalTimeSpent = filteredProgress.reduce((sum, p) => sum + p.timeSpentReading, 0);
  
  // Calculate average score
  const averageScore = totalMaxPoints > 0 ? (totalPointsEarned / totalMaxPoints) * 100 : 0;
  
  // Calculate overall level (every 100 points = 1 level, consistent with session level calculation)
  const overallLevel = Math.floor(totalPointsEarned / 100) + 1;
  
  // Count completed sessions from active sessions only
  // This would need more complex logic to determine if all released sections were completed
  const sessionsCompleted = filteredProgress.filter(p => p.sectionsCompleted > 0).length;
  
  // Find first session date from active sessions
  const firstSessionDate = filteredProgress.reduce((earliest, p) => {
    return p.lastActive.seconds < earliest.seconds ? p.lastActive : earliest;
  }, filteredProgress[0].lastActive);
  
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
    totalCorrectAnswers,
    totalUniqueWordsUsed,
    firstSessionDate
  };
  
    await updateStudentOverallProgressStudent(studentId, overallProgress);
    return overallProgress;
  } catch (error) {
    console.error('Failed to calculate and update overall progress:', error);
    // Return a minimal progress object so the UI doesn't break
    return {
      totalSessions: 0,
      totalSectionsCompleted: 0,
      totalQuestionsAnswered: 0,
      totalPointsEarned: 0,
      totalMaxPoints: 0,
      overallLevel: 1,
      totalXP: 0,
      averageScore: 0,
      sessionsCompleted: 0,
      totalHighlights: 0,
      totalCorrectAnswers: 0,
      totalUniqueWordsUsed: 0
    };
  }
};

export const getOverallLeaderboardStudent = async (limit: number = 10): Promise<StudentOverallProgress[]> => {
  try {
    const q = query(
      collection(studentDb, COLLECTIONS.STUDENT_OVERALL_PROGRESS),
      orderBy('totalPointsEarned', 'desc'),
      orderBy('totalSectionsCompleted', 'desc')
    );
    const querySnapshot = await getDocs(q);
  
  const progress = querySnapshot.docs.map(doc => ({
    ...doc.data()
  })) as StudentOverallProgress[];
  
  // Note: Overall progress should be unique by studentId by design since each student 
  // has only one overall progress document, but we'll add deduplication for safety
  const deduplicatedProgress = progress.reduce((acc, current) => {
    const existing = acc.find(p => p.studentId === current.studentId);
    if (!existing) {
      acc.push(current);
    } else {
      // Replace if current has higher points, or same points but more sections completed
      if (current.totalPointsEarned > existing.totalPointsEarned || 
          (current.totalPointsEarned === existing.totalPointsEarned && current.totalSectionsCompleted > existing.totalSectionsCompleted)) {
        const index = acc.findIndex(p => p.studentId === current.studentId);
        acc[index] = current;
      }
    }
    return acc;
  }, [] as StudentOverallProgress[]);
  
  const sortedProgress = deduplicatedProgress
    .slice(0, limit)
    .map((student, index) => ({
      ...student,
      rank: index + 1
    }));

  // Fetch student names for all students in the overall leaderboard
  const studentIds = sortedProgress.map(p => p.studentId);
  const studentNames = new Map<string, string>();
  
  if (studentIds.length > 0) {
    try {
      // Batch fetch student documents - try both document IDs and studentId fields
      const batchSize = 10;
      for (let i = 0; i < studentIds.length; i += batchSize) {
        const batch = studentIds.slice(i, i + batchSize);
        
        // First try to get by document ID
        const docPromises = batch.map(id => getDoc(doc(studentDb, COLLECTIONS.STUDENTS, id)));
        const docResults = await Promise.all(docPromises);
        
        const remainingIds: string[] = [];
        docResults.forEach((docSnap, index) => {
          if (docSnap.exists()) {
            const studentData = docSnap.data() as Student;
            studentNames.set(batch[index], studentData.name || studentData.studentId || batch[index]);
          } else {
            remainingIds.push(batch[index]);
          }
        });
        
        // For IDs not found as document IDs, try to find by studentId field
        if (remainingIds.length > 0) {
          const q = query(
            collection(studentDb, COLLECTIONS.STUDENTS),
            where('studentId', 'in', remainingIds)
          );
          const querySnapshot = await getDocs(q);
          querySnapshot.docs.forEach(doc => {
            const studentData = doc.data() as Student;
            studentNames.set(studentData.studentId, studentData.name || studentData.studentId);
          });
        }
      }
      } catch (error) {
        console.error('Failed to fetch student names for overall leaderboard:', error);
      }
    }
    
    // Add student names to the progress data
    return sortedProgress.map(progress => ({
      ...progress,
      studentName: studentNames.get(progress.studentId) || `Student ${progress.studentId.slice(-4)}`
    }));
  } catch (error) {
    console.error('Failed to get overall leaderboard:', error);
    // Return empty array so the UI doesn't break
    return [];
  }
};