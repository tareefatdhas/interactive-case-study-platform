import TrackedCta from '@/components/analytics/TrackedCta';
import { ArrowRight, CalendarDots, Check, ShieldCheck } from '@phosphor-icons/react/ssr';
import MarketingPage from '@/components/marketing/MarketingPage';
import PricingPlans from '@/components/marketing/PricingPlans';
import { createPageMetadata } from '@/lib/metadata';

export const metadata = createPageMetadata({
  title: 'Pricing for university instructors',
  description: 'Start Classfully free, then choose friendly pricing for a teaching term, a full year, or a department rollout. Students never pay.',
  path: '/pricing',
});

const termMoments = [
  ['Week 1', 'The class checks in'],
  ['Week 5', 'Patterns begin to form'],
  ['Week 12', 'Progress carries forward'],
] as const;

export default function PricingPage() {
  return (
    <MarketingPage>
      <section className="pricing-hero">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-20">
          <div>
            <p className="seminar-eyebrow mb-5">Friendly pricing for real classrooms</p>
            <h1 className="seminar-display text-5xl leading-[0.98] text-[var(--seminar-ink)] sm:text-7xl">Pay for the teaching term. Bring the whole class.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--seminar-muted)]">Start with six live sessions at no cost. When Classfully becomes part of the course, choose one price for the term instead of counting students, answers, or live moments.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <TrackedCta href="/signup" ctaLocation="pricing_plans" ctaLabel="start_pilot_hero" className="marketing-button marketing-button-primary marketing-button-large seminar-focus">Start your classroom pilot <ArrowRight aria-hidden="true" /></TrackedCta>
              <a href="#plans" className="marketing-button marketing-button-secondary marketing-button-large seminar-focus">See the plans</a>
            </div>
          </div>

          <div className="pricing-term-visual" aria-label="A teaching term where each session adds to the course record">
            <div className="pricing-term-top"><CalendarDots aria-hidden="true" /><span>A teaching term</span><strong>$69</strong></div>
            <div className="pricing-term-line" aria-hidden="true">{Array.from({ length: 12 }).map((_, index) => <i key={index} className={index < 9 ? 'is-complete' : ''} />)}</div>
            <div className="pricing-term-moments">
              {termMoments.map(([week, moment]) => <div key={week}><span>{week}</span><strong>{moment}</strong></div>)}
            </div>
            <p><Check aria-hidden="true" />Every response stays connected to the course.</p>
          </div>
        </div>
      </section>

      <section id="plans" className="pricing-plans-section">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="pricing-section-heading">
            <p className="seminar-eyebrow">Choose by how you teach</p>
            <h2 className="seminar-display">Start small. Keep going when it earns its place.</h2>
            <p>The pilot is large enough for a real university classroom. The paid plan begins when you are ready to make Classfully part of the course.</p>
          </div>
          <PricingPlans />
        </div>
      </section>

      <section className="pricing-stakeholders">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.72fr_1.28fr] lg:items-start lg:gap-20">
          <div>
            <p className="seminar-eyebrow mb-4">Made for how universities buy</p>
            <h2 className="seminar-display text-4xl leading-[1.02] text-[var(--seminar-ink)] sm:text-6xl">Easy to start alone. Ready to grow into one shared workspace.</h2>
          </div>
          <div className="pricing-stakeholder-grid">
            <article><span>Instructor</span><h3 className="seminar-display">Try it before asking for a budget.</h3><p>Run six sessions with a real class. Upgrade by teaching term only after the workflow proves useful.</p></article>
            <article><span>Students</span><h3 className="seminar-display">One profile, without another password.</h3><p>An institution can link a student number or approved sign-in method to one profile that follows the student across devices and participating courses.</p></article>
            <article><span>Department or university</span><h3 className="seminar-display">Connect the community, not the classrooms.</h3><p>The institution shares a student directory, points ledger, and reward system. Each instructor still works inside a private course space.</p></article>
            <article><span>IT and privacy</span><h3 className="seminar-display">Set the boundaries once.</h3><p>The institution controls identity rules, retention, reward permissions, and who can see each part of a student record.</p></article>
          </div>
        </div>
      </section>

      <section className="pricing-faq">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.66fr_1.34fr] lg:gap-20">
          <div>
            <ShieldCheck className="h-6 w-6 text-[var(--seminar-success)]" aria-hidden="true" />
            <p className="seminar-eyebrow mt-5">Before you choose</p>
            <h2 className="seminar-display mt-4 text-4xl leading-tight text-[var(--seminar-ink)] sm:text-5xl">Straight answers about the price.</h2>
          </div>
          <div className="faq-list">
            {[
              ['What is a teaching term?', 'A teaching term covers four consecutive months from the date you begin the paid plan. It fits a semester, quarter, or intensive course.'],
              ['What happens after the six pilot sessions?', 'Your course record remains available. Choose a term or annual plan when you want to run the next live session.'],
              ['Do students need a paid account?', 'No. Students never pay to join, respond, or keep their Classfully progress.'],
              ['Can I teach more than one course?', 'Yes. The Instructor plan includes up to five active courses and 300 students in each course.'],
              ['What if my lecture has more than 300 students?', 'Talk with us before the course begins. We will confirm capacity and a plan that will not interrupt the live class.'],
              ['Do students need separate Classfully accounts?', 'Not in an institution workspace. A student uses an approved institutional identity, such as a student number with verification, so the same record can follow them across devices and participating courses without another password.'],
              ['How are points shared across courses?', 'Each course keeps its own academic points and instructor-approved rewards. An institution can also offer a separate shared points balance for university-wide rewards. This prevents one instructor’s grading choices from affecting another course.'],
              ['Can a department pay by invoice?', 'Yes. Institution pricing is designed for one invoice, a coordinated launch, and a data review before rollout. The shared institution workspace is part of the managed rollout and is not included in the self-serve Instructor plan.'],
              ['Why not charge per student or response?', 'Participation works best when instructors do not have to ration it. The instructor and teaching term are the clearest measures of the value Classfully provides.'],
            ].map(([question, answer]) => (
              <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-final-cta">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8 sm:py-24">
          <h2 className="seminar-display text-4xl text-[var(--seminar-ink)] sm:text-5xl">Let six classes answer the pricing question.</h2>
          <p className="mt-5 text-lg text-[var(--seminar-muted)]">Start free. See whether Classfully earns a place in the rest of the course.</p>
          <TrackedCta href="/signup" ctaLocation="pricing_plans" ctaLabel="start_pilot_footer" className="marketing-button marketing-button-primary marketing-button-large seminar-focus mt-8">Start your classroom pilot <ArrowRight aria-hidden="true" /></TrackedCta>
        </div>
      </section>
    </MarketingPage>
  );
}
