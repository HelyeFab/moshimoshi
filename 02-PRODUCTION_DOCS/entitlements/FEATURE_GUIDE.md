# Entitlements & Gating – Feature Guide

**Status:** ACTIVE  
**Last Updated:** 2026-02-10

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

### Pattern E: Lookup Modals (Word/Kanji)
Lookup modals **must not flash** on quota denial. Use a two-layer gate:
1. **Pre-check at the click source** (before opening the modal):
   - `checkOnly({ failOpen: false })`
   - If denied, show toast and **do not open** the modal.
2. **Increment inside the modal**:
   - `checkAndTrack({ showUI: true })` on first open for a new item.

To preserve the “seen pool” UX (users can reopen previously viewed items even after quota is exhausted), use a daily localStorage set:
- `src/utils/wordLookupSeen.ts` for word lookups
- `src/utils/kanjiLookupSeen.ts` for kanji lookups

Notes:
- localStorage is **UX only**. Deleting it does **not** bypass server enforcement.
- Modal still calls `checkAndTrack()` for new items to guarantee server quota.
- The modal should close immediately when denied; the pre-check prevents visible flash.

## Client Hook Usage
- `checkOnly({ failOpen: false })` → enforce access without consuming quota.
- `checkAndTrack({ showUI: true })` → enforce and increment quota.
- Cache TTL is 60s; cache clears on increment or subscription change.

### Lookup Toast Message & Upgrade CTA
For `word_lookup` and `kanji_lookup`, use:
- `entitlements.messages.lookupLimitReached`
- Provide upgrade action (when not premium), matching other features:
  - Label: `subscription.actions.upgrade`
  - Action: route to `/pricing`

## Unique Item Dedupe
For content features that should not consume quota on repeated item access, pass `itemId` (or `boardId` for mood boards) to `checkOnly` / `checkAndTrack`. The API records unique item IDs and won’t increment on repeats.

Applies to these content features today:
- `news`
- `story`
- `comics`
- `books`

Implementation notes:
- Server stores arrays in the usage doc, keyed by feature.
- Example fields:
  - `news_items`
  - `story_items`
  - `comics_items`
  - `books_items`
- The generic usage endpoints (`/api/usage/[featureId]/check` and `/api/usage/[featureId]/increment`) also honor these fields when an `itemId` is provided.

### Dedupe Checklist (Adding a New Content Feature)
Use this when adding a new deduped content feature.
1. Add the feature to `config/features.v1.json` and regenerate types.
2. Ensure the content detail API stores item IDs in the usage doc (`*_items` array).
3. Add the feature to `UNIQUE_ITEM_FEATURES` in `src/hooks/useFeature.ts` if the UI uses `useFeature` with `metadata.itemId`.
4. Add the feature to `UNIQUE_ITEM_FIELDS` in:
   - `src/app/api/usage/[featureId]/check/route.ts`
   - `src/app/api/usage/[featureId]/increment/route.ts`
   - `src/app/api/usage/sync/route.ts`
5. If there is a list page using `FeatureUsageIndicator`, confirm `decision.limit` is returned so the UI can render correctly.

## Offline Behavior
- `useFeature()` checks offline entitlement snapshot for allow/deny.
- Offline usage is cached and synced when connectivity returns.
- If no snapshot is available, fail-closed for checkOnly (lifecycle_blocked).

### Offline Dedupe Sync
When offline usage is synced via `POST /api/usage/sync`, unique-item features must include their item IDs so repeats do not consume additional quota.
- Client collects unique item IDs in local storage.
- Sync payload includes `uniqueItems`.
- Server appends these to the same `*_items` arrays used online.

## UX Standards
- **Daily limits**: Use a simple “Daily limit reached” message (no hour countdown).
- **Monthly limits**: Use “Monthly limit reached. Resets next month.”
- **Upgrade CTA**: Use `subscription.actions.upgrade` labels for consistency.

### Lookup Quotas UX
- Lookup quota denial should never open the modal.
- Re-opening already-seen words/kanji should still work even if quota is exhausted (via localStorage seen pools).

## Lookup Entry Points
Keep these in sync when changing lookup gating behavior.

Word lookup (`WordExplanationModal`) entry points:
- `src/components/news/EnhancedArticleReaderFinal.tsx`
- `src/app/[locale]/comics/[episodeId]/page.tsx`
- `src/app/[locale]/youtube-shadowing/page.tsx`
- `src/components/shadowing/MoshiShadowingPlayer.tsx`

Kanji lookup (`KanjiDetailsModal`) entry points:
- `src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx`
- `src/app/[locale]/kanji-connection/families/KanjiFamiliesPage.tsx`
- `src/app/[locale]/kanji-connection/visual-layout/VisualLayoutPage.tsx`
- `src/app/[locale]/kanji-connection/radicals/KanjiRadicalsPage.tsx`
- `src/app/[locale]/kanji-moods/[boardId]/page.tsx`
- `src/app/[locale]/textbook-vocabulary/components/VocabularyDisplay.tsx`
- `src/app/[locale]/lists/[listId]/page.tsx`
- `src/components/review-engine/cards/KanjiCard.tsx`
- `src/components/review-engine/inputs/MultipleChoiceInput.tsx`
- `src/app/[locale]/tools/kanji-mastery/components/KanjiProgressSummary.tsx`

### Usage Display Notes
- `LimitDisplay` uses `decision.limit` to render progress.
- If `decision.limit` is missing or `<= 0`, the progress bar is hidden.

## Troubleshooting
- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues (config sync, quota bypasses, offline behavior).

## Related Resources
- Admin entitlements dashboard: `02-PRODUCTION_DOCS/admin-dashboard/`
- Payments and plans: `02-PRODUCTION_DOCS/payments/`
