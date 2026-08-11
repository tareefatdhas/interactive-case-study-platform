import { Timestamp } from 'firebase/firestore';

export interface Question {
  id: string;
  text: string;
  type: 'text' | 'multiple-choice' | 'multiple-choice-feedback' | 'essay';
  options?: string[];
  correctAnswer?: number; // Index of the correct option (for multiple-choice)
  correctAnswerExplanation?: string; // Explanation for why the correct answer is correct
  points: number;
}

export type SectionType = 'reading' | 'discussion' | 'activity';

export interface Section {
  id: string;
  title: string;
  content: string;
  type: SectionType;
  questions: Question[];
  order: number;
  // For discussion sections
  discussionPrompt?: string;
  // For activity sections  
  activityInstructions?: string;
}

export interface CaseStudy {
  id: string;
  title: string;
  description: string;
  sections: Section[];
  totalPoints: number;
  courseId: string;
  teacherId: string;
  archived: boolean; // Soft delete - hide from normal views but preserve for sessions
  archivedAt?: Timestamp;
  conclusionGuidance?: string; // Optional guidance for AI-generated conclusions
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SessionType = 'case-study' | 'standalone';

export type SessionInteractionType =
  | 'pulse'
  | 'poll'
  | 'quiz'
  | 'open-response'
  | 'word-cloud'
  | 'peer-learning'
  | 'team-formation'
  | 'group-work'
  | 'timer'
  | 'spin-wheel'
  | 'reflection'
  | 'case-study';

export interface SessionInteraction {
  id: string;
  type: SessionInteractionType;
  title: string;
  prompt: string;
  plannedTime?: string;
  durationMinutes?: number;
  caseStudyId?: string;
  options?: string[];
  correctOptionIndex?: number;
  explanation?: string;
  discussionMinutes?: number;
  groupSize?: number;
  teamTags?: string[];
  requireTeamTag?: boolean;
  wheelSource?: 'students' | 'teams' | 'custom';
  wheelItems?: string[];
  wheelRemoveSelected?: boolean;
  resultVisibility?: 'live' | 'after-reveal' | 'instructor-only';
}

export type SessionInteractionRunStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface SessionInteractionRun {
  id: string;
  interactionId: string;
  startedAt: number;
  updatedAt: number;
  endedAt?: number;
  status: SessionInteractionRunStatus;
  responseCount: number;
  resultState?: {
    open: boolean;
    revealed: boolean;
    phase?: 'respond' | 'discuss' | 'respond-again' | 'work' | 'complete';
    firstResponseCount?: number;
    firstOptionCounts?: number[];
    wheelItems?: string[];
    wheelItemColors?: string[];
    wheelSelectedIndex?: number | null;
    wheelSelectedLabel?: string | null;
    wheelSpinCount?: number;
    wheelRotation?: number;
    wheelHistory?: string[];
  };
  timerState?: {
    label: string;
    durationSeconds: number;
    endsAt: number;
  };
}

export interface Session {
  id: string;
  sessionCode: string;
  sessionType: SessionType;
  caseStudyId?: string; // Optional for standalone sessions
  caseStudyTitle?: string; // Store title to avoid orphaned references
  teacherId: string;
  courseId?: string;
  courseCode?: string;
  courseName?: string;
  scheduledFor?: string;
  presentationMode?: 'external';
  interactions?: SessionInteraction[];
  courseSourceIds?: string[];
  interactionRuns?: SessionInteractionRun[];
  active: boolean;
  studentsJoined: string[];
  releasedSections: number[]; // Array of section indices that have been released (0-based)
  currentReleasedSection: number; // Current maximum section index released (-1 means none released)
  
  // For standalone sessions
  title?: string;
  description?: string;
  sections?: StandaloneSection[];
  
  createdAt: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  lastActivityAt?: Timestamp;
}

export type CourseSourceKind = 'syllabus' | 'slides' | 'reading' | 'case' | 'notes';

export interface CourseSource {
  id: string;
  title: string;
  kind: CourseSourceKind;
  content: string;
  fileName?: string;
  extractedWithAi?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StandaloneSection {
  id: string;
  title: string;
  type: SectionType;
  order: number;
  // For discussion sections
  discussionPrompt?: string;
  // For activity sections  
  activityInstructions?: string;
}

export interface Student {
  id: string;
  authorUid?: string;
  studentId: string;
  studentIdNormalized: string; // For duplicate detection and searching
  name: string;
  email?: string;
  courseIds: string[];
  createdAt: Timestamp;
}

export interface Response {
  id: string;
  authorUid?: string;
  studentId: string;
  sessionId: string;
  caseStudyId: string;
  sectionId: string;
  questionId: string;
  response: string;
  points?: number;
  maxPoints: number;
  submittedAt: Timestamp;
  gradedAt?: Timestamp;
  gradedBy?: string;
  assessment?: {
    score: number;
    feedback: string;
    milestones: {
      [key: string]: {
        achieved: boolean;
        evidence: string;
        confidence: number;
      };
    };
  };
}

export interface StudentGrade {
  id: string;
  studentId: string;
  courseId: string;
  totalPoints: number;
  maxTotalPoints: number;
  participationRate: number;
  sessions: {
    sessionId: string;
    caseStudyId: string;
    points: number;
    maxPoints: number;
    completedAt: Timestamp;
  }[];
  // Achievement bonus system
  achievementBonusPoints: number; // Total bonus points from achievements
  achievementBonusPercentage: number; // Additional percentage bonus (0-100)
  achievementBonuses: {
    achievementId: string;
    achievementName: string;
    bonusPoints: number;
    bonusPercentage?: number;
    awardedAt: Timestamp;
  }[];
  lastUpdated: Timestamp;
}

export interface Teacher {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
  courseIds: string[];
  createdAt: Timestamp;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  studentIds: string[];
  term?: string;
  archived?: boolean;
  archivedAt?: Timestamp | null;
  sourceCourseId?: string;
  interactionTemplates?: SessionInteraction[];
  courseSources?: CourseSource[];
  teamTags?: string[];
  teams?: Array<{
    id: string;
    name: string;
    description?: string;
    tag?: string;
    color?: 'violet' | 'blue' | 'teal' | 'green' | 'gold' | 'coral' | 'pink' | 'navy';
    creatorUid?: string;
    memberCount?: number;
    members?: Array<{
      studentUid: string;
      studentNumber?: string;
      displayName?: string;
    }>;
  }>;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface SessionProgress {
  sessionId: string;
  studentsJoined: number;
  studentsCompleted: number;
  averageProgress: number;
  currentSection: number;
  responses: {
    studentId: string;
    currentSection: number;
    completed: boolean;
  }[];
}

export interface Highlight {
  id: string;
  studentId: string;
  authorUid?: string; // Firebase Auth UID of the user who created the highlight
  sessionId: string;
  sectionIndex: number;
  sectionTitle: string;
  text: string;
  startOffset: number;
  endOffset: number;
  color: string;
  note?: string;
  shared?: boolean;
  createdAt: Timestamp;
}

export interface StudentProgress {
  studentId: string;
  sessionId: string;
  authorUid?: string; // Firebase Auth UID for security rules
  sectionsCompleted: number;
  questionsAnswered: number;
  totalPoints: number;
  maxPoints: number;
  currentLevel: number;
  xp: number;
  streak: number;
  timeSpentReading: number; // in minutes
  lastActive: Timestamp;
  rank?: number; // Calculated field for leaderboard
  correctAnswers?: number; // Number of correct answers in this session
  highlightsCreated?: number; // Number of highlights created in this session
  totalUniqueWords?: number; // Total unique words used in responses for this session
  studentName?: string; // Student name for display purposes (not stored in progress, populated on query)
}

export interface StudentOverallProgress {
  studentId: string;
  authorUid?: string; // Firebase Auth UID for security rules
  totalSessions: number;
  totalSectionsCompleted: number;
  totalQuestionsAnswered: number;
  totalPointsEarned: number;
  totalMaxPoints: number;
  overallLevel: number;
  totalXP: number;
  longestStreak: number;
  totalTimeSpent: number; // in minutes
  averageScore: number; // percentage
  studentName?: string; // Student name for display purposes (not stored in progress, populated on query)
  sessionsCompleted: number; // sessions where all released sections were completed
  totalHighlights: number;
  firstSessionDate: Timestamp;
  lastActive: Timestamp;
  rank?: number; // Overall rank across all students
  totalCorrectAnswers?: number; // Total correct answers across all sessions
  totalUniqueWordsUsed?: number; // Total unique words used in all responses
}

export type UserRole = 'teacher' | 'student';

export interface AuthUser {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  photoURL?: string;
}

// Achievement system types
export type AchievementCategory = 'reading' | 'excellence' | 'participation' | 'streaks' | 'special';
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AchievementRequirement {
  type: 'sections_completed' | 'perfect_score' | 'streak_days' | 'session_count' | 'points_earned' | 'first_to_complete' | 'response_count' | 'attendance_rate' | 'correct_answers' | 'highlights_created' | 'response_effort';
  value: number;
  scope?: 'session' | 'overall'; // Whether requirement applies to single session or overall progress
  timeframe?: number; // For time-based requirements (days)
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string; // Icon identifier (lucide icon name)
  requirements: AchievementRequirement;
  gradeBonus?: number; // Optional points bonus (0-10)
  xpReward: number;
  rarity: AchievementRarity;
  teacherId: string; // Who created the achievement
  courseId?: string | null; // Course-specific or global (null for global)
  enabled: boolean;
  isDefault?: boolean; // System default achievements
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StudentAchievement {
  id: string;
  authorUid?: string;
  studentId: string;
  achievementId: string;
  achievementName: string; // Cache for display
  achievementIcon: string; // Cache for display
  achievementRarity: AchievementRarity; // Cache for display
  unlockedAt: Timestamp;
  bonusApplied: boolean;
  bonusPoints?: number; // How many bonus points were awarded
  sessionId?: string; // Which session triggered the achievement
  xpAwarded: number;
}

export interface AchievementProgress {
  achievementId: string;
  currentValue: number;
  requiredValue: number;
  percentage: number;
}

export type RewardKind = 'pass' | 'recognition' | 'choice' | 'extra-credit';
export type RewardRequestStatus = 'pending' | 'approved' | 'declined' | 'used';

export interface RewardDefinition {
  id: string;
  teacherId: string;
  courseId: string;
  courseCode: string;
  name: string;
  description: string;
  pointsRequired: number;
  kind: RewardKind;
  enabled: boolean;
  limitPerStudent?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RewardRequest {
  id: string;
  authorUid: string;
  teacherId: string;
  courseId: string;
  courseCode: string;
  studentNumber: string;
  studentDisplayName?: string;
  rewardId: string;
  rewardName: string;
  pointsRequired: number;
  pointsAtRequest: number;
  status: RewardRequestStatus;
  requestedAt: Timestamp;
  reviewedAt?: Timestamp;
  instructorNote?: string;
}
