# Agent W1 — Retrieval Waterfall Port

Read these first, in order:
1. [21-STAGE-A-RETRIEVAL-WATERFALL-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/21-STAGE-A-RETRIEVAL-WATERFALL-OVERVIEW.md)
2. [02-STAGE-A-CONTINUOUS-PLAYER.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/02-STAGE-A-CONTINUOUS-PLAYER.md)
3. [20-STAGE-A-RETRIEVAL-WATERFALL-DISPATCH.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/20-STAGE-A-RETRIEVAL-WATERFALL-DISPATCH.md)

## Your assignment

Port the clean raw transcript retrieval waterfall into the rebuild-owned Stage A route.

Primary target:
- [`src/app/api/moshi-player/transcript/[videoId]/route.ts`](/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/moshi-player/transcript/%5BvideoId%5D/route.ts)

You may inspect these old routes for archaeology:
- [`src/app/api/youtube/transcript/[videoId]/route.ts`](/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/youtube/transcript/%5BvideoId%5D/route.ts)
- [`src/app/api/youtube/extract/route.ts`](/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/youtube/extract/route.ts)

## Required outcome

The rebuild-owned route must:
- stay owned by `/api/moshi-player/transcript/[videoId]`
- use a provider waterfall rather than a single fragile retrieval path
- prefer Japanese transcript tracks
- return raw transcript only
- remain Stage A compatible

## What you are allowed to reuse or port

You may reuse or port only the clean retrieval layer:
- provider order
- provider-specific request logic
- Japanese language detection and selection
- fallback sequencing
- raw field mapping

## What you must not import or reuse

Do not import or port:
- any AI formatting logic
- any transcript cleanup/merge/chunk/resegmentation logic
- any practice-segment code
- any playback/repeat/sync code
- any quota/history/auth coupling

Specifically avoid imports from:
- `src/lib/transcript/mergeSegments`
- `src/lib/transcript/chunkSegments`
- `src/lib/transcript/resegmentation`
- `src/lib/transcript/aiTimingAlignment`
- `src/lib/transcript/practiceSegments`
- `src/lib/transcript/practiceSegmentTypes`
- old shadowing/player utilities

## Acceptable route behavior

The route may:
- check a transcript cache if that is purely retrieval/cache, not transcript shaping
- call multiple providers sequentially
- return provider source metadata
- return unavailable when no Japanese transcript exists

The route must not:
- mutate transcript into learner-oriented segments
- run cleanup that changes unit boundaries
- add translations, words, or practice metadata

## Suggested approach

1. Inspect old provider ordering.
2. Identify the smallest reliable subset worth carrying into Stage A.
3. Implement that waterfall in the new route.
4. Keep the response shape simple:
   - `available`
   - `videoId`
   - `title`
   - `language`
   - `availableLanguages`
   - `source`
   - `segments: [{ start, end, duration, text }]`
   - `message` / `error`
5. Preserve page compatibility with the current `moshi-player` page.

## Deliverables

1. Route changes in:
- [`src/app/api/moshi-player/transcript/[videoId]/route.ts`](/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/moshi-player/transcript/%5BvideoId%5D/route.ts)

2. If needed, one small rebuild-owned helper module under:
- [`src/lib/moshi-player/`](/home/helye/DevProjects/nextjs/moshimoshi/src/lib/moshi-player)

3. Tests
- at least one route-level test against the real rebuild route handler
- provider fallback tests if practical

4. Delivery report including:
- provider order implemented
- what old logic was inspected
- what was intentionally excluded
- how Japanese track selection works
- what is still environment-dependent or unverified

## Acceptance criteria

I will accept only if all of these are true:

1. The rebuild route no longer depends on a single direct retrieval path.
2. The route remains rebuild-owned.
3. No old processing or AI layers are imported.
4. The returned transcript is still raw.
5. Japanese transcript selection is explicit.
6. The implementation is narrow and Stage A only.
7. At least one real route-handler test exists.

## Additional note

Do not try to solve lyric segmentation here.

This pass is only about transcript retrieval robustness.
