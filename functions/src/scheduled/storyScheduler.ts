/**
 * Story Scheduler - Daily AI Story Generation
 * Generates a new educational Japanese story every day at 00:00 UTC
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
 * 9. Publish story
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { preGenerateStorySentences } from '../utils/sentencePreGenerator'

// Define secrets needed for story generation
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY')
const MODAL_API_KEY = defineSecret('MODAL_API_KEY')
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')

// Initialize Firestore
const db = admin.firestore()

// App URL for API calls
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'

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

// JLPT levels to rotate through (weighted towards beginner)
const JLPT_LEVELS = ['N5', 'N5', 'N5', 'N4', 'N4', 'N3'] as const

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
 * Main story generation function
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

    const draftId = characterResult.draftId
    logger.info('[StoryScheduler] Character sheet created', { draftId })

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
      logger.info('[StoryScheduler] Quiz created')
    } catch (quizError) {
      logger.warn('[StoryScheduler] Quiz generation failed, continuing...', {
        error: quizError instanceof Error ? quizError.message : 'Unknown',
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
      2, // 2 attempts
      3000
    )

    if (modelSheetResult.success) {
      logger.info('[StoryScheduler] Model sheet created')
    } else {
      logger.warn('[StoryScheduler] Model sheet generation failed after retries, continuing...', {
        error: modelSheetResult.error,
      })
    }

    // Step 6: Generate Page Images (with retry logic)
    logger.info('[StoryScheduler] Step 6/9: Generating page images...')
    let imagesGenerated = 0
    let imagesFailed = 0

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      logger.info(`[StoryScheduler] Generating image for page ${pageNum}/${pageCount}...`)

      const imageResult = await callStoryAPIWithRetry(
        '/api/admin/generate-story',
        {
          step: 'generate_page_image',
          draftId,
          pageNumber: pageNum,
        },
        adminKey,
        3, // 3 attempts for images
        3000 // 3 second delay between retries
      )

      if (imageResult.success) {
        imagesGenerated++
        logger.info(`[StoryScheduler] Image generated for page ${pageNum}`)
      } else {
        imagesFailed++
        logger.warn(
          `[StoryScheduler] Image generation failed for page ${pageNum} after all retries`,
          {
            error: imageResult.error,
          }
        )
      }
    }

    logger.info('[StoryScheduler] Page images completed', {
      generated: imagesGenerated,
      failed: imagesFailed,
      total: pageCount,
    })

    // Step 7: Generate Audio
    logger.info('[StoryScheduler] Step 7/9: Generating audio...')
    try {
      await callStoryAPI(
        '/api/admin/generate-story',
        {
          step: 'generate_audio',
          draftId,
          voice: 'nemo',
        },
        adminKey
      )
      logger.info('[StoryScheduler] Audio generated')
    } catch (audioError) {
      logger.warn('[StoryScheduler] Audio generation failed', {
        error: audioError instanceof Error ? audioError.message : 'Unknown',
      })
    }

    // Step 8: Pre-generate sentence-level audio and translations
    logger.info('[StoryScheduler] Step 8/9: Generating sentence-level data...')
    try {
      // Fetch the draft to get page texts
      const draftDoc = await db.collection('story_drafts').doc(draftId).get()
      const draftData = draftDoc.data()

      if (draftData?.pages && Array.isArray(draftData.pages)) {
        const pages = draftData.pages.map((page: any, index: number) => ({
          pageNumber: page.pageNumber || index + 1,
          text: page.text || '',
        })).filter((page: any) => page.text.length > 0)

        logger.info('[StoryScheduler] Pre-generating sentences for pages', {
          draftId,
          pageCount: pages.length,
        })

        await preGenerateStorySentences(draftId, pages)

        logger.info('[StoryScheduler] Sentence pre-generation completed', {
          draftId,
          pageCount: pages.length,
        })
      } else {
        logger.warn('[StoryScheduler] No pages found in draft for sentence pre-generation', {
          draftId,
        })
      }
    } catch (sentenceError) {
      logger.warn('[StoryScheduler] Sentence pre-generation failed', {
        error: sentenceError instanceof Error ? sentenceError.message : 'Unknown',
      })
      // Continue - don't fail story generation if sentences fail
    }

    // Step 9: Publish the story
    logger.info('[StoryScheduler] Step 9/9: Publishing story...')
    const publishResult = await callStoryAPI(
      '/api/admin/stories/publish-draft',
      { draftId },
      adminKey
    )

    const duration = Date.now() - startTime
    const storyId = publishResult.storyId

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
      durationMs: duration,
    })

    // Log failure to Firestore
    await db.collection('story_generation_logs').add({
      type: 'scheduled',
      success: false,
      error: errorMessage,
      theme,
      jlptLevel,
      duration,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return {
      success: false,
      error: errorMessage,
      duration,
    }
  }
}

/**
 * Scheduled function - runs daily at 00:00 UTC
 */
export const scheduledStoryGeneratorFunction = onSchedule(
  {
    schedule: '0 0 * * *', // Daily at 00:00 UTC
    timeZone: 'UTC',
    memory: '1GiB',
    timeoutSeconds: 540, // 9 minutes (max allowed)
    retryCount: 1, // Retry once on failure
    secrets: [OPENAI_API_KEY, MODAL_API_KEY, GEMINI_API_KEY],
  },
  async event => {
    logger.info('[StoryScheduler] Scheduled trigger activated', {
      scheduleTime: event.scheduleTime,
      jobName: event.jobName,
    })

    // Get admin key from environment
    const adminKey = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025'

    const result = await generateDailyStory(adminKey)

    if (!result.success) {
      // Throw to trigger retry
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
    secrets: [OPENAI_API_KEY, MODAL_API_KEY, GEMINI_API_KEY],
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

    const result = await generateDailyStory(expectedAdminKey)

    return result
  }
)
