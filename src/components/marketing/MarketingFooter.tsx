import Link from 'next/link';
import ClassfullyBrand from './ClassfullyBrand';

export default function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--seminar-line)] bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto_auto_auto] md:items-start">
        <div>
          <ClassfullyBrand className="text-xl" />
          <h2 className="marketing-footer-belief seminar-display">Make every class count toward the next.</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--seminar-muted)]">The participation layer for university courses.</p>
        </div>
        <nav className="grid gap-2 text-sm" aria-label="Product links">
          <span className="font-semibold text-[var(--seminar-ink)]">Classfully</span>
          <Link href="/instructors">For instructors</Link>
          <Link href="/students">For students</Link>
          <Link href="/resources">Resources</Link>
        </nav>
        <nav className="grid gap-2 text-sm" aria-label="Account and policy links">
          <span className="font-semibold text-[var(--seminar-ink)]">Use Classfully</span>
          <Link href="/join">Join a class</Link>
          <Link href="/login">Instructor sign in</Link>
        </nav>
        <nav className="grid gap-2 text-sm" aria-label="Legal and trust links">
          <span className="font-semibold text-[var(--seminar-ink)]">Legal and trust</span>
          <Link href="/data-policy">Data Policy</Link>
          <Link href="/terms">Terms & Conditions</Link>
          <Link href="/privacy">Student privacy</Link>
        </nav>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-[var(--seminar-line)] px-5 py-5 text-xs text-[var(--seminar-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>© 2026 Classfully. Operated by Tareef Jafferi.</span>
        <Link href="mailto:tareef@happily.ai">tareef@happily.ai</Link>
      </div>
    </footer>
  );
}
