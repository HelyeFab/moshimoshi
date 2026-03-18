# Stage A Retrieval Waterfall Dispatch

This dispatch is for the next narrow Stage A recovery pass.

## Why this exists

Manual testing of the rebuild player at `/en/moshi-player` showed:
- YouTube link loading: pass
- continuous playback: pass
- Japanese transcript fetch: fail

The old player at `/en/youtube-shadowing` still succeeds on the same video.

We now know why:
- the old system did not rely on one direct transcript method
- it used a waterfall of retrieval providers and fallbacks

## Correct boundary

We are **not** revising the rebuild architecture.

We are allowing one specific thing:
- reuse or careful porting of the old **raw transcript retrieval waterfall**

We are still forbidding:
- old transcript processing
- old segmentation
- old AI formatting/resegmentation
- old playback coupling
- old repeat/sync logic

## Goal of this pass

Design and implement a rebuild-owned transcript route that uses only the clean retrieval layer from the old system:
- provider ordering
- Japanese track selection
- fallback behavior
- raw transcript extraction

The new route must still return raw transcript only.

## Dispatch order

1. `Agent W1 — Retrieval Archaeology + Port`
2. `Agent W2 — Validation Delta`

Run in that order:
- `W1` first
- `W2` after `W1` lands

## Do not dispatch

- Stage B work
- segmentation work
- edit mode
- repeat logic
- AI processing
- transcript beautification or cleanup beyond minimal structural normalization
