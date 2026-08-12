'use client';

import { httpsCallable } from 'firebase/functions';
import { functions } from './config';
import type { BillingPlan, InstructorBillingSummary } from '@/types';

type RedirectPayload = { url: string };

const getBillingCall = httpsCallable<undefined, InstructorBillingSummary>(functions, 'getInstructorBilling');
const checkoutCall = httpsCallable<{ plan: BillingPlan }, RedirectPayload>(functions, 'createBillingCheckout');
const portalCall = httpsCallable<undefined, RedirectPayload>(functions, 'createBillingPortal');
const startSessionCall = httpsCallable<{ sessionId: string }, { alreadyCounted: boolean; billing: InstructorBillingSummary }>(functions, 'startInstructorSession');
const createCourseCall = httpsCallable<{
  name: string;
  code: string;
  term?: string;
  sourceCourseId?: string;
  interactionTemplates?: unknown[];
}, { courseId: string }>(functions, 'createInstructorCourse');

export async function getInstructorBilling(): Promise<InstructorBillingSummary> {
  return (await getBillingCall()).data;
}

export async function openBillingCheckout(plan: Extract<BillingPlan, 'instructor_term' | 'instructor_annual'>): Promise<void> {
  const { data } = await checkoutCall({ plan });
  window.location.assign(data.url);
}

export async function openBillingPortal(): Promise<void> {
  const { data } = await portalCall();
  window.location.assign(data.url);
}

export async function claimSessionStart(sessionId: string) {
  return (await startSessionCall({ sessionId })).data;
}

export async function createCourseWithEntitlement(input: {
  name: string;
  code: string;
  term?: string;
  sourceCourseId?: string;
  interactionTemplates?: unknown[];
}): Promise<string> {
  return (await createCourseCall(input)).data.courseId;
}
