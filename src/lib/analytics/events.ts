'use client';

import { bucketDuration, bucketParticipants, failureReason } from './config';
import { sendEvent, setUserId, setUserProperties } from './gtag';

/**
 * The event catalog.
 *
 * Every event here exists to answer a question someone actually asks. If a new
 * event cannot be attached to a decision, it does not belong in this file — a
 * report nobody reads still costs the cardinality budget and the review time.
 *
 * Names follow GA4's recommended vocabulary where one exists (`sign_up`,
 * `login`, `begin_checkout`, `purchase`, `generate_lead`) so the built-in
 * reports work without configuration. Everything else is `object_action`.
 *
 * Nothing in here may carry a class code, a student number, a display name, a
 * response, or a student's Firebase UID.
 */

export type VisitorType = 'visitor' | 'instructor' | 'student';
export type AuthMethod = 'email' | 'google';
export type ContentSource = 'manual' | 'ai';
export type PlanId = 'pilot' | 'instructor_term' | 'instructor_annual' | 'institution';

/** Where a call to action sits, so identical labels stay distinguishable. */
export type CtaLocation =
  | 'header'
  | 'footer'
  | 'home_hero'
  | 'home_final'
  | 'home_body'
  | 'pricing_plans'
  | 'instructors_page'
  | 'students_page'
  | 'resources_page'
  | 'blog';

type EventMap = {
  // ── Acquisition ────────────────────────────────────────────────────────────
  /**
   * Which pages and which positions actually move people toward signup.
   * Answers: is the hero pulling its weight, or is the footer doing the work?
   */
  cta_clicked: {
    cta_location: CtaLocation;
    cta_label: string;
    cta_destination: string;
  };

  /**
   * A plan card was chosen on the pricing page. Paired with `begin_checkout`,
   * this separates "picked a plan" from "reached Stripe", which is where
   * pricing-page problems and billing problems stop looking alike.
   */
  pricing_plan_selected: {
    plan_id: PlanId;
    plan_price_usd: number;
  };

  /** GA4 recommended event. The Institution plan is a sales conversation. */
  generate_lead: {
    lead_type: 'institution_enquiry';
    cta_location: CtaLocation;
  };

  // ── Account ────────────────────────────────────────────────────────────────
  /** GA4 recommended event. The marketing conversion. */
  sign_up: {
    method: AuthMethod;
    /** Set when the visitor arrived from a priced plan card, e.g. `instructor-term`. */
    plan_intent?: string;
  };

  /** GA4 recommended event. Separates returning use from new acquisition. */
  login: {
    method: AuthMethod;
  };

  /**
   * Signup attempts that failed, grouped by reason.
   * Answers: how much of the signup gap is intent versus broken flow?
   */
  signup_failed: {
    method: AuthMethod;
    failure_reason: string;
  };

  // ── Activation: does a new instructor reach a live class? ──────────────────
  /** Content exists. `content_source` shows how much of it the AI drafts. */
  case_study_created: {
    content_source: ContentSource;
  };

  /**
   * The AI drafting feature produced something. Answers whether the feature is
   * used, and whether it is fast enough that people wait for it.
   */
  case_study_generated: {
    generation_seconds: number;
  };

  /** Interactions were drafted for a session plan from lesson material. */
  session_interactions_generated: {
    interaction_count: number;
  };

  /** A lesson plan exists. The step between having content and teaching it. */
  session_created: {
    session_type: string;
    interaction_count: number;
  };

  /**
   * The primary activation event: an instructor is actually teaching with it.
   * Everything upstream is a means to this. Mark it as a key event in GA4 and
   * measure signup-to-first-class as the real onboarding funnel.
   *
   * Counts distinct classes taught, not console opens: reopening or resuming a
   * session that already started does not fire it again.
   */
  live_classroom_started: {
    session_type: string;
    interaction_count: number;
    /**
     * Pilot sessions consumed after this one, so `1` is a first-ever class.
     * Stays at its last value once the instructor is on a paid plan, because
     * the server only meters the free pilot.
     */
    pilot_sessions_used: number;
  };

  /**
   * How the class went, in bands. Answers: do classes run long enough to be
   * real teaching, and do students actually show up?
   */
  live_classroom_ended: {
    duration_bucket: string;
    participant_bucket: string;
    interactions_run: number;
  };

  // ── Monetization ───────────────────────────────────────────────────────────
  /** GA4 recommended event. Fires as Stripe Checkout is requested. */
  begin_checkout: {
    currency: 'USD';
    value: number;
    plan_id: PlanId;
  };

  /** Reached Stripe and came back without paying. Where price objections show. */
  checkout_abandoned: Record<string, never>;

  /**
   * Returned from a successful Stripe Checkout. This is a funnel signal, not
   * the revenue record — `purchase` is sent server-side from the Stripe
   * webhook, which is the only place the amount is known and confirmed.
   */
  checkout_completed: Record<string, never>;

  /** Existing subscribers managing a plan. Usually precedes a cancellation. */
  billing_portal_opened: Record<string, never>;

  // ── Student funnel: no identifiers, ever ───────────────────────────────────
  /**
   * A student is trying to get into a class.
   * Answers: does the QR code work better than reading a code off a projector?
   * This is a product-reliability metric, not an acquisition metric.
   */
  join_started: {
    entry_method: 'qr_link' | 'manual_code';
  };

  /**
   * Made it in. `join_mode` shows which participation model instructors pick,
   * and `classroom_kind` shows whether the live console or the older
   * case-study reader is carrying real classes.
   */
  join_succeeded: {
    join_mode: 'anonymous' | 'session-name' | 'course-record';
    entry_method: 'qr_link' | 'manual_code';
    classroom_kind: 'live' | 'case_study';
  };

  /**
   * Did not make it in, grouped by reason. A rise here during class hours is an
   * incident, not a statistic — wrong code, ended session, or an outage.
   */
  join_failed: {
    failure_reason: string;
    entry_method: 'qr_link' | 'manual_code';
  };
};

/** Sends a catalog event. The name and its parameters are checked together. */
export function track<K extends keyof EventMap>(name: K, params: EventMap[K]): void {
  sendEvent(name, params);
}

/**
 * Labels the person so marketing reports can exclude students and product
 * reports can isolate instructors. Register `visitor_type` as a user-scoped
 * custom dimension in GA4 Admin, then build the comparisons described in
 * docs/analytics-tracking-plan.md.
 */
export function setVisitorType(visitorType: VisitorType): void {
  setUserProperties({ visitor_type: visitorType });
}

/** Records the plan an instructor is on, whenever the app learns it. */
export function setInstructorPlan(plan: PlanId): void {
  setUserProperties({ instructor_plan: plan });
}

/** Identifies a signed-in instructor. Never called for students. */
export function identifyInstructor(uid: string): void {
  setUserId(uid);
  setVisitorType('instructor');
}

/** Clears the identity on sign-out so the next session is not merged in. */
export function clearInstructorIdentity(): void {
  setUserId(null);
  setVisitorType('visitor');
}

export { bucketDuration, bucketParticipants, failureReason };
