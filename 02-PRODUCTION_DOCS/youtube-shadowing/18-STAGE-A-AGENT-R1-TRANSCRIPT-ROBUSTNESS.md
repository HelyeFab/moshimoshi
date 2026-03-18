# Agent R1 — Stage A Transcript Robustness

## Read first

1. [17-STAGE-A-ROBUSTNESS-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/17-STAGE-A-ROBUSTNESS-OVERVIEW.md)
2. [02-STAGE-A-CONTINUOUS-PLAYER.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/02-STAGE-A-CONTINUOUS-PLAYER.md)
3. Current rebuild-owned transcript route:
   [route.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/moshi-player/transcript/%5BvideoId%5D/route.ts)
4. Current Stage A page:
   [page.tsx](/home/helye/DevProjects/nextjs/moshimoshi/src/app/%5Blocale%5D/moshi-player/page.tsx)

## Mission

Make the rebuild-owned Stage A transcript route robust enough to retrieve Japanese captions on videos where Japanese captions exist.

The current route is too weak. A real manual test already showed:
- old player succeeds
- new rebuild player fails

Your job is to close that gap using rebuild-owned logic only.

## Constraints

Do not:
- import anything from the old `/api/youtube/transcript/[videoId]` route
- import anything from `src/lib/transcript/*`
- import old shadowing modules
- add segmentation
- add AI processing
- add Railway/Sheldon/Supa fallback layers

You may:
- use `youtubei.js`
- inspect YouTube transcript/language menu structures
- add minimal helper logic inside the new route
- improve language selection and transcript retrieval behavior

## Required behavior

1. Prefer Japanese transcript tracks explicitly.
2. If default transcript is not Japanese, search for Japanese transcript options.
3. If Japanese track exists, fetch and return it.
4. If Japanese track does not exist, return clean unavailable state.
5. Keep the route minimal and rebuild-owned.

## Deliverables

1. Updated rebuild-owned transcript route.
2. Any narrowly scoped tests for the new route if useful.
3. Short implementation note covering:
- how Japanese was detected
- how alternate Japanese track was selected/fetched
- what edge cases are now covered

## Acceptance criteria

1. The route is still rebuild-owned and minimal.
2. No old transcript pipeline code is imported.
3. Japanese transcript selection is more robust than the current version.
4. The route still returns clean unavailable/error states.
5. No Stage B/C logic leaks into this work.

## Report back format

Return with:
- files changed
- exact retrieval strategy
- what failure mode from the current route was fixed
- what is still unverified until manual runtime testing
