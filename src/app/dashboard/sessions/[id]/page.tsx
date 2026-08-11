'use client';

import { useState, useEffect, use, useMemo, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { 
  getSession, 
  getSessionsByTeacher,
  getCaseStudy, 
  updateSession,
  updateSessionActivity,
  releaseNextSection,
  getResponsesBySession,
  getStudentsByIds
} from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import ParticipationTrend from '@/components/teacher/ParticipationTrend';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import type { Session, CaseStudy, Response, Student } from '@/types';
import { 
  QrCode, 
  Users, 
  Play, 
  Square, 
  Copy, 
  ExternalLink,
  BarChart,
  Clock,
  CheckCircle,
  ArrowRight,
  AlertCircle,
  HeartPulse,
  ListChecks,
  Lock,
  Unlock,
  MonitorUp,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Repeat2,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { Timestamp } from 'firebase/firestore';
import { endInstructorClassroom, getInstructorClassroomRecords } from '@/lib/firebase/live-classroom';
import {
  countClassroomResponses,
  getSessionParticipationSummary,
  interactionRunSummariesDiffer,
  reconcileInteractionRuns,
} from '@/lib/session-response-summary';
import { getUserFacingError } from '@/lib/user-facing-error';

interface SessionPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function SessionPage({ params }: SessionPageProps) {
  const resolvedParams = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [courseSessions, setCourseSessions] = useState<Session[]>([]);
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [standaloneResponseCount, setStandaloneResponseCount] = useState(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [releasingSection, setReleasingSection] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [appUrl, setAppUrl] = useState(process.env.NEXT_PUBLIC_APP_URL || '');

  const joinUrl = session?.sessionType === 'standalone'
    ? `${appUrl}/join?code=${encodeURIComponent(session.sessionCode)}`
    : `${appUrl}/session/${session?.sessionCode}`;

  useEffect(() => {
    setAppUrl(window.location.origin);
  }, []);

  useEffect(() => {
    const loadSessionData = async () => {
      setLoading(true);
      setError('');
      setCaseStudy(null);
      setResponses([]);
      setStandaloneResponseCount(0);
      setStudents([]);
      try {
        const sessionData = await getSession(resolvedParams.id);
        
        if (!sessionData) {
          setError('We could not find this class session. Return to your class and choose another session.');
          return;
        }

        if (sessionData.teacherId !== user?.uid) {
          setError('This session belongs to another instructor account. Sign in with the account that created it.');
          return;
        }

        let hydratedSession = sessionData;
        if (sessionData.sessionType === 'standalone') {
          try {
            const classroomRecords = await getInstructorClassroomRecords(sessionData.teacherId, sessionData.id);
            const reconciledRuns = reconcileInteractionRuns(
              sessionData.interactionRuns,
              classroomRecords.responses,
              sessionData.interactions,
            );
            const joinedStudents = Array.from(new Set([
              ...(sessionData.studentsJoined || []),
              ...Object.values(classroomRecords.attendance).map((claim) => claim.studentNumber),
            ]));
            hydratedSession = {
              ...sessionData,
              interactionRuns: reconciledRuns,
              studentsJoined: joinedStudents,
            };
            setStandaloneResponseCount(countClassroomResponses(classroomRecords.responses));

            if (
              interactionRunSummariesDiffer(sessionData.interactionRuns, reconciledRuns)
              || joinedStudents.length !== (sessionData.studentsJoined || []).length
            ) {
              await updateSession(sessionData.id, {
                interactionRuns: reconciledRuns,
                studentsJoined: joinedStudents,
              }).catch((summaryError) => {
                console.warn('Recovered classroom summaries could not be saved:', summaryError);
              });
            }
          } catch (classroomError) {
            console.warn('Preserved classroom responses could not be reconciled:', classroomError);
            setStandaloneResponseCount(
              (sessionData.interactionRuns || []).reduce((total, run) => total + run.responseCount, 0),
            );
          }
        }

        setSession(hydratedSession);

        const teacherSessions = await getSessionsByTeacher(sessionData.teacherId);
        const relatedSessions = teacherSessions
          .filter((candidate) => sessionData.courseId
            ? candidate.courseId === sessionData.courseId || (!candidate.courseId && candidate.courseCode === sessionData.courseCode)
            : candidate.courseCode === sessionData.courseCode)
          .sort((a, b) => {
            const timeFor = (candidate: Session) => {
              if (candidate.scheduledFor) {
                const scheduled = new Date(candidate.scheduledFor).getTime();
                if (!Number.isNaN(scheduled)) return scheduled;
              }
              return candidate.createdAt?.toMillis?.() || 0;
            };
            return timeFor(a) - timeFor(b);
          });
        setCourseSessions(relatedSessions);
        
        const caseStudyData = sessionData.caseStudyId ? await getCaseStudy(sessionData.caseStudyId) : null;
        if (caseStudyData) {
          setCaseStudy(caseStudyData);
        }

        // Update session activity when teacher accesses the dashboard
        if (sessionData.active) {
          await updateSessionActivity(sessionData.id);
        }

      } catch (error: unknown) {
        setError(getUserFacingError(error, 'This session could not be opened. Return to the class and try again.'));
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadSessionData();
    }
  }, [resolvedParams.id, user]);

  useEffect(() => {
    if (!session || session.sessionType === 'standalone') return;

    // Ensure session exists in Realtime Database and subscribe to live data
    const { subscribeToLiveSession, subscribeToLiveResponses, ensureLiveSessionExists } = require('@/lib/firebase/realtime');
    
    // Initialize Realtime Database session if it doesn't exist
    ensureLiveSessionExists(session.id, session).catch(console.warn);
    
    const unsubscribeLive = subscribeToLiveSession(session.id, (liveSession: any) => {
      if (liveSession && liveSession.status) {
        // Update session with live status
        setSession(prev => prev ? {
          ...prev,
          active: liveSession.status.active ?? prev.active,
          releasedSections: liveSession.status.releasedSections ?? prev.releasedSections
        } : prev);
      }
    });

    // Load historical responses from Firestore first
    const loadHistoricalResponses = async () => {
      try {
        const firestoreResponses = await getResponsesBySession(session.id);
        setResponses(firestoreResponses);
      } catch (error) {
        console.error('Error loading historical responses:', error);
      }
    };
    
    loadHistoricalResponses();

    // Subscribe to live responses from Realtime Database for new responses
    const unsubscribeResponses = subscribeToLiveResponses(session.id, (liveResponses: any) => {
      // Convert Realtime Database format to our Response format
      const liveResponseArray = Object.entries(liveResponses || {}).map(([id, response]: [string, any]) => ({
        id,
        ...response,
        submittedAt: new Date(response.timestamp)
      }));
      
      // Merge with existing Firestore responses (avoid duplicates by studentId + questionId)
      setResponses(prevResponses => {
        // Create a map of existing responses by studentId + questionId
        const existingResponseMap = new Map(
          prevResponses.map(r => [`${r.studentId}-${r.questionId}`, r])
        );
        
        // Only add live responses that don't already exist
        liveResponseArray.forEach(liveResponse => {
          const key = `${liveResponse.studentId}-${liveResponse.questionId}`;
          if (!existingResponseMap.has(key)) {
            existingResponseMap.set(key, liveResponse);
          }
        });
        
        return Array.from(existingResponseMap.values());
      });
    });

    // Load complete student data from Firestore
    const loadStudentData = async () => {
      try {
        // Get all unique student IDs from multiple sources
        const allStudentIds = new Set<string>();
        session.studentsJoined?.forEach(id => allStudentIds.add(id));
        responses.forEach(response => allStudentIds.add(response.studentId));
        
        if (allStudentIds.size > 0) {
          const firestoreStudents = await getStudentsByIds(Array.from(allStudentIds));
          setStudents(firestoreStudents);
        }
      } catch (error) {
        console.error('Error loading student data:', error);
      }
    };
    
    loadStudentData();

    // Subscribe to student presence for real-time updates
    const { subscribeToStudentPresence } = require('@/lib/firebase/realtime');
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
      unsubscribeLive();
      unsubscribeResponses();
      unsubscribePresence();
    };
  }, [session]);

  // Note: Student data is now managed by the Realtime Database presence subscription above
  // This replaces the old Firestore-based student fetching for better real-time updates

  const handleToggleSession = async () => {
    if (!session) return;

    if (session.sessionType === 'standalone' && !session.active) {
      router.push(`/live?sessionId=${session.id}`);
      return;
    }

    setUpdating(true);
    try {
      const newActiveState = !session.active;

      if (session.sessionType === 'standalone' && !newActiveState) {
        await endInstructorClassroom(session.teacherId, session.id);
      }
      
      // Update Firestore (persistence)
      await updateSession(session.id, {
        active: newActiveState,
        ...(session.active ?
          { endedAt: Timestamp.now() } :
          { startedAt: Timestamp.now(), lastActivityAt: Timestamp.now() }
        )
      });

      // Update Realtime Database (live status)
      if (session.sessionType !== 'standalone') {
        const { updateSessionStatus } = await import('@/lib/firebase/realtime');
        await updateSessionStatus(session.id, {
          active: newActiveState,
          ...(newActiveState ? {} : { endedAt: Date.now() })
        });
      }
      setSession({ ...session, active: newActiveState });
      
    } catch (error: unknown) {
      setError(getUserFacingError(error, 'The session could not be updated. Check your connection and try again.'));
    } finally {
      setUpdating(false);
    }
  };

  const copyJoinUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setToast('Join link copied');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const copySessionCode = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.sessionCode);
      setToast('Session code copied');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleReleaseNextSection = async () => {
    if (!session || !caseStudy) return;
    
    const currentReleasedSection = session.currentReleasedSection ?? 0;
    const nextSectionIndex = currentReleasedSection + 1;
    
    if (nextSectionIndex >= caseStudy.sections.length) {
      setToast('All sections are already available');
      return;
    }

    setReleaseConfirmOpen(true);
  };

  const confirmReleaseNextSection = async () => {
    if (!session || !caseStudy) return;
    const nextSectionIndex = (session.currentReleasedSection ?? 0) + 1;
    if (nextSectionIndex >= caseStudy.sections.length) return;

    setReleasingSection(true);
    try {
      // Use hybrid approach: Update both Firestore (persistence) and Realtime Database (live updates)
      await releaseNextSection(session.id, nextSectionIndex);
      
      // Update Realtime Database for instant student notifications
      const { releaseNextSection: releaseNextSectionRealtime } = require('@/lib/firebase/realtime');
      await releaseNextSectionRealtime(session.id, nextSectionIndex);
      setReleaseConfirmOpen(false);
      setToast(`Section ${nextSectionIndex + 1} is now available`);
    } catch (error: unknown) {
      setError(getUserFacingError(error, 'The next section could not be shared. Check your connection and try again.'));
      setReleaseConfirmOpen(false);
    } finally {
      setReleasingSection(false);
    }
  };

  // Helper function to get student display name
  const getStudentDisplayName = (studentId: string) => {
    // Fix: Check both document ID and readable studentId for student lookup
    const student = students.find(s => s.id === studentId || s.studentId === studentId);
    if (student) {
      return student.name || student.studentId || studentId;
    }
    return studentId; // Fallback to raw ID if student not found
  };

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

  // Memoized student progress calculation that updates when dependencies change
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
    });
  }, [session, caseStudy, responses, students]);

  // Memoized average progress calculation
  const averageProgress = useMemo(() => {
    return studentProgress.length > 0 
      ? Math.round(studentProgress.reduce((sum, s) => sum + s.progress, 0) / studentProgress.length)
      : 0;
  }, [studentProgress]);

  const participationSummary = useMemo(() => (
    session?.sessionType === 'standalone'
      ? getSessionParticipationSummary(session.interactionRuns, session.interactions)
      : null
  ), [session]);
  const displayedAverage = participationSummary?.averageParticipationPercent ?? averageProgress;

  const currentSessionIndex = session ? courseSessions.findIndex((candidate) => candidate.id === session.id) : -1;
  const previousSession = currentSessionIndex > 0 ? courseSessions[currentSessionIndex - 1] : null;
  const nextSession = currentSessionIndex >= 0 && currentSessionIndex < courseSessions.length - 1 ? courseSessions[currentSessionIndex + 1] : null;

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Session could not be opened</h2>
                <p className="text-gray-600 mb-6">{error}</p>
                <Button onClick={() => router.push('/dashboard')}>
                  Back to overview
                </Button>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="instructor-page p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <section className="session-hero mb-8 p-5 sm:p-6 lg:p-7">
            <Link href={session?.courseId ? `/dashboard/classes/${session.courseId}` : '/dashboard/sessions'} className="seminar-focus mb-6 inline-flex min-h-9 items-center gap-2 rounded-lg text-sm font-semibold text-[#697087] transition-colors hover:text-[#5146e5]"><ArrowLeft className="h-4 w-4" /> {session?.courseName || 'All sessions'}</Link>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="seminar-eyebrow mb-2">{session?.courseCode || 'Class session'}</p>
                <h1 className="seminar-display max-w-4xl text-4xl leading-[1.04] text-[#101a38] sm:text-[2.8rem]">{session?.title || caseStudy?.title || 'Class session'}</h1>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#697087]">
                  {session?.courseName && <span>{session.courseName}</span>}
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-xs font-bold tracking-[0.08em] text-[#313950]">{session?.sessionCode}</span>
                  <span aria-hidden="true">·</span>
                  <span className={`inline-flex items-center gap-1.5 font-semibold ${session?.active ? 'text-[#287a43]' : 'text-[#697087]'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${session?.active ? 'bg-[#3aa45a]' : 'bg-[#a5a9b6]'}`} aria-hidden="true" />
                    {session?.active ? 'Live' : 'Prepared'}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {session?.sessionType === 'standalone' && !session?.active && <Link href={`/dashboard/sessions/new?sessionId=${session?.id}`}>
                  <Button variant="outline" className="flex items-center">
                    <ListChecks className="mr-2 h-4 w-4" /> Edit flow
                  </Button>
                </Link>}
                {(session?.sessionType !== 'standalone' || session?.active) && <Link href={session?.sessionType === 'standalone' ? `/live?sessionId=${session?.id}` : `/dashboard/sessions/${session?.id}/presentation`}>
                  <Button
                    variant="outline"
                    className="flex items-center"
                  >
                    {session?.sessionType === 'standalone' ? <MonitorUp className="w-4 h-4 mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                    {session?.sessionType === 'standalone' ? 'Open instructor console' : 'Presentation mode'}
                  </Button>
                </Link>}
                <Button
                  onClick={handleToggleSession}
                  loading={updating}
                  variant={session?.active ? 'destructive' : 'secondary'}
                  className="flex items-center"
                >
                  {session?.active ? (
                    <>
                      <Square className="w-4 h-4 mr-2" />
                      End session
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      {session?.sessionType === 'standalone' ? 'Start class' : 'Start session'}
                    </>
                  )}
                </Button>
              </div>
            </div>
            {courseSessions.length > 1 && (
              <nav aria-label="Move between class sessions" className="mt-7 grid grid-cols-2 gap-2 rounded-2xl border border-[#e3e5ed] bg-[#f8f7fb] p-2.5 sm:grid-cols-[128px_minmax(0,1fr)_128px] sm:items-center">
                {previousSession ? (
                  <Link
                    href={`/dashboard/sessions/${previousSession.id}`}
                    title={`Previous: ${previousSession.title || 'Untitled session'}`}
                    className="seminar-focus group flex min-h-12 items-center justify-center gap-2 rounded-xl border border-transparent px-3 text-sm font-bold text-[#697087] transition hover:border-[#e3e5ed] hover:bg-white hover:text-[#5146e5] sm:justify-start"
                    aria-label={`Previous session: ${previousSession.title || 'Untitled session'}`}
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                    <span>Previous</span>
                  </Link>
                ) : (
                  <span className="flex min-h-12 items-center justify-center gap-2 px-3 text-sm font-bold text-[#b0b4c1] sm:justify-start" aria-hidden="true"><ChevronLeft className="h-4 w-4" /> Previous</span>
                )}

                <label className="relative order-first col-span-2 min-w-0 cursor-pointer rounded-xl border border-[#dcd8ff] bg-white shadow-[0_3px_12px_rgba(16,26,56,0.05)] transition hover:border-[#bdb7ff] sm:order-none sm:col-span-1">
                  <span className="pointer-events-none absolute left-4 top-2 text-[10px] font-bold uppercase tracking-[0.09em] text-[#7b8193]">{currentSessionIndex + 1} of {courseSessions.length} in this class</span>
                  <select
                    aria-label="Choose another session"
                    value={session?.id || ''}
                    onChange={(event) => router.push(`/dashboard/sessions/${event.target.value}`)}
                    className="min-h-14 w-full cursor-pointer appearance-none rounded-xl bg-transparent pb-2 pl-4 pr-11 pt-6 text-sm font-bold text-[#101a38] outline-none focus:border-[#5146e5]"
                  >
                    {courseSessions.map((courseSession, index) => (
                      <option key={courseSession.id} value={courseSession.id}>{index + 1}. {courseSession.title || 'Untitled session'}{courseSession.active ? ' (Live)' : ''}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#697087]" />
                </label>

                {nextSession ? (
                  <Link
                    href={`/dashboard/sessions/${nextSession.id}`}
                    title={`Next: ${nextSession.title || 'Untitled session'}`}
                    className="seminar-focus group flex min-h-12 items-center justify-center gap-2 rounded-xl border border-transparent px-3 text-sm font-bold text-[#697087] transition hover:border-[#e3e5ed] hover:bg-white hover:text-[#5146e5] sm:justify-end"
                    aria-label={`Next session: ${nextSession.title || 'Untitled session'}`}
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ) : (
                  <span className="flex min-h-12 items-center justify-center gap-2 px-3 text-sm font-bold text-[#b0b4c1] sm:justify-end" aria-hidden="true">Next <ChevronRight className="h-4 w-4" /></span>
                )}
              </nav>
            )}
          </section>

          <div className="grid gap-8 2xl:grid-cols-3">
            {/* Main Content */}
            <div className="space-y-6 2xl:col-span-2">
              {/* Stats */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="session-metric-card" style={{ '--metric-tint': '#e9f1ff' } as CSSProperties}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <span className="session-metric-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf3ff] text-[#2f73df]"><Users className="h-5 w-5" /></span>
                      <div className="relative z-10 min-w-0">
                        <p className="text-xs font-semibold text-[#697087]">Students joined</p>
                        <p className="mt-0.5 text-2xl font-bold tabular-nums text-[#101a38]">
                          {session?.studentsJoined?.length || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="session-metric-card" style={{ '--metric-tint': '#e6f6eb' } as CSSProperties}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <span className="session-metric-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf8ee] text-[#29954a]"><BarChart className="h-5 w-5" /></span>
                      <div className="relative z-10 min-w-0">
                        <p className="text-xs font-semibold text-[#697087]">
                          {session?.sessionType === 'standalone' ? 'Avg participation' : 'Avg progress'}
                        </p>
                        <p className="mt-0.5 text-2xl font-bold tabular-nums text-[#101a38]">
                          {displayedAverage}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="session-metric-card" style={{ '--metric-tint': '#eeebff' } as CSSProperties}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <span className="session-metric-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f0efff] text-[#5146e5]"><CheckCircle className="h-5 w-5" /></span>
                      <div className="relative z-10 min-w-0">
                        <p className="text-xs font-semibold text-[#697087]">Responses</p>
                        <p className="mt-0.5 text-2xl font-bold tabular-nums text-[#101a38]">
                          {session?.sessionType === 'standalone' ? standaloneResponseCount : responses.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {session?.sessionType === 'standalone' && participationSummary && participationSummary.interactions.length > 0 && (
                <Card className="session-primary-card">
                  <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <CardTitle>Participation by interaction</CardTitle>
                        <CardDescription>
                          Compared with the busiest activity in this session.
                        </CardDescription>
                      </div>
                      <div className="rounded-full bg-[#f0efff] px-3 py-1.5 text-xs font-semibold text-[#5146e5]">
                        Peak: {participationSummary.benchmarkResponseCount} responses
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ParticipationTrend summary={participationSummary} />
                  </CardContent>
                </Card>
              )}

              {/* Prepared content and interactions */}
              <Card className="session-primary-card">
                <CardHeader>
                  <CardTitle>{session?.sessionType === 'standalone' ? 'Prepared interactions' : 'Section management'}</CardTitle>
                  <CardDescription>
                    {session?.sessionType === 'standalone' ? 'Private until you choose to show one on the classroom display' : 'Control which sections students can access'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {caseStudy ? (
                    <div className="space-y-4">
                      {/* Section Status Overview */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {caseStudy.sections.map((section, index) => {
                          const isReleased = session?.releasedSections?.includes(index) || false;
                          const isCurrent = (session?.currentReleasedSection ?? 0) === index;
                          
                          return (
                            <div 
                              key={section.id}
                              className={`p-3 rounded-lg border-2 transition-colors ${
                                isReleased 
                                  ? isCurrent 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-green-500 bg-green-50'
                                  : 'border-gray-200 bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {isReleased ? (
                                  <Unlock className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Lock className="h-4 w-4 text-gray-400" />
                                )}
                                <span className="text-sm font-medium">
                                  Section {index + 1}
                                </span>
                                {isCurrent && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 truncate">
                                {section.title}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Release Next Section Button */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Next Section to Release:
                          </p>
                          {(() => {
                            const nextIndex = (session?.currentReleasedSection ?? 0) + 1;
                            if (nextIndex >= caseStudy.sections.length) {
                              return (
                                <p className="text-sm text-green-600">
                                  ✓ All sections released
                                </p>
                              );
                            }
                            return (
                              <p className="text-sm text-gray-600">
                                Section {nextIndex + 1}: {caseStudy.sections[nextIndex].title}
                              </p>
                            );
                          })()}
                        </div>
                        
                        {(() => {
                          const nextIndex = (session?.currentReleasedSection ?? 0) + 1;
                          const canReleaseNext = nextIndex < caseStudy.sections.length;
                          
                          return canReleaseNext ? (
                            <Button
                              onClick={handleReleaseNextSection}
                              loading={releasingSection}
                              className="flex items-center gap-2"
                            >
                              <ArrowRight className="h-4 w-4" />
                              Release Section {nextIndex + 1}
                            </Button>
                          ) : (
                            <Button disabled className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              All Released
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  ) : session?.sessionType === 'standalone' ? (
                    <div className="space-y-3">
                      {(session.interactions || []).length > 0 ? (session.interactions || []).map((interaction, index) => (
                        <div key={interaction.id} className="flex items-start gap-4 rounded-xl border border-[#e3e5ed] p-4">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0efff] text-[#5146e5]">
                            {interaction.type === 'pulse' ? <HeartPulse className="h-5 w-5" /> : <ListChecks className="h-5 w-5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#697087]">{index + 1} · {interaction.plannedTime || 'During class'}</span>
                              {interaction.durationMinutes && <span className="text-xs text-[#9298a5]">About {interaction.durationMinutes} min</span>}
                            </div>
                            <h3 className="mt-1 font-semibold text-[#101a38]">{interaction.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-[#697087]">{interaction.prompt}</p>
                            {(() => {
                              const runs = (session.interactionRuns || [])
                                .filter((run) => run.interactionId === interaction.id)
                                .sort((a, b) => a.startedAt - b.startedAt);
                              if (!runs.length) return null;
                              return <div className="mt-3 flex flex-wrap gap-2 border-t border-[#eceef3] pt-3">
                                {runs.map((run, runIndex) => <span key={run.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f3ff] px-2.5 py-1 text-xs text-[#5146e5]">
                                  <Repeat2 className="h-3.5 w-3.5" />
                                  <strong>Round {runIndex + 1}</strong>
                                  <span className="text-[#73798d]">{run.responseCount} {run.responseCount === 1 ? 'response' : 'responses'}</span>
                                  {run.status === 'archived' && <span className="font-semibold text-[#9a6745]">Archived</span>}
                                </span>)}
                              </div>;
                            })()}
                          </div>
                        </div>
                      )) : (
                        <div className="py-6 text-center text-sm text-[#697087]">No prepared interactions. You can still ask the class an unplanned question during the session.</div>
                      )}
                      <div className="flex items-center justify-between border-t border-[#e3e5ed] pt-4">
                        <p className="text-sm text-[#697087]">Your slides remain in their original presentation app.</p>
                        <Link href={`/live?sessionId=${session.id}`}><Button size="sm">Open console</Button></Link>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">Case study information is unavailable.</div>
                  )}
                </CardContent>
              </Card>

              {/* Student Progress */}
              <Card>
                <CardHeader>
                  <CardTitle>{session?.sessionType === 'standalone' ? 'Live participation' : 'Student progress'}</CardTitle>
                  <CardDescription>
                    {session?.sessionType === 'standalone' ? 'Students and responses will appear here when the session begins' : 'Real-time view of student participation'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {studentProgress.length > 0 ? (
                    <div className="space-y-4">
                      {studentProgress.map((student) => (
                        <div key={student.studentId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col">
                              <p className="font-medium text-gray-900">{student.name || student.displayName}</p>
                              {student.actualStudentId && (
                                <p className="text-xs text-gray-500 font-mono">
                                  ID: {student.actualStudentId}
                                </p>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {student.responses} of {student.totalQuestions} questions answered
                            </p>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  student.completed ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${student.progress}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-gray-900 w-10 text-right tabular-nums">
                                {student.progress}%
                              </span>
                              {student.completed && (
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No students have joined yet. Share the class code when you are ready to begin.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <aside className="grid gap-6 md:grid-cols-2 2xl:sticky 2xl:top-6 2xl:block 2xl:self-start 2xl:space-y-6">
              {/* QR Code */}
              <Card className="student-access-card overflow-hidden">
                <CardHeader className="border-b border-[#eceef3] bg-[#faf9ff] pb-5">
                  <CardTitle className="flex items-center gap-2 text-[1.65rem]">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#5146e5] shadow-[0_8px_20px_-14px_rgba(81,70,229,0.7)]"><QrCode className="h-[18px] w-[18px]" /></span>
                    Student access
                  </CardTitle>
                  <CardDescription>Keep this ready when students need to join.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 sm:p-6">
                  <div className="space-y-5">
                    <div className="text-center">
                      <div className="inline-block rounded-2xl border border-[#dfe1ea] bg-white p-4 shadow-[0_14px_34px_-26px_rgba(16,26,56,0.52)]">
                        <QRCode 
                          value={joinUrl}
                          size={176}
                        />
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a90a2]">Class code</p>
                      <div className="student-access-code seminar-display mb-3 mt-1 text-3xl text-[#101a38]">
                        {session?.sessionCode}
                      </div>
                      <Button
                        onClick={copySessionCode}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copy code
                      </Button>
                    </div>

                    <div className="rounded-xl bg-[#f8f7fb] p-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a90a2]">Join at</p>
                      <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate text-xs font-semibold text-[#313950]">
                          {appUrl}/join
                        </code>
                        <Button
                          onClick={copyJoinUrl}
                          variant="outline"
                          size="sm"
                          className="h-9 min-h-9 px-2.5"
                          aria-label="Copy student join link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Session Info */}
              <Card className="session-primary-card">
                <CardHeader>
                  <CardTitle className="text-[1.65rem]">Session details</CardTitle>
                  <CardDescription>The setup students and the classroom display use.</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y divide-[#eceef3] text-sm">
                    <div className="flex items-center justify-between py-3 first:pt-0">
                      <dt className="text-[#697087]">Status</dt>
                      <dd className={`inline-flex items-center gap-1.5 font-semibold ${session?.active ? 'text-[#287a43]' : 'text-[#697087]'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${session?.active ? 'bg-[#3aa45a]' : 'bg-[#a5a9b6]'}`} aria-hidden="true" />
                        {session?.active ? 'Live' : 'Prepared'}
                      </dd>
                    </div>
                    {session?.sessionType === 'standalone' ? (
                      <>
                        <div className="flex justify-between py-3"><dt className="text-[#697087]">Activities</dt><dd className="font-semibold tabular-nums text-[#101a38]">{session.interactions?.length || 0}</dd></div>
                        <div className="flex justify-between py-3"><dt className="text-[#697087]">Slides</dt><dd className="font-semibold text-[#101a38]">Stay separate</dd></div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between py-3"><dt className="text-[#697087]">Sections</dt><dd className="font-semibold tabular-nums text-[#101a38]">{caseStudy?.sections.length}</dd></div>
                        <div className="flex justify-between py-3"><dt className="text-[#697087]">Total points</dt><dd className="font-semibold tabular-nums text-[#101a38]">{caseStudy?.totalPoints}</dd></div>
                      </>
                    )}
                    {session?.createdAt && (
                      <div className="flex items-start justify-between gap-4 py-3 last:pb-0">
                        <dt className="text-[#697087]">Created</dt>
                        <dd className="text-right font-semibold text-[#101a38]">
                          {new Date(session.createdAt.seconds * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            </aside>
          </div>
          {toast && <div className="fixed bottom-5 right-5 z-[80] rounded-xl bg-[#101a38] px-4 py-3 text-sm font-semibold text-white shadow-xl" role="status">{toast}</div>}
          <Dialog
            isOpen={releaseConfirmOpen}
            onClose={() => setReleaseConfirmOpen(false)}
            onConfirm={confirmReleaseNextSection}
            title="Release the next section?"
            message={caseStudy && session ? `Students will immediately see Section ${(session.currentReleasedSection ?? 0) + 2}: ${caseStudy.sections[(session.currentReleasedSection ?? 0) + 1]?.title || ''}.` : 'Students will immediately see the next section.'}
            confirmText="Release section"
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
