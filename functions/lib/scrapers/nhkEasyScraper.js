"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeNHKEasy = scrapeNHKEasy;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const crypto_1 = __importDefault(require("crypto"));
const scraper_utils_1 = require("../utils/scraper-utils");
// Initialize Firestore
const db = admin.firestore();
// Helper to generate consistent IDs
function generateArticleId(url) {
    return crypto_1.default.createHash('md5').update(url).digest('hex');
}
// Helper to strip ruby tags but keep the text
function stripRubyTags(html) {
    // Remove <rt> tags and their content
    let text = html.replace(/<rt>.*?<\/rt>/g, '');
    // Remove remaining <ruby> tags but keep content
    text = text.replace(/<\/?ruby>/g, '');
    return text;
}
/**
 * NHK Easy scraper using self-hosted NHK Easy API
 * Fetches articles from our Sheldon-hosted nhk-easy-api service
 * Much faster and more reliable than HTML scraping
 */
async function scrapeNHKEasy() {
    const startTime = Date.now();
    const articles = [];
    try {
        logger.info('[NHK Easy] Starting API fetch', {
            source: 'NHK Easy API',
            endpoint: 'nhk.selfmind.dev',
            timestamp: new Date().toISOString()
        });
        // Calculate date range: fetch articles from last 7 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        const apiUrl = `https://nhk.selfmind.dev/news?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
        logger.info('[NHK Easy] Fetching from API', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });
        // Fetch from our self-hosted API
        const response = await (0, scraper_utils_1.safeFetch)(apiUrl, {
            timeoutMs: 30000,
            headers: {
                'Accept': 'application/json',
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const apiArticles = await response.json();
        logger.info('[NHK Easy] API response received', {
            articleCount: apiArticles.length
        });
        if (!Array.isArray(apiArticles) || apiArticles.length === 0) {
            logger.info('[NHK Easy] No articles available');
            return { success: true, articles: [] };
        }
        // Transform API articles to our NewsArticle format
        for (const apiArticle of apiArticles) {
            try {
                // Use bodyWithoutHtml as the plain text content
                const content = apiArticle.bodyWithoutHtml;
                // Use outline (summary without HTML) as summary
                const summary = apiArticle.outline || content.substring(0, 200) + (content.length > 200 ? '...' : '');
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
                    audioUrl: apiArticle.m3u8Url || undefined, // Audio for listening practice!
                    publishDate: new Date(apiArticle.publishedAtUtc),
                    source: 'NHK Easy',
                    sourceId: apiArticle.newsId, // Original NHK article ID
                    category: 'news',
                    difficulty: 'N5', // NHK Easy is beginner level
                    tags: ['nhk', 'easy', 'news', 'beginner'],
                    metadata: {
                        wordCount: content.length,
                        readingTime: Math.ceil(content.length / 300), // 300 chars per minute for beginners
                        hasFurigana: true // NHK Easy always has furigana
                    }
                };
                articles.push(newsArticle);
                logger.debug('[NHK Easy] Article processed', {
                    newsId: apiArticle.newsId,
                    title: newsArticle.title.substring(0, 50),
                    contentLength: content.length
                });
            }
            catch (articleError) {
                logger.error('[NHK Easy] Error processing article', {
                    newsId: apiArticle.newsId,
                    error: articleError instanceof Error ? articleError.message : 'Unknown error'
                });
                continue;
            }
        }
        const duration = Date.now() - startTime;
        logger.info('[NHK Easy] API fetch completed successfully', {
            articlesProcessed: articles.length,
            durationMs: duration,
            avgTimePerArticle: articles.length > 0 ? Math.round(duration / articles.length) : 0
        });
        // Store articles in Firestore
        if (articles.length > 0) {
            try {
                const batch = db.batch();
                for (const article of articles) {
                    const docRef = db.collection('news_articles').doc(article.id);
                    batch.set(docRef, Object.assign(Object.assign({}, article), { publishDate: admin.firestore.Timestamp.fromDate(article.publishDate), createdAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdated: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
                }
                await batch.commit();
                logger.info('[NHK Easy] Articles stored in Firestore', {
                    count: articles.length
                });
            }
            catch (dbError) {
                logger.error('[NHK Easy] Failed to store in Firestore', {
                    error: dbError instanceof Error ? dbError.message : 'Unknown error',
                    articleCount: articles.length
                });
                // Continue - return articles even if storage fails
            }
        }
        return { success: true, articles };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger.error('[NHK Easy] API fetch failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            durationMs: duration,
            articlesCollected: articles.length
        });
        return {
            success: false,
            articles: [],
            error: error instanceof Error ? error.message : 'Failed to fetch from API'
        };
    }
}
//# sourceMappingURL=nhkEasyScraper.js.map