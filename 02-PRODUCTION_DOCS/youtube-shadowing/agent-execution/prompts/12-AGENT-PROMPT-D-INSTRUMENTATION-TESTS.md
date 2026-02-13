# Agent Prompt D: Instrumentation and Benchmark Harness

You are implementing measurement infrastructure for segmentation and sync acceptance gates.

## Mandatory pre-read
- `02-PRODUCTION_DOCS/youtube-shadowing/agent-execution/00-AGENT-COMMON-CONTEXT.md`

## Scope
Add reproducible metrics collection and benchmark scripts/tests to validate improvements.

## Required files to inspect first
- `04-REVIEW-RUBRIC-AND-ACCEPTANCE-GATES.md`
- Existing analytics/tracking hooks and routes:
  - `src/hooks/useYouTubePracticeTracking.ts`
  - `src/app/api/practice/track/route.ts`
  - `src/utils/__tests__/youtubePlayerUtils.enhanced.test.ts`

## Required changes
1. Add metric collectors for:
   - Segment duration percentiles
   - Segment length percentiles
   - Highlight error median/P95
   - Loop overshoot median/P95
   - Hard drift incident rate
2. Add test/benchmark harness for repeatable local runs.
3. Ensure instrumentation is non-blocking and low overhead.
4. Output machine-readable report format (JSON) for lead review.

## Constraints
- Do not alter product behavior except adding passive measurements.
- Keep telemetry schema backward compatible.

## Required tests
1. Unit tests for metric calculators.
2. Harness smoke test.
3. Backward-compat test for analytics payloads.

## Deliverable
1. Patch + tests.
2. Example benchmark report output.
3. Mapping from each metric to acceptance gate.
