/**
 * Story Scheduler - Weekly AI Story Generation
 * Generates a new educational Japanese story every Sunday at 00:00 UTC
 *
 * Flow:
 * 1. Pick a random theme or select from moodboards
 * 2. Generate character sheet
 * 3. Generate story outline
 * 4. Generate pages (one by one)
 * 5. Generate quiz
 * 6. Generate model sheet + page images
 * 7. Generate audio (VOICEVOX)
 * 8. Pre-generate sentence-level audio and translations
 * 8.5. Pre-generate word explanations (1000 words)
 * 9. Publish story
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { preGenerateStorySentences } from '../utils/sentencePreGenerator'
// DISABLED: Word precomputation requires Next.js dependencies that aren't available in Cloud Functions
// Words will be precomputed on-demand when users access the story
// import { precomputeWordExplanations } from '../../../src/lib/ai/precompute/wordPrecompute'
import {
  sendStoryGenerationFailureAlert,
  sendStoryGenerationWarningAlert,
} from '../utils/alertNotifier'

// Define secrets needed for story generation
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY')
const MODAL_API_KEY = defineSecret('MODAL_API_KEY')
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')
const RESEND_API_KEY = defineSecret('RESEND_API_KEY')

// Initialize Firestore
const db = admin.firestore()

// App URL for API calls
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'

// Configuration for checkpoint/resume
const CHECKPOINT_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,          // Max times to retry a failed step
  INCOMPLETE_DRAFT_HOURS: 48,     // Look back this many hours for incomplete drafts
  CONCURRENT_IMAGE_LIMIT: 3,      // Max parallel image generations
}

// Types for checkpoint tracking
type DraftGenerationStep =
  | 'character_sheet'
  | 'outline'
  | 'pages'
  | 'quiz'
  | 'model_sheet'
  | 'page_images'
  | 'audio'
  | 'sentences'
  | 'word_explanations'
  | 'complete'

interface DraftCheckpoint {
  lastCompletedStep: DraftGenerationStep
  lastCompletedIndex?: number
  failedAttempts: number
  lastAttemptAt: admin.firestore.Timestamp
  lastError?: string
}

interface IncompleteDraft {
  id: string
  draftId: string
  status: string
  theme: string
  jlptLevel: string
  pageCount: number
  checkpoint: DraftCheckpoint
  createdAt: admin.firestore.Timestamp
}

// Story themes to rotate through
const STORY_THEMES = [
  'A Day at School',
  'Shopping at the Convenience Store',
  'Visiting a Temple',
  'Making Friends',
  'A Trip to the Park',
  'Cooking Japanese Food',
  'At the Train Station',
  'A Rainy Day',
  'Cherry Blossom Viewing',
  'Summer Festival',
  'New Year Celebration',
  'Going to the Beach',
  'A Visit to the Doctor',
  'At the Library',
  'Playing Sports',
]

// JLPT levels to rotate through (beginner-friendly but complete coverage)
// Distribution: N5=37.5%, N4=25%, N3=12.5%, N2=12.5%, N1=12.5%
// Covers all JLPT levels while prioritizing beginner content
const JLPT_LEVELS = ['N5', 'N5', 'N5', 'N4', 'N4', 'N3', 'N2', 'N1'] as const

/**
 * Helper to make API calls with admin authentication
 */
async function callStoryAPI(
  endpoint: string,
  body: Record<string, any>,
  adminKey: string
): Promise<any> {
  const url = `${APP_URL}${endpoint}`

  logger.info('[StoryScheduler] Calling API', { endpoint, step: body.step })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': adminKey,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error ${response.status}: ${errorText}`)
  }

  return response.json()
}

/**
 * Helper to call API with retry logic
 * Used for potentially slow operations like image generation
 */
async function callStoryAPIWithRetry(
  endpoint: string,
  body: Record<string, any>,
  adminKey: string,
  maxRetries: number = 2,
  delayMs: number = 2000
): Promise<{ success: boolean; data?: any; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await callStoryAPI(endpoint, body, adminKey)

      // CRITICAL FIX: Check if the API response itself indicates failure
      // Some endpoints return HTTP 200 with {success: false, error: "..."}
      if (result && typeof result.success === 'boolean' && !result.success) {
        const errorMsg = result.error || 'API returned success: false'
        throw new Error(errorMsg)
      }

      return { success: true, data: result }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logger.warn(`[StoryScheduler] API call failed (attempt ${attempt}/${maxRetries})`, {
        endpoint,
        step: body.step,
        error: errorMsg,
      })

      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const waitTime = delayMs * attempt
        logger.info(`[StoryScheduler] Retrying in ${waitTime}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      } else {
        return { success: false, error: errorMsg }
      }
    }
  }
  return { success: false, error: 'Max retries exceeded' }
}

/**
 * Select today's theme, level, and page count
 * Uses day of year to rotate through themes predictably
 * Page count is randomized between 3-4 for variety
 */
function selectThemeAndLevel(): { theme: string; jlptLevel: string; pageCount: number } {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - startOfYear.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))

  const theme = STORY_THEMES[dayOfYear % STORY_THEMES.length]
  const jlptLevel = JLPT_LEVELS[dayOfYear % JLPT_LEVELS.length]
  // Random page count between 3 and 4 (inclusive)
  const pageCount = Math.floor(Math.random() * 2) + 3

  return { theme, jlptLevel, pageCount }
}

/**
 * Find an incomplete draft that needs to be resumed
 * Looks for drafts with pending_* status from the last 48 hours
 */
async function findIncompleteDraft(): Promise<IncompleteDraft | null> {
  const lookbackDate = new Date()
  lookbackDate.setHours(lookbackDate.getHours() - CHECKPOINT_CONFIG.INCOMPLETE_DRAFT_HOURS)

  logger.info('[StoryScheduler] Checking for incomplete drafts', {
    since: lookbackDate.toISOString(),
  })

  try {
    // Query for drafts that need resumption
    const snapshot = await db
      .collection('ai_story_drafts')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(lookbackDate))
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()

    // Filter for pending statuses in memory (avoids composite index requirement)
    for (const doc of snapshot.docs) {
      const data = doc.data()
      const status = data.status as string

      // Check for pending statuses that need retry
      if (status?.startsWith('pending_')) {
        const checkpoint = data.checkpoint as DraftCheckpoint | undefined

        // Skip if max retries exceeded
        if (checkpoint && checkpoint.failedAttempts >= CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS) {
          logger.info('[StoryScheduler] Skipping draft - max retries exceeded', {
            draftId: doc.id,
            failedAttempts: checkpoint.failedAttempts,
          })
          continue
        }

        logger.info('[StoryScheduler] Found incomplete draft to resume', {
          draftId: doc.id,
          status,
          lastStep: checkpoint?.lastCompletedStep,
          failedAttempts: checkpoint?.failedAttempts || 0,
        })

        return {
          id: doc.id,
          draftId: doc.id,
          status,
          theme: data.theme || 'Unknown Theme',
          jlptLevel: data.jlptLevel || 'N5',
          pageCount: data.pageCount || data.pages?.length || 5,
          checkpoint: checkpoint || {
            lastCompletedStep: 'pages' as DraftGenerationStep, // Assume pages done if no checkpoint
            failedAttempts: 0,
            lastAttemptAt: admin.firestore.Timestamp.now(),
          },
          createdAt: data.createdAt,
        }
      }
    }

    logger.info('[StoryScheduler] No incomplete drafts found')
    return null
  } catch (error) {
    logger.warn('[StoryScheduler] Error checking for incomplete drafts', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return null
  }
}

/**
 * Process tasks with a concurrency limit
 * Used for parallel image generation
 */
async function processWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<Array<{ success: boolean; result?: T; error?: string; index: number }>> {
  const results: Array<{ success: boolean; result?: T; error?: string; index: number }> = []

  for (let i = 0; i < tasks.length; i += limit) {
    const chunk = tasks.slice(i, i + limit)
    const chunkResults = await Promise.allSettled(chunk.map(fn => fn()))

    chunkResults.forEach((result, idx) => {
      const actualIndex = i + idx
      if (result.status === 'fulfilled') {
        results.push({ success: true, result: result.value, index: actualIndex })
      } else {
        results.push({
          success: false,
          error: result.reason?.message || 'Unknown error',
          index: actualIndex,
        })
      }
    })
  }

  return results
}

/**
 * Update checkpoint in draft document
 * Uses set with merge to be defensive in case document doesn't exist yet
 */
async function updateCheckpoint(
  draftId: string,
  step: DraftGenerationStep,
  index?: number,
  error?: string
): Promise<void> {
  const checkpointData: Record<string, any> = {
    lastCompletedStep: step,
    lastAttemptAt: admin.firestore.Timestamp.now(),
  }

  if (index !== undefined) {
    checkpointData.lastCompletedIndex = index
  }

  if (error) {
    checkpointData.lastError = error
  }

  await db.collection('ai_story_drafts').doc(draftId).set({
    checkpoint: checkpointData,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
}

/**
 * Mark draft as pending with incremented failure count
 * First gets current failedAttempts, then sets with merge
 */
async function markDraftAsPending(
  draftId: string,
  pendingStatus: 'pending_images' | 'pending_audio' | 'pending_sentences',
  error: string
): Promise<void> {
  // Get current failed attempts count
  const doc = await db.collection('ai_story_drafts').doc(draftId).get()
  const currentAttempts = doc.exists ? (doc.data()?.checkpoint?.failedAttempts || 0) : 0

  await db.collection('ai_story_drafts').doc(draftId).set({
    status: pendingStatus,
    checkpoint: {
      failedAttempts: currentAttempts + 1,
      lastAttemptAt: admin.firestore.Timestamp.now(),
      lastError: error,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
}

/**
 * Resume story generation from a checkpoint
 */
async function resumeFromCheckpoint(
  draft: IncompleteDraft,
  adminKey: string
): Promise<{ success: boolean; storyId?: string; draftId?: string; error?: string; duration: number }> {
  const startTime = Date.now()
  const { draftId, theme, jlptLevel, pageCount, checkpoint } = draft

  logger.info('[StoryScheduler] Resuming from checkpoint', {
    draftId,
    lastStep: checkpoint.lastCompletedStep,
    lastIndex: checkpoint.lastCompletedIndex,
    failedAttempts: checkpoint.failedAttempts,
  })

  try {
    // Determine which step to resume from
    const stepOrder: DraftGenerationStep[] = [
      'character_sheet',
      'outline',
      'pages',
      'quiz',
      'model_sheet',
      'page_images',
      'audio',
      'sentences',
      'word_explanations',
      'complete',
    ]

    const lastStepIndex = stepOrder.indexOf(checkpoint.lastCompletedStep)
    const nextStepIndex = lastStepIndex + 1

    if (nextStepIndex >= stepOrder.length) {
      // Already complete, just publish
      logger.info('[StoryScheduler] Draft already complete, publishing...')
      return await publishDraft(draftId, theme, jlptLevel, pageCount, startTime, adminKey)
    }

    // Resume from the next step
    const nextStep = stepOrder[nextStepIndex]
    logger.info('[StoryScheduler] Resuming from step', { nextStep, nextStepIndex })

    // Execute remaining steps
    let imagesGenerated = 0
    let imagesFailed = 0

    // Step: Page Images (if needed)
    if (nextStep === 'page_images' || stepOrder.indexOf(nextStep) < stepOrder.indexOf('page_images')) {
      const startPage = nextStep === 'page_images' ? (checkpoint.lastCompletedIndex || 0) + 1 : 1
      const result = await generatePageImagesParallel(draftId, startPage, pageCount, adminKey)
      imagesGenerated = result.generated
      imagesFailed = result.failed

      if (imagesFailed > 0) {
        // Save checkpoint and exit - will retry next time
        await markDraftAsPending(draftId, 'pending_images', `${imagesFailed} images failed`)
        return {
          success: false,
          draftId,
          error: `Image generation incomplete: ${imagesFailed} of ${pageCount} failed`,
          duration: Date.now() - startTime,
        }
      }

      await updateCheckpoint(draftId, 'page_images')
    }

    // Step: Audio (if needed) - with retries
    if (stepOrder.indexOf(nextStep) <= stepOrder.indexOf('audio')) {
      const audioResult = await callStoryAPIWithRetry(
        '/api/admin/generate-story',
        { step: 'generate_audio', draftId, voice: '23' },
        adminKey,
        3,  // 3 retries
        5000  // 5s, 10s, 15s backoff
      )

      if (audioResult.success) {
        await updateCheckpoint(draftId, 'audio')
      } else {
        const errorMsg = audioResult.error || 'Audio generation failed after retries'
        logger.warn('[StoryScheduler] Audio generation failed - saving as pending_audio', {
          draftId,
          error: errorMsg,
        })
        await markDraftAsPending(draftId, 'pending_audio', errorMsg)
        return {
          success: false,
          draftId,
          error: `Audio generation failed: ${errorMsg}`,
          duration: Date.now() - startTime,
        }
      }
    }

    // Step: Sentences (if needed) - with retries
    if (stepOrder.indexOf(nextStep) <= stepOrder.indexOf('sentences')) {
      const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get()
      const draftData = draftDoc.data()

      if (draftData?.pages && Array.isArray(draftData.pages)) {
        const pages = draftData.pages
          .map((page: any, index: number) => ({
            pageNumber: page.pageNumber || index + 1,
            text: page.text || '',
          }))
          .filter((page: any) => page.text.length > 0)

        let sentenceSuccess = false
        let sentenceError: string | undefined

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await preGenerateStorySentences(draftId, pages)
            sentenceSuccess = true
            await updateCheckpoint(draftId, 'sentences')
            break
          } catch (error) {
            sentenceError = error instanceof Error ? error.message : 'Unknown error'
            logger.warn(`[StoryScheduler] Sentence pre-generation failed (attempt ${attempt}/3)`, {
              draftId,
              error: sentenceError,
            })
            if (attempt < 3) {
              const waitTime = 5000 * attempt
              await new Promise(resolve => setTimeout(resolve, waitTime))
            }
          }
        }

        if (!sentenceSuccess) {
          const errorMsg = sentenceError || 'Sentence pre-generation failed after retries'
          logger.warn('[StoryScheduler] Sentence pre-generation failed - saving as pending_sentences', {
            draftId,
            error: errorMsg,
          })
          await markDraftAsPending(draftId, 'pending_sentences', errorMsg)
          return {
            success: false,
            draftId,
            error: `Sentence pre-generation failed: ${errorMsg}`,
            duration: Date.now() - startTime,
          }
        }
      }
    }

    // All steps complete - publish
    return await publishDraft(draftId, theme, jlptLevel, pageCount, startTime, adminKey, imagesGenerated, imagesFailed)
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    logger.error('[StoryScheduler] Resume failed', { error: errorMessage, draftId })

    // Increment failure count (get current then set with merge)
    const failedDoc = await db.collection('ai_story_drafts').doc(draftId).get()
    const currentFailedAttempts = failedDoc.exists ? (failedDoc.data()?.checkpoint?.failedAttempts || 0) : 0

    await db.collection('ai_story_drafts').doc(draftId).set({
      checkpoint: {
        failedAttempts: currentFailedAttempts + 1,
        lastError: errorMessage,
        lastAttemptAt: admin.firestore.Timestamp.now(),
      },
    }, { merge: true })

    return { success: false, draftId, error: errorMessage, duration }
  }
}

/**
 * Generate page images in parallel with concurrency limit
 */
async function generatePageImagesParallel(
  draftId: string,
  startPage: number,
  totalPages: number,
  adminKey: string
): Promise<{ generated: number; failed: number }> {
  logger.info('[StoryScheduler] Generating page images in parallel', {
    draftId,
    startPage,
    totalPages,
    concurrency: CHECKPOINT_CONFIG.CONCURRENT_IMAGE_LIMIT,
  })

  const pagesToGenerate = Array.from(
    { length: totalPages - startPage + 1 },
    (_, i) => startPage + i
  )

  const tasks = pagesToGenerate.map(pageNum => async () => {
    const result = await callStoryAPIWithRetry(
      '/api/admin/generate-story',
      { step: 'generate_page_image', draftId, pageNumber: pageNum },
      adminKey,
      3,
      3000
    )
    if (!result.success) {
      throw new Error(result.error || `Page ${pageNum} image failed`)
    }
    return { pageNum, result }
  })

  const results = await processWithConcurrency(tasks, CHECKPOINT_CONFIG.CONCURRENT_IMAGE_LIMIT)

  const generated = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  logger.info('[StoryScheduler] Parallel image generation complete', {
    draftId,
    generated,
    failed,
    total: pagesToGenerate.length,
  })

  // Update checkpoint with last successful page
  const lastSuccessful = results
    .filter(r => r.success)
    .map(r => pagesToGenerate[r.index])
    .sort((a, b) => b - a)[0]

  if (lastSuccessful) {
    await updateCheckpoint(draftId, 'page_images', lastSuccessful)
  }

  return { generated, failed }
}

/**
 * Publish a completed draft
 */
async function publishDraft(
  draftId: string,
  theme: string,
  jlptLevel: string,
  pageCount: number,
  startTime: number,
  adminKey: string,
  imagesGenerated?: number,
  imagesFailed?: number
): Promise<{ success: boolean; storyId?: string; draftId?: string; error?: string; duration: number }> {
  logger.info('[StoryScheduler] Publishing story...', { draftId })

  const publishResult = await callStoryAPI(
    '/api/admin/stories/publish-draft',
    { draftId },
    adminKey
  )

  const duration = Date.now() - startTime
  const storyId = publishResult.storyId

  // Mark draft as complete
  await db.collection('ai_story_drafts').doc(draftId).set({
    status: 'published',
    checkpoint: {
      lastCompletedStep: 'complete',
    },
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  // Log success
  await db.collection('story_generation_logs').add({
    type: 'scheduled',
    success: true,
    storyId,
    draftId,
    theme,
    jlptLevel,
    pageCount,
    imagesGenerated: imagesGenerated || pageCount,
    imagesFailed: imagesFailed || 0,
    duration,
    resumed: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  logger.info('[StoryScheduler] Story published successfully!', {
    storyId,
    draftId,
    duration,
  })

  return { success: true, storyId, draftId, duration }
}

/**
 * Main story generation function
 * Now with checkpoint support and parallel image generation
 */
export async function generateDailyStory(adminKey: string): Promise<{
  success: boolean
  storyId?: string
  draftId?: string
  error?: string
  duration: number
}> {
  const startTime = Date.now()
  const { theme, jlptLevel, pageCount } = selectThemeAndLevel()
  let draftId: string | undefined

  logger.info('[StoryScheduler] Starting daily story generation', {
    theme,
    jlptLevel,
    pageCount,
    timestamp: new Date().toISOString(),
  })

  try {
    // Step 1: Generate Character Sheet
    logger.info('[StoryScheduler] Step 1/9: Generating character sheet...')
    const characterResult = await callStoryAPI(
      '/api/admin/generate-story',
      {
        step: 'character_sheet',
        theme,
        jlptLevel,
        pageCount,
      },
      adminKey
    )

    if (!characterResult.success || !characterResult.draftId) {
      throw new Error('Failed to generate character sheet')
    }

    draftId = characterResult.draftId
    logger.info('[StoryScheduler] Character sheet created', { draftId })

    // Initialize checkpoint and progress tracking (use set with merge in case document isn't visible yet)
    await db.collection('ai_story_drafts').doc(draftId).set({
      checkpoint: {
        lastCompletedStep: 'character_sheet',
        failedAttempts: 0,
        lastAttemptAt: admin.firestore.Timestamp.now(),
      },
      metadata: {
        generationStep: 'character_sheet',
        progress: 10,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
    }, { merge: true })

    // Step 2: Generate Outline
    logger.info('[StoryScheduler] Step 2/9: Generating outline...')
    const outlineResult = await callStoryAPI(
      '/api/admin/generate-story',
      {
        step: 'outline',
        theme,
        jlptLevel,
        pageCount,
        draftId,
      },
      adminKey
    )

    if (!outlineResult.success) {
      throw new Error('Failed to generate outline')
    }
    await updateCheckpoint(draftId, 'outline')
    await db.collection('ai_story_drafts').doc(draftId).update({
      'metadata.generationStep': 'outline',
      'metadata.progress': 20,
      'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
    })
    logger.info('[StoryScheduler] Outline created')

    // Step 3: Generate Pages
    logger.info('[StoryScheduler] Step 3/9: Generating pages...')
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      logger.info(`[StoryScheduler] Generating page ${pageNum}/${pageCount}...`)

      const pageResult = await callStoryAPI(
        '/api/admin/generate-story',
        {
          step: 'generate_page',
          jlptLevel,
          pageNumber: pageNum,
          draftId,
        },
        adminKey
      )

      if (!pageResult.success) {
        logger.warn(`[StoryScheduler] Page ${pageNum} generation failed, continuing...`)
      }
    }
    await updateCheckpoint(draftId, 'pages')
    await db.collection('ai_story_drafts').doc(draftId).update({
      'metadata.generationStep': 'pages',
      'metadata.progress': 40,
      'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
    })
    logger.info('[StoryScheduler] All pages generated')

    // Step 4: Generate Quiz
    logger.info('[StoryScheduler] Step 4/9: Generating quiz...')
    try {
      await callStoryAPI(
        '/api/admin/generate-story',
        {
          step: 'generate_quiz',
          jlptLevel,
          draftId,
        },
        adminKey
      )
      await updateCheckpoint(draftId, 'quiz')
      await db.collection('ai_story_drafts').doc(draftId).update({
        'metadata.generationStep': 'quiz',
        'metadata.progress': 50,
        'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
      })
      logger.info('[StoryScheduler] Quiz created')
    } catch (quizError) {
      logger.warn('[StoryScheduler] Quiz generation failed, continuing...', {
        error: quizError instanceof Error ? quizError.message : 'Unknown',
      })
      // Quiz is non-critical, still update checkpoint
      await updateCheckpoint(draftId, 'quiz')
      await db.collection('ai_story_drafts').doc(draftId).update({
        'metadata.generationStep': 'quiz',
        'metadata.progress': 50,
        'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    // Step 5: Generate Model Sheet (for character consistency) - with retry
    logger.info('[StoryScheduler] Step 5/9: Generating model sheet...')
    const modelSheetResult = await callStoryAPIWithRetry(
      '/api/admin/generate-story',
      {
        step: 'generate_model_sheet',
        draftId,
      },
      adminKey,
      2,
      3000
    )

    if (modelSheetResult.success) {
      logger.info('[StoryScheduler] Model sheet created')
    } else {
      logger.warn('[StoryScheduler] Model sheet generation failed after retries, continuing...', {
        error: modelSheetResult.error,
      })
    }
    await updateCheckpoint(draftId, 'model_sheet')
    await db.collection('ai_story_drafts').doc(draftId).update({
      'metadata.generationStep': 'model_sheet',
      'metadata.progress': 60,
      'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
    })

    // Step 6: Generate Page Images (PARALLEL with concurrency limit)
    logger.info('[StoryScheduler] Step 6/9: Generating page images (parallel)...')
    const imageResult = await generatePageImagesParallel(draftId, 1, pageCount, adminKey)
    const imagesGenerated = imageResult.generated
    const imagesFailed = imageResult.failed

    logger.info('[StoryScheduler] Page images completed', {
      generated: imagesGenerated,
      failed: imagesFailed,
      total: pageCount,
    })

    // CRITICAL: If images failed, DON'T publish - save as pending and exit
    if (imagesFailed > 0) {
      const errorMsg = `${imagesFailed} of ${pageCount} page images failed to generate`
      logger.warn('[StoryScheduler] Images incomplete - saving as pending_images', {
        draftId,
        imagesFailed,
        pageCount,
      })

      await markDraftAsPending(draftId, 'pending_images', errorMsg)

      // Log the incomplete generation
      await db.collection('story_generation_logs').add({
        type: 'scheduled',
        success: false,
        draftId,
        theme,
        jlptLevel,
        pageCount,
        imagesGenerated,
        imagesFailed,
        error: errorMsg,
        status: 'pending_images',
        duration: Date.now() - startTime,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Send warning alert
      await sendStoryGenerationWarningAlert(
        RESEND_API_KEY.value(),
        draftId,
        [`Story saved as pending - ${errorMsg}`, 'Will retry on next scheduler run'],
        { theme, jlptLevel, imagesGenerated, imagesFailed, pageCount }
      )

      return {
        success: false,
        draftId,
        error: `Story pending: ${errorMsg}. Will retry next run.`,
        duration: Date.now() - startTime,
      }
    }

    await updateCheckpoint(draftId, 'page_images')
    await db.collection('ai_story_drafts').doc(draftId).update({
      'metadata.generationStep': 'page_images',
      'metadata.progress': 70,
      'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
    })

    // Step 7: Generate Audio (with immediate retries)
    logger.info('[StoryScheduler] Step 7/9: Generating audio...')
    const audioResult = await callStoryAPIWithRetry(
      '/api/admin/generate-story',
      {
        step: 'generate_audio',
        draftId,
        voice: '23',
      },
      adminKey,
      3,  // 3 retries
      5000  // 5s, 10s, 15s backoff
    )

    if (audioResult.success) {
      await updateCheckpoint(draftId, 'audio')
      await db.collection('ai_story_drafts').doc(draftId).update({
        'metadata.generationStep': 'audio',
        'metadata.progress': 80,
        'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
      })
      logger.info('[StoryScheduler] Audio generated')
    } else {
      const errorMsg = audioResult.error || 'Audio generation failed after retries'
      logger.warn('[StoryScheduler] Audio generation failed - saving as pending_audio', {
        draftId,
        error: errorMsg,
      })

      await markDraftAsPending(draftId, 'pending_audio', errorMsg)

      // Log the incomplete generation
      await db.collection('story_generation_logs').add({
        type: 'scheduled',
        success: false,
        draftId,
        theme,
        jlptLevel,
        pageCount,
        imagesGenerated,
        imagesFailed,
        error: errorMsg,
        status: 'pending_audio',
        duration: Date.now() - startTime,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Send warning alert
      await sendStoryGenerationWarningAlert(
        RESEND_API_KEY.value(),
        draftId,
        [`Story saved as pending - ${errorMsg}`, 'Will retry on next scheduler run'],
        { theme, jlptLevel, imagesGenerated, imagesFailed, pageCount }
      )

      return {
        success: false,
        draftId,
        error: `Story pending: ${errorMsg}. Will retry next run.`,
        duration: Date.now() - startTime,
      }
    }

    // Step 8: Pre-generate sentence-level audio and translations (with immediate retries)
    logger.info('[StoryScheduler] Step 8/10: Generating sentence-level data...')
    const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get()
    const draftData = draftDoc.data()

    if (draftData?.pages && Array.isArray(draftData.pages)) {
      const pages = draftData.pages
        .map((page: any, index: number) => ({
          pageNumber: page.pageNumber || index + 1,
          text: page.text || '',
        }))
        .filter((page: any) => page.text.length > 0)

      logger.info('[StoryScheduler] Pre-generating sentences for pages', {
        draftId,
        pageCount: pages.length,
      })

      // Retry logic for sentence generation
      let sentenceSuccess = false
      let sentenceError: string | undefined

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await preGenerateStorySentences(draftId, pages)
          sentenceSuccess = true
          await updateCheckpoint(draftId, 'sentences')
          await db.collection('ai_story_drafts').doc(draftId).update({
            'metadata.generationStep': 'sentences',
            'metadata.progress': 90,
            'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
          })
          logger.info('[StoryScheduler] Sentence pre-generation completed', {
            draftId,
            pageCount: pages.length,
            attempt,
          })
          break
        } catch (error) {
          sentenceError = error instanceof Error ? error.message : 'Unknown error'
          logger.warn(`[StoryScheduler] Sentence pre-generation failed (attempt ${attempt}/3)`, {
            draftId,
            error: sentenceError,
          })
          if (attempt < 3) {
            const waitTime = 5000 * attempt  // 5s, 10s, 15s
            logger.info(`[StoryScheduler] Retrying sentences in ${waitTime}ms...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
          }
        }
      }

      if (!sentenceSuccess) {
        const errorMsg = sentenceError || 'Sentence pre-generation failed after retries'
        logger.warn('[StoryScheduler] Sentence pre-generation failed - saving as pending_sentences', {
          draftId,
          error: errorMsg,
        })

        await markDraftAsPending(draftId, 'pending_sentences', errorMsg)

        // Log the incomplete generation
        await db.collection('story_generation_logs').add({
          type: 'scheduled',
          success: false,
          draftId,
          theme,
          jlptLevel,
          pageCount,
          imagesGenerated,
          imagesFailed,
          error: errorMsg,
          status: 'pending_sentences',
          duration: Date.now() - startTime,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        // Send warning alert
        await sendStoryGenerationWarningAlert(
          RESEND_API_KEY.value(),
          draftId,
          [`Story saved as pending - ${errorMsg}`, 'Will retry on next scheduler run'],
          { theme, jlptLevel, imagesGenerated, imagesFailed, pageCount }
        )

        return {
          success: false,
          draftId,
          error: `Story pending: ${errorMsg}. Will retry next run.`,
          duration: Date.now() - startTime,
        }
      }
    } else {
      logger.warn('[StoryScheduler] No pages found in draft for sentence pre-generation', {
        draftId,
      })
      await updateCheckpoint(draftId, 'sentences')
    }

    // Step 8.5: Pre-generate word explanations (server-side prefetch)
    logger.info('[StoryScheduler] Step 8.5/10: Generating word explanations...')

    try {
      await db.collection('ai_story_drafts').doc(draftId).update({
        'metadata.generationStep': 'word_explanations',
        'metadata.progress': 92,
      })

      // Extract story text from pages
      const wordDraftDoc = await db.collection('ai_story_drafts').doc(draftId).get()
      const wordDraftData = wordDraftDoc.data()

      if (wordDraftData?.pages && Array.isArray(wordDraftData.pages)) {
        const storyText = wordDraftData.pages
          .map((page: any) => page.text || '')
          .join('\n')

        // Check timeout before starting (leave 2min buffer for publish step)
        const timeElapsed = Date.now() - startTime
        const timeRemaining = 540000 - timeElapsed  // 540s = 9min Cloud Function limit

        // DISABLED: Word precomputation requires Next.js dependencies (kuromoji, etc.)
        // that aren't available in Cloud Functions runtime. Words will be precomputed
        // on-demand when users access the story.
        logger.info('[StoryScheduler] Skipping word explanations - will be generated on-demand', {
          reason: 'Next.js dependencies not available in Cloud Functions',
          timeRemaining: Math.round(timeRemaining / 1000),
        })

        await updateCheckpoint(draftId, 'word_explanations')
        await db.collection('ai_story_drafts').doc(draftId).update({
          'metadata.progress': 94,
          'metadata.wordExplanationsSkipped': true,
        })
      } else {
        logger.warn('[StoryScheduler] No pages found for word explanation generation', { draftId })
        await updateCheckpoint(draftId, 'word_explanations')
      }
    } catch (wordError) {
      logger.warn('[StoryScheduler] Word explanation generation failed - continuing', {
        error: wordError instanceof Error ? wordError.message : 'Unknown error',
      })

      // Non-critical - story will still publish without word explanations
      await updateCheckpoint(draftId, 'word_explanations')
    }

    // Step 9: Publish the story (only if all critical assets are present)
    logger.info('[StoryScheduler] Step 9/10: Publishing story...')
    const publishResult = await callStoryAPI(
      '/api/admin/stories/publish-draft',
      { draftId },
      adminKey
    )

    const duration = Date.now() - startTime
    const storyId = publishResult.storyId

    // Mark as complete
    await db.collection('ai_story_drafts').doc(draftId).set({
      status: 'published',
      checkpoint: {
        lastCompletedStep: 'complete',
      },
      metadata: {
        generationStep: 'completed',
        progress: 100,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })

    // Log success to Firestore
    await db.collection('story_generation_logs').add({
      type: 'scheduled',
      success: true,
      storyId,
      draftId,
      theme,
      jlptLevel,
      pageCount,
      imagesGenerated,
      imagesFailed,
      duration,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    logger.info('[StoryScheduler] Story published successfully!', {
      storyId,
      draftId,
      theme,
      jlptLevel,
      imagesGenerated,
      imagesFailed,
      durationMs: duration,
      durationMin: (duration / 60000).toFixed(2),
    })

    return {
      success: true,
      storyId,
      draftId,
      duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    logger.error('[StoryScheduler] Story generation failed', {
      error: errorMessage,
      theme,
      jlptLevel,
      draftId,
      durationMs: duration,
    })

    // Log failure to Firestore
    await db.collection('story_generation_logs').add({
      type: 'scheduled',
      success: false,
      error: errorMessage,
      draftId,
      theme,
      jlptLevel,
      duration,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Send email alert for the failure
    await sendStoryGenerationFailureAlert(
      RESEND_API_KEY.value(),
      draftId || 'unknown',
      'unknown',
      errorMessage,
      {
        theme,
        jlptLevel,
        durationMs: duration,
      }
    )

    return {
      success: false,
      draftId,
      error: errorMessage,
      duration,
    }
  }
}

/**
 * Scheduled function - runs weekly on Sunday at 00:00 UTC
 * Now checks for incomplete drafts first before generating new stories
 */
export const scheduledStoryGeneratorFunction = onSchedule(
  {
    schedule: '0 0 * * 0', // Weekly on Sunday at 00:00 UTC
    timeZone: 'UTC',
    memory: '1GiB',
    timeoutSeconds: 540, // 9 minutes (max allowed)
    retryCount: 1, // Retry once on failure
    secrets: [OPENAI_API_KEY, MODAL_API_KEY, GEMINI_API_KEY, RESEND_API_KEY],
  },
  async event => {
    logger.info('[StoryScheduler] Scheduled trigger activated', {
      scheduleTime: event.scheduleTime,
      jobName: event.jobName,
    })

    const adminKey = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025'

    // FIRST: Check for incomplete drafts that need to be resumed
    const incompleteDraft = await findIncompleteDraft()

    if (incompleteDraft) {
      logger.info('[StoryScheduler] Found incomplete draft - resuming instead of generating new', {
        draftId: incompleteDraft.draftId,
        lastStep: incompleteDraft.checkpoint.lastCompletedStep,
        failedAttempts: incompleteDraft.checkpoint.failedAttempts,
      })

      const result = await resumeFromCheckpoint(incompleteDraft, adminKey)

      if (!result.success) {
        // Check if we've exceeded max retries
        const updatedDraft = await db.collection('ai_story_drafts').doc(incompleteDraft.draftId).get()
        const checkpoint = updatedDraft.data()?.checkpoint as DraftCheckpoint | undefined

        if (checkpoint && checkpoint.failedAttempts >= CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS) {
          // Mark as failed and send alert
          await db.collection('ai_story_drafts').doc(incompleteDraft.draftId).set({
            status: 'failed',
            error: `Max retries (${CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS}) exceeded`,
          }, { merge: true })

          await sendStoryGenerationFailureAlert(
            RESEND_API_KEY.value(),
            incompleteDraft.draftId,
            'unknown',
            `Story generation failed after ${CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS} attempts: ${result.error}`,
            {
              theme: incompleteDraft.theme,
              jlptLevel: incompleteDraft.jlptLevel,
              durationMs: result.duration,
            }
          )

          logger.error('[StoryScheduler] Draft marked as failed after max retries', {
            draftId: incompleteDraft.draftId,
            attempts: checkpoint.failedAttempts,
          })
        }

        // Don't throw - we want to try again next time (unless max retries exceeded)
        logger.warn('[StoryScheduler] Resume incomplete - will retry next run', result)
        return
      }

      logger.info('[StoryScheduler] Successfully resumed and published story', result)
      return
    }

    // No incomplete drafts - generate a new story
    logger.info('[StoryScheduler] No incomplete drafts - generating new story')
    const result = await generateDailyStory(adminKey)

    if (!result.success) {
      // If it failed but created a pending draft, don't throw (will retry next time)
      if (result.error?.includes('pending')) {
        logger.warn('[StoryScheduler] Story pending - will retry next run', result)
        return
      }

      // Throw to trigger Cloud Functions retry for unexpected failures
      throw new Error(`Story generation failed: ${result.error}`)
    }

    logger.info('[StoryScheduler] Daily story generation complete', result)
  }
)

/**
 * Manual trigger function for testing
 */
export const manualStoryGeneratorFunction = onCall(
  {
    memory: '1GiB',
    timeoutSeconds: 540,
    invoker: 'public', // Auth checked inside
    secrets: [OPENAI_API_KEY, MODAL_API_KEY, GEMINI_API_KEY, RESEND_API_KEY],
  },
  async request => {
    // Check authentication
    const adminKey = request.data?.adminKey
    const expectedAdminKey = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025'

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

    logger.info('[StoryScheduler] Manual trigger initiated', {
      userId: request.auth?.uid || 'admin-key',
      customTheme: request.data?.theme,
      customLevel: request.data?.jlptLevel,
    })

    // Manual trigger always generates NEW story (use dailyStoryRetryScheduler for retries)
    const result = await generateDailyStory(expectedAdminKey)

    return result
  }
)

/**
 * Daily retry scheduler - runs every day at 06:00 UTC
 * Only retries incomplete drafts, does NOT generate new stories
 * This ensures pending stories get resolved within days, not weeks
 */
export const dailyStoryRetryScheduler = onSchedule(
  {
    schedule: '0 6 * * *', // Daily at 06:00 UTC
    timeZone: 'UTC',
    memory: '1GiB',
    timeoutSeconds: 540,
    retryCount: 1,
    secrets: [OPENAI_API_KEY, MODAL_API_KEY, GEMINI_API_KEY, RESEND_API_KEY],
  },
  async event => {
    logger.info('[DailyRetry] Daily retry scheduler activated', {
      scheduleTime: event.scheduleTime,
      jobName: event.jobName,
    })

    const adminKey = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025'

    // Find incomplete drafts
    const incompleteDraft = await findIncompleteDraft()

    if (!incompleteDraft) {
      logger.info('[DailyRetry] No incomplete drafts found - nothing to retry')
      return
    }

    logger.info('[DailyRetry] Found incomplete draft - attempting to resume', {
      draftId: incompleteDraft.draftId,
      status: incompleteDraft.status,
      lastStep: incompleteDraft.checkpoint.lastCompletedStep,
      failedAttempts: incompleteDraft.checkpoint.failedAttempts,
    })

    const result = await resumeFromCheckpoint(incompleteDraft, adminKey)

    if (!result.success) {
      // Check if we've exceeded max retries
      const updatedDraft = await db.collection('ai_story_drafts').doc(incompleteDraft.draftId).get()
      const checkpoint = updatedDraft.data()?.checkpoint as DraftCheckpoint | undefined

      if (checkpoint && checkpoint.failedAttempts >= CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS) {
        // Mark as failed and send alert
        await db.collection('ai_story_drafts').doc(incompleteDraft.draftId).set({
          status: 'failed',
          error: `Max retries (${CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS}) exceeded`,
        }, { merge: true })

        await sendStoryGenerationFailureAlert(
          RESEND_API_KEY.value(),
          incompleteDraft.draftId,
          'unknown',
          `Story generation failed after ${CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS} attempts: ${result.error}`,
          {
            theme: incompleteDraft.theme,
            jlptLevel: incompleteDraft.jlptLevel,
            durationMs: result.duration,
          }
        )

        logger.error('[DailyRetry] Draft marked as failed after max retries', {
          draftId: incompleteDraft.draftId,
          attempts: checkpoint.failedAttempts,
        })
        return
      }

      logger.warn('[DailyRetry] Resume incomplete - will retry tomorrow', result)
      return
    }

    logger.info('[DailyRetry] Successfully resumed and published story', result)
  }
)
