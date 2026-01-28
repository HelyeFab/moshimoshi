# Entitlements Manual Test Playbook

Scope
- Entitlements gating (page + action)
- Usage quotas (daily/monthly)
- Offline snapshot + usage sync

Non-scope
- Stripe checkout flows
- Pricing page UI copy
- PWA install/update flows

---

## Preflight checklist

Environment
- Dev server running and reachable (use a consistent port).
- Test accounts available for guest, free, and premium.
- `ENTITLEMENTS_PRIVATE_KEY` set on server, `NEXT_PUBLIC_ENTITLEMENTS_PUBLIC_KEY` set in client env.

Data hygiene
- Clear localStorage keys before each session:
  - `entitlementsSnapshot`
  - `usageSnapshot`
  - `offlineUsageDelta`
  - `offlineUniqueUsage`
  - `auth-user-cache`
- Optional: clear IndexedDB caches for news/books if testing cached content behavior.

---

## Manual test matrix

### A) Page-level gating (EntitlementGate)

Goal: premium-only pages block free/guest correctly and redirect to pricing.

Steps
1) Open a premium-only route as guest (not signed in).
2) Confirm the login modal appears.
3) Sign in as free user and retry the same route.
4) Confirm redirect to `/<locale>/pricing?from=<featureId>`.
5) Sign in as premium user and retry.
6) Confirm access granted and page renders.

Expected
- Guest sees login modal.
- Free user is redirected to pricing with `from` param.
- Premium user has access without gating UI.

Notes
- Premium-only route list is in `PAYMENT_MONETIZATION_ONBOARDING.md`.

---

### B) Action-level gating (useFeature)

Goal: quota checks and tracking are enforced for action-level features.

Steps
1) Sign in as free user.
2) Choose a daily-limited feature (e.g., `grammar_explanations`).
3) Trigger the action until limit is reached.
4) Verify next attempt shows limit UI and action is blocked.
5) Sign in as premium user and repeat.

Expected
- Free user hits limit and is blocked.
- Premium user proceeds or is unlimited (depending on config).

---

### C) Usage snapshot storage (online)

Goal: online checks refresh usageSnapshot and snapshot policy version.

Steps
1) Clear localStorage keys.
2) Sign in and perform a `checkOnly` action (e.g., open a gated page with EntitlementGate).
3) Inspect localStorage for:
   - `entitlementsSnapshot` token
   - `usageSnapshot` entry for the feature

Expected
- `usageSnapshot[featureId]` exists with `{ used, limit, resetAtUtc }`.
- `entitlementsSnapshot` token is present and valid.

---

### D) Offline gating (bounded rules)

Goal: offline decisions rely on snapshot + usage snapshot; fail-closed on missing data.

Setup
- Ensure `entitlementsSnapshot` + `usageSnapshot` are present by running online checks first.

Steps
1) Toggle DevTools → Offline.
2) Retry a limited feature action.
3) Verify decision matches remaining usage.
4) Clear `usageSnapshot`, keep snapshot.
5) Retry the same action.

Expected
- Offline allows when snapshot + usage snapshot show remaining > 0.
- Offline denies when usage snapshot is missing (bounded rule).

---

### E) Offline delta tracking + sync

Goal: offline increments are recorded and reconciled on reconnect.

Steps
1) Ensure `usageSnapshot` exists for a limited feature.
2) Go offline.
3) Trigger the action 2–3 times.
4) Inspect `offlineUsageDelta` and `usageSnapshot` (used should increase).
5) Go back online.
6) Confirm `/api/usage/sync` runs and deltas are cleared.

Expected
- `offlineUsageDelta` increments while offline.
- On reconnect, deltas clear and `usageSnapshot` reflects server values.

---

### F) Unique-item features (news, kanji_mood_board)

Goal: rereading the same item offline should not consume extra quota.

Steps
1) Ensure `usageSnapshot` exists for `news`.
2) Go offline.
3) Open the same news article twice.
4) Inspect `offlineUniqueUsage`.
5) Open a different article.

Expected
- First read increments usage.
- Second read of the same item does not increment.
- New article increments usage and adds ID to `offlineUniqueUsage`.

---

### G) Snapshot expiry

Goal: offline access is denied when snapshot expires.

Steps
1) Note the `expiresAt` in the decoded snapshot (or wait past expiry).
2) Go offline after expiry.
3) Try a gated action.

Expected
- Access denied with a fail-closed decision.

---

## Debug tips

Local storage
- `entitlementsSnapshot`: signed token, decoded payload must match user + tier.
- `usageSnapshot`: per feature, used/limit/resetAtUtc in UTC ISO.
- `offlineUsageDelta`: per feature, local increments.
- `offlineUniqueUsage`: unique IDs for `news` and `kanji_mood_board`.
- `auth-user-cache`: offline fallback for `useAuth`.

Network
- Online checks use `/api/usage/:featureId/check`.
- Usage increments use `/api/usage/:featureId/increment`.
- Offline reconciliation uses `/api/usage/sync`.
- Snapshot token comes from `/api/entitlements/snapshot`.

---

## Pass criteria

- Gated routes enforce guest/free/premium behavior consistently.
- Usage limits are enforced online and offline.
- Offline decisions fail-closed when data is missing or stale.
- Offline deltas reconcile correctly and local caches clear on reconnect.
- Unique-item features do not double-count offline repeats.
