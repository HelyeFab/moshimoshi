# Stage C Execution Overview

## What We Are Building

Stage C is where Moshi Player stops behaving like a raw transcript viewer and starts behaving like a real shadowing player.

Current reality:
- some providers return transcript rows that are already good enough to preserve
  - example: `9LW9DpmhrPE`
- some providers return raw rows that are structurally unusable as learner-facing segments
  - example: `45fMrqfNIXA`

The player cannot solve this by repeat logic alone.
If it loops raw provider rows directly, the learner repeats the wrong unit.

## The Architectural Decision

Stage C must introduce a rebuild-owned segment pipeline:
- raw provider transcript
- reconstructed learner-facing text segments
- coarse timing assignment
- final player segment contract

The player must consume the final contract, not the raw provider rows.

## Hard Constraints

Allowed:
- shared app routing
- shared UI primitives
- shared generic utilities
- reuse of the pure repeat state machine if needed later

Not allowed:
- importing old youtube-shadowing segmentation logic
- reviving old transcript processing architecture
- embedding reconstruction heuristics directly in the page

## Stage C First Slice

The first slice is:
- reconstruct good learner-facing text units
- assign coarse timing from source spans
- migrate the page to those computed player segments

## What Good Looks Like

Given raw provider rows like:
- `こんにちは、こんばんは、おはようござい`
- `ます。黒猫ママです。日本語の勉強頑張っ`

Stage C should compute:
- `こんにちは、こんばんは、おはようございます。`
- `黒猫ママです。`

And it should preserve already-good lineation when the source already looks right.

## Success Criteria

Stage C first slice is successful if:
- raw transcript rows are no longer the direct playback/display unit
- the route emits rebuild-owned computed segments
- the page consumes computed player segments
- `45fMrqfNIXA` is materially cleaner than raw Sheldon output
- `9LW9DpmhrPE` is not degraded
