# Stage A Retrieval Waterfall Overview

This document is written for fresh agents with no prior context.

## Product we are building

We are rebuilding Moshi Player from scratch.

Old path:
- `/en/youtube-shadowing`

New rebuild path:
- `/en/moshi-player`

The rebuild is intentionally linear.

### Stage A

Current scope:
- accept a YouTube link
- load the video
- fetch a Japanese transcript
- display the transcript
- let the video play continuously and naturally

Stage A explicitly does **not** include:
- segmentation
- repeat-by-segment
- transcript-controlled seeking
- edit mode
- AI resegmentation

### Stage B

Will later add:
- full-video loop from the beginning

### Stage C

Will later add:
- meaningful segmentation comparable to Miraa

## Rebuild rule

The rebuild must not drift back into the old shadowing architecture.

Allowed:
- shared app infrastructure
- shared UI primitives
- shared auth/routing/i18n
- shared external packages
- raw transcript retrieval providers and fallback strategy

Forbidden:
- old transcript processing pipeline
- old cleanup/merge/chunk/resegmentation layers
- old AI formatting or correction layers
- old player/repeat/sync logic
- old practice-segment model

## Current implementation status

What already exists:
- a new player shell at:
  - [`src/app/[locale]/moshi-player/page.tsx`](/home/helye/DevProjects/nextjs/moshimoshi/src/app/%5Blocale%5D/moshi-player/page.tsx)
- a rebuild-owned transcript route at:
  - [`src/app/api/moshi-player/transcript/[videoId]/route.ts`](/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/moshi-player/transcript/%5BvideoId%5D/route.ts)

What already works:
- YouTube link loading
- continuous playback
- transcript display wiring
- playback remains decoupled from transcript rendering

What currently fails:
- Japanese transcript retrieval is not robust enough

Manual reality:
- the rebuild player failed to load transcript for a known video
- the old player succeeded on that same video

## Important architectural discovery

The old player succeeded because its transcript acquisition layer was broad.

From code inspection, the old system used a retrieval waterfall across:
- Firebase cache
- Railway transcript server
- Sheldon transcript server
- YouTubei.js with Japanese language forcing
- standard YouTubei.js
- Supa transcript API

The older extract route also contained additional raw retrieval methods such as:
- YouTube-Transcript.io
- youtube-captions-scraper

That old system also mixed retrieval with many things we do **not** want:
- cache mutation
- quota logic
- user history
- AI formatting
- transcript cleanup
- segmentation-related normalization

## What this pass must do

This pass should separate the clean retrieval mechanism from the contaminated layers.

Specifically, the agent should:
1. study the old retrieval ordering and provider logic
2. identify the minimal raw retrieval subset worth porting into the rebuild route
3. implement or port that retrieval waterfall into the rebuild-owned route
4. keep the route response raw and Stage A compatible

## What is safe to port

Safe:
- provider order
- provider adapters
- Japanese language detection
- caption track selection
- fallback sequencing
- raw transcript extraction
- structural field mapping only

Not safe:
- removeTinyAdjacentTextOverlap as product logic if used to shape transcript semantics
- merge/chunk/resegment logic
- AI formatting/correction
- cache-driven transcript mutation
- history/quota/auth side effects
- playback-related assumptions

Minimal structural normalization is acceptable only if it does not alter transcript meaning:
- mapping provider output to `{ start, end, duration, text }`
- dropping empty segments
- converting milliseconds to seconds

## Acceptance target

The rebuild route should be able to load Japanese transcript for videos where the old player already can.

Success looks like:
- `/en/moshi-player` loads transcript on known working Japanese-caption videos
- transcript remains raw
- no segmentation logic leaks in
- no old playback/shadowing behavior leaks in

## Known test videos

Use these as anchors:

V1:
- `uk7gKixqVNU`
- normal Japanese speech

V2:
- `9LW9DpmhrPE`
- problematic music/lyrics case

The immediate requirement is transcript retrieval robustness, not lyric segmentation quality.

## Core engineering question

How do we port the old transcript retrieval breadth into the new Stage A route while keeping everything else from the old player out?
