'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { track, type CtaLocation } from '@/lib/analytics/events';

type TrackedCtaProps = Omit<ComponentProps<typeof Link>, 'onClick'> & {
  /** Where on the site this call to action sits. */
  ctaLocation: CtaLocation;
  /** Stable label. Keep it steady across copy edits so trends stay comparable. */
  ctaLabel: string;
  children: ReactNode;
};

/**
 * A marketing link that records `cta_clicked`.
 *
 * Exists so the marketing pages can stay server components: only the anchor
 * itself becomes client-side, not the page around it.
 */
export default function TrackedCta({ ctaLocation, ctaLabel, href, children, ...rest }: TrackedCtaProps) {
  return (
    <Link
      href={href}
      onClick={() => track('cta_clicked', {
        cta_location: ctaLocation,
        cta_label: ctaLabel,
        cta_destination: typeof href === 'string' ? href : href.pathname || '',
      })}
      {...rest}
    >
      {children}
    </Link>
  );
}
