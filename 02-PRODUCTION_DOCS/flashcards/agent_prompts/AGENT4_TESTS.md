# Agent 4 — Tests and Regression Coverage

## Objective
Update/add tests to cover starter deck removal and DeckMarket one-deck enforcement for free users.

## Must Read First
- `02-PRODUCTION_DOCS/flashcards/FLASHCARDS_ONBOARDING.md`
- `02-PRODUCTION_DOCS/deckMarket/DECKMARKET.md`

## Scope (You Own)
1. **Unit tests**
   - FlashcardManager gating (free one-deck rule).
   - Starter deck cleanup behavior if it’s in manager logic.
2. **API tests**
   - Flashcards API routes should reject free user non-DeckMarket writes.
3. **E2E (if stable)**
   - Optional: Add/update a minimal DeckMarket add flow test (single user).

## Out of Scope
- Feature implementation (handled by Agents 1–3).

## Likely Files
- `src/app/api/flashcards/decks/__tests__/route.test.ts`
- `src/lib/flashcards/__tests__/*`
- `e2e/*` (only if existing tests are stable)

## Constraints
- Keep tests deterministic; avoid cross-context flakiness.
- Use existing test utilities and factories.

## Acceptance Criteria
- Failing tests demonstrate gating if regressions occur.
- Minimal new tests that directly cover new rules.
