# Agent 6 — DeckMarket State UI + Delete Hook

## Objective
Use the DeckMarket state API to disable “Add to Flashcards” for free users who already have a DeckMarket deck, and clear state on delete.

## Must Read First
- `02-PRODUCTION_DOCS/flashcards/FLASHCARDS_ONBOARDING.md`
- `02-PRODUCTION_DOCS/deckMarket/DECKMARKET.md`
- API prompt: `AGENT5_DECKMARKET_STATE_API.md`

## Scope (You Own)
1. **DeckMarket Detail Page**
   - `src/app/[locale]/deckmarket/[deckId]/page.tsx`
   - On load, call `GET /api/deckmarket/state`.
   - If a different deck is already set and user is free:
     - Disable “Add to Flashcards” button.
     - Show a message (new i18n key if needed).
   - After successful add (free only), call `PUT /api/deckmarket/state` with the new deckId.

2. **Delete Hook**
   - On deleting a DeckMarket deck (free only), call `DELETE /api/deckmarket/state`.
   - Preferred location: `FlashcardManager.deleteDeck` (or the UI delete handler if absolutely necessary).

## Constraints
- No new patterns. Use existing fetch + error patterns.
- Keep changes minimal and local.

## Acceptance Criteria
- Free users cannot click “Add” when they already have another DeckMarket deck.
- Deleting the active DeckMarket deck clears the state across devices.
- Premium users unaffected.
