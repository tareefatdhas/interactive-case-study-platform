import Link from 'next/link';
import { ArrowRight, Check, Laptop, MonitorPlay as MonitorUp, Presentation, DeviceMobile as Smartphone, UsersThree as Users } from '@phosphor-icons/react/ssr';
import MarketingPage from '@/components/marketing/MarketingPage';
import { createPageMetadata } from '@/lib/metadata';

export const metadata = createPageMetadata({
  title: 'For university instructors',
  description: 'Run classroom interactions beside your slides and build a useful record of attendance, understanding, questions, and progress across every session.',
  path: '/instructors',
});

const stages = [
  { label: 'Prepare', title: 'Plan the moments that need a response.', body: 'Name the class and session, then add a check-in, poll, knowledge check, or short response. Use lesson material to draft questions when it is useful.' },
  { label: 'Teach', title: 'Keep Classfully beside your slides.', body: 'Open the classroom display once. When you want the class to respond, switch to it and launch the next prepared activity.' },
  { label: 'Read the room', title: 'Decide what needs more time.', body: 'See response patterns, questions, and pace signals on your private console. Choose what the projector shows.' },
  { label: 'Review', title: 'Let this session inform the next.', body: 'See who joined, what the room understood, which questions remain, and how the pattern is changing.' },
];

export default function InstructorsPage() {
  return (
    <MarketingPage>
      <section className="marketing-page-hero">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_0.72fr] lg:items-end">
          <div>
            <p className="seminar-eyebrow mb-5">For university instructors</p>
            <h1 className="seminar-display max-w-4xl text-5xl leading-[0.98] text-[var(--seminar-ink)] sm:text-7xl">Run today’s class. Understand the course over time.</h1>
          </div>
          <div>
            <p className="text-lg leading-8 text-[var(--seminar-muted)]">Classfully stays beside your existing lesson materials. It gives you a private teaching console, a classroom display, and a course record that grows with every session.</p>
            <Link href="/signup" className="marketing-button marketing-button-primary marketing-button-large seminar-focus mt-7">Create an instructor account <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--seminar-line)] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
          <p className="seminar-eyebrow mb-4">The class workflow</p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--seminar-line)] bg-[var(--seminar-line)] lg:grid-cols-4">
            {stages.map((stage, index) => (
              <article key={stage.label} className="bg-white p-7 sm:p-8">
                <span className="seminar-display text-2xl text-[var(--seminar-violet)]">{index + 1}</span>
                <p className="seminar-eyebrow mt-8">{stage.label}</p>
                <h2 className="seminar-display mt-3 text-2xl leading-tight text-[var(--seminar-ink)]">{stage.title}</h2>
                <p className="mt-4 text-sm leading-6 text-[var(--seminar-muted)]">{stage.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <p className="seminar-eyebrow mb-4">One laptop, two views</p>
          <h2 className="seminar-display text-4xl leading-tight text-[var(--seminar-ink)] sm:text-5xl">Keep the controls with you. Give the room a clear signal.</h2>
          <p className="mt-5 text-lg leading-8 text-[var(--seminar-muted)]">The instructor console stays on your device. The classroom display opens in a separate window for the projector.</p>
          <ul className="mt-7 grid gap-3 text-sm">
            <li className="inline-flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 text-[var(--seminar-success)]" />Preview what students will see before you show it</li>
            <li className="inline-flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 text-[var(--seminar-success)]" />Moderate questions without exposing names</li>
            <li className="inline-flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 text-[var(--seminar-success)]" />Pause, reopen, or finish responses while speaking</li>
          </ul>
        </div>
        <div className="device-relationship" aria-label="Instructor laptop sends a shared view to the projector while students respond by phone">
          <div className="device-card device-instructor"><Laptop /><span>Instructor console</span><small>Private</small></div>
          <div className="device-line" aria-hidden="true"><i /><i /><i /></div>
          <div className="device-card device-projector"><MonitorUp /><span>Classroom display</span><small>Shared</small></div>
          <div className="device-card device-phone"><Smartphone /><span>Student phone</span><small>One response</small></div>
        </div>
      </section>

      <section className="border-y border-[var(--seminar-line)] bg-[var(--seminar-soft)]">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-2">
          <div>
            <Users className="h-6 w-6 text-[var(--seminar-violet)]" />
            <h2 className="seminar-display mt-5 text-4xl text-[var(--seminar-ink)]">Read the room, whatever its size.</h2>
            <p className="mt-4 leading-7 text-[var(--seminar-muted)]">From small seminars to full lecture halls, the console turns individual responses into useful patterns. See attendance, unanswered questions, and signals that suggest it is time to pause.</p>
          </div>
          <div>
            <Presentation className="h-6 w-6 text-[var(--seminar-violet)]" />
            <h2 className="seminar-display mt-5 text-4xl text-[var(--seminar-ink)]">Leave with more than a result slide.</h2>
            <p className="mt-4 leading-7 text-[var(--seminar-muted)]">Attendance, understanding, questions, and reflection remain connected to the session, so the next class begins with context.</p>
          </div>
        </div>
      </section>

      <section className="marketing-final-cta">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8 sm:py-24">
          <h2 className="seminar-display text-4xl text-[var(--seminar-ink)] sm:text-5xl">Prepare the next class.</h2>
          <p className="mt-5 text-lg text-[var(--seminar-muted)]">Start with one question you genuinely need the room to answer.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="marketing-button marketing-button-primary marketing-button-large seminar-focus">Create a class <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/resources" className="marketing-button marketing-button-secondary marketing-button-large seminar-focus">Open instructor resources</Link>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
