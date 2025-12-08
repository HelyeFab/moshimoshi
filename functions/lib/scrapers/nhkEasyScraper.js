'use strict'
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        var desc = Object.getOwnPropertyDescriptor(m, k)
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k]
            },
          }
        }
        Object.defineProperty(o, k2, desc)
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        o[k2] = m[k]
      })
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v })
      }
    : function (o, v) {
        o['default'] = v
      })
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = []
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k
          return ar
        }
      return ownKeys(o)
    }
    return function (mod) {
      if (mod && mod.__esModule) return mod
      var result = {}
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i])
      __setModuleDefault(result, mod)
      return result
    }
  })()
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.scrapeNHKEasy = scrapeNHKEasy
const admin = __importStar(require('firebase-admin'))
const logger = __importStar(require('firebase-functions/logger'))
const params_1 = require('firebase-functions/params')
const crypto_1 = __importDefault(require('crypto'))
const scraper_utils_1 = require('../utils/scraper-utils')
// Define the Modal API key secret (used for NHK API proxy + VOICEVOX TTS)
const MODAL_API_KEY = (0, params_1.defineSecret)('MODAL_API_KEY')
// Initialize Firestore
const db = admin.firestore()
// Helper to generate consistent IDs
function generateArticleId(url) {
  return crypto_1.default.createHash('md5').update(url).digest('hex')
}
/**
 * NHK Easy scraper using Railway-hosted NHK Easy API
 * Fetches articles from our protected nhk-api-proxy on Railway
 * Much faster and more reliable than HTML scraping
 *
 * @param customStartDate - Optional start date (YYYY-MM-DD)
 * @param customEndDate - Optional end date (YYYY-MM-DD)
 * @param limit - Maximum number of articles to scrape (default: 1)
 */
async function scrapeNHKEasy(customStartDate, customEndDate, limit = 1) {
  var _a, _b, _c
  const startTime = Date.now()
  const articles = []
  try {
    logger.info('[NHK Easy] Starting API fetch', {
      source: 'NHK Easy API',
      endpoint: 'nhk-api-proxy-production.up.railway.app',
      timestamp: new Date().toISOString(),
    })
    // Calculate date range: use custom dates if provided, otherwise last 7 days
    let startDate
    let endDate
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate)
      endDate = new Date(customEndDate)
      // Ensure end date includes the whole day
      endDate.setHours(23, 59, 59, 999)
      logger.info('[NHK Easy] Using custom date range', {
        customStartDate,
        customEndDate,
      })
    } else {
      // Default: fetch articles from last 7 days
      endDate = new Date()
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
      logger.info('[NHK Easy] Using default 7-day range')
    }
    const apiUrl = `https://nhk-api-proxy-production.up.railway.app/news?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
    logger.info('[NHK Easy] Fetching from API', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      isCustomRange: !!(customStartDate && customEndDate),
    })
    // Get API key from Firebase secret (trim to remove any trailing newlines)
    const apiKey = (_a = MODAL_API_KEY.value()) === null || _a === void 0 ? void 0 : _a.trim()
    if (!apiKey) {
      throw new Error('MODAL_API_KEY secret not configured')
    }
    // Fetch from our protected Railway API
    const response = await (0, scraper_utils_1.safeFetch)(apiUrl, {
      timeoutMs: 30000,
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey,
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const apiArticles = await response.json()
    // Sort by publish date descending (newest first) to ensure we process the most recent articles
    apiArticles.sort(
      (a, b) => new Date(b.publishedAtUtc).getTime() - new Date(a.publishedAtUtc).getTime()
    )
    logger.info('[NHK Easy] API response received', {
      articleCount: apiArticles.length,
      limit,
      newestArticle: (_b = apiArticles[0]) === null || _b === void 0 ? void 0 : _b.publishedAtUtc,
      oldestArticle:
        (_c = apiArticles[apiArticles.length - 1]) === null || _c === void 0
          ? void 0
          : _c.publishedAtUtc,
    })
    if (!Array.isArray(apiArticles) || apiArticles.length === 0) {
      logger.info('[NHK Easy] No articles available')
      return { success: true, articles: [] }
    }
    // Generate IDs for all articles to check which are already processed
    const articleIdsToCheck = apiArticles.map(a => generateArticleId(a.url))
    // Check Firestore for already fully pre-cached articles
    // An article is "fully pre-cached" if it has audio, translations, AND word explanations
    const existingFullyCached = new Set()
    try {
      // Check in batches of 10 (Firestore 'in' query limit)
      for (let i = 0; i < articleIdsToCheck.length; i += 10) {
        const batchIds = articleIdsToCheck.slice(i, i + 10)
        // Check news_articles for audio
        const articlesSnap = await db
          .collection('news_articles')
          .where(admin.firestore.FieldPath.documentId(), 'in', batchIds)
          .get()
        // Check news_article_translations
        const translationsSnap = await db
          .collection('news_article_translations')
          .where(admin.firestore.FieldPath.documentId(), 'in', batchIds)
          .get()
        // Check news_article_word_explanations
        const explanationsSnap = await db
          .collection('news_article_word_explanations')
          .where(admin.firestore.FieldPath.documentId(), 'in', batchIds)
          .get()
        const hasAudio = new Set(
          articlesSnap.docs.filter(d => d.data().generatedContentAudioUrl).map(d => d.id)
        )
        const hasTranslations = new Set(translationsSnap.docs.map(d => d.id))
        const hasExplanations = new Set(explanationsSnap.docs.map(d => d.id))
        // Mark as fully cached if ALL three exist
        for (const id of batchIds) {
          if (hasAudio.has(id) && hasTranslations.has(id) && hasExplanations.has(id)) {
            existingFullyCached.add(id)
          }
        }
      }
      logger.info('[NHK Easy] Checked for existing pre-cached articles', {
        totalFromApi: apiArticles.length,
        alreadyFullyCached: existingFullyCached.size,
      })
    } catch (checkError) {
      logger.warn(
        '[NHK Easy] Error checking for existing articles, proceeding without skip logic',
        {
          error: checkError instanceof Error ? checkError.message : 'Unknown error',
        }
      )
    }
    // Filter out already fully pre-cached articles, then apply limit
    const newArticles = apiArticles.filter(a => !existingFullyCached.has(generateArticleId(a.url)))
    const articlesToProcess = newArticles.slice(0, limit)
    logger.info('[NHK Easy] Applying article limit after filtering', {
      totalFromApi: apiArticles.length,
      alreadyFullyCached: existingFullyCached.size,
      newArticlesAvailable: newArticles.length,
      processing: articlesToProcess.length,
      limit,
    })
    if (articlesToProcess.length === 0) {
      logger.info('[NHK Easy] All articles in date range are already fully pre-cached')
      return { success: true, articles: [], message: 'All articles already pre-cached' }
    }
    // Transform API articles to our NewsArticle format
    for (const apiArticle of articlesToProcess) {
      try {
        // Use bodyWithoutHtml as the plain text content
        const content = apiArticle.bodyWithoutHtml
        // Use outline (summary without HTML) as summary
        const summary =
          apiArticle.outline || content.substring(0, 200) + (content.length > 200 ? '...' : '')
        const newsArticle = {
          id: generateArticleId(apiArticle.url),
          title: apiArticle.title,
          titleWithFurigana: apiArticle.titleWithRuby, // Full title with furigana
          content,
          contentWithFurigana: apiArticle.body, // Full HTML with furigana and grammar colors
          summary,
          summaryWithFurigana: apiArticle.outlineWithRuby, // Summary with furigana
          url: apiArticle.url,
          imageUrl: apiArticle.imageUrl || undefined,
          nhkAudioUrl: apiArticle.m3u8Url || undefined, // NHK's official audio (professional narrator)
          publishDate: new Date(apiArticle.publishedAtUtc),
          source: 'NHK Easy',
          sourceId: apiArticle.newsId, // Original NHK article ID
          category: 'news',
          difficulty: 'N5', // NHK Easy is beginner level
          tags: ['nhk', 'easy', 'news', 'beginner'],
          metadata: {
            wordCount: content.length,
            readingTime: Math.ceil(content.length / 300), // 300 chars per minute for beginners
            hasFurigana: true, // NHK Easy always has furigana
          },
        }
        articles.push(newsArticle)
        logger.debug('[NHK Easy] Article processed', {
          newsId: apiArticle.newsId,
          title: newsArticle.title.substring(0, 50),
          contentLength: content.length,
        })
      } catch (articleError) {
        logger.error('[NHK Easy] Error processing article', {
          newsId: apiArticle.newsId,
          error: articleError instanceof Error ? articleError.message : 'Unknown error',
        })
        continue
      }
    }
    const duration = Date.now() - startTime
    logger.info('[NHK Easy] API fetch completed successfully', {
      articlesProcessed: articles.length,
      durationMs: duration,
      avgTimePerArticle: articles.length > 0 ? Math.round(duration / articles.length) : 0,
    })
    // Store articles in Firestore with batch chunking
    // Firestore has a 500 operation limit per batch, so we chunk at 100 for optimal performance
    if (articles.length > 0) {
      try {
        const BATCH_SIZE = 100
        let totalStored = 0
        let newArticlesCount = 0
        let updatedArticlesCount = 0
        // First, check which articles already exist in Firestore
        // This prevents overwriting createdAt for existing articles
        const existingArticleIds = new Set()
        const articleIds = articles.map(a => a.id)
        // Check in batches of 10 (Firestore 'in' query limit)
        for (let i = 0; i < articleIds.length; i += 10) {
          const batchIds = articleIds.slice(i, i + 10)
          const existingDocs = await db
            .collection('news_articles')
            .where(admin.firestore.FieldPath.documentId(), 'in', batchIds)
            .select() // Only fetch document references, not full data
            .get()
          existingDocs.docs.forEach(doc => existingArticleIds.add(doc.id))
        }
        logger.info('[NHK Easy] Checked existing articles', {
          totalArticles: articles.length,
          alreadyExist: existingArticleIds.size,
          trulyNew: articles.length - existingArticleIds.size,
        })
        for (let i = 0; i < articles.length; i += BATCH_SIZE) {
          const batch = db.batch()
          const chunk = articles.slice(i, i + BATCH_SIZE)
          for (const article of chunk) {
            const docRef = db.collection('news_articles').doc(article.id)
            const isNewArticle = !existingArticleIds.has(article.id)
            if (isNewArticle) {
              // New article: set both createdAt and lastUpdated
              batch.set(
                docRef,
                Object.assign(Object.assign({}, article), {
                  publishDate: admin.firestore.Timestamp.fromDate(article.publishDate),
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                })
              )
              newArticlesCount++
            } else {
              // Existing article: only update lastUpdated, preserve createdAt
              batch.set(
                docRef,
                Object.assign(Object.assign({}, article), {
                  publishDate: admin.firestore.Timestamp.fromDate(article.publishDate),
                  lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                }),
                { merge: true }
              )
              updatedArticlesCount++
            }
          }
          await batch.commit()
          totalStored += chunk.length
          logger.debug('[NHK Easy] Batch committed', {
            batchNumber: Math.floor(i / BATCH_SIZE) + 1,
            articlesInBatch: chunk.length,
            totalStored,
          })
        }
        logger.info('[NHK Easy] Articles stored in Firestore', {
          count: totalStored,
          newArticles: newArticlesCount,
          updatedArticles: updatedArticlesCount,
          batches: Math.ceil(articles.length / BATCH_SIZE),
        })
      } catch (dbError) {
        logger.error('[NHK Easy] Failed to store in Firestore', {
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          articleCount: articles.length,
        })
        // Continue - return articles even if storage fails
      }
    }
    return { success: true, articles }
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('[NHK Easy] API fetch failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
      articlesCollected: articles.length,
    })
    return {
      success: false,
      articles: [],
      error: error instanceof Error ? error.message : 'Failed to fetch from API',
    }
  }
}
//# sourceMappingURL=nhkEasyScraper.js.map
