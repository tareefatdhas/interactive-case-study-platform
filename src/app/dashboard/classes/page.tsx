'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { createCourse, getCoursesByTeacher, getSessionsByTeacher } from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import InlineMessage from '@/components/ui/InlineMessage';
import type { Course, Session, SessionInteraction } from '@/types';
import {
  ArrowRight,
  Archive,
  CalendarPlus,
  CheckCircle2,
  GraduationCap,
  Layers3,
  LoaderCircle,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';

const starterInteractions: SessionInteraction[] = [
  {
    id: 'template-arrival-pulse',
    type: 'pulse',
    title: 'Arrival check-in',
    prompt: 'How are you arriving today?',
    plannedTime: 'Start of class',
    durationMinutes: 2,
    options: ['Energized', 'Steady', 'A little tired', 'Overwhelmed', 'Prefer not to say'],
    resultVisibility: 'live',
  },
  {
    id: 'template-confidence-check',
    type: 'pulse',
    title: 'Confidence check',
    prompt: 'How confident do you feel about this idea?',
    plannedTime: 'After a key concept',
    durationMinutes: 2,
    options: ['Still fuzzy', 'Getting there', 'Mostly got it', 'Confident', 'Could explain it'],
    resultVisibility: 'live',
  },
  {
    id: 'template-exit-question',
    type: 'open-response',
    title: 'Exit reflection',
    prompt: 'What is one question you are leaving with?',
    plannedTime: 'End of class',
    durationMinutes: 3,
    resultVisibility: 'instructor-only',
  },
];

export default function ClassesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [term, setTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState('');

  const loadClasses = async () => {
    if (!user) return;
    try {
      const [courseData, sessionData] = await Promise.all([
        getCoursesByTeacher(user.uid, true),
        getSessionsByTeacher(user.uid),
      ]);
      setCourses(courseData);
      setSessions(sessionData);
    } catch (loadError) {
      console.error('Could not load classes:', loadError);
      setError('Your classes could not be loaded. Try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
    // loadClasses is stable for the signed-in user in this view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const classSummaries = useMemo(() => courses.filter((course) => Boolean(course.archived) === showArchived).map((course) => {
    const courseSessions = sessions.filter((session) => (
      session.courseId === course.id || (!session.courseId && session.courseCode === course.code)
    ));
    const students = new Set(courseSessions.flatMap((session) => session.studentsJoined || []));
    const upcoming = courseSessions
      .filter((session) => !session.active && session.scheduledFor && new Date(session.scheduledFor) >= new Date())
      .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())[0];
    return { course, courseSessions, students: students.size, upcoming };
  }), [courses, sessions, showArchived]);

  const archivedCount = courses.filter((course) => course.archived).length;

  const createNewClass = async () => {
    if (!user || !code.trim() || !name.trim()) return;
    const normalizedCode = code.trim().toUpperCase();
    if (courses.some((course) => course.code.trim().toUpperCase() === normalizedCode)) {
      setError('That class code is already in use. Choose a different code so records stay separate.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await createCourse({
        code: normalizedCode,
        name: name.trim(),
        term: term.trim() || undefined,
        teacherId: user.uid,
        studentIds: [],
        interactionTemplates: starterInteractions,
      });
      setCode('');
      setName('');
      setTerm('');
      setShowCreate(false);
      await loadClasses();
    } catch (createError) {
      console.error('Could not create class:', createError);
      setError('The class could not be saved. Check the details and try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <main className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-10">
          <header className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="seminar-eyebrow mb-3">Teaching workspace</p>
              <h1 className="seminar-display text-4xl text-[#101a38] sm:text-5xl">Your classes</h1>
              <p className="mt-3 text-base leading-7 text-[#697087]">Create each course once, then organize its meetings into sessions with a clear flow of classroom activities.</p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="gap-2 self-start sm:self-auto">
              <Plus className="h-4 w-4" /> Add class
            </Button>
          </header>

          <section className="mb-8 grid gap-3 rounded-2xl border border-[#dcd8ff] bg-[#f7f6ff] p-5 sm:grid-cols-3" aria-label="Class planning model">
            {[
              [GraduationCap, 'Set up the class', 'Add the course once, including its name and term.'],
              [CalendarPlus, 'Plan each session', 'Create the meetings you expect to teach this term.'],
              [Layers3, 'Build the activity flow', 'Add polls, quizzes, check-ins, or modules in teaching order.'],
            ].map(([Icon, title, copy], index) => {
              const StepIcon = Icon as typeof GraduationCap;
              return (
                <div key={String(title)} className="flex gap-3 rounded-xl bg-white/75 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f0efff] text-[#5146e5]"><StepIcon className="h-4 w-4" /></span>
                  <div><strong className="text-sm text-[#101a38]">{index + 1}. {String(title)}</strong><p className="mt-1 text-xs leading-5 text-[#697087]">{String(copy)}</p></div>
                </div>
              );
            })}
          </section>

          <div className="mb-6 flex flex-wrap items-center gap-2" aria-label="Class list view">
            <button type="button" onClick={() => setShowArchived(false)} className={`seminar-focus rounded-full px-4 py-2 text-sm font-bold ${!showArchived ? 'bg-[#101a38] text-white' : 'bg-white text-[#697087] hover:bg-[#f8f7fb]'}`}>Current classes</button>
            <button type="button" onClick={() => setShowArchived(true)} className={`seminar-focus inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${showArchived ? 'bg-[#101a38] text-white' : 'bg-white text-[#697087] hover:bg-[#f8f7fb]'}`}><Archive className="h-4 w-4" /> Archived <span className="tabular-nums">{archivedCount}</span></button>
          </div>

          {error && <InlineMessage className="mb-6" title="Your classes are still here." message={error} />}

          {loading ? (
            <div className="flex min-h-64 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#5146e5]" /></div>
          ) : classSummaries.length === 0 && showArchived ? (
            <section className="rounded-3xl border border-dashed border-[#cfd2df] bg-white px-6 py-14 text-center">
              <Archive className="mx-auto h-7 w-7 text-[#697087]" />
              <h2 className="seminar-display mt-4 text-3xl text-[#101a38]">No archived classes.</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#697087]">Classes you close at the end of a term will be kept here with their session history intact.</p>
            </section>
          ) : classSummaries.length === 0 ? (
            <section className="rounded-3xl border border-dashed border-[#cfd2df] bg-white px-6 py-16 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0efff] text-[#5146e5]"><GraduationCap className="h-7 w-7" /></span>
              <h2 className="seminar-display mt-5 text-3xl text-[#101a38]">Start with the class you teach next.</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#697087]">We will add a small starter kit of useful check-ins. You can keep, edit, or remove every one.</p>
              <Button onClick={() => setShowCreate(true)} className="mt-6 gap-2"><Plus className="h-4 w-4" /> Add your first class</Button>
            </section>
          ) : (
            <section className="grid gap-5 lg:grid-cols-2">
              {classSummaries.map(({ course, courseSessions, students, upcoming }) => (
                <article key={course.id} className={`group rounded-3xl border p-6 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(16,26,56,0.08)] ${course.archived ? 'border-[#e3e5ed] bg-[#f8f7f3]' : 'border-[#e3e5ed] bg-white hover:border-[#cbc7ff]'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#101a38] px-3 py-1 text-xs font-bold text-white">{course.code}</span>{course.term && <span className="text-xs font-semibold text-[#697087]">{course.term}</span>}{course.archived && <span className="rounded-full bg-[#e7e5df] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#5f6472]">Archived</span>}</div>
                      <h2 className="seminar-display mt-4 text-3xl text-[#101a38]">{course.name}</h2>
                    </div>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff2ed] text-[#c85540]"><Sparkles className="h-5 w-5" /></span>
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-3 border-y border-[#e3e5ed] py-5">
                    <div><strong className="block text-xl text-[#101a38]">{courseSessions.length}</strong><span className="text-xs text-[#697087]">sessions</span></div>
                    <div><strong className="block text-xl text-[#101a38]">{students}</strong><span className="text-xs text-[#697087]">students seen</span></div>
                    <div><strong className="block text-xl text-[#101a38]">{course.interactionTemplates?.length || 0}</strong><span className="text-xs text-[#697087]">saved activities</span></div>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-4">
                    <div className="min-w-0 text-xs leading-5 text-[#697087]">
                      {course.archived ? <span>Session history and student records are preserved</span> : upcoming ? <><span className="font-semibold text-[#3a4258]">Next:</span> {upcoming.title || 'Prepared session'}</> : <span>No upcoming session prepared</span>}
                    </div>
                    <Link href={`/dashboard/classes/${course.id}`} className="seminar-focus inline-flex shrink-0 items-center gap-2 rounded-lg text-sm font-bold text-[#5146e5]">Open class <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Link>
                  </div>
                </article>
              ))}
            </section>
          )}

          {showCreate && (
            <div className="fixed inset-0 z-[70] grid place-items-center bg-[#101a38]/55 p-4" role="dialog" aria-modal="true" aria-labelledby="new-class-title">
              <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_28px_80px_rgba(16,26,56,0.25)] sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="seminar-eyebrow mb-2">New class</p><h2 id="new-class-title" className="seminar-display text-3xl text-[#101a38]">What are you teaching?</h2></div>
                  <button type="button" onClick={() => setShowCreate(false)} className="seminar-focus rounded-lg p-2 text-[#697087] hover:bg-[#f8f7fb]" aria-label="Close"><X className="h-5 w-5" /></button>
                </div>
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <Input label="Class code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="ECON 302" />
                  <Input label="Term" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Fall 2026" />
                  <div className="sm:col-span-2"><Input label="Class name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Intermediate Microeconomics" /></div>
                </div>
                <div className="mt-6 flex gap-3 rounded-xl bg-[#f7f6ff] p-4 text-sm leading-6 text-[#555d73]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5146e5]" /><span>We will include an arrival check-in, confidence check, and exit reflection as editable starting points.</span></div>
                <div className="mt-7 flex justify-end gap-3"><Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={createNewClass} loading={creating} disabled={!code.trim() || !name.trim()} className="gap-2"><Plus className="h-4 w-4" /> Create class</Button></div>
              </div>
            </div>
          )}
        </main>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
