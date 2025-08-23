'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getCaseStudy, updateCaseStudy } from '@/lib/firebase/firestore';
import { generateId } from '@/lib/utils';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import RichTextEditor from '@/components/ui/RichTextEditor';
import type { Section, Question, CaseStudy } from '@/types';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';

export default function EditCaseStudyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const caseStudyId = params?.id as string;
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    courseId: 'default', // TODO: Implement course selection
  });

  const [sections, setSections] = useState<Section[]>([]);

  // Load existing case study data
  useEffect(() => {
    const loadCaseStudy = async () => {
      if (!caseStudyId || !user) return;
      
      try {
        const existingCaseStudy = await getCaseStudy(caseStudyId);
        if (!existingCaseStudy) {
          setError('Case study not found');
          return;
        }
        
        // Check if user owns this case study
        if (existingCaseStudy.teacherId !== user.uid) {
          setError('You do not have permission to edit this case study');
          return;
        }
        
        setCaseStudy(existingCaseStudy);
        setFormData({
          title: existingCaseStudy.title,
          description: existingCaseStudy.description,
          courseId: existingCaseStudy.courseId,
        });
        setSections(existingCaseStudy.sections || []);
      } catch (error: any) {
        console.error('Error loading case study:', error);
        setError('Failed to load case study');
      } finally {
        setInitialLoading(false);
      }
    };

    loadCaseStudy();
  }, [caseStudyId, user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSectionChange = (sectionId: string, field: keyof Section, value: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, [field]: value }
        : section
    ));
  };

  const addSection = () => {
    const newSection: Section = {
      id: generateId(),
      title: '',
      content: '',
      questions: [],
      order: sections.length
    };
    setSections(prev => [...prev, newSection]);
  };

  const removeSection = (sectionId: string) => {
    if (sections.length === 1) return; // Keep at least one section
    setSections(prev => prev.filter(section => section.id !== sectionId));
  };

  const addQuestion = (sectionId: string) => {
    const newQuestion: Question = {
      id: generateId(),
      text: '',
      type: 'text',
      points: 10
    };

    setSections(prev => prev.map(section =>
      section.id === sectionId
        ? { ...section, questions: [...section.questions, newQuestion] }
        : section
    ));
  };

  const removeQuestion = (sectionId: string, questionId: string) => {
    setSections(prev => prev.map(section =>
      section.id === sectionId
        ? { ...section, questions: section.questions.filter(q => q.id !== questionId) }
        : section
    ));
  };

  const handleQuestionChange = (
    sectionId: string, 
    questionId: string, 
    field: keyof Question, 
    value: string | number
  ) => {
    setSections(prev => prev.map(section =>
      section.id === sectionId
        ? {
            ...section,
            questions: section.questions.map(question =>
              question.id === questionId
                ? { 
                    ...question, 
                    [field]: value,
                    // Initialize options array when type changes to multiple-choice
                    ...(field === 'type' && value === 'multiple-choice' 
                      ? { options: ['Option 1', 'Option 2'], correctAnswer: 0 }
                      : {}
                    )
                  }
                : question
            )
          }
        : section
    ));
  };

  const addOption = (sectionId: string, questionId: string) => {
    setSections(prev => prev.map(section =>
      section.id === sectionId
        ? {
            ...section,
            questions: section.questions.map(question =>
              question.id === questionId && question.options
                ? { 
                    ...question, 
                    options: [...question.options, `Option ${question.options.length + 1}`]
                  }
                : question
            )
          }
        : section
    ));
  };

  const removeOption = (sectionId: string, questionId: string, optionIndex: number) => {
    setSections(prev => prev.map(section =>
      section.id === sectionId
        ? {
            ...section,
            questions: section.questions.map(question =>
              question.id === questionId && question.options
                ? { 
                    ...question, 
                    options: question.options.filter((_, index) => index !== optionIndex),
                    // Adjust correct answer if needed
                    correctAnswer: question.correctAnswer === optionIndex 
                      ? 0 
                      : question.correctAnswer && question.correctAnswer > optionIndex
                        ? question.correctAnswer - 1
                        : question.correctAnswer
                  }
                : question
            )
          }
        : section
    ));
  };

  const updateOption = (sectionId: string, questionId: string, optionIndex: number, value: string) => {
    setSections(prev => prev.map(section =>
      section.id === sectionId
        ? {
            ...section,
            questions: section.questions.map(question =>
              question.id === questionId && question.options
                ? { 
                    ...question, 
                    options: question.options.map((option, index) =>
                      index === optionIndex ? value : option
                    )
                  }
                : question
            )
          }
        : section
    ));
  };

  const calculateTotalPoints = () => {
    return sections.reduce((total, section) => 
      total + section.questions.reduce((sectionTotal, question) => sectionTotal + question.points, 0), 
      0
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !caseStudyId) return;
    
    setLoading(true);
    setError('');

    try {
      // Validate form
      if (!formData.title.trim()) {
        throw new Error('Case study title is required');
      }

      if (sections.some(section => !section.title.trim() || !section.content.trim())) {
        throw new Error('All sections must have a title and content');
      }

      const totalPoints = calculateTotalPoints();
      
      const updateData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        sections: sections.map((section, index) => ({
          ...section,
          order: index
        })),
        totalPoints,
        courseId: formData.courseId,
      };

      await updateCaseStudy(caseStudyId, updateData);
      router.push('/dashboard/case-studies');
    } catch (error: any) {
      setError(error.message || 'Failed to update case study');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6 lg:p-8 max-w-4xl">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-8"></div>
              <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="border rounded-lg p-6">
                    <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (error && !caseStudy) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6 lg:p-8 max-w-4xl">
            <div className="text-center py-12">
              <div className="text-red-600 text-lg font-medium mb-4">{error}</div>
              <Button onClick={() => router.push('/dashboard/case-studies')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Case Studies
              </Button>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  const totalPoints = calculateTotalPoints();

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 lg:p-8 max-w-4xl">
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant="ghost"
                onClick={() => router.push('/dashboard/case-studies')}
                className="p-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Edit Case Study</h1>
                <p className="text-gray-600 mt-1">
                  Update your interactive case study with sections and questions.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Marketing Strategy Dilemma"
                />
                
                <RichTextEditor
                  label="Description"
                  content={formData.description}
                  onChange={(content) => setFormData(prev => ({ ...prev, description: content }))}
                  placeholder="Brief description of the case study and learning objectives..."
                  helperText="Provide a clear overview of what students will learn from this case study."
                />

                <div className="bg-blue-50 p-4 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Total Points:</strong> {totalPoints} points across {sections.length} sections
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Sections */}
            {sections.map((section, sectionIndex) => (
              <Card key={section.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Section {sectionIndex + 1}</CardTitle>
                    {sections.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSection(section.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Section Title"
                    value={section.title}
                    onChange={(e) => handleSectionChange(section.id, 'title', e.target.value)}
                    required
                    placeholder="e.g., Background Information"
                  />
                  
                  <RichTextEditor
                    label="Content"
                    content={section.content}
                    onChange={(content) => handleSectionChange(section.id, 'content', content)}
                    required
                    placeholder="Write your case study content with rich text formatting..."
                    helperText="Use the toolbar above to format text, add links, images, and more."
                  />

                  {/* Questions */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium text-gray-900">Questions</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addQuestion(section.id)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Question
                      </Button>
                    </div>

                    {section.questions.map((question, questionIndex) => (
                      <div key={question.id} className="border rounded-md p-4 space-y-3 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            Question {questionIndex + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeQuestion(section.id, question.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <Textarea
                          label="Question Text"
                          value={question.text}
                          onChange={(e) => handleQuestionChange(section.id, question.id, 'text', e.target.value)}
                          required
                          placeholder="Enter your question here..."
                          rows={2}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Question Type
                            </label>
                            <select
                              value={question.type}
                              onChange={(e) => handleQuestionChange(section.id, question.id, 'type', e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            >
                              <option value="text">Text Response</option>
                              <option value="essay">Essay</option>
                              <option value="multiple-choice">Multiple Choice</option>
                            </select>
                          </div>
                          
                          <Input
                            label="Points"
                            type="number"
                            value={question.points}
                            onChange={(e) => handleQuestionChange(section.id, question.id, 'points', parseInt(e.target.value) || 0)}
                            min="1"
                            max="100"
                          />
                        </div>

                        {/* Multiple Choice Options */}
                        {question.type === 'multiple-choice' && (
                          <div className="mt-4">
                            <div className="flex items-center justify-between mb-3">
                              <label className="block text-sm font-medium text-gray-700">
                                Answer Options
                              </label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addOption(section.id, question.id)}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Option
                              </Button>
                            </div>
                            
                            <div className="space-y-2">
                              {question.options?.map((option, optionIndex) => (
                                <div key={optionIndex} className="flex items-center gap-3">
                                  <input
                                    type="radio"
                                    name={`correct-${question.id}`}
                                    checked={question.correctAnswer === optionIndex}
                                    onChange={() => handleQuestionChange(section.id, question.id, 'correctAnswer', optionIndex)}
                                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                  />
                                  <Input
                                    value={option}
                                    onChange={(e) => updateOption(section.id, question.id, optionIndex, e.target.value)}
                                    placeholder={`Option ${optionIndex + 1}`}
                                    className="flex-1"
                                  />
                                  {question.options && question.options.length > 2 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeOption(section.id, question.id, optionIndex)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                            
                            <p className="text-xs text-gray-500 mt-2">
                              Select the radio button next to the correct answer
                            </p>
                          </div>
                        )}
                      </div>
                    ))}

                    {section.questions.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No questions yet. Click "Add Question" to get started.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add Section Button */}
            <div className="text-center">
              <Button
                type="button"
                variant="outline"
                onClick={addSection}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Another Section
              </Button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-4">
              <Button
                type="submit"
                loading={loading}
                className="flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Update Case Study
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard/case-studies')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
