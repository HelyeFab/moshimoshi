/**
 * Article Audio Generator - Scheduled Function
 *
 * Runs 30 minutes after each news scraper run to generate audio for new articles.
 * Schedule: 00:30, 06:30, 12:30, 18:30 JST (30 min after news scraper)
 *
 * This function:
 * 1. Finds all articles missing audio (title, summary, or content)
 * 2. Generates VOICEVOX audio for each missing type
 * 3. Updates Firestore with audio URLs
 * 4. Logs results to article_audio_generation_logs collection
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { generateBatchAudio, BatchAudioResult } from '../utils/newsAudioGenerator'
import { isAutomationEnabled } from '../utils/automationFlags'

// Define secrets
const MODAL_API_KEY = defineSecret('MODAL_API_KEY')

// Initialize Firestore (assumes admin is already initialized)
const db = admin.firestore()

// Configuration
const MAX_ARTICLES_PER_RUN = 20 // Process up to 20 articles per run
const DELAY_BETWEEN_ARTICLES_MS = 1500 // 1.5 seconds between articles to avoid rate limiting

interface ArticleForAudio {
  id: string
  title: string
  summary: string
  content: string
  source: string
  nhkAudioUrl?: string
  generatedTitleAudioUrl?: string
  generatedSummaryAudioUrl?: string
  generatedContentAudioUrl?: string
  audioStatus?: string
}

interface AudioGenerationLog {
  type: 'scheduled' | 'manual'
  startTime: admin.firestore.Timestamp
  endTime: admin.firestore.Timestamp
  duration: number
  articlesProcessed: number
  articlesWithErrors: number
  audioFilesGenerated: number
  errors: string[]
  details: Array<{
    articleId: string
    title: string
    generated: string[]
    errors: string[]
  }>
}

/**
 * Find articles that are missing any audio files
 */
async function findArticlesMissingAudio(limit: number): Promise<ArticleForAudio[]> {
  const snapshot = await db.collection('news_articles').get()

  const articlesMissingAudio: ArticleForAudio[] = []

  snapshot.forEach(doc => {
    const data = doc.data()

    // Check what's missing
    const missingTitle = !data.generatedTitleAudioUrl
    const missingSummary = !data.generatedSummaryAudioUrl
    const missingContent = !data.generatedContentAudioUrl

    // Skip fully complete articles
    if (!missingTitle && !missingSummary && !missingContent) {
      return
    }

    // Skip failed articles (will be retried in next run)
    if (data.audioStatus === 'failed' && data.audioRetryCount >= 3) {
      logger.debug(`Skipping article ${doc.id} - max retries reached`)
      return
    }

    articlesMissingAudio.push({
      id: doc.id,
      title: data.title || '',
      summary: data.summary || '',
      content: data.content || '',
      source: data.source || 'NHK-Easy',
      nhkAudioUrl: data.nhkAudioUrl,
      generatedTitleAudioUrl: data.generatedTitleAudioUrl,
      generatedSummaryAudioUrl: data.generatedSummaryAudioUrl,
      generatedContentAudioUrl: data.generatedContentAudioUrl,
      audioStatus: data.audioStatus,
    })
  })

  // Sort by most recent first (assuming IDs are date-based or we could use a createdAt field)
  // Return limited batch
  return articlesMissingAudio.slice(0, limit)
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Main audio generation function
 */
async function generateMissingAudio(options: { maxArticles?: number } = {}): Promise<{
  success: boolean
  articlesProcessed: number
  articlesWithErrors: number
  audioFilesGenerated: number
  errors: string[]
  details: Array<{
    articleId: string
    title: string
    generated: string[]
    errors: string[]
  }>
}> {
  const startTime = Date.now()
  const maxArticles = options.maxArticles || MAX_ARTICLES_PER_RUN

  logger.info('[ArticleAudioGenerator] Starting audio generation', { maxArticles })

  // Find articles missing audio
  const articles = await findArticlesMissingAudio(maxArticles)

  if (articles.length === 0) {
    logger.info('[ArticleAudioGenerator] No articles missing audio')
    return {
      success: true,
      articlesProcessed: 0,
      articlesWithErrors: 0,
      audioFilesGenerated: 0,
      errors: [],
      details: [],
    }
  }

  logger.info(`[ArticleAudioGenerator] Found ${articles.length} articles missing audio`)

  const results: {
    articleId: string
    title: string
    generated: string[]
    errors: string[]
  }[] = []

  let totalGenerated = 0
  let totalErrors = 0

  // Process each article
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i]

    logger.info(`[ArticleAudioGenerator] Processing ${i + 1}/${articles.length}: ${article.id}`, {
      title: article.title.substring(0, 50),
      missingTitle: !article.generatedTitleAudioUrl,
      missingSummary: !article.generatedSummaryAudioUrl,
      missingContent: !article.generatedContentAudioUrl,
    })

    try {
      // Generate audio using the existing utility
      const result: BatchAudioResult = await generateBatchAudio({
        id: article.id,
        title: article.title,
        summary: article.summary,
        content: article.content,
        source: article.source,
        nhkAudioUrl: article.nhkAudioUrl,
      })

      // Count generated files
      const generated: string[] = []
      if (result.titleAudio?.url && !article.generatedTitleAudioUrl) generated.push('title')
      if (result.summaryAudio?.url && !article.generatedSummaryAudioUrl) generated.push('summary')
      if (result.contentAudio?.url && !article.generatedContentAudioUrl) generated.push('content')

      totalGenerated += generated.length

      if (result.errors.length > 0) {
        totalErrors++
        // Increment retry count for failed articles
        await db
          .collection('news_articles')
          .doc(article.id)
          .update({
            audioRetryCount: admin.firestore.FieldValue.increment(1),
            lastAudioError: result.errors.join('; '),
          })
      }

      results.push({
        articleId: article.id,
        title: article.title,
        generated,
        errors: result.errors,
      })

      logger.info(`[ArticleAudioGenerator] Completed ${article.id}`, {
        generated,
        errors: result.errors,
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      totalErrors++

      results.push({
        articleId: article.id,
        title: article.title,
        generated: [],
        errors: [errorMsg],
      })

      logger.error(`[ArticleAudioGenerator] Failed to process ${article.id}`, { error: errorMsg })
    }

    // Delay between articles (except for last one)
    if (i < articles.length - 1) {
      await sleep(DELAY_BETWEEN_ARTICLES_MS)
    }
  }

  const duration = Date.now() - startTime

  // Log results to Firestore
  const logEntry: AudioGenerationLog = {
    type: 'scheduled',
    startTime: admin.firestore.Timestamp.fromDate(new Date(startTime)),
    endTime: admin.firestore.Timestamp.fromDate(new Date()),
    duration,
    articlesProcessed: articles.length,
    articlesWithErrors: totalErrors,
    audioFilesGenerated: totalGenerated,
    errors: results.flatMap(r => r.errors),
    details: results,
  }

  await db.collection('article_audio_generation_logs').add(logEntry)

  logger.info('[ArticleAudioGenerator] Audio generation complete', {
    articlesProcessed: articles.length,
    articlesWithErrors: totalErrors,
    audioFilesGenerated: totalGenerated,
    durationMs: duration,
    durationSec: (duration / 1000).toFixed(1),
  })

  return {
    success: totalErrors === 0,
    articlesProcessed: articles.length,
    articlesWithErrors: totalErrors,
    audioFilesGenerated: totalGenerated,
    errors: results.flatMap(r => r.errors),
    details: results,
  }
}

/**
 * Scheduled function - runs 30 minutes after each news scraper
 * Schedule: 00:30, 06:30, 12:30, 18:30 JST
 */
export const scheduledArticleAudioGenerator = onSchedule(
  {
    schedule: '30 0,6,12,18 * * *', // 30 min after news scraper
    timeZone: 'Asia/Tokyo',
    memory: '1GiB',
    timeoutSeconds: 540, // 9 minutes max
    retryCount: 1,
    secrets: [MODAL_API_KEY],
  },
  async event => {
    logger.info('[ArticleAudioGenerator] Scheduled trigger activated', {
      scheduleTime: event.scheduleTime,
      jobName: event.jobName,
    })

    const automationEnabled = await isAutomationEnabled('NEWS_AUTOMATION', true)
    if (!automationEnabled) {
      logger.info('[ArticleAudioGenerator] NEWS_AUTOMATION is disabled - skipping scheduled run', {
        scheduleTime: event.scheduleTime,
      })
      return
    }

    const result = await generateMissingAudio()

    if (!result.success && result.articlesWithErrors > 0) {
      // Log warning but don't throw - we don't want to retry the whole batch
      logger.warn('[ArticleAudioGenerator] Completed with some errors', {
        articlesWithErrors: result.articlesWithErrors,
        errors: result.errors.slice(0, 5), // Log first 5 errors
      })
    }
  }
)

/**
 * Manual trigger function for testing or backfill
 */
export const manualArticleAudioGenerator = onCall(
  {
    memory: '1GiB',
    timeoutSeconds: 540,
    invoker: 'public', // Auth checked inside
    secrets: [MODAL_API_KEY],
  },
  async request => {
    // Check authentication
    const adminKey = request.data?.adminKey
    const expectedAdminKey = process.env.AUDIO_GENERATOR_ADMIN_KEY || 'audio-generator-2025'

    if (!request.auth && adminKey !== expectedAdminKey) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated or provide valid admin key'
      )
    }

    // Check if user is admin (if authenticated)
    if (request.auth) {
      const userDoc = await db.collection('users').doc(request.auth.uid).get()
      const userData = userDoc.data()
      if (!userData?.isAdmin) {
        throw new HttpsError('permission-denied', 'Admin access required')
      }
    }

    logger.info('[ArticleAudioGenerator] Manual trigger initiated', {
      userId: request.auth?.uid || 'admin-key',
      maxArticles: request.data?.maxArticles,
    })

    const result = await generateMissingAudio({
      maxArticles: request.data?.maxArticles || MAX_ARTICLES_PER_RUN,
    })

    return result
  }
)
