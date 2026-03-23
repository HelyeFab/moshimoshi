# Stage C Implementation Roadmap

## Phase C1: Reconstruction And Coarse Player Contract

Goal:
- introduce reconstructed text segments and coarse timing

Files to add:
- `src/lib/moshi-player/transcript-types.ts`
- `src/lib/moshi-player/raw-transcript.ts`
- `src/lib/moshi-player/reconstruction-heuristics.ts`
- `src/lib/moshi-player/reconstruct-segments.ts`
- `src/lib/moshi-player/segment-timings.ts`
- `src/lib/moshi-player/player-segments.ts`

Files to change:
- [route.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/moshi-player/transcript/%5BvideoId%5D/route.ts)

What C1 must do:
- normalize provider output into rebuild-owned `RawTranscriptUnit[]`
- build `ReconstructedTextSegment[]`
- compute coarse start/end from source-unit unions
- build `PlayerSegment[]`
- return:
  - raw transcript
  - reconstructed segments
  - player segments

Acceptance:
- route remains rebuild-owned
- no old youtube-shadowing segmentation imports
- obvious broken fragments are repaired in computed text
- canonical raw lineation is preserved when already good

## Phase C2: Page Migration To Player Segments

Goal:
- make the page consume `PlayerSegment[]` instead of raw provider rows

Files to change:
- [page.tsx](/home/helye/DevProjects/nextjs/moshimoshi/src/app/%5Blocale%5D/moshi-player/page.tsx)

What C2 must do:
- display `PlayerSegment` text in transcript UI
- use `PlayerSegment.start/end` for repeat/shadowing
- keep raw response available only in debug

Acceptance:
- no runtime logic depends on raw provider rows for playback
- transcript UI uses computed segments
- repeat/shadowing targets computed player segments

## Phase C3: Validation And Benchmarking

Goal:
- prove computed segments improve text units without degrading already-good sources

Benchmark minimum:
- `45fMrqfNIXA`
- `9LW9DpmhrPE`
- plus additional real-video checks beyond the two anchor benchmarks

What C3 must check:
- reconstructed text quality
- preservation of already-good lineation
- no route contract regression
- page uses computed segments, not raw rows
- whether the deterministic preserve/rebuild heuristic holds on a broader set

Acceptance:
- benchmark report with explicit pass/fail examples
- explicit judgment on whether heuristic refinement is still required before Stage C sign-off
