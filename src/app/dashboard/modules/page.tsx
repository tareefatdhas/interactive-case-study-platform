'use client';

import Link from 'next/link';
import { ArrowRight, Clock3, Repeat2, UsersRound } from 'lucide-react';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import Button from '@/components/ui/Button';

const modules = [
  {
    name: 'Peer learning',
    icon: Repeat2,
    color: '#5146e5',
    tint: '#f2f0ff',
    purpose: 'Help students test and improve their reasoning through a short conversation.',
    steps: ['Answer privately', 'Discuss with a partner', 'Answer again', 'See what shifted'],
    bestFor: 'Concept questions where the reasoning matters more than speed.',
  },
  {
    name: 'Group work',
    icon: UsersRound,
    color: '#c85540',
    tint: '#fff2ed',
    purpose: 'Give small groups one clear task, shared working time, and a single submission.',
    steps: ['Form small groups', 'Choose one note-taker', 'Work to the shared clock', 'Review group ideas'],
    bestFor: 'Applications, comparisons, worked examples, and case decisions.',
  },
  {
    name: 'Clock',
    icon: Clock3,
    color: '#2f8b63',
    tint: '#edf8f2',
    purpose: 'Turn quiet thinking or working time into a visible part of the lesson flow.',
    steps: ['Show one focused prompt', 'Start the shared clock', 'Keep every screen in sync', 'Return to the lesson'],
    bestFor: 'Think time, writing, group work, breaks, and timed transitions.',
  },
];

export default function TeachingModulesPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
          <header className="flex flex-col gap-5 border-b border-[#e3e5ed] pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="seminar-eyebrow mb-3">Teaching modules</p>
              <h1 className="seminar-display text-4xl text-[#101a38] sm:text-5xl">More than a single question.</h1>
              <p className="mt-3 text-base leading-7 text-[#697087]">Modules guide the room through a short teaching routine. Add one to a session, edit it for the topic, then launch it beside your slides.</p>
            </div>
            <Link href="/dashboard/classes"><Button className="gap-2">Choose a class <ArrowRight className="h-4 w-4" /></Button></Link>
          </header>

          <div className="mt-8 space-y-5">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <section key={module.name} className="grid gap-6 rounded-3xl border border-[#e3e5ed] bg-white p-6 sm:p-7 lg:grid-cols-[240px_minmax(0,1fr)_260px] lg:items-center">
                  <div>
                    <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ color: module.color, background: module.tint }}><Icon className="h-6 w-6" /></span>
                    <h2 className="seminar-display mt-4 text-3xl text-[#101a38]">{module.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-[#697087]">{module.purpose}</p>
                  </div>
                  <ol className="grid gap-2 sm:grid-cols-2">
                    {module.steps.map((step, index) => <li key={step} className="flex items-center gap-3 rounded-xl bg-[#faf9fc] p-3 text-sm font-semibold text-[#3f465b]"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold" style={{ color: module.color }}>{index + 1}</span>{step}</li>)}
                  </ol>
                  <aside className="rounded-2xl border border-[#e7e5ec] bg-[#fffefa] p-4"><small className="font-bold uppercase tracking-[0.08em] text-[#8d93a4]">Works best for</small><p className="mt-2 text-sm leading-6 text-[#4f576d]">{module.bestFor}</p></aside>
                </section>
              );
            })}
          </div>

          <section className="mt-8 flex flex-col gap-5 rounded-3xl bg-[#101a38] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#b8b3ff]">Use them in context</p><h2 className="seminar-display mt-2 text-3xl">Add a module to a class session.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#cbd0df]">Open a class, plan a session, and choose Add activity. Modules remain private until you launch them during class.</p></div>
            <Link href="/dashboard/classes" className="shrink-0"><Button variant="outline" className="gap-2 border-white bg-white text-[#101a38] hover:bg-[#f4f2ff]">Open classes <ArrowRight className="h-4 w-4" /></Button></Link>
          </section>
        </main>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
