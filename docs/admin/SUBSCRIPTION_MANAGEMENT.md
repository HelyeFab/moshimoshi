# Admin Subscription Management Guide

## Overview
The admin subscription management system allows administrators to upgrade or downgrade user subscriptions without requiring payment. This is useful for:
- Providing promotional upgrades
- Compensating users for support issues
- Testing premium features
- Managing special accounts

## Architecture

### Security
- All admin endpoints require authentication via JWT session
- Admin status is verified by checking `user.isAdmin === true` in Firestore (NOT `admin`)
- All admin actions are logged to `admin_logs` collection

**⚠️ IMPORTANT**: The admin field is `isAdmin`, not `admin`. Always check:
```typescript
userData?.isAdmin === true  // ✅ Correct
userData?.admin === true    // ❌ Wrong - this field doesn't exist
```

### API Endpoint
`/api/admin/subscriptions/upgrade`

#### GET - List All Users
Returns all users with their subscription information.

**Response:**
```json
{
  "users": [
    {
      "uid": "user123",
      "email": "user@example.com",
      "displayName": "John Doe",
      "subscription": {
        "plan": "premium_monthly",
        "status": "trialing",
        "currentPeriodEnd": "2025-02-15T00:00:00Z"
      }
    }
  ]
}
```

#### POST - Update User Subscription
Updates a user's subscription plan.

**Request:**
```json
{
  "targetUserId": "user123",
  "plan": "premium_monthly", // or "premium_yearly" or "free"
  "reason": "Promotional upgrade for beta testing"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User subscription updated to premium_monthly",
  "previousPlan": "free",
  "newPlan": "premium_monthly"
}
```

## How It Works

### Upgrading to Premium
1. **Stripe Customer Creation**: If the user doesn't have a Stripe customer ID, one is created
2. **Subscription Creation**: A Stripe subscription is created with a 100-year trial period (effectively free)
3. **Firebase Update**: User document is updated with subscription details
4. **Audit Logging**: Action is logged to `admin_logs` collection

### Downgrading to Free
1. **Stripe Cancellation**: Any existing Stripe subscription is cancelled
2. **Firebase Update**: User document is reset to free plan
3. **Audit Logging**: Action is logged with reason

## Database Structure

### User Document Updates
```typescript
{
  subscription: {
    plan: 'premium_monthly',
    status: 'trialing',        // Admin upgrades use trial status
    stripeCustomerId: 'cus_xxx',
    stripeSubscriptionId: 'sub_xxx',
    stripePriceId: 'price_xxx',
    currentPeriodEnd: Date,
    trialEnd: Date,            // 100 years in the future
    metadata: {
      source: 'admin',         // Indicates admin upgrade
      updatedBy: 'adminUid',   // Admin who made the change
      updatedAt: Date,
      reason: 'string'         // Reason for change
    }
  }
}
```

### Admin Logs
```typescript
{
  action: 'subscription_change',
  adminUid: 'admin123',
  adminEmail: 'admin@example.com',
  targetUserId: 'user123',
  fromPlan: 'free',
  toPlan: 'premium_monthly',
  reason: 'Promotional upgrade',
  timestamp: Date
}
```

## UI Components

### Admin Subscriptions Page
Location: `/admin/subscriptions`

Features:
- **User List**: Displays all users with subscription status
- **Search**: Filter by email or display name
- **Plan Filter**: Filter by subscription plan
- **Statistics**: Shows breakdown of users by plan
- **Manage Button**: Opens modal to change subscription

### Upgrade Modal
- Select new plan (Free, Premium Monthly, Premium Yearly)
- Require reason for audit trail
- Show warnings for downgrades
- Confirm action with loading state

## Best Practices

### When to Use Admin Upgrades
1. **Beta Testing**: Give testers free premium access
2. **Compensation**: Resolve support issues with temporary premium
3. **Partnerships**: Provide access to partner organizations
4. **Development**: Test premium features without payment flow

### Security Considerations
1. **Always require a reason**: Ensures accountability
2. **Review audit logs**: Regularly check `admin_logs` collection
3. **Limit admin access**: Only trusted team members should have admin privileges
4. **Monitor usage**: Set up alerts for unusual admin activity

### Limitations
1. **No Revenue**: Admin upgrades don't generate revenue in Stripe
2. **Trial Status**: Users show as "trialing" rather than "active"
3. **No Invoices**: No invoices are generated for admin upgrades
4. **Manual Process**: Each upgrade must be done individually

## Testing

### Local Development
1. Set your user as admin in Firestore: `admin: true`
2. Navigate to `/admin/subscriptions`
3. Select a test user and upgrade them
4. Verify the subscription updates in Firebase

### Production Considerations
1. Always test in development first
2. Double-check user selection before upgrading
3. Monitor Stripe dashboard for any issues
4. Review admin logs after bulk operations

## Troubleshooting

### Common Issues

#### "Forbidden - Admin access required"
- Ensure your user document has `admin: true` in Firestore
- Check that you're logged in with the correct account

#### Stripe Customer Creation Fails
- Verify STRIPE_SECRET_KEY is set correctly
- Check Stripe API logs for detailed errors

#### Subscription Not Updating in UI
- User may need to refresh their page
- Check that webhook is processing updates
- Verify Firebase rules allow reading subscription data

## Future Enhancements
1. **Bulk Operations**: Upgrade multiple users at once
2. **Time-Limited Upgrades**: Set expiration dates for promotional upgrades
3. **Coupon Codes**: Generate codes for self-service upgrades
4. **Analytics**: Track conversion rates from admin upgrades
5. **Automation**: Set rules for automatic upgrades based on criteria