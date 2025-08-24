import { Timestamp } from 'firebase/firestore';

export interface Question {
  id: string;
  text: string;
  type: 'text' | 'multiple-choice' | 'multiple-choice-feedback' | 'essay';
  options?: string[];
  correctAnswer?: number; // Index of the correct option (for multiple-choice)
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SessionType = 'case-study' | 'standalone';

export interface Session {
  id: string;
  sessionCode: string;
  sessionType: SessionType;
  caseStudyId?: string; // Optional for standalone sessions
  teacherId: string;
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
  studentId: string;
  name: string;
  email?: string;
  courseIds: string[];
  createdAt: Timestamp;
}

export interface Response {
  id: string;
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
  lastUpdated: Timestamp;
}

export interface Teacher {
  id: string;
  email: string;
  name: string;
  courseIds: string[];
  createdAt: Timestamp;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  studentIds: string[];
  createdAt: Timestamp;
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

export type UserRole = 'teacher' | 'student';

export interface AuthUser {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
}