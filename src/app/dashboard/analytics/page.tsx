'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getCaseStudiesByTeacher, getSessionsByTeacher, getResponsesBySession } from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import type { CaseStudy, Session, Response } from '@/types';
import { 
  BarChart, 
  TrendingUp, 
  Users, 
  BookOpen, 
  Target, 
  Clock,
  Award,
  Activity
} from 'lucide-react';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        try {
          // Load all data in parallel
          const [studies, sessionsData] = await Promise.all([
            getCaseStudiesByTeacher(user.uid),
            getSessionsByTeacher(user.uid)
          ]);
          
          setCaseStudies(studies);
          setSessions(sessionsData);
          
          // Load responses for recent sessions only (last 10) to reduce reads
          const recentSessions = sessionsData
            .sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)).getTime() - (a.createdAt?.toDate?.() || new Date(0)).getTime())
            .slice(0, 10);
            
          const allResponses: Response[] = [];
          for (const session of recentSessions) {
            try {
              const sessionResponses = await getResponsesBySession(session.id);
              allResponses.push(...sessionResponses);
            } catch (error) {
              console.warn(`Failed to load responses for session ${session.id}:`, error);
            }
          }
          setResponses(allResponses);
          
        } catch (error) {
          console.error('Error loading analytics data:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadData();
  }, [user]);

  // Calculate real analytics data
  const analyticsData = useMemo(() => {
    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.active).length;
    const endedSessions = sessions.filter(s => !s.active).length;
    
    // Calculate total unique students
    const allStudentIds = new Set<string>();
    sessions.forEach(session => {
      session.studentsJoined?.forEach(studentId => allStudentIds.add(studentId));
    });
    const totalStudents = allStudentIds.size;
    
    // Calculate completion rate (students who submitted responses)
    const studentsWithResponses = new Set<string>();
    responses.forEach(response => studentsWithResponses.add(response.studentId));
    const completionRate = totalStudents > 0 ? Math.round((studentsWithResponses.size / totalStudents) * 100) : 0;
    
    // Calculate average engagement (responses per student)
    const totalResponses = responses.length;
    const averageEngagement = totalStudents > 0 ? Math.round(totalResponses / totalStudents) : 0;
    
    return {
      totalSessions,
      activeSessions,
      endedSessions,
      totalStudents,
      completionRate,
      averageEngagement,
      totalResponses
    };
  }, [sessions, responses]);

  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    description 
  }: { 
    title: string; 
    value: string | number; 
    change?: string; 
    icon: React.ComponentType<{ className?: string }>; 
    description: string;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-gray-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        {change && (
          <p className="text-xs text-green-600 flex items-center mt-1">
            <TrendingUp className="h-3 w-3 mr-1" />
            {change}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600 mt-1">
              Track engagement, performance, and learning outcomes across your case studies.
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-6 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  title="Total Sessions"
                  value={analyticsData.totalSessions}
                  change={`${analyticsData.activeSessions} active`}
                  icon={Activity}
                  description="Sessions conducted"
                />
                <StatCard
                  title="Total Students"
                  value={analyticsData.totalStudents}
                  change={`${analyticsData.totalResponses} responses`}
                  icon={Users}
                  description="Unique students engaged"
                />
                <StatCard
                  title="Completion Rate"
                  value={`${analyticsData.completionRate}%`}
                  change={`${analyticsData.endedSessions} ended`}
                  icon={Target}
                  description="Students completing sessions"
                />
                <StatCard
                  title="Avg. Engagement"
                  value={analyticsData.averageEngagement}
                  change="responses per student"
                  icon={Award}
                  description="Average participation level"
                />
              </div>

              {/* Detailed Analytics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Case Studies Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BookOpen className="w-5 h-5 mr-2" />
                      Case Studies Performance
                    </CardTitle>
                    <CardDescription>
                      Engagement metrics for each case study
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {caseStudies.length === 0 ? (
                      <div className="text-center py-8">
                        <BarChart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-500">No case studies available</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Create case studies to see performance analytics
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {caseStudies.map((caseStudy) => {
                          // Calculate metrics for this case study
                          const caseStudySessions = sessions.filter(s => s.caseStudyId === caseStudy.id);
                          const caseStudyResponses = responses.filter(r => 
                            caseStudySessions.some(s => s.id === r.sessionId)
                          );
                          
                          // Get unique students for this case study
                          const caseStudyStudentIds = new Set<string>();
                          caseStudySessions.forEach(session => {
                            session.studentsJoined?.forEach(studentId => caseStudyStudentIds.add(studentId));
                          });
                          const totalStudents = caseStudyStudentIds.size;
                          
                          // Calculate completion rate
                          const studentsWithResponses = new Set<string>();
                          caseStudyResponses.forEach(response => studentsWithResponses.add(response.studentId));
                          const completionRate = totalStudents > 0 ? Math.round((studentsWithResponses.size / totalStudents) * 100) : 0;
                          
                          // Calculate average score
                          const scoredResponses = caseStudyResponses.filter(r => r.points !== undefined);
                          const averageScore = scoredResponses.length > 0 
                            ? Math.round(scoredResponses.reduce((sum, r) => sum + (r.points || 0), 0) / scoredResponses.length)
                            : 0;
                          
                          return (
                            <div key={caseStudy.id} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-gray-900 truncate">
                                  {caseStudy.title}
                                </h4>
                                <span className="text-sm text-gray-500">
                                  {caseStudySessions.length} session{caseStudySessions.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-500">Students</p>
                                  <p className="font-medium">{totalStudents}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Completion</p>
                                  <p className="font-medium">{completionRate}%</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Avg. Score</p>
                                  <p className="font-medium">{averageScore > 0 ? averageScore : '-'}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="w-5 h-5 mr-2" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>
                      Latest sessions and student interactions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sessions.length === 0 ? (
                      <div className="text-center py-8">
                        <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-500">No recent activity</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Start a session to see activity here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sessions.slice(0, 5).map((session) => {
                          const sessionResponses = responses.filter(r => r.sessionId === session.id);
                          const caseStudy = caseStudies.find(cs => cs.id === session.caseStudyId);
                          
                          return (
                            <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">
                                  {caseStudy?.title || 'Unknown Case Study'}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {session.sessionCode} • {session.studentsJoined?.length || 0} students • {sessionResponses.length} responses
                                </p>
                              </div>
                              <div className="flex items-center space-x-2 ml-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  session.active 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {session.active ? 'Active' : 'Ended'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* AI Assessment Insights */}
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="w-5 h-5 mr-2" />
                    AI Assessment Insights
                  </CardTitle>
                  <CardDescription>
                    Learning outcomes and milestone achievements powered by AI analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {responses.length === 0 ? (
                    <div className="text-center py-8">
                      <Target className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-gray-500">No assessment data available</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Conduct sessions to generate AI-powered insights on student learning
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h4 className="font-medium text-blue-900 mb-2">Assessment Coverage</h4>
                          <p className="text-2xl font-bold text-blue-700">
                            {responses.filter(r => r.assessment).length}
                          </p>
                          <p className="text-sm text-blue-600">AI-assessed responses</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <h4 className="font-medium text-green-900 mb-2">Average Score</h4>
                          <p className="text-2xl font-bold text-green-700">
                            {(() => {
                              const scoredResponses = responses.filter(r => r.points !== undefined);
                              return scoredResponses.length > 0 
                                ? Math.round(scoredResponses.reduce((sum, r) => sum + (r.points || 0), 0) / scoredResponses.length)
                                : 0;
                            })()}
                          </p>
                          <p className="text-sm text-green-600">points per response</p>
                        </div>
                      </div>
                      
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <h4 className="font-medium text-purple-900 mb-2">Learning Insights</h4>
                        <p className="text-sm text-purple-700">
                          {responses.length} total responses analyzed across {sessions.length} sessions
                        </p>
                        <p className="text-sm text-purple-600 mt-1">
                          AI assessment provides detailed feedback on student understanding and progress
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
