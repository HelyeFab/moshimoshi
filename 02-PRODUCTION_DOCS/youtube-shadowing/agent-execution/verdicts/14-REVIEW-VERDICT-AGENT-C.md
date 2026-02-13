# Review Verdict: Agent C (AI Resegmentation Fallback)

## Decision
REJECT (fixes required before merge)

## Blocking findings
1. AI timeout is not actually enforced.
- File: `src/app/api/youtube/resegment/route.ts:145`
- File: `src/app/api/youtube/resegment/route.ts:149`
- Problem: `AbortController` is created and aborted after 15s, but its signal is never passed to `aiService.processTranscript(...)` and no timeout race is used.
- Impact: a hung AI provider call can block the request indefinitely, violating timeout-safe behavior and risking API saturation.
- Required fix: enforce timeout with `Promise.race` and explicit timeout rejection, or pass abort signal through AI service if supported.

2. Client integration does not implement the required quality-gated + feature-flagged invocation path.
- File: `src/hooks/useProgressiveTranscript.ts:349`
- File: `src/hooks/useProgressiveTranscript.ts:362`
- Problem: hook adds a manual `resegment()` call that always hits `/api/youtube/resegment` when invoked, without local quality gating and without checking client flag state.
- Impact: does not satisfy Agent C task contract; introduces extra network path independent of gating strategy.
- Required fix: integrate with deterministic `computeSegmentQuality(...)` threshold + `AI_RESEGMENTATION` gate before any resegmentation request path is invoked.

3. Output validation allows invalid timing edge cases to pass.
- File: `src/lib/transcript/resegmentation.ts:97`
- File: `src/lib/transcript/resegmentation.ts:106`
- File: `src/lib/transcript/resegmentation.ts:125`
- Problem:
  - `start === end` passes (`start > end` check only).
  - Zero-duration segments bypass min-duration check (`duration > 0` guard).
  - Overlap is not rejected (`seg.start < prev.end` not validated; only large positive gaps are checked).
- Impact: malformed AI output can be accepted and cached, degrading loop precision and segment sync.
- Required fix: enforce strict `start < end`, reject overlap (`seg.start < prev.end`), and apply min-duration check to zero duration.

## Non-blocking findings
1. The "does NOT invoke AI when flag is off" test is weak and can pass falsely.
- File: `src/app/api/youtube/resegment/__tests__/route.test.ts:34`
- File: `src/app/api/youtube/resegment/__tests__/route.test.ts:145`
- Reason: `getInstance()` returns a fresh object with a new `jest.fn()` each call; assertion may inspect a different function reference than route used.
- Recommendation: use a shared mocked `processTranscript` spy instance.

2. `ResegmentationCacheService` import is unused in route.
- File: `src/app/api/youtube/resegment/route.ts:45`
- Recommendation: remove unused import to keep lint clean.

## Validation run
- `npm test -- src/lib/transcript/__tests__/resegmentation.test.ts src/app/api/youtube/resegment/__tests__/route.test.ts` -> PASS (34 tests)
- `npm run -s type-check` -> PASS

## Acceptance condition
- Resolve all blocking findings and add regression tests covering timeout enforcement and invalid timing rejection.
