# Pre-Launch Waitlist & 25% Discount Implementation

> **Status**: ✅ FULLY TESTED & PRODUCTION READY
> **Last Updated**: January 2, 2026
> **Launch Date**: January 23rd, 2026 at 00:00 GMT
> **Test Checkout**: Successfully completed with 25% discount auto-applied

---

## Executive Summary

This document tracks the implementation of a pre-launch marketing campaign for Moshimoshi. The app is "locked" until January 23rd, 2026. Users who join the waitlist before launch receive a 25% discount on their first Premium subscription, auto-applied at checkout.

---

## Business Requirements

1. **Lock the app** until January 23rd, 2026
2. **Collect emails** from interested users via a waitlist
3. **Grant 25% discount** to waitlist users when they sign up after launch
4. **Auto-apply discount** at Stripe checkout (Option A - no manual promo code entry)
5. **Lock toggle** via environment variable for testing purposes

---

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Lock Screen Style | Modified landing page | Keep existing design, add waitlist CTA |
| Public Pages During Lock | Lock everything | All routes redirect to `/` or `/waitlist` |
| Launch Timezone | Midnight UK (GMT) | `2026-01-23T00:00:00Z` |
| Discount Application | Option A (Auto-apply only) | Seamless UX, no code sharing risk |
| Email Storage | Firestore only | Simple, no external email service needed |
| Lock Toggle | Environment variable | `PRELAUNCH_LOCK_ENABLED=false` bypasses lock |
| i18n | Full 6-locale support | en, it, ja, de, fr, es |

---

## Stripe Configuration

**Already Created in Stripe Dashboard:**

| Item | Value |
|------|-------|
| Coupon Name | `PRELAUNCH25` |
| Coupon Type | 25% off, once (first invoice only) |
| Promotion Code | `MOSHI25` |
| Promotion Code ID | `promo_1SedzAHdrJomitOw2FAmRlXc` |
| Restrictions | First-time orders only |

**Environment Variables:**

```bash
# Stripe discount configuration
PRELAUNCH_PROMO_CODE_ID=promo_1SedzAHdrJomitOw2FAmRlXc
PRELAUNCH_PROMO_CODE=MOSHI25

# Launch date (ISO 8601 format)
LAUNCH_DATE=2026-01-23T00:00:00Z
NEXT_PUBLIC_LAUNCH_DATE=2026-01-23T00:00:00Z

# Lock toggle (set to 'false' to bypass lock for testing)
PRELAUNCH_LOCK_ENABLED=true                    # Server-side
NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED=true        # Client-side
```

**Vercel Environment Configuration:**

| Environment | PRELAUNCH_LOCK_ENABLED | Effect |
|-------------|------------------------|--------|
| Production | `true` | App is locked, shows waitlist |
| Preview | `false` | App unlocked for testing |
| Development | `false` | App unlocked for testing |

---

## Implementation Progress

### ✅ ALL STEPS COMPLETED

#### Step 1: Stripe Dashboard Setup
- Created coupon `PRELAUNCH25` (25% off, once)
- Created promotion code `MOSHI25` with first-time order restriction
- Added environment variables to `.env.local` and Vercel

#### Step 2: Waitlist API
**File**: `src/app/api/waitlist/join/route.ts`

- POST endpoint to join waitlist
- Email validation with Zod
- Duplicate handling (returns success without revealing if email exists)
- GET endpoint to check waitlist count (admin/debug)

**Firestore Schema** (`waitlist/{document-id}`):
```typescript
{
  email: string,              // lowercase, trimmed
  joinedAt: Timestamp,
  source: "pre_launch_2025",
  linkedUid: string | null,   // Firebase UID after signup
  linkedAt: Timestamp | null,
  discountGranted: boolean,
}
```

#### Step 3: Waitlist Page + Components
**Files Created**:
- `src/components/waitlist/CountdownTimer.tsx` - Live countdown to launch
- `src/components/waitlist/WaitlistForm.tsx` - Email signup form with full i18n
- `src/app/[locale]/waitlist/page.tsx` - Full waitlist page

**Features**:
- Japanese aesthetic styling (matches blog page)
- Responsive design (1 col mobile, 2 col sm, 3 col md+)
- Success state with clear messaging about free tier + Premium discount
- Countdown timer with days/hours/mins/secs
- Full i18n support (6 locales)
- Bottom navbar hidden on waitlist page

#### Step 4: Landing Page Pre-Launch Mode
**File Modified**: `src/app/[locale]/(home)/LandingPageClient.tsx`

**Changes**:
- Added `usePreLaunch` hook import
- Desktop nav: Shows "Join Waitlist" button + "Jan 23rd" badge when locked
- Mobile menu: Shows waitlist CTA when locked
- Hero section: Shows pre-launch badge + countdown timer when locked
- Hero CTA: Links to `/waitlist` instead of `/auth/signup` when locked

**Supporting Files Created**:
- `src/hooks/usePreLaunch.ts` - Client-side hook with lock toggle support
- `src/lib/prelaunch/config.ts` - Pre-launch configuration utilities

#### Step 5: Middleware Lock Logic
**File Modified**: `src/middleware.ts`

**Changes**:
- Added `LAUNCH_DATE` constant from env var
- Added `PRE_LAUNCH_ALLOWED_ROUTES` list
- Added `isPreLaunchMode()` function with lock toggle check
- Added `isAllowedDuringPreLaunch()` function
- Added lock check before admin/protected route checks
- **Bypass**: Logged-in users (with session cookie) can bypass lock

**Allowed Routes During Lock**:
- `/` (landing page with pre-launch mode)
- `/waitlist`
- `/terms`
- `/privacy`
- `/about`

#### Step 6: Discount Helper
**File Created**: `src/lib/stripe/discounts.ts`

**Functions**:
- `getDiscountEligibility(uid)` - Check if user is eligible for discount
- `markDiscountRedeemed(uid, subscriptionId?)` - Mark discount as used
- `createDiscountEligibility(uid, email, source)` - Create eligibility record

**Firestore Schema** (`stripe/discounts/users/{uid}`):
```typescript
{
  eligible: boolean,
  promotionCodeId: string,
  source: string,
  waitlistEmail: string,
  grantedAt: Timestamp,
  redeemed: boolean,
  redeemedAt: Timestamp | null,
  redeemedSubscriptionId?: string,
}
```

#### Step 7: Link Waitlist to Signup
**File Created**: `src/lib/waitlist/linkWaitlist.ts`

**Function**: `linkWaitlistToUser(email, uid)`
- Queries waitlist by email (lowercase)
- Updates waitlist doc with `linkedUid` and `linkedAt`
- Calls `createDiscountEligibility()` to grant discount

**Files Modified**:
- `src/app/api/auth/signup/route.ts` - Added import and call to `linkWaitlistToUser`
- `src/app/api/auth/google/route.ts` - Added import and call to `linkWaitlistToUser`

#### Step 8: Modify Checkout for Auto-Apply Discount
**File**: `src/app/api/stripe/create-checkout-session/route.ts`

**Implementation**:
- Import `getDiscountEligibility` from `@/lib/stripe/discounts`
- Calls `getDiscountEligibility(uid)` and logs eligibility
- Sets `allow_promotion_codes: false` (Option A)
- Adds `discounts` array with promotion code if eligible
- Adds `discount_applied` and `discount_source` metadata to both session and subscription_data

#### Step 9: Update Webhook to Mark Discount Redeemed
**File**: `functions/src/firestore.ts` (added `markDiscountRedeemedByCustomerId`)
**File**: `functions/src/handlers/checkout.ts`

**Implementation**:
- Added `markDiscountRedeemedByCustomerId()` function to `firestore.ts` (follows existing patterns)
- Checkout handler imports from `../firestore`
- Checks `session.metadata?.discount_applied === 'true'` and calls the function
- Non-critical error handling (doesn't fail checkout if discount marking fails)

#### Step 10: Localization
**Files Modified**: All locale string files
- `src/i18n/locales/en/strings.ts`
- `src/i18n/locales/it/strings.ts`
- `src/i18n/locales/ja/strings.ts`
- `src/i18n/locales/de/strings.ts`
- `src/i18n/locales/fr/strings.ts`
- `src/i18n/locales/es/strings.ts`

**Added Strings**:
- `waitlist.form.*` - Form placeholders, buttons, errors, success messages
- `landing.hero.preLaunch.*` - Pre-launch badges and hero text
- Updated subtitle to clarify: "Free to use...25% off Premium if you decide to upgrade"

#### Step 11: Helper Script
**File Created**: `scripts/update-launch-date.js`

**Usage**:
```bash
node scripts/update-launch-date.js 2026-01-16
```

Updates all hardcoded date strings across:
- `src/lib/prelaunch/config.ts` (DEFAULT_LAUNCH_DATE)
- All 6 locale files (badge strings)

---

## Testing Checklist

| # | Test Case | Status |
|---|-----------|--------|
| 1 | Waitlist signup stores email correctly | ✅ Verified |
| 2 | Duplicate emails handled gracefully | ✅ Verified |
| 3 | Landing page shows pre-launch mode | ✅ Verified |
| 4 | Non-allowed routes redirect to landing | ✅ Verified |
| 5 | `/waitlist` page is accessible during lock | ✅ Verified |
| 6 | Lock toggle bypasses lock when `false` | ✅ Verified |
| 7 | Logged-in users bypass lock | ✅ Verified |
| 8 | Waitlist → User linking creates eligibility | ✅ Verified |
| 9 | Checkout auto-applies 25% for eligible users | ✅ Verified (Dec 15, 2025) |
| 10 | Checkout shows full price for non-eligible users | ✅ Verified (no discount field shown) |
| 11 | Webhook marks discount as redeemed | ✅ Verified (redeemedAt: 2025-12-15T17:35:59Z) |
| 12 | Second subscription doesn't re-apply discount | ✅ Verified (redeemed=true prevents re-use)

**Test Account**: emmanuelfabiani@yahoo.com (UID: bPhnM9Lmy2ToZXAScBl120zfxkL2)

---

## File Summary

### Files Created (10 new files)
| File | Purpose |
|------|---------|
| `src/app/api/waitlist/join/route.ts` | Waitlist signup API |
| `src/app/[locale]/waitlist/page.tsx` | Waitlist page |
| `src/components/waitlist/CountdownTimer.tsx` | Countdown component |
| `src/components/waitlist/WaitlistForm.tsx` | Email form component (with i18n) |
| `src/hooks/usePreLaunch.ts` | Pre-launch status hook (with lock toggle) |
| `src/lib/prelaunch/config.ts` | Pre-launch config utilities |
| `src/lib/stripe/discounts.ts` | Discount eligibility helper |
| `src/lib/waitlist/linkWaitlist.ts` | Waitlist-to-user linking |
| `scripts/update-launch-date.js` | Helper to update launch date strings |
| `scripts/check-discount-eligibility.js` | Debug script to check user discount status |

### Files Modified (10 files)
| File | Changes |
|------|---------|
| `.env.local` | Added promo code ID, launch date, lock toggle |
| `src/middleware.ts` | Added pre-launch lock logic with toggle |
| `src/app/[locale]/(home)/LandingPageClient.tsx` | Added pre-launch mode UI |
| `src/app/api/auth/signup/route.ts` | Added waitlist linking call |
| `src/app/api/auth/google/route.ts` | Added waitlist linking call |
| `src/app/api/stripe/create-checkout-session/route.ts` | Added auto-apply discount logic |
| `src/components/layout/BottomNav.tsx` | Hide navbar on `/waitlist` |
| `functions/src/firestore.ts` | Added `markDiscountRedeemedByCustomerId` |
| `functions/src/handlers/checkout.ts` | Added discount redemption call |
| `src/i18n/locales/*/strings.ts` | Added waitlist i18n strings (6 files) |

---

## Data Flow Diagram

```
PRE-LAUNCH FLOW:
================

User visits moshimoshi.app
        │
        ▼
Middleware checks:
  1. PRELAUNCH_LOCK_ENABLED == 'false'? → Skip lock
  2. User has session cookie? → Skip lock (logged-in bypass)
  3. new Date() < LAUNCH_DATE? → Apply lock
        │
        ├─── LOCKED ─────────────────────────────────────────┐
        │                                                     │
        ▼                                                     ▼
Is route allowed?                                    Redirect to /
(/waitlist, /terms, etc.)                            (Landing page)
        │                                                     │
        ├─── YES ──► Continue to page                         │
        │                                                     ▼
        └─── NO ───► Redirect to /               Landing shows:
                                                  - Pre-launch badge
                                                  - Countdown timer
                                                  - "Join Waitlist" CTA
                                                          │
                                                          ▼
                                                  User clicks waitlist
                                                          │
                                                          ▼
                                                  /waitlist page
                                                          │
                                                          ▼
                                                  User enters email
                                                          │
                                                          ▼
                                                  POST /api/waitlist/join
                                                          │
                                                          ▼
                                                  Firestore: waitlist/{id}
                                                  {
                                                    email: "user@example.com",
                                                    joinedAt: now,
                                                    linkedUid: null
                                                  }


POST-LAUNCH FLOW:
=================

User signs up (email/password or Google)
        │
        ▼
Auth API creates user profile
        │
        ▼
linkWaitlistToUser(email, uid)
        │
        ▼
Query: waitlist where email == user's email
        │
        ├─── NOT FOUND ──► Return (no discount)
        │
        └─── FOUND ──► Update waitlist doc with uid
                              │
                              ▼
                       Create discount eligibility:
                       stripe/discounts/users/{uid}
                       {
                         eligible: true,
                         promotionCodeId: "promo_xxx",
                         redeemed: false
                       }


CHECKOUT FLOW:
==============

User clicks "Subscribe"
        │
        ▼
POST /api/stripe/create-checkout-session
        │
        ▼
getDiscountEligibility(uid)
        │
        ├─── NULL ──► Create session WITHOUT discount
        │             allow_promotion_codes: false
        │
        └─── ELIGIBLE ──► Create session WITH discount
                          discounts: [{ promotion_code: "promo_xxx" }]
                          allow_promotion_codes: false
                          metadata: { discount_applied: "true" }
                                    │
                                    ▼
                          Stripe Checkout shows:
                          "Subtotal: £8.99"
                          "MOSHI25: -£2.25"
                          "Total: £6.74"


WEBHOOK FLOW:
=============

Stripe sends checkout.session.completed
        │
        ▼
Firebase Function: applyCheckoutCompleted()
        │
        ▼
Check metadata: discount_applied == 'true'?
        │
        ├─── NO ──► Continue normal flow
        │
        └─── YES ──► markDiscountRedeemedByCustomerId()
                              │
                              ▼
                     Update: stripe/discounts/users/{uid}
                     {
                       redeemed: true,
                       redeemedAt: now,
                       redeemedSubscriptionId: "sub_xxx"
                     }
```

---

## Lock Toggle Quick Reference

**To disable lock for testing:**

```bash
# .env.local (local development)
PRELAUNCH_LOCK_ENABLED=false
NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED=false
```

**To enable lock for production:**
```bash
# Vercel Production Environment
PRELAUNCH_LOCK_ENABLED=true
NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED=true
```

**Vercel CLI commands used:**
```bash
vercel env add PRELAUNCH_LOCK_ENABLED production
vercel env add NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED production
vercel env add PRELAUNCH_LOCK_ENABLED preview
vercel env add NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED preview
vercel env add PRELAUNCH_LOCK_ENABLED development
vercel env add NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED development
```

---

## Notes & Gotchas

1. **Stripe Limitation**: Cannot use both `allow_promotion_codes` AND `discounts` array in the same request - even with `allow_promotion_codes: false`. Solution: Use spread operator to conditionally include only one parameter.

2. **Launch Date Timezone**: Uses `2026-01-23T00:00:00Z` (UTC/GMT). UK is on GMT in winter.

3. **Waitlist Linking is Non-Blocking**: If `linkWaitlistToUser` fails, signup continues. Discount is a bonus, not critical path.

4. **Duplicate Email Handling**: Returns success message even if email already on waitlist (privacy - don't reveal if email exists).

5. **Logged-in User Bypass**: Users with a valid session cookie can access the full app even during pre-launch lock (useful for developer testing).

6. **Lock Toggle**: Set `PRELAUNCH_LOCK_ENABLED=false` to bypass the lock entirely, regardless of date.

7. **Firebase Functions**: Discount marking is in `functions/src/firestore.ts` (not a separate file) to follow existing patterns.

8. **i18n**: All user-facing strings are localized in 6 languages. Use `scripts/update-launch-date.js` to update date strings.

9. **Debug Scripts**:
   - `scripts/check-discount-eligibility.js [email]` - Check a user's discount status
   - Run from `functions/` directory: `cd functions && node ../scripts/check-discount-eligibility.js`

---

## Related Documentation

- `/01_PRODUCTION_DOCS/STRIPE_ARCHITECTURE_EXPERT_REPORT.md` - Full Stripe integration docs
- `/01_PRODUCTION_DOCS/STRIPE_STRIPE_INTEGRATION_OVERVIEW.md` - Stripe overview
- `/.claude/plans/validated-wibbling-garden.md` - Original plan file

---

*Document created: December 15, 2025*
*Last updated: December 15, 2025*
*For questions, refer to the git history or the plan file.*
