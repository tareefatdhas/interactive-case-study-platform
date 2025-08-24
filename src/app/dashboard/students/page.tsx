'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getAllStudentsWithStats } from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import type { Student } from '@/types';
import { UserCheck, Users, Trophy, Target, TrendingUp, Award, BookOpen, Search, ChevronUp, ChevronDown, Filter } from 'lucide-react';

interface StudentWithStats extends Student {
  stats: {
    totalResponses: number;
    correctResponses: number;
    correctPercentage: number;
    totalPoints: number;
    maxTotalPoints: number;
    averageScore: number;
    progressPercentage: number;
    totalQuestionsAvailable: number;
  };
}

type SortField = 'name' | 'studentId' | 'progressPercentage' | 'correctPercentage' | 'totalResponses' | 'totalPoints';
type SortDirection = 'asc' | 'desc';

export default function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    const loadStudents = async () => {
      if (user) {
        try {
          const studentsWithStats = await getAllStudentsWithStats(user.uid);
          setStudents(studentsWithStats);
        } catch (error) {
          console.error('Error loading students:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadStudents();
  }, [user]);

  // Filtered and sorted students
  const filteredAndSortedStudents = useMemo(() => {
    let filtered = students.filter(student => {
      const searchLower = searchTerm.toLowerCase();
      return (
        student.name?.toLowerCase().includes(searchLower) ||
        (student.studentId || student.id).toLowerCase().includes(searchLower)
      );
    });

    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'studentId':
          aValue = (a.studentId || a.id).toLowerCase();
          bValue = (b.studentId || b.id).toLowerCase();
          break;
        case 'progressPercentage':
          aValue = a.stats.progressPercentage;
          bValue = b.stats.progressPercentage;
          break;
        case 'correctPercentage':
          aValue = a.stats.correctPercentage;
          bValue = b.stats.correctPercentage;
          break;
        case 'totalResponses':
          aValue = a.stats.totalResponses;
          bValue = b.stats.totalResponses;
          break;
        case 'totalPoints':
          aValue = a.stats.totalPoints;
          bValue = b.stats.totalPoints;
          break;
        default:
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [students, searchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 inline ml-1" /> : 
      <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const totalStudents = students.length;
  const totalResponses = students.reduce((sum, s) => sum + s.stats.totalResponses, 0);
  const averageCorrectPercentage = totalStudents > 0 
    ? Math.round((students.reduce((sum, s) => sum + s.stats.correctPercentage, 0) / totalStudents) * 10) / 10
    : 0;
  const averageProgressPercentage = totalStudents > 0 
    ? Math.round((students.reduce((sum, s) => sum + s.stats.progressPercentage, 0) / totalStudents) * 10) / 10
    : 0;
  const totalPointsEarned = students.reduce((sum, s) => sum + s.stats.totalPoints, 0);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Students</h1>
              <p className="text-gray-600 mt-1">
                Track student performance and engagement across all sessions.
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search students by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Summary Stats */}
          {!loading && students.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <UserCheck className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Students</p>
                      <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookOpen className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Responses</p>
                      <p className="text-2xl font-bold text-gray-900">{totalResponses}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Target className="h-8 w-8 text-yellow-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Avg Correct %</p>
                      <p className="text-2xl font-bold text-gray-900">{averageCorrectPercentage}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-indigo-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Avg Progress</p>
                      <p className="text-2xl font-bold text-gray-900">{averageProgressPercentage}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Trophy className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Points</p>
                      <p className="text-2xl font-bold text-gray-900">{totalPointsEarned}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {loading ? (
            <Card>
              <CardContent className="p-0">
                <div className="animate-pulse">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correct %</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responses</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Points</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {[...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                              <div className="ml-4 h-4 bg-gray-200 rounded w-24"></div>
                            </div>
                          </td>
                          <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                          <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                          <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                          <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                          <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : students.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No students yet</h3>
                <p className="text-gray-600 mb-6">
                  Students will appear here after they join and participate in your sessions.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort('name')}
                        >
                          Student {getSortIcon('name')}
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort('studentId')}
                        >
                          ID {getSortIcon('studentId')}
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort('progressPercentage')}
                        >
                          Progress {getSortIcon('progressPercentage')}
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort('correctPercentage')}
                        >
                          Correct % {getSortIcon('correctPercentage')}
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort('totalResponses')}
                        >
                          Responses {getSortIcon('totalResponses')}
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort('totalPoints')}
                        >
                          Total Points {getSortIcon('totalPoints')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAndSortedStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-800">
                                  {student.name?.charAt(0).toUpperCase() || 'S'}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{student.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 font-mono">
                              {student.studentId || student.id}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-semibold ${getPerformanceColor(student.stats.progressPercentage)}`}>
                              {student.stats.progressPercentage}%
                            </div>
                            <div className="text-xs text-gray-500">
                              {student.stats.totalResponses}/{student.stats.totalQuestionsAvailable}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-semibold ${getPerformanceColor(student.stats.correctPercentage)}`}>
                              {student.stats.correctPercentage}%
                            </div>
                            <div className="text-xs text-gray-500">
                              {student.stats.correctResponses}/{student.stats.totalResponses}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {student.stats.totalResponses}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {student.stats.totalPoints}
                            </div>
                            <div className="text-xs text-gray-500">
                              /{student.stats.maxTotalPoints} max
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Table Footer with Results Count */}
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing {filteredAndSortedStudents.length} of {students.length} students
                      {searchTerm && (
                        <span className="text-gray-500"> (filtered)</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      Click column headers to sort
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
