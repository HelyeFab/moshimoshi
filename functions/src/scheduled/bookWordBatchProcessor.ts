/**
 * Book Word Batch Processor
 * Pub/Sub-triggered function that processes book word explanation batches
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { onMessagePublished } from 'firebase-functions/v2/pubsub'
import { defineSecret } from 'firebase-functions/params'
import { PubSub } from '@google-cloud/pubsub'
import crypto from 'crypto'
import {
  getBatchQueue,
  markBatchProcessing,
  markBatchComplete,
  markBatchFailed,
  isComplete,
} from '../utils/bookWordBatchManager'
import { generateWordExplanation, WordExplanation } from '../utils/storyWordExplanationPreGenerator'
import { ExtractedWord } from '../utils/wordExtractor'

const db = admin.firestore()
const pubsub = new PubSub()
const MODAL_API_KEY = defineSecret('MODAL_API_KEY')
const PRECOMPUTE_VERSION = 'v2_all_tokens'

interface BatchMessage {
  bookId: string
  batchNumber: number
}

const BATCH_TOPIC = 'book-word-batch-processing'

function hashWord(word: string): string {
  return crypto.createHash('sha256').update(word.trim().toLowerCase()).digest('hex')
}

async function getBatchCache(
  words: ExtractedWord[]
): Promise<Map<string, WordExplanation>> {
  const cache = new Map<string, WordExplanation>()
  if (words.length === 0) return cache

  const docRefs = words.map(word =>
    db.collection('wordExplanationCache').doc(hashWord(word.word))
  )
  const docs = await db.getAll(...docRefs)

  docs.forEach((doc, idx) => {
    if (!doc.exists) return
    const data = doc.data() as { explanation?: WordExplanation }
    if (data?.explanation) {
      cache.set(words[idx].word.trim().toLowerCase(), data.explanation)
    }
  })

  return cache
}

export const processBookWordBatch = onMessagePublished(
  {
    topic: BATCH_TOPIC,
    secrets: [MODAL_API_KEY],
    memory: '1GiB',
    timeoutSeconds: 540,
    retry: true,
  },
  async event => {
    const message = event.data.message
    const data = message.json as BatchMessage
    const { bookId, batchNumber } = data

    logger.info('[BookBatchProcessor] Processing batch', {
      bookId,
      batchNumber,
    })

    try {
      const queue = await getBatchQueue(bookId)
      if (!queue) {
        logger.error('[BookBatchProcessor] Batch queue not found', { bookId })
        return
      }

      const batch = queue.batches.find(b => b.batchNumber === batchNumber)
      if (!batch) {
        logger.error('[BookBatchProcessor] Batch not found', { bookId, batchNumber })
        return
      }

      await markBatchProcessing(bookId, batchNumber)

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
      })

      const bookDoc = await db.collection('books').doc(bookId).get()
      const book = bookDoc.data()
      const context = book?.content ? String(book.content).substring(0, 500) : undefined

      const cacheMap = await getBatchCache(batch.words)

      const explanations: WordExplanation[] = []
      let totalPromptTokens = 0
      let totalCompletionTokens = 0
      let totalTokens = 0

      for (const word of batch.words) {
        try {
          const cached = cacheMap.get(word.word.trim().toLowerCase())
          if (cached) {
            explanations.push(cached)
            continue
          }

          const { explanation, usage } = await generateWordExplanation(word, context)
          explanations.push(explanation)
          totalPromptTokens += usage.promptTokens
          totalCompletionTokens += usage.completionTokens
          totalTokens += usage.totalTokens
        } catch (error) {
          logger.error('[BookBatchProcessor] Failed to generate word explanation', {
            bookId,
            batchNumber,
            word: word.word,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      const docRef = db.collection('book_word_explanations').doc(bookId)
      const existingDoc = await docRef.get()
      const existingData = existingDoc.exists ? existingDoc.data() : undefined
      const existingExplanations = existingData?.words || []
      const existingCostInfo = existingData?.costInfo || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      }
      const existingBatchNumbers: number[] = existingData?.batchNumbers || []
      const existingBatchWordCounts: Record<string, number> =
        existingData?.batchWordCounts || {}

      if (existingBatchNumbers.includes(batchNumber)) {
        const storedCount =
          existingBatchWordCounts[String(batchNumber)] ?? batch.words.length
        logger.warn('[BookBatchProcessor] Batch already stored, skipping append', {
          bookId,
          batchNumber,
          storedCount,
        })
        const progress = await markBatchComplete(bookId, batchNumber, storedCount)
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
        })

        if (await isComplete(bookId)) {
          await db.collection('books').doc(bookId).update({
            'metadata.wordExplanationsStatus': 'complete',
            'metadata.wordExplanationsCached': true,
            'metadata.wordExplanationsGeneratedAt': admin.firestore.FieldValue.serverTimestamp(),
            'metadata.wordProgress': null,
          })
          await db.collection('book_word_explanations').doc(bookId).set(
            {
              precomputeStatus: 'complete',
              precomputeVersion: PRECOMPUTE_VERSION,
              precomputeUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
        }

        return
      }

      await docRef.set(
        {
          bookId,
          words: [...existingExplanations, ...explanations],
          wordCount: existingExplanations.length + explanations.length,
          total: existingExplanations.length + explanations.length,
          batchNumbers: admin.firestore.FieldValue.arrayUnion(batchNumber),
          batchWordCounts: {
            ...existingBatchWordCounts,
            [batchNumber]: explanations.length,
          },
          costInfo: {
            promptTokens: existingCostInfo.promptTokens + totalPromptTokens,
            completionTokens: existingCostInfo.completionTokens + totalCompletionTokens,
            totalTokens: existingCostInfo.totalTokens + totalTokens,
            estimatedCost: 0,
          },
          ...(existingDoc.exists
            ? {}
            : { generatedAt: admin.firestore.FieldValue.serverTimestamp() }),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )

      const progress = await markBatchComplete(bookId, batchNumber, explanations.length)
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
      })

      if (await isComplete(bookId)) {
        await db.collection('books').doc(bookId).update({
          'metadata.wordExplanationsStatus': 'complete',
          'metadata.wordExplanationsCached': true,
          'metadata.wordExplanationsGeneratedAt': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.wordProgress': null,
        })
        await db.collection('book_word_explanations').doc(bookId).set(
          {
            precomputeStatus: 'complete',
            precomputeVersion: PRECOMPUTE_VERSION,
            precomputeUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
      } else {
        const nextBatchNumber = batchNumber + 1
        await pubsub.topic(BATCH_TOPIC).publishMessage({
          json: { bookId, batchNumber: nextBatchNumber },
        })
        logger.info('[BookBatchProcessor] Published next batch', {
          bookId,
          nextBatchNumber,
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('[BookBatchProcessor] Batch processing failed', {
        bookId,
        batchNumber,
        error: errorMessage,
      })
      await markBatchFailed(bookId, batchNumber, errorMessage)
      await db.collection('books').doc(bookId).update({
        'metadata.wordExplanationsStatus': 'failed',
        'metadata.wordExplanationsError': errorMessage,
        'metadata.wordExplanationsFailedAt': admin.firestore.FieldValue.serverTimestamp(),
      })
      throw error
    }
  }
)

export async function publishFirstBookBatch(bookId: string): Promise<void> {
  await pubsub.topic(BATCH_TOPIC).publishMessage({
    json: {
      bookId,
      batchNumber: 1,
    },
  })
  logger.info('[BookBatchProcessor] Published first batch message', {
    bookId,
    batchNumber: 1,
  })
}
