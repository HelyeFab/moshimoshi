# Stripe Integration Fixes - January 2025

## Overview
This document summarizes the critical fixes applied to the Stripe integration in the Moshimoshi project to resolve duplicate processing, session staleness, and configuration issues.

## Issues Identified

### 1. Duplicate Webhook Processing
- **Problem**: Both Firebase Functions and Next.js API routes were processing the same webhook events
- **Impact**: Race conditions, duplicate database writes, conflicting subscription states

### 2. Session Tier Staleness
- **Problem**: JWT sessions cached subscription tier for 24 hours without invalidation
- **Impact**: Users couldn't access premium features immediately after subscribing

### 3. API Version Mismatch
- **Problem**: Different Stripe API versions across files (2023-10-16, 2024-06-20, 2025-04-30, 2025-08-27)
- **Impact**: Potential compatibility issues and unexpected behavior

### 4. Sensitive Data Logging
- **Problem**: Price IDs, customer IDs, and email addresses were logged in plain text
- **Impact**: Security risk, potential PII exposure in logs

### 5. Missing Firebase Functions Configuration
- **Problem**: Price IDs not configured in Firebase Functions environment
- **Impact**: Functions couldn't map price IDs to plans correctly

## Fixes Applied

### 1. ✅ Disabled Next.js Webhook Handler
- **File**: `/src/app/api/stripe/webhook/route.ts`
- **Change**: Disabled the handler to return a 200 response without processing
- **Result**: Only Firebase Functions process webhooks now

### 2. ✅ Standardized Stripe API Version
- **Files Updated**:
  - `/functions/src/stripeClient.ts`
  - `/functions/src/webhook.ts`
  - `/src/app/api/stripe/webhook/route.ts`
- **Version**: `2025-08-27.basil` across all files
- **Result**: Consistent API behavior

### 3. ✅ Implemented Session Invalidation
- **Files Updated**:
  - `/functions/src/handlers/subscriptions.ts`
  - `/functions/src/handlers/checkout.ts`
- **Change**: Added calls to `/api/auth/invalidate-tier-cache` after subscription changes
- **Result**: Users see subscription updates immediately

### 4. ✅ Removed Sensitive Data Logging
- **Files Updated**:
  - `/src/lib/stripe/mapping.ts`
  - `/functions/src/mapping/stripeMapping.ts`
  - `/src/app/api/stripe/create-checkout-session/route.ts`
- **Change**: Removed logging of price IDs, customer IDs, and emails
- **Result**: Improved security and privacy

### 5. ✅ Created Firebase Config Script
- **File**: `/scripts/update-firebase-config.sh`
- **Purpose**: Sets Firebase Functions configuration with correct price IDs
- **Usage**: `./scripts/update-firebase-config.sh`

## Configuration Required

### Environment Variables (.env.local)
```bash
# Keep only these Stripe variables
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=price_1S6wG7HdrJomitOw5YvQ71DD
NEXT_PUBLIC_STRIPE_PRICE_YEARLY=price_1S6wGGHdrJomitOwcmT2JeUG
NEXT_PUBLIC_STRIPE_MONTHLY_AMOUNT=8.99
NEXT_PUBLIC_STRIPE_YEARLY_AMOUNT=99.99
NEXT_PUBLIC_STRIPE_CURRENCY=GBP

# Remove these deprecated variables
# STRIPE_PRICE_MONTHLY (old)
# STRIPE_PRICE_YEARLY (old)
```

### Firebase Functions Configuration
Run the update script to set configuration:
```bash
./scripts/update-firebase-config.sh
firebase deploy --only functions
```

## Data Flow After Fixes

### Checkout Flow
1. User clicks upgrade → Next.js `/api/stripe/create-checkout-session`
2. Creates Stripe checkout session with uid in metadata
3. User completes payment → Stripe sends webhook
4. Firebase Function processes webhook → Updates Firestore
5. Firebase Function calls Next.js to invalidate session cache
6. User's session refreshes → Premium access granted immediately

### Subscription Update Flow
1. Stripe subscription changes (renewal, cancellation, etc.)
2. Webhook sent to Firebase Functions
3. Functions update Firestore subscription data
4. Functions call session invalidation API
5. User's cached session marked for refresh
6. Next request gets fresh subscription data

## Architecture Summary

### Single Webhook Handler
- **Production**: `https://europe-west1-moshimoshi-de237.cloudfunctions.net/stripeWebhook`
- **Handles**: All Stripe webhook events
- **Features**: Dual-secret verification (TEST + PROD), idempotency, logging

### Session Management
- **JWT Sessions**: 1 hour default, 7 days with "remember me"
- **Redis Cache**: Session storage with invalidation support
- **Tier Refresh**: Automatic invalidation on subscription changes

### Customer Mapping
- **Storage**: `/stripe/byUid/uidToCustomer/{uid}` and `/stripe/byCustomer/customerToUid/{customerId}`
- **Bidirectional**: Maps Firebase UID ↔ Stripe Customer ID

## Testing Checklist

- [ ] Run Firebase config update script
- [ ] Deploy Firebase Functions
- [ ] Test checkout flow with test card (4242 4242 4242 4242)
- [ ] Verify subscription appears in Firestore
- [ ] Check session tier updates immediately
- [ ] Test cancellation flow
- [ ] Verify webhook events in Stripe dashboard
- [ ] Check no duplicate processing in logs

## Monitoring

### Key Metrics to Track
1. Webhook success rate in Stripe Dashboard
2. Session invalidation API success rate
3. Time between subscription and session update
4. Firebase Functions execution time
5. Error rate in Firebase Functions logs

### Debug Commands
```bash
# View Firebase Functions logs
firebase functions:log

# Check Firebase config
firebase functions:config:get

# Test webhook locally
stripe listen --forward-to localhost:3006/api/stripe/webhook

# Trigger test events
stripe trigger customer.subscription.updated
```

## Completed Low-Priority Improvements

### ✅ Idempotency and Deduplication
- **Status**: Already implemented in Firebase Functions
- **Features**:
  - `wasProcessed()` checks for duplicate events
  - `markProcessed()` marks events after successful handling
  - Events stored in Firestore with 30-day TTL
  - Failed events not marked (allows retry)
  - Returns early on duplicates without reprocessing

### ✅ Plan Naming Consistency
- **Status**: Fully consistent using underscore notation
- **Standard**: `premium_monthly` and `premium_yearly` everywhere
- **Normalization**: `tier-cache.ts` handles both formats for backward compatibility
- **Function**: `normalizeTier()` converts dot notation to underscore

### ✅ Comprehensive Testing Suite
- **Created**: `/scripts/test-stripe-flow.js`
- **Tests**:
  - Environment variable validation
  - API endpoint health checks
  - Webhook handler status
  - Session invalidation
  - Security verification
  - Configuration consistency
- **Usage**: `node scripts/test-stripe-flow.js`

## Remaining Future Improvements

1. **Implement Dead Letter Queue**: For persistent webhook failures
2. **Add Monitoring Dashboard**: Track subscription metrics in real-time
3. **Create Health Check Endpoint**: For Firebase Functions monitoring
4. **Add Rate Limiting**: On session invalidation API
5. **Implement Circuit Breaker**: For external API calls

## Important Notes

- Firebase Functions use Node.js 20 which has native fetch support
- Always use `premium_monthly` and `premium_yearly` (underscore notation)
- Session cookies use `sameSite: 'lax'` for Stripe redirects
- Never log sensitive data (price IDs, customer IDs, emails)
- Test mode and production mode webhooks handled by same function

---

Last Updated: January 2025
Author: Claude