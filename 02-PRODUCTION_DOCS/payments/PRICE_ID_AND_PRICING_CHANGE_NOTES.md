# Price ID And Pricing Change Notes

**Status:** ACTIVE
**Created:** 2026-03-24
**Purpose:** Capture the current Stripe price ID setup, where those IDs are stored, current risk assessment, and the safest rollout pattern for future price changes.

## Current Production Price IDs

- Monthly: `price_1S6vKuHdrJomitOw4XuExllV`
- Yearly: `price_1S6vMBHdrJomitOwweaSGhYp`

## Where These IDs Are Recorded

### App env

Recorded in:

- `/home/helye/DevProjects/nextjs/moshimoshi/.env.local`

Current variables:

- `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=price_1S6vKuHdrJomitOw4XuExllV`
- `NEXT_PUBLIC_STRIPE_PRICE_YEARLY=price_1S6vMBHdrJomitOwweaSGhYp`

Used by:

- `src/lib/stripe/mapping.ts`
- `src/config/pricing.ts`
- `src/hooks/useSubscription.ts`
- other app-side pricing/subscription helpers

### Firebase Functions mapping

Also recorded in:

- `functions/src/mapping/stripeMapping.ts`

Current production mapping:

- `const PRICE_MONTHLY_PROD = 'price_1S6vKuHdrJomitOw4XuExllV'`
- `const PRICE_YEARLY_PROD = 'price_1S6vMBHdrJomitOwweaSGhYp'`

These are used by the active Functions code path:

- `functions/src/handlers/checkout.ts`
- `functions/src/handlers/subscriptions.ts`
- `functions/src/index.ts`

## Current Assessment

### Current state

At the moment, app env and Functions mapping match exactly. There is no active production mismatch based on the checked-in workspace and local env file.

### Architecture risk

The risk is future drift, not current drift.

The app reads Stripe price IDs from env variables.

The active Firebase Functions webhook mapping reads them from hardcoded source code.

That means:

- checkout can be updated by changing env
- webhook mapping will not update unless Functions source is also updated and redeployed

### Real failure mode

The most likely failure mode is not total entitlement loss.

In the current Functions code, unknown active prices fall back to a paid default plan:

- `DEFAULT_PAID_PLAN = 'premium_monthly'`

So if prices drift in the future, the likely outcome is:

- new subscription checkouts still succeed
- webhook writes may classify an unknown yearly price as `premium_monthly`
- analytics, admin reporting, and plan labels may become inaccurate
- user access would probably remain paid, but may be mapped to the wrong paid tier

## Free Status Note

There is a real data inconsistency in how "free" users are represented:

- some paths return `plan: free, status: active`
- webhook deletion writes `plan: free, status: canceled`

This does **not** appear to be a major entitlement risk because the main tier resolution logic treats non-active premium states as free.

But it **does** affect:

- admin reporting
- debugging
- canceled-user counts/status displays

So this should be treated as a data consistency issue, not a premium-access issue.

## One-Time Payments / Lifetime Note

Current docs overstate monetization breadth.

The current live web checkout path is subscription-only.

The Functions webhook contains a `payment` mode placeholder, but it is not a full one-time purchase implementation yet.

Implication:

- do not assume one-time payments or lifetime purchases are fully shipped just because the docs mention them

## Can Functions Be Moved To A Non-Hardcoded Config Source?

### Short answer

Yes, but there is no true `0 risk` production change.

### Lowest-risk production approach

Do an additive migration:

1. Add runtime env/param support in Functions
2. Keep current hardcoded IDs as fallback
3. Deploy that additive change
4. Set production runtime values
5. Verify with logs/test webhook
6. Remove hardcoded fallback later, only after confidence is high

### Why not use only `functions/.env`?

In this repo:

- there is no checked-in `functions/.env`
- only `functions/.env.example` exists
- the Functions code already uses Firebase params/secrets for Stripe secrets

So a local `.env` file is fine for emulator/dev, but should not be treated as the only production source of truth.

### Safer target

Prefer runtime env / Firebase params with hardcoded fallback during migration.

Example migration pattern:

```ts
const PRICE_MONTHLY_PROD =
  process.env.STRIPE_PRICE_MONTHLY_PROD || 'price_1S6vKuHdrJomitOw4XuExllV';

const PRICE_YEARLY_PROD =
  process.env.STRIPE_PRICE_YEARLY_PROD || 'price_1S6vMBHdrJomitOwweaSGhYp';
```

That preserves existing behavior if runtime config is missing.

## If Prices Need To Be Lowered

### Short answer

For new checkouts, mostly yes.

For the full production system, not quite.

### What changes for new users

If Stripe gets new lower Price IDs, the app can point checkout at those IDs by updating:

- `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`
- `NEXT_PUBLIC_STRIPE_PRICE_YEARLY`
- likely displayed amounts too:
  - `NEXT_PUBLIC_STRIPE_MONTHLY_AMOUNT`
  - `NEXT_PUBLIC_STRIPE_YEARLY_AMOUNT`

UI display flows through:

- `src/config/pricing.ts`

### What does not happen automatically

Existing subscribers do **not** move to the new Stripe prices just because the app switches IDs.

Stripe prices are separate objects.

That means:

- new checkouts use the new prices
- existing subscriptions stay on the old prices unless migrated in Stripe

### Safe rollout pattern for price reductions

1. Create new lower Stripe prices
2. Update displayed amounts in app config/env
3. Update app checkout to use the new price IDs
4. Update Functions mapping to support both old and new IDs temporarily
5. Decide whether existing subscribers are:
   - grandfathered on old prices, or
   - migrated to new prices
6. Remove old price IDs from mapping only after migration/grandfathering is fully resolved

### Important transition rule

During rollout, Functions should recognize:

- old monthly + new monthly
- old yearly + new yearly

Otherwise webhook events for existing subscriptions may be misclassified.

## Recommended Follow-Up Work

- Update payments docs so tiers/features reflect actual shipped plans
- Add a dedicated "price ID source of truth" note to billing docs
- Migrate Functions price mapping to runtime config with fallback
- Normalize free-tier status semantics across app/admin/webhook paths
- Document a formal rollout checklist for future Stripe price changes
