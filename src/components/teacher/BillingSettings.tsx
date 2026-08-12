'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarRange, CheckCircle2, CreditCard, ExternalLink, GraduationCap, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import InlineMessage from '@/components/ui/InlineMessage';
import { getInstructorBilling, openBillingCheckout, openBillingPortal } from '@/lib/firebase/billing';
import { getUserFacingError } from '@/lib/user-facing-error';
import type { BillingPlan, InstructorBillingSummary } from '@/types';

const planNames: Record<BillingPlan, string> = {
  pilot: 'Classroom pilot',
  instructor_term: 'Instructor term',
  instructor_annual: 'Instructor annual',
  institution: 'Institution workspace',
};

function readableDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

export default function BillingSettings() {
  const [billing, setBilling] = useState<InstructorBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'term' | 'annual' | 'portal' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') === 'success') setNotice('Payment received. Your plan will update as soon as Stripe confirms it.');
    if (params.get('billing') === 'cancelled') setNotice('No changes were made to your plan.');
    getInstructorBilling()
      .then(setBilling)
      .catch((loadError) => setError(getUserFacingError(loadError, 'Billing details are not available yet. Try again shortly.')))
      .finally(() => setLoading(false));
  }, []);

  const startCheckout = async (plan: Extract<BillingPlan, 'instructor_term' | 'instructor_annual'>) => {
    setAction(plan === 'instructor_term' ? 'term' : 'annual');
    setError('');
    try {
      await openBillingCheckout(plan);
    } catch (checkoutError) {
      setError(getUserFacingError(checkoutError, 'Checkout could not be opened. Try again.'));
      setAction(null);
    }
  };

  const manageBilling = async () => {
    setAction('portal');
    setError('');
    try {
      await openBillingPortal();
    } catch (portalError) {
      setError(getUserFacingError(portalError, 'Your billing page could not be opened. Try again.'));
      setAction(null);
    }
  };

  const planName = billing ? planNames[billing.effectivePlan] : 'Classroom pilot';
  const periodEnd = readableDate(billing?.currentPeriodEnd || null);
  const pilotUsed = billing?.pilotSessionsUsed ?? 0;
  const pilotRemaining = billing?.sessionsRemaining ?? Math.max(0, 6 - pilotUsed);
  const needsPaymentAttention = billing?.status === 'past_due' || billing?.status === 'unpaid';

  return (
    <Card id="billing" className="scroll-mt-8 overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-[#5146e5]" />
          Plan and billing
        </CardTitle>
        <CardDescription>Manage the plan that supports your live classes. Students never pay.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5" aria-busy={loading}>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-[#dcd8ff] bg-[#f7f5ff] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-[#5146e5]">Current plan</span>
                <h3 className="seminar-display mt-2 text-3xl text-[#101a38]">{loading ? 'Loading your plan' : planName}</h3>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[#5146e5] shadow-sm"><GraduationCap className="h-5 w-5" /></span>
            </div>
            {billing?.effectivePlan === 'pilot' || !billing ? (
              <>
                <p className="mt-3 text-sm leading-6 text-[#697087]">Your pilot includes six live sessions. Preparing classes and reviewing past results remain available.</p>
                <div className="mt-5" aria-label={`${pilotUsed} of 6 pilot sessions used`}>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#4f566b]"><span>{pilotUsed} used</span><span>{pilotRemaining} remaining</span></div>
                  <div className="grid grid-cols-6 gap-2">{Array.from({ length: 6 }).map((_, index) => <span key={index} className={`h-2 rounded-full ${index < pilotUsed ? 'bg-[#5146e5]' : 'bg-[#dedbea]'}`} />)}</div>
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-2 text-sm leading-6 text-[#697087]">
                <p><CheckCircle2 className="mr-2 inline h-4 w-4 text-[#2f8750]" />Unlimited live sessions for up to five active courses.</p>
                {periodEnd && <p><CalendarRange className="mr-2 inline h-4 w-4 text-[#5146e5]" />{billing.cancelAtPeriodEnd ? `Access continues until ${periodEnd}.` : `Current period renews on ${periodEnd}.`}</p>}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#e3e5ed] bg-white p-5">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-[#697087]">Current use</span>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f7f8fb] p-3"><dt className="text-xs text-[#697087]">Active classes</dt><dd className="mt-1 text-xl font-bold text-[#101a38]">{billing?.usage.activeCourses ?? '–'}</dd></div>
              <div className="rounded-xl bg-[#f7f8fb] p-3"><dt className="text-xs text-[#697087]">Sessions prepared</dt><dd className="mt-1 text-xl font-bold text-[#101a38]">{billing?.usage.totalSessions ?? '–'}</dd></div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-[#697087]">A prepared session only uses the pilot when you start it live for the first time.</p>
          </section>
        </div>

        {notice && <InlineMessage tone="info" title="Your plan is updating" message={notice} />}
        {needsPaymentAttention && <InlineMessage tone="error" title="Your payment needs attention" message="Update your payment method to keep starting new live sessions after the grace period." />}
        {error && <InlineMessage tone="error" message={error} />}

        {billing?.paid || billing?.hasBillingAccount ? (
          <div className="flex flex-col gap-3 border-t border-[#e3e5ed] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-[#697087]">{needsPaymentAttention ? 'Open billing to update your payment method.' : 'Update your payment method, download invoices, or cancel at the end of the current period in Stripe.'}</p>
            <Button type="button" variant="outline" loading={action === 'portal'} onClick={manageBilling} className="shrink-0 gap-2">Manage billing <ExternalLink className="h-4 w-4" /></Button>
          </div>
        ) : (
          <div className="border-t border-[#e3e5ed] pt-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 h-5 w-5 shrink-0 text-[#5146e5]" />
              <div><h3 className="font-bold text-[#101a38]">Continue after your pilot</h3><p className="mt-1 text-sm leading-6 text-[#697087]">Choose a four-month teaching term or a full teaching year. Your classes and student history stay connected.</p></div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={Boolean(action) || !billing?.billingEnabled} onClick={() => startCheckout('instructor_term')} className="seminar-focus rounded-2xl border border-[#dcd8ff] bg-[#f7f5ff] p-4 text-left transition-colors hover:border-[#9189ee] disabled:cursor-not-allowed disabled:opacity-60"><span className="text-sm font-bold text-[#101a38]">Teaching term</span><strong className="seminar-display mt-2 block text-3xl text-[#5146e5]">$69</strong><small className="text-[#697087]">Four consecutive months</small></button>
              <button type="button" disabled={Boolean(action) || !billing?.billingEnabled} onClick={() => startCheckout('instructor_annual')} className="seminar-focus rounded-2xl border border-[#e3e5ed] bg-white p-4 text-left transition-colors hover:border-[#9189ee] disabled:cursor-not-allowed disabled:opacity-60"><span className="text-sm font-bold text-[#101a38]">Teaching year</span><strong className="seminar-display mt-2 block text-3xl text-[#5146e5]">$119</strong><small className="text-[#697087]">One full year</small></button>
            </div>
            {!billing?.billingEnabled && <p className="mt-3 text-xs leading-5 text-[#697087]">Checkout will appear here after the Stripe account is connected. Your pilot remains available in the meantime.</p>}
          </div>
        )}

        <p className="text-xs leading-5 text-[#697087]">Need a department invoice or institution workspace? <Link href="mailto:tareef@happily.ai?subject=Classfully%20institution%20pricing" className="font-semibold text-[#5146e5] underline-offset-2 hover:underline">Contact Classfully</Link>.</p>
      </CardContent>
    </Card>
  );
}
