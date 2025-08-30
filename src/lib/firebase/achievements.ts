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
      
    case 'correct_answers':
      if (req.scope === 'session' && studentProgress) {
        return (studentProgress.correctAnswers || 0) >= req.value;
      } else if (req.scope === 'overall' && overallProgress) {
        return (overallProgress.totalCorrectAnswers || 0) >= req.value;
      }
      return false;
      
    case 'highlights_created':
      if (req.scope === 'session' && studentProgress) {
        return (studentProgress.highlightsCreated || 0) >= req.value;
      } else if (req.scope === 'overall' && overallProgress) {
        return overallProgress.totalHighlights >= req.value;
      }
      return false;
      
    case 'response_effort':
      if (req.scope === 'session' && studentProgress) {
        return (studentProgress.totalUniqueWords || 0) >= req.value;
      } else if (req.scope === 'overall' && overallProgress) {
        return (overallProgress.totalUniqueWordsUsed || 0) >= req.value;
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
      
    case 'correct_answers':
      if (req.scope === 'session' && studentProgress) {
        currentValue = studentProgress.correctAnswers || 0;
      } else if (req.scope === 'overall' && overallProgress) {
        currentValue = overallProgress.totalCorrectAnswers || 0;
      }
      break;
      
    case 'highlights_created':
      if (req.scope === 'session' && studentProgress) {
        currentValue = studentProgress.highlightsCreated || 0;
      } else if (req.scope === 'overall' && overallProgress) {
        currentValue = overallProgress.totalHighlights;
      }
      break;
      
    case 'response_effort':
      if (req.scope === 'session' && studentProgress) {
        currentValue = studentProgress.totalUniqueWords || 0;
      } else if (req.scope === 'overall' && overallProgress) {
        currentValue = overallProgress.totalUniqueWordsUsed || 0;
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

// Default achievements to seed the system - based on behavioral science principles
export const getDefaultAchievements = (teacherId: string): Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'>[] => [
  // === ONBOARDING & EARLY ENGAGEMENT (reduce initial friction) ===
  {
    name: 'First Steps',
    description: 'Complete your first section - every journey begins with a single step!',
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
    name: 'Getting Started',
    description: 'Answer your first question - your voice matters!',
    category: 'participation',
    icon: 'Users',
    requirements: { type: 'response_count', value: 1, scope: 'session' },
    gradeBonus: 1,
    xpReward: 10,
    rarity: 'common',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Early Bird',
    description: 'Join your second session - building the habit!',
    category: 'participation',
    icon: 'Calendar',
    requirements: { type: 'session_count', value: 2, scope: 'overall' },
    gradeBonus: 1,
    xpReward: 15,
    rarity: 'common',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },

  // === CONSISTENCY & HABIT FORMATION (build routine) ===
  {
    name: 'Consistent Learner',
    description: 'Participate in 5 sessions - consistency is key to mastery!',
    category: 'participation',
    icon: 'Target',
    requirements: { type: 'session_count', value: 5, scope: 'overall' },
    gradeBonus: 2,
    xpReward: 25,
    rarity: 'common',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Streak Starter',
    description: 'Maintain a 3-day learning streak - momentum is building!',
    category: 'streaks',
    icon: 'Flame',
    requirements: { type: 'streak_days', value: 3, scope: 'overall' },
    gradeBonus: 2,
    xpReward: 20,
    rarity: 'common',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Week Warrior',
    description: 'Maintain a 7-day learning streak - you\'re on fire!',
    category: 'streaks',
    icon: 'Flame',
    requirements: { type: 'streak_days', value: 7, scope: 'overall' },
    gradeBonus: 3,
    xpReward: 35,
    rarity: 'rare',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Dedicated Student',
    description: 'Participate in 10 sessions - your commitment shows!',
    category: 'participation',
    icon: 'Award',
    requirements: { type: 'session_count', value: 10, scope: 'overall' },
    gradeBonus: 3,
    xpReward: 40,
    rarity: 'rare',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },

  // === QUALITY & EXCELLENCE (reward good work) ===
  {
    name: 'Perfect Start',
    description: 'Get a perfect score in a session - excellence from the beginning!',
    category: 'excellence',
    icon: 'Star',
    requirements: { type: 'perfect_score', value: 100, scope: 'session' },
    gradeBonus: 3,
    xpReward: 30,
    rarity: 'rare',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'High Achiever',
    description: 'Maintain an 85% average score - quality over quantity!',
    category: 'excellence',
    icon: 'Trophy',
    requirements: { type: 'perfect_score', value: 85, scope: 'overall' },
    gradeBonus: 4,
    xpReward: 45,
    rarity: 'epic',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Perfectionist',
    description: 'Maintain a 95% average score - exceptional performance!',
    category: 'excellence',
    icon: 'Crown',
    requirements: { type: 'perfect_score', value: 95, scope: 'overall' },
    gradeBonus: 6,
    xpReward: 60,
    rarity: 'legendary',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },

  // === ENGAGEMENT & PARTICIPATION (encourage active learning) ===
  {
    name: 'Active Participant',
    description: 'Submit 10 responses - your thoughts enrich the discussion!',
    category: 'participation',
    icon: 'Users',
    requirements: { type: 'response_count', value: 10, scope: 'overall' },
    gradeBonus: 2,
    xpReward: 25,
    rarity: 'common',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Discussion Leader',
    description: 'Submit 25 responses - you\'re driving meaningful conversations!',
    category: 'participation',
    icon: 'Users',
    requirements: { type: 'response_count', value: 25, scope: 'overall' },
    gradeBonus: 3,
    xpReward: 35,
    rarity: 'rare',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Thought Leader',
    description: 'Submit 50 responses - your insights inspire others!',
    category: 'participation',
    icon: 'Sparkles',
    requirements: { type: 'response_count', value: 50, scope: 'overall' },
    gradeBonus: 5,
    xpReward: 50,
    rarity: 'epic',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },

  // === READING & COMPREHENSION (encourage deep engagement) ===
  {
    name: 'Speed Reader',
    description: 'Complete 5 sections in one session - efficient and focused!',
    category: 'reading',
    icon: 'Zap',
    requirements: { type: 'sections_completed', value: 5, scope: 'session' },
    gradeBonus: 2,
    xpReward: 25,
    rarity: 'common',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Deep Diver',
    description: 'Complete 10 sections in one session - thorough exploration!',
    category: 'reading',
    icon: 'BookOpen',
    requirements: { type: 'sections_completed', value: 10, scope: 'session' },
    gradeBonus: 3,
    xpReward: 35,
    rarity: 'rare',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Knowledge Seeker',
    description: 'Complete 50 sections overall - your curiosity knows no bounds!',
    category: 'reading',
    icon: 'BookOpen',
    requirements: { type: 'sections_completed', value: 50, scope: 'overall' },
    gradeBonus: 4,
    xpReward: 45,
    rarity: 'epic',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Scholar',
    description: 'Complete 100 sections overall - a true academic!',
    category: 'reading',
    icon: 'Medal',
    requirements: { type: 'sections_completed', value: 100, scope: 'overall' },
    gradeBonus: 6,
    xpReward: 75,
    rarity: 'legendary',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },

  // === COMPETITION & RECOGNITION (healthy competition) ===
  {
    name: 'First to Finish',
    description: 'Be the first student to complete a session - leadership in action!',
    category: 'special',
    icon: 'Trophy',
    requirements: { type: 'first_to_complete', value: 1, scope: 'session' },
    gradeBonus: 2,
    xpReward: 30,
    rarity: 'rare',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Point Collector',
    description: 'Earn 100 points overall - every point counts!',
    category: 'excellence',
    icon: 'Star',
    requirements: { type: 'points_earned', value: 100, scope: 'overall' },
    gradeBonus: 2,
    xpReward: 25,
    rarity: 'common',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Point Master',
    description: 'Earn 500 points overall - impressive accumulation!',
    category: 'excellence',
    icon: 'Award',
    requirements: { type: 'points_earned', value: 500, scope: 'overall' },
    gradeBonus: 4,
    xpReward: 50,
    rarity: 'epic',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },

  // === LONG-TERM COMMITMENT (reward persistence) ===
  {
    name: 'Marathon Learner',
    description: 'Maintain a 14-day learning streak - incredible dedication!',
    category: 'streaks',
    icon: 'Flame',
    requirements: { type: 'streak_days', value: 14, scope: 'overall' },
    gradeBonus: 5,
    xpReward: 60,
    rarity: 'epic',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Unstoppable',
    description: 'Maintain a 30-day learning streak - you\'re a force of nature!',
    category: 'streaks',
    icon: 'Crown',
    requirements: { type: 'streak_days', value: 30, scope: 'overall' },
    gradeBonus: 8,
    xpReward: 100,
    rarity: 'legendary',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Veteran Student',
    description: 'Participate in 25 sessions - you\'re a seasoned learner!',
    category: 'participation',
    icon: 'Medal',
    requirements: { type: 'session_count', value: 25, scope: 'overall' },
    gradeBonus: 5,
    xpReward: 65,
    rarity: 'epic',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Master Student',
    description: 'Participate in 50 sessions - mastery through practice!',
    category: 'participation',
    icon: 'Crown',
    requirements: { type: 'session_count', value: 50, scope: 'overall' },
    gradeBonus: 8,
    xpReward: 100,
    rarity: 'legendary',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },

  // === ACCURACY & CORRECTNESS (reward getting things right) ===
  {
    name: 'Sharp Shooter',
    description: 'Get 5 answers correct in one session - accuracy matters!',
    category: 'excellence',
    icon: 'Target',
    requirements: { type: 'correct_answers', value: 5, scope: 'session' },
    gradeBonus: 2,
    xpReward: 25,
    rarity: 'common',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Accuracy Expert',
    description: 'Get 10 answers correct in one session - precision personified!',
    category: 'excellence',
    icon: 'Target',
    requirements: { type: 'correct_answers', value: 10, scope: 'session' },
    gradeBonus: 3,
    xpReward: 35,
    rarity: 'rare',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Knowledge Master',
    description: 'Get 50 answers correct overall - your understanding runs deep!',
    category: 'excellence',
    icon: 'Crown',
    requirements: { type: 'correct_answers', value: 50, scope: 'overall' },
    gradeBonus: 4,
    xpReward: 50,
    rarity: 'epic',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Answer Virtuoso',
    description: 'Get 100 answers correct overall - mastery achieved!',
    category: 'excellence',
    icon: 'Medal',
    requirements: { type: 'correct_answers', value: 100, scope: 'overall' },
    gradeBonus: 6,
    xpReward: 75,
    rarity: 'legendary',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },

  // === HIGHLIGHTING & ENGAGEMENT (encourage active reading) ===
  {
    name: 'First Highlight',
    description: 'Create your first highlight - mark what matters!',
    category: 'reading',
    icon: 'Sparkles',
    requirements: { type: 'highlights_created', value: 1, scope: 'session' },
    gradeBonus: 1,
    xpReward: 10,
    rarity: 'common',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Active Reader',
    description: 'Create 5 highlights in one session - engaged learning!',
    category: 'reading',
    icon: 'BookOpen',
    requirements: { type: 'highlights_created', value: 5, scope: 'session' },
    gradeBonus: 2,
    xpReward: 20,
    rarity: 'common',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Highlight Enthusiast',
    description: 'Create 25 highlights overall - you see the important details!',
    category: 'reading',
    icon: 'Star',
    requirements: { type: 'highlights_created', value: 25, scope: 'overall' },
    gradeBonus: 3,
    xpReward: 35,
    rarity: 'rare',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Annotation Master',
    description: 'Create 50 highlights overall - your insights illuminate the text!',
    category: 'reading',
    icon: 'Award',
    requirements: { type: 'highlights_created', value: 50, scope: 'overall' },
    gradeBonus: 4,
    xpReward: 50,
    rarity: 'epic',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Highlighting Legend',
    description: 'Create 100 highlights overall - a true scholar\'s approach!',
    category: 'reading',
    icon: 'Crown',
    requirements: { type: 'highlights_created', value: 100, scope: 'overall' },
    gradeBonus: 6,
    xpReward: 75,
    rarity: 'legendary',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },

  // === RESPONSE EFFORT & THOUGHTFULNESS (reward detailed responses) ===
  {
    name: 'Thoughtful Responder',
    description: 'Use 50 unique words in your responses in one session - depth of thought!',
    category: 'participation',
    icon: 'Users',
    requirements: { type: 'response_effort', value: 50, scope: 'session' },
    gradeBonus: 2,
    xpReward: 25,
    rarity: 'common',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Articulate Thinker',
    description: 'Use 100 unique words in your responses in one session - eloquent expression!',
    category: 'participation',
    icon: 'Sparkles',
    requirements: { type: 'response_effort', value: 100, scope: 'session' },
    gradeBonus: 3,
    xpReward: 35,
    rarity: 'rare',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Vocabulary Builder',
    description: 'Use 500 unique words in your responses overall - expanding your expression!',
    category: 'participation',
    icon: 'BookOpen',
    requirements: { type: 'response_effort', value: 500, scope: 'overall' },
    gradeBonus: 4,
    xpReward: 45,
    rarity: 'epic',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Word Wizard',
    description: 'Use 1000 unique words in your responses overall - linguistic mastery!',
    category: 'participation',
    icon: 'Crown',
    requirements: { type: 'response_effort', value: 1000, scope: 'overall' },
    gradeBonus: 6,
    xpReward: 75,
    rarity: 'legendary',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },

  // === SPECIAL RECOGNITION (unique achievements) ===
  {
    name: 'Perfect Session',
    description: 'Score 100% and complete all sections in one session - flawless execution!',
    category: 'special',
    icon: 'Sparkles',
    requirements: { type: 'perfect_score', value: 100, scope: 'session' },
    gradeBonus: 4,
    xpReward: 40,
    rarity: 'epic',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  },
  {
    name: 'Reliable Attendee',
    description: 'Maintain 90% attendance rate - consistency is excellence!',
    category: 'participation',
    icon: 'Calendar',
    requirements: { type: 'attendance_rate', value: 90, scope: 'overall' },
    gradeBonus: 3,
    xpReward: 35,
    rarity: 'rare',
    teacherId,
    courseId: null,
    enabled: true,
    isDefault: true
  }
];

export const seedDefaultAchievements = async (teacherId: string): Promise<void> => {
  // First, get existing achievements to check what's already there
  const existingAchievements = await getAchievementsByTeacher(teacherId);
  const existingNames = new Set(existingAchievements.map(a => a.name));
  
  const batch = writeBatch(db);
  const defaults = getDefaultAchievements(teacherId);
  let addedCount = 0;
  
  for (const achievement of defaults) {
    // Only add achievements that don't already exist
    if (!existingNames.has(achievement.name)) {
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
      addedCount++;
    }
  }
  
  if (addedCount > 0) {
    await batch.commit();
    console.log(`✅ Added ${addedCount} new default achievements`);
  } else {
    console.log('ℹ️ All default achievements already exist');
  }
};

export const replaceDefaultAchievements = async (teacherId: string): Promise<void> => {
  // Get existing default achievements and delete them
  const existingAchievements = await getAchievementsByTeacher(teacherId);
  const defaultAchievements = existingAchievements.filter(a => a.isDefault);
  
  const batch = writeBatch(db);
  
  // Delete existing default achievements
  for (const achievement of defaultAchievements) {
    const docRef = doc(db, COLLECTIONS.ACHIEVEMENTS, achievement.id);
    batch.delete(docRef);
  }
  
  // Add new default achievements
  const defaults = getDefaultAchievements(teacherId);
  for (const achievement of defaults) {
    const docRef = doc(collection(db, COLLECTIONS.ACHIEVEMENTS));
    const now = Timestamp.now();
    
    const cleanedAchievement = {
      ...achievement,
      courseId: achievement.courseId ?? null,
      gradeBonus: achievement.gradeBonus ?? 0,
      createdAt: now,
      updatedAt: now
    };
    
    batch.set(docRef, cleanedAchievement);
  }
  
  await batch.commit();
  console.log(`🔄 Replaced ${defaultAchievements.length} old defaults with ${defaults.length} new achievements`);
};