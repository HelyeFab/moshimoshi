# Subscription & Cancellation Hooks Map (Exploration Summary)

Purpose: Capture the current subscription/cancellation flow and the key hooks/routes/functions a developer should know when working on billing, portals, and entitlement gating. This is a reverse‑engineered snapshot from code exploration.

## Scope

- Client hooks that read subscription state or trigger billing actions
- Next.js API routes for subscription state and portal/checkout sessions
- Firebase Functions webhook and subscription fact writers
- Cache invalidation paths that ensure tier changes propagate

## Subscription Facts (Source of Truth)

Subscription facts live on the user document:

- Firestore: `users/{uid}.subscription`
  - Fields include: `plan`, `status`, `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `metadata.*`

Primary writers are Stripe webhooks (Firebase Functions) that upsert facts into the user doc.

## Client Hooks (Read + Actions)

- `src/hooks/useSubscription.ts`
  - Fetches `GET /api/user/subscription`
  - Computes: `isSubscribed`, `isPremium`, `isFreeTier`, `canUpgrade`, `daysUntilRenewal`
  - Actions:
    - `upgradeToPremium(plan)` → client checkout start
    - `manageBilling()` → portal session
    - `cancelSubscription()` → portal session (cancellation via Stripe portal)
  - Post‑checkout polling: revalidates subscription to catch webhook processing

- `src/hooks/useHasPlan.ts` (in same file)
  - Helper for plan checks (e.g., yearly implies monthly)

- Consumer hooks/components (examples):
  - `src/hooks/useFeature.ts` (entitlement gating)
  - `src/hooks/useEntitlementModal.ts`
  - `src/components/review-engine/EntitlementGate.tsx`
  - `src/components/layout/Navbar.tsx`

## Next.js API Routes (App Router)

- `src/app/api/user/subscription/route.ts`
  - Returns `users/{uid}.subscription` using Admin SDK
  - Defaults to `{ plan: 'free', status: 'active' }` if missing

- `src/app/api/stripe/create-checkout-session/route.ts`
  - Creates Stripe Checkout subscription session
  - Uses session cookie auth (no Firebase token)
  - Handles idempotency via client‑supplied key

- `src/app/api/stripe/create-portal-session/route.ts`
  - Creates Stripe Billing Portal session
  - Used for manage/cancel actions

- `src/app/api/stripe/webhook/route.ts`
  - **Disabled** to prevent duplicate processing
  - Delegates to Firebase Functions webhook

- `src/app/api/auth/invalidate-all-caches/route.ts`
  - Used by webhook flow to invalidate tier/session/entitlements caches

## Firebase Functions (Authoritative Webhook Processing)

- `functions/src/webhook.ts`
  - Main Stripe webhook entrypoint
  - Verifies signature and routes events

- `functions/src/handlers/subscriptions.ts`
  - Handles `customer.subscription.created|updated|deleted`
  - Upserts subscription facts via Firestore helper
  - On delete: reverts to free plan
  - Triggers cache invalidation via Next.js API

- `functions/src/handlers/checkout.ts`
  - Handles `checkout.session.completed`
  - Links Stripe customer ↔ user mapping

- `functions/src/firestore.ts`
  - `upsertUserSubscriptionByCustomerId()`
  - `upsertUserSubscriptionByUid()`
  - `clearUserSubscription()`
  - `getUserSubscription()` / `checkSubscriptionHealth()`

- `functions/src/index.ts`
  - Exports `stripeWebhook`
  - Exports `createCheckoutSession`, `createBillingPortalSession` (public endpoints)
  - Scheduled `syncSubscriptionStatus` (daily reconciliation)

## Cancellation Flow (What Actually Happens)

### User‑initiated cancellation

1) Client calls `useSubscription().cancelSubscription()`
2) This opens Stripe Billing Portal (`/api/stripe/create-portal-session`)
3) Stripe portal processes cancellation
4) Stripe emits webhook(s)
5) Firebase Functions updates Firestore subscription facts
6) Cache invalidation endpoint clears tier/session/entitlement caches
7) Client polling/refresh sees updated subscription state

### Admin‑initiated downgrade/cancel

- `src/app/api/admin/subscriptions/upgrade/route.ts`
  - Can cancel Stripe subscription during downgrade to free
  - Updates Firestore subscription facts to mirror webhook structure

## Cache Invalidation (Tier Changes)

- `functions/src/handlers/subscriptions.ts` → calls Next.js:
  - `POST /api/auth/invalidate-all-caches`

- `src/lib/redis/invalidation/tier-change-handler.ts`
  - Clears tier/session/stats/queue/entitlements/profile caches
  - Logs to Firestore `audit_logs`

## Related Docs / Pointers

- Entitlements overview: `02-PRODUCTION_DOCS/entitlements/README.md`
- Discount system: `02-PRODUCTION_DOCS/payments/discounts/DISCOUNT_SYSTEM.md`

## Quick Debug Checklist

- Confirm webhook is hitting Firebase Functions (Next.js webhook is disabled)
- Verify `users/{uid}.subscription` has correct plan/status
- Check cache invalidation logs if UI doesn’t update
- Use `/api/user/subscription` to confirm server view

