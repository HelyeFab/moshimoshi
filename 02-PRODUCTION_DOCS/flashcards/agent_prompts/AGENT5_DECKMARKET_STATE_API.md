# Agent 5 — DeckMarket State API (Free Users)

## Objective
Implement a minimal cross-device tracker so free users can only have one DeckMarket deck at a time. This provides a simple "current deck" record in Firestore and a small API to read/update it.

## Must Read First
- `02-PRODUCTION_DOCS/flashcards/FLASHCARDS_ONBOARDING.md`
- `02-PRODUCTION_DOCS/deckMarket/DECKMARKET.md`

## Data Model
Firestore document:
```
users/{uid}/deckmarketState/current
{
  deckId: string,
  updatedAt: number // epoch ms
}
```

## API Routes (Create new file)
`src/app/api/deckmarket/state/route.ts`

### GET /api/deckmarket/state
- Auth required (`getSession()`).
- Return `{ deckId, updatedAt }` if exists, else `{ deckId: null }`.

### PUT /api/deckmarket/state
- Auth required.
- Body: `{ deckId: string }`
- Only for **free** users (premium can be no-op or 403).
- Set doc with `updatedAt = Date.now()`.

### DELETE /api/deckmarket/state
- Auth required.
- Only for **free** users.
- Delete doc if exists.

## Constraints
- Follow existing API route conventions (NextResponse.json, 401/403 on auth/plan issues).
- Use `getSession()` and `getUserPlan()` if needed (see patterns in other API routes).

## Acceptance Criteria
- Free users can read/write/delete the state record.
- Premium users do not use this state.
