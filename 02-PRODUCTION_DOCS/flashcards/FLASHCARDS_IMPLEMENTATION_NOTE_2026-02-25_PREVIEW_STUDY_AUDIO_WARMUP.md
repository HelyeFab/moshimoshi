# Flashcards Implementation Note (2026-02-25)

**Status:** Implemented  
**Scope:** Preview/Study modes, local audio warmup, deck creation quota UX, and related flashcards/Anki reliability work completed in this session.

## Why This Note Exists
This document captures the exact feature and UX changes implemented today so future developers can:
- understand product intent,
- find the relevant code quickly,
- avoid reintroducing regressions,
- and distinguish deliberate policy behavior from bugs.

## Update Addendum (2026-02-27)
This section records follow-up changes made after the initial 2026-02-25 rollout.

### 1) Study Mode Mastery Loop (Non-SRS, But Persistent Practice Signals)
Implemented:
- Study mode now uses self-check responses to power mastery follow-ups:
  - `I didn't know` (`again`) -> persisted to weak cards + mistake replay + follow-up queue
  - `Hard` (`hard`) -> persisted to weak cards + follow-up queue
  - `I knew it` (`good`) -> no follow-up queue entry
- On Study session completion, if follow-up queue is non-empty, the app auto-starts another Study round with queued cards.
- Chained rounds continue until queue is cleared.

Preserved:
- Study mode still does **not** write SRS scheduling state.
- Study mode still does **not** write session stats/XP.

### 2) Study Mode Card Rotation for Large All-New Decks
Problem:
- With decks larger than 20 all-new cards, Study mode repeatedly served the same first 20 cards.

Fix:
- Added per-user/per-deck Study rotation state in localStorage (`flashcards_study_rotation_v1:*`).
- Study sessions now rotate card chunks without replacement until pool exhaustion, then reshuffle.

### 3) Accuracy > 100% Bug Fix
Problem:
- Rapid repeated taps on Study self-check buttons could double-count `correctCount`, showing >100% accuracy.

Fix:
- Responses are now idempotent per card position (index), not just by card id.
- Study self-check buttons disable after first answer per card position.
- Header accuracy uses stable answered counters from session state.

### 4) Duplicate Card ID Completion Reliability
Problem:
- Decks containing duplicate card ids (possible in imports) could stall on last-card completion in Study mode.

Fix:
- Answer-tracking and graded-state logic switched to per-card-position handling.
- Study completion fallback remains scoped to Study mode only.

### 5) UI/UX Polish
- Added auto-hide for the "Guided practice..." hint banner (4.5s).
- Added localized Study follow-up banner:
  - `flashcards.studyFollowUp.title`
  - `flashcards.studyFollowUp.cardsLeft`
  - implemented across `en`, `ja`, `de`, `es`, `fr`, `it`.

### 6) Behavior Clarification (Source of Truth)
- **Preview mode**: non-SRS, non-persistent (no weak/mistake writes).
- **Study mode**: non-SRS, but **does** persist weak/mistake practice signals to support mastery drills.
- **Other modes**: unchanged normal completion flow.

## Executive Summary
Implemented and validated:

1. **Preview Mode** for flashcards (zero-pressure browsing, no SRS writes)
2. **Study Mode** for flashcards (guided self-check, no SRS writes)
3. **New deck recommendation flow**
   - defaults to `Preview`
   - shows “Recommended for new decks” in Study Mode Selector
4. **Preview completion handoff**
   - prompt: `Start Review` or `Back to Decks`
5. **Local-only Japanese audio pre-generation (device cache)**
   - for `Preview` / `Study`
   - first 5 cards first, then background warmup
   - uses existing `OfflineTTSCache` (IndexedDB)
6. **Audio warmup UI indicator**
   - non-blocking
   - uses app `Alert` (Doshi mascot) + `ProgressBar`
   - fully localized (6 locales)
7. **Deck creation quota UX improvements**
   - dynamic quota copy (config-driven via entitlements API)
   - reusable quota banner + explainer
   - disabled Create Deck menu action when quota exhausted
8. **Anki backup delete reliability improvements**
   - synchronous delete API orchestrates tombstone + metadata + R2 delete
   - partial cleanup jobs + retry route/script + 4h Vercel cron

## Product Problem Solved (Flashcards Study Flow)
### Problem
Users creating/importing a brand-new deck were immediately dropped into a quiz-like flashcard review flow. This felt like being tested before familiarization.

### Solution
Added two gentler modes:
- **Preview**: browse cards in authored order, no grading, no SRS updates
- **Study**: guided self-check with lightweight confidence actions, no SRS updates

This preserves the existing SRS review flow but adds a better learning-onramp.

## What Was Implemented

### 1) Preview / Study Modes
#### Behavior
- `Preview`
  - Uses deck order (`deck.cards`) to preserve structured progression
  - No grading buttons from `FlashcardViewer`
  - No SRS updates
  - No weak-card / mistake replay writes
  - No session stats persistence / XP
- `Study`
  - Guided self-check buttons (`I didn't know`, `Hard`, `I knew it`)
  - No SRS updates
  - Persists weak-card / mistake replay practice signals (non-SRS)
  - No session stats persistence / XP
  - Auto-chains follow-up drill rounds until queued `again/hard` cards are cleared

#### Files
- `src/components/flashcards/StudyModeSelector.tsx`
  - Added `preview` and `study` modes
  - Card selection rules:
    - `preview` -> all cards (deck order)
    - `study` -> mixed due/new if available, otherwise all cards
- `src/app/[locale]/flashcards/FlashcardsContent.tsx`
  - Tracks explicit session behavior mode (`activeStudySessionMode`)
  - Threads mode into `StudySession`
  - Restores persisted/remote session mode for resume flows
- `src/components/flashcards/StudySession.tsx`
  - Branches behavior for `preview` / `study`
  - Disables SRS/state persistence side effects for non-SRS modes
- `src/types/flashcards.ts`
  - `StudyMode` widened to include `preview` and `study`

## 2) New Deck Recommendation UX
### Behavior
- If `deck.stats.totalStudied === 0`, Study Mode Selector:
  - preselects `Preview`
  - shows a localized “Recommended for new decks” badge on Preview mode

### Files
- `src/components/flashcards/StudyModeSelector.tsx`
- i18n keys added:
  - `flashcards.recommendedForNewDeck`

## 3) Preview Completion -> Start Review Prompt
### Behavior
When a `Preview` session ends, user sees a dialog:
- **Start Review** -> reopens study mode selector for that deck
- **Back to Decks**

This keeps Preview as a learning onramp without trapping users outside the review flow.

### Files
- `src/app/[locale]/flashcards/FlashcardsContent.tsx`
- i18n keys added:
  - `flashcards.previewComplete.title`
  - `flashcards.previewComplete.message`
  - `flashcards.previewComplete.startReview`
  - `flashcards.previewComplete.backToDecks`

## 4) Local-Only Japanese Audio Warmup (Device Cache)
### Product Decision
Audio pre-generation for flashcards should be **device-local only**, not Firebase/R2:
- user decks are personal/private
- no need to pay cloud storage for user-specific TTS assets
- avoids expiring signed URL issues
- keeps architecture simpler

### Implementation Details
#### Warmup strategy
- Triggered only in `Preview` / `Study`
- Generates Japanese-only audio
- Warms **first 5 cards first** (better immediate UX)
- Continues in background in small batches
- Stores audio in local IndexedDB via existing `OfflineTTSCache`

#### Cache check granularity (important)
Warmup checks per:
- normalized text
- provider
- voice
- speed

Not “deck has audio” globally. This avoids duplicate generation and supports partial cache state.

#### Local completion marker
Warmup writes a local marker when full deck warmup completes:
- key includes deck id + deck updatedAt + card count + voice/speed + version
- prevents repeating full warmup every session on the same device unless deck content/version changes

#### Files
- `src/lib/flashcards/audioWarmup.ts` (new)
  - local-only warmup service
  - Japanese-only filtering
  - normalization
  - background batching
  - progress callback
- `src/components/flashcards/StudySession.tsx`
  - starts warmup for `preview` / `study`
  - cancels on unmount/session change

### Important Constraints / Tradeoffs
- This still calls `/api/tts/synthesize` to generate audio, but **storage persistence is local only**
- If browser evicts IndexedDB cache, audio regenerates on demand
- Cross-device reuse is intentionally not supported (by design)

## 5) Audio Warmup UI Indicator (Doshi + i18n)
### Behavior
Non-blocking indicator shown during Preview/Study while local audio warmup is running:
- app `Alert` component
- Doshi mascot (`showDoshi`)
- app `ProgressBar`
- localized strings

### Files
- `src/components/flashcards/StudySession.tsx`
  - renders `Alert` + `ProgressBar` during `audioWarmupProgress.phase === 'warming'`
- `src/lib/flashcards/audioWarmup.ts`
  - reports progress via callback (`warming`, `complete`, counts)

### i18n keys
- `flashcards.audioWarmup.title`
- `flashcards.audioWarmup.message`
- `flashcards.audioWarmup.progress`

## 6) Deck Creation Quota UX (Premium Policy Clarification)
### Background
A premium user hitting “Save” in Deck Creator received a generic limit toast. Investigation confirmed this was **policy**, not a code bug:
- `flashcard_decks` is a monthly creation quota
- deleting decks does not refund quota

### Implemented UX improvements
- Dynamic, entitlement-backed quota toast copy (`X/Y`, not hardcoded)
- Reusable `DeckCreationQuotaBanner` component in Deck Creator
- “How limits work” explainer (localized)
- Disabled Create Deck page menu action with quota explanation when exhausted

### Key files
- `src/components/flashcards/DeckCreator.tsx`
- `src/components/flashcards/DeckCreationQuotaBanner.tsx`
- `src/app/[locale]/flashcards/FlashcardsContent.tsx`
- `src/components/ui/ActionMenu.tsx`
- `src/hooks/useFeature.ts`

### Related doc
- `DECK_CREATION_QUOTA_UX_AND_POLICY_NOTE_2026-02-22.md`

## 7) Shared Flashcards Premium Entitlements Helper (API Consistency)
### Why
Premium-only flashcards sync routes had inconsistent plan-check logic.

### Implemented
- Shared helper introduced for premium route checks:
  - `src/app/api/flashcards/_lib/entitlements.ts`
- Adopted in premium sync-related routes (`active-session`, `goals`, `recommendations`, `weak-cards`, `streak-snapshots`)

## 8) Anki R2 Backup Delete Reliability + Retry
### Problem
Partial cleanup could leave inconsistent state across:
- `anki_r2_backups` metadata
- `users/{uid}/deletedAnkiDecks` tombstones
- R2 objects

### Implemented
- `POST /api/anki/r2/delete` is now synchronous server-orchestrated cleanup
  - writes tombstone
  - deletes metadata
  - attempts R2 deletion
  - returns `status: complete | partial`
- Partial cleanup jobs persisted in:
  - `users/{uid}/ankiBackupCleanupJobs/{deckId}`
- Retry mechanisms:
  - route: `src/app/api/anki/r2/cleanup-retry/route.ts`
  - script: `scripts/retry-anki-r2-cleanup.js`
  - Vercel cron every 4 hours
- Re-import fix:
  - `POST /api/anki/r2/metadata` clears stale tombstones on re-import

## Testing Added (Today)
### Preview / Study Mode Behavior
- `src/components/flashcards/__tests__/StudySessionModes.test.tsx`
  - verifies Preview/Study do **not** call SRS updates or session stat persistence

### New Deck Preview Recommendation
- `src/components/flashcards/__tests__/StudyModeSelector.preview.test.tsx`
  - verifies new deck defaults to Preview and starts Preview mode

### Audio Warmup Service
- `src/lib/flashcards/__tests__/audioWarmup.test.ts`
  - verifies Japanese-only filtering
  - verifies progress callbacks
  - verifies deck completion marker
  - verifies skip when already warmed

### Audio Warmup UI (Doshi indicator)
- `src/components/flashcards/__tests__/StudySessionAudioWarmupUI.test.tsx`
  - verifies Doshi alert + progress UI shows during warmup

### Follow-Up Reliability + Study Quality
- `src/components/flashcards/__tests__/StudySessionModes.test.tsx`
  - verifies duplicate taps are ignored
  - verifies Study mode persists weak/mistake signals + follow-up IDs
  - verifies follow-up drill banner rendering
  - verifies mode hint auto-hides
  - verifies duplicate card IDs still complete in Study mode
- `src/components/flashcards/__tests__/StudyModeSelector.preview.test.tsx`
  - verifies large all-new Study sessions are not locked to first 20 cards
  - verifies Study card rotation across consecutive sessions

## i18n Changes (6 Locales)
Updated:
- `src/i18n/locales/en/strings.ts`
- `src/i18n/locales/es/strings.ts`
- `src/i18n/locales/it/strings.ts`
- `src/i18n/locales/fr/strings.ts`
- `src/i18n/locales/de/strings.ts`
- `src/i18n/locales/ja/strings.ts`

Added keys include:
- `flashcards.modes.preview.*`
- `flashcards.modes.study.*`
- `flashcards.recommendedForNewDeck`
- `flashcards.previewComplete.*`
- `flashcards.audioWarmup.*`
- plus quota UX keys (see quota note)

## Key Architectural Decisions (Preserve These)
1. **Preview/Study are non-SRS modes**
   - Do not write scheduling state or session stats/XP
   - Preview: no weak/mistake writes
   - Study: may write weak/mistake practice signals for mastery follow-ups
2. **Audio warmup is local-only**
   - Store pre-generated audio on device via `OfflineTTSCache`
   - Do not persist flashcards pregenerated audio to Firebase/R2 by default
3. **Warmup cache checks are per normalized text+voice+speed**
   - Not per-deck global flag only
4. **Use app components + i18n**
   - Audio warmup indicator uses `Alert` (Doshi) + `ProgressBar`
5. **Keep server-side entitlements authoritative**
   - UI pre-checks improve UX, but save-time and API checks remain final enforcement

## Open Follow-Ups (Optional)
1. Add an explicit “Preparing audio…” settings toggle for Preview/Study (user preference)
2. Add warmup progress persistence/resume across app restarts (currently session-scoped UI only; cache persists)
3. Add local cache maintenance UI (clear flashcards audio cache / size estimate) using `OfflineTTSCache.getCacheStats()`
4. Add docs note for local audio warmup in `FLASHCARDS_ONBOARDING.md` if support/dev onboarding needs it

## Quick File Map (What to Read First)
- `src/app/[locale]/flashcards/FlashcardsContent.tsx`
  - mode routing, session handoff, preview-complete dialog, quota pre-check menu UX
- `src/components/flashcards/StudyModeSelector.tsx`
  - Preview/Study options + new deck recommendation
- `src/components/flashcards/StudySession.tsx`
  - non-SRS behavior, warmup trigger, Doshi warmup UI
- `src/lib/flashcards/audioWarmup.ts`
  - local-only Japanese audio pre-generation service
- `src/components/flashcards/DeckCreationQuotaBanner.tsx`
  - reusable quota banner component
- `src/app/api/anki/r2/delete/route.ts`
  - synchronous cleanup endpoint
- `src/app/api/anki/r2/cleanup-retry/route.ts`
  - partial cleanup retry route
