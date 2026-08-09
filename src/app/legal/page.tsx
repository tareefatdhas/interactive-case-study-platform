import Link from 'next/link';
import { ArrowRight, FileText, LockKey, ShieldCheck, UserCircle } from '@phosphor-icons/react/ssr';
import MarketingPage from '@/components/marketing/MarketingPage';
import { CLASSFULLY_CONTACT, CLASSFULLY_OPERATOR, CLASSFULLY_POLICY_DATE } from '@/lib/legal';
import { createPageMetadata } from '@/lib/metadata';

export const metadata = createPageMetadata({
  title: 'Legal and trust',
  description: 'Classfully policies for classroom data, student privacy, platform use, and the responsibilities of instructors and institutions.',
  path: '/legal',
});

const policies = [
  { href: '/data-policy', icon: ShieldCheck, label: 'Data Policy', body: 'What Classfully collects, why it is used, who can access it, and how to make a request.', action: 'Read policy' },
  { href: '/terms', icon: FileText, label: 'Terms & Conditions', body: 'The responsibilities that apply when instructors, institutions, and students use Classfully.', action: 'Read terms' },
  { href: '/privacy', icon: LockKey, label: 'Student privacy notice', body: 'A shorter classroom-specific notice students can read before joining a session.', action: 'Read notice' },
];

export default function LegalPage() {
  return (
    <MarketingPage>
      <section className="marketing-page-hero">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_0.72fr] lg:items-end">
          <div>
            <p className="seminar-eyebrow mb-5">Legal and trust</p>
            <h1 className="seminar-display max-w-4xl text-5xl leading-[0.98] text-[var(--seminar-ink)] sm:text-7xl">Clear rules for a classroom built on trust.</h1>
          </div>
          <p className="text-lg leading-8 text-[var(--seminar-muted)]">These pages explain how Classfully handles classroom information, what users are responsible for, and where to ask questions.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="legal-policy-grid">
          {policies.map(({ href, icon: Icon, label, body, action }) => (
            <Link href={href} key={href} className="legal-policy-card seminar-focus">
              <Icon weight="duotone" />
              <h2 className="seminar-display">{label}</h2>
              <p>{body}</p>
              <span>{action} <ArrowRight /></span>
            </Link>
          ))}
        </div>

        <section className="legal-operator-card">
          <UserCircle weight="duotone" />
          <div>
            <p className="seminar-eyebrow">Platform operator</p>
            <h2 className="seminar-display">Classfully is operated by {CLASSFULLY_OPERATOR}.</h2>
            <p>Policy questions, data requests, and legal notices can be sent to <a href={`mailto:${CLASSFULLY_CONTACT}`}>{CLASSFULLY_CONTACT}</a>.</p>
          </div>
          <span>Policies effective {CLASSFULLY_POLICY_DATE}</span>
        </section>
      </section>
    </MarketingPage>
  );
}
