"use strict";
/**
 * Backfill Sentence Data Script
 * One-time script to generate sentence-level audio and translations
 * for existing articles, stories, and books in Firebase
 *
 * Usage:
 * - Deploy and call via HTTP: POST /backfillSentenceData
 * - Pass contentType: 'articles' | 'stories' | 'books' | 'all'
 * - Optional: pass specific IDs to process only those items
 */
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
exports.backfillSentenceData = void 0;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const sentencePreGenerator_1 = require("../utils/sentencePreGenerator");
// Define secrets
const MODAL_API_KEY = (0, params_1.defineSecret)('MODAL_API_KEY');
// Initialize Firestore
const db = admin.firestore();
// ============================================
// Article Backfill
// ============================================
async function backfillArticles(ids, skipExisting = true, dryRun = false) {
    var _a;
    const result = {
        contentType: 'articles',
        totalItems: 0,
        processedItems: 0,
        skippedItems: 0,
        failedItems: 0,
        details: [],
    };
    try {
        // Get articles to process
        let articlesQuery = db.collection('news_articles');
        if (ids && ids.length > 0) {
            // Process specific articles
            articlesQuery = articlesQuery.where(admin.firestore.FieldPath.documentId(), 'in', ids);
        }
        const articlesSnapshot = await articlesQuery.get();
        result.totalItems = articlesSnapshot.size;
        logger.info('[Backfill] Found articles to process', {
            total: result.totalItems,
            specificIds: (ids === null || ids === void 0 ? void 0 : ids.length) || 0,
        });
        for (const articleDoc of articlesSnapshot.docs) {
            const articleId = articleDoc.id;
            const articleData = articleDoc.data();
            try {
                // Check if already has sentence data
                if (skipExisting) {
                    const translationDoc = await db
                        .collection('news_article_translations')
                        .doc(articleId)
                        .get();
                    if (translationDoc.exists &&
                        ((_a = translationDoc.data()) === null || _a === void 0 ? void 0 : _a.sentences) &&
                        translationDoc.data().sentences.length > 0) {
                        logger.info('[Backfill] Skipping article with existing sentences', { articleId });
                        result.skippedItems++;
                        result.details.push({
                            id: articleId,
                            status: 'skipped',
                            sentenceCount: translationDoc.data().sentences.length,
                        });
                        continue;
                    }
                }
                // Check for content
                if (!articleData.content || articleData.content.trim().length === 0) {
                    logger.warn('[Backfill] Article has no content', { articleId });
                    result.skippedItems++;
                    result.details.push({
                        id: articleId,
                        status: 'skipped',
                        error: 'No content',
                    });
                    continue;
                }
                if (dryRun) {
                    // Count sentences without processing
                    const sentenceCount = (articleData.content.match(/。/g) || []).length + 1;
                    result.details.push({
                        id: articleId,
                        status: 'processed',
                        sentenceCount,
                    });
                    result.processedItems++;
                    continue;
                }
                // Generate sentence data
                logger.info('[Backfill] Processing article', {
                    articleId,
                    contentLength: articleData.content.length,
                });
                await (0, sentencePreGenerator_1.preGenerateArticleSentences)(articleId, articleData.content);
                result.processedItems++;
                result.details.push({
                    id: articleId,
                    status: 'processed',
                });
                // Small delay between articles to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            catch (error) {
                logger.error('[Backfill] Error processing article', {
                    articleId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                result.failedItems++;
                result.details.push({
                    id: articleId,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        return result;
    }
    catch (error) {
        logger.error('[Backfill] Fatal error in article backfill', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
// ============================================
// Story Backfill
// ============================================
async function backfillStories(ids, skipExisting = true, dryRun = false) {
    var _a;
    const result = {
        contentType: 'stories',
        totalItems: 0,
        processedItems: 0,
        skippedItems: 0,
        failedItems: 0,
        details: [],
    };
    try {
        let storiesQuery = db.collection('stories');
        if (ids && ids.length > 0) {
            storiesQuery = storiesQuery.where(admin.firestore.FieldPath.documentId(), 'in', ids);
        }
        const storiesSnapshot = await storiesQuery.get();
        result.totalItems = storiesSnapshot.size;
        logger.info('[Backfill] Found stories to process', { total: result.totalItems });
        for (const storyDoc of storiesSnapshot.docs) {
            const storyId = storyDoc.id;
            const storyData = storyDoc.data();
            try {
                // Check if already has sentence data
                if (skipExisting) {
                    const sentenceDoc = await db.collection('story_sentence_data').doc(storyId).get();
                    if (sentenceDoc.exists &&
                        ((_a = sentenceDoc.data()) === null || _a === void 0 ? void 0 : _a.pages) &&
                        sentenceDoc.data().pages.length > 0) {
                        logger.info('[Backfill] Skipping story with existing sentences', { storyId });
                        result.skippedItems++;
                        result.details.push({
                            id: storyId,
                            status: 'skipped',
                        });
                        continue;
                    }
                }
                // Check for pages
                if (!storyData.pages || !Array.isArray(storyData.pages) || storyData.pages.length === 0) {
                    logger.warn('[Backfill] Story has no pages', { storyId });
                    result.skippedItems++;
                    result.details.push({
                        id: storyId,
                        status: 'skipped',
                        error: 'No pages',
                    });
                    continue;
                }
                // Extract page data
                const pages = storyData.pages
                    .map((page, index) => ({
                    pageNumber: page.pageNumber || index + 1,
                    text: page.text || '',
                }))
                    .filter((page) => page.text.length > 0);
                if (pages.length === 0) {
                    logger.warn('[Backfill] Story has no text content', { storyId });
                    result.skippedItems++;
                    result.details.push({
                        id: storyId,
                        status: 'skipped',
                        error: 'No text content',
                    });
                    continue;
                }
                if (dryRun) {
                    const totalSentences = pages.reduce((acc, p) => acc + (p.text.match(/。/g) || []).length + 1, 0);
                    result.details.push({
                        id: storyId,
                        status: 'processed',
                        sentenceCount: totalSentences,
                    });
                    result.processedItems++;
                    continue;
                }
                logger.info('[Backfill] Processing story', {
                    storyId,
                    pageCount: pages.length,
                });
                await (0, sentencePreGenerator_1.preGenerateStorySentences)(storyId, pages);
                result.processedItems++;
                result.details.push({
                    id: storyId,
                    status: 'processed',
                });
                // Delay between stories
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            catch (error) {
                logger.error('[Backfill] Error processing story', {
                    storyId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                result.failedItems++;
                result.details.push({
                    id: storyId,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        return result;
    }
    catch (error) {
        logger.error('[Backfill] Fatal error in story backfill', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
// ============================================
// Book Backfill
// ============================================
async function backfillBooks(ids, skipExisting = true, dryRun = false) {
    var _a;
    const result = {
        contentType: 'books',
        totalItems: 0,
        processedItems: 0,
        skippedItems: 0,
        failedItems: 0,
        details: [],
    };
    try {
        let booksQuery = db.collection('books');
        if (ids && ids.length > 0) {
            booksQuery = booksQuery.where(admin.firestore.FieldPath.documentId(), 'in', ids);
        }
        const booksSnapshot = await booksQuery.get();
        result.totalItems = booksSnapshot.size;
        logger.info('[Backfill] Found books to process', { total: result.totalItems });
        for (const bookDoc of booksSnapshot.docs) {
            const bookId = bookDoc.id;
            const bookData = bookDoc.data();
            try {
                // Check if already has sentence data
                if (skipExisting) {
                    const sentenceDoc = await db.collection('book_sentence_data').doc(bookId).get();
                    if (sentenceDoc.exists &&
                        ((_a = sentenceDoc.data()) === null || _a === void 0 ? void 0 : _a.sentences) &&
                        sentenceDoc.data().sentences.length > 0) {
                        logger.info('[Backfill] Skipping book with existing sentences', { bookId });
                        result.skippedItems++;
                        result.details.push({
                            id: bookId,
                            status: 'skipped',
                            sentenceCount: sentenceDoc.data().sentences.length,
                        });
                        continue;
                    }
                }
                // Check for content
                if (!bookData.content || bookData.content.trim().length === 0) {
                    logger.warn('[Backfill] Book has no content', { bookId });
                    result.skippedItems++;
                    result.details.push({
                        id: bookId,
                        status: 'skipped',
                        error: 'No content',
                    });
                    continue;
                }
                if (dryRun) {
                    const sentenceCount = (bookData.content.match(/。/g) || []).length + 1;
                    result.details.push({
                        id: bookId,
                        status: 'processed',
                        sentenceCount,
                    });
                    result.processedItems++;
                    continue;
                }
                logger.info('[Backfill] Processing book', {
                    bookId,
                    contentLength: bookData.content.length,
                });
                await (0, sentencePreGenerator_1.preGenerateBookSentences)(bookId, bookData.content);
                result.processedItems++;
                result.details.push({
                    id: bookId,
                    status: 'processed',
                });
                // Delay between books
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            catch (error) {
                logger.error('[Backfill] Error processing book', {
                    bookId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                result.failedItems++;
                result.details.push({
                    id: bookId,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        return result;
    }
    catch (error) {
        logger.error('[Backfill] Fatal error in book backfill', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
// ============================================
// Main Export - Callable Function
// ============================================
exports.backfillSentenceData = (0, https_1.onCall)({
    region: 'asia-northeast1',
    memory: '1GiB',
    timeoutSeconds: 3600, // 1 hour timeout for large backfills
    secrets: [MODAL_API_KEY],
}, async (request) => {
    // Verify caller is admin (optional - add your own auth check)
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be authenticated to run backfill');
    }
    // Get request data
    const data = request.data;
    const contentType = (data === null || data === void 0 ? void 0 : data.contentType) || 'all';
    const ids = data === null || data === void 0 ? void 0 : data.ids;
    const skipExisting = (data === null || data === void 0 ? void 0 : data.skipExisting) !== false; // Default true
    const dryRun = (data === null || data === void 0 ? void 0 : data.dryRun) === true; // Default false
    logger.info('[Backfill] Starting sentence data backfill', {
        contentType,
        specificIds: (ids === null || ids === void 0 ? void 0 : ids.length) || 0,
        skipExisting,
        dryRun,
        calledBy: request.auth.uid,
    });
    const results = [];
    try {
        // Process articles
        if (contentType === 'articles' || contentType === 'all') {
            const articleResult = await backfillArticles(contentType === 'articles' ? ids : undefined, skipExisting, dryRun);
            results.push(articleResult);
            logger.info('[Backfill] Article backfill complete', articleResult);
        }
        // Process stories
        if (contentType === 'stories' || contentType === 'all') {
            const storyResult = await backfillStories(contentType === 'stories' ? ids : undefined, skipExisting, dryRun);
            results.push(storyResult);
            logger.info('[Backfill] Story backfill complete', storyResult);
        }
        // Process books
        if (contentType === 'books' || contentType === 'all') {
            const bookResult = await backfillBooks(contentType === 'books' ? ids : undefined, skipExisting, dryRun);
            results.push(bookResult);
            logger.info('[Backfill] Book backfill complete', bookResult);
        }
        // Calculate totals
        const summary = {
            totalItems: results.reduce((acc, r) => acc + r.totalItems, 0),
            processedItems: results.reduce((acc, r) => acc + r.processedItems, 0),
            skippedItems: results.reduce((acc, r) => acc + r.skippedItems, 0),
            failedItems: results.reduce((acc, r) => acc + r.failedItems, 0),
            dryRun,
        };
        logger.info('[Backfill] All backfills complete', summary);
        return {
            success: true,
            summary,
            results,
        };
    }
    catch (error) {
        logger.error('[Backfill] Backfill failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new https_1.HttpsError('internal', `Backfill failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
//# sourceMappingURL=backfillSentenceData.js.map