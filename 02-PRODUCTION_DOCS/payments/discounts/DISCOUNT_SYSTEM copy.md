# Discount System

> **Status**: ACTIVE
> **Last Updated**: 2026-01-28
> **Related**: Stripe Integration, Admin Dashboard

---

## Overview

Config-driven discount system that allows admins to grant promotional discounts to users. Discounts are auto-applied at Stripe checkout - users don't need to enter promo codes manually.

### Current Discount Types

| Type | Discount | Description | Admin Grantable |
|------|----------|-------------|-----------------|
| `prelaunch` | 25% | Pre-launch waitlist users | No (auto-granted) |
| `thankyou` | 50% | Manual reward for community members | Yes |
| `thankyou10` | 10% | Smaller thank you for community members | Yes |

---

## Architecture

### Data Flow

```
1. ADMIN GRANTS DISCOUNT
   Admin Dashboard → POST /api/admin/discounts
   → Creates Firestore document: stripe/discounts/users/{uid}

2. USER SUBSCRIBES
   Checkout → getDiscountEligibility(uid)
   → Reads promotionCodeId from Firestore
   → Passes to Stripe: discounts: [{ promotion_code: "promo_xxx" }]

3. STRIPE CHECKOUT
   → Shows discount automatically (e.g., "THANKYOU50: -£4.50")
   → User pays discounted price

4. WEBHOOK MARKS REDEEMED
   checkout.session.completed → markDiscountRedeemed(uid)
   → Prevents re-use
```

### Firestore Schema

**Collection**: `stripe/discounts/users/{uid}`

```typescript
{
  eligible: boolean,           // Can use the discount
  promotionCodeId: string,     // Stripe promo code ID (promo_xxx)
  discountType: string,        // "prelaunch" | "thankyou" | etc.
  source: string,              // e.g., "thankyou_beta_tester"
  grantedAt: Timestamp,
  grantedBy?: string,          // Admin UID (if manually granted)
  redeemed: boolean,           // Has been used
  redeemedAt?: Timestamp,
  redeemedSubscriptionId?: string,
  revokedAt?: Timestamp,       // If revoked before use
  revokedBy?: string,
}
```

---

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PRELAUNCH_PROMO_CODE_ID` | Stripe promo code for waitlist | `promo_1Sedz...` |
| `THANKYOU_PROMO_CODE_ID` | Stripe promo code for thank you | `promo_1Su5p...` |

### Discount Type Configuration

Located in `src/lib/stripe/discounts.ts`:

```typescript
export const DISCOUNT_TYPES = {
  prelaunch: {
    id: 'prelaunch',
    envVar: 'PRELAUNCH_PROMO_CODE_ID',
    label: 'Pre-Launch Waitlist (25%)',
    description: 'For users who joined the waitlist before launch',
    sources: ['pre_launch_waitlist'] as const,
    adminGrantable: false,
  },
  thankyou: {
    id: 'thankyou',
    envVar: 'THANKYOU_PROMO_CODE_ID',
    label: 'Thank You (50%)',
    description: 'Manual reward for valuable community members',
    sources: [
      'beta_tester',
      'bug_reporter',
      'content_creator',
      'community_contributor',
      'support_compensation',
      'other',
    ] as const,
    adminGrantable: true,
  },
}
```

---

## Adding a New Discount Type

### Step 1: Create Stripe Coupon & Promo Code

1. Go to [Stripe Dashboard → Coupons](https://dashboard.stripe.com/coupons)
2. Click **"+ Create coupon"**
3. Configure:
   - **Name**: e.g., `REFERRAL20`
   - **Type**: Percentage discount
   - **Percent off**: e.g., `20`
   - **Duration**: Once (first invoice only)
   - **Use customer-facing coupon codes**: Enable
   - **Code**: e.g., `REFERRAL20`
   - **First-time orders only**: Enable
4. Click **"Create coupon"**
5. Copy the **Promotion Code ID** (starts with `promo_`)

### Step 2: Add Environment Variable

```bash
# Local (.env.local)
REFERRAL_PROMO_CODE_ID=promo_1Sxxx...

# Vercel (all environments)
vercel env add REFERRAL_PROMO_CODE_ID production
vercel env add REFERRAL_PROMO_CODE_ID preview
vercel env add REFERRAL_PROMO_CODE_ID development
```

### Step 3: Add Configuration

Edit `src/lib/stripe/discounts.ts`:

```typescript
export const DISCOUNT_TYPES = {
  // ... existing types ...

  referral: {
    id: 'referral',
    envVar: 'REFERRAL_PROMO_CODE_ID',
    label: 'Referral (20%)',
    description: 'For users who referred new members',
    sources: [
      'referred_user',
      'referrer_bonus',
    ] as const,
    adminGrantable: true,  // Set to true if admins can grant manually
  },
}
```

### Step 4: Deploy

```bash
git add .
git commit -m "feat: Add referral discount type"
git push
```

**That's it!** The API and Admin UI automatically pick up the new discount type.

---

## Admin Usage

### Granting a Discount

1. Go to **Admin → Subscriptions** (`/admin/subscriptions`)
2. Find the user and click **"Manage"**
3. Scroll to **"Grant Discount"** section
4. Select discount type (if multiple available)
5. Select reason/source
6. Click **"Grant [Discount Name]"**
7. **IMPORTANT**: Update the external tracker: `/home/beano/Life-Org/08_Moshimoshi/DISCOUNTS.md`
   - Add entry to "Granted Discounts" table
   - Update stats (Total Granted, Pending)
   - Update "Last updated" date

### Revoking a Discount

- Only unredeemed discounts can be revoked
- Click **"Revoke Discount"** in the manage modal
- Revoked discounts are marked in Firestore but not deleted

### Viewing Discount Status

The manage modal shows:
- Current discount type and status
- Source/reason
- Grant date
- Redemption date (if used)

---

## API Reference

### GET /api/admin/discounts

**Get discount status for a user:**
```
GET /api/admin/discounts?uid=USER_UID
```

**Get available discount types:**
```
GET /api/admin/discounts?types=true
```

**Get sources for a discount type:**
```
GET /api/admin/discounts?sources=thankyou
```

### POST /api/admin/discounts

**Grant a discount:**
```json
{
  "targetUserId": "USER_UID",
  "discountType": "thankyou",
  "source": "beta_tester"
}
```

### DELETE /api/admin/discounts

**Revoke a discount:**
```json
{
  "targetUserId": "USER_UID"
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/stripe/discounts.ts` | Discount configuration and core functions |
| `src/app/api/admin/discounts/route.ts` | Admin API for managing discounts |
| `src/app/[locale]/admin/subscriptions/page.tsx` | Admin UI with discount management |
| `src/app/api/stripe/create-checkout-session/route.ts` | Auto-applies discount at checkout |

---

## Troubleshooting

### Discount not applying at checkout

1. Check Firestore: `stripe/discounts/users/{uid}`
   - `eligible` should be `true`
   - `redeemed` should be `false`
2. Check env var is set: `THANKYOU_PROMO_CODE_ID`
3. Check Stripe promo code is active in dashboard

### "User already has an active discount" error

- User already has an unredeemed discount
- Either revoke the existing one or let them use it first

### "User has already redeemed a discount" error

- One discount per user lifetime
- This is by design to prevent abuse

### Promo code not working in Stripe

1. Verify promo code is active in Stripe Dashboard
2. Check "First-time orders only" restriction matches user status
3. Verify the promo code ID (not the code itself) is in env var

---

## Related Documentation

- [Stripe Integration Overview](../../01_PRE-PRODUCTION_DOCS/2-Payment-Monetization/STRIPE_INTEGRATION_OVERVIEW.md)
- [Pre-Launch Waitlist Implementation](../../01_PRE-PRODUCTION_DOCS/2-Payment-Monetization/legacy/PRELAUNCH_WAITLIST_IMPLEMENTATION.md)
- **External Tracker**: `/home/beano/Life-Org/08_Moshimoshi/DISCOUNTS.md` (Manual updates required)

---

*Created: 2026-01-27 | Updated: 2026-01-28*
