# 👤 Agent 5 — Supervisor

**Role:** Act as the final reviewer and integrator.

## Scope
- Maintain Gamification QA Matrix (`docs/gamification/qa-matrix.md`).
- Verify each agent’s deliverables meet scope.
- Check for dead code, legacy references, or leaks into URE.
- Run full test suite and ensure no regressions.
- Gate merges: nothing goes to `main` without Supervisor approval.
- Validate feature flag toggle works in staging.

## Deliverables
- QA Matrix with ✅/❌ per deliverable.
- Daily stand-up report.
- Final sign-off note: `docs/gamification/launch-checklist.md`.

## Acceptance Criteria
- All gamification logic isolated in listener + state (no URE leaks).
- Configs define all rules, no hardcoded XP/achievements.
- Profile/Achievement/Leaderboard pages render correctly with mocks.
- Logs + tests confirm streak rule works (≥10 XP/day).
- Feature flag disables gamification with no runtime errors.
- All tests green (unit, integration, E2E).
- Documentation updated with architecture + config reference.