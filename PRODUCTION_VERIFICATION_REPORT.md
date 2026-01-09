# Production Verification Report

Date: 2026-01-09

## Recovery Actions
- Production envs synced from collaborator preview.
- R2 variables added to Production.
- Prelaunch lock set to `false` and production redeployed.

## Public/Read-Only API Smoke Tests
- `/api/news/health` → 200
- `/api/news/status` → 200
- `/api/news/articles?limit=1` → 200
- `/api/nhk/live-schedule?service=g1&includeStats=true` → 200
- `/api/tts/cache/stats` → 200
- `/api/auth/google` (dummy token) → 401 (expected)

## Env-Dependent Services
- AI health (`/api/ai/process`) → 200, `openaiConnected: true`
- YouTube API (`/api/youtube/video-info`) → 200
- TTS demo (`/api/tts/demo`) → 200
- Stripe health (`/api/admin/stripe/health`) → 200

## Authenticated R2 Checks (Browser)
- `/api/anki/r2/usage-check` → `allowed: true`
- `/api/anki/r2/usage` → returned real `usedBytes` and `limitBytes`
