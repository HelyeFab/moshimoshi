# Manual QA Checklist — PracticeSegment Architecture Migration

Last updated: 2026-03-13
Owner: Agent 04 (QA & Benchmarks)
Status: active

## 1. Purpose

This checklist is used after each phase merge to manually verify that the player still produces correct, safe, repeat-worthy practice segments.

Automated tests catch contract and shape regressions.
This checklist catches perceptual and UX regressions that automation cannot.

## 2. When To Run

Run this checklist:
- after merging Agent 01 (backend data model)
- after merging Agent 02 (page migration)
- after merging Agent 03 (edit mode MVP)
- after any segmentation heuristic change
- before releasing to production

## 3. Test Videos

Pick at least one video per benchmark category (see `BENCHMARK_VIDEO_SET.md`):
- [ ] Normal speech
- [ ] Fast speech / dialogue
- [ ] Lyrics
- [ ] Noisy / bad captions
- [ ] Long transcript

## 4. Core Checks

### 4.1 "Is this the right thing to repeat?"

For each test video, review the first 10 segments displayed:

- [ ] Each segment contains a complete or near-complete thought
- [ ] No segment starts or ends mid-word
- [ ] No orphan particles isolated as standalone segments (ね、よ、か alone)
- [ ] No duplicate text between adjacent segments
- [ ] Segment text length feels appropriate for one repeat cycle (not too short, not too long)
- [ ] Japanese punctuation is not lost or garbled

### 4.2 "Does the player stop and restart exactly there?"

For each test video, test loop behavior on at least 3 segments:

- [ ] Player stops at the correct end boundary (no audio bleed into next segment)
- [ ] Player restarts from the correct start boundary (no skipped audio at beginning)
- [ ] Repeat loop cycles correctly (seek → play → stop → seek → play)
- [ ] No desync between highlighted text and audio position
- [ ] Seek verification still works (player reaches the intended timestamp)
- [ ] Forward/backward segment navigation lands on correct boundaries

### 4.3 "Are lyrics not degraded?"

For lyrics benchmark videos specifically:

- [ ] Source line breaks from captions are preserved in final segments
- [ ] Lyric lines are NOT aggressively merged into speech-like clauses
- [ ] Repeated refrains/chorus lines remain as separate repeat units
- [ ] Timing boundaries respect musical phrasing (not cutting mid-verse)
- [ ] Quality score does not unfairly penalize lyric structure (note: score may be lower, that is expected — check that it is not worse than baseline)

### 4.4 Session and state integrity

- [ ] Transcript loads without error on all benchmark videos
- [ ] Session restore (reload page) returns to the correct segment
- [ ] Translation lookup still works on any segment
- [ ] Word explanation still works for clicked words
- [ ] No JavaScript errors in console during normal playback

## 5. Regression Indicators

Flag as a regression if any of the following are true:

| Signal | Severity | Action |
|---|---|---|
| Audio bleeds into next segment | Critical | Block merge |
| Loop desync (text and audio diverge) | Critical | Block merge |
| Segment starts mid-word | High | File bug, may block merge |
| Orphan particle appears as solo segment | Medium | File bug |
| Quality score drops > 5% on any benchmark video | Medium | Investigate |
| New console errors during playback | Medium | Investigate |
| Translation/word-explanation breaks | Medium | Investigate |
| Segment feels too long but still works | Low | Note for future |

## 6. Post-Phase 1 Specific Checks

After Agent 01 merges the backend data model:

- [x] Transcript route response includes `computedPracticeSegments` array — verified by route-contract test (Agent 05)
- [x] Transcript route response includes `finalPracticeSegments` array — verified by route-contract test (Agent 05)
- [x] Legacy `segments` field is still present for backwards compatibility — verified by route-contract test (Agent 05)
- [x] `finalPracticeSegments` count matches `segments` count (Phase 1: no overrides yet) — verified by route-contract test (Agent 05)
- [x] Each segment has `contentKind`, `segmentationPolicy`, `boundaryConfidence` fields — verified by route-contract test, 25 field-level assertions (Agent 05)
- [ ] Player behavior is identical to pre-merge (no visible regression) — requires manual QA
- [x] At least one route-contract check exists against the real `/api/youtube/transcript/[videoId]` response shape before Phase 2 sign-off — route-handler test imports and calls real GET handler (18 tests at `src/app/api/youtube/transcript/__tests__/routeContract.test.ts`), supplemented by builder-pipeline harness (68 tests at `src/lib/transcript/__tests__/builderPipelineContract.test.ts`) (Agent 05)

## 7. Post-Phase 2 Specific Checks

After Agent 02 merges the page migration:

- [x] Page reads `finalPracticeSegments` when available — verified by code inspection of `extractSegmentsFromResponse()` (Agent 05)
- [x] Page falls back to `segments` when `finalPracticeSegments` is absent — verified by code inspection, legacy path at page.tsx:174 (Agent 05)
- [ ] Repeat state machine works exactly as before — requires manual QA
- [ ] No change in visible UX unless intentional — requires manual QA
- [x] Route-contract coverage has been added or verified for the transcript API response shape used by the page — route-handler test (18 tests calling real GET) + builder-pipeline harness (68 tests) (Agent 05)
- [x] Translation preservation has been verified when `finalPracticeSegments` are used — verified by code inspection, text-based lookup at page.tsx:154-161 (Agent 05)
- [x] Known limitation recorded: translation merge is currently text-based, so repeated identical lines may attach the wrong cached translation until a stronger join key is exposed — recorded in PHASE3_VALIDATION_REPORT.md (Agent 05)

## 8. Post-Phase 3 Specific Checks

After Agent 03 merges the edit mode MVP:

- [x] "Edit Segments" mode can be toggled on/off — verified by code inspection, `editMode` state + `toggleEditMode` handler (Agent 05)
- [x] Merge adjacent segments produces correct combined text and timing span — verified by code inspection of `mergeAdjacentSegments()` (Agent 05)
- [x] Split segment at text position produces two correctly timed segments — verified by code inspection of `splitSegmentAtPosition()` (Agent 05)
- [x] Reset to original restores computed segments — verified by code inspection, `originalSegmentsRef` guard fixed by Agent 03 resubmission (Agent 05)
- [x] Edits survive page reload (localStorage persistence) — verified by code inspection, `saveSegmentOverrides`/`loadSegmentOverrides` at page.tsx load and restore paths (Agent 05)
- [ ] Edits do not break repeat logic — requires manual QA
- [x] `isUserEdited` is true on modified segments — verified by code inspection, set in `mergeAdjacentSegments` and `splitSegmentAtPosition` (Agent 05)

## 9. Sign-Off

| Phase | QA Runner | Date | Pass/Fail | Notes |
|---|---|---|---|---|
| Phase 1 (backend) | Agent 05 | 2026-03-14 | Automated pass | Route-handler test (18 tests calling real GET) + builder harness (68 tests). Manual QA pending. |
| Phase 2 (page migration) | Agent 05 | 2026-03-14 | Automated pass | extractSegmentsFromResponse compatibility verified against real route output. Manual QA pending. |
| Phase 3 (edit mode) | Agent 05 | 2026-03-14 | Automated pass | Code inspection confirms merge/split/reset/persistence correctness. Manual QA pending. |

### Agent 05 Validation Notes

- **Route-contract gap**: closed. Route-handler test at `src/app/api/youtube/transcript/__tests__/routeContract.test.ts` imports and calls the real `GET` handler (18 tests). Builder-pipeline harness at `src/lib/transcript/__tests__/builderPipelineContract.test.ts` provides supplementary coverage (68 tests).
- **Benchmark/manual QA**: automated validation complete. Manual QA against live benchmark videos remains pending (requires running dev server).
- **Known limitations**: translation text-key collision documented. Missing benchmark videos for 3 of 5 categories (fast speech, lyrics, noisy captions).
- **Full test suite**: 221 tests pass across 9 test suites, 0 regressions.
- **Remaining action**: run manual QA checklist (sections 4.1–4.4) against live videos before production release.
