# Agent A3 — Validation And QA

## Shared Context

Read this first:
- [05-STAGE-A-EXECUTION-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/05-STAGE-A-EXECUTION-OVERVIEW.md)
- [02-STAGE-A-CONTINUOUS-PLAYER.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/02-STAGE-A-CONTINUOUS-PLAYER.md)

This agent may run in two passes:
- preparation pass in parallel with Agent A1
- validation pass after Agent A2

## Mission

Define and then execute the Stage A acceptance validation.

This stage is about one thing:
- can the rebuilt player play continuously and naturally while transcript data is present?

## Scope

Required:
- prepare Stage A QA checklist / validation doc
- define what must be tested on:
  - normal speech video
  - problematic music video
- after implementation lands, validate the result

Not in scope:
- segmentation evaluation
- repeat-loop evaluation
- edit mode evaluation

## Deliverables

1. Stage A validation checklist document.
2. Stage A validation report document after implementation is ready.
3. Any minimal automated checks that are genuinely useful for Stage A.

## Acceptance Criteria

1. Validation is centered on continuous playback trust.
2. The problematic music-video case is included.
3. Report clearly distinguishes:
- confirmed
- unverified
- failed
4. No fake confidence from irrelevant tests.

## Report Back Format

Return with:
- files added/changed
- what was prepared vs actually validated
- Stage A pass/fail verdict
- concrete residual risks
