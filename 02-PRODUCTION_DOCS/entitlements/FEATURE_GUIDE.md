# Entitlements & Gating – Feature Guide

**Status:** ACTIVE  
**Last Updated:** 2026-02-04

## Overview
This guide documents how entitlements are configured and enforced across the app. It covers client gating patterns, server enforcement, and the UX standards for quotas and premium-only features.

## Architecture
1. **Config (source of truth)**
   - `config/features.v1.json` defines plans, features, limitType, and limits.
2. **Generated artifacts**
   - `src/types/FeatureId.ts` (FeatureId union)
   - `src/lib/entitlements/policy.ts` (PLAN_LIMITS, POLICY_VERSION)
   - `src/lib/features/registry.ts` (feature metadata)
3. **Evaluator**
   - `src/lib/entitlements/evaluator.ts` produces `Decision` from plan + usage + overrides.
4. **API enforcement**
   - `GET /api/usage/[featureId]/check` and `POST /api/usage/[featureId]/increment`
   - Always uses fresh Firestore plan data (never trust session tier).
5. **Client enforcement**
   - `useFeature()` handles checks, increments, caching, and toasts.
   - `EntitlementGate` for page-level gating.

## Configuration
### Add or update a feature
1. Edit `config/features.v1.json`
   - Define feature id, limitType (`daily` or `monthly`), lifecycle, and limits per plan.
2. Regenerate entitlements
   - `npm run gen:entitlements` (or Admin → Entitlements → Regenerate Types).
3. Update UI
   - Use `useFeature()` to enforce access.
   - Add optional usage display (`FeatureUsageIndicator`).

### Limit semantics
- `-1`: Unlimited access
- `0`: Fully blocked
- `>0`: Quota per limitType

## Gating Patterns
### Pattern A: Page-level gate (premium-only)
Use `EntitlementGate` when the feature is all-or-nothing.
- Example: premium-only tools or pages.
- `EntitlementGate` handles loading and upgrade UX.

### Pattern B: Action-level gate (quota features)
Use `useFeature().checkOnly()` or `checkAndTrack()` when users can browse but have limited actions.
- Example: reading content, drills, or limited sessions.
- **Do not** wrap the entire page with `EntitlementGate` for quota features.

### Pattern C: Mixed access
If users can browse lists but limit the “start” action, do:
- List page: show `FeatureUsageIndicator` and allow browsing.
- Start button: `checkOnly({ failOpen: false })`, then navigate.
- Session completion: `checkAndTrack()` if usage should be consumed after success.

### Pattern D: Free access with premium creation/sync (Flashcards)
Flashcards is now free to access but still premium-gated for creation/import and cloud sync.
- Page access: allow free via `flashcards` feature (daily limit = `-1`).
- Creation/import: gate with `flashcard_decks` and `anki_imports` (free limit = `0`).
- Session analytics sync: premium-only via `flashcard_daily_reviews` on server.

## Client Hook Usage
- `checkOnly({ failOpen: false })` → enforce access without consuming quota.
- `checkAndTrack({ showUI: true })` → enforce and increment quota.
- Cache TTL is 60s; cache clears on increment or subscription change.

## Unique Item Dedupe
For content features that should not consume quota on repeated item access (e.g., comics/news), pass `itemId` or `boardId` to `checkOnly` / `checkAndTrack`. The API records unique items and won’t increment on repeats.

## Offline Behavior
- `useFeature()` checks offline entitlement snapshot for allow/deny.
- Offline usage is cached and synced when connectivity returns.
- If no snapshot is available, fail-closed for checkOnly (lifecycle_blocked).

## UX Standards
- **Daily limits**: Use a simple “Daily limit reached” message (no hour countdown).
- **Monthly limits**: Use “Monthly limit reached. Resets next month.”
- **Upgrade CTA**: Use `subscription.actions.upgrade` labels for consistency.

## Troubleshooting
- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues (config sync, quota bypasses, offline behavior).

## Related Resources
- Admin entitlements dashboard: `02-PRODUCTION_DOCS/admin-dashboard/`
- Payments and plans: `02-PRODUCTION_DOCS/payments/`
