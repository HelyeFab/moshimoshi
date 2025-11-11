# Firebase Collections Usage Summary

This report captures how the project codebase interacts with the `streak_validations`, `user_stats`, and `users` Firestore collections.

## streak_validations
- No API route or backend job currently reads or writes this collection.
- Project-wide searches (`rg "streak_validations"`) confirm the collection is referenced only in documentation, so it functions as an unused audit log bucket at present.

## user_stats
- `POST /api/gamification/sync` (`src/app/api/gamification/sync/route.ts:47`): premium cross-device sync writes merged XP, streak, session, and achievement data.
- `GET /api/gamification/load` (`src/app/api/gamification/load/route.ts:25`): premium clients read the synced document to restore IndexedDB caches.
- `POST /api/gamification/migration/upload` (`src/app/api/gamification/migration/upload/route.ts:25`): migration helper merges legacy streak/XPs into the unified schema.
- `GET /api/review/stats` (`src/app/api/review/stats/route.ts:180`): dashboard aggregation pulls streak/session fields.
- Admin tooling reads the collection for maintenance tasks:
  - Leaderboard rebuild (`POST /api/admin/leaderboard/trigger`, `src/app/api/admin/leaderboard/trigger/route.ts:30`)
  - Data integrity checks (`GET /api/admin/stats-consistency`, `src/app/api/admin/stats-consistency/route.ts:138`)
  - User detail views (`GET /api/admin/users/[uid]/data`, `src/app/api/admin/users/[uid]/data/route.ts:91`)
- Cloud Function `updateLeaderboardSnapshots` (`functions/src/scheduled/leaderboard.ts:55`) mirrors the leaderboard trigger by reading the same fields daily.

## users
- Account lifecycle:
  - Signup seeds the default profile (`POST /api/auth/signup`, `src/app/api/auth/signup/route.ts:92`).
  - Signin records last-login metadata (`POST /api/auth/signin`, `src/app/api/auth/signin/route.ts:152,344`).
  - Google/magic-link sign-ins merge OAuth profile details (`POST /api/auth/google`, `src/app/api/auth/google/route.ts:85-128`).
- Session/tier utilities continuously read the collection (`/api/auth/session-check`, `/api/auth/refresh`, etc.).
- Profile management updates preferences, notifications, and avatars (`PATCH /api/user/profile`, `src/app/api/user/profile/route.ts:290-309`; `POST /api/user/upload-avatar`, `src/app/api/user/upload-avatar/route.ts:142,206`).
- Account deletion soft-deletes the document and schedules cleanup (`POST /api/user/delete-account`, `src/app/api/user/delete-account/route.ts:201-209`).
- Feature subcollections under `users/{uid}` drive learning features:
  - Vocabulary history (`src/app/api/vocabulary/history/route.ts:46,136,208`).
  - Custom lists (`src/app/api/lists/route.ts:43,246` and nested routes).
  - SRS updates (`src/app/api/srs/update/route.ts:21,49`).
  - Drill sessions (`src/app/api/drill/session/route.ts:110,357`).
  - Todos (`src/app/api/todos/route.ts:48,123,184`).
  - Kanji tools (`src/app/api/kanji/browse/route.ts:59,175`).
- Admin modules read/update/delete user documents for support (`src/app/api/admin/users/[uid]/data/route.ts:89-114`; `src/app/api/admin/set-admin/route.ts:54`).

## Follow-up Ideas
1. Decide whether to wire actual audit logging into `streak_validations` or remove the unused collection.
2. Optionally run a live Firestore inspection with the service account to confirm production data aligns with these code paths.
