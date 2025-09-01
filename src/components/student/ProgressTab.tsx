'use client';

import { useState, useEffect } from 'react';
import { Trophy, Target, Clock, Flame, Crown, Medal, Star, Highlighter, Globe, Calendar, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudentProgress, StudentOverallProgress } from '@/types';
import { 
  getStudentProgressStudent,
  getLeaderboardStudent
} from '@/lib/firebase/student-firestore';

interface ProgressTabProps {
  studentId?: string;
  sessionId?: string;
  currentSectionIndex?: number;
  totalSections?: number;
  totalPoints?: number;
  maxPoints?: number;
  highlights?: any[]; // Add highlights for additional stats
}

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function ProgressRing({ progress, size = 120, strokeWidth = 8, className }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-blue-600 transition-all duration-500 ease-out"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {Math.round(progress)}%
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Progress
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  color?: 'blue' | 'green' | 'orange' | 'purple';
}

function StatCard({ icon, label, value, subtext, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    orange: 'text-orange-600 bg-orange-50',
    purple: 'text-purple-600 bg-purple-50',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm font-medium text-gray-600">{label}</div>
          {subtext && (
            <div className="text-xs text-gray-500">{subtext}</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface LeaderboardEntryProps {
  rank: number;
  studentId: string;
  totalPoints: number;
  sectionsCompleted: number;
  isCurrentUser?: boolean;
  isOverall?: boolean;
  totalSessions?: number;
  studentName?: string;
}

interface ViewToggleProps {
  view: 'session' | 'overall';
  onViewChange: (view: 'session' | 'overall') => void;
}

function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1 text-sm">
      <button
        onClick={() => onViewChange('session')}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md font-medium transition-all duration-200',
          'bg-white text-blue-600 shadow-sm' // Always active since it's the only option
        )}
      >
        <Clock className="h-4 w-4" />
        Session Progress
      </button>
      {/* Overall tab temporarily disabled
      <button
        onClick={() => onViewChange('overall')}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md font-medium transition-all duration-200',
          view === 'overall'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-800'
        )}
      >
        <Globe className="h-4 w-4" />
        Overall
      </button>
      */}
    </div>
  );
}

function LeaderboardEntry({ rank, studentId, totalPoints, sectionsCompleted, isCurrentUser, isOverall, totalSessions, studentName }: LeaderboardEntryProps) {
  const getRankIcon = () => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return (
          <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-xs font-bold text-gray-600">{rank}</span>
          </div>
        );
    }
  };

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg transition-colors',
      isCurrentUser 
        ? 'bg-blue-50 border border-blue-200' 
        : 'hover:bg-gray-50'
    )}>
      <div className="flex-shrink-0">
        {getRankIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-medium text-sm truncate',
            isCurrentUser ? 'text-blue-900' : 'text-gray-900'
          )}>
            {isCurrentUser ? 'You' : (studentName || `Student ${studentId.slice(-4)}`)}
          </span>
          {isCurrentUser && (
            <Star className="h-3 w-3 text-blue-600" />
          )}
        </div>
        <div className="text-xs text-gray-500">
          {isOverall && totalSessions ? 
            `${totalSessions} sessions • ${sectionsCompleted} sections` :
            `${sectionsCompleted} sections completed`
          }
        </div>
      </div>
      
      <div className="text-right">
        <div className={cn(
          'text-lg font-bold',
          isCurrentUser ? 'text-blue-700' : 'text-gray-900'
        )}>
          {totalPoints}
        </div>
        <div className="text-xs text-gray-500">points</div>
      </div>
    </div>
  );
}

export default function ProgressTab({ 
  studentId, 
  sessionId, 
  currentSectionIndex = 0, 
  totalSections = 1,
  totalPoints = 0,
  maxPoints = 0,
  highlights = []
}: ProgressTabProps) {
  const [view, setView] = useState<'session' | 'overall'>('session'); // Overall disabled, always session
  const [studentProgress, setStudentProgress] = useState<StudentProgress | null>(null);
  const [studentOverallProgress, setStudentOverallProgress] = useState<StudentOverallProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<StudentProgress[]>([]);
  const [overallLeaderboard, setOverallLeaderboard] = useState<StudentOverallProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studentId && sessionId) {
      loadData();
    }
  }, [studentId, sessionId]);

  const loadData = async () => {
    if (!studentId || !sessionId) return;

    try {
      setLoading(true);
      
      // Load session data only (overall functionality temporarily disabled)
      const [progressData, leaderboardData] = await Promise.all([
        getStudentProgressStudent(studentId, sessionId).catch(error => {
          console.error('Failed to load session progress:', error);
          return null;
        }),
        getLeaderboardStudent(sessionId, 10).catch(error => {
          console.error('Failed to load session leaderboard:', error);
          return [];
        })
      ]);

      setStudentProgress(progressData);
      setLeaderboard(leaderboardData);
      // Overall data setting removed (functionality temporarily disabled)
      setStudentOverallProgress(null);
      setOverallLeaderboard([]);
      
      // Note: Progress updates should happen when actual actions occur (answering questions, etc.)
      // not when viewing the progress tab. This component is read-only.

      // Overall progress calculation disabled (functionality temporarily disabled)
    } catch (error) {
      console.error('Failed to load progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateLevel = (points: number): number => {
    // Simple level calculation: 1 level per 100 points
    return Math.floor(points / 100) + 1;
  };

  const getProgressPercentage = (): number => {
    if (maxPoints === 0) return 0;
    return Math.min((totalPoints / maxPoints) * 100, 100);
  };

  const getSectionProgress = (): number => {
    // Calculate section-based progress for this session
    if (totalSections === 0) return 0;
    return Math.min(((currentSectionIndex + 1) / totalSections) * 100, 100);
  };

  const getCurrentUserRank = (): number => {
    if (view === 'overall') {
      const userInLeaderboard = overallLeaderboard.find(entry => entry.studentId === studentId);
      return userInLeaderboard?.rank || overallLeaderboard.length + 1;
    } else {
      const userInLeaderboard = leaderboard.find(entry => entry.studentId === studentId);
      return userInLeaderboard?.rank || leaderboard.length + 1;
    }
  };

  const getDisplayData = () => {
    if (view === 'overall' && studentOverallProgress) {
      return {
        level: studentOverallProgress.overallLevel,
        points: studentOverallProgress.totalPointsEarned,
        maxPoints: studentOverallProgress.totalMaxPoints,
        sections: studentOverallProgress.totalSectionsCompleted,
        totalSections: studentOverallProgress.totalSectionsCompleted, // Total sections across all their sessions
        progress: studentOverallProgress.totalMaxPoints > 0 ? 
          (studentOverallProgress.totalPointsEarned / studentOverallProgress.totalMaxPoints) * 100 : 0,
        highlights: studentOverallProgress.totalHighlights,
        xp: studentOverallProgress.totalXP
      };
    } else if (view === 'overall' && !studentOverallProgress) {
      // Overall view but no overall data available - show minimal/loading state
      return {
        level: 1,
        points: 0,
        maxPoints: 0,
        sections: 0,
        totalSections: 0,
        progress: 0,
        highlights: 0,
        xp: 0
      };
    } else {
      // Session progress: show actual completed sections in THIS session
      const sectionsCompleted = studentProgress?.sectionsCompleted || Math.max(currentSectionIndex, 0);
      return {
        level: calculateLevel(totalPoints),
        points: totalPoints,
        maxPoints,
        sections: sectionsCompleted, // Sections completed in this session
        totalSections,
        progress: getSectionProgress(), // For session view, section progress is more intuitive than points
        highlights: highlights.length,
        xp: totalPoints * 10
      };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentUserRank = getCurrentUserRank();
  const displayData = getDisplayData();

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <ViewToggle view={view} onViewChange={setView} />

      {/* Personal Progress Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {view === 'overall' ? 'Overall Progress' : 'Session Progress'}
          </h3>
          {view === 'overall' && (
            <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              <Globe className="h-3 w-3" />
              All Sessions
            </div>
          )}
        </div>
        
        {/* Progress Ring and Stats */}
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
          <ProgressRing progress={displayData.progress} />
          
          <div className="flex-1 grid grid-cols-2 gap-3 w-full">
            <StatCard
              icon={<Target className="h-5 w-5" />}
              label="Level"
              value={displayData.level}
              subtext={`${displayData.xp} XP`}
              color="purple"
            />
            
            <StatCard
              icon={<Trophy className="h-5 w-5" />}
              label="Points"
              value={displayData.points}
              subtext={`of ${displayData.maxPoints}`}
              color="green"
            />
            
            <StatCard
              icon={view === 'overall' ? <Target className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              label={view === 'overall' ? 'Sections' : 'Sections'}
              value={view === 'overall' ? 
                `${studentOverallProgress?.totalSectionsCompleted || 0}` :
                `${displayData.sections}/${displayData.totalSections}`
              }
              subtext={view === 'overall' ? 'total completed' : 'completed'}
              color="blue"
            />
            
            <StatCard
              icon={<Flame className="h-5 w-5" />}
              label="Rank"
              value={`#${currentUserRank}`}
              subtext={view === 'overall' ? 'overall' : 'in session'}
              color="orange"
            />
            
            <StatCard
              icon={<Highlighter className="h-5 w-5" />}
              label="Highlights"
              value={displayData.highlights}
              subtext="created"
              color="blue"
            />
            
            {view === 'overall' && studentOverallProgress && (
              <>
                <StatCard
                  icon={<Calendar className="h-5 w-5" />}
                  label="Sessions"
                  value={`${studentOverallProgress.totalSessions}`}
                  subtext="participated"
                  color="purple"
                />
                
                <StatCard
                  icon={<TrendingUp className="h-5 w-5" />}
                  label="Average"
                  value={`${Math.round(studentOverallProgress.averageScore)}%`}
                  subtext="score"
                  color="green"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {view === 'overall' ? 'Overall Leaderboard' : 'Session Leaderboard'}
          </h3>
          <Trophy className="h-5 w-5 text-yellow-500" />
        </div>
        
        <div className="space-y-1">
          {view === 'overall' && !studentOverallProgress ? (
            <div className="text-center py-8 text-gray-500">
              <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Overall progress data unavailable</p>
              <p className="text-xs">
                Trying to load overall progress data...
              </p>
            </div>
          ) : (view === 'overall' ? overallLeaderboard : leaderboard).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No rankings available yet</p>
              <p className="text-xs">
                {view === 'overall' 
                  ? 'Complete sessions to see the overall leaderboard'
                  : 'Complete more sections to see the leaderboard'
                }
              </p>
            </div>
          ) : (
            <>
              {(view === 'overall' ? overallLeaderboard : leaderboard).map((entry, index) => (
                <LeaderboardEntry
                  key={`leaderboard-${entry.studentId}-${index}`}
                  rank={entry.rank || 0}
                  studentId={entry.studentId}
                  totalPoints={view === 'overall' ? 
                    (entry as StudentOverallProgress).totalPointsEarned : 
                    (entry as StudentProgress).totalPoints
                  }
                  sectionsCompleted={view === 'overall' ? 
                    (entry as StudentOverallProgress).totalSectionsCompleted : 
                    (entry as StudentProgress).sectionsCompleted
                  }
                  isCurrentUser={entry.studentId === studentId}
                  isOverall={view === 'overall'}
                  totalSessions={view === 'overall' ? 
                    (entry as StudentOverallProgress).totalSessions : 
                    undefined
                  }
                  studentName={entry.studentName}
                />
              ))}
              
              {/* Show current user if not in top 10 */}
              {currentUserRank > 10 && (
                <>
                  <div className="border-t border-gray-200 my-2" />
                  <LeaderboardEntry
                    key={`current-user-${studentId}`}
                    rank={currentUserRank}
                    studentId={studentId || ''}
                    totalPoints={view === 'overall' ? 
                      (studentOverallProgress?.totalPointsEarned || 0) : 
                      totalPoints
                    }
                    sectionsCompleted={view === 'overall' ? 
                      (studentOverallProgress?.totalSectionsCompleted || 0) : 
                      currentSectionIndex
                    }
                    isCurrentUser={true}
                    isOverall={view === 'overall'}
                    totalSessions={view === 'overall' ? 
                      (studentOverallProgress?.totalSessions || 0) : 
                      undefined
                    }
                    studentName={view === 'overall' ? 
                      studentOverallProgress?.studentName : 
                      studentProgress?.studentName
                    }
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>


    </div>
  );
}