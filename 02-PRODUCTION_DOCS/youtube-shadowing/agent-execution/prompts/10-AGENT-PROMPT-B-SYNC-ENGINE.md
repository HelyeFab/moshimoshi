# Agent Prompt B: Sync Accuracy and Loop Precision

You are implementing playback sync and loop precision improvements for YouTube Shadowing.

## Mandatory pre-read
- `02-PRODUCTION_DOCS/youtube-shadowing/agent-execution/00-AGENT-COMMON-CONTEXT.md`

## Scope
Reduce segment highlight drift and repeat-loop boundary overshoot.

## Required files to inspect first
- `src/utils/youtubePlayerUtils.ts`
- `src/utils/youtubeHelpers.ts`
- `src/lib/shadowing/repeat.ts`
- `src/components/shadowing/MoshiShadowingPlayer.tsx`
- Existing tests in `src/utils/__tests__` and `src/lib/shadowing/__tests__`

## Required changes
1. Improve seek landing verification after `seekTo`.
2. Add correction path for large landing error.
3. Improve boundary crossing detection for active segment updates.
4. Stabilize repeat loop re-entry timing.
5. Add safe feature flag support (`sync_precision_v2`) default off.

## Constraints
- Keep current repeat semantics.
- Avoid CPU-heavy continuous polling.
- No behavioral regressions in normal playback.

## Required tests
1. Seek landing error tests.
2. Loop overshoot tests across repeated loops.
3. Regression tests for repeat modes.

## Deliverable
1. Patch + tests.
2. Before/after metric snapshot from local harness.
3. Rollback note (exact files/flags).
