# 1) Test Plan (Staging Firestore + Stripe Test Mode)

### 🎯 Goals

- Verify subscription lifecycle flows (checkout → active → cancel → renewal).

- Ensure idempotency (no double writes on replay).

- Validate Firestore documents reflect Stripe source of truth.

- Confirm access layer can read correct `plan` and `status`.

---

## Phase A — Setup

1. **Stripe CLI forwarder**
   
   `stripe listen --forward-to https://<YOUR_PROJECT>.cloudfunctions.net/stripeWebhook`
   
   This gives you a `whsec_XXXX` secret. Add it to Firebase Secret Manager.

2. **Secrets in Firebase**
   
   `gcloud secrets versions add STRIPE_SECRET_KEY --data-file=<(echo "sk_test_xxx") gcloud secrets versions add STRIPE_WEBHOOK_SECRET --data-file=<(echo "whsec_xxx")`

3. **Environment Variables** (local `.env` for client/dev scripts)  
   Use the `.env.example` I’ll generate below.

---

## Phase B — Unit Tests (Local, Fast)

- **Handlers**
  
  - Test `applySubscriptionEvent` with synthetic JSON events → Firestore updated correctly.
  
  - Test `applyInvoiceEvent` sets status `active`/`past_due`.

- **Firestore Helpers**
  
  - Test `wasProcessed` and `markProcessed` to confirm idempotency.
  
  - Test `upsertUserSubscriptionByCustomerId` merges facts safely.

---

## Phase C — Integration Tests (Staging Firestore)

- **Checkout Flow**
  
  1. Call `createCheckoutSession` endpoint with a test user UID + monthly `price_id`.
  
  2. Complete checkout via Stripe’s test card (`4242 4242 4242 4242`).
  
  3. Verify Firestore `/users/{uid}/subscription` shows `plan: 'monthly'`, `status: 'active'`.

- **Update Flow**
  
  1. In Stripe Dashboard → upgrade subscription from monthly to yearly.
  
  2. Webhook fires `customer.subscription.updated`.
  
  3. Verify Firestore updated with new `priceId` and `plan: 'yearly'`.

- **Cancel Flow**
  
  1. Cancel subscription in Dashboard (or via Billing Portal).
  
  2. Webhook fires `customer.subscription.deleted`.
  
  3. Firestore shows `status: 'canceled'`.

- **Invoice Failure**
  
  1. Use Stripe test card `4000 0000 0000 0341` (fails payment).
  
  2. Webhook `invoice.payment_failed` updates Firestore → `status: 'past_due'`.

---

## Phase D — Idempotency & Replay

1. Replay webhook:
   
   `stripe events resend <event_id>`
   
   Firestore should remain unchanged (no double writes).

2. Simulate out-of-order events (`invoice.payment_succeeded` before `subscription.updated`) → Firestore must reflect the *latest status*.

---

## Phase E — Observability

- Check `/logs/stripe/events` → every event appended with `applied: true`.

- Check `/ops/stripe/processed_events` → event IDs present.

- Cross-check Firestore `users/{uid}/subscription` matches latest Stripe Dashboard state.

---

# 2) `.env.example`

Put this in your project root as `.env.example`:

`# --- Firebase --- FIREBASE_PROJECT_ID=your-firebase-project-id FIREBASE_REGION=europe-west1  # --- Stripe (Test Mode) --- STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx  # --- Stripe Prices (Test Mode) --- STRIPE_PRICE_MONTHLY=price_xxxxxxxxxxxxxxxx STRIPE_PRICE_YEARLY=price_yyyyyyyyyyyyyyyy  # --- Client (public vars) --- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx  # --- Misc --- # Default success/cancel return URLs (can be overridden at runtime) STRIPE_SUCCESS_URL=http://localhost:3000/account?upgrade=success STRIPE_CANCEL_URL=http://localhost:3000/pricing`

Copy it to `.env.local` (for client) and to your **Firebase Functions config** (`gcloud secrets` for server-side keys).
