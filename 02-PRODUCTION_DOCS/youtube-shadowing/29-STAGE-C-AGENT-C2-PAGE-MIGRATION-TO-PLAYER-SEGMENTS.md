# Agent C2: Page Migration To Player Segments

Read these first, in order:

1. [27-STAGE-C-EXECUTION-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/27-STAGE-C-EXECUTION-OVERVIEW.md)
2. [24-STAGE-C-10-10-ARCHITECTURE.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/24-STAGE-C-10-10-ARCHITECTURE.md)
3. [25-STAGE-C-IMPLEMENTATION-ROADMAP.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/25-STAGE-C-IMPLEMENTATION-ROADMAP.md)
4. Agent C1 accepted delivery

## Your Assignment

Migrate the Moshi Player page so it consumes computed `PlayerSegment` data instead of raw provider rows.

Primary file:
- [page.tsx](/home/helye/DevProjects/nextjs/moshimoshi/src/app/%5Blocale%5D/moshi-player/page.tsx)

## Required Behavior

1. The transcript UI should display computed player segment text.
2. Repeat/shadowing should use computed player segment timings.
3. Raw transcript rows should remain available only for debug/inspection.
4. The page must stop treating raw provider rows as the playback contract.

## Constraints

- no repeat-mode feature expansion
- no alignment refinement logic in the page
- no old youtube-shadowing imports
- no local reimplementation of reconstruction logic
