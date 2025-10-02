# Agent A — Gamification Core (Code Surgeon/Refactor Lead)

## Mission
Unify all gamification writes through **/api/stats/unified** with a single client hook. Remove legacy paths, fix correctness. Own the contract between client → server → stores.

## Deliverables
1. **Unified client hook**: `useStats()` (or consolidate into `useUserStats`), no write side‑effects outside the server API.
2. **Endpoint parity**: `/api/xp/track` removed or proxied to unified; tests updated.
3. **Legacy removal**: delete or lock **legacy stores** that wrote to localStorage/Zustand.
4. **Invariants enforced**: non‑negative XP; ≥10 XP → streak increment; activity idempotency.
5. **Types & Contracts**: strict TS types for payloads; server zod schema.

## Step‑By‑Step
- Inventory all callers of `useReviewStats`, `useUserStats`, and direct store writes.
- Create `libs/stats/contract.ts` (shared types) and `pages/api/stats/unified.ts` (zod + handler).
- Add `idempotencyKey` to activity payloads; persist keys on server to prevent duplicates.
- Replace all client write paths with calls to unified; delete dead code and update imports.
- Add unit tests for: XP award, streak increment rule, achievement unlock, leaderboard enqueue call.

## Acceptance Tests
- When a user completes an activity worth ≥10 XP in one day → streak increments once (never twice).
- Multiple replays with same `idempotencyKey` do not double count.
- Achievements unlock strictly on server decisions (no client logic).
