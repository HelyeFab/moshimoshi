# DoshiSensei — Entitlements & Subscriptions (v2) — **Master Spec**
**Version:** 2025-09-11  
**Owner:** Emmanuel (Product/Tech Lead)  
**Goal:** A single, exhaustive document for a unified entitlement system. Multiple developers (agents) should be able to work in parallel with no drift.  

---

## 0) Executive Summary

We are building **Entitlements v2** for DoshiSensei.  
This system controls who can practice **Hiragana** and **Katakana**, how often, and under which subscription plan.  

Key principles:
- **One schema to rule them all** (`features.v1.json`).  
- **Generated artifacts** (registry, enums, limits) from schema.  
- **Pure policy evaluator** (`evaluate()` returns a Decision).  
- **Atomic usage API** (`/api/usage/:featureId/increment`) with **idempotency**.  
- **Flat subscription facts** in `/users/{uid}` (no logic here).  
- **Stripe webhooks** write subscription facts.  
- **UI access hook** makes gating one-liner.  
- **Decision logs** for auditing & admin tools.  

---

## 1) Repository Layout
```
/config/features.v1.json                 # Single Source Schema
/scripts/gen-entitlements.ts             # Codegen
/src/types/FeatureId.ts                  # GENERATED union of feature IDs
/src/lib/access/permissionMap.ts         # GENERATED enum Permission
/src/lib/features/registry.ts            # GENERATED registry
/src/lib/entitlements/policy.ts          # GENERATED policy (limits + version)
/src/lib/entitlements/evaluator.ts       # Pure evaluator
/src/pages/api/usage/[featureId].ts      # Atomic increment API
/src/hooks/useFeature.ts                 # Client hook
/src/lib/firebase/server.ts              # Firestore Admin (server)
/src/lib/firebase/client.ts              # Firebase client init
/functions/src/index.ts                  # Firebase Functions: Stripe webhooks
/functions/src/stripeMapping.ts          # Stripe price→plan mapping
/admin/decision-explorer/                # Admin UI for logs & diffs
/tests/evaluator.spec.ts                 # Unit tests for evaluate()
/tests/snapshot.matrix.spec.ts           # Snapshot of plan×feature
/tests/e2e/hiragana-katakana.e2e.ts      # E2E Guest→Free→Premium flows
```

---

## 2) Single Source Schema (SSS)

**File:** `/config/features.v1.json`

```jsonc
{
  "version": 1,
  "features": [
    {
      "id": "hiragana_practice",
      "name": "Hiragana Practice",
      "category": "learning",
      "lifecycle": "active",
      "permission": "do_practice",
      "limitType": "daily",
      "notifications": true
    },
    {
      "id": "katakana_practice",
      "name": "Katakana Practice",
      "category": "learning",
      "lifecycle": "active",
      "permission": "do_practice",
      "limitType": "daily",
      "notifications": true
    }
  ],
  "plans": ["guest","free","premium_monthly","premium_yearly"],
  "limits": {
    "guest":    { "daily": { "hiragana_practice": 3, "katakana_practice": 3 } },
    "free":     { "daily": { "hiragana_practice": 5, "katakana_practice": 5 } },
    "premium_monthly": { "daily": { "hiragana_practice": -1, "katakana_practice": -1 } },
    "premium_yearly":  { "daily": { "hiragana_practice": -1, "katakana_practice": -1 } }
  }
}
```

---

## 3) Policy Engine

**File:** `/src/lib/entitlements/evaluator.ts`

### 3.1 Function signature
```ts
export function evaluate(featureId: FeatureId, ctx: EvalContext): Decision
```

### 3.2 Context
```ts
interface EvalContext {
  userId: string;
  plan: 'guest'|'free'|'premium_monthly'|'premium_yearly';
  usage: Record<FeatureId, number>; 
  nowUtcISO: string;
  overrides?: { [f in FeatureId]?: number | 'unlimited' };
  tenant?: { id?: string; dailyCaps?: Record<FeatureId, number> };
}
```

### 3.3 Decision
```ts
interface Decision {
  allow: boolean;
  remaining: number | -1;
  reason: 'ok'|'no_permission'|'limit_reached'|'lifecycle_blocked';
  policyVersion: number;
  resetAtUtc?: string;
}
```

### 3.4 Logic
- Check lifecycle → block hidden/deprecated.  
- Check permission → map plan → allowed permissions.  
- Compute effective limit = min(planLimit, tenantCap, override).  
- Compare usage → remaining.  
- Return Decision.  

---

## 4) Atomic Usage API

**File:** `/src/pages/api/usage/[featureId].ts`

### 4.1 Endpoint
```
POST /api/usage/hiragana_practice/increment
POST /api/usage/katakana_practice/increment
```

### 4.2 Body
```json
{ "idempotencyKey": "uuid" }
```

### 4.3 Flow
1. Resolve `uid` & plan from Firestore `/users/{uid}`.  
2. Start Firestore **transaction**:  
   - Read today’s usage bucket (`/usage/{uid}/daily/{YYYY-MM-DD}`).  
   - Run `evaluate()`.  
   - If allow → increment usage count.  
   - Always log decision in `/logs/entitlements`.  
3. Return `Decision`.  

---

## 5) Firebase User Profile Schema

**Collection:** `/users/{uid}`

```ts
interface UserDoc {
  profileVersion: 1;
  locale: string;          // e.g., 'en', 'ja'
  createdAt: Timestamp;
  updatedAt: Timestamp;
  subscription?: {
    plan: 'free' | 'monthly' | 'yearly';
    status: 'active'|'incomplete'|'past_due'|'canceled'|'trialing';
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    currentPeriodEnd?: Timestamp;
    cancelAtPeriodEnd?: boolean;
    metadata?: {
      source: 'stripe';
      createdAt: Timestamp;
      updatedAt: Timestamp;
    };
  };
}
```

---

## 6) Stripe Integration

**Functions:** `/functions/src/index.ts`

- Listen to:  
  - `customer.subscription.created`  
  - `customer.subscription.updated`  
  - `customer.subscription.deleted`  

- For each:  
  - Map Stripe `priceId` → plan (`monthly` or `yearly`) via `stripeMapping.ts`.  
  - Write flat subscription facts into `/users/{uid}.subscription`.  
  - Never write entitlements logic — only facts.  

**Example Mapping**
```ts
export const PRICE_MAP: Record<string, 'monthly'|'yearly'> = {
  "price_123": "monthly",
  "price_456": "yearly"
};
```

---

## 7) Decision Logs

**Collection:** `/logs/entitlements/{autoId}`

```jsonc
{
  "ts": "2025-09-11T08:00:00Z",
  "userId": "uid_123",
  "featureId": "hiragana_practice",
  "plan": "free",
  "usageBefore": 4,
  "limit": 5,
  "allow": true,
  "remaining": 0,
  "reason": "ok",
  "policyVersion": 1,
  "idempotencyKey": "uuid"
}
```

---

## 8) Client Hook

**File:** `/src/hooks/useFeature.ts`

```ts
const { checkAndTrack } = useFeature('hiragana_practice');
if (await checkAndTrack({ showUI: true })) {
  // Start session
}
```

---

## 9) Parallel Work Plan (for 4 agents)

| Agent | Focus | Files | Deliverable |
|-------|-------|-------|-------------|
| **A1 (Schema & Codegen)** | Define `/config/features.v1.json`, implement `gen-entitlements.ts`. | `/config`, `/scripts` | Generated artifacts in sync. |
| **A2 (Evaluator & API)** | Build `evaluator.ts` & Firestore-backed API. | `/src/lib/entitlements`, `/src/pages/api/usage/[featureId].ts` | `evaluate()` + atomic increment API. |
| **A3 (Profiles & Stripe)** | Define `/users/{uid}` schema & Functions. | `/functions/src`, `/lib/firebase/server.ts` | Subscription facts updated from Stripe. |
| **A4 (Client & Admin)** | Hook + decision logging + Admin Explorer. | `/src/hooks`, `/admin` | UI hook works, logs visible in Admin. |

---

## 10) Testing Plan

- **Unit:** `evaluate()` edge cases.  
- **Snapshot:** Plan × Feature matrix.  
- **Integration:** API increment with Firestore emulator.  
- **E2E:** Guest (3/day), Free (5/day), Premium (unlimited).  

---

✅ With this document, 4 separate agents can implement in parallel and produce one **unified entitlement + subscription system** centered on **Hiragana/Katakana practice**.  
