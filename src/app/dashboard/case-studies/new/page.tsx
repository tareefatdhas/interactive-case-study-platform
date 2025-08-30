'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createCaseStudy } from '@/lib/firebase/firestore';
import { generateId } from '@/lib/utils';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import RichTextEditor from '@/components/ui/RichTextEditor';
import type { Section, Question, SectionType } from '@/types';
import { Plus, Trash2, Save, BookOpen, MessageSquare, Activity } from 'lucide-react';

export default function NewCaseStudyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    courseId: 'default', // TODO: Implement course selection
    conclusionGuidance: '',
  });

  const [sections, setSections] = useState<Section[]>([
    {
      id: generateId(),
      title: '',
      content: '',
      type: 'reading',
      questions: [],
      order: 0
    }
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSectionChange = (sectionId: string, field: keyof Section, value: string | SectionType) => {
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
      type: 'reading',
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
    value: any
  ) => {
    setSections(prev => prev.map(section =>
      section.id === sectionId
        ? {
            ...section,
            questions: section.questions.map(question =>
              question.id === questionId
                ? { ...question, [field]: value }
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
              question.id === questionId
                ? { ...question, options: [...(question.options || []), ''] }
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
              question.id === questionId
                ? {
                    ...question,
                    options: question.options?.map((option, index) =>
                      index === optionIndex ? value : option
                    )
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
              question.id === questionId
                ? {
                    ...question,
                    options: question.options?.filter((_, index) => index !== optionIndex),
                    // Reset correct answer if it was the removed option
                    correctAnswer: question.correctAnswer === optionIndex 
                      ? undefined 
                      : question.correctAnswer !== undefined && question.correctAnswer > optionIndex
                        ? question.correctAnswer - 1
                        : question.correctAnswer
                  }
                : question
            )
          }
        : section
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      // Validate form
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }

      if (sections.length === 0) {
        throw new Error('At least one section is required');
      }

      // Validate sections
      for (const section of sections) {
        if (!section.title.trim()) {
          throw new Error('All sections must have a title');
        }

        if (section.type === 'reading' && !section.content.trim()) {
          throw new Error('Reading sections must have content');
        }

        if (section.type === 'discussion' && (!section.discussionPrompt?.trim() || section.discussionPrompt === '<p></p>')) {
          throw new Error('Discussion sections must have a prompt');
        }

        if (section.type === 'activity' && (!section.activityInstructions?.trim() || section.activityInstructions === '<p></p>')) {
          throw new Error('Activity sections must have instructions');
        }
      }

      // Calculate total points
      const totalPoints = sections.reduce((total, section) => 
        total + section.questions.reduce((sectionTotal, question) => 
          sectionTotal + question.points, 0
        ), 0
      );

      const caseStudyData = {
        ...formData,
        sections: sections.map((section, index) => ({
          ...section,
          order: index
        })),
        totalPoints,
        teacherId: user.uid,
        archived: false
      };

      await createCaseStudy(caseStudyData);
      router.push('/dashboard/case-studies');
    } catch (error: any) {
      setError(error.message || 'Failed to create case study');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 lg:p-8 max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Create New Case Study</h1>
            <p className="text-gray-600 mt-1">
              Design an interactive case study with reading, discussion, and activity sections.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Case Study Title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Marketing Strategy Challenge"
                />
                
                <RichTextEditor
                  label="Description"
                  content={formData.description}
                  onChange={(content) => setFormData(prev => ({ ...prev, description: content }))}
                  placeholder="Provide an overview of the case study..."
                  helperText="This description will be shown to students at the beginning of the session."
                />
                
                <RichTextEditor
                  label="Conclusion Guidance (Optional)"
                  content={formData.conclusionGuidance}
                  onChange={(content) => setFormData(prev => ({ ...prev, conclusionGuidance: content }))}
                  placeholder="Provide guidance for AI-generated learning conclusions..."
                  helperText="Optional: Guide the AI on what key themes, concepts, or learning objectives to emphasize in student conclusion summaries. Leave blank for general analysis."
                />
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

                  {/* Section Type Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Section Type
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { type: 'reading' as SectionType, icon: BookOpen, label: 'Reading', color: 'blue' },
                        { type: 'discussion' as SectionType, icon: MessageSquare, label: 'Discussion', color: 'purple' },
                        { type: 'activity' as SectionType, icon: Activity, label: 'Activity', color: 'green' }
                      ].map(({ type, icon: Icon, label, color }) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleSectionChange(section.id, 'type', type)}
                          className={`p-3 border rounded-lg transition-all hover:shadow-md ${
                            section.type === type
                              ? `border-${color}-500 bg-${color}-50`
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Icon className={`w-5 h-5 ${
                              section.type === type ? `text-${color}-600` : 'text-gray-400'
                            }`} />
                            <span className={`text-sm font-medium ${
                              section.type === type ? `text-${color}-900` : 'text-gray-600'
                            }`}>
                              {label}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content based on section type */}
                  {section.type === 'reading' && (
                    <RichTextEditor
                      label="Content"
                      content={section.content}
                      onChange={(content) => handleSectionChange(section.id, 'content', content)}
                      required
                      placeholder="Write your case study content with rich text formatting..."
                      helperText="Use the toolbar above to format text, add links, images, and more."
                    />
                  )}

                  {section.type === 'discussion' && (
                    <RichTextEditor
                      label="Discussion Prompt"
                      content={section.discussionPrompt || ''}
                      onChange={(content) => handleSectionChange(section.id, 'discussionPrompt', content)}
                      required
                      placeholder="Enter the discussion question or prompt for students..."
                      helperText="Use formatting, bullet points, and links to create engaging discussion prompts."
                    />
                  )}

                  {section.type === 'activity' && (
                    <RichTextEditor
                      label="Activity Instructions"
                      content={section.activityInstructions || ''}
                      onChange={(content) => handleSectionChange(section.id, 'activityInstructions', content)}
                      required
                      placeholder="Provide clear instructions for the activity students should complete..."
                      helperText="Use formatting, bullet points, and links to create clear activity instructions."
                    />
                  )}

                  {/* Questions - Only show for reading sections */}
                  {section.type === 'reading' && (
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
                        <Card key={question.id} className="bg-gray-50">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm font-medium text-gray-900">
                                Question {questionIndex + 1}
                              </h5>
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

                            <Input
                              label="Question Text"
                              value={question.text}
                              onChange={(e) => handleQuestionChange(section.id, question.id, 'text', e.target.value)}
                              required
                              placeholder="Enter your question..."
                            />

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Question Type
                                </label>
                                <select
                                  value={question.type}
                                  onChange={(e) => handleQuestionChange(section.id, question.id, 'type', e.target.value as 'text' | 'multiple-choice' | 'multiple-choice-feedback' | 'essay')}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="text">Short Answer</option>
                                  <option value="essay">Essay</option>
                                  <option value="multiple-choice">Multiple Choice</option>
                                  <option value="multiple-choice-feedback">Multiple Choice (Feedback)</option>
                                </select>
                              </div>

                              <Input
                                label="Points"
                                type="number"
                                value={question.points.toString()}
                                onChange={(e) => handleQuestionChange(section.id, question.id, 'points', parseInt(e.target.value) || 0)}
                                required
                                min="1"
                                placeholder="10"
                              />
                            </div>

                            {(question.type === 'multiple-choice' || question.type === 'multiple-choice-feedback') && (
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Answer Options
                                  </label>
                                  <div className="space-y-2">
                                    {question.type === 'multiple-choice-feedback' && (
                                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                        <p className="text-sm text-blue-800">
                                          <strong>Feedback Question:</strong> All answers will be considered correct and earn full points. 
                                          This is designed to gather student opinions and insights.
                                        </p>
                                      </div>
                                    )}
                                    {(question.options || []).map((option, optionIndex) => (
                                      <div key={optionIndex} className="flex items-center gap-2">
                                        {question.type === 'multiple-choice' && (
                                          <input
                                            type="radio"
                                            name={`correct-${question.id}`}
                                            checked={question.correctAnswer === optionIndex}
                                            onChange={() => handleQuestionChange(section.id, question.id, 'correctAnswer', optionIndex)}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                          />
                                        )}
                                        <input
                                          type="text"
                                          value={option}
                                          onChange={(e) => updateOption(section.id, question.id, optionIndex, e.target.value)}
                                          placeholder={`Option ${optionIndex + 1}`}
                                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeOption(section.id, question.id, optionIndex)}
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => addOption(section.id, question.id)}
                                      className="w-full"
                                    >
                                      <Plus className="w-4 h-4 mr-1" />
                                      Add Option
                                    </Button>
                                  </div>
                                </div>

                                {question.type === 'multiple-choice' && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Explanation for Correct Answer
                                    </label>
                                    <Textarea
                                      value={question.correctAnswerExplanation || ''}
                                      onChange={(e) => handleQuestionChange(section.id, question.id, 'correctAnswerExplanation', e.target.value)}
                                      placeholder="Explain why this is the correct answer. This will be shown to students who answer incorrectly."
                                      rows={3}
                                      className="w-full"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                      This explanation helps students understand their mistakes and learn from them.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addSection}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Section
            </Button>

            {error && (
              <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <Button
                type="submit"
                loading={loading}
                className="flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Create Case Study
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
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
