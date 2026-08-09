'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getAllStudentsWithStats, getCoursesByTeacher, getSessionsByTeacher } from '@/lib/firebase/firestore';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import StudentResponseModal from '@/components/teacher/StudentResponseModal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { Course, Session, Student } from '@/types';
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Download,
  Eye,
  GraduationCap,
  LoaderCircle,
  Search,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';

interface StudentWithStats extends Student {
  stats: {
    totalResponses: number;
    correctResponses: number;
    correctPercentage: number;
    totalPoints: number;
    maxTotalPoints: number;
    averageScore: number;
    progressPercentage: number;
    totalQuestionsAvailable: number;
  };
}

const hasStudent = (session: Session, student: StudentWithStats) => (
  session.studentsJoined?.includes(student.id) || session.studentsJoined?.includes(student.studentId)
);

function ProgressContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const requestedCourseId = searchParams.get('courseId') || 'all';
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(requestedCourseId);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProgress = async () => {
      if (!user) return;
      try {
        const [courseData, sessionData, studentData] = await Promise.all([
          getCoursesByTeacher(user.uid),
          getSessionsByTeacher(user.uid),
          getAllStudentsWithStats(user.uid),
        ]);
        setCourses(courseData);
        setSessions(sessionData);
        setStudents(studentData as StudentWithStats[]);
      } catch (loadError) {
        console.error('Could not load student progress:', loadError);
        setError('Student progress could not be loaded. Try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };
    loadProgress();
  }, [user]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const relevantSessions = useMemo(() => sessions.filter((session) => (
    selectedCourseId === 'all'
      ? true
      : session.courseId === selectedCourseId || (!session.courseId && session.courseCode === selectedCourse?.code)
  )), [selectedCourse?.code, selectedCourseId, sessions]);

  const heldSessions = useMemo(() => relevantSessions.filter((session) => (
    session.active || session.startedAt || session.endedAt || (session.studentsJoined?.length || 0) > 0
  )), [relevantSessions]);

  const visibleStudents = useMemo(() => {
    const inScope = selectedCourseId === 'all'
      ? students
      : students.filter((student) => heldSessions.some((session) => hasStudent(session, student)));
    const query = search.trim().toLowerCase();
    return inScope
      .filter((student) => !query || student.name?.toLowerCase().includes(query) || student.studentId.toLowerCase().includes(query))
      .map((student) => {
        const attended = heldSessions.filter((session) => hasStudent(session, student)).length;
        const attendance = heldSessions.length ? Math.round((attended / heldSessions.length) * 100) : 0;
        return { ...student, attended, attendance };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [heldSessions, search, selectedCourseId, students]);

  const allScopedStudents = useMemo(() => {
    const inScope = selectedCourseId === 'all'
      ? students
      : students.filter((student) => heldSessions.some((session) => hasStudent(session, student)));
    return inScope.map((student) => {
      const attended = heldSessions.filter((session) => hasStudent(session, student)).length;
      return { ...student, attended, attendance: heldSessions.length ? Math.round((attended / heldSessions.length) * 100) : 0 };
    });
  }, [heldSessions, selectedCourseId, students]);

  const averageAttendance = allScopedStudents.length
    ? Math.round(allScopedStudents.reduce((sum, student) => sum + student.attendance, 0) / allScopedStudents.length)
    : 0;
  const activeParticipants = allScopedStudents.filter((student) => student.attendance >= 75).length;
  const needsFollowUp = allScopedStudents.filter((student) => (
    (heldSessions.length >= 2 && student.attendance < 60) || (student.stats.totalResponses >= 3 && student.stats.correctPercentage < 60)
  )).length;
  const recentSessions = [...heldSessions]
    .sort((a, b) => (b.startedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0)).getTime() - (a.startedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0)).getTime())
    .slice(0, 6)
    .reverse();

  const exportProgress = () => {
    const rows = visibleStudents.map((student) => [
      student.name,
      student.studentId,
      `${student.attended}/${heldSessions.length}`,
      `${student.attendance}%`,
      `${student.stats.correctPercentage}%`,
      student.stats.totalResponses,
    ]);
    const csv = [['Student', 'Student ID', 'Sessions attended', 'Attendance', 'Overall correct', 'Responses'], ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedCourse?.code || 'all-classes'}-progress.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <main className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-10">
          <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl"><p className="seminar-eyebrow mb-3">Student progress</p><h1 className="seminar-display text-4xl text-[#101a38] sm:text-5xl">See who is keeping up.</h1><p className="mt-3 text-base leading-7 text-[#697087]">Start with class-level patterns, then look at an individual student only when you need more context.</p></div>
            <div className="flex flex-wrap gap-3">
              <label className="grid gap-1.5 text-xs font-bold text-[#697087]">Class<select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} className="min-h-11 min-w-56 rounded-xl border border-[#d7dae5] bg-white px-3 text-sm font-semibold text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]"><option value="all">All classes</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select></label>
              <Button variant="outline" onClick={exportProgress} disabled={visibleStudents.length === 0} className="mt-auto gap-2"><Download className="h-4 w-4" /> Export</Button>
            </div>
          </header>

          {error && <p className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p>}
          {loading ? <div className="flex min-h-80 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#5146e5]" /></div> : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Progress summary">
                {[
                  [Users, allScopedStudents.length, 'Students seen', 'Unique students in recorded sessions', '#f0efff', '#5146e5'],
                  [CalendarCheck, `${averageAttendance}%`, 'Average attendance', `${heldSessions.length} held session${heldSessions.length === 1 ? '' : 's'}`, '#edf8f0', '#32864a'],
                  [CheckCircle2, activeParticipants, 'Regular participants', 'Present for at least 75% of sessions', '#eef6ff', '#2f73df'],
                  [AlertCircle, needsFollowUp, 'May need follow-up', 'Low attendance or repeated difficulty', '#fff2ed', '#c85540'],
                ].map(([Icon, value, label, help, background, color]) => {
                  const StatIcon = Icon as typeof Users;
                  return <article key={String(label)} className="rounded-2xl border border-[#e3e5ed] bg-white p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: String(background), color: String(color) }}><StatIcon className="h-5 w-5" /></span><strong className="mt-5 block text-3xl text-[#101a38]">{String(value)}</strong><span className="mt-1 block text-sm font-bold text-[#313950]">{String(label)}</span><p className="mt-1 text-xs leading-5 text-[#697087]">{String(help)}</p></article>;
                })}
              </section>

              <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="rounded-3xl border border-[#e3e5ed] bg-white p-5 sm:p-7">
                  <div className="flex flex-col gap-4 border-b border-[#e3e5ed] pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="seminar-eyebrow mb-2">Class roster</p><h2 className="seminar-display text-3xl text-[#101a38]">Individual progress</h2><p className="mt-1 text-sm text-[#697087]">Attendance is scoped to the selected class. Knowledge-check results are currently shown across recorded work.</p></div><div className="relative sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9298a8]" /><Input aria-label="Search students" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or ID" className="pl-9" /></div></div>

                  {visibleStudents.length === 0 ? <div className="py-14 text-center"><UserCheck className="mx-auto h-8 w-8 text-[#9ca2b2]" /><h3 className="seminar-display mt-3 text-2xl text-[#101a38]">No progress to show yet.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#697087]">Students appear after joining a class session with their student number.</p></div> : <div className="overflow-x-auto"><table className="mt-2 w-full min-w-[720px] text-left"><thead><tr className="border-b border-[#e3e5ed] text-[11px] font-bold uppercase tracking-[0.07em] text-[#697087]"><th className="px-3 py-4">Student</th><th className="px-3 py-4">Attendance</th><th className="px-3 py-4">Knowledge checks</th><th className="px-3 py-4">Responses</th><th className="px-3 py-4 text-right">Details</th></tr></thead><tbody>{visibleStudents.map((student) => <tr key={student.id} className="border-b border-[#eceef3] last:border-0 hover:bg-[#fbfaff]"><td className="px-3 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0efff] text-sm font-bold text-[#5146e5]">{student.name?.charAt(0).toUpperCase() || 'S'}</span><div><strong className="block text-sm text-[#101a38]">{student.name || 'Student'}</strong><span className="text-xs text-[#697087]">{student.studentId}</span></div></div></td><td className="px-3 py-4"><strong className="block text-sm text-[#101a38]">{student.attendance}%</strong><span className="text-xs text-[#697087]">{student.attended} of {heldSessions.length}</span></td><td className="px-3 py-4"><strong className="block text-sm text-[#101a38]">{student.stats.correctPercentage}%</strong><span className="text-xs text-[#697087]">Across recorded work</span></td><td className="px-3 py-4 text-sm font-semibold text-[#313950]">{student.stats.totalResponses}</td><td className="px-3 py-4 text-right"><Button size="sm" variant="ghost" onClick={() => setSelectedStudent(student)} className="gap-1.5"><Eye className="h-4 w-4" /> Review</Button></td></tr>)}</tbody></table></div>}
                </div>

                <aside className="space-y-5">
                  <section className="rounded-3xl border border-[#e3e5ed] bg-white p-6"><div className="flex items-start justify-between"><div><p className="seminar-eyebrow mb-2">Attendance trend</p><h2 className="seminar-display text-2xl text-[#101a38]">Recent sessions</h2></div><TrendingUp className="h-5 w-5 text-[#5146e5]" /></div>{recentSessions.length ? <div className="mt-7 flex h-36 items-end gap-2 border-b border-[#dfe2ea] pb-1">{recentSessions.map((session) => { const max = Math.max(...recentSessions.map((item) => item.studentsJoined?.length || 0), 1); const height = Math.max(12, ((session.studentsJoined?.length || 0) / max) * 100); return <div key={session.id} className="group relative flex h-full flex-1 items-end"><div className="w-full rounded-t-lg bg-[#d9d4ff] transition-colors group-hover:bg-[#7067e8]" style={{ height: `${height}%` }} /><span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#101a38] px-2 py-1 text-[10px] text-white group-hover:block">{session.studentsJoined?.length || 0} joined</span></div>; })}</div> : <p className="mt-5 text-sm leading-6 text-[#697087]">Hold a session to begin the trend.</p>}<p className="mt-4 text-xs leading-5 text-[#697087]">Each bar shows how many students joined. Hover to see the count.</p></section>
                  <section className="rounded-3xl border border-[#dcd8ff] bg-[#f7f6ff] p-6"><GraduationCap className="h-5 w-5 text-[#5146e5]" /><h2 className="seminar-display mt-4 text-2xl text-[#101a38]">Progress needs context.</h2><p className="mt-2 text-sm leading-6 text-[#697087]">A low score may mean the concept needs reteaching, not that the student is disengaged. Use attendance, responses, and class patterns together.</p>{selectedCourse && <Link href={`/dashboard/classes/${selectedCourse.id}`} className="seminar-focus mt-4 inline-flex items-center gap-2 rounded-lg text-sm font-bold text-[#5146e5]">Open class workspace <ArrowRight className="h-4 w-4" /></Link>}</section>
                </aside>
              </section>
            </>
          )}
        </main>
      </DashboardLayout>
      {selectedStudent && <StudentResponseModal isOpen onClose={() => setSelectedStudent(null)} studentId={selectedStudent.studentId} studentDocId={selectedStudent.id} studentName={selectedStudent.name || 'Student'} teacherId={user?.uid || ''} />}
    </ProtectedRoute>
  );
}

export default function ProgressPage() {
  return <Suspense fallback={<ProtectedRoute><DashboardLayout><div className="flex min-h-96 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#5146e5]" /></div></DashboardLayout></ProtectedRoute>}><ProgressContent /></Suspense>;
}
