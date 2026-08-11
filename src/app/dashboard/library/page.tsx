'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CalendarPlus,
  GraduationCap,
  Library,
  MessageCircleQuestion,
  Plus,
  Repeat2,
  UsersRound,
} from 'lucide-react';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import Button from '@/components/ui/Button';
import InlineMessage from '@/components/ui/InlineMessage';
import { AmbientLoading } from '@/components/motion';
import { useAuth } from '@/lib/hooks/useAuth';
import { getCaseStudiesByTeacher, getCoursesByTeacher } from '@/lib/firebase/firestore';
import type { CaseStudy, Course } from '@/types';

const teachingFlows = [
  {
    name: 'Peer learning',
    description: 'Students answer privately, discuss their reasoning, then answer again.',
    sequence: 'Answer · discuss · answer again',
    icon: Repeat2,
    tint: '#f0efff',
    color: '#5146e5',
  },
  {
    name: 'Group work',
    description: 'Give teams one prompt, a shared clock, and one response to bring back to the room.',
    sequence: 'Prompt · work · submit · review',
    icon: UsersRound,
    tint: '#fff2ed',
    color: '#c85540',
  },
  {
    name: 'Case discussion',
    description: 'Bring prepared material into a decision, discussion, and reflection flow.',
    sequence: 'Read · decide · discuss · reflect',
    icon: MessageCircleQuestion,
    tint: '#edf8f2',
    color: '#2f8b63',
  },
];

export default function LibraryPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getCoursesByTeacher(user.uid),
      getCaseStudiesByTeacher(user.uid),
    ])
      .then(([courseData, caseStudyData]) => {
        setCourses(courseData);
        setCaseStudies(caseStudyData);
      })
      .catch((loadError) => {
        console.error('Could not load the teaching library:', loadError);
        setError('Your library could not be opened. Refresh the page and try again.');
      })
      .finally(() => setLoading(false));
  }, [user]);

  const savedInteractionCount = useMemo(
    () => courses.reduce((total, course) => total + (course.interactionTemplates?.length || 0), 0),
    [courses],
  );

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <main className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-10">
          <header className="flex flex-col gap-5 border-b border-[#e3e5ed] pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="seminar-eyebrow mb-3">Library</p>
              <h1 className="seminar-display text-4xl text-[#101a38] sm:text-5xl">Keep useful teaching work ready.</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#697087]">Find the interactions, teaching flows, and case material you can bring into a class. The session is where you put them in teaching order.</p>
            </div>
            <Link href="/dashboard/classes"><Button className="gap-2">Open a class <ArrowRight className="h-4 w-4" /></Button></Link>
          </header>

          {error && <InlineMessage className="mt-6" title="Your library is still here." message={error} />}

          {loading ? (
            <div className="grid min-h-80 place-items-center" role="status" aria-label="Opening your library"><AmbientLoading className="w-44 rounded-full" announce="off" /></div>
          ) : (
            <div className="mt-8 space-y-8">
              <section aria-labelledby="saved-interactions-title">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="seminar-eyebrow mb-2">Saved interactions</p><h2 id="saved-interactions-title" className="seminar-display text-3xl text-[#101a38]">Your course kits</h2><p className="mt-2 text-sm leading-6 text-[#697087]">Questions and activities stay with the class they were designed for.</p></div>
                  <span className="text-sm font-semibold text-[#697087]">{savedInteractionCount} saved across {courses.length} {courses.length === 1 ? 'class' : 'classes'}</span>
                </div>

                {courses.length ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {courses.map((course) => (
                      <Link key={course.id} href={`/dashboard/classes/${course.id}?view=kit`} className="seminar-focus group flex items-center gap-4 rounded-3xl border border-[#e3e5ed] bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#cbc7ff] hover:shadow-[0_14px_34px_rgba(16,26,56,0.07)]">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f0efff] text-[#5146e5]"><GraduationCap className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1"><small className="font-bold uppercase tracking-[0.07em] text-[#697087]">{course.code}{course.term ? ` · ${course.term}` : ''}</small><strong className="mt-1 block truncate text-lg text-[#101a38]">{course.name}</strong><span className="mt-1 block text-sm text-[#697087]">{course.interactionTemplates?.length || 0} saved interactions · {course.courseSources?.length || 0} course sources</span></span>
                        <ArrowRight className="h-5 w-5 shrink-0 text-[#8d93a4] transition-transform group-hover:translate-x-1 group-hover:text-[#5146e5]" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-[#cfd2df] bg-white px-6 py-12 text-center"><CalendarPlus className="mx-auto h-7 w-7 text-[#5146e5]" /><h3 className="seminar-display mt-4 text-2xl text-[#101a38]">Add a class to start its course kit.</h3><Link href="/dashboard/classes" className="mt-5 inline-block"><Button className="gap-2"><Plus className="h-4 w-4" /> Add a class</Button></Link></div>
                )}
              </section>

              <section className="rounded-[28px] border border-[#dedaf8] bg-[#f7f6ff] p-6 sm:p-8" aria-labelledby="teaching-flows-title">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="seminar-eyebrow mb-2">Teaching flows</p><h2 id="teaching-flows-title" className="seminar-display text-3xl text-[#101a38]">More than one classroom moment</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#697087]">These built-in flows coordinate several student and instructor steps. Add one while planning a session, then make it fit that lesson.</p></div>
                  <Link href="/dashboard/classes" className="seminar-focus inline-flex items-center gap-2 rounded-lg text-sm font-bold text-[#5146e5]">Choose a class <ArrowRight className="h-4 w-4" /></Link>
                </div>
                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  {teachingFlows.map((flow) => {
                    const Icon = flow.icon;
                    return <article key={flow.name} className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_8px_26px_rgba(16,26,56,0.05)]"><span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: flow.tint, color: flow.color }}><Icon className="h-5 w-5" /></span><h3 className="seminar-display mt-5 text-2xl text-[#101a38]">{flow.name}</h3><p className="mt-2 text-sm leading-6 text-[#697087]">{flow.description}</p><p className="mt-5 border-t border-[#ececf1] pt-4 text-xs font-bold uppercase tracking-[0.06em] text-[#5146e5]">{flow.sequence}</p></article>;
                  })}
                </div>
              </section>

              <section id="case-studies" className="grid gap-6 rounded-[28px] border border-[#e3e5ed] bg-white p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center" aria-labelledby="case-library-title">
                <div>
                  <p className="seminar-eyebrow mb-2">Case studies</p>
                  <h2 id="case-library-title" className="seminar-display text-3xl text-[#101a38]">Prepare the material once.</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#697087]">A case study is reusable course material. Add it to a session when you want to turn it into a decision, discussion, or reflection.</p>
                  <div className="mt-5 flex flex-wrap gap-3"><Link href="/dashboard/case-studies"><Button variant="outline" className="gap-2"><BookOpen className="h-4 w-4" /> Manage case studies</Button></Link><Link href="/dashboard/case-studies/new"><Button className="gap-2"><Plus className="h-4 w-4" /> Create case study</Button></Link></div>
                </div>
                <aside className="rounded-2xl bg-[#fff8e6] p-5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#9a5b1f]"><Library className="h-5 w-5" /></span><strong className="seminar-display mt-4 block text-3xl text-[#101a38]">{caseStudies.length}</strong><span className="text-sm font-semibold text-[#697087]">prepared {caseStudies.length === 1 ? 'case' : 'cases'}</span>{caseStudies.length > 0 && <ul className="mt-4 space-y-2 border-t border-[#eadfc5] pt-4">{caseStudies.slice(0, 3).map((caseStudy) => <li key={caseStudy.id} className="truncate text-sm font-semibold text-[#4f576d]">{caseStudy.title}</li>)}</ul>}</aside>
              </section>
            </div>
          )}
        </main>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
