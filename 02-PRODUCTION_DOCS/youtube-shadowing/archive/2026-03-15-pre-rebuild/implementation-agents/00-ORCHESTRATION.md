# Orchestration

Last updated: 2026-03-13
Role: Technical Lead execution plan

## 1. Objective

Implement the `PracticeSegment` architecture without destabilizing the existing YouTube Shadowing player.

Primary goal:

`replace the implicit "cleaned transcript = final practice segment" assumption with explicit source/computed/final practice segment layers`

## 2. Streams

### Stream A

Agent:
- `01-AGENT-BACKEND-PRACTICE-SEGMENTS.md`

Scope:
- types
- transcript route output
- helper module for computed/final practice segments

Parallel status:
- can start immediately

### Stream B

Agent:
- `02-AGENT-PAGE-MIGRATION.md`

Scope:
- page consumption of `FinalPracticeSegment`
- runtime compatibility mapping

Parallel status:
- should start after Stream A establishes the route contract

### Stream C

Agent:
- `03-AGENT-EDIT-MODE-MVP.md`

Scope:
- local split/merge/reset edit mode
- local override persistence

Parallel status:
- should start after Stream B lands

### Stream D

Agent:
- `04-AGENT-QA-BENCHMARKS.md`

Scope:
- benchmark plan
- test coverage
- manual verification harness

Parallel status:
- can start immediately
- should update in parallel as other streams progress

## 3. Dependency Graph

Order:

1. Stream A
2. Stream B
3. Stream C

Parallel support:

- Stream D in parallel with A, B, and C

## 4. Acceptance Sequence

The Technical Lead should review in this order:

1. backend contract
2. page migration
3. edit mode
4. QA additions

Do not approve downstream work if upstream contracts are still unstable.

## 5. Merge Policy

Recommended merge order:

1. Agent 01
2. Agent 02
3. Agent 04 baseline QA changes
4. Agent 03
5. Agent 04 follow-up QA changes if needed

## 6. Non-Negotiables

1. No agent should rewrite the player loop engine during Phase 1 or Phase 2.
2. No agent should introduce audio-heavy alignment infrastructure in this implementation batch.
3. No agent should introduce `lyrics` policy logic yet unless explicitly asked in a later wave.
4. Backwards compatibility should be preserved during migration where practical.
5. Every change should keep deterministic fallback intact.

