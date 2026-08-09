import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Medal as Award, Check, Eye, Fire as Flame, LockKey as Lock, DeviceMobile as Smartphone, Target } from '@phosphor-icons/react/ssr';
import MarketingPage from '@/components/marketing/MarketingPage';

export const metadata: Metadata = {
  title: 'For students | Classfully',
  description: 'Join class from your phone, make your voice heard, and build a useful record of participation and progress across your course.',
};

export default function StudentsPage() {
  return (
    <MarketingPage>
      <section className="marketing-page-hero">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_0.78fr]">
          <div>
            <p className="seminar-eyebrow mb-5">For students</p>
            <h1 className="seminar-display max-w-4xl text-5xl leading-[0.98] text-[var(--seminar-ink)] sm:text-7xl">Your participation should add up to something.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--seminar-muted)]">Join from your phone to answer, ask, predict, and reflect. Each class can add to your own record of attendance, progress, and contribution.</p>
            <Link href="/join" className="marketing-button marketing-button-primary marketing-button-large seminar-focus mt-8">Join with a class code <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="student-phone-preview" aria-hidden="true">
            <div className="student-phone-top"><span>Classfully</span><i /></div>
            <p className="seminar-eyebrow">Class pulse</p>
            <h2 className="seminar-display">How is the pace right now?</h2>
            {['Ready to continue', 'One more example', 'Please slow down'].map((label, index) => <span key={label} className={index === 1 ? 'selected' : ''}>{label}<i /></span>)}
            <button tabIndex={-1}>Send response</button>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--seminar-line)] bg-[#fff7dc]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <p className="seminar-eyebrow">Across the course</p>
            <h2 className="seminar-display mt-4 text-4xl leading-tight text-[var(--seminar-ink)] sm:text-5xl">See the progress that is easy to miss from one class to the next.</h2>
            <p className="mt-5 leading-7 text-[var(--seminar-muted)]">Your private course view can bring together attendance, participation, quiz understanding, reflections, and the goals you are working toward.</p>
          </div>
          <div className="student-progress-story">
            {[
              { icon: Flame, value: '4', label: 'class streak', color: 'sun' },
              { icon: Award, value: '320', label: 'points earned', color: 'violet' },
              { icon: Target, value: '12', label: 'activities completed', color: 'mint' },
            ].map(({ icon: Icon, value, label, color }) => <article className={`is-${color}`} key={label}><Icon /><strong className="seminar-display">{value}</strong><span>{label}</span></article>)}
            <div className="student-progress-note"><Lock /><p><strong>Your record is personal.</strong> The projector shows the class pattern, not your individual progress.</p></div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--seminar-line)] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
          <p className="seminar-eyebrow mb-4">Joining takes a minute</p>
          <ol className="student-steps mt-10">
            {[
              ['Open the link', 'Scan the classroom QR code or go to classfully.com/join.'],
              ['Enter the code', 'Use the six-character code shown by your instructor.'],
              ['Add your student number', 'This connects attendance and progress to the right class record.'],
              ['Keep the page nearby', 'New questions appear when the instructor starts them.'],
            ].map(([title, body], index) => (
              <li key={title}><span>{index + 1}</span><div><h2 className="seminar-display">{title}</h2><p>{body}</p></div></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-px overflow-hidden px-5 py-20 sm:px-8 sm:py-24 md:grid-cols-3">
        {[
          { icon: Lock, title: 'Your response stays private', body: 'Your instructor may access the individual class record. Classmates do not see your student number.' },
          { icon: Eye, title: 'The projector shows the room', body: 'The shared screen shows totals and only the written responses the instructor chooses to share.' },
          { icon: Smartphone, title: 'Your record continues', body: 'Using the same student number keeps attendance, participation, and course progress connected across sessions.' },
        ].map(({ icon: Icon, title, body }) => (
          <article key={title} className="border border-[var(--seminar-line)] bg-white p-7 first:rounded-t-2xl last:rounded-b-2xl md:first:rounded-l-2xl md:first:rounded-tr-none md:last:rounded-r-2xl md:last:rounded-bl-none">
            <Icon className="h-5 w-5 text-[var(--seminar-violet)]" />
            <h2 className="seminar-display mt-5 text-2xl text-[var(--seminar-ink)]">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--seminar-muted)]">{body}</p>
          </article>
        ))}
      </section>

      <section className="border-t border-[var(--seminar-line)] bg-[var(--seminar-soft)]">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="seminar-display text-4xl text-[var(--seminar-ink)]">What counts, and what never should</h2>
          <ul className="mt-7 grid gap-4 text-sm leading-6 text-[var(--seminar-text)]">
            <li className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-[var(--seminar-success)]" />Wellbeing check-ins include a way to prefer not to say.</li>
            <li className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-[var(--seminar-success)]" />Correct answers and useful participation may earn points. Wellbeing responses never do.</li>
            <li className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-[var(--seminar-success)]" />Your instructor decides what earns points and approves any academic reward.</li>
            <li className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-[var(--seminar-success)]" />If the classroom connection drops, keep the page open while it reconnects.</li>
          </ul>
          <p className="mt-8 text-sm text-[var(--seminar-muted)]">For data access or correction requests, read the <Link href="/privacy" className="font-semibold text-[var(--seminar-violet)] underline underline-offset-4">student privacy notice</Link>.</p>
        </div>
      </section>
    </MarketingPage>
  );
}
