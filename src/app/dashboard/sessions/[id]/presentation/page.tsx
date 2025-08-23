'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { 
  getSession, 
  getCaseStudy, 
  updateSessionActivity,
  releaseNextSection
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
  BarChart2
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
  const [currentView, setCurrentView] = useState<'overview' | 'questions'>('overview');
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
        
        const caseStudyData = await getCaseStudy(sessionData.caseStudyId);
        if (caseStudyData) {
          setCaseStudy(caseStudyData);
        }

        // Update session activity when accessing presentation mode
        if (sessionData.active) {
          await updateSessionActivity(sessionData.id);
        }

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
    if (!session) return;

    // Subscribe to live session data from Realtime Database
    const { subscribeToLiveSession, subscribeToLiveResponses, subscribeToStudentPresence } = require('@/lib/firebase/realtime');
    
    const unsubscribeLive = subscribeToLiveSession(session.id, (liveSession) => {
      if (liveSession) {
        // Update session with live status
        setSession(prev => prev ? {
          ...prev,
          active: liveSession.status.active,
          releasedSections: liveSession.status.releasedSections,
          currentSection: liveSession.status.currentSection
        } : prev);
      }
    });

    // Subscribe to live responses from Realtime Database
    const unsubscribeResponses = subscribeToLiveResponses(session.id, (liveResponses) => {
      // Convert Realtime Database format to our Response format
      const liveResponseArray = Object.entries(liveResponses || {}).map(([id, response]) => ({
        id,
        ...response,
        submittedAt: new Date(response.timestamp)
      }));
      
      // For now, just show live responses. In a full implementation, you might want to 
      // merge with historical responses from Firestore if needed
      setResponses(liveResponseArray);
    });

    // Subscribe to student presence
    const unsubscribePresence = subscribeToStudentPresence(session.id, (presenceData) => {
      if (presenceData) {
        const presentStudents = Object.entries(presenceData).map(([studentId, data]) => ({
          id: studentId,
          studentId,
          name: data.name,
          present: data.present,
          lastSeen: new Date(data.lastSeen)
        }));
        setStudents(presentStudents);
      }
    });

    return () => {
      unsubscribeLive();
      unsubscribeResponses();
      unsubscribePresence();
    };
  }, [session]);

  // Note: Student data is now managed by the Realtime Database presence subscription above
  // This replaces the old Firestore-based student fetching for better real-time updates

  const handleReleaseNextSection = async () => {
    if (!session || !caseStudy) return;
    
    const currentReleasedSection = session.currentReleasedSection || -1;
    const nextSectionIndex = currentReleasedSection + 1;
    
    if (nextSectionIndex >= caseStudy.sections.length) {
      return; // All sections already released
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

    return session.studentsJoined.map(studentId => {
      const studentResponseList = studentResponses[studentId] || [];
      const progress = totalQuestions > 0 ? (studentResponseList.length / totalQuestions) * 100 : 0;
      const student = students.find(s => s.studentId === studentId);
      
      return {
        studentId,
        name: student?.name || null,
        displayName: student?.name || student?.studentId || studentId,
        responses: studentResponseList.length,
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
              const student = students.find(s => s.studentId === r.studentId);
              
              // For multiple choice, determine which option was selected
              let selectedIndex: number | undefined;
              let isCorrect: boolean | undefined;
              
              if (question.type === 'multiple-choice' && question.options) {
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
                
                // Check if it's correct
                if (selectedIndex !== undefined && question.correctAnswer !== undefined) {
                  isCorrect = selectedIndex === question.correctAnswer;
                }
              }
              
              return {
                studentId: r.studentId,
                studentName: student?.name || student?.studentId || r.studentId,
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
          
          if (question.type === 'multiple-choice') {
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
            const nextIndex = (session.currentReleasedSection || -1) + 1;
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
        setCurrentView(prev => prev === 'overview' ? 'questions' : 'overview');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [session, caseStudy, releasingSection, currentView, questionAnalysis.length]);

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
        {/* Header with View Toggle */}
        <div className="flex items-center justify-between px-12 py-8">
          <div className="flex items-center space-x-8">
            <div>
              <h1 className="text-5xl font-light text-white mb-2">{caseStudy?.title}</h1>
              <div className="flex items-center space-x-6 text-gray-400">
                <span className="text-xl font-mono">{session?.sessionCode}</span>
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

            {/* View Toggle */}
            <div className="flex bg-gray-800 rounded-2xl p-1 border border-gray-700">
              <button
                onClick={() => setCurrentView('overview')}
                className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${
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
                className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${
                  currentView === 'questions'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4 mr-2 inline" />
                Questions ({questionAnalysis.length})
              </button>
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

        {/* Main Content */}
        <div className="px-12 pb-20">
          {currentView === 'overview' ? (
            /* Overview Layout */
            <div className="grid grid-cols-12 gap-12">
            
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
                      const nextIndex = (session?.currentReleasedSection || -1) + 1;
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
                      const isCurrent = (session?.currentReleasedSection || -1) === index;
                      const nextToRelease = (session?.currentReleasedSection || -1) + 1 === index;
                      
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
                            <span className="font-medium text-white text-base">
                              {student.displayName}
                            </span>
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
          ) : (
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
                                : 'Student Responses'
                              }
                            </h3>
                            <div className="text-sm text-gray-500">
                              {questionAnalysis[selectedQuestionIndex].totalResponses} of {metrics.totalStudents} students responded
                            </div>
                          </div>
                          
                          {/* Multiple Choice Options with Response Distribution */}
                          {questionAnalysis[selectedQuestionIndex].questionType === 'multiple-choice' && 
                           questionAnalysis[selectedQuestionIndex].questionOptions ? (
                            <div className="space-y-4">
                              {questionAnalysis[selectedQuestionIndex].questionOptions!.map((option, index) => {
                                const distribution = questionAnalysis[selectedQuestionIndex].optionDistribution?.find(d => d.optionIndex === index);
                                const isCorrect = questionAnalysis[selectedQuestionIndex].correctAnswer === index;
                                const responseCount = distribution?.count || 0;
                                const percentage = distribution?.percentage || 0;
                                
                                return (
                                  <div 
                                    key={index}
                                    className={`p-5 rounded-2xl border transition-all ${
                                      isCorrect
                                        ? 'bg-green-500/15 border-green-500/40'
                                        : responseCount > 0
                                          ? 'bg-blue-500/10 border-blue-500/30'
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
                                        <span className="font-medium text-white">
                                          {response.studentName}
                                        </span>
                                        
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
              Press <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">TAB</kbd> to switch views
            </div>
            
            {currentView === 'overview' && session?.active && caseStudy && (() => {
              const nextIndex = (session.currentReleasedSection || -1) + 1;
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
