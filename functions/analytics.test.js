'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPurchasePayload, toMajorUnits } = require('./analytics');

const checkoutSession = {
  id: 'cs_test_123',
  currency: 'usd',
  amount_total: 6900,
  metadata: {
    firebaseUid: 'teacher-1',
    classfullyPlan: 'instructor_term',
    gaClientId: '1234567890.1700000000',
    gaSessionId: '1700000000',
  },
};

test('a completed checkout becomes an attributed purchase', () => {
  const payload = buildPurchasePayload(checkoutSession);
  assert.equal(payload.client_id, '1234567890.1700000000');
  assert.equal(payload.user_id, 'teacher-1');

  const [event] = payload.events;
  assert.equal(event.name, 'purchase');
  assert.equal(event.params.session_id, '1700000000');
  assert.equal(event.params.transaction_id, 'cs_test_123');
  assert.equal(event.params.currency, 'USD');
  assert.equal(event.params.value, 69);
  assert.equal(event.params.engagement_time_msec, 1);
  assert.deepEqual(event.params.items, [{
    item_id: 'instructor_term',
    item_name: 'Instructor term',
    item_category: 'subscription',
    price: 69,
    quantity: 1,
  }]);
});

test('a checkout with no analytics client is not reported', () => {
  const payload = buildPurchasePayload({
    ...checkoutSession,
    metadata: { firebaseUid: 'teacher-1', classfullyPlan: 'instructor_term' },
  });
  assert.equal(payload, null);
});

test('a missing session id still reports the purchase', () => {
  const payload = buildPurchasePayload({
    ...checkoutSession,
    metadata: { ...checkoutSession.metadata, gaSessionId: undefined },
  });
  assert.equal(payload.events[0].params.session_id, undefined);
  assert.equal(payload.events[0].params.value, 69);
});

test('the annual plan carries its own label and amount', () => {
  const payload = buildPurchasePayload({
    ...checkoutSession,
    amount_total: 11900,
    metadata: { ...checkoutSession.metadata, classfullyPlan: 'instructor_annual' },
  });
  assert.equal(payload.events[0].params.value, 119);
  assert.equal(payload.events[0].params.items[0].item_name, 'Instructor annual');
});

test('minor units convert per currency', () => {
  assert.equal(toMajorUnits(6900, 'usd'), 69);
  assert.equal(toMajorUnits(2450, 'thb'), 24.5);
  // Yen has no minor unit, so the amount must not be divided.
  assert.equal(toMajorUnits(1000, 'jpy'), 1000);
});
