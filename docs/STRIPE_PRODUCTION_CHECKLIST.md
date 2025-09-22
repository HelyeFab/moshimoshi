# Stripe Production Checklist

## Before Going Live

### 1. Environment Variables
- [ ] Update `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` with production key
- [ ] Update `STRIPE_SECRET_KEY` with production key
- [ ] Update webhook secrets in Firebase config:
  ```bash
  firebase functions:config:set stripe.webhook_secret_prod="whsec_YOUR_PROD_SECRET"
  ```

### 2. Stripe Dashboard Setup
- [ ] Create production webhook endpoint: `https://europe-west1-moshimoshi-de237.cloudfunctions.net/stripeWebhook`
- [ ] Enable these webhook events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

### 3. Testing Checklist
- [ ] Test new subscription purchase
- [ ] Test subscription cancellation
- [ ] Test subscription renewal
- [ ] Test failed payment handling
- [ ] Test webhook retries
- [ ] Verify subscription status updates in Firebase
- [ ] Verify user can access premium features
- [ ] Test customer portal access

### 4. Monitoring
- [ ] Set up alerts for webhook failures
- [ ] Monitor Firebase Function logs
- [ ] Set up payment failure notifications
- [ ] Configure customer email notifications in Stripe

### 5. Security
- [ ] Ensure webhook secrets are not in code
- [ ] Verify HTTPS only for all endpoints
- [ ] Test webhook signature verification
- [ ] Review Firebase security rules

## Post-Launch Monitoring
- Monitor webhook success rate
- Track subscription conversion rates
- Review failed payment patterns
- Monitor function execution times