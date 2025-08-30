'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Star, 
  Lock, 
  BookOpen, 
  Target, 
  Users, 
  Flame, 
  Sparkles,
  Calendar,
  Zap,
  Award,
  Crown,
  Medal,
  Gift
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  Achievement, 
  StudentAchievement, 
  AchievementProgress, 
  AchievementCategory,
  AchievementRarity,
  StudentProgress,
  StudentOverallProgress
} from '@/types';
import { 
  getStudentAchievements,
  getAvailableAchievementsForStudent,
  calculateAchievementProgress,
  unlockAchievement
} from '@/lib/firebase/achievements';
import { 
  getStudentProgressStudent,
  getStudentOverallProgressStudent
} from '@/lib/firebase/student-firestore';

interface AchievementsTabProps {
  studentId?: string;
  sessionId?: string;
  teacherId?: string;
  courseId?: string;
}

interface AchievementCardProps {
  achievement: Achievement;
  studentAchievement?: StudentAchievement;
  progress?: AchievementProgress;
  isUnlocked: boolean;
  onUnlock?: (achievement: Achievement) => void;
  isUnlocking?: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  BookOpen,
  Star,
  Target,
  Users,
  Flame,
  Sparkles,
  Calendar,
  Zap,
  Award,
  Trophy,
  Crown,
  Medal,
  Gift
};

const categoryConfig: Record<AchievementCategory, { label: string; icon: React.ElementType; color: string }> = {
  reading: { label: 'Reading', icon: BookOpen, color: 'blue' },
  excellence: { label: 'Excellence', icon: Star, color: 'yellow' },
  participation: { label: 'Engage', icon: Users, color: 'green' },
  streaks: { label: 'Streaks', icon: Flame, color: 'orange' },
  special: { label: 'Special', icon: Sparkles, color: 'purple' }
};

const rarityConfig: Record<AchievementRarity, { color: string; glow: string; border: string }> = {
  common: { color: 'text-gray-600', glow: '', border: 'border-gray-200' },
  rare: { color: 'text-blue-600', glow: 'shadow-blue-100', border: 'border-blue-200' },
  epic: { color: 'text-purple-600', glow: 'shadow-purple-100', border: 'border-purple-200' },
  legendary: { color: 'text-yellow-600', glow: 'shadow-yellow-100', border: 'border-yellow-200' }
};

function ProgressBar({ progress, className }: { progress: number; className?: string }) {
  return (
    <div className={cn('w-full bg-gray-200 rounded-full h-2', className)}>
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );
}

function AchievementCard({ achievement, studentAchievement, progress, isUnlocked, onUnlock, isUnlocking }: AchievementCardProps) {
  const Icon = iconMap[achievement.icon] || Award;
  const rarityInfo = rarityConfig[achievement.rarity];
  const hasProgress = progress && progress.percentage > 0;
  
  return (
    <div className={cn(
      'relative bg-white border-2 rounded-lg p-4 transition-all duration-200 hover:shadow-lg',
      isUnlocked ? (
        // Unlocked achievements: prominent styling with rarity colors and glow
        cn(
          rarityInfo.border,
          rarityInfo.glow,
          'shadow-md',
          achievement.rarity === 'legendary' && 'bg-gradient-to-br from-yellow-50 to-orange-50',
          achievement.rarity === 'epic' && 'bg-gradient-to-br from-purple-50 to-pink-50',
          achievement.rarity === 'rare' && 'bg-gradient-to-br from-blue-50 to-cyan-50',
          achievement.rarity === 'common' && 'bg-gradient-to-br from-gray-50 to-slate-50'
        )
      ) : progress && progress.percentage >= 100 ? (
        // Ready to unlock: golden highlight
        'border-yellow-300 bg-yellow-50/50 shadow-sm'
      ) : hasProgress ? (
        // Has progress: subtle blue highlight to draw attention
        'border-blue-300 bg-blue-50/30'
      ) : (
        // No progress: standard styling
        'border-gray-200 opacity-75'
      )
    )}>
      {/* Achievement status indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-2">
        {isUnlocked ? (
          <>
            {/* Completion badge */}
            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              <Trophy className="h-3 w-3" />
              <span>Unlocked!</span>
            </div>
            {/* Rarity indicator */}
            <div className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              achievement.rarity === 'common' && 'bg-gray-100 text-gray-600',
              achievement.rarity === 'rare' && 'bg-blue-100 text-blue-600',
              achievement.rarity === 'epic' && 'bg-purple-100 text-purple-600',
              achievement.rarity === 'legendary' && 'bg-yellow-100 text-yellow-600'
            )}>
              {achievement.rarity}
            </div>
          </>
        ) : hasProgress && (
          <div className={cn(
            "px-2 py-1 rounded-full text-xs font-medium",
            progress.percentage >= 100 ? 
              "bg-yellow-100 text-yellow-700 animate-pulse" : 
              "bg-blue-100 text-blue-700"
          )}>
            {progress.percentage >= 100 ? "Ready to unlock!" : `${Math.round(progress.percentage)}% complete`}
          </div>
        )}
      </div>
      
      {/* Icon and basic info */}
      <div className="flex items-start gap-3 mb-3 mt-8">
        <div className={cn(
          'p-3 rounded-lg relative',
          isUnlocked ? (
            cn(
              'shadow-sm',
              achievement.rarity === 'common' && 'bg-gray-200',
              achievement.rarity === 'rare' && 'bg-blue-200',
              achievement.rarity === 'epic' && 'bg-purple-200',
              achievement.rarity === 'legendary' && 'bg-yellow-200'
            )
          ) : progress && progress.percentage >= 100 ? (
            'bg-yellow-100'
          ) : hasProgress ? (
            'bg-blue-100'
          ) : (
            'bg-gray-100'
          )
        )}>
          {isUnlocked ? (
            <>
              <Icon className={cn('h-6 w-6', rarityInfo.color)} />
              {/* Sparkle effect for unlocked achievements */}
              <div className="absolute -top-1 -right-1">
                <Sparkles className="h-4 w-4 text-yellow-500" />
              </div>
            </>
          ) : progress && progress.percentage >= 100 ? (
            <Icon className="h-6 w-6 text-yellow-600" />
          ) : hasProgress ? (
            <Icon className="h-6 w-6 text-blue-600" />
          ) : (
            <Lock className="h-6 w-6 text-gray-400" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            'font-semibold text-sm',
            isUnlocked ? 'text-gray-900' : 'text-gray-500'
          )}>
            {achievement.name}
          </h3>
          <p className={cn(
            'text-xs mt-1',
            isUnlocked ? 'text-gray-600' : 'text-gray-400'
          )}>
            {achievement.description}
          </p>
        </div>
      </div>
      
      {/* Progress bar for locked achievements */}
      {!isUnlocked && progress && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={hasProgress ? 'text-blue-600 font-medium' : 'text-gray-500'}>
              Progress
            </span>
            <span className={hasProgress ? 'text-blue-700 font-medium' : 'text-gray-500'}>
              {progress.currentValue}/{progress.requiredValue}
            </span>
          </div>
          <div className={cn(
            'w-full rounded-full h-2.5',
            progress.percentage >= 100 ? 'bg-yellow-100' : hasProgress ? 'bg-blue-100' : 'bg-gray-200'
          )}>
            <div 
              className={cn(
                'h-2.5 rounded-full transition-all duration-500 ease-out',
                progress.percentage >= 100 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                hasProgress ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gray-300'
              )}
              style={{ width: `${Math.min(progress.percentage, 100)}%` }}
            />
          </div>
          {hasProgress && (
            <div className={cn(
              "text-xs mt-1 font-medium",
              progress.percentage >= 100 ? "text-yellow-600" : "text-blue-600"
            )}>
              {progress.percentage >= 100 ? 
                "🎉 Achievement complete! Check back soon for unlock." : 
                `${Math.round(progress.percentage)}% complete - Keep going! 🎯`
              }
            </div>
          )}
        </div>
      )}
      
      {/* Unlock Button for Ready Achievements */}
      {!isUnlocked && progress && progress.percentage >= 100 && onUnlock && (
        <div className="mb-3">
          <button
            onClick={() => onUnlock(achievement)}
            disabled={isUnlocking}
            className={cn(
              "w-full font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2",
              isUnlocking 
                ? "bg-gray-400 cursor-not-allowed" 
                : "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
            )}
          >
            {isUnlocking ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Unlocking...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Unlock Achievement!
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Rewards */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          {achievement.xpReward > 0 && (
            <div className="flex items-center gap-1 text-blue-600">
              <Star className="h-3 w-3" />
              <span>{achievement.xpReward} XP</span>
            </div>
          )}
          {achievement.gradeBonus && achievement.gradeBonus > 0 && (
            <div className="flex items-center gap-1 text-green-600">
              <Trophy className="h-3 w-3" />
              <span>+{achievement.gradeBonus} pts</span>
            </div>
          )}
        </div>
        
        {studentAchievement && (
          <div className="text-gray-500">
            {new Date(
              studentAchievement.unlockedAt?.toDate?.() || 
              studentAchievement.unlockedAt?.seconds * 1000 || 
              studentAchievement.unlockedAt
            ).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryFilter({ 
  categories, 
  selectedCategory, 
  onCategoryChange 
}: { 
  categories: AchievementCategory[];
  selectedCategory: AchievementCategory | 'all';
  onCategoryChange: (category: AchievementCategory | 'all') => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
      <button
        onClick={() => onCategoryChange('all')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
          selectedCategory === 'all'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        )}
      >
        All
      </button>
      
      {categories.map((category) => {
        const config = categoryConfig[category];
        const Icon = config.icon;
        
        return (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
              selectedCategory === category
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {config.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AchievementsTab({ 
  studentId, 
  sessionId, 
  teacherId,
  courseId 
}: AchievementsTabProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [studentAchievements, setStudentAchievements] = useState<StudentAchievement[]>([]);
  const [studentProgress, setStudentProgress] = useState<StudentProgress | null>(null);
  const [overallProgress, setOverallProgress] = useState<StudentOverallProgress | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!studentId || !teacherId) {
        console.log('AchievementsTab: Missing required props', { studentId, teacherId });
        return;
      }
      
      try {
        setLoading(true);
        console.log('AchievementsTab: Loading data for', { studentId, teacherId, sessionId, courseId });
        
        // Check authentication state
        const { studentAuth } = await import('@/lib/firebase/student-config');
        console.log('AchievementsTab: Auth state', {
          currentUser: studentAuth.currentUser?.uid,
          isAnonymous: studentAuth.currentUser?.isAnonymous,
          providerData: studentAuth.currentUser?.providerData
        });
        
        // Load all data in parallel with error handling
        const [
          availableAchievements,
          studentAchievementsData,
          sessionProgressData,
          overallProgressData
        ] = await Promise.all([
          getAvailableAchievementsForStudent(teacherId, courseId || undefined).catch(error => {
            console.error('Failed to load available achievements:', error);
            return []; // Return empty array as fallback
          }),
          getStudentAchievements(studentId).catch(error => {
            console.error('Failed to load student achievements:', error);
            return []; // Return empty array as fallback
          }),
          sessionId ? getStudentProgressStudent(studentId, sessionId).catch(error => {
            console.error('Failed to load session progress:', error);
            return null;
          }) : null,
          getStudentOverallProgressStudent(studentId).catch(error => {
            console.error('Failed to load overall progress:', error);
            return null;
          })
        ]);
        
        console.log('AchievementsTab: Data loaded', {
          availableAchievements: availableAchievements.length,
          studentAchievements: studentAchievementsData.length,
          sessionProgress: !!sessionProgressData,
          overallProgress: !!overallProgressData
        });
        
        setAchievements(availableAchievements);
        setStudentAchievements(studentAchievementsData);
        setStudentProgress(sessionProgressData);
        setOverallProgress(overallProgressData);
        
      } catch (error) {
        console.error('Failed to load achievements data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [studentId, sessionId, teacherId, courseId]);

  const handleUnlock = async (achievement: Achievement) => {
    if (!studentId || unlocking) return;
    
    try {
      setUnlocking(achievement.id);
      console.log('Unlocking achievement:', achievement.name);
      
      // Unlock the achievement
      await unlockAchievement(studentId, achievement, sessionId);
      
      // Reload the data to reflect the new unlock
      const updatedStudentAchievements = await getStudentAchievements(studentId);
      setStudentAchievements(updatedStudentAchievements);
      
      console.log('Achievement unlocked successfully!');
    } catch (error) {
      console.error('Failed to unlock achievement:', error);
    } finally {
      setUnlocking(null);
    }
  };

  const { filteredAchievements, categories, stats } = useMemo(() => {
    const unlockedAchievementIds = new Set(studentAchievements.map(sa => sa.achievementId));
    
    // Calculate progress for each achievement
    const achievementsWithProgress = achievements.map(achievement => {
      const isUnlocked = unlockedAchievementIds.has(achievement.id);
      const studentAchievement = studentAchievements.find(sa => sa.achievementId === achievement.id);
      
      let progress: AchievementProgress | undefined;
      if (!isUnlocked) {
        progress = calculateAchievementProgress(
          achievement,
          studentProgress,
          overallProgress
        );
      }
      
      return {
        achievement,
        studentAchievement,
        progress,
        isUnlocked
      };
    });
    
    // Filter by category
    const filtered = selectedCategory === 'all' 
      ? achievementsWithProgress
      : achievementsWithProgress.filter(item => item.achievement.category === selectedCategory);
    
    // Sort: unlocked first, then by progress (highest first), then by rarity, then by name
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
    filtered.sort((a, b) => {
      // Unlocked achievements first
      if (a.isUnlocked && !b.isUnlocked) return -1;
      if (!a.isUnlocked && b.isUnlocked) return 1;
      
      // For locked achievements, sort by progress (highest progress first)
      if (!a.isUnlocked && !b.isUnlocked) {
        const progressA = a.progress?.percentage || 0;
        const progressB = b.progress?.percentage || 0;
        if (progressA !== progressB) return progressB - progressA; // Higher progress first
      }
      
      // Then by rarity
      const rarityA = rarityOrder[a.achievement.rarity];
      const rarityB = rarityOrder[b.achievement.rarity];
      if (rarityA !== rarityB) return rarityA - rarityB;
      
      return a.achievement.name.localeCompare(b.achievement.name);
    });
    
    // Get unique categories
    const uniqueCategories = [...new Set(achievements.map(a => a.category))];
    
    // Calculate stats
    const totalAchievements = achievements.length;
    const unlockedCount = studentAchievements.length;
    const readyToUnlockCount = achievementsWithProgress.filter(item => !item.isUnlocked && item.progress && item.progress.percentage >= 100).length;
    const totalXp = studentAchievements.reduce((sum, sa) => sum + sa.xpAwarded, 0);
    const totalBonusPoints = studentAchievements.reduce((sum, sa) => sum + (sa.bonusPoints || 0), 0);
    
    return {
      filteredAchievements: filtered,
      categories: uniqueCategories,
      stats: {
        totalAchievements,
        unlockedCount,
        readyToUnlockCount,
        totalXp,
        totalBonusPoints
      }
    };
  }, [achievements, studentAchievements, studentProgress, overallProgress, selectedCategory]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-24 animate-pulse" />
          ))}
        </div>
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-full h-8 w-20 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-32 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4">
        {stats.readyToUnlockCount > 0 && (
          <div className="col-span-2 mb-2">
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-yellow-700">
                    {stats.readyToUnlockCount}
                  </p>
                  <p className="text-sm text-yellow-600">Ready to Unlock!</p>
                </div>
                <Sparkles className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-blue-700">
                {stats.unlockedCount}/{stats.totalAchievements}
              </p>
              <p className="text-sm text-blue-600">Achievements</p>
            </div>
            <Trophy className="h-6 w-6 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-green-700">
                +{stats.totalBonusPoints}
              </p>
              <p className="text-sm text-green-600">Bonus Points</p>
            </div>
            <Gift className="h-6 w-6 text-green-600" />
          </div>
        </div>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Categories</h3>
          <CategoryFilter 
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>
      )}

      {/* Achievements Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {selectedCategory === 'all' ? 'All Achievements' : categoryConfig[selectedCategory as AchievementCategory]?.label}
          </h3>
          <span className="text-sm text-gray-500">
            {filteredAchievements.filter(item => item.isUnlocked).length}/{filteredAchievements.length} unlocked
          </span>
        </div>

        {filteredAchievements.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No achievements available</p>
            <p className="text-xs mt-1">
              Complete activities to unlock achievements
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Group achievements by status */}
            {(() => {
              const unlockedAchievements = filteredAchievements.filter(item => item.isUnlocked);
              const readyToUnlockAchievements = filteredAchievements.filter(item => !item.isUnlocked && item.progress && item.progress.percentage >= 100);
              const inProgressAchievements = filteredAchievements.filter(item => !item.isUnlocked && item.progress && item.progress.percentage > 0 && item.progress.percentage < 100);
              const lockedAchievements = filteredAchievements.filter(item => !item.isUnlocked && (!item.progress || item.progress.percentage === 0));
              
              return (
                <>
                  {/* Unlocked Achievements */}
                  {unlockedAchievements.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Trophy className="h-5 w-5 text-green-600" />
                        <h4 className="text-lg font-semibold text-green-700">
                          Unlocked ({unlockedAchievements.length})
                        </h4>
                        <div className="flex-1 h-px bg-green-200" />
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {unlockedAchievements.map((item) => (
                          <AchievementCard
                            key={item.achievement.id}
                            achievement={item.achievement}
                            studentAchievement={item.studentAchievement}
                            progress={item.progress}
                            isUnlocked={item.isUnlocked}
                            onUnlock={handleUnlock}
                            isUnlocking={unlocking === item.achievement.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Ready to Unlock Achievements */}
                  {readyToUnlockAchievements.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="h-5 w-5 text-yellow-600" />
                        <h4 className="text-lg font-semibold text-yellow-700">
                          Ready to Unlock ({readyToUnlockAchievements.length})
                        </h4>
                        <div className="flex-1 h-px bg-yellow-200" />
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {readyToUnlockAchievements.map((item) => (
                          <AchievementCard
                            key={item.achievement.id}
                            achievement={item.achievement}
                            studentAchievement={item.studentAchievement}
                            progress={item.progress}
                            isUnlocked={item.isUnlocked}
                            onUnlock={handleUnlock}
                            isUnlocking={unlocking === item.achievement.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* In Progress Achievements */}
                  {inProgressAchievements.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Target className="h-5 w-5 text-blue-600" />
                        <h4 className="text-lg font-semibold text-blue-700">
                          In Progress ({inProgressAchievements.length})
                        </h4>
                        <div className="flex-1 h-px bg-blue-200" />
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {inProgressAchievements.map((item) => (
                          <AchievementCard
                            key={item.achievement.id}
                            achievement={item.achievement}
                            studentAchievement={item.studentAchievement}
                            progress={item.progress}
                            isUnlocked={item.isUnlocked}
                            onUnlock={handleUnlock}
                            isUnlocking={unlocking === item.achievement.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Locked Achievements */}
                  {lockedAchievements.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Lock className="h-5 w-5 text-gray-500" />
                        <h4 className="text-lg font-semibold text-gray-600">
                          Locked ({lockedAchievements.length})
                        </h4>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {lockedAchievements.map((item) => (
                          <AchievementCard
                            key={item.achievement.id}
                            achievement={item.achievement}
                            studentAchievement={item.studentAchievement}
                            progress={item.progress}
                            isUnlocked={item.isUnlocked}
                            onUnlock={handleUnlock}
                            isUnlocking={unlocking === item.achievement.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}