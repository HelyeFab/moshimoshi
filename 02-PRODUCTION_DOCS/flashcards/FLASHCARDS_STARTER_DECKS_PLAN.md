# Flashcards Starter Decks Plan

**Status:** Draft (Updated)
**Date:** 2026-02-04
**Owner:** Codex (Senior TypeScript Engineer)

## Summary
Lift flashcards access for free users by providing a starter set of 3 decks. Free users can study starter decks but cannot create/import/edit/delete decks. Premium users can create/import normally and can delete starter decks.

## Decisions (Confirmed)
- **Starter decks:** seeded for **free + premium** users.
- **Guests:** **blocked** from flashcards (no starter decks).
- **Starter decks storage:** **local-only** for free; **Firebase sync** only for premium (same as user decks); **never** in R2.
- **Free session persistence:** **local-only** (keep `flashcard_daily_reviews = 0`).
- **Starter identity:** **stable hard-coded IDs** in starter data.
- **Server enforcement:** block **any server deck writes** for free at API layer (local-only seeding is allowed).

## Exact Code Changes (Planned)

### 1) Entitlements config
- **File:** `config/features.v1.json`
- **Change:** set `limits.free.daily.flashcards` from `0` to `-1` (allow flashcards page access for free).
- **Keep:** `limits.free.monthly.flashcard_decks = 0` and `limits.free.monthly.anki_imports = 0` to block creation/imports.
- **Keep:** `limits.free.daily.flashcard_daily_reviews = 0` (free stays local-only for session persistence).

### 2) Flashcard deck type model
- **File:** `src/types/flashcards.ts`
- **Change:** add `isStarter?: boolean;` to `FlashcardDeck`.

### 3) Starter deck content (stable IDs)
- **File (new):** `src/lib/flashcards/starterDecks.ts`
- **Change:** export 3 starter decks with hard-coded IDs (e.g., `starter-v1-1`, `starter-v1-2`, `starter-v1-3`).
- **Note:** include `isStarter: true` and `source: 'user'` so they behave like normal user decks.

### 4) Seeding logic (free + premium only)
- **File:** `src/app/[locale]/flashcards/FlashcardsContent.tsx`
- **Change:** after local decks load, if `userTier` is `free` or `premium_*` and user has **no decks**, seed starter decks.
- **Guard:** do **not** seed for guests.
- **Implementation detail:** call `flashcardManager.ensureStarterDecks(userId, isPremium)`.

### 5) Local creation/import gating (free blocked)
- **File:** `src/components/flashcards/DeckCreator.tsx`
- **Change:** block **all** sources (scratch, list, csv, anki) for free users; show toast + pricing CTA.

- **File:** `src/app/[locale]/flashcards/FlashcardsContent.tsx`
- **Change:** in `handleOpenDeckCreator`, if `!isPremium`, block with toast + pricing redirect.
- **Change:** hide create actions in `ActionMenu` and `DeckGrid` for free users.

- **File:** `src/lib/flashcards/FlashcardManager.ts`
- **Change:** in `createDeck`, if `!isPremium` and `request.isStarter !== true`, throw error `STARTER_ONLY`.
- **Change:** add `ensureStarterDecks()` that bypasses deck limit checks for starter only.

### 6) Server-side write enforcement (free blocked)
- **File:** `src/app/api/flashcards/decks/route.ts`
- **Change:** in POST, if plan is `free` or `guest`, return 403 for any write (even if data is starter).

- **File:** `src/app/api/flashcards/decks/[deckId]/route.ts`
- **Change:** in DELETE, if plan is `free` or `guest`, return 403.
- **Change:** additionally, if `deck.isStarter` and plan is `free`, return 403 (defense in depth).

- **File:** `src/app/api/flashcards/decks/[deckId]/route.ts` (GET)
- **No change** beyond existing entitlement check.

### 7) Starter deck delete/edit restriction (premium-only)
- **File:** `src/components/flashcards/DeckGrid.tsx`
- **Change:** hide delete + edit actions if `deck.isStarter` and `!isPremium`.

- **File:** `src/app/[locale]/flashcards/FlashcardsContent.tsx`
- **Change:** in `handleDeleteDeck` + bulk delete, skip starter decks for free users with toast.
- **Change:** block edit for starter decks when free (do not open creator modal).

- **File:** `src/lib/flashcards/FlashcardManager.ts`
- **Change:** in `deleteDeck`, if `deck.isStarter && !isPremium`, return false or throw `STARTER_DELETE_FORBIDDEN`.

### 8) R2 + export behavior
- **File:** `src/lib/flashcards/FlashcardManager.ts`
- **Change:** in `uploadDeckToR2` and `deleteDeckFromR2`, skip if `deck.isStarter`.
- **Change:** in export flows (if required), either exclude starter decks or leave unchanged; confirm expectation.

### 9) Bulk ops + migration
- **File:** `src/components/flashcards/BulkOperations.tsx`
- **Change:** block bulk merge/duplicate for free users.

- **File:** `src/lib/flashcards/MigrationManager.ts`
- **Change:** block `importBulkDecks` for free users (premium only).

### 10) UX + i18n
- **File:** `src/i18n/locales/en/strings.ts` (+ other locales if required)
- **Add strings:**
  - `flashcards.starterOnly` (Free users can study starter decks only)
  - `flashcards.upgradeToCreate` (Upgrade to create/import decks)
  - `flashcards.upgradeToDeleteStarter` (Upgrade to delete starter decks)

## Task Breakdown

1. **Starter data + typing**
- Add `isStarter` to `FlashcardDeck`.
- Create `src/lib/flashcards/starterDecks.ts` with 3 decks + stable IDs.

2. **Seeding**
- Add `flashcardManager.ensureStarterDecks()`.
- Call from `FlashcardsContent` for free + premium only.

3. **Entitlements**
- Update `config/features.v1.json` for free `flashcards` access.
- Keep free deck/import/session limits blocked.

4. **Local gating**
- Block all creation/import sources in `DeckCreator` for free.
- Block `handleOpenDeckCreator` for free.
- Guard `FlashcardManager.createDeck` and delete.

5. **Server gating**
- Enforce no writes for free in `POST /api/flashcards/decks`.
- Enforce no deletes for free in `DELETE /api/flashcards/decks/[deckId]`.

6. **Starter-only delete/edit**
- Hide edit/delete in `DeckGrid` when free + starter.
- Block in `FlashcardsContent` handlers.
- Guard in `FlashcardManager.deleteDeck`.

7. **R2 handling**
- Ensure starter decks never upload to or delete from R2.

8. **UX/i18n**
- Add free-tier banner/notice and CTA strings.

9. **Tests**
- Update API tests for free write/delete restrictions.
- Add unit tests for free gating on create/import/delete.

## Open Questions (None Blocking)
- Whether starter decks should be excluded from exports; default is exclude unless requested.
