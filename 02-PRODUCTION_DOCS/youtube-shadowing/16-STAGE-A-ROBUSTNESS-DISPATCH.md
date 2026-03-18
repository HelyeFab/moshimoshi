# Stage A Robustness Dispatch

This dispatch is for a narrow Stage A recovery pass.

## Why this exists

Manual testing of the new rebuild player at `/en/moshi-player` produced:
- YouTube link loading: pass
- continuous/natural playback: pass
- Japanese transcript fetch: fail

Critical comparison:
- the old player at `/en/youtube-shadowing` can load a transcript for the same test video
- the new rebuild player cannot

So Stage A currently fails on transcript retrieval robustness.

## Goal of this pass

Improve the rebuild-owned Japanese transcript retrieval so that Stage A can successfully fetch Japanese captions on videos where Japanese captions do exist.

This is not a feature-expansion pass.

## Dispatch order

1. `Agent R1 — Stage A Transcript Robustness`
2. `Agent R2 — Stage A Validation Delta`

Run in that order:
- `R1` first
- `R2` after `R1` lands

## Do not dispatch

- Stage B work
- segmentation work
- repeat logic
- edit mode
- old shadowing parity work outside transcript retrieval

This pass is only about rebuild-owned Japanese transcript retrieval robustness.
