'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createSession, generateSessionCode, getCaseStudiesByTeacher, getCourse, getSession, updateSession } from '@/lib/firebase/firestore';
import { auth } from '@/lib/firebase/config';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
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
  FileText,
  HeartPulse,
  ListChecks,
  LoaderCircle,
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
  { type: 'peer-learning', label: 'Peer learning', description: 'Let students answer, discuss, then answer again.', icon: Repeat2 },
  { type: 'group-work', label: 'Group work', description: 'Give small groups a shared task, clock, and submission.', icon: UsersRound },
  { type: 'timer', label: 'Clock', description: 'Put focused thinking or working time into the session flow.', icon: Clock3 },
  { type: 'case-study', label: 'Case material', description: 'Open a prepared decision or reading.', icon: BookOpen },
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

const defaultPrompt: Record<SessionInteractionType, string> = {
  pulse: 'How is the pace right now?',
  poll: 'Which option best matches your view?',
  quiz: 'Choose the best answer.',
  'open-response': 'What question is still unresolved?',
  'peer-learning': 'Choose the best answer. You will discuss it with a partner, then answer again.',
  'group-work': 'Work together on this prompt. Choose one note-taker to submit for your group.',
  timer: 'Use this time to think, write, or complete the task on screen.',
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
  const [generatingInteractions, setGeneratingInteractions] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generationNotice, setGenerationNotice] = useState('');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const lessonFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadPlanningData = async () => {
      if (!user) return;
      try {
        const [studies, session] = await Promise.all([
          getCaseStudiesByTeacher(user.uid),
          editingSessionId ? getSession(editingSessionId) : Promise.resolve(null),
        ]);
        if (editingSessionId && (!session || session.teacherId !== user.uid)) {
          setError('This session could not be found.');
          return;
        }

        const courseId = preselectedCourseId || session?.courseId;
        const course = courseId ? await getCourse(courseId) : null;
        setCaseStudies(studies);

        if (course && course.teacherId === user.uid) {
          setSelectedCourse(course);
          setCourseCode(course.code);
          setCourseName(course.name);
          if (!session) setInteractions([]);
        } else if (session) {
          setCourseCode(session.courseCode || '');
          setCourseName(session.courseName || '');
        }

        if (session) {
          setSessionTitle(session.title || '');
          setScheduledFor(session.scheduledFor || '');
          setInteractions(session.interactions || []);
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

  const addInteraction = (type: SessionInteractionType, caseStudy?: CaseStudy) => {
    const option = interactionOptions.find((item) => item.type === type);
    setInteractions((current) => [
      ...current,
      {
        id: `${type}-${Date.now()}`,
        type,
        title: caseStudy?.title || option?.label || 'Class activity',
        prompt: defaultPrompt[type],
        plannedTime: 'During class',
        durationMinutes: type === 'case-study' ? 15 : type === 'group-work' ? 8 : type === 'timer' ? 5 : 3,
        discussionMinutes: type === 'peer-learning' ? 2 : undefined,
        groupSize: type === 'group-work' ? 4 : undefined,
        caseStudyId: caseStudy?.id,
        options: type === 'pulse'
          ? ['Very low', 'Low', 'Steady', 'High', 'Very high']
          : type === 'poll' || type === 'quiz' || type === 'peer-learning'
            ? ['Option 1', 'Option 2', 'Option 3', 'Option 4']
            : undefined,
        correctOptionIndex: type === 'quiz' || type === 'peer-learning' ? 0 : undefined,
        explanation: type === 'quiz' || type === 'peer-learning' ? 'Explain why this answer is correct.' : undefined,
        resultVisibility: type === 'quiz' || type === 'peer-learning' ? 'after-reveal' : type === 'open-response' || type === 'group-work' ? 'instructor-only' : 'live',
      },
    ]);
    setAddMenuOpen(false);
  };

  const addLibraryInteraction = (template: SessionInteraction) => {
    setInteractions((current) => [
      ...current,
      { ...template, id: `session-${template.type}-${Date.now()}-${current.length}` },
    ]);
  };

  const updateInteraction = (id: string, updates: Partial<SessionInteraction>) => {
    setInteractions((current) => current.map((interaction) => (
      interaction.id === id ? { ...interaction, ...updates } : interaction
    )));
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

  const removeInteraction = (id: string) => {
    setInteractions((current) => current.filter((interaction) => interaction.id !== id));
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
    const trimmedLesson = lessonContent.trim();
    if (trimmedLesson.length < 80) {
      setGenerationError('Paste or upload a short section of lesson material first.');
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
      setGenerationNotice('Four drafts were added below. Review the wording, choices, and correct answer before saving.');
    } catch (generationIssue: unknown) {
      setGenerationError(generationIssue instanceof Error ? generationIssue.message : 'The question drafts could not be generated.');
    } finally {
      setGeneratingInteractions(false);
    }
  };

  const handleSaveSession = async () => {
    if (!user || !courseCode.trim() || !sessionTitle.trim()) return;
    setCreating(true);
    setError('');

    try {
      if (editingSessionId) {
        await updateSession(editingSessionId, {
          title: sessionTitle.trim(),
          ...(selectedCourse?.id ? { courseId: selectedCourse.id } : {}),
          courseCode: courseCode.trim(),
          courseName: courseName.trim(),
          ...(scheduledFor ? { scheduledFor } : {}),
          presentationMode: 'external',
          interactions,
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
        courseName: courseName.trim(),
        presentationMode: 'external',
        interactions,
        teacherId: user.uid,
        active: false,
        studentsJoined: [],
        releasedSections: [],
        currentReleasedSection: -1,
        sections: [],
      });

      router.push(`/dashboard/sessions/${sessionId}`);
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : 'The session flow could not be saved. Try again.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex min-h-96 items-center justify-center" role="status" aria-label="Loading session setup">
            <LoaderCircle className="h-7 w-7 animate-spin text-[#5146e5]" />
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
                  <div className="relative">
                    <Button type="button" variant="outline" onClick={() => setAddMenuOpen((open) => !open)} className="gap-2">
                      <Plus className="h-4 w-4" /> Add activity
                    </Button>
                    {addMenuOpen && (
                      <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-[#e3e5ed] bg-white p-2 shadow-[0_18px_50px_rgba(16,26,56,0.14)]">
                        {interactionOptions.filter((option) => option.type !== 'case-study').map(({ type, label, description, icon: Icon }) => (
                          <button key={type} type="button" onClick={() => addInteraction(type)} className="flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-[#f8f7fb]">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0efff] text-[#5146e5]"><Icon className="h-4 w-4" /></span>
                            <span><strong className="block text-sm text-[#101a38]">{label}</strong><small className="mt-0.5 block leading-5 text-[#697087]">{description}</small></span>
                          </button>
                        ))}
                        {caseStudies.length > 0 && (
                          <div className="mt-2 border-t border-[#e3e5ed] pt-2">
                            <p className="px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#697087]">Case material</p>
                            {caseStudies.slice(0, 3).map((caseStudy) => (
                              <button key={caseStudy.id} type="button" onClick={() => addInteraction('case-study', caseStudy)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f8f7fb]">
                                <BookOpen className="h-4 w-4 text-[#5146e5]" /><span className="line-clamp-1 text-sm font-semibold text-[#101a38]">{caseStudy.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {selectedCourse && (selectedCourse.interactionTemplates?.length || 0) > 0 && (
                  <section className="mt-6 rounded-2xl border border-[#dcd8ff] bg-[#f7f6ff] p-5" aria-labelledby="class-library-title">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div><p className="seminar-eyebrow mb-2">From {selectedCourse.code}</p><h3 id="class-library-title" className="seminar-display text-2xl text-[#101a38]">Choose from your activity library</h3><p className="mt-1 text-sm leading-6 text-[#697087]">Add only what this session needs. Each copy can be edited below.</p></div>
                      <span className="text-xs font-semibold text-[#697087]">{selectedCourse.interactionTemplates?.length} saved</span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {selectedCourse.interactionTemplates?.map((template) => {
                        const option = interactionOptions.find((item) => item.type === template.type);
                        const Icon = option?.icon || Sparkles;
                        return (
                          <button key={template.id} type="button" onClick={() => addLibraryInteraction(template)} className="seminar-focus group flex min-h-20 items-center gap-3 rounded-xl border border-[#e0ddff] bg-white p-3 text-left transition duration-150 hover:-translate-y-0.5 hover:border-[#bfb9ff] hover:shadow-sm">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0efff] text-[#5146e5]"><Icon className="h-4 w-4" /></span>
                            <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#101a38]">{template.title}</strong><small className="mt-0.5 block line-clamp-1 text-[#697087]">{template.prompt}</small></span>
                            <Plus className="h-4 w-4 shrink-0 text-[#8e94a6] group-hover:text-[#5146e5]" />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                <details className="group mt-6 rounded-2xl border border-[#e3e5ed] bg-[#faf9fc] open:bg-[#f7f6ff]">
                  <summary className="seminar-focus flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 marker:content-none">
                    <div>
                      <p className="text-sm font-semibold text-[#101a38]">Draft activities with AI</p>
                      <p className="mt-1 text-xs leading-5 text-[#697087]">Optional: turn lesson notes into editable question drafts.</p>
                    </div>
                    <Plus className="h-5 w-5 shrink-0 text-[#5146e5] transition-transform duration-150 group-open:rotate-45" />
                  </summary>
                  <div className="border-t border-[#dcd8ff] p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="seminar-display text-2xl text-[#101a38]">Draft questions from this class</h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#697087]">Paste a lesson outline, slides, reading excerpt, or upload a plain-text file. Every draft can be reviewed before you save.</p>
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
                    placeholder="Paste the part of the lesson you want students to discuss or check for understanding."
                    className="mt-5 w-full resize-y rounded-xl border border-[#d7dae5] bg-white px-3.5 py-3 text-sm leading-6 text-[#313950] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]"
                  />
                  <div className="mt-3 flex flex-col gap-3 text-xs leading-5 text-[#697087] sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {lessonSourceName || 'Plain text only: .txt, .md, .csv, or .tsv'}</span>
                    <span>{lessonContent.length.toLocaleString()} / {MAX_LESSON_CHARS.toLocaleString()} characters</span>
                  </div>
                  {generationError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700" role="alert">{generationError}</p>}
                  {generationNotice && <p className="mt-3 rounded-lg border border-[#cce8d2] bg-[#f2fbf4] px-3 py-2 text-sm leading-6 text-[#296e3c]" role="status">{generationNotice}</p>}
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-[#5a6278]">Creates one pulse, poll, quiz, and short response. You can edit or remove every draft.</p>
                    <Button type="button" onClick={handleGenerateInteractions} loading={generatingInteractions} disabled={lessonContent.trim().length < 80} className="shrink-0 gap-2">
                      <Sparkles className="h-4 w-4" /> Draft activities
                    </Button>
                  </div>
                  </div>
                </details>

                <div className="mt-2 divide-y divide-[#e3e5ed]">
                  {interactions.map((interaction, index) => {
                    const option = interactionOptions.find((item) => item.type === interaction.type);
                    const Icon = option?.icon || ListChecks;
                    return (
                      <article key={interaction.id} className="grid gap-4 py-6 md:grid-cols-[44px_minmax(0,1fr)_150px_auto] md:items-start">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0efff] text-[#5146e5]"><Icon className="h-5 w-5" /></span>
                        <div className="space-y-3">
                          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#5146e5]">{option?.label || 'Class activity'}</p>
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
                          {interaction.type === 'peer-learning' && <label className="flex items-center gap-3 rounded-xl bg-[#f7f6ff] px-3.5 py-3 text-xs font-semibold text-[#4f576d]"><Repeat2 className="h-4 w-4 text-[#5146e5]" /> Partner discussion <input aria-label="Partner discussion minutes" type="number" min={1} max={10} value={interaction.discussionMinutes || 2} onChange={(event) => updateInteraction(interaction.id, { discussionMinutes: Number(event.target.value) })} className="ml-auto w-16 rounded-lg border border-[#d7dae5] bg-white px-2 py-1.5 text-[#313950]" /> min</label>}
                          {interaction.type === 'group-work' && <label className="flex items-center gap-3 rounded-xl bg-[#fff7f2] px-3.5 py-3 text-xs font-semibold text-[#4f576d]"><UsersRound className="h-4 w-4 text-[#c85540]" /> Suggested group size <input aria-label="Suggested group size" type="number" min={2} max={10} value={interaction.groupSize || 4} onChange={(event) => updateInteraction(interaction.id, { groupSize: Number(event.target.value) })} className="ml-auto w-16 rounded-lg border border-[#e4d7d1] bg-white px-2 py-1.5 text-[#313950]" /> students</label>}
                          {interaction.type === 'timer' && <p className="rounded-lg bg-[#f7f6ff] px-3 py-2 text-xs leading-5 text-[#5a6278]">The clock starts when you launch this activity. Students see the prompt and the same countdown on their phones.</p>}
                          {interaction.type === 'open-response' && <p className="rounded-lg bg-[#f7f6ff] px-3 py-2 text-xs leading-5 text-[#5a6278]">Written responses stay on the instructor screen. You choose what appears on the projector.</p>}
                          {interaction.type === 'group-work' && <p className="rounded-lg bg-[#fff7f2] px-3 py-2 text-xs leading-5 text-[#6a554e]">Ask each group to choose one note-taker. The projector shows the number of group submissions, not individual names.</p>}
                        </div>
                        <div className="grid gap-3">
                          <Input aria-label="Planned moment" value={interaction.plannedTime || ''} onChange={(event) => updateInteraction(interaction.id, { plannedTime: event.target.value })} />
                          <label className="flex items-center gap-2 text-xs font-semibold text-[#697087]">
                            <Clock3 className="h-3.5 w-3.5" />
                            <input aria-label="Estimated minutes" type="number" min={1} max={60} value={interaction.durationMinutes || 1} onChange={(event) => updateInteraction(interaction.id, { durationMinutes: Number(event.target.value) })} className="w-16 rounded-lg border border-[#d7dae5] px-2 py-1.5 text-[#313950] outline-none focus:border-[#5146e5]" /> min
                          </label>
                        </div>
                        <div className="flex gap-1 md:flex-col">
                          <button type="button" onClick={() => moveInteraction(index, -1)} disabled={index === 0} className="seminar-focus rounded-lg p-2 text-[#697087] hover:bg-[#f8f7fb] hover:text-[#101a38] disabled:opacity-30" aria-label={`Move ${interaction.title} up`}><ArrowUp className="h-4 w-4" /></button>
                          <button type="button" onClick={() => moveInteraction(index, 1)} disabled={index === interactions.length - 1} className="seminar-focus rounded-lg p-2 text-[#697087] hover:bg-[#f8f7fb] hover:text-[#101a38] disabled:opacity-30" aria-label={`Move ${interaction.title} down`}><ArrowDown className="h-4 w-4" /></button>
                          <button type="button" onClick={() => removeInteraction(interaction.id)} className="seminar-focus rounded-lg p-2 text-[#697087] hover:bg-[#fff1ee] hover:text-[#b64936]" aria-label={`Remove ${interaction.title}`}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>

            <aside className="space-y-5 xl:sticky xl:top-6">
              <section className="rounded-2xl border border-[#dcd8ff] bg-[#f7f6ff] p-6">
                <p className="seminar-eyebrow mb-2">Session summary</p>
                <h2 className="seminar-display text-3xl text-[#101a38]">{sessionTitle || 'Untitled session'}</h2>
                <p className="mt-2 text-sm text-[#697087]">{courseCode}{courseName ? ` · ${courseName}` : ''}</p>
                <div className="mt-6 space-y-3 border-y border-[#dcd8ff] py-5 text-sm">
                  <div className="flex items-center justify-between"><span className="text-[#697087]">Activities</span><strong className="text-[#101a38]">{interactions.length}</strong></div>
                  <div className="flex items-center justify-between"><span className="text-[#697087]">Activity time</span><strong className="text-[#101a38]">About {estimatedMinutes} min</strong></div>
                </div>
                <div className="mt-5 flex gap-3 text-sm leading-6 text-[#4f576d]"><Check className="mt-1 h-4 w-4 shrink-0 text-[#3aa45a]" /><span>You can add an unplanned question during class without changing this plan.</span></div>
              </section>

              {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700" role="alert">{error}</div>}

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
          <div className="flex min-h-96 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#5146e5]" /></div>
        </DashboardLayout>
      </ProtectedRoute>
    )}>
      <NewSessionContent />
    </Suspense>
  );
}
