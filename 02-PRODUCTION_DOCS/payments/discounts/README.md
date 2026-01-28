# Discount System

**Status:** ACTIVE
**Last Updated:** 2026-01-28

## Overview

The discount system provides a config-driven approach to managing promotional codes and admin-granted discounts in Moshimoshi. It integrates with Stripe coupons and promo codes, supporting auto-apply logic and admin management interfaces.

## Quick Start

1. **Create discount**: Add to discount configuration
2. **Stripe setup**: Create corresponding coupon in Stripe
3. **Auto-apply**: Configure trigger conditions
4. **Admin grant**: Use admin interface to grant to specific users
5. **Track usage**: Monitor redemptions and impact

## Documentation

| Document | Description |
|----------|-------------|
| [DISCOUNT_SYSTEM.md](./DISCOUNT_SYSTEM.md) | Complete discount system implementation guide |

## Key Topics

- **Config-driven discounts** - JSON configuration for easy management
- **Stripe integration** - Coupon and promo code synchronization
- **Admin-grantable** - Manual discount assignment (e.g., Thank You 50%)
- **Auto-apply logic** - Automatic discounts at checkout
- **Usage tracking** - Redemption monitoring and analytics
- **Expiration handling** - Time-limited promotional periods

## Architecture

```
Discount System
├── Configuration
│   ├── Discount definitions (JSON)
│   ├── Stripe coupon IDs
│   └── Application rules
├── Stripe Integration
│   ├── Coupon creation/sync
│   ├── Promo code management
│   └── Application at checkout
├── Admin Interface
│   ├── Grant discounts to users
│   ├── View redemptions
│   └── Create new discounts
└── Auto-apply Logic
    ├── User eligibility checks
    ├── Automatic application
    └── Conflict resolution
```

## Key Files

- `src/lib/stripe/discounts.ts:67` - Discount management service
- `config/discounts.json:12` - Discount configuration
- `src/app/api/admin/discounts/route.ts:34` - Admin API
- `src/app/[locale]/admin/discounts/page.tsx:45` - Admin interface

## Discount Configuration

Example discount config:
```json
{
  "id": "thank-you-50",
  "name": "Thank You 50% Off",
  "type": "percentage",
  "value": 50,
  "stripeCouponId": "THANK_YOU_50",
  "adminGrantable": true,
  "autoApply": false,
  "description": "Admin-granted thank you discount",
  "expiresAt": null
}
```

## Discount Types

### Percentage Discounts
- Value: 1-100 (percentage off)
- Example: 50% off first month

### Fixed Amount Discounts
- Value: Dollar amount
- Example: $10 off subscription

### Trial Extensions
- Value: Days to extend trial
- Example: +7 days free trial

## Admin-Granted Discounts

Admins can grant special discounts:
1. Navigate to admin discount management
2. Select user and discount type
3. Set duration (one-time, duration, forever)
4. User receives discount at next checkout

Common admin discounts:
- **Thank You 50%**: For helpful community members
- **Beta Tester**: Special pricing for early adopters
- **Influencer**: Discount for content creators
- **Support Recovery**: Apology discount for issues

## Auto-Apply Logic

Discounts can auto-apply based on:
- **User type**: New users, returning users
- **Subscription tier**: Upgrading from free
- **Time-based**: Seasonal promotions
- **Behavior**: Referrals, achievements
- **Email domain**: Educational institutions

## Creating New Discounts

1. **Define in config**: Add to `config/discounts.json`
2. **Create Stripe coupon**: Create matching coupon in Stripe dashboard
3. **Set application rules**: Configure auto-apply conditions
4. **Test**: Verify discount applies correctly
5. **Deploy**: Push configuration to production
6. **Monitor**: Track usage and impact

## Stripe Integration

Each discount requires:
- Stripe coupon ID (matches config)
- Duration (once, repeating, forever)
- Currency (if fixed amount)
- Valid redemption period

## Usage Analytics

Track for each discount:
- Total redemptions
- Revenue impact
- User acquisition cost
- Conversion rate
- Popular tiers

## Best Practices

- Use clear, descriptive discount names
- Set appropriate expiration dates
- Limit redemptions to prevent abuse
- Test all discounts before announcing
- Monitor usage to detect issues
- Communicate clearly to users

## Troubleshooting

### Discount not applying
- Check Stripe coupon is active
- Verify discount hasn't expired
- Confirm user eligibility
- Check for conflicting discounts

### Multiple discounts conflict
- System applies most valuable discount
- Admin-granted takes priority
- Time-limited over permanent

---

*For complete implementation details, see [DISCOUNT_SYSTEM.md](./DISCOUNT_SYSTEM.md)*
