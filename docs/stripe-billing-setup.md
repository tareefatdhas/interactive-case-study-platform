# Classfully Stripe setup

The product is ready to connect to Stripe, but checkout stays off until the account, products, prices, secrets, webhook, and Customer Portal are configured.

## 1. Create the Stripe account

Create a Stripe account for Classfully and complete the business verification Stripe requests. Turn on an authenticator app or passkey for the account.

Use Stripe test mode first. Keep test and live credentials separate.

## 2. Create two recurring prices

Create one product named **Classfully Instructor** with two recurring prices:

- **Teaching term:** USD 69, recurring every 4 months
- **Teaching year:** USD 119, recurring every year

Copy the two Price IDs. They begin with `price_`.

Do not create a per-student price. Institution accounts remain a manual sales and invoice flow for now.

## 3. Create a restricted API key

Create a restricted key for the Classfully production functions. Prefer an `rk_` key over the account-wide secret key.

It needs write access to:

- Checkout Sessions
- Customers
- Customer Portal Sessions

It needs read access to:

- Prices
- Products
- Subscriptions

If Stripe rejects a specific operation during test mode, add only the permission named in that rejection.

Store the key in Firebase Secret Manager:

```sh
firebase functions:secrets:set STRIPE_RESTRICTED_KEY
```

Then store the price IDs:

```sh
firebase functions:secrets:set STRIPE_TERM_PRICE_ID
firebase functions:secrets:set STRIPE_ANNUAL_PRICE_ID
```

Never place these values in `.env.local`, browser code, source control, chat, screenshots, or a `NEXT_PUBLIC_` variable.

## 4. Add the Stripe webhook

The webhook endpoint is predictable and can be registered before the function is deployed:

```text
https://asia-southeast1-interactive-case-study-2aff7.cloudfunctions.net/stripeBillingWebhook
```

In Stripe Workbench, create a webhook destination using that endpoint. Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the signing secret, which begins with `whsec_`, and store it in Firebase:

```sh
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

The function verifies every signature and records processed event IDs so Stripe retries cannot apply the same event twice.

## 5. Deploy with checkout disabled

Keep checkout disabled for this first deployment. In `functions/.env.interactive-case-study-2aff7`, add:

```text
STRIPE_BILLING_ENABLED=false
```

After all four Firebase secrets have been stored, deploy:

```sh
firebase deploy --only functions,firestore:rules,database
```

## 6. Configure the Customer Portal

In Stripe, configure the Customer Portal to allow instructors to:

- Update payment methods
- Download invoices
- Cancel at the end of the billing period

Do not enable mid-period plan changes until the proration and four-month term behavior have been tested.

## 7. Decide tax treatment before enabling Stripe Tax

Classfully does not enable automatic tax yet. Confirm the business location, product tax code, and tax registrations with a qualified tax adviser first.

Stripe Tax only collects in jurisdictions with an active registration. Enabling it without those registrations can look successful while collecting no tax.

## 8. Test before going live

In Stripe test mode, verify:

1. A new instructor starts with six pilot sessions.
2. Preparing or editing a session does not use the pilot.
3. Starting a session uses one pilot session only once, including after refresh.
4. The seventh new live session is blocked, while history and preparation remain available.
5. A successful test checkout changes the account to the selected paid plan.
6. A canceled checkout changes nothing.
7. The Customer Portal opens for a paid instructor.
8. A failed renewal receives a seven-day grace period.
9. A canceled subscription remains active until its paid period ends.
10. A second active class is blocked on Pilot and allowed on Instructor.
11. Student 201 is blocked on Pilot and student 301 is blocked on Instructor.

After these pass, create equivalent live-mode prices and a live restricted key, replace the Firebase secrets, and change `functions/.env.interactive-case-study-2aff7` to:

```text
STRIPE_BILLING_ENABLED=true
```

Then deploy the functions again:

```sh
firebase deploy --only functions
```

## Operating notes

- Stripe is the payment and renewal source of truth.
- Firebase stores the access state needed by Classfully.
- Instructors cannot edit their own billing fields through Firestore rules.
- Existing class history is never deleted because payment ends.
- An active class is not interrupted by a failed renewal. Restrictions apply when starting the next new live session.
