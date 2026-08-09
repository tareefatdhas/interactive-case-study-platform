'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getCourse, getSessionsByTeacher, updateCourse } from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import Button from '@/components/ui/Button';
import type { Course, Session, SessionInteraction, SessionInteractionType } from '@/types';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarPlus,
  Check,
  CircleHelp,
  Clock3,
  Copy,
  HeartPulse,
  Library,
  LoaderCircle,
  MessageCircle,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Users,
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
        : 'What question is still unresolved?',
  plannedTime: 'During class',
  durationMinutes: type === 'open-response' ? 4 : 3,
  options: type === 'pulse'
    ? ['Still fuzzy', 'Getting there', 'Mostly got it', 'Confident', 'Could explain it']
    : type === 'poll' || type === 'quiz'
      ? ['Option 1', 'Option 2', 'Option 3', 'Option 4']
      : undefined,
  correctOptionIndex: type === 'quiz' ? 0 : undefined,
  resultVisibility: type === 'quiz' ? 'after-reveal' : type === 'open-response' ? 'instructor-only' : 'live',
});

const readableDate = (value?: string) => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ClassWorkspacePage({ params }: ClassWorkspaceProps) {
  const { id } = use(params);
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<SessionInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
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

  const updateTemplate = (templateId: string, updates: Partial<SessionInteraction>) => {
    setSaved(false);
    setTemplates((current) => current.map((template) => template.id === templateId ? { ...template, ...updates } : template));
  };

  const saveLibrary = async () => {
    if (!course) return;
    setSaving(true);
    setError('');
    try {
      await updateCourse(course.id, { interactionTemplates: templates });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch (saveError) {
      console.error('Could not save interaction library:', saveError);
      setError('Your interaction library could not be saved. Try again.');
    } finally {
      setSaving(false);
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
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#101a38] px-3 py-1 text-xs font-bold text-white">{course.code}</span>{course.term && <span className="text-xs font-semibold text-[#697087]">{course.term}</span>}</div>
                  <h1 className="seminar-display mt-4 text-4xl text-[#101a38] sm:text-5xl">{course.name}</h1>
                  <div className="mt-4 flex flex-wrap gap-5 text-sm text-[#697087]"><span className="flex items-center gap-2"><CalendarPlus className="h-4 w-4" /> {sessions.length} sessions</span><span className="flex items-center gap-2"><Users className="h-4 w-4" /> {studentCount} students seen</span><span className="flex items-center gap-2"><Library className="h-4 w-4" /> {templates.length} reusable interactions</span></div>
                </div>
                <div className="flex flex-wrap gap-3"><Link href={`/dashboard/progress?courseId=${course.id}`}><Button variant="outline">View progress</Button></Link><Link href={`/dashboard/sessions/new?courseId=${course.id}`}><Button className="gap-2"><CalendarPlus className="h-4 w-4" /> Plan next session</Button></Link></div>
              </header>

              <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
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
                                {template.options && <div className="mt-3 flex flex-wrap gap-2">{template.options.map((option, optionIndex) => <span key={`${template.id}-${optionIndex}`} className="rounded-full border border-[#e0e2ec] bg-white px-3 py-1 text-xs text-[#555d73]">{option}</span>)}</div>}
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#697087]"><span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> About {template.durationMinutes || 3} min</span><div className="flex gap-1"><button type="button" onClick={() => { setTemplates((current) => [...current, { ...template, id: `${template.id}-copy-${Date.now()}`, title: `${template.title} copy` }]); setSaved(false); }} className="seminar-focus rounded-lg p-2 hover:bg-white" aria-label={`Duplicate ${template.title}`}><Copy className="h-4 w-4" /></button><button type="button" onClick={() => { setTemplates((current) => current.filter((item) => item.id !== template.id)); setSaved(false); }} className="seminar-focus rounded-lg p-2 hover:bg-[#fff1ee] hover:text-[#b64936]" aria-label={`Delete ${template.title}`}><Trash2 className="h-4 w-4" /></button></div></div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#e3e5ed] pt-6"><span className={`flex items-center gap-1.5 text-sm font-semibold text-[#3a8b50] transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`} role="status"><Check className="h-4 w-4" /> Saved</span><Button onClick={saveLibrary} loading={saving} className="gap-2"><Save className="h-4 w-4" /> Save library</Button></div>
                </section>

                <aside className="space-y-5 xl:sticky xl:top-6">
                  <section className="rounded-3xl border border-[#dcd8ff] bg-[#f7f6ff] p-6">
                    <p className="seminar-eyebrow mb-2">Next step</p><h2 className="seminar-display text-3xl text-[#101a38]">Plan a session</h2><p className="mt-3 text-sm leading-6 text-[#697087]">Choose from this library, add lesson-specific questions, and put everything in teaching order.</p><Link href={`/dashboard/sessions/new?courseId=${course.id}`} className="mt-5 block"><Button className="w-full gap-2">Plan next session <ArrowRight className="h-4 w-4" /></Button></Link>
                  </section>

                  <section className="rounded-3xl border border-[#e3e5ed] bg-white p-6">
                    <div className="flex items-center justify-between"><div><p className="seminar-eyebrow mb-2">Session history</p><h2 className="seminar-display text-2xl text-[#101a38]">Recent sessions</h2></div><span className="text-sm font-bold text-[#101a38]">{sessions.length}</span></div>
                    <div className="mt-5 space-y-1">{sessions.slice(0, 5).map((session) => <Link key={session.id} href={`/dashboard/sessions/${session.id}`} className="group flex items-center justify-between gap-3 rounded-xl px-2 py-3 hover:bg-[#f8f7fb]"><div className="min-w-0"><strong className="block truncate text-sm text-[#101a38]">{session.title || 'Untitled session'}</strong><span className="text-xs text-[#697087]">{session.active ? 'Live now' : readableDate(session.scheduledFor)}</span></div><ArrowRight className="h-4 w-4 shrink-0 text-[#a0a5b5] group-hover:text-[#5146e5]" /></Link>)}{sessions.length === 0 && <p className="py-5 text-sm leading-6 text-[#697087]">No sessions yet. Your first plan will appear here.</p>}</div>
                  </section>
                </aside>
              </div>
            </>
          )}
        </main>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
