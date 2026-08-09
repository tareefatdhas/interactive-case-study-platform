import Link from 'next/link';
import { ArrowRight, Check, ClipboardCheck, Clock3, MessageCircleQuestion, ShieldCheck } from 'lucide-react';
import MarketingPage from '@/components/marketing/MarketingPage';
import { createPageMetadata } from '@/lib/metadata';

export const metadata = createPageMetadata({
  title: 'Classroom engagement resources',
  description: 'Practical checklists and interaction guidance for running clear, engaging Classfully sessions in university classrooms.',
  path: '/resources',
});

const activityGuide = [
  { name: 'Class Pulse', use: 'Use when you need a fast read on pace, confidence, agreement, or how the room feels.', avoid: 'Do not use a personal pulse for grades or public comparison.' },
  { name: 'Opinion poll', use: 'Use before discussion when seeing differences will give the room something concrete to explore.', avoid: 'Do not reveal results early if they may pull later answers toward the majority.' },
  { name: 'Knowledge check', use: 'Use after a concept when the next part depends on understanding it.', avoid: 'Do not reward speed. Close responses before revealing the correct answer.' },
  { name: 'Short response', use: 'Use for questions, reflection, examples, or the muddiest point.', avoid: 'Do not put raw student writing on the projector without reviewing it first.' },
];

export default function ResourcesPage() {
  return (
    <MarketingPage>
      <section className="marketing-page-hero">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <p className="seminar-eyebrow mb-5">Classroom resources</p>
          <h1 className="seminar-display max-w-5xl text-5xl leading-[0.98] text-[var(--seminar-ink)] sm:text-7xl">A calm class starts with a short preflight.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--seminar-muted)]">Use these guides before the first session, then keep the classroom checklist near your instructor console.</p>
        </div>
      </section>

      <section className="border-y border-[var(--seminar-line)] bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-3">
          {[
            { href: '#before-class', icon: ClipboardCheck, title: 'Before-class checklist', body: 'Set up the projector, confirm the join code, and test one response.' },
            { href: '#interaction-guide', icon: MessageCircleQuestion, title: 'Interaction guide', body: 'Choose a format based on the classroom decision you need to make.' },
            { href: '#privacy', icon: ShieldCheck, title: 'Privacy in the room', body: 'Know what belongs on the instructor screen, projector, and student phone.' },
          ].map(({ href, icon: Icon, title, body }) => (
            <a href={href} key={href} className="resource-jump seminar-focus">
              <Icon className="h-5 w-5" /><div><h2 className="seminar-display text-2xl">{title}</h2><p>{body}</p></div><ArrowRight className="h-4 w-4" />
            </a>
          ))}
        </div>
      </section>

      <section id="before-class" className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
        <div>
          <Clock3 className="h-6 w-6 text-[var(--seminar-violet)]" />
          <p className="seminar-eyebrow mt-5">Ten minutes before class</p>
          <h2 className="seminar-display mt-3 text-4xl text-[var(--seminar-ink)]">Before-class checklist</h2>
          <p className="mt-4 leading-7 text-[var(--seminar-muted)]">Do this once in the actual room. The projector and campus network are part of the product experience.</p>
        </div>
        <ol className="checklist-card">
          {[
            ['Open the session', 'Check the class title and the prepared activities.'],
            ['Open the classroom display', 'Put it on the projector and confirm you can see the join code from the back row.'],
            ['Join from a phone', 'Use mobile data once if campus Wi-Fi access is uncertain.'],
            ['Send one test response', 'Confirm the instructor console and projector update.'],
            ['End the test', 'Make sure the old join code closes, then start the real session.'],
          ].map(([title, body], index) => <li key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{body}</p></div></li>)}
        </ol>
      </section>

      <section id="interaction-guide" className="border-y border-[var(--seminar-line)] bg-[var(--seminar-soft)]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
          <p className="seminar-eyebrow">Interaction guide</p>
          <h2 className="seminar-display mt-4 max-w-3xl text-4xl text-[var(--seminar-ink)] sm:text-5xl">Start with the teaching decision.</h2>
          <div className="activity-guide mt-12">
            {activityGuide.map((item) => (
              <article key={item.name}>
                <h3 className="seminar-display">{item.name}</h3>
                <div><span>Use it when</span><p>{item.use}</p></div>
                <div><span>Keep in mind</span><p>{item.avoid}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy" className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
        <div>
          <ShieldCheck className="h-6 w-6 text-[var(--seminar-violet)]" />
          <h2 className="seminar-display mt-5 text-4xl text-[var(--seminar-ink)]">Three privacy surfaces</h2>
          <p className="mt-4 leading-7 text-[var(--seminar-muted)]">Do not treat the instructor console, projector, and student phone as the same screen.</p>
        </div>
        <div className="privacy-surface-list">
          {[
            ['Instructor', 'May see attendance, raw written responses, and individual records when the activity says so.'],
            ['Projector', 'Shows totals, distributions, and only a response the instructor deliberately shares.'],
            ['Student', 'Shows the current prompt, the student’s own submission, and the safe class-level result.'],
          ].map(([title, body]) => <div key={title}><Check className="h-4 w-4" /><h3>{title}</h3><p>{body}</p></div>)}
          <Link href="/privacy" className="marketing-button marketing-button-secondary seminar-focus mt-3 w-fit">Read the student privacy notice <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </MarketingPage>
  );
}
