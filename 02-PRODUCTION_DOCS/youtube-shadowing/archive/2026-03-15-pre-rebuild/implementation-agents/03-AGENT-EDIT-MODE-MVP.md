# Agent 03: Edit Mode MVP

## 1. Mission

Add the minimal useful in-player segment correction workflow on top of final practice segments.

You own:
- edit mode toggle
- merge adjacent segments
- split segment at selected text position
- reset to original
- local persistence of overrides

You do not own:
- backend override API
- waveform editor
- audio preview
- policy detection

## 2. Must-Read Context

Read before coding:

1. `02-PRODUCTION_DOCS/youtube-shadowing/PRACTICE_SEGMENT_ARCHITECTURE_PROPOSAL.md`
2. `02-PRODUCTION_DOCS/youtube-shadowing/IMPLEMENTATION_ROADMAP.md`
3. `02-PRODUCTION_DOCS/youtube-shadowing/research-briefs/outputs/06-editable-fallback-ux-REPORT.md`

Then inspect:

- `src/app/[locale]/youtube-shadowing/page.tsx`
- the final segment contract landed by Agent 02

## 3. Dependency

Do not start final implementation until Agent 02 has landed page consumption of final practice segments.

## 4. Scope

Implement Phase 3 only.

### Required work

1. Add `Edit Segments` mode to the player page.
2. Add merge operation for adjacent segments.
3. Add split operation for a segment at a selected text position.
4. Add `Reset to original`.
5. Persist overrides locally.
6. Re-apply overrides on reload.

### Suggested technical shape

- add `SegmentOverride` model
- add helper module under `src/lib/transcript/`
- keep persistence local-first

### Out of scope

- backend persistence
- cross-device sync
- drag handles
- audio preview
- confidence-based UI prioritization beyond minimal hints

## 5. Deliverables

You should deliver:

1. edit mode UI
2. override helper logic
3. local persistence
4. safe merge/split timing behavior

## 6. Acceptance Criteria

The Technical Lead should accept only if:

1. edit mode is off by default
2. merge and split work on the actual final practice segments
3. reset is reliable
4. overrides survive reload
5. repeat and playback logic remain stable after edits
6. the implementation remains lightweight and understandable

## 7. Rejection Criteria

Reject if:
- the agent introduces a heavy editor UI
- the agent edits raw transcript source instead of final practice segments
- persistence is coupled to the backend prematurely
- merge/split can produce unsafe timings without normalization

## 8. Parallel Or Solo

Work mode:
- starts after Agent 02
- can run in parallel with Agent 04 follow-up QA
- otherwise solo

