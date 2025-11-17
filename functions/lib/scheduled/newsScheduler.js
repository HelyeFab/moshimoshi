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
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualNewsScraperFunction = exports.scheduledNewsScraperFunction = void 0;
exports.scheduledNewsScraper = scheduledNewsScraper;
exports.manualNewsScraper = manualNewsScraper;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const nhkEasyScraper_1 = require("../scrapers/nhkEasyScraper");
const watanoc_1 = require("../scrapers/watanoc");
const mainichi_news_1 = require("../scrapers/mainichi-news");
const mainichi_shogakusei_1 = require("../scrapers/mainichi-shogakusei");
// Initialize Firestore
const db = admin.firestore();
// News source configurations
const NEWS_SOURCES = [
    {
        name: 'NHK Easy',
        endpoint: 'nhk-easy',
        priority: 1,
        enabled: true
    },
    {
        name: 'Watanoc',
        endpoint: 'watanoc',
        priority: 2,
        enabled: true
    },
    {
        name: 'Mainichi News',
        endpoint: 'mainichi-news',
        priority: 3,
        enabled: true
    },
    {
        name: 'Mainichi Elementary',
        endpoint: 'mainichi-shogakusei',
        priority: 4,
        enabled: true
    }
];
// Helper to save articles to Firestore
async function saveArticlesToFirestore(articles, sourceName) {
    if (!articles || articles.length === 0) {
        logger.debug('[NewsScheduler] No articles to save', { source: sourceName });
        return 0;
    }
    try {
        const BATCH_SIZE = 100;
        let totalStored = 0;
        for (let i = 0; i < articles.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = articles.slice(i, i + BATCH_SIZE);
            for (const article of chunk) {
                const docRef = db.collection('news_articles').doc(article.id);
                batch.set(docRef, Object.assign(Object.assign({}, article), { publishDate: article.publishDate instanceof Date
                        ? admin.firestore.Timestamp.fromDate(article.publishDate)
                        : article.publishDate, createdAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdated: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
            }
            await batch.commit();
            totalStored += chunk.length;
            logger.debug('[NewsScheduler] Batch committed', {
                source: sourceName,
                batchNumber: Math.floor(i / BATCH_SIZE) + 1,
                articlesInBatch: chunk.length,
                totalStored
            });
        }
        logger.info('[NewsScheduler] Articles stored in Firestore', {
            source: sourceName,
            count: totalStored,
            batches: Math.ceil(articles.length / BATCH_SIZE)
        });
        return totalStored;
    }
    catch (dbError) {
        logger.error('[NewsScheduler] Failed to store in Firestore', {
            source: sourceName,
            error: dbError instanceof Error ? dbError.message : 'Unknown error',
            articleCount: articles.length
        });
        return 0;
    }
}
// Helper to trigger individual scraper
async function triggerScraper(source) {
    var _a, _b;
    const startTime = Date.now();
    try {
        logger.info('[NewsScheduler] Triggering scraper', { source: source.name });
        let result;
        // Call scrapers directly instead of via HTTP
        switch (source.endpoint) {
            case 'nhk-easy':
                result = await (0, nhkEasyScraper_1.scrapeNHKEasy)();
                break;
            case 'watanoc': {
                const articles = await (0, watanoc_1.scrapeWatanoc)();
                result = { success: true, articles };
                break;
            }
            case 'mainichi-news': {
                const articles = await (0, mainichi_news_1.scrapeMainichiNews)();
                result = { success: true, articles };
                break;
            }
            case 'mainichi-shogakusei': {
                const articles = await (0, mainichi_shogakusei_1.scrapeMainichiShogakusei)();
                result = { success: true, articles };
                break;
            }
            default:
                throw new Error(`Unknown scraper: ${source.endpoint}`);
        }
        // Save articles to Firestore (except NHK Easy which saves internally)
        if (source.endpoint !== 'nhk-easy' && result.articles && result.articles.length > 0) {
            await saveArticlesToFirestore(result.articles, source.name);
        }
        const duration = Date.now() - startTime;
        if (result.success) {
            logger.info('[NewsScheduler] Scraper succeeded', {
                source: source.name,
                articlesCount: ((_a = result.articles) === null || _a === void 0 ? void 0 : _a.length) || 0,
                durationMs: duration
            });
            return {
                source: source.name,
                endpoint: source.endpoint,
                success: true,
                articlesCount: ((_b = result.articles) === null || _b === void 0 ? void 0 : _b.length) || 0,
                duration,
                timestamp: new Date().toISOString()
            };
        }
        else {
            logger.error('[NewsScheduler] Scraper failed', {
                source: source.name,
                error: result.error,
                durationMs: duration
            });
            return {
                source: source.name,
                endpoint: source.endpoint,
                success: false,
                articlesCount: 0,
                duration,
                error: result.error,
                timestamp: new Date().toISOString()
            };
        }
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger.error('[NewsScheduler] Scraper error', {
            source: source.name,
            error: error instanceof Error ? error.message : 'Unknown error',
            durationMs: duration
        });
        return {
            source: source.name,
            endpoint: source.endpoint,
            success: false,
            articlesCount: 0,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        };
    }
}
// Main scheduler function
async function scheduledNewsScraper() {
    const startTime = Date.now();
    logger.info('[NewsScheduler] Starting scheduled news scraping');
    try {
        // Filter enabled sources only
        const enabledSources = NEWS_SOURCES.filter(s => s.enabled);
        if (enabledSources.length === 0) {
            logger.warn('[NewsScheduler] No news sources enabled');
            return {
                success: false,
                message: 'No news sources enabled',
                timestamp: new Date().toISOString()
            };
        }
        // Run all scrapers in parallel
        logger.info('[NewsScheduler] Running scrapers in parallel', {
            scraperCount: enabledSources.length
        });
        const results = await Promise.allSettled(enabledSources.map(source => triggerScraper(source)));
        // Process results
        const summary = {
            totalArticles: 0,
            successfulSources: 0,
            failedSources: 0,
            sources: {},
            duration: 0,
            timestamp: new Date().toISOString()
        };
        results.forEach((result, index) => {
            var _a;
            const sourceName = enabledSources[index].name;
            if (result.status === 'fulfilled' && result.value.success) {
                summary.successfulSources++;
                summary.totalArticles += result.value.articlesCount;
                summary.sources[sourceName] = {
                    success: true,
                    articles: result.value.articlesCount,
                    duration: result.value.duration
                };
            }
            else if (result.status === 'fulfilled') {
                summary.failedSources++;
                summary.sources[sourceName] = {
                    success: false,
                    error: result.value.error,
                    duration: result.value.duration
                };
            }
            else {
                summary.failedSources++;
                summary.sources[sourceName] = {
                    success: false,
                    error: ((_a = result.reason) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error'
                };
            }
        });
        summary.duration = Date.now() - startTime;
        // Log results to Firestore for monitoring
        try {
            await db.collection('scraping_logs').add(Object.assign(Object.assign({}, summary), { type: 'scheduled', createdAt: admin.firestore.FieldValue.serverTimestamp() }));
            logger.info('[NewsScheduler] Results logged to Firestore');
        }
        catch (logError) {
            logger.error('[NewsScheduler] Failed to log results', {
                error: logError instanceof Error ? logError.message : 'Unknown error'
            });
        }
        // Log summary
        logger.info('[NewsScheduler] Scraping summary', {
            totalArticles: summary.totalArticles,
            successfulSources: summary.successfulSources,
            totalSources: enabledSources.length,
            failedSources: summary.failedSources,
            durationMs: summary.duration,
            sources: summary.sources
        });
        // Send alert if all scrapers failed
        if (summary.successfulSources === 0) {
            logger.error('[NewsScheduler] ALERT: All scrapers failed', {
                totalSources: enabledSources.length,
                timestamp: new Date().toISOString()
            });
            // TODO: Send notification (email, Slack, etc.)
        }
        return {
            success: summary.successfulSources > 0,
            summary,
            message: `Scraped ${summary.totalArticles} articles from ${summary.successfulSources} sources`
        };
    }
    catch (error) {
        logger.error('[NewsScheduler] Fatal error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            durationMs: Date.now() - startTime
        });
        // Log error to Firestore
        try {
            await db.collection('scraping_logs').add({
                type: 'scheduled',
                error: error instanceof Error ? error.message : 'Unknown error',
                success: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        catch (logError) {
            logger.error('[NewsScheduler] Failed to log error', {
                error: logError instanceof Error ? logError.message : 'Unknown error'
            });
        }
        throw error;
    }
}
// Manual trigger function for testing
async function manualNewsScraper(data, context) {
    var _a;
    // Check if user is authenticated OR has admin key
    const adminKey = data === null || data === void 0 ? void 0 : data.adminKey;
    const expectedAdminKey = process.env.NEWS_SCRAPER_ADMIN_KEY || 'news-scraper-admin-2025';
    if (!context.auth && adminKey !== expectedAdminKey) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated or provide valid admin key to trigger manual scraping');
    }
    const requestedSource = data === null || data === void 0 ? void 0 : data.source;
    logger.info('[NewsScheduler] Manual trigger initiated', {
        userId: ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) || 'admin-key',
        source: requestedSource || 'all',
        timestamp: new Date().toISOString()
    });
    // If a specific source is requested, scrape only that source
    if (requestedSource) {
        const source = NEWS_SOURCES.find(s => s.endpoint === requestedSource);
        if (!source) {
            throw new https_1.HttpsError('invalid-argument', `Invalid source: ${requestedSource}. Valid sources: ${NEWS_SOURCES.map(s => s.endpoint).join(', ')}`);
        }
        if (!source.enabled) {
            throw new https_1.HttpsError('failed-precondition', `Source ${source.name} is currently disabled`);
        }
        logger.info('[NewsScheduler] Scraping single source', { source: source.name });
        const result = await triggerScraper(source);
        return {
            success: result.success,
            source: result.source,
            articlesCount: result.articlesCount,
            duration: result.duration,
            timestamp: result.timestamp,
            error: result.error
        };
    }
    // No specific source - run all scrapers
    logger.info('[NewsScheduler] Scraping all sources');
    const result = await scheduledNewsScraper();
    return result;
}
// Export functions for different triggers
exports.scheduledNewsScraperFunction = (0, scheduler_1.onSchedule)({
    schedule: '0 6 * * *', // 6:00 AM every day
    timeZone: 'Asia/Tokyo', // Japan time
    memory: '2GiB', // Increased from 1GiB for better performance
    timeoutSeconds: 540, // 9 minutes
    retryCount: 2 // Retry up to 2 times on failure
}, async (event) => {
    logger.info('[NewsScheduler] Scheduled trigger activated', {
        scheduleTime: event.scheduleTime,
        jobName: event.jobName
    });
    await scheduledNewsScraper();
});
exports.manualNewsScraperFunction = (0, https_1.onCall)({
    memory: '2GiB', // Increased from 1GiB for better performance
    timeoutSeconds: 540,
    invoker: 'public' // Allow public invocation (auth checked via admin key inside)
}, async (request) => {
    return manualNewsScraper(request.data, request);
});
//# sourceMappingURL=newsScheduler.js.map