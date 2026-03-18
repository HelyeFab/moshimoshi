# Agent 02: Page Migration To FinalPracticeSegment

## 1. Mission

Migrate the YouTube Shadowing page to consume explicit final practice segments while preserving the existing playback engine and user-facing behavior.

You own:
- page data consumption
- runtime compatibility mapping
- preserving current playback behavior while switching the page’s data source

You do not own:
- backend contract design
- edit mode
- new alignment infrastructure

## 2. Must-Read Context

Read before coding:

1. `02-PRODUCTION_DOCS/youtube-shadowing/PRACTICE_SEGMENT_ARCHITECTURE_PROPOSAL.md`
2. `02-PRODUCTION_DOCS/youtube-shadowing/IMPLEMENTATION_ROADMAP.md`
3. `02-PRODUCTION_DOCS/youtube-shadowing/implementation-agents/01-AGENT-BACKEND-PRACTICE-SEGMENTS.md`

Then inspect:

- `src/app/[locale]/youtube-shadowing/page.tsx`
- transcript response shape from Agent 01’s changes

## 3. Dependency

Do not start final implementation until Agent 01’s route contract is available.

## 4. Scope

Implement Phase 2 only.

### Required work

1. Update the page to prefer `finalPracticeSegments` from the route response.
2. Preserve fallback to the legacy `segments` field if needed.
3. Map final practice segments into the page’s runtime player segment shape.
4. Keep:
- repeat logic
- seek verification
- session restore
- translation behavior
- word explanation behavior

5. Introduce internal awareness of:
- `contentKind`
- `segmentationPolicy`
- `boundaryConfidence`
- `isUserEdited`

These fields do not need full UI exposure yet.

### Out of scope

- changing repeat logic semantics
- edit mode
- override persistence
- new segmentation heuristics

## 5. Deliverables

You should deliver:

1. page transcript response type updates
2. page load/mapping updates
3. any minimal UI adjustments needed to keep behavior stable

## 6. Acceptance Criteria

The Technical Lead should accept only if:

1. the page clearly consumes final learner-facing segments
2. playback behavior is not regressed
3. compatibility fallback remains safe
4. translation and word explanation flows still work
5. no premature edit mode or policy UI is added

## 7. Rejection Criteria

Reject if:
- the agent rewrites the playback engine unnecessarily
- the agent mixes migration work with edit-mode work
- the page becomes dependent on fields that Agent 01 did not guarantee
- the change adds UX complexity unrelated to the migration

## 8. Parallel Or Solo

Work mode:
- starts after Agent 01
- parallel with Agent 04 once started
- blocks Agent 03

