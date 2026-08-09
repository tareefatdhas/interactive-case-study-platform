'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getCaseStudiesByTeacher, getCoursesByTeacher, getSessionsByTeacher } from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import Button from '@/components/ui/Button';
import type { CaseStudy, Course, Session } from '@/types';
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, GraduationCap, LoaderCircle, MonitorUp, Plus } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([getCaseStudiesByTeacher(user.uid), getCoursesByTeacher(user.uid), getSessionsByTeacher(user.uid)])
      .then(([studies, teacherCourses, teacherSessions]) => {
        setCaseStudies(studies);
        setCourses(teacherCourses);
        setSessions(teacherSessions);
      })
      .catch((error) => console.error('Could not load the instructor overview:', error))
      .finally(() => setLoading(false));
  }, [user]);

  const recentSessions = sessions.slice(0, 3);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <main className="mx-auto max-w-6xl p-6 lg:p-10">
          <header className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="seminar-eyebrow mb-2">Instructor home</p>
              <h1 className="seminar-display text-4xl leading-tight text-[#101a38] sm:text-5xl">What does your class need next?</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#697087]">Prepare the next session, return to a recent class, or review what attendance, questions, and understanding are showing across the course.</p>
            </div>
            <Link href={courses.length ? `/dashboard/classes/${courses[0].id}` : '/dashboard/classes'}><Button size="lg" className="gap-2 whitespace-nowrap">{courses.length ? <CalendarDays className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{courses.length ? 'Choose a class' : 'Add your first class'}</Button></Link>
          </header>

          {loading ? (
            <div className="flex min-h-80 items-center justify-center" role="status"><LoaderCircle className="h-7 w-7 animate-spin text-[#5146e5]" /><span className="sr-only">Loading your sessions</span></div>
          ) : (
            <>
              {sessions.length === 0 ? (
                <section className="overflow-hidden rounded-2xl border border-[#dcd8ff] bg-white" aria-labelledby="first-session-title">
                  <div className="border-b border-[#e3e5ed] bg-[#f7f6ff] p-6 sm:p-8">
                    <p className="seminar-eyebrow mb-2">Your first classroom</p>
                    <h2 id="first-session-title" className="seminar-display text-3xl text-[#101a38] sm:text-4xl">Start the course record with one useful interaction.</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[#697087]">A check-in at the beginning or one knowledge check after a difficult idea is enough. Each later session can build on what this class reveals.</p>
                  </div>
                  <div className="grid divide-y divide-[#e3e5ed] md:grid-cols-3 md:divide-x md:divide-y-0">
                    {[
                      { icon: GraduationCap, title: 'Set up the class once', copy: 'Add its name, term, and reusable interaction kit.' },
                      { icon: CheckCircle2, title: 'Prepare one or two prompts', copy: 'Choose a pulse, poll, quiz, or short response.' },
                      { icon: MonitorUp, title: 'Open the display and teach', copy: 'Show a prompt, discuss the result, then return to your slides.' },
                    ].map(({ icon: Icon, title, copy }) => (
                      <div className="p-6" key={title}><Icon className="h-5 w-5 text-[#5146e5]" /><h3 className="mt-4 font-semibold text-[#101a38]">{title}</h3><p className="mt-1 text-sm leading-6 text-[#697087]">{copy}</p></div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-3 border-t border-[#e3e5ed] p-6 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[#697087]">Most instructors can prepare the first session in a few minutes.</p>
                    <Link href={courses.length ? `/dashboard/classes/${courses[0].id}` : '/dashboard/classes'}><Button className="gap-2">{courses.length ? 'Open class workspace' : 'Add your first class'} <ArrowRight className="h-4 w-4" /></Button></Link>
                  </div>
                </section>
              ) : (
                <section aria-labelledby="recent-sessions-title">
                  <div className="mb-4 flex items-center justify-between"><div><p className="seminar-eyebrow mb-1">Teach</p><h2 id="recent-sessions-title" className="seminar-display text-3xl text-[#101a38]">Your sessions</h2></div><Link href="/dashboard/sessions" className="seminar-focus rounded-lg text-sm font-semibold text-[#5146e5]">View all</Link></div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    {recentSessions.map((session) => (
                      <article className="flex min-h-52 flex-col rounded-2xl border border-[#e3e5ed] bg-white p-5" key={session.id}>
                        <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-[0.08em] text-[#5146e5]">{session.courseCode || 'Class session'}</span>{session.active && <span className="rounded-full bg-[#edf8ef] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#28733a]">Live</span>}</div>
                        <h3 className="seminar-display mt-3 text-2xl leading-tight text-[#101a38]">{session.title || session.caseStudyTitle || 'Untitled session'}</h3>
                        <div className="mt-3 flex items-center gap-2 text-xs text-[#697087]"><Clock3 className="h-3.5 w-3.5" />{session.interactions?.length || 0} prepared interactions</div>
                        <Link className="mt-auto pt-5" href={`/dashboard/sessions/${session.id}`}><Button variant="outline" className="w-full gap-2">{session.active ? 'Return to class' : 'Open session'} <ArrowRight className="h-4 w-4" /></Button></Link>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="mt-10 border-t border-[#e3e5ed] pt-8" aria-labelledby="lesson-material-title">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="seminar-eyebrow mb-1">Optional module</p><h2 id="lesson-material-title" className="seminar-display text-3xl text-[#101a38]">Case material</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#697087]">Add a case when the lesson needs a shared decision or reading. It is not required for live polls and quizzes.</p></div>
                  <div className="flex gap-2"><Link href="/dashboard/case-studies"><Button variant="ghost">View library</Button></Link><Link href="/dashboard/case-studies/new"><Button variant="outline" className="gap-2"><BookOpen className="h-4 w-4" /> Add case</Button></Link></div>
                </div>
                {caseStudies.length > 0 && <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#e3e5ed] bg-white px-4 py-3 text-sm text-[#4f576d]"><BookOpen className="h-4 w-4 text-[#5146e5]" /><span><strong className="text-[#101a38]">{caseStudies.length}</strong> {caseStudies.length === 1 ? 'case is' : 'cases are'} ready in your lesson library.</span></div>}
              </section>
            </>
          )}
        </main>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
