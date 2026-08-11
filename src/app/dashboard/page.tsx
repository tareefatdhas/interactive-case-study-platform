'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { checkAndTimeoutInactiveSessions, getCoursesByTeacher, getSessionsByTeacher } from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import Button from '@/components/ui/Button';
import { AmbientLoading } from '@/components/motion';
import type { Course, Session } from '@/types';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Layers3,
  MonitorUp,
  Plus,
  Radio,
  Users,
} from 'lucide-react';

function sessionDate(session: Session) {
  if (session.scheduledFor) {
    const scheduled = new Date(session.scheduledFor);
    if (!Number.isNaN(scheduled.getTime())) return scheduled;
  }
  const createdAt = session.createdAt as unknown as { toDate?: () => Date } | undefined;
  return createdAt?.toDate?.() || new Date(0);
}

function readableSessionDate(session: Session) {
  if (!session.scheduledFor) return 'Date not set';
  const date = new Date(session.scheduledFor);
  if (Number.isNaN(date.getTime())) return session.scheduledFor;
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([getCoursesByTeacher(user.uid), checkAndTimeoutInactiveSessions(user.uid)])
      .then(async ([teacherCourses]) => {
        const teacherSessions = await getSessionsByTeacher(user.uid);
        setCourses(teacherCourses.filter((course) => !course.archived));
        setSessions(teacherSessions);
      })
      .catch((error) => console.error('Could not load the instructor home:', error))
      .finally(() => setLoading(false));
  }, [user]);

  const sessionsByCourse = useMemo(() => new Map(courses.map((course) => [
    course.id,
    sessions
      .filter((session) => session.courseId === course.id || (!session.courseId && session.courseCode === course.code))
      .sort((a, b) => sessionDate(b).getTime() - sessionDate(a).getTime()),
  ])), [courses, sessions]);

  const liveSession = sessions.find((session) => session.active);
  const upcomingSession = [...sessions]
    .filter((session) => !session.active && !session.endedAt && session.scheduledFor && sessionDate(session).getTime() >= Date.now())
    .sort((a, b) => sessionDate(a).getTime() - sessionDate(b).getTime())[0];
  const nextSession = liveSession || upcomingSession;
  const nextCourse = nextSession
    ? courses.find((course) => course.id === nextSession.courseId || course.code === nextSession.courseCode)
    : courses[0];
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <main className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-10">
          <header className="flex flex-col gap-5 border-b border-[#e3e5ed] pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="seminar-eyebrow mb-3">Instructor home</p>
              <h1 className="seminar-display text-4xl leading-[1.05] text-[#101a38] sm:text-5xl">Good to see you, {firstName}.</h1>
              <p className="mt-3 text-base leading-7 text-[#697087]">Choose a class, prepare its next session, or return to the room you are teaching now.</p>
            </div>
            <Link href="/dashboard/classes"><Button variant="outline" size="lg" className="gap-2 whitespace-nowrap"><Plus className="h-4 w-4" /> Add class</Button></Link>
          </header>

          {loading ? (
            <div className="grid min-h-80 place-items-center" role="status" aria-label="Loading your classes"><AmbientLoading className="w-44 rounded-full" announce="off" /></div>
          ) : courses.length === 0 ? (
            <section className="mt-8 overflow-hidden rounded-3xl border border-[#dcd8ff] bg-white" aria-labelledby="first-class-title">
              <div className="grid gap-8 bg-[linear-gradient(125deg,#f7f6ff_0%,#fffefa_58%,#fff2ed_100%)] p-7 sm:p-10 lg:grid-cols-[1fr_340px] lg:items-center">
                <div>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5146e5] text-white shadow-[0_8px_22px_rgba(81,70,229,0.24)]"><GraduationCap className="h-5 w-5" /></span>
                  <p className="seminar-eyebrow mb-2 mt-6">Start here</p>
                  <h2 id="first-class-title" className="seminar-display max-w-2xl text-4xl leading-tight text-[#101a38]">Create the class you teach next.</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#697087]">A class keeps its students, sessions, progress, and reusable activities together. You only set it up once per term.</p>
                  <Link href="/dashboard/classes" className="mt-6 inline-block"><Button size="lg" className="gap-2">Create your first class <ArrowRight className="h-4 w-4" /></Button></Link>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-[0_18px_45px_rgba(16,26,56,0.08)] backdrop-blur">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#5146e5]">How it is organized</p>
                  {[
                    [GraduationCap, 'Class', 'The course and term you teach'],
                    [CalendarDays, 'Sessions', 'Each meeting of that class'],
                    [Layers3, 'Activities', 'Polls, quizzes, check-ins, and modules'],
                  ].map(([Icon, title, copy], index) => {
                    const StepIcon = Icon as typeof GraduationCap;
                    return <div key={String(title)} className="mt-4 flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f0efff] text-[#5146e5]"><StepIcon className="h-4 w-4" /></span><div><strong className="text-sm text-[#101a38]">{index + 1}. {String(title)}</strong><p className="mt-0.5 text-xs leading-5 text-[#697087]">{String(copy)}</p></div></div>;
                  })}
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="mt-8" aria-labelledby="teach-next-title">
                <div className="mb-4 flex items-end justify-between gap-4"><div><p className="seminar-eyebrow mb-2">Teach next</p><h2 id="teach-next-title" className="seminar-display text-3xl text-[#101a38]">{liveSession ? 'Your class is live' : nextSession ? 'Your next prepared session' : 'Plan the next meeting'}</h2></div></div>
                <article className="relative overflow-hidden rounded-3xl border border-[#dcd8ff] bg-[#101a38] text-white shadow-[0_18px_50px_rgba(16,26,56,0.12)]">
                  <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_center,rgba(111,94,255,0.4),transparent_66%)]" aria-hidden="true" />
                  <div className="relative grid gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#c9c4ff]">{liveSession && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2f8750] px-2.5 py-1 text-white"><Radio className="h-3.5 w-3.5" /> Live now</span>}<span>{nextCourse?.code}</span>{nextCourse?.term && <span>· {nextCourse.term}</span>}</div>
                      <h3 className="seminar-display mt-4 text-3xl leading-tight !text-white sm:text-4xl">{nextSession?.title || `Prepare the next ${nextCourse?.name || 'class'} session`}</h3>
                      <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#c6cbda]">
                        {nextSession ? <><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {liveSession ? 'In progress' : readableSessionDate(nextSession)}</span><span className="flex items-center gap-2"><Layers3 className="h-4 w-4" /> {nextSession.interactions?.length || 0} prepared activities</span></> : <span>Build a short flow of moments you can launch beside your slides.</span>}
                      </div>
                    </div>
                    <Link href={nextSession ? (liveSession ? `/live?sessionId=${nextSession.id}` : `/dashboard/sessions/${nextSession.id}`) : `/dashboard/sessions/new?courseId=${nextCourse?.id}`}>
                      <Button size="lg" className="w-full gap-2 border-white bg-white text-[#101a38] hover:bg-[#f3f2ff] lg:w-auto">{liveSession ? <MonitorUp className="h-4 w-4" /> : nextSession ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{liveSession ? 'Return to live class' : nextSession ? 'Open session' : 'Plan a session'} <ArrowRight className="h-4 w-4" /></Button>
                    </Link>
                  </div>
                </article>
              </section>

              <section className="mt-10" aria-labelledby="your-classes-title">
                <div className="mb-5 flex items-end justify-between"><div><p className="seminar-eyebrow mb-2">Your teaching</p><h2 id="your-classes-title" className="seminar-display text-3xl text-[#101a38]">Classes</h2></div><Link href="/dashboard/classes" className="seminar-focus rounded-lg text-sm font-bold text-[#5146e5]">View all classes</Link></div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {courses.map((course) => {
                    const courseSessions = sessionsByCourse.get(course.id) || [];
                    const latest = courseSessions[0];
                    const students = new Set(courseSessions.flatMap((session) => session.studentsJoined || [])).size;
                    return (
                      <Link key={course.id} href={`/dashboard/classes/${course.id}`} className="seminar-focus group rounded-3xl border border-[#e3e5ed] bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:border-[#cbc7ff] hover:shadow-[0_16px_40px_rgba(16,26,56,0.08)]">
                        <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#f0efff] px-3 py-1 text-xs font-bold text-[#4137c7]">{course.code}</span>{course.term && <span className="text-xs font-semibold text-[#697087]">{course.term}</span>}</div><h3 className="seminar-display mt-4 text-3xl leading-tight text-[#101a38]">{course.name}</h3></div><ArrowRight className="mt-2 h-5 w-5 text-[#a2a7b7] transition-transform group-hover:translate-x-1 group-hover:text-[#5146e5]" /></div>
                        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#e3e5ed] pt-5 text-sm"><span className="flex items-center gap-2 text-[#697087]"><CalendarDays className="h-4 w-4 text-[#5146e5]" /><strong className="text-[#101a38]">{courseSessions.length}</strong> sessions</span><span className="flex items-center gap-2 text-[#697087]"><Users className="h-4 w-4 text-[#c85540]" /><strong className="text-[#101a38]">{students}</strong> students</span></div>
                        <div className="mt-4 flex items-center gap-2 text-xs text-[#697087]"><Clock3 className="h-3.5 w-3.5" />{latest ? `Latest: ${latest.title || 'Untitled session'}` : 'No sessions prepared yet'}</div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </main>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
