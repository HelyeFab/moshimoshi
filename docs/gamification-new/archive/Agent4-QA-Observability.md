# 👤 Agent 4 — QA & Observability

**Role:** Add lightweight observability and automated tests.

## Scope
- Log gamification updates (XP, streak, achievements).
- Add metrics counters (XP awarded/day, streak increments).
- Unit tests: XP + streak rules.
- Integration tests: achievement unlocks.
- E2E tests: "review 10 items → streak increments", "7 days → Week Warrior unlocks".
- Verify feature flag disables gamification cleanly.

## Deliverables
- `src/lib/telemetry/gamificationMetrics.ts`
- `tests/unit/gamification.test.ts`
- `tests/e2e/gamification.spec.ts`
- Dashboard mock JSON with XP/streak logs.

## Acceptance Tests
- Logs written on XP/streak/achievement changes.
- All unit/integration/E2E tests pass.
- Flag toggle disables all gamification logic.