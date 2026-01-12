"use strict";
/**
 * Story Word Batch Manager
 * Manages batch processing for story word explanations to avoid Cloud Functions timeout
 *
 * Architecture:
 * - Batch Size: 20 words per batch (27s/word × 20 = 540s = 9 min - fits within timeout)
 * - Queue Storage: Firestore story_word_batches collection
 * - Progress Tracking: Real-time updates in story document
 * - Pub/Sub Coordination: Each batch triggers next via Pub/Sub message
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
exports.getCurrentBatch = getCurrentBatch;
exports.markBatchProcessing = markBatchProcessing;
exports.markBatchComplete = markBatchComplete;
exports.markBatchFailed = markBatchFailed;
exports.getProgress = getProgress;
exports.isComplete = isComplete;
exports.cleanupBatchQueue = cleanupBatchQueue;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const db = admin.firestore();
// Batch configuration based on comics performance data
// 27 words took 729s (~27s/word). 10 words keeps us well under 9 min with overhead.
const BATCH_SIZE = 10;
/**
 * Create batch queue from extracted words
 */
async function createBatchQueue(storyId, words) {
    const batches = [];
    const totalWords = words.length;
    const totalBatches = Math.ceil(totalWords / BATCH_SIZE);
    // Split words into batches
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
        storyId,
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
    // Store in Firestore
    await db.collection('story_word_batches').doc(storyId).set(batchQueue);
    logger.info('[StoryBatchManager] Batch queue created', {
        storyId,
        totalWords,
        totalBatches,
        batchSize: BATCH_SIZE,
    });
    return batchQueue;
}
/**
 * Get batch queue for a story
 */
async function getBatchQueue(storyId) {
    const doc = await db.collection('story_word_batches').doc(storyId).get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}
/**
 * Get current batch to process
 */
async function getCurrentBatch(storyId) {
    const queue = await getBatchQueue(storyId);
    if (!queue) {
        logger.warn('[StoryBatchManager] No batch queue found', { storyId });
        return null;
    }
    const batch = queue.batches.find(b => b.batchNumber === queue.currentBatch);
    if (!batch) {
        logger.error('[StoryBatchManager] Current batch not found', {
            storyId,
            currentBatch: queue.currentBatch,
        });
        return null;
    }
    return batch;
}
/**
 * Mark batch as processing
 */
async function markBatchProcessing(storyId, batchNumber) {
    const queue = await getBatchQueue(storyId);
    if (!queue) {
        throw new Error('Batch queue not found');
    }
    const batchIdx = queue.batches.findIndex(b => b.batchNumber === batchNumber);
    if (batchIdx === -1) {
        throw new Error(`Batch ${batchNumber} not found`);
    }
    queue.batches[batchIdx].status = 'processing';
    queue.batches[batchIdx].startedAt = admin.firestore.Timestamp.now();
    queue.lastUpdatedAt = admin.firestore.Timestamp.now();
    await db.collection('story_word_batches').doc(storyId).update({
        batches: queue.batches,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.info('[StoryBatchManager] Batch marked as processing', {
        storyId,
        batchNumber,
    });
}
/**
 * Mark batch as complete and update progress
 */
async function markBatchComplete(storyId, batchNumber, wordsGenerated) {
    const queue = await getBatchQueue(storyId);
    if (!queue) {
        throw new Error('Batch queue not found');
    }
    const batchIdx = queue.batches.findIndex(b => b.batchNumber === batchNumber);
    if (batchIdx === -1) {
        throw new Error(`Batch ${batchNumber} not found`);
    }
    // Update batch status
    queue.batches[batchIdx].status = 'complete';
    queue.batches[batchIdx].completedAt = admin.firestore.Timestamp.now();
    // Update queue progress
    queue.completedBatches += 1;
    queue.completedWords += wordsGenerated;
    queue.currentBatch = batchNumber + 1;
    queue.lastUpdatedAt = admin.firestore.Timestamp.now();
    // Check if all batches complete
    if (queue.completedBatches >= queue.totalBatches) {
        queue.status = 'complete';
    }
    await db.collection('story_word_batches').doc(storyId).update({
        batches: queue.batches,
        completedBatches: queue.completedBatches,
        completedWords: queue.completedWords,
        currentBatch: queue.currentBatch,
        status: queue.status,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const progress = {
        totalBatches: queue.totalBatches,
        completedBatches: queue.completedBatches,
        totalWords: queue.totalWords,
        completedWords: queue.completedWords,
        currentBatch: queue.currentBatch,
        percentComplete: Math.round((queue.completedWords / queue.totalWords) * 100),
    };
    logger.info('[StoryBatchManager] Batch marked as complete', {
        storyId,
        batchNumber,
        wordsGenerated,
        progress,
    });
    return progress;
}
/**
 * Mark batch as failed
 */
async function markBatchFailed(storyId, batchNumber, errorMessage) {
    const queue = await getBatchQueue(storyId);
    if (!queue) {
        throw new Error('Batch queue not found');
    }
    const batchIdx = queue.batches.findIndex(b => b.batchNumber === batchNumber);
    if (batchIdx === -1) {
        throw new Error(`Batch ${batchNumber} not found`);
    }
    queue.batches[batchIdx].status = 'failed';
    queue.batches[batchIdx].errorMessage = errorMessage;
    queue.status = 'failed';
    queue.lastUpdatedAt = admin.firestore.Timestamp.now();
    await db.collection('story_word_batches').doc(storyId).update({
        batches: queue.batches,
        status: 'failed',
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.error('[StoryBatchManager] Batch marked as failed', {
        storyId,
        batchNumber,
        errorMessage,
    });
}
/**
 * Get progress for a story
 */
async function getProgress(storyId) {
    const queue = await getBatchQueue(storyId);
    if (!queue) {
        return null;
    }
    return {
        totalBatches: queue.totalBatches,
        completedBatches: queue.completedBatches,
        totalWords: queue.totalWords,
        completedWords: queue.completedWords,
        currentBatch: queue.currentBatch,
        percentComplete: Math.round((queue.completedWords / queue.totalWords) * 100),
    };
}
/**
 * Check if all batches are complete
 */
async function isComplete(storyId) {
    const queue = await getBatchQueue(storyId);
    if (!queue) {
        return false;
    }
    return queue.status === 'complete';
}
/**
 * Clean up batch queue after completion
 */
async function cleanupBatchQueue(storyId) {
    await db.collection('story_word_batches').doc(storyId).delete();
    logger.info('[StoryBatchManager] Batch queue cleaned up', { storyId });
}
//# sourceMappingURL=storyWordBatchManager.js.map