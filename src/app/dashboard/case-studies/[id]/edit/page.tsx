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
import type { Section, Question, CaseStudy, SectionType } from '@/types';
import { Plus, Trash2, Save, ArrowLeft, BookOpen, MessageSquare, Activity, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableSectionProps {
  section: Section;
  sectionIndex: number;
  sections: Section[];
  isCollapsed: boolean;
  onSectionChange: (sectionId: string, field: keyof Section, value: string | SectionType) => void;
  onRemoveSection: (sectionId: string) => void;
  onAddQuestion: (sectionId: string) => void;
  onRemoveQuestion: (sectionId: string, questionId: string) => void;
  onQuestionChange: (sectionId: string, questionId: string, field: keyof Question, value: any) => void;
}

function SortableSection({
  section,
  sectionIndex,
  sections,
  isCollapsed,
  onSectionChange,
  onRemoveSection,
  onAddQuestion,
  onRemoveQuestion,
  onQuestionChange,
}: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'all 200ms ease',
    opacity: isDragging ? 0.5 : 1,
  };

  const getSectionTypeInfo = (type: SectionType) => {
    switch (type) {
      case 'reading':
        return { icon: BookOpen, label: 'Reading', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'discussion':
        return { icon: MessageSquare, label: 'Discussion', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'activity':
        return { icon: Activity, label: 'Activity', color: 'bg-green-100 text-green-800 border-green-200' };
      default:
        return { icon: BookOpen, label: 'Reading', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
  };

  const typeInfo = getSectionTypeInfo(section.type);
  const TypeIcon = typeInfo.icon;

  if (isCollapsed) {
    return (
      <Card 
        ref={setNodeRef} 
        style={style} 
        className={`transition-all duration-200 ${isDragging ? 'shadow-lg ring-2 ring-blue-300' : 'hover:shadow-md'}`}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className={`p-2 rounded-md transition-colors ${
                sections.length > 1 
                  ? 'cursor-grab active:cursor-grabbing hover:bg-gray-100' 
                  : 'cursor-not-allowed opacity-50'
              }`}
              {...(sections.length > 1 ? attributes : {})}
              {...(sections.length > 1 ? listeners : {})}
              title={sections.length > 1 ? 'Drag to reorder sections' : 'Need multiple sections to reorder'}
            >
              <GripVertical className="w-4 h-4 text-gray-400" />
            </div>
            
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-500 whitespace-nowrap">
                Section {sectionIndex + 1}
              </span>
              
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${typeInfo.color}`}>
                <TypeIcon className="w-3 h-3" />
                {typeInfo.label}
              </span>
              
              <span className="font-medium text-gray-900 truncate">
                {section.title || 'Untitled Section'}
              </span>
            </div>
          </div>
          
          {sections.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemoveSection(section.id)}
              className="text-red-600 hover:text-red-700 ml-2"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card ref={setNodeRef} style={style} className={`transition-all duration-200 ${isDragging ? 'shadow-lg' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`p-1 rounded transition-colors ${
                sections.length > 1 
                  ? 'cursor-grab active:cursor-grabbing hover:bg-gray-100' 
                  : 'cursor-not-allowed opacity-50'
              }`}
              {...(sections.length > 1 ? attributes : {})}
              {...(sections.length > 1 ? listeners : {})}
              title={sections.length > 1 ? 'Drag to reorder sections' : 'Need multiple sections to reorder'}
            >
              <GripVertical className="w-4 h-4 text-gray-400" />
            </div>
            <CardTitle>Section {sectionIndex + 1}</CardTitle>
          </div>
          {sections.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemoveSection(section.id)}
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
          onChange={(e) => onSectionChange(section.id, 'title', e.target.value)}
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
                onClick={() => onSectionChange(section.id, 'type', type)}
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
            onChange={(content) => onSectionChange(section.id, 'content', content)}
            required
            placeholder="Write your case study content with rich text formatting..."
            helperText="Use the toolbar above to format text, add links, images, and more."
          />
        )}

        {section.type === 'discussion' && (
          <RichTextEditor
            label="Discussion Prompt"
            content={section.discussionPrompt || ''}
            onChange={(content) => onSectionChange(section.id, 'discussionPrompt', content)}
            required
            placeholder="Enter the discussion question or prompt for students..."
            helperText="Use formatting, bullet points, and links to create engaging discussion prompts."
          />
        )}

        {section.type === 'activity' && (
          <RichTextEditor
            label="Activity Instructions"
            content={section.activityInstructions || ''}
            onChange={(content) => onSectionChange(section.id, 'activityInstructions', content)}
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
                onClick={() => onAddQuestion(section.id)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Question
              </Button>
            </div>

            <div className="space-y-4">
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
                      onClick={() => onRemoveQuestion(section.id, question.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <Input
                    label="Question Text"
                    value={question.text}
                    onChange={(e) => onQuestionChange(section.id, question.id, 'text', e.target.value)}
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
                        onChange={(e) => onQuestionChange(section.id, question.id, 'type', e.target.value as 'text' | 'multiple-choice' | 'multiple-choice-feedback' | 'essay')}
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
                      onChange={(e) => onQuestionChange(section.id, question.id, 'points', parseInt(e.target.value) || 0)}
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
                                  onChange={() => onQuestionChange(section.id, question.id, 'correctAnswer', optionIndex)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                              )}
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...(question.options || [])];
                                  newOptions[optionIndex] = e.target.value;
                                  onQuestionChange(section.id, question.id, 'options', newOptions);
                                }}
                                placeholder={`Option ${optionIndex + 1}`}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newOptions = question.options?.filter((_, i) => i !== optionIndex) || [];
                                  onQuestionChange(section.id, question.id, 'options', newOptions);
                                  // Adjust correct answer if needed
                                  if (question.correctAnswer === optionIndex) {
                                    onQuestionChange(section.id, question.id, 'correctAnswer', undefined);
                                  } else if (question.correctAnswer !== undefined && question.correctAnswer > optionIndex) {
                                    onQuestionChange(section.id, question.id, 'correctAnswer', question.correctAnswer - 1);
                                  }
                                }}
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
                            onClick={() => {
                              const newOptions = [...(question.options || []), ''];
                              onQuestionChange(section.id, question.id, 'options', newOptions);
                            }}
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
                            onChange={(e) => onQuestionChange(section.id, question.id, 'correctAnswerExplanation', e.target.value)}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
    conclusionGuidance: '',
  });

  const [sections, setSections] = useState<Section[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start for collapsing sections
  const handleDragStart = (event: DragStartEvent) => {
    try {
      // Only start drag mode if we have multiple sections
      if (sections.length <= 1) {
        return;
      }
      setIsDragging(true);
    } catch (error) {
      console.error('Error starting drag operation:', error);
      setIsDragging(false);
    }
  };

  // Handle drag end for reordering sections
  const handleDragEnd = (event: DragEndEvent) => {
    try {
      const { active, over } = event;

      setIsDragging(false);

      // Handle drag cancellation or invalid drop
      if (!over || active.id === over.id) {
        return;
      }

      setSections((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        // Validate indices
        if (oldIndex === -1 || newIndex === -1) {
          console.warn('Invalid drag operation: section not found');
          return items;
        }

        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        
        // Additional validation: ensure we didn't lose any sections
        if (reorderedItems.length !== items.length) {
          console.error('Section count mismatch after drag operation');
          return items;
        }

        return reorderedItems;
      });
    } catch (error) {
      console.error('Error during drag operation:', error);
      setIsDragging(false);
    }
  };

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
          conclusionGuidance: existingCaseStudy.conclusionGuidance || '',
        });
        // Migrate existing sections to include type field if missing
        const migratedSections = (existingCaseStudy.sections || []).map(section => ({
          ...section,
          type: section.type || 'reading' // Default to reading for existing sections
        }));
        setSections(migratedSections);
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

      // Ensure we have at least one section
      if (sections.length === 0) {
        throw new Error('Case study must have at least one section');
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

      const totalPoints = calculateTotalPoints();
      
      const updateData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        conclusionGuidance: formData.conclusionGuidance.trim(),
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
                
                <RichTextEditor
                  label="Conclusion Guidance (Optional)"
                  content={formData.conclusionGuidance}
                  onChange={(content) => setFormData(prev => ({ ...prev, conclusionGuidance: content }))}
                  placeholder="Provide guidance for AI-generated learning conclusions..."
                  helperText="Optional: Guide the AI on what key themes, concepts, or learning objectives to emphasize in student conclusion summaries. Leave blank for general analysis."
                />

                <div className="bg-blue-50 p-4 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Total Points:</strong> {totalPoints} points across {sections.length} sections
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Drag mode indicator */}
            {isDragging && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800 font-medium">
                  📋 Drag mode active - Drop sections to reorder them
                </p>
              </div>
            )}

            {/* Sections with drag and drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sections.map(section => section.id)}
                strategy={verticalListSortingStrategy}
              >
                {sections.map((section, sectionIndex) => (
                  <SortableSection
                    key={section.id}
                    section={section}
                    sectionIndex={sectionIndex}
                    sections={sections}
                    isCollapsed={isDragging}
                    onSectionChange={handleSectionChange}
                    onRemoveSection={removeSection}
                    onAddQuestion={addQuestion}
                    onRemoveQuestion={removeQuestion}
                    onQuestionChange={handleQuestionChange}
                  />
                ))}
              </SortableContext>
            </DndContext>

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
