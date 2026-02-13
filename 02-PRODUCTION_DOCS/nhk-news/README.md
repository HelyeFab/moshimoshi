# NHK News Scraping System

**Status:** ACTIVE
**Last Updated:** 2026-02-12

## Overview

The NHK News feature provides Japanese learners with real NHK Easy News articles enhanced with audio narration, translations, word explanations, and furigana. It is a fully automated pipeline that scrapes articles from NHK Easy News, pre-generates learning assets (TTS audio, translations, vocabulary), and serves them through a cache-first offline-capable reader UI.

The system spans **4 layers across 3 codebases**:
1. **Kotlin NHK Scraper** (Railway) - Scrapes NHK, stores in MySQL
2. **Python Auth Proxy** (Railway) - Adds API key authentication
3. **Firebase Cloud Functions** - Orchestrates scraping + asset pre-caching
4. **Next.js Frontend** - Reader UI with offline support

---

## Quick Start

### Trigger a Manual Scrape
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"data":{"source":"nhk-easy","adminKey":"news-scraper-admin-2025"}}' \
  "https://us-central1-moshimoshi-de237.cloudfunctions.net/manualNewsScraperFunction"
```

### Check Railway Services
```bash
cd /home/beano/Dev/python/modal-services/nhk-api-railway
railway link -p terrific-communication
railway service status --all
```

### Check Railway Logs
```bash
railway logs --service MySQL
railway logs --service nhk-easy-api
railway logs --service nhk-easy-task
railway logs --service nhk-api-proxy
```

### Test the Full Chain
```bash
# 1. Check proxy health (no auth needed)
curl "https://nhk-api-proxy-production.up.railway.app/health"

# 2. Test news endpoint (will return 401 without key - confirms proxy is alive)
curl "https://nhk-api-proxy-production.up.railway.app/news?startDate=2026-01-01T00:00:00.000Z&endDate=2026-01-02T23:59:59.000Z"

# 3. Restart services if needed
railway restart --service MySQL --yes
railway restart --service nhk-easy-api --yes
```

---

## Architecture

### System Diagram

```
NHK Easy News (nhk.or.jp)
         |
         | Scrapes top-list.json (hourly cron)
         v
+--[ Railway Project: "terrific-communication" ]-------------------+
|                                                                   |
|  nhk-easy-task (Kotlin Spring Boot)                              |
|  Docker: xiaodanmao/nhk-easy-task:v1.4.0                        |
|  Schedule: 0 * * * * (hourly)                                   |
|  Fetches from NHK, deduplicates, stores in MySQL                |
|         |                                                        |
|         v                                                        |
|  MySQL 9.4.0                                                     |
|  Host: mysql.railway.internal:3306                               |
|  Public: shortline.proxy.rlwy.net:46705                         |
|  Database: railway                                               |
|  Tables: news, news_images, sentences, words                    |
|  Volume: mysql-volume (173MB / 500MB used)                      |
|         ^                                                        |
|         | Reads articles via JPA                                 |
|         |                                                        |
|  nhk-easy-api (Kotlin Spring Boot)                              |
|  Docker: xiaodanmao/nhk-easy-api:latest                         |
|  Internal: nhk-easy-api.railway.internal:8080                    |
|  Endpoints: GET /news, GET /actuator/health                     |
|  NO public domain (internal only)                                |
|         ^                                                        |
|         | Proxied via internal Railway network                    |
|         |                                                        |
|  nhk-api-proxy (Python FastAPI)                                  |
|  Source: modal-services/nhk-api-railway/main.py                 |
|  Public: https://nhk-api-proxy-production.up.railway.app        |
|  Auth: X-API-Key header (NHK_API_KEY env var)                   |
|  Endpoints: GET /news, GET /health, GET /                       |
|  Timeout: 30s (httpx)                                           |
+------------------------------------------------------------------+
         |
         | HTTPS + X-API-Key (= MODAL_API_KEY Firebase secret)
         v
+--[ Firebase Cloud Functions ]-------------------------------------+
|                                                                    |
|  scheduledNewsScraperFunction                                      |
|  Schedule: 0 12 * * * Asia/Tokyo (daily 12:00 JST = 03:00 UTC)  |
|  Memory: 2GiB | Timeout: 540s | Retries: 2                       |
|  Secrets: MODAL_API_KEY, OPENAI_API_KEY, RESEND_API_KEY          |
|         |                                                         |
|         v                                                         |
|  scrapeNHKEasy() --> safeFetch(Railway proxy, 30s timeout)       |
|         |                                                         |
|         v                                                         |
|  Validate + Deduplicate + Store in Firestore                     |
|         |                                                         |
|         v                                                         |
|  Pre-Caching Pipeline (runs inline):                             |
|  1. Audio: VOICEVOX TTS via Modal (title, summary, content)     |
|  2. Translations: Qwen 2.5 32B via Modal Ollama                 |
|  3. Word Explanations: Kuromoji + Qwen 2.5 32B                  |
|  4. Sentence Audio/Translation: VOICEVOX + Qwen                 |
|         |                                                         |
|         v                                                         |
|  Log to scraping_logs | Alert on failure via Resend email        |
+-------------------------------------------------------------------+
         |
         | Firestore reads via API routes
         v
+--[ Next.js Frontend (Vercel) ]------------------------------------+
|                                                                    |
|  API Routes:                                                       |
|    GET  /api/news/articles          - Paginated list               |
|    GET  /api/news/article/[id]      - Single article               |
|    POST /api/news/scrape            - Manual scrape trigger        |
|    POST /api/news/progress/complete - Mark complete + XP           |
|    GET  /api/news/status            - Scraping health              |
|                                                                    |
|  Pages:                                                            |
|    /[locale]/news        - Article list with filters               |
|    /[locale]/news/[id]   - Enhanced reader                        |
|                                                                    |
|  Client Features:                                                  |
|    - IndexedDB cache (50 articles, 7-day TTL)                     |
|    - Offline prefetch (2 articles)                                |
|    - Audio player (NHK native m3u8 or TTS fallback)              |
|    - Furigana toggle                                              |
|    - Word hover explanations                                      |
|    - Translation pane                                             |
|    - Reading progress tracking with idle detection                |
|    - XP rewards on completion                                     |
|    - Entitlements enforcement (daily limits)                      |
+-------------------------------------------------------------------+
```

---

## Firestore Collections

### news_articles
**Primary collection for all scraped articles.**

```typescript
{
  id: string                        // MD5 hash of article URL
  title: string                     // Plain text title
  titleWithFurigana?: string        // HTML with <ruby> tags
  content: string                   // Plain text body
  contentWithFurigana?: string      // HTML with grammar color coding
  summary: string                   // Plain text summary
  summaryWithFurigana?: string      // HTML with <ruby> tags
  url: string                       // Original NHK article URL
  imageUrl?: string                 // Article image URL
  publishDate: Timestamp            // Original publish date
  source: string                    // 'NHK Easy'
  sourceId?: string                 // Original NHK news ID
  category: string                  // 'news'
  difficulty: string                // 'N5' for NHK Easy
  tags?: string[]                   // ['nhk', 'easy', 'news', 'beginner']

  // NHK Official Audio
  nhkAudioUrl?: string              // m3u8 stream URL from NHK

  // TTS-Generated Audio (VOICEVOX)
  generatedTitleAudioUrl?: string
  generatedSummaryAudioUrl?: string
  generatedContentAudioUrl?: string
  audioGeneratedAt?: Timestamp
  audioProvider?: 'edge-tts' | 'voicevox'
  audioVoice?: string               // e.g., '23'
  audioStatus?: 'pending' | 'generated' | 'failed' | 'partial'
  audioError?: string

  // Metadata
  metadata?: {
    wordCount?: number
    readingTime?: number
    hasFurigana?: boolean
  }

  createdAt: Timestamp              // Server timestamp
  lastUpdated: Timestamp            // Server timestamp
}
```

### news_article_translations
**Pre-generated translations per article. Document ID = article ID.**

```typescript
{
  articleId: string
  title: TranslationSegment
  summary: TranslationSegment
  content: TranslationSegment
  sentences?: TranslationSegment[]
  generatedAt: Timestamp
  costInfo: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    estimatedCost: number
  }
}
```

### news_article_word_explanations
**Word-level explanations per article. Document ID = article ID.**

Each word includes: reading (yomi), romaji, meaning, part of speech, kanji breakdown (with kun/on readings), conjugation forms (for verbs/adjectives).

### news_progress
**Per-user reading progress. Document ID = `{userId}_{articleId}`.**

```typescript
{
  userId: string
  articleId: string
  difficulty: string
  firstReadAt: string               // ISO 8601
  lastReadAt: string                // ISO 8601
  totalReadTimeMs: number
  completed: boolean
  xpEarned: number
}
```

### scraping_logs
**Audit log for every scraping run.**

```typescript
{
  type: 'scheduled' | 'manual'
  totalArticles: number
  successfulSources: number
  failedSources: number
  duration: number                  // milliseconds
  timestamp: string                 // ISO 8601
  sources: {
    [sourceName]: {
      success: boolean
      articles: number
      duration: number
      error?: string
    }
  }
  createdAt: Timestamp
}
```

### scraping_progress
**Real-time progress tracking for manual scrapes (UI polling).**

```typescript
{
  stage: 'initializing' | 'scraping' | 'audio' | 'translation' | 'words' | 'complete'
  substage?: string
  details: string
  percentage: number                // 0-100
  status: 'running' | 'complete' | 'error'
  startedAt?: Timestamp
  updatedAt: Timestamp
  completedAt?: Timestamp
  error?: string
}
```

### wordExplanationCache
**Global word explanation cache to avoid regenerating known words.**
Document ID = SHA256 hash of word (lowercase, trimmed).

---

## Railway Infrastructure

### Project: terrific-communication

| Service | Type | Status | Internal URL | Public URL |
|---------|------|--------|-------------|------------|
| MySQL | Database | Must be running | mysql.railway.internal:3306 | shortline.proxy.rlwy.net:46705 |
| nhk-easy-api | Kotlin Spring Boot | Must be running | nhk-easy-api.railway.internal:8080 | None (internal only) |
| nhk-easy-task | Kotlin Spring Boot | Batch job (starts, runs, exits) | N/A | N/A |
| nhk-api-proxy | Python FastAPI | Must be running | N/A | nhk-api-proxy-production.up.railway.app |

### MySQL Configuration
- **Version**: 9.4.0
- **Memory**: 8 GB limit
- **Start command**: `docker-entrypoint.sh mysqld --innodb-use-native-aio=0 --disable-log-bin --performance_schema=0 --innodb-buffer-pool-size=1G`
- **Volume**: mysql-volume mounted at /var/lib/mysql (500MB)
- **Restart Policy**: Always (changed 2026-02-12, was previously "On Failure")
- **Credentials**: root / MKCixlltjXujzRRSdwqtVQqLfLOHFOMk

### MySQL Schema (Hibernate auto-created)
```
Tables:
  news           - Main articles (news_id, title, title_with_ruby, outline,
                   outline_with_ruby, url, body, body_without_html,
                   image_url, m3u8url, published_at_utc)
  news_images    - Article images
  sentences      - Article sentences with furigana
  words          - Vocabulary words
```

### nhk-easy-task (Kotlin Scraper)
- **Docker**: xiaodanmao/nhk-easy-task:v1.4.0
- **Schedule**: Hourly cron (0 * * * *)
- **Behavior**: Fetches NHK's `top-list.json` (~20 articles), deduplicates by news_id, inserts new articles into MySQL, then exits (exit code 0)
- **Typical output**: "Successfully fetched 20 articles from NHK... Saving 4 new articles"

### nhk-easy-api (Kotlin REST API)
- **Docker**: xiaodanmao/nhk-easy-api:latest
- **Port**: 8080 (internal only)
- **Endpoints**:
  - `GET /news?startDate=ISO&endDate=ISO` - Returns JSON array of articles
  - `GET /actuator/health` - Health check
- **Cold start**: ~16 seconds (JVM + Spring Boot + Hibernate + MySQL connection pool)
- **Connection pool**: HikariCP with 30s connection timeout

### nhk-api-proxy (Python Auth Proxy)
- **Source**: `/home/beano/Dev/python/modal-services/nhk-api-railway/main.py`
- **Framework**: FastAPI + httpx + uvicorn
- **Auth**: X-API-Key header validated against NHK_API_KEY env var
- **Upstream**: Proxies to `http://nhk-easy-api.railway.internal:8080`
- **Timeout**: 30s (httpx.AsyncClient)
- **Deploy**: `railway.json` with Nixpacks builder
- **Dependencies**: fastapi==0.115.6, uvicorn[standard]==0.32.1, httpx==0.28.1

### Railway Environment Variables
```bash
# nhk-api-proxy
NHK_API_KEY=<same as MODAL_API_KEY in Firebase>
UPSTREAM_URL=http://nhk-easy-api.railway.internal:8080

# nhk-easy-api + nhk-easy-task
SPRING_DATASOURCE_URL=jdbc:mysql://mysql.railway.internal:3306/railway?useSSL=false&allowPublicKeyRetrieval=true
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=MKCixlltjXujzRRSdwqtVQqLfLOHFOMk
SPRING_JPA_HIBERNATE_DDL_AUTO=update
```

---

## External Services

| Service | URL | Auth | Purpose |
|---------|-----|------|---------|
| Railway NHK Proxy | nhk-api-proxy-production.up.railway.app | X-API-Key header | Article data source |
| VOICEVOX TTS (Modal) | emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech | X-API-Key header | Japanese TTS audio generation |
| Qwen 2.5 32B (Modal) | emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run/v1/chat/completions | X-API-Key header | Translations + word explanations |
| Edge-TTS | tts.selfmind.dev/speak | None | TTS fallback provider |
| Resend | api.resend.com/emails | Bearer token | Failure alert emails |
| Firebase Storage | moshimoshi-de237.firebasestorage.app | Firebase Admin SDK | Audio file hosting |

### Firebase Secrets
```
MODAL_API_KEY    - Used for: Railway proxy, VOICEVOX TTS, Qwen LLM
OPENAI_API_KEY   - Used for: Additional AI processing
RESEND_API_KEY   - Used for: Failure alert emails
```

---

## Scheduling

### Firebase Functions
| Function | Schedule | Purpose |
|----------|----------|---------|
| `scheduledNewsScraperFunction` | `0 12 * * *` Asia/Tokyo (03:00 UTC) | Daily scrape + pre-caching |
| `scheduledArticleAudioGenerator` | 00:30, 06:30, 12:30, 18:30 JST | Catch-up audio generation for articles missing audio |

### Railway
| Service | Schedule | Purpose |
|---------|----------|---------|
| `nhk-easy-task` | `0 * * * *` (hourly) | Scrape NHK top articles into MySQL |

### Timing Flow
```
Every hour:    nhk-easy-task scrapes NHK → MySQL (Railway keeps DB fresh)
Daily 12:00 JST: Firebase pulls from Railway → Firestore → Pre-caches assets
Daily 12:30 JST: Audio generator catches any missed articles
```

---

## Pre-Caching Pipeline

When a new article is scraped, 4 stages run inline within the Firebase function:

### Stage 1: Audio Generation
- **File**: `functions/src/utils/newsAudioGenerator.ts`
- **Provider**: VOICEVOX TTS via Modal (Speaker ID 23, energetic female, 0.85x speed)
- **Fallback**: Edge-TTS
- **Generates**: Title audio, summary audio, content audio
- **Storage**: Firebase Storage at `news-audio/{source}/{articleId}/{audioType}.mp3`
- **Updates**: Audio URL fields on the `news_articles` document

### Stage 2: Translation Generation
- **File**: `functions/src/utils/translationPreGenerator.ts`
- **Provider**: Qwen 2.5 32B via Modal Ollama (5-minute timeout)
- **Generates**: Title, summary, content, and sentence-level translations
- **Storage**: `news_article_translations` collection

### Stage 3: Word Extraction & Explanation
- **Files**: `functions/src/utils/wordExtractor.ts`, `functions/src/utils/wordExplanationPreGenerator.ts`
- **Extraction**: Kuromoji morphological analysis, top 100 words per article
- **Explanation**: Qwen 2.5 32B generates reading, meaning, kanji breakdown, conjugations
- **Storage**: `news_article_word_explanations` collection
- **Cache**: Words cached in `wordExplanationCache` collection (SHA256 keyed)

### Stage 4: Sentence Pre-Generation
- **File**: `functions/src/utils/sentencePreGenerator.ts`
- **Splits**: Article by Japanese period (。)
- **Generates**: Per-sentence VOICEVOX audio + Qwen translation with grammar notes
- **Storage**: Firestore with sentence index and audio URL

---

## Article Validation

**File**: `functions/src/utils/articleValidation.ts`

| Function | Line | Purpose |
|----------|------|---------|
| `isLikelyJapanese()` | 27 | Checks >30% Japanese characters + has hiragana |
| `quickValidate()` | 64 | Content length (min 50 chars), Japanese ratio, error patterns, quality score |
| `checkDuplicates()` | 193 | Fingerprint-based dedup (title + first 200 chars) |
| `estimateDifficulty()` | 215 | JLPT level based on kanji density |
| `estimateReadingTime()` | (nearby) | Reading time based on character count and difficulty |
| `extractKeyVocabulary()` | (nearby) | Top 10 words using kanji+kana patterns |

---

## Scraping Utilities

**File**: `functions/src/utils/scraper-utils.ts`

| Utility | Line | Purpose |
|---------|------|---------|
| `RateLimiter` | 16 | 1.5-2 second randomized delays between requests |
| `RobotsTxtChecker` | 57 | Validates against robots.txt, caches 24 hours |
| `RetryHandler` | 184 | Exponential backoff retry (1s, 2s, 4s...) |
| `safeFetch()` | 239 | Fetch with AbortController timeout (default 30s), proper User-Agent |
| `removePhotoCaptions()` | (nearby) | Removes photo credits from Japanese text |

---

## Error Handling & Monitoring

### Alert System
- **File**: `functions/src/utils/alertNotifier.ts:137` - `sendScraperFailureAlert()`
- **Trigger**: When ALL scrapers fail in a scheduled run
- **Method**: Resend email API
- **Recipients**: emmanuelfabiani23@gmail.com, mail.moshimoshi.app@gmail.com
- **Severity levels**: critical, warning, info

### Failure Cascade (What Happens When Things Break)
```
1. All scrapers fail → Email alert sent to admins
2. API timeouts      → Logged, doesn't fail entire job
3. Audio gen fails   → Continues with translations
4. Translations fail → Continues with word extraction
5. Partial cache     → Logged as "partial" status
```

### Retry Logic
- Firebase Function: 2 retries on failure (Firebase managed)
- safeFetch: AbortController timeout (30s default)
- RetryHandler: Exponential backoff for individual operations
- Audio generation: Skips existing, retries missing (via scheduledArticleAudioGenerator)

---

## Timeout Chain (Critical for Debugging)

When a request flows through the system, these timeouts apply:

| Layer | Timeout | What Happens on Timeout |
|-------|---------|------------------------|
| Firebase Function | 540s (9 min) | Function fails, retry up to 2x |
| `safeFetch()` in nhkEasyScraper | **30s** | AbortController fires: "The user aborted a request." |
| Python proxy httpx | **30s** | Returns 504 Gateway Timeout |
| HikariCP (Kotlin → MySQL) | **30s** | CJCommunicationsException |
| Kotlin Spring Boot cold start | ~16s | Not a timeout, but eats into the 30s budget |

**IMPORTANT**: The safeFetch 30s timeout and the proxy httpx 30s timeout are identical, creating a race condition. If the Kotlin API is slow (cold start + MySQL query), both can fire simultaneously.

---

## Known Issues & Production Incidents

### 2026-02-12: MySQL SIGTERM Shutdown
**Symptom**: "All news scrapers failed!" alert. Error: "The user aborted a request."
**Root Cause**: Railway sent SIGTERM to MySQL container (Feb 11, 14:45 UTC). MySQL exited cleanly (code 0). Restart policy was "On Failure" so it did not restart. The Kotlin API could not connect to MySQL, HikariCP waited 30s, safeFetch timed out.
**Fix**: Restarted MySQL and nhk-easy-api via Railway CLI. Changed restart policy from "On Failure" to "Always".
**Prevention**: Monitor Railway MySQL status. Consider adding a health check endpoint or uptime monitor.

### Kotlin API Sentry DSN Warning
**Symptom**: `Caused by: java.net.URISyntaxException: Illegal character in path at index 1: ${SENTRY_DSN}`
**Cause**: SENTRY_DSN environment variable not set on nhk-easy-api service.
**Impact**: Non-fatal warning. Application starts and runs normally.

---

## Frontend Integration

### API Routes

| Route | Method | File | Line | Purpose |
|-------|--------|------|------|---------|
| `/api/news/articles` | GET | `src/app/api/news/articles/route.ts` | 9 | Paginated list with source/difficulty/category filters |
| `/api/news/article/[id]` | GET | `src/app/api/news/article/[id]/route.ts` | 15 | Single article with usage tracking |
| `/api/news/scrape` | GET | `src/app/api/news/scrape/route.ts` | 11 | Manual scrape trigger (30min in-memory cache) |
| `/api/news/progress/complete` | POST | `src/app/api/news/progress/complete/route.ts` | 17 | Mark article complete, award XP |
| `/api/news/status` | GET | (nearby) | | Scraping health status |
| `/api/news/delete-all` | DELETE | (nearby) | | Admin: delete all articles |
| `/api/admin/news/trigger-scraping` | POST | `src/app/api/admin/news/trigger-scraping/route.ts` | | Admin scraping trigger |
| `/api/test-scraper` | GET | `src/app/api/test-scraper/route.ts` | 27 | Test endpoint (?action=trigger or ?action=check) |

### React Hooks

| Hook | File | Line | Purpose |
|------|------|------|---------|
| `useArticleCache` | `src/hooks/useArticleCache.ts` | 42 | IndexedDB cache-first article fetching (max 50 articles, 7-day TTL) |
| `useNewsProgress` | `src/hooks/useNewsProgress.ts` | 42 | Reading session tracking with visibility/idle detection (60s pause) |
| `useCachedArticle` | (nearby) | | Wrapper around useArticleCache for single articles |
| `useFeatureUsage` | (nearby) | | Entitlements check for daily reading limits |

### Pages

| Page | File | Line | Purpose |
|------|------|------|---------|
| News List | `src/app/[locale]/news/page.tsx` | 318 | Article grid with month/day filters, difficulty badges, offline prefetch |
| Article Reader | `src/app/[locale]/news/[id]/page.tsx` | 13 | Enhanced reader with audio, furigana, translations, word help |

### Key Components
- `EnhancedArticleReaderFinal` - `src/components/news/EnhancedArticleReaderFinal.tsx` - Main reader component
- `ArticleImageWithFallback` - Image handling with category-specific fallbacks
- `TranslationAssistance` - In-article translation UI
- `CompactSettingsToolbar` - Reader settings (font size, furigana toggle, etc.)

### Types
```typescript
// src/services/newsService.ts
export type NewsSource = 'all' | 'nhk-easy' | 'watanoc' | 'mainichi-news' | 'mainichi-shogakusei'  // Line 6
export type DifficultyLevel = 'all' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1'                             // Line 7
export type NewsCategory = 'all' | 'news' | 'culture' | 'science' | 'sports' | ...                   // Line 8
export interface NewsArticle { id, title, content, summary, url, ... }                                // Line 10

// src/lib/news/article-cache.types.ts
export interface CachedArticle extends NewsArticle { /* + audio URLs */ }                              // Line 6
```

### i18n
News-related translation keys are in `src/i18n/locales/{locale}/strings.ts` under the `news` and `newsScraping` namespaces. Supported in all 6 languages (EN, JA, DE, ES, FR, IT).

---

## Python Services (modal-services)

### Repository: /home/beano/Dev/python/modal-services

#### nhk-api-railway/ (Auth Proxy - ACTIVE)
| File | Purpose |
|------|---------|
| `main.py` | FastAPI proxy with API key auth (102 lines) |
| `requirements.txt` | fastapi, uvicorn, httpx |
| `railway.json` | Nixpacks builder config |
| `Procfile` | `web: uvicorn main:app --host 0.0.0.0 --port $PORT` |
| `README.md` | Deployment guide |

#### nhk-scraper/ (Utilities & History)
| File | Purpose |
|------|---------|
| `backfill_articles.py` | Python script to backfill MySQL with historical NHK articles (347 lines) |
| `docker-compose.yml` | Local dev setup for nhk-easy-api + nhk-easy-task |
| `DEPLOYMENT_HISTORY.md` | Comprehensive migration log from homeserver to Railway (1,582 lines) |
| `RAILWAY_DEPLOY.md` | Step-by-step Railway deployment guide |
| `SETUP.md` | Quick setup guide |
| `deploy_nhk_fullstack.py` | Failed Modal attempt (Java containers not supported) |
| `deploy_nhk.py` | Failed Modal attempt (NHK requires OAuth) |
| `deploy_nhk_simple.py` | Failed Modal attempt (HTTP 401) |
| `deploy_nhk_springboot.py` | Failed Modal attempt (Python runtime required) |

#### Related Modal Services (Used by Pre-Caching Pipeline)
| Directory | Purpose |
|-----------|---------|
| `voicevox-tts/` | VOICEVOX TTS deployment on Modal (used for article audio) |
| `ollama-llm/` | Qwen 2.5 32B deployment on Modal (used for translations/explanations) |
| `whisper-transcribe/` | Whisper transcription (not directly used by news) |
| `transcript-service/` | Transcript service on Railway (not directly used by news) |

---

## Archived Scrapers

Located in `functions/src/scrapers/archived/`:
- **mainichi-news.ts** - Mainichi newspaper HTML scraping (disabled)
- **mainichi-shogakusei.ts** - Mainichi elementary news (disabled)
- **watanoc.ts** - Watanoc Japanese news (disabled)

Also: `functions/src/scrapers/todaii.ts` - Todaii news (different approach, disabled)

Currently only NHK Easy is active (defined in `newsScheduler.ts:24` NEWS_SOURCES array).

---

## Key Files Reference

### Firebase Functions (functions/src/)

| File | Key Functions | Lines |
|------|--------------|-------|
| `scheduled/newsScheduler.ts` | `scheduledNewsScraper()`, `manualNewsScraper()`, `triggerScraper()`, `saveArticlesToFirestore()`, `runPreCachingPipeline()` | 173, 657, 94, 34, 488 |
| `scheduled/newsScheduler.ts` | `scheduledNewsScraperFunction` (export), `manualNewsScraperFunction` (export) | 1035, 1053 |
| `scheduled/articleAudioGenerator.ts` | `scheduledArticleAudioGenerator` (export), `findArticlesMissingAudio()` | 274, 64 |
| `scrapers/nhkEasyScraper.ts` | `scrapeNHKEasy()`, `generateArticleId()`, Railway API URL, `NHKAPIArticle` interface | 74, 61, 112, 139 |
| `utils/newsAudioGenerator.ts` | `generateBatchAudio()`, `uploadToFirebaseStorage()`, VOICEVOX URL, Edge-TTS URL | 342, 241, 12, 14 |
| `utils/translationPreGenerator.ts` | `generateBatchTranslations()`, Qwen config | 377, 20 |
| `utils/wordExplanationPreGenerator.ts` | `generateBatchWordExplanations()` | 513 |
| `utils/wordExtractor.ts` | `extractTopWords()` | 233 |
| `utils/sentencePreGenerator.ts` | `preGenerateArticleSentences()` | 578 |
| `utils/articleValidation.ts` | `quickValidate()`, `isLikelyJapanese()`, `checkDuplicates()`, `estimateDifficulty()` | 64, 27, 193, 215 |
| `utils/scraper-utils.ts` | `safeFetch()`, `RateLimiter`, `RobotsTxtChecker`, `RetryHandler` | 239, 16, 57, 184 |
| `utils/alertNotifier.ts` | `sendScraperFailureAlert()` | 137 |

### Next.js Frontend (src/)

| File | Key Exports | Lines |
|------|-------------|-------|
| `services/newsService.ts` | `NewsArticle`, `NewsSource`, `DifficultyLevel` | 10, 6, 7 |
| `lib/news/article-cache.types.ts` | `CachedArticle` | 6 |
| `hooks/useArticleCache.ts` | `useArticleCache()` | 42 |
| `hooks/useNewsProgress.ts` | `useNewsProgress()` | 42 |
| `app/[locale]/news/page.tsx` | `NewsPage` (default export) | 318 |
| `app/[locale]/news/[id]/page.tsx` | `NewsArticlePage` (default export) | 13 |
| `app/api/news/articles/route.ts` | `GET()` | 9 |
| `app/api/news/article/[id]/route.ts` | `GET()` | 15 |
| `app/api/news/scrape/route.ts` | `GET()` | 11 |
| `app/api/news/progress/complete/route.ts` | `POST()` | 17 |
| `app/api/test-scraper/route.ts` | `GET()` | 27 |

### Python (modal-services/)

| File | Purpose |
|------|---------|
| `nhk-api-railway/main.py` | FastAPI auth proxy |
| `nhk-scraper/backfill_articles.py` | MySQL backfill script |
| `nhk-scraper/docker-compose.yml` | Local dev compose |
| `nhk-scraper/DEPLOYMENT_HISTORY.md` | Full migration history |

---

## Backfill Script

For populating MySQL with historical articles (beyond the daily scraper's reach):

```bash
cd /home/beano/Dev/python/modal-services/nhk-scraper

# Install dependencies
pip install pymysql requests beautifulsoup4

# Backfill specific date range
python backfill_articles.py --start-date 2025-10-01 --end-date 2025-11-26

# Dry run
python backfill_articles.py --start-date 2025-10-01 --end-date 2025-11-26 --dry-run
```

**Note**: Connects to Railway MySQL via public proxy (`shortline.proxy.rlwy.net:46705`). NHK's `news-list.json` contains ~243 dates of historical articles going back ~8 months.

---

## Troubleshooting

### "The user aborted a request." Error
**Cause**: `safeFetch()` 30-second AbortController timeout fired.
**Check**:
1. `railway service status --all` - Is MySQL running?
2. `railway logs --service MySQL` - Any shutdown signals?
3. `railway logs --service nhk-easy-api` - HikariCP connection errors?
4. `curl https://nhk-api-proxy-production.up.railway.app/health` - Is proxy alive?
**Fix**: `railway restart --service MySQL --yes && railway restart --service nhk-easy-api --yes`

### No New Articles Appearing
**Check**:
1. Verify scheduled function ran: Check `scraping_logs` collection in Firestore
2. Check Railway: `railway logs --service nhk-easy-task` - Did the Kotlin scraper run?
3. Check NHK: Are there new articles on https://www.nhk.or.jp/news/easy/ ?
4. Manual trigger: Use curl command from Quick Start section above

### Audio Not Generated
**Check**:
1. VOICEVOX Modal endpoint: `curl https://emmanuelfabiani23--voicevox-tts-serve.modal.run/health`
2. Check `audioStatus` field on article in Firestore
3. Wait for `scheduledArticleAudioGenerator` (runs 4x daily at :30)
4. Check Firebase Function logs for audio generation errors

### Translations Missing
**Check**:
1. Qwen Modal endpoint health
2. Check `news_article_translations` collection for the article ID
3. Check Firebase Function logs for translation errors
4. Verify MODAL_API_KEY secret is set correctly

### MySQL Keeps Stopping on Railway
**Check**:
1. `railway logs --service MySQL` - Look for `Received SHUTDOWN from user <via user signal>`
2. Verify restart policy is "Always" (not "On Failure")
3. Check Railway Usage tab for resource spikes
4. Check volume usage: `railway volume list` (500MB limit)
5. Consider if Railway is performing infrastructure maintenance

### Railway CLI Setup
```bash
railway whoami                          # Check auth
railway list                            # List projects
railway link -p terrific-communication  # Link to project
railway service status --all            # Check all services
railway logs --service <name>           # View logs
railway restart --service <name> --yes  # Restart service
railway volume list                     # Check disk usage
```

---

## NHK API Article Schema (from Railway)

The Kotlin API returns articles in this format:

```json
{
  "newsId": "ne2025120311491",
  "title": "たくさんの雪や強い風に気をつけて",
  "titleWithRuby": "<ruby>...",
  "outline": "Summary text",
  "outlineWithRuby": "<ruby>...",
  "body": "Full HTML with color-coded word types",
  "bodyWithoutHtml": "Plain text",
  "url": "https://news.web.nhk/news/easy/ne2025120311491/ne2025120311491.html",
  "m3u8Url": "https://vod-stream.nhk.jp/news/easy_audio/.../index.m3u8",
  "imageUrl": "https://...",
  "publishedAtUtc": "2025-12-03T10:30:00Z"
}
```

### Field Mapping (Railway → Firestore)

| Railway API Field | Firestore Field | Notes |
|-------------------|-----------------|-------|
| `title` | `title` | Plain text |
| `titleWithRuby` | `titleWithFurigana` | HTML with `<ruby>` tags |
| `bodyWithoutHtml` | `content` | Plain text |
| `body` | `contentWithFurigana` | HTML with grammar color coding |
| `outline` | `summary` | Plain text |
| `outlineWithRuby` | `summaryWithFurigana` | HTML with `<ruby>` tags |
| `m3u8Url` | `nhkAudioUrl` | NHK official narrator audio |
| `imageUrl` | `imageUrl` | Article image |
| `publishedAtUtc` | `publishDate` | Converted to Firestore Timestamp |
| `url` | `url` | Original NHK URL |
| MD5(url) | `id` | Generated article ID |

---

## Performance Characteristics

| Operation | Target | Actual |
|-----------|--------|--------|
| Full scrape + pre-cache (1 article) | <5 min | ~4.5s scrape + ~280s pre-cache |
| Railway proxy response | <1s | ~0.5s |
| Kotlin API cold start | <30s | ~16s |
| MySQL connection pool init | <5s | ~0.6s |
| VOICEVOX audio generation | <60s/article | Varies |
| Qwen translation | <120s/article | Varies |
| IndexedDB article cache lookup | <10ms | <5ms |
| API article list fetch | <2s | ~1s |

---

*Document Version: 1.0*
*Created: 2026-02-12*
*Maintained By: Claude + Emmanuel Fabiani*
