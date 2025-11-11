# Stripe Integration - Firebase Collections

## Overview
Collections managing Stripe subscription data, customer mappings, and payment information.

## Collections

### `stripe/byUid/uidToCustomer/{uid}`

**Description:** Maps Firebase user IDs to Stripe customer IDs.

**Access:**
- 🔒 Server-only (Firebase Admin SDK)
- 📍 Location: Nested under `stripe/byUid`
- 🔄 Created by: Stripe webhook handlers

**Document Structure:**
```typescript
{
  customerId: string                  // Stripe customer ID (cus_xxx)
}
```

**Example Document:**
```json
{
  "customerId": "cus_PQR12345xyz"
}
```

**Firestore Path Example:**
```
stripe/byUid/uidToCustomer/8onZzlQg3tQxkw8pinSF9ow4Q6j2
```

---

### `stripe/byCustomer/customerToUid/{customerId}`

**Description:** Maps Stripe customer IDs to Firebase user IDs (reverse lookup).

**Access:**
- 🔒 Server-only (Firebase Admin SDK)
- 📍 Location: Nested under `stripe/byCustomer`
- 🔄 Created by: Stripe webhook handlers

**Document Structure:**
```typescript
{
  uid: string                         // Firebase user ID
}
```

**Example Document:**
```json
{
  "uid": "8onZzlQg3tQxkw8pinSF9ow4Q6j2"
}
```

**Firestore Path Example:**
```
stripe/byCustomer/customerToUid/cus_PQR12345xyz
```

---

### `users/{userId}` (Subscription Data)

**Description:** Subscription information stored in user document.

**Relevant Fields:**
```typescript
{
  subscription: {
    plan: 'free' | 'premium_monthly' | 'premium_yearly'
    status: 'active' | 'incomplete' | 'past_due' | 'canceled' | 'trialing'
    stripeCustomerId: string          // Stripe customer ID
    stripeSubscriptionId: string      // Stripe subscription ID (sub_xxx)
    stripePriceId: string             // Stripe price ID (price_xxx)
    currentPeriodEnd: Timestamp       // When current period ends
    cancelAtPeriodEnd: boolean        // Whether subscription will cancel
    metadata: {
      source: 'stripe'
      createdAt: Timestamp
      updatedAt: Timestamp
    }
  }
}
```

**Example:**
```json
{
  "subscription": {
    "plan": "premium_monthly",
    "status": "active",
    "stripeCustomerId": "cus_PQR12345xyz",
    "stripeSubscriptionId": "sub_ABC123def456",
    "stripePriceId": "price_1SBurYHdrJomitOwnUkS46Ab",
    "currentPeriodEnd": "2025-11-03T14:30:00.000Z",
    "cancelAtPeriodEnd": false,
    "metadata": {
      "source": "stripe",
      "createdAt": "2025-10-03T14:30:00.000Z",
      "updatedAt": "2025-10-03T14:30:00.000Z"
    }
  }
}
```

## Stripe Price IDs

### Monthly Plan
- **Price ID:** `price_1SBurYHdrJomitOwnUkS46Ab`
- **Amount:** $8.99/month
- **Plan Code:** `premium_monthly`

### Yearly Plan
- **Price ID:** `price_1SBus6HdrJomitOweasMATvU`
- **Amount:** $99.99/year
- **Plan Code:** `premium_yearly`

## Webhook Events

### Event: `customer.subscription.created`
**Handler:** `/src/app/api/stripe/webhook/route.ts`

**Actions:**
1. Extract `uid` from subscription metadata
2. Get/create Stripe customer ID
3. Map UID ↔ Customer ID (bidirectional)
4. Update user document with subscription data
5. Set subscription status to `active` or `trialing`

**Code Flow:**
```typescript
const uid = subscription.metadata.userId
const customerId = subscription.customer as string

// Create bidirectional mapping
await mapUidToCustomer(uid, customerId)

// Update user subscription
await adminFirestore.collection('users').doc(uid).update({
  subscription: {
    plan: getPlanFromPriceId(subscription.items.data[0].price.id),
    status: subscription.status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0].price.id,
    currentPeriodEnd: Timestamp.fromDate(
      new Date(subscription.current_period_end * 1000)
    ),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    metadata: {
      source: 'stripe',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }
  }
})
```

---

### Event: `customer.subscription.updated`
**Handler:** `/src/app/api/stripe/webhook/route.ts`

**Actions:**
1. Look up UID from customer ID
2. Update subscription status (active, past_due, canceled)
3. Update period end date
4. Handle cancellations and reactivations

**Handles:**
- Plan changes (monthly ↔ yearly)
- Status changes (active → past_due)
- Cancellation scheduling
- Period renewals

---

### Event: `customer.subscription.deleted`
**Handler:** `/src/app/api/stripe/webhook/route.ts`

**Actions:**
1. Look up UID from customer ID
2. Set subscription plan to `free`
3. Set status to `canceled`
4. Preserve Stripe IDs for reference
5. Update metadata timestamp

---

### Event: `invoice.payment_failed`
**Handler:** `/src/app/api/stripe/webhook/route.ts`

**Actions:**
1. Update subscription status to `past_due`
2. Send notification to user (future)
3. Log payment failure

---

### Event: `invoice.payment_succeeded`
**Handler:** `/src/app/api/stripe/webhook/route.ts`

**Actions:**
1. Ensure subscription status is `active`
2. Update period end date
3. Clear any past_due status

## Helper Functions

### `mapUidToCustomer(uid, customerId)`
**File:** `/src/lib/firebase/admin.ts`

Creates bidirectional mapping between UID and Stripe customer ID.

```typescript
export async function mapUidToCustomer(
  uid: string,
  customerId: string
): Promise<void> {
  const batch = adminFirestore.batch()

  // Map uid → customerId
  const uidRef = adminFirestore
    .collection('stripe')
    .doc('byUid')
    .collection('uidToCustomer')
    .doc(uid)

  batch.set(uidRef, { customerId }, { merge: true })

  // Map customerId → uid
  const customerRef = adminFirestore
    .collection('stripe')
    .doc('byCustomer')
    .collection('customerToUid')
    .doc(customerId)

  batch.set(customerRef, { uid }, { merge: true })

  await batch.commit()
}
```

### `getCustomerIdByUid(uid)`
**File:** `/src/lib/firebase/admin.ts`

Retrieve Stripe customer ID for a user.

```typescript
export async function getCustomerIdByUid(
  uid: string
): Promise<string | null> {
  const docRef = adminFirestore
    .collection('stripe')
    .doc('byUid')
    .collection('uidToCustomer')
    .doc(uid)

  const doc = await docRef.get()
  return doc.exists ? doc.data()?.customerId : null
}
```

### `getUidByCustomerId(customerId)`
**File:** `/src/lib/firebase/admin.ts`

Retrieve Firebase UID for a Stripe customer.

```typescript
export async function getUidByCustomerId(
  customerId: string
): Promise<string | null> {
  const docRef = adminFirestore
    .collection('stripe')
    .doc('byCustomer')
    .collection('customerToUid')
    .doc(customerId)

  const doc = await docRef.get()
  return doc.exists ? doc.data()?.uid : null
}
```

### `getUserSubscriptionPlan(uid)`
**File:** `/src/lib/firebase/admin.ts`

Get user's current subscription plan.

```typescript
export async function getUserSubscriptionPlan(
  uid: string
): Promise<'guest' | 'free' | 'premium_monthly' | 'premium_yearly'> {
  const userDoc = await adminFirestore
    .collection('users')
    .doc(uid)
    .get()

  if (!userDoc.exists) return 'guest'

  const userData = userDoc.data()

  if (!userData.subscription) return 'free'

  if (
    userData.subscription.status === 'active' ||
    userData.subscription.status === 'trialing'
  ) {
    return userData.subscription.plan
  }

  return 'free'
}
```

## API Endpoints

### POST `/api/stripe/webhook`
Stripe webhook endpoint for subscription events

**File:** `/src/app/api/stripe/webhook/route.ts`

**Webhook Secret:** `whsec_...` (configured in Stripe dashboard)

**Signature Verification:**
```typescript
const signature = request.headers.get('stripe-signature')
const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
)
```

**Supported Events:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

---

### GET `/api/user/subscription`
Get user's subscription status

**File:** `/src/app/api/user/subscription/route.ts`

**Response:**
```json
{
  "subscription": {
    "plan": "premium_monthly",
    "status": "active",
    "currentPeriodEnd": "2025-11-03T14:30:00.000Z",
    "cancelAtPeriodEnd": false
  }
}
```

## Subscription Status Flow

```
User subscribes on Stripe Checkout
    ↓
Stripe sends webhook: customer.subscription.created
    ↓
Create UID ↔ Customer ID mapping
    ↓
Update users/{uid} with subscription data
    ↓
User gains premium features
    ↓
Monthly renewal → webhook: invoice.payment_succeeded
    ↓
Update currentPeriodEnd
    ↓
User cancels → webhook: customer.subscription.updated
    ↓
Set cancelAtPeriodEnd = true
    ↓
Period ends → webhook: customer.subscription.deleted
    ↓
Downgrade to free tier
```

## Queries & Indexes

### Required Indexes
```
Collection: stripe/byUid/uidToCustomer
- (No indexes needed - direct document reads)

Collection: stripe/byCustomer/customerToUid
- (No indexes needed - direct document reads)
```

### Query Examples

**Get customer ID for user:**
```javascript
const customerId = await getCustomerIdByUid(userId)
```

**Get user ID from Stripe customer:**
```javascript
const uid = await getUidByCustomerId(customerId)
```

**Check if user is premium:**
```javascript
const plan = await getUserSubscriptionPlan(uid)
const isPremium = plan === 'premium_monthly' || plan === 'premium_yearly'
```

## Security

- ✅ Webhook signature verification required
- ✅ All Stripe operations server-side only
- ✅ No client-side Stripe secret keys
- ✅ Idempotency for webhook processing
- ✅ Customer ID mapping prevents user impersonation

## Testing

### Stripe CLI Webhook Testing
```bash
# Listen to webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test events
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

### Environment Variables
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## Data Retention

- **Mappings:** Retained permanently for subscription history
- **Subscription data:** Updated in real-time
- **Canceled subscriptions:** Data preserved with `canceled` status
- **Account deletion:** Stripe data deleted, mapping removed

## Error Handling

### Duplicate Webhook Events
- Stripe may send same webhook multiple times
- Use idempotency checks
- Merge updates to prevent overwriting

### Missing User Document
- Create user profile if doesn't exist
- Log warning for investigation
- Gracefully handle edge cases

### Invalid Customer ID
- Log error with details
- Return 200 to Stripe (processed but failed)
- Alert admins for manual review

## Related Files

- Webhook Handler: `/src/app/api/stripe/webhook/route.ts`
- Admin Helpers: `/src/lib/firebase/admin.ts`
- Subscription Hook: `/src/hooks/useSubscription.ts`
- Checkout: `/src/app/pricing/page.tsx`

## Monitoring

- Track webhook processing time
- Alert on failed webhooks
- Monitor subscription churn rate
- Track payment failure rate
- Log all Stripe operations for audit
