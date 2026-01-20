/**
 * Story Word Batch Processor
 * Pub/Sub-triggered function that processes word explanation batches
 *
 * Flow:
 * 1. Receives Pub/Sub message with storyId and batchNumber
 * 2. Loads batch from Firestore
 * 3. Generates word explanations for batch
 * 4. Stores results in story_word_explanations collection
 * 5. Updates progress in story document
 * 6. If more batches remain, publishes message for next batch
 * 7. If all complete, marks story as complete
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { onMessagePublished } from 'firebase-functions/v2/pubsub'
import { defineSecret } from 'firebase-functions/params'
import { PubSub } from '@google-cloud/pubsub'
import {
  getBatchQueue,
  getCurrentBatch,
  markBatchProcessing,
  markBatchComplete,
  markBatchFailed,
  isComplete,
} from '../utils/storyWordBatchManager'
import {
  generateWordExplanation,
  WordExplanation,
} from '../utils/storyWordExplanationPreGenerator'
import { ExtractedWord } from '../utils/wordExtractor'

const db = admin.firestore()
const pubsub = new PubSub()
const MODAL_API_KEY = defineSecret('MODAL_API_KEY')

interface BatchMessage {
  storyId: string
  batchNumber: number
}

/**
 * Pub/Sub topic for batch processing
 */
const BATCH_TOPIC = 'story-word-batch-processing'
const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID
const BATCH_TOPIC_NAME = PROJECT_ID
  ? `projects/${PROJECT_ID}/topics/${BATCH_TOPIC}`
  : BATCH_TOPIC

/**
 * Process a single batch of word explanations
 */
export const processStoryWordBatch = onMessagePublished(
  {
    topic: BATCH_TOPIC_NAME,
    secrets: [MODAL_API_KEY],
    memory: '1GiB',
    timeoutSeconds: 540, // 9 minutes - enough for 20 words at 27s/word
    retry: true,
  },
  async event => {
    const message = event.data.message
    const data = message.json as BatchMessage

    const { storyId, batchNumber } = data

    logger.info('[StoryBatchProcessor] Processing batch', {
      storyId,
      batchNumber,
    })

    try {
      // Get batch queue
      const queue = await getBatchQueue(storyId)

      if (!queue) {
        logger.error('[StoryBatchProcessor] Batch queue not found', { storyId })
        return
      }

      // Get current batch
      const batch = queue.batches.find(b => b.batchNumber === batchNumber)

      if (!batch) {
        logger.error('[StoryBatchProcessor] Batch not found', {
          storyId,
          batchNumber,
        })
        return
      }

      const maxBatchAttempts = queue.maxBatchAttempts ?? 3
      const attemptCount = batch.attemptCount ?? 0

      if (batch.status === 'complete') {
        logger.info('[StoryBatchProcessor] Batch already complete, skipping', {
          storyId,
          batchNumber,
        })
        return
      }

      if (attemptCount >= maxBatchAttempts) {
        logger.error('[StoryBatchProcessor] Max attempts exceeded for batch', {
          storyId,
          batchNumber,
          attemptCount,
          maxBatchAttempts,
        })
        await markBatchFailed(
          storyId,
          batchNumber,
          `Max attempts (${maxBatchAttempts}) exceeded`
        )
        await db.collection('stories').doc(storyId).update({
          wordExplanationsStatus: 'failed',
          wordExplanationsError: `Batch ${batchNumber} exceeded max attempts`,
          wordExplanationsFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        return
      }

      // Update story status
      await db.collection('stories').doc(storyId).update({
        wordExplanationsStatus: 'generating',
        wordExplanationsProgress: {
          totalBatches: queue.totalBatches,
          completedBatches: queue.completedBatches,
          totalWords: queue.totalWords,
          completedWords: queue.completedWords,
          currentBatch: batchNumber,
          percentComplete: Math.round(
            (queue.completedWords / queue.totalWords) * 100
          ),
        },
        wordExplanationsLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Load existing explanations to avoid duplicates and detect missing words
      const docRef = db.collection('story_word_explanations').doc(storyId)
      const existingDoc = await docRef.get()
      const existingData = existingDoc.exists ? existingDoc.data() : undefined
      const existingExplanations: WordExplanation[] = existingData?.words || []
      const existingWords = new Set(existingExplanations.map(w => w.word))
      const existingBatchNumbers: number[] = existingData?.batchNumbers || []
      const existingBatchWordCounts: Record<string, number> =
        existingData?.batchWordCounts || {}

      const missingWords = batch.words.filter(w => !existingWords.has(w.word))

      if (missingWords.length === 0) {
        logger.info('[StoryBatchProcessor] No missing words for batch, marking complete', {
          storyId,
          batchNumber,
        })

        const progress = await markBatchComplete(
          storyId,
          batchNumber,
          batch.words.length
        )

        await db.collection('stories').doc(storyId).update({
          wordExplanationsProgress: {
            totalBatches: progress.totalBatches,
            completedBatches: progress.completedBatches,
            totalWords: progress.totalWords,
            completedWords: progress.completedWords,
            currentBatch: progress.currentBatch,
            percentComplete: progress.percentComplete,
          },
          wordExplanationsCount: progress.completedWords,
          wordExplanationsLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        const allComplete = await isComplete(storyId)
        if (allComplete) {
          await db.collection('stories').doc(storyId).update({
            wordExplanationsStatus: 'complete',
            wordExplanationsCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        }

        return
      }

      // Mark batch as processing
      await markBatchProcessing(storyId, batchNumber)

      logger.info('[StoryBatchProcessor] Generating word explanations', {
        storyId,
        batchNumber,
        wordCount: missingWords.length,
      })

      // Generate word explanations for this batch
      const explanations: WordExplanation[] = []
      let totalPromptTokens = 0
      let totalCompletionTokens = 0
      let totalTokens = 0

      const failedWords: ExtractedWord[] = []

      for (const word of missingWords) {
        try {
          const { explanation, usage } = await generateWordExplanation(word)

          explanations.push(explanation)

          totalPromptTokens += usage.promptTokens
          totalCompletionTokens += usage.completionTokens
          totalTokens += usage.totalTokens

          logger.debug('[StoryBatchProcessor] Word explanation generated', {
            storyId,
            batchNumber,
            word: word.word,
            meaning: explanation.meaning,
          })
        } catch (error) {
          logger.error('[StoryBatchProcessor] Failed to generate word explanation', {
            storyId,
            batchNumber,
            word: word.word,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          // Continue with next word
          failedWords.push(word)
        }
      }

      logger.info('[StoryBatchProcessor] Batch generation complete', {
        storyId,
        batchNumber,
        wordsGenerated: explanations.length,
        tokensUsed: totalTokens,
      })

      // Store or append explanations to Firestore (idempotent per word)
      const existingCostInfo = existingData?.costInfo || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      }

      const merged = [...existingExplanations, ...explanations]
      const mergedWords = new Map<string, WordExplanation>()
      for (const exp of merged) {
        if (!exp?.word) continue
        if (!mergedWords.has(exp.word)) {
          mergedWords.set(exp.word, exp)
        }
      }
      const mergedExplanations = Array.from(mergedWords.values())
      const shouldMarkComplete = failedWords.length === 0
      const includeBatchNumber =
        shouldMarkComplete || existingBatchNumbers.includes(batchNumber)
      const existingBatchCount = existingBatchWordCounts[String(batchNumber)] ?? 0
      const updatedBatchCount = existingBatchCount + explanations.length

      await docRef.set(
        {
          storyId,
          words: mergedExplanations,
          wordCount: mergedExplanations.length,
          total: mergedExplanations.length,
          ...(includeBatchNumber
            ? { batchNumbers: admin.firestore.FieldValue.arrayUnion(batchNumber) }
            : {}),
          batchWordCounts: {
            ...existingBatchWordCounts,
            [batchNumber]: updatedBatchCount,
          },
          costInfo: {
            promptTokens: existingCostInfo.promptTokens + totalPromptTokens,
            completionTokens:
              existingCostInfo.completionTokens + totalCompletionTokens,
            totalTokens: existingCostInfo.totalTokens + totalTokens,
            estimatedCost: 0, // Qwen is self-hosted
          },
          ...(existingDoc.exists
            ? {}
            : { generatedAt: admin.firestore.FieldValue.serverTimestamp() }),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )

      if (!shouldMarkComplete) {
        logger.warn('[StoryBatchProcessor] Batch incomplete, scheduling retry', {
          storyId,
          batchNumber,
          failedWords: failedWords.length,
          remainingWords: failedWords.map(w => w.word).slice(0, 10),
        })

        const refreshedQueue = await getBatchQueue(storyId)
        const refreshedBatch =
          refreshedQueue?.batches.find(b => b.batchNumber === batchNumber) || batch
        const attempts = refreshedBatch.attemptCount ?? 0

        if (attempts >= maxBatchAttempts) {
          await markBatchFailed(
            storyId,
            batchNumber,
            `Max attempts (${maxBatchAttempts}) exceeded`
          )
          await db.collection('stories').doc(storyId).update({
            wordExplanationsStatus: 'failed',
            wordExplanationsError: `Batch ${batchNumber} exceeded max attempts`,
            wordExplanationsFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
          return
        }

        const batchesForUpdate = (refreshedQueue?.batches || queue.batches).map(b =>
          b.batchNumber === batchNumber
            ? {
                ...b,
                status: 'pending',
                errorMessage: `Failed ${failedWords.length} words`,
              }
            : b
        )

        await db.collection('story_word_batches').doc(storyId).update({
          batches: batchesForUpdate,
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        await pubsub.topic(BATCH_TOPIC).publishMessage({
          json: {
            storyId,
            batchNumber,
          },
        })

        return
      }

      // Mark batch as complete and get updated progress
      const progress = await markBatchComplete(
        storyId,
        batchNumber,
        batch.words.length
      )

      // Update story progress
      await db.collection('stories').doc(storyId).update({
        wordExplanationsProgress: {
          totalBatches: progress.totalBatches,
          completedBatches: progress.completedBatches,
          totalWords: progress.totalWords,
          completedWords: progress.completedWords,
          currentBatch: progress.currentBatch,
          percentComplete: progress.percentComplete,
        },
        wordExplanationsCount: progress.completedWords,
        wordExplanationsLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      logger.info('[StoryBatchProcessor] Progress updated', {
        storyId,
        batchNumber,
        progress,
      })

      // Check if all batches are complete
      const allComplete = await isComplete(storyId)

      if (allComplete) {
        // All batches done - mark story as complete
        await db.collection('stories').doc(storyId).update({
          wordExplanationsStatus: 'complete',
          wordExplanationsCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        logger.info('[StoryBatchProcessor] All batches complete', {
          storyId,
          totalBatches: progress.totalBatches,
          totalWords: progress.completedWords,
        })
      } else {
        // More batches to process - publish message for next batch
        const nextBatchNumber = batchNumber + 1

        const messageData = JSON.stringify({
          storyId,
          batchNumber: nextBatchNumber,
        })

        await pubsub.topic(BATCH_TOPIC).publishMessage({
          json: {
            storyId,
            batchNumber: nextBatchNumber,
          },
        })

        logger.info('[StoryBatchProcessor] Published message for next batch', {
          storyId,
          nextBatchNumber,
        })
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('[StoryBatchProcessor] Batch processing failed', {
        storyId,
        batchNumber,
        error: errorMessage,
      })

      // Mark batch as failed
      await markBatchFailed(storyId, batchNumber, errorMessage)

      // Mark story as failed
      await db.collection('stories').doc(storyId).update({
        wordExplanationsStatus: 'failed',
        wordExplanationsError: errorMessage,
        wordExplanationsFailedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      throw error
    }
  }
)

/**
 * Helper to publish first batch message
 */
export async function publishFirstBatch(storyId: string): Promise<void> {
  const topic = pubsub.topic(BATCH_TOPIC_NAME)
  await topic.get({ autoCreate: true })
  await topic.publishMessage({
    json: {
      storyId,
      batchNumber: 1,
    },
  })

  logger.info('[StoryBatchProcessor] Published first batch message', {
    storyId,
    batchNumber: 1,
    topic: BATCH_TOPIC_NAME,
    projectId: PROJECT_ID,
  })
}
