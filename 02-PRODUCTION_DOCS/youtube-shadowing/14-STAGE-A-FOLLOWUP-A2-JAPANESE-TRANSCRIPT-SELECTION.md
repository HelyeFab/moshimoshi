# Agent A2 Follow-Up — Japanese Transcript Selection

## Read First

1. [13-STAGE-A-FOLLOWUP-OVERVIEW.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/13-STAGE-A-FOLLOWUP-OVERVIEW.md)
2. [02-STAGE-A-CONTINUOUS-PLAYER.md](/home/helye/DevProjects/nextjs/moshimoshi/02-PRODUCTION_DOCS/youtube-shadowing/02-STAGE-A-CONTINUOUS-PLAYER.md)
3. Current rebuild-owned route:
   [route.ts](/home/helye/DevProjects/nextjs/moshimoshi/src/app/api/moshi-player/transcript/%5BvideoId%5D/route.ts)

## Mission

Keep the new rebuild-owned transcript route, but make transcript selection explicitly Japanese-specific.

## Required behavior

1. If a Japanese transcript/caption track exists, use it.
2. If multiple tracks exist, prefer Japanese.
3. If no Japanese transcript exists, return:
- `available: false`
- a clear message indicating Japanese transcript is unavailable
4. Do not silently accept another language as success.

## Constraints

Do not:
- import old YouTube shadowing transcript code
- add segmentation
- add AI processing
- add provider fallback layers
- pull in old cache or Supa/Railway/Sheldon logic

Using `youtubei.js` directly is still allowed.

## Deliverables

1. Updated rebuild-owned transcript route.
2. Any necessary page adjustment if the unavailable message needs to surface cleanly.
3. Short implementation note explaining:
- how Japanese was detected/selected
- what happens when Japanese is unavailable

## Acceptance Criteria

1. Japanese transcript is explicitly preferred.
2. Non-Japanese default transcript is not treated as success.
3. Route remains minimal and rebuild-owned.
4. No Stage B or segmentation logic leaks into this change.

## Report Back Format

Return with:
- files changed
- transcript selection logic used
- unavailable behavior when Japanese is absent
- confirmation that no old transcript pipeline code was imported
