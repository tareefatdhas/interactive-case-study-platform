'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createCaseStudy } from '@/lib/firebase/firestore';
import { auth } from '@/lib/firebase/config';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import InlineMessage from '@/components/ui/InlineMessage';
import type { CaseStudy } from '@/types';
import { Sparkles, ArrowLeft, Save, Loader2, BookOpen, MessageSquare, Activity, HelpCircle, Award } from 'lucide-react';
import { getUserFacingError } from '@/lib/user-facing-error';

export default function GenerateCaseStudyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedCaseStudy, setGeneratedCaseStudy] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const [formData, setFormData] = useState({
    prompt: '',
    learningObjectives: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleGenerate = async (e: React.FormEvent, isRetry = false) => {
    e.preventDefault();
    if (!user) return;

    if (!isRetry) {
      setRetryCount(0);
    }

    setLoading(true);
    setError('');
    setGeneratedCaseStudy(null);
    setLoadingProgress('Initializing AI generation...');

    try {
      if (!formData.prompt.trim() || !formData.learningObjectives.trim()) {
        throw new Error('Please provide both a prompt and learning objectives');
      }

      setLoadingProgress('Sending request to AI...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Sign in again before generating a case study.');
      const response = await fetch('/api/generate-case-study', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          prompt: formData.prompt,
          learningObjectives: formData.learningObjectives,
          teacherId: user.uid,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setLoadingProgress('Processing AI response...');

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'The case study draft is not ready yet. Try again in a moment.');
      }

      setLoadingProgress('Finalizing case study...');
      setGeneratedCaseStudy(data.caseStudy);
      setLoadingProgress('');
    } catch (error: any) {
      console.error('Generation error:', error);
      
      if (error.name === 'AbortError') {
        setError('The draft is taking longer than expected. Try again with a shorter source or fewer learning objectives.');
      } else if (error.message.includes('parse') || error.message.includes('JSON')) {
        setError('The draft came back incomplete. Try generating it once more.');
      } else {
        setError(getUserFacingError(error, 'The case study draft could not be generated. Check your connection and try again.'));
      }
      
      setRetryCount(prev => prev + 1);
    } finally {
      setLoading(false);
      setLoadingProgress('');
    }
  };

  const handleRetry = (e: React.FormEvent) => {
    handleGenerate(e, true);
  };

  const handleSave = async () => {
    if (!user || !generatedCaseStudy) return;

    setSaving(true);
    setError('');

    try {
      await createCaseStudy(generatedCaseStudy);
      router.push('/dashboard/case-studies');
    } catch (error: any) {
      setError(getUserFacingError(error, 'The case study could not be saved. The generated draft is still here, so you can try again.'));
    } finally {
      setSaving(false);
    }
  };

  const getQuestionCount = (caseStudy: any) => {
    return caseStudy.sections?.reduce((total: number, section: any) => 
      total + (section.questions?.length || 0), 0) || 0;
  };

  const getSectionTypeIcon = (type: string) => {
    switch (type) {
      case 'reading': return <BookOpen className="w-4 h-4 text-blue-600" />;
      case 'discussion': return <MessageSquare className="w-4 h-4 text-purple-600" />;
      case 'activity': return <Activity className="w-4 h-4 text-green-600" />;
      default: return <BookOpen className="w-4 h-4 text-gray-600" />;
    }
  };

  const getSectionTypeName = (type: string) => {
    switch (type) {
      case 'reading': return 'Reading';
      case 'discussion': return 'Discussion';
      case 'activity': return 'Activity';
      default: return 'Section';
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="seminar-eyebrow mb-2">Case study draft</p>
                <h1 className="seminar-display text-4xl text-[#101a38]">Draft from a brief</h1>
                <p className="text-gray-600 mt-1">
                  Create engaging, HBS-style case studies with AI assistance.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Generation Form */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    Generate Case Study
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleGenerate} className="space-y-4">
                    <Textarea
                      label="Case Study Prompt"
                      name="prompt"
                      value={formData.prompt}
                      onChange={handleInputChange}
                      required
                      rows={4}
                      placeholder="Describe the case study you want to create. For example: 'A marketing manager at a tech startup needs to decide between two product launch strategies. The case should explore market research, competitive analysis, and resource allocation decisions.'"
                      helperText="Provide context, scenario, and key decision points you want students to explore."
                    />
                    
                    <Textarea
                      label="Learning Objectives"
                      name="learningObjectives"
                      value={formData.learningObjectives}
                      onChange={handleInputChange}
                      required
                      rows={3}
                      placeholder="Students will be able to: 1) Analyze market research data, 2) Evaluate strategic alternatives, 3) Make data-driven decisions under uncertainty"
                      helperText="List the specific skills and knowledge students should gain from this case study."
                    />

                    <Button
                      type="submit"
                      disabled={loading || !formData.prompt.trim() || !formData.learningObjectives.trim()}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {loadingProgress || 'Generating Case Study...'}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Case Study
                        </>
                      )}
                    </Button>
                  </form>

                  {error && (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <InlineMessage className="flex-1" title="The draft is not ready yet." message={retryCount > 0 ? `${error} This was attempt ${retryCount + 1}.` : error} />
                      <Button onClick={handleRetry} disabled={loading} size="sm" variant="outline">Try again</Button>
                    </div>
                  )}

                  {loading && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-center">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">
                            {loadingProgress || 'Generating Case Study...'}
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            This typically takes 30-90 seconds. Please wait...
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Guidelines */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Generation Guidelines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p><strong>HBS Style:</strong> Cases will be narrative-driven with realistic scenarios and engaging storytelling.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p><strong>Critical Thinking:</strong> Questions require analysis and evaluation, not just recall.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p><strong>Mixed Formats:</strong> Includes reading sections, discussion prompts, and activities.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p><strong>Question Types:</strong> Mix of multiple choice and open-ended questions with appropriate point values.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Generated Case Study Preview */}
            <div className="space-y-6">
              {generatedCaseStudy ? (
                <>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Generated Case Study</CardTitle>
                        <Button
                          onClick={handleSave}
                          loading={saving}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Case Study
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">
                          {generatedCaseStudy.title}
                        </h3>
                        <div 
                          className="text-gray-600 text-sm prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: generatedCaseStudy.description }}
                        />
                      </div>

                      {/* Statistics */}
                      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <BookOpen className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {generatedCaseStudy.sections?.length || 0}
                          </div>
                          <div className="text-xs text-gray-500">Sections</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <HelpCircle className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {getQuestionCount(generatedCaseStudy)}
                          </div>
                          <div className="text-xs text-gray-500">Questions</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <Award className="w-4 h-4 text-yellow-600" />
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {generatedCaseStudy.totalPoints}
                          </div>
                          <div className="text-xs text-gray-500">Points</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sections Preview */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Sections Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {generatedCaseStudy.sections?.map((section: any, index: number) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            {getSectionTypeIcon(section.type)}
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {section.title}
                              </div>
                              <div className="text-sm text-gray-500">
                                {getSectionTypeName(section.type)}
                                {section.questions?.length > 0 && (
                                  <span> • {section.questions.length} question{section.questions.length !== 1 ? 's' : ''}</span>
                                )}
                              </div>
                            </div>
                            {section.questions?.length > 0 && (
                              <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                                {section.questions.reduce((total: number, q: any) => total + (q.points || 0), 0)} pts
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for your brief</h3>
                    <p className="text-gray-600 mb-6">
                      Add the teaching context and source material on the left. A draft will appear here for you to review.
                    </p>
                    <div className="text-sm text-gray-500">
                      Drafting may take a moment.
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
