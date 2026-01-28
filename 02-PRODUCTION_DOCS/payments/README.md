# Payment & Monetization System

**Status:** ACTIVE
**Last Updated:** 2026-01-28

## Overview

Moshimoshi's payment system integrates Stripe for subscription management, one-time purchases, and promotional discounts. It includes entitlement management, quota tracking, and admin controls for managing user subscriptions and discounts.

## Quick Start

1. **Stripe integration**: Live mode for production payments
2. **Subscription tiers**: Free, Basic, Premium, Lifetime
3. **Discount system**: See `discounts/` folder for promotional codes
4. **Entitlements**: Feature gating based on subscription level
5. **Admin management**: Control subscriptions via admin dashboard

## Documentation

### Discounts System

See [discounts/README.md](./discounts/README.md) for complete discount system documentation.

## Key Topics

- **Stripe integration** - Payment processing and subscription management
- **Subscription tiers** - Multiple pricing levels with feature gates
- **Discount codes** - Promotional codes and admin-granted discounts
- **Entitlement system** - Feature access control based on subscription
- **Quota management** - Usage limits and tracking
- **Webhook handling** - Stripe event processing
- **Admin controls** - Subscription and discount management

## Architecture

```
Payment System
├── Stripe Integration
│   ├── Subscriptions
│   ├── One-time payments
│   ├── Webhooks
│   └── Customer portal
├── Entitlements
│   ├── Feature gates
│   ├── Quota tracking
│   └── Access validation
├── Discounts
│   ├── Promo codes
│   ├── Admin grants
│   └── Auto-apply logic
└── Admin Management
    ├── Subscription control
    ├── Discount creation
    └── User management
```

## Key Files

- `src/lib/stripe/client.ts:45` - Stripe client initialization
- `src/lib/stripe/subscriptions.ts:89` - Subscription management
- `src/lib/stripe/discounts.ts:67` - Discount system
- `src/lib/entitlements/policy.ts:123` - Entitlement rules
- `src/app/api/webhooks/stripe/route.ts:78` - Webhook handler

## Subscription Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Basic features, limited usage |
| **Basic** | $9.99/mo | Extended features, higher quotas |
| **Premium** | $19.99/mo | All features, unlimited usage |
| **Lifetime** | $199 one-time | Premium features forever |

## Entitlements

Features are gated by subscription level:
- **Kanji Mastery**: Premium feature
- **Advanced Analytics**: Premium feature
- **Cross-device Sync**: Premium feature
- **Priority Support**: Premium feature
- **Ad-free Experience**: Basic and above

## Discount System

See [discounts/](./discounts/) folder for:
- Creating new discount codes
- Admin-granted discounts (Thank You 50%)
- Auto-apply discount logic
- Stripe integration details

## Webhook Events

The system processes these Stripe events:
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Subscription change
- `customer.subscription.deleted` - Cancellation
- `invoice.payment_succeeded` - Successful payment
- `invoice.payment_failed` - Payment failure
- `checkout.session.completed` - Checkout completion

## Admin Management

Admins can:
- View all subscriptions
- Cancel/refund subscriptions
- Create discount codes
- Grant special discounts to users
- View payment history
- Manage failed payments

## Security

- **Webhook verification** - Stripe signature validation
- **Secure API routes** - Admin-only access
- **PCI compliance** - No card data stored
- **HTTPS only** - All payment pages require SSL
- **Session security** - Server-side validation

## Testing

- **Test mode**: Stripe test keys for development
- **Test cards**: Use Stripe test card numbers
- **Webhook testing**: Stripe CLI for local webhooks
- **Subscription testing**: Test all tiers and transitions

---

*For discount system details, see [discounts/README.md](./discounts/README.md)*
