# Agent B — Data & Sync (Storage/Timezone/Offline/Migration)

## Mission
Make premium sync reliable and timezone‑safe; implement offline queue, migrations, nightly recompute, and leaderboard delta materialization.

## Deliverables
1. **UTC boundary util** with comprehensive tests (DST, leap, offsets).
2. **Sync enabled**: remove early return; implement idempotent upserts and replay.
3. **Offline queue**: IndexedDB queue with dedupe by `activityId`/`idempotencyKey`.
4. **Migration v1**: localStorage/Zustand → IndexedDB → server for premium users.
5. **Nightly recompute** (server function) to canonicalize streak totals.
6. **Leaderboard deltas**: incremental materialization tasks.

## Step‑By‑Step
- Implement `lib/time/utcDayBucket(serverNowUtc, userTzOffsetSnapshot)`.
- Rework sync worker to batch events, attach idempotency keys, and upsert server‑side.
- Build migration script (read legacy keys, transform, replay through unified).
- Create server cron/Cloud Function to recompute streaks and materialize leaderboard deltas nightly.
- Log each stage with correlation ids for traceability.

## Acceptance Tests
- Crossing midnight in different timezones behaves identically (server is source of truth).
- Offline activity replay produces exactly one streak increment when ≥10 XP day threshold is met.
- Migration dry‑run shows 0 data loss; post‑migration recompute yields same or corrected totals.
