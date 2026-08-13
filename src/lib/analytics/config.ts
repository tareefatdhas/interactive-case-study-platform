/**
 * Analytics configuration.
 *
 * Two rules shape everything in this folder.
 *
 * 1. No personal data reaches Google Analytics. Class codes, student numbers,
 *    display names, response text, and the Firebase UIDs in live-classroom URLs
 *    stay in Firebase. The institution is the controller for classroom data,
 *    Classfully is the processor, and Google Analytics is not on that
 *    processing record. See PDPA_COMPLIANCE.md.
 *
 * 2. Students are not marketing traffic. One 200-seat lecture produces more
 *    sessions than a good week of marketing, so if students are measured the
 *    same way visitors are, every acquisition number becomes meaningless.
 *    In-lesson surfaces are not measured at all, and the join funnel is
 *    labelled `visitor_type=student` so marketing reports can exclude it.
 */

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '';

/**
 * Sends events to GA4 DebugView instead of the normal reporting pipeline, so
 * local and preview traffic can be verified without polluting production data.
 */
export const GA_DEBUG_MODE = process.env.NEXT_PUBLIC_GA_DEBUG === 'true';

export function isAnalyticsConfigured(): boolean {
  return GA_MEASUREMENT_ID.length > 0;
}

/**
 * Surfaces a student or a projector sits on during a live lesson.
 *
 * These are excluded from measurement entirely. The projector is a screen in a
 * room rather than a person, and counting it invents a phantom user for every
 * class. The student views carry classroom personal data in their URLs and
 * their engagement is already recorded in Firebase, where the instructor and
 * the institution can govern it.
 *
 * The join page is deliberately absent: it is the top of the student funnel and
 * carries no identifier, so it is measured and labelled instead.
 */
const UNMEASURED_PATH_PREFIXES = [
  '/live/student',
  '/live/display',
  '/live/remote',
  '/session/',
];

export function isMeasuredPath(pathname: string): boolean {
  return !UNMEASURED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Paths only a student reaches. `/join` is measured but still belongs here: it
 * is what marks the visitor as a student so acquisition reports can drop them.
 */
const STUDENT_PATH_PREFIXES = ['/join', '/live/student', '/live/remote', '/session/'];

export function isStudentSurface(pathname: string): boolean {
  return STUDENT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Collapses record identifiers out of the path.
 *
 * Without this, `/dashboard/sessions/<id>` becomes one row per session in every
 * report, so nobody can answer "how much is the session console used". Blog
 * slugs are intentionally left alone: per-article traffic is the point.
 */
const DYNAMIC_ROUTE_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/session\/[^/]+$/, '/session/[code]'],
  [/^\/dashboard\/sessions\/(?!new$)[^/]+\/presentation$/, '/dashboard/sessions/[id]/presentation'],
  [/^\/dashboard\/sessions\/(?!new$)[^/]+$/, '/dashboard/sessions/[id]'],
  [/^\/dashboard\/case-studies\/(?!new$|generate$)[^/]+\/edit$/, '/dashboard/case-studies/[id]/edit'],
  [/^\/dashboard\/case-studies\/(?!new$|generate$)[^/]+$/, '/dashboard/case-studies/[id]'],
  [/^\/dashboard\/classes\/(?!new$)[^/]+$/, '/dashboard/classes/[id]'],
  [/^\/teams\/[^/]+$/, '/teams/[courseId]'],
];

export function normalizePath(pathname: string): string {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const matched = DYNAMIC_ROUTE_RULES.find(([pattern]) => pattern.test(trimmed));
  return matched ? matched[1] : trimmed;
}

/**
 * Query parameters worth keeping on `page_location`.
 *
 * Everything else is dropped rather than filtered later, because `page_location`
 * is the one field that would otherwise carry `ownerUid`, `sessionId`, and class
 * codes straight into Google Analytics.
 */
const ALLOWED_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'ttclid',
  'li_fat_id',
  'ref',
  'plan',
  'billing',
]);

/**
 * Builds the `page_location` value: normalized path, allowlisted query only.
 */
export function buildPageLocation(pathname: string, search: URLSearchParams, origin: string): string {
  const kept = new URLSearchParams();
  ALLOWED_QUERY_PARAMS.forEach((key) => {
    const value = search.get(key);
    if (value) kept.set(key, value);
  });
  const query = kept.toString();
  return `${origin}${normalizePath(pathname)}${query ? `?${query}` : ''}`;
}

/**
 * Buckets a headcount. Raw counts would make small classes identifiable and add
 * nothing a bucket does not already answer.
 */
export function bucketParticipants(count: number): string {
  if (count <= 0) return '0';
  if (count < 10) return '1-9';
  if (count < 30) return '10-29';
  if (count < 60) return '30-59';
  if (count < 120) return '60-119';
  return '120+';
}

/** Buckets a duration in milliseconds into a lesson-length band. */
export function bucketDuration(milliseconds: number): string {
  const minutes = milliseconds / 60000;
  if (minutes < 5) return '0-5m';
  if (minutes < 15) return '5-15m';
  if (minutes < 30) return '15-30m';
  if (minutes < 60) return '30-60m';
  if (minutes < 120) return '60-120m';
  return '120m+';
}

/**
 * Reduces a thrown value to a short, stable, non-identifying label so failure
 * reasons can be grouped in reports. Never send raw error messages: they can
 * contain an email address or a class code.
 */
export function failureReason(value: unknown): string {
  const raw = typeof value === 'string'
    ? value
    : (value as { code?: string })?.code || (value as { name?: string })?.name || 'unknown';
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'unknown';
}
