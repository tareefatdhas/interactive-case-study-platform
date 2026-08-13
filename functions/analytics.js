'use strict';

/**
 * Server-side purchase reporting for Google Analytics.
 *
 * A browser cannot be trusted with revenue. The Stripe success page is reached
 * before Stripe confirms anything, it is skipped whenever someone closes the
 * tab, and the amount there is whatever the page was told. This module reports
 * `purchase` from the webhook instead, where the amount is confirmed and every
 * paying customer passes through exactly once.
 *
 * The catch is attribution: an event sent from a server has no campaign of its
 * own. The GA4 client and session identifiers are captured in the browser when
 * checkout starts and carried through Stripe metadata, so the purchase joins
 * the visit that earned it. Without them the revenue would land under "direct"
 * and no channel could be judged on what it returned.
 */

const MEASUREMENT_PROTOCOL_URL = 'https://www.google-analytics.com/mp/collect';

/** Stripe reports minor units. GA4 expects a decimal amount. */
function toMajorUnits(amountMinor, currency) {
  // Zero-decimal currencies per Stripe. JPY 1000 is 1000 yen, not 10.00.
  const zeroDecimal = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
  const divisor = zeroDecimal.has(String(currency || '').toLowerCase()) ? 1 : 100;
  return Math.round((Number(amountMinor || 0) / divisor) * 100) / 100;
}

const PLAN_LABELS = {
  instructor_term: 'Instructor term',
  instructor_annual: 'Instructor annual',
};

/**
 * Builds the Measurement Protocol body for a completed Stripe Checkout session.
 *
 * Pure so it can be tested without a network call. Returns null when the
 * session cannot be attributed, because an unattributed purchase is worse than
 * no purchase row: it silently understates every channel that did convert.
 */
function buildPurchasePayload(checkoutSession) {
  const metadata = checkoutSession?.metadata || {};
  const clientId = metadata.gaClientId;
  if (!clientId) return null;

  const plan = metadata.classfullyPlan || 'instructor_term';
  const currency = String(checkoutSession.currency || 'usd').toUpperCase();
  const value = toMajorUnits(checkoutSession.amount_total, checkoutSession.currency);

  return {
    client_id: clientId,
    // The Firebase UID, matching the User-ID set in the browser, so the
    // purchase belongs to the same person across devices.
    ...(metadata.firebaseUid ? { user_id: metadata.firebaseUid } : {}),
    events: [{
      name: 'purchase',
      params: {
        // Joins the event to the browser session that started checkout.
        ...(metadata.gaSessionId ? { session_id: metadata.gaSessionId } : {}),
        // Required, or GA4 discards the event as having no engagement.
        engagement_time_msec: 1,
        // The Stripe session id. GA4 drops repeat transaction ids, so a webhook
        // retry cannot double-count the revenue.
        transaction_id: checkoutSession.id,
        currency,
        value,
        items: [{
          item_id: plan,
          item_name: PLAN_LABELS[plan] || plan,
          item_category: 'subscription',
          price: value,
          quantity: 1,
        }],
      },
    }],
  };
}

/**
 * Sends the purchase to Google Analytics.
 *
 * Never throws: analytics must not be able to fail a Stripe webhook and force a
 * retry of the subscription write that already succeeded.
 */
async function sendPurchase(checkoutSession, { measurementId, apiSecret }) {
  if (!measurementId || !apiSecret) return { sent: false, reason: 'not_configured' };

  const payload = buildPurchasePayload(checkoutSession);
  if (!payload) return { sent: false, reason: 'unattributed' };

  try {
    const url = `${MEASUREMENT_PROTOCOL_URL}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { sent: false, reason: `http_${response.status}` };
    return { sent: true };
  } catch (error) {
    console.warn('Purchase could not be reported to Google Analytics.', error instanceof Error ? error.message : error);
    return { sent: false, reason: 'request_failed' };
  }
}

module.exports = { buildPurchasePayload, sendPurchase, toMajorUnits };
