# Entitlements & Gating

**Status:** ACTIVE  
**Last Updated:** 2026-01-30

## Overview
The entitlements system controls feature access by plan (guest/free/premium), enforces daily/monthly quotas, and provides consistent UX for upgrades and limits. It is the single source of truth for what a user can do and how often.

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

## Troubleshooting
- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and fixes.

## Documentation
- [FEATURE_GUIDE.md](./FEATURE_GUIDE.md) - Full implementation patterns and UX rules
- [API_REFERENCE.md](./API_REFERENCE.md) - Entitlements API endpoints and payloads
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and fixes

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
