import Link from 'next/link';
import { ArrowLeft, EnvelopeSimple } from '@phosphor-icons/react/ssr';
import MarketingPage from './MarketingPage';
import { CLASSFULLY_CONTACT, CLASSFULLY_OPERATOR, CLASSFULLY_POLICY_DATE } from '@/lib/legal';

export default function LegalDocument({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <MarketingPage>
      <section className="legal-document-hero">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
          <Link href="/legal" className="marketing-text-link seminar-focus"><ArrowLeft /> Legal and trust</Link>
          <p className="seminar-eyebrow mt-9">{eyebrow}</p>
          <h1 className="seminar-display mt-4 max-w-4xl text-5xl leading-[0.98] text-[var(--seminar-ink)] sm:text-7xl">{title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--seminar-muted)]">{intro}</p>
          <div className="legal-document-meta">
            <span>Effective {CLASSFULLY_POLICY_DATE}</span>
            <span>Operated by {CLASSFULLY_OPERATOR}</span>
          </div>
        </div>
      </section>
      <article className="legal-document mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
        {children}
        <section className="legal-contact-card">
          <EnvelopeSimple weight="duotone" />
          <div>
            <h2>Questions, requests, or concerns</h2>
            <p>Contact {CLASSFULLY_OPERATOR}, the operator of Classfully, at <a href={`mailto:${CLASSFULLY_CONTACT}`}>{CLASSFULLY_CONTACT}</a>.</p>
          </div>
        </section>
      </article>
    </MarketingPage>
  );
}
