# Agent C — Observability & Release (CI/CD/Flags/Security/Perf)

## Mission
Provide the safety rails to launch and operate: feature flags, CI gates, telemetry, SLOs, security, and load testing; deliver a rollback‑ready release.

## Deliverables
1. **Feature flags** wired: `GAMIFICATION_UNIFIED_ONLY`, `SYNC_ENABLED`, `DEPRECATE_LEGACY_STORES`, `LEADERBOARD_DELTAS`.
2. **CI gates**: unit/integration/E2E, AST rule forbidding client writes, type/lint/format, bundle budgets.
3. **Telemetry**: structured logs + metrics; dashboards and alerts (error rate, latency, XP/streak rates).
4. **Security**: server‑only writes; JWT/session; entitlement checks; rate limits; audit logs.
5. **Perf**: load test plan + report; ensure no full scans on hot paths.

## Step‑By‑Step
- Add flags to config/env; expose typed flag helper; guard code paths.
- Implement custom ESLint/AST rule (or CI grep) that fails on forbidden client write calls.
- Add Playwright/Cypress E2E covering XP→streak, offline→online, DST edge, duplicate prevention.
- Provision dashboards and alerts; document thresholds and runbooks.
- Run load tests; report p50/p95 latency; verify error rate < threshold; tune indexes/caching.

## Acceptance Tests
- CI fails if client writes are detected or E2E criticals fail.
- Dashboards show live XP/streak metrics during dry‑run; alerts remain under thresholds.
- Toggle flags in staging and prod safely; rollback works instantly.
