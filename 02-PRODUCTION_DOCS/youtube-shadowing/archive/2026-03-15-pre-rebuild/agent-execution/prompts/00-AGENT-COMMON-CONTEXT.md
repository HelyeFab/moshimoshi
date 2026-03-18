# Agent Common Context (Mandatory Pre-Read)

## Mission
Ship production-safe improvements to YouTube Shadowing focused on:
1. Repeat-friendly transcript segmentation.
2. Playback-to-segment synchronization accuracy.

## Non-Negotiables
1. Preserve existing architecture and conventions.
2. Smallest safe change; no speculative refactors.
3. No silent behavior changes.
4. No entitlement/usage-tracking regressions.
5. Feature-flag risky changes by default.

## Cross-Feature Invariants (Must Not Break)
1. Segment ordering remains stable and monotonic.
2. Segment timestamps remain monotonic and non-negative.
3. Repeat semantics remain consistent with existing user expectations.
4. Progressive transcript loading must not reorder or skip segments.
5. Playback must not block on AI/analytics/translations.

## Acceptance Gates
Use:
- `02-PRODUCTION_DOCS/youtube-shadowing/04-REVIEW-RUBRIC-AND-ACCEPTANCE-GATES.md`

Minimum quality bar:
1. Rubric average >= 4.0.
2. No category below 3.5.
3. All hard acceptance gates pass.

## Boundaries
1. Do not change product scope outside your assigned task.
2. Do not introduce new libraries unless required and justified.
3. Keep API contracts backward compatible unless explicitly approved.

## Required Agent Output Contract
1. Patch with strong TypeScript typing.
2. Tests for all changed logic paths.
3. Risk note (what can still fail).
4. Rollback note (how to disable/revert safely).
5. Explicit list of touched files.
