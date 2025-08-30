'use client';

import { useState, useEffect, use, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { signInAnonymously } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { studentAuth } from '@/lib/firebase/student-config';
import { 
  getSessionByCodeStudent as getSessionByCode, 
  getCaseStudyStudent as getCaseStudy, 
  createStudentStudent as createStudent,
  getStudentByStudentIdStudent as getStudentByStudentId,
  joinSessionStudent as joinSession,
  createResponseStudent as createResponse,
  getResponsesByStudentStudent as getResponsesByStudent
} from '@/lib/firebase/student-firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import type { Session, CaseStudy, Student, Response, Highlight } from '@/types';
import { User, CheckCircle, X, ArrowRight, BookOpen, Clock, MessageSquare, Settings, Award, HelpCircle, FileText } from 'lucide-react';
import { DEFAULT_MILESTONES } from '@/lib/ai/assessment';
import FloatingActionButton from '@/components/student/FloatingActionButton';
import FeaturePanel from '@/components/student/FeaturePanel';
import { useFABState } from '@/components/student/useFABState';
import HighlightableContent from '@/components/student/HighlightableContent';
import ReadingSettingsPanel from '@/components/student/ReadingSettingsPanel';
import AchievementNotification, { AchievementToast, useAchievementNotifications } from '@/components/student/AchievementNotification';
import { 
  createHighlightStudent, 
  subscribeToHighlightsByStudentStudent, 
  deleteHighlightStudent,
  subscribeToPopularHighlightsBySessionStudent,
  calculateAndUpdateOverallProgress
} from '@/lib/firebase/student-firestore';
import { normalizeStudentId } from '@/lib/utils';

interface StudentSessionPageProps {
  params: Promise<{
    code: string;
  }>;
}

export default function StudentSessionPage({ params }: StudentSessionPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  
  const [step, setStep] = useState<'join' | 'reading' | 'review' | 'waiting' | 'conclusion' | 'completed'>('join');
  const [currentSection, setCurrentSection] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setErrorOriginal] = useState('');
  const [hasReadSection, setHasReadSection] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Wrap setError to log who is calling it
  const setError = (errorMessage: string) => {
    console.log('🔴 setError called with:', errorMessage);
    console.trace('🔴 setError STACK TRACE:');
    setErrorOriginal(errorMessage);
  };

  
  
  const [studentInfo, setStudentInfo] = useState({
    studentId: '',
    name: ''
  });
  const [showJoinAsOther, setShowJoinAsOther] = useState(false);
  const [rememberedStudent, setRememberedStudent] = useState<{studentId: string, name: string} | null>(null);
  
  const [currentResponses, setCurrentResponses] = useState<Record<string, string>>({});
  
  // State for new section notifications
  const [newSectionAvailable, setNewSectionAvailable] = useState(false);
  const [newSectionIndex, setNewSectionIndex] = useState(-1);
  const [initialReleasedSections, setInitialReleasedSections] = useState<number[] | null>(null);
  
  // Feature panel state
  const [isFeaturePanelOpen, setIsFeaturePanelOpen] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  
  // Popular highlights state
  const [allSessionHighlights, setAllSessionHighlights] = useState<Highlight[]>([]);
  const [showPopularHighlights, setShowPopularHighlights] = useState(false);
  const [popularityOpacity, setPopularityOpacity] = useState(0.6);
  const [minimumStudents, setMinimumStudents] = useState(2);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Achievement notifications
  const { notifications, showAchievementNotification, closeNotification } = useAchievementNotifications();

  // Storage key for this specific session
  const storageKey = `student-session-${resolvedParams.code}`;

  // Cookie management for student info
  const STUDENT_INFO_COOKIE = 'case-study-student-info';
  
  const saveStudentInfoToCookie = (studentId: string, name: string) => {
    try {
      const studentInfo = { studentId, name };
      document.cookie = `${STUDENT_INFO_COOKIE}=${encodeURIComponent(JSON.stringify(studentInfo))}; path=/; max-age=${30 * 24 * 60 * 60}`; // 30 days
    } catch (error) {
      console.warn('Failed to save student info to cookie:', error);
    }
  };

  const loadStudentInfoFromCookie = (): {studentId: string, name: string} | null => {
    try {
      const cookies = document.cookie.split(';');
      const studentCookie = cookies.find(cookie => cookie.trim().startsWith(`${STUDENT_INFO_COOKIE}=`));
      
      if (studentCookie) {
        const cookieValue = studentCookie.split('=')[1];
        const studentInfo = JSON.parse(decodeURIComponent(cookieValue));
        return studentInfo;
      }
    } catch (error) {
      console.warn('Failed to load student info from cookie:', error);
    }
    return null;
  };

  const clearStudentInfoCookie = () => {
    try {
      document.cookie = `${STUDENT_INFO_COOKIE}=; path=/; max-age=0`;
    } catch (error) {
      console.warn('Failed to clear student info cookie:', error);
    }
  };

  // Save student session to localStorage
  const saveStudentSession = (studentData: Student, sessionData: Session) => {
    try {
      const sessionInfo = {
        student: studentData,
        session: sessionData,
        timestamp: Date.now()
      };
      localStorage.setItem(storageKey, JSON.stringify(sessionInfo));
      
      // Also save to cookie for future sessions
      saveStudentInfoToCookie(studentData.studentId, studentData.name);
    } catch (error) {
      console.warn('Failed to save student session to localStorage:', error);
    }
  };

  // Load student session from localStorage
  const loadStoredSession = (): { student: Student; session: Session } | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;
      
      const sessionInfo = JSON.parse(stored);
      // Check if session was stored within the last 24 hours
      const dayInMs = 24 * 60 * 60 * 1000;
      if (Date.now() - sessionInfo.timestamp > dayInMs) {
        localStorage.removeItem(storageKey);
        return null;
      }
      
      return {
        student: sessionInfo.student,
        session: sessionInfo.session
      };
    } catch (error) {
      console.warn('Failed to load student session from localStorage:', error);
      localStorage.removeItem(storageKey);
      return null;
    }
  };

  // Clear stored session
  const clearStoredSession = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear student session from localStorage:', error);
    }
  };

  // Load remembered student info from cookie
  useEffect(() => {
    const remembered = loadStudentInfoFromCookie();
    if (remembered) {
      setRememberedStudent(remembered);
    }
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      try {
        setError('');
        
        // Always sign in anonymously on the student auth instance
        // This won't interfere with teacher sessions since it's a separate Firebase app
        console.log('LOAD: Attempting anonymous sign-in...');
        try {
          await signInAnonymously(studentAuth);
          console.log('LOAD: Anonymous sign-in successful');
        } catch (authError: any) {
          console.error('LOAD: Anonymous sign-in failed:', authError.code, '-', authError.message);
          if (authError.code === 'auth/operation-not-allowed') {
            setError('Anonymous authentication is not enabled. Please contact your administrator.');
          } else {
            setError('Authentication failed: ' + authError.message);
          }
          return;
        }
        
        // Check for stored session first
        const storedSession = loadStoredSession();
        
        console.log('LOAD: Fetching session data...');
        const sessionData = await getSessionByCode(resolvedParams.code);
        if (!sessionData) {
          console.error('LOAD: Session not found');
          setError('Session not found');
          clearStoredSession(); // Clear invalid stored session
          return;
        }
        console.log('LOAD: Session data fetched successfully');
        if (!sessionData.active) {
          setError('This session is no longer active');
          clearStoredSession(); // Clear stored session for inactive session
          return;
        }
        // Handle legacy sessions that might not have releasedSections field
        if (!sessionData.releasedSections) {
          console.log('LEGACY: Session missing releasedSections, defaulting to all sections released');
          // For compatibility, release all sections initially for legacy sessions
          const caseStudyData = sessionData.caseStudyId ? await getCaseStudy(sessionData.caseStudyId) : null;
          const totalSections = caseStudyData?.sections.length || 2;
          sessionData.releasedSections = Array.from({ length: totalSections }, (_, i) => i);
          sessionData.currentReleasedSection = totalSections - 1;
          console.log('LEGACY: Set released sections to:', sessionData.releasedSections);
        }
        
        setSession(sessionData);
        
        // Track initial released sections to detect live releases later
        setInitialReleasedSections(sessionData.releasedSections || []);
        
        console.log('LOAD: Fetching case study data...');
        const caseStudyData = sessionData.caseStudyId ? await getCaseStudy(sessionData.caseStudyId) : null;
        if (!caseStudyData) {
          console.error('LOAD: Case study not found');
          setError('Case study not found');
          return;
        }
        console.log('LOAD: Case study data fetched successfully');
        setCaseStudy(caseStudyData);
        
        // If we have a valid stored session, restore the student's progress
        if (storedSession && sessionData.id === storedSession.session.id) {
          console.log('RESTORE: Found stored session, restoring student progress...');
          
          try {
            // Verify the student still exists and is part of this session
            const studentData = await getStudentByStudentId(storedSession.student.studentId);
            if (studentData && sessionData.studentsJoined.includes(studentData.id)) {
              setStudent(studentData);
              setStudentInfo({
                studentId: studentData.studentId,
                name: studentData.name
              });
              
              // Load existing responses
              const existingResponses = await getResponsesByStudent(studentData.id, sessionData.id);
              setResponses(existingResponses);
              
              // Determine current section based on progress and released sections
              const completedSections = new Set(existingResponses.map(r => {
                const sectionIndex = caseStudyData?.sections.findIndex(s => s.id === r.sectionId) ?? -1;
                return sectionIndex;
              }));
              
              // Find the next section the student should work on
              const explicitlyReleasedSections = sessionData.releasedSections || [0];
              const maxReleasedSection = Math.max(...explicitlyReleasedSections);
              
              // All sections up to and including the max released section are available
              const allAvailableSections = Array.from({ length: maxReleasedSection + 1 }, (_, i) => i);
              
              // Find the first incomplete section among available sections
              let targetSection = 0; // Default to first section
              for (const sectionIndex of allAvailableSections) {
                if (!completedSections.has(sectionIndex)) {
                  targetSection = sectionIndex;
                  break;
                }
                // If this section is completed, continue to next available section
                targetSection = sectionIndex; // Stay at last completed section if all are done
              }
              
              setCurrentSection(targetSection);
              setStep('reading');
              console.log('RESTORE: Successfully restored student session at section', targetSection);
            } else {
              console.log('RESTORE: Student no longer valid, clearing stored session');
              clearStoredSession();
            }
          } catch (error) {
            console.warn('RESTORE: Failed to restore session, clearing stored data:', error);
            clearStoredSession();
          }
        }
      } catch (error: any) {
        console.error('Session load error:', error.message);
        setError(error.message || 'Failed to load session');
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [resolvedParams.code]);

  // Watch for session becoming inactive and clear stored session
  useEffect(() => {
    if (session && !session.active) {
      clearStoredSession();
    }
  }, [session]);


  // Handle student presence when component unmounts or page unloads
  useEffect(() => {
    if (!session || !student) return;

    const handleBeforeUnload = async () => {
      try {
        const { updateStudentPresenceStudent } = require('@/lib/firebase/student-realtime');
        await updateStudentPresenceStudent(session.id, student.id, false);
      } catch (error) {
        console.warn('Failed to update presence on unload:', error);
      }
    };

    // Set up presence tracking
    const setupPresence = async () => {
      try {
        const { updateStudentPresenceStudent } = require('@/lib/firebase/student-realtime');
        await updateStudentPresenceStudent(session.id, student.id, true);
      } catch (error) {
        console.warn('Failed to set initial presence:', error);
      }
    };

    setupPresence();

    // Listen for page unload
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function for component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Update presence to offline when component unmounts
      const { updateStudentPresenceStudent } = require('@/lib/firebase/student-realtime');
      updateStudentPresenceStudent(session.id, student.id, false).catch(console.warn);
    };
  }, [session, student]);

  // Subscribe to session updates to detect when new sections are released
  useEffect(() => {
    if (!session?.id || !['reading', 'review', 'waiting'].includes(step)) return;
    
    // Use Realtime Database for instant updates with zero polling
    const { subscribeToSessionStatusStudent } = require('@/lib/firebase/student-realtime');
    
    const unsubscribe = subscribeToSessionStatusStudent(session.id, (status: any) => {
      if (status && status.releasedSections) {
        // Update local session state with latest released sections
        setSession(prev => prev ? {
          ...prev,
          releasedSections: status.releasedSections
        } : null);

        if (initialReleasedSections && status.releasedSections.length > initialReleasedSections.length) {
          const newSection = status.releasedSections[status.releasedSections.length - 1];
          setNewSectionIndex(newSection);
          setNewSectionAvailable(true);
        }
      }
    });

    return () => unsubscribe();
  }, [session?.id, step, initialReleasedSections]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !caseStudy) return;

    setSubmitLoading(true);
    setError('');

    try {
      console.log('JOIN: Looking up student...'); 
      let studentData;
      try {
        studentData = await getStudentByStudentId(studentInfo.studentId);
        console.log('JOIN: Student lookup result:', studentData ? 'found' : 'not found');
      } catch (error: any) {
        console.error('JOIN: Student lookup failed:', error.code || 'unknown', '-', error.message);
        throw error;
      }
      
      if (!studentData) {
        console.log('JOIN: Creating student...');
        try {
          const studentId = await createStudent({
            studentId: studentInfo.studentId,
            studentIdNormalized: normalizeStudentId(studentInfo.studentId),
            name: studentInfo.name,
            courseIds: [caseStudy.courseId]
          });
          console.log('JOIN: Student created successfully with ID:', studentId);
          studentData = {
            id: studentId,
            studentId: studentInfo.studentId,
            studentIdNormalized: normalizeStudentId(studentInfo.studentId),
            name: studentInfo.name,
            courseIds: [caseStudy.courseId],
            createdAt: new Date() as any
          };
        } catch (error: any) {
          console.error('JOIN: Student creation failed:', error.code || 'unknown', '-', error.message);
          throw error;
        }
      }

      setStudent(studentData);
      
      console.log('JOIN: Joining session...');
      try {
        // Use hybrid approach: Update both Firestore (persistence) and Realtime Database (live presence)
        // Use the Firestore document ID for consistency
        await joinSession(session.id, studentData.id);
        console.log('JOIN: Session joined successfully');
      } catch (error: any) {
        console.error('JOIN: Session join failed:', error.code || 'unknown', '-', error.message);
        throw error;
      }
      
             // Add to Realtime Database for live presence
       // Use the Firestore document ID for consistency with responses
       try {
         const { joinLiveSessionStudent } = require('@/lib/firebase/student-realtime');
         await joinLiveSessionStudent(session.id, studentData.id, studentData.name);
         console.log('JOIN: Live session joined successfully');
       } catch (error: any) {
         console.warn('JOIN: Live session join failed (non-critical):', error);
       }
      
      console.log('JOIN: Getting responses...');
      let existingResponses: Response[] = [];
      try {
        existingResponses = await getResponsesByStudent(studentData.id, session.id);
        console.log('JOIN: Responses fetched successfully');
        setResponses(existingResponses);
      } catch (error: any) {
        console.error('JOIN: Getting responses failed:', error.code || 'unknown', '-', error.message);
        throw error;
      }
      
      // Determine starting section for new students
      const completedSections = new Set(existingResponses.map(r => {
        const sectionIndex = caseStudy?.sections.findIndex(s => s.id === r.sectionId) ?? -1;
        return sectionIndex;
      }));
      
      // Find the first incomplete section within the released range
      const explicitlyReleasedSections = session.releasedSections || [0];
      const maxReleasedSection = Math.max(...explicitlyReleasedSections);
      
      // All sections up to and including the max released section are available
      const allAvailableSections = Array.from({ length: maxReleasedSection + 1 }, (_, i) => i);
      
      // Find the first incomplete section among available sections
      let targetSection = 0; // Default to first section
      for (const sectionIndex of allAvailableSections) {
        if (!completedSections.has(sectionIndex)) {
          targetSection = sectionIndex;
          break;
        }
        // If this section is completed, continue to next available section
        targetSection = sectionIndex; // Stay at last completed section if all are done
      }
      
      console.log('JOIN: Setting current section to:', targetSection);
      console.log('JOIN: Released sections:', explicitlyReleasedSections);
      console.log('JOIN: Available sections:', allAvailableSections);
      console.log('JOIN: Completed sections:', Array.from(completedSections));
      setCurrentSection(targetSection);
      
      // Save session to localStorage for persistence
      saveStudentSession(studentData, session);
      
      setStep('reading');
      console.log('JOIN: Success!');
    } catch (error: any) {
      console.error('JOIN ERROR:', error.code || 'unknown', '-', error.message);
      setError(error.message || 'Failed to join session');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleResponseChange = (questionId: string, value: string) => {
    setCurrentResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // Reset reading state when section changes
  useEffect(() => {
    setHasReadSection(false);
    setShowQuestions(false);
    setIsHeaderCollapsed(false);
    setCurrentResponses({});
    
    // Scroll to top when section changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentSection]);

  // Scroll detection for header collapse and showing questions at end of content
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      
      // Collapse header after 100px of scrolling
      if (scrollY > 100 && !isHeaderCollapsed) {
        setIsHeaderCollapsed(true);
      } else if (scrollY <= 100 && isHeaderCollapsed) {
        setIsHeaderCollapsed(false);
      }
      
      // Show questions when user scrolls to end of content
      if (!contentRef.current) return;
      
      const contentElement = contentRef.current;
      const scrollPosition = window.scrollY + window.innerHeight;
      const contentBottom = contentElement.offsetTop + contentElement.offsetHeight;
      
      // Show questions when user scrolls to within 100px of content bottom
      if (scrollPosition >= contentBottom - 100 && !hasReadSection) {
        setHasReadSection(true);
        setTimeout(() => setShowQuestions(true), 500); // Delay for smooth transition
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasReadSection, isHeaderCollapsed]);

  const handleSubmitSection = async () => {
    if (!session || !caseStudy || !student) return;

    const currentSectionData = caseStudy.sections[currentSection];
    setSubmitLoading(true);

    try {
      for (const question of currentSectionData.questions) {
        const response = currentResponses[question.id] || '';
        
        if (response.trim() || question.type === 'multiple-choice' || question.type === 'multiple-choice-feedback') {
          // For multiple choice, calculate points automatically
          let points: number | undefined;
          let responseText = response.trim();
          
          if (question.type === 'multiple-choice' && question.correctAnswer !== undefined) {
            const selectedIndex = parseInt(response);
            points = selectedIndex === question.correctAnswer ? question.points : 0;
            responseText = question.options?.[selectedIndex] || response;
          } else if (question.type === 'multiple-choice-feedback') {
            // For feedback questions, all answers are correct and get full points
            const selectedIndex = parseInt(response);
            points = question.points;
            responseText = question.options?.[selectedIndex] || response;
          }

          // Create the response in Firestore for persistence and assessment
          await createResponse({
            studentId: student.id,
            sessionId: session.id,
            caseStudyId: caseStudy.id,
            sectionId: currentSectionData.id,
            questionId: question.id,
            response: responseText,
            maxPoints: question.points,
            ...(points !== undefined && { points })
          });

          // Response saved to Firestore only - teacher dashboard will get real-time updates via Firestore subscription

          // Only send to AI for assessment if not multiple choice (since MC is auto-graded)
          if (question.type !== 'multiple-choice' && question.type !== 'multiple-choice-feedback') {
            try {
              await fetch('/api/chat', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: responseText,
                  studentId: student.id,
                  sessionId: session.id,
                  questionId: question.id,
                  context: {
                    question: question.text,
                    caseStudyContent: currentSectionData.content,
                    maxPoints: question.points
                  }
                })
              });
            } catch (aiError) {
              console.error('AI assessment failed:', aiError);
              // Continue without AI assessment if it fails
            }
          }
        }
      }

      setCurrentResponses({});
      
      // Reload responses to include the newly submitted ones
      const updatedResponses = await getResponsesByStudent(student.id, session.id);
      setResponses(updatedResponses);
      
      // Update overall progress asynchronously
      calculateAndUpdateOverallProgress(student.id).catch(console.error);
      
      // Trigger FAB progress notification
      onProgressMade();
      
      // Check for achievements after submitting responses
      // Add a small delay to ensure all database updates are complete
      setTimeout(() => {
        checkAndShowAchievements().catch(error => {
          // Silently handle permission errors for section completion achievement checking
          if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            console.debug('Achievement checking skipped due to permissions (expected for anonymous users)');
          } else {
            console.error('Unexpected error in section completion achievement checking:', error);
          }
        });
      }, 1000);
      
      // Show review state first so students can see their feedback
      setStep('review');
    } catch (error: any) {
      setError(error.message || 'Failed to submit responses');
    } finally {
      setSubmitLoading(false);
    }
  };

  const isQuestionAnswered = (questionId: string) => {
    return responses.some(r => r.questionId === questionId);
  };

  // Helper function to check if a section is completed (with release validation)
  const isSectionCompleted = (sectionIndex: number) => {
    if (!caseStudy || !session) return false;
    
    const maxReleasedSection = session?.releasedSections ? Math.max(...session.releasedSections) : -1;
    const isReleased = sectionIndex <= maxReleasedSection;
    
    if (!isReleased) return false; // Can't be completed if not released
    
    const section = caseStudy.sections[sectionIndex];
    if (!section) return false;
    
    // Special case: sections with no questions can only be completed if the user has visited them
    // This prevents confusion where empty sections appear completed without user interaction
    if (section.questions.length === 0) {
      // Check if student has progressed past this section or is currently on it
      // This is more intuitive - empty sections are "completed" when the student has seen them
      return sectionIndex < currentSection || (sectionIndex === currentSection && step !== 'join');
    }
    
    // Only check responses that belong to released sections' questions
    return section.questions.every(q => {
      // Double-check: make sure this question belongs to a released section
      const questionSectionIndex = caseStudy.sections.findIndex(s => 
        s.questions.some(sq => sq.id === q.id)
      );
      const questionSectionReleased = questionSectionIndex <= maxReleasedSection;
      
      return questionSectionReleased && isQuestionAnswered(q.id);
    });
  };

  const canProceed = () => {
    if (!caseStudy) return false;
    const currentSectionData = caseStudy.sections[currentSection];
    return currentSectionData.questions.every(q => {
      // If already answered, can proceed
      if (isQuestionAnswered(q.id)) return true;
      
      // For multiple choice, just need to have selected an option
      if (q.type === 'multiple-choice') {
        return currentResponses[q.id] !== undefined && currentResponses[q.id] !== '';
      }
      
      // For text/essay, need non-empty response
      return currentResponses[q.id]?.trim();
    });
  };

  const canNavigateToPrevious = () => {
    const maxReleasedSection = session?.releasedSections ? Math.max(...session.releasedSections) : -1;
    return currentSection > 0 && (currentSection - 1) <= maxReleasedSection;
  };

  const canNavigateToNext = () => {
    const nextSection = currentSection + 1;
    const maxReleasedSection = session?.releasedSections ? Math.max(...session.releasedSections) : -1;
    return nextSection < (caseStudy?.sections.length || 0) && 
           nextSection <= maxReleasedSection &&
           isCurrentSectionCompleted();
  };

  const isCurrentSectionCompleted = () => {
    return isSectionCompleted(currentSection);
  };

  const handleNavigateToSection = (sectionIndex: number) => {
    const maxReleasedSection = session?.releasedSections ? Math.max(...session.releasedSections) : -1;
    if (sectionIndex <= maxReleasedSection) {
      setCurrentSection(sectionIndex);
      
      // Dismiss notification if we've navigated to or past the notification's target section
      if (newSectionAvailable && sectionIndex >= newSectionIndex) {
        setNewSectionAvailable(false);
      }
    }
  };

  const handleSwitchUser = () => {
    // Clear stored session but keep remembered student info for "Continue as..." option
    clearStoredSession();
    // Don't clear the cookie - keep it so "Continue as..." still appears
    // clearStudentInfoCookie(); 
    setStudent(null);
    setStudentInfo({ studentId: '', name: '' });
    setResponses([]);
    setStep('join');
    setShowJoinAsOther(false);
  };

  const handleGoToNewSection = () => {
    if (newSectionIndex > currentSection) {
      setCurrentSection(newSectionIndex);
      setStep('reading');
      setHasReadSection(false);
      setShowQuestions(false);
      setCurrentResponses({});
      setNewSectionAvailable(false);
    }
  };

  const handleDismissNewSection = () => {
    setNewSectionAvailable(false);
  };

  // Subscribe to highlights in real-time
  useEffect(() => {
    if (student?.id && session?.id) {
      const unsubscribe = subscribeToHighlightsByStudentStudent(
        student.id,
        session.id,
        (highlightsData) => {
          setHighlights(highlightsData);
        }
      );
      return () => unsubscribe();
    }
  }, [student?.id, session?.id]);

  // Subscribe to all session highlights for popular highlights feature
  useEffect(() => {
    if (session?.id && showPopularHighlights) {
      try {
        const unsubscribe = subscribeToPopularHighlightsBySessionStudent(
          session.id,
          (allHighlightsData) => {
            setAllSessionHighlights(allHighlightsData);
          }
        );
        return () => unsubscribe();
      } catch (error) {
        console.error('Failed to subscribe to popular highlights:', error);
        setAllSessionHighlights([]);
      }
    } else {
      // Clear highlights when feature is disabled
      setAllSessionHighlights([]);
    }
  }, [session?.id, showPopularHighlights]);

  // FAB state management - with error handling for Firebase permissions
  const fabStateContext = useMemo(() => {
    try {
      return {
        currentSection,
        totalSections: caseStudy?.sections.length || 1,
        sectionCompleted: caseStudy && session ? isSectionCompleted(currentSection) : false,
        totalPoints: responses.reduce((total, response) => total + (response.points || 0), 0),
        maxPoints: caseStudy?.sections.slice(0, currentSection + 1).reduce((total, section) => 
          total + section.questions.reduce((sectionTotal, question) => sectionTotal + question.points, 0), 0
        ) || 0,
        recentHighlights: 0, // Will be updated by the hook
        recentAchievements: [], // Will be updated by the hook
        hasAnsweredCurrentSection: caseStudy?.sections[currentSection]?.questions.every(q => 
          responses.some(r => r.questionId === q.id)
        ) || false,
        progressPercentage: caseStudy ? ((currentSection + 1) / caseStudy.sections.length) * 100 : 0
      };
    } catch (error) {
      console.warn('Error creating FAB state context:', error);
      // Return safe defaults if there's an error
      return {
        currentSection: 0,
        totalSections: 1,
        sectionCompleted: false,
        totalPoints: 0,
        maxPoints: 0,
        recentHighlights: 0,
        recentAchievements: [],
        hasAnsweredCurrentSection: false,
        progressPercentage: 0
      };
    }
  }, [currentSection, caseStudy, session, responses]);

  const {
    fabState,
    notifications: fabNotifications,
    suggestedTab,
    clearNotifications: clearFABNotifications,
    onHighlightCreated,
    onProgressMade,
    onAchievementUnlocked
  } = useFABState(fabStateContext);

  // Function to check for achievements and show notifications
  const checkAndShowAchievements = useCallback(async (): Promise<void> => {
    if (!student || !session) return;

    try {
      // Import achievement checker
      const { default: AchievementChecker } = await import('@/lib/firebase/achievement-checker');
      
      const context = {
        studentId: student.id,
        sessionId: session.id,
        teacherId: session.teacherId,
        courseId: undefined // Would need to be passed in or derived
      };

      // Check for newly unlocked achievements
      const unlockedAchievements = await AchievementChecker.checkAndUnlockAchievements(context);
      
      // Show notifications for each newly unlocked achievement
      unlockedAchievements.forEach(({ achievement, xpAwarded, bonusPoints }) => {
        showAchievementNotification(achievement, xpAwarded, bonusPoints);
        onAchievementUnlocked(achievement);
      });
      
    } catch (error: any) {
      // Handle Firebase permission errors gracefully
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        console.warn('Firebase permissions insufficient for achievement checking. This is expected for anonymous users or restricted environments.');
      } else {
        console.error('Error checking achievements:', error);
      }
    }
  }, [student, session, showAchievementNotification, onAchievementUnlocked]);

  const handleHighlightCreateForSection = useCallback(async (highlight: { id: string; text: string; color: string; note?: string; startOffset: number; endOffset: number; createdAt: Date }, sectionIndex: number) => {
    if (!student || !session || !caseStudy) return;

    const user = studentAuth.currentUser;
    if (!user) {
      console.error('No authenticated user found for creating highlight.');
      return;
    }

    // Get section data - handle description section (-1) and regular sections
    const sectionData = sectionIndex === -1 
      ? { title: 'Introduction' }
      : caseStudy.sections[sectionIndex];
    
    if (!sectionData && sectionIndex !== -1) {
      console.error('Invalid section index:', sectionIndex);
      return;
    }
    
    try {
      const highlightData = {
        studentId: student.id,
        authorUid: user.uid, // Add the secure auth UID
        sessionId: session.id,
        sectionIndex: sectionIndex,
        sectionTitle: sectionData.title,
        text: highlight.text,
        startOffset: highlight.startOffset,
        endOffset: highlight.endOffset,
        color: highlight.color,
        note: highlight.note || '' // Ensure note is not undefined
      };
      
      console.log('📝 Creating highlight with this data:', highlightData);
      
      const highlightId = await createHighlightStudent(highlightData);
      
      // Add to local state immediately for better UX
      const newHighlight: Highlight = { 
        ...highlightData, 
        id: highlightId, 
        createdAt: Timestamp.now(),
      };
      setHighlights(prev => [...prev, newHighlight]);
      
      // Trigger FAB highlight notification
      onHighlightCreated();
      
      // Check for highlight-based achievements
      // Small delay to ensure database updates are complete
      setTimeout(() => {
        checkAndShowAchievements().catch(error => {
          // Silently handle permission errors for highlight-based achievement checking
          if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            console.debug('Achievement checking skipped due to permissions (expected for anonymous users)');
          } else {
            console.error('Unexpected error in highlight achievement checking:', error);
          }
        });
      }, 500);
    } catch (error) {
      console.error('Failed to create highlight:', error);
    }
  }, [student, session, caseStudy, onHighlightCreated]);

  const handleHighlightDelete = useCallback(async (highlightId: string) => {
    try {
      await deleteHighlightStudent(highlightId);
      // Real-time listener will handle UI updates
    } catch (error) {
      console.error('Failed to delete highlight:', error);
    }
  }, []);

  const handleHighlightJump = useCallback((highlightId: string) => {
    // Find the highlight in our data to get its section
    const highlight = highlights.find(h => h.id === highlightId);
    if (!highlight) {
      console.warn('Highlight not found:', highlightId);
      return;
    }

    const highlightSection = highlight.sectionIndex ?? 0;
    
    // Function to actually scroll to the highlight
    const scrollToHighlight = () => {
      const highlightElement = document.querySelector(`[data-highlight-id="${highlightId}"]`);
      if (highlightElement) {
        highlightElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
        
        // Add a brief highlight animation
        highlightElement.classList.add('animate-pulse');
        setTimeout(() => {
          highlightElement.classList.remove('animate-pulse');
        }, 2000);
      } else {
        console.warn('Highlight element not found in DOM:', highlightId);
      }
    };

    // Check if we're already on the correct section
    if (highlightSection === currentSection) {
      // We're on the right section, scroll immediately
      scrollToHighlight();
    } else {
      // Navigate to the correct section first
      console.log(`Jumping from section ${currentSection} to section ${highlightSection} for highlight ${highlightId}`);
      handleNavigateToSection(highlightSection);
      
      // Wait for the section to render, then scroll to the highlight
      setTimeout(() => {
        scrollToHighlight();
      }, 500); // Give time for the new section to render
    }
  }, [highlights, currentSection, handleNavigateToSection]);

  // Helper function to count highlights per section
  const getHighlightCountForSection = useCallback((sectionIndex: number) => {
    return highlights.filter(h => {
      if (sectionIndex === -1) {
        return h.sectionIndex === -1; // Introduction highlights
      }
      return h.sectionIndex === sectionIndex;
    }).length;
  }, [highlights]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  if (error && !session && !caseStudy) {
    // Only show error UI if we don't have session/case study data
    // This way, if data loaded successfully but join failed, we can still show the join form
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Session Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => router.push('/join')}>
              Try Another Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Join step
  if (step === 'join') {
    const handleQuickJoin = async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!rememberedStudent || !session || !caseStudy || submitLoading) return;

      setStudentInfo(rememberedStudent);
      setSubmitLoading(true);
      setError('');

      try {
        console.log('QUICK JOIN: Looking up student...'); 
        let studentData = await getStudentByStudentId(rememberedStudent.studentId);
        
        if (!studentData) {
          console.log('QUICK JOIN: Creating student...');
          const studentId = await createStudent({
            studentId: rememberedStudent.studentId,
            studentIdNormalized: normalizeStudentId(rememberedStudent.studentId),
            name: rememberedStudent.name,
            courseIds: [caseStudy.courseId]
          });
          studentData = {
            id: studentId,
            studentId: rememberedStudent.studentId,
            studentIdNormalized: normalizeStudentId(rememberedStudent.studentId),
            name: rememberedStudent.name,
            courseIds: [caseStudy.courseId],
            createdAt: new Date() as any
          };
        }

        setStudent(studentData);
        
        console.log('QUICK JOIN: Joining session...');
        if (studentData) {
          await joinSession(session.id, studentData.id);
        }
        
        console.log('QUICK JOIN: Getting responses...');
        let existingResponses: Response[] = [];
        if (studentData) {
          existingResponses = await getResponsesByStudent(studentData.id, session.id);
          setResponses(existingResponses);
        }
        
        // Determine starting section for returning students
        const completedSections = new Set(existingResponses.map((r: Response) => {
          const sectionIndex = caseStudy?.sections.findIndex(s => s.id === r.sectionId) ?? -1;
          return sectionIndex;
        }));
        
        // Find the first incomplete section within the released range
        const explicitlyReleasedSections = session.releasedSections || [0];
        const maxReleasedSection = Math.max(...explicitlyReleasedSections);
        
        // All sections up to and including the max released section are available
        const allAvailableSections = Array.from({ length: maxReleasedSection + 1 }, (_, i) => i);
        
        // Find the first incomplete section among available sections
        let targetSection = 0; // Default to first section
        for (const sectionIndex of allAvailableSections) {
          if (!completedSections.has(sectionIndex)) {
            targetSection = sectionIndex;
            break;
          }
          // If this section is completed, continue to next available section
          targetSection = sectionIndex; // Stay at last completed section if all are done
        }
        
        console.log('QUICK JOIN: Setting current section to:', targetSection);
        console.log('QUICK JOIN: Released sections:', explicitlyReleasedSections);
        console.log('QUICK JOIN: Available sections:', allAvailableSections);
        console.log('QUICK JOIN: Completed sections:', Array.from(completedSections));
        setCurrentSection(targetSection);
        
        // Save session to localStorage for persistence
        if (studentData) {
          saveStudentSession(studentData, session);
        }
        
        setStep('reading');
        console.log('QUICK JOIN: Success!');
      } catch (error: any) {
        console.error('QUICK JOIN ERROR:', error.code || 'unknown', '-', error.message);
        setError(error.message || 'Failed to join session');
      } finally {
        setSubmitLoading(false);
      }
    };

    const handleJoinAsOther = () => {
      setShowJoinAsOther(true);
      setStudentInfo({ studentId: '', name: '' });
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {caseStudy?.title}
            </h1>
            <p className="text-gray-600 mt-2">
              Session: {session?.sessionCode}
            </p>
          </div>

          {/* Quick Join Option */}
          {rememberedStudent && !showJoinAsOther && (
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                      Welcome back!
                    </h3>
                    <p className="text-sm text-gray-600">
                      Continue as <span className="font-medium">{rememberedStudent.name}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Student ID: {rememberedStudent.studentId}
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <Button
                      onClick={handleQuickJoin}
                      loading={submitLoading}
                      className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Continue as {rememberedStudent.name}
                    </Button>
                    
                    <button
                      type="button"
                      onClick={handleJoinAsOther}
                      className="w-full text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Join as someone else
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Join Form */}
          {(!rememberedStudent || showJoinAsOther) && (
            <Card>
              <CardHeader>
                <CardTitle>Student Information</CardTitle>
                <CardDescription>
                  Enter your student ID and the name you'd like to be called
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form id="join-form" onSubmit={handleJoin} className="space-y-4">
                  <Input
                    label="Student ID"
                    value={studentInfo.studentId}
                    onChange={(e) => {
                      // Allow letters, numbers, hyphens, dots, and @ signs (for email addresses)
                      const cleanedValue = e.target.value.replace(/[^A-Za-z0-9\-\.@]/g, '');
                      setStudentInfo(prev => ({ ...prev, studentId: cleanedValue }));
                    }}
                    placeholder="e.g., STU001 or student@university.edu"
                    required
                  />
                  
                  <Input
                    label="Display Name"
                    value={studentInfo.name}
                    onChange={(e) => setStudentInfo(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Alex or Alex J."
                    required
                  />

                  {error && (
                    <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                      {error}
                    </div>
                  )}

                  <div className="space-y-3">
                    <Button
                      type="submit"
                      loading={submitLoading}
                      className="w-full flex items-center justify-center"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Join Session
                    </Button>
                    
                    {showJoinAsOther && rememberedStudent && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowJoinAsOther(false);
                          setStudentInfo({ studentId: '', name: '' });
                        }}
                        className="w-full text-sm text-gray-500 hover:text-gray-700 underline"
                      >
                        Back to quick join
                      </button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Option to clear remembered info */}
          {rememberedStudent && (
            <div className="text-center">
              <button
                onClick={() => {
                  clearStudentInfoCookie();
                  setRememberedStudent(null);
                  setShowJoinAsOther(false);
                  setStudentInfo({ studentId: '', name: '' });
                }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Forget my information
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Review answers step
  if (step === 'review') {
    if (!caseStudy) return null;
    
    const currentSectionData = caseStudy.sections[currentSection];
    
    const handleContinueAfterReview = () => {
      // Check if this is the last section of the entire case study
      if (currentSection >= caseStudy.sections.length - 1) {
        setStep('conclusion');
        // Don't clear session yet - wait until after conclusion
      } else {
        // Check if next section is released
        const nextSectionIndex = currentSection + 1;
        const maxReleasedSection = session?.releasedSections ? Math.max(...session.releasedSections) : -1;
        const isNextSectionReleased = nextSectionIndex <= maxReleasedSection;
        
        if (isNextSectionReleased) {
          setCurrentSection(nextSectionIndex);
          setStep('reading');
        } else {
          // Check if this is the last released section
          if (currentSection >= maxReleasedSection) {
            // Wait for teacher to release more sections
            setStep('waiting');
          } else {
            // Move to next released section (shouldn't happen with current logic, but safety check)
            setCurrentSection(nextSectionIndex);
            setStep('reading');
          }
        }
      }
    };

    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
            <div className="text-center">
              <h1 className="text-xl sm:text-2xl font-light text-gray-900 mb-2">
                {caseStudy.title}
              </h1>
              <p className="text-sm text-gray-500">
                Section {currentSection + 1} Review
              </p>
            </div>
          </div>
        </div>

        {/* Review Content */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium mb-4">
              <CheckCircle className="h-4 w-4" />
              Section {currentSection + 1} Submitted
            </div>
            <h2 className="text-2xl font-light text-gray-900 mb-2">
              Review Your Answers
            </h2>
            <p className="text-gray-600">
              Here's how you did on this section's questions.
            </p>
          </div>

          {/* Questions Review */}
          <div className="space-y-12 mb-12">
            {currentSectionData.questions.map((question, index) => (
              <div key={question.id} className="relative">
                <div className="mb-8">
                  <div className="flex items-start gap-5 mb-4">
                    <div className="flex-shrink-0 w-10 h-10 border-2 border-gray-900 text-gray-900 rounded-full flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </div>
                    <h3 className="text-xl font-light text-gray-900 leading-tight" style={{ fontFamily: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, 'Times New Roman', serif" }}>
                      {question.text}
                    </h3>
                  </div>
                  <div className="w-full h-px bg-gray-200 mt-6"></div>
                </div>

                {/* Response and Feedback */}
                <div className="ml-15 space-y-6">
                  {/* Show submitted response */}
                  <div className="border-l-4 border-blue-500 bg-blue-50/30 rounded-r-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-blue-800">Your Response</span>
                    </div>
                    <div className="text-lg text-gray-800 leading-relaxed" style={{ fontFamily: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, 'Times New Roman', serif" }}>
                      {(() => {
                        const response = responses.find(r => r.questionId === question.id);
                        return response?.response || 'No response recorded';
                      })()}
                    </div>
                  </div>
                  
                  {/* Show feedback for multiple choice questions */}
                  {question.type === 'multiple-choice' && question.correctAnswer !== undefined && (
                    <div className={`border-l-4 rounded-r-xl p-6 ${
                      (() => {
                        const response = responses.find(r => r.questionId === question.id);
                        const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                        const isCorrect = userAnswer === question.correctAnswer;
                        return isCorrect 
                          ? 'border-green-500 bg-green-50/30' 
                          : 'border-red-500 bg-red-50/30';
                      })()
                    }`}>
                      <div className={`flex items-center gap-4 mb-5 ${
                        (() => {
                          const response = responses.find(r => r.questionId === question.id);
                          const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                          const isCorrect = userAnswer === question.correctAnswer;
                          return isCorrect ? 'text-green-800' : 'text-red-800';
                        })()
                      }`}>
                        {(() => {
                          const response = responses.find(r => r.questionId === question.id);
                          const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                          const isCorrect = userAnswer === question.correctAnswer;
                          return isCorrect ? (
                            <>
                              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </div>
                              <span className="font-medium text-green-800">Correct answer</span>
                            </>
                          ) : (
                            <>
                              <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
                                <X className="h-4 w-4 text-red-600" />
                              </div>
                              <span className="font-medium text-red-800">Incorrect answer</span>
                            </>
                          );
                        })()}
                        
                        <div className="ml-auto flex items-center gap-2 text-sm">
                          <span className="text-gray-600">Points:</span>
                          <span className="font-semibold">
                            {(() => {
                              const response = responses.find(r => r.questionId === question.id);
                              const points = response?.points ?? 0;
                              const maxPoints = response?.maxPoints ?? question.points;
                              return `${points}/${maxPoints}`;
                            })()}
                          </span>
                        </div>
                      </div>
                      
                      {/* Show correct answer if user was wrong */}
                      {(() => {
                        const response = responses.find(r => r.questionId === question.id);
                        const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                        const isCorrect = userAnswer === question.correctAnswer;
                        
                        if (!isCorrect && question.options && question.correctAnswer !== undefined) {
                          return (
                            <div className="bg-white/70 rounded-lg p-4 border border-red-200/60 space-y-3">
                              <div>
                                <p className="text-sm text-gray-600 mb-2 font-medium">The correct answer was:</p>
                                <p className="text-lg text-gray-800 leading-relaxed" style={{ fontFamily: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, 'Times New Roman', serif" }}>
                                  {question.options[question.correctAnswer]}
                                </p>
                              </div>
                              {question.correctAnswerExplanation && (
                                <div>
                                  <p className="text-sm text-gray-600 mb-2 font-medium">Explanation:</p>
                                  <p className="text-base text-gray-700 leading-relaxed" style={{ fontFamily: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, 'Times New Roman', serif" }}>
                                    {question.correctAnswerExplanation}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                  
                  {/* Show feedback for multiple choice feedback questions */}
                  {question.type === 'multiple-choice-feedback' && (
                    <div className="border-l-4 border-blue-500 bg-blue-50/30 rounded-r-xl p-6">
                      <div className="flex items-center gap-4 mb-5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-blue-800 leading-none">
                            Thank you for your feedback!
                          </p>
                          <p className="text-xs text-blue-600/80 mt-1">
                            You earned {question.points} points
                          </p>
                        </div>
                      </div>
                      <div className="bg-white/70 rounded-lg p-4 border border-blue-200/60">
                        <p className="text-sm text-gray-600 mb-2 font-medium">Your response helps us understand different perspectives on this topic.</p>
                        <p className="text-lg text-gray-800 leading-relaxed" style={{ fontFamily: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, 'Times New Roman', serif" }}>
                          All responses are valuable for learning and discussion.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Show points for other question types */}
                  {question.type !== 'multiple-choice' && question.type !== 'multiple-choice-feedback' && (
                    <div className="border-l-4 border-amber-500 bg-amber-50/30 rounded-r-xl p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-amber-600" />
                        </div>
                        <span className="font-medium text-amber-800">
                          Awaiting instructor review
                        </span>
                        <div className="ml-auto flex items-center gap-2 text-sm">
                          <span className="text-gray-600">Worth:</span>
                          <span className="font-semibold">
                            {(() => {
                              const response = responses.find(r => r.questionId === question.id);
                              const points = response?.points;
                              const maxPoints = response?.maxPoints ?? question.points;
                              return points !== undefined ? `${points}/${maxPoints} points` : `${maxPoints} points`;
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Continue Button */}
          <div className="text-center">
            <Button
              onClick={handleContinueAfterReview}
              className="px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg"
            >
              {currentSection >= caseStudy.sections.length - 1 ? (
                'View Learning Summary'
              ) : (
                (() => {
                  const nextSectionIndex = currentSection + 1;
                  const maxReleasedSection = session?.releasedSections ? Math.max(...session.releasedSections) : -1;
                  const isNextSectionReleased = nextSectionIndex <= maxReleasedSection;
                  
                  return isNextSectionReleased 
                    ? `Continue to Section ${nextSectionIndex + 1} →` 
                    : 'Wait for Next Section';
                })()
              )}
            </Button>
          </div>
          
          {/* Switch User Link */}
          <div className="mt-8 pt-4 border-t border-gray-100">
            <div className="text-center">
              <button
                onClick={handleSwitchUser}
                className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
                title="Switch to a different student account for testing"
              >
                Switch User
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Waiting for next section step
  if (step === 'waiting') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <Clock className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-light text-gray-900 mb-2">
              Waiting for Next Section
            </h2>
            <p className="text-gray-600 mb-6">
              You've completed Section {currentSection + 1}. Your instructor will release the next section when ready.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <p className="text-sm text-gray-500">
                Checking for updates...
              </p>
            </div>
          </div>
          
          <div className="text-xs text-gray-400 mb-8">
            Case Study: {caseStudy?.title}
          </div>
          
          {/* Switch User Link */}
          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={handleSwitchUser}
              className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
              title="Switch to a different student account for testing"
            >
              Switch User
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Conclusion step - comprehensive summary and learning consolidation
  if (step === 'conclusion') {
    if (!caseStudy || !student || !session) return null;

    // Calculate performance metrics
    const totalPossiblePoints = caseStudy.sections.reduce((total, section) => 
      total + section.questions.reduce((sectionTotal, question) => sectionTotal + question.points, 0), 0
    );
    const earnedPoints = responses.reduce((total, response) => total + (response.points || 0), 0);
    const percentageScore = totalPossiblePoints > 0 ? Math.round((earnedPoints / totalPossiblePoints) * 100) : 0;
    
    // Calculate completion metrics
    const totalQuestions = caseStudy.sections.reduce((total, section) => total + section.questions.length, 0);
    const answeredQuestions = responses.length;
    const completionRate = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 100;
    
    // State for AI-generated conclusion data
    const [conclusionData, setConclusionData] = useState<{
      keyInsights: string[];
      learningMilestones: any;
      reflectionPrompts: string[];
    } | null>(null);
    const [loadingConclusion, setLoadingConclusion] = useState(true);

    // Generate AI-powered conclusion when component mounts
    useEffect(() => {
      const generateConclusion = async () => {
        try {
          setLoadingConclusion(true);
          
          // Prepare response data for AI analysis
          const responseData = responses.map(response => {
            const question = caseStudy.sections
              .flatMap(section => section.questions.map(q => ({ ...q, sectionTitle: section.title })))
              .find(q => q.id === response.questionId);
            
            return {
              questionText: question?.text || 'Question not found',
              studentResponse: response.response,
              points: response.points || 0,
              maxPoints: response.maxPoints,
              sectionTitle: question?.sectionTitle || 'Unknown Section'
            };
          });

          // Call the API endpoint to generate AI conclusion
          const response = await fetch('/api/generate-conclusion', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              caseStudyTitle: caseStudy.title,
              caseStudyDescription: caseStudy.description,
              responses: responseData,
              performance: {
                totalScore: earnedPoints,
                maxScore: totalPossiblePoints,
                percentageScore,
                completionRate
              },
              studentName: student.name,
              teacherGuidance: caseStudy.conclusionGuidance
            })
          });

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
          }

          const apiResult = await response.json();
          
          if (!apiResult.success) {
            throw new Error(apiResult.error || 'Failed to generate conclusion');
          }

          const aiConclusion = apiResult.result;

          setConclusionData(aiConclusion);
        } catch (error) {
          console.error('Error generating AI conclusion:', error);
          // Fallback to basic conclusion
          setConclusionData({
            keyInsights: [
              "You engaged thoughtfully with the case study material and demonstrated learning progress.",
              "Your responses showed effort and engagement with the key concepts presented.",
              "This learning experience has provided you with valuable insights to build upon."
            ],
            learningMilestones: Object.keys(DEFAULT_MILESTONES).reduce((acc, key) => {
              acc[key] = {
                name: DEFAULT_MILESTONES[key].name,
                achieved: percentageScore >= 70,
                progress: Math.min(1, percentageScore / 100),
                evidence: "Assessment based on overall performance",
                confidence: 0.7
              };
              return acc;
            }, {} as any),
            reflectionPrompts: [
              "What was the most important concept you learned from this case study?",
              "How might you apply these insights in real-world situations?",
              "What questions do you still have about this topic?"
            ]
          });
        } finally {
          setLoadingConclusion(false);
        }
      };

      generateConclusion();
    }, [caseStudy, student, responses, earnedPoints, totalPossiblePoints, percentageScore, completionRate]);

    // Show loading state while generating conclusion
    if (loadingConclusion || !conclusionData) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-light text-gray-900 mb-2">
              Generating Your Learning Summary
            </h2>
            <p className="text-gray-600">
              Our AI is analyzing your responses to create personalized insights...
            </p>
          </div>
        </div>
      );
    }

    const { keyInsights, learningMilestones, reflectionPrompts } = conclusionData;

    // Performance level determination
    const getPerformanceLevel = (score: number) => {
      if (score >= 90) return { level: 'Excellent', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
      if (score >= 80) return { level: 'Proficient', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
      if (score >= 70) return { level: 'Developing', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
      return { level: 'Beginning', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };
    };

    const performance = getPerformanceLevel(percentageScore);

    const handleFinishCaseStudy = () => {
      setStep('completed');
      clearStoredSession();
    };

    const handleDownloadSummary = () => {
      // Create a downloadable summary with AI-generated content
      const summaryText = `
Case Study Completion Summary
============================

Case Study: ${caseStudy.title}
Student: ${student.name}
Completed: ${new Date().toLocaleDateString()}

Performance Summary:
- Score: ${earnedPoints}/${totalPossiblePoints} points (${percentageScore}%)
- Questions Answered: ${answeredQuestions}/${totalQuestions} (${completionRate}%)
- Performance Level: ${performance.level}

Learning Milestones (AI-Assessed):
${Object.entries(learningMilestones).map(([key, milestone]: [string, any]) => 
  `- ${milestone.name || DEFAULT_MILESTONES[key]?.name}: ${milestone.achieved ? '✓ Achieved' : '○ In Progress'} (${Math.round(milestone.progress * 100)}%)
  Evidence: ${milestone.evidence || 'No specific evidence recorded'}`
).join('\n')}

Key Insights (AI-Generated):
${keyInsights.map(insight => `- ${insight}`).join('\n')}

Reflection Questions (Personalized):
${reflectionPrompts.map((prompt, index) => `${index + 1}. ${prompt}`).join('\n')}

---
This summary was generated using AI analysis of your responses and performance.
      `.trim();

      const blob = new Blob([summaryText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${caseStudy.title.replace(/[^a-z0-9]/gi, '_')}_Summary.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium mb-4">
                <CheckCircle className="h-4 w-4" />
                Case Study Completed
              </div>
              <h1 className="text-2xl sm:text-3xl font-light text-gray-900 mb-2">
                {caseStudy.title}
              </h1>
              <p className="text-gray-600">
                Congratulations on completing this learning journey!
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="space-y-8">
            {/* Performance Overview */}
            <Card className={`${performance.bg} ${performance.border} border-2`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Award className={`h-6 w-6 ${performance.color}`} />
                  <span className={performance.color}>Performance Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${performance.color} mb-2`}>
                      {percentageScore}%
                    </div>
                    <div className="text-sm text-gray-600">Overall Score</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {earnedPoints} of {totalPossiblePoints} points
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${performance.color} mb-2`}>
                      {completionRate}%
                    </div>
                    <div className="text-sm text-gray-600">Completion Rate</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {answeredQuestions} of {totalQuestions} questions
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${performance.color} mb-2`}>
                      {performance.level}
                    </div>
                    <div className="text-sm text-gray-600">Performance Level</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Based on your responses
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Learning Milestones */}
            {Object.keys(learningMilestones).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                    Learning Milestones
                  </CardTitle>
                  <CardDescription>
                    AI-powered analysis of your progress on key learning objectives
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(learningMilestones).map(([key, milestone]: [string, any]) => (
                      <div key={key} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              milestone.achieved ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
                            }`}>
                              {milestone.achieved ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{milestone.name || DEFAULT_MILESTONES[key]?.name}</div>
                              <div className="text-sm text-gray-600">
                                {milestone.achieved ? 'Achieved' : 'In Progress'} • {Math.round(milestone.progress * 100)}% demonstrated
                              </div>
                            </div>
                          </div>
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${milestone.achieved ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${milestone.progress * 100}%` }}
                            />
                          </div>
                        </div>
                        {milestone.evidence && (
                          <div className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-blue-200">
                            <span className="font-medium text-blue-800">Evidence: </span>
                            {milestone.evidence}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Key Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <MessageSquare className="h-6 w-6 text-purple-600" />
                  Key Insights
                </CardTitle>
                <CardDescription>
                  Highlights from your learning journey
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {keyInsights.map((insight, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                      <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-purple-600 text-sm font-medium">{index + 1}</span>
                      </div>
                      <p className="text-gray-700 leading-relaxed">{insight}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Reflection Questions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <HelpCircle className="h-6 w-6 text-orange-600" />
                  Reflection Questions
                </CardTitle>
                <CardDescription>
                  Personalized questions based on your learning journey
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reflectionPrompts.map((prompt, index) => (
                    <div key={index} className="p-4 bg-orange-50 rounded-lg border-l-4 border-orange-400">
                      <p className="font-medium text-gray-900 mb-2">{prompt}</p>
                      <p className="text-sm text-gray-600">
                        {index === 0 && "Consider the key insights that will stay with you beyond this session."}
                        {index === 1 && "Think about practical applications of what you've learned."}
                        {index === 2 && "Identify areas for continued learning and exploration."}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                onClick={handleDownloadSummary}
                variant="outline"
                className="flex-1 h-12 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <FileText className="w-4 h-4 mr-2" />
                Download Learning Summary
              </Button>
              <Button
                onClick={handleFinishCaseStudy}
                className="flex-1 h-12 text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Finish Case Study
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Completed step
  if (step === 'completed') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-600 mb-4" />
          <h2 className="text-2xl font-light text-gray-900 mb-2">
            Case Study Completed!
          </h2>
          <p className="text-gray-600 mb-6">
            Thank you for participating in "{caseStudy?.title}". Your responses have been submitted for grading.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
            <p className="text-sm text-gray-700">
              Your instructor will review your responses and provide feedback soon.
            </p>
          </div>
          
          {/* Switch User Link */}
          <div className="pt-4 border-t border-gray-100">
            <div className="text-center">
              <button
                onClick={handleSwitchUser}
                className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
                title="Switch to a different student account for testing"
              >
                Switch User
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reading step
  if (!caseStudy) return null;

  // Check if current section is released (any section up to max released is available)
  const maxReleasedSection = session?.releasedSections ? Math.max(...session.releasedSections) : -1;
  const isCurrentSectionReleased = currentSection <= maxReleasedSection;
  
  if (!isCurrentSectionReleased) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <Clock className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-2xl font-light text-gray-900 mb-2">
            Section Not Available
          </h2>
          <p className="text-gray-600 mb-6">
            This section hasn't been released yet. Please wait for your instructor.
          </p>
        </div>
      </div>
    );
  }

  const currentSectionData = caseStudy.sections[currentSection];
  const progress = ((currentSection + 1) / caseStudy.sections.length) * 100;

  // Safety check for currentSectionData
  if (!currentSectionData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading section...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Collapsible Progress Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 transition-all duration-300 ease-in-out">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 transition-all duration-300 ease-in-out"
             style={{ 
               paddingTop: isHeaderCollapsed ? '0.75rem' : '1.5rem',
               paddingBottom: isHeaderCollapsed ? '0.75rem' : '1.5rem'
             }}>
          <div className={`flex flex-col transition-all duration-300 ease-in-out ${
            isHeaderCollapsed ? 'gap-2' : 'gap-4'
          }`}>
            <div className="relative text-center">
              <h1 className={`font-light text-gray-900 mb-2 transition-all duration-300 ease-in-out ${
                isHeaderCollapsed 
                  ? 'text-base sm:text-lg' 
                  : 'text-xl sm:text-2xl'
              }`}>
                {isHeaderCollapsed ? 
                  `${caseStudy.title.length > 40 ? caseStudy.title.slice(0, 40) + '...' : caseStudy.title}` :
                  caseStudy.title
                }
              </h1>
              
              {/* Settings Button - positioned absolutely in top right */}
              <button
                onClick={() => setShowSettingsPanel(true)}
                className="absolute top-0 right-0 p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="Reading Settings"
              >
                <Settings className="h-4 w-4 text-gray-500" />
              </button>
              {!isHeaderCollapsed && (
                <p className="text-sm text-gray-500 transition-opacity duration-300">
                  Section {currentSection + 1} of {caseStudy.sections.length}
                </p>
              )}
              {isHeaderCollapsed && (
                <p className="text-xs text-gray-400">
                  {currentSection + 1}/{caseStudy.sections.length} • {Math.round(progress)}%
                </p>
              )}
            </div>
            <div className={`w-full bg-gray-100 transition-all duration-300 ease-in-out ${
              isHeaderCollapsed ? 'h-0.5' : 'h-px'
            }`}>
              <div 
                className={`bg-gray-900 transition-all duration-500 ease-out ${
                  isHeaderCollapsed ? 'h-0.5' : 'h-px'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* New Section Available Notification */}
      {newSectionAvailable && (
        <div 
          className="sticky z-10 mx-auto max-w-3xl px-4 sm:px-6 mb-4 transition-all duration-300 ease-in-out"
          style={{ 
            top: isHeaderCollapsed ? '4rem' : '6rem'
          }}
        >
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <ArrowRight className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    New Section Available!
                  </p>
                  <p className="text-xs text-blue-700">
                    Section {newSectionIndex + 1} has been released and is ready to read.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleGoToNewSection}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 h-auto"
                >
                  Go to Section {newSectionIndex + 1}
                </Button>
                <button
                  onClick={handleDismissNewSection}
                  className="text-blue-500 hover:text-blue-700 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Reading Container */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 transition-all duration-300 ease-in-out"
           style={{ 
             paddingTop: isHeaderCollapsed ? '1.5rem' : '2rem',
             paddingBottom: '3rem'
           }}>
        
        {/* Section Progress Indicator */}
        {session && caseStudy && caseStudy.sections.length > 1 && (
          <div className="mb-8 sm:mb-12">
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              {caseStudy.sections.map((section, index) => {
                const maxReleasedSection = session?.releasedSections ? Math.max(...session.releasedSections) : -1;
                const isReleased = index <= maxReleasedSection;
                const isCompleted = isSectionCompleted(index);
                const isCurrent = index === currentSection;
                
                const highlightCount = getHighlightCountForSection(index);
                
                return (
                  <button
                    key={section.id}
                    onClick={() => isReleased ? handleNavigateToSection(index) : null}
                    disabled={!isReleased}
                    className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 transition-all duration-200 ${
                      isCurrent
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : isCompleted
                        ? 'border-green-500 bg-green-500 text-white'
                        : isReleased
                        ? 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title={`Section ${index + 1}: ${section.title}${!isReleased ? ' (Not released)' : ''}${highlightCount > 0 ? ` • ${highlightCount} highlight${highlightCount !== 1 ? 's' : ''}` : ''}`}
                  >
                    <span className="text-xs sm:text-sm font-medium">
                      {index + 1}
                    </span>
                    
                    {/* Highlight count badge */}
                    {highlightCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-sm">
                        {highlightCount > 9 ? '9+' : highlightCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-gray-900"></div>
                <span>Current</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full border border-gray-300 bg-white"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                <span>Locked</span>
              </div>
            </div>
          </div>
        )}

        {/* Section Title */}
        <div className="text-center mb-12 sm:mb-16">
          {/* Section Type Indicator */}
          {currentSectionData.type !== 'reading' && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6 ${
              currentSectionData.type === 'discussion' 
                ? 'bg-purple-100 text-purple-800'
                : currentSectionData.type === 'activity'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {currentSectionData.type === 'discussion' && (
                <>
                  <MessageSquare className="h-4 w-4" />
                  Discussion Section
                </>
              )}
              {currentSectionData.type === 'activity' && (
                <>
                  <BookOpen className="h-4 w-4" />
                  Activity Section
                </>
              )}
            </div>
          )}
          
          <h2 className="text-2xl sm:text-3xl font-light text-gray-900 leading-tight">
            {currentSectionData.title}
          </h2>
        </div>

        {/* Reading Content */}
        <div 
          ref={contentRef}
          className={`max-w-none mb-16 sm:mb-20 ${
            currentSectionData.type === 'discussion' 
              ? 'discussion-content' 
              : currentSectionData.type === 'activity'
              ? 'activity-content'
              : 'reading-content-minimal'
          }`}
        >
          {/* Case Study Description - Only show before first section */}
          {currentSection === 0 && caseStudy.description && (
            <div className="mb-12 sm:mb-16">
              <HighlightableContent
                key="case-study-description"
                htmlContent={caseStudy.description}
                className="[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_li]:mb-1"
                onHighlightCreate={(highlight) => {
                  // Handle description highlights with sectionIndex -1
                  handleHighlightCreateForSection(highlight, -1);
                }}
                onHighlightDelete={handleHighlightDelete}
                highlights={highlights.filter(h => h.sectionIndex === -1)}
                allSessionHighlights={allSessionHighlights}
                currentStudentId={student?.id || ''}
                currentSectionIndex={-1}
                showPopularHighlights={showPopularHighlights}
                popularityOpacity={popularityOpacity}
                minimumStudents={minimumStudents}
              />
              {/* Divider between description and first section */}
              <div className="w-full h-px bg-gray-200 my-12 sm:my-16"></div>
            </div>
          )}
          
          {/* Section Content */}
          <HighlightableContent
            key="section-content"
            htmlContent={
              currentSectionData.type === 'discussion' 
                ? currentSectionData.discussionPrompt || ''
                : currentSectionData.type === 'activity'
                ? currentSectionData.activityInstructions || ''
                : currentSectionData.content || ''
            }
            className="[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_li]:mb-1"
            onHighlightCreate={(highlight) => handleHighlightCreateForSection(highlight, currentSection)}
            onHighlightDelete={handleHighlightDelete}
            highlights={highlights.filter(h => h.sectionIndex === currentSection)}
            allSessionHighlights={allSessionHighlights}
            currentStudentId={student?.id || ''}
            currentSectionIndex={currentSection}
            showPopularHighlights={showPopularHighlights}
            popularityOpacity={popularityOpacity}
            minimumStudents={minimumStudents}
          />
        </div>

        {/* Reading Completion Indicator */}
        {!hasReadSection && currentSectionData.questions.length > 0 && (
          <div className="mt-12 p-6 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center gap-3 justify-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
              <p className="text-sm text-gray-600">
                {(() => {
                  switch (currentSectionData.type) {
                    case 'discussion':
                      return 'Continue reading the discussion prompt to proceed to questions';
                    case 'activity':
                      return 'Continue reading the activity instructions to proceed to questions';
                    case 'reading':
                    default:
                      return 'Continue reading to proceed to questions';
                  }
                })()}
              </p>
            </div>
          </div>
        )}

        {/* Empty Section Completion Indicator */}
        {!hasReadSection && currentSectionData.questions.length === 0 && (
          <div className="mt-12 p-6 border border-green-200 rounded-lg bg-green-50">
            <div className="flex items-center gap-3 justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-sm text-green-700">
                {(() => {
                  switch (currentSectionData.type) {
                    case 'discussion':
                      return 'Discussion section complete - no questions to answer';
                    case 'activity':
                      return 'Activity section complete - no questions to answer';
                    case 'reading':
                    default:
                      return 'Reading section complete - no questions to answer';
                  }
                })()}
              </p>
            </div>
          </div>
        )}

        {/* Questions Section - Appears at end */}
        {hasReadSection && currentSectionData.questions.length > 0 && (
          <div className={`transition-all duration-500 ease-in-out ${
            showQuestions ? 'opacity-100' : 'opacity-0'
          }`}>
            {/* Questions Divider */}
            <div className="w-full h-px bg-gray-200 mb-12"></div>
            
            {/* Questions */}
            <div className="space-y-16 sm:space-y-20">
              {currentSectionData.questions.map((question, index) => (
                <div key={question.id} className="relative">
                  {/* Question Header */}
                  <div className="mb-8 sm:mb-10">
                    <div className="flex items-start gap-5 mb-4">
                      <div className="flex-shrink-0 w-10 h-10 border-2 border-gray-900 text-gray-900 rounded-full flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl sm:text-2xl font-light text-gray-900 leading-tight mb-4" style={{ fontFamily: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, 'Times New Roman', serif" }}>
                          {question.text}
                        </h3>
                        <div className="flex items-center gap-4">
                          <p className="text-sm text-gray-600 font-medium">
                            {question.points} {question.points === 1 ? 'point' : 'points'}
                          </p>
                          {isQuestionAnswered(question.id) && (
                            <div className="flex items-center gap-2 text-green-700">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm font-medium">Answered</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="w-full h-px bg-gray-200 mt-6"></div>
                  </div>
                  
                  {!isQuestionAnswered(question.id) && (
                    <div className="ml-15 space-y-6">
                      {(question.type === 'multiple-choice' || question.type === 'multiple-choice-feedback') && question.options ? (
                        <div className="space-y-3">
                          {question.options.map((option, optionIndex) => (
                            <label 
                              key={optionIndex}
                              htmlFor={`${question.id}-option-${optionIndex}`}
                              className="group flex items-start gap-4 py-6 px-6 rounded-lg border border-gray-200 cursor-pointer hover:border-gray-300 hover:bg-gray-50/80 transition-all duration-200 min-h-[60px] sm:min-h-[auto] sm:py-5"
                            >
                              <input
                                type="radio"
                                id={`${question.id}-option-${optionIndex}`}
                                name={question.id}
                                value={optionIndex.toString()}
                                checked={currentResponses[question.id] === optionIndex.toString()}
                                onChange={(e) => handleResponseChange(question.id, e.target.value)}
                                className="h-5 w-5 text-gray-900 focus:ring-2 focus:ring-gray-900 border-gray-300 mt-1 flex-shrink-0"
                              />
                              <span className="text-lg sm:text-xl text-gray-800 leading-relaxed font-normal group-hover:text-gray-900 transition-colors" style={{ fontFamily: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, 'Times New Roman', serif" }}>
                                {option}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                          <Textarea
                            value={currentResponses[question.id] || ''}
                            onChange={(e) => handleResponseChange(question.id, e.target.value)}
                            placeholder="Share your thoughts here..."
                            rows={question.type === 'essay' ? 8 : 5}
                            className="w-full text-lg sm:text-xl leading-relaxed resize-none border-0 focus:ring-0 focus:outline-none p-6 bg-transparent placeholder-gray-400"
                            style={{ fontFamily: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, 'Times New Roman', serif" }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {isQuestionAnswered(question.id) && (
                    <div className="ml-15 space-y-6">
                      {/* Show submitted response */}
                      <div className="border-l-4 border-blue-500 bg-blue-50/30 rounded-r-xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="text-sm font-medium text-blue-800">Your Response</span>
                        </div>
                        <div className="text-lg text-gray-800 leading-relaxed" style={{ fontFamily: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, 'Times New Roman', serif" }}>
                          {(() => {
                            const response = responses.find(r => r.questionId === question.id);
                            return response?.response || 'No response recorded';
                          })()}
                        </div>
                      </div>
                      
                      {/* Show feedback for multiple choice questions */}
                      {question.type === 'multiple-choice' && question.correctAnswer !== undefined && (
                        <div className={`border-l-4 rounded-r-xl p-6 ${
                          (() => {
                            const response = responses.find(r => r.questionId === question.id);
                            const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                            const isCorrect = userAnswer === question.correctAnswer;
                            return isCorrect 
                              ? 'border-green-500 bg-green-50/30' 
                              : 'border-red-500 bg-red-50/30';
                          })()
                        }`}>
                          <div className={`flex items-center gap-4 mb-5 ${
                            (() => {
                              const response = responses.find(r => r.questionId === question.id);
                              const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                              const isCorrect = userAnswer === question.correctAnswer;
                              return isCorrect ? 'text-green-800' : 'text-red-800';
                            })()
                          }`}>
                            {(() => {
                              const response = responses.find(r => r.questionId === question.id);
                              const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                              const isCorrect = userAnswer === question.correctAnswer;
                              return isCorrect ? (
                                <>
                                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  </div>
                                  <span className="font-medium text-green-800">Correct answer</span>
                                </>
                              ) : (
                                <>
                                  <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
                                    <X className="h-4 w-4 text-red-600" />
                                  </div>
                                  <span className="font-medium text-red-800">Incorrect answer</span>
                                </>
                              );
                            })()}
                            
                            <div className="ml-auto flex items-center gap-2 text-sm">
                              <span className="text-gray-600">Points:</span>
                              <span className="font-semibold">
                                {(() => {
                                  const response = responses.find(r => r.questionId === question.id);
                                  const points = response?.points ?? 0;
                                  const maxPoints = response?.maxPoints ?? question.points;
                                  return `${points}/${maxPoints}`;
                                })()}
                              </span>
                            </div>
                          </div>
                          
                          {/* Show correct answer if user was wrong */}
                          {(() => {
                            const response = responses.find(r => r.questionId === question.id);
                            const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                            const isCorrect = userAnswer === question.correctAnswer;
                            
                            if (!isCorrect && question.options && question.correctAnswer !== undefined) {
                              return (
                                <div className="bg-white/70 rounded-lg p-4 border border-red-200/60 space-y-3">
                                  <div>
                                    <p className="text-sm text-gray-600 mb-2 font-medium">The correct answer was:</p>
                                    <p className="text-lg text-gray-800 leading-relaxed" style={{ fontFamily: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, 'Times New Roman', serif" }}>
                                      {question.options[question.correctAnswer]}
                                    </p>
                                  </div>
                                  {question.correctAnswerExplanation && (
                                    <div>
                                      <p className="text-sm text-gray-600 mb-2 font-medium">Explanation:</p>
                                      <p className="text-base text-gray-700 leading-relaxed" style={{ fontFamily: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, 'Times New Roman', serif" }}>
                                        {question.correctAnswerExplanation}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                      
                      {/* Show feedback for multiple choice feedback questions */}
                      {question.type === 'multiple-choice-feedback' && (
                        <div className="border-l-4 border-blue-500 bg-blue-50/30 rounded-r-xl p-6">
                          <div className="flex items-center gap-4 mb-5">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-blue-800 leading-none">
                                Thank you for your feedback!
                              </p>
                              <p className="text-xs text-blue-600/80 mt-1">
                                You earned {question.points} points
                              </p>
                            </div>
                          </div>
                          <div className="bg-white/70 rounded-lg p-4 border border-blue-200/60">
                            <p className="text-sm text-gray-600 mb-2 font-medium">Your response helps us understand different perspectives on this topic.</p>
                            <p className="text-lg text-gray-800 leading-relaxed" style={{ fontFamily: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, 'Times New Roman', serif" }}>
                              All responses are valuable for learning and discussion.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Show points for other question types */}
                      {question.type !== 'multiple-choice' && question.type !== 'multiple-choice-feedback' && (
                        <div className="border-l-4 border-amber-500 bg-amber-50/30 rounded-r-xl p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
                              <Clock className="h-4 w-4 text-amber-600" />
                            </div>
                            <span className="font-medium text-amber-800">
                              Awaiting instructor review
                            </span>
                            <div className="ml-auto flex items-center gap-2 text-sm">
                              <span className="text-gray-600">Worth:</span>
                              <span className="font-semibold">
                                {(() => {
                                  const response = responses.find(r => r.questionId === question.id);
                                  const points = response?.points;
                                  const maxPoints = response?.maxPoints ?? question.points;
                                  return points !== undefined ? `${points}/${maxPoints} points` : `${maxPoints} points`;
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {error && (
                <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-8 space-y-3">
                {/* Submit/Complete Button - Primary Action First */}
                {!isCurrentSectionCompleted() && (
                  <Button
                    onClick={handleSubmitSection}
                    disabled={!canProceed()}
                    loading={submitLoading}
                    className="w-full h-12 text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Section {currentSection + 1}
                  </Button>
                )}

                {/* Section Status for completed sections */}
                {isCurrentSectionCompleted() && (
                  <div className="w-full h-12 flex items-center justify-center bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-sm font-medium text-green-700">
                      ✓ Section {currentSection + 1} Completed
                    </span>
                  </div>
                )}

                {/* Navigation Row - Secondary Actions */}
                <div className="flex gap-3">
                  {canNavigateToPrevious() && (
                    <Button
                      variant="outline"
                      onClick={() => handleNavigateToSection(currentSection - 1)}
                      className="flex-1 h-12 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      ← Previous Section
                    </Button>
                  )}
                  
                  {canNavigateToNext() && (
                    <Button
                      variant="outline"
                      onClick={() => handleNavigateToSection(currentSection + 1)}
                      className="flex-1 h-12 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Next Section →
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation for empty sections */}
        {hasReadSection && currentSectionData.questions.length === 0 && (
          <div className="mt-12 space-y-3">
            {/* Navigation Row */}
            <div className="flex gap-3">
              {canNavigateToPrevious() && (
                <Button
                  variant="outline"
                  onClick={() => handleNavigateToSection(currentSection - 1)}
                  className="flex-1 h-12 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  ← Previous Section
                </Button>
              )}
              
              {canNavigateToNext() && (
                <Button
                  variant="outline"
                  onClick={() => handleNavigateToSection(currentSection + 1)}
                  className="flex-1 h-12 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Next Section →
                </Button>
              )}
            </div>

            {/* Complete Button for final sections or waiting */}
            {!canNavigateToNext() && (
              <>
                {currentSection >= (caseStudy?.sections.length || 0) - 1 ? (
                  <div className="w-full h-12 flex items-center justify-center bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-sm font-medium text-green-700">
                      ✓ Case Study Completed
                    </span>
                  </div>
                ) : (
                  <div className="w-full h-12 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">
                      ⏳ Waiting for Next Section
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Switch User Link - Only show in reading step when student is logged in */}
        {step === 'reading' && student && (
          <div className="mt-12 pt-8 border-t border-gray-100">
            <div className="text-center">
              <button
                onClick={handleSwitchUser}
                className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
                title="Switch to a different student account for testing"
              >
                Switch User
              </button>
            </div>
          </div>
        )}

        {/* Floating Action Button */}
        <FloatingActionButton 
          onClick={() => {
            clearFABNotifications();
            setIsFeaturePanelOpen(true);
          }}
          state={fabState}
          notifications={fabNotifications}
          suggestedTab={suggestedTab}
        />

        {/* Feature Panel */}
        <FeaturePanel
          isOpen={isFeaturePanelOpen}
          onClose={() => setIsFeaturePanelOpen(false)}
          studentId={student?.id}
          sessionId={session?.id}
          caseStudy={caseStudy}
          highlights={highlights}
          currentSectionIndex={currentSection}
          totalSections={caseStudy?.sections.length || 1}
          totalPoints={responses.reduce((total, response) => total + (response.points || 0), 0)}
          maxPoints={caseStudy?.sections.slice(0, currentSection + 1).reduce((total, section) => 
            total + section.questions.reduce((sectionTotal, question) => sectionTotal + question.points, 0), 0
          ) || 0}
          onHighlightJump={handleHighlightJump}
          teacherId={session?.teacherId}
          suggestedTab={suggestedTab}
        />

        {/* Reading Settings Panel for Popular Highlights */}
        <ReadingSettingsPanel
          isOpen={showSettingsPanel}
          onClose={() => setShowSettingsPanel(false)}
          showPopularHighlights={showPopularHighlights}
          onTogglePopularHighlights={setShowPopularHighlights}
          popularityOpacity={popularityOpacity}
          onOpacityChange={setPopularityOpacity}
          minimumStudents={minimumStudents}
          onMinimumStudentsChange={setMinimumStudents}
        />

        {/* Achievement Notifications */}
        {notifications.map((notification) => (
          notification.type === 'modal' ? (
            <AchievementNotification
              key={notification.id}
              achievement={notification.achievement}
              xpAwarded={notification.xpAwarded}
              bonusPoints={notification.bonusPoints}
              onClose={() => closeNotification(notification.id)}
              isVisible={true}
            />
          ) : (
            <AchievementToast
              key={notification.id}
              achievement={notification.achievement}
              xpAwarded={notification.xpAwarded}
              bonusPoints={notification.bonusPoints}
              onClose={() => closeNotification(notification.id)}
              isVisible={true}
            />
          )
        ))}
      </div>
    </div>
  );
}