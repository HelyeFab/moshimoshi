# Entitlements API Reference

**Status:** ACTIVE  
**Last Updated:** 2026-01-30

## Overview
These endpoints provide entitlement checks, usage increments, and admin tooling for entitlements.

## Core Endpoints

### GET `/api/usage/[featureId]/check`
**Purpose:** Check access without incrementing usage.

**Auth:** Required (guest returns guest-tier decision).

**Query Params (optional):**
- `itemId` / `boardId` — for unique-item features (dedupes repeats).

**Response (Decision + metadata):**
```json
{
  "allow": true,
  "remaining": 3,
  "reason": "ok",
  "policyVersion": 1,
  "resetAtUtc": "2026-02-01T00:00:00.000Z",
  "limit": 5,
  "usageBefore": 2,
  "featureId": "comics",
  "currentUsage": 2,
  "bucketKey": "comics_2026-01",
  "plan": "free"
}
```

**Notes:**
- Pulls **fresh** Firestore subscription plan.
- Unique-item features allow repeats without consuming quota.

---

### POST `/api/usage/[featureId]/increment`
**Purpose:** Check access and increment usage atomically (if allowed).

**Auth:** Required (guest returns guest-tier decision).

**Body:**
```json
{
  "idempotencyKey": "feature-<timestamp>-<random>",
  "itemId": "optional-unique-item-id"
}
```

**Response:**
```json
{
  "allow": true,
  "remaining": 2,
  "reason": "ok",
  "policyVersion": 1,
  "resetAtUtc": "2026-02-01T00:00:00.000Z",
  "limit": 5,
  "usageBefore": 2,
  "incremented": true
}
```

**Notes:**
- Uses idempotency docs to prevent double-counting.
- If `itemId` repeats for unique-item features, increment is skipped.

---

## Admin Endpoints

### GET `/api/admin/entitlements/config`
Returns the JSON config used by entitlements.

### GET `/api/admin/entitlements/types`
Returns the generated TS types and registry info; may auto-regenerate if mismatched.

### POST `/api/admin/entitlements/generate`
Regenerates TypeScript entitlements files from config.

---

## Decision Object
```ts
interface Decision {
  allow: boolean;
  remaining: number | -1;
  reason: 'ok' | 'no_permission' | 'limit_reached' | 'lifecycle_blocked';
  policyVersion: number;
  resetAtUtc?: string;
  limit?: number;
  usageBefore?: number;
  incremented?: boolean;
}
```

## Related Files
- `src/app/api/usage/[featureId]/check/route.ts`
- `src/app/api/usage/[featureId]/increment/route.ts`
- `src/lib/entitlements/evaluator.ts`
