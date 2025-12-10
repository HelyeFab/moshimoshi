# Scraping Debug Context

**Date:** 2025-12-08
**Issue:** Firebase not receiving fresh NHK articles despite scheduled scraper running

---

## Architecture Overview

```
NHK Easy Website
      ↓
Railway NHK API Proxy (scrapes NHK, stores in MySQL)
      ↓
MySQL Database (Railway) ← stores raw articles
      ↓
Firebase Cloud Function (scheduledNewsScraperFunction)
      ↓
Firebase Firestore ← serves to app
```

## Key Endpoints & Credentials

- **Railway NHK API Proxy:** `https://nhk-api-proxy-production.up.railway.app/news`
- **API Key Header:** `X-API-Key: x0nYn3nNmNVA3mqlhz5ABSfSS7voYWxrBCHGzkJASEU`
- **MySQL:** `mysql://root:MKCixlltjXujzRRSdwqtVQqLfLOHFOMk@shortline.proxy.rlwy.net:46705/railway`

## The Problem We Found (2025-12-08)

### Symptoms
- Firebase had latest article from Dec 5th
- MySQL had articles from Dec 8th
- Scheduled scraper logs showed "success" but 0 articles every run

### Root Cause: Timing Misalignment

**NHK publishes articles around 10:30 UTC daily (19:30 JST)**

**OLD Railway cron:** `0 */8 * * *` (every 8 hours)
- Scraped at: 00:00, 08:00, 16:00 UTC
- The 08:00 UTC scrape was BEFORE NHK published
- The 16:00 UTC scrape was AFTER the Firebase 15:00 UTC run

**Firebase schedule:** `0 0,6,12,18 * * *` in Asia/Tokyo
- Runs at: 03:00, 09:00, 15:00, 21:00 UTC
- The 15:00 UTC run happened BEFORE Railway's 16:00 UTC scrape
- Result: Firebase got stale data with 0 new articles

### The Fixes Applied

**Fix 1: Railway cron timing**
**NEW Railway cron:** `0 2,8,14,20 * * *`

| Railway Scrape (UTC) | Firebase Run (UTC) | Buffer |
|---------------------|-------------------|--------|
| 02:00 | 03:00 | 1 hour |
| 08:00 | 09:00 | 1 hour |
| **14:00** | **15:00** | **1 hour - catches NHK's 10:30 UTC publish** |
| 20:00 | 21:00 | 1 hour |

**Fix 2: Increased ARTICLE_LIMIT from 1 to 10**
- File: `functions/src/scheduled/newsScheduler.ts`
- Lines 195 and 657: Changed `ARTICLE_LIMIT = 1` to `ARTICLE_LIMIT = 10`
- Reason: NHK publishes ~4 articles at once. With limit=1, it took 4 runs to get all articles.
- Now: All daily articles will be scraped in a single run.

**IMPORTANT:** Deploy the functions after this fix:
```bash
cd functions && npm run deploy
# OR
npx firebase deploy --only functions:scheduledNewsScraperFunction,functions:manualNewsScraperFunction --project=moshimoshi-de237
```

---

## Debugging Commands

### Check latest article in MySQL
```bash
node -e "
const mysql = require('mysql2/promise');
const MYSQL_URL = 'mysql://root:MKCixlltjXujzRRSdwqtVQqLfLOHFOMk@shortline.proxy.rlwy.net:46705/railway';

async function check() {
  const conn = await mysql.createConnection(MYSQL_URL);
  const [latest] = await conn.query('SELECT title, published_at_utc FROM news ORDER BY published_at_utc DESC LIMIT 1');
  console.log('MySQL Latest:', latest[0].title, '-', latest[0].published_at_utc);
  await conn.end();
}
check();
"
```

### Check latest article in Firebase (via API)
```bash
curl -s "https://moshimoshi.app/api/news/articles?limit=1" | node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const data = JSON.parse(Buffer.concat(chunks).toString());
  const a = data.articles[0];
  const pubDate = new Date(a.publishDate._seconds * 1000);
  console.log('Firebase Latest:', a.title, '-', pubDate.toISOString());
});
"
```

### Check NHK API Proxy directly
```bash
node -e "
const https = require('https');
const now = new Date();
const start = new Date(now.getTime() - 7*24*60*60*1000);
const url = 'https://nhk-api-proxy-production.up.railway.app/news?startDate=' + start.toISOString() + '&endDate=' + now.toISOString();
https.get(url, {headers: {'X-API-Key': 'x0nYn3nNmNVA3mqlhz5ABSfSS7voYWxrBCHGzkJASEU'}}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('API articles:', json.length);
    if (json.length > 0) console.log('Latest:', json[0].title, '-', json[0].publishedAtUtc);
  });
});
"
```

### Check scraping logs
```bash
curl -s "https://moshimoshi.app/api/admin/scraping-logs?limit=10" \
  -H "x-admin-key: news-scraper-admin-2025" | node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const data = JSON.parse(Buffer.concat(chunks).toString());
  data.logs.forEach(l => {
    console.log(l.type, l.createdAt, 'articles:', l.totalArticles, 'duration:', l.duration + 'ms');
  });
});
"
```

### Manually trigger scraper (for testing)
```bash
curl -s -X POST "https://us-central1-moshimoshi-de237.cloudfunctions.net/manualNewsScraperFunction" \
  -H "Content-Type: application/json" \
  -d '{"data":{"adminKey":"news-scraper-admin-2025","source":"nhk-easy","skipPreCache":true}}'
```

### Check Firebase Cloud Function logs
```bash
npx firebase functions:log --project=moshimoshi-de237 --only=scheduledNewsScraperFunction
```

---

## Key Files

- **Scheduler:** `functions/src/scheduled/newsScheduler.ts`
- **NHK Scraper:** `functions/src/scrapers/nhkEasyScraper.ts`
- **Scraper Utils:** `functions/src/utils/scraper-utils.ts`
- **Backfill Script:** `scripts/backfill-nhk-from-mysql.js`

---

## Important Observations

1. **NHK doesn't publish on weekends** - Dec 6 (Sat) and Dec 7 (Sun) had 0 articles

2. **Duration indicates API call success:**
   - ~500-600ms = API was called
   - <25ms = Function exited early (broken or no sources)

3. **Pre-cache check:** The scraper skips articles that already have:
   - `generatedContentAudioUrl` (audio)
   - Entry in `news_article_translations`
   - Entry in `news_article_word_explanations`

4. **Article ID generation:** `MD5(article.url)` - consistent between scraper runs

---

## If Problem Persists Tomorrow

1. Check if Railway cron actually updated (should scrape at 14:00 UTC)
2. Check scraping_logs for the 15:00 UTC Firebase run
3. Compare MySQL vs Firebase article counts for the day
4. Look at detailed function logs: `npx firebase functions:log --project=moshimoshi-de237 --only=scheduledNewsScraperFunction`
5. Verify the API proxy is returning articles: use the debugging commands above

---

## Contact/Resources

- Firebase Project: `moshimoshi-de237`
- Railway Project: Contains NHK API Proxy
- Schedule timezone: Firebase uses `Asia/Tokyo`, Railway uses UTC
