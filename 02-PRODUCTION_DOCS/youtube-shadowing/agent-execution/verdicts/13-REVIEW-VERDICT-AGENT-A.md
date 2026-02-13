# Review Verdict: Agent A (Deterministic Segmentation)

## Decision
REJECT (fixes required before merge)

## Blocking findings
1. Short sentence boundaries can still be merged incorrectly.
- File: `src/lib/transcript/mergeSegments.ts:78`
- File: `src/lib/transcript/mergeSegments.ts:83`
- Problem: punctuation boundary protection only applies when `gap > sentenceBoundaryGap`. For short punctuation-ended sentences with small gaps (e.g. `はい。` followed by next short token), line 83 can still force merge via lonely-fragment rule.
- Impact: violates intended behavior for repeat-friendly sentence units and contradicts Agent A claim that short complete sentences stay separate.
- Required fix: never apply lonely-fragment merge across a punctuation-ended `currentText`, regardless of gap.

2. Quality scorer implementation does not match its documented definition.
- File: `src/lib/transcript/segmentQuality.ts:8`
- File: `src/lib/transcript/segmentQuality.ts:61`
- Problem: docs/comments state sentence-terminal ratio includes punctuation OR natural pause, but implementation counts punctuation only.
- Impact: quality score is biased low for transcripts with valid pause-based boundaries and can over-trigger downstream AI fallback.
- Required fix: either implement pause-aware terminal logic (using adjacent segment timing) or update contract/docs and all callsites/tests to explicitly be punctuation-only.

## Non-blocking findings
1. Missing regression test for the short punctuation sentence case above.
- Add test in `src/lib/transcript/__tests__/mergeSegments.test.ts` covering `はい。` + short next segment with small gap.

2. Missing test for Intl.Segmenter-unavailable fallback path.
- Add test in `src/lib/transcript/__tests__/chunkSegments.test.ts` to ensure deterministic behavior when `Intl.Segmenter` is unavailable.

## Validation run
- `npm test -- src/lib/transcript/__tests__/mergeSegments.test.ts src/lib/transcript/__tests__/chunkSegments.test.ts src/lib/transcript/__tests__/segmentQuality.test.ts` -> PASS (35 tests)
- `npm run -s type-check` -> PASS

## Acceptance condition
- Resolve both blocking findings and add the required regression test(s), then resubmit.
