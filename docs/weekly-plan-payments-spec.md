# Weekly Recurring Plan + Card Management — Spec

## 1. Goal

Add a new **weekly recurring payment plan** (separate from the existing one-time `Plan`/`UserPlan` purchase flow, which stays as-is), plus standalone endpoints for card show / update / retry.

Two weekly tiers, each billed every week for 6 cycles total:

| Tier | Weekly price | Cycles | Total |
|---|---|---|---|
| Single | $33.99 | 6 | $203.94 |
| Family | $49.99 | 6 | $299.94 |

A subscriber can pay off the remaining balance early in one lump sum at any point.

## 2. Non-goals / constraints

- **Do not touch** the existing one-time `startPlan` / `upgradePlan` / `startTrial` flow (`payment.service.ts`, `Plan`, `UserPlan`, `PaymentHistory`). It is a separate product path and stays fully intact.
- No Stripe Customer Portal — all card UI is custom, backed by our own endpoints.
- No changes to `PlanName` enum (`SOLO_EXPLORER`, `FAMILY_PACK`) — the weekly plan is a new, independent concept, not a variant of `Plan`.

## 3. Data model (new entities, new module)

New module: `src/modules/weekly-subscription/`

### 3.1 `WeeklyPlan` (table `weekly_plans`)

Static catalog, seeded once (analogous to `Plan` but separate).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tier` | enum `WeeklyPlanTier` (`SINGLE`, `FAMILY`) | |
| `weeklyPrice` | decimal | 33.99 / 49.99 |
| `totalCycles` | int | 6 |
| `currency` | varchar | `usd` |
| `stripePriceId` | varchar | Stripe recurring weekly Price object |
| `createdAt` | timestamp | |

### 3.2 `WeeklySubscription` (table `weekly_subscriptions`)

One row per user's weekly subscription (a user may only have one active row at a time — enforce via partial unique index on `userId` where `status IN ('active','past_due')`).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid FK → users | |
| `weeklyPlanId` | uuid FK → weekly_plans | |
| `stripeSubscriptionId` | varchar, unique | Stripe `Subscription` id |
| `status` | enum `WeeklySubscriptionStatus`: `active`, `past_due`, `paid_off`, `canceled`, `incomplete` | mirrors Stripe subscription status, plus our own `paid_off` |
| `cyclesPaid` | int, default 0 | incremented on each successful `invoice.payment_succeeded` |
| `totalCycles` | int | copied from plan at creation (immutable even if catalog changes later) |
| `currentPeriodEnd` | timestamp, nullable | from Stripe subscription |
| `startedAt` | timestamp | |
| `paidOffAt` | timestamp, nullable | set when early payoff completes |
| `canceledAt` | timestamp, nullable | |
| `createdAt` / `updatedAt` | timestamp | |

### 3.3 `WeeklyPaymentHistory` (table `weekly_payment_history`)

One row per Stripe invoice/charge attempt against a `WeeklySubscription` (separate table from the existing `PaymentHistory`, which belongs to the one-time flow).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `weeklySubscriptionId` | uuid FK | |
| `stripeInvoiceId` | varchar, unique | |
| `stripePaymentIntentId` | varchar, nullable | |
| `cycleNumber` | int, nullable | 1..6 for regular cycles, null for the payoff/upgrade charge |
| `amount` | decimal | |
| `currency` | varchar | |
| `status` | enum: `succeeded`, `failed`, `pending` | |
| `type` | enum: `cycle`, `payoff`, `upgrade` | distinguishes a regular weekly charge, an early-payoff lump sum, and the solo→family upgrade catch-up charge |
| `fromTier` / `toTier` | enum `WeeklyPlanTier`, nullable | populated only on `type: 'upgrade'` rows (`fromTier: 'SINGLE'`, `toTier: 'FAMILY'`); null otherwise |
| `failureReason` | varchar, nullable | Stripe `last_payment_error.message` when `status = failed` |
| `createdAt` | timestamp | |

### 3.4 `User` entity changes

The existing unused columns (`paymentMethodId`, `cardBrand`, `cardLast4`, `cardExpMonth`, `cardExpYear`, `stripeCustomerId`) are reused as-is for the default payment method — no schema change needed here. They will finally be populated (see §5.3). If a user doesn't yet have `stripeCustomerId`, card endpoints create one lazily, same pattern as `payment.service.ts:91-101`.

## 4. Stripe setup

- Two new **recurring weekly Price** objects in Stripe (interval: `week`, interval_count: `1`), one per tier, referenced by `WeeklyPlan.stripePriceId`. Created via Stripe dashboard/CLI as part of seeding, not at runtime.
- Subscriptions created with `cancel_at` behavior: since Stripe subscriptions are open-ended by default, cap them at 6 cycles by setting Stripe subscription metadata `totalCycles: 6` and **canceling the subscription ourselves** (`stripe.subscriptions.cancel`) once `cyclesPaid === totalCycles`, inside the `invoice.payment_succeeded` handler. (Stripe has no native "N-cycle subscription" primitive.)
- `default_payment_method` set at the Subscription level (and Customer level) so card updates apply to future weekly charges automatically.

## 5. Endpoints

All under `src/modules/weekly-subscription/weekly-subscription.controller.ts`, prefix `/weekly-subscription`, authenticated (Clerk) same as `payment.controller.ts`.

### 5.1 `POST /weekly-subscription/start`

Start a new weekly subscription.

**Body:** `{ tier: 'SINGLE' | 'FAMILY', paymentMethodId?: string }`

- If user already has an `active`/`past_due` `WeeklySubscription`, reject with 409.
- If `paymentMethodId` given, attach it to the Stripe Customer and use as `default_payment_method`; otherwise create the subscription with `payment_behavior: 'default_incomplete'` and return a `client_secret` for the frontend to collect a card (first-time flow), matching how Stripe recommends bootstrapping a subscription's first payment.
- Creates `stripe.subscriptions.create({ customer, items: [{ price: weeklyPlan.stripePriceId }], metadata: { totalCycles: '6', userId, weeklyPlanId } })`.
- Persist `WeeklySubscription` row with `status: 'incomplete'` (flips to `active` on webhook confirmation).
- Response: `{ weeklySubscriptionId, clientSecret? }`.

### 5.2 `POST /weekly-subscription/payoff`

Pay the remaining balance in one lump sum. **Generalized to support paying off at a different (higher) tier than the one the user is currently subscribed to** — this covers all three allowed combinations from §5.2b:

- Solo recurring → solo payoff (`targetTier` omitted, defaults to current tier).
- Solo recurring → family payoff (`targetTier: 'FAMILY'`) — pays off the rest of the term at the family rate in one shot, combining upgrade + payoff into a single charge.
- Family recurring → family payoff only (`targetTier` omitted or `'FAMILY'`) — **no downgrade payoff to solo is allowed**.

**Body:** `{ targetTier?: WeeklyPlanTier }`

- Look up caller's `active`/`past_due` `WeeklySubscription`.
- Compute `remainingCycles = totalCycles - cyclesPaid`; reject 400 if `remainingCycles <= 0`.
- Resolve `payoffPlan = targetTier ? weeklyPlanFor(targetTier) : currentWeeklyPlan`.
- Validate the tier transition: reject 400 if `targetTier === 'SINGLE'` while the current subscription's tier is `'FAMILY'` (no downgrade). Any other combination (same tier, or `SINGLE → FAMILY`) is allowed.
- `remainingAmount = remainingCycles * payoffPlan.weeklyPrice`.
- Charge the Customer's default payment method directly via `stripe.paymentIntents.create({ customer, payment_method: defaultPaymentMethodId, amount: remainingAmount, currency, off_session: true, confirm: true })` — off-session because the customer already has a card on file.
- On success (synchronous confirmation, not webhook-dependent — this is a direct charge, not an invoice): write a `WeeklyPaymentHistory` row (`type: 'payoff'`, `cycleNumber: null`, and if `payoffPlan.tier !== currentTier` also set `fromTier`/`toTier` for visibility in history), set `WeeklySubscription.status = 'paid_off'`, `paidOffAt = now`, `cyclesPaid = totalCycles`, `weeklyPlanId = payoffPlan.id` (so the record reflects the tier actually paid for), then `stripe.subscriptions.cancel(stripeSubscriptionId, { prorate: false })` so no further weekly charges occur.
- On failure (card declined): return 402 with the Stripe decline reason; subscription is untouched, no retry state created (this is a synchronous user-initiated action, not a scheduled charge — the existing retry endpoint below doesn't apply here).

### 5.2a `POST /weekly-subscription/upgrade` — Solo → Family, stays recurring

Upgrades an **active** recurring Solo subscription to recurring Family, charging only the catch-up difference for the weeks remaining in the 6-cycle term, then continuing as a Family-priced recurring subscription (not a payoff — this is the "keep paying weekly, just at the higher tier from now on" path, distinct from §5.2's "pay off the rest of the term in one shot at the higher tier").

- Allowed when `WeeklySubscription.status IN ('active', 'past_due')` (reject 400 otherwise, or if current tier is already `FAMILY`) — upgrading while `past_due` is explicitly supported and **resolves the past-due state**: since the upgrade's off-session PaymentIntent charge succeeding proves the (presumably now-updated) card is chargeable, on success also clear any outstanding `WeeklyPaymentHistory` `failed` rows' relevance by setting `WeeklySubscription.status = 'active'` as part of the same update (in addition to the tier/price swap below).
- Per-week upgrade differential = `familyWeeklyPlan.weeklyPrice - soloWeeklyPlan.weeklyPrice` = `$49.99 - $33.99 = $16.00`. Store it as its own config value, `WEEKLY_UPGRADE_DIFF_PRICE` (= `$16.00`), rather than computing it inline from the two plan rows at call time — this mirrors the existing one-time-flow pattern in `payment.service.ts:118-175` (`upgradePriceId` is a distinct configured Stripe object, not derived on the fly) and lets product tune the upgrade incentive independently of the two base weekly prices later without it silently drifting if either base price changes.
- Compute `remainingCycles = totalCycles - cyclesPaid` (reject 400 if `<= 0` — nothing left to upgrade); `upgradeAmount = remainingCycles * WEEKLY_UPGRADE_DIFF_PRICE`, i.e. the differential is only charged for weeks not yet paid — this is the "adjusted based on when they're upgrading" behavior.
- Charge `upgradeAmount` immediately via the same off-session `paymentIntents.create` pattern as §5.2.
- On success: swap the Stripe subscription's price going forward — `stripe.subscriptions.update(stripeSubscriptionId, { items: [{ id: subscriptionItemId, price: familyWeeklyPlan.stripePriceId }], proration_behavior: 'none' })` (proration disabled because the differential for the remaining term was already collected as a lump sum, so Stripe must not also prorate the current period). Update local `WeeklySubscription.weeklyPlanId = familyWeeklyPlan.id`. Write a `WeeklyPaymentHistory` row (`type: 'upgrade'`, `fromTier: 'SINGLE'`, `toTier: 'FAMILY'`, `amount: upgradeAmount`, `cycleNumber: null`). `cyclesPaid` is untouched — remaining cycles still count down 1-for-1 against `totalCycles`, now charged at the family rate.
- On failure (card declined): return 402; subscription remains Solo, untouched.
- Response: `{ weeklySubscriptionId, amountCharged, newTier: 'FAMILY' }`.

### 5.2b Allowed tier-change combinations (summary)

| From (recurring) | Action | To | Endpoint |
|---|---|---|---|
| Solo | Upgrade, stay recurring | Family (recurring) | `POST /weekly-subscription/upgrade` |
| Solo | Pay off remainder | Solo (paid off) | `POST /weekly-subscription/payoff` (no `targetTier`) |
| Solo | Pay off remainder at higher tier | Family (paid off) | `POST /weekly-subscription/payoff { targetTier: 'FAMILY' }` |
| Family | Pay off remainder | Family (paid off) | `POST /weekly-subscription/payoff` (no `targetTier`, or `{ targetTier: 'FAMILY' }`) |
| Family | — | Solo (any form) | **Not allowed** — no downgrade path, neither recurring nor payoff |
| Solo or Family | Cancel outright (no payoff, no proration) | Canceled | `POST /weekly-subscription/cancel` |

### 5.2c `POST /weekly-subscription/cancel`

Cancels the caller's `active`/`past_due` `WeeklySubscription` outright, with no payoff and no proration — "if a user cancels, then cancels."

- Reject 400 if no `active`/`past_due` `WeeklySubscription` exists.
- `stripe.subscriptions.cancel(stripeSubscriptionId, { prorate: false })` — no refund for the current partially-used cycle, no charge for anything beyond it.
- Set `WeeklySubscription.status = 'canceled'`, `canceledAt = now`. `cyclesPaid` stays at whatever it was — no adjustment.
- Access is lost immediately: per §9, a `canceled` status does not count as a valid `baseDate` source, so modules lock on the user's very next access-status fetch, same as `past_due`.
- Response: `{ weeklySubscriptionId, status: 'canceled' }`.

### 5.3 Card endpoints — `src/modules/payment-method/payment-method.controller.ts` (new, separate module — not under `weekly-subscription` since cards are shared infra, usable for both flows even though only the weekly flow needs retry today)

**`GET /payment-method`** — show current card
- Reads `User.cardBrand/cardLast4/cardExpMonth/cardExpYear`. If empty but `stripeCustomerId` exists, lazily fetch from Stripe (`customers.retrieve` with `expand: ['invoice_settings.default_payment_method']`) and backfill the columns.
- Response: `{ brand, last4, expMonth, expYear } | null`.

**`POST /payment-method`** — update card
- Body: `{ paymentMethodId: string }` (frontend creates the PaymentMethod client-side via Stripe.js/Elements and passes the id — no raw card data touches this backend).
- `stripe.paymentMethods.attach(paymentMethodId, { customer })`.
- `stripe.customers.update(customer, { invoice_settings: { default_payment_method: paymentMethodId } })`.
- If the user has an active `WeeklySubscription`, also `stripe.subscriptions.update(stripeSubscriptionId, { default_payment_method: paymentMethodId })`.
- Update `User` columns (`paymentMethodId`, `cardBrand`, `cardLast4`, `cardExpMonth`, `cardExpYear`) from the attached PaymentMethod's `card` object.
- **Then attempt to retry any outstanding failed payments** (see 5.4) synchronously as part of this request, per the requirement "update card should try previous failed payment(s)".
- Response: `{ brand, last4, expMonth, expYear, retriedPayments: [{ weeklyPaymentHistoryId, status }] }`.

**`POST /payment-method/retry`** — standalone retry endpoint (also callable independently, not just as a side effect of card update)
- Finds the caller's `WeeklyPaymentHistory` rows with `status = 'failed'` for their current `WeeklySubscription`, most recent first.
- For each, since these originate from Stripe **Invoices** (regular weekly cycle failures) rather than direct PaymentIntents, retry via `stripe.invoices.pay(stripeInvoiceId)` using the customer's current default payment method.
- On success: webhook `invoice.payment_succeeded` will fire and update the row/subscription state (see §6) — this endpoint does not mutate DB state itself beyond returning the attempt result, to avoid double-booking with the webhook.
- On failure: return which invoices still failed and why (`last_payment_error.message`).
- Response: `{ attempted: number, succeeded: string[], stillFailing: { invoiceId, reason }[] }`.

## 6. Webhook handling (extend `stripe-webhooks.service.ts`)

New cases needed in the dispatch switch (`stripe.controller.ts`) and handlers in `stripe-webhooks.service.ts`. Route by checking `event.data.object.subscription` (or metadata) to distinguish weekly-subscription events from the existing one-time-payment events — do not change existing case handling.

- **`customer.subscription.created` / `.updated`** → upsert `WeeklySubscription.status` from Stripe's status (`active`, `past_due`, `canceled`, `incomplete`), update `currentPeriodEnd`.
- **`customer.subscription.deleted`** → set `status = 'canceled'`, `canceledAt = now` (covers both our own cancel-on-payoff and cancel-on-6th-cycle, plus manual cancellations from Stripe dashboard).
- **`invoice.payment_succeeded`** (for weekly subscriptions only — check `invoice.subscription` matches a `WeeklySubscription.stripeSubscriptionId`):
  - Upsert `WeeklyPaymentHistory` row (`type: 'cycle'`, `status: 'succeeded'`, `cycleNumber: subscription.cyclesPaid + 1`).
  - Increment `WeeklySubscription.cyclesPaid`.
  - **If the subscription's current `status` is `'past_due'`, flip it back to `'active'`** — this is the "later on if client updates card, the payment should be paid and plan resumed" path: the user (or `/payment-method/retry`) triggers a successful charge on the same weekly Invoice via Stripe (either Stripe's own automatic retry after a card update, or our explicit `stripe.invoices.pay()` call in §5.3), this webhook fires as a normal payment-succeeded event, and resuming `active` here re-unlocks modules on the user's next access-status fetch (§9) with no separate "resume" endpoint needed.
  - If `cyclesPaid === totalCycles`: call `stripe.subscriptions.cancel()`, set `status = 'paid_off'`, `paidOffAt = now` (6th cycle completes the plan — no 7th charge).
- **`invoice.payment_failed`** (weekly subscriptions only):
  - Upsert `WeeklyPaymentHistory` row (`status: 'failed'`, `failureReason` from `invoice.last_finalization_error` or the associated PaymentIntent's `last_payment_error.message`).
  - Set `WeeklySubscription.status = 'past_due'`.
  - This replaces today's no-op `handleInvoicePaymentFailed` for the weekly-subscription case; the existing one-time-payment path through this same event type (if any) is untouched.

Note Stripe itself will auto-retry failed invoice payments a few times per its default retry schedule before finally marking the invoice `uncollectible` — our own `/payment-method/retry` endpoint is an **additional, user-triggered** retry (e.g. right after they update their card), independent of Stripe's automatic retries.

## 7. Edge cases to handle explicitly

- Starting a weekly subscription while one is already `active`/`past_due` → 409 (must cancel/pay off existing one first).
- Payoff attempted with `cyclesPaid === totalCycles` already (nothing left to pay) → 400.
- Card update with no active subscription → still allowed (endpoint doesn't require one), just skips the "update subscription's default_payment_method" step; `retriedPayments` will simply be empty.
- Webhook arrives before our DB row exists (e.g. `invoice.payment_succeeded` for the very first cycle racing the `subscription.created` webhook) → mirror the existing defensive "create stub if missing" pattern already used in `payment.service.ts` for the one-time flow.
- `stripeCustomerId` missing when `/payment-method` is called before any purchase → create the Customer at this point too (not only in `payment.service.ts`), same helper reused across both flows.

## 8. Product decisions (resolved)

1. **Repeated card failures**: `past_due` is not time-boxed — the subscription stays `past_due` indefinitely (relying on Stripe's automatic retry schedule + user-triggered `/payment-method/retry`) until the card is fixed and a payment succeeds, at which point it auto-resumes (§6, §9). No auto-cancel-after-N-failures policy.
2. **Tier switching**: Solo → Family is the only supported direction, covered explicitly by §5.2/§5.2a/§5.2b. Downgrade (Family → Solo) is never allowed, in any form.
3. **Cancellation**: no proration on cancel — if a user cancels, they simply lose access from that point on with no partial refund and no partial charge for the current cycle (§5.2c).
4. **Upgrade while `past_due`**: allowed — upgrading resolves the past-due state, since the upgrade charge succeeding is itself proof the card now works (§5.2a).

## 9. Module locking on no-plan / past-due

Today, module/screen unlocking is computed in `ModulesService.getAccessStatus()` / `getAccessList()` (`src/modules/modules/modules.service.ts:61,263`), which looks up `UserPlan` by `{ userId, isActive: true }` (lines 84-86, 278-280) and derives `baseDate = userPlan?.purchasedAt ?? null` (line 232). If no active `UserPlan` row exists, `baseDate` is `null` and `resolveModuleStatus()` (line 238) locks every module (`unlocked: false, accessible: false`).

The weekly plan must participate in this same check, and a `past_due` weekly subscription must lock modules exactly like "no plan":

- Extend the plan lookup in `getAccessStatus()`/`getAccessList()` to also fetch the user's `WeeklySubscription` (by `userId`).
- Treat the user as having a valid base date if **either**:
  - an active one-time `UserPlan` exists (`isActive: true`, unchanged), **or**
  - a `WeeklySubscription` exists with `status IN ('active', 'paid_off')`.
- A `WeeklySubscription.status IN ('past_due', 'canceled', 'incomplete')` does **not** count — `baseDate` stays `null` (or falls back to the one-time plan's date if that's separately active), and modules lock, same as the current no-plan case.
- `baseDate` for a weekly subscriber = `WeeklySubscription.startedAt` (the date the first cycle succeeded), not `currentPeriodEnd` — module unlock schedules (`MODULE_UNLOCK_DAYS`) run from when access began, same semantics as `purchasedAt` today.
- If a user somehow has both a one-time `UserPlan` and a weekly `WeeklySubscription` (shouldn't normally happen, but not explicitly prevented by this spec), the **earliest** valid `baseDate` between the two wins, so switching from one-time to weekly (or vice versa) never re-locks already-unlocked modules.
- **Resume on card fix**: since lock state is derived live from `WeeklySubscription.status` on every `getAccessStatus()`/`getAccessList()` call rather than cached, no separate "resume" action is needed — once a `past_due` subscription's outstanding invoice is successfully paid (via the user updating their card, `/payment-method/retry`, or Stripe's own automatic retry) and the `invoice.payment_succeeded` webhook flips `status` back to `'active'` (§6), the very next access-status fetch sees `baseDate` populated again and modules unlock exactly as if nothing had happened — `startedAt` is unchanged, so the original unlock schedule (not a fresh one) resumes.
- No new guard/interceptor needed — this fits the existing pattern where `ModulesService` computes lock state and the frontend gates on the returned `AccessStatus`/`AccessList` payload, so a `past_due` subscription immediately re-locks content the next time the frontend fetches access status (e.g. right after the `invoice.payment_failed` webhook flips `WeeklySubscription.status` to `past_due`, per §6).
- `FREE_ACCESS_EMAILS` bypass (constants file, line 41) is unaffected — continues to skip plan checks entirely regardless of weekly-subscription state.

## 10. Payment history — unified view across one-time and weekly

The existing `PaymentHistory` (one-time flow) and new `WeeklyPaymentHistory` (§3.3) remain **separate tables** — different lifecycles, different foreign keys, and the one-time flow must stay untouched per §2. But the user-facing "Payment History" screen (currently backed by `GET /payment/history`, consumed by `payment.history` in `useApi.ts`, rendered in `app/(main)/(dashboard)/panel/subscription/page.tsx`) needs to show **both** kinds of payment in one list, distinguishing:

- **Payment type**: `one_time` vs `weekly_recurring`.
- For `weekly_recurring` rows specifically: **which cycle/week** the payment was for (`week 1` … `week 6`), or that it was the **early payoff** of the remaining balance.

### 10.1 Backend: `GET /payment/history` response change

Extend the existing endpoint (`payment.controller.ts` — do not add a second endpoint, since the frontend already has one history view) to merge both sources server-side and return a single ordered list (by `createdAt` desc):

```ts
interface PaymentHistoryItem {
  id: string;
  type: 'one_time' | 'weekly_recurring';
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending' | 'processing';
  createdAt: string;
  invoicePdfUrl: string | null;
  planName: string | null;        // e.g. "SOLO_EXPLORER" / "FAMILY_PACK" for one_time rows
  weeklyTier: WeeklyPlanTier | null;   // "SINGLE" / "FAMILY" for weekly_recurring rows
  cycleNumber: number | null;     // 1-6 for a regular weekly charge, null for one_time, payoff, and upgrade rows
  isPayoff: boolean;              // true only for the lump-sum early-payoff charge
  isUpgrade: boolean;             // true only for the solo→family recurring upgrade catch-up charge
  upgradeFromTier: WeeklyPlanTier | null; // "SINGLE" when isUpgrade is true, else null
}
```

- `type: 'one_time'` rows map straight from the existing `PaymentHistory` table (`planId` → `planName`, existing `status`/`amount`/`invoicePdfUrl`/`createdAt` fields unchanged).
- `type: 'weekly_recurring'` rows map from `WeeklyPaymentHistory` (§3.3): `cycleNumber` copied directly (`1..6`, or `null` for `type: 'payoff'`/`'upgrade'`), `isPayoff = (type === 'payoff')`, `isUpgrade = (type === 'upgrade')`, `upgradeFromTier = row.fromTier`, `weeklyTier` from the joined `WeeklySubscription.weeklyPlan.tier` (for a payoff-to-higher-tier row, this reflects `toTier` since `WeeklySubscription.weeklyPlanId` is updated to the paid-off tier per §5.2).
- Implementation: `PaymentService.getHistory()` fetches both tables for the user, maps each to `PaymentHistoryItem`, concatenates, sorts by `createdAt` desc. Keep this a simple in-memory merge (both tables are small per-user) rather than a SQL UNION, to avoid coupling the two otherwise-independent tables at the query layer.

### 10.2 Frontend: `useApi`/type changes for history

- `lib/api/types.ts`: replace/extend the existing `PaymentHistory` type with the `PaymentHistoryItem` shape above (or add it as a new exported type if call sites need a transition period — recommend a straight rename since there's only one consumer, the subscription page's history tab).
- `apiSlice.ts`'s existing `getPaymentHistory` endpoint (`GET /payment/history`) keeps its URL and RTK tag (`"PaymentHistory"`) — only its response type changes to `PaymentHistoryItem[]`. No new endpoint needed; this reuses the merge done server-side in §10.1.
- No new mutation/query wiring needed in `useApi.ts` beyond updating the type parameter on the existing `payment.history` query result.

## 11. Frontend `useApi` changes (busy-brains-frontend)

Scope note: this section covers only the API-layer wiring (`lib/api/apiSlice.ts`, `lib/api/useApi.ts`, `lib/api/types.ts`) — no UI components. It follows the existing conventions found in the frontend repo: RTK Query endpoints centralized in `apiSlice.ts` under a `// --- Domain ---` comment block, response/shared types in `lib/api/types.ts`, consumer-facing hooks composed in `useApi.ts`'s namespaced return object, docs updated in `lib/api/USE_API.md`. The existing `payment` namespace (`startTrial`, `startPlan`, `upgradePlan`, `payment.history`) is untouched — these additions are new, sibling namespaces.

**Important existing-code note:** `apiSlice.ts` already defines a `savePaymentMethod` mutation (`POST /payment/save-payment-method`, body `{ paymentMethodId: string }` → `{ success: boolean }`) and it's wired into `useApi.ts`'s `payment` namespace, but **no such endpoint exists in the backend today** (only `start-trial`, `start-plan`, `upgrade-plan`, `history` were found under `payment.controller.ts`) and no UI calls it. Decide during implementation whether to repurpose this pre-existing mutation for the new `POST /payment-method` endpoint (rename path client-side) or leave it dead and add a fresh one — recommend **repurposing it** since the request/response shape already matches closely, to avoid two near-duplicate mutations.

### 9.1 New types — `lib/api/types.ts`

Add a `// ---- Weekly Subscription ----` section:

```ts
export type WeeklyPlanTier = "SINGLE" | "FAMILY";

export interface WeeklyPlan {
  id: string;
  tier: WeeklyPlanTier;
  weeklyPrice: number;
  totalCycles: number;
  currency: string;
}

export type WeeklySubscriptionStatus =
  | "active"
  | "past_due"
  | "paid_off"
  | "canceled"
  | "incomplete";

export interface WeeklySubscription {
  id: string;
  weeklyPlanId: string;
  status: WeeklySubscriptionStatus;
  cyclesPaid: number;
  totalCycles: number;
  currentPeriodEnd: string | null;
  startedAt: string;
  paidOffAt: string | null;
  canceledAt: string | null;
}

export interface StartWeeklySubscriptionResponse {
  weeklySubscriptionId: string;
  clientSecret?: string;
}

export interface WeeklyPayoffResponse {
  weeklySubscriptionId: string;
  amountCharged: number;
  status: "paid_off";
}
```

Add a `// ---- Payment Method ----` section (shared by both the one-time and weekly flows, per the spec's card endpoints in §5.3):

```ts
export interface PaymentMethodInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface RetriedPaymentResult {
  weeklyPaymentHistoryId: string;
  status: "succeeded" | "failed";
}

export interface UpdatePaymentMethodResponse extends PaymentMethodInfo {
  retriedPayments: RetriedPaymentResult[];
}

export interface RetryPaymentsResponse {
  attempted: number;
  succeeded: string[];
  stillFailing: { invoiceId: string; reason: string }[];
}
```

### 9.2 New endpoints — `lib/api/apiSlice.ts`

Add under a new `// --- Weekly Subscription ---` block (near the existing `// --- Payment ---` block):

```ts
getWeeklySubscription: builder.query<WeeklySubscription | null, void>({
  query: () => ({ url: "/weekly-subscription", method: "GET" }),
  providesTags: ["WeeklySubscription"],
}),

startWeeklySubscription: builder.mutation<
  StartWeeklySubscriptionResponse,
  { tier: WeeklyPlanTier; paymentMethodId?: string }
>({
  query: (body) => ({ url: "/weekly-subscription/start", method: "POST", data: body }),
  invalidatesTags: ["WeeklySubscription", "User"],
}),

payoffWeeklySubscription: builder.mutation<WeeklyPayoffResponse, void>({
  query: () => ({ url: "/weekly-subscription/payoff", method: "POST" }),
  invalidatesTags: ["WeeklySubscription", "User"],
}),
```

Add under a new `// --- Payment Method ---` block:

```ts
getPaymentMethod: builder.query<PaymentMethodInfo | null, void>({
  query: () => ({ url: "/payment-method", method: "GET" }),
  providesTags: ["PaymentMethod"],
}),

updatePaymentMethod: builder.mutation<UpdatePaymentMethodResponse, { paymentMethodId: string }>({
  query: (body) => ({ url: "/payment-method", method: "POST", data: body }),
  invalidatesTags: ["PaymentMethod", "User", "WeeklySubscription"],
}),

retryFailedPayments: builder.mutation<RetryPaymentsResponse, void>({
  query: () => ({ url: "/payment-method/retry", method: "POST" }),
  invalidatesTags: ["WeeklySubscription"],
}),
```

Add `"WeeklySubscription"` and `"PaymentMethod"` to the `tagTypes` array passed to `createApi({...})`.

### 9.3 `useApi.ts` wiring

Add two new namespaces to the object `useApi()` returns, following the existing `payment` namespace pattern (query result unwrapped to `{ data, isLoading, error, refetch }`, mutations unwrapped via `.unwrap()` into an async `trigger` function plus a `xLoading` flag):

- `weeklySubscription`: `{ current, isLoading, refetch, start(args), startLoading, payoff(), payoffLoading }`
- `paymentMethod`: `{ current, isLoading, refetch, update(args), updateLoading, retry(), retryLoading }`

### 9.4 Docs

Update `lib/api/USE_API.md` with usage examples for `weeklySubscription` and `paymentMethod`, mirroring the existing `payment` section's documentation style.
