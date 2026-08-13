'use client';

import {
  GA_DEBUG_MODE,
  GA_MEASUREMENT_ID,
  buildPageLocation,
  isAnalyticsConfigured,
  isMeasuredPath,
  normalizePath,
} from './config';

type GtagArguments =
  | ['js', Date]
  | ['config', string, Record<string, unknown>]
  | ['event', string, Record<string, unknown>]
  | ['set', Record<string, unknown>]
  | ['set', 'user_properties', Record<string, unknown>]
  | ['consent', 'default' | 'update', Record<string, string>]
  | ['get', string, string, (value: string) => void];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: GtagArguments) => void;
  }
}

function push(...args: GtagArguments): void {
  if (typeof window === 'undefined' || !isAnalyticsConfigured()) return;
  // Queue directly rather than waiting for gtag.js. Anything pushed before the
  // library loads is replayed in order once it does, so an event fired during
  // the first paint is never lost.
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

/**
 * Consent defaults, applied before the first `config` call.
 *
 * Analytics storage is granted so the measurement the product depends on works
 * out of the box. Everything advertising-related is denied: Classfully runs no
 * ads today, and sharing classroom-adjacent traffic with Google's advertising
 * products is not a default anyone should inherit silently. Flip these through
 * `updateConsent` once a consent banner and a paid channel exist.
 */
export const DEFAULT_CONSENT: Record<string, string> = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'granted',
  functionality_storage: 'granted',
  personalization_storage: 'denied',
  security_storage: 'granted',
};

/**
 * The inline bootstrap. Kept as a string so consent defaults and the `config`
 * call land in the data layer in the right order, in one script, before
 * anything else can fire an event.
 *
 * `send_page_view` is off because the App Router changes routes without a
 * document load. Page views are sent from `trackPageView` instead, on one code
 * path for both the first paint and every client-side navigation.
 */
export function bootstrapScript(): string {
  const config: Record<string, unknown> = { send_page_view: false };
  if (GA_DEBUG_MODE) config.debug_mode = true;

  return [
    'window.dataLayer = window.dataLayer || [];',
    'function gtag(){dataLayer.push(arguments);}',
    `gtag('consent', 'default', ${JSON.stringify(DEFAULT_CONSENT)});`,
    "gtag('js', new Date());",
    `gtag('config', ${JSON.stringify(GA_MEASUREMENT_ID)}, ${JSON.stringify(config)});`,
  ].join('\n');
}

/** Updates consent after a user choice, e.g. from a cookie banner. */
export function updateConsent(consent: Record<string, 'granted' | 'denied'>): void {
  push('consent', 'update', consent);
}

/**
 * Sends a page view for the current location, or nothing at all when it is an
 * in-lesson surface.
 */
export function trackPageView(pathname: string): void {
  if (typeof window === 'undefined' || !isMeasuredPath(pathname)) return;
  push('event', 'page_view', {
    ...currentPageContext(),
    page_title: document.title,
    // A referrer from inside the app can carry a class code or an owner UID.
    page_referrer: sanitizeReferrer(document.referrer),
  });
}

/**
 * The sanitized location attached to every event.
 *
 * gtag would otherwise read `window.location` itself, which on the instructor
 * console is `/live?sessionId=<id>` and on a student view carries `ownerUid`.
 * Overriding it on each event is what keeps those identifiers out of Google
 * Analytics, and keeps one row per route instead of one row per record.
 */
function currentPageContext(): { page_location: string; page_path: string } {
  const { pathname, search, origin } = window.location;
  return {
    page_location: buildPageLocation(pathname, new URLSearchParams(search), origin),
    page_path: normalizePath(pathname),
  };
}

function sanitizeReferrer(referrer: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    if (url.origin !== window.location.origin) return referrer;
    return isMeasuredPath(url.pathname)
      ? `${url.origin}${normalizePath(url.pathname)}`
      : undefined;
  } catch {
    return undefined;
  }
}

/** Low-level event send. Prefer the typed `track` helper in `events.ts`. */
export function sendEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  const clean: Record<string, unknown> = currentPageContext();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') clean[key] = value;
  });
  push('event', name, clean);
}

/**
 * Sets user-scoped properties. Register each one as a user-scoped custom
 * dimension in GA4 Admin or it will not appear in reports.
 */
export function setUserProperties(properties: Record<string, string | number | undefined>): void {
  const clean: Record<string, string | number> = {};
  Object.entries(properties).forEach(([key, value]) => {
    if (value !== undefined && value !== '') clean[key] = value;
  });
  if (Object.keys(clean).length === 0) return;
  push('set', 'user_properties', clean);
}

/**
 * Links sessions across devices for a signed-in instructor.
 *
 * The Firebase UID is a pseudonymous internal identifier, which is what GA4's
 * User-ID feature expects. It is only ever set for instructors: students
 * authenticate anonymously against a separate Firebase app and are never
 * identified here.
 */
export function setUserId(userId: string | null): void {
  push('config', GA_MEASUREMENT_ID, { user_id: userId ?? undefined, send_page_view: false });
}

/**
 * Reads the GA4 client and session identifiers.
 *
 * Needed when a conversion completes off-site — Stripe Checkout — so the
 * server-side event can be joined back to the session and campaign that earned
 * it. Resolves to nulls if gtag has not loaded or a blocker removed it.
 */
export function getMeasurementIdentifiers(timeoutMs = 1500): Promise<{ clientId: string | null; sessionId: string | null }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function' || !isAnalyticsConfigured()) {
      resolve({ clientId: null, sessionId: null });
      return;
    }

    let clientId: string | null = null;
    let sessionId: string | null = null;
    let settled = false;
    let pending = 2;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ clientId, sessionId });
    };

    const timer = window.setTimeout(finish, timeoutMs);
    const record = (assign: (value: string) => void) => (value: string) => {
      assign(value);
      pending -= 1;
      if (pending === 0) {
        window.clearTimeout(timer);
        finish();
      }
    };

    window.gtag('get', GA_MEASUREMENT_ID, 'client_id', record((value) => { clientId = value; }));
    window.gtag('get', GA_MEASUREMENT_ID, 'session_id', record((value) => { sessionId = value; }));
  });
}
