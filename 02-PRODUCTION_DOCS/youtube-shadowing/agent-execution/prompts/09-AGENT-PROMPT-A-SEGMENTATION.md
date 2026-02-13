# Agent Prompt A: Deterministic Segmentation Improvements

You are implementing deterministic transcript segmentation upgrades for YouTube Shadowing.

## Mandatory pre-read
- `02-PRODUCTION_DOCS/youtube-shadowing/agent-execution/00-AGENT-COMMON-CONTEXT.md`

## Scope
Improve repeat-friendly segmentation quality without AI dependencies.

## Required files to inspect first
- `src/lib/transcript/mergeSegments.ts`
- `src/lib/transcript/chunkSegments.ts`
- `src/utils/sentenceSplitter.ts`
- `src/hooks/useProgressiveTranscript.ts`
- Existing tests under `src/lib/transcript/**/__tests__` and `src/hooks/__tests__`

## Required changes
1. Add timestamp-gap-aware boundary heuristics.
2. Improve micro-fragment merging rules.
3. Improve word-aware splitting for Japanese (use established repo patterns, minimal bundle increase).
4. Add `computeSegmentQuality(segments)` helper with deterministic scoring.
5. Preserve existing data contracts and ordering guarantees.

## Constraints
- Smallest safe change.
- No API contract breaks.
- No new architecture.
- Strong TypeScript typing.

## Required tests
1. Unit tests for new merge/split heuristics.
2. Regression tests for monotonic timestamps and ordering.
3. Tests covering Japanese no-punctuation and micro-fragment cases.

## Deliverable
1. Patch + tests.
2. Short change log with risks.
3. Explicit statement of what remains for Agent C integration.
