import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';
import type { StudentGrade, StudentAchievement, Achievement } from '@/types';
import { COLLECTIONS as ACHIEVEMENT_COLLECTIONS } from './achievements';

export const COLLECTIONS = {
  STUDENT_GRADES: 'studentGrades',
} as const;

interface GradeBonusCalculation {
  basePoints: number;
  maxBasePoints: number;
  achievementBonusPoints: number;
  achievementBonusPercentage: number;
  finalPoints: number;
  finalMaxPoints: number;
  finalPercentage: number;
  bonusBreakdown: {
    achievementId: string;
    achievementName: string;
    bonusPoints: number;
    bonusPercentage: number;
  }[];
}

export class GradeBonusService {
  /**
   * Apply achievement bonuses to a student's grade record
   */
  static async applyAchievementBonuses(
    studentId: string,
    courseId: string,
    newAchievements: StudentAchievement[]
  ): Promise<void> {
    try {
      // Get current student grade record
      const gradeQuery = query(
        collection(db, COLLECTIONS.STUDENT_GRADES),
        where('studentId', '==', studentId),
        where('courseId', '==', courseId)
      );
      
      const gradeSnapshot = await getDocs(gradeQuery);
      
      if (gradeSnapshot.empty) {
        console.warn(`No grade record found for student ${studentId} in course ${courseId}`);
        return;
      }
      
      const gradeDoc = gradeSnapshot.docs[0];
      const currentGrade = gradeDoc.data() as StudentGrade;
      
      // Get existing achievement bonuses
      const existingBonusAchievementIds = new Set(
        currentGrade.achievementBonuses?.map(ab => ab.achievementId) || []
      );
      
      // Filter to only new achievements that haven't been applied yet
      const unappliedAchievements = newAchievements.filter(
        achievement => !existingBonusAchievementIds.has(achievement.achievementId)
      );
      
      if (unappliedAchievements.length === 0) {
        return; // No new bonuses to apply
      }
      
      // Calculate new bonus amounts
      let additionalBonusPoints = 0;
      const newBonuses: StudentGrade['achievementBonuses'] = [];
      
      for (const achievement of unappliedAchievements) {
        if (achievement.bonusPoints && achievement.bonusPoints > 0) {
          additionalBonusPoints += achievement.bonusPoints;
          
          newBonuses.push({
            achievementId: achievement.achievementId,
            achievementName: achievement.achievementName,
            bonusPoints: achievement.bonusPoints,
            bonusPercentage: 0, // Currently only supporting point bonuses
            awardedAt: achievement.unlockedAt
          });
        }
      }
      
      // Update the grade record
      const updatedGrade: Partial<StudentGrade> = {
        achievementBonusPoints: (currentGrade.achievementBonusPoints || 0) + additionalBonusPoints,
        achievementBonuses: [
          ...(currentGrade.achievementBonuses || []),
          ...newBonuses
        ],
        lastUpdated: Timestamp.now()
      };
      
      await updateDoc(doc(db, COLLECTIONS.STUDENT_GRADES, gradeDoc.id), updatedGrade);
      
      // Mark achievements as bonus applied
      for (const achievement of unappliedAchievements) {
        if (achievement.bonusPoints && achievement.bonusPoints > 0) {
          achievement.bonusApplied = true;
        }
      }
      
      console.log(`Applied ${additionalBonusPoints} bonus points to student ${studentId}`);
      
    } catch (error) {
      console.error('Error applying achievement bonuses:', error);
      throw error;
    }
  }

  /**
   * Calculate final grade including achievement bonuses
   */
  static calculateFinalGrade(grade: StudentGrade): GradeBonusCalculation {
    const basePoints = grade.totalPoints;
    const maxBasePoints = grade.maxTotalPoints;
    const achievementBonusPoints = grade.achievementBonusPoints || 0;
    const achievementBonusPercentage = grade.achievementBonusPercentage || 0;
    
    // Apply point bonuses first
    const pointsWithBonuses = basePoints + achievementBonusPoints;
    
    // Apply percentage bonuses to the base points (not including point bonuses)
    const percentageBonusPoints = (basePoints * achievementBonusPercentage) / 100;
    
    // Final calculation
    const finalPoints = pointsWithBonuses + percentageBonusPoints;
    const finalMaxPoints = maxBasePoints + achievementBonusPoints + ((maxBasePoints * achievementBonusPercentage) / 100);
    const finalPercentage = finalMaxPoints > 0 ? (finalPoints / finalMaxPoints) * 100 : 0;
    
    // Create bonus breakdown
    const bonusBreakdown = (grade.achievementBonuses || []).map(bonus => ({
      achievementId: bonus.achievementId,
      achievementName: bonus.achievementName,
      bonusPoints: bonus.bonusPoints,
      bonusPercentage: bonus.bonusPercentage || 0
    }));
    
    return {
      basePoints,
      maxBasePoints,
      achievementBonusPoints,
      achievementBonusPercentage,
      finalPoints: Math.round(finalPoints * 100) / 100, // Round to 2 decimal places
      finalMaxPoints: Math.round(finalMaxPoints * 100) / 100,
      finalPercentage: Math.round(finalPercentage * 100) / 100,
      bonusBreakdown
    };
  }

  /**
   * Get grade with bonus calculation for display
   */
  static async getStudentGradeWithBonuses(
    studentId: string,
    courseId: string
  ): Promise<{ grade: StudentGrade; calculation: GradeBonusCalculation } | null> {
    try {
      const gradeQuery = query(
        collection(db, COLLECTIONS.STUDENT_GRADES),
        where('studentId', '==', studentId),
        where('courseId', '==', courseId)
      );
      
      const gradeSnapshot = await getDocs(gradeQuery);
      
      if (gradeSnapshot.empty) {
        return null;
      }
      
      const grade = gradeSnapshot.docs[0].data() as StudentGrade;
      const calculation = this.calculateFinalGrade(grade);
      
      return { grade, calculation };
      
    } catch (error) {
      console.error('Error getting student grade with bonuses:', error);
      return null;
    }
  }

  /**
   * Get all students' grades with bonuses for a course
   */
  static async getCourseGradesWithBonuses(courseId: string): Promise<{
    studentId: string;
    grade: StudentGrade;
    calculation: GradeBonusCalculation;
  }[]> {
    try {
      const gradesQuery = query(
        collection(db, COLLECTIONS.STUDENT_GRADES),
        where('courseId', '==', courseId)
      );
      
      const gradesSnapshot = await getDocs(gradesQuery);
      
      const results = gradesSnapshot.docs.map(doc => {
        const grade = doc.data() as StudentGrade;
        const calculation = this.calculateFinalGrade(grade);
        
        return {
          studentId: grade.studentId,
          grade,
          calculation
        };
      });
      
      // Sort by final percentage descending
      results.sort((a, b) => b.calculation.finalPercentage - a.calculation.finalPercentage);
      
      return results;
      
    } catch (error) {
      console.error('Error getting course grades with bonuses:', error);
      return [];
    }
  }

  /**
   * Update achievement bonus settings for a course
   */
  static async updateCourseBonusSettings(
    courseId: string,
    settings: {
      maxBonusPoints?: number;
      maxBonusPercentage?: number;
      enabledAchievementCategories?: string[];
    }
  ): Promise<void> {
    // This would be stored in a course settings document
    // For now, we'll keep it simple and apply bonuses for all achievements
    console.log('Course bonus settings updated:', settings);
  }

  /**
   * Get bonus statistics for a course
   */
  static async getCourseBonusStats(courseId: string): Promise<{
    studentsWithBonuses: number;
    totalBonusPointsAwarded: number;
    averageBonusPoints: number;
    topBonusEarners: { studentId: string; bonusPoints: number }[];
  }> {
    try {
      const grades = await this.getCourseGradesWithBonuses(courseId);
      
      const studentsWithBonuses = grades.filter(g => g.calculation.achievementBonusPoints > 0).length;
      const totalBonusPointsAwarded = grades.reduce((sum, g) => sum + g.calculation.achievementBonusPoints, 0);
      const averageBonusPoints = grades.length > 0 ? totalBonusPointsAwarded / grades.length : 0;
      
      const topBonusEarners = grades
        .filter(g => g.calculation.achievementBonusPoints > 0)
        .sort((a, b) => b.calculation.achievementBonusPoints - a.calculation.achievementBonusPoints)
        .slice(0, 10)
        .map(g => ({
          studentId: g.studentId,
          bonusPoints: g.calculation.achievementBonusPoints
        }));
      
      return {
        studentsWithBonuses,
        totalBonusPointsAwarded,
        averageBonusPoints: Math.round(averageBonusPoints * 100) / 100,
        topBonusEarners
      };
      
    } catch (error) {
      console.error('Error getting course bonus stats:', error);
      return {
        studentsWithBonuses: 0,
        totalBonusPointsAwarded: 0,
        averageBonusPoints: 0,
        topBonusEarners: []
      };
    }
  }

  /**
   * Remove achievement bonus (if achievement is disabled/removed)
   */
  static async removeAchievementBonus(
    studentId: string,
    courseId: string,
    achievementId: string
  ): Promise<void> {
    try {
      const gradeQuery = query(
        collection(db, COLLECTIONS.STUDENT_GRADES),
        where('studentId', '==', studentId),
        where('courseId', '==', courseId)
      );
      
      const gradeSnapshot = await getDocs(gradeQuery);
      
      if (gradeSnapshot.empty) {
        return;
      }
      
      const gradeDoc = gradeSnapshot.docs[0];
      const currentGrade = gradeDoc.data() as StudentGrade;
      
      const bonusToRemove = currentGrade.achievementBonuses?.find(
        bonus => bonus.achievementId === achievementId
      );
      
      if (!bonusToRemove) {
        return; // Bonus not found
      }
      
      // Remove the bonus from the arrays and totals
      const updatedBonuses = currentGrade.achievementBonuses?.filter(
        bonus => bonus.achievementId !== achievementId
      ) || [];
      
      const updatedBonusPoints = (currentGrade.achievementBonusPoints || 0) - bonusToRemove.bonusPoints;
      const updatedBonusPercentage = (currentGrade.achievementBonusPercentage || 0) - (bonusToRemove.bonusPercentage || 0);
      
      await updateDoc(doc(db, COLLECTIONS.STUDENT_GRADES, gradeDoc.id), {
        achievementBonuses: updatedBonuses,
        achievementBonusPoints: Math.max(0, updatedBonusPoints),
        achievementBonusPercentage: Math.max(0, updatedBonusPercentage),
        lastUpdated: Timestamp.now()
      });
      
    } catch (error) {
      console.error('Error removing achievement bonus:', error);
      throw error;
    }
  }
}

export default GradeBonusService;