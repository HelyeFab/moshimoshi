# Stripe Webhook Development Setup Guide

## Quick Start (Daily Setup)

Every time you want to test Stripe webhooks locally, you need to:

### 1. Start Your Dev Server
```bash
# Start on your preferred port (default 3000, or specify another)
PORT=3001 npm run dev
```

### 2. Start Stripe CLI Webhook Forwarding
```bash
# Forward webhooks to your local server
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

**Important**: The Stripe CLI will display a webhook signing secret like:
```
Ready! Your webhook signing secret is whsec_xxxxx
```

### 3. Update Your Environment Variable (First Time Only)
Add this to your `.env.local` file:
```env
STRIPE_WEBHOOK_SECRET_TEST=whsec_xxxxx  # The secret from step 2
```

## Automated Setup (Recommended)

We've created a script to start all webhook listeners automatically:

```bash
# This starts webhook forwarding on multiple ports (3000-3010)
./start-all-webhooks.sh
```

This script monitors ports 3000-3010, so you can start your dev server on any of these ports and webhooks will work automatically.

## Testing Webhooks

### Method 1: Real Actions
Perform actual actions in your app:
- Create a subscription through checkout
- Cancel a subscription
- Update payment method

### Method 2: Stripe CLI Triggers
Test specific webhook events without performing actions:

```bash
# Test successful payment
stripe trigger invoice.payment_succeeded

# Test failed payment
stripe trigger invoice.payment_failed

# Test subscription created
stripe trigger customer.subscription.created

# Test subscription canceled
stripe trigger customer.subscription.deleted
```

### Method 3: Stripe Dashboard
1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click on your webhook endpoint
3. Click "Send test webhook"
4. Select event type and send

## Common Webhook Events Your App Handles

| Event | What It Does | When It Fires |
|-------|--------------|---------------|
| `checkout.session.completed` | Updates user subscription in Firebase | After successful checkout |
| `customer.subscription.created` | Creates subscription record | New subscription started |
| `customer.subscription.updated` | Updates plan/status | Subscription modified |
| `customer.subscription.deleted` | Resets user to free plan | Subscription canceled |
| `invoice.created` | Adds custom footer | New invoice generated |
| `invoice.payment_succeeded` | Confirms active subscription | Renewal payment successful |
| `invoice.payment_failed` | Sets status to past_due | Renewal payment failed |

## Troubleshooting

### Issue: "Webhook signature verification failed"
**Solution**: Make sure your `.env.local` has the correct webhook secret from the Stripe CLI output.

### Issue: Webhooks not reaching local server
**Solution**:
1. Check that Stripe CLI is running: `stripe listen --forward-to localhost:YOUR_PORT/api/stripe/webhook`
2. Verify your dev server is running on the same port
3. Check for any firewall blocking local connections

### Issue: 404 errors on webhook endpoint
**Solution**: Ensure your webhook endpoint exists at `/api/stripe/webhook/route.ts`

### Issue: Webhook events not updating Firebase
**Solution**:
1. Check Firebase Admin is initialized
2. Verify user has `stripeCustomerId` in Firebase
3. Check logs for any Firebase permission errors

## Monitoring Webhook Activity

### 1. Stripe CLI Output
The Stripe CLI shows all webhook events in real-time:
```
2025-09-14 09:15:23  --> invoice.created [evt_xxx]
2025-09-14 09:15:24  <-- [200] POST http://localhost:3001/api/stripe/webhook
```

### 2. Your App Logs
Check your Next.js console for webhook processing:
```
[Webhook] Processing checkout.session.completed: cs_test_xxx
[Webhook] ✅ Successfully updated user abc123 to premium_monthly
```

### 3. Stripe Dashboard
View all webhook attempts at:
https://dashboard.stripe.com/test/webhooks/we_xxx

## Firebase Functions Webhook (Production)

For production, webhooks go to your Firebase Function:
```
https://europe-west1-moshimoshi-de237.cloudfunctions.net/stripeWebhook
```

This handles both TEST and PRODUCTION webhooks automatically based on the signature.

## Daily Development Workflow

```bash
# 1. Start your dev server
PORT=3001 npm run dev

# 2. In a new terminal, start webhook forwarding
stripe listen --forward-to localhost:3001/api/stripe/webhook

# 3. Keep both terminals open while developing
# 4. Test by creating subscriptions or using stripe trigger commands
```

## Important Files

- `/src/app/api/stripe/webhook/route.ts` - Local webhook handler
- `/functions/src/webhook.ts` - Firebase Function webhook handler
- `/src/lib/stripe/invoice-messages.ts` - Invoice customization messages
- `/.env.local` - Local environment variables (including webhook secrets)

## Security Notes

⚠️ **Never commit webhook secrets to git**
- Keep `STRIPE_WEBHOOK_SECRET` in `.env.local`
- Use Firebase config for production secrets
- Different secrets for TEST vs PRODUCTION

## Need Help?

1. Check Stripe CLI is installed: `stripe --version`
2. Login to Stripe CLI: `stripe login`
3. View webhook logs: `stripe logs tail`
4. Test connection: `stripe trigger ping`

---

Last Updated: September 14, 2025