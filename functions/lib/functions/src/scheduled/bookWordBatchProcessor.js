"use strict";
/**
 * Book Word Batch Processor
 * Pub/Sub-triggered function that processes book word explanation batches
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBookWordBatch = void 0;
exports.publishFirstBookBatch = publishFirstBookBatch;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const pubsub_1 = require("firebase-functions/v2/pubsub");
const params_1 = require("firebase-functions/params");
const pubsub_2 = require("@google-cloud/pubsub");
const crypto_1 = __importDefault(require("crypto"));
const bookWordBatchManager_1 = require("../utils/bookWordBatchManager");
const storyWordExplanationPreGenerator_1 = require("../utils/storyWordExplanationPreGenerator");
const db = admin.firestore();
const pubsub = new pubsub_2.PubSub();
const MODAL_API_KEY = (0, params_1.defineSecret)('MODAL_API_KEY');
const PRECOMPUTE_VERSION = 'v2_all_tokens';
const BATCH_TOPIC = 'book-word-batch-processing';
function hashWord(word) {
    return crypto_1.default.createHash('sha256').update(word.trim().toLowerCase()).digest('hex');
}
async function getBatchCache(words) {
    const cache = new Map();
    if (words.length === 0)
        return cache;
    const docRefs = words.map(word => db.collection('wordExplanationCache').doc(hashWord(word.word)));
    const docs = await db.getAll(...docRefs);
    docs.forEach((doc, idx) => {
        if (!doc.exists)
            return;
        const data = doc.data();
        if (data === null || data === void 0 ? void 0 : data.explanation) {
            cache.set(words[idx].word.trim().toLowerCase(), data.explanation);
        }
    });
    return cache;
}
exports.processBookWordBatch = (0, pubsub_1.onMessagePublished)({
    topic: BATCH_TOPIC,
    secrets: [MODAL_API_KEY],
    memory: '1GiB',
    timeoutSeconds: 540,
    retry: true,
}, async (event) => {
    var _a;
    const message = event.data.message;
    const data = message.json;
    const { bookId, batchNumber } = data;
    logger.info('[BookBatchProcessor] Processing batch', {
        bookId,
        batchNumber,
    });
    try {
        const queue = await (0, bookWordBatchManager_1.getBatchQueue)(bookId);
        if (!queue) {
            logger.error('[BookBatchProcessor] Batch queue not found', { bookId });
            return;
        }
        const batch = queue.batches.find(b => b.batchNumber === batchNumber);
        if (!batch) {
            logger.error('[BookBatchProcessor] Batch not found', { bookId, batchNumber });
            return;
        }
        await (0, bookWordBatchManager_1.markBatchProcessing)(bookId, batchNumber);
        // Update book progress
        await db.collection('books').doc(bookId).update({
            'metadata.wordExplanationsStatus': 'generating',
            'metadata.wordProgress': {
                totalBatches: queue.totalBatches,
                completedBatches: queue.completedBatches,
                totalWords: queue.totalWords,
                completedWords: queue.completedWords,
                currentBatch: batchNumber,
                percentComplete: Math.round((queue.completedWords / queue.totalWords) * 100),
            },
            'metadata.wordExplanationsLastUpdatedAt': admin.firestore.FieldValue.serverTimestamp(),
        });
        const bookDoc = await db.collection('books').doc(bookId).get();
        const book = bookDoc.data();
        const context = (book === null || book === void 0 ? void 0 : book.content) ? String(book.content).substring(0, 500) : undefined;
        const cacheMap = await getBatchCache(batch.words);
        const explanations = [];
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        let totalTokens = 0;
        for (const word of batch.words) {
            try {
                const cached = cacheMap.get(word.word.trim().toLowerCase());
                if (cached) {
                    explanations.push(cached);
                    continue;
                }
                const { explanation, usage } = await (0, storyWordExplanationPreGenerator_1.generateWordExplanation)(word, context);
                explanations.push(explanation);
                totalPromptTokens += usage.promptTokens;
                totalCompletionTokens += usage.completionTokens;
                totalTokens += usage.totalTokens;
            }
            catch (error) {
                logger.error('[BookBatchProcessor] Failed to generate word explanation', {
                    bookId,
                    batchNumber,
                    word: word.word,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        const docRef = db.collection('book_word_explanations').doc(bookId);
        const existingDoc = await docRef.get();
        const existingData = existingDoc.exists ? existingDoc.data() : undefined;
        const existingExplanations = (existingData === null || existingData === void 0 ? void 0 : existingData.words) || [];
        const existingCostInfo = (existingData === null || existingData === void 0 ? void 0 : existingData.costInfo) || {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
        };
        const existingBatchNumbers = (existingData === null || existingData === void 0 ? void 0 : existingData.batchNumbers) || [];
        const existingBatchWordCounts = (existingData === null || existingData === void 0 ? void 0 : existingData.batchWordCounts) || {};
        if (existingBatchNumbers.includes(batchNumber)) {
            const storedCount = (_a = existingBatchWordCounts[String(batchNumber)]) !== null && _a !== void 0 ? _a : batch.words.length;
            logger.warn('[BookBatchProcessor] Batch already stored, skipping append', {
                bookId,
                batchNumber,
                storedCount,
            });
            const progress = await (0, bookWordBatchManager_1.markBatchComplete)(bookId, batchNumber, storedCount);
            await db.collection('books').doc(bookId).update({
                'metadata.wordProgress': {
                    totalBatches: progress.totalBatches,
                    completedBatches: progress.completedBatches,
                    totalWords: progress.totalWords,
                    completedWords: progress.completedWords,
                    currentBatch: progress.currentBatch,
                    percentComplete: progress.percentComplete,
                },
                'metadata.wordExplanationsCount': progress.completedWords,
                'metadata.wordExplanationsLastUpdatedAt': admin.firestore.FieldValue.serverTimestamp(),
            });
            if (await (0, bookWordBatchManager_1.isComplete)(bookId)) {
                await db.collection('books').doc(bookId).update({
                    'metadata.wordExplanationsStatus': 'complete',
                    'metadata.wordExplanationsCached': true,
                    'metadata.wordExplanationsGeneratedAt': admin.firestore.FieldValue.serverTimestamp(),
                    'metadata.wordProgress': null,
                });
                await db.collection('book_word_explanations').doc(bookId).set({
                    precomputeStatus: 'complete',
                    precomputeVersion: PRECOMPUTE_VERSION,
                    precomputeUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            return;
        }
        await docRef.set(Object.assign(Object.assign({ bookId, words: [...existingExplanations, ...explanations], wordCount: existingExplanations.length + explanations.length, total: existingExplanations.length + explanations.length, batchNumbers: admin.firestore.FieldValue.arrayUnion(batchNumber), batchWordCounts: Object.assign(Object.assign({}, existingBatchWordCounts), { [batchNumber]: explanations.length }), costInfo: {
                promptTokens: existingCostInfo.promptTokens + totalPromptTokens,
                completionTokens: existingCostInfo.completionTokens + totalCompletionTokens,
                totalTokens: existingCostInfo.totalTokens + totalTokens,
                estimatedCost: 0,
            } }, (existingDoc.exists
            ? {}
            : { generatedAt: admin.firestore.FieldValue.serverTimestamp() })), { lastUpdated: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
        const progress = await (0, bookWordBatchManager_1.markBatchComplete)(bookId, batchNumber, explanations.length);
        await db.collection('books').doc(bookId).update({
            'metadata.wordProgress': {
                totalBatches: progress.totalBatches,
                completedBatches: progress.completedBatches,
                totalWords: progress.totalWords,
                completedWords: progress.completedWords,
                currentBatch: progress.currentBatch,
                percentComplete: progress.percentComplete,
            },
            'metadata.wordExplanationsCount': progress.completedWords,
            'metadata.wordExplanationsLastUpdatedAt': admin.firestore.FieldValue.serverTimestamp(),
        });
        if (await (0, bookWordBatchManager_1.isComplete)(bookId)) {
            await db.collection('books').doc(bookId).update({
                'metadata.wordExplanationsStatus': 'complete',
                'metadata.wordExplanationsCached': true,
                'metadata.wordExplanationsGeneratedAt': admin.firestore.FieldValue.serverTimestamp(),
                'metadata.wordProgress': null,
            });
            await db.collection('book_word_explanations').doc(bookId).set({
                precomputeStatus: 'complete',
                precomputeVersion: PRECOMPUTE_VERSION,
                precomputeUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        else {
            const nextBatchNumber = batchNumber + 1;
            await pubsub.topic(BATCH_TOPIC).publishMessage({
                json: { bookId, batchNumber: nextBatchNumber },
            });
            logger.info('[BookBatchProcessor] Published next batch', {
                bookId,
                nextBatchNumber,
            });
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[BookBatchProcessor] Batch processing failed', {
            bookId,
            batchNumber,
            error: errorMessage,
        });
        await (0, bookWordBatchManager_1.markBatchFailed)(bookId, batchNumber, errorMessage);
        await db.collection('books').doc(bookId).update({
            'metadata.wordExplanationsStatus': 'failed',
            'metadata.wordExplanationsError': errorMessage,
            'metadata.wordExplanationsFailedAt': admin.firestore.FieldValue.serverTimestamp(),
        });
        throw error;
    }
});
async function publishFirstBookBatch(bookId) {
    await pubsub.topic(BATCH_TOPIC).publishMessage({
        json: {
            bookId,
            batchNumber: 1,
        },
    });
    logger.info('[BookBatchProcessor] Published first batch message', {
        bookId,
        batchNumber: 1,
    });
}
//# sourceMappingURL=bookWordBatchProcessor.js.map