'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createCourse, getCourse, getCoursesByTeacher, getSessionsByTeacher, updateCourse } from '@/lib/firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import type { Course, Session, SessionInteraction, SessionInteractionType } from '@/types';
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  ArchiveRestore,
  BarChart3,
  CalendarPlus,
  CalendarSync,
  CalendarDays,
  Check,
  CircleHelp,
  Clock3,
  Copy,
  HeartPulse,
  Library,
  LoaderCircle,
  MessageCircle,
  Plus,
  Play,
  Radio,
  Save,
  Sparkles,
  Repeat2,
  Trash2,
  Users,
  UsersRound,
  X,
} from 'lucide-react';

interface ClassWorkspaceProps {
  params: Promise<{ id: string }>;
}

const interactionTypes: Array<{
  type: SessionInteractionType;
  label: string;
  use: string;
  icon: typeof HeartPulse;
}> = [
  { type: 'pulse', label: 'Pulse check', use: 'Read confidence, pace, or wellbeing.', icon: HeartPulse },
  { type: 'poll', label: 'Opinion poll', use: 'See where the room stands before discussion.', icon: BarChart3 },
  { type: 'quiz', label: 'Knowledge check', use: 'Catch a misconception while you can address it.', icon: CircleHelp },
  { type: 'open-response', label: 'Short response', use: 'Collect questions, reasoning, or reflection.', icon: MessageCircle },
  { type: 'peer-learning', label: 'Peer learning', use: 'Answer, discuss with a partner, then answer again.', icon: Repeat2 },
  { type: 'group-work', label: 'Group work', use: 'Give groups a shared task and one submission.', icon: UsersRound },
  { type: 'timer', label: 'Clock', use: 'Save a timed thinking or working block.', icon: Clock3 },
];

const createTemplate = (type: SessionInteractionType): SessionInteraction => ({
  id: `template-${type}-${Date.now()}`,
  type,
  title: interactionTypes.find((option) => option.type === type)?.label || 'Interaction',
  prompt: type === 'pulse'
    ? 'How confident do you feel right now?'
    : type === 'poll'
      ? 'Which option best matches your view?'
      : type === 'quiz'
        ? 'Choose the best answer.'
        : type === 'peer-learning'
          ? 'Choose the best answer. Discuss it with a partner, then answer again.'
          : type === 'group-work'
            ? 'Work together on this prompt. Choose one note-taker to submit.'
            : type === 'timer'
              ? 'Use this time to think, write, or complete the task on screen.'
              : 'What question is still unresolved?',
  plannedTime: 'During class',
  durationMinutes: type === 'group-work' ? 8 : type === 'timer' ? 5 : type === 'open-response' ? 4 : 3,
  discussionMinutes: type === 'peer-learning' ? 2 : undefined,
  groupSize: type === 'group-work' ? 4 : undefined,
  options: type === 'pulse'
    ? ['Still fuzzy', 'Getting there', 'Mostly got it', 'Confident', 'Could explain it']
    : type === 'poll' || type === 'quiz' || type === 'peer-learning'
      ? ['Option 1', 'Option 2', 'Option 3', 'Option 4']
      : undefined,
  correctOptionIndex: type === 'quiz' || type === 'peer-learning' ? 0 : undefined,
  resultVisibility: type === 'quiz' || type === 'peer-learning' ? 'after-reveal' : type === 'open-response' || type === 'group-work' ? 'instructor-only' : 'live',
});

const readableDate = (value?: string) => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ClassWorkspacePage({ params }: ClassWorkspaceProps) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<SessionInteraction[]>([]);
  const [className, setClassName] = useState('');
  const [classTerm, setClassTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<'sessions' | 'library'>('sessions');
  const [addOpen, setAddOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [rollingOver, setRollingOver] = useState(false);
  const [nextTerm, setNextTerm] = useState('');
  const [nextCode, setNextCode] = useState('');
  const [archiveAfterRollover, setArchiveAfterRollover] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadWorkspace = async () => {
      if (!user) return;
      try {
        const [courseData, sessionData] = await Promise.all([getCourse(id), getSessionsByTeacher(user.uid)]);
        if (!courseData || courseData.teacherId !== user.uid) {
          setError('This class could not be found.');
          return;
        }
        setCourse(courseData);
        setTemplates(courseData.interactionTemplates || []);
        setClassName(courseData.name);
        setClassTerm(courseData.term || '');
        setSessions(sessionData.filter((session) => session.courseId === id || (!session.courseId && session.courseCode === courseData.code)));
      } catch (loadError) {
        console.error('Could not load class workspace:', loadError);
        setError('The class workspace could not be loaded.');
      } finally {
        setLoading(false);
      }
    };
    loadWorkspace();
  }, [id, user]);

  const studentCount = useMemo(() => new Set(sessions.flatMap((session) => session.studentsJoined || [])).size, [sessions]);
  const orderedSessions = useMemo(() => [...sessions].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const aTime = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
    const bTime = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
    return bTime - aTime;
  }), [sessions]);

  const updateTemplate = (templateId: string, updates: Partial<SessionInteraction>) => {
    setSaved(false);
    setTemplates((current) => current.map((template) => template.id === templateId ? { ...template, ...updates } : template));
  };

  const updateTemplateOption = (templateId: string, optionIndex: number, value: string) => {
    setTemplates((current) => current.map((template) => {
      if (template.id !== templateId || !template.options) return template;
      const options = [...template.options];
      options[optionIndex] = value;
      return { ...template, options };
    }));
    setSaved(false);
  };

  const removeTemplateOption = (templateId: string, optionIndex: number) => {
    setTemplates((current) => current.map((template) => {
      if (template.id !== templateId || !template.options || template.options.length <= 2) return template;
      const options = template.options.filter((_, index) => index !== optionIndex);
      const correctOptionIndex = template.correctOptionIndex === optionIndex
        ? 0
        : template.correctOptionIndex !== undefined && template.correctOptionIndex > optionIndex
          ? template.correctOptionIndex - 1
          : template.correctOptionIndex;
      return { ...template, options, correctOptionIndex };
    }));
    setSaved(false);
  };

  const saveLibrary = async () => {
    if (!course) return;
    setSaving(true);
    setError('');
    try {
      await updateCourse(course.id, {
        name: className.trim() || course.name,
        term: classTerm.trim() || undefined,
        interactionTemplates: templates,
      });
      setCourse((current) => current ? { ...current, name: className.trim() || current.name, term: classTerm.trim() || undefined, interactionTemplates: templates } : current);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch (saveError) {
      console.error('Could not save interaction library:', saveError);
      setError('Your interaction library could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const archiveClass = async () => {
    if (!course) return;
    await updateCourse(course.id, { archived: true, archivedAt: Timestamp.now() });
    setCourse((current) => current ? { ...current, archived: true, archivedAt: Timestamp.now() } : current);
    setArchiveOpen(false);
  };

  const restoreClass = async () => {
    if (!course) return;
    setSaving(true);
    try {
      await updateCourse(course.id, { archived: false, archivedAt: null });
      setCourse((current) => current ? { ...current, archived: false, archivedAt: null } : current);
    } catch (restoreError) {
      console.error('Could not restore class:', restoreError);
      setError('The class could not be restored. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const openRollover = () => {
    if (!course) return;
    setNextTerm('');
    setNextCode(`${course.code}-${new Date().getFullYear() + 1}`);
    setArchiveAfterRollover(true);
    setRolloverOpen(true);
  };

  const createNextTerm = async () => {
    if (!course || !user || !nextTerm.trim() || !nextCode.trim()) return;
    setRollingOver(true);
    setError('');
    try {
      const existingCourses = await getCoursesByTeacher(user.uid, true);
      const normalizedNextCode = nextCode.trim().toUpperCase();
      if (existingCourses.some((candidate) => candidate.code.trim().toUpperCase() === normalizedNextCode)) {
        setError('That class code is already in use. Choose a different code so records stay separate.');
        setRollingOver(false);
        return;
      }
      const nextCourseId = await createCourse({
        name: course.name,
        code: normalizedNextCode,
        term: nextTerm.trim(),
        teacherId: user.uid,
        studentIds: [],
        interactionTemplates: templates.map((template) => ({ ...template, id: `${template.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })),
        archived: false,
        sourceCourseId: course.id,
      });
      if (archiveAfterRollover) {
        await updateCourse(course.id, { archived: true, archivedAt: Timestamp.now() });
      }
      router.push(`/dashboard/classes/${nextCourseId}`);
    } catch (rolloverError) {
      console.error('Could not create next term:', rolloverError);
      setError('The next term could not be created. Check the details and try again.');
      setRollingOver(false);
    }
  };

  if (loading) {
    return <ProtectedRoute><DashboardLayout><div className="flex min-h-96 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#5146e5]" /></div></DashboardLayout></ProtectedRoute>;
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <main className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-10">
          <Link href="/dashboard/classes" className="seminar-focus mb-6 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[#697087] hover:text-[#101a38]"><ArrowLeft className="h-4 w-4" /> All classes</Link>

          {error && !course ? (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</section>
          ) : course && (
            <>
              <header className="mb-8 flex flex-col gap-5 border-b border-[#e3e5ed] pb-8 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#101a38] px-3 py-1 text-xs font-bold text-white">{course.code}</span>{course.term && <span className="text-xs font-semibold text-[#697087]">{course.term}</span>}{course.archived && <span className="rounded-full bg-[#e7e5df] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#5f6472]">Archived</span>}</div>
                  <h1 className="seminar-display mt-4 text-4xl text-[#101a38] sm:text-5xl">{course.name}</h1>
                  <div className="mt-4 flex flex-wrap gap-5 text-sm text-[#697087]"><span className="flex items-center gap-2"><CalendarPlus className="h-4 w-4" /> {sessions.length} sessions</span><span className="flex items-center gap-2"><Users className="h-4 w-4" /> {studentCount} students seen</span><span className="flex items-center gap-2"><Library className="h-4 w-4" /> {templates.length} reusable interactions</span></div>
                </div>
                <div className="flex flex-wrap gap-3">{course.archived ? <Button variant="outline" onClick={restoreClass} loading={saving} className="gap-2"><ArchiveRestore className="h-4 w-4" /> Restore class</Button> : <><Button variant="outline" onClick={openRollover} className="gap-2"><CalendarSync className="h-4 w-4" /> Start next term</Button><Link href={`/dashboard/progress?courseId=${course.id}`}><Button variant="outline">View progress</Button></Link><Link href={`/dashboard/sessions/new?courseId=${course.id}`}><Button className="gap-2"><CalendarPlus className="h-4 w-4" /> Plan next session</Button></Link></>}</div>
              </header>

              {error && <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

              {course.archived && <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#dedbd2] bg-[#f8f7f3] p-4 text-sm leading-6 text-[#5f6472]"><Archive className="mt-0.5 h-4 w-4 shrink-0" /><span><strong className="block text-[#101a38]">This class is archived.</strong>Its teaching kit and history are read-only until you restore it.</span></div>}

              <div className="mb-7 flex gap-1 overflow-x-auto rounded-2xl bg-[#f1f0f5] p-1.5" role="tablist" aria-label="Class workspace views">
                <button type="button" role="tab" aria-selected={workspaceView === 'sessions'} onClick={() => setWorkspaceView('sessions')} className={`seminar-focus flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition ${workspaceView === 'sessions' ? 'bg-white text-[#101a38] shadow-[0_4px_14px_rgba(16,26,56,0.08)]' : 'text-[#697087] hover:text-[#101a38]'}`}><CalendarDays className="h-4 w-4" /> Sessions <span className="rounded-full bg-[#f0efff] px-2 py-0.5 text-[11px] text-[#5146e5]">{sessions.length}</span></button>
                <button type="button" role="tab" aria-selected={workspaceView === 'library'} onClick={() => setWorkspaceView('library')} className={`seminar-focus flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition ${workspaceView === 'library' ? 'bg-white text-[#101a38] shadow-[0_4px_14px_rgba(16,26,56,0.08)]' : 'text-[#697087] hover:text-[#101a38]'}`}><Library className="h-4 w-4" /> Activity library <span className="rounded-full bg-[#f0efff] px-2 py-0.5 text-[11px] text-[#5146e5]">{templates.length}</span></button>
                <Link role="tab" aria-selected="false" href={`/dashboard/progress?courseId=${course.id}`} className="seminar-focus flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold text-[#697087] transition hover:text-[#101a38]"><Users className="h-4 w-4" /> Students</Link>
              </div>

              {workspaceView === 'sessions' ? (
                <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <section className="overflow-hidden rounded-3xl border border-[#e3e5ed] bg-white" aria-labelledby="class-sessions-title">
                    <div className="flex flex-col gap-4 border-b border-[#e3e5ed] bg-[linear-gradient(110deg,#fff_0%,#faf9ff_70%,#fff5f0_100%)] p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7">
                      <div><p className="seminar-eyebrow mb-2">Teaching sequence</p><h2 id="class-sessions-title" className="seminar-display text-3xl text-[#101a38]">Sessions</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#697087]">Each session has its own ordered flow of activities, ready to launch beside your slides.</p></div>
                      {!course.archived && <Link href={`/dashboard/sessions/new?courseId=${course.id}`}><Button className="gap-2"><Plus className="h-4 w-4" /> New session</Button></Link>}
                    </div>

                    {orderedSessions.length === 0 ? (
                      <div className="px-6 py-14 text-center sm:px-10">
                        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0efff] text-[#5146e5]"><CalendarPlus className="h-7 w-7" /></span>
                        <h3 className="seminar-display mt-5 text-3xl text-[#101a38]">Plan the first meeting.</h3>
                        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#697087]">Give it a title, then add only the polls, quizzes, check-ins, or modules you expect to use.</p>
                        {!course.archived && <Link href={`/dashboard/sessions/new?courseId=${course.id}`} className="mt-6 inline-block"><Button className="gap-2">Plan session 1 <ArrowRight className="h-4 w-4" /></Button></Link>}
                      </div>
                    ) : (
                      <ol className="divide-y divide-[#e8e8ee]">
                        {orderedSessions.map((session, index) => {
                          const sessionNumber = Math.max(1, sessions.length - index);
                          return (
                            <li key={session.id} className="group grid gap-4 p-5 transition-colors hover:bg-[#faf9ff] sm:grid-cols-[54px_minmax(0,1fr)_auto] sm:items-center sm:p-6">
                              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold ${session.active ? 'bg-[#e8f7ed] text-[#28733a]' : 'bg-[#f0efff] text-[#5146e5]'}`}>{session.active ? <Radio className="h-5 w-5" /> : sessionNumber}</span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em]"><span className={session.active ? 'text-[#28733a]' : 'text-[#5146e5]'}>{session.active ? 'Live now' : `Session ${sessionNumber}`}</span><span className="text-[#9aa0b1]">{readableDate(session.scheduledFor)}</span></div>
                                <h3 className="mt-1 truncate text-lg font-bold text-[#101a38]">{session.title || 'Untitled session'}</h3>
                                <p className="mt-1 flex items-center gap-2 text-xs text-[#697087]"><Library className="h-3.5 w-3.5" /> {session.interactions?.length || 0} activities in this flow</p>
                              </div>
                              <Link href={session.active ? `/live?sessionId=${session.id}` : `/dashboard/sessions/${session.id}`}><Button variant={session.active ? 'primary' : 'outline'} className="w-full gap-2 sm:w-auto">{session.active ? <Play className="h-4 w-4" /> : null}{session.active ? 'Open live controls' : 'Open session'} <ArrowRight className="h-4 w-4" /></Button></Link>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </section>

                  <aside className="space-y-5 xl:sticky xl:top-6">
                    {!course.archived && <section className="rounded-3xl border border-[#dcd8ff] bg-[#f7f6ff] p-6">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#5146e5] shadow-sm"><CalendarPlus className="h-5 w-5" /></span>
                      <p className="seminar-eyebrow mb-2 mt-5">Next meeting</p><h2 className="seminar-display text-3xl text-[#101a38]">Build the session flow</h2><p className="mt-3 text-sm leading-6 text-[#697087]">Put activities in teaching order. They remain private until you launch each one.</p><Link href={`/dashboard/sessions/new?courseId=${course.id}`} className="mt-5 block"><Button className="w-full gap-2">Plan next session <ArrowRight className="h-4 w-4" /></Button></Link>
                    </section>}
                    <section className="rounded-3xl border border-[#e3e5ed] bg-white p-6">
                      <p className="seminar-eyebrow mb-2">Class tools</p><h2 className="seminar-display text-2xl text-[#101a38]">Reuse what works</h2><p className="mt-3 text-sm leading-6 text-[#697087]">Keep check-ins and question formats you use often in this class.</p><button type="button" onClick={() => setWorkspaceView('library')} className="seminar-focus mt-5 inline-flex items-center gap-2 rounded-lg text-sm font-bold text-[#5146e5]">Open activity library <ArrowRight className="h-4 w-4" /></button>
                    </section>
                  </aside>
                </div>
              ) : (
              <fieldset disabled={course.archived} className="m-0 grid min-w-0 items-start gap-8 border-0 p-0 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section className="rounded-3xl border border-[#e3e5ed] bg-white p-5 sm:p-7" aria-labelledby="library-title">
                  <div className="flex flex-col gap-4 border-b border-[#e3e5ed] pb-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-2xl"><p className="seminar-eyebrow mb-2">Reusable kit</p><h2 id="library-title" className="seminar-display text-3xl text-[#101a38]">Interaction library</h2><p className="mt-2 text-sm leading-6 text-[#697087]">Save the formats and wording you return to often. Adding one to a session creates an editable copy, so the original stays intact.</p></div>
                    <div className="relative shrink-0">
                      <Button variant="outline" onClick={() => setAddOpen((open) => !open)} className="gap-2"><Plus className="h-4 w-4" /> New interaction</Button>
                      {addOpen && <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-[#e3e5ed] bg-white p-2 shadow-[0_18px_50px_rgba(16,26,56,0.14)]">{interactionTypes.map(({ type, label, use: useCase, icon: Icon }) => <button key={type} type="button" onClick={() => { setTemplates((current) => [...current, createTemplate(type)]); setAddOpen(false); setSaved(false); }} className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-[#f8f7fb]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0efff] text-[#5146e5]"><Icon className="h-4 w-4" /></span><span><strong className="block text-sm text-[#101a38]">{label}</strong><small className="mt-0.5 block leading-5 text-[#697087]">{useCase}</small></span></button>)}</div>}
                    </div>
                  </div>

                  {templates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#cfd2df] py-12 text-center"><Sparkles className="mx-auto h-7 w-7 text-[#5146e5]" /><h3 className="seminar-display mt-3 text-2xl text-[#101a38]">Build a small, useful kit.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#697087]">Start with an interaction you can imagine using in at least three sessions.</p></div>
                  ) : (
                    <div className="mt-6 space-y-4">
                      {templates.map((template) => {
                        const type = interactionTypes.find((option) => option.type === template.type);
                        const Icon = type?.icon || Sparkles;
                        return (
                          <article key={template.id} className="rounded-2xl border border-[#e3e5ed] bg-[#fffefa] p-5">
                            <div className="flex items-start gap-4">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0efff] text-[#5146e5]"><Icon className="h-5 w-5" /></span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <input aria-label="Interaction name" value={template.title} onChange={(event) => updateTemplate(template.id, { title: event.target.value })} className="min-w-0 flex-1 border-0 bg-transparent text-base font-bold text-[#101a38] outline-none focus:ring-0" />
                                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#697087]">{type?.label || template.type}</span>
                                </div>
                                <textarea aria-label={`${template.title} prompt`} value={template.prompt} onChange={(event) => updateTemplate(template.id, { prompt: event.target.value })} rows={2} className="mt-3 w-full resize-none rounded-xl border border-[#d7dae5] bg-white px-3.5 py-3 text-sm leading-6 text-[#313950] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" />
                                {template.options && <div className="mt-4 space-y-2"><p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#697087]">{template.type === 'quiz' || template.type === 'peer-learning' ? 'Choices and correct answer' : 'Response choices'}</p>{template.options.map((option, optionIndex) => { const hasCorrectAnswer = template.type === 'quiz' || template.type === 'peer-learning'; return <div key={`${template.id}-${optionIndex}`} className="flex items-center gap-2"><input type="radio" name={`correct-${template.id}`} checked={hasCorrectAnswer && template.correctOptionIndex === optionIndex} onChange={() => hasCorrectAnswer && updateTemplate(template.id, { correctOptionIndex: optionIndex })} disabled={!hasCorrectAnswer} className={hasCorrectAnswer ? 'accent-[#5146e5]' : 'invisible'} aria-label={hasCorrectAnswer ? `Mark choice ${optionIndex + 1} correct` : undefined} /><input aria-label={`Choice ${optionIndex + 1}`} value={option} onChange={(event) => updateTemplateOption(template.id, optionIndex, event.target.value)} className="min-h-10 flex-1 rounded-lg border border-[#d7dae5] bg-white px-3 text-sm text-[#313950] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /><button type="button" onClick={() => removeTemplateOption(template.id, optionIndex)} disabled={template.options!.length <= 2} className="seminar-focus rounded-lg p-2 text-[#8b91a3] hover:bg-[#fff1ee] hover:text-[#b64936] disabled:opacity-25" aria-label={`Remove choice ${optionIndex + 1}`}><X className="h-3.5 w-3.5" /></button></div>; })}{template.options.length < 6 && <button type="button" onClick={() => updateTemplate(template.id, { options: [...template.options!, `Option ${template.options!.length + 1}`] })} className="seminar-focus ml-6 rounded-lg px-2 py-1 text-xs font-bold text-[#5146e5] hover:bg-white"><Plus className="mr-1 inline h-3.5 w-3.5" /> Add choice</button>}</div>}
                                {(template.type === 'quiz' || template.type === 'peer-learning') && <textarea aria-label={`${template.title} answer explanation`} value={template.explanation || ''} onChange={(event) => updateTemplate(template.id, { explanation: event.target.value })} rows={2} placeholder="Explain why the correct answer is right" className="mt-4 w-full resize-none rounded-xl border border-[#d7dae5] bg-white px-3.5 py-3 text-sm leading-6 text-[#313950] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" />}
                                {template.type === 'peer-learning' && <label className="mt-4 flex items-center gap-3 rounded-xl bg-[#f7f6ff] p-3 text-xs font-bold text-[#555d73]"><Repeat2 className="h-4 w-4 text-[#5146e5]" /> Partner discussion <input type="number" aria-label={`${template.title} discussion minutes`} min={1} max={10} value={template.discussionMinutes || 2} onChange={(event) => updateTemplate(template.id, { discussionMinutes: Number(event.target.value) })} className="ml-auto w-16 rounded-lg border border-[#d7dae5] bg-white px-2 py-1.5" /> min</label>}
                                {template.type === 'group-work' && <label className="mt-4 flex items-center gap-3 rounded-xl bg-[#fff5f0] p-3 text-xs font-bold text-[#654f48]"><UsersRound className="h-4 w-4 text-[#c85540]" /> Suggested size <input type="number" aria-label={`${template.title} group size`} min={2} max={10} value={template.groupSize || 4} onChange={(event) => updateTemplate(template.id, { groupSize: Number(event.target.value) })} className="ml-auto w-16 rounded-lg border border-[#e4d7d1] bg-white px-2 py-1.5" /> students</label>}
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#697087]"><label className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /><input type="number" aria-label={`${template.title} duration minutes`} min={1} max={60} value={template.durationMinutes || 3} onChange={(event) => updateTemplate(template.id, { durationMinutes: Number(event.target.value) })} className="w-16 rounded-lg border border-[#d7dae5] bg-white px-2 py-1.5" /> min</label><div className="flex gap-1"><button type="button" onClick={() => { setTemplates((current) => [...current, { ...template, id: `${template.id}-copy-${Date.now()}`, title: `${template.title} copy` }]); setSaved(false); }} className="seminar-focus rounded-lg p-2 hover:bg-white" aria-label={`Duplicate ${template.title}`}><Copy className="h-4 w-4" /></button><button type="button" onClick={() => { setTemplates((current) => current.filter((item) => item.id !== template.id)); setSaved(false); }} className="seminar-focus rounded-lg p-2 hover:bg-[#fff1ee] hover:text-[#b64936]" aria-label={`Delete ${template.title}`}><Trash2 className="h-4 w-4" /></button></div></div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#e3e5ed] pt-6"><span className={`flex items-center gap-1.5 text-sm font-semibold text-[#3a8b50] transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`} role="status"><Check className="h-4 w-4" /> Saved</span><Button onClick={saveLibrary} loading={saving} className="gap-2"><Save className="h-4 w-4" /> Save changes</Button></div>
                </section>

                <aside className="space-y-5 xl:sticky xl:top-6">
                  <section className="rounded-3xl border border-[#e3e5ed] bg-white p-6">
                    <p className="seminar-eyebrow mb-2">Class details</p><h2 className="seminar-display text-2xl text-[#101a38]">Keep the workspace current</h2>
                    <label className="mt-5 grid gap-1.5 text-xs font-bold text-[#697087]">Class name<input value={className} onChange={(event) => { setClassName(event.target.value); setSaved(false); }} className="min-h-11 rounded-xl border border-[#d7dae5] bg-white px-3 text-sm font-medium text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                    <label className="mt-4 grid gap-1.5 text-xs font-bold text-[#697087]">Term<input value={classTerm} onChange={(event) => { setClassTerm(event.target.value); setSaved(false); }} placeholder="Fall 2026" className="min-h-11 rounded-xl border border-[#d7dae5] bg-white px-3 text-sm font-medium text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                    <p className="mt-3 text-xs leading-5 text-[#697087]">The class code stays fixed so older attendance and session records remain connected.</p>
                    {!course.archived && <button type="button" onClick={() => setArchiveOpen(true)} className="seminar-focus mt-5 inline-flex items-center gap-2 rounded-lg text-sm font-bold text-[#8a4b3d] hover:text-[#b64936]"><Archive className="h-4 w-4" /> Archive this class</button>}
                  </section>
                  {!course.archived && <section className="rounded-3xl border border-[#dcd8ff] bg-[#f7f6ff] p-6">
                    <p className="seminar-eyebrow mb-2">Next step</p><h2 className="seminar-display text-3xl text-[#101a38]">Plan a session</h2><p className="mt-3 text-sm leading-6 text-[#697087]">Choose from this library, add lesson-specific questions, and put everything in teaching order.</p><Link href={`/dashboard/sessions/new?courseId=${course.id}`} className="mt-5 block"><Button className="w-full gap-2">Plan next session <ArrowRight className="h-4 w-4" /></Button></Link>
                  </section>}

                  <section className="rounded-3xl border border-[#e3e5ed] bg-white p-6">
                    <div className="flex items-center justify-between"><div><p className="seminar-eyebrow mb-2">Session history</p><h2 className="seminar-display text-2xl text-[#101a38]">Recent sessions</h2></div><span className="text-sm font-bold text-[#101a38]">{sessions.length}</span></div>
                    <div className="mt-5 space-y-1">{sessions.slice(0, 5).map((session) => <Link key={session.id} href={`/dashboard/sessions/${session.id}`} className="group flex items-center justify-between gap-3 rounded-xl px-2 py-3 hover:bg-[#f8f7fb]"><div className="min-w-0"><strong className="block truncate text-sm text-[#101a38]">{session.title || 'Untitled session'}</strong><span className="text-xs text-[#697087]">{session.active ? 'Live now' : readableDate(session.scheduledFor)}</span></div><ArrowRight className="h-4 w-4 shrink-0 text-[#a0a5b5] group-hover:text-[#5146e5]" /></Link>)}{sessions.length === 0 && <p className="py-5 text-sm leading-6 text-[#697087]">No sessions yet. Your first plan will appear here.</p>}</div>
                  </section>
                </aside>
              </fieldset>
              )}

              <Dialog isOpen={archiveOpen} onClose={() => setArchiveOpen(false)} onConfirm={archiveClass} title="Archive this class?" message="It will move out of your current classes. Sessions, attendance, student progress, and reusable interactions will be kept." confirmText="Archive class" variant="destructive" />

              {rolloverOpen && (
                <div className="fixed inset-0 z-[80] grid place-items-center bg-[#101a38]/55 p-4" role="presentation">
                  <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_28px_80px_rgba(16,26,56,0.25)] sm:p-8" role="dialog" aria-modal="true" aria-labelledby="rollover-title">
                    <div className="flex items-start justify-between gap-4"><div><p className="seminar-eyebrow mb-2">New teaching period</p><h2 id="rollover-title" className="seminar-display text-3xl text-[#101a38]">Start the next term</h2></div><button type="button" onClick={() => setRolloverOpen(false)} disabled={rollingOver} className="seminar-focus rounded-lg p-2 text-[#697087] hover:bg-[#f8f7fb]" aria-label="Close"><X className="h-5 w-5" /></button></div>
                    <p className="mt-3 text-sm leading-6 text-[#697087]">Your interaction library will be copied. Students, attendance, responses, and sessions will start fresh.</p>
                    <label className="mt-6 grid gap-1.5 text-xs font-bold text-[#697087]">New term<input value={nextTerm} onChange={(event) => setNextTerm(event.target.value)} placeholder="Spring 2027" className="min-h-11 rounded-xl border border-[#d7dae5] px-3 text-sm text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                    <label className="mt-4 grid gap-1.5 text-xs font-bold text-[#697087]">New class code<input value={nextCode} onChange={(event) => setNextCode(event.target.value)} className="min-h-11 rounded-xl border border-[#d7dae5] px-3 text-sm uppercase text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /><span className="font-normal leading-5">Use a new code so student and session records never mix across terms.</span></label>
                    <label className="mt-5 flex items-start gap-3 rounded-xl bg-[#f7f6ff] p-4 text-sm leading-6 text-[#3f465b]"><input type="checkbox" checked={archiveAfterRollover} onChange={(event) => setArchiveAfterRollover(event.target.checked)} className="mt-1 accent-[#5146e5]" /><span><strong className="block text-[#101a38]">Archive the current class</strong>Keep its history available under Archived classes.</span></label>
                    <div className="mt-7 flex justify-end gap-3"><Button variant="ghost" onClick={() => setRolloverOpen(false)} disabled={rollingOver}>Cancel</Button><Button onClick={createNextTerm} loading={rollingOver} disabled={!nextTerm.trim() || !nextCode.trim()} className="gap-2"><CalendarSync className="h-4 w-4" /> Create next term</Button></div>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
