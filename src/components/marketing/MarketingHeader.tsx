import Link from 'next/link';
import { List as Menu } from '@phosphor-icons/react/ssr';
import ClassfullyBrand from './ClassfullyBrand';
import TrackedCta from '@/components/analytics/TrackedCta';

const links = [
  { href: '/instructors', label: 'For instructors' },
  { href: '/students', label: 'For students' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Field Notes' },
  { href: '/resources', label: 'Resources' },
];

export default function MarketingHeader() {
  return (
    <header className="marketing-header">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <ClassfullyBrand className="text-xl sm:text-2xl" />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="marketing-nav-link seminar-focus">{link.label}</Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <TrackedCta href="/join" ctaLocation="header" ctaLabel="join_a_class" className="marketing-nav-link seminar-focus">Join a class</TrackedCta>
          <TrackedCta href="/login" ctaLocation="header" ctaLabel="sign_in" className="marketing-button marketing-button-secondary seminar-focus">Sign in</TrackedCta>
          <TrackedCta href="/signup" ctaLocation="header" ctaLabel="create_a_class" className="marketing-button marketing-button-primary seminar-focus">Create a class</TrackedCta>
        </div>

        <details className="marketing-menu sm:hidden">
          <summary className="seminar-focus" aria-label="Open navigation"><Menu className="h-5 w-5" aria-hidden="true" /></summary>
          <div className="marketing-menu-panel">
            {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
            <TrackedCta href="/join" ctaLocation="header" ctaLabel="join_a_class_mobile">Join a class</TrackedCta>
            <TrackedCta href="/login" ctaLocation="header" ctaLabel="sign_in_mobile">Instructor sign in</TrackedCta>
            <TrackedCta href="/signup" ctaLocation="header" ctaLabel="create_a_class_mobile" className="marketing-menu-primary">Create a class</TrackedCta>
          </div>
        </details>
      </div>
    </header>
  );
}
