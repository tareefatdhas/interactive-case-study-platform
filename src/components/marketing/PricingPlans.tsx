import Link from 'next/link';
import { ArrowRight, Check, ChalkboardTeacher, GraduationCap, UsersThree } from '@phosphor-icons/react/ssr';

const plans = [
  {
    name: 'Pilot',
    eyebrow: 'Try it with a real class',
    price: '$0',
    cadence: 'No card required',
    description: 'Six live sessions to see how participation begins to build over time.',
    icon: GraduationCap,
    features: [
      '1 active course',
      'Up to 200 students',
      'All core interaction types',
      'Attendance and student progress',
      'Course Pulse across your pilot sessions',
    ],
    cta: 'Start your classroom pilot',
    href: '/signup',
  },
  {
    name: 'Instructor',
    eyebrow: 'For the full teaching term',
    price: '$69',
    cadence: 'per 4-month teaching term',
    alternate: 'Or $119 for a full teaching year',
    description: 'For instructors using Classfully as a consistent part of the course.',
    icon: ChalkboardTeacher,
    featured: true,
    features: [
      'Up to 5 active courses',
      'Up to 300 students in each course',
      'Unlimited sessions and interactions',
      'AI interaction drafts from your material',
      'Full course history, trends, and exports',
      'Points, streaks, and instructor-approved rewards',
    ],
    cta: 'Start six sessions free',
    href: '/signup',
  },
  {
    name: 'Institution',
    eyebrow: 'For departments and universities',
    price: 'Let’s talk',
    cadence: 'Priced by active instructors, not students',
    description: 'One shared workspace for students, instructors, courses, points, and rewards.',
    icon: UsersThree,
    features: [
      'One student profile across participating courses',
      'Private course spaces for each instructor',
      'Points and reward history synced across devices',
      'Institution and course-level reward controls',
      'Guided onboarding, billing, and privacy review',
    ],
    cta: 'Plan an institution rollout',
    href: 'mailto:tareef@happily.ai?subject=Classfully%20institution%20pricing',
  },
] as const;

export default function PricingPlans() {
  return (
    <>
      <div className="pricing-plan-grid">
        {plans.map(({ icon: Icon, ...plan }) => (
          <article key={plan.name} className={`pricing-plan-card${'featured' in plan && plan.featured ? ' is-featured' : ''}`}>
            {'featured' in plan && plan.featured ? <span className="pricing-plan-ribbon">Best for a full course</span> : null}
            <div className="pricing-plan-heading">
              <Icon aria-hidden="true" />
              <div>
                <p className="seminar-eyebrow">{plan.eyebrow}</p>
                <h3 className="seminar-display">{plan.name}</h3>
              </div>
            </div>
            <div className="pricing-plan-price">
              <strong className="seminar-display">{plan.price}</strong>
              <span>{plan.cadence}</span>
            </div>
            {'alternate' in plan ? <p className="pricing-plan-alternate">{plan.alternate}</p> : null}
            <p className="pricing-plan-description">{plan.description}</p>
            <ul>
              {plan.features.map((feature) => <li key={feature}><Check aria-hidden="true" />{feature}</li>)}
            </ul>
            <Link href={plan.href} className={`marketing-button seminar-focus ${'featured' in plan && plan.featured ? 'marketing-button-primary' : 'marketing-button-secondary'}`}>
              {plan.cta} <ArrowRight aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>

      <div className="pricing-promises" aria-label="Pricing promises">
        <span><Check aria-hidden="true" /> Students never pay</span>
        <span><Check aria-hidden="true" /> No per-response charges</span>
        <span><Check aria-hidden="true" /> No overage interruption during a live class</span>
        <small>Prices are in USD. Taxes may apply.</small>
      </div>
    </>
  );
}
