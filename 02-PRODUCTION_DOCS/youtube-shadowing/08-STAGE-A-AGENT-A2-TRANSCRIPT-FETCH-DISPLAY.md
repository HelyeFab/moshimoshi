# Agent A2 — Transcript Fetch And Display

## Shared Context

Read this first:
- [05-STAGE-A-EXECUTION-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/05-STAGE-A-EXECUTION-OVERVIEW.md)
- [02-STAGE-A-CONTINUOUS-PLAYER.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/02-STAGE-A-CONTINUOUS-PLAYER.md)
- `Agent A1` output

This is a rebuild from scratch.

Do not:
- import old Moshi Player / YouTube shadowing transcript orchestration
- add segmentation logic
- add player timeline control based on transcript

## Mission

Add transcript fetching and transcript display to the new Stage A player shell.

The transcript should be treated as display data in this stage, not as playback-control data.

## Scope

Required:
- fetch transcript for the provided video
- render transcript text in the transcript panel
- handle transcript unavailable / loading / error states
- keep playback continuous and independent from transcript rendering

Not in scope:
- segmentation
- repeat logic
- looping from start
- transcript-guided seeking
- transcript editing

## Deliverables

1. Transcript fetch integration for the Stage A player shell.
2. Transcript rendering in the UI.
3. A short note describing:
- where transcript data is fetched
- what response shape is used
- how playback is kept decoupled from transcript behavior

## Acceptance Criteria

1. Transcript loads when available.
2. Transcript renders in a readable form.
3. Continuous playback still feels natural.
4. Transcript loading does not introduce pause/seek/re-entry logic.
5. No segmentation work is introduced.

## Report Back Format

Return with:
- files changed
- transcript source/API used
- failure states handled
- confirmation that playback control was not coupled to transcript rendering
