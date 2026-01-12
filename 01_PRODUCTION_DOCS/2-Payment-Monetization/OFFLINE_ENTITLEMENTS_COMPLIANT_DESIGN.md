# Offline Entitlements: Compliant Design (Graceful but Bounded)

Purpose
- Preserve offline UX while enforcing entitlement limits and avoiding tier/usage bypass.
- Keep behavior consistent with existing online entitlements policy and EntitlementGate.

Non-goals
- No changes to pricing tiers (monthly vs yearly are identical).
- No new product features; this is enforcement + offline safety only.

## Design summary

Principles
- Offline access is allowed only when we can prove a valid tier and a bounded usage window.
- Unknown/stale tier or usage data = fail-closed for gated features.
- Unlimited features can be allowed offline if tier is valid.

Key components
1) Signed entitlement snapshot (tier proof)
- Server issues signed snapshot on successful session/auth refresh.
- Stored client-side as `entitlementsSnapshot`.
- Offline: only trust snapshot if signature valid and not expired.

2) Usage snapshot (bounded usage window)
- Cache per feature: `{ used, limit, resetAtUtc }` from API responses.
- Offline decision uses snapshot + offline delta.

3) Offline usage delta (local increments)
- While offline, increments are recorded locally: `offlineUsageDelta[featureId] += 1`.
- On reconnect, client syncs delta to server via an idempotent endpoint.

4) Decision cache isolation
- Cache decisions separately for online vs offline. Invalidate on connectivity change.

5) Tier storage rules
- Stop using `localStorage.userTier` for offline decisions.
- Only use the signed snapshot as the tier source.

## Integration gaps found in current implementation (must fix)

These are required for full approval and correct integration with existing entitlements storage.

1) Usage schema mismatch in sync
- Current sync writes to `usageData.counts` but the rest of the system reads `usageDoc.data()[featureId]`.
- Impact: synced usage is ignored, limits appear reset, and offline deltas are lost.
- Fix: write counts at the top level (same schema used by `/api/usage/[featureId]/check` and `/increment`).

2) Bucket calculation mismatch for monthly limits
- Sync uses `getTodayBucket`, but `check`/`increment` use `getBucketKey(featureId, userId, nowUtcISO)`.
- Impact: monthly-limited features never reconcile correctly.
- Fix: compute bucket per feature with `getBucketKey(featureId, userId, nowUtcISO)` inside the sync loop.

3) Feature validation is incomplete
- Sync uses a hard-coded `VALID_FEATURES` subset.
- Impact: offline deltas are dropped for features not in the list.
- Fix: validate against `FEATURE_IDS` (or config) to match the rest of the API.

## How to fix (code-level guide)

Update the sync endpoint to align with the canonical usage schema and bucket rules:

1) Replace the sync bucket usage
- Use `getBucketKey(featureId, userId, nowUtcISO)` per feature, not `getTodayBucket`.

2) Align usage storage schema
- Read/write usage counts at the top level of the usage document.
- Example structure:
  - { userId, date, updatedAt, hiragana_practice: 2, kanji_browser: 5, ... }

3) Validate feature IDs against the authoritative list
- Import and use `FEATURE_IDS` (same as check/increment).

4) Return accurate snapshots
- For each feature synced, return `{ used, limit, resetAtUtc }` matching the evaluate() decision.

## Reference patch (sync endpoint)

Use this as the target shape; adjust imports/paths to match your codebase.

```ts
// src/app/api/usage/sync/route.ts (core loop only)
import { FEATURE_IDS } from '@/types/FeatureId'
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator'

const VALID_FEATURES = new Set(FEATURE_IDS)

for (const [featureKey, deltaValue] of Object.entries(deltas)) {
  const featureId = featureKey as FeatureId
  if (!VALID_FEATURES.has(featureId)) continue
  const delta = Number(deltaValue)
  if (!Number.isFinite(delta) || delta <= 0) continue

  const bucketKey = getBucketKey(featureId, userId, nowUtcISO)
  const usageRef = adminDb
    .collection('users')
    .doc(userId)
    .collection('usage')
    .doc(bucketKey)

  const usageDoc = await transaction.get(usageRef)
  const usageData = usageDoc.exists
    ? (usageDoc.data() as UsageBucket)
    : { userId, date: bucketKey, updatedAt: nowUtcISO }

  const usageBefore = (usageData[featureId] as number) || 0
  const context = { userId, plan, usage: { [featureId]: usageBefore }, nowUtcISO }
  const decision = evaluate(featureId, context)
  const limit = decision.limit ?? 0

  const remaining = limit === -1 ? delta : Math.max(0, limit - usageBefore)
  const appliedDelta = limit === -1 ? delta : Math.min(delta, remaining)
  const nextUsed = usageBefore + appliedDelta

  usageData[featureId] = nextUsed
  usageData.updatedAt = nowUtcISO
  transaction.set(usageRef, usageData)

  nextSnapshots[featureId] = {
    used: nextUsed,
    limit,
    resetAtUtc: decision.resetAtUtc || nowUtcISO
  }
}
```

## Data structures

Client storage keys
- `entitlementsSnapshot` (string, signed JSON)
- `usageSnapshot` (JSON object)
- `offlineUsageDelta` (JSON object)

Suggested shapes
- Entitlement snapshot payload (signed)
  {
    "userId": "...",
    "tier": "premium" | "free" | "guest",
    "issuedAt": "2026-01-12T12:34:56Z",
    "expiresAt": "2026-01-13T12:34:56Z",
    "policyVersion": 1
  }

- Usage snapshot
  {
    "featureId": {
      "used": 3,
      "limit": 5,
      "resetAtUtc": "2026-01-13T00:00:00Z"
    }
  }

- Offline usage delta
  {
    "featureId": 2
  }

## Offline decision rules

Given a featureId and current time:
1) Validate entitlement snapshot
- Reject if missing, expired, or signature invalid.
- If invalid: deny for gated features (fail-closed).

2) Determine limit
- If feature is unlimited for tier: allow.
- If limited: require usage snapshot.
- If missing usage snapshot: deny (bounded rule).

3) Evaluate remaining
- usedEffective = usageSnapshot.used + offlineUsageDelta
- remaining = max(0, limit - usedEffective)
- If remaining > 0: allow
- Else deny with reason `limit_reached`.

4) Reset window
- If resetAtUtc is in the past, deny until online refresh.

## Online flow
- `useFeature.checkOnly` calls `/api/usage/:feature/check`.
- Server responds with `allow`, `remaining`, `limit`, `resetAtUtc`, `policyVersion`.
- Client stores/refreshes:
  - `usageSnapshot[featureId]`
  - `entitlementsSnapshot` (from session refresh or dedicated endpoint)

## Offline flow
- `useFeature.checkOnly` uses the offline rules above.
- `checkAndTrack` increments `offlineUsageDelta[featureId]` and updates `usageSnapshot` locally.

## Sync on reconnect
- New endpoint: `POST /api/usage/sync` with `offlineUsageDelta` and an idempotency key.
- Server validates tier, merges deltas, returns fresh usage snapshot for updated features.
- Client clears synced deltas and refreshes snapshots.

## API changes

1) Session/entitlements snapshot
- Add an endpoint or session field that returns the signed snapshot.
- Example: `GET /api/entitlements/snapshot`

2) Usage sync
- `POST /api/usage/sync`
  - Body: `{ deltas: { featureId: number }, clientTimestamp, idempotencyKey }`
  - Response: `{ snapshots: { featureId: { used, limit, resetAtUtc } } }`

## Security notes
- Snapshot must be signed server-side; do not trust client-written tier.
- Snapshot expiry should be short (e.g., 24h or less).
- Usage snapshots must come from server responses only.

## Operational notes
- Invalidate offline decision cache on online/offline transitions.
- Do not overwrite cached tier with SWR fallback data.

---

# Agent implementation prompt

Implement the “Offline Entitlements: Compliant Design (Graceful but Bounded)” policy for Moshimoshi.

Constraints
- Monthly and yearly premium entitlements are identical.
- Offline access is allowed only with a valid signed entitlement snapshot and a bounded usage snapshot.
- Unknown or stale data must fail-closed for gated features.
- Keep existing tests and entitlement APIs intact where possible.

Tasks
1) Add server-side signed entitlement snapshot
- Expose a new endpoint or add to session response.
- Snapshot includes: userId, tier, issuedAt, expiresAt, policyVersion.
- Sign with server secret (HMAC/JWT).

2) Add client-side snapshot validation
- Store in localStorage.
- Validate signature and expiry before use.

3) Implement offline usage snapshot + delta
- Persist `usageSnapshot` and `offlineUsageDelta` to localStorage.
- Update `useFeature` offline path to use these for allow/deny.

4) Add offline usage sync
- Create `POST /api/usage/sync` endpoint.
- Merge deltas on server; return refreshed snapshots.
- Client clears deltas after successful sync.

5) Decision cache isolation
- Invalidate decision cache when `navigator.onLine` changes.

6) Remove reliance on `localStorage.userTier` for offline entitlements
- Use signed snapshot tier only.
- Prevent SWR fallback from downgrading tier while offline.

Acceptance criteria
- Offline allows only if snapshot is valid and usage snapshot shows remaining > 0.
- Offline denies when snapshot missing/expired or usage snapshot missing for limited features.
- Reconnect sync correctly updates usage and clears deltas.
- No entitlement bypass via localStorage modifications.
- Existing entitlement tests still pass; add tests for offline snapshot validation and offline usage bounds.

Files likely to change
- `src/hooks/useFeature.ts`
- `src/hooks/useAuth.ts`
- `src/hooks/useSubscription.ts`
- `src/lib/pwa/offline-entitlements.ts` (replace with snapshot validation)
- New: `src/lib/pwa/offline-usage.ts`
- New: `src/app/api/entitlements/snapshot/route.ts` (or similar)
- New: `src/app/api/usage/sync/route.ts`
