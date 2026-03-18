# YouTube Shadowing Implementation Roadmap

Last updated: 2026-03-13
Status: proposed
Depends on:
- `IMPLEMENTATION_ARCHAEOLOGY.md`
- `PRACTICE_SEGMENT_ARCHITECTURE_PROPOSAL.md`
- `research-briefs/WAVE1_SYNTHESIS.md`
- `research-briefs/WAVE2_SYNTHESIS.md`

## 1. Purpose

This roadmap defines the phased implementation path from the current YouTube Shadowing architecture to the proposed `PracticeSegment` architecture.

Primary objective:

`Improve segmentation quality without destabilizing playback.`

The roadmap is intentionally phased so the team can:
- preserve the current working player
- introduce new abstractions incrementally
- benchmark each step
- avoid mixing segmentation redesign with large unrelated refactors

## 2. Guiding Principles

1. Keep playback stable while changing segmentation.
2. Separate data-model migration from UX expansion.
3. Preserve deterministic fallback at every step.
4. Introduce richer timing only after the segment model is in place.
5. Do not couple edit UX to backend persistence on day one.

## 3. Scope Ordering

Implement in this order:

1. `PracticeSegment` data model and transcript-route generation
2. page compatibility layer and explicit final segment consumption
3. local edit-mode MVP with split/merge/reset
4. content policy detection and `lyrics-lineation` branch
5. richer timing input and selective acoustic refinement

Do not invert this order.

## 4. Phase 1: Data Model Introduction

### Goal

Introduce `ComputedPracticeSegment` and `FinalPracticeSegment` without breaking the current page runtime.

### Deliverables

- new types for source/computed/final segments
- transcript route generates richer segment structures
- route still returns a backwards-compatible flat segment list for the current page

### Files To Touch

- `src/app/api/youtube/transcript/[videoId]/route.ts`
- `src/lib/transcript/`:
  - add `practiceSegments.ts`
  - optionally add `types.ts` or `practiceSegmentTypes.ts`
- if needed:
  - `src/types/youtubeShadowing.ts`

### What To Implement

1. Define:
- `SourceTranscriptSegment`
- `ComputedPracticeSegment`
- `FinalPracticeSegment`

2. Create a new helper module responsible for:
- converting current transcript output into computed practice segments
- creating final practice segments when there are no user overrides yet

3. In the transcript route:
- preserve current transcript retrieval logic
- preserve current deterministic cleanup and AI logic
- wrap the resulting segment list into:
  - `computedPracticeSegments`
  - `finalPracticeSegments`

4. Transitional API shape:
- continue returning `segments` for compatibility
- also return richer fields

Example transitional response:

```ts
{
  segments: [...], // compatibility
  computedPracticeSegments: [...],
  finalPracticeSegments: [...],
  source: "...",
  processing: {...}
}
```

### Validation Gate

- current page still works with no visible regression
- route returns richer segment metadata
- no repeat-loop regressions

## 5. Phase 2: Page Migration To FinalPracticeSegment

### Goal

Make the page consume final learner-facing segments explicitly instead of implicitly relying on flat transcript segments.

### Deliverables

- page runtime reads `finalPracticeSegments`
- internal runtime segment type aligns with final practice segments
- compatibility mapping remains for safety during rollout

### Files To Touch

- `src/app/[locale]/youtube-shadowing/page.tsx`
- possibly:
  - `src/components/shadowing/*` if any shared UI types need alignment

### What To Implement

1. Update page transcript types:
- current local `TranscriptSegment` should become a player-facing compatibility view over `FinalPracticeSegment`

2. Map response:
- if `finalPracticeSegments` exists, use it
- otherwise fall back to `segments`

3. Keep current playback logic unchanged as much as possible:
- repeat state
- seek verification
- translation state
- word explanation prefetch

4. Add internal awareness of:
- `contentKind`
- `segmentationPolicy`
- `boundaryConfidence`
- `isUserEdited`

These do not need to be fully surfaced in UI yet.

### Validation Gate

- player still loops exactly
- no regression in session restore
- no regression in translation or word lookup
- ability to compare old and new runtime data on the same videos

## 6. Phase 3: Edit Mode MVP

### Goal

Add the smallest useful correction UX directly inside the player.

### Deliverables

- `Edit Segments` mode
- merge adjacent segments
- split a segment at a selected text position
- reset to original
- local persistence of overrides

### Files To Touch

- `src/app/[locale]/youtube-shadowing/page.tsx`
- add under `src/lib/transcript/`:
  - `segmentOverrides.ts`
- optionally add:
  - `src/components/shadowing/shared/SegmentEditorControls.tsx`

### What To Implement

1. Add edit mode state to the page.

2. Add override model:
- `SegmentOverride`
- apply overrides after transcript load
- keep persistence local-first

3. Merge behavior:
- combine adjacent final practice segments
- preserve timing span
- mark `isUserEdited = true`

4. Split behavior:
- split a segment at selected text boundary
- use current proportional timing as MVP
- mark both resulting segments `isUserEdited = true`

5. Reset behavior:
- discard overrides
- restore computed segments as final segments

6. Persistence:
- store overrides in localStorage
- keep it separate from raw session state if possible

### Validation Gate

- edits survive reload
- edits survive replay and navigation
- edits do not break repeat logic
- reset is reliable

## 7. Phase 4: Segmentation Policy Layer

### Goal

Introduce content-aware segmentation policy selection while keeping one universal playback contract.

### Deliverables

- `contentKind` detection
- `segmentationPolicy` assignment
- first explicit policy branch:
  - `speech-utterance`
  - `lyrics-lineation`

### Files To Touch

- `src/lib/transcript/practiceSegments.ts`
- `src/app/api/youtube/transcript/[videoId]/route.ts`
- possibly add:
  - `src/lib/transcript/contentKind.ts`
  - `src/lib/transcript/segmentationPolicy.ts`

### What To Implement

1. Add policy decision function:

```ts
determineSegmentationPolicy(...)
```

2. MVP policy rules:
- default to `speech-utterance`
- detect likely `lyrics` conservatively
- use `fallback-safe` when uncertain

3. For `speech-utterance`:
- use existing improved segmentation logic

4. For `lyrics-lineation`:
- preserve source line structure when confidence is high
- avoid aggressive regrouping
- still refine timing safely

### Validation Gate

- lyric-like content is not degraded by speech heuristics
- speech content still benefits from regrouping
- page runtime remains policy-agnostic at playback level

## 8. Phase 5: Stronger Text-First Segmentation

### Goal

Upgrade the segmentation layer itself.

### Deliverables

- punctuation-restoration-aware segmentation
- morphology-informed segmentation
- optional utterance segmentation model integration

### Files To Touch

- `src/lib/transcript/chunkSegments.ts`
- `src/lib/transcript/mergeSegments.ts`
- `src/lib/transcript/practiceSegments.ts`
- `src/app/api/youtube/resegment/route.ts`
- `src/app/api/youtube/transcript/[videoId]/route.ts`

### What To Implement

1. Improve AI prompt for Japanese punctuation restoration and regrouping.
2. Integrate Sudachi or equivalent morphological layer.
3. Optionally prototype wtpsplit as a separate segmentation step.
4. Emit `boundaryMethod` and `boundaryConfidence`.

### Validation Gate

- measurable improvement on benchmark videos
- no increase in loop desync
- low-confidence segments identifiable

## 9. Phase 6: Richer Timing Input

### Goal

Reduce reliance on proportional timing.

### Deliverables

- investigate JSON3 word-level timing extraction
- use richer timing when available
- fall back safely when unavailable

### Files To Touch

- `src/app/api/youtube/transcript/[videoId]/route.ts`
- `src/lib/transcript/practiceSegments.ts`
- possibly add:
  - `src/lib/transcript/wordTiming.ts`

### What To Implement

1. Validate real-world availability of word-level timing on target videos.
2. If viable, build `SourceTranscriptWord`.
3. Use word timing for practice segment timing assignment.
4. Keep proportional fallback for compatibility.

### Validation Gate

- timing accuracy visibly improves on hard videos
- playback still respects universal contract

## 10. Phase 7: Selective Acoustic Refinement

### Goal

Add acoustic timing support only where it is clearly worth it.

### Deliverables

- prototype stable-ts or equivalent alignment path
- prototype VAD timing refinement path
- run selectively, not universally

### Files To Touch

- likely new service or route:
  - `src/app/api/youtube/align/route.ts` or equivalent
- `src/lib/transcript/practiceSegments.ts`
- `src/app/api/youtube/transcript/[videoId]/route.ts`

### What To Implement

1. Define trigger conditions:
- hard video
- low boundary confidence
- user-invoked resegment
- premium-only if needed

2. Use acoustic refinement to:
- clean start/end timing
- improve hard cases

3. Do not make audio processing mandatory for all videos in the first pass.

### Validation Gate

- only difficult videos pay the extra cost
- timing refinement produces audible improvement
- infrastructure cost is justified

## 11. Benchmark And QA Plan

### Required Benchmark Set

Curate at least:
- normal speech
- fast speech/dialogue
- lyric-heavy video
- noisy / poor-caption video
- long transcript video

### Core Questions

For every phase, evaluate:

1. Is this the right thing to repeat?
2. Does the player stop and restart exactly there?
3. Did the new architecture improve or degrade trust?
4. Are low-confidence cases easier to identify?
5. Do lyrics get preserved better once the policy branch exists?

### Instrumentation To Add Over Time

- `contentKind`
- `segmentationPolicy`
- `boundaryMethod`
- `timingMethod`
- `boundaryConfidence`
- override count per video
- override survival after resegmentation

## 12. Recommended First Coding Slice

Start here:

1. Add new segment types
2. Add `practiceSegments.ts`
3. Make transcript route emit computed/final practice segments
4. Keep current page compatible

Do not start with:
- acoustic alignment
- full policy detection
- full backend override APIs
- major UI redesign

## 13. Team Sequence

Recommended execution order:

1. backend data-model and route work
2. page compatibility migration
3. edit-mode MVP
4. policy branch
5. segmentation upgrades
6. richer timing
7. acoustic refinement

## 14. Done Criteria

This roadmap succeeds if:

1. the system no longer treats cleaned captions as automatically final practice units
2. the player consumes explicit final practice segments
3. users can correct bad boundaries in-player
4. playback precision remains strong across all phases
5. content-specific segmentation policy becomes possible without rewriting the player

