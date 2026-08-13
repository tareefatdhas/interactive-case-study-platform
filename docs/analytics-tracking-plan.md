# Classfully tracking plan

Measurement ID: `G-38JCNNBPB8`
Implementation: `src/lib/analytics/` and `src/components/analytics/`

## What this is designed to answer

Four questions, and nothing beyond them:

1. **Which marketing brings instructors?** Channel, page, and call to action, all the way to signup.
2. **Do new instructors reach a real class?** Signup → content → session → live classroom.
3. **What earns revenue?** Which campaign produced a paying subscription, with the amount confirmed by Stripe.
4. **Does joining a class work?** Whether students get in, and why they do not.

Anything that does not serve one of these is not tracked. The instrumentation is
a typed catalog in `src/lib/analytics/events.ts`; adding an event means adding it
there, which is the point at which someone has to say what decision it informs.

## Two rules that shape the whole setup

### Students are not marketing traffic

One 200-seat lecture produces more sessions than a good week of marketing. If
students are counted like visitors, every acquisition number becomes fiction.

- In-lesson surfaces (`/live/student`, `/live/display`, `/live/remote`,
  `/session/[code]`) send **nothing at all**. The projector in particular is a
  screen in a room, not a person, and counting it invents a user per class.
- `/join` **is** measured, because the join funnel is worth knowing, and anyone
  on it is labelled `visitor_type=student`.
- Every marketing report must apply the **Exclude students** comparison below.
  This is not optional polish. Without it the reports are wrong.

### No personal data reaches Google Analytics

The institution is the controller for classroom data and Classfully is the
processor (`PDPA_COMPLIANCE.md`). Google Analytics is not on that processing
record and must not become a copy of it.

- `page_location` is rebuilt on **every** event from an allowlist, so the
  `ownerUid` and `sessionId` in live-classroom URLs, and the class code in
  `/session/<code>`, never leave the browser. Only UTM, click, `plan`, `billing`,
  and `ref` parameters survive.
- Record identifiers in paths collapse to route templates, so
  `/dashboard/sessions/<id>` reports as `/dashboard/sessions/[id]` — one row per
  route rather than one per record.
- Headcounts and durations are sent as bands (`30-59`, `15-30m`), so a small
  class is not identifiable from a report.
- Failure reasons are normalized codes, never raw error messages, which can
  contain an email address or a class code.
- GA4 User-ID is set **only** for instructors, from their Firebase UID.
  Students authenticate anonymously against a separate Firebase app and are
  never identified.

## Setup

### 1. Environment variables

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-38JCNNBPB8
NEXT_PUBLIC_GA_DEBUG=false
```

Set these in Vercel for **Production only**. Leave them unset in Preview and
Development so test traffic never reaches the property. To verify locally, set
both temporarily (`NEXT_PUBLIC_GA_DEBUG=true` routes events to DebugView).

Nothing renders when the measurement ID is absent, so an unset environment is
simply un-tracked rather than broken.

### 2. Turn off duplicate page views — required

The app sends `page_view` itself, because the App Router changes routes without
a document load and the automatic event would otherwise capture the previous
page's title.

In **Admin → Data streams → Web stream → Enhanced measurement → Page views →
Show advanced settings**, turn **off** "Page changes based on browser history
events". Leaving it on double-counts every client-side navigation.

Leave the rest of enhanced measurement on: scrolls, outbound clicks, and file
downloads are all useful and none of them are affected.

### 3. Register custom dimensions

**Admin → Custom definitions.** A parameter that is not registered is collected
but invisible in reports.

User-scoped dimensions:

| Name | User property | What it is for |
| --- | --- | --- |
| Visitor type | `visitor_type` | `visitor`, `instructor`, `student`. The basis of every comparison below. |
| Instructor plan | `instructor_plan` | `pilot`, `instructor_term`, `instructor_annual`, `institution`. |

Event-scoped dimensions:

| Name | Parameter |
| --- | --- |
| CTA location | `cta_location` |
| CTA label | `cta_label` |
| Plan ID | `plan_id` |
| Plan intent | `plan_intent` |
| Auth method | `method` |
| Failure reason | `failure_reason` |
| Content source | `content_source` |
| Session type | `session_type` |
| Entry method | `entry_method` |
| Join mode | `join_mode` |
| Classroom kind | `classroom_kind` |
| Duration bucket | `duration_bucket` |
| Participant bucket | `participant_bucket` |
| Lead type | `lead_type` |

Event-scoped metrics:

| Name | Parameter | Unit |
| --- | --- | --- |
| Interaction count | `interaction_count` | Standard |
| Interactions run | `interactions_run` | Standard |
| Generation seconds | `generation_seconds` | Seconds |
| Pilot sessions used | `pilot_sessions_used` | Standard |

Register these **before** deploying. GA4 does not backfill: a dimension only
carries data collected after it exists.

### 4. Mark key events

**Admin → Events → Key events.** Mark exactly these four:

- `sign_up` — the marketing conversion
- `live_classroom_started` — the activation conversion, and the one that
  actually predicts retention
- `purchase` — revenue
- `generate_lead` — institution sales enquiries

Do **not** mark `begin_checkout`, `cta_clicked`, or `session_created`. They are
funnel steps; marking them makes the conversion count meaningless.

### 5. Server-side purchase reporting

`purchase` is sent from the Stripe webhook, not the browser. The success page is
reached before Stripe confirms anything, is skipped whenever someone closes the
tab, and knows only what it was told about the amount.

Attribution is preserved by capturing the GA4 client and session identifiers in
the browser when checkout starts and carrying them through Stripe metadata, so
the purchase joins the visit that earned it rather than landing under "direct".

To enable it:

1. **Admin → Data streams → Web stream → Measurement Protocol API secrets →
   Create**. Copy the secret value.
2. Set the Firebase secret and parameter:

```bash
firebase functions:secrets:set GA4_API_SECRET
```

```bash
firebase deploy --only functions:stripeBillingWebhook,functions:createBillingCheckout
```

`GA4_MEASUREMENT_ID` is a function parameter — set it to `G-38JCNNBPB8` when
prompted during deploy, or in `.env` for the functions project.

Until both are set, the webhook skips the call silently and everything else
continues to work. The transaction ID is the Stripe Checkout session ID, so a
webhook retry cannot double-count revenue.

### 6. Property settings

- **Data retention: 14 months.** The default of 2 months makes year-over-year
  and full-term analysis impossible, and a teaching term is four months.
- **Internal traffic:** define a filter for your own IP addresses and set it to
  Active, or your own testing will look like demand.
- **Google Signals: leave off** for now. Consent defaults deny `ad_storage`,
  `ad_user_data`, and `ad_personalization`, which is the right default for a
  product used by students under an institution's data policy. Turn them on
  through `updateConsent()` behind a consent banner if a paid channel starts.
- **Unwanted referrals:** add `checkout.stripe.com` so returning from Stripe
  does not restart the session and steal credit from the original campaign.

## Event reference

Every event carries a sanitized `page_location` and `page_path`.

### Acquisition

| Event | Parameters | Fires when |
| --- | --- | --- |
| `cta_clicked` | `cta_location`, `cta_label`, `cta_destination` | Any tracked marketing call to action |
| `pricing_plan_selected` | `plan_id`, `plan_price_usd` | A self-serve plan card is chosen |
| `generate_lead` | `lead_type`, `cta_location` | The Institution plan card is chosen |

### Account

| Event | Parameters | Fires when |
| --- | --- | --- |
| `sign_up` | `method`, `plan_intent` | A new instructor account is created |
| `login` | `method` | An existing instructor signs in |
| `signup_failed` | `method`, `failure_reason` | A signup attempt fails |

Google is one button for two intents, so `signInTeacherWithGoogle` reports
whether it created the account. A returning instructor clicking Google on the
signup page is a `login`, not a `sign_up`.

### Activation

| Event | Parameters | Fires when |
| --- | --- | --- |
| `case_study_created` | `content_source` | A case study is saved (`manual` or `ai`) |
| `case_study_generated` | `generation_seconds` | An AI draft comes back |
| `session_interactions_generated` | `interaction_count` | AI drafts interactions from lesson material |
| `session_created` | `session_type`, `interaction_count` | A session plan is saved |
| `live_classroom_started` | `session_type`, `interaction_count`, `pilot_sessions_used` | A class is genuinely started |
| `live_classroom_ended` | `duration_bucket`, `participant_bucket`, `interactions_run` | The instructor ends the class |

`live_classroom_started` counts **classes taught, not consoles opened**.
Reopening or resuming a session that already started does not fire it again.
`pilot_sessions_used` is `1` on a first-ever class, and stops moving once the
instructor is on a paid plan, because the server only meters the free pilot.

### Monetization

| Event | Parameters | Fires when |
| --- | --- | --- |
| `begin_checkout` | `currency`, `value`, `plan_id` | Stripe Checkout is requested |
| `checkout_completed` | — | Returned from Stripe successfully |
| `checkout_abandoned` | — | Returned from Stripe without paying |
| `billing_portal_opened` | — | The Stripe billing portal is opened |
| `purchase` | `transaction_id`, `currency`, `value`, `items` | **Server-side**, from the Stripe webhook |

`checkout_completed` is a funnel signal only. Use `purchase` for revenue.

### Student funnel

| Event | Parameters | Fires when |
| --- | --- | --- |
| `join_started` | `entry_method` | The join form is submitted |
| `join_succeeded` | `join_mode`, `entry_method`, `classroom_kind` | The student gets into a class |
| `join_failed` | `failure_reason`, `entry_method` | The student does not |

`entry_method` distinguishes `qr_link` from `manual_code`, which is how you
learn whether the projector QR code is doing its job.

## Reports to build

### Comparison: exclude students — build this first

**Any marketing report → Add comparison →** Dimension `Visitor type`,
Condition **does not exactly match** `student`. Save it. Apply it to every
acquisition, landing-page, and channel report you look at.

Its mirror, `Visitor type exactly matches student`, is the product view of the
join funnel.

### Funnel: visitor to first class

**Explore → Funnel exploration**, open funnel, with the student comparison
applied:

1. `page_view`
2. `cta_clicked`
3. `sign_up`
4. `session_created`
5. `live_classroom_started`

This is the onboarding funnel that matters. Breakdown by `Session default
channel group` shows which channels bring instructors who actually teach, as
opposed to instructors who merely register. Those are usually different channels,
and the gap is the whole reason for tracking activation separately from signup.

### Funnel: pricing to revenue

1. `page_view` on `/pricing`
2. `pricing_plan_selected`
3. `begin_checkout`
4. `purchase`

A large drop between steps 2 and 3 is a pricing-page or plan-clarity problem. A
drop between 3 and 4 is a price or payment-friction problem. They look identical
without both events, which is why both exist.

### Free-form: which calls to action earn signups

Rows `CTA location` and `CTA label`, values Event count for `cta_clicked`, next
to `sign_up`. Answers whether the hero is pulling its weight or the footer is
quietly doing the work.

### Free-form: content that converts

Rows `Page path`, filtered to begin with `/blog`. Metrics: Views, Average
engagement time, and `sign_up` key event count. Content marketing is worth
continuing only where the third column is non-zero.

### Free-form: join reliability

Student comparison applied. Rows `Failure reason` and `Entry method`, metric
Event count for `join_failed`, against `join_started`. Watch this during
teaching hours: a spike is an incident, not a statistic.

### Audiences worth creating

| Audience | Definition | Use |
| --- | --- | --- |
| Registered, never taught | `sign_up` and not `live_classroom_started` | The activation gap. The onboarding email target. |
| Pilot nearly spent | `pilot_sessions_used >= 4` | The upgrade conversation, before the pilot runs out mid-term. |
| Institution leads | `generate_lead` | Sales follow-up. |
| Active instructors | `live_classroom_started` in last 30 days | The retention denominator. |

## UTM conventions

Lowercase, underscores, no spaces. Consistency matters more than the specific
scheme, because GA4 treats `Newsletter` and `newsletter` as two channels.

| Parameter | Values |
| --- | --- |
| `utm_source` | `linkedin`, `newsletter`, `google`, `partner_<name>` |
| `utm_medium` | `social`, `email`, `cpc`, `referral`, `qr` |
| `utm_campaign` | `<term>_<theme>`, e.g. `2026_spring_pilot` |
| `utm_content` | Which creative or link, e.g. `hero_cta`, `footer_link` |

**Never tag the classroom QR code.** It points at `/join` and would place a live
class inside a marketing campaign. Students are separated by `visitor_type`, not
by campaign.

## Verifying the implementation

With `NEXT_PUBLIC_GA_DEBUG=true`, in **Admin → DebugView**:

- [ ] One `page_view` per navigation, not two. If two, enhanced measurement's
      history-event setting is still on.
- [ ] `page_location` on a `/dashboard/sessions/<id>` page reads
      `/dashboard/sessions/[id]` with no record ID.
- [ ] No event fires at all on `/live/student` or `/live/display`.
- [ ] `/join` sets `visitor_type=student`; the dashboard sets
      `visitor_type=instructor` and a `user_id`.
- [ ] A failed join reports a readable `failure_reason`, not `error`.
- [ ] `live_classroom_started` fires once for a new class, and **not** again
      when the console is reloaded.
- [ ] A Stripe test purchase produces one `purchase` with the right `value` and
      a `session_id` matching the browser session.

## Deliberately not tracked

Recorded here so the absences read as decisions rather than oversights.

- **Individual student responses, votes, wellbeing answers, and questions.**
  Classroom personal data under the institution's control. It is already in
  Firebase, where the instructor and the institution can govern it, and the
  instructor reports are the right place to read it.
- **Anything on the projector display.** A screen is not a user.
- **Raw class codes, student numbers, and display names.** No report needs them,
  and every one of them would be a PDPA disclosure to a new processor.
- **Reading depth inside a case study.** Interesting, but it is student
  behaviour, and answering it in GA4 would mean measuring students in a lesson.
