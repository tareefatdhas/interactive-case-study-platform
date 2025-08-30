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
  calculateAchievementProgress
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
  participation: { label: 'Participation', icon: Users, color: 'green' },
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

function AchievementCard({ achievement, studentAchievement, progress, isUnlocked }: AchievementCardProps) {
  const Icon = iconMap[achievement.icon] || Award;
  const rarityInfo = rarityConfig[achievement.rarity];
  
  return (
    <div className={cn(
      'relative bg-white border-2 rounded-lg p-4 transition-all duration-200 hover:shadow-lg',
      isUnlocked ? rarityInfo.border : 'border-gray-200',
      isUnlocked && rarityInfo.glow,
      !isUnlocked && 'opacity-75'
    )}>
      {/* Rarity indicator */}
      {isUnlocked && (
        <div className={cn(
          'absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium',
          achievement.rarity === 'common' && 'bg-gray-100 text-gray-600',
          achievement.rarity === 'rare' && 'bg-blue-100 text-blue-600',
          achievement.rarity === 'epic' && 'bg-purple-100 text-purple-600',
          achievement.rarity === 'legendary' && 'bg-yellow-100 text-yellow-600'
        )}>
          {achievement.rarity}
        </div>
      )}
      
      {/* Icon and basic info */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          'p-2 rounded-lg',
          isUnlocked ? (
            achievement.rarity === 'common' ? 'bg-gray-100' :
            achievement.rarity === 'rare' ? 'bg-blue-100' :
            achievement.rarity === 'epic' ? 'bg-purple-100' :
            'bg-yellow-100'
          ) : 'bg-gray-100'
        )}>
          {isUnlocked ? (
            <Icon className={cn('h-5 w-5', rarityInfo.color)} />
          ) : (
            <Lock className="h-5 w-5 text-gray-400" />
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
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{progress.currentValue}/{progress.requiredValue}</span>
          </div>
          <ProgressBar progress={progress.percentage} />
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
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      <button
        onClick={() => onCategoryChange('all')}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
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
              'flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              selectedCategory === category
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <Icon className="h-4 w-4" />
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

  useEffect(() => {
    const loadData = async () => {
      if (!studentId || !teacherId) {
        console.log('AchievementsTab: Missing required props', { studentId, teacherId });
        return;
      }
      
      try {
        setLoading(true);
        console.log('AchievementsTab: Loading data for', { studentId, teacherId, sessionId, courseId });
        
        // Load all data in parallel
        const [
          availableAchievements,
          studentAchievementsData,
          sessionProgressData,
          overallProgressData
        ] = await Promise.all([
          getAvailableAchievementsForStudent(teacherId, courseId || undefined),
          getStudentAchievements(studentId),
          sessionId ? getStudentProgressStudent(studentId, sessionId) : null,
          getStudentOverallProgressStudent(studentId)
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
    
    // Sort: unlocked first, then by rarity, then by name
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
    filtered.sort((a, b) => {
      if (a.isUnlocked && !b.isUnlocked) return -1;
      if (!a.isUnlocked && b.isUnlocked) return 1;
      
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
    const totalXp = studentAchievements.reduce((sum, sa) => sum + sa.xpAwarded, 0);
    const totalBonusPoints = studentAchievements.reduce((sum, sa) => sum + (sa.bonusPoints || 0), 0);
    
    return {
      filteredAchievements: filtered,
      categories: uniqueCategories,
      stats: {
        totalAchievements,
        unlockedCount,
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
          <div className="grid grid-cols-1 gap-4">
            {filteredAchievements.map((item) => (
              <AchievementCard
                key={item.achievement.id}
                achievement={item.achievement}
                studentAchievement={item.studentAchievement}
                progress={item.progress}
                isUnlocked={item.isUnlocked}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}