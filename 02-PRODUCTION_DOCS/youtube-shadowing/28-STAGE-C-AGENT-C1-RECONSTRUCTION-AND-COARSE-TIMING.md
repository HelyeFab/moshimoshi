# Agent C1: Reconstruction And Coarse Timing

Read these first, in order:

1. [27-STAGE-C-EXECUTION-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/27-STAGE-C-EXECUTION-OVERVIEW.md)
2. [24-STAGE-C-10-10-ARCHITECTURE.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/24-STAGE-C-10-10-ARCHITECTURE.md)
3. [25-STAGE-C-IMPLEMENTATION-ROADMAP.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/25-STAGE-C-IMPLEMENTATION-ROADMAP.md)

## Your Assignment

Implement the first rebuild-owned computed segment contract.

You are responsible for:
- raw transcript normalization into rebuild-owned types
- reconstructed learner-facing text segments
- coarse timing assignment
- route output expansion

You are not responsible for:
- page migration
- runtime repeat hardening
- alignment refinement

## Files You May Need To Change

Must change:
- [route.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/moshi-player/transcript/%5BvideoId%5D/route.ts)

Expected new files:
- `src/lib/moshi-player/transcript-types.ts`
- `src/lib/moshi-player/raw-transcript.ts`
- `src/lib/moshi-player/reconstruction-heuristics.ts`
- `src/lib/moshi-player/reconstruct-segments.ts`
- `src/lib/moshi-player/segment-timings.ts`
- `src/lib/moshi-player/player-segments.ts`

Do not modify the page beyond what is absolutely necessary for types.

## Required Output Contract

The route must continue returning raw transcript information, but must also return computed layers.

At minimum, the route response should expose:
- `rawTranscript`
- `reconstructedSegments`
- `playerSegments`

## Required Behavior

1. Normalize provider output into rebuild-owned raw transcript units.
2. Reconstruct learner-facing text segments from raw units.
3. Compute coarse timing:
- start = earliest contributing source start
- end = latest contributing source end
4. Build final player segments from those computed values.
5. Preserve already-good lineation when the raw source is already strong.
6. Repair obvious broken fragments like:
- `おはようござい` + `ます。`

## Non-Goals

- no AI segmentation
- no forced alignment
- no old youtube-shadowing imports
- no player runtime changes

## Acceptance Criteria

I will reject the submission if any of these are missing:

1. The route still returns only raw provider rows.
2. Reconstruction logic is embedded directly in the route or page instead of helper modules.
3. The computed text layer degrades already-good source lineation.
4. There is no explicit provenance from computed segments back to raw source units.
5. The contract is vague enough that the page would still have to infer segment meaning for itself.

I will accept if:
- the route emits a clear computed segment contract
- the helpers are rebuild-owned and modular
- the benchmark examples are visibly handled better at the computed text layer

## Deliverables

1. Code changes
2. Short delivery summary
3. Explicit list of files changed
4. Acceptance checklist against the criteria above
