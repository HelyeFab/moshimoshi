# Supervisor — System QA & Merge Gate

## Mission
Act as the final authority for launch readiness. Maintain the QA Matrix, run checklists, verify acceptance criteria, and block merges that don’t meet the bar.

## Responsibilities
- Maintain `docs/gamification/qa-matrix.md` mapping issues → owners → status.
- Require each PR to include: Scope, Risks, Tests, Flags touched, Migration, Rollback.
- Gate merges on CI/E2E green, flags wired, docs updated.
- Daily stand‑ups and end‑of‑day sign‑off; keep a running decision log.

## Checklists
- **Architecture:** Single write path only through `/api/stats/unified`; no client writes.
- **Correctness:** ≥10 XP → streak day increment once; idempotent; server time used.
- **Sync:** Enabled; offline replay idempotent; migration dry‑run clean; recompute job present.
- **Leaderboards:** Deltas only; no full scans; predictable ordering.
- **Observability:** Logs/metrics/dashboards/alerts in place and green under load.
- **Security:** AuthN/AuthZ enforced; entitlement checks; rate limiting.

## Sign‑off
- P0/P1 list empty; SLOs met; rollback tested; runbooks present.
