'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getCaseStudiesByTeacher } from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import type { CaseStudy } from '@/types';
import { BookOpen, Users, Play, Plus } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCaseStudies = async () => {
      if (user) {
        try {
          const studies = await getCaseStudiesByTeacher(user.uid);
          setCaseStudies(studies);
        } catch (error) {
          console.error('Error loading case studies:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadCaseStudies();
  }, [user]);

  const stats = {
    totalCaseStudies: caseStudies.length,
    totalSessions: 0, // TODO: Calculate from sessions
    totalStudents: 0, // TODO: Calculate from sessions
    averageScore: 0, // TODO: Calculate from responses
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.name}
            </h1>
            <p className="text-gray-600 mt-1">
              Here's what's happening with your case studies today.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <BookOpen className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Case Studies</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalCaseStudies}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Play className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Sessions</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalSessions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Students</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 font-bold">%</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Score</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.averageScore}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/dashboard/case-studies/new">
                <Button className="flex items-center">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Case Study
                </Button>
              </Link>
              <Link href="/dashboard/sessions/new">
                <Button variant="outline" className="flex items-center">
                  <Play className="w-4 h-4 mr-2" />
                  Start Session
                </Button>
              </Link>
            </div>
          </div>

          {/* Recent Case Studies */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Case Studies</h2>
              <Link href="/dashboard/case-studies">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
              </div>
            ) : caseStudies.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {caseStudies.slice(0, 6).map((caseStudy) => (
                  <Card key={caseStudy.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-base">{caseStudy.title}</CardTitle>
                      <CardDescription 
                        className="line-clamp-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_li]:mb-1"
                        dangerouslySetInnerHTML={{ __html: caseStudy.description }}
                      />
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>{caseStudy.sections.length} sections</span>
                        <span>{caseStudy.totalPoints} points</span>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Link href={`/dashboard/case-studies/${caseStudy.id}`}>
                          <Button size="sm" variant="outline">
                            Edit
                          </Button>
                        </Link>
                        <Link href={`/dashboard/sessions/new?caseStudyId=${caseStudy.id}`}>
                          <Button size="sm">
                            Start Session
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No case studies yet</h3>
                  <p className="text-gray-600 mb-6">
                    Get started by creating your first interactive case study.
                  </p>
                  <Link href="/dashboard/case-studies/new">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Case Study
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}