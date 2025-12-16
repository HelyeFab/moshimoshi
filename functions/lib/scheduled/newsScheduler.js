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
const params_1 = require("firebase-functions/params");
const nhkEasyScraper_1 = require("../scrapers/nhkEasyScraper");
const newsAudioGenerator_1 = require("../utils/newsAudioGenerator");
const wordExtractor_1 = require("../utils/wordExtractor");
const translationPreGenerator_1 = require("../utils/translationPreGenerator");
const wordExplanationPreGenerator_1 = require("../utils/wordExplanationPreGenerator");
const sentencePreGenerator_1 = require("../utils/sentencePreGenerator");
const alertNotifier_1 = require("../utils/alertNotifier");
// Define secrets needed for TTS audio generation, AI processing, and NHK API
const MODAL_API_KEY = (0, params_1.defineSecret)('MODAL_API_KEY'); // For VOICEVOX TTS and NHK API
const OPENAI_API_KEY = (0, params_1.defineSecret)('OPENAI_API_KEY');
const RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY'); // For email alerts
// Initialize Firestore
const db = admin.firestore();
// News source configurations
const NEWS_SOURCES = [
    {
        name: 'NHK Easy',
        endpoint: 'nhk-easy',
        priority: 1,
        enabled: true,
    },
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
                totalStored,
            });
        }
        logger.info('[NewsScheduler] Articles stored in Firestore', {
            source: sourceName,
            count: totalStored,
            batches: Math.ceil(articles.length / BATCH_SIZE),
        });
        return totalStored;
    }
    catch (dbError) {
        logger.error('[NewsScheduler] Failed to store in Firestore', {
            source: sourceName,
            error: dbError instanceof Error ? dbError.message : 'Unknown error',
            articleCount: articles.length,
        });
        return 0;
    }
}
// Helper to trigger individual scraper
async function triggerScraper(source, startDate, endDate, limit = 1) {
    var _a, _b;
    const startTime = Date.now();
    try {
        logger.info('[NewsScheduler] Triggering scraper', { source: source.name, limit });
        let result;
        // Call scrapers directly instead of via HTTP
        switch (source.endpoint) {
            case 'nhk-easy':
                result = await (0, nhkEasyScraper_1.scrapeNHKEasy)(startDate, endDate, limit);
                break;
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
                durationMs: duration,
            });
            return {
                source: source.name,
                endpoint: source.endpoint,
                success: true,
                articlesCount: ((_b = result.articles) === null || _b === void 0 ? void 0 : _b.length) || 0,
                duration,
                timestamp: new Date().toISOString(),
            };
        }
        else {
            logger.error('[NewsScheduler] Scraper failed', {
                source: source.name,
                error: result.error,
                durationMs: duration,
            });
            return {
                source: source.name,
                endpoint: source.endpoint,
                success: false,
                articlesCount: 0,
                duration,
                error: result.error,
                timestamp: new Date().toISOString(),
            };
        }
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger.error('[NewsScheduler] Scraper error', {
            source: source.name,
            error: error instanceof Error ? error.message : 'Unknown error',
            durationMs: duration,
        });
        return {
            source: source.name,
            endpoint: source.endpoint,
            success: false,
            articlesCount: 0,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
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
                timestamp: new Date().toISOString(),
            };
        }
        // Calculate date range to fetch only recent articles (last 6 hours)
        const now = new Date();
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        const endDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const startDate = sixHoursAgo.toISOString().split('T')[0]; // YYYY-MM-DD
        // Run all scrapers in parallel - limit to 1 article per source per run
        // NHK publishes ~4 articles per weekday, we only want 1 per day
        const ARTICLE_LIMIT = 1;
        logger.info('[NewsScheduler] Running scrapers in parallel', {
            scraperCount: enabledSources.length,
            dateRange: { startDate, endDate },
            articleLimit: ARTICLE_LIMIT,
        });
        const results = await Promise.allSettled(enabledSources.map(source => triggerScraper(source, startDate, endDate, ARTICLE_LIMIT)));
        // Process results
        const summary = {
            totalArticles: 0,
            successfulSources: 0,
            failedSources: 0,
            sources: {},
            duration: 0,
            timestamp: new Date().toISOString(),
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
                    duration: result.value.duration,
                };
            }
            else if (result.status === 'fulfilled') {
                summary.failedSources++;
                summary.sources[sourceName] = {
                    success: false,
                    error: result.value.error,
                    duration: result.value.duration,
                };
            }
            else {
                summary.failedSources++;
                summary.sources[sourceName] = {
                    success: false,
                    error: ((_a = result.reason) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error',
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
                error: logError instanceof Error ? logError.message : 'Unknown error',
            });
        }
        // Log summary
        logger.info('[NewsScheduler] Scraping summary', {
            totalArticles: summary.totalArticles,
            successfulSources: summary.successfulSources,
            totalSources: enabledSources.length,
            failedSources: summary.failedSources,
            durationMs: summary.duration,
            sources: summary.sources,
        });
        // Send alert if all scrapers failed
        if (summary.successfulSources === 0) {
            logger.error('[NewsScheduler] ALERT: All scrapers failed', {
                totalSources: enabledSources.length,
                timestamp: new Date().toISOString(),
            });
            // Send email alert
            const failedSourceNames = Object.keys(summary.sources);
            const errors = {};
            for (const [name, data] of Object.entries(summary.sources)) {
                if (!data.success && data.error) {
                    errors[name] = data.error;
                }
            }
            try {
                await (0, alertNotifier_1.sendScraperFailureAlert)(RESEND_API_KEY.value(), failedSourceNames, errors, enabledSources.length);
            }
            catch (alertError) {
                logger.error('[NewsScheduler] Failed to send alert email', {
                    error: alertError instanceof Error ? alertError.message : 'Unknown error',
                });
            }
        }
        // PRE-CACHE ASSETS: Generate audio for newly scraped articles
        if (summary.totalArticles > 0) {
            logger.info('[NewsScheduler] Starting asset pre-caching for articles', {
                articleCount: summary.totalArticles,
            });
            try {
                // Fetch articles scraped in this run (last 10 minutes to be safe)
                const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
                const articlesSnapshot = await db
                    .collection('news_articles')
                    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(tenMinutesAgo))
                    .orderBy('createdAt', 'desc')
                    .limit(10) // Safety limit
                    .get();
                if (!articlesSnapshot.empty) {
                    const articles = articlesSnapshot.docs.map(doc => ({
                        id: doc.id,
                        title: doc.data().title,
                        summary: doc.data().summary,
                        content: doc.data().content,
                        source: doc.data().source,
                        nhkAudioUrl: doc.data().nhkAudioUrl, // NHK's original audio
                    }));
                    logger.info('[NewsScheduler] Found articles for pre-caching', {
                        count: articles.length,
                    });
                    // Generate audio (title, summary, content) for all articles
                    const audioStartTime = Date.now();
                    let audioSuccessCount = 0;
                    let audioFailureCount = 0;
                    for (const article of articles) {
                        try {
                            await (0, newsAudioGenerator_1.generateBatchAudio)(article);
                            audioSuccessCount++;
                        }
                        catch (audioError) {
                            audioFailureCount++;
                            logger.error('[NewsScheduler] Audio generation failed for article', {
                                articleId: article.id,
                                error: audioError instanceof Error ? audioError.message : 'Unknown error',
                            });
                        }
                    }
                    const audioDuration = Date.now() - audioStartTime;
                    logger.info('[NewsScheduler] Audio generation completed', {
                        articlesProcessed: audioSuccessCount,
                        articlesFailed: audioFailureCount,
                        durationMs: audioDuration,
                    });
                    // STEP 2: Generate translations for all article segments
                    logger.info('[NewsScheduler] Starting translation pre-generation');
                    const translationStartTime = Date.now();
                    try {
                        const translationResults = await (0, translationPreGenerator_1.generateBatchTranslations)(articles);
                        const translationDuration = Date.now() - translationStartTime;
                        logger.info('[NewsScheduler] Translation generation completed', {
                            articlesProcessed: translationResults.successCount,
                            articlesFailed: translationResults.failureCount,
                            totalCost: translationResults.totalCost.toFixed(4),
                            durationMs: translationDuration,
                        });
                    }
                    catch (translationError) {
                        logger.error('[NewsScheduler] Translation generation failed', {
                            error: translationError instanceof Error ? translationError.message : 'Unknown error',
                        });
                        // Continue - don't fail whole job if translations fail
                    }
                    // STEP 3: Extract top words and generate explanations
                    logger.info('[NewsScheduler] Starting word extraction and explanation generation');
                    const wordExtractionStartTime = Date.now();
                    try {
                        // Extract top 100 words from each article
                        const articlesWithWords = articles.map(article => {
                            const words = (0, wordExtractor_1.extractTopWords)(article.content, 100);
                            return {
                                id: article.id,
                                content: article.content,
                                words: words.words,
                            };
                        });
                        logger.info('[NewsScheduler] Words extracted', {
                            articleCount: articlesWithWords.length,
                            totalWords: articlesWithWords.reduce((sum, a) => sum + a.words.length, 0),
                        });
                        // Generate word explanations for all articles
                        const wordExplanationResults = await (0, wordExplanationPreGenerator_1.generateBatchWordExplanations)(articlesWithWords);
                        const wordExtractionDuration = Date.now() - wordExtractionStartTime;
                        logger.info('[NewsScheduler] Word explanation generation completed', {
                            articlesProcessed: wordExplanationResults.successCount,
                            articlesFailed: wordExplanationResults.failureCount,
                            totalWords: wordExplanationResults.totalWords,
                            totalCost: wordExplanationResults.totalCost.toFixed(4),
                            durationMs: wordExtractionDuration,
                        });
                    }
                    catch (wordError) {
                        logger.error('[NewsScheduler] Word explanation generation failed', {
                            error: wordError instanceof Error ? wordError.message : 'Unknown error',
                        });
                        // Continue - don't fail whole job if word explanations fail
                    }
                    // STEP 4: Generate sentence-level audio and translations
                    logger.info('[NewsScheduler] Starting sentence-level pre-generation');
                    const sentenceStartTime = Date.now();
                    let sentenceSuccessCount = 0;
                    let sentenceFailureCount = 0;
                    for (const article of articles) {
                        try {
                            await (0, sentencePreGenerator_1.preGenerateArticleSentences)(article.id, article.content);
                            sentenceSuccessCount++;
                        }
                        catch (sentenceError) {
                            sentenceFailureCount++;
                            logger.error('[NewsScheduler] Sentence pre-generation failed for article', {
                                articleId: article.id,
                                error: sentenceError instanceof Error ? sentenceError.message : 'Unknown error',
                            });
                        }
                    }
                    const sentenceDuration = Date.now() - sentenceStartTime;
                    logger.info('[NewsScheduler] Sentence pre-generation completed', {
                        articlesProcessed: sentenceSuccessCount,
                        articlesFailed: sentenceFailureCount,
                        durationMs: sentenceDuration,
                    });
                }
                else {
                    logger.warn('[NewsScheduler] No articles found for pre-caching');
                }
            }
            catch (assetError) {
                logger.error('[NewsScheduler] Asset pre-caching failed', {
                    error: assetError instanceof Error ? assetError.message : 'Unknown error',
                });
                // Don't fail the whole scraping job if asset generation fails
            }
        }
        return {
            success: summary.successfulSources > 0,
            summary,
            message: `Scraped ${summary.totalArticles} articles from ${summary.successfulSources} sources`,
        };
    }
    catch (error) {
        logger.error('[NewsScheduler] Fatal error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            durationMs: Date.now() - startTime,
        });
        // Log error to Firestore
        try {
            await db.collection('scraping_logs').add({
                type: 'scheduled',
                error: error instanceof Error ? error.message : 'Unknown error',
                success: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        catch (logError) {
            logger.error('[NewsScheduler] Failed to log error', {
                error: logError instanceof Error ? logError.message : 'Unknown error',
            });
        }
        throw error;
    }
}
// Helper function to run pre-caching pipeline on articles
async function runPreCachingPipeline(articleIds) {
    const result = {
        audioSuccess: 0,
        audioFailed: 0,
        translationSuccess: 0,
        translationFailed: 0,
        wordExplanationSuccess: 0,
        wordExplanationFailed: 0,
        totalCost: 0,
    };
    if (articleIds.length === 0) {
        logger.info('[PreCache] No articles to process');
        return result;
    }
    logger.info('[PreCache] Starting pre-caching pipeline', {
        articleCount: articleIds.length,
    });
    // Fetch the full article data
    const articlesSnapshot = await db
        .collection('news_articles')
        .where(admin.firestore.FieldPath.documentId(), 'in', articleIds.slice(0, 10)) // Firestore 'in' limit is 10
        .get();
    if (articlesSnapshot.empty) {
        logger.warn('[PreCache] No articles found for pre-caching');
        return result;
    }
    const articles = articlesSnapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        summary: doc.data().summary,
        content: doc.data().content,
        source: doc.data().source,
        nhkAudioUrl: doc.data().nhkAudioUrl, // NHK's original audio
    }));
    logger.info('[PreCache] Found articles for pre-caching', {
        count: articles.length,
    });
    // STAGE 1: Audio Generation
    logger.info('[PreCache] Stage 1: Audio generation');
    const audioStartTime = Date.now();
    for (const article of articles) {
        try {
            await (0, newsAudioGenerator_1.generateBatchAudio)(article);
            result.audioSuccess++;
        }
        catch (audioError) {
            result.audioFailed++;
            logger.error('[PreCache] Audio generation failed for article', {
                articleId: article.id,
                error: audioError instanceof Error ? audioError.message : 'Unknown error',
            });
        }
    }
    logger.info('[PreCache] Audio generation completed', {
        success: result.audioSuccess,
        failed: result.audioFailed,
        durationMs: Date.now() - audioStartTime,
    });
    // STAGE 2: Translation Generation
    logger.info('[PreCache] Stage 2: Translation generation');
    const translationStartTime = Date.now();
    try {
        const translationResults = await (0, translationPreGenerator_1.generateBatchTranslations)(articles);
        result.translationSuccess = translationResults.successCount;
        result.translationFailed = translationResults.failureCount;
        result.totalCost += translationResults.totalCost;
        logger.info('[PreCache] Translation generation completed', {
            success: result.translationSuccess,
            failed: result.translationFailed,
            cost: translationResults.totalCost.toFixed(4),
            durationMs: Date.now() - translationStartTime,
        });
    }
    catch (translationError) {
        result.translationFailed = articles.length;
        logger.error('[PreCache] Translation generation failed', {
            error: translationError instanceof Error ? translationError.message : 'Unknown error',
        });
    }
    // STAGE 3: Word Explanation Generation
    logger.info('[PreCache] Stage 3: Word explanation generation');
    const wordStartTime = Date.now();
    try {
        const articlesWithWords = articles.map(article => {
            const words = (0, wordExtractor_1.extractTopWords)(article.content, 100);
            return {
                id: article.id,
                content: article.content,
                words: words.words,
            };
        });
        const wordResults = await (0, wordExplanationPreGenerator_1.generateBatchWordExplanations)(articlesWithWords);
        result.wordExplanationSuccess = wordResults.successCount;
        result.wordExplanationFailed = wordResults.failureCount;
        result.totalCost += wordResults.totalCost;
        logger.info('[PreCache] Word explanation generation completed', {
            success: result.wordExplanationSuccess,
            failed: result.wordExplanationFailed,
            totalWords: wordResults.totalWords,
            cost: wordResults.totalCost.toFixed(4),
            durationMs: Date.now() - wordStartTime,
        });
    }
    catch (wordError) {
        result.wordExplanationFailed = articles.length;
        logger.error('[PreCache] Word explanation generation failed', {
            error: wordError instanceof Error ? wordError.message : 'Unknown error',
        });
    }
    logger.info('[PreCache] Pipeline completed', Object.assign(Object.assign({}, result), { totalCost: result.totalCost.toFixed(4) }));
    return result;
}
// Helper to update progress in Firestore
async function updateProgress(progressId, stage, details, percentage, substage) {
    try {
        await db
            .collection('scraping_progress')
            .doc(progressId)
            .set({
            stage,
            substage: substage || null,
            details,
            percentage,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch (error) {
        logger.error('[Progress] Failed to update progress', { progressId, error });
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
    const startDate = data === null || data === void 0 ? void 0 : data.startDate;
    const endDate = data === null || data === void 0 ? void 0 : data.endDate;
    const skipPreCache = (data === null || data === void 0 ? void 0 : data.skipPreCache) === true; // Option to skip pre-caching
    const progressId = data === null || data === void 0 ? void 0 : data.progressId; // For progress tracking
    logger.info('[NewsScheduler] Manual trigger initiated', {
        userId: ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) || 'admin-key',
        source: requestedSource || 'all',
        startDate: startDate || 'default',
        endDate: endDate || 'default',
        skipPreCache,
        progressId,
        timestamp: new Date().toISOString(),
    });
    // Initialize progress tracking if progressId provided
    if (progressId) {
        await db.collection('scraping_progress').doc(progressId).set({
            stage: 'initializing',
            details: 'Starting scraping process...',
            percentage: 0,
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'running',
        });
    }
    // If a specific source is requested, scrape only that source
    if (requestedSource) {
        const source = NEWS_SOURCES.find(s => s.endpoint === requestedSource);
        if (!source) {
            throw new https_1.HttpsError('invalid-argument', `Invalid source: ${requestedSource}. Valid sources: ${NEWS_SOURCES.map(s => s.endpoint).join(', ')}`);
        }
        if (!source.enabled) {
            throw new https_1.HttpsError('failed-precondition', `Source ${source.name} is currently disabled`);
        }
        // Limit to 1 article per manual trigger
        const ARTICLE_LIMIT = 1;
        logger.info('[NewsScheduler] Scraping single source', {
            source: source.name,
            limit: ARTICLE_LIMIT,
        });
        // Stage 1: Scraping (0-25%)
        if (progressId) {
            await updateProgress(progressId, 'scraping', `Fetching articles from ${source.name}...`, 5);
        }
        const result = await triggerScraper(source, startDate, endDate, ARTICLE_LIMIT);
        if (progressId) {
            await updateProgress(progressId, 'scraping', `Found ${result.articlesCount} new article(s)`, 25);
        }
        // Run pre-caching pipeline for the 1 scraped article
        let preCacheResult = null;
        if (result.success && result.articlesCount > 0 && !skipPreCache) {
            logger.info('[NewsScheduler] Running pre-caching pipeline for scraped article');
            // Get ONLY articles created in the last 2 minutes (truly new from THIS scrape)
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            let recentArticles = await db
                .collection('news_articles')
                .where('source', '==', source.name)
                .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(twoMinutesAgo))
                .orderBy('createdAt', 'desc')
                .limit(ARTICLE_LIMIT)
                .get();
            // If no newly created articles, check for articles that need pre-caching (exist but not fully cached)
            if (recentArticles.empty) {
                logger.info('[NewsScheduler] No newly created articles, checking for articles needing pre-cache retry');
                // Get the most recent articles that might need pre-caching
                const recentArticlesQuery = await db
                    .collection('news_articles')
                    .where('source', '==', source.name)
                    .orderBy('publishDate', 'desc')
                    .limit(5)
                    .get();
                if (!recentArticlesQuery.empty) {
                    // Check which ones are missing translations or word explanations
                    const articlesToCheck = recentArticlesQuery.docs;
                    const articleIdsToCheck = articlesToCheck.map(doc => doc.id);
                    // Check for missing translations
                    const translationsSnap = await db
                        .collection('news_article_translations')
                        .where(admin.firestore.FieldPath.documentId(), 'in', articleIdsToCheck)
                        .get();
                    const hasTranslations = new Set(translationsSnap.docs.map(d => d.id));
                    // Check for missing word explanations
                    const explanationsSnap = await db
                        .collection('news_article_word_explanations')
                        .where(admin.firestore.FieldPath.documentId(), 'in', articleIdsToCheck)
                        .get();
                    const hasExplanations = new Set(explanationsSnap.docs.map(d => d.id));
                    // Find articles missing either translations or word explanations
                    const articlesNeedingPreCache = articlesToCheck.filter(doc => {
                        const hasAudio = doc.data().generatedContentAudioUrl;
                        return !hasAudio || !hasTranslations.has(doc.id) || !hasExplanations.has(doc.id);
                    });
                    if (articlesNeedingPreCache.length > 0) {
                        // Create a fake query result with the articles needing pre-cache
                        recentArticles = {
                            empty: false,
                            docs: articlesNeedingPreCache.slice(0, ARTICLE_LIMIT),
                        };
                        logger.info('[NewsScheduler] Found articles needing pre-cache retry', {
                            count: recentArticles.docs.length,
                            articleIds: recentArticles.docs.map(d => d.id),
                        });
                    }
                }
            }
            if (!recentArticles.empty) {
                const articleIds = recentArticles.docs.map(doc => doc.id);
                logger.info('[NewsScheduler] Found articles for pre-caching', {
                    count: articleIds.length,
                    articleIds,
                });
                preCacheResult = await runPreCachingPipelineWithProgress(articleIds, progressId);
            }
            else {
                logger.info('[NewsScheduler] All recent articles are fully pre-cached');
                if (progressId) {
                    await updateProgress(progressId, 'complete', 'Article already fully cached', 100);
                }
            }
        }
        else if (progressId) {
            // No articles to pre-cache, skip to complete
            await updateProgress(progressId, 'complete', 'No new articles to process', 100);
        }
        // Mark as complete
        if (progressId) {
            await db
                .collection('scraping_progress')
                .doc(progressId)
                .set({
                stage: 'complete',
                details: `Completed: ${result.articlesCount} article(s) scraped`,
                percentage: 100,
                status: 'complete',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        // Log to scraping_logs for admin dashboard
        const totalDuration = Date.now() - (new Date(result.timestamp).getTime() || Date.now());
        try {
            await db.collection('scraping_logs').add({
                type: 'manual',
                source: result.source,
                totalArticles: result.articlesCount,
                successfulSources: result.success ? 1 : 0,
                failedSources: result.success ? 0 : 1,
                duration: totalDuration,
                sources: [
                    {
                        name: source.name,
                        status: result.success ? 'success' : 'error',
                        articlesCount: result.articlesCount,
                        error: result.error || null,
                    },
                ],
                preCaching: preCacheResult
                    ? {
                        audioGenerated: preCacheResult.audioSuccess,
                        translationsGenerated: preCacheResult.translationSuccess,
                        wordExplanationsGenerated: preCacheResult.wordExplanationSuccess,
                        totalCost: preCacheResult.totalCost,
                    }
                    : null,
                dateRange: startDate && endDate ? { startDate, endDate } : null,
                error: result.error || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            logger.info('[NewsScheduler] Manual scrape logged to Firestore');
        }
        catch (logError) {
            logger.error('[NewsScheduler] Failed to log manual scrape', {
                error: logError instanceof Error ? logError.message : 'Unknown error',
            });
        }
        return {
            success: result.success,
            source: result.source,
            articlesScraped: result.articlesCount,
            articlesPreCached: preCacheResult ? result.articlesCount : 0,
            duration: result.duration,
            timestamp: result.timestamp,
            error: result.error,
            preCaching: preCacheResult,
        };
    }
    // No specific source - run all scrapers
    logger.info('[NewsScheduler] Scraping all sources');
    const result = await scheduledNewsScraper();
    return result;
}
// Pre-caching pipeline with progress updates
async function runPreCachingPipelineWithProgress(articleIds, progressId) {
    const result = {
        audioSuccess: 0,
        audioFailed: 0,
        translationSuccess: 0,
        translationFailed: 0,
        wordExplanationSuccess: 0,
        wordExplanationFailed: 0,
        totalCost: 0,
    };
    if (articleIds.length === 0) {
        logger.info('[PreCache] No articles to process');
        return result;
    }
    // Fetch the full article data
    const articlesSnapshot = await db
        .collection('news_articles')
        .where(admin.firestore.FieldPath.documentId(), 'in', articleIds.slice(0, 10))
        .get();
    if (articlesSnapshot.empty) {
        return result;
    }
    const articles = articlesSnapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        summary: doc.data().summary,
        content: doc.data().content,
        source: doc.data().source,
        nhkAudioUrl: doc.data().nhkAudioUrl, // NHK's original audio
    }));
    // STAGE 2: Audio Generation (25-50%)
    if (progressId) {
        await updateProgress(progressId, 'audio', 'Generating audio with VOICEVOX TTS...', 30, 'title');
    }
    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        try {
            if (progressId) {
                await updateProgress(progressId, 'audio', `Generating audio for article ${i + 1}/${articles.length}...`, 30 + (i / articles.length) * 20);
            }
            await (0, newsAudioGenerator_1.generateBatchAudio)(article);
            result.audioSuccess++;
        }
        catch (audioError) {
            result.audioFailed++;
            logger.error('[PreCache] Audio generation failed', { articleId: article.id });
        }
    }
    // STAGE 3: Translation Generation (50-75%)
    if (progressId) {
        await updateProgress(progressId, 'translation', 'Generating translations...', 55);
    }
    try {
        const translationResults = await (0, translationPreGenerator_1.generateBatchTranslations)(articles);
        result.translationSuccess = translationResults.successCount;
        result.translationFailed = translationResults.failureCount;
        result.totalCost += translationResults.totalCost;
        if (progressId) {
            await updateProgress(progressId, 'translation', `Translated ${translationResults.successCount} segment(s)`, 75);
        }
    }
    catch (translationError) {
        result.translationFailed = articles.length;
        logger.error('[PreCache] Translation generation failed');
    }
    // STAGE 4: Word Explanation Generation (75-100%)
    if (progressId) {
        await updateProgress(progressId, 'words', 'Generating word explanations...', 80);
    }
    try {
        const articlesWithWords = articles.map(article => {
            const words = (0, wordExtractor_1.extractTopWords)(article.content, 100);
            return {
                id: article.id,
                content: article.content,
                words: words.words,
            };
        });
        if (progressId) {
            const totalWords = articlesWithWords.reduce((sum, a) => sum + a.words.length, 0);
            await updateProgress(progressId, 'words', `Processing ${totalWords} words...`, 85);
        }
        const wordResults = await (0, wordExplanationPreGenerator_1.generateBatchWordExplanations)(articlesWithWords);
        result.wordExplanationSuccess = wordResults.successCount;
        result.wordExplanationFailed = wordResults.failureCount;
        result.totalCost += wordResults.totalCost;
        if (progressId) {
            await updateProgress(progressId, 'words', `Generated ${wordResults.totalWords} word explanations`, 95);
        }
    }
    catch (wordError) {
        result.wordExplanationFailed = articles.length;
        logger.error('[PreCache] Word explanation generation failed');
    }
    return result;
}
// Export functions for different triggers
exports.scheduledNewsScraperFunction = (0, scheduler_1.onSchedule)({
    schedule: '0 12 * * *', // Once daily at 12:00 JST (noon)
    timeZone: 'Asia/Tokyo', // Japan time
    memory: '2GiB', // Increased from 1GiB for better performance
    timeoutSeconds: 540, // 9 minutes
    retryCount: 2, // Retry up to 2 times on failure
    secrets: [MODAL_API_KEY, OPENAI_API_KEY, RESEND_API_KEY], // MODAL_API_KEY used for VOICEVOX TTS + NHK API, RESEND for alerts
}, async (event) => {
    logger.info('[NewsScheduler] Scheduled trigger activated', {
        scheduleTime: event.scheduleTime,
        jobName: event.jobName,
    });
    await scheduledNewsScraper();
});
exports.manualNewsScraperFunction = (0, https_1.onCall)({
    memory: '2GiB', // Increased from 1GiB for better performance
    timeoutSeconds: 540,
    invoker: 'public', // Allow public invocation (auth checked via admin key inside)
    secrets: [MODAL_API_KEY, OPENAI_API_KEY], // MODAL_API_KEY used for VOICEVOX TTS + NHK API
}, async (request) => {
    return manualNewsScraper(request.data, request);
});
//# sourceMappingURL=newsScheduler.js.map