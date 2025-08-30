import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit as firestoreLimit
} from 'firebase/firestore';
import { studentDb } from './student-config';
import type {
  Achievement,
  StudentProgress,
  StudentOverallProgress,
  StudentAchievement
} from '@/types';
import {
  getAvailableAchievementsForStudent,
  getStudentAchievements,
  unlockAchievement,
  checkAchievementRequirements
} from './achievements';
import {
  getStudentProgressStudent,
  getStudentOverallProgressStudent
} from './student-firestore';

interface AchievementCheckContext {
  studentId: string;
  sessionId?: string;
  teacherId: string;
  courseId?: string;
  
  // Additional context data
  isFirstToComplete?: boolean;
  responseCount?: number;
  totalSessionsInCourse?: number;
  
  // Triggered by specific events
  triggerEvent?: 'section_completed' | 'response_submitted' | 'session_completed' | 'streak_updated';
}

interface UnlockedAchievementNotification {
  achievement: Achievement;
  isNew: boolean; // Whether this was just unlocked (vs already had)
  xpAwarded: number;
  bonusPoints?: number;
}

export class AchievementChecker {
  /**
   * Check all achievements for a student and unlock any newly earned ones
   */
  static async checkAndUnlockAchievements(context: AchievementCheckContext): Promise<UnlockedAchievementNotification[]> {
    const {
      studentId,
      sessionId,
      teacherId,
      courseId,
      isFirstToComplete = false,
      responseCount = 0,
      totalSessionsInCourse = 1
    } = context;

    try {
      // Get all available achievements and current student achievements
      const [availableAchievements, studentAchievements, studentProgress, overallProgress] = await Promise.all([
        getAvailableAchievementsForStudent(teacherId, courseId).catch(error => {
          if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            console.warn('Student does not have permission to read achievements. Skipping achievement check.');
            return [];
          }
          throw error;
        }),
        getStudentAchievements(studentId).catch(error => {
          if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            console.warn('Student does not have permission to read student achievements. Skipping achievement check.');
            return [];
          }
          throw error;
        }),
        sessionId ? getStudentProgressStudent(studentId, sessionId) : Promise.resolve(null),
        getStudentOverallProgressStudent(studentId)
      ]);

      // Create set of already unlocked achievement IDs
      const unlockedAchievementIds = new Set(studentAchievements.map(sa => sa.achievementId));
      
      // Check each available achievement
      const newlyUnlockedAchievements: UnlockedAchievementNotification[] = [];
      
      for (const achievement of availableAchievements) {
        // Skip if already unlocked or disabled
        if (unlockedAchievementIds.has(achievement.id) || !achievement.enabled) {
          continue;
        }
        
        // Check if requirements are met
        const sessionData = {
          isFirstToComplete,
          responseCount,
          totalSessions: totalSessionsInCourse
        };
        
        const requirementsMet = checkAchievementRequirements(
          achievement,
          studentProgress,
          overallProgress,
          sessionData
        );
        
        if (requirementsMet) {
          // Unlock the achievement
          await unlockAchievement(studentId, achievement, sessionId);
          
          newlyUnlockedAchievements.push({
            achievement,
            isNew: true,
            xpAwarded: achievement.xpReward,
            bonusPoints: achievement.gradeBonus
          });
          
          console.log(`🏆 Achievement unlocked: ${achievement.name} for student ${studentId}`);
        }
      }
      
      return newlyUnlockedAchievements;
      
    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }

  /**
   * Check for specific achievement types based on the trigger event
   */
  static async checkSpecificAchievements(
    context: AchievementCheckContext,
    achievementTypes?: Achievement['requirements']['type'][]
  ): Promise<UnlockedAchievementNotification[]> {
    
    // If specific types provided, filter achievements to only check those
    if (achievementTypes) {
      const availableAchievements = await getAvailableAchievementsForStudent(
        context.teacherId, 
        context.courseId
      );
      
      const filteredAchievements = availableAchievements.filter(achievement => 
        achievementTypes.includes(achievement.requirements.type)
      );
      
      // Use the same checking logic but with filtered achievements
      return this.checkFilteredAchievements(context, filteredAchievements);
    }
    
    return this.checkAndUnlockAchievements(context);
  }

  /**
   * Check achievements when a section is completed
   */
  static async onSectionCompleted(context: Omit<AchievementCheckContext, 'triggerEvent'>): Promise<UnlockedAchievementNotification[]> {
    return this.checkSpecificAchievements(
      { ...context, triggerEvent: 'section_completed' },
      ['sections_completed', 'perfect_score', 'first_to_complete']
    );
  }

  /**
   * Check achievements when a response is submitted
   */
  static async onResponseSubmitted(context: Omit<AchievementCheckContext, 'triggerEvent'>): Promise<UnlockedAchievementNotification[]> {
    return this.checkSpecificAchievements(
      { ...context, triggerEvent: 'response_submitted' },
      ['response_count', 'points_earned', 'perfect_score', 'correct_answers', 'response_effort']
    );
  }

  /**
   * Check achievements when a session is completed
   */
  static async onSessionCompleted(context: Omit<AchievementCheckContext, 'triggerEvent'>): Promise<UnlockedAchievementNotification[]> {
    return this.checkSpecificAchievements(
      { ...context, triggerEvent: 'session_completed' },
      ['session_count', 'perfect_score', 'attendance_rate', 'first_to_complete']
    );
  }

  /**
   * Check streak-based achievements (called daily/periodically)
   */
  static async onStreakUpdated(context: Omit<AchievementCheckContext, 'triggerEvent'>): Promise<UnlockedAchievementNotification[]> {
    return this.checkSpecificAchievements(
      { ...context, triggerEvent: 'streak_updated' },
      ['streak_days']
    );
  }

  /**
   * Check achievements when a highlight is created
   */
  static async onHighlightCreated(context: Omit<AchievementCheckContext, 'triggerEvent'>): Promise<UnlockedAchievementNotification[]> {
    return this.checkSpecificAchievements(
      { ...context, triggerEvent: 'section_completed' },
      ['highlights_created']
    );
  }

  /**
   * Helper method to check a filtered list of achievements
   */
  private static async checkFilteredAchievements(
    context: AchievementCheckContext,
    achievements: Achievement[]
  ): Promise<UnlockedAchievementNotification[]> {
    const {
      studentId,
      sessionId,
      isFirstToComplete = false,
      responseCount = 0,
      totalSessionsInCourse = 1
    } = context;

    try {
      const [studentAchievements, studentProgress, overallProgress] = await Promise.all([
        getStudentAchievements(studentId).catch(error => {
          if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            console.warn('Student does not have permission to read student achievements. Skipping achievement check.');
            return [];
          }
          throw error;
        }),
        sessionId ? getStudentProgressStudent(studentId, sessionId) : Promise.resolve(null),
        getStudentOverallProgressStudent(studentId)
      ]);

      const unlockedAchievementIds = new Set(studentAchievements.map(sa => sa.achievementId));
      const newlyUnlockedAchievements: UnlockedAchievementNotification[] = [];
      
      for (const achievement of achievements) {
        if (unlockedAchievementIds.has(achievement.id) || !achievement.enabled) {
          continue;
        }
        
        const sessionData = {
          isFirstToComplete,
          responseCount,
          totalSessions: totalSessionsInCourse
        };
        
        const requirementsMet = checkAchievementRequirements(
          achievement,
          studentProgress,
          overallProgress,
          sessionData
        );
        
        if (requirementsMet) {
          await unlockAchievement(studentId, achievement, sessionId);
          
          newlyUnlockedAchievements.push({
            achievement,
            isNew: true,
            xpAwarded: achievement.xpReward,
            bonusPoints: achievement.gradeBonus
          });
        }
      }
      
      return newlyUnlockedAchievements;
      
    } catch (error) {
      console.error('Error checking filtered achievements:', error);
      return [];
    }
  }

  /**
   * Get achievement statistics for a teacher/course
   */
  static async getAchievementStats(teacherId: string, courseId?: string): Promise<{
    totalAchievements: number;
    studentsWithAchievements: number;
    mostEarnedAchievement?: { achievement: Achievement; count: number };
    rareAchievements: { achievement: Achievement; count: number }[];
  }> {
    try {
      // Get all achievements for this teacher/course
      const achievements = await getAvailableAchievementsForStudent(teacherId, courseId);
      
      // Get all student achievements
      const q = query(collection(studentDb, 'studentAchievements'));
      const studentAchievementsSnap = await getDocs(q);
      const allStudentAchievements = studentAchievementsSnap.docs.map(doc => doc.data()) as StudentAchievement[];
      
      // Filter to only achievements from this teacher/course
      const relevantAchievementIds = new Set(achievements.map(a => a.id));
      const relevantStudentAchievements = allStudentAchievements.filter(sa => 
        relevantAchievementIds.has(sa.achievementId)
      );
      
      // Calculate stats
      const uniqueStudents = new Set(relevantStudentAchievements.map(sa => sa.studentId)).size;
      
      // Count achievements by type
      const achievementCounts = new Map<string, number>();
      relevantStudentAchievements.forEach(sa => {
        achievementCounts.set(sa.achievementId, (achievementCounts.get(sa.achievementId) || 0) + 1);
      });
      
      // Find most earned achievement
      let mostEarnedAchievement: { achievement: Achievement; count: number } | undefined;
      let maxCount = 0;
      
      const rareAchievements: { achievement: Achievement; count: number }[] = [];
      
      achievements.forEach(achievement => {
        const count = achievementCounts.get(achievement.id) || 0;
        
        if (count > maxCount) {
          maxCount = count;
          mostEarnedAchievement = { achievement, count };
        }
        
        // Consider achievements with < 10% earning rate as "rare"
        const earningRate = uniqueStudents > 0 ? (count / uniqueStudents) : 0;
        if (earningRate < 0.1 && count > 0) {
          rareAchievements.push({ achievement, count });
        }
      });
      
      return {
        totalAchievements: achievements.length,
        studentsWithAchievements: uniqueStudents,
        mostEarnedAchievement,
        rareAchievements
      };
      
    } catch (error) {
      console.error('Error getting achievement stats:', error);
      return {
        totalAchievements: 0,
        studentsWithAchievements: 0,
        rareAchievements: []
      };
    }
  }

  /**
   * Check if student is first to complete a session
   */
  static async isFirstToComplete(sessionId: string, studentId: string): Promise<boolean> {
    try {
      // Check if any other student has completed this session before
      const q = query(
        collection(studentDb, 'studentProgress'),
        where('sessionId', '==', sessionId),
        where('studentId', '!=', studentId),
        orderBy('studentId'), // Required for != queries
        orderBy('lastActive', 'desc'),
        firestoreLimit(1)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return true; // No other students have progress, so this is first
      }
      
      // Check if any of these students have completed more sections
      const currentStudentProgress = await getStudentProgressStudent(studentId, sessionId);
      if (!currentStudentProgress) return false;
      
      for (const doc of snapshot.docs) {
        const otherProgress = doc.data() as StudentProgress;
        // If another student has completed same or more sections, student is not first
        if (otherProgress.sectionsCompleted >= currentStudentProgress.sectionsCompleted) {
          return false;
        }
      }
      
      return true;
      
    } catch (error) {
      console.error('Error checking first to complete:', error);
      return false;
    }
  }
}

export default AchievementChecker;