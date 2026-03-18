# Agent 04: QA And Benchmarks

## 1. Mission

Define and implement the benchmark and QA layer that allows the Technical Lead to accept or reject segmentation-architecture changes with evidence.

You own:
- test and benchmark scaffolding
- manual validation guidance
- regression checks around segment shape and playback safety

You do not own:
- main product feature implementation
- policy logic
- edit-mode UX

## 2. Must-Read Context

Read before coding:

1. `02-PRODUCTION_DOCS/youtube-shadowing/IMPLEMENTATION_ROADMAP.md`
2. `02-PRODUCTION_DOCS/youtube-shadowing/PRACTICE_SEGMENT_ARCHITECTURE_PROPOSAL.md`
3. `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/WAVE1_SYNTHESIS.md`
4. `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/WAVE2_SYNTHESIS.md`

Then inspect:

- existing transcript tests under `src/lib/transcript/__tests__/`
- existing resegment tests
- existing benchmark docs in `02-PRODUCTION_DOCS/youtube-shadowing/`

## 3. Scope

Implement supporting QA work in parallel with the feature streams.

### Required work

1. Define benchmark video set categories:
- normal speech
- fast speech/dialogue
- lyrics
- noisy/bad captions
- long transcript

2. Add or extend targeted tests for:
- computed/final segment shape
- no overlap
- minimum duration
- stable fallback behavior

3. Add a manual QA checklist for:
- "right thing to repeat"
- "player stops/restarts exactly there"
- "lyrics are not degraded when policy work arrives later"

4. If practical, add instrumentation expectations for:
- `boundaryMethod`
- `timingMethod`
- `boundaryConfidence`
- override rate

### Out of scope

- large product code changes unrelated to QA
- architecture design itself

## 4. Deliverables

You should deliver:

1. test additions or updates
2. benchmark/checklist documentation updates
3. any minimal helper scripts needed for validation

## 5. Acceptance Criteria

The Technical Lead should accept only if:

1. QA work is tied directly to the architecture migration
2. benchmark categories reflect the real segmentation problem
3. tests help catch regressions in segment safety and contract shape
4. no speculative tooling is added without immediate value

## 6. Rejection Criteria

Reject if:
- the work becomes generic testing churn
- it ignores lyrics or hard-caption scenarios
- it adds heavy infra with weak payoff

## 7. Parallel Or Solo

Work mode:
- starts immediately in parallel with Agent 01
- continues in parallel with Agent 02 and Agent 03
- does not block initial coding but blocks final acceptance

