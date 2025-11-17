# News System Fix - Deployment Guide

## 🐛 Problems Fixed

### Critical Bug: Scrapers Not Saving Articles
**Issue**: Only NHK Easy articles were being saved. Watanoc, Mainichi News, Mainichi Elementary, and Todaii scrapers reported success but never saved articles to Firestore.

**Root Cause**:
- NHK Easy scraper saves articles internally (lines 184-226 in `nhkEasyScraper.ts`)
- All other scrapers returned articles to the scheduler
- Scheduler counted articles and threw them away without saving

**Fix**: Added `saveArticlesToFirestore()` function in `functions/src/scheduled/newsScheduler.ts` (lines 49-102) that saves all non-NHK articles after scraping.

### Missing Pagination
**Issue**: News page had no `newsService`, broken pagination, and couldn't load articles properly.

**Fixes**:
1. Created `/src/services/newsService.ts` - Full service with pagination support
2. Updated `/src/app/api/news/articles/route.ts` - Added offset, limit, totalCount, hasMore
3. Created `/src/components/news/NewsArticleFallbackImage.tsx` - Theme-aware gradient fallback

## 📋 Deployment Steps

### Step 1: Deploy Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

**What this does**: Creates composite indexes for:
- `source` + `publishDate`
- `difficulty` + `publishDate`
- `category` + `publishDate`
- `source` + `difficulty` + `publishDate`

### Step 2: Deploy Cloud Functions
```bash
firebase deploy --only functions:manualNewsScraperFunction,functions:scheduledNewsScraperFunction
```

**What this deploys**:
- `manualNewsScraperFunction` - Now respects source parameter and saves all articles
- `scheduledNewsScraperFunction` - Daily 6 AM JST scraper with article saving

### Step 3: Trigger Manual Scrape (Populate Database)

Run these commands to populate all sources:

```bash
# Watanoc
curl -X POST https://moshimoshi.vercel.app/api/news/scrape \
  -H "Content-Type: application/json" \
  -d '{"source": "watanoc"}'

# Mainichi News
curl -X POST https://moshimoshi.vercel.app/api/news/scrape \
  -H "Content-Type: application/json" \
  -d '{"source": "mainichi-news"}'

# Mainichi Elementary
curl -X POST https://moshimoshi.vercel.app/api/news/scrape \
  -H "Content-Type: application/json" \
  -d '{"source": "mainichi-shogakusei"}'

# Todaii
curl -X POST https://moshimoshi.vercel.app/api/news/scrape \
  -H "Content-Type: application/json" \
  -d '{"source": "todaii"}'

# Or scrape all sources at once
curl -X POST https://moshimoshi.vercel.app/api/news/scrape \
  -H "Content-Type: application/json"
```

## ✅ Verification

### Check Articles in Database
```bash
node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

(async () => {
  const sources = ['NHK Easy', 'Watanoc', 'Mainichi News', 'Mainichi Elementary', 'Todaii'];

  console.log('Articles by source:');
  for (const source of sources) {
    const snapshot = await db.collection('news_articles')
      .where('source', '==', source)
      .count()
      .get();
    console.log('-', source + ':', snapshot.data().count);
  }

  const total = await db.collection('news_articles').count().get();
  console.log('\nTotal:', total.data().count, 'articles');

  process.exit(0);
})();
"
```

### Expected Results After Deployment
- **NHK Easy**: 20 articles (already working)
- **Watanoc**: 5 articles (NEW)
- **Mainichi News**: 5 articles (NEW)
- **Mainichi Elementary**: 10 articles (NEW)
- **Todaii**: 0 articles (source has no content currently)
- **Total**: ~40 articles

### Test News Page
1. Navigate to `/news`
2. Should see articles from all sources
3. "Load More" button should work
4. Filters (source, difficulty, category) should work
5. Fallback images show theme-colored gradients with source emoji

## 🔍 Files Changed

### Backend (Cloud Functions)
- `functions/src/scheduled/newsScheduler.ts` - Added `saveArticlesToFirestore()` function
- `functions/src/scrapers/nhkEasyScraper.ts` - Image URL fix (already deployed on Sheldon)

### Frontend
- `src/services/newsService.ts` - **NEW FILE** - News service with pagination
- `src/app/api/news/articles/route.ts` - Added pagination support
- `src/components/news/NewsArticleFallbackImage.tsx` - **NEW FILE** - Theme-aware fallback

### Configuration
- `firestore.indexes.json` - Already has all required indexes
- `.claude/api-implementation-context.yml` - Updated with NHK image fix documentation

## 📊 Before vs After

### Before
- ❌ Only 20 NHK Easy articles in database
- ❌ Watanoc, Mainichi News, Mainichi Elementary not saving
- ❌ News page broken (no newsService)
- ❌ No pagination
- ❌ Hard 100-article limit

### After
- ✅ ~40 articles from 4 sources
- ✅ All scrapers save correctly
- ✅ Full pagination support
- ✅ Filters working
- ✅ Load more functionality
- ✅ Theme-aware fallback images

## 🕐 Scheduled Scraper

The scheduled function runs **daily at 6:00 AM JST** and now:
1. ✅ Scrapes all 5 sources in parallel
2. ✅ Saves articles from ALL sources (not just NHK)
3. ✅ Logs results to `scraping_logs` collection
4. ✅ Reports accurate article counts

## 🚨 Important Notes

1. **Deployment order matters**: Deploy indexes first, then functions
2. **Allow 5-10 minutes** for index creation to complete
3. **Manual scrape required** after deployment to populate non-NHK articles
4. **Scheduled function will maintain** the database going forward

## 🎯 Next Steps After Deployment

1. Deploy indexes and functions (steps 1-2 above)
2. Wait for index creation (check Firebase Console)
3. Trigger manual scrapes (step 3 above)
4. Verify article counts
5. Test news page functionality
6. Monitor scheduled runs in `scraping_logs`

---
**Created**: 2025-11-17
**Author**: Claude Code
**Status**: Ready to deploy
