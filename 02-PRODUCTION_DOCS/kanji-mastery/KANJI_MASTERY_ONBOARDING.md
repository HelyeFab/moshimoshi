# Kanji Mastery Developer Onboarding

**Status:** ACTIVE
**Last Updated:** 2026-01-28

## Overview
This onboarding guide is specific to the **Kanji Mastery** feature. It explains the end-to-end flow (UI -> session tracking -> SRS scheduling -> storage/sync), the key code paths, and how to extend or debug the feature safely.

---

## Feature Entry Points

### Routes
- Tool landing: `src/app/[locale]/tools/kanji-mastery/page.tsx`
- Learning session: `src/app/[locale]/tools/kanji-mastery/learn/page.tsx`
- Learning layout: `src/app/[locale]/tools/kanji-mastery/learn/layout.tsx`

### Core UI Module
- Session UI controller: `src/app/[locale]/tools/kanji-mastery/learn/LearnContent.tsx`
- Round components:
  - Round 1 (learn): `src/app/[locale]/tools/kanji-mastery/learn/components/Round1Learn.tsx`
  - Round 2 (test): `src/app/[locale]/tools/kanji-mastery/learn/components/Round2Test.tsx`
  - Round 3 (evaluate): `src/app/[locale]/tools/kanji-mastery/learn/components/Round3Evaluate.tsx`

### Session Completion UI
- Session complete modal: `src/app/[locale]/tools/kanji-mastery/components/SessionCompleteModal.tsx`

---

## User Flow (Happy Path)

1) User enters `/tools/kanji-mastery` and starts a session.
2) `/learn` loads kanji based on `mode`, `level`, `approach`, and `size` query params.
3) Session proceeds through 3 rounds (learn -> test -> self-evaluate).
4) On completion, session data is persisted via the **KanjiMasteryProgressManager**.
5) Progress is stored in IndexedDB for all users; premium users also sync to Firebase.

---

## Session State Model

`LearnContent.tsx` maintains a `SessionState` with:
- `kanji`: selected session list
- `currentRound`: 1..3
- `currentIndex`: current kanji pointer
- `progress`: Map of per-kanji performance
- `reviewAgainPile`: Set of weak kanji (accuracy < 70%)
- `sessionId`, `startTime`, `level`, `mode`

Key types:
- `SessionState` and `KanjiProgress` in `LearnContent.tsx`
- `KanjiSession`, `KanjiProgressRecord` in `src/lib/kanji-mastery/kanjiMasteryDB.ts`

---

## Kanji Selection Logic

Selection is handled in `src/app/[locale]/tools/kanji-mastery/learn/kanjiSelection.ts`.

### Smart Approach
- Uses IndexedDB progress to pick:
  - Due items (by `srsData.nextReviewAt`)
  - Weak items (by `srsData.difficulty` + accuracy)
  - New items (up to 60% of the session)
- Avoids recently-seen kanji via recent session history.

### Mixed Mode
- Blends due/weak/new from all JLPT levels.
- Prefers lowest unmastered level when picking new items.

### Linear Approach
- Progress tracked in local storage (`kanjiLinearProgress`).

---

## Test Order Logic (Round 2)

Test sequence generation is handled in `src/app/[locale]/tools/kanji-mastery/learn/testOrder.ts`.

- **Per‑kanji randomization** via `buildRound2TestSequence()`
- **Constraints**: optional on/kun adjacency prevention and session-level de‑clumping
- **Deterministic testing**: supports seeded RNG injection

---

## SRS Pipeline (Core Logic)

### Primary Flow
1) Session completion triggers `saveSession()` in `LearnContent.tsx`.
2) `KanjiMasteryProgressManager.trackSession()` transforms round performance into SRS updates.
3) SRS algorithm is selected via `AlgorithmFactory.fromSRSData()`.
4) New cards default to **FSRS** via `AlgorithmFactory.getDefault()`.

### Key Files
- Progress manager: `src/lib/review-engine/progress/KanjiMasteryProgressManager.ts`
- Algorithm selection: `src/lib/review-engine/srs/algorithm-factory.ts`
- FSRS wrapper: `src/lib/review-engine/srs/ts-fsrs-wrapper.ts`
- SRS data shape: `src/lib/review-engine/core/interfaces.ts`

### How Performance Maps to FSRS Ratings
- Round 2 accuracy (0..1) and Round 3 rating (1..5) are combined.
- `mapPerformanceToDifficulty()` produces `again|hard|good|easy`.
- That difficulty is passed to FSRS as the scheduling rating.

---

## Storage & Sync

### IndexedDB (All Users)
- `KanjiMasteryDB` stores sessions, progress, and statistics.
- Source: `src/lib/kanji-mastery/kanjiMasteryDB.ts`
- Stores serialized SRS data in `srsData`.

### Firebase (Premium Only)
- API route: `src/app/api/kanji-mastery/session/route.ts`
- Saves:
  - `users/{uid}/kanji_mastery_sessions`
  - `users/{uid}/kanji_progress`
  - `users/{uid}/statistics/kanji_mastery`

### Data Consistency Rules
- IndexedDB write happens first (LWW).
- Firebase sync is best-effort and never blocks session completion.

---

## Events & Gamification

- Kanji Mastery emits events using `kanjiMasteryEvents` in `src/app/[locale]/tools/kanji-mastery/events.ts`.
- Session completion emits to the global Review Engine event hub.
- Gamification updates are gated by `NEXT_PUBLIC_ENABLE_GAMIFICATION`.

---

## Query Params (Learning Session)

`/tools/kanji-mastery/learn?` supports:
- `size`: number of kanji per session (default: 5)
- `mode`: `jlpt` | `grade` | `mixed`
- `level`: JLPT level or grade
- `approach`: `smart` | `linear`
- `testMode`: `choice` | `recall`

---

## Debugging Checklist

### No kanji available
- Check kanji data loading in `kanjiService`.
- Verify IndexedDB is not returning empty or corrupted progress.

### SRS not updating
- Ensure `trackSession()` is called in `saveSession()`.
- Confirm `existingSrsData` is being deserialized correctly.
- Inspect `algorithm` field in stored `srsData`.

### Incorrect scheduling
- Verify `mapPerformanceToDifficulty()` thresholds.
- Check that `responseTimeMs` is sane (average per session).
- Validate FSRS parameters via `TSFSRSWrapper.getVersion()` if needed.

---

## Tests

- Selection logic tests: `src/app/[locale]/tools/kanji-mastery/learn/__tests__/kanjiSelection.test.ts`
- API route tests: `src/app/api/kanji-mastery/session/__tests__/route.test.ts`

Recommended test commands:
```bash
npm run test:unit -- kanji-mastery
```

---

## Safe Extension Points

- Add new selection strategies in `kanjiSelection.ts`.
- Adjust performance mapping in `mapPerformanceToDifficulty()`.
- Extend session stats in `calculateSessionStats()`.
- Add new analytics in `kanjiMasteryEvents` pipeline.

---

## Common Pitfalls

- Do not rely on Firebase for free users; IndexedDB is the source of truth.
- Avoid breaking `SerializedSRSData` shape; it is used for both local and remote data.
- Avoid large per-kanji network calls inside session completion.
- Respect the `reviewAgainPile` threshold if you change accuracy scoring.

---

## Related Resources

- `src/lib/review-engine/srs/README.md` (SRS internals)
- `src/lib/review-engine/progress/KanjiMasteryProgressManager.ts`
- `src/lib/kanji-mastery/kanjiMasteryDB.ts`
- `src/app/api/kanji-mastery/session/route.ts`

---

## Change Log
- 2026-01-28: Replaced generic onboarding with Kanji Mastery-specific onboarding.
