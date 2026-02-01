# Stripe Integration Deep Dive

This document summarizes the current Stripe architecture across the Next.js app and Firebase Functions. It focuses on auth flow, API surfaces, webhook handling, data mapping, and operational concerns.

## High-Level Flow
- Client (`src/hooks/useSubscription.ts`) loads subscription facts from `/api/user/subscription`, drives upgrade/portal actions via `src/lib/stripe/api.ts`, and polls after checkout completion.
- Next API routes create checkout/portal sessions, donation sessions, and expose invoices; webhook handling in the Next app is disabled in favor of Firebase Functions.
- Firebase Functions own production webhooks: they verify signatures, dedupe, log, route to handlers, upsert facts in Firestore, and call back into the Next API to invalidate caches so the UI reflects tier changes quickly.
- Pricing/plan presentation is driven from `src/config/pricing.ts` + `src/lib/stripe/types.ts`; plan resolution for Functions is in `functions/src/mapping/stripeMapping.ts`.

## Next.js App Surface
- `src/app/api/stripe/create-checkout-session/route.ts`: session-authenticated, resolves/creates Stripe customer (uid↔customer mapping in Firestore), builds subscription Checkout with metadata + idempotencyKey, returns redirect URL.
- `src/app/api/stripe/create-portal-session/route.ts`: session-authenticated, opens billing portal for existing customer.
- `src/app/api/stripe/invoices/route.ts`: session-authenticated, fetches invoices for customer, filters out $0/draft, normalizes dates/fields for UI.
- `src/app/api/stripe/donate/route.ts`: optional session, one-off payment Checkout (default $5).
- `src/app/api/stripe/webhook/route.ts`: intentionally disabled (returns message) to avoid duplicate processing—production uses Firebase Functions.
- `src/app/api/user/subscription/route.ts`: reads Firestore with Admin SDK, normalizes `currentPeriodEnd` timestamps, defaults to free on missing/unauth/error.
- `src/app/api/auth/invalidate-all-caches/route.ts`: given `userId` or `stripeCustomerId` (or falls back to session), clears tier/session/stats/entitlements/profile caches via Redis invalidation handler; called by Functions after webhook processing.

## Client Hook & Helpers
- `src/hooks/useSubscription.ts`: SWR-backed subscription facts with fallback to free, derived flags (isSubscribed/isPremium/canUpgrade), checkout status parsing, and polling after success. Actions: `upgradeToPremium` (selects price ID from env), `manageBilling`, `cancelSubscription` (portal redirect).
- `src/lib/stripe/api.ts`: thin POST helper with session cookies, checkout/portal starters with idempotency keys, URL builders and cleanup helpers.
- `src/lib/stripe/server.ts`: lazy Stripe singleton (needs `STRIPE_SECRET_KEY`, apiVersion `2025-08-27.basil`).
- `src/lib/stripe/mapping.ts`: env-driven price→plan mapping for the Next app; logs if `NEXT_PUBLIC_STRIPE_PRICE_*` missing.
- UI: `src/components/subscription/InvoiceHistory.tsx` consumes `/api/stripe/invoices` and renders responsive history; `SubscriptionStatus` (not shown here) uses hook data.

## Firebase Functions (Production Webhook Path)
- Entry `functions/src/webhook.ts`: verifies signature with `STRIPE_WEBHOOK_SECRET`, dedupes (`ops/stripe/processed_events`), logs (`logs/stripe/events`), routes to handlers, marks processed, returns 500 on handler errors to trigger Stripe retry.
- Handlers:
  - Checkout (`functions/src/handlers/checkout.ts`): handles `checkout.session.completed`, maps uid↔customer, extracts price/plan (fallback `DEFAULT_PAID_PLAN`), upserts subscription facts, calls Next cache invalidation; special handling for admin test metadata; placeholder for payment-mode future use.
  - Subscriptions (`functions/src/handlers/subscriptions.ts`): handles `customer.subscription.created/updated/deleted` (and related), normalizes status, extracts price/current period, upserts facts, retries cache invalidation with backoff.
  - Invoices (`functions/src/handlers/invoices.ts`): handles `invoice.payment_succeeded/failed/...`, updates status/metadata, logs success/failure context, and notes TODOs for notifications.
- Shared helpers `functions/src/firestore.ts`: idempotency tracking, event logging, uid↔customer mapping, fact upserts (Timestamp conversion), batch ops, cleanup, health queries.
- Stripe client `functions/src/stripeClient.ts`: singleton with same API version; `functions/src/index.ts` exports webhook, checkout/portal endpoints, scheduled sync (`syncSubscriptionStatus`), and other scheduled jobs.
- Price mapping for Functions (`functions/src/mapping/stripeMapping.ts`): hard-coded test/prod price IDs mapped to plans; differs from env-based mapping used in the Next app (keep in sync when rotating prices).

## Data Model & Mapping
- Firestore user doc subscription facts: `plan`, `status`, optional `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `currentPeriodEnd`, `cancelAtPeriodEnd`, metadata source/update timestamps.
- Bidirectional uid↔customer mapping stored under `stripe/byUid/uidToCustomer` and `stripe/byCustomer/customerToUid`.
- Cache invalidation endpoint accepts either uid or Stripe customer ID and clears multiple Redis-backed caches to avoid stale entitlements.

## Operational Notes / Risks
- Single source of truth for webhooks is Firebase Functions; ensure Stripe dashboard points to the Cloud Functions URL, not Next API.
- API version is pinned to `2025-08-27.basil` everywhere; changing requires updating both Next and Functions clients.
- Price ID divergence: Next app uses env-driven `NEXT_PUBLIC_STRIPE_PRICE_*`; Functions use hard-coded IDs—coordinate updates to avoid mismatches.
- Cache coherence depends on `APP_URL` being reachable from Functions for `invalidate-all-caches`; failures fall back to client polling (SWR in `useSubscription`).
- Session auth uses JWT+Redis with `sameSite: 'lax'` to allow Stripe redirects; all Next Stripe APIs rely on `getSession()`, not Firebase client tokens.

## Local Dev Notes
- Use `start-all-webhooks.sh` to spin up Stripe CLI listeners for ports 3000–3010; add the printed signing secret to `.env.local` if re-enabling local webhook testing.
- Webhook handler inside Next remains disabled; use Stripe CLI forwarding to the Functions URL or re-enable locally with caution to avoid duplicate processing.

## 25% Off First Subscription (Newsletter Cohort)
Goal: apply a 25% discount to a user’s first paid subscription (monthly or yearly), ideally for subscribers of a special newsletter.

Architecture-aligned approach:
- Stripe assets: Create one Coupon (25% off, duration=once, applies to recurring). Create one Promotion Code tied to that coupon (or one per user) with `max_redemptions_per_customer=1`.
- Eligibility storage: In Firestore, map `uid → promotion code data` (e.g., `stripe/discounts/{uid}` with `{promotionCodeId, code, issuedAt, redeemed:false}`). For a shared code, store `{eligible:true}`.
- Checkout integration (Next API): In `src/app/api/stripe/create-checkout-session/route.ts`, after resolving `uid`, check eligibility; if eligible and not redeemed, pass `discounts: [{ promotion_code: <codeId> }]` to `stripe.checkout.sessions.create`. Keep `allow_promotion_codes: true` so users can also type a code.
- Webhook/bookkeeping: In Functions (`checkout` or `subscriptions` handler), on first subscription creation/payment, mark the user’s discount record as `redeemed:true` (or delete) to prevent reuse. Stripe’s per-customer limit also enforces single use.
- Plan mapping: No change; coupon applies to both monthly and yearly prices if configured that way in Stripe.
- UI: Optional—surface the code on pricing/account for newsletter users if you prefer manual entry; otherwise auto-apply via server.

Integration plan:
1) Stripe setup: Create Coupon (25% once) and Promotion Code(s) with per-customer limit; ensure applies to both prices.
2) Data layer: Add Firestore collection `stripe/discounts` (uid → code info) and a server helper to read eligibility.
3) API tweak: Update `create-checkout-session` route to include `discounts` when eligible; keep idempotencyKey and metadata intact.
4) Webhook update: In Functions handlers, mark the discount as redeemed on first successful subscription event/payment.
5) Optional UI: Show the code to eligible users in pricing/account if you want manual entry; otherwise rely on auto-apply.
6) Test: In Stripe test mode, run monthly and yearly checkouts with the code; verify discount on checkout/invoice and that a second attempt does not reapply. Ensure entitlement flow remains unchanged.

## Code Snippets (proposed)
Reference stubs for implementation; adjust paths as you integrate.

### Firestore eligibility helper (Next.js server runtime)
```ts
// src/lib/stripe/discounts.ts
import { adminFirestore } from '@/lib/firebase/admin';

export interface DiscountEligibility {
  promotionCodeId: string;
  code?: string;
  redeemed?: boolean;
}

export async function getDiscountEligibility(uid: string): Promise<DiscountEligibility | null> {
  if (!adminFirestore) return null;
  const snap = await adminFirestore.collection('stripe').doc('discounts').collection('users').doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as DiscountEligibility;
  if (!data || data.redeemed) return null;
  return data;
}

export async function markDiscountRedeemed(uid: string): Promise<void> {
  if (!adminFirestore) return;
  await adminFirestore
    .collection('stripe')
    .doc('discounts')
    .collection('users')
    .doc(uid)
    .set({ redeemed: true, redeemedAt: new Date() }, { merge: true });
}
```

### Apply discount in checkout route
```ts
// src/app/api/stripe/create-checkout-session/route.ts (inside POST handler)
import { getDiscountEligibility } from '@/lib/stripe/discounts';

// ...
const eligibility = await getDiscountEligibility(uid);

const checkoutSession = await stripe.checkout.sessions.create(
  {
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    discounts: eligibility ? [{ promotion_code: eligibility.promotionCodeId }] : undefined,
    subscription_data: { metadata: { uid } },
    metadata: { uid, price_id: priceId },
  },
  { idempotencyKey }
);
```

### Mark discount redeemed in webhook (Functions)
```ts
// functions/src/handlers/subscriptions.ts (after successful upsert)
import { markDiscountRedeemed } from './discounts'; // you can mirror the helper in functions/

// inside handleSubscriptionCreated / handleSubscriptionUpdated when first active subscription detected
try {
  await markDiscountRedeemed(customerId); // mark by uid if you map uid in helper; or accept customerId then resolve uid inside helper
} catch (err) {
  console.warn('Failed to mark discount redeemed', err);
}
```

Example helper for Functions:
```ts
// functions/src/discounts.ts
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getUidByCustomerId } from './firestore';

const db = getFirestore();

export async function markDiscountRedeemed(customerId: string): Promise<void> {
  const uid = await getUidByCustomerId(customerId);
  if (!uid) return;
  await db
    .collection('stripe')
    .doc('discounts')
    .collection('users')
    .doc(uid)
    .set({ redeemed: true, redeemedAt: Timestamp.now() }, { merge: true });
}
```
