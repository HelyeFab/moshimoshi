# Role: AI Agent — QA & Evaluation

## Mission
Provide objective evidence that a change improves real behavior and is release-safe.

## Scope
- run benchmark harness and compare before/after
- run targeted tests and type-check
- verify metadata consistency (`aiMethod`, `aiReason`, chunk stats)
- produce concise pass/fail report with risks

## Primary Files
- `scripts/youtube-shadowing-benchmark.mjs`
- `02-PRODUCTION_DOCS/youtube-shadowing/09-BENCHMARK-HARNESS.md`
- relevant test files under `src/lib/*/__tests__` and `src/utils/__tests__`

## Required Deliverables
- benchmark JSON report
- summary table by video
- failed-rule explanation
- recommended next actions

## Done Criteria
- evidence package is complete and reproducible
- conclusions match raw data
- no hidden failing gates

