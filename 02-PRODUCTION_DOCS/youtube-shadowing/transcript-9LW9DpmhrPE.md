# Benchmark: 9LW9DpmhrPE

- **Video ID:** `9LW9DpmhrPE`
- **Title:** `Suzume (feat. Toaka)`
- **Route under test:** `/en/moshi-player`
- **Observed retrieval source:** `supa`
- **Date confirmed:** `2026-03-16`

## Why this benchmark matters

This video was previously a strong failure case for the old shadowing player:
- poor transcript text quality
- fused or corrupted lyric lines
- playback flow problems once segmentation logic started controlling the player

After the Stage A retrieval fix, the rebuilt player now retrieves a raw transcript that aligns closely with the lyric text shown by Google and the lineation seen in Miraa.

## What was confirmed

Confirmed in the live Stage A player:
- transcript loads in `/en/moshi-player`
- source is `supa`
- transcript text is materially aligned with canonical lyric text
- this is now a valid Stage A success case for transcript retrieval quality

## Critical product note

At Stage A, this transcript must **not** be "improved" by any shaping logic.

Reason:
- the raw transcript lineation is already good enough to act as the canonical source material
- breaking or regrouping it at this stage would be a regression
- future segmentation work must start from the principle:
  - if the raw transcript already matches canonical lyric lines, preserve that structure

## Example alignment

Representative lines observed as aligned with Google/Miraa:
- `君の中にある 赤と青き線`
- `それらが結ばれるのは 心の臓`
- `風の中でも負けないような声で`
- `届ける言葉を今は育ててる`

## Engineering implication

This benchmark proves an important architectural point:
- transcript retrieval quality is upstream of segmentation quality
- when retrieval quality is high, Stage C segmentation should avoid damaging canonical line boundaries
- lyric content may eventually require a preservation-first segmentation policy rather than regrouping
