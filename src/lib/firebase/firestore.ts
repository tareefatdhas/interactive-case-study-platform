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
  writeBatch,
  arrayUnion,
  deleteField,
} from 'firebase/firestore';
import { db } from './config';
import type {
  CaseStudy,
  Session,
  Student,
  Response,
  StudentGrade,
  Teacher,
  Course,
  Highlight
} from '@/types';

// Collections
export const COLLECTIONS = {
  CASE_STUDIES: 'casestudies',
  SESSIONS: 'sessions',
  STUDENTS: 'students',
  RESPONSES: 'responses',
  STUDENT_GRADES: 'studentGrades',
  TEACHERS: 'teachers',
  COURSES: 'courses',
  HIGHLIGHTS: 'highlights'
} as const;

// Case Studies
export const createCaseStudy = async (caseStudy: Omit<CaseStudy, 'id' | 'createdAt' | 'updatedAt'>) => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTIONS.CASE_STUDIES), {
    ...caseStudy,
    archived: false, // Ensure new case studies are not archived
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

export const getCaseStudiesByTeacher = async (teacherId: string, includeArchived = false): Promise<CaseStudy[]> => {
  const q = query(
    collection(db, COLLECTIONS.CASE_STUDIES),
    where('teacherId', '==', teacherId)
    // Temporarily removed orderBy until Firestore index is built
    // orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  const caseStudies = querySnapshot.docs.map(doc => ({
    id: doc.id,
    archived: false, // Default for backward compatibility
    ...doc.data()
  })) as CaseStudy[];
  
  // Filter out archived case studies unless specifically requested
  const filtered = includeArchived ? caseStudies : caseStudies.filter(cs => !cs.archived);
  
  // Sort in JavaScript as temporary workaround
  return filtered.sort((a, b) => {
    const aTime = a.createdAt?.toDate?.() || new Date(0);
    const bTime = b.createdAt?.toDate?.() || new Date(0);
    return bTime.getTime() - aTime.getTime();
  });
};

export const duplicateCaseStudy = async (caseStudyId: string): Promise<string> => {
  const originalCaseStudy = await getCaseStudy(caseStudyId);
  if (!originalCaseStudy) {
    throw new Error('Case study not found');
  }

  const now = Timestamp.now();
  const duplicatedCaseStudy = {
    ...originalCaseStudy,
    title: `(Copy) ${originalCaseStudy.title}`,
    archived: false, // Ensure copies are not archived
    archivedAt: null,
    createdAt: now,
    updatedAt: now
  };

  // Remove the id field since it will be auto-generated
  const { id, ...caseStudyData } = duplicatedCaseStudy;

  const docRef = await addDoc(collection(db, COLLECTIONS.CASE_STUDIES), caseStudyData);
  return docRef.id;
};

export const archiveCaseStudy = async (caseStudyId: string): Promise<void> => {
  const now = Timestamp.now();
  await updateDoc(doc(db, COLLECTIONS.CASE_STUDIES, caseStudyId), {
    archived: true,
    archivedAt: now,
    updatedAt: now
  });
};

export const unarchiveCaseStudy = async (caseStudyId: string): Promise<void> => {
  const now = Timestamp.now();
  await updateDoc(doc(db, COLLECTIONS.CASE_STUDIES, caseStudyId), {
    archived: false,
    archivedAt: null,
    updatedAt: now
  });
};

// Courses
export const createCourse = async (
  course: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTIONS.COURSES), {
    ...omitUndefinedValues(course),
    rewardScopeId: course.rewardScopeId || course.code,
    archived: course.archived ?? false,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
};

export const getCourse = async (id: string): Promise<Course | null> => {
  const snapshot = await getDoc(doc(db, COLLECTIONS.COURSES, id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as Course : null;
};

export const getCoursesByTeacher = async (teacherId: string, includeArchived = false): Promise<Course[]> => {
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.COURSES),
    where('teacherId', '==', teacherId),
  ));
  const courses = snapshot.docs
    .map((courseDoc) => ({ id: courseDoc.id, ...courseDoc.data() } as Course))
    .sort((a, b) => a.code.localeCompare(b.code));
  return includeArchived ? courses : courses.filter((course) => !course.archived);
};

export const getAccessibleCourses = async (userId: string, includeArchived = false): Promise<Course[]> => {
  const owned = await getCoursesByTeacher(userId, true);
  let workspaceAccess: QuerySnapshot<DocumentData>;
  let courseAccess: QuerySnapshot<DocumentData>;
  try {
    [workspaceAccess, courseAccess] = await Promise.all([
      getDocs(query(collection(db, 'workspaceInstructorAccess'), where('userUid', '==', userId))),
      getDocs(query(collection(db, 'courseInstructorAccess'), where('userUid', '==', userId))),
    ]);
  } catch (accessError) {
    const candidate = accessError as { code?: string; message?: string };
    const code = candidate.code?.toLowerCase() || '';
    const message = candidate.message?.toLowerCase() || '';
    if (code === 'permission-denied' || message.includes('missing or insufficient permissions')) {
      // Teaching-team access is additive. If its rules have not reached the
      // current Firebase environment yet, an instructor must still be able to
      // open and manage the courses they own.
      return includeArchived ? owned : owned.filter((course) => !course.archived);
    }
    throw accessError;
  }
  const sharedCourseIds = new Set(courseAccess.docs.filter((item) => item.data().active === true).map((item) => item.data().courseId as string));
  const workspaceOwnerIds = workspaceAccess.docs.filter((item) => item.data().active === true).map((item) => item.data().ownerUid as string);
  const workspaceCourses = (await Promise.all(workspaceOwnerIds.map((ownerUid) => getCoursesByTeacher(ownerUid, true)))).flat();
  const courseDocuments = await Promise.all([...sharedCourseIds].map((courseId) => getCourse(courseId)));
  const courses = [...owned, ...workspaceCourses, ...courseDocuments.filter((course): course is Course => Boolean(course))];
  const unique = [...new Map(courses.map((course) => [course.id, course])).values()].sort((a, b) => a.code.localeCompare(b.code));
  return includeArchived ? unique : unique.filter((course) => !course.archived);
};

export const getCourseInstructorRole = async (
  userId: string,
  course: Course,
): Promise<'owner' | 'co-instructor' | 'progress-viewer' | null> => {
  if (course.teacherId === userId) return 'owner';
  const [workspaceAccess, courseAccess] = await Promise.all([
    getDocs(query(collection(db, 'workspaceInstructorAccess'), where('userUid', '==', userId))),
    getDocs(query(collection(db, 'courseInstructorAccess'), where('userUid', '==', userId))),
  ]);

  // Query the records the signed-in instructor is allowed to read, then
  // resolve the applicable scope locally. A direct read of a missing access
  // document is rejected by Firestore rules instead of returning "not found",
  // which previously prevented workspace-level instructors from opening a
  // course when they did not also have a redundant course-level record.
  const courseScopedAccess = courseAccess.docs
    .map((item) => item.data())
    .find((access) => access.active === true
      && access.courseId === course.id
      && access.ownerUid === course.teacherId);
  const workspaceScopedAccess = workspaceAccess.docs
    .map((item) => item.data())
    .find((access) => access.active === true && access.ownerUid === course.teacherId);
  const access = courseScopedAccess || workspaceScopedAccess || null;
  return access?.role === 'co-instructor' || access?.role === 'progress-viewer' ? access.role : null;
};

export const updateCourse = async (
  id: string,
  updates: Partial<Omit<Course, 'id' | 'teacherId' | 'createdAt'>>,
): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.COURSES, id), {
    ...omitUndefinedValues(updates),
    updatedAt: Timestamp.now(),
  });
};

export const updateCourseIdentity = async (
  course: Course,
  sessionIds: string[],
  updates: { name: string; code: string; term?: string },
): Promise<void> => {
  const normalizedCode = updates.code.trim().toUpperCase();
  const rewardScopeId = course.rewardScopeId || course.code;
  const rewardSnapshot = await getDocs(query(
    collection(db, 'rewardDefinitions'),
    where('courseId', '==', course.id),
  ));
  const uniqueSessionIds = [...new Set(sessionIds)];
  const writeCount = 2 + uniqueSessionIds.length + rewardSnapshot.size;
  if (writeCount > 490) {
    throw new Error('This class has too many linked records to update safely in one step.');
  }

  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.COURSES, course.id), omitUndefinedValues({
    name: updates.name.trim(),
    code: normalizedCode,
    term: updates.term?.trim() || deleteField(),
    rewardScopeId,
    updatedAt: Timestamp.now(),
  }));
  uniqueSessionIds.forEach((sessionId) => {
    batch.update(doc(db, COLLECTIONS.SESSIONS, sessionId), {
      courseId: course.id,
      courseCode: normalizedCode,
      courseName: updates.name.trim(),
      rewardScopeId,
    });
  });
  rewardSnapshot.docs.forEach((rewardDoc) => {
    batch.update(rewardDoc.ref, { courseCode: normalizedCode, updatedAt: Timestamp.now() });
  });
  batch.set(doc(db, 'teamModules', course.id), omitUndefinedValues({
    courseId: course.id,
    teacherId: course.teacherId,
    courseCode: normalizedCode,
    courseName: updates.name.trim(),
    term: updates.term?.trim() || deleteField(),
    tags: course.teamTags || [],
    enabled: !course.archived,
    updatedAt: Timestamp.now(),
  }), { merge: true });
  await batch.commit();
};

// Sessions
function omitUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) return value.map(omitUndefinedValues) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, omitUndefinedValues(child)]),
    ) as T;
  }
  return value;
}

export const createSession = async (session: Omit<Session, 'id' | 'createdAt'>) => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTIONS.SESSIONS), {
    ...omitUndefinedValues(session),
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
  await updateDoc(docRef, omitUndefinedValues(updates));
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

export const getAccessibleSessions = async (userId: string): Promise<Session[]> => {
  const courses = await getAccessibleCourses(userId, true);
  const owned = await getSessionsByTeacher(userId);
  const sharedCourses = courses.filter((course) => course.teacherId !== userId);
  const sharedGroups = await Promise.all(sharedCourses.map(async (course) => {
    const snapshot = await getDocs(query(collection(db, COLLECTIONS.SESSIONS), where('courseId', '==', course.id)));
    return snapshot.docs.map((sessionDoc) => ({ id: sessionDoc.id, ...sessionDoc.data() } as Session));
  }));
  return [...new Map([...owned, ...sharedGroups.flat()].map((session) => [session.id, session])).values()]
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
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

export const checkAndTimeoutInactiveSessions = async (teacherId: string) => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  // Get all active sessions first, then filter in JavaScript
  const q = query(
    collection(db, COLLECTIONS.SESSIONS),
    where('teacherId', '==', teacherId),
    where('active', '==', true)
  );
  
  const querySnapshot = await getDocs(q);
  const batch = writeBatch(db);
  let timeoutCount = 0;
  
  querySnapshot.docs.forEach(doc => {
    const data = doc.data();
    const lastActivity = data.lastActivityAt?.toDate?.()
      || data.startedAt?.toDate?.()
      || data.createdAt?.toDate?.()
      || new Date(0);
    
    if (lastActivity < fiveMinutesAgo) {
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

export const syncStandaloneSessionStudents = async (
  sessionId: string,
  teacherId: string,
  studentNumbers: string[],
) => {
  const uniqueStudentNumbers = [...new Set(studentNumbers.map((value) => value.trim()).filter(Boolean))];
  if (!uniqueStudentNumbers.length) return;
  const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
  const sessionSnapshot = await getDoc(sessionRef);
  if (!sessionSnapshot.exists()) throw new Error('Session not found');
  const session = sessionSnapshot.data() as Session;
  if (session.teacherId !== teacherId || session.sessionType !== 'standalone') {
    throw new Error('Only the owning instructor can sync a live session roster.');
  }
  await updateDoc(sessionRef, {
    studentsJoined: arrayUnion(...uniqueStudentNumbers),
    lastActivityAt: Timestamp.now(),
  });
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
  
  const batchSize = 10;
  const students: Map<string, Student> = new Map();
  
  // Try to get students by document ID
  const docBatches = [];
  for (let i = 0; i < studentIds.length; i += batchSize) {
    const batch = studentIds.slice(i, i + batchSize);
    const docPromises = batch.map(id => getDoc(doc(db, COLLECTIONS.STUDENTS, id)));
    docBatches.push(Promise.all(docPromises));
  }
  
  const docResults = await Promise.all(docBatches);
  const remainingIds: string[] = [];
  
  let globalIndex = 0;
  docResults.forEach(docArray => {
    docArray.forEach((docSnap) => {
      if (docSnap.exists()) {
        const student = { id: docSnap.id, ...docSnap.data() } as Student;
        students.set(student.id, student);
      } else {
        // If not found by document ID, we'll try by studentId field
        remainingIds.push(studentIds[globalIndex]);
      }
      globalIndex++;
    });
  });
  
  // For IDs not found as document IDs, try to find by studentId field
  if (remainingIds.length > 0) {
    const batches = [];
    for (let i = 0; i < remainingIds.length; i += batchSize) {
      const batch = remainingIds.slice(i, i + batchSize);
      const q = query(
        collection(db, COLLECTIONS.STUDENTS),
        where('studentId', 'in', batch)
      );
      batches.push(getDocs(q));
    }
    
    const results = await Promise.all(batches);
    results.forEach(querySnapshot => {
      querySnapshot.docs.forEach(doc => {
        const student = { id: doc.id, ...doc.data() } as Student;
        students.set(student.id, student);
      });
    });
  }
  
  return Array.from(students.values());
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
  
  // Check for achievements after response submission
  try {
    // Import here to avoid circular dependencies
    const AchievementChecker = (await import('./achievement-checker')).default;
    const GradeBonusService = (await import('./grade-bonus')).default;
    const { updateSessionMetricsStudent } = await import('./student-firestore');
    
    // Update session metrics for achievement tracking
    await updateSessionMetricsStudent(response.studentId, response.sessionId);
    
    // Get session details to find teacher/course info
    const session = await getSession(response.sessionId);
    if (session) {
      const context = {
        studentId: response.studentId,
        sessionId: response.sessionId,
        teacherId: session.teacherId,
        courseId: undefined, // Would need to be passed in or derived
        responseCount: 1 // This single response
      };
      
      const unlockedAchievements = await AchievementChecker.onResponseSubmitted(context);
      
      // Apply any grade bonuses from new achievements
      if (unlockedAchievements.length > 0 && context.courseId) {
        const achievementsWithBonuses = unlockedAchievements
          .map(ua => ({
            studentId: response.studentId,
            achievementId: ua.achievement.id,
            achievementName: ua.achievement.name,
            achievementIcon: ua.achievement.icon,
            achievementRarity: ua.achievement.rarity,
            unlockedAt: now,
            bonusApplied: false,
            bonusPoints: ua.bonusPoints || 0,
            sessionId: response.sessionId,
            xpAwarded: ua.xpAwarded
          }));
        
        await GradeBonusService.applyAchievementBonuses(
          response.studentId,
          context.courseId,
          achievementsWithBonuses
        );
      }
    }
  } catch (error) {
    console.error('Error checking achievements after response submission:', error);
    // Don't fail the response submission if achievement checking fails
  }
  
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
  // Avoid characters that are easy to confuse when a code is shown on a projector.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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

// Get all students with their performance statistics
export const getAllStudentsWithStats = async (teacherId: string) => {
  try {
    // Get all sessions for this teacher to find all students who participated
    const sessions = await getSessionsByTeacher(teacherId);
    const allStudentIds = new Set<string>();
    
    sessions.forEach(session => {
      session.studentsJoined?.forEach(studentId => {
        allStudentIds.add(studentId);
      });
    });

    if (allStudentIds.size === 0) {
      return [];
    }

    // Get student details
    const students = await getStudentsByIds(Array.from(allStudentIds));
    
    // Get all case studies for this teacher
    const caseStudies = await getCaseStudiesByTeacher(teacherId);
    const caseStudyMap = new Map(caseStudies.map(cs => [cs.id, cs]));
    
    // Get all responses for these students
    const studentStats = await Promise.all(
      students.map(async (student) => {
        // Get all responses by this student
        // Try both the document ID and the readable studentId to be safe
        const queries = [
          query(
            collection(db, COLLECTIONS.RESPONSES),
            where('studentId', '==', student.id)
          ),
          ...(student.studentId && student.studentId !== student.id ? [
            query(
              collection(db, COLLECTIONS.RESPONSES),
              where('studentId', '==', student.studentId)
            )
          ] : [])
        ];
        
        const responseSnapshots = await Promise.all(queries.map(q => getDocs(q)));
        const allResponses = new Map<string, Response>();
        
        responseSnapshots.forEach(responseSnapshot => {
          responseSnapshot.docs.forEach(doc => {
            allResponses.set(doc.id, {
              id: doc.id,
              ...doc.data()
            } as Response);
          });
        });
        
        const responses = Array.from(allResponses.values());

        // Calculate total questions available for sessions this student participated in
        // Only count questions from sections that have been released
        const studentSessions = sessions.filter(session => 
          session.studentsJoined?.includes(student.id) || 
          session.studentsJoined?.includes(student.studentId)
        );
        
        const totalQuestionsAvailable = studentSessions.reduce((total, session) => {
          if (!session.caseStudyId) return total;
          const caseStudy = caseStudyMap.get(session.caseStudyId);
          if (caseStudy && session.releasedSections) {
            // Only count questions from sections that have been released to students
            const releasedSectionIndices = new Set(session.releasedSections);
            return total + (caseStudy.sections?.reduce((sectionTotal, section, index) => {
              // Check if this section has been released (0-based indexing)
              if (releasedSectionIndices.has(index)) {
                return sectionTotal + (section.questions?.length || 0);
              }
              return sectionTotal;
            }, 0) || 0);
          }
          return total;
        }, 0);

        // Calculate statistics
        const gradedResponses = responses.filter(r => r.points !== undefined);
        const totalPoints = gradedResponses.reduce((sum, r) => sum + (r.points || 0), 0);
        const maxTotalPoints = responses.reduce((sum, r) => sum + (r.maxPoints || 0), 0);
        
        // Filter responses to only include those from released sections
        const responsesFromReleasedSections = responses.filter(response => {
          // Find the session this response belongs to
          const responseSession = studentSessions.find(session => session.id === response.sessionId);
          if (!responseSession || !responseSession.releasedSections) return false;

          // Find the case study and section for this response
          if (!responseSession.caseStudyId) return false;
          const caseStudy = caseStudyMap.get(responseSession.caseStudyId);
          if (!caseStudy) return false;

          // Find the section index for this response's sectionId
          const sectionIndex = caseStudy.sections?.findIndex(section => section.id === response.sectionId);
          if (sectionIndex === -1) return false;

          // Check if this section was released
          return responseSession.releasedSections.includes(sectionIndex);
        });

        // Calculate correct responses from released sections
        // - Waiting for Approval (points === undefined): considered correct
        // - Graded responses: correct if points === maxPoints
        const correctResponses = responsesFromReleasedSections.filter(r => {
          // If not graded yet (Waiting for Approval), consider it correct
          if (r.points === undefined) {
            return true;
          }
          // If graded, it's correct if it earned the maximum points
          return r.points === r.maxPoints;
        }).length;
        
        const correctPercentage = responsesFromReleasedSections.length > 0 ? (correctResponses / responsesFromReleasedSections.length) * 100 : 0;
        const progressPercentage = totalQuestionsAvailable > 0 ? (responsesFromReleasedSections.length / totalQuestionsAvailable) * 100 : 0;

        return {
          ...student,
          stats: {
            totalResponses: responsesFromReleasedSections.length,
            correctResponses,
            correctPercentage: Math.round(correctPercentage * 10) / 10, // Round to 1 decimal
            totalPoints,
            maxTotalPoints,
            averageScore: maxTotalPoints > 0 ? Math.round((totalPoints / maxTotalPoints) * 100 * 10) / 10 : 0,
            progressPercentage: Math.round(progressPercentage * 10) / 10, // Round to 1 decimal
            totalQuestionsAvailable
          }
        };
      })
    );

    return studentStats;
  } catch (error) {
    console.error('Error getting students with stats:', error);
    throw error;
  }
};

export const getAccessibleStudentsWithStats = async (userId: string) => {
  const courses = await getAccessibleCourses(userId, true);
  const ownerIds = [...new Set([userId, ...courses.map((course) => course.teacherId)])];
  const groups = await Promise.all(ownerIds.map((ownerUid) => getAllStudentsWithStats(ownerUid)));
  return [...new Map(groups.flat().map((student) => [student.id, student])).values()];
};

// Highlights functions for teachers
export const getHighlightsBySession = async (sessionId: string): Promise<Highlight[]> => {
  const q = query(
    collection(db, COLLECTIONS.HIGHLIGHTS),
    where('sessionId', '==', sessionId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(highlight => !(highlight as any).deleted) as Highlight[]; // Filter out soft-deleted highlights
};

// Subscribe to real-time highlights for a session (teacher view)
export const subscribeToSessionHighlights = (
  sessionId: string,
  callback: (highlights: Highlight[]) => void
) => {
  const q = query(
    collection(db, COLLECTIONS.HIGHLIGHTS),
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
