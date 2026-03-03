# Flashcards Resident Onboarding Guide

**Status:** ACTIVE  
**Last Updated:** 2026-02-06

## Current Status (2026-02-03)
- **Implemented:** Cross-device deletion tombstones for user decks (Firebase) and Anki/R2 decks; sync now respects tombstones and prevents resurrection.
- **Implemented:** Bulk-select + bulk-delete UI, with ActionMenu (three-dot) housing actions (insights, create deck, select all, sync all, export all).
- **Implemented:** API responses now include deleted deck IDs for flashcards and Anki backups.
- **Tests added (unit):**
  - `src/app/api/flashcards/decks/__tests__/route.test.ts` (GET returns `deletedDeckIds`)
  - `src/app/api/anki/r2/backups/__tests__/route.test.ts` (GET returns `deletedDeckIds` and filters tombstoned backups)

### Still to Do (UI E2E)
- **E2E test pending stabilization:** `e2e/flashcards-multi-device-deletion.spec.ts`
  - Flaky due to **auth/session drops** in multi-context tests and **non-deterministic sync latency**.
  - Current mitigations:
    - Server must run with `E2E_BYPASS_RECAPTCHA=true`.
    - Use `e2e/.auth/premium.json` storage state if available.
    - Poll `/api/flashcards/decks` for cloud visibility and `deletedDeckIds`.
  - **Recommended next step:** Make sync deterministic for tests:
    - Add a test-only sync endpoint or explicit UI completion signal.
    - Or extend polling/refresh strategy in test to wait for cloud propagation + UI hydration.

## Overview
This guide is a condensed, production-focused onboarding for the Flashcards + Anki feature set in Moshimoshi. It is intended to make a new “resident owner” productive quickly without re-learning the full codebase. It captures:
- Product intent and rules
- Core architecture and data flow
- Where business rules live
- Storage + sync behavior (local, Firebase, R2)
- SRS algorithm usage (FSRS vs SM-2)
- Media handling and Anki constraints
- Tests and known footguns

If you need deeper historical context, see `DOCS_ARCHIVE/01_PRE-PRODUCTION_DOCS/3-Features`.

---

## Purpose & Scope (Flashcards + Anki)
- Local-first flashcard system with SRS scheduling.
- Two deck types:
  - User-created flashcards (full CRUD, optional premium sync).
  - Anki imports (.apkg) stored locally; optional premium R2 backups.
- Study sessions with stats, goals, recommendations, and XP integration.
- Robust offline behavior and recovery (IndexedDB + localStorage).

### Non-negotiable product rules
- **Anki content must not be modified**: no TTS generation, no furigana generation, preserve original HTML and media references.
- **User decks use FSRS**, Anki uses **SM-2**.
- **Media URLs are ephemeral**: store filenames in HTML and hydrate blob URLs on render.
- **Missing media is acceptable** during restore; never fail restore for partial media.
- **Do not sync Anki decks via flashcards API** (server filters them out).

---

## Quick Start (Where to Look First)
1. Flashcards page and flow: `src/app/[locale]/flashcards/FlashcardsContent.tsx`
2. User decks core logic: `src/lib/flashcards/FlashcardManager.ts`
3. Anki import + storage: `src/lib/anki/importer.ts` + `src/lib/anki/AnkiDeckManager.ts`
4. Anki study flow: `src/hooks/useAnkiStudy.ts` + `src/lib/anki/AnkiStudyManager.ts`
5. Media hydration: `src/hooks/useMediaHydration.ts` + `src/lib/anki/mediaHydrator.ts`
6. R2 backup/restore:
   - Anki: `src/lib/r2/R2UploadQueue.ts`, `src/lib/r2/RestoreOrchestrator.ts`
   - User decks: `src/lib/r2/UserDeckUploadQueue.ts`, `src/lib/r2/UserDeckRestoreOrchestrator.ts`

---

## Architecture Snapshot

### Deck types
- **User deck** (`FlashcardDeck`):
  - Stored in IndexedDB (`FlashcardDB`) with optional Firebase sync for premium.
  - SRS data stored per card in `metadata`.
  - Uses FSRS via `AlgorithmFactory.getDefault()`.

- **Anki deck** (`StoredAnkiDeck`):
  - Stored in IndexedDB only.
  - Media stored in `ankiMediaDB`.
  - SRS data stored in `srsData` using SM-2 via `AnkiStudyManager`.
  - Optional R2 backup/restore for premium.

### Storage layers
- IndexedDB:
  - `FlashcardDB` for user decks and Anki decks.
  - `ankiMediaDB` for Anki media and sync queue.
  - `AnkiProgressDB` for Anki daily limits.
- Cloud (premium):
  - Firebase `flashcardDecks` and `flashcardSessions` (user decks only).
  - R2 backups for Anki packages (apkg + manifest + media) and user decks (cards.json + media + manifest).

### SRS algorithms
- **User flashcards**: FSRS via `src/lib/review-engine/srs/algorithm-factory.ts` and `TSFSRSWrapper`.
- **Anki decks**: SM-2 via `src/lib/anki/AnkiStudyManager.ts` using `SRSAlgorithm` (SM-2).

---

## Feature Flows

### Create / Edit User Deck
- UI: `DeckCreator` -> `FlashcardManager.createDeck` or `updateFullDeck`.
- Enforces deck limits and quota via `FlashcardManager.getDeckLimits` and `QuotaGuard`.
- Premium sync uses `/api/flashcards/decks` batch upsert.

### Import Anki (.apkg)
- `AnkiImporter.parsePackage` -> `AnkiDeckManager.saveDeck`.
- Media stored in `ankiMediaDB` by import modal.
- **Strict rules**: no furigana generation, no TTS, preserve original HTML.

### Study User Deck
- UI: `StudySession` -> `FlashcardViewer`.
- SRS update: `FlashcardManager.updateCardAfterReview` (FSRS default).
- Session stats saved locally and optionally to `/api/flashcards/sessions`.

### Study Anki Deck
- UI: `/anki-study/[deckId]` uses `useAnkiStudy` + `ReviewSessionUI`.
- `AnkiStudyManager.getDueCards` respects daily limits.
- SRS update: `AnkiStudyManager.processReviewResult` (SM-2).
- Updates stored via `AnkiDeckManager.updateCard`.

### Review Weak Cards (Latest Session)
- Purpose: Let students revisit “Again/Hard” cards from the latest session outside of a full study session.
- Storage: local-only, per deck, **overwritten each session**.
  - `localStorage` key: `flashcards_weak_cards_<userId>_<deckId>`
  - Stored via `weakCardsStore` (`src/lib/flashcards/weakCards.ts`).
- Premium sync: latest-only, stored in Firestore for cross-device reuse.
  - API: `GET/PUT/DELETE /api/flashcards/weak-cards`
  - Path: `users/{uid}/flashcardWeakCards/{deckId}`
  - Merge rule: client uses `updatedAt` (latest wins).
- UI entry: deck card menu action **Review Weak Cards** (shows only when weak cards exist).
  - Visual hint: pulsing red dot on the deck menu button.
- Viewer: read-only single-card review in modal (no SRS updates).
  - Filter: toggle **Again only** vs **All**.
  - Clear: wipes latest weak cards list for the deck.

### Mistake Replay (Last 3 Sessions)
- Purpose: Let students review mistakes from the **last 3 sessions** for a deck.
- Storage: local-only, per deck.
  - `localStorage` key: `flashcards_mistake_replay_<userId>_<deckId>`
  - Stored via `mistakeReplayStore` (`src/lib/flashcards/mistakeReplay.ts`).
- Source data: session responses where **incorrect** OR difficulty is **Again/Hard**.
- UI entry: Study Mode Selector -> **Mistake Replay**.
  - Includes a **Session history** row (All + Session 1/2/3 chips).
  - Session chips show date as `Mon 7` (locale short month + day).

### Audio First (Study Mode)
- Purpose: A study mode that only includes cards with audio.
- Filter: card has `audioFilename` / `audioUrl` or `front/back` media of type `audio`.
- UI entry: Study Mode Selector -> **Audio First**.

### Momentum Coach + Heat Focus (Insights Widgets)
- **Placement (Desktop):** Mastery widget on the left, Momentum Coach + Heat Focus stacked on the right (equal combined height).
- **Placement (Mobile):** stacked in a single column.
- **Momentum Coach**
  - Purpose: quick nudge to keep momentum.
  - Logic: picks the deck with the most due cards and suggests a **small session** (up to 10 due cards).
  - Action: “Start quick session” launches a session directly (no mode selection).
- **Heat Focus**
  - Purpose: surface the most fragile cards right now.
  - Pool: top 10 cards by **heat score** (see below), then tiered into Hot/Warm/Cool.
  - UI: chips grouped by tier. Clicking a chip starts a review session for **all cards in that tier**.
  - **Cross‑deck handling:** if a tier spans multiple decks, sessions are queued and run **one deck at a time**.
  - Scroll: internal list scrolls with hidden scrollbar.

#### Heat Score (Fragility)
Heat score is calculated per card (higher = more fragile):
- Lapses (weight 4)
- Accuracy penalty (1 - accuracy) * 3
- Overdue days (capped at 10)

#### Heat Tiers (Score‑based)
- **Hot:** score ≥ 8
- **Warm:** score ≥ 4
- **Cool:** score < 4

---

## Mastery Widget (Streak‑Based)

### Purpose
Provide a high‑level mastery view based on **card streaks** and recent trend.

### Summary Counters
Based on card metadata:
- **Mastered:** `status === 'mastered'`
- **Good:** `status === 'review'` and `streak >= 2`
- **To confirm:** `status === 'new' || 'learning'` OR (`status === 'review'` and `streak === 1`)
- **Bad:** `lapses >= 2` OR (`status === 'review'` and `streak === 0`)

### 7‑Day Trend (Stacked Area)
Shows card counts by streak bucket:
- **Streak 1**
- **Streak 2**
- **Streak 3+**

### Snapshot Storage
Daily snapshots are stored in IndexedDB and optionally synced (premium):
- Local store: `FlashcardDB` -> `streakSnapshots`
- Remote sync: `/api/flashcards/streak-snapshots` (premium only)
- Snapshot shape:
  - `date` (YYYY‑MM‑DD), `streak1`, `streak2`, `streak3plus`, `total`, `updatedAt`

### Snapshot Policy
- Snapshot is computed on **page load** from current card state.
- Only **today** is guaranteed (no historical backfill).

---

## Study Mode Selector Enhancements

### Custom Mode Sorting
- **Priority:** uses `FlashcardSRSHelper.sortByPriority`.
- **Random:** seeded shuffle, stable **within the modal**, reshuffled when “Start Studying” is pressed.
- **Oldest First:** falls back to `createdAt` → `modifiedAt` → `lastReviewed`; unknown timestamps go last.

### Study Mode Mastery Loop (Updated 2026-02-27)
- Study mode remains **non-SRS** (no schedule mutation), but now persists practice signals:
  - `again` -> weak cards + mistake replay + follow-up queue
  - `hard` -> weak cards + follow-up queue
  - `good` -> no follow-up queue
- After Study completion, app auto-starts chained Study rounds when follow-up queue is non-empty.
- Follow-up rounds are surfaced with localized banner keys:
  - `flashcards.studyFollowUp.title`
  - `flashcards.studyFollowUp.cardsLeft`
- Large all-new decks now rotate Study card sets across sessions using local rotation state:
  - key prefix: `flashcards_study_rotation_v1:`
- Session-completion handling is intentionally scoped:
  - Study mode uses follow-up-safe completion path
  - Other modes use normal completion flow


### Sync & Restore (Premium)
- **User decks**:
  - Upload: `UserDeckUploadQueue` writes `cards.json`, `manifest.json`, `media/*`.
  - Restore: `UserDeckRestoreOrchestrator` hydrates IndexedDB; local deck only updated if remote is newer.
- **Anki decks**:
  - Upload: `R2UploadQueue` writes `package.apkg`, `manifest.json`, `media/*`.
  - Restore: `RestoreOrchestrator` parses apkg and writes deck + media into IndexedDB.
  - Deleted card tombstones applied during restore from `/api/flashcards/decks/[deckId]/deletions`.

---

## Media Handling (Critical)
- Media URLs are blob URLs and do not persist.
- Store media filenames or `data-anki-media` attributes in HTML.
- Hydrate on render using:
  - `useMediaHydration` (single card)
  - `useBatchMediaHydration` (preload around current card)
  - `hydrateAnkiMedia` for HTML inline images

---

## Entitlements & Limits
- UI gating uses `EntitlementGate` and `useFeature`.
- Server enforcement via `evaluateFeatureAccess` in `/api/flashcards/*` routes.
- Separate limits:
  - `flashcards` (general access)
  - `flashcard_decks` (monthly deck limit)
  - `flashcard_daily_reviews` (daily session limit)
- R2 storage limit: **300MB per user** enforced on upload.

### Free Users: Current Behavior (Source of Truth)
This section describes **actual current behavior** in production code, not planned behavior.

**Page access**
- The flashcards page is gated by `EntitlementGate` on `flashcards`.
- With `limits.free.daily.flashcards = 0`, **free users cannot access the flashcards page at all**.
- Source: `config/features.v1.json`, `src/app/[locale]/flashcards/page.tsx`

**Starter decks (3)**
- Three **starter decks** exist and are seeded for any non-guest user **when the page loads** and they have no decks:
  - Japanese Greetings
  - Numbers
  - Colors
- Source: `src/lib/flashcards/starterDecks.ts`, `FlashcardManager.ensureStarterDecks`, `FlashcardsContent`

**If free page access is enabled (e.g., `flashcards = -1`), free users can:**
- Study starter decks.
- Review weak cards for starter decks (if any).

**Free users cannot:**
- Open the create/import modal (all sources blocked).
- Create or import decks (blocked by `flashcard_decks = 0`, `anki_imports = 0`).
- Edit starter decks.
- Delete starter decks.
- Export starter decks.
- Sync or R2 backup (premium-only).

**Key enforcement points**
- UI gating and modals: `FlashcardsContent`, `DeckCreator`, `DeckGrid`
- Local writes: `FlashcardManager` (`createDeck`, `updateFullDeck`, `deleteDeck`, `exportDeck`)
- Server sync: `/api/flashcards/decks` and other flashcards APIs deny free/guest writes

---

## DeckMarket Integration (Planned)

### Decisions (2026-02-11)
- **Starter decks removed** for both free and premium.
- **Free users** can have **one DeckMarket deck at a time**.
  - They can delete it and download a different DeckMarket deck.
- **Premium users** can add DeckMarket decks as normal; these **count toward premium limits**.
- **Download button stays** (users can keep `.apkg` for other apps).
- **DeckMarket decks should sync/backup for premium** (same behavior expectations as other Anki decks).

### UX Direction
- Prefer an **“Add to Flashcards”** flow from DeckMarket that **hides manual import UI**.
- Under the hood, the existing Anki import pipeline still runs to populate IndexedDB.

### Impact Map (No Code Yet)
**Entry points**
- DeckMarket UI: add “Add to Flashcards” CTA alongside “Download”.
- Flashcards UI: remove starter deck messaging + entry points.

**Storage + identity**
- Introduce a **stable marker** on decks added from DeckMarket (e.g. `origin: 'deckmarket'`).
- Use this marker for:
  - Free-tier “one deck at a time” enforcement
  - UX labeling / deletion rules
  - Sync/backup inclusion rules

**Gating + limits**
- Free tier:
  - Block all create/import sources except DeckMarket.
  - Allow only **one** deck with `origin: 'deckmarket'`.
  - Allow delete to free the slot.
- Premium tier:
  - DeckMarket decks count toward `flashcard_decks` / `anki_imports` limits.

**Starter deck removal**
- Remove seeding logic.
- Consider one-time cleanup of existing starter decks:
  - Delete locally on load if present.
  - For premium, write tombstones to prevent resurrection via sync/restore.

**Sync/backup expectations**
- Premium: DeckMarket decks should follow existing Anki backup/restore behavior (R2).
- Free: local-only.

**Risk hotspots**
- Import/gating logic: ensure “one deck max” does not block premium.
- Tombstone logic: avoid resurrecting removed starter decks.
- Deck identity: avoid treating DeckMarket decks as generic Anki decks without a marker.

---

## Key Files (Resident Owner Map)

### Flashcards
- `src/app/[locale]/flashcards/FlashcardsContent.tsx`
- `src/lib/flashcards/FlashcardManager.ts`
- `src/lib/flashcards/SRSHelper.ts`
- `src/lib/flashcards/SessionManager.ts`
- `src/components/flashcards/StudySession.tsx`
- `src/components/flashcards/FlashcardViewer.tsx`

### Anki
- `src/lib/anki/parser.ts`
- `src/lib/anki/importer.ts`
- `src/lib/anki/AnkiDeckManager.ts`
- `src/lib/anki/AnkiStudyManager.ts`
- `src/lib/anki/mediaStore.ts`
- `src/lib/anki/mediaHydrator.ts`

### R2 Backup / Restore
- `src/lib/r2/R2UploadQueue.ts`
- `src/lib/r2/RestoreOrchestrator.ts`
- `src/lib/r2/RestoreQueue.ts`
- `src/lib/r2/UserDeckUploadQueue.ts`
- `src/lib/r2/UserDeckRestoreOrchestrator.ts`
- `src/app/api/anki/r2/*`
- `src/app/api/flashcards/r2/*`

### Review Engine (shared)
- `src/components/review-engine/ReviewSessionUI.tsx`
- `src/lib/review-engine/srs/algorithm-factory.ts`
- `src/lib/review-engine/srs/ts-fsrs-wrapper.ts`
- `src/lib/review-engine/adapters/FlashcardAdapter.ts`
- `src/lib/review-engine/adapters/AnkiAdapter.ts`

---

## Tests & Diagnostics
- Flashcards API tests:
  - `src/app/api/flashcards/**/__tests__/route.test.ts`
- Anki R2 backups API tests:
  - `src/app/api/anki/r2/backups/__tests__/route.test.ts`
- Session validation tests:
  - `src/lib/flashcards/__tests__/session-validation.test.ts`
- Study session persistence test:
  - `src/components/flashcards/__tests__/StudySessionPersistence.test.tsx`
- Review engine hook tests:
  - `src/hooks/__tests__/useSessionManager.test.tsx`
- E2E:
  - `e2e/flashcards-multi-device-deletion.spec.ts` (currently flaky; see Current Status)

---

## Common Footguns
- **Anki decks must never go through flashcards APIs**: server routes filter `source === 'anki'`.
- **Media hydration is required**: blob URLs are transient and must be re-created.
- **Restore and deletions**: restore must apply deletions from `/deletions` to avoid resurrecting deleted cards.
- **Local vs server**: premium users still rely on IndexedDB for offline access; sync is additive and conflict-resolved by `updatedAt`.
- **Deck name collisions**: `AnkiDeckManager.saveDeck` rejects duplicates across all decks for a user.
- **Signed URL failures**: R2 presigned URLs will fail with `InvalidArgument/Authorization` if the system clock is off. Always verify local system time.

---

## Minimal Change Strategy
When adding or fixing behavior:
1. Find the closest existing pattern (FlashcardManager or AnkiDeckManager) and extend it.
2. Keep changes local to the feature boundary.
3. Respect SRS algorithm separation (FSRS for user decks, SM-2 for Anki).
4. Never add media URL logic outside hydration or media store.

---

## Debugging Checklist
- Confirm deck `source` and storage location (local vs Firebase).
- Check IndexedDB contents:
  - `FlashcardDB.decks`
  - `ankiMediaDB.media`
  - `AnkiProgressDB.dailyProgress`
- For missing images: verify `data-anki-media` and `AnkiMediaStore.getMediaUrl`.
- For sync issues: confirm entitlements and `updatedAt` conflict logic.
- For restore issues: inspect R2 manifest and downloaded file counts.

---

## Open Questions (if needed)
- None currently blocking; feature rules are defined in pre-production docs and enforced in code.

---

## Related Documentation
- Pre-production flashcards/Anki/FSRS docs:
  - `DOCS_ARCHIVE/01_PRE-PRODUCTION_DOCS/3-Features/*`
- Entitlements guidance:
  - `02-PRODUCTION_DOCS/entitlements/README.md`
- Gamification and XP:
  - `02-PRODUCTION_DOCS/entertainment-system/README.md`

---

## Context Extensions (Make This 100% Self-Sufficient)
Use these only when you need deeper system knowledge or cross-feature coupling details:
- Entitlements enforcement and UI gating patterns:
  - `02-PRODUCTION_DOCS/entitlements/README.md`
  - `02-PRODUCTION_DOCS/entitlements/FEATURE_GUIDE.md`
- Review Engine internals (session lifecycle, validation, analytics):
  - `src/lib/review-engine/session/manager.ts`
  - `src/hooks/useSessionManager.ts`
  - `src/lib/review-engine/core/*`
- FSRS implementation details and migration tests:
  - `src/lib/review-engine/srs/*`
  - `DOCS_ARCHIVE/01_PRE-PRODUCTION_DOCS/3-Features/TS_FSRS_*`
- R2 storage details and failure modes:
  - `src/app/api/anki/r2/*`
  - `src/app/api/flashcards/r2/*`
- Historical product intent and edge cases:
  - `DOCS_ARCHIVE/01_PRE-PRODUCTION_DOCS/3-Features/*`
