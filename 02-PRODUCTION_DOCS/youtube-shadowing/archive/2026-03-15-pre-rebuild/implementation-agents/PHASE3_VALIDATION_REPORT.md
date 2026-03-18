# Phase 3 Validation Report — PracticeSegment Architecture

Date: 2026-03-14
Author: Agent 05 (Route Contract & Benchmark Validation)
Status: complete

## 1. Scope

This report covers the validation pass after all four implementation agents were accepted:

- Agent 01: backend PracticeSegment types + builder module
- Agent 02: page migration to prefer finalPracticeSegments
- Agent 03: edit mode MVP (merge/split/reset with localStorage persistence)
- Agent 04: builder-level QA tests + benchmark/checklist docs

## 2. Route-Contract Coverage

### 2.1 Route-handler test (primary deliverable)

New test file: `src/app/api/youtube/transcript/__tests__/routeContract.test.ts`

18 tests that import and call the real `GET` handler exported from route.ts.

**Mock boundary**: external transcript providers (Firebase cache, Supa, YouTube) are mocked at the module boundary. The route's internal logic — segment cleanup, merge, normalize, `buildPracticeSegmentLayers` — runs for real. Console output confirms the real handler executes: `[TRANSCRIPT-API] ✅ Cache hit! Returning 5 segments`.

| Group | Tests | What it validates |
|---|---|---|
| Response basics | 3 | available, videoId, source correct |
| Legacy segments | 2 | `segments` array exists with start/end/text fields |
| Practice segment layers | 3 | sourceSegments, computedPracticeSegments, finalPracticeSegments exist and are non-empty |
| Page-required fields | 1 | All fields page.tsx reads (id, text, startTime, endTime, contentKind, segmentationPolicy, boundaryConfidence, isUserEdited) present on every FinalPracticeSegment |
| Timing safety | 3 | No overlaps, positive durations, monotonic ordering on real route output |
| Provenance chain | 3 | computedSegmentIds and sourceSegmentIds reference real segments |
| Count consistency | 1 | finalPracticeSegments.length === segments.length |
| Cache called | 1 | transcriptCache.get invoked with correct content ID |
| Page compat | 1 | extractSegmentsFromResponse mapping works on real route output |

### 2.2 Builder-pipeline harness (supplementary)

Renamed test file: `src/lib/transcript/__tests__/builderPipelineContract.test.ts`

68 tests exercising the builder functions directly (buildSourceSegments, buildComputedPracticeSegments, buildFinalPracticeSegments) with realistic data. This does not import the route handler — it provides additional coverage of the builder pipeline including AI vs deterministic paths, Phase 1 defaults, and negative assertions.

### Result

The route-contract gap is now closed. The route-handler test at `src/app/api/youtube/transcript/__tests__/routeContract.test.ts` imports and calls the real `GET` handler, confirming that the actual route response includes all three practice segment layers with the correct shape for the page consumer.

## 3. Benchmark Validation

### 3.1 Normal Speech

Category: normal spoken Japanese at natural pace.
Benchmark video: `Xs0Lxif1u9E` (43 segments, deterministic path).

**Automated validation:**
- Route-contract test: pass (deterministic path tested with realistic Japanese segments)
- Builder shape tests (Agent 04): 36 tests pass
- Instrumentation tests (Agent 04): 28 tests pass
- Timing safety: no overlaps, no negative durations, monotonic ordering — confirmed

**Manual QA:**
- Could not be performed in this session. The dev server was not running during this validation pass, and calling the live transcript API requires network access to external providers.
- The builder pipeline is the same code path that produces segments for this category. Contract test confirms the output shape is correct.

**Result:** automated pass. Manual QA: unverified (requires running dev server with live API).

### 3.2 Fast Speech / Dialogue

Category: rapid conversational Japanese, short utterances.
Benchmark video: none in benchmark-latest.json. Recommended additions not yet captured.

**Automated validation:**
- The builder pipeline handles short segments correctly (tested with 5 segments including short ones in route-contract test).
- Timing safety holds regardless of segment duration.
- No fast-speech-specific logic in the PracticeSegment pipeline (it wraps whatever the upstream pipeline produces).

**Manual QA:**
- Could not be performed. No benchmark video captured for this category yet.

**Result:** automated pass (pipeline is content-agnostic). Manual QA: unverified (no benchmark video available).

### 3.3 Lyrics

Category: music/karaoke content with line-based structure.
Benchmark video: none in benchmark-latest.json. Recommended additions not yet captured.

**Automated validation:**
- Phase 1-2 scope: lyrics segments are not broken worse than baseline. The pipeline does not apply any lyrics-specific heuristics (contentKind defaults to `unknown`, segmentationPolicy to `fallback-safe`).
- Phase 4+ lyrics-lineation policy is out of scope for this validation.
- Timing safety holds on all segment types.

**Manual QA:**
- Could not be performed. No lyrics benchmark video captured yet.
- Per BENCHMARK_VIDEO_SET.md, Phase 1-2 evaluation for lyrics is limited to: "not broken worse than baseline" and "playback safety on rhythmic content." The pipeline is a transparent wrapper — no lyrics-specific degradation path exists.

**Result:** automated pass (no lyrics-specific code path to regress). Manual QA: unverified (no benchmark video). Known limitation: no lyrics-lineation policy until Phase 4+.

### 3.4 Noisy / Bad Captions

Category: auto-generated captions with errors, repetition, bad timing.
Benchmark video: none in benchmark-latest.json. Recommended additions not yet captured.

**Automated validation:**
- The PracticeSegment pipeline wraps cleaned segments. Deduplication, orphan particle cleanup, and normalization happen upstream in the route before `buildPracticeSegmentLayers` is called. The pipeline itself does not add or remove noise.
- Boundary confidence scoring does penalize short text without sentence endings (correctly).
- Deterministic fallback path is tested in route-contract tests.

**Manual QA:**
- Could not be performed. No noisy-caption benchmark video captured yet.

**Result:** automated pass (pipeline is transparent to noise handling). Manual QA: unverified.

### 3.5 Long Transcript

Category: >200 segments, tests pipeline scaling.
Benchmark video: `t9U8QfOxMMw` (563 segments, AI path).

**Automated validation:**
- The builder functions are pure mappers with O(n) complexity. No performance concern at 563 segments.
- AI pipeline path tested in route-contract tests (3 merged segments from 5 raw — exercises the AI code path).
- Timing safety invariants hold regardless of segment count.

**Manual QA:**
- Could not be performed against the actual 563-segment video.
- From benchmark-latest.json baseline: 0 overlaps, 0 long-duration segments, 1 orphan particle, quality improved from 0.453 to 0.468 on AI path.

**Result:** automated pass. Manual QA: unverified against live video, but baseline data confirms acceptable quality on this category.

## 4. Edit Mode (Phase 3) Validation

### Automated validation

The edit mode module (`segmentOverrides.ts`) contains pure functions. Validation:

| Check | Method | Result |
|---|---|---|
| Merge produces correct timing span | Code inspection: `merged.start = a.start, merged.end = b.end` | Confirmed |
| Split distributes timing proportionally | Code inspection: `splitTime = seg.start + duration * ratio` | Confirmed |
| Both operations set `isUserEdited: true` | Code inspection: lines 72, 121, 131 | Confirmed |
| Merge throws on non-adjacent | Code inspection: line 48-50 | Confirmed |
| Split throws on out-of-bounds position | Code inspection: line 103-105 | Confirmed |
| Results pass through normalizeSegmentsForPlayback | Page integration: page.tsx handleMergeSegments, handleSplitSegment | Confirmed |
| Overrides persisted to localStorage | Code inspection: saveSegmentOverrides keyed by videoId | Confirmed |
| Overrides loaded on transcript load and session restore | Code inspection: page.tsx lines 632-636, 1190-1195 | Confirmed |
| Reset restores true baseline (not edited state) | Code inspection: page.tsx toggleEditMode guards with `if (!originalSegmentsRef.current)` | Confirmed |
| Edit mode off by default | Code inspection: `useState(false)` | Confirmed |

### Manual QA

Could not be performed (requires running dev server). The code paths are verified by inspection and TypeScript compilation succeeds.

## 5. Full Test Suite Results

```
Test Suites: 9 passed, 9 total
Tests:       221 passed, 221 total

Breakdown:
  Route-handler test (Agent 05):
    src/app/api/youtube/transcript/__tests__/routeContract.test.ts
      — 18 tests, imports and calls real GET handler

  Builder-pipeline harness (Agent 05):
    src/lib/transcript/__tests__/builderPipelineContract.test.ts
      — 68 tests, exercises builder functions directly

  Builder shape & instrumentation (Agent 04):
    practiceSegmentShape.test.ts       — 36 tests
    practiceSegmentInstrumentation.test.ts — 28 tests

  Existing transcript tests:
    segmentQuality.test.ts             — existing
    mergeSegments.test.ts              — existing
    resegmentation.test.ts             — existing
    chunkSegments.test.ts              — existing
    aiTimingAlignment.test.ts          — existing
```

TypeScript compilation: clean (no errors).
Production build: succeeds.

## 6. Known Limitations

| Limitation | Severity | Status |
|---|---|---|
| Translation merge is text-based: repeated identical lines may attach wrong cached translation | Medium | Known, documented in QA_CHECKLIST.md section 7. Requires stronger join key (Phase 4+). |
| No benchmark videos captured for fast speech, lyrics, or noisy captions categories | Low | Benchmark set defines categories but only 2 specific videos exist (`Xs0Lxif1u9E`, `t9U8QfOxMMw`). Additional videos should be captured. |
| Manual QA could not be performed | Medium | Requires running dev server against live transcript API. All automated validation passes. |
| Phase 1 defaults `contentKind: unknown` and `segmentationPolicy: fallback-safe` for all content | Expected | Policy detection is Phase 4 scope. Not a limitation — by design. |
| Edit mode overrides are local-only (localStorage) | Expected | Backend persistence and cross-device sync are explicitly out of scope for Phase 3. |

## 7. Residual Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Manual QA not performed against live videos | A perceptual regression could exist that automated tests don't catch | Run QA_CHECKLIST.md manually before production release |
| Missing benchmark videos for 3 of 5 categories | Gaps in validation coverage for fast speech, lyrics, noisy captions | Capture recommended benchmark additions from BENCHMARK_VIDEO_SET.md |
| Translation text-key collision on repeated lines | Wrong translation shown for identical segment text | Low incidence; fix requires FinalPracticeSegment to carry translation natively (future) |

## 8. Overall Assessment

The current implementation is **acceptable for the completed phases (1-3)**.

Evidence:
1. Route-contract gap is closed. The route-handler test (`src/app/api/youtube/transcript/__tests__/routeContract.test.ts`) imports and calls the real `GET` handler with 18 tests. The builder-pipeline harness adds 68 supplementary tests.
2. All 221 tests pass across 9 test suites with no regressions.
3. TypeScript compiles cleanly. Production build succeeds.
4. The edit mode implementation is correct by code inspection (merge/split timing, reset baseline preservation, localStorage persistence).
5. Known limitations are documented and are either by-design (Phase 1 defaults, local-only overrides) or deferred to future phases (translation key collision, policy detection).

The two remaining actions before production release:
1. Run the manual QA checklist against live benchmark videos.
2. Capture additional benchmark videos for the fast speech, lyrics, and noisy captions categories.
