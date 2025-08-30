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
  Timestamp,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db } from './config';
import { studentDb } from './student-config';
import type {
  Achievement,
  StudentAchievement,
  AchievementProgress,
  AchievementCategory,
  AchievementRarity,
  StudentProgress,
  StudentOverallProgress
} from '@/types';

// Collections
export const COLLECTIONS = {
  ACHIEVEMENTS: 'achievements',
  STUDENT_ACHIEVEMENTS: 'studentAchievements'
} as const;

// Teacher-side functions (using main db)
export const createAchievement = async (achievement: Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTIONS.ACHIEVEMENTS), {
    ...achievement,
    createdAt: now,
    updatedAt: now
  });
  return docRef.id;
};

export const getAchievementsByTeacher = async (teacherId: string): Promise<Achievement[]> => {
  const q = query(
    collection(db, COLLECTIONS.ACHIEVEMENTS),
    where('teacherId', '==', teacherId),
    orderBy('category'),
    orderBy('name')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Achievement[];
};

export const getAchievementsByCourse = async (courseId: string): Promise<Achievement[]> => {
  const q = query(
    collection(db, COLLECTIONS.ACHIEVEMENTS),
    where('courseId', '==', courseId),
    where('enabled', '==', true),
    orderBy('category'),
    orderBy('name')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Achievement[];
};

export const getGlobalAchievements = async (): Promise<Achievement[]> => {
  // Query for achievements where courseId is null (global achievements)
  const q = query(
    collection(db, COLLECTIONS.ACHIEVEMENTS),
    where('courseId', '==', null),
    where('enabled', '==', true),
    orderBy('category'),
    orderBy('name')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Achievement[];
};

export const updateAchievement = async (achievementId: string, updates: Partial<Achievement>): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.ACHIEVEMENTS, achievementId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now()
  });
};

export const toggleAchievementEnabled = async (achievementId: string, enabled: boolean): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.ACHIEVEMENTS, achievementId);
  await updateDoc(docRef, {
    enabled,
    updatedAt: Timestamp.now()
  });
};

// Student-side functions (using student db)
export const getStudentAchievements = async (studentId: string): Promise<StudentAchievement[]> => {
  const q = query(
    collection(studentDb, COLLECTIONS.STUDENT_ACHIEVEMENTS),
    where('studentId', '==', studentId),
    orderBy('unlockedAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as StudentAchievement[];
};

export const getAvailableAchievementsForStudent = async (teacherId: string, courseId?: string): Promise<Achievement[]> => {
  // Get global achievements
  const globalAchievements = await getGlobalAchievements();
  
  // Get course-specific achievements if courseId provided
  let courseAchievements: Achievement[] = [];
  if (courseId) {
    courseAchievements = await getAchievementsByCourse(courseId);
  }
  
  // Get teacher's global achievements (courseId is null)
  const q = query(
    collection(studentDb, COLLECTIONS.ACHIEVEMENTS),
    where('teacherId', '==', teacherId),
    where('courseId', '==', null),
    where('enabled', '==', true)
  );
  const querySnapshot = await getDocs(q);
  const teacherGlobalAchievements = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Achievement[];
  
  return [...globalAchievements, ...courseAchievements, ...teacherGlobalAchievements];
};

export const unlockAchievement = async (
  studentId: string,
  achievement: Achievement,
  sessionId?: string
): Promise<void> => {
  const now = Timestamp.now();
  
  const studentAchievement: Omit<StudentAchievement, 'id'> = {
    studentId,
    achievementId: achievement.id,
    achievementName: achievement.name,
    achievementIcon: achievement.icon,
    achievementRarity: achievement.rarity,
    unlockedAt: now,
    bonusApplied: false,
    bonusPoints: achievement.gradeBonus || 0,
    sessionId,
    xpAwarded: achievement.xpReward
  };
  
  // Check if already unlocked
  const q = query(
    collection(studentDb, COLLECTIONS.STUDENT_ACHIEVEMENTS),
    where('studentId', '==', studentId),
    where('achievementId', '==', achievement.id),
    limit(1)
  );
  const existing = await getDocs(q);
  
  if (existing.empty) {
    await addDoc(collection(studentDb, COLLECTIONS.STUDENT_ACHIEVEMENTS), studentAchievement);
  }
};

export const checkAchievementRequirements = (
  achievement: Achievement,
  studentProgress: StudentProgress | null,
  overallProgress: StudentOverallProgress | null,
  sessionData?: {
    isFirstToComplete?: boolean;
    responseCount?: number;
    totalSessions?: number;
  }
): boolean => {
  const req = achievement.requirements;
  
  switch (req.type) {
    case 'sections_completed':
      if (req.scope === 'session' && studentProgress) {
        return studentProgress.sectionsCompleted >= req.value;
      } else if (req.scope === 'overall' && overallProgress) {
        return overallProgress.totalSectionsCompleted >= req.value;
      }
      return false;
      
    case 'perfect_score':
      if (req.scope === 'session' && studentProgress) {
        return studentProgress.maxPoints > 0 && studentProgress.totalPoints === studentProgress.maxPoints;
      } else if (req.scope === 'overall' && overallProgress) {
        return overallProgress.averageScore >= req.value;
      }
      return false;
      
    case 'streak_days':
      if (overallProgress) {
        return overallProgress.longestStreak >= req.value;
      }
      return false;
      
    case 'session_count':
      if (overallProgress) {
        return overallProgress.totalSessions >= req.value;
      }
      return false;
      
    case 'points_earned':
      if (req.scope === 'session' && studentProgress) {
        return studentProgress.totalPoints >= req.value;
      } else if (req.scope === 'overall' && overallProgress) {
        return overallProgress.totalPointsEarned >= req.value;
      }
      return false;
      
    case 'first_to_complete':
      return sessionData?.isFirstToComplete || false;
      
    case 'response_count':
      if (req.scope === 'session' && studentProgress) {
        return studentProgress.questionsAnswered >= req.value;
      } else if (req.scope === 'overall' && overallProgress) {
        return overallProgress.totalQuestionsAnswered >= req.value;
      }
      return false;
      
    case 'attendance_rate':
      if (overallProgress && sessionData?.totalSessions) {
        const rate = (overallProgress.totalSessions / sessionData.totalSessions) * 100;
        return rate >= req.value;
      }
      return false;
      
    default:
      return false;
  }
};

export const calculateAchievementProgress = (
  achievement: Achievement,
  studentProgress: StudentProgress | null,
  overallProgress: StudentOverallProgress | null,
  sessionData?: {
    isFirstToComplete?: boolean;
    responseCount?: number;
    totalSessions?: number;
  }
): AchievementProgress => {
  const req = achievement.requirements;
  let currentValue = 0;
  
  switch (req.type) {
    case 'sections_completed':
      if (req.scope === 'session' && studentProgress) {
        currentValue = studentProgress.sectionsCompleted;
      } else if (req.scope === 'overall' && overallProgress) {
        currentValue = overallProgress.totalSectionsCompleted;
      }
      break;
      
    case 'perfect_score':
      if (req.scope === 'session' && studentProgress) {
        currentValue = studentProgress.maxPoints > 0 ? 
          Math.round((studentProgress.totalPoints / studentProgress.maxPoints) * 100) : 0;
      } else if (req.scope === 'overall' && overallProgress) {
        currentValue = Math.round(overallProgress.averageScore);
      }
      break;
      
    case 'streak_days':
      if (overallProgress) {
        currentValue = overallProgress.longestStreak;
      }
      break;
      
    case 'session_count':
      if (overallProgress) {
        currentValue = overallProgress.totalSessions;
      }
      break;
      
    case 'points_earned':
      if (req.scope === 'session' && studentProgress) {
        currentValue = studentProgress.totalPoints;
      } else if (req.scope === 'overall' && overallProgress) {
        currentValue = overallProgress.totalPointsEarned;
      }
      break;
      
    case 'first_to_complete':
      currentValue = sessionData?.isFirstToComplete ? 1 : 0;
      break;
      
    case 'response_count':
      if (req.scope === 'session' && studentProgress) {
        currentValue = studentProgress.questionsAnswered;
      } else if (req.scope === 'overall' && overallProgress) {
        currentValue = overallProgress.totalQuestionsAnswered;
      }
      break;
      
    case 'attendance_rate':
      if (overallProgress && sessionData?.totalSessions) {
        currentValue = Math.round((overallProgress.totalSessions / sessionData.totalSessions) * 100);
      }
      break;
  }
  
  const percentage = Math.min((currentValue / req.value) * 100, 100);
  
  return {
    achievementId: achievement.id,
    currentValue,
    requiredValue: req.value,
    percentage
  };
};

// Default achievements to seed the system
export const getDefaultAchievements = (teacherId: string): Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'>[] => [
  {
    name: 'First Steps',
    description: 'Complete your first section',
    category: 'reading',
    icon: 'BookOpen',
    requirements: { type: 'sections_completed', value: 1, scope: 'session' },
    gradeBonus: 1,
    xpReward: 10,
    rarity: 'common',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Perfect Start',
    description: 'Get a perfect score on your first session',
    category: 'excellence',
    icon: 'Star',
    requirements: { type: 'perfect_score', value: 100, scope: 'session' },
    gradeBonus: 3,
    xpReward: 25,
    rarity: 'rare',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Speed Reader',
    description: 'Complete 5 sections in one session',
    category: 'reading',
    icon: 'Zap',
    requirements: { type: 'sections_completed', value: 5, scope: 'session' },
    gradeBonus: 2,
    xpReward: 20,
    rarity: 'common',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Dedicated Student',
    description: 'Participate in 10 sessions',
    category: 'participation',
    icon: 'Calendar',
    requirements: { type: 'session_count', value: 10, scope: 'overall' },
    gradeBonus: 5,
    xpReward: 50,
    rarity: 'epic',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Streak Master',
    description: 'Maintain a 7-day learning streak',
    category: 'streaks',
    icon: 'Flame',
    requirements: { type: 'streak_days', value: 7, scope: 'overall' },
    gradeBonus: 3,
    xpReward: 30,
    rarity: 'rare',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'First to Finish',
    description: 'Be the first student to complete a session',
    category: 'special',
    icon: 'Trophy',
    requirements: { type: 'first_to_complete', value: 1, scope: 'session' },
    gradeBonus: 2,
    xpReward: 25,
    rarity: 'rare',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  }
];

export const seedDefaultAchievements = async (teacherId: string): Promise<void> => {
  const batch = writeBatch(db);
  const defaults = getDefaultAchievements(teacherId);
  
  for (const achievement of defaults) {
    const docRef = doc(collection(db, COLLECTIONS.ACHIEVEMENTS));
    const now = Timestamp.now();
    
    // Ensure all fields are properly defined for Firestore
    const cleanedAchievement = {
      ...achievement,
      courseId: achievement.courseId ?? null, // Convert undefined to null
      gradeBonus: achievement.gradeBonus ?? 0,
      createdAt: now,
      updatedAt: now
    };
    
    batch.set(docRef, cleanedAchievement);
  }
  
  await batch.commit();
};