/**
 * Firestore Trigger: Async Word Explanation Generation for Books
 * Triggers when a book is published to the 'books' collection
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { extractWords } from '../utils/wordExtractor'
import { createBatchQueue } from '../utils/bookWordBatchManager'
import { publishFirstBookBatch } from './bookWordBatchProcessor'

const db = admin.firestore()
const MODAL_API_KEY = defineSecret('MODAL_API_KEY')

const BOOK_WORD_LIMIT = 1000
const PRECOMPUTE_VERSION = 'v2_all_tokens'

export const onBookPublished = onDocumentCreated(
  {
    document: 'books/{bookId}',
    secrets: [MODAL_API_KEY],
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async event => {
    const bookId = event.params.bookId
    const book = event.data?.data()

    if (!book) {
      logger.error('[BookWordGen] No book data in trigger', { bookId })
      return
    }

    if (book.status !== 'published') {
      logger.info('[BookWordGen] Skipping non-published book', { bookId })
      return
    }

    try {
      const existing = await db.collection('book_word_explanations').doc(bookId).get()
      if (existing.exists) {
        logger.info('[BookWordGen] Word explanations already exist, skipping', { bookId })
        return
      }

      const content = book.content || ''
      if (!content || content.trim().length === 0) {
        throw new Error('No content found in book')
      }

      await db.collection('books').doc(bookId).update({
        'metadata.wordExplanationsStatus': 'generating',
        'metadata.wordExplanationsStartedAt': admin.firestore.FieldValue.serverTimestamp(),
      })

      logger.info('[BookWordGen] Extracting words for batch processing', {
        bookId,
        textLength: content.length,
      })

      const { words } = await extractWords(content, {
        limit: BOOK_WORD_LIMIT,
        includeParticles: true,
        minLength: 1,
      })

      logger.info('[BookWordGen] Words extracted, creating batch queue', {
        bookId,
        wordCount: words.length,
      })

      const queue = await createBatchQueue(bookId, words)

      await db.collection('books').doc(bookId).update({
        'metadata.wordProgress': {
          totalBatches: queue.totalBatches,
          completedBatches: 0,
          totalWords: queue.totalWords,
          completedWords: 0,
          currentBatch: 1,
          percentComplete: 0,
        },
      })

      await publishFirstBookBatch(bookId)

      logger.info('[BookWordGen] First batch published', {
        bookId,
        totalBatches: queue.totalBatches,
        totalWords: queue.totalWords,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('[BookWordGen] Failed to start batch processing', {
        bookId,
        error: errorMessage,
      })
      await db.collection('books').doc(bookId).update({
        'metadata.wordExplanationsStatus': 'failed',
        'metadata.wordExplanationsError': errorMessage,
        'metadata.wordExplanationsFailedAt': admin.firestore.FieldValue.serverTimestamp(),
      })
    }
  }
)

/**
 * Firestore Trigger: On-demand book word precompute (client-triggered)
 * Listens to book_word_precompute_requests to avoid heavy work in Next API.
 */
export const onBookPrecomputeRequested = onDocumentCreated(
  {
    document: 'book_word_precompute_requests/{requestId}',
    secrets: [MODAL_API_KEY],
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async event => {
    const request = event.data?.data()
    const bookId = request?.bookId as string | undefined

    if (!bookId) {
      logger.error('[BookWordGen] Missing bookId in precompute request')
      return
    }

    try {
      const bookDoc = await db.collection('books').doc(bookId).get()
      if (!bookDoc.exists) {
        throw new Error('Book not found')
      }

      const book = bookDoc.data()
      const content = book?.content || ''
      if (!content || String(content).trim().length === 0) {
        throw new Error('No content found in book')
      }

      await db.collection('books').doc(bookId).update({
        'metadata.wordExplanationsStatus': 'generating',
        'metadata.wordExplanationsStartedAt': admin.firestore.FieldValue.serverTimestamp(),
      })

      logger.info('[BookWordGen] Extracting words for on-demand batch', {
        bookId,
        textLength: content.length,
      })

      const { words } = await extractWords(content, {
        limit: BOOK_WORD_LIMIT,
        includeParticles: true,
        minLength: 1,
      })

      const queue = await createBatchQueue(bookId, words)

      await db.collection('books').doc(bookId).update({
        'metadata.wordProgress': {
          totalBatches: queue.totalBatches,
          completedBatches: 0,
          totalWords: queue.totalWords,
          completedWords: 0,
          currentBatch: 1,
          percentComplete: 0,
        },
      })

      await publishFirstBookBatch(bookId)

      await db.collection('book_word_explanations').doc(bookId).set(
        {
          precomputeStatus: 'generating',
          precomputeVersion: PRECOMPUTE_VERSION,
          precomputeOptions: { includeParticles: true, minLength: 1 },
          precomputeUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )

      logger.info('[BookWordGen] On-demand batch published', {
        bookId,
        totalBatches: queue.totalBatches,
        totalWords: queue.totalWords,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('[BookWordGen] On-demand precompute failed', {
        bookId,
        error: errorMessage,
      })

      await db.collection('book_word_explanations').doc(bookId).set(
        {
          precomputeStatus: 'failed',
          precomputeError: errorMessage,
          precomputeUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          precomputeVersion: PRECOMPUTE_VERSION,
        },
        { merge: true }
      )
    }
  }
)
