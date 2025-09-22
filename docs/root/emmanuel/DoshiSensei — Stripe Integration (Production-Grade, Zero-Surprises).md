# DoshiSensei — Stripe Integration (Production-Grade, Zero-Surprises)

**Date:** 2025-09-11  
**Stack:** Stripe + Firebase Auth + Firestore + **Google Cloud Functions Gen 2** (`firebase-functions` v2, Node 20)  
**Goal:** A *rock-solid*, **industry-standard** Stripe integration with near-zero avoidable issues: secure, idempotent, auditable, EU-ready, and easy to extend.

---

## 0) Principles & Non-negotiables

1. **Facts, not decisions:** Firestore stores **subscription facts** only. Entitlements are decided by the **policy engine** (separate).

2. **Idempotency everywhere:** Client requests pass **idempotency keys**. Webhooks dedupe by `event.id`. *All writes are idempotent upserts.*

3. **Strong verification:** Webhooks **must** verify `Stripe-Signature` using the **raw request body** and a signing secret from **Secret Manager**.

4. **At-least-once ready:** Handlers tolerate retries & reordering. Always safe to process twice.

5. **Minimal PII:** Store Stripe IDs and plan/status facts only. No card numbers; no unnecessary addresses.

6. **EU-ready:** Use Checkout for SCA/3DS. Optional Stripe Tax when needed. Data stored in EU region Firestore if required.

7. **Observability:** Append-only `logs/stripe/events` + per-user snapshots. Correlate via `event.id`, `request.id`.

8. **Security:** `defineSecret()` for secrets; least-privilege Firestore Security Rules; strict auth checks on callable endpoints.

9. **Replay-safe:** `/ops/stripe/processed_events/{eventId}` toggles used to ignore replays after successful apply.

10. **Separation of concerns:** Functions do mapping & write facts; client & entitlements read facts.

---

## 1) Repo Layout

`/functions/   src/     index.ts                   # Exported functions (webhooks + public endpoints)     secrets.ts                 # defineSecret() bindings     stripeClient.ts            # Stripe SDK init     webhook.ts                 # Webhook receiver (raw body, signature, router)     firestore.ts               # Firestore helpers (logs, idempotency, upserts, maps)     handlers/       subscriptions.ts         # subscription.* handlers       checkout.ts              # checkout.session.completed handler       invoices.ts              # invoice.payment_* handlers     mapping/stripeMapping.ts   # priceId → plan mapping   package.json   tsconfig.json /src/lib/firebase/client.ts    # client Firebase init /src/lib/stripe/api.ts         # client → server helpers (fetch) /src/lib/stripe/types.ts       # public types /firebase.json                 # functions config (region, node) /firestore.indexes.json /firestore.rules`

---

## 2) Firestore Schema (Facts + Logs + Maps)

### 2.1 User Facts (`/users/{uid}`)

`export type SubscriptionPlan = 'free'|'monthly'|'yearly'; export type SubscriptionStatus = 'active'|'incomplete'|'past_due'|'canceled'|'trialing';  export interface UserSubscriptionFacts {  plan: SubscriptionPlan;  status: SubscriptionStatus;   stripeCustomerId?: string;   stripeSubscriptionId?: string;   stripePriceId?: string;   currentPeriodEnd?: FirebaseFirestore.Timestamp;   cancelAtPeriodEnd?: boolean;   metadata?: { source: 'stripe'; updatedAt: FirebaseFirestore.Timestamp }; }  export interface UserDoc {  profileVersion: 1;  locale: string;  createdAt: FirebaseFirestore.Timestamp;  updatedAt: FirebaseFirestore.Timestamp;   subscription?: UserSubscriptionFacts;   // absent for guests }`

### 2.2 Logs (`/logs/stripe/events/{autoId}`)

`{   "ts": "2025-09-11T08:07:00Z",   "eventId": "evt_...",   "type": "customer.subscription.updated",   "requestId": "req_...",   "livemode": false,   "uid": "uid_123",   "objectId": "sub_...",   "payloadSummary": { "status": "active", "price": "price_123" },   "processing": { "deduped": false, "applied": true, "error": null } }`

### 2.3 Processed Events

- `/ops/stripe/processed_events/{eventId}` → prevents double application.

### 2.4 Maps

- `/stripe/byUid/uidToCustomer/{uid} = { customerId }`

- `/stripe/byCustomer/customerToUid/{customerId} = { uid }`

---

## 3) Secrets

`// /functions/src/secrets.ts import { defineSecret } from 'firebase-functions/params'; export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY'); export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');`

Store them in **Google Secret Manager**.

---

## 4) Stripe Client

`// /functions/src/stripeClient.ts import Stripe from 'stripe'; import { onInit } from 'firebase-functions/v2/core'; import { STRIPE_SECRET_KEY } from './secrets';  let stripe: Stripe; onInit(() => {   stripe = new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2024-06-20' }); }); export function getStripe(): Stripe { return stripe; }`

---

## 5) Price → Plan Mapping

`// /functions/src/mapping/stripeMapping.ts export const PRICE_TO_PLAN: Record<string, 'monthly'|'yearly'> = {  'price_monthly_xxx': 'monthly',  'price_yearly_yyy': 'yearly', }; export function toPlan(priceId?: string) {  return priceId ? PRICE_TO_PLAN[priceId] ?? null : null; }`

---

## 6) Webhook Receiver

``// /functions/src/webhook.ts import { onRequest } from 'firebase-functions/v2/https'; import { getStripe } from './stripeClient'; import { STRIPE_WEBHOOK_SECRET } from './secrets'; import { wasProcessed, markProcessed, logStripeEvent } from './firestore'; import { applyCheckoutCompleted } from './handlers/checkout'; import { applySubscriptionEvent } from './handlers/subscriptions'; import { applyInvoiceEvent } from './handlers/invoices';  export const stripeWebhook = onRequest(   { region: 'europe-west1', secrets: [STRIPE_WEBHOOK_SECRET], invoker: 'public' },  async (req, res) => {    if (req.method !== 'POST') return res.status(405).end();    const sig = req.headers['stripe-signature'] as string;    const stripe = getStripe();    let event;    try {       event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET.value());     } catch (err: any) {      return res.status(400).send(`Webhook error: ${err.message}`);     }    if (await wasProcessed(event.id)) return res.json({ duplicate: true });    await logStripeEvent(event);    try {      switch (event.type) {        case 'checkout.session.completed': await applyCheckoutCompleted(event); break;        case 'customer.subscription.created':        case 'customer.subscription.updated':        case 'customer.subscription.deleted': await applySubscriptionEvent(event); break;        case 'invoice.payment_succeeded':        case 'invoice.payment_failed': await applyInvoiceEvent(event); break;       }      await markProcessed(event.id);      return res.json({ received: true });     } catch (e) {      console.error(e);      return res.status(500).send('Handler error');     }   } );``

---

## 7) Public Endpoints

- **createCheckoutSession**

- **createBillingPortalSession**

Both require Firebase Auth bearer token + client idempotency key. They resolve/create a Stripe Customer, then return a session URL.

---

## 8) Security Rules

`match /users/{uid} {   allow read: if request.auth.uid == uid;   allow write: if false; // only Functions } match /logs/{doc=**} { allow read, write: if false; } match /ops/{doc=**} { allow read, write: if false; } match /stripe/{doc=**} { allow read, write: if false; }`

---

## 9) Parallel Work Plan

| Agent  | Scope                                | Files                                         | Acceptance                                   |
| ------ | ------------------------------------ | --------------------------------------------- | -------------------------------------------- |
| **A1** | Secrets, Stripe client, webhook base | `secrets.ts`, `stripeClient.ts`, `webhook.ts` | Webhook verified, events logged              |
| **A2** | Firestore helpers                    | `firestore.ts`                                | Processed events deduped, facts upserted     |
| **A3** | Handlers                             | `handlers/*.ts`, `mapping/stripeMapping.ts`   | Subscription/invoice events idempotent       |
| **A4** | Public endpoints & client helpers    | `index.ts`, `/src/lib/stripe/api.ts`          | Checkout/Portal work with auth + idempotency |

"# DoshiSensei — Stripe Integration (Production‑Grade, Zero‑Surprises)
**Date:** 2025‑09‑11  
**Stack:** Stripe + Firebase Auth + Firestore + **Google Cloud Functions Gen 2** (`firebase-functions` v2, Node 20)  
**Goal:** A *rock‑solid*, **industry‑standard** Stripe integration with near‑zero avoidable issues: secure, idempotent, auditable, EU‑ready, and easy to extend.

> This spec is designed for **4 agents** to implement in parallel with zero drift. It includes **TypeScript code skeletons**, **Firestore schema**, **secrets management**, **webhook verification**, **idempotency**, **retry safety**, **testing**, **emulator setup**, **indexes/security rules**, and **deployment**.

---

## 0) Principles & Non‑negotiables

1. **Facts, not decisions:** Firestore stores **subscription facts** only. Entitlements are decided by the **policy engine** (separate).  
2. **Idempotency everywhere:** Client requests pass **idempotency keys**. Webhooks dedupe by `event.id`. *All writes are idempotent upserts.*  
3. **Strong verification:** Webhooks **must** verify `Stripe-Signature` using the **raw request body** and a signing secret from **Secret Manager**.  
4. **At‑least‑once ready:** Handlers tolerate retries & reordering. Always safe to process twice.  
5. **Minimal PII:** Store Stripe IDs and plan/status facts only. No card numbers; no unnecessary addresses.  
6. **EU‑ready:** Use Checkout for SCA/3DS. Optional Stripe Tax when needed. Data stored in EU region Firestore if required.  
7. **Observability:** Append‑only `logs/stripe/events` + per‑user snapshots. Correlate via `event.id`, `request.id`.  
8. **Security:** `defineSecret()` for secrets; least‑privilege Firestore Security Rules; strict auth checks on callable endpoints.  
9. **Replay‑safe:** `/ops/stripe/processed_events/{eventId}` toggles used to ignore replays after successful apply.  
10. **Separation of concerns:** Functions do mapping & write facts; client & entitlements read facts.  

---

## 1) Repo Layout

/functions/
src/
index.ts # Exported functions (webhooks + public endpoints)
secrets.ts # defineSecret() bindings
stripeClient.ts # Stripe SDK init
webhook.ts # Webhook receiver (raw body, signature, router)
firestore.ts # Firestore helpers (logs, idempotency, upserts, maps)
handlers/
subscriptions.ts # subscription.* handlers
checkout.ts # checkout.session.completed handler
invoices.ts # invoice.payment_* handlers
mapping/stripeMapping.ts # priceId → plan mapping
package.json
tsconfig.json
/src/lib/firebase/client.ts # client Firebase init
/src/lib/stripe/api.ts # client → server helpers (fetch)
/src/lib/stripe/types.ts # public types
/firebase.json # functions config (region, node)
/firestore.indexes.json
/firestore.rules

php
Always show details

Copy code

---

## 2) Firestore Schema (Facts + Logs + Maps)

### 2.1 User Facts (`/users/{uid}`)

```ts
export type SubscriptionPlan = 'free'|'monthly'|'yearly';
export type SubscriptionStatus = 'active'|'incomplete'|'past_due'|'canceled'|'trialing';

export interface UserSubscriptionFacts {
  plan: SubscriptionPlan;                 // mapped from priceId
  status: SubscriptionStatus;             // normalized Stripe status
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodEnd?: FirebaseFirestore.Timestamp;
  cancelAtPeriodEnd?: boolean;
  metadata?: { source: 'stripe'; updatedAt: FirebaseFirestore.Timestamp };
}

export interface UserDoc {
  profileVersion: 1;
  locale: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  subscription?: UserSubscriptionFacts;   // ABSENT for guests
}
Conventions

Guests: no subscription. Free: { plan:'free', status:'active' }.

Write facts only. Never compute entitlements here.

2.2 Logs (/logs/stripe/events/{autoId})
jsonc
Always show details

Copy code
{
  "ts": "2025-09-11T08:07:00Z",
  "eventId": "evt_...",
  "type": "customer.subscription.updated",
  "requestId": "req_...",
  "livemode": false,
  "uid": "uid_123",
  "objectId": "sub_...",
  "payloadSummary": { "status": "active", "price": "price_123" },
  "processing": { "deduped": false, "applied": true, "error": null }
}
2.3 Processed Events (/ops/stripe/processed_events/{eventId})
Empty doc indicates event already applied.

TTL (optional) via Firestore TTL policy to purge old entries.

2.4 Maps
/stripe/byUid/uidToCustomer/{uid} = { customerId }

/stripe/byCustomer/customerToUid/{customerId} = { uid }

3) Secrets & Environment
3.1 Secret Manager (required)
STRIPE_SECRET_KEY (sk_live_* / sk_test_*)

STRIPE_WEBHOOK_SECRET (whsec_*)

ts
Always show details

Copy code
// /functions/src/secrets.ts
import { defineSecret } from 'firebase-functions/params';
export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
3.2 CLI Setup
bash
Always show details

Copy code
gcloud secrets create STRIPE_SECRET_KEY --replication-policy="automatic"
printf '%s' 'sk_test_XXXX' | gcloud secrets versions add STRIPE_SECRET_KEY --data-file=-

gcloud secrets create STRIPE_WEBHOOK_SECRET --replication-policy="automatic"
printf '%s' 'whsec_XXXX' | gcloud secrets versions add STRIPE_WEBHOOK_SECRET --data-file=-
4) Stripe Client (Server‑side)
ts
Always show details

Copy code
// /functions/src/stripeClient.ts
import Stripe from 'stripe';
import { onInit } from 'firebase-functions/v2/core';
import { STRIPE_SECRET_KEY } from './secrets';

let stripe: Stripe;

onInit(() => {
  const key = STRIPE_SECRET_KEY.value();
  stripe = new Stripe(key, { apiVersion: '2024-06-20' }); // pin exact version
});

export function getStripe(): Stripe {
  return stripe;
}
5) Price → Plan Mapping (Single Source)
ts
Always show details

Copy code
// /functions/src/mapping/stripeMapping.ts
export type Plan = 'monthly'|'yearly';
export const PRICE_TO_PLAN: Record<string, Plan> = {
  'price_monthly_xxx': 'monthly',
  'price_yearly_yyy': 'yearly',
};

export function toPlan(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  return PRICE_TO_PLAN[priceId] ?? null;
}
Keep mapping in VCS. If you rotate prices, add both old and new during transition windows.

6) Firestore Helpers (Idempotency + Facts + Maps)
ts
Always show details

Copy code
// /functions/src/firestore.ts
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import Stripe from 'stripe';

const db = getFirestore();

export async function wasProcessed(eventId: string) {
  const ref = db.collection('ops').doc('stripe').collection('processed_events').doc(eventId);
  const snap = await ref.get();
  return snap.exists;
}

export async function markProcessed(eventId: string) {
  const ref = db.collection('ops').doc('stripe').collection('processed_events').doc(eventId);
  await ref.set({ ts: Timestamp.now() }, { merge: true });
}

export async function logStripeEvent(event: Stripe.Event, extra?: Record<string, any>) {
  const ref = db.collection('logs').doc('stripe').collection('events').doc();
  const base: any = {
    ts: Timestamp.now(),
    eventId: event.id,
    type: event.type,
    livemode: event.livemode,
    requestId: (event.request as any)?.id ?? null,
  };
  await ref.set({ ...base, ...extra }, { merge: true });
}

export async function mapUidToCustomer(uid: string, customerId: string) {
  const batch = db.batch();
  const a = db.collection('stripe').doc('byUid').collection('uidToCustomer').doc(uid);
  const b = db.collection('stripe').doc('byCustomer').collection('customerToUid').doc(customerId);
  batch.set(a, { customerId }, { merge: true });
  batch.set(b, { uid }, { merge: true });
  await batch.commit();
}

export async function getCustomerIdByUid(uid: string): Promise<string | null> {
  const ref = db.collection('stripe').doc('byUid').collection('uidToCustomer').doc(uid);
  const snap = await ref.get();
  return snap.exists ? (snap.data() as any).customerId : null;
}

export async function getUidByCustomerId(customerId: string): Promise<string | null> {
  const ref = db.collection('stripe').doc('byCustomer').collection('customerToUid').doc(customerId);
  const snap = await ref.get();
  return snap.exists ? (snap.data() as any).uid : null;
}

export async function upsertUserSubscriptionByCustomerId(
  customerId: string,
  facts: Partial<{
    plan: 'monthly'|'yearly'|'free',
    status: string,
    stripeSubscriptionId: string | null,
    stripePriceId: string | null,
    currentPeriodEnd: number | null, // epoch seconds
    cancelAtPeriodEnd: boolean | null,
  }>
) {
  const uid = await getUidByCustomerId(customerId);
  if (!uid) throw new Error(`No uid mapped for customer ${customerId}`);
  const userRef = db.collection('users').doc(uid);

  const data = {
    subscription: {
      plan: (facts.plan ?? 'free'),
      status: facts.status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: facts.stripeSubscriptionId,
      stripePriceId: facts.stripePriceId,
      currentPeriodEnd: facts.currentPeriodEnd
        ? Timestamp.fromMillis(facts.currentPeriodEnd * 1000)
        : null,
      cancelAtPeriodEnd: facts.cancelAtPeriodEnd ?? null,
      metadata: { source: 'stripe', updatedAt: Timestamp.now() },
    }
  };
  await userRef.set(data, { merge: true });
}
7) Webhook Receiver (Raw Body + Signature)
ts
Always show details

Copy code
// /functions/src/webhook.ts
import { onRequest } from 'firebase-functions/v2/https';
import { getStripe } from './stripeClient';
import { STRIPE_WEBHOOK_SECRET } from './secrets';
import { logStripeEvent, markProcessed, wasProcessed } from './firestore';
import { applyCheckoutCompleted } from './handlers/checkout';
import { applySubscriptionEvent } from './handlers/subscriptions';
import { applyInvoiceEvent } from './handlers/invoices';

export const stripeWebhook = onRequest(
  {
    region: 'europe-west1',
    secrets: [STRIPE_WEBHOOK_SECRET],
    invoker: 'public',
    maxInstances: 5,
    concurrency: 1,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.set('Allow', 'POST');
      return res.status(405).send('Method Not Allowed');
    }
    const sig = req.headers['stripe-signature'] as string | undefined;
    if (!sig) return res.status(400).send('Missing signature');

    const stripe = getStripe();
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET.value());
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Dedupe
    if (await wasProcessed(event.id)) {
      return res.status(200).send({ received: true, duplicate: true });
    }

    await logStripeEvent(event);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await applyCheckoutCompleted(event);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await applySubscriptionEvent(event);
          break;
        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed':
          await applyInvoiceEvent(event);
          break;
        default:
          // ignore others, but stay idempotent
          break;
      }
      await markProcessed(event.id);
      return res.status(200).send({ received: true });
    } catch (err: any) {
      console.error('Webhook handler error', event.id, err);
      // do NOT mark processed; let Stripe retry
      return res.status(500).send('Webhook handler error');
    }
  }
);
8) Handlers (Idempotent)
ts
Always show details

Copy code
// /functions/src/handlers/checkout.ts
import Stripe from 'stripe';
import { toPlan } from '../mapping/stripeMapping';
import { mapUidToCustomer, upsertUserSubscriptionByCustomerId } from '../firestore';

export async function applyCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const customerId = session.customer as string | null;
  const uid = (session.customer_details?.metadata as any)?.uid
           || session.metadata?.uid
           || null;

  // If you created the customer in your authenticated endpoint, you already mapped uid<->customer
  if (uid && customerId) await mapUidToCustomer(uid, customerId);

  // Price can be read from line items (requires expand) or metadata
  const priceId = (session as any)?.line_items?.data?.[0]?.price?.id
               || session.metadata?.price_id
               || null;

  const plan = toPlan(priceId) ?? null;
  if (customerId) {
    await upsertUserSubscriptionByCustomerId(customerId, {
      plan: (plan ?? 'monthly'),
      status: 'active',
      stripeSubscriptionId: (session.subscription as string) || null,
      stripePriceId: priceId,
    });
  }
}
ts
Always show details

Copy code
// /functions/src/handlers/subscriptions.ts
import Stripe from 'stripe';
import { toPlan } from '../mapping/stripeMapping';
import { upsertUserSubscriptionByCustomerId } from '../firestore';

export async function applySubscriptionEvent(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const customerId = sub.customer as string;
  const item = sub.items.data[0] || null;
  const priceId = item?.price?.id ?? null;
  const plan = toPlan(priceId) ?? 'monthly';

  await upsertUserSubscriptionByCustomerId(customerId, {
    plan,
    status: sub.status,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
  });
}
ts
Always show details

Copy code
// /functions/src/handlers/invoices.ts
import Stripe from 'stripe';
import { upsertUserSubscriptionByCustomerId } from '../firestore';

export async function applyInvoiceEvent(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;
  const status = event.type === 'invoice.payment_succeeded' ? 'active' : 'past_due';

  await upsertUserSubscriptionByCustomerId(customerId, { status });
}
9) Public HTTPS Endpoints (Client → Server)
We expose two endpoints for the app UI:

Create Checkout Session (/functions:createCheckoutSession)

Create Billing Portal Session (/functions:createBillingPortalSession)

Both require Firebase Auth bearer token, validate uid, and accept a client idempotency key.

ts
Always show details

Copy code
// /functions/src/index.ts
import { onRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStripe } from './stripeClient';
import { STRIPE_SECRET_KEY } from './secrets';
import { stripeWebhook } from './webhook';
import { mapUidToCustomer, getCustomerIdByUid } from './firestore';

export { stripeWebhook };

function requireAuth(req: any): string {
  const authz = req.headers.authorization || '';
  const m = authz.match(/^Bearer (.*)$/);
  if (!m) throw new Error('Missing Authorization: Bearer <ID_TOKEN>');
  return m[1];
}

export const createCheckoutSession = onRequest(
  { region: 'europe-west1', secrets: [STRIPE_SECRET_KEY] },
  async (req, res) => {
    try {
      if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
      const idToken = requireAuth(req);
      const decoded = await getAuth().verifyIdToken(idToken);
      const uid = decoded.uid;

      const { priceId, successUrl, cancelUrl, idempotencyKey } = req.body || {};
      if (!priceId || !successUrl || !cancelUrl || !idempotencyKey) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const stripe = getStripe();
      const db = getFirestore();

      // Resolve or create customer
      let customerId = await getCustomerIdByUid(uid);
      if (!customerId) {
        const customer = await stripe.customers.create({ metadata: { uid } });
        customerId = customer.id;
        await mapUidToCustomer(uid, customerId);
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        metadata: { uid, price_id: priceId },
      }, { idempotencyKey });

      res.status(200).json({ url: session.url });
    } catch (err: any) {
      console.error('createCheckoutSession error', err);
      res.status(500).json({ error: 'Internal error' });
    }
  }
);

export const createBillingPortalSession = onRequest(
  { region: 'europe-west1', secrets: [STRIPE_SECRET_KEY] },
  async (req, res) => {
    try {
      if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
      const idToken = requireAuth(req);
      const decoded = await getAuth().verifyIdToken(idToken);
      const uid = decoded.uid;

      const { returnUrl } = req.body || {};
      if (!returnUrl) return res.status(400).json({ error: 'Missing returnUrl' });

      const stripe = getStripe();
      const customerId = await getCustomerIdByUid(uid);
      if (!customerId) return res.status(400).json({ error: 'No Stripe customer' });

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      res.status(200).json({ url: session.url });
    } catch (err: any) {
      console.error('createBillingPortalSession error', err);
      res.status(500).json({ error: 'Internal error' });
    }
  }
);
10) Client Helpers (Fetch + Idempotency)
ts
Always show details

Copy code
// /src/lib/stripe/api.ts
export async function postJSON(url: string, body: any) {
  const idToken = await window.firebase.auth().currentUser?.getIdToken(true);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function startCheckout(priceId: string, successUrl: string, cancelUrl: string) {
  const { url } = await postJSON('/functions/createCheckoutSession', {
    priceId, successUrl, cancelUrl, idempotencyKey: crypto.randomUUID(),
  });
  window.location.assign(url);
}

export async function openBillingPortal(returnUrl: string) {
  const { url } = await postJSON('/functions/createBillingPortalSession', { returnUrl });
  window.location.assign(url);
}
11) Firestore Security Rules (Least Privilege)
js
Always show details

Copy code
// /firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own user doc; write only limited fields client-side (if any).
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      // Writes to subscription facts come from Functions only.
      allow write: if false;
    }

    // Logs and ops are server-only.
    match /logs/{document=**} {
      allow read, write: if false;
    }
    match /ops/{document=**} {
      allow read, write: if false;
    }

    // Stripe maps are server-only.
    match /stripe/{document=**} {
      allow read, write: if false;
    }
  }
}
12) Firestore Indexes
Add composite indexes only as needed for the Admin UI. Minimal to start:

json
Always show details

Copy code
// /firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "ts", "order": "DESCENDING" }
      ]
    }
  ]
}
13) Local Development & Testing
13.1 Emulators
Use Stripe CLI to forward events to your local webhook.

bash
Always show details

Copy code
# 1) Start Firebase emulators (Functions + Firestore)
firebase emulators:start

# 2) In another terminal: forward Stripe events
stripe listen --forward-to http://127.0.0.1:5001/YOUR_PROJECT/europe-west1/stripeWebhook
# Copy the webhook secret (whsec_*) to your local env via 'functions:config' or Secret Manager emulator
13.2 Unit Tests
Test toPlan() mapping, Firestore upsert logic, idempotency (marking processed), and handler behavior with synthetic events.

13.3 Replay/Ordering Tests
Feed events out of order (invoice.payment_succeeded before subscription.updated) → handlers must remain consistent.

14) Deployment Checklist
Set Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.

Pin API version: Match the Stripe API version in dashboard settings.

Verify Webhook Endpoint: URL must match deployed region & function path.

Lock Rules: Ensure Firestore rules deny client writes to logs/ops/stripe maps.

Monitoring: Enable Error Reporting & Cloud Logging sinks with alerting on stripeWebhook errors.

Rollout: Deploy to staging first; verify end‑to‑end flow (Checkout → webhook → Firestore facts).

Backups: Optional scheduled export of /logs/stripe/events for audit.

15) Parallel Work Plan (4 Agents)
Agent    Scope    Files    Acceptance
A1    Secrets, Stripe client, webhook receiver    secrets.ts, stripeClient.ts, webhook.ts    Webhook signature verified; events received & logged
A2    Firestore helpers & idempotency    firestore.ts    Processed events deduped; facts upserted; maps maintained
A3    Business handlers    handlers/*.ts, mapping/stripeMapping.ts    Subscriptions/invoices/checkout idempotent; mapping correct
A4    Public endpoints & client helpers    index.ts, /src/lib/stripe/api.ts    Checkout/Portal endpoints auth‑safe; client idempotency verified

16) Failure Modes & Mitigations
Duplicate webhooks: Ignored via processed_events guard.

Out‑of‑order events: Handlers are upserts; last write wins with correct facts.

Missing uid ↔ customer map: Create map on first checkout creation; also accept metadata.uid if present.

Webhook signature mismatch: Return 400; investigate endpoint URL & secret.

Stripe retries during deploy: Safe; keep idempotency.

Price rotation: Temporarily keep old + new prices in mapping.

17) Data Flow Summary
Client calls createCheckoutSession with priceId (+ idempotencyKey).

Function verifies auth, resolves/creates Customer, creates Checkout Session.

User pays; Stripe fires checkout.session.completed + subscription.*.

Webhook verifies signature, dedupes by event.id, logs, applies handler(s).

Handlers upsert facts in /users/{uid}.subscription.

Entitlements layer reads plan/status and evaluates policy.

18) Copy‑Paste Snippets
Stripe CLI:

bash
Always show details

Copy code
stripe login
stripe listen --forward-to http://127.0.0.1:5001/PROJECT/europe-west1/stripeWebhook
Create Monthly Checkout (client):

ts
Always show details

Copy code
await startCheckout(process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!, location.origin + '/account?upgrade=success', location.origin + '/pricing');
Open Billing Portal (client):

ts
Always show details

Copy code
await openBillingPortal(location.origin + '/account');
19) Definition of Done (DoD)
Webhooks verified & idempotent.

Facts reflect Stripe source of truth after full cycle (create→update→cancel).

Security rules prevent client tampering.

Observability: logs + alerts.

E2E tests pass in staging.
```

## Appendix A — Interface Contracts (Must Honor)

### A1. Firestore Helpers → Handlers

- **Contract:**
  
  - `upsertUserSubscriptionByCustomerId(customerId, facts)`
  
  - Must be idempotent and merge facts without erasing unrelated fields.

- **Expectation:**
  
  - Handlers never talk to Firestore directly, only through this function.

### A2. Mapping → Handlers

- **Contract:**
  
  - `toPlan(priceId)` returns `'monthly' | 'yearly' | null`.

- **Expectation:**
  
  - Handlers must treat `null` as fallback and log discrepancy.

### A3. Webhook → Handlers

- **Contract:**
  
  - All handlers accept `(event: Stripe.Event)` and return `Promise<void>`.

- **Expectation:**
  
  - Handlers **never throw** on unknown shape; they default to safe no-ops.

### A4. Client → Public Endpoints

- **Contract:**
  
  - Endpoints require: `{ priceId, successUrl, cancelUrl, idempotencyKey }` (checkout)
  
  - `{ returnUrl }` (portal)

- **Expectation:**
  
  - Clients must always send a fresh `idempotencyKey`.

---

## Appendix B — Mock Strategies (Independent Testing)

### B1. Secrets

- Mock `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with fake strings in unit tests.

### B2. Stripe SDK

- Use **Stripe’s official mock library** (`stripe-mock`) or stub methods:
  
  - `customers.create` → return `{ id: 'cus_test123' }`
  
  - `checkout.sessions.create` → return `{ url: 'https://test/checkout' }`

### B3. Firestore

- Use Firebase Emulator Suite or **in-memory stubs** for unit tests.

- Agents may swap Firestore calls with `jest.fn()` mocks for handler tests.

### B4. Events

- Generate mock events via Stripe CLI:
  
  `stripe trigger checkout.session.completed stripe trigger customer.subscription.updated`

- Store JSON fixtures under `/tests/fixtures/`.

---

## Appendix C — Dependency Order

1. **A1 (Secrets & Webhook Base)**
   
   - Must deliver secrets bindings + webhook receiver skeleton **first**, so others can hook into it.

2. **A2 (Firestore Helpers)**
   
   - Provides idempotency, logging, and upsert functions. Must be ready before handlers are finalized.

3. **A3 (Business Handlers)**
   
   - Depend on Firestore helpers + mapping. Cannot ship before A2.

4. **A4 (Public Endpoints + Client Helpers)**
   
   - Depend on A1 (Stripe client) and A2 (customer mapping).

**Critical path:** A1 → A2 → A3 → A4.

---

## Appendix D — Integration Test Ownership

- **A1 (Webhook base):**  
  Owns **signature verification tests** (invalid signature → 400, valid signature → passes).

- **A2 (Firestore helpers):**  
  Owns **idempotency tests** (replay same event → no double increment, logs intact).

- **A3 (Handlers):**  
  Owns **fact-writing tests** (subscription updated → facts match Stripe payload).

- **A4 (Public endpoints):**  
  Owns **end-to-end flow tests** (checkout session creation, portal session creation, success URLs).

**Shared:**

- Final E2E (staging) runs with real Stripe test keys + Firebase Emulator.

- Test runner rotates responsibility weekly.
