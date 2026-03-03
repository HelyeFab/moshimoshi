# Flashcards

**Status:** ACTIVE  
**Last Updated:** 2026-02-27

## Overview
Flashcards is a local-first SRS feature with two deck types: user-created decks and Anki imports. User decks use FSRS, Anki decks use SM-2, and media is hydrated at render time from IndexedDB. Premium users can sync user decks via Firebase and back up both deck types to R2. Premium users also get cross-device resume for active study sessions.

## Quick Start
1. Read the resident onboarding: `FLASHCARDS_ONBOARDING.md`
2. Start at `src/app/[locale]/flashcards/FlashcardsContent.tsx`
3. Inspect `src/lib/flashcards/FlashcardManager.ts` and `src/lib/anki/AnkiDeckManager.ts`

## Architecture
- User decks stored in `FlashcardDB` (IndexedDB), optional Firebase sync for premium.
- Anki decks stored in `FlashcardDB` only; media in `ankiMediaDB`.
- SRS split: FSRS for user decks, SM-2 for Anki decks.
- Media hydration via `useMediaHydration` and `hydrateAnkiMedia`.
- Premium R2 backup/restore for both deck types.
- Premium cross-device active session sync via Firestore (`users/{uid}/flashcardActiveSessions/{deckId}`); local session state is still stored in `localStorage` for resume.
- Premium-only flashcards sync routes should use the shared helper `src/app/api/flashcards/_lib/entitlements.ts` to avoid duplicating plan checks and drifting logic.

## Shared Entitlements Helper (Flashcards API)
- Use `src/app/api/flashcards/_lib/entitlements.ts` for premium-only flashcards sync routes (`active-session`, `goals`, `recommendations`, `weak-cards`, `streak-snapshots`).
- The helper reads the canonical plan via `getUserPlan(uid)` from `@/lib/entitlements/server` rather than ad-hoc Firestore document reads in each route.
- This keeps premium route checks aligned with the broader entitlements system and reduces copy/paste drift when plan logic changes.
- Keep route-specific validation (`zod`) and auth (`getSession`) in each route; only centralize the plan/premium check.

## Anki R2 Delete Reliability (Partial Cleanup Jobs)
- Anki backup delete is now a **synchronous server-orchestrated cleanup** via `POST /api/anki/r2/delete`:
  - writes `users/{uid}/deletedAnkiDecks/{deckId}` tombstone
  - deletes `anki_r2_backups/{deckId}` metadata
  - attempts R2 prefix deletion
  - returns structured status: `complete` or `partial`
- If R2 deletion is partial/fails, the endpoint persists a retryable job in `users/{uid}/ankiBackupCleanupJobs/{deckId}`.
- Invariant: backup listings stay correct immediately because tombstone + metadata cleanup happen before/alongside R2 deletion attempts.
- Re-import path (`POST /api/anki/r2/metadata`) clears stale tombstones so re-imported backups become visible again.

### Retry Mechanisms
- Cron/manual retry API: `src/app/api/anki/r2/cleanup-retry/route.ts`
  - Auth: `Authorization: Bearer ${CRON_SECRET}`
  - Supports all jobs, per-user, or per-deck retries
  - Reasserts tombstone + metadata deletion and retries R2 prefix deletion
- Manual CLI repair script: `scripts/retry-anki-r2-cleanup.js`
  - Useful for support/debugging and targeted retries

### Cron Schedule
- Vercel cron calls `/api/anki/r2/cleanup-retry` every **4 hours** (`0 */4 * * *`) using the existing `CRON_SECRET`.

## Documentation
- [CHANGELOG.md](./CHANGELOG.md) - Chronological summary of production changes
- [FLASHCARDS_ONBOARDING.md](./FLASHCARDS_ONBOARDING.md) - Condensed resident owner guide
- [FLASHCARDS_IMPLEMENTATION_NOTE_2026-02-25_PREVIEW_STUDY_AUDIO_WARMUP.md](./FLASHCARDS_IMPLEMENTATION_NOTE_2026-02-25_PREVIEW_STUDY_AUDIO_WARMUP.md) - Full implementation note for Preview/Study modes, local audio warmup, quota UX, and related reliability changes
- [DECK_CREATION_QUOTA_UX_AND_POLICY_NOTE_2026-02-22.md](./DECK_CREATION_QUOTA_UX_AND_POLICY_NOTE_2026-02-22.md) - Incident summary, UX copy fix, and future policy options for deck creation quotas
- [DECKMARKET_SEO.md](./DECKMARKET_SEO.md) - DeckMarket SEO setup, architecture decisions, and checklist for creating new decks

### 2026-02-27 Addendum (Preview/Study Reliability + Mastery Loop)
- Study mode now persists learner signals for follow-up practice:
  - `I didn't know` -> weak cards + mistake replay + follow-up drill queue
  - `Hard` -> weak cards + follow-up drill queue
  - `I knew it` -> no follow-up queue
- Preview mode remains non-persistent (no SRS, no weak/mistake writes).
- Study mode now auto-chains follow-up drill rounds until queued weak cards are cleared.
- Large all-new decks in Study mode now rotate across sessions (not always the same first 20 cards).
- Fixed >100% accuracy display in Study mode by making responses idempotent per card position.
- Added localized follow-up drill banner (`flashcards.studyFollowUp.*`) in all 6 locales.
- Session completion handling is scoped:
  - Study mode uses follow-up-safe completion path.
  - Other modes keep normal completion behavior.

## Key Files
- `src/app/[locale]/flashcards/FlashcardsContent.tsx` - Main flashcards page
- `src/lib/flashcards/FlashcardManager.ts` - User deck CRUD + sync + SRS
- `src/components/flashcards/StudySession.tsx` - User deck study flow
- `src/app/api/flashcards/_lib/entitlements.ts` - Shared flashcards API plan/premium helper for sync routes
- `src/app/api/flashcards/active-session/route.ts` - Premium active session sync API (GET/PUT/DELETE)
- `src/lib/flashcards/deviceId.ts` - Device id for cross-device resume
- `src/lib/anki/importer.ts` - Anki import + rules
- `src/lib/anki/AnkiDeckManager.ts` - Anki deck persistence
- `src/lib/anki/AnkiStudyManager.ts` - Anki SM-2 scheduling
- `src/hooks/useMediaHydration.ts` - Media hydration
- `src/lib/r2/R2UploadQueue.ts` - Anki R2 backup
- `src/lib/r2/UserDeckUploadQueue.ts` - User deck R2 backup
- `src/app/api/anki/r2/delete/route.ts` - Synchronous Anki backup delete (R2 + metadata + tombstone)
- `src/app/api/anki/r2/cleanup-retry/route.ts` - Partial cleanup retry cron/manual endpoint
