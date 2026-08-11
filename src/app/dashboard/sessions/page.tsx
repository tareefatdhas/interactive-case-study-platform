'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createSession, generateSessionCode, getCaseStudiesByTeacher, getSessionsByTeacher, checkAndTimeoutInactiveSessions, endSession, deleteSession, updateSession } from '@/lib/firebase/firestore';
import { deleteInstructorClassroomData, endInstructorClassroom } from '@/lib/firebase/live-classroom';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import type { CaseStudy, Session } from '@/types';
import { Play, Plus, Users, Clock, QrCode, Trash2, StopCircle, Calendar, Activity, BarChart3, Eye, Filter, SortDesc, Monitor, Copy } from 'lucide-react';

export default function SessionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'students'>('newest');
  const [pendingAction, setPendingAction] = useState<{ type: 'end' | 'delete' | 'end-all'; sessionId?: string } | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        try {
          // Reconcile stale live flags before showing session status.
          const [studies] = await Promise.all([
            getCaseStudiesByTeacher(user.uid, true), // Include archived for session references
            checkAndTimeoutInactiveSessions(user.uid),
          ]);
          const sessionsData = await getSessionsByTeacher(user.uid);
          
          setCaseStudies(studies);
          setSessions(sessionsData);
        } catch (error) {
          console.error('Error loading data:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadData();
  }, [user]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSessionDuration = (session: Session) => {
    const start = session.startedAt?.toDate?.() || session.createdAt?.toDate?.();
    const end = session.endedAt?.toDate?.() || (session.active ? new Date() : null);
    
    if (!start || !end) return 'Unknown';
    
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  };

  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  // Create a mapping of case study IDs to titles for efficient lookup
  const caseStudyTitles = useMemo(() => {
    const mapping: Record<string, string> = {};
    caseStudies.forEach(cs => {
      mapping[cs.id] = cs.title;
    });
    return mapping;
  }, [caseStudies]);

  // Add periodic refresh for real-time session updates
  useEffect(() => {
    if (!user) return;

    const refreshSessions = async () => {
      try {
        // Check for inactive sessions and timeout if needed
        await checkAndTimeoutInactiveSessions(user.uid);
        
        // Then refresh the sessions list
        const sessionsData = await getSessionsByTeacher(user.uid);
        setSessions(sessionsData);
      } catch (error) {
        console.error('Error refreshing sessions:', error);
      }
    };

    // Refresh every 10 seconds for real-time updates and timeout checking
    const interval = setInterval(refreshSessions, 10000);
    
    return () => clearInterval(interval);
  }, [user]);



  const handleEndSession = async (sessionId: string) => {
    setPendingAction({ type: 'end', sessionId });
  };

  const confirmEndSession = async (sessionId: string) => {

    setActionLoading(prev => ({ ...prev, [sessionId]: true }));
    try {
      const session = sessions.find((candidate) => candidate.id === sessionId);
      if (session?.sessionType === 'standalone') {
        await endInstructorClassroom(session.teacherId, session.id);
      }
      await endSession(sessionId);
      // Refresh sessions list
      if (user) {
        const sessionsData = await getSessionsByTeacher(user.uid);
        setSessions(sessionsData);
      }
    } catch (error) {
      console.error('Error ending session:', error);
      setToast('The session could not be ended. Check your connection and try again.');
    } finally {
      setActionLoading(prev => ({ ...prev, [sessionId]: false }));
      setPendingAction(null);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setPendingAction({ type: 'delete', sessionId });
  };

  const confirmDeleteSession = async (sessionId: string) => {

    setActionLoading(prev => ({ ...prev, [sessionId]: true }));
    try {
      const session = sessions.find((candidate) => candidate.id === sessionId);
      if (session?.sessionType === 'standalone') {
        await deleteInstructorClassroomData(session.teacherId, session.id);
      }
      await deleteSession(sessionId);
      // Refresh sessions list
      if (user) {
        const sessionsData = await getSessionsByTeacher(user.uid);
        setSessions(sessionsData);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      setToast('The session could not be deleted. Try again.');
    } finally {
      setActionLoading(prev => ({ ...prev, [sessionId]: false }));
      setPendingAction(null);
    }
  };

  const handleDuplicateSession = async (session: Session) => {
    if (!user) return;
    setActionLoading(prev => ({ ...prev, [session.id]: true }));
    try {
      const duplicateId = await createSession({
        sessionCode: generateSessionCode(),
        sessionType: session.sessionType,
        caseStudyId: session.caseStudyId,
        caseStudyTitle: session.caseStudyTitle,
        teacherId: user.uid,
        courseId: session.courseId,
        courseCode: session.courseCode,
        courseName: session.courseName,
        presentationMode: session.presentationMode || 'external',
        interactions: (session.interactions || []).map((interaction, index) => ({
          ...interaction,
          id: `${interaction.type}-${Date.now()}-${index}`,
        })),
        active: false,
        studentsJoined: [],
        releasedSections: [],
        currentReleasedSection: -1,
        title: `${session.title || session.caseStudyTitle || 'Class session'} copy`,
        description: session.description,
        sections: session.sections,
      });

      router.push(`/dashboard/sessions/${duplicateId}`);
    } catch (duplicateError) {
      console.error('Could not duplicate session:', duplicateError);
      setToast('The session could not be copied. Try again.');
    } finally {
      setActionLoading(prev => ({ ...prev, [session.id]: false }));
    }
  };

  const getSessionState = (session: Session) => {
    if (session.active) return { label: 'Live', className: 'bg-[#edf8ef] text-[#28733a]' };
    if (session.endedAt) return { label: 'Completed', className: 'bg-[#f1f2f6] text-[#5e667a]' };
    return { label: 'Ready', className: 'bg-[#f0efff] text-[#5146e5]' };
  };

  const handleEndAllActiveSessions = async () => {
    const activeSessions = sessions.filter(s => s.active);
    if (activeSessions.length === 0) {
      setToast('There are no live sessions to end.');
      return;
    }

    setPendingAction({ type: 'end-all' });
  };

  const confirmEndAllActiveSessions = async () => {
    const activeSessions = sessions.filter(s => s.active);
    if (activeSessions.length === 0) return;

    setBulkActionLoading(true);
    try {
      await Promise.all(activeSessions.map(async (session) => {
        if (session.sessionType === 'standalone') {
          await endInstructorClassroom(session.teacherId, session.id);
        }
        await endSession(session.id);
      }));
      // Refresh sessions list
      if (user) {
        const sessionsData = await getSessionsByTeacher(user.uid);
        setSessions(sessionsData);
      }
    } catch (error) {
      console.error('Error ending sessions:', error);
      setToast('Some sessions could not be ended. Check your connection and try again.');
    } finally {
      setBulkActionLoading(false);
      setPendingAction(null);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'end' && pendingAction.sessionId) return confirmEndSession(pendingAction.sessionId);
    if (pendingAction.type === 'delete' && pendingAction.sessionId) return confirmDeleteSession(pendingAction.sessionId);
    if (pendingAction.type === 'end-all') return confirmEndAllActiveSessions();
  };

  const pendingDialog = pendingAction?.type === 'delete'
    ? { title: 'Delete this session?', message: 'This permanently removes the session and its live classroom data. This cannot be undone.', confirmText: 'Delete session', destructive: true }
    : pendingAction?.type === 'end-all'
      ? { title: `End ${sessions.filter((session) => session.active).length} live sessions?`, message: 'Students will no longer be able to join or submit responses in any of these sessions.', confirmText: 'End all sessions', destructive: true }
      : { title: 'End this session?', message: 'Students will no longer be able to join or submit responses. You can still review the session afterward.', confirmText: 'End session', destructive: false };

  // Get session counts for display
  const activeSessions = sessions.filter(s => s.active);
  const endedSessions = sessions.filter(s => !s.active);

  // Filter and sort sessions
  const filteredAndSortedSessions = useMemo(() => {
    let filtered = sessions;
    
    // Apply filter
    if (filter === 'active') {
      filtered = sessions.filter(s => s.active);
    } else if (filter === 'ended') {
      filtered = sessions.filter(s => !s.active);
    }
    
    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          const aTime = a.createdAt?.toDate?.() || new Date(0);
          const bTime = b.createdAt?.toDate?.() || new Date(0);
          return bTime.getTime() - aTime.getTime();
        case 'oldest':
          const aTimeOld = a.createdAt?.toDate?.() || new Date(0);
          const bTimeOld = b.createdAt?.toDate?.() || new Date(0);
          return aTimeOld.getTime() - bTimeOld.getTime();
        case 'students':
          return (b.studentsJoined?.length || 0) - (a.studentsJoined?.length || 0);
        default:
          return 0;
      }
    });
  }, [sessions, filter, sortBy]);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <p className="seminar-eyebrow mb-2">Classroom control</p>
              <h1 className="seminar-display text-4xl text-[#101a38]">Live sessions</h1>
              <p className="text-gray-600 mt-1">
                Start a class, open its projector view, or review an earlier session.
                {sessions.length > 0 && (
                  <span className="ml-2 text-sm">
                    ({activeSessions.length} active, {endedSessions.length} ended)
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center space-x-3">

              {activeSessions.length > 1 && (
                <Button 
                  variant="outline"
                  onClick={handleEndAllActiveSessions}
                  loading={bulkActionLoading}
                  disabled={bulkActionLoading}
                >
                  <StopCircle className="w-4 h-4 mr-2" />
                  End All Active ({activeSessions.length})
                </Button>
              )}
              <Link href="/dashboard/sessions/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Prepare session
                </Button>
              </Link>
            </div>
          </div>

          {/* Filter and Sort Controls */}
          {sessions.length > 0 && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Filter className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Filter:</span>
                      <div className="flex space-x-1">
                        {[
                          { key: 'all', label: 'All', count: sessions.length },
                          { key: 'active', label: 'Active', count: activeSessions.length },
                          { key: 'ended', label: 'Ended', count: endedSessions.length }
                        ].map(({ key, label, count }) => (
                          <button
                            key={key}
                            onClick={() => setFilter(key as any)}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                              filter === key
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {label} ({count})
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <SortDesc className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Sort by:</span>
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-1 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="students">Most Students</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Stats */}
          {sessions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <QrCode className="h-8 w-8 text-gray-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                      <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Activity className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Active Sessions</p>
                      <p className="text-2xl font-bold text-gray-900">{activeSessions.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-gray-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Students</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {sessions.reduce((total, s) => total + (s.studentsJoined?.length || 0), 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-gray-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(() => {
                          const durations = sessions.map(s => {
                            const start = s.startedAt?.toDate?.() || s.createdAt?.toDate?.();
                            const end = s.endedAt?.toDate?.() || (s.active ? new Date() : null);
                            if (!start || !end) return 0;
                            return end.getTime() - start.getTime();
                          }).filter(d => d > 0);
                          
                          if (durations.length === 0) return '0m';
                          const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
                          const avgMins = Math.floor(avgMs / (1000 * 60));
                          return avgMins > 60 ? `${Math.floor(avgMins / 60)}h` : `${avgMins}m`;
                        })()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-3 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAndSortedSessions.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <QrCode className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No sessions yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Prepare a pulse, poll, quiz, or short response for the class you teach next.
                </p>
                <Link href="/dashboard/classes"><Button><Plus className="w-4 h-4 mr-2" /> Choose a class</Button></Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {filteredAndSortedSessions.map((session) => (
                <Card key={session.id} className="hover:shadow-md transition-shadow duration-200">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="flex items-center space-x-3 mb-3">
                          <span className="text-lg font-semibold text-gray-900 truncate">
                            {session.title || session.caseStudyTitle || caseStudyTitles[session.caseStudyId || ''] || 'Untitled session'}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSessionState(session).className}`}>
                            {getSessionState(session).label}
                          </span>
                        </CardTitle>
                        
                        {/* Session Code and Quick Info */}
                        <div className="flex items-center space-x-4 mb-4">
                          <div className="flex items-center bg-gray-50 px-3 py-1 rounded-md border border-gray-200">
                            <QrCode className="w-4 h-4 mr-2 text-gray-600" />
                            <span className="font-mono text-sm font-medium text-gray-900">{session.sessionCode}</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Clock className="w-4 h-4 mr-1" />
                            Duration: {getSessionDuration(session)}
                          </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center space-x-3">
                            <Users className="w-5 h-5 text-gray-500" />
                            <div>
                              <p className="font-medium text-gray-900">{session.studentsJoined?.length || 0}</p>
                              <p className="text-gray-500">Students</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <Calendar className="w-5 h-5 text-gray-500" />
                            <div>
                              <p className="font-medium text-gray-900">{formatDate(session.createdAt)}</p>
                              <p className="text-gray-500">{getRelativeTime(session.createdAt)}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            <Clock className="w-5 h-5 text-gray-500" />
                            <div>
                              <p className="font-medium text-gray-900">{formatTime(session.createdAt)}</p>
                              <p className="text-gray-500">{session.active ? 'Running now' : session.endedAt ? `Completed ${getRelativeTime(session.endedAt)}` : `${session.interactions?.length || 0} interactions ready`}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col space-y-2 ml-6">
                        {session.active ? (
                          <>
                            <Link href={`/dashboard/sessions/${session.id}`}>
                              <Button size="sm" className="w-full">
                                <BarChart3 className="w-4 h-4 mr-2" />
                                Manage
                              </Button>
                            </Link>
                            <Link href={`/dashboard/sessions/${session.id}/presentation`}>
                              <Button size="sm" variant="outline" className="w-full">
                                <Monitor className="w-4 h-4 mr-2" />
                                Present
                              </Button>
                            </Link>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleEndSession(session.id)}
                              loading={actionLoading[session.id]}
                              disabled={actionLoading[session.id]}
                              className="w-full"
                            >
                              <StopCircle className="w-4 h-4 mr-2" />
                              End Session
                            </Button>
                          </>
                        ) : session.endedAt ? (
                          <>
                            <Link href={`/dashboard/sessions/${session.id}`}>
                              <Button variant="outline" size="sm" className="w-full">
                                <Eye className="w-4 h-4 mr-2" />
                                View Results
                              </Button>
                            </Link>
                            <Button size="sm" variant="outline" onClick={() => handleDuplicateSession(session)} loading={actionLoading[session.id]} disabled={actionLoading[session.id]} className="w-full">
                              <Copy className="w-4 h-4 mr-2" /> Use again
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleDeleteSession(session.id)}
                              loading={actionLoading[session.id]}
                              disabled={actionLoading[session.id]}
                              className="w-full"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </>
                        ) : (
                          <>
                            <Link href={`/dashboard/sessions/${session.id}`}><Button size="sm" className="w-full"><Play className="w-4 h-4 mr-2" /> Open session</Button></Link>
                            <Button size="sm" variant="outline" onClick={() => handleDuplicateSession(session)} loading={actionLoading[session.id]} disabled={actionLoading[session.id]} className="w-full"><Copy className="w-4 h-4 mr-2" /> Make a copy</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteSession(session.id)} loading={actionLoading[session.id]} disabled={actionLoading[session.id]} className="w-full"><Trash2 className="w-4 h-4 mr-2" /> Delete</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
        {toast && <div className="fixed bottom-5 right-5 z-[80] rounded-xl bg-[#101a38] px-4 py-3 text-sm font-semibold text-white shadow-xl" role="status">{toast}</div>}
        <Dialog isOpen={Boolean(pendingAction)} onClose={() => setPendingAction(null)} onConfirm={confirmPendingAction} title={pendingDialog.title} message={pendingDialog.message} confirmText={pendingDialog.confirmText} variant={pendingDialog.destructive ? 'destructive' : 'default'} />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
