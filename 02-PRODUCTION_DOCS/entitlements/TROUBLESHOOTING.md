# Entitlements & Gating – Troubleshooting

**Status:** ACTIVE  
**Last Updated:** 2026-01-30

## Common Issues

### 1) Config change not reflected in app
**Symptom:** New limits don’t apply or feature id is “invalid”.

**Fix:**
- Run `npm run gen:entitlements` or Admin → Entitlements → Regenerate Types.
- Confirm `src/types/FeatureId.ts` and `src/lib/entitlements/policy.ts` updated.

---

### 2) Whole page gets blocked after quota limit
**Symptom:** Users see a full-screen gate after hitting a quota.

**Fix:**
- Use **action-level** gating (`useFeature().checkOnly()` / `checkAndTrack()`) instead of `EntitlementGate`.
- Reserve `EntitlementGate` for premium-only features (limit = 0).

---

### 3) Quota consumed on failed action
**Symptom:** Users lose quota even when the action fails (e.g., no transcript).

**Fix:**
- Only call `checkAndTrack()` after the action succeeds.
- Use `checkOnly()` before long operations, then track on success.

---

### 4) Quota bypass via retry buttons
**Symptom:** Retry buttons don’t consume quota.

**Fix:**
- Add `checkAndTrack()` to **every** retry or “try again” action.

---

### 5) Duplicate increments on repeated content
**Symptom:** Accessing the same item consumes multiple units.

**Fix:**
- Pass `itemId` or `boardId` to `checkOnly`/`checkAndTrack`.
- Ensure the feature is listed in `UNIQUE_ITEM_FEATURES`.

---

### 6) Toast shows huge hour count for monthly limits
**Symptom:** Monthly reset shows “Resets 700+ hours”.

**Fix:**
- Monthly limits should use the “Resets next month” string.
- Confirm `entitlements.limits.resetsNextMonth` exists in i18n.

---

### 7) Access works for premium but fails for free unexpectedly
**Symptom:** Free users blocked when they should have quota.

**Fix:**
- Ensure the feature exists in `config/features.v1.json` limits.
- Verify `limitType` matches the limit bucket (daily vs monthly).
- Check server logs for `limit_reached` vs `no_permission`.

---

## Diagnostics
- Check decision JSON from `/api/usage/[featureId]/check`.
- Verify usage docs in Firestore: `users/{uid}/usage/{featureId_YYYY-MM-DD}` or `{featureId_YYYY-MM}`.
- Confirm plan in `users/{uid}/subscription.plan`.

## Related Resources
- `src/app/api/usage/[featureId]/check/route.ts`
- `src/app/api/usage/[featureId]/increment/route.ts`
- `src/hooks/useFeature.ts`
