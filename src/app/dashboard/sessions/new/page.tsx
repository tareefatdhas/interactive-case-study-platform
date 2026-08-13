'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createSession, generateSessionCode, getCaseStudiesByTeacher, getCourse, getSession, updateSession } from '@/lib/firebase/firestore';
import { auth } from '@/lib/firebase/config';
import { getUserFacingError } from '@/lib/user-facing-error';
import { track } from '@/lib/analytics/events';
import { buildLessonMaterial, courseSourceWordCount } from '@/lib/course-sources';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import InlineMessage from '@/components/ui/InlineMessage';
import { AmbientLoading } from '@/components/motion';
import type { CaseStudy, Course, SessionInteraction, SessionInteractionType } from '@/types';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  BookOpen,
  Check,
  CircleHelp,
  Clock3,
  Cloud,
  Dices,
  FileText,
  GripVertical,
  HeartPulse,
  ListChecks,
  MessageCircle,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Repeat2,
  Trash2,
  Upload,
  UsersRound,
  X,
} from 'lucide-react';

const interactionOptions: Array<{
  type: SessionInteractionType;
  label: string;
  description: string;
  icon: typeof HeartPulse;
}> = [
  { type: 'pulse', label: 'Class Pulse', description: 'Check pace, confidence, or how the room feels.', icon: HeartPulse },
  { type: 'poll', label: 'Opinion poll', description: 'Open a discussion with the room’s starting view.', icon: BarChart3 },
  { type: 'quiz', label: 'Knowledge check', description: 'Reveal a misconception while there is time to reteach it.', icon: CircleHelp },
  { type: 'open-response', label: 'Short response', description: 'Gather questions or a brief reflection for review.', icon: MessageCircle },
  { type: 'word-cloud', label: 'Word cloud', description: 'Gather one word or a short phrase and show shared themes live.', icon: Cloud },
  { type: 'reflection', label: 'Exit reflection', description: 'Capture what changed and what students will carry forward.', icon: Sparkles },
  { type: 'team-formation', label: 'Form teams now', description: 'Let students create or join named teams during class.', icon: UsersRound },
  { type: 'peer-learning', label: 'Peer learning', description: 'Let students answer, discuss, then answer again.', icon: Repeat2 },
  { type: 'group-work', label: 'Group work', description: 'Give small groups a shared task, clock, and submission.', icon: UsersRound },
  { type: 'timer', label: 'Clock', description: 'Put focused thinking or working time into the session flow.', icon: Clock3 },
  { type: 'spin-wheel', label: 'Spin the wheel', description: 'Choose a student, team, or custom item with the room.', icon: Dices },
  { type: 'case-study', label: 'Case material', description: 'Open a prepared decision or reading.', icon: BookOpen },
];

const interactionGroups: Array<{
  label: string;
  description: string;
  types: SessionInteractionType[];
}> = [
  {
    label: 'Quick interactions',
    description: 'One focused classroom moment',
    types: ['pulse', 'poll', 'quiz', 'open-response', 'word-cloud', 'reflection'],
  },
  {
    label: 'Teaching flows',
    description: 'Several coordinated student steps',
    types: ['peer-learning', 'group-work'],
  },
  {
    label: 'Classroom tools',
    description: 'Support the room while you teach',
    types: ['timer', 'spin-wheel', 'team-formation'],
  },
];

const startingInteractions: SessionInteraction[] = [
  {
    id: 'arrival-pulse',
    type: 'pulse',
    title: 'Arrival pulse',
    prompt: 'How are you arriving today?',
    plannedTime: 'Start of class',
    durationMinutes: 2,
    options: ['Energized', 'Steady', 'A little tired', 'Overwhelmed', 'Prefer not to say'],
    resultVisibility: 'live',
  },
  {
    id: 'concept-check',
    type: 'poll',
    title: 'Concept check',
    prompt: 'Which idea needs another example?',
    plannedTime: 'After the first topic',
    durationMinutes: 3,
    options: ['Direct effects', 'Indirect effects', 'Switching costs', 'Market tipping'],
    resultVisibility: 'live',
  },
];

const getActivityPhase = (interaction: SessionInteraction, index: number, total: number) => {
  if (index === 0) return 'Opening';
  if (interaction.type === 'reflection' && index === total - 1) return 'Closing';
  return 'During class';
};

const defaultPrompt: Record<SessionInteractionType, string> = {
  pulse: 'How is the pace right now?',
  poll: 'Which option best matches your view?',
  quiz: 'Choose the best answer.',
  'open-response': 'What question is still unresolved?',
  'word-cloud': 'What one word best captures this idea?',
  'team-formation': 'Create a team name, add a short description, and choose the direction that fits your group.',
  'peer-learning': 'Choose the best answer. You will discuss it with a partner, then answer again.',
  'group-work': 'Work together on this prompt. Choose one note-taker to submit for your group.',
  timer: 'Use this time to think, write, or complete the task on screen.',
  'spin-wheel': 'Who or what should go next?',
  reflection: 'What will you take from this discussion?',
  'case-study': 'Open the case and review the first decision point.',
};

const MAX_LESSON_CHARS = 24_000;
const ACCEPTED_LESSON_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'text/tab-separated-values'];
const ACCEPTED_LESSON_EXTENSIONS = ['txt', 'md', 'markdown', 'csv', 'tsv'];

type GeneratedInteraction = Omit<SessionInteraction, 'id'>;

const isAcceptedLessonFile = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return ACCEPTED_LESSON_TYPES.includes(file.type) || ACCEPTED_LESSON_EXTENSIONS.includes(extension);
};

function NewSessionContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCaseStudyId = searchParams.get('caseStudyId');
  const preselectedCourseId = searchParams.get('courseId');
  const editingSessionId = searchParams.get('sessionId');

  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [interactions, setInteractions] = useState<SessionInteraction[]>(startingInteractions);
  const [lessonContent, setLessonContent] = useState('');
  const [lessonSourceName, setLessonSourceName] = useState('');
  const [selectedCourseSourceIds, setSelectedCourseSourceIds] = useState<string[]>([]);
  const [generatingInteractions, setGeneratingInteractions] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generationNotice, setGenerationNotice] = useState('');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [caseMaterialOpen, setCaseMaterialOpen] = useState(false);
  const [expandedInteractionId, setExpandedInteractionId] = useState<string | null>(null);
  const [draggingInteractionId, setDraggingInteractionId] = useState<string | null>(null);
  const [dragOverInteractionId, setDragOverInteractionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const lessonFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAddMenuOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [addMenuOpen]);

  useEffect(() => {
    const loadPlanningData = async () => {
      if (!user) return;
      try {
        const [studies, session] = await Promise.all([
          getCaseStudiesByTeacher(user.uid),
          editingSessionId ? getSession(editingSessionId) : Promise.resolve(null),
        ]);
        if (editingSessionId && !session) {
          setError('This session could not be found.');
          return;
        }

        const courseId = preselectedCourseId || session?.courseId;
        const course = courseId ? await getCourse(courseId) : null;
        setCaseStudies(studies);

        if (course) {
          setSelectedCourse(course);
          setCourseCode(course.code);
          setCourseName(course.name);
          if (!session) {
            setInteractions([]);
            setExpandedInteractionId(null);
          }
        } else if (session) {
          setCourseCode(session.courseCode || '');
          setCourseName(session.courseName || '');
        }

        if (session) {
          setSessionTitle(session.title || '');
          setScheduledFor(session.scheduledFor || '');
          setInteractions(session.interactions || []);
          setSelectedCourseSourceIds(session.courseSourceIds || []);
          setExpandedInteractionId(session.interactions?.[0]?.id || null);
        }

        const selectedCase = studies.find((study) => study.id === preselectedCaseStudyId);
        if (selectedCase && !session) {
          setInteractions((current) => [
            ...current,
            {
              id: `case-${selectedCase.id}`,
              type: 'case-study',
              title: selectedCase.title,
              prompt: 'Open the case and review the first decision point.',
              plannedTime: 'During class',
              durationMinutes: 15,
              caseStudyId: selectedCase.id,
            },
          ]);
        }
      } catch (loadError) {
        console.error('Error loading lesson material:', loadError);
        setError('Lesson material could not be loaded. You can still prepare this session.');
      } finally {
        setLoading(false);
      }
    };

    loadPlanningData();
  }, [editingSessionId, preselectedCaseStudyId, preselectedCourseId, user]);

  const estimatedMinutes = useMemo(
    () => interactions.reduce((total, interaction) => total + (interaction.durationMinutes || 0), 0),
    [interactions],
  );

  const lessonMaterial = useMemo(() => buildLessonMaterial(
    selectedCourse?.courseSources || [],
    selectedCourseSourceIds,
    lessonContent,
  ), [lessonContent, selectedCourse?.courseSources, selectedCourseSourceIds]);

  const relevantCaseStudies = useMemo(() => selectedCourse
    ? caseStudies.filter((caseStudy) => caseStudy.courseId === selectedCourse.id || caseStudy.courseId === 'default')
    : caseStudies,
  [caseStudies, selectedCourse]);

  const addInteraction = (type: SessionInteractionType, caseStudy?: CaseStudy) => {
    const option = interactionOptions.find((item) => item.type === type);
    const interactionId = `${type}-${Date.now()}`;
    setInteractions((current) => [
      ...current,
      {
        id: interactionId,
        type,
        title: caseStudy?.title || option?.label || 'Class activity',
        prompt: defaultPrompt[type],
        plannedTime: 'During class',
        durationMinutes: type === 'case-study' ? 15 : type === 'group-work' ? 8 : type === 'timer' ? 5 : type === 'word-cloud' || type === 'spin-wheel' ? 2 : 3,
        discussionMinutes: type === 'peer-learning' ? 2 : undefined,
        groupSize: type === 'group-work' ? 4 : undefined,
        teamTags: type === 'team-formation' ? (selectedCourse?.teamTags?.length ? selectedCourse.teamTags : ['Theme 1', 'Theme 2', 'Theme 3']) : undefined,
        requireTeamTag: type === 'team-formation' ? true : undefined,
        caseStudyId: caseStudy?.id,
        options: type === 'pulse'
          ? ['Very low', 'Low', 'Steady', 'High', 'Very high']
          : type === 'poll' || type === 'quiz' || type === 'peer-learning'
            ? ['Option 1', 'Option 2', 'Option 3', 'Option 4']
            : undefined,
        correctOptionIndex: type === 'quiz' || type === 'peer-learning' ? 0 : undefined,
        explanation: type === 'quiz' || type === 'peer-learning' ? 'Explain why this answer is correct.' : undefined,
        wheelSource: type === 'spin-wheel' ? 'students' : undefined,
        wheelItems: type === 'spin-wheel' ? [] : undefined,
        wheelRemoveSelected: type === 'spin-wheel' ? true : undefined,
        resultVisibility: type === 'quiz' || type === 'peer-learning' ? 'after-reveal' : type === 'open-response' || type === 'group-work' || type === 'reflection' ? 'instructor-only' : 'live',
      },
    ]);
    setExpandedInteractionId(interactionId);
    setAddMenuOpen(false);
    window.setTimeout(() => document.getElementById(`activity-${interactionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const addLibraryInteraction = (template: SessionInteraction) => {
    const interactionId = `session-${template.type}-${Date.now()}-${interactions.length}`;
    setInteractions((current) => [
      ...current,
      { ...template, id: interactionId },
    ]);
    setExpandedInteractionId(interactionId);
    setAddMenuOpen(false);
    window.setTimeout(() => document.getElementById(`activity-${interactionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const updateInteraction = (id: string, updates: Partial<SessionInteraction>) => {
    setInteractions((current) => current.map((interaction) => (
      interaction.id === id ? { ...interaction, ...updates } : interaction
    )));
  };

  const updateTimerDuration = (interaction: SessionInteraction, part: 'minutes' | 'seconds', value: number) => {
    const currentSeconds = Math.max(1, Math.round((interaction.durationMinutes || 0) * 60));
    const minutes = part === 'minutes' ? Math.min(99, Math.max(0, value)) : Math.floor(currentSeconds / 60);
    const seconds = part === 'seconds' ? Math.min(59, Math.max(0, value)) : currentSeconds % 60;
    updateInteraction(interaction.id, { durationMinutes: Math.max(1, minutes * 60 + seconds) / 60 });
  };

  const updateOption = (interactionId: string, optionIndex: number, value: string) => {
    setInteractions((current) => current.map((interaction) => {
      if (interaction.id !== interactionId || !interaction.options) return interaction;
      const options = [...interaction.options];
      options[optionIndex] = value;
      return { ...interaction, options };
    }));
  };

  const addOption = (interactionId: string) => {
    setInteractions((current) => current.map((interaction) => (
      interaction.id === interactionId && interaction.options && interaction.options.length < 6
        ? { ...interaction, options: [...interaction.options, `Option ${interaction.options.length + 1}`] }
        : interaction
    )));
  };

  const removeOption = (interactionId: string, optionIndex: number) => {
    setInteractions((current) => current.map((interaction) => {
      if (interaction.id !== interactionId || !interaction.options || interaction.options.length <= 2) return interaction;
      const options = interaction.options.filter((_, index) => index !== optionIndex);
      const correctOptionIndex = interaction.correctOptionIndex === undefined
        ? undefined
        : Math.min(interaction.correctOptionIndex, options.length - 1);
      return { ...interaction, options, correctOptionIndex };
    }));
  };

  const moveInteraction = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= interactions.length) return;
    setInteractions((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const reorderInteraction = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setInteractions((current) => {
      const sourceIndex = current.findIndex((interaction) => interaction.id === sourceId);
      const targetIndex = current.findIndex((interaction) => interaction.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleDropInteraction = (targetId: string) => {
    if (draggingInteractionId) reorderInteraction(draggingInteractionId, targetId);
    setDraggingInteractionId(null);
    setDragOverInteractionId(null);
  };

  const focusInteraction = (id: string) => {
    setExpandedInteractionId(id);
    window.setTimeout(() => document.getElementById(`activity-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 20);
  };

  const removeInteraction = (id: string) => {
    setInteractions((current) => current.filter((interaction) => interaction.id !== id));
    setExpandedInteractionId((current) => current === id ? null : current);
  };

  const handleLessonFile = async (file: File | undefined) => {
    if (!file) return;
    setGenerationError('');
    setGenerationNotice('');

    if (!isAcceptedLessonFile(file)) {
      setGenerationError('Use a plain-text file: .txt, .md, .csv, or .tsv. Paste content from a document or PDF instead.');
      return;
    }
    if (file.size > 300_000) {
      setGenerationError('Choose a text file smaller than 300 KB, or paste the relevant lesson excerpt.');
      return;
    }

    try {
      const text = await file.text();
      const trimmed = text.trim().slice(0, MAX_LESSON_CHARS);
      if (trimmed.length < 80) {
        setGenerationError('That file does not contain enough text to draft class questions.');
        return;
      }
      setLessonContent(trimmed);
      setLessonSourceName(file.name);
      setGenerationNotice(trimmed.length < text.trim().length ? 'The first 24,000 characters were added for review.' : `${file.name} is ready to review.`);
    } catch {
      setGenerationError('That file could not be read. Paste the lesson text instead.');
    } finally {
      if (lessonFileInputRef.current) lessonFileInputRef.current.value = '';
    }
  };

  const handleGenerateInteractions = async () => {
    const trimmedLesson = lessonMaterial.trim();
    if (trimmedLesson.length < 80) {
      setGenerationError('Choose a course source, or paste a short section of lesson material first.');
      return;
    }

    setGeneratingInteractions(true);
    setGenerationError('');
    setGenerationNotice('');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Sign in again before drafting interactions.');
      const response = await fetch('/api/generate-session-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          lessonContent: trimmedLesson,
          sessionTitle,
          courseCode,
          courseName,
        }),
      });
      const data = await response.json() as { interactions?: GeneratedInteraction[]; error?: string };
      if (!response.ok || !data.interactions) {
        throw new Error(data.error || 'The question drafts could not be generated.');
      }

      const drafts: SessionInteraction[] = data.interactions.map((interaction, index) => ({
        ...interaction,
        id: `generated-${interaction.type}-${Date.now()}-${index}`,
      }));
      setInteractions((current) => [...current, ...drafts]);
      setExpandedInteractionId(drafts[0]?.id || null);
      if (drafts[0]) window.setTimeout(() => document.getElementById(`activity-${drafts[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      setGenerationNotice('Four drafts were added below. Review the wording, choices, and correct answer before saving.');
      track('session_interactions_generated', { interaction_count: drafts.length });
    } catch (generationIssue: unknown) {
      setGenerationError(getUserFacingError(generationIssue, 'The question drafts could not be generated. Check your connection and try again.'));
    } finally {
      setGeneratingInteractions(false);
    }
  };

  const handleSaveSession = async () => {
    if (!user || !courseCode.trim() || !sessionTitle.trim()) return;
    setCreating(true);
    setError('');

    try {
      const normalizedInteractions = interactions.map((interaction, index) => ({
        ...interaction,
        plannedTime: getActivityPhase(interaction, index, interactions.length),
      }));

      if (editingSessionId) {
        await updateSession(editingSessionId, {
          title: sessionTitle.trim(),
          ...(selectedCourse?.id ? { courseId: selectedCourse.id } : {}),
          courseCode: courseCode.trim(),
          ...(selectedCourse ? { rewardScopeId: selectedCourse.rewardScopeId || selectedCourse.code } : {}),
          courseName: courseName.trim(),
          ...(scheduledFor ? { scheduledFor } : {}),
          presentationMode: 'external',
          interactions: normalizedInteractions,
          courseSourceIds: selectedCourseSourceIds,
        });
        router.push(`/dashboard/sessions/${editingSessionId}`);
        return;
      }

      const sessionId = await createSession({
        sessionCode: generateSessionCode(),
        sessionType: 'standalone',
        title: sessionTitle.trim(),
        courseId: selectedCourse?.id,
        courseCode: courseCode.trim(),
        rewardScopeId: selectedCourse ? selectedCourse.rewardScopeId || selectedCourse.code : courseCode.trim(),
        courseName: courseName.trim(),
        presentationMode: 'external',
        interactions: normalizedInteractions,
        courseSourceIds: selectedCourseSourceIds,
        teacherId: selectedCourse?.teacherId || user.uid,
        active: false,
        studentsJoined: [],
        releasedSections: [],
        currentReleasedSection: -1,
        sections: [],
      });

      track('session_created', { session_type: 'standalone', interaction_count: normalizedInteractions.length });
      router.push(`/dashboard/sessions/${sessionId}`);
    } catch (createError: unknown) {
      setError(getUserFacingError(createError, 'The session flow could not be saved. Your work is still here, so you can try again.'));
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="grid min-h-96 place-items-center" role="status" aria-label="Loading session setup">
            <AmbientLoading className="w-44 rounded-full" announce="off" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <main className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-10">
          <button type="button" onClick={() => router.back()} className="seminar-focus mb-6 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[#697087] hover:text-[#101a38]">
            <ArrowLeft className="h-4 w-4" /> {selectedCourse ? `Back to ${selectedCourse.code}` : 'Back to sessions'}
          </button>

          <div className="mb-8 max-w-3xl">
            <p className="seminar-eyebrow mb-3">Session plan</p>
            <h1 className="seminar-display text-4xl leading-tight text-[#101a38] sm:text-5xl">{editingSessionId ? 'Refine this session.' : 'Plan the moments between your slides.'}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-[#697087]">Name the session, then add only the activities you expect to use.</p>
          </div>

          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-8">
              <section className="rounded-2xl border border-[#e3e5ed] bg-white p-6 sm:p-7" aria-labelledby="class-details-title">
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0efff] text-[#5146e5]"><ListChecks className="h-5 w-5" /></span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#697087]">{selectedCourse ? 'Planning for' : 'Session details'}</p>
                    <h2 id="class-details-title" className="mt-0.5 text-base font-semibold text-[#101a38]">{selectedCourse ? `${selectedCourse.code} · ${selectedCourse.name}` : 'Name the class and session'}</h2>
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  {!selectedCourse && (
                    <>
                      <Input label="Class code" value={courseCode} onChange={(event) => setCourseCode(event.target.value)} placeholder="ECON 302" />
                      <Input label="Class name" value={courseName} onChange={(event) => setCourseName(event.target.value)} placeholder="Intermediate Microeconomics" />
                    </>
                  )}
                  <div className="sm:col-span-2">
                    <Input label="Session title" value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} placeholder="Session 6 · Platform strategy" />
                    <p className="mt-2 text-xs leading-5 text-[#697087]">Use the name students will recognize when you review this class later.</p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[#e3e5ed] bg-white p-6 sm:p-7" aria-labelledby="interaction-plan-title">
                <div className="flex flex-col gap-4 border-b border-[#e3e5ed] pb-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="seminar-eyebrow mb-2">Session flow</p>
                    <h2 id="interaction-plan-title" className="seminar-display text-3xl text-[#101a38]">Activities in teaching order</h2>
                    <p className="mt-2 text-sm text-[#697087]">Add only what you expect to use. Every activity stays private until you launch it.</p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <Button type="button" onClick={() => { setCaseMaterialOpen(false); setAddMenuOpen(true); }} className="w-full gap-2 px-5 py-2.5 shadow-[0_3px_0_#342bb3,0_9px_20px_rgba(81,70,229,0.22)] transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_0_#342bb3,0_12px_24px_rgba(81,70,229,0.25)] active:translate-y-[2px] active:shadow-[0_1px_0_#342bb3,0_4px_10px_rgba(81,70,229,0.18)] motion-reduce:transform-none sm:w-auto">
                      <Plus className="h-4 w-4" /> Add an activity
                    </Button>
                  </div>
                </div>

                {aiDraftOpen && <section id="activity-ai-drafts" className="mt-6 rounded-2xl border border-[#e3e5ed] bg-[#f7f6ff]">
                  <div className="flex items-center justify-between gap-4 rounded-2xl p-5">
                    <div>
                      <p className="text-sm font-semibold text-[#101a38]">Draft activities with AI</p>
                      <p className="mt-1 text-xs leading-5 text-[#697087]">Optional: turn lesson notes into editable question drafts.</p>
                    </div>
                    <button type="button" onClick={() => setAiDraftOpen(false)} className="seminar-focus grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#d7dae5] bg-white text-[#697087] hover:text-[#101a38]" aria-label="Close AI activity drafts"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="border-t border-[#dcd8ff] p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="seminar-display text-2xl text-[#101a38]">Draft questions from this class</h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#697087]">Choose saved course sources, paste an excerpt, or upload a text file. Every draft can be reviewed before you save.</p>
                        <div className="mt-4 flex max-w-2xl items-start gap-2 rounded-xl border border-[#dcd8ff] bg-[#f6f4ff] p-3 text-xs leading-5 text-[#555d73]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#5146e5]" /><span>Use teaching material only. Do not upload student names, numbers, grades, health information, or private submissions. This text is sent to the configured AI service to draft questions.</span></div>
                      </div>
                    <input
                      ref={lessonFileInputRef}
                      type="file"
                      accept=".txt,.md,.markdown,.csv,.tsv,text/plain,text/markdown,text/csv,text/tab-separated-values"
                      className="hidden"
                      onChange={(event) => handleLessonFile(event.target.files?.[0])}
                    />
                    <Button type="button" variant="outline" onClick={() => lessonFileInputRef.current?.click()} className="shrink-0 gap-2">
                      <Upload className="h-4 w-4" /> Upload text file
                    </Button>
                  </div>

                  {selectedCourse?.courseSources?.length ? <fieldset className="mt-5 rounded-2xl border border-[#dedaf8] bg-white p-4">
                    <legend className="px-1 text-sm font-bold text-[#101a38]">Use saved course sources</legend>
                    <p className="mb-3 text-xs leading-5 text-[#697087]">Select only what is relevant to this session.</p>
                    <div className="grid gap-2 sm:grid-cols-2">{selectedCourse.courseSources.map((source) => {
                      const selected = selectedCourseSourceIds.includes(source.id);
                      return <button key={source.id} type="button" aria-pressed={selected} onClick={() => { setSelectedCourseSourceIds((current) => selected ? current.filter((sourceId) => sourceId !== source.id) : [...current, source.id]); setGenerationError(''); setGenerationNotice(''); }} className={`seminar-focus flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-[#5146e5] bg-[#f0efff]' : 'border-[#e3e5ed] bg-white hover:border-[#bdb6ff]'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${selected ? 'bg-[#5146e5] text-white' : 'bg-[#f4f3f8] text-[#697087]'}`}>{selected ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span><span className="min-w-0"><strong className="block truncate text-sm text-[#101a38]">{source.title}</strong><small className="block text-[#697087]">{courseSourceWordCount(source.content).toLocaleString()} words</small></span></button>;
                    })}</div>
                  </fieldset> : selectedCourse ? <div className="mt-5 rounded-xl border border-dashed border-[#cfd2df] bg-white p-4 text-sm leading-6 text-[#697087]">No saved course sources yet. Add them from the class Interactions view, or paste material below.</div> : null}

                  <textarea
                    aria-label="Lesson material for question drafts"
                    value={lessonContent}
                    onChange={(event) => {
                      setLessonContent(event.target.value.slice(0, MAX_LESSON_CHARS));
                      setLessonSourceName('');
                      setGenerationError('');
                      setGenerationNotice('');
                    }}
                    rows={8}
                    maxLength={MAX_LESSON_CHARS}
                    placeholder="Add any session-specific excerpt or note. Leave this blank if the selected course sources are enough."
                    className="mt-5 w-full resize-y rounded-xl border border-[#d7dae5] bg-white px-3.5 py-3 text-sm leading-6 text-[#313950] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]"
                  />
                  <div className="mt-3 flex flex-col gap-3 text-xs leading-5 text-[#697087] sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {lessonSourceName || 'Plain text only: .txt, .md, .csv, or .tsv'}</span>
                    <span>{lessonMaterial.length.toLocaleString()} characters ready for drafting</span>
                  </div>
                  {generationError && <InlineMessage className="mt-3" title="The question draft needs another try." message={generationError} />}
                  {generationNotice && <p className="mt-3 rounded-lg border border-[#cce8d2] bg-[#f2fbf4] px-3 py-2 text-sm leading-6 text-[#296e3c]" role="status">{generationNotice}</p>}
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-[#5a6278]">Creates one pulse, poll, knowledge check, and short response. You can edit or remove every draft.</p>
                    <Button type="button" onClick={handleGenerateInteractions} loading={generatingInteractions} disabled={lessonMaterial.trim().length < 80} className="shrink-0 gap-2">
                      <Sparkles className="h-4 w-4" /> Draft activities
                    </Button>
                  </div>
                  </div>
                </section>}

                {addMenuOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#101a38]/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddMenuOpen(false); }}>
                  <section role="dialog" aria-modal="true" aria-labelledby="activity-chooser-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] border border-[#dedfe8] bg-[#fffefa] shadow-[0_28px_90px_rgba(16,26,56,0.22)] sm:max-w-6xl sm:rounded-[28px]">
                    <header className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-[#e3e5ed] bg-[#fffefa]/95 px-5 py-5 backdrop-blur sm:px-7">
                      <div><p className="seminar-eyebrow mb-2">Add to this session</p><h3 id="activity-chooser-title" className="seminar-display text-3xl text-[#101a38]">Choose the next classroom moment</h3><p className="mt-1 text-sm text-[#697087]">Compare what you have saved with every available format.</p></div>
                      <button type="button" onClick={() => setAddMenuOpen(false)} className="seminar-focus grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#d7dae5] bg-white text-[#697087] hover:text-[#101a38]" aria-label="Close activity chooser"><X className="h-4 w-4" /></button>
                    </header>
                    <div className="p-5 sm:p-7">
                      {(selectedCourse?.interactionTemplates?.length || 0) > 0 && <section aria-labelledby="saved-activities-title">
                        <div className="mb-3 flex items-end justify-between gap-4"><div><h4 id="saved-activities-title" className="text-sm font-bold text-[#101a38]">Saved for {selectedCourse?.code}</h4><p className="mt-0.5 text-xs text-[#697087]">Familiar activities you can reuse and adjust.</p></div><span className="rounded-full bg-[#f0efff] px-2.5 py-1 text-[11px] font-bold text-[#5146e5]">{selectedCourse?.interactionTemplates?.length} saved</span></div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{selectedCourse?.interactionTemplates?.map((template) => { const option = interactionOptions.find((item) => item.type === template.type); const Icon = option?.icon || Sparkles; return <button key={template.id} type="button" onClick={() => addLibraryInteraction(template)} className="seminar-focus group flex min-h-20 items-center gap-3 rounded-xl border border-[#dedaf8] bg-[#f8f7ff] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#bcb5ff] hover:shadow-sm"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#5146e5]"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><small className="font-bold uppercase tracking-[0.06em] text-[#6a61d7]">{option?.label || 'Activity'}</small><strong className="mt-0.5 block truncate text-sm text-[#101a38]">{template.title}</strong><span className="mt-0.5 block truncate text-xs text-[#697087]">{template.prompt}</span></span><Plus className="h-4 w-4 shrink-0 text-[#8e94a6] group-hover:text-[#5146e5]" /></button>; })}</div>
                      </section>}

                      <section className={(selectedCourse?.interactionTemplates?.length || 0) > 0 ? 'mt-7 border-t border-[#e3e5ed] pt-6' : ''} aria-labelledby="fresh-activities-title">
                        <div className="mb-3"><h4 id="fresh-activities-title" className="text-sm font-bold text-[#101a38]">Start with a format</h4><p className="mt-0.5 text-xs text-[#697087]">Choose the classroom job first. Edit the wording after it enters the session plan.</p></div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{interactionGroups.flatMap((group) => group.types.map((type) => ({ type, group: group.label }))).map(({ type, group }) => { const option = interactionOptions.find((item) => item.type === type); if (!option) return null; const Icon = option.icon; return <button key={type} type="button" onClick={() => addInteraction(type)} className="seminar-focus group flex min-h-24 flex-col items-start rounded-xl border border-[#e3e5ed] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-[#bdb6ff] hover:shadow-sm"><span className="flex w-full items-start justify-between gap-2"><i className="grid h-9 w-9 place-items-center rounded-lg bg-[#f0efff] text-[#5146e5]"><Icon className="h-4 w-4" /></i><small className="line-clamp-1 pt-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#8a90a2]">{group}</small></span><strong className="mt-2 block text-sm leading-5 text-[#101a38]">{option.label}</strong><small className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[#697087]">{option.description}</small></button>; })}</div>
                      </section>

                      <div className="mt-6 grid gap-2 sm:grid-cols-2">
                        {relevantCaseStudies.length > 0 && <button type="button" aria-expanded={caseMaterialOpen} onClick={() => setCaseMaterialOpen((open) => !open)} className="seminar-focus flex min-h-[72px] items-center gap-3 rounded-xl border border-[#e3e5ed] bg-white p-3 text-left hover:border-[#bdb6ff]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f4f3f8] text-[#5146e5]"><BookOpen className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-[#101a38]">Prepared case material</strong><small className="mt-0.5 block text-xs text-[#697087]">{relevantCaseStudies.length} longer discussions and readings</small></span><ArrowDown className={`h-4 w-4 shrink-0 text-[#697087] transition-transform ${caseMaterialOpen ? 'rotate-180' : ''}`} /></button>}
                        <button type="button" onClick={() => { setAddMenuOpen(false); setAiDraftOpen(true); window.setTimeout(() => document.getElementById('activity-ai-drafts')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }} className="seminar-focus flex min-h-[72px] items-center gap-3 rounded-xl border border-[#dedaf8] bg-[#f7f6ff] p-3 text-left hover:border-[#bdb6ff]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#5146e5]"><Sparkles className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-[#101a38]">Draft activities with AI</strong><small className="mt-0.5 block text-xs text-[#697087]">Use lesson notes or saved course sources</small></span><ArrowDown className="h-4 w-4 shrink-0 -rotate-90 text-[#5146e5]" /></button>
                      </div>
                      {caseMaterialOpen && <section className="mt-3 rounded-2xl border border-[#e3e5ed] bg-[#faf9fc] p-3" aria-label="Prepared case material"><div className="grid gap-2 sm:grid-cols-2">{relevantCaseStudies.slice(0, 6).map((caseStudy) => <button key={caseStudy.id} type="button" onClick={() => addInteraction('case-study', caseStudy)} className="seminar-focus flex min-h-16 items-center gap-3 rounded-xl border border-[#e3e5ed] bg-white p-3 text-left hover:border-[#bdb6ff]"><BookOpen className="h-4 w-4 shrink-0 text-[#5146e5]" /><span className="line-clamp-2 text-sm font-semibold text-[#101a38]">{caseStudy.title}</span><Plus className="ml-auto h-4 w-4 shrink-0 text-[#8e94a6]" /></button>)}</div></section>}
                    </div>
                  </section>
                </div>}

                {interactions.length === 0 && (
                  <div className="mt-6 rounded-2xl border border-dashed border-[#cbc7e8] bg-[#faf9fc] px-6 py-10 text-center">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0efff] text-[#5146e5]"><Plus className="h-5 w-5" /></span>
                    <h3 className="mt-4 text-base font-semibold text-[#101a38]">Your session flow starts here</h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#697087]">Choose from your class library or add an activity. You can change the order at any time.</p>
                  </div>
                )}

                <div className="mt-3">
                  {interactions.map((interaction, index) => {
                    const option = interactionOptions.find((item) => item.type === interaction.type);
                    const Icon = option?.icon || ListChecks;
                    const isExpanded = expandedInteractionId === interaction.id;
                    const phase = getActivityPhase(interaction, index, interactions.length);
                    const hasSideSettings = interaction.type === 'timer' || interaction.type === 'group-work';
                    return (
                      <article
                        id={`activity-${interaction.id}`}
                        key={interaction.id}
                        onDragOver={(event) => {
                          if (!draggingInteractionId || draggingInteractionId === interaction.id) return;
                          event.preventDefault();
                          setDragOverInteractionId(interaction.id);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleDropInteraction(interaction.id);
                        }}
                        className={`my-3 overflow-hidden rounded-2xl border bg-white transition-[border-color,box-shadow,transform] duration-200 ${isExpanded ? 'border-[#bdb7ff] shadow-[0_14px_38px_rgba(56,46,150,0.09)]' : 'border-[#e3e5ed] hover:border-[#cbc7e8]'} ${dragOverInteractionId === interaction.id ? 'translate-y-1 border-[#5146e5]' : ''}`}
                      >
                        <div className="flex min-h-20 items-center gap-3 px-3 py-3 sm:px-4">
                          <span
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/plain', interaction.id);
                              setDraggingInteractionId(interaction.id);
                            }}
                            onDragEnd={() => {
                              setDraggingInteractionId(null);
                              setDragOverInteractionId(null);
                            }}
                            className="hidden cursor-grab rounded-lg p-2 text-[#a0a5b4] hover:bg-[#f7f6fb] hover:text-[#5146e5] active:cursor-grabbing sm:block"
                            aria-label={`Drag ${interaction.title} to reorder`}
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0efff] text-[#5146e5]"><Icon className="h-4.5 w-4.5" /></span>
                          <button type="button" onClick={() => setExpandedInteractionId(isExpanded ? null : interaction.id)} className="seminar-focus min-w-0 flex-1 rounded-lg text-left">
                            <span className="flex items-center gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#5146e5]">{index + 1}. {option?.label || 'Class activity'}</span>
                              <span className="hidden truncate text-[11px] text-[#8a90a2] sm:inline">· {phase}</span>
                            </span>
                            <strong className="mt-1 block truncate text-sm text-[#101a38]">{interaction.title || 'Untitled activity'}</strong>
                            {!isExpanded && <span className="mt-0.5 block truncate text-xs text-[#697087]">{interaction.prompt}</span>}
                          </button>
                          <span className="hidden rounded-full bg-[#f7f6fb] px-2.5 py-1 text-[11px] font-semibold text-[#697087] lg:inline">{Math.ceil(interaction.durationMinutes || 0)} min</span>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button type="button" onClick={() => moveInteraction(index, -1)} disabled={index === 0} className="seminar-focus rounded-lg p-2 text-[#858b9d] hover:bg-[#f8f7fb] hover:text-[#101a38] disabled:opacity-25" aria-label={`Move ${interaction.title} up`}><ArrowUp className="h-4 w-4" /></button>
                            <button type="button" onClick={() => moveInteraction(index, 1)} disabled={index === interactions.length - 1} className="seminar-focus rounded-lg p-2 text-[#858b9d] hover:bg-[#f8f7fb] hover:text-[#101a38] disabled:opacity-25" aria-label={`Move ${interaction.title} down`}><ArrowDown className="h-4 w-4" /></button>
                            <button type="button" onClick={() => removeInteraction(interaction.id)} className="seminar-focus rounded-lg p-2 text-[#858b9d] hover:bg-[#fff1ee] hover:text-[#b64936]" aria-label={`Remove ${interaction.title}`}><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                        {isExpanded && <div className={`grid gap-5 border-t border-[#e7e5f0] bg-[#fdfcff] p-4 sm:p-5 ${hasSideSettings ? 'md:grid-cols-[minmax(0,1fr)_180px] md:items-start' : ''}`}>
                        <div className="space-y-3">
                          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#5146e5]">Edit activity</p>
                          <Input aria-label="Interaction title" value={interaction.title} onChange={(event) => updateInteraction(interaction.id, { title: event.target.value })} />
                          <textarea aria-label="Prompt" value={interaction.prompt} onChange={(event) => updateInteraction(interaction.id, { prompt: event.target.value })} rows={2} className="w-full resize-none rounded-xl border border-[#d7dae5] bg-white px-3.5 py-3 text-sm leading-6 text-[#313950] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" />
                          {interaction.options && (
                            <div className="rounded-xl border border-[#e3e5ed] bg-[#faf9fc] p-3.5">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold text-[#4f576d]">{interaction.type === 'quiz' || interaction.type === 'peer-learning' ? 'Answer choices and correct answer' : 'Response choices'}</p>
                                {interaction.options.length < 6 && <button type="button" onClick={() => addOption(interaction.id)} className="seminar-focus text-xs font-bold text-[#5146e5]"><Plus className="mr-1 inline h-3.5 w-3.5" />Add choice</button>}
                              </div>
                              <div className="space-y-2">
                                {interaction.options.map((choice, optionIndex) => (
                                  <div className="flex items-center gap-2" key={`${interaction.id}-${optionIndex}`}>
                                    {interaction.type === 'quiz' || interaction.type === 'peer-learning' ? (
                                      <input
                                        type="radio"
                                        name={`correct-${interaction.id}`}
                                        aria-label={`Mark choice ${optionIndex + 1} correct`}
                                        checked={interaction.correctOptionIndex === optionIndex}
                                        onChange={() => updateInteraction(interaction.id, { correctOptionIndex: optionIndex })}
                                        className="h-4 w-4 accent-[#5146e5]"
                                      />
                                    ) : <span className="w-4 text-center text-xs font-bold text-[#8b91a3]">{String.fromCharCode(65 + optionIndex)}</span>}
                                    <input
                                      aria-label={`Choice ${optionIndex + 1}`}
                                      value={choice}
                                      onChange={(event) => updateOption(interaction.id, optionIndex, event.target.value)}
                                      className="min-h-10 flex-1 rounded-lg border border-[#d7dae5] bg-white px-3 text-sm text-[#313950] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]"
                                    />
                                    <button type="button" onClick={() => removeOption(interaction.id, optionIndex)} disabled={interaction.options!.length <= 2} className="seminar-focus rounded-md p-2 text-[#8b91a3] hover:text-[#b64936] disabled:opacity-25" aria-label={`Remove choice ${optionIndex + 1}`}><X className="h-3.5 w-3.5" /></button>
                                  </div>
                                ))}
                              </div>
                              {(interaction.type === 'quiz' || interaction.type === 'peer-learning') && <p className="mt-2 pl-6 text-[11px] text-[#697087]">Select the circle beside the correct answer.</p>}
                            </div>
                          )}
                          {(interaction.type === 'quiz' || interaction.type === 'peer-learning') && (
                            <textarea aria-label="Answer explanation" value={interaction.explanation || ''} onChange={(event) => updateInteraction(interaction.id, { explanation: event.target.value })} rows={2} placeholder="Explain the answer after students respond" className="w-full resize-none rounded-xl border border-[#d7dae5] bg-white px-3.5 py-3 text-sm leading-6 text-[#313950] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" />
                          )}
                          {interaction.type === 'quiz' && <div className="rounded-xl border border-[#dedaf8] bg-[#f7f6ff] p-3.5"><label className="flex min-h-10 items-center gap-3 text-xs font-bold text-[#4f576d]"><input type="checkbox" checked={Boolean(interaction.speedBonusEnabled)} onChange={(event) => updateInteraction(interaction.id, { speedBonusEnabled: event.target.checked, speedBonusSeconds: event.target.checked ? interaction.speedBonusSeconds || 40 : undefined, maxSpeedBonusPoints: event.target.checked ? 4 : undefined })} className="h-4 w-4 accent-[#5146e5]" /> Add a speed bonus</label>{interaction.speedBonusEnabled && <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#dedaf8] pt-3"><label className="flex items-center gap-2 text-xs font-semibold text-[#555d73]">Bonus window <input type="number" min={10} max={120} step={5} value={interaction.speedBonusSeconds || 40} onChange={(event) => updateInteraction(interaction.id, { speedBonusSeconds: Math.min(120, Math.max(10, Number(event.target.value) || 40)) })} className="w-16 rounded-lg border border-[#d7dae5] bg-white px-2 py-1.5" /> sec</label><span className="text-[11px] text-[#697087]">8 points for a correct answer, plus up to 4 for speed.</span></div>}</div>}
                          {interaction.type === 'peer-learning' && <label className="flex items-center gap-3 rounded-xl bg-[#f7f6ff] px-3.5 py-3 text-xs font-semibold text-[#4f576d]"><Repeat2 className="h-4 w-4 text-[#5146e5]" /> Partner discussion <input aria-label="Partner discussion minutes" type="number" min={1} max={10} value={interaction.discussionMinutes || 2} onChange={(event) => updateInteraction(interaction.id, { discussionMinutes: Number(event.target.value) })} className="ml-auto w-16 rounded-lg border border-[#d7dae5] bg-white px-2 py-1.5 text-[#313950]" /> min</label>}
                          {interaction.type === 'group-work' && <label className="flex items-center gap-3 rounded-xl bg-[#fff7f2] px-3.5 py-3 text-xs font-semibold text-[#4f576d]"><UsersRound className="h-4 w-4 text-[#c85540]" /> Suggested group size <input aria-label="Suggested group size" type="number" min={2} max={10} value={interaction.groupSize || 4} onChange={(event) => updateInteraction(interaction.id, { groupSize: Number(event.target.value) })} className="ml-auto w-16 rounded-lg border border-[#e4d7d1] bg-white px-2 py-1.5 text-[#313950]" /> students</label>}
                          {interaction.type === 'timer' && <p className="rounded-lg bg-[#f7f6ff] px-3 py-2 text-xs leading-5 text-[#5a6278]">The clock starts when you launch this activity. Students see the prompt and the same countdown on their phones.</p>}
                          {interaction.type === 'open-response' && <p className="rounded-lg bg-[#f7f6ff] px-3 py-2 text-xs leading-5 text-[#5a6278]">Written responses stay on the instructor screen. You choose what appears on the projector.</p>}
                          {interaction.type === 'word-cloud' && <p className="rounded-lg bg-[#f7f6ff] px-3 py-2 text-xs leading-5 text-[#5a6278]">Students send one word or a short phrase. Repeated answers grow larger in the live projector cloud.</p>}
                          {interaction.type === 'team-formation' && <label className="grid gap-2 rounded-lg bg-[#f7f6ff] px-3 py-3 text-xs font-semibold text-[#4f576d]"><span>Course tags <small className="font-normal">Separate with commas</small></span><input defaultValue={(interaction.teamTags || []).join(', ')} onBlur={(event) => { const teamTags = event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8); updateInteraction(interaction.id, { teamTags, requireTeamTag: teamTags.length > 0 }); }} placeholder="Theme 1, Theme 2, Theme 3" className="rounded-lg border border-[#d7dae5] bg-white px-3 py-2 font-normal" /></label>}
                          {interaction.type === 'group-work' && <p className="rounded-lg bg-[#fff7f2] px-3 py-2 text-xs leading-5 text-[#6a554e]">Ask each group to choose one note-taker. The projector shows the number of group submissions, not individual names.</p>}
                          {interaction.type === 'spin-wheel' && (
                            <div className="space-y-3 rounded-xl border border-[#dedaf8] bg-[#f8f7ff] p-4">
                              <label className="grid gap-1.5 text-xs font-semibold text-[#4f576d]">
                                <span>Choose from</span>
                                <select aria-label="Wheel item source" value={interaction.wheelSource || 'students'} onChange={(event) => updateInteraction(interaction.id, { wheelSource: event.target.value as NonNullable<SessionInteraction['wheelSource']> })} className="min-h-10 rounded-lg border border-[#d7dae5] bg-white px-3 text-sm text-[#313950] outline-none focus:border-[#5146e5]">
                                  <option value="students">Students who joined this session</option>
                                  <option value="teams">Teams created in this class</option>
                                  <option value="custom">A custom list</option>
                                </select>
                              </label>
                              {interaction.wheelSource === 'custom' ? (
                                <label className="grid gap-1.5 text-xs font-semibold text-[#4f576d]">
                                  <span>Items <small className="font-normal text-[#7a8194]">One per line</small></span>
                                  <textarea aria-label="Custom wheel items" value={(interaction.wheelItems || []).join('\n')} onChange={(event) => updateInteraction(interaction.id, { wheelItems: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 40) })} rows={5} maxLength={1000} placeholder={'Topic A\nTopic B\nTopic C'} className="w-full resize-y rounded-lg border border-[#d7dae5] bg-white px-3 py-2.5 text-sm leading-6 text-[#313950] outline-none focus:border-[#5146e5]" />
                                </label>
                              ) : <p className="text-xs leading-5 text-[#697087]">{interaction.wheelSource === 'teams' ? 'The wheel uses the current team list when you launch it.' : 'The wheel uses the live attendance list. Student display names will appear on the classroom screen.'}</p>}
                              <label className="flex items-center gap-2.5 text-xs font-semibold text-[#4f576d]"><input type="checkbox" checked={interaction.wheelRemoveSelected !== false} onChange={(event) => updateInteraction(interaction.id, { wheelRemoveSelected: event.target.checked })} className="h-4 w-4 accent-[#5146e5]" /> Remove a selected item before the next spin</label>
                            </div>
                          )}
                        </div>
                        {hasSideSettings && <div className="grid gap-3">
                          {interaction.type === 'timer' && (
                            <label className="grid gap-1.5 text-xs font-semibold text-[#697087]">
                              <span>Duration</span>
                              <span className="flex items-center gap-2">
                                <Clock3 className="h-3.5 w-3.5" />
                                <input aria-label="Clock duration minutes" type="number" min={0} max={99} value={Math.floor(Math.round((interaction.durationMinutes || 0) * 60) / 60)} onChange={(event) => updateTimerDuration(interaction, 'minutes', Number(event.target.value))} className="w-16 rounded-lg border border-[#d7dae5] px-2 py-1.5 text-[#313950] outline-none focus:border-[#5146e5]" /> min
                                <input aria-label="Clock duration seconds" type="number" min={0} max={59} value={Math.round((interaction.durationMinutes || 0) * 60) % 60} onChange={(event) => updateTimerDuration(interaction, 'seconds', Number(event.target.value))} className="w-16 rounded-lg border border-[#d7dae5] px-2 py-1.5 text-[#313950] outline-none focus:border-[#5146e5]" /> sec
                              </span>
                            </label>
                          )}
                          {interaction.type === 'group-work' && (
                            <label className="grid gap-1.5 text-xs font-semibold text-[#697087]">
                              <span>Work time</span>
                              <span className="flex items-center gap-2">
                                <Clock3 className="h-3.5 w-3.5" />
                                <input aria-label="Group work minutes" type="number" min={1} max={60} value={interaction.durationMinutes || 1} onChange={(event) => updateInteraction(interaction.id, { durationMinutes: Number(event.target.value) })} className="w-16 rounded-lg border border-[#d7dae5] px-2 py-1.5 text-[#313950] outline-none focus:border-[#5146e5]" /> min
                              </span>
                            </label>
                          )}
                        </div>}
                        </div>}
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>

            <aside className="space-y-5 xl:sticky xl:top-6">
              <section className="overflow-hidden rounded-2xl border border-[#dcd8ff] bg-white shadow-[0_12px_32px_rgba(45,38,110,0.06)]" aria-labelledby="run-of-show-title">
                <div className="border-b border-[#e5e2fb] bg-[#f7f6ff] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="seminar-eyebrow mb-1.5">Run of show</p>
                      <h2 id="run-of-show-title" className="seminar-display text-2xl text-[#101a38]">{sessionTitle || 'Untitled session'}</h2>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#5146e5] shadow-sm">{interactions.length}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#697087]">Drag to reorder. Select an activity to edit it.</p>
                </div>

                <div className="max-h-[52vh] space-y-1.5 overflow-y-auto p-3" aria-label="Activity sequence">
                  {interactions.length === 0 ? (
                    <p className="px-3 py-7 text-center text-sm leading-6 text-[#7a8194]">Activities will appear here as you add them.</p>
                  ) : interactions.map((interaction, index) => {
                    const option = interactionOptions.find((item) => item.type === interaction.type);
                    const Icon = option?.icon || ListChecks;
                    const isActive = expandedInteractionId === interaction.id;
                    return (
                      <div
                        key={`sequence-${interaction.id}`}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', interaction.id);
                          setDraggingInteractionId(interaction.id);
                        }}
                        onDragOver={(event) => {
                          if (!draggingInteractionId || draggingInteractionId === interaction.id) return;
                          event.preventDefault();
                          setDragOverInteractionId(interaction.id);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleDropInteraction(interaction.id);
                        }}
                        onDragEnd={() => {
                          setDraggingInteractionId(null);
                          setDragOverInteractionId(null);
                        }}
                        className={`group flex items-center gap-2 rounded-xl border px-2 py-2 transition-[background-color,border-color,transform] duration-150 ${isActive ? 'border-[#bdb7ff] bg-[#f4f2ff]' : 'border-transparent hover:border-[#e3e5ed] hover:bg-[#faf9fc]'} ${dragOverInteractionId === interaction.id ? 'translate-y-1 border-[#5146e5]' : ''}`}
                      >
                        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#b0b4c1] group-hover:text-[#5146e5]" />
                        <button type="button" onClick={() => focusInteraction(interaction.id)} className="seminar-focus flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#5146e5] shadow-sm"><Icon className="h-3.5 w-3.5" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a8194]">{index + 1} · {option?.label || 'Activity'}</span>
                            <strong className="mt-0.5 block truncate text-xs text-[#101a38]">{interaction.title || 'Untitled activity'}</strong>
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 border-t border-[#e5e2fb] bg-[#fbfaff] text-xs">
                  <div className="border-r border-[#e5e2fb] px-4 py-3"><span className="block text-[#7a8194]">Activities</span><strong className="mt-0.5 block text-[#101a38]">{interactions.length}</strong></div>
                  <div className="px-4 py-3"><span className="block text-[#7a8194]">Activity time</span><strong className="mt-0.5 block text-[#101a38]">About {Math.ceil(estimatedMinutes)} min</strong></div>
                </div>
              </section>

              <div className="flex gap-3 rounded-xl border border-[#dce9df] bg-[#f5fbf6] p-4 text-sm leading-6 text-[#4f576d]"><Check className="mt-1 h-4 w-4 shrink-0 text-[#3aa45a]" /><span>You can still add an unplanned question during class.</span></div>

              {error && <InlineMessage title="The session is not saved yet." message={error} />}

              <Button type="button" onClick={handleSaveSession} loading={creating} disabled={!courseCode.trim() || !sessionTitle.trim()} size="lg" className="w-full gap-2">
                <Save className="h-4 w-4" /> {editingSessionId ? 'Save changes' : 'Save session'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.back()} className="w-full">Cancel</Button>
            </aside>
          </div>
        </main>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

export default function NewSessionPage() {
  return (
    <Suspense fallback={(
      <ProtectedRoute>
        <DashboardLayout>
          <div className="grid min-h-96 place-items-center" role="status" aria-label="Opening session setup"><AmbientLoading className="w-44 rounded-full" announce="off" /></div>
        </DashboardLayout>
      </ProtectedRoute>
    )}>
      <NewSessionContent />
    </Suspense>
  );
}
