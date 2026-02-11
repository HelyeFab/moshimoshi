# Agent 3 — Backend / Sync / Limits

## Objective
Implement server-side enforcement and sync/backup behavior for DeckMarket decks, ensuring free-tier and premium rules are enforced consistently.

## Must Read First
- `02-PRODUCTION_DOCS/flashcards/FLASHCARDS_ONBOARDING.md`
- `02-PRODUCTION_DOCS/deckMarket/DECKMARKET.md`

## Scope (You Own)
1. **Server-side gating**
   - Ensure free users cannot create/import non-DeckMarket decks via flashcards APIs.
   - If any new endpoints are needed for DeckMarket add flow, follow existing patterns and auth.
2. **Sync/backup alignment**
   - DeckMarket decks should be included in premium sync/backup for Anki decks.
   - Ensure deleted DeckMarket decks are tombstoned so they do not resurrect.
3. **Limits**
   - DeckMarket decks count toward premium limits (e.g., `flashcard_decks`, `anki_imports`).
   - Free users limited to one DeckMarket deck (server-side validation if applicable).

## Out of Scope
- UI changes (Agent 1/2).
- Tests (Agent 4).

## Likely Files
- `src/app/api/flashcards/decks/route.ts`
- `src/app/api/flashcards/decks/[deckId]/route.ts`
- `src/lib/flashcards/FlashcardManager.ts`
- `src/lib/r2/R2UploadQueue.ts`
- `src/lib/r2/RestoreOrchestrator.ts`
- `src/lib/anki/AnkiDeckManager.ts`
- `src/lib/flashcards/DeletionManager.ts` (if exists)

## Constraints
- No new infra patterns.
- Reuse existing entitlement checks and error shapes.
- Keep changes minimal and localized.

## Acceptance Criteria
- Free-tier restrictions enforced server-side (no silent bypass).
- Premium behavior unchanged except DeckMarket inclusion.
- Deletions do not resurrect after sync/restore.
