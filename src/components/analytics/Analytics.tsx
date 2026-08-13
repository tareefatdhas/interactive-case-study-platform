'use client';

import Script from 'next/script';
import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { GA_MEASUREMENT_ID, isAnalyticsConfigured, isStudentSurface } from '@/lib/analytics/config';
import { bootstrapScript, trackPageView } from '@/lib/analytics/gtag';
import { clearInstructorIdentity, identifyInstructor, setVisitorType } from '@/lib/analytics/events';
import { useAuth } from '@/lib/hooks/useAuth';

/**
 * Google Analytics for the App Router.
 *
 * Mounted inside `AuthProvider` in the root layout so the signed-in instructor
 * can be labelled. Renders nothing when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is
 * unset, which keeps local development and preview builds out of the property
 * unless they are deliberately opted in.
 */
export default function Analytics() {
  if (!isAnalyticsConfigured()) return null;

  return (
    <>
      {/*
        Consent defaults and `config` must reach the data layer before any
        event, so they share one inline script. The library is loaded after it;
        gtag.js replays whatever is already queued, in order.
      */}
      <Script id="ga-bootstrap" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: bootstrapScript() }} />
      <Script id="ga-library" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
      {/* useSearchParams needs a boundary or every page below it renders client-side. */}
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <VisitorIdentity />
    </>
  );
}

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // The App Router swaps the route before the metadata system updates
    // document.title, so firing immediately records the previous page's title.
    // A short delay lets the new title land first.
    const timer = window.setTimeout(() => trackPageView(pathname), 80);
    return () => window.clearTimeout(timer);
  }, [pathname, searchParams]);

  return null;
}

/**
 * Keeps `visitor_type` and the GA4 User-ID in step with who is on the page.
 *
 * `useAuth` only ever resolves to an instructor: students authenticate
 * anonymously against a separate Firebase app and never appear here, so no
 * student identifier can reach Google Analytics through this path.
 */
function VisitorIdentity() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    const identity = user ? `instructor:${user.uid}` : isStudentSurface(pathname) ? 'student' : 'visitor';
    if (applied.current === identity) return;

    if (user) identifyInstructor(user.uid);
    else if (identity === 'student') setVisitorType('student');
    else if (applied.current?.startsWith('instructor:')) clearInstructorIdentity();
    else setVisitorType('visitor');

    applied.current = identity;
  }, [user, loading, pathname]);

  return null;
}
