'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getCaseStudiesByTeacher, getSessionsByTeacher, checkAndTimeoutInactiveSessions, endSession, deleteSession } from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import type { CaseStudy, Session } from '@/types';
import { Play, Plus, Users, Clock, QrCode, Square, Trash2, StopCircle, Calendar, Activity, BarChart3, Eye, Filter, SortDesc, TrendingUp, Monitor } from 'lucide-react';

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

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        try {
          // Load case studies and sessions
          const [studies, sessionsData] = await Promise.all([
            getCaseStudiesByTeacher(user.uid),
            getSessionsByTeacher(user.uid)
          ]);
          
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
        await checkAndTimeoutInactiveSessions();
        
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
    if (!confirm('Are you sure you want to end this session? Students will no longer be able to join or submit responses.')) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [sessionId]: true }));
    try {
      await endSession(sessionId);
      // Refresh sessions list
      if (user) {
        const sessionsData = await getSessionsByTeacher(user.uid);
        setSessions(sessionsData);
      }
    } catch (error) {
      console.error('Error ending session:', error);
      alert('Failed to end session. Please try again.');
    } finally {
      setActionLoading(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone and will remove all associated data.')) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [sessionId]: true }));
    try {
      await deleteSession(sessionId);
      // Refresh sessions list
      if (user) {
        const sessionsData = await getSessionsByTeacher(user.uid);
        setSessions(sessionsData);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session. Please try again.');
    } finally {
      setActionLoading(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const handleEndAllActiveSessions = async () => {
    const activeSessions = sessions.filter(s => s.active);
    if (activeSessions.length === 0) {
      alert('No active sessions to end.');
      return;
    }

    if (!confirm(`Are you sure you want to end all ${activeSessions.length} active sessions? Students will no longer be able to join or submit responses to any of these sessions.`)) {
      return;
    }

    setBulkActionLoading(true);
    try {
      await Promise.all(activeSessions.map(session => endSession(session.id)));
      // Refresh sessions list
      if (user) {
        const sessionsData = await getSessionsByTeacher(user.uid);
        setSessions(sessionsData);
      }
    } catch (error) {
      console.error('Error ending sessions:', error);
      alert('Failed to end some sessions. Please try again.');
    } finally {
      setBulkActionLoading(false);
    }
  };

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
              <h1 className="text-2xl font-bold text-gray-900">Sessions</h1>
              <p className="text-gray-600 mt-1">
                Manage your live case study sessions and start new ones.
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
              {caseStudies.length > 0 ? (
                <Link href="/dashboard/sessions/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Session
                  </Button>
                </Link>
              ) : (
                <Link href="/dashboard/case-studies/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Case Study First
                  </Button>
                </Link>
              )}
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
                  {caseStudies.length === 0 ? 'No case studies available' : 'No sessions yet'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {caseStudies.length === 0 
                    ? 'You need to create a case study before you can start a session.'
                    : 'Start your first live session to engage with students.'}
                </p>
                {caseStudies.length > 0 ? (
                  <Link href="/dashboard/sessions/new">
                    <Button>
                      <Play className="w-4 h-4 mr-2" />
                      Start Session
                    </Button>
                  </Link>
                ) : (
                  <Link href="/dashboard/case-studies/new">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Case Study
                    </Button>
                  </Link>
                )}
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
                            {caseStudyTitles[session.caseStudyId] || 'Unknown Case Study'}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            session.active 
                              ? 'bg-gray-100 text-gray-700' 
                              : 'bg-gray-50 text-gray-600'
                          }`}>
                            {session.active ? 'Active' : 'Ended'}
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
                              <p className="text-gray-500">
                                {session.active ? 'Running' : `Ended ${getRelativeTime(session.endedAt)}`}
                              </p>
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
                        ) : (
                          <>
                            <Link href={`/dashboard/sessions/${session.id}`}>
                              <Button variant="outline" size="sm" className="w-full">
                                <Eye className="w-4 h-4 mr-2" />
                                View Results
                              </Button>
                            </Link>
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
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
