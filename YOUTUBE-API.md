# YouTube Transcript API Documentation

## Overview

The YouTube Shadowing feature uses a multi-provider transcript extraction system with automatic fallback to ensure maximum availability of Japanese transcripts.

## Primary API Endpoint

```
GET /api/youtube/transcript/[videoId]
```

**Used by:** YouTube Shadowing Page (`/youtube-shadowing`)

**Response Format:**
```typescript
{
  available: boolean
  videoId: string
  title?: string
  segments?: TranscriptSegment[]
  language?: string
  availableLanguages?: string[]
  source?: 'firebase-cache' | 'railway-server' | 'sheldon-server' | 'youtubei-enhanced' | 'youtubei-standard' | 'supa-api'
  cached?: boolean
  totalSegments?: number
  totalDuration?: number
  message?: string
  error?: string
}
```

## Transcript Extraction Flow

The API uses a **waterfall pattern** - each provider is tried in sequence until one succeeds.

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSCRIPT EXTRACTION FLOW                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐
│  START   │
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: FIREBASE CACHE                                          │
│ ────────────────────────────────────────────────────────────── │
│ Collection: transcriptCache                                     │
│ Document ID: youtube_{videoId}                                  │
│ Source: 'firebase-cache'                                        │
│                                                                 │
│ ✅ HIT  → Return cached transcript immediately                  │
│ ❌ MISS → Continue to Step 2                                    │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: RAILWAY TRANSCRIPT SERVER (PRIMARY)                     │
│ ────────────────────────────────────────────────────────────── │
│ URL: https://modal-services-production.up.railway.app           │
│ Endpoint: /get-japanese-transcript?videoId={videoId}            │
│ Env Var: RAILWAY_TRANSCRIPT_URL (optional, has default)         │
│ Source: 'railway-server'                                        │
│                                                                 │
│ ✅ SUCCESS → Cache to Firebase, return transcript               │
│ ❌ FAIL    → Continue to Step 3                                 │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: SHELDON TRANSCRIPT SERVER (FALLBACK)                    │
│ ────────────────────────────────────────────────────────────── │
│ URL: https://api.selfmind.dev/transcript/api/youtube/{videoId}  │
│ Env Vars: SHELDON_API_URL (optional), SHELDON_API_KEY (required)│
│ Auth: X-API-Key header                                          │
│ Source: 'sheldon-server'                                        │
│                                                                 │
│ ⚠️  Skipped if SHELDON_API_KEY not configured                   │
│ ✅ SUCCESS → Cache to Firebase, return transcript               │
│ ❌ FAIL    → Continue to Step 4                                 │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: ENHANCED YOUTUBEI.JS                                    │
│ ────────────────────────────────────────────────────────────── │
│ Library: youtubei.js (npm package)                              │
│ Method: getTranscript() with Japanese language selection        │
│ Source: 'youtubei-enhanced'                                     │
│                                                                 │
│ Features:                                                       │
│ - Detects available transcript languages                        │
│ - Forces Japanese selection if available                        │
│ - Validates returned language is actually Japanese              │
│                                                                 │
│ ✅ SUCCESS → Cache to Firebase, return transcript               │
│ ❌ FAIL    → Continue to Step 5                                 │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: STANDARD YOUTUBEI.JS                                    │
│ ────────────────────────────────────────────────────────────── │
│ Library: youtubei.js (npm package)                              │
│ Method: Basic getTranscript() call                              │
│ Source: 'youtubei-standard'                                     │
│                                                                 │
│ ✅ SUCCESS → Cache to Firebase, return transcript               │
│ ❌ FAIL    → Continue to Step 6                                 │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: SUPA API (LAST RESORT)                                  │
│ ────────────────────────────────────────────────────────────── │
│ URL: https://api.supadata.ai/v1/transcript                      │
│ Env Var: SUPA_YOUTUBE_API_KEY (required)                        │
│ Source: 'supa-api'                                              │
│                                                                 │
│ ⚠️  Skipped if SUPA_YOUTUBE_API_KEY not configured              │
│ ✅ SUCCESS → Cache to Firebase, return transcript               │
│ ❌ FAIL    → Return 404 error                                   │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────┐
│ ALL METHODS FAILED                                               │
│ ──────────────────────────────────────────────────────────────── │
│ Return: { available: false, error: 'All methods failed' }        │
│ Status: 404                                                      │
└──────────────────────────────────────────────────────────────────┘
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RAILWAY_TRANSCRIPT_URL` | No | `https://modal-services-production.up.railway.app` | Railway transcript server URL |
| `SHELDON_API_URL` | No | `https://api.selfmind.dev/transcript/api/youtube` | Sheldon server URL |
| `SHELDON_API_KEY` | Yes* | - | API key for Sheldon server (*skipped if missing) |
| `SUPA_YOUTUBE_API_KEY` | Yes* | - | API key for Supa API (*skipped if missing) |
| `YOUTUBE_API_KEY` | No | - | YouTube Data API key (used for caption detection) |
| `GOOGLE_API_KEY` | No | - | Fallback for YOUTUBE_API_KEY |

## Provider Comparison

| Provider | Speed | Reliability | Japanese Support | Notes |
|----------|-------|-------------|------------------|-------|
| **Firebase Cache** | Instant | 100% | N/A | Cached from previous fetches |
| **Railway Server** | Fast | High | Excellent | Primary provider, hosted on Railway |
| **Sheldon Server** | Fast | High | Excellent | Residential IP, good for rate-limited videos |
| **YouTubei.js Enhanced** | Medium | Medium | Good | Handles Japanese language selection |
| **YouTubei.js Standard** | Medium | Medium | Variable | Basic transcript fetch |
| **Supa API** | Slow | High | Good | Paid API, last resort |

## Caching Strategy

1. **All successful fetches are cached** to Firebase (`transcriptCache` collection)
2. **Cache is checked first** on every request
3. **Cache write is async** - doesn't block the response
4. **Cache structure:**
   ```typescript
   {
     contentId: 'youtube_{videoId}',
     contentType: 'youtube',
     transcript: TranscriptLine[],
     language: string,
     videoUrl: string,
     videoTitle: string,
     metadata: { youtubeVideoId: string }
   }
   ```

## Related Collections

| Collection | Purpose |
|------------|---------|
| `transcriptCache` | Stores cached transcripts |
| `youtube_word_explanations` | Pre-computed word explanations for transcripts |

## Testing Scripts

```bash
# Check transcript for a video
node scripts/check-youtube-transcript.js {videoId}

# Delete transcript and word explanations
node scripts/delete-youtube-transcript.js {videoId}

# Test all transcript providers
npx tsx scripts/test-transcript-services.ts
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Video ID is required` | Missing videoId parameter | Provide valid YouTube video ID |
| `No transcript available` | All providers failed | Video may not have Japanese captions |
| `All transcript fetch methods failed` | All 6 steps failed | Check provider status/API keys |

## Supported Video Types

| Type | Example URL | Support |
|------|-------------|---------|
| Regular Video | `youtube.com/watch?v=xxx` | ✅ Full |
| YouTube Short | `youtube.com/shorts/xxx` | ✅ Full |
| YouTube Music | `music.youtube.com/watch?v=xxx` | ✅ Full |
| Live Stream | `youtube.com/watch?v=xxx` (live) | ❌ No captions |

## API Response Examples

### Success Response
```json
{
  "available": true,
  "videoId": "ewHktqEnxTQ",
  "title": "日本語会話練習",
  "segments": [
    {
      "start": 0.5,
      "end": 3.2,
      "duration": 2.7,
      "startTime": 0.5,
      "endTime": 3.2,
      "text": "みなさん、こんにちは",
      "words": ["みなさん", "こんにちは"]
    }
  ],
  "language": "Japanese",
  "source": "railway-server",
  "totalSegments": 263,
  "totalDuration": 1245.5
}
```

### Error Response
```json
{
  "available": false,
  "videoId": "xxx",
  "message": "No transcript available for this video.",
  "error": "All transcript fetch methods failed"
}
```

---

**Last Updated:** 2026-01-23
**File:** `src/app/api/youtube/transcript/[videoId]/route.ts`
