/**
 * Book Word Batch Manager
 * Manages batch processing for book word explanations to avoid timeouts
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { ExtractedWord } from './wordExtractor'

const db = admin.firestore()

// Keep batches small to stay well under function timeout
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
  bookId: string
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

export async function createBatchQueue(
  bookId: string,
  words: ExtractedWord[]
): Promise<BatchQueue> {
  const batches: WordBatch[] = []
  const totalWords = words.length
  const totalBatches = Math.ceil(totalWords / BATCH_SIZE)

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
  }

  await db.collection('book_word_batches').doc(bookId).set(batchQueue)

  logger.info('[BookBatchManager] Batch queue created', {
    bookId,
    totalWords,
    totalBatches,
    batchSize: BATCH_SIZE,
  })

  return batchQueue
}

export async function getBatchQueue(bookId: string): Promise<BatchQueue | null> {
  const doc = await db.collection('book_word_batches').doc(bookId).get()
  if (!doc.exists) return null
  return doc.data() as BatchQueue
}

export async function markBatchProcessing(
  bookId: string,
  batchNumber: number
): Promise<void> {
  const queue = await getBatchQueue(bookId)
  if (!queue) throw new Error('Batch queue not found')

  const batchIdx = queue.batches.findIndex(b => b.batchNumber === batchNumber)
  if (batchIdx === -1) throw new Error(`Batch ${batchNumber} not found`)

  queue.batches[batchIdx].status = 'processing'
  queue.batches[batchIdx].startedAt = admin.firestore.Timestamp.now()
  queue.lastUpdatedAt = admin.firestore.Timestamp.now()

  await db.collection('book_word_batches').doc(bookId).update({
    batches: queue.batches,
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

export async function markBatchComplete(
  bookId: string,
  batchNumber: number,
  wordsGenerated: number
): Promise<BatchProgress> {
  const queue = await getBatchQueue(bookId)
  if (!queue) throw new Error('Batch queue not found')

  const batchIdx = queue.batches.findIndex(b => b.batchNumber === batchNumber)
  if (batchIdx === -1) throw new Error(`Batch ${batchNumber} not found`)

  queue.batches[batchIdx].status = 'complete'
  queue.batches[batchIdx].completedAt = admin.firestore.Timestamp.now()

  queue.completedBatches += 1
  queue.completedWords += wordsGenerated
  queue.currentBatch = batchNumber + 1
  queue.lastUpdatedAt = admin.firestore.Timestamp.now()

  if (queue.completedBatches >= queue.totalBatches) {
    queue.status = 'complete'
  }

  await db.collection('book_word_batches').doc(bookId).update({
    batches: queue.batches,
    completedBatches: queue.completedBatches,
    completedWords: queue.completedWords,
    currentBatch: queue.currentBatch,
    status: queue.status,
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return {
    totalBatches: queue.totalBatches,
    completedBatches: queue.completedBatches,
    totalWords: queue.totalWords,
    completedWords: queue.completedWords,
    currentBatch: queue.currentBatch,
    percentComplete: Math.round((queue.completedWords / queue.totalWords) * 100),
  }
}

export async function markBatchFailed(
  bookId: string,
  batchNumber: number,
  errorMessage: string
): Promise<void> {
  const queue = await getBatchQueue(bookId)
  if (!queue) throw new Error('Batch queue not found')

  const batchIdx = queue.batches.findIndex(b => b.batchNumber === batchNumber)
  if (batchIdx === -1) throw new Error(`Batch ${batchNumber} not found`)

  queue.batches[batchIdx].status = 'failed'
  queue.batches[batchIdx].errorMessage = errorMessage
  queue.status = 'failed'
  queue.lastUpdatedAt = admin.firestore.Timestamp.now()

  await db.collection('book_word_batches').doc(bookId).update({
    batches: queue.batches,
    status: 'failed',
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

export async function isComplete(bookId: string): Promise<boolean> {
  const queue = await getBatchQueue(bookId)
  if (!queue) return false
  return queue.status === 'complete'
}
