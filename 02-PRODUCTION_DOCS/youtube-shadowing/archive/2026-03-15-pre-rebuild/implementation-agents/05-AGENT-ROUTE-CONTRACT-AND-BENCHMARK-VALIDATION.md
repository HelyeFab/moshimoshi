# Agent 05 — Route Contract And Benchmark Validation

## Role

This agent is responsible for the next validation pass after Agents 01-04.

Scope:
- add route-level contract coverage for `/api/youtube/transcript/[videoId]`
- run and document benchmark/manual QA validation against the current implementation

This is a validation agent, not a feature-expansion agent.

## Work Mode

Run `solo`.

Reason:
- this work depends on the accepted outputs from Agents 01-04
- the route-contract check and benchmark validation should be authored as one coherent acceptance package
- parallelizing this would create fragmented evidence and duplicated validation effort

## Context

Current state:
- Agent 01 accepted: backend `PracticeSegment` layers landed
- Agent 02 accepted: page now prefers `finalPracticeSegments`
- Agent 03 accepted: edit mode MVP landed
- Agent 04 accepted: benchmark/checklist docs and builder-level QA landed

Known remaining validation gap:
- we still want at least one real route-contract check for `/api/youtube/transcript/[videoId]`
- builder-level tests alone are not enough

Known current limitation:
- translation merge on the page is still text-based
- repeated identical lines can attach the wrong cached translation until a stronger join key is exposed

Relevant docs:
- [00-ORCHESTRATION.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/implementation-agents/00-ORCHESTRATION.md)
- [QA_CHECKLIST.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/implementation-agents/QA_CHECKLIST.md)
- [BENCHMARK_VIDEO_SET.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/implementation-agents/BENCHMARK_VIDEO_SET.md)
- [IMPLEMENTATION_ROADMAP.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/IMPLEMENTATION_ROADMAP.md)

Relevant code:
- [page.tsx](/home/helye/DevProjects/nextjs/moshimoshi/src/app/%5Blocale%5D/youtube-shadowing/page.tsx)
- [route.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/youtube/transcript/%5BvideoId%5D/route.ts)
- [practiceSegments.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/lib/transcript/practiceSegments.ts)
- [practiceSegmentTypes.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/lib/transcript/practiceSegmentTypes.ts)
- [segmentOverrides.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/lib/transcript/segmentOverrides.ts)

## Objective

Produce an acceptance-quality validation package for the current YouTube shadowing implementation.

Specifically:
1. prove that the real transcript route emits the expected contract for the page
2. prove that the current end-to-end feature still behaves acceptably on benchmark content
3. document remaining risks clearly, without expanding scope into new feature work

## Required Deliverables

### 1. Route-Contract Coverage

Add at least one real automated check for the transcript API contract.

Requirements:
- exercise the real `/api/youtube/transcript/[videoId]` response path as directly as feasible in this repo
- validate at minimum:
  - `segments` still exists
  - `finalPracticeSegments` exists when available
  - `computedPracticeSegments` exists when available
  - `sourceSegments` exists when available
  - page-required fields exist on `finalPracticeSegments`
  - response remains backward-compatible for legacy consumers
- do not write a fake contract test that only validates locally fabricated objects

Acceptable forms:
- route test
- integration-style contract test
- tightly scoped server-side test harness

Not acceptable:
- tests that only re-assert builder output
- tests that mirror interfaces locally without touching real route behavior

### 2. Benchmark Validation Report

Create a written validation report under:

`02-PRODUCTION_DOCS/youtube-shadowing/implementation-agents/PHASE3_VALIDATION_REPORT.md`

It must cover:
- which benchmark videos/categories were validated
- what was tested automatically
- what was tested manually
- pass/fail result by category
- notable regressions found or explicitly not found
- whether the current implementation is acceptable for the completed phases

Minimum categories to address:
- normal speech
- fast dialogue
- lyrics
- noisy/bad captions
- long transcript

If a category could not be tested, state that explicitly and why.

### 3. Checklist Update

Update [QA_CHECKLIST.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/implementation-agents/QA_CHECKLIST.md) sign-off section or notes to reflect the results of this validation pass.

At minimum:
- whether route-contract coverage is now satisfied
- whether benchmark/manual QA was completed
- whether current known limitations remain open

## Non-Goals

Do not:
- introduce new segmentation heuristics
- change player sync logic unless required to unblock a clear failing validation
- redesign the route contract
- start Phase 4 policy branching work
- add speculative UI changes

This agent validates the current accepted implementation. It does not expand scope.

## Acceptance Criteria

I will accept this agent only if all of the following are true:

1. There is at least one real route-level contract check for `/api/youtube/transcript/[videoId]`.
2. The validation report is concrete and grounded in actual repo behavior, not generic prose.
3. Manual QA results are recorded against the benchmark categories or explicitly called out as incomplete.
4. The report distinguishes:
   - confirmed behavior
   - known limitation
   - unverified area
5. No fake confidence:
   - if something could not be tested, it must be stated directly
6. Any code changes remain tightly scoped to validation and testing.

## Suggested Execution Plan

1. Inspect the accepted implementation from Agents 01-04.
2. Add route-contract coverage.
3. Run available automated validation.
4. Perform the benchmark/manual QA pass using the checklist.
5. Write `PHASE3_VALIDATION_REPORT.md`.
6. Update the checklist/sign-off notes.

## Expected Output Back To Me

Return with:
- a short summary of what was added
- file paths changed
- whether the route-contract gap is now closed
- benchmark/manual QA outcome
- explicit residual risks
