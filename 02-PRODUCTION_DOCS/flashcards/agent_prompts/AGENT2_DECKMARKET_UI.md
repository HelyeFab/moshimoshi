# Agent 2 — DeckMarket UI “Add to Flashcards”

## Objective
Add an “Add to Flashcards” flow in DeckMarket UI while keeping the existing Download button.
This flow should download the `.apkg`, import it into IndexedDB via the existing Anki import pipeline, and then make the deck appear in Flashcards without a manual file picker.

## Must Read First
- `02-PRODUCTION_DOCS/deckMarket/DECKMARKET.md`
- `02-PRODUCTION_DOCS/flashcards/FLASHCARDS_ONBOARDING.md`

## Scope (You Own)
1. **DeckMarket catalogue + detail pages**
   - Add CTA “Add to Flashcards” alongside “Download”.
   - UI states: loading, success, error, and “already added” states for free users.
2. **Client-side add flow**
   - Use existing DeckMarket download API to fetch `.apkg`.
   - Call existing Anki importer and persistence logic (e.g., `AnkiImporter.parsePackage` + `AnkiDeckManager.saveDeck`).
   - Apply the DeckMarket origin marker when saving (coordinate with Agent 1).
3. **UX**
   - No new patterns. Use existing UI components (buttons, toasts, modal if needed).
   - After success, offer “Go to Flashcards” or deep-link to the deck.

## Out of Scope
- Flashcards gating logic (Agent 1).
- Server/API enforcement (Agent 3).
- Tests (Agent 4).

## Likely Files
- `src/app/[locale]/deckmarket/page.tsx`
- `src/app/[locale]/deckmarket/[deckId]/page.tsx`
- `src/lib/anki/importer.ts`
- `src/lib/anki/AnkiDeckManager.ts`
- `src/hooks/useAnkiStudy.ts` (only if needed for navigation)
- `src/components/flashcards/*` (only if the UX requires a link)

## Constraints
- Keep download button for portability.
- Do not expose raw presigned URLs to UI logs.
- Maintain existing error handling patterns.
- Avoid large memory spikes: stream/arrayBuffer as existing importer expects.

## Acceptance Criteria
- User can add a DeckMarket deck into Flashcards without manual import.
- Download still works as before.
- Free users hitting the one-deck limit should see a friendly block message (actual enforcement is in Agent 1/3).
