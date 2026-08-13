'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { track, type PlanId } from '@/lib/analytics/events';

/**
 * The button on a pricing plan card.
 *
 * A self-serve plan records `pricing_plan_selected`, which pairs with
 * `begin_checkout` later to separate "chose a plan" from "reached Stripe".
 * The Institution card is a sales conversation, so it records `generate_lead`
 * instead — those two should never be counted in the same funnel.
 */
export default function PricingPlanCta({
  planId,
  priceUsd,
  href,
  className,
  children,
}: {
  planId: PlanId;
  priceUsd: number;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const record = () => {
    if (planId === 'institution') {
      track('generate_lead', { lead_type: 'institution_enquiry', cta_location: 'pricing_plans' });
      return;
    }
    track('pricing_plan_selected', { plan_id: planId, plan_price_usd: priceUsd });
  };

  return (
    <Link href={href} className={className} onClick={record}>
      {children}
    </Link>
  );
}
