# Agent A1 — Foundation And Player Shell

## Shared Context

Read this first:
- [05-STAGE-A-EXECUTION-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/05-STAGE-A-EXECUTION-OVERVIEW.md)
- [02-STAGE-A-CONTINUOUS-PLAYER.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/02-STAGE-A-CONTINUOUS-PLAYER.md)

This is a rebuild from scratch.

Do not:
- reuse old YouTube shadowing logic
- import prior playback/sync/repeat code
- copy old transcript-driven player behavior

You may use:
- shared app infrastructure
- shared UI primitives
- shared auth/routing/i18n

## Mission

Build the Stage A player shell.

The result should be a clean new page or module that:
- accepts a YouTube URL
- loads and embeds the video
- can play continuously
- has a visible transcript area ready for transcript data

Transcript fetching itself is not the core responsibility of this agent. Build the shell and clean integration points for it.

## Scope

Required:
- URL input
- video ID extraction
- player embed
- clear loading / error / empty states
- transcript panel placeholder/state
- no transcript-driven playback control

Not in scope:
- segmentation
- repeat
- full-video loop
- edit mode
- word explanations
- translation workflows

## Deliverables

1. New Stage A player shell implementation in code.
2. Any minimal supporting styles/components required.
3. A short implementation note describing:
- entrypoint
- major files changed
- assumptions

## Acceptance Criteria

1. User can paste a YouTube link and load the player.
2. The player can play continuously without our code pausing/seeking on transcript boundaries.
3. Transcript area exists, even if it is not fully wired yet.
4. No old shadowing runtime logic is imported.
5. Scope stays narrow and Stage A-specific.

## Report Back Format

Return with:
- files changed
- what was implemented
- what was intentionally left out
- anything that blocks Agent A2
