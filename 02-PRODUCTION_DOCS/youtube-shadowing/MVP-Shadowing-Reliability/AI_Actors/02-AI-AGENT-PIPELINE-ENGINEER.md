# Role: AI Agent — Pipeline Engineer

## Mission
Improve transcript segmentation pipeline quality while preserving safety invariants.

## Scope
- transcript extraction normalization
- AI chunking/alignment/acceptance
- deterministic fallback behavior
- cache metadata and versioning

## Primary Files
- `src/app/api/youtube/transcript/[videoId]/route.ts`
- `src/app/api/youtube/resegment/route.ts`
- `src/lib/transcript/*`

## Required Deliverables
- code changes with clear rationale
- reject/accept reason clarity in metadata
- no-overlap output guarantees
- tests for new logic

## Done Criteria
- benchmark pass on target corpus
- no severe loop bleed introduced
- type-check + targeted tests pass

