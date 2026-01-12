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

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { ExtractedWord } from './wordExtractor'

const db = admin.firestore()

// Batch configuration based on comics performance data
// 27 words took 729s (~27s/word). 10 words keeps us well under 9 min with overhead.
const BATCH_SIZE = 10

export interface WordBatch {
  batchNumber: number
  words: ExtractedWord[]
  status: 'pending' | 'processing' | 'complete' | 'failed'
  startedAt?: admin.firestore.Timestamp
  completedAt?: admin.firestore.Timestamp
  errorMessage?: string
}

export interface BatchQueue {
  storyId: string
  totalBatches: number
  totalWords: number
  completedBatches: number
  completedWords: number
  currentBatch: number
  batches: WordBatch[]
  createdAt: admin.firestore.Timestamp
  lastUpdatedAt: admin.firestore.Timestamp
  status: 'processing' | 'complete' | 'failed'
}

export interface BatchProgress {
  totalBatches: number
  completedBatches: number
  totalWords: number
  completedWords: number
  currentBatch: number
  percentComplete: number
}

/**
 * Create batch queue from extracted words
 */
export async function createBatchQueue(
  storyId: string,
  words: ExtractedWord[]
): Promise<BatchQueue> {
  const batches: WordBatch[] = []
  const totalWords = words.length
  const totalBatches = Math.ceil(totalWords / BATCH_SIZE)

  // Split words into batches
  for (let i = 0; i < totalBatches; i++) {
    const startIdx = i * BATCH_SIZE
    const endIdx = Math.min(startIdx + BATCH_SIZE, totalWords)
    const batchWords = words.slice(startIdx, endIdx)

    batches.push({
      batchNumber: i + 1,
      words: batchWords,
      status: 'pending',
    })
  }

  const batchQueue: BatchQueue = {
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
  }

  // Store in Firestore
  await db.collection('story_word_batches').doc(storyId).set(batchQueue)

  logger.info('[StoryBatchManager] Batch queue created', {
    storyId,
    totalWords,
    totalBatches,
    batchSize: BATCH_SIZE,
  })

  return batchQueue
}

/**
 * Get batch queue for a story
 */
export async function getBatchQueue(storyId: string): Promise<BatchQueue | null> {
  const doc = await db.collection('story_word_batches').doc(storyId).get()

  if (!doc.exists) {
    return null
  }

  return doc.data() as BatchQueue
}

/**
 * Get current batch to process
 */
export async function getCurrentBatch(storyId: string): Promise<WordBatch | null> {
  const queue = await getBatchQueue(storyId)

  if (!queue) {
    logger.warn('[StoryBatchManager] No batch queue found', { storyId })
    return null
  }

  const batch = queue.batches.find(b => b.batchNumber === queue.currentBatch)

  if (!batch) {
    logger.error('[StoryBatchManager] Current batch not found', {
      storyId,
      currentBatch: queue.currentBatch,
    })
    return null
  }

  return batch
}

/**
 * Mark batch as processing
 */
export async function markBatchProcessing(
  storyId: string,
  batchNumber: number
): Promise<void> {
  const queue = await getBatchQueue(storyId)

  if (!queue) {
    throw new Error('Batch queue not found')
  }

  const batchIdx = queue.batches.findIndex(b => b.batchNumber === batchNumber)

  if (batchIdx === -1) {
    throw new Error(`Batch ${batchNumber} not found`)
  }

  queue.batches[batchIdx].status = 'processing'
  queue.batches[batchIdx].startedAt = admin.firestore.Timestamp.now()
  queue.lastUpdatedAt = admin.firestore.Timestamp.now()

  await db.collection('story_word_batches').doc(storyId).update({
    batches: queue.batches,
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  logger.info('[StoryBatchManager] Batch marked as processing', {
    storyId,
    batchNumber,
  })
}

/**
 * Mark batch as complete and update progress
 */
export async function markBatchComplete(
  storyId: string,
  batchNumber: number,
  wordsGenerated: number
): Promise<BatchProgress> {
  const queue = await getBatchQueue(storyId)

  if (!queue) {
    throw new Error('Batch queue not found')
  }

  const batchIdx = queue.batches.findIndex(b => b.batchNumber === batchNumber)

  if (batchIdx === -1) {
    throw new Error(`Batch ${batchNumber} not found`)
  }

  // Update batch status
  queue.batches[batchIdx].status = 'complete'
  queue.batches[batchIdx].completedAt = admin.firestore.Timestamp.now()

  // Update queue progress
  queue.completedBatches += 1
  queue.completedWords += wordsGenerated
  queue.currentBatch = batchNumber + 1
  queue.lastUpdatedAt = admin.firestore.Timestamp.now()

  // Check if all batches complete
  if (queue.completedBatches >= queue.totalBatches) {
    queue.status = 'complete'
  }

  await db.collection('story_word_batches').doc(storyId).update({
    batches: queue.batches,
    completedBatches: queue.completedBatches,
    completedWords: queue.completedWords,
    currentBatch: queue.currentBatch,
    status: queue.status,
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  const progress: BatchProgress = {
    totalBatches: queue.totalBatches,
    completedBatches: queue.completedBatches,
    totalWords: queue.totalWords,
    completedWords: queue.completedWords,
    currentBatch: queue.currentBatch,
    percentComplete: Math.round((queue.completedWords / queue.totalWords) * 100),
  }

  logger.info('[StoryBatchManager] Batch marked as complete', {
    storyId,
    batchNumber,
    wordsGenerated,
    progress,
  })

  return progress
}

/**
 * Mark batch as failed
 */
export async function markBatchFailed(
  storyId: string,
  batchNumber: number,
  errorMessage: string
): Promise<void> {
  const queue = await getBatchQueue(storyId)

  if (!queue) {
    throw new Error('Batch queue not found')
  }

  const batchIdx = queue.batches.findIndex(b => b.batchNumber === batchNumber)

  if (batchIdx === -1) {
    throw new Error(`Batch ${batchNumber} not found`)
  }

  queue.batches[batchIdx].status = 'failed'
  queue.batches[batchIdx].errorMessage = errorMessage
  queue.status = 'failed'
  queue.lastUpdatedAt = admin.firestore.Timestamp.now()

  await db.collection('story_word_batches').doc(storyId).update({
    batches: queue.batches,
    status: 'failed',
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  logger.error('[StoryBatchManager] Batch marked as failed', {
    storyId,
    batchNumber,
    errorMessage,
  })
}

/**
 * Get progress for a story
 */
export async function getProgress(storyId: string): Promise<BatchProgress | null> {
  const queue = await getBatchQueue(storyId)

  if (!queue) {
    return null
  }

  return {
    totalBatches: queue.totalBatches,
    completedBatches: queue.completedBatches,
    totalWords: queue.totalWords,
    completedWords: queue.completedWords,
    currentBatch: queue.currentBatch,
    percentComplete: Math.round((queue.completedWords / queue.totalWords) * 100),
  }
}

/**
 * Check if all batches are complete
 */
export async function isComplete(storyId: string): Promise<boolean> {
  const queue = await getBatchQueue(storyId)

  if (!queue) {
    return false
  }

  return queue.status === 'complete'
}

/**
 * Clean up batch queue after completion
 */
export async function cleanupBatchQueue(storyId: string): Promise<void> {
  await db.collection('story_word_batches').doc(storyId).delete()

  logger.info('[StoryBatchManager] Batch queue cleaned up', { storyId })
}
