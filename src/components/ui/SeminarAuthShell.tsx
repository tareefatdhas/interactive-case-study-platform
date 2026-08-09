import Link from 'next/link';
import { MessageCircleQuestion, Radio, Users } from 'lucide-react';

interface SeminarAuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function SeminarAuthShell({ eyebrow, title, description, children }: SeminarAuthShellProps) {
  return (
    <main className="grid min-h-screen bg-[#fffefa] lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.72fr)]">
      <section className="flex flex-col px-5 py-6 sm:px-10 lg:px-14 lg:py-10">
        <Link href="/" className="classfully-wordmark seminar-focus w-fit text-2xl">Classfully</Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <p className="seminar-eyebrow mb-4">{eyebrow}</p>
          <h1 className="seminar-display text-4xl leading-tight text-[#101a38] sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-md text-base leading-7 text-[#697087]">{description}</p>
          <div className="mt-9">{children}</div>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden border-l border-[#e3e5ed] bg-[#f8f7fb] p-10 lg:flex lg:items-center">
        <div className="mx-auto w-full max-w-md rounded-[28px] border border-[#e3e5ed] bg-white p-8 shadow-[0_24px_70px_rgba(16,26,56,0.08)]">
          <div className="flex items-center justify-between border-b border-[#e3e5ed] pb-5">
            <div>
              <p className="seminar-eyebrow">Classroom signal</p>
              <p className="mt-1 text-sm text-[#697087]">Visible while you teach</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#eef8f0] px-3 py-1.5 text-xs font-bold text-[#2f7f47]">
              <span className="h-2 w-2 rounded-full bg-[#3aa45a]" /> Live
            </span>
          </div>
          <h2 className="seminar-display mt-7 text-3xl text-[#101a38]">The class is ready to continue.</h2>
          <div className="mt-8 space-y-4">
            {[
              { icon: Users, label: '142 students connected', color: '#2f73df' },
              { icon: MessageCircleQuestion, label: '7 questions waiting', color: '#7057e8' },
              { icon: Radio, label: '12 students need a pause', color: '#ef7359' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border border-[#e3e5ed] px-4 py-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color, backgroundColor: `${color}12` }}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-[#313950]">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-7 border-t border-[#e3e5ed] pt-5 text-sm leading-6 text-[#697087]">
            Private student details stay on the instructor screen. The projector shows the shared class signal.
          </p>
        </div>
      </aside>
    </main>
  );
}
