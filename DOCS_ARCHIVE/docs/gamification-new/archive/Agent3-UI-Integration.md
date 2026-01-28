# 👤 Agent 3 — UI Integration

**Role:** Connect gamification state to the front-end.

## Scope
- Build `useGamification()` hook.
- Update Profile page → show XP, streak, level.
- Update Achievements page → show unlocked vs locked achievements.
- Update Leaderboard page → render mocked data only (no server dependency).
- Remove any old gamification components.

## Deliverables
- `src/hooks/useGamification.ts`
- Updated Profile, Achievements, Leaderboard UI.
- Snapshot tests for components with mock gamification data.

## Acceptance Tests
- Profile page shows correct XP/streak/level.
- Achievements page renders locked/unlocked states from config.
- Leaderboard renders mock list without network calls.
- No runtime errors if gamification disabled.