'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { 
  getSession, 
  getCaseStudy, 
  updateSessionActivity,
  releaseNextSection,
  getResponsesBySession,
  getStudentsByIds
} from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import type { Session, CaseStudy, Response, Student } from '@/types';
import { 
  QrCode, 
  Users, 
  Clock,
  CheckCircle,
  Activity,
  BarChart3,
  TrendingUp,
  Monitor,
  Minimize2,
  ArrowRight,
  Lock,
  Unlock,
  Play,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Eye,
  BarChart2,
  BookOpen,
  FileText
} from 'lucide-react';
import QRCode from 'react-qr-code';

interface PresentationPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function PresentationPage({ params }: PresentationPageProps) {
  const resolvedParams = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [releasingSection, setReleasingSection] = useState(false);
  const [currentView, setCurrentView] = useState<'overview' | 'questions' | 'section'>('overview');
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL}/session/${session?.sessionCode}`;

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);



  useEffect(() => {
    const loadSessionData = async () => {
      try {
        const sessionData = await getSession(resolvedParams.id);
        
        if (!sessionData) {
          setError('Session not found');
          return;
        }

        if (sessionData.teacherId !== user?.uid) {
          setError('Access denied');
          return;
        }

        setSession(sessionData);
        
        const caseStudyData = sessionData.caseStudyId ? await getCaseStudy(sessionData.caseStudyId) : null;
        if (caseStudyData) {
          setCaseStudy(caseStudyData);
        }

        // Update session activity when accessing presentation mode
        if (sessionData.active) {
          await updateSessionActivity(sessionData.id);
        }

        // Load initial responses
        const { getResponsesBySession } = require('@/lib/firebase/firestore');
        const initialResponses = await getResponsesBySession(sessionData.id);
        setResponses(initialResponses);

      } catch (error: any) {
        setError(error.message || 'Failed to load session');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadSessionData();
    }
  }, [resolvedParams.id, user]);

  useEffect(() => {
    if (!session?.id) return;

    // Ensure session exists in Realtime Database and subscribe to live data
    const { subscribeToStudentPresence, ensureLiveSessionExists } = require('@/lib/firebase/realtime');
    
    // Initialize Realtime Database session if it doesn't exist
    ensureLiveSessionExists(session.id, session).catch(console.warn);
    
    // We'll use Firestore session subscription instead of Realtime DB for consistency

    // Use Firestore as single source of truth for responses
    const { subscribeToSessionResponses, subscribeToSession } = require('@/lib/firebase/firestore');
    
    // Subscribe to responses with proper cleanup
    const unsubscribeResponses = subscribeToSessionResponses(session.id, (firestoreResponses: any) => {
      console.log('Presentation: Responses updated:', firestoreResponses.length, 'responses');
      setResponses(firestoreResponses);
    });

    // Subscribe to session updates to get real-time section releases
    const unsubscribeSession = subscribeToSession(session.id, (updatedSession: any) => {
      if (updatedSession) {
        console.log('Presentation: Session updated:', updatedSession);
        setSession(updatedSession);
      }
    });

    // Subscribe to student presence for real-time updates
    const unsubscribePresence = subscribeToStudentPresence(session.id, (presenceData: any) => {
      // Update presence information without overriding student data
      if (presenceData) {
        setStudents(prevStudents => {
          return prevStudents.map(student => {
            const presenceInfo = presenceData[student.id];
            if (presenceInfo) {
              return {
                ...student,
                present: presenceInfo.present,
                lastSeen: new Date(presenceInfo.lastSeen)
              };
            }
            return student;
          });
        });
      }
    });

    return () => {
      console.log('Cleaning up subscriptions for session:', session.id);
      unsubscribeResponses();
      unsubscribeSession();
      unsubscribePresence();
    };
  }, [session?.id]); // Only re-subscribe when session ID changes

  // Load student data when session or responses change
  useEffect(() => {
    const loadStudentData = async () => {
      if (!session) return;
      
      try {
        // Get all unique student IDs from multiple sources
        const allStudentIds = new Set<string>();
        session.studentsJoined?.forEach(id => allStudentIds.add(id));
        responses.forEach(response => allStudentIds.add(response.studentId));
        
        if (allStudentIds.size > 0) {
          const firestoreStudents = await getStudentsByIds(Array.from(allStudentIds));
          setStudents(firestoreStudents);
        } else {
          setStudents([]);
        }
      } catch (error) {
        console.error('Error loading student data:', error);
      }
    };
    
    loadStudentData();
  }, [session?.studentsJoined?.length, responses.length]); // Only re-run when counts change

  const handleReleaseNextSection = async () => {
    if (!session || !caseStudy) return;
    
    const currentReleasedSection = session.currentReleasedSection ?? 0;
    const nextSectionIndex = currentReleasedSection + 1;
    
    if (nextSectionIndex >= caseStudy.sections.length) {
      return; // All sections already released
    }
    
    // Add confirmation dialog to prevent accidental releases
    if (!confirm(`Release Section ${nextSectionIndex + 1}: "${caseStudy.sections[nextSectionIndex].title}"?`)) {
      return;
    }
    
    setReleasingSection(true);
    try {
      // Use hybrid approach: Update both Firestore (persistence) and Realtime Database (live updates)
      await releaseNextSection(session.id, nextSectionIndex);
      
      // Update Realtime Database for instant student notifications
      const { releaseNextSection: releaseNextSectionRealtime } = require('@/lib/firebase/realtime');
      await releaseNextSectionRealtime(session.id, nextSectionIndex);
      
      // The session will update via the subscription
    } catch (error: any) {
      console.error('Failed to release section:', error);
      // Could add a toast notification here
    } finally {
      setReleasingSection(false);
    }
  };

  // Calculate session duration
  const sessionDuration = useMemo(() => {
    if (!session?.startedAt && !session?.createdAt) return '0m';
    
    const start = session.startedAt?.toDate?.() || session.createdAt?.toDate?.();
    if (!start) return '0m';
    
    const diffMs = currentTime.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  }, [session, currentTime]);

  // Get all unique students from multiple sources
  const allStudentIds = useMemo(() => {
    const studentIds = new Set<string>();
    
    // Add students from session.studentsJoined
    session?.studentsJoined?.forEach(id => studentIds.add(id));
    
    // Add students who have submitted responses
    responses.forEach(response => studentIds.add(response.studentId));
    
    // Add students from presence data
    students.forEach(student => {
      studentIds.add(student.id);
      if (student.studentId) studentIds.add(student.studentId);
    });
    
    return Array.from(studentIds);
  }, [session, responses, students]);

  // Memoized student progress calculation
  const studentProgress = useMemo(() => {
    if (!session || !caseStudy) return [];

    const studentResponses: Record<string, Response[]> = {};
    responses.forEach(response => {
      if (!studentResponses[response.studentId]) {
        studentResponses[response.studentId] = [];
      }
      studentResponses[response.studentId].push(response);
    });

    // Only count questions from released sections
    const totalQuestions = caseStudy.sections.reduce((total, section, index) => {
      if (session.releasedSections?.includes(index)) {
        return total + section.questions.length;
      }
      return total;
    }, 0);

    // Only show progress for students who have officially joined the session
    const joinedStudentIds = session.studentsJoined || [];
    return joinedStudentIds.map(studentId => {
      const studentResponseList = studentResponses[studentId] || [];
      
      // Filter responses to only count those from released sections
      const releasedResponses = studentResponseList.filter(response => {
        const questionSection = caseStudy.sections.find(section => 
          section.questions.some(q => q.id === response.questionId)
        );
        if (!questionSection) return false;
        const sectionIndex = caseStudy.sections.indexOf(questionSection);
        return session.releasedSections?.includes(sectionIndex) || false;
      });
      
      const progress = totalQuestions > 0 ? (releasedResponses.length / totalQuestions) * 100 : 0;
      // Fix: Check both document ID and readable studentId for student lookup
      const student = students.find(s => s.id === studentId || s.studentId === studentId);
      
      return {
        studentId,
        name: student?.name || null,
        displayName: student?.name || student?.studentId || studentId,
        actualStudentId: student?.studentId,
        responses: releasedResponses.length, // Use filtered responses count
        totalQuestions,
        progress: Math.round(progress),
        completed: progress === 100
      };
    }).sort((a, b) => b.progress - a.progress); // Sort by progress descending
  }, [session, caseStudy, responses, students]);

  // Calculate averages and metrics
  const metrics = useMemo(() => {
    const averageProgress = studentProgress.length > 0 
      ? Math.round(studentProgress.reduce((sum, s) => sum + s.progress, 0) / studentProgress.length)
      : 0;

    const completedStudents = studentProgress.filter(s => s.completed).length;
    const activeStudents = studentProgress.filter(s => s.responses > 0).length;

    return {
      averageProgress,
      completedStudents,
      activeStudents,
      totalStudents: studentProgress.length,
      participationRate: studentProgress.length > 0 
        ? Math.round((activeStudents / studentProgress.length) * 100)
        : 0
    };
  }, [studentProgress]);

  // Organize questions and responses for review
  const questionAnalysis = useMemo(() => {
    if (!caseStudy || !session) return [];

    const allQuestions: Array<{
      questionId: string;
      sectionId: string;
      sectionIndex: number;
      questionIndex: number;
      questionText: string;
      questionType: string;
      questionOptions?: string[];
      correctAnswer?: number;
      maxPoints: number;
      responses: Array<{
        studentId: string;
        studentName: string;
        actualStudentId?: string;
        response: string;
        selectedIndex?: number;
        isCorrect?: boolean;
        points?: number;
        submittedAt: any;
      }>;
      totalResponses: number;
      averageScore?: number;
      correctCount?: number;
      incorrectCount?: number;
      optionDistribution?: Array<{optionIndex: number, optionText: string, count: number, percentage: number}>;
    }> = [];

    caseStudy.sections.forEach((section, sectionIndex) => {
      // Only include questions from released sections
      if (session.releasedSections?.includes(sectionIndex)) {
        section.questions.forEach((question, questionIndex) => {
          const questionResponses = responses
            .filter(r => r.questionId === question.id)
            .map(r => {
              // Fix: Check both document ID and readable studentId for student lookup
              const student = students.find(s => s.id === r.studentId || s.studentId === r.studentId);
              
              // For multiple choice, determine which option was selected
              let selectedIndex: number | undefined;
              let isCorrect: boolean | undefined;
              
              if ((question.type === 'multiple-choice' || question.type === 'multiple-choice-feedback') && question.options && r.response) {
                // Find the index of the selected option by matching the response text
                selectedIndex = question.options.findIndex(option => option.trim() === r.response.trim());
                if (selectedIndex === -1) {
                  // Fallback: try to parse response as index number (in case it's stored as "0", "1", etc.)
                  const parsedIndex = parseInt(r.response);
                  if (!isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < question.options.length) {
                    selectedIndex = parsedIndex;
                  } else {
                    console.warn('Could not match response to option:', r.response, 'Options:', question.options);
                    selectedIndex = undefined;
                  }
                }
              } else if ((question.type === 'multiple-choice' || question.type === 'multiple-choice-feedback') && !r.response) {
                // Handle case where response is undefined/null
                console.warn('Response is undefined for multiple choice question:', question.id, 'Student:', r.studentId);
                selectedIndex = undefined;
              }
              
              // Check if it's correct (moved outside the if blocks)
              if (question.type === 'multiple-choice' && selectedIndex !== undefined && question.correctAnswer !== undefined) {
                isCorrect = selectedIndex === question.correctAnswer;
              } else if (question.type === 'multiple-choice-feedback' && selectedIndex !== undefined) {
                // For feedback questions, all answers are considered correct
                isCorrect = true;
              }
              
              return {
                studentId: r.studentId,
                studentName: student?.name || student?.studentId || r.studentId,
                actualStudentId: student?.studentId,
                response: r.response,
                selectedIndex,
                isCorrect,
                points: r.points,
                submittedAt: r.submittedAt
              };
            })
            .sort((a, b) => {
              const aTime = a.submittedAt?.toDate?.() || new Date(0);
              const bTime = b.submittedAt?.toDate?.() || new Date(0);
              return bTime.getTime() - aTime.getTime(); // newest first
            });

          const scoredResponses = questionResponses.filter(r => typeof r.points === 'number');
          const averageScore = scoredResponses.length > 0 
            ? scoredResponses.reduce((sum, r) => sum + (r.points || 0), 0) / scoredResponses.length
            : undefined;

          // For multiple choice, calculate correct/incorrect counts and option distribution
          let correctCount: number | undefined;
          let incorrectCount: number | undefined;
          let optionDistribution: Array<{optionIndex: number, optionText: string, count: number, percentage: number}> | undefined;
          
          if (question.type === 'multiple-choice' || question.type === 'multiple-choice-feedback') {
            const responsesWithCorrectness = questionResponses.filter(r => typeof r.isCorrect === 'boolean');
            correctCount = responsesWithCorrectness.filter(r => r.isCorrect === true).length;
            incorrectCount = responsesWithCorrectness.filter(r => r.isCorrect === false).length;
            
            // Calculate option distribution
            if (question.options) {
              optionDistribution = question.options.map((option, index) => {
                const count = questionResponses.filter(r => r.selectedIndex === index).length;
                const percentage = questionResponses.length > 0 ? Math.round((count / questionResponses.length) * 100) : 0;
                return {
                  optionIndex: index,
                  optionText: option,
                  count,
                  percentage
                };
              });
            }
          }

          allQuestions.push({
            questionId: question.id,
            sectionId: section.id,
            sectionIndex: sectionIndex + 1,
            questionIndex: questionIndex + 1,
            questionText: question.text,
            questionType: question.type,
            questionOptions: question.options,
            correctAnswer: question.correctAnswer,
            maxPoints: question.points,
            responses: questionResponses,
            totalResponses: questionResponses.length,
            averageScore,
            correctCount,
            incorrectCount,
            optionDistribution
          });
        });
      }
    });

    return allQuestions;
  }, [caseStudy, session, responses, students]);

  // Keyboard shortcuts for presentation mode
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (currentView === 'overview') {
        // Space bar or 'R' key to release next section
        if ((event.code === 'Space' || event.key === 'r' || event.key === 'R') && !releasingSection) {
          event.preventDefault();
          if (session?.active && caseStudy) {
            const nextIndex = (session.currentReleasedSection ?? 0) + 1;
            if (nextIndex < caseStudy.sections.length) {
              handleReleaseNextSection();
            }
          }
        }
      } else if (currentView === 'questions') {
        // Arrow keys for question navigation
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          setSelectedQuestionIndex(prev => Math.max(0, prev - 1));
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          setSelectedQuestionIndex(prev => Math.min(questionAnalysis.length - 1, prev + 1));
        }
      }
      
      // Tab to switch views
      if (event.key === 'Tab') {
        event.preventDefault();
        setCurrentView(prev => {
          if (prev === 'overview') return 'questions';
          if (prev === 'questions') return 'section';
          return 'overview';
        });
      }
      
      // Escape to exit presentation mode
      if (event.key === 'Escape') {
        event.preventDefault();
        router.push(`/dashboard/sessions/${session?.id}`);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [session, caseStudy, releasingSection, currentView, questionAnalysis.length, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-300 text-xl">Loading presentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold text-white mb-2">Session Error</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button 
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 text-white overflow-hidden">
        {/* Compact Header */}
        <div className="px-8 py-4 border-b border-gray-800">
          {/* Top Row: Title, Session Info, and Time */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-6">
              <div>
                <h1 className="text-3xl font-light text-white mb-1">{caseStudy?.title}</h1>
                <div className="flex items-center space-x-4 text-gray-400">
                  <span className="text-lg font-mono">{session?.sessionCode}</span>
                  <div className={`flex items-center space-x-2 ${
                    session?.active ? 'text-green-400' : 'text-gray-500'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      session?.active ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                    }`}></div>
                    <span className="text-sm uppercase tracking-wide">
                      {session?.active ? 'Live' : 'Ended'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-right text-gray-400">
              <div className="text-2xl font-mono">
                {currentTime.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit'
                })}
              </div>
              <div className="text-sm">
                {sessionDuration}
              </div>
            </div>
          </div>

          {/* Bottom Row: View Toggle - Centered */}
          <div className="flex justify-center">
            <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700">
              <button
                onClick={() => setCurrentView('overview')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  currentView === 'overview'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <BarChart2 className="w-4 h-4 mr-2 inline" />
                Overview
              </button>
              <button
                onClick={() => setCurrentView('questions')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  currentView === 'questions'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4 mr-2 inline" />
                Questions ({questionAnalysis.length})
              </button>
              <button
                onClick={() => setCurrentView('section')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  currentView === 'section'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-4 h-4 mr-2 inline" />
                Section
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-8 py-6 pb-20">
          {currentView === 'overview' ? (
            /* Overview Layout */
            <div className="grid grid-cols-12 gap-8">
            
            {/* Left Side - Key Metrics & QR */}
            <div className="col-span-4 space-y-8">
              
              {/* Core Metrics with Visual Enhancement */}
              <div className="space-y-6">
                <div className="text-center p-6 rounded-3xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20">
                  <div className="text-6xl font-extralight text-blue-400 mb-1">
                    {metrics.totalStudents}
                  </div>
                  <div className="text-lg text-gray-400 uppercase tracking-widest">
                    Students Joined
                  </div>
                </div>

                <div className="text-center p-6 rounded-3xl bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20">
                  <div className="text-6xl font-extralight text-green-400 mb-1">
                    {metrics.averageProgress}%
                  </div>
                  <div className="text-lg text-gray-400 uppercase tracking-widest">
                    Average Progress
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-800 rounded-full h-2 mt-4">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${metrics.averageProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* QR Code - Refined */}
              <div className="text-center mt-8">
                <div className="bg-white p-5 rounded-3xl inline-block shadow-2xl border-4 border-gray-700">
                  <QRCode 
                    value={joinUrl}
                    size={180}
                  />
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-mono text-white mb-1 tracking-wider">
                    {session?.sessionCode}
                  </div>
                  <div className="text-xs text-gray-500 uppercase tracking-widest">
                    Scan to Join Session
                  </div>
                </div>
              </div>
            </div>

            {/* Center - Section Management */}
            <div className="col-span-4">
              {caseStudy && (
                <div className="space-y-6">
                  
                  {/* Release Control - More Prominent */}
                  <div className="text-center">
                    {(() => {
                      const nextIndex = (session?.currentReleasedSection ?? 0) + 1;
                      const canReleaseNext = nextIndex < caseStudy.sections.length;
                      
                      return canReleaseNext ? (
                        <div className="space-y-3">
                          <div className="text-sm text-gray-400 uppercase tracking-wide">
                            Next Section Ready
                          </div>
                          <button
                            onClick={handleReleaseNextSection}
                            disabled={releasingSection || !session?.active}
                            className={`px-10 py-5 rounded-2xl font-medium text-xl transition-all ${
                              releasingSection || !session?.active
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-xl hover:shadow-2xl transform hover:scale-105'
                            }`}
                          >
                            {releasingSection ? (
                              <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-3" />
                                Releasing...
                              </>
                            ) : (
                              <>
                                Release Section {nextIndex + 1}
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-sm text-gray-400 uppercase tracking-wide">
                            All Content Released
                          </div>
                          <div className="px-10 py-5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-2xl text-xl">
                            ✓ Complete
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Section Status - Cleaner */}
                  <div className="space-y-3">
                    {caseStudy.sections.map((section, index) => {
                      const isReleased = session?.releasedSections?.includes(index) || false;
                      const isCurrent = (session?.currentReleasedSection ?? 0) === index;
                      const nextToRelease = (session?.currentReleasedSection ?? 0) + 1 === index;
                      
                      return (
                        <div 
                          key={section.id}
                          className={`p-5 rounded-2xl transition-all border ${
                            isReleased 
                              ? isCurrent 
                                ? 'bg-blue-500/15 border-blue-400/40 shadow-blue-500/20 shadow-lg' 
                                : 'bg-green-500/15 border-green-400/40'
                              : nextToRelease
                                ? 'bg-amber-500/15 border-amber-400/40 shadow-amber-500/20 shadow-lg'
                                : 'bg-gray-800/30 border-gray-600/30'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="text-lg font-medium">
                                  Section {index + 1}
                                </span>
                                {isCurrent && (
                                  <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                                    CURRENT
                                  </span>
                                )}
                                {nextToRelease && !isReleased && (
                                  <span className="text-xs bg-amber-500 text-black px-2 py-1 rounded-full">
                                    READY
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-400 truncate">
                                {section.title}
                              </div>
                            </div>
                            <div className={`${
                              isReleased ? 'text-green-400' : nextToRelease ? 'text-amber-400' : 'text-gray-500'
                            }`}>
                              {isReleased ? (
                                <CheckCircle className="w-7 h-7" />
                              ) : nextToRelease ? (
                                <Play className="w-7 h-7" />
                              ) : (
                                <Lock className="w-7 h-7" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side - Student Progress */}
            <div className="col-span-4">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-2xl font-light text-gray-300 mb-2">Live Progress</h3>
                  {studentProgress.length > 0 && (
                    <div className="text-sm text-gray-500">
                      {metrics.activeStudents} of {metrics.totalStudents} students active
                    </div>
                  )}
                </div>
                
                {studentProgress.length > 0 ? (
                  <div className="space-y-3 max-h-[55vh] overflow-y-auto">
                    {studentProgress.slice(0, 10).map((student) => (
                      <div 
                        key={student.studentId} 
                        className={`p-4 rounded-2xl border transition-all ${
                          student.completed 
                            ? 'bg-green-500/15 border-green-400/40' 
                            : student.responses > 0
                              ? 'bg-blue-500/15 border-blue-400/40'
                              : 'bg-gray-800/30 border-gray-600/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="flex flex-col">
                              <span className="font-medium text-white text-base">
                                {student.name || student.displayName}
                              </span>
                              {student.actualStudentId && (
                                <span className="text-xs text-gray-400 font-mono">
                                  ID: {student.actualStudentId}
                                </span>
                              )}
                            </div>
                            {student.completed && (
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            )}
                          </div>
                          <span className="text-lg font-mono text-gray-300">
                            {student.progress}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-700/50 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-1000 ${
                              student.completed 
                                ? 'bg-gradient-to-r from-green-400 to-green-500' 
                                : student.responses > 0
                                  ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                                  : 'bg-gray-600'
                            }`}
                            style={{ width: `${student.progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {student.responses} / {student.totalQuestions} responses
                        </div>
                      </div>
                    ))}
                    {studentProgress.length > 10 && (
                      <div className="text-center text-gray-500 text-sm py-2">
                        +{studentProgress.length - 10} more students
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-5xl mb-3">📱</div>
                    <p className="text-lg">Waiting for students to join...</p>
                    <p className="text-sm text-gray-600 mt-1">Share the QR code or session code</p>
                  </div>
                )}
              </div>
            </div>
            </div>
          ) : currentView === 'questions' ? (
            /* Questions Review Layout */
            <div className="space-y-8">
              {questionAnalysis.length > 0 ? (
                <>
                  {/* Question Navigator */}
                  <div className="flex items-center justify-center space-x-6">
                    <button
                      onClick={() => setSelectedQuestionIndex(Math.max(0, selectedQuestionIndex - 1))}
                      disabled={selectedQuestionIndex === 0}
                      className="p-3 rounded-full bg-gray-800 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    
                    <div className="text-center">
                      <div className="text-sm text-gray-400 uppercase tracking-wide mb-1">
                        Question {selectedQuestionIndex + 1} of {questionAnalysis.length}
                      </div>
                      <div className="text-lg text-white">
                        Section {questionAnalysis[selectedQuestionIndex]?.sectionIndex} • Question {questionAnalysis[selectedQuestionIndex]?.questionIndex}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setSelectedQuestionIndex(Math.min(questionAnalysis.length - 1, selectedQuestionIndex + 1))}
                      disabled={selectedQuestionIndex === questionAnalysis.length - 1}
                      className="p-3 rounded-full bg-gray-800 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Current Question Review */}
                  {questionAnalysis[selectedQuestionIndex] && (
                    <div className="grid grid-cols-12 gap-8">
                      {/* Question Details */}
                      <div className="col-span-5 space-y-6">
                        <div className="bg-gray-800/50 p-8 rounded-3xl border border-gray-700/50">
                          <div className="mb-6">
                            <div className="text-sm text-gray-400 uppercase tracking-wide mb-2">
                              Question • {questionAnalysis[selectedQuestionIndex].questionType.replace('-', ' ')}
                            </div>
                            <div className="text-xl text-white leading-relaxed">
                              {questionAnalysis[selectedQuestionIndex].questionText}
                            </div>
                          </div>


                          
                          <div className={`grid gap-4 pt-6 border-t border-gray-700 ${
                            questionAnalysis[selectedQuestionIndex].questionType === 'multiple-choice' 
                              ? 'grid-cols-5' 
                              : questionAnalysis[selectedQuestionIndex].questionType === 'multiple-choice-feedback'
                                ? 'grid-cols-4'
                                : 'grid-cols-3'
                          }`}>
                            <div className="text-center">
                              <div className="text-2xl font-light text-blue-400">
                                {questionAnalysis[selectedQuestionIndex].totalResponses}
                              </div>
                              <div className="text-sm text-gray-400 uppercase tracking-wide">
                                Responses
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-light text-purple-400">
                                {questionAnalysis[selectedQuestionIndex].maxPoints}
                              </div>
                              <div className="text-sm text-gray-400 uppercase tracking-wide">
                                Max Points
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-light text-green-400">
                                {questionAnalysis[selectedQuestionIndex].averageScore 
                                  ? Math.round(questionAnalysis[selectedQuestionIndex].averageScore! * 10) / 10
                                  : '—'
                                }
                              </div>
                              <div className="text-sm text-gray-400 uppercase tracking-wide">
                                Avg Score
                              </div>
                            </div>
                            
                            {/* Multiple Choice Specific Stats */}
                            {questionAnalysis[selectedQuestionIndex].questionType === 'multiple-choice' && (
                              <>
                                <div className="text-center">
                                  <div className="text-2xl font-light text-green-400">
                                    {questionAnalysis[selectedQuestionIndex].correctCount || 0}
                                  </div>
                                  <div className="text-sm text-gray-400 uppercase tracking-wide">
                                    Correct
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-light text-red-400">
                                    {questionAnalysis[selectedQuestionIndex].incorrectCount || 0}
                                  </div>
                                  <div className="text-sm text-gray-400 uppercase tracking-wide">
                                    Incorrect
                                  </div>
                                </div>
                              </>
                            )}
                            
                            {/* Multiple Choice Feedback Specific Stats */}
                            {questionAnalysis[selectedQuestionIndex].questionType === 'multiple-choice-feedback' && (
                              <div className="text-center">
                                <div className="text-2xl font-light text-blue-400">
                                  {questionAnalysis[selectedQuestionIndex].totalResponses}
                                </div>
                                <div className="text-sm text-gray-400 uppercase tracking-wide">
                                  Responses
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Student Responses */}
                      <div className="col-span-7">
                        <div className="bg-gray-800/30 rounded-3xl border border-gray-700/50 p-6">
                          <div className="mb-6">
                            <h3 className="text-xl font-light text-gray-300 mb-2">
                              {questionAnalysis[selectedQuestionIndex].questionType === 'multiple-choice' 
                                ? 'Response Distribution' 
                                : questionAnalysis[selectedQuestionIndex].questionType === 'multiple-choice-feedback'
                                  ? 'Feedback Responses'
                                  : 'Student Responses'
                              }
                            </h3>
                            <div className="text-sm text-gray-500">
                              {questionAnalysis[selectedQuestionIndex].totalResponses} of {metrics.totalStudents} students responded
                            </div>
                          </div>
                          
                          {/* Multiple Choice Options with Response Distribution */}
                          {(questionAnalysis[selectedQuestionIndex].questionType === 'multiple-choice' || 
                           questionAnalysis[selectedQuestionIndex].questionType === 'multiple-choice-feedback') && 
                           questionAnalysis[selectedQuestionIndex].questionOptions ? (
                            <div className="space-y-4">
                              {questionAnalysis[selectedQuestionIndex].questionOptions!.map((option, index) => {
                                const distribution = questionAnalysis[selectedQuestionIndex].optionDistribution?.find(d => d.optionIndex === index);
                                const isCorrect = questionAnalysis[selectedQuestionIndex].questionType === 'multiple-choice-feedback' 
                                  ? true  // All answers are considered correct for feedback questions
                                  : questionAnalysis[selectedQuestionIndex].correctAnswer === index;
                                const responseCount = distribution?.count || 0;
                                const percentage = distribution?.percentage || 0;
                                
                                return (
                                  <div 
                                    key={index}
                                    className={`p-5 rounded-2xl border transition-all ${
                                      questionAnalysis[selectedQuestionIndex].questionType === 'multiple-choice-feedback'
                                        ? responseCount > 0
                                          ? 'bg-blue-500/15 border-blue-500/40'
                                          : 'bg-gray-800/50 border-gray-700/30'
                                        : isCorrect
                                          ? 'bg-green-500/15 border-green-500/40'
                                          : responseCount > 0
                                            ? 'bg-red-500/10 border-red-500/30'
                                            : 'bg-gray-800/50 border-gray-700/30'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center space-x-3 flex-1">
                                        <span className="text-lg font-mono text-gray-400 w-8">
                                          {String.fromCharCode(65 + index)}.
                                        </span>
                                        <span className={`text-base leading-relaxed ${
                                          isCorrect
                                            ? 'text-green-300 font-medium'
                                            : 'text-gray-300'
                                        }`}>
                                          {option}
                                        </span>
                                        {isCorrect && (
                                          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                                        )}
                                      </div>
                                      
                                      <div className="text-right ml-4">
                                        <div className="text-lg font-semibold text-white">
                                          {responseCount}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          {percentage}%
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Visual progress bar for response distribution */}
                                    <div className="w-full bg-gray-700/50 rounded-full h-3">
                                      <div 
                                        className={`h-3 rounded-full transition-all duration-1000 ${
                                          isCorrect 
                                            ? 'bg-green-400' 
                                            : responseCount > 0
                                              ? 'bg-blue-400'
                                              : 'bg-transparent'
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            /* Text/Essay Question Responses */
                            questionAnalysis[selectedQuestionIndex].responses.length > 0 ? (
                              <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                                {questionAnalysis[selectedQuestionIndex].responses.map((response, index) => (
                                  <div 
                                    key={`${response.studentId}-${index}`}
                                    className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700/30"
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center space-x-3">
                                        <div className="flex flex-col">
                                          <span className="font-medium text-white">
                                            {response.studentName}
                                          </span>
                                          {response.actualStudentId && (
                                            <span className="text-xs text-gray-500 font-mono">
                                              ID: {response.actualStudentId}
                                            </span>
                                          )}
                                        </div>
                                        
                                        {typeof response.points === 'number' && (
                                          <span className="text-sm bg-gray-700 text-gray-300 px-2 py-1 rounded">
                                            {response.points}/{questionAnalysis[selectedQuestionIndex].maxPoints} pts
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {response.submittedAt?.toDate?.()?.toLocaleTimeString([], { 
                                          hour: '2-digit', 
                                          minute: '2-digit' 
                                        }) || 'Unknown time'}
                                      </div>
                                    </div>
                                    
                                    <div className="text-gray-300 leading-relaxed">
                                      {response.response}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-12 text-gray-500">
                                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg">No responses yet</p>
                                <p className="text-sm">Waiting for students to answer this question</p>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-20 text-gray-500">
                  <MessageSquare className="w-16 h-16 mx-auto mb-6 opacity-50" />
                  <p className="text-2xl mb-2">No Questions Available</p>
                  <p className="text-lg">Release sections to see questions and responses</p>
                </div>
              )}
            </div>
          ) : (
            /* Section Display Layout */
            (() => {
              // Get the current section being displayed (use the most recently released section)
              const releasedSections = session?.releasedSections || [];
              // If no sections are released but session is active, default to section 0
              const currentSectionIndex = releasedSections.length > 0 
                ? Math.max(...releasedSections) 
                : (session?.active && caseStudy?.sections && caseStudy.sections.length > 0 ? 0 : -1);
              let currentSection = caseStudy && currentSectionIndex >= 0 ? caseStudy.sections[currentSectionIndex] : null;
              
              // Handle legacy sections without type field
              if (currentSection && !currentSection.type) {
                console.warn('Section missing type field, defaulting to "reading":', currentSection);
                currentSection = { ...currentSection, type: 'reading' as const };
              }
              
              if (!currentSection) {
                return (
                  <div className="text-center py-20 text-gray-500">
                    <BookOpen className="w-16 h-16 mx-auto mb-6 opacity-50" />
                    <p className="text-2xl mb-2">No Section Released</p>
                    <p className="text-lg">Release a section to display it for the class</p>
                  </div>
                );
              }

              return (
                <div className="max-w-6xl mx-auto space-y-8">
                  {/* Section Header */}
                  <div className="text-center mb-12">
                    <div className="text-sm text-gray-400 uppercase tracking-wide mb-2">
                      Section {currentSectionIndex + 1} • {currentSection.type ? currentSection.type.charAt(0).toUpperCase() + currentSection.type.slice(1) : 'Unknown'}
                    </div>
                    <h2 className="text-4xl font-light text-white mb-4">
                      {currentSection.title}
                    </h2>
                  </div>

                  {/* Section Content Based on Type */}
                  {currentSection.type === 'reading' ? (
                    /* Reading Section Display */
                    <div className="grid grid-cols-12 gap-8">
                      {/* Reading Content */}
                      <div className="col-span-7">
                        <div className="bg-gray-800/30 rounded-3xl border border-gray-700/50 p-8">
                          <div className="mb-6">
                            <h3 className="text-xl font-light text-white mb-4 flex items-center" style={{ color: 'white' }}>
                              <FileText className="w-5 h-5 mr-2" />
                              Reading Material
                            </h3>
                          </div>
                          <div className="prose prose-invert prose-lg max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_li]:mb-1 [&_strong]:text-white [&_strong]:font-bold [&_b]:text-white [&_b]:font-bold" style={{ color: 'white' }}>
                            <div 
                              className="text-white leading-relaxed [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_li]:mb-1 [&_strong]:text-white [&_strong]:font-bold [&_b]:text-white [&_b]:font-bold"
                              style={{ color: 'white', fontSize: '1.125rem', lineHeight: '1.7' }}
                              dangerouslySetInnerHTML={{ __html: currentSection.content }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Questions Panel */}
                      <div className="col-span-5">
                        <div className="bg-gray-800/50 rounded-3xl border border-gray-700/50 p-6">
                          <h3 className="text-xl font-light text-white mb-6 flex items-center" style={{ color: 'white' }}>
                            <MessageSquare className="w-5 h-5 mr-2" />
                            Questions ({currentSection.questions.length})
                          </h3>
                          
                          {currentSection.questions.length > 0 ? (
                            <div className="space-y-6">
                              {currentSection.questions.map((question, index) => (
                                <div 
                                  key={question.id}
                                  className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700/30"
                                >
                                  <div className="mb-3">
                                    <div className="text-sm text-gray-400 mb-2">
                                      Question {index + 1} • {question.type.replace('-', ' ')} • {question.points} pts
                                    </div>
                                    <div className="text-base text-white leading-relaxed">
                                      {question.text}
                                    </div>
                                  </div>
                                  
                                  {/* Multiple Choice Options - No answers revealed in Section display */}
                                  {(question.type === 'multiple-choice' || question.type === 'multiple-choice-feedback') && question.options && (
                                    <div className="space-y-2 mt-4">
                                      {question.options.map((option, optionIndex) => (
                                        <div 
                                          key={optionIndex}
                                          className="p-3 rounded-lg border text-sm bg-gray-700/30 border-gray-600/30 text-gray-300"
                                        >
                                          <span className="font-mono text-gray-400 mr-2">
                                            {String.fromCharCode(65 + optionIndex)}.
                                          </span>
                                          {option}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                              <p>No questions for this section</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : currentSection.type === 'discussion' ? (
                    /* Discussion Section Display */
                    <div className="max-w-4xl mx-auto">
                      <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-3xl p-12 text-center">
                        <div className="mb-8">
                          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                          <h3 className="text-2xl font-light text-purple-300 mb-2">
                            Discussion Time
                          </h3>
                          <p className="text-gray-400">
                            Engage students in meaningful conversation
                          </p>
                        </div>
                        
                        {/* Discussion Prompt */}
                        <div className="bg-gray-800/50 rounded-2xl p-8 mb-8">
                          <div className="text-sm text-gray-400 uppercase tracking-wide mb-4">
                            Discussion Prompt
                          </div>
                          <div 
                            className="text-xl text-white leading-relaxed [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_li]:mb-1 [&_strong]:text-white [&_strong]:font-bold [&_b]:text-white [&_b]:font-bold"
                            dangerouslySetInnerHTML={{ 
                              __html: currentSection.discussionPrompt || currentSection.content 
                            }}
                          />
                        </div>
                        
                        {/* Discussion Questions */}
                        {currentSection.questions.length > 0 && (
                          <div className="space-y-4">
                            <div className="text-sm text-gray-400 uppercase tracking-wide mb-4">
                              Discussion Questions
                            </div>
                            {currentSection.questions.map((question, index) => (
                              <div 
                                key={question.id}
                                className="bg-gray-800/30 p-6 rounded-2xl border border-gray-700/30 text-left"
                              >
                                <div className="text-sm text-purple-400 mb-2">
                                  Question {index + 1}
                                </div>
                                <div className="text-lg text-white leading-relaxed">
                                  {question.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : currentSection.type === 'activity' ? (
                    /* Activity Section Display */
                    <div className="max-w-4xl mx-auto">
                      <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-3xl p-12 text-center">
                        <div className="mb-8">
                          <Activity className="w-16 h-16 mx-auto mb-4 text-orange-400" />
                          <h3 className="text-2xl font-light text-orange-300 mb-2">
                            Activity Time
                          </h3>
                          <p className="text-gray-400">
                            Interactive learning activity
                          </p>
                        </div>
                        
                        {/* Activity Instructions */}
                        <div className="bg-gray-800/50 rounded-2xl p-8 mb-8">
                          <div className="text-sm text-gray-400 uppercase tracking-wide mb-4">
                            Activity Instructions
                          </div>
                          <div 
                            className="text-xl text-white leading-relaxed [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_li]:mb-1 [&_strong]:text-white [&_strong]:font-bold [&_b]:text-white [&_b]:font-bold"
                            dangerouslySetInnerHTML={{ 
                              __html: currentSection.activityInstructions || currentSection.content 
                            }}
                          />
                        </div>
                        
                        {/* Activity Questions */}
                        {currentSection.questions.length > 0 && (
                          <div className="space-y-4">
                            <div className="text-sm text-gray-400 uppercase tracking-wide mb-4">
                              Activity Questions
                            </div>
                            {currentSection.questions.map((question, index) => (
                              <div 
                                key={question.id}
                                className="bg-gray-800/30 p-6 rounded-2xl border border-gray-700/30 text-left"
                              >
                                <div className="text-sm text-orange-400 mb-2">
                                  Question {index + 1} • {question.points} pts
                                </div>
                                <div className="text-lg text-white leading-relaxed">
                                  {question.text}
                                </div>
                                
                                {/* Multiple Choice Options for Activities */}
                                {(question.type === 'multiple-choice' || question.type === 'multiple-choice-feedback') && question.options && (
                                  <div className="space-y-2 mt-4">
                                    {question.options.map((option, optionIndex) => (
                                      <div 
                                        key={optionIndex}
                                        className="p-3 rounded-lg bg-gray-700/30 border border-gray-600/30 text-gray-300 text-sm"
                                      >
                                        <span className="font-mono text-gray-400 mr-2">
                                          {String.fromCharCode(65 + optionIndex)}.
                                        </span>
                                        {option}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Unknown Section Type */
                    <div className="text-center py-20 text-gray-500">
                      <BookOpen className="w-16 h-16 mx-auto mb-6 opacity-50" />
                      <p className="text-2xl mb-2">Unknown Section Type</p>
                      <p className="text-lg">Section type: {currentSection.type || 'undefined'}</p>
                      <div className="bg-gray-800/50 rounded-2xl p-8 mt-8 max-w-2xl mx-auto">
                        <div className="text-sm text-gray-400 uppercase tracking-wide mb-4">
                          Section Content
                        </div>
                        <div 
                          className="text-white leading-relaxed [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_li]:mb-1 [&_strong]:text-white [&_strong]:font-bold [&_b]:text-white [&_b]:font-bold"
                          dangerouslySetInnerHTML={{ __html: currentSection.content }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>

        {/* Enhanced Control Bar */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2">
          <div className="bg-gray-800/95 backdrop-blur border border-gray-600/50 rounded-full px-6 py-3 flex items-center space-x-6">
            <button
              onClick={() => router.push(`/dashboard/sessions/${session?.id}`)}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Exit Presentation
            </button>
            
            <div className="h-4 w-px bg-gray-600"></div>
            
            <div className="text-gray-500 text-xs">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">ESC</kbd> to exit • 
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs ml-1">TAB</kbd> to switch views
            </div>
            
            {currentView === 'overview' && session?.active && caseStudy && (() => {
              const nextIndex = (session.currentReleasedSection ?? 0) + 1;
              const canReleaseNext = nextIndex < caseStudy.sections.length;
              
              return canReleaseNext && (
                <div className="text-gray-500 text-xs">
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">SPACE</kbd> to release next section
                </div>
              );
            })()}
            
            {currentView === 'questions' && questionAnalysis.length > 1 && (
              <div className="text-gray-500 text-xs">
                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">←</kbd>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-xs ml-1">→</kbd> navigate questions
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
