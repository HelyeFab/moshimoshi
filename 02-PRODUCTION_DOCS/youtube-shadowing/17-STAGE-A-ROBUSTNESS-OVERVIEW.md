# Stage A Robustness Overview

This document is written for fresh agents with no prior context.

## Product context

We are rebuilding Moshi Player from scratch.

The old player path is:
- `/en/youtube-shadowing`

The new rebuild path is:
- `/en/moshi-player`

The rebuild is intentionally staged:

### Stage A

Goal:
- accept a YouTube link
- fetch a Japanese transcript
- display the transcript
- play the video continuously and naturally

Stage A explicitly does **not** include:
- segmentation
- repeat-by-segment
- transcript-driven playback control
- edit mode
- AI resegmentation

### Stage B

Will later add:
- full-video loop from the beginning

### Stage C

Will later add:
- meaningful segmentation comparable to Miraa

## Rebuild rule

This rebuild must not reuse the old YouTube shadowing implementation.

Allowed:
- shared app infrastructure
- shared UI primitives
- shared routing/auth/i18n
- generic utilities
- shared external packages like `youtubei.js`

Not allowed:
- importing old transcript pipeline logic
- importing old shadowing/repeat/sync logic
- reusing old transcript segmentation or enrichment code

## What has already been built

The new Stage A player shell exists at:
- [`src/app/[locale]/moshi-player/page.tsx`](/home/helye/DevProjects/nextjs/moshimoshi/src/app/%5Blocale%5D/moshi-player/page.tsx)

Current known good behavior:
- user can load a YouTube link
- video playback is continuous and natural
- transcript rendering is decoupled from playback

The rebuild-owned transcript route exists at:
- [`src/app/api/moshi-player/transcript/[videoId]/route.ts`](/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/moshi-player/transcript/%5BvideoId%5D/route.ts)

It currently:
- uses `youtubei.js`
- tries to fetch transcript directly
- stays minimal

## Current failure

Manual testing showed:
- the new player can load the video
- the new player playback is natural
- the new player fails to fetch Japanese transcript for a video where the old player succeeds

This means:
- Stage A playback foundation is correct
- Stage A transcript retrieval is not robust enough

## What success looks like in this pass

For videos that truly have Japanese captions available:
- the new rebuild-owned route should successfully retrieve Japanese transcript
- the page should display it

For videos without Japanese captions:
- the new route should return a clean unavailable state
- the UI should show that clearly

## What this pass is not trying to do

- match the old route's entire feature surface
- add caching layers
- add AI formatting
- add segmentation
- add provider farms (Railway/Sheldon/Supa)

This pass is about improving Japanese transcript retrieval using rebuild-owned logic only.

## Important observed test case

Manual testing already found a concrete failure:
- new player route failed to load Japanese transcript
- old player did load transcript for the same video

That means regression exists in transcript retrieval capability, even if the rebuild architecture is cleaner.

## Core engineering question

How do we make the rebuild-owned route reliably retrieve Japanese transcript tracks using minimal direct logic, without importing the old transcript pipeline?
