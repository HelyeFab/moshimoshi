# Pre-Launch Waitlist & 25% Discount Implementation

> **Status**: IMPLEMENTATION COMPLETE - Ready for Testing (Step 10)
> **Last Updated**: December 15, 2025
> **Launch Date**: December 31st, 2025 at 00:00 GMT

---

## Executive Summary

This document tracks the implementation of a pre-launch marketing campaign for Moshimoshi. The app is "locked" until December 31st, 2025. Users who join the waitlist before launch receive a 25% discount on their first subscription, auto-applied at checkout.

---

## Business Requirements

1. **Lock the app** until December 31st, 2025
2. **Collect emails** from interested users via a waitlist
3. **Grant 25% discount** to waitlist users when they sign up after launch
4. **Auto-apply discount** at Stripe checkout (Option A - no manual promo code entry)

---

## Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Lock Screen Style | Modified landing page | Keep existing design, add waitlist CTA |
| Public Pages During Lock | Lock everything | All routes redirect to `/` or `/waitlist` |
| Launch Timezone | Midnight UK (GMT) | `2025-12-31T00:00:00Z` |
| Discount Application | Option A (Auto-apply only) | Seamless UX, no code sharing risk |
| Email Storage | Firestore only | Simple, no external email service needed |

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

**Environment Variables Added** (`.env.local`):
```bash
PRELAUNCH_PROMO_CODE_ID=promo_1SedzAHdrJomitOw2FAmRlXc
PRELAUNCH_PROMO_CODE=MOSHI25
LAUNCH_DATE=2025-12-31T00:00:00Z
```

---

## Implementation Progress

### ✅ COMPLETED

#### Step 1: Stripe Dashboard Setup
- Created coupon `PRELAUNCH25` (25% off, once)
- Created promotion code `MOSHI25` with first-time order restriction
- Added environment variables to `.env.local`

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
- `src/components/waitlist/WaitlistForm.tsx` - Email signup form
- `src/app/[locale]/waitlist/page.tsx` - Full waitlist page

**Features**:
- Japanese aesthetic styling (matches blog page)
- Responsive design (mobile-first)
- Success state with explanation of discount
- Countdown timer with days/hours/mins/secs

#### Step 4: Landing Page Pre-Launch Mode
**File Modified**: `src/app/[locale]/(home)/LandingPageClient.tsx`

**Changes**:
- Added `usePreLaunch` hook import
- Desktop nav: Shows "Join Waitlist" button + "Dec 31st" badge when locked
- Mobile menu: Shows waitlist CTA when locked
- Hero section: Shows pre-launch badge + countdown timer when locked
- Hero CTA: Links to `/waitlist` instead of `/auth/signup` when locked

**Supporting Files Created**:
- `src/hooks/usePreLaunch.ts` - Client-side hook for pre-launch status
- `src/lib/prelaunch/config.ts` - Pre-launch configuration utilities

#### Step 5: Middleware Lock Logic
**File Modified**: `src/middleware.ts`

**Changes**:
- Added `LAUNCH_DATE` constant
- Added `PRE_LAUNCH_ALLOWED_ROUTES` list
- Added `isPreLaunchMode()` function
- Added `isAllowedDuringPreLaunch()` function
- Added lock check before admin/protected route checks

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

**Status**: ✅ COMPLETE

**Implementation**:
- Line 7: Added import `getDiscountEligibility`
- Lines 74-80: Calls `getDiscountEligibility(uid)` and logs eligibility
- Lines 97-101: Sets `allow_promotion_codes: false` (Option A) and adds `discounts` array
- Lines 103-115: Adds `discount_applied` and `discount_source` metadata to both session and subscription_data

#### Step 9: Update Webhook to Mark Discount Redeemed
**File**: `functions/src/handlers/checkout.ts`

**Status**: ✅ COMPLETE

**Implementation**:
- Created `functions/src/discounts.ts` with `markDiscountRedeemedByCustomerId()` function
- Line 18: Added import in checkout handler
- Lines 188-198: Checks `session.metadata?.discount_applied === 'true'` and calls the function
- Non-critical error handling (doesn't fail checkout if discount marking fails)

---

### ⏳ PENDING

#### Step 10: Testing
**Test Cases**:
1. [ ] Waitlist signup stores email correctly in Firestore
2. [ ] Duplicate emails handled gracefully (no error shown)
3. [ ] Landing page shows pre-launch mode (badge, countdown, waitlist CTA)
4. [ ] Non-allowed routes redirect to landing page
5. [ ] `/waitlist` page is accessible during lock
6. [ ] After "launch" (change date), normal app behavior resumes
7. [ ] User signs up with waitlist email → discount eligibility created
8. [ ] User signs up with non-waitlist email → no discount eligibility
9. [ ] Checkout auto-applies 25% for eligible users
10. [ ] Checkout shows full price for non-eligible users
11. [ ] Webhook marks discount as redeemed after successful subscription
12. [ ] Second subscription attempt doesn't re-apply discount

---

## File Summary

### Files Created (8 new files)
| File | Purpose |
|------|---------|
| `src/app/api/waitlist/join/route.ts` | Waitlist signup API |
| `src/app/[locale]/waitlist/page.tsx` | Waitlist page |
| `src/components/waitlist/CountdownTimer.tsx` | Countdown component |
| `src/components/waitlist/WaitlistForm.tsx` | Email form component |
| `src/hooks/usePreLaunch.ts` | Pre-launch status hook |
| `src/lib/prelaunch/config.ts` | Pre-launch config utilities |
| `src/lib/stripe/discounts.ts` | Discount eligibility helper |
| `src/lib/waitlist/linkWaitlist.ts` | Waitlist-to-user linking |
| `functions/src/discounts.ts` | Firebase Functions discount helper |

### Files Modified (7 files)
| File | Changes |
|------|---------|
| `.env.local` | Added promo code ID, launch date |
| `src/middleware.ts` | Added pre-launch lock logic |
| `src/app/[locale]/(home)/LandingPageClient.tsx` | Added pre-launch mode UI |
| `src/app/api/auth/signup/route.ts` | Added waitlist linking call |
| `src/app/api/auth/google/route.ts` | Added waitlist linking call |
| `src/app/api/stripe/create-checkout-session/route.ts` | Added auto-apply discount logic |
| `functions/src/handlers/checkout.ts` | Added discount redemption marking |

---

## Data Flow Diagram

```
PRE-LAUNCH FLOW:
================

User visits moshimoshi.app
        │
        ▼
Middleware checks: new Date() < LAUNCH_DATE?
        │
        ├─── YES (Locked) ─────────────────────────────────┐
        │                                                   │
        ▼                                                   ▼
Is route allowed?                                    Redirect to /
(/waitlist, /terms, etc.)                            (Landing page)
        │                                                   │
        ├─── YES ──► Continue to page                       │
        │                                                   ▼
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

## Quick Start for Future Implementation

To continue implementation:

1. **Open this document** to understand context
2. **Check current step** (Step 8 in progress)
3. **Complete Step 8**: Modify checkout session creation in `src/app/api/stripe/create-checkout-session/route.ts`
4. **Implement Step 9**: Create `functions/src/discounts.ts` and modify webhook
5. **Test Step 10**: Run through all test cases

---

## Notes & Gotchas

1. **Stripe Limitation**: Cannot use both `allow_promotion_codes: true` AND `discounts` array. We chose Option A (auto-apply only, no manual codes).

2. **Launch Date Timezone**: Uses `2025-12-31T00:00:00Z` (UTC/GMT). UK is on GMT in winter, so this is correct.

3. **Waitlist Linking is Non-Blocking**: If `linkWaitlistToUser` fails, signup continues. Discount is a bonus, not critical path.

4. **Duplicate Email Handling**: Returns success message even if email already on waitlist (privacy - don't reveal if email exists).

5. **Environment Variables**: Must also be set in Vercel/production environment before deployment.

---

## Related Documentation

- `/01_PRODUCTION_DOCS/STRIPE_ARCHITECTURE_EXPERT_REPORT.md` - Full Stripe integration docs
- `/01_PRODUCTION_DOCS/STRIPE_STRIPE_INTEGRATION_OVERVIEW.md` - Stripe overview
- `/.claude/plans/validated-wibbling-garden.md` - Original plan file

---

*Document created: December 15, 2025*
*For questions, refer to the git history or the plan file.*
