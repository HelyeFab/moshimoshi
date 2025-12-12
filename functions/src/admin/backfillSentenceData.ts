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

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import {
  preGenerateArticleSentences,
  preGenerateStorySentences,
  preGenerateBookSentences,
} from '../utils/sentencePreGenerator'

// Define secrets
const MODAL_API_KEY = defineSecret('MODAL_API_KEY')

// Initialize Firestore
const db = admin.firestore()

// ============================================
// Types
// ============================================

interface BackfillRequest {
  contentType: 'articles' | 'stories' | 'books' | 'all'
  ids?: string[] // Optional: specific IDs to process
  skipExisting?: boolean // Default: true
  batchSize?: number // Default: 5
  dryRun?: boolean // Default: false - just count without processing
}

interface BackfillResult {
  contentType: string
  totalItems: number
  processedItems: number
  skippedItems: number
  failedItems: number
  details: Array<{
    id: string
    status: 'processed' | 'skipped' | 'failed'
    sentenceCount?: number
    error?: string
  }>
}

// ============================================
// Article Backfill
// ============================================

async function backfillArticles(
  ids?: string[],
  skipExisting = true,
  dryRun = false
): Promise<BackfillResult> {
  const result: BackfillResult = {
    contentType: 'articles',
    totalItems: 0,
    processedItems: 0,
    skippedItems: 0,
    failedItems: 0,
    details: [],
  }

  try {
    // Get articles to process
    let articlesQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
      db.collection('news_articles')

    if (ids && ids.length > 0) {
      // Process specific articles
      articlesQuery = articlesQuery.where(admin.firestore.FieldPath.documentId(), 'in', ids)
    }

    const articlesSnapshot = await articlesQuery.get()
    result.totalItems = articlesSnapshot.size

    logger.info('[Backfill] Found articles to process', {
      total: result.totalItems,
      specificIds: ids?.length || 0,
    })

    for (const articleDoc of articlesSnapshot.docs) {
      const articleId = articleDoc.id
      const articleData = articleDoc.data()

      try {
        // Check if already has sentence data
        if (skipExisting) {
          const translationDoc = await db
            .collection('news_article_translations')
            .doc(articleId)
            .get()

          if (
            translationDoc.exists &&
            translationDoc.data()?.sentences &&
            translationDoc.data()!.sentences.length > 0
          ) {
            logger.info('[Backfill] Skipping article with existing sentences', { articleId })
            result.skippedItems++
            result.details.push({
              id: articleId,
              status: 'skipped',
              sentenceCount: translationDoc.data()!.sentences.length,
            })
            continue
          }
        }

        // Check for content
        if (!articleData.content || articleData.content.trim().length === 0) {
          logger.warn('[Backfill] Article has no content', { articleId })
          result.skippedItems++
          result.details.push({
            id: articleId,
            status: 'skipped',
            error: 'No content',
          })
          continue
        }

        if (dryRun) {
          // Count sentences without processing
          const sentenceCount = (articleData.content.match(/。/g) || []).length + 1
          result.details.push({
            id: articleId,
            status: 'processed',
            sentenceCount,
          })
          result.processedItems++
          continue
        }

        // Generate sentence data
        logger.info('[Backfill] Processing article', {
          articleId,
          contentLength: articleData.content.length,
        })

        await preGenerateArticleSentences(articleId, articleData.content)

        result.processedItems++
        result.details.push({
          id: articleId,
          status: 'processed',
        })

        // Small delay between articles to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (error) {
        logger.error('[Backfill] Error processing article', {
          articleId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        result.failedItems++
        result.details.push({
          id: articleId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return result
  } catch (error) {
    logger.error('[Backfill] Fatal error in article backfill', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

// ============================================
// Story Backfill
// ============================================

async function backfillStories(
  ids?: string[],
  skipExisting = true,
  dryRun = false
): Promise<BackfillResult> {
  const result: BackfillResult = {
    contentType: 'stories',
    totalItems: 0,
    processedItems: 0,
    skippedItems: 0,
    failedItems: 0,
    details: [],
  }

  try {
    let storiesQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
      db.collection('stories')

    if (ids && ids.length > 0) {
      storiesQuery = storiesQuery.where(admin.firestore.FieldPath.documentId(), 'in', ids)
    }

    const storiesSnapshot = await storiesQuery.get()
    result.totalItems = storiesSnapshot.size

    logger.info('[Backfill] Found stories to process', { total: result.totalItems })

    for (const storyDoc of storiesSnapshot.docs) {
      const storyId = storyDoc.id
      const storyData = storyDoc.data()

      try {
        // Check if already has sentence data
        if (skipExisting) {
          const sentenceDoc = await db.collection('story_sentence_data').doc(storyId).get()

          if (
            sentenceDoc.exists &&
            sentenceDoc.data()?.pages &&
            sentenceDoc.data()!.pages.length > 0
          ) {
            logger.info('[Backfill] Skipping story with existing sentences', { storyId })
            result.skippedItems++
            result.details.push({
              id: storyId,
              status: 'skipped',
            })
            continue
          }
        }

        // Check for pages
        if (!storyData.pages || !Array.isArray(storyData.pages) || storyData.pages.length === 0) {
          logger.warn('[Backfill] Story has no pages', { storyId })
          result.skippedItems++
          result.details.push({
            id: storyId,
            status: 'skipped',
            error: 'No pages',
          })
          continue
        }

        // Extract page data
        const pages = storyData.pages
          .map((page: { pageNumber?: number; text?: string }, index: number) => ({
            pageNumber: page.pageNumber || index + 1,
            text: page.text || '',
          }))
          .filter((page: { text: string }) => page.text.length > 0)

        if (pages.length === 0) {
          logger.warn('[Backfill] Story has no text content', { storyId })
          result.skippedItems++
          result.details.push({
            id: storyId,
            status: 'skipped',
            error: 'No text content',
          })
          continue
        }

        if (dryRun) {
          const totalSentences = pages.reduce(
            (acc: number, p: { text: string }) => acc + (p.text.match(/。/g) || []).length + 1,
            0
          )
          result.details.push({
            id: storyId,
            status: 'processed',
            sentenceCount: totalSentences,
          })
          result.processedItems++
          continue
        }

        logger.info('[Backfill] Processing story', {
          storyId,
          pageCount: pages.length,
        })

        await preGenerateStorySentences(storyId, pages)

        result.processedItems++
        result.details.push({
          id: storyId,
          status: 'processed',
        })

        // Delay between stories
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch (error) {
        logger.error('[Backfill] Error processing story', {
          storyId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        result.failedItems++
        result.details.push({
          id: storyId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return result
  } catch (error) {
    logger.error('[Backfill] Fatal error in story backfill', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

// ============================================
// Book Backfill
// ============================================

async function backfillBooks(
  ids?: string[],
  skipExisting = true,
  dryRun = false
): Promise<BackfillResult> {
  const result: BackfillResult = {
    contentType: 'books',
    totalItems: 0,
    processedItems: 0,
    skippedItems: 0,
    failedItems: 0,
    details: [],
  }

  try {
    let booksQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
      db.collection('books')

    if (ids && ids.length > 0) {
      booksQuery = booksQuery.where(admin.firestore.FieldPath.documentId(), 'in', ids)
    }

    const booksSnapshot = await booksQuery.get()
    result.totalItems = booksSnapshot.size

    logger.info('[Backfill] Found books to process', { total: result.totalItems })

    for (const bookDoc of booksSnapshot.docs) {
      const bookId = bookDoc.id
      const bookData = bookDoc.data()

      try {
        // Check if already has sentence data
        if (skipExisting) {
          const sentenceDoc = await db.collection('book_sentence_data').doc(bookId).get()

          if (
            sentenceDoc.exists &&
            sentenceDoc.data()?.sentences &&
            sentenceDoc.data()!.sentences.length > 0
          ) {
            logger.info('[Backfill] Skipping book with existing sentences', { bookId })
            result.skippedItems++
            result.details.push({
              id: bookId,
              status: 'skipped',
              sentenceCount: sentenceDoc.data()!.sentences.length,
            })
            continue
          }
        }

        // Check for content
        if (!bookData.content || bookData.content.trim().length === 0) {
          logger.warn('[Backfill] Book has no content', { bookId })
          result.skippedItems++
          result.details.push({
            id: bookId,
            status: 'skipped',
            error: 'No content',
          })
          continue
        }

        if (dryRun) {
          const sentenceCount = (bookData.content.match(/。/g) || []).length + 1
          result.details.push({
            id: bookId,
            status: 'processed',
            sentenceCount,
          })
          result.processedItems++
          continue
        }

        logger.info('[Backfill] Processing book', {
          bookId,
          contentLength: bookData.content.length,
        })

        await preGenerateBookSentences(bookId, bookData.content)

        result.processedItems++
        result.details.push({
          id: bookId,
          status: 'processed',
        })

        // Delay between books
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch (error) {
        logger.error('[Backfill] Error processing book', {
          bookId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        result.failedItems++
        result.details.push({
          id: bookId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return result
  } catch (error) {
    logger.error('[Backfill] Fatal error in book backfill', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

// ============================================
// Main Export - Callable Function
// ============================================

export const backfillSentenceData = onCall(
  {
    region: 'asia-northeast1',
    memory: '1GiB',
    timeoutSeconds: 3600, // 1 hour timeout for large backfills
    secrets: [MODAL_API_KEY],
  },
  async (request: CallableRequest<BackfillRequest>) => {
    // Verify caller is admin (optional - add your own auth check)
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated to run backfill')
    }

    // Get request data
    const data = request.data
    const contentType = data?.contentType || 'all'
    const ids = data?.ids
    const skipExisting = data?.skipExisting !== false // Default true
    const dryRun = data?.dryRun === true // Default false

    logger.info('[Backfill] Starting sentence data backfill', {
      contentType,
      specificIds: ids?.length || 0,
      skipExisting,
      dryRun,
      calledBy: request.auth.uid,
    })

    const results: BackfillResult[] = []

    try {
      // Process articles
      if (contentType === 'articles' || contentType === 'all') {
        const articleResult = await backfillArticles(
          contentType === 'articles' ? ids : undefined,
          skipExisting,
          dryRun
        )
        results.push(articleResult)
        logger.info('[Backfill] Article backfill complete', articleResult)
      }

      // Process stories
      if (contentType === 'stories' || contentType === 'all') {
        const storyResult = await backfillStories(
          contentType === 'stories' ? ids : undefined,
          skipExisting,
          dryRun
        )
        results.push(storyResult)
        logger.info('[Backfill] Story backfill complete', storyResult)
      }

      // Process books
      if (contentType === 'books' || contentType === 'all') {
        const bookResult = await backfillBooks(
          contentType === 'books' ? ids : undefined,
          skipExisting,
          dryRun
        )
        results.push(bookResult)
        logger.info('[Backfill] Book backfill complete', bookResult)
      }

      // Calculate totals
      const summary = {
        totalItems: results.reduce((acc, r) => acc + r.totalItems, 0),
        processedItems: results.reduce((acc, r) => acc + r.processedItems, 0),
        skippedItems: results.reduce((acc, r) => acc + r.skippedItems, 0),
        failedItems: results.reduce((acc, r) => acc + r.failedItems, 0),
        dryRun,
      }

      logger.info('[Backfill] All backfills complete', summary)

      return {
        success: true,
        summary,
        results,
      }
    } catch (error) {
      logger.error('[Backfill] Backfill failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw new HttpsError(
        'internal',
        `Backfill failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
)
