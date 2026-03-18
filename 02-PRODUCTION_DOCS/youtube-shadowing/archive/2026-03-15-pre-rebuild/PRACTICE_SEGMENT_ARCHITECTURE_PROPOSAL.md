# PracticeSegment Architecture Proposal

Last updated: 2026-03-13
Status: proposed
Scope: redesign the YouTube Shadowing segmentation model around explicit learner-facing practice units

## 1. Purpose

This proposal defines the next architectural step for the YouTube Shadowing feature:

`separate raw transcript timing units from learner-facing practice units`

The current feature is strong at:
- loading a transcript
- looping segments
- protecting timing safety

The weakest part remains:
- meaningful segmentation

The system currently treats cleaned transcript segments as if they are the same thing as ideal shadowing units.
That assumption is now the main limiting factor.

## 2. Problem Statement

The current pipeline roughly behaves like this:

1. fetch transcript segments from YouTube or cache
2. merge and split them deterministically
3. optionally improve them with AI
4. use those resulting segments directly in the player

This works, but it conflates two different concepts:

1. `Transcript segments`
- artifacts of caption extraction and timing
- optimized for display or source retrieval

2. `Practice segments`
- learner-facing units for repetition
- optimized for meaning, rhythm, and repeat-worthiness

These should not be the same abstraction.

## 3. Goals

The new architecture should:

1. preserve the current playback reliability
2. improve segmentation quality materially
3. support multiple segmentation sources and confidence levels
4. allow user overrides without fighting the pipeline
5. make timing refinement a separate concern from text segmentation
6. allow partial rollout without rewriting the whole feature

## 3.1 Core Architectural Principle

This proposal now makes one distinction explicit:

1. `universal playback contract`
- the player must execute boundaries perfectly
- stop at the right point
- restart at the right point
- avoid bleed and drift

2. `multiple segmentation policies`
- the system should not assume all content wants the same kind of segment boundary
- different content types may require different boundary selection strategies

This means the architecture should aim for:

- one playback engine
- one final runtime segment model
- multiple ways of generating those segments

Perfect playback execution is necessary, but not sufficient.
Even a perfectly aligned bad segment is still the wrong thing to repeat.

## 4. Non-Goals

This proposal does not assume:
- full ASR-first architecture for all videos
- mandatory audio extraction for every transcript
- full waveform editor
- collaborative editing
- full transcript authoring

## 5. Proposed Model

Introduce three levels of representation.

### 5.1 SourceTranscriptWord

The lowest-level unit when word-level timing is available.

```ts
interface SourceTranscriptWord {
  id: string;
  text: string;
  normalizedText: string;
  startTime: number;
  endTime: number;
  confidence?: number;
  source: "youtube-json3" | "aligned" | "derived";
}
```

Use when:
- JSON3 word timing exists
- acoustic alignment generates word timing

If unavailable, this layer can be synthesized later from source transcript segments.

### 5.2 SourceTranscriptSegment

Represents raw or near-raw timed transcript chunks from the upstream provider.

```ts
interface SourceTranscriptSegment {
  id: string;
  text: string;
  normalizedText: string;
  startTime: number;
  endTime: number;
  words?: SourceTranscriptWord[];
  source:
    | "youtubei-standard"
    | "youtubei-enhanced"
    | "youtube-json3"
    | "firebase-cache"
    | "supa-api"
    | "aligned";
}
```

This is the canonical source layer.
It should remain immutable once loaded for a given pipeline run.

### 5.3 ComputedPracticeSegment

Represents a learner-facing candidate segment produced by deterministic and/or AI logic.

```ts
interface ComputedPracticeSegment {
  id: string;
  text: string;
  normalizedText: string;
  startTime: number;
  endTime: number;
  sourceSegmentIds: string[];
  sourceWordIds?: string[];
  contentKind: "speech" | "lyrics" | "mixed" | "unknown";
  segmentationPolicy:
    | "speech-utterance"
    | "lyrics-lineation"
    | "mixed-adaptive"
    | "fallback-safe";
  boundaryMethod:
    | "gap-based"
    | "punctuation-restored"
    | "morphology-informed"
    | "wtpsplit"
    | "ai-resegment"
    | "text+vad"
    | "text+alignment";
  boundaryConfidence: number;
  timingMethod:
    | "segment-inherited"
    | "word-anchored"
    | "proportional"
    | "vad-refined"
    | "acoustic-aligned";
  qualityScore?: number;
  flags?: Array<
    | "low-confidence-boundary"
    | "mid-clause-risk"
    | "timing-refined"
    | "contains-long-gap"
    | "fallback-generated"
  >;
}
```

This is the pipeline output before user edits.

### 5.4 FinalPracticeSegment

Represents what the player actually loops.

```ts
interface FinalPracticeSegment {
  id: string;
  text: string;
  normalizedText: string;
  startTime: number;
  endTime: number;
  computedSegmentIds: string[];
  sourceSegmentIds: string[];
  sourceWordIds?: string[];
  contentKind: ComputedPracticeSegment["contentKind"];
  segmentationPolicy: ComputedPracticeSegment["segmentationPolicy"];
  boundaryConfidence: number;
  timingMethod: ComputedPracticeSegment["timingMethod"];
  isUserEdited: boolean;
  editHistory?: SegmentOverride[];
}
```

This is the only layer the player should consume directly.

## 6. Override Model

User edits should be stored as operations, not full snapshots.

```ts
interface SegmentOverride {
  id: string;
  type: "merge" | "split" | "reset";
  videoId: string;
  anchorText: string;
  anchorTextNext?: string;
  splitPosition?: number;
  createdAt: number;
  version: number;
}
```

Rules:
- apply overrides after computed segments are generated
- match by normalized text, not by raw array index only
- silently no-op when an old override is no longer relevant
- expose `reset to original` in the UI

## 7. Pipeline Proposal

### Stage A: Retrieve richest source timing available

Priority order:

1. word-level transcript data if available
2. segment-level transcript data from current providers
3. cached transcript data

Goal:
- make timing richness explicit early

### Stage B: Build source layer

Output:
- `SourceTranscriptWord[]` when available
- `SourceTranscriptSegment[]` always

This stage does not attempt to create learner-facing boundaries.

### Stage C: Generate segmentation candidates

Candidate generation should be multi-strategy, not single-strategy.

Suggested order:

1. deterministic text cleanup
   - duplicate removal
   - orphan cleanup
2. punctuation restoration
3. Japanese morphological / clause-aware regrouping
4. wtpsplit or equivalent utterance segmentation
5. optional AI resegmentation

Each strategy may propose boundaries.

### Stage C.1: Determine content kind and segmentation policy

Before selecting final boundaries, the system should classify the content into one of:

- `speech`
- `lyrics`
- `mixed`
- `unknown`

This classification does not need to be perfect.
It only needs to be good enough to avoid applying the wrong segmentation philosophy.

Suggested output:

```ts
interface SegmentationPolicyDecision {
  contentKind: "speech" | "lyrics" | "mixed" | "unknown";
  segmentationPolicy:
    | "speech-utterance"
    | "lyrics-lineation"
    | "mixed-adaptive"
    | "fallback-safe";
  confidence: number;
  reasons: string[];
}
```

### Stage C.2: Apply policy-specific boundary logic

#### Policy: `speech-utterance`

Goal:
- create repeat-worthy spoken units

Preferred signals:
- punctuation restoration
- morphological boundaries
- utterance segmentation
- optional timing refinement

#### Policy: `lyrics-lineation`

Goal:
- preserve authoritative lyric line breaks when available or strongly implied

Preferred signals:
- source lineation
- externally consistent lyric line structure
- refrain / repeated-line patterns
- timing cleanup only

Important rule:
- do not aggressively regroup lyric lines into speech-style clauses just because it looks linguistically cleaner

#### Policy: `mixed-adaptive`

Goal:
- combine safer speech segmentation with selective preservation of source structure

Use when:
- the content contains both spoken commentary and quoted lines
- the signal for `lyrics` is partial but not decisive

#### Policy: `fallback-safe`

Goal:
- produce mechanically safe segments when confidence is low

Use when:
- content kind is uncertain
- better segmentation methods fail

### Stage D: Select computed practice boundaries

Boundary selection should favor:
- agreement between multiple signals
- duration targets suitable for shadowing
- complete or near-complete clauses
- no broken words or orphan particles

If multiple signals disagree:
- choose the safest high-confidence boundary
- flag low-confidence boundaries for UI and correction mode

Important addition:
- boundary selection must occur within the currently chosen segmentation policy

This prevents a speech-optimized heuristic from silently overriding a lyrics-first decision.

### Stage E: Assign or refine timing

Timing priority:

1. word-anchored timing from source words
2. inherited segment timing when boundaries map cleanly
3. acoustic alignment on harder videos or harder segments
4. VAD refinement for speech onset/offset cleanup
5. proportional fallback only when no better source exists

This stage should be separate from boundary generation.

### Stage E.1: Universal playback contract

Regardless of segmentation policy, the player contract should remain universal:

- every final segment must have trustworthy `startTime` and `endTime`
- boundaries must be loop-safe
- no overlap
- no negative durations
- seek verification and anti-bleed behavior remain mandatory

This is the one universal pattern the architecture should enforce.

Segmentation policy may vary.
Playback execution must not.

### Stage F: Score and validate

Use validation to reject unsafe segments:
- no overlap
- minimum duration
- no unreasonable max duration
- acceptable boundary confidence floor

Existing quality scoring should be extended, not discarded.

### Stage G: Apply user overrides

Output:
- `FinalPracticeSegment[]`

This becomes the player's data source.

## 8. Confidence Model

The player should stop pretending all segments are equally trustworthy.

Proposed confidence inputs:
- punctuation restoration certainty
- morphology boundary support
- utterance model boundary support
- pause/VAD confirmation
- alignment quality
- fallback usage

Suggested confidence bands:

- `high`
  - multiple signals agree
  - timing anchored or aligned well
- `medium`
  - acceptable boundary, some disagreement
- `low`
  - fallback-heavy, weak evidence, or awkward timing

Use cases:
- prioritize low-confidence segments in edit mode
- instrument benchmark reports
- optionally expose subtle warning state in UI

## 9. Player Contract Changes

The player should consume `FinalPracticeSegment[]`, not raw transcript segments.

This means:
- repeat logic remains mostly unchanged
- seek logic remains mostly unchanged
- the data contract becomes more explicit
- segmentation policy becomes data, not hidden behavior

Recommended player contract:

```ts
interface PlayerPracticeSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  translation?: string;
  contentKind: "speech" | "lyrics" | "mixed" | "unknown";
  segmentationPolicy:
    | "speech-utterance"
    | "lyrics-lineation"
    | "mixed-adaptive"
    | "fallback-safe";
  boundaryConfidence: number;
  isUserEdited: boolean;
}
```

## 10. API Contract Changes

### 10.1 Transcript route

Current transcript route returns simple timed segments.

Proposed transitional response:

```ts
interface TranscriptPracticeResponse {
  sourceSegments: SourceTranscriptSegment[];
  computedPracticeSegments: ComputedPracticeSegment[];
  finalPracticeSegments?: FinalPracticeSegment[];
  language?: string;
  source: string;
  processing?: {
    aiMethod?: string;
    aiReason?: string;
    boundaryMethods?: string[];
    timingMethods?: string[];
  };
}
```

Migration note:
- page can initially continue consuming a flattened `segments` array while the backend starts emitting richer metadata

### 10.2 Override persistence

Add a dedicated override persistence route rather than overloading session storage forever.

Suggested endpoints:
- `GET /api/youtube/practice-segment-overrides?videoId=...`
- `POST /api/youtube/practice-segment-overrides`
- `DELETE /api/youtube/practice-segment-overrides?videoId=...`

MVP can still begin with local persistence only.

## 11. UI Proposal

### 11.1 Default view

Keep the current player simple.

Normal users should see:
- segment list
- repeat controls
- translation / word tools

No correction affordances by default.

The player does not need to expose segmentation policy explicitly in MVP.
But the runtime should know it.

This enables future policy-aware UX such as:
- lyrics mode preserving lineation visually
- speech mode emphasizing utterance repetition
- subtle confidence cues when fallback policy is active

### 11.2 Edit mode

Minimal MVP:
- `Edit Segments` toggle
- merge adjacent segments
- split segment at selected text position
- `Reset to original`

Enhancements later:
- confidence indicators
- boundary drag adjustments
- audio preview around boundary

## 12. Migration Plan

### Phase 0: metadata-first

Do not break the player yet.

Add:
- boundary method metadata
- timing method metadata
- confidence score

Still return a flat segments list for runtime.

### Phase 1: computed vs final segments

Start generating:
- `ComputedPracticeSegment[]`
- `FinalPracticeSegment[]`

Page continues to map `FinalPracticeSegment` into the existing runtime shape.

### Phase 2: override layer

Add:
- local override persistence
- edit mode UI
- re-application after resegmentation

### Phase 3: richer timing

Add:
- JSON3 word timing when available
- acoustic alignment or VAD selectively

### Phase 4: benchmarking and confidence-driven QA

Update benchmark tooling to track:
- boundary confidence distribution
- timing method usage
- override rates per video

## 13. Success Criteria

The architecture is working if:

1. the player uses learner-facing practice units rather than implicit cleaned captions
2. segmentation quality improves measurably on hard videos
3. loop timing remains safe across all segmentation policies
4. user edits survive regeneration and reload
5. low-confidence boundaries become visible to the system even if not always visible to the user
6. lyric-like content is not degraded by speech-oriented regrouping

## 14. Open Questions

1. How often is JSON3 word timing available on target videos?
2. Is text-first segmentation enough on most videos once upgraded?
3. When should acoustic alignment run:
   - all videos
   - hard videos only
   - premium only
   - manual resegment only
4. What confidence threshold should trigger UI suggestions for edit mode?
5. Should override persistence be local-first only at first, or sync across devices immediately?
6. What heuristics or signals are sufficient for `lyrics` detection without overfitting?
7. When `lyrics` is detected, what source lineation should be treated as authoritative?

## 15. Recommendation

Adopt the `PracticeSegment` architecture.

It is the clearest way to:
- improve segmentation quality without destabilizing playback
- combine deterministic, AI, and timing-refinement layers coherently
- support inline correction UX
- and align the implementation with the actual reason the feature exists

The most important architectural shift is simple:

`raw transcript segments are source material`

not

`the final thing the learner should repeat`

And the most important follow-up distinction is:

`one universal playback contract`

with

`multiple segmentation policies`

all converging into one common `PracticeSegment` runtime model.
