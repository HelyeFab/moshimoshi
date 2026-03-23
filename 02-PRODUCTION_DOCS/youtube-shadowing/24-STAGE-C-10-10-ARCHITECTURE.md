# Stage C 10/10 Architecture

Mission:
- reach Miraa-level shadowing trust for YouTube videos
- display learner-facing segments that match the audio the player repeats

Core insight:
- raw transcript rows are not the thing the learner should repeat
- the player must not loop raw provider rows directly
- the system needs a reconstructed segment layer and a separate timing layer

Target pipeline:

1. `RawTranscriptUnit`
- direct provider output only
- may be overlapping, duplicated, fragmented, or noisy

2. `ReconstructedTextSegment`
- learner-facing text unit
- responsibilities:
  - merge overlapping fragments
  - repair broken fixed expressions
  - preserve already-good lineation
  - prefer complete sentence-like units
  - remove obvious junk
  - keep provenance to source rows

3. `AlignedPracticeSegment`
- same learner-facing text
- paired with playback timing
- first Stage C slice uses coarse timing only
- later Stage C can refine alignment

4. `PlayerSegment`
- the only object the player consumes
- player sees:
  - `id`
  - `text`
  - `start`
  - `end`
  - `confidence`
  - provenance ids

Design rules:

1. Text reconstruction and timing alignment are separate stages.
2. The player executes boundaries. It does not invent them.
3. Already-good source lineation must be preserved.
4. Coarse timing is acceptable for the first Stage C slice.
5. Content reconstruction and playback execution are different concerns.

Recommended new modules:
- `src/lib/moshi-player/transcript-types.ts`
- `src/lib/moshi-player/raw-transcript.ts`
- `src/lib/moshi-player/reconstruction-heuristics.ts`
- `src/lib/moshi-player/reconstruct-segments.ts`
- `src/lib/moshi-player/segment-timings.ts`
- `src/lib/moshi-player/player-segments.ts`

Non-goals for first Stage C slice:
- no forced alignment yet
- no AI segmentation pass
- no old youtube-shadowing imports

Definition of success for the first Stage C slice:
- the route returns a rebuild-owned computed segment layer
- the page can later consume `PlayerSegment`
- obvious fragment breaks like `おはようござい` / `ます。` are repaired
- already-good raw lineation like `9LW9DpmhrPE` is not degraded
