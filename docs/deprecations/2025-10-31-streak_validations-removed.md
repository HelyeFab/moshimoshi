# Deprecation: Remove `streak_validations` Firestore Collection

- Date: 2025-10-31
- Status: Removed from codebase; blocked in security rules
- Affected: None (no runtime references)

## Rationale
- `streak_validations` was an unused legacy audit bucket.
- All streak logic is persisted transactionally in `user_stats.streak` via `src/lib/gamification/services/streakService.ts`.
- Removing the collection reduces schema surface area and prevents accidental writes.

## Changes
- Removed all runtime references (none existed in `src/` or `functions/`).
- Added explicit deny rule blocks to:
  - `firestore.rules`
  - `firestore.dual-storage.rules`
- Added CI guard: `scripts/ci-guard-streak-validations.sh` and `npm run ci:guard:streak` to fail builds if the collection name appears in runtime code.
- Updated documentation to reflect removal:
  - `docs/FIREBASE_COLLECTIONS_API_MAPPING.md`
  - `user-phoenix/FIREBASE_COLLECTIONS_API_MAPPING.md`
  - `user-phoenix/FIREBASE_COLLECTIONS_ANALYSIS.md`
  - `user-phoenix/streak_user_stats_users_summary.md`

## What Stays The Same
- Streak logic remains in `user_stats.streak` with transactional updates in `streakService.ts`.
- No API behavior changes. Endpoints continue to use `user_stats` and `users` only.
