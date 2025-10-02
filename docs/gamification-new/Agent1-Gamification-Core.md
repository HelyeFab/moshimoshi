# 👤 Agent 1 — Gamification Core

**Role:** Implement the gamification listener and unified state.

## Scope
- Subscribe to Universal Review Engine (URE) review events.
- Apply XP + streak rules (using config).
- Maintain `user_gamification` state in IndexedDB (free) + Firebase (premium).
- Wrap the whole system in a feature flag `ENABLE_GAMIFICATION`.

## Deliverables
- `src/lib/gamification/gamificationListener.ts`
- `src/state/userGamification.ts`
- Unit tests: XP accumulation, streak increment/reset.

## Acceptance Tests
- Correct review → +XP (from config).
- Day with ≥10 XP → streak increments by 1.
- Missed day → streak resets to 0.
- Feature flag off → no XP/streak updates occur.