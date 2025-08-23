'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { 
  getSession, 
  getCaseStudy, 
  updateSession,
  updateSessionActivity,
  releaseNextSection
} from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
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
  Lock,
  Unlock
} from 'lucide-react';
import QRCode from 'react-qr-code';

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
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [releasingSection, setReleasingSection] = useState(false);
  const [error, setError] = useState('');

  const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL}/session/${session?.sessionCode}`;

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

        // Update session activity when teacher accesses the dashboard
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
    const { subscribeToLiveSession, subscribeToLiveResponses } = require('@/lib/firebase/realtime');
    
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
    const { subscribeToStudentPresence } = require('@/lib/firebase/realtime');
    const unsubscribePresence = subscribeToStudentPresence(session.id, (presenceData) => {
      // Update student list with presence information
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

  const handleToggleSession = async () => {
    if (!session) return;

    setUpdating(true);
    try {
      const newActiveState = !session.active;
      
      // Update Firestore (persistence)
      await updateSession(session.id, {
        active: newActiveState,
        ...(session.active ? 
          { endedAt: new Date() as any } : 
          { startedAt: new Date() as any, lastActivityAt: new Date() as any }
        )
      });

      // Update Realtime Database (live status)
      const { updateSessionStatus } = require('@/lib/firebase/realtime');
      await updateSessionStatus(session.id, {
        active: newActiveState,
        ...(newActiveState ? {} : { endedAt: Date.now() })
      });
      
    } catch (error: any) {
      setError(error.message || 'Failed to update session');
    } finally {
      setUpdating(false);
    }
  };

  const copyJoinUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      // TODO: Show toast notification
      alert('Join URL copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const copySessionCode = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.sessionCode);
      // TODO: Show toast notification
      alert('Session code copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleReleaseNextSection = async () => {
    if (!session || !caseStudy) return;
    
    const currentReleasedSection = session.currentReleasedSection || 0;
    const nextSectionIndex = currentReleasedSection + 1;
    
    if (nextSectionIndex >= caseStudy.sections.length) {
      alert('All sections have already been released!');
      return;
    }
    
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
      setError(error.message || 'Failed to release section');
      alert('Failed to release section. Please try again.');
    } finally {
      setReleasingSection(false);
    }
  };

  // Helper function to get student display name
  const getStudentDisplayName = (studentId: string) => {
    const student = students.find(s => s.studentId === studentId);
    if (student) {
      return student.name || student.studentId;
    }
    return studentId; // Fallback to raw ID if student not found
  };

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
    });
  }, [session, caseStudy, responses, students]);

  // Memoized average progress calculation
  const averageProgress = useMemo(() => {
    return studentProgress.length > 0 
      ? Math.round(studentProgress.reduce((sum, s) => sum + s.progress, 0) / studentProgress.length)
      : 0;
  }, [studentProgress]);

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
                <div className="text-red-500 text-6xl mb-4">⚠️</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Session Error</h2>
                <p className="text-gray-600 mb-6">{error}</p>
                <Button onClick={() => router.push('/dashboard')}>
                  Back to Dashboard
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
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{caseStudy?.title}</h1>
                <p className="text-gray-600 mt-1">
                  Session: {session?.sessionCode} • {session?.active ? 'Active' : 'Inactive'}
                </p>
              </div>
              <div className="flex gap-3">
                <Link href={`/dashboard/sessions/${session?.id}/presentation`}>
                  <Button
                    variant="outline"
                    className="flex items-center"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Presentation Mode
                  </Button>
                </Link>
                <Button
                  onClick={handleToggleSession}
                  loading={updating}
                  variant={session?.active ? 'destructive' : 'secondary'}
                  className="flex items-center"
                >
                  {session?.active ? (
                    <>
                      <Square className="w-4 h-4 mr-2" />
                      End Session
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Resume Session
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Stats */}
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-blue-600" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Students Joined</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {session?.studentsJoined.length || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <BarChart className="h-8 w-8 text-green-600" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Avg Progress</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {averageProgress}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <CheckCircle className="h-8 w-8 text-purple-600" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Responses</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {responses.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Section Release Controls */}
              <Card>
                <CardHeader>
                  <CardTitle>Section Management</CardTitle>
                  <CardDescription>
                    Control which sections students can access
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {caseStudy ? (
                    <div className="space-y-4">
                      {/* Section Status Overview */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {caseStudy.sections.map((section, index) => {
                          const isReleased = session?.releasedSections?.includes(index) || false;
                          const isCurrent = (session?.currentReleasedSection || 0) === index;
                          
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
                            const nextIndex = (session?.currentReleasedSection || 0) + 1;
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
                          const nextIndex = (session?.currentReleasedSection || 0) + 1;
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
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      Loading case study information...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Student Progress */}
              <Card>
                <CardHeader>
                  <CardTitle>Student Progress</CardTitle>
                  <CardDescription>
                    Real-time view of student participation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {studentProgress.length > 0 ? (
                    <div className="space-y-4">
                      {studentProgress.map((student) => (
                        <div key={student.studentId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{student.displayName}</p>
                            <p className="text-sm text-gray-600">
                              {student.responses} of {student.totalQuestions} questions answered
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  student.completed ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${student.progress}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-900 w-12 text-right">
                              {student.progress}%
                            </span>
                            {student.completed && (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No students have joined yet. Share the session code or QR code with your class.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* QR Code */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <QrCode className="w-5 h-5 mr-2" />
                    Student Access
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="bg-white p-4 rounded-lg border inline-block">
                        <QRCode 
                          value={joinUrl}
                          size={150}
                        />
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-bold font-mono text-gray-900 mb-2">
                        {session?.sessionCode}
                      </div>
                      <Button
                        onClick={copySessionCode}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Code
                      </Button>
                    </div>

                    <div className="text-center space-y-2">
                      <p className="text-xs text-gray-600">
                        Students can join at:
                      </p>
                      <div className="flex gap-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1">
                          {process.env.NEXT_PUBLIC_APP_URL}/join
                        </code>
                        <Button
                          onClick={copyJoinUrl}
                          variant="outline"
                          size="sm"
                          className="px-2"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Session Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Session Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-medium ${
                        session?.active ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {session?.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sections:</span>
                      <span className="font-medium">{caseStudy?.sections.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Points:</span>
                      <span className="font-medium">{caseStudy?.totalPoints}</span>
                    </div>
                    {session?.createdAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Created:</span>
                        <span className="font-medium">
                          {new Date(session.createdAt.seconds * 1000).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}