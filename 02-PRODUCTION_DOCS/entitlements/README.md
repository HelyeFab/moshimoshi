# Entitlements & Gating

**Status:** ACTIVE  
**Last Updated:** 2026-02-10

## Overview
The entitlements system controls feature access by plan (guest/free/premium), enforces daily/monthly quotas, and provides consistent UX for upgrades and limits. It is the single source of truth for what a user can do and how often. Flashcards now allow free users to access the feature while still gating deck creation/import and premium-only sync features.

## Quick Start (<5 min)
1. Add/update feature limits in `config/features.v1.json`.
2. Regenerate types: `npm run gen:entitlements` (or Admin → Entitlements → Regenerate Types).
3. Enforce access in UI with `useFeature().checkOnly()` or `checkAndTrack()`.
4. Display usage with `FeatureUsageIndicator` (optional, UX only).

## Architecture
- **Source of truth**: `config/features.v1.json` defines plans, features, limitType, and per-plan limits.
- **Evaluator**: `evaluate()` computes access decisions from plan + usage + overrides.
- **API**: `/api/usage/[featureId]/check` and `/api/usage/[featureId]/increment` read usage, evaluate, and (optionally) increment.
- **Client**: `useFeature()` handles checks/increments, caching, toasts, and offline snapshot logic.
- **UI patterns**: `EntitlementGate` for page-level blocking; `useFeature` for action-level gating; `FeatureUsageIndicator` for display only.

## Configuration
- Update `config/features.v1.json` and regenerate types (`npm run gen:entitlements`).
- Keep FeatureId, policy, and registry files in sync with the JSON config.

## Notes (Data Model & Behavior)
- Usage buckets live under `users/{uid}/usage/{featureId_YYYY-MM-DD|YYYY-MM}`.
- Unique-item dedupe uses `*_items` arrays in the same usage doc.
- Client/UI limits display uses `decision.limit` when present; if missing or `<= 0`, no progress bar is shown.
- Offline usage is synced via `POST /api/usage/sync` and should include `uniqueItems` for dedupe features.

## Lookup Quotas (Word/Kanji)
Lookup modals use a two-layer gate to avoid flashing on quota denial:
1. **Pre-check at click source** using `checkOnly({ failOpen: false })`.
2. **Increment inside modal** via `checkAndTrack({ showUI: true })` for new items.

Daily “seen pools” are stored in localStorage to allow reopening already-viewed items even after quota is exhausted:
- `src/utils/wordLookupSeen.ts`
- `src/utils/kanjiLookupSeen.ts`

localStorage is UX-only; deleting it does **not** bypass server enforcement.

## Lookup Toast Messaging
Use the dedicated message key for lookup limits:
- `entitlements.messages.lookupLimitReached`
Add the upgrade action when the user is not premium:
- label `subscription.actions.upgrade`
- route `/pricing`

## Troubleshooting
- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and fixes.

## Documentation
- [FEATURE_GUIDE.md](./FEATURE_GUIDE.md) - Full implementation patterns and UX rules
- [API_REFERENCE.md](./API_REFERENCE.md) - Entitlements API endpoints and payloads
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and fixes
- [KANJI_BROWSER_STUDY_GATING_PLAN.md](./KANJI_BROWSER_STUDY_GATING_PLAN.md) - Proposed entitlement model for Kanji Browser study
- [KANJI_BROWSER_STUDY_MARKETING.md](./KANJI_BROWSER_STUDY_MARKETING.md) - Product and marketing framing for the Kanji Browser study cap
- [KANJI_BROWSER_STUDY_AGENT_OVERVIEW.md](./KANJI_BROWSER_STUDY_AGENT_OVERVIEW.md) - Shared implementation overview for working agents
- [KANJI_BROWSER_STUDY_AGENT_A_CONFIG.md](./KANJI_BROWSER_STUDY_AGENT_A_CONFIG.md) - Config/regeneration brief
- [KANJI_BROWSER_STUDY_AGENT_B_API.md](./KANJI_BROWSER_STUDY_AGENT_B_API.md) - Server/API brief
- [KANJI_BROWSER_STUDY_AGENT_C_CLIENT.md](./KANJI_BROWSER_STUDY_AGENT_C_CLIENT.md) - Client gating brief
- [KANJI_BROWSER_STUDY_AGENT_D_TESTS.md](./KANJI_BROWSER_STUDY_AGENT_D_TESTS.md) - Test brief

## Key Files (with line references)
- `config/features.v1.json:1` - Plans, features, and limits (single source of truth)
- `src/types/FeatureId.ts:7` - Generated FeatureId union
- `src/lib/entitlements/policy.ts:20` - Generated plan limits used by runtime/UI
- `src/lib/features/registry.ts:21` - Generated feature registry and metadata
- `src/lib/entitlements/evaluator.ts:47` - Decision engine (allow/deny/remaining/reset)
- `src/app/api/usage/[featureId]/check/route.ts:23` - Check endpoint
- `src/app/api/usage/[featureId]/increment/route.ts:25` - Increment endpoint
- `src/hooks/useFeature.ts:67` - Client hook for checks/increments + toasts
- `src/components/review-engine/EntitlementGate.tsx:30` - Page-level gate pattern
- `src/app/[locale]/admin/entitlements/page.tsx:46` - Admin entitlements dashboard

## Related Resources
- Stripe plans and billing: `02-PRODUCTION_DOCS/payments/`
- Admin dashboard patterns: `02-PRODUCTION_DOCS/admin-dashboard/`
