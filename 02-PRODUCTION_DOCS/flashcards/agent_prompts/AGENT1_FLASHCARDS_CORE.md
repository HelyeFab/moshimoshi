# Agent 1 — Flashcards Core (Starter Removal + Gating)

## Objective
Implement flashcards-side changes to remove starter decks and enforce free-tier “one DeckMarket deck at a time,” plus deck identity markers used elsewhere.

## Must Read First
- `02-PRODUCTION_DOCS/flashcards/FLASHCARDS_ONBOARDING.md`
- `02-PRODUCTION_DOCS/flashcards/FLASHCARDS_STARTER_DECKS_PLAN.md` (for starter deck locations)
- `02-PRODUCTION_DOCS/deckMarket/DECKMARKET.md` (deckmarket constraints)

## Scope (You Own)
1. **Starter decks removal**
   - Remove any seeding logic and starter deck content.
   - Add a one-time cleanup on flashcards load to delete existing starter decks if present.
   - For premium users, ensure deletion uses existing tombstone logic so decks do not resurrect.
2. **Deck identity marker**
   - Add a stable marker to flashcard/anki deck model for DeckMarket origin (e.g. `origin: 'deckmarket'`).
   - Ensure it persists in IndexedDB and is available in UI and manager logic.
3. **Free-tier gating**
   - Enforce “one DeckMarket deck at a time” at the manager level.
   - Free users cannot create/import other deck types (non-DeckMarket).
4. **UI gating (flashcards page only)**
   - Hide starter deck UI and any affordances referencing them.
   - Hide/disable create/import actions for free users except DeckMarket entry.

## Out of Scope
- DeckMarket UI changes (CTA “Add to Flashcards” lives with Agent 2).
- Backend/API changes for DeckMarket (Agent 3).
- Test updates (Agent 4).

## Likely Files
- `src/app/[locale]/flashcards/FlashcardsContent.tsx`
- `src/lib/flashcards/FlashcardManager.ts`
- `src/lib/flashcards/starterDecks.ts` (remove)
- `src/types/flashcards.ts`
- `src/components/flashcards/DeckGrid.tsx`
- `src/components/flashcards/DeckCreator.tsx`
- `src/components/flashcards/BulkOperations.tsx` (if it affects create/delete)
- `src/lib/flashcards/MigrationManager.ts` (if import gates exist)
- `config/features.v1.json` (only if needed for free page access changes)

## Constraints
- Small, local, incremental changes.
- No new architecture or libraries.
- Strong typing; TypeScript-first.
- Follow existing error handling and toast patterns.
- Do not change DeckMarket endpoints or import logic here.

## Acceptance Criteria
- Starter decks no longer appear for any user; existing starter decks are cleaned up safely.
- Free users can have exactly **one** DeckMarket deck; create/import other deck types is blocked.
- Premium users unaffected except starter decks removal and new deck origin marker.

## Notes
- Ensure removal does not break weak-cards/mistake-replay localStorage references.
- Tombstones are already used for deletions; reuse the same mechanism.
