"use strict";
/**
 * Book Word Batch Manager
 * Manages batch processing for book word explanations to avoid timeouts
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
exports.createBatchQueue = createBatchQueue;
exports.getBatchQueue = getBatchQueue;
exports.markBatchProcessing = markBatchProcessing;
exports.markBatchComplete = markBatchComplete;
exports.markBatchFailed = markBatchFailed;
exports.isComplete = isComplete;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const db = admin.firestore();
// Keep batches small to stay well under function timeout
const BATCH_SIZE = 10;
async function createBatchQueue(bookId, words) {
    const batches = [];
    const totalWords = words.length;
    const totalBatches = Math.ceil(totalWords / BATCH_SIZE);
    for (let i = 0; i < totalBatches; i++) {
        const startIdx = i * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, totalWords);
        const batchWords = words.slice(startIdx, endIdx);
        batches.push({
            batchNumber: i + 1,
            words: batchWords,
            status: 'pending',
        });
    }
    const batchQueue = {
        bookId,
        totalBatches,
        totalWords,
        completedBatches: 0,
        completedWords: 0,
        currentBatch: 1,
        batches,
        createdAt: admin.firestore.Timestamp.now(),
        lastUpdatedAt: admin.firestore.Timestamp.now(),
        status: 'processing',
    };
    await db.collection('book_word_batches').doc(bookId).set(batchQueue);
    logger.info('[BookBatchManager] Batch queue created', {
        bookId,
        totalWords,
        totalBatches,
        batchSize: BATCH_SIZE,
    });
    return batchQueue;
}
async function getBatchQueue(bookId) {
    const doc = await db.collection('book_word_batches').doc(bookId).get();
    if (!doc.exists)
        return null;
    return doc.data();
}
async function markBatchProcessing(bookId, batchNumber) {
    const queue = await getBatchQueue(bookId);
    if (!queue)
        throw new Error('Batch queue not found');
    const batchIdx = queue.batches.findIndex(b => b.batchNumber === batchNumber);
    if (batchIdx === -1)
        throw new Error(`Batch ${batchNumber} not found`);
    queue.batches[batchIdx].status = 'processing';
    queue.batches[batchIdx].startedAt = admin.firestore.Timestamp.now();
    queue.lastUpdatedAt = admin.firestore.Timestamp.now();
    await db.collection('book_word_batches').doc(bookId).update({
        batches: queue.batches,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
async function markBatchComplete(bookId, batchNumber, wordsGenerated) {
    const queue = await getBatchQueue(bookId);
    if (!queue)
        throw new Error('Batch queue not found');
    const batchIdx = queue.batches.findIndex(b => b.batchNumber === batchNumber);
    if (batchIdx === -1)
        throw new Error(`Batch ${batchNumber} not found`);
    queue.batches[batchIdx].status = 'complete';
    queue.batches[batchIdx].completedAt = admin.firestore.Timestamp.now();
    queue.completedBatches += 1;
    queue.completedWords += wordsGenerated;
    queue.currentBatch = batchNumber + 1;
    queue.lastUpdatedAt = admin.firestore.Timestamp.now();
    if (queue.completedBatches >= queue.totalBatches) {
        queue.status = 'complete';
    }
    await db.collection('book_word_batches').doc(bookId).update({
        batches: queue.batches,
        completedBatches: queue.completedBatches,
        completedWords: queue.completedWords,
        currentBatch: queue.currentBatch,
        status: queue.status,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
        totalBatches: queue.totalBatches,
        completedBatches: queue.completedBatches,
        totalWords: queue.totalWords,
        completedWords: queue.completedWords,
        currentBatch: queue.currentBatch,
        percentComplete: Math.round((queue.completedWords / queue.totalWords) * 100),
    };
}
async function markBatchFailed(bookId, batchNumber, errorMessage) {
    const queue = await getBatchQueue(bookId);
    if (!queue)
        throw new Error('Batch queue not found');
    const batchIdx = queue.batches.findIndex(b => b.batchNumber === batchNumber);
    if (batchIdx === -1)
        throw new Error(`Batch ${batchNumber} not found`);
    queue.batches[batchIdx].status = 'failed';
    queue.batches[batchIdx].errorMessage = errorMessage;
    queue.status = 'failed';
    queue.lastUpdatedAt = admin.firestore.Timestamp.now();
    await db.collection('book_word_batches').doc(bookId).update({
        batches: queue.batches,
        status: 'failed',
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
async function isComplete(bookId) {
    const queue = await getBatchQueue(bookId);
    if (!queue)
        return false;
    return queue.status === 'complete';
}
//# sourceMappingURL=bookWordBatchManager.js.map