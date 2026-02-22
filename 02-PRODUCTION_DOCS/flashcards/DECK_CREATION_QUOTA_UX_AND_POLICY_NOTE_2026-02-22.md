# Flashcards Deck Creation Quota: UX Copy Fix + Policy Notes

**Status:** ACTIVE  
**Date:** 2026-02-22  
**Scope:** Flashcards deck creation (especially "Create from List" flow)

## Summary
This document records an investigated "limit reached" report on the flashcards deck creation flow and the UX fix applied on 2026-02-22.

Outcome:
- There was **no bug** in entitlement enforcement.
- The user was correctly blocked by the configured `flashcard_decks` **monthly creation quota**.
- The UX copy was misleading/generic, so we improved it to show the **actual quota usage and limit** (localized).

## The Issue We Investigated
Symptom reported:
- Premium user can go through the flashcards deck creation flow (including "Create from List")
- On **Save**, they receive a generic "limit reached" toast
- User expectation: "I am premium, I should not have limits"

Why this was confusing:
- `flashcards` page access is unlimited for premium
- `flashcard_daily_reviews` is unlimited for premium
- `maxCardsPerDeck` is unlimited for premium
- But `flashcard_decks` (deck creation) is a **separate monthly quota** and was set to `10` for premium tiers

## Root Cause (Not a Code Defect)
The system is enforcing the intended policy:
- `flashcard_decks` is a **monthly** entitlement feature
- Premium monthly/yearly limits are currently set to **10**
- "Create from List" creates a **new custom deck**, so it consumes / is checked against `flashcard_decks`
- Deleting previously created decks does **not** refund monthly quota usage

This means users can be blocked in the current month even if they currently have very few decks stored.

## Evidence and Where to Look in Code

### 1) Policy source of truth (entitlements config)
- `config/features.v1.json:269` defines `flashcard_decks` as a **monthly** feature
- `config/features.v1.json:284` shows `maxCardsPerDeck` metadata (premium is `-1`, unlimited)
- `config/features.v1.json:754` sets `premium_monthly.flashcard_decks = 10`
- `config/features.v1.json:803` sets `premium_yearly.flashcard_decks = 10`

### 2) Deck creator Save flow (where the user sees the toast)
- `src/components/flashcards/DeckCreator.tsx:66` binds `useFeature('flashcard_decks')`
- `src/components/flashcards/DeckCreator.tsx:442` calls `checkDeckLimit({ failOpen: false })` on Save
- If denied, the Save flow shows the toast and returns early

### 3) Entitlement API response includes dynamic limit + usage
- `src/app/api/usage/[featureId]/check/route.ts:103` reads current usage
- `src/app/api/usage/[featureId]/check/route.ts:121` evaluates entitlement
- `src/app/api/usage/[featureId]/check/route.ts:137` returns response including `currentUsage`

### 4) Client hook type used by the deck creator
- `src/hooks/useFeature.ts:17` `Decision` type used client-side
- `src/hooks/useFeature.ts:25` includes `currentUsage` (added to match API payload shape for this UX)

## Fix Applied Today (2026-02-22)
We improved the Save-blocked toast copy in the flashcards deck creator to show the actual quota:

Example:
- `Deck creations this month: 10/10. Resets next month.`

Implementation details:
- The message now uses the **evaluated entitlement decision** (`decision.currentUsage`, `decision.limit`) instead of hardcoding a value.
- This keeps the UI aligned with config-driven limits after entitlement regeneration.

### Code changes
- `src/components/flashcards/DeckCreator.tsx:452`
  - Builds a quota message from `decision.currentUsage` + `decision.limit`
- `src/components/flashcards/DeckCreator.tsx:453`
  - Uses i18n key `flashcards.limits.deckCreationsMonthlyQuotaReached`
- `src/i18n/locales/en/strings.ts:4954`
  - Added localized string (and equivalent keys in all supported locales)

Locales updated:
- `src/i18n/locales/en/strings.ts`
- `src/i18n/locales/es/strings.ts`
- `src/i18n/locales/it/strings.ts`
- `src/i18n/locales/fr/strings.ts`
- `src/i18n/locales/de/strings.ts`
- `src/i18n/locales/ja/strings.ts`

## Important Operational Note (Config Changes)
This toast reads the limit from the entitlement decision returned by the API.

If you change `config/features.v1.json`, you must regenerate entitlements:
- `npm run gen:entitlements`

Otherwise runtime policy may still reflect the old generated values.

## Product Semantics: Why Users Perceive This as a Bug
Users often interpret "deck limit" as:
- "How many decks I can have right now" (active inventory)

Current policy actually means:
- "How many decks I can create this month" (throughput quota)

That mismatch in interpretation is the core UX issue.

## Policy Options (Brainstorm)

### 1) Keep current policy, fix UX copy (current direction)
- Keep `10` deck creations/month for premium
- Improve messaging:
  - quota count (e.g. `10/10`)
  - reset timing (e.g. `Resets next month`)
- Pros:
  - Simple
  - Stable
  - Server-enforceable
- Cons:
  - Still frustrating after deleting decks

### 2) Active deck slots (inventory) instead of creation quota
- Allow up to N active user decks at a time
- Deleting frees a slot immediately
- Pros:
  - Matches user expectation
- Cons:
  - Flashcards is local-first (IndexedDB); server-only counting is incomplete
  - Firebase/R2 cannot be trusted as total active-deck source

### 3) Hybrid (recommended for future exploration)
- Keep `10` creations/month (anti-abuse / cost control)
- Plus a higher or unlimited active deck count
- Add limited refunds on deletion (e.g. only if deleted quickly and never studied)
- Pros:
  - Better user fairness
  - Maintains abuse/cost control
- Cons:
  - More implementation complexity (refund rules, idempotency, auditability)

### 4) Split local vs cloud policy
- Local deck creation: more generous/unlimited for premium
- Cloud sync/backup deck count: capped (Firebase/R2 cost control)
- Pros:
  - Better aligned with infrastructure costs
- Cons:
  - More complex UX messaging and support burden

## Pragmatic Recommendation (Current)
If business goal is cost protection + less user frustration:
- Keep `10/month` for now
- Keep the new quota-aware toast copy
- Add a visible quota indicator in deck creation UI:
  - `Deck creations this month: 10/10`
  - `Resets next month`

This acknowledges that current behavior is valid and reduces support confusion.

## If We Revisit the Policy Later: Engineering Starting Points

### If changing the quota value only
1. Update `config/features.v1.json`
2. Run `npm run gen:entitlements`
3. Verify `/api/usage/flashcard_decks/check` returns updated `limit`
4. Confirm deck creator Save toast reflects new value automatically

### If changing from creation quota to active deck inventory
Start by auditing these areas:
- `src/components/flashcards/DeckCreator.tsx` (Save pre-check UX)
- `src/lib/flashcards/FlashcardManager.ts` (local IndexedDB deck create/delete lifecycle)
- `src/app/api/flashcards/decks/route.ts` (server sync path and `flashcard_decks` usage increments)
- `src/app/api/usage/[featureId]/check/route.ts` and `src/app/api/usage/[featureId]/increment/route.ts` (generic entitlement model)

Architectural caveat:
- Do not assume Firebase or R2 contains all active decks; local-only decks may exist.

### If adding deletion refunds (hybrid)
Plan for:
- Refund eligibility rules (time window, studied/not studied, synced/not synced)
- Idempotent refund handling
- Audit logs (why quota was refunded)
- UI copy explaining what is refunded and what is not

## Verification Checklist (Current Behavior)
- Premium user with `flashcard_decks` usage below limit can save a new deck
- Premium user at quota sees localized quota message with `current/limit`
- "Create from List" uses same Save path and same quota message
- Changing quota in config + regenerating entitlements updates displayed limit automatically

## Non-Issues / Common Misdiagnoses
- "Premium should have no limits" -> policy decision, not code bug (under current config)
- "I only have 1 deck in Firebase so quota should allow more" -> current policy counts monthly creations, not current inventory
- "maxCardsPerDeck is blocking me" -> premium `maxCardsPerDeck` is already unlimited (`-1`)

