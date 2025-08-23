'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { 
  getCaseStudiesByTeacher, 
  createSession, 
  generateSessionCode 
} from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import type { CaseStudy } from '@/types';
import { Play, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';

export default function NewSessionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCaseStudyId = searchParams.get('caseStudyId');

  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCaseStudies = async () => {
      if (user) {
        try {
          const studies = await getCaseStudiesByTeacher(user.uid);
          setCaseStudies(studies);
          
          // If a case study was preselected, set it
          if (preselectedCaseStudyId) {
            const exists = studies.find(s => s.id === preselectedCaseStudyId);
            if (exists) {
              setSelectedCaseStudy(preselectedCaseStudyId);
            }
          }
        } catch (error) {
          console.error('Error loading case studies:', error);
          setError('Failed to load case studies');
        } finally {
          setLoading(false);
        }
      }
    };

    loadCaseStudies();
  }, [user, preselectedCaseStudyId]);

  const handleCreateSession = async () => {
    if (!selectedCaseStudy || !user) return;

    setCreating(true);
    setError('');

    try {
      const sessionCode = generateSessionCode();
      
      const sessionId = await createSession({
        sessionCode,
        caseStudyId: selectedCaseStudy,
        teacherId: user.uid,
        active: true,
        studentsJoined: [],
        releasedSections: [0], // Start with first section released
        currentReleasedSection: 0, // First section (index 0) is available
        startedAt: new Date() as any,
        lastActivityAt: new Date() as any
      });

      // Create corresponding live session in Realtime Database
      const { createLiveSession } = require('@/lib/firebase/realtime');
      await createLiveSession(sessionId, {
        status: {
          active: true,
          currentSection: 0,
          releasedSections: [0]
        }
      });

      router.push(`/dashboard/sessions/${sessionId}`);
    } catch (error: any) {
      setError(error.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

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

  const selectedCaseStudyData = caseStudies.find(cs => cs.id === selectedCaseStudy);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 lg:p-8 max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Start New Session</h1>
            <p className="text-gray-600 mt-1">
              Select a case study to create a live session for your students.
            </p>
          </div>

          {caseStudies.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <QrCode className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No case studies available</h3>
                <p className="text-gray-600 mb-6">
                  You need to create a case study before you can start a session.
                </p>
                <Button onClick={() => router.push('/dashboard/case-studies/new')}>
                  Create Case Study
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Case Study Selection */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Select Case Study</CardTitle>
                    <CardDescription>
                      Choose which case study to use for this session
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {caseStudies.map((caseStudy) => (
                        <div
                          key={caseStudy.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            selectedCaseStudy === caseStudy.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedCaseStudy(caseStudy.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">{caseStudy.title}</h4>
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {caseStudy.description}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span>{caseStudy.sections.length} sections</span>
                                <span>{caseStudy.totalPoints} points</span>
                              </div>
                            </div>
                            <input
                              type="radio"
                              checked={selectedCaseStudy === caseStudy.id}
                              onChange={() => setSelectedCaseStudy(caseStudy.id)}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {error && (
                      <div className="mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                        {error}
                      </div>
                    )}

                    <div className="mt-6 flex gap-3">
                      <Button
                        onClick={handleCreateSession}
                        disabled={!selectedCaseStudy}
                        loading={creating}
                        className="flex items-center"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start Session
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => router.back()}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Preview */}
              {selectedCaseStudyData && (
                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Session Preview</CardTitle>
                      <CardDescription>
                        Overview of the selected case study
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">
                            {selectedCaseStudyData.title}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {selectedCaseStudyData.description}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {selectedCaseStudyData.sections.length}
                            </div>
                            <div className="text-sm text-gray-600">Sections</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {selectedCaseStudyData.totalPoints}
                            </div>
                            <div className="text-sm text-gray-600">Total Points</div>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">Sections:</h5>
                          <ul className="space-y-1">
                            {selectedCaseStudyData.sections.map((section, index) => (
                              <li key={section.id} className="text-sm text-gray-600 flex items-center">
                                <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs mr-2">
                                  {index + 1}
                                </span>
                                {section.title}
                                <span className="ml-auto text-xs">
                                  {section.questions.length} Q
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}