# Agent 01: Backend PracticeSegment Foundation

## 1. Mission

Create the backend data-model foundation for `PracticeSegment` without breaking the current YouTube Shadowing page.

You own:
- new segment types
- transcript-route generation of computed/final practice segments
- helper logic that separates source, computed, and final layers

You do not own:
- player UI changes
- edit mode UX
- audio alignment
- lyrics policy

## 2. Must-Read Context

Read before coding:

1. `02-PRODUCTION_DOCS/youtube-shadowing/PRACTICE_SEGMENT_ARCHITECTURE_PROPOSAL.md`
2. `02-PRODUCTION_DOCS/youtube-shadowing/IMPLEMENTATION_ROADMAP.md`
3. `02-PRODUCTION_DOCS/youtube-shadowing/IMPLEMENTATION_ARCHAEOLOGY.md`

Then inspect:

- `src/app/api/youtube/transcript/[videoId]/route.ts`
- `src/lib/transcript/chunkSegments.ts`
- `src/lib/transcript/mergeSegments.ts`
- `src/lib/transcript/segmentQuality.ts`
- `src/lib/transcript/aiTimingAlignment.ts`

## 3. Scope

Implement Phase 1 only.

### Required work

1. Add explicit types for:
- `SourceTranscriptSegment`
- `ComputedPracticeSegment`
- `FinalPracticeSegment`

2. Add a helper module under `src/lib/transcript/` to:
- convert current transcript output into computed practice segments
- create final practice segments from computed ones

3. Update the transcript route to return:
- `segments` for backward compatibility
- `computedPracticeSegments`
- `finalPracticeSegments`

4. Populate at least:
- `boundaryMethod`
- `timingMethod`
- `boundaryConfidence`
- `isUserEdited` on final segments

### Out of scope

- changing the current page to consume the new fields
- user overrides
- policy detection
- JSON3 timing
- acoustic refinement

## 4. Deliverables

You should deliver:

1. new type definitions
2. new helper module(s)
3. transcript route changes
4. any targeted unit tests needed for the helper logic

## 5. Acceptance Criteria

The Technical Lead should accept only if:

1. the route still supports the current page without breaking it
2. source vs computed vs final layers are explicit in code
3. the compatibility `segments` output remains intact
4. no playback logic is touched
5. no speculative policy logic is added
6. no audio-heavy infrastructure is introduced

## 6. Rejection Criteria

Reject if:
- the code reuses the old flat segment model and only renames it
- the route contract is changed in a breaking way
- the implementation entangles user edits with computed segment generation
- the implementation introduces premature lyrics or audio logic

## 7. Parallel Or Solo

Work mode:
- parallel with Agent 04
- effectively solo relative to Agent 02 and Agent 03 because they depend on your contract

