'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signInAnonymously } from 'firebase/auth';
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
import type { Session, CaseStudy, Student, Section, Question, Response } from '@/types';
import { User, CheckCircle, X, ArrowRight, ArrowLeft, BookOpen, Clock } from 'lucide-react';

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
  
  const [step, setStep] = useState<'join' | 'reading' | 'review' | 'waiting' | 'completed'>('join');
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
          const caseStudyData = await getCaseStudy(sessionData.caseStudyId);
          const totalSections = caseStudyData?.sections.length || 2;
          sessionData.releasedSections = Array.from({ length: totalSections }, (_, i) => i);
          sessionData.currentReleasedSection = totalSections - 1;
          console.log('LEGACY: Set released sections to:', sessionData.releasedSections);
        }
        
        setSession(sessionData);
        
        console.log('LOAD: Fetching case study data...');
        const caseStudyData = await getCaseStudy(sessionData.caseStudyId);
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
    if (!session || step !== 'waiting') return;

    // Use Realtime Database for instant updates with zero polling
    const { subscribeToSessionStatusStudent } = require('@/lib/firebase/student-realtime');
    
    const unsubscribe = subscribeToSessionStatusStudent(session.id, (status) => {
      if (status) {
        const nextSectionIndex = currentSection + 1;
        const isNextSectionNowReleased = status.releasedSections?.includes(nextSectionIndex) || false;
        
        if (isNextSectionNowReleased) {
          // Update local session state
          setSession(prev => prev ? {
            ...prev,
            releasedSections: status.releasedSections,
            currentSection: status.currentSection
          } : prev);
          setCurrentSection(nextSectionIndex);
          setStep('reading');
        }
      }
    });

    return () => unsubscribe?.();
  }, [session, step, currentSection]);

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
            name: studentInfo.name,
            courseIds: [caseStudy.courseId]
          });
          console.log('JOIN: Student created successfully with ID:', studentId);
          studentData = {
            id: studentId,
            studentId: studentInfo.studentId,
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
        
        if (response.trim() || question.type === 'multiple-choice') {
          // For multiple choice, calculate points automatically
          let points: number | undefined;
          let responseText = response.trim();
          
          if (question.type === 'multiple-choice' && question.correctAnswer !== undefined) {
            const selectedIndex = parseInt(response);
            points = selectedIndex === question.correctAnswer ? question.points : 0;
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

          // Also add to Realtime Database for live teacher viewing
          // Use the same studentId as Firestore for consistency
          try {
            const { addLiveResponseStudent } = require('@/lib/firebase/student-realtime');
            await addLiveResponseStudent(session.id, student.id, question.id, responseText);
          } catch (error) {
            console.warn('Failed to add live response:', error);
          }

          // Only send to AI for assessment if not multiple choice (since MC is auto-graded)
          if (question.type !== 'multiple-choice') {
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
    if (!caseStudy) return false;
    const currentSectionData = caseStudy.sections[currentSection];
    return currentSectionData.questions.every(q => isQuestionAnswered(q.id));
  };

  const handleNavigateToSection = (sectionIndex: number) => {
    const maxReleasedSection = session?.releasedSections ? Math.max(...session.releasedSections) : -1;
    if (sectionIndex <= maxReleasedSection) {
      setCurrentSection(sectionIndex);
    }
  };


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
            name: rememberedStudent.name,
            courseIds: [caseStudy.courseId]
          });
          studentData = {
            id: studentId,
            studentId: rememberedStudent.studentId,
            name: rememberedStudent.name,
            courseIds: [caseStudy.courseId],
            createdAt: new Date() as any
          };
        }

        setStudent(studentData);
        
        console.log('QUICK JOIN: Joining session...');
        await joinSession(session.id, studentData.studentId);
        
        console.log('QUICK JOIN: Getting responses...');
        const existingResponses = await getResponsesByStudent(studentData.id, session.id);
        setResponses(existingResponses);
        
        // Determine starting section for returning students
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
        
        console.log('QUICK JOIN: Setting current section to:', targetSection);
        console.log('QUICK JOIN: Released sections:', explicitlyReleasedSections);
        console.log('QUICK JOIN: Available sections:', allAvailableSections);
        console.log('QUICK JOIN: Completed sections:', Array.from(completedSections));
        setCurrentSection(targetSection);
        
        // Save session to localStorage for persistence
        saveStudentSession(studentData, session);
        
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
                  Enter your details to join this case study session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form id="join-form" onSubmit={handleJoin} className="space-y-4">
                  <Input
                    label="Student ID"
                    value={studentInfo.studentId}
                    onChange={(e) => setStudentInfo(prev => ({ ...prev, studentId: e.target.value }))}
                    placeholder="e.g., STU001"
                    required
                  />
                  
                  <Input
                    label="Full Name"
                    value={studentInfo.name}
                    onChange={(e) => setStudentInfo(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Alex Johnson"
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
        setStep('completed');
        clearStoredSession();
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
          <div className="space-y-6 mb-8">
            {currentSectionData.questions.map((question, index) => (
              <div key={question.id} className="bg-gray-50 rounded-lg p-6">
                <div className="mb-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="flex-shrink-0 w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <label className="text-base font-medium text-gray-900 leading-relaxed">
                      {question.text}
                    </label>
                  </div>
                </div>

                {/* Response and Feedback */}
                <div className="space-y-3">
                  {/* Show submitted response */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-700 mb-2">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Your Response:</span>
                    </div>
                    <div className="text-sm text-blue-800">
                      {(() => {
                        const response = responses.find(r => r.questionId === question.id);
                        return response?.response || 'No response recorded';
                      })()}
                    </div>
                  </div>
                  
                  {/* Show feedback for multiple choice questions */}
                  {question.type === 'multiple-choice' && question.correctAnswer !== undefined && (
                    <div className={`border rounded-xl p-5 transition-all ${
                      (() => {
                        const response = responses.find(r => r.questionId === question.id);
                        const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                        const isCorrect = userAnswer === question.correctAnswer;
                        return isCorrect 
                          ? 'bg-green-50/50 border-green-200/60 shadow-sm' 
                          : 'bg-red-50/50 border-red-200/60 shadow-sm';
                      })()
                    }`}>
                      <div className={`flex items-center gap-3 mb-3 ${
                        (() => {
                          const response = responses.find(r => r.questionId === question.id);
                          const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                          const isCorrect = userAnswer === question.correctAnswer;
                          return isCorrect ? 'text-green-600' : 'text-red-500';
                        })()
                      }`}>
                        {(() => {
                          const response = responses.find(r => r.questionId === question.id);
                          const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                          const isCorrect = userAnswer === question.correctAnswer;
                          return isCorrect ? (
                            <>
                              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </div>
                              <span className="font-medium text-green-700">Correct</span>
                            </>
                          ) : (
                            <>
                              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                                <X className="h-4 w-4 text-red-500" />
                              </div>
                              <span className="font-medium text-red-600">Incorrect</span>
                            </>
                          );
                        })()}
                      </div>
                      
                      {/* Show correct answer if user was wrong */}
                      {(() => {
                        const response = responses.find(r => r.questionId === question.id);
                        const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                        const isCorrect = userAnswer === question.correctAnswer;
                        
                        if (!isCorrect && question.options && question.correctAnswer !== undefined) {
                          return (
                            <div className="bg-white/60 rounded-lg p-3 border border-red-100/60">
                              <p className="text-sm text-gray-600 mb-1">Correct answer:</p>
                              <p className="text-sm font-medium text-gray-800">{question.options[question.correctAnswer]}</p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Show points earned */}
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                        <span className="text-xs text-gray-500">Points earned</span>
                        <span className="text-sm font-medium text-gray-700">
                          {(() => {
                            const response = responses.find(r => r.questionId === question.id);
                            const points = response?.points ?? 0;
                            const maxPoints = response?.maxPoints ?? question.points;
                            return `${points}/${maxPoints}`;
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Show points for other question types */}
                  {question.type !== 'multiple-choice' && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          Awaiting instructor review
                        </span>
                        <span className="text-xs text-gray-500">
                          {(() => {
                            const response = responses.find(r => r.questionId === question.id);
                            const points = response?.points;
                            const maxPoints = response?.maxPoints ?? question.points;
                            return points !== undefined ? `${points}/${maxPoints} points` : `Worth ${maxPoints} points`;
                          })()}
                        </span>
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
                'Complete Case Study'
              ) : (
                (() => {
                  const nextSectionIndex = currentSection + 1;
                  const maxReleasedSection = session?.releasedSections ? Math.max(...session.releasedSections) : -1;
                  const isNextSectionReleased = nextSectionIndex <= maxReleasedSection;
                  
                  return isNextSectionReleased 
                    ? `Continue to Section ${nextSectionIndex + 1}` 
                    : 'Wait for Next Section';
                })()
              )}
            </Button>
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
          
          <div className="text-xs text-gray-400">
            Case Study: {caseStudy?.title}
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
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <p className="text-sm text-gray-700">
              Your instructor will review your responses and provide feedback soon.
            </p>
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
            <div className="text-center">
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
                const isCompleted = section.questions.every(q => isQuestionAnswered(q.id));
                const isCurrent = index === currentSection;
                
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
                    title={`Section ${index + 1}: ${section.title}${!isReleased ? ' (Not released)' : ''}`}
                  >
                    <span className="text-xs sm:text-sm font-medium">
                      {index + 1}
                    </span>
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
          <h2 className="text-2xl sm:text-3xl font-light text-gray-900 leading-tight">
            {currentSectionData.title}
          </h2>
        </div>

        {/* Reading Content */}
        <div 
          ref={contentRef}
          className="reading-content-minimal max-w-none mb-16 sm:mb-20"
        >
          {/* Case Study Description - Only show before first section */}
          {currentSection === 0 && caseStudy.description && (
            <div className="mb-12 sm:mb-16">
              <div dangerouslySetInnerHTML={{ 
                __html: caseStudy.description 
              }} />
              {/* Divider between description and first section */}
              <div className="w-full h-px bg-gray-200 my-12 sm:my-16"></div>
            </div>
          )}
          
          {/* Section Content */}
          <div dangerouslySetInnerHTML={{ 
            __html: currentSectionData.content 
          }} />
        </div>

        {/* Reading Completion Indicator */}
        {!hasReadSection && (
          <div className="mt-12 p-6 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center gap-3 justify-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
              <p className="text-sm text-gray-600">
                Continue reading to proceed to questions
              </p>
            </div>
          </div>
        )}

        {/* Questions Section - Appears at end */}
        {hasReadSection && (
          <div className={`transition-all duration-500 ease-in-out ${
            showQuestions ? 'opacity-100' : 'opacity-0'
          }`}>
            {/* Questions Divider */}
            <div className="w-full h-px bg-gray-200 mb-12"></div>
            
            {/* Questions */}
            <div className="space-y-10 sm:space-y-12">
              {currentSectionData.questions.map((question, index) => (
                <div key={question.id} className="bg-gray-50 border border-gray-100 rounded-lg p-6 sm:p-8">
                  {/* Question Header */}
                  <div className="mb-6">
                    <div className="flex items-start gap-4 mb-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="text-base sm:text-lg text-gray-900 leading-relaxed font-medium block">
                          {question.text}
                        </label>
                        <p className="text-xs sm:text-sm text-gray-500 mt-2">
                          {question.points} points
                        </p>
                      </div>
                      {isQuestionAnswered(question.id) && (
                        <div className="flex-shrink-0">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {!isQuestionAnswered(question.id) && (
                    <div className="space-y-1">
                      {question.type === 'multiple-choice' && question.options ? (
                        <div className="space-y-1">
                          {question.options.map((option, optionIndex) => (
                            <label 
                              key={optionIndex}
                              htmlFor={`${question.id}-option-${optionIndex}`}
                              className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-white hover:border-gray-300 transition-colors"
                            >
                              <input
                                type="radio"
                                id={`${question.id}-option-${optionIndex}`}
                                name={question.id}
                                value={optionIndex.toString()}
                                checked={currentResponses[question.id] === optionIndex.toString()}
                                onChange={(e) => handleResponseChange(question.id, e.target.value)}
                                className="h-5 w-5 text-gray-900 focus:ring-2 focus:ring-gray-900 border-gray-300 mt-0.5 flex-shrink-0"
                              />
                              <span className="text-sm sm:text-base text-gray-700 leading-relaxed">
                                {option}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <Textarea
                            value={currentResponses[question.id] || ''}
                            onChange={(e) => handleResponseChange(question.id, e.target.value)}
                            placeholder="Type your response here..."
                            rows={question.type === 'essay' ? 6 : 4}
                            className="w-full text-sm sm:text-base resize-none border-0 focus:ring-0 focus:outline-none p-0 bg-transparent placeholder-gray-400"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {isQuestionAnswered(question.id) && (
                    <div className="space-y-3">
                      {/* Show submitted response */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-blue-700 mb-2">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Your Response:</span>
                        </div>
                        <div className="text-sm text-blue-800">
                          {(() => {
                            const response = responses.find(r => r.questionId === question.id);
                            return response?.response || 'No response recorded';
                          })()}
                        </div>
                      </div>
                      
                      {/* Show feedback for multiple choice questions */}
                      {question.type === 'multiple-choice' && question.correctAnswer !== undefined && (
                        <div className={`border rounded-xl p-5 transition-all ${
                          (() => {
                            const response = responses.find(r => r.questionId === question.id);
                            const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                            const isCorrect = userAnswer === question.correctAnswer;
                            return isCorrect 
                              ? 'bg-green-50/50 border-green-200/60 shadow-sm' 
                              : 'bg-red-50/50 border-red-200/60 shadow-sm';
                          })()
                        }`}>
                          <div className={`flex items-center gap-3 mb-3 ${
                            (() => {
                              const response = responses.find(r => r.questionId === question.id);
                              const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                              const isCorrect = userAnswer === question.correctAnswer;
                              return isCorrect ? 'text-green-600' : 'text-red-500';
                            })()
                          }`}>
                            {(() => {
                              const response = responses.find(r => r.questionId === question.id);
                              const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                              const isCorrect = userAnswer === question.correctAnswer;
                              return isCorrect ? (
                                <>
                                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  </div>
                                  <span className="font-medium text-green-700">Correct</span>
                                </>
                              ) : (
                                <>
                                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                                    <X className="h-4 w-4 text-red-500" />
                                  </div>
                                  <span className="font-medium text-red-600">Incorrect</span>
                                </>
                              );
                            })()}
                          </div>
                          
                          {/* Show correct answer if user was wrong */}
                          {(() => {
                            const response = responses.find(r => r.questionId === question.id);
                            const userAnswer = question.options?.findIndex(opt => opt === response?.response) ?? -1;
                            const isCorrect = userAnswer === question.correctAnswer;
                            
                            if (!isCorrect && question.options && question.correctAnswer !== undefined) {
                              return (
                                <div className="bg-white/60 rounded-lg p-3 border border-red-100/60">
                                  <p className="text-sm text-gray-600 mb-1">Correct answer:</p>
                                  <p className="text-sm font-medium text-gray-800">{question.options[question.correctAnswer]}</p>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          
                          {/* Show points earned */}
                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                            <span className="text-xs text-gray-500">Points earned</span>
                            <span className="text-sm font-medium text-gray-700">
                              {(() => {
                                const response = responses.find(r => r.questionId === question.id);
                                const points = response?.points ?? 0;
                                const maxPoints = response?.maxPoints ?? question.points;
                                return `${points}/${maxPoints}`;
                              })()}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Show points for other question types */}
                      {question.type !== 'multiple-choice' && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">
                              Awaiting instructor review
                            </span>
                            <span className="text-xs text-gray-500">
                              {(() => {
                                const response = responses.find(r => r.questionId === question.id);
                                const points = response?.points;
                                const maxPoints = response?.maxPoints ?? question.points;
                                return points !== undefined ? `${points}/${maxPoints} points` : `Worth ${maxPoints} points`;
                              })()}
                            </span>
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

                {/* Submit/Complete Button */}
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
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}