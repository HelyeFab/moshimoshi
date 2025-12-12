/**
 * Comic Scheduler - Weekly "Moshi Goes to Japan" Episode Generation
 *
 * Generates a new comic episode featuring Moshi the red panda
 * exploring different locations in Japan.
 *
 * Flow:
 * 1. Load Moshi character reference (persistent across all episodes)
 * 2. Select episode theme/location
 * 3. Generate episode outline
 * 4. Generate panel dialogues
 * 5. Generate panel images (using character consistency)
 * 6. Extract vocabulary
 * 7. Generate cultural notes
 * 8. Generate quiz
 * 9. Generate audio
 * 10. Publish episode
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'

// Define secrets needed for comic generation
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY')
const MODAL_API_KEY = defineSecret('MODAL_API_KEY')
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')

// Initialize Firestore
const db = admin.firestore()

// App URL for API calls
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'

// Comic series ID for "Moshi Goes to Japan"
const MOSHI_SERIES_ID = 'moshi-goes-to-japan'
const MOSHI_CHARACTER_ID = 'moshi-master'

// Episode themes - locations and scenarios in Japan
const EPISODE_THEMES = [
  { theme: 'arrival', location: 'Narita Airport', titleEn: 'Arriving in Japan', titleJa: '日本に到着' },
  { theme: 'train', location: 'Shinkansen', titleEn: 'First Train Ride', titleJa: '初めての電車' },
  { theme: 'konbini', location: 'Convenience Store', titleEn: 'Konbini Adventure', titleJa: 'コンビニ冒険' },
  { theme: 'lost', location: 'Shibuya', titleEn: 'Lost in Tokyo', titleJa: '東京で迷子' },
  { theme: 'school', location: 'Japanese School', titleEn: 'Making Friends', titleJa: '友達を作る' },
  { theme: 'temple', location: 'Senso-ji Temple', titleEn: 'Temple Visit', titleJa: 'お寺参り' },
  { theme: 'sushi', location: 'Sushi Restaurant', titleEn: 'Sushi Surprise', titleJa: 'お寿司びっくり' },
  { theme: 'rain', location: 'Tokyo Streets', titleEn: 'Rainy Day', titleJa: '雨の日' },
  { theme: 'sakura', location: 'Ueno Park', titleEn: 'Cherry Blossoms', titleJa: '桜を見る' },
  { theme: 'matsuri', location: 'Summer Festival', titleEn: 'Festival Fun', titleJa: 'お祭り' },
  { theme: 'onsen', location: 'Hot Spring Town', titleEn: 'Onsen Experience', titleJa: '温泉体験' },
  { theme: 'karaoke', location: 'Karaoke Box', titleEn: 'Karaoke Night', titleJa: 'カラオケの夜' },
  { theme: 'ramen', location: 'Ramen Shop', titleEn: 'Ramen Quest', titleJa: 'ラーメン探し' },
  { theme: 'castle', location: 'Osaka Castle', titleEn: 'Castle Adventure', titleJa: 'お城冒険' },
  { theme: 'deer', location: 'Nara Park', titleEn: 'Deer Friends', titleJa: '鹿の友達' },
  { theme: 'geisha', location: 'Kyoto Gion', titleEn: 'Kyoto Magic', titleJa: '京都の魔法' },
  { theme: 'arcade', location: 'Game Center', titleEn: 'Arcade Challenge', titleJa: 'ゲームセンター' },
  { theme: 'fishing', location: 'Tsukiji Market', titleEn: 'Fish Market Morning', titleJa: '魚市場の朝' },
  { theme: 'snow', location: 'Hokkaido', titleEn: 'Snow Day', titleJa: '雪の日' },
  { theme: 'goodbye', location: 'Tokyo Station', titleEn: 'Until Next Time', titleJa: 'また会う日まで' },
] as const

// JLPT levels to rotate through (weighted towards beginner)
const JLPT_LEVELS = ['N5', 'N5', 'N5', 'N4', 'N4', 'N3'] as const

/**
 * Helper to make API calls with admin authentication
 */
async function callComicAPI(
  endpoint: string,
  body: Record<string, any>,
  adminKey: string
): Promise<any> {
  const url = `${APP_URL}${endpoint}`

  logger.info('[ComicScheduler] Calling API', { endpoint, step: body.step })

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
 */
async function callComicAPIWithRetry(
  endpoint: string,
  body: Record<string, any>,
  adminKey: string,
  maxRetries: number = 2,
  delayMs: number = 2000
): Promise<{ success: boolean; data?: any; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await callComicAPI(endpoint, body, adminKey)
      return { success: true, data: result }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logger.warn(`[ComicScheduler] API call failed (attempt ${attempt}/${maxRetries})`, {
        endpoint,
        step: body.step,
        error: errorMsg,
      })

      if (attempt < maxRetries) {
        const waitTime = delayMs * attempt
        logger.info(`[ComicScheduler] Retrying in ${waitTime}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      } else {
        return { success: false, error: errorMsg }
      }
    }
  }
  return { success: false, error: 'Max retries exceeded' }
}

/**
 * Get the next episode number for the series
 */
async function getNextEpisodeNumber(): Promise<number> {
  const seriesDoc = await db.collection('comic_series').doc(MOSHI_SERIES_ID).get()

  if (!seriesDoc.exists) {
    // Create the series if it doesn't exist
    await db.collection('comic_series').doc(MOSHI_SERIES_ID).set({
      id: MOSHI_SERIES_ID,
      slug: 'moshi-goes-to-japan',
      title: 'Moshi Goes to Japan',
      titleJa: 'もしの日本旅行',
      description: 'Follow Moshi the red panda on adventures across Japan while learning Japanese!',
      descriptionJa: 'レッサーパンダのもしと一緒に日本を冒険しながら日本語を学ぼう！',
      mainCharacterId: MOSHI_CHARACTER_ID,
      defaultJlptLevel: 'N5',
      visualStyle: 'Kawaii manga style, soft colors, children\'s book illustration',
      episodeCount: 0,
      publishedEpisodeCount: 0,
      totalViews: 0,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return 1
  }

  const data = seriesDoc.data()
  return (data?.episodeCount || 0) + 1
}

/**
 * Load Moshi character reference for consistency
 */
async function loadMoshiReference(): Promise<{
  referenceImageData: string
  characterSheet: any
} | null> {
  const charDoc = await db.collection('saved_characters').doc(MOSHI_CHARACTER_ID).get()

  if (!charDoc.exists) {
    logger.warn('[ComicScheduler] Moshi character not found! Run setup script first.')
    return null
  }

  const data = charDoc.data()
  return {
    referenceImageData: data?.referenceImageData || '',
    characterSheet: {
      mainCharacter: {
        name: data?.name || 'Moshi',
        nameJa: data?.nameJa || 'もし',
        description: data?.description || '',
        visualDescription: data?.visualDescription || '',
        personality: data?.personality || '',
      },
      visualStyle: data?.visualStyle || 'Kawaii manga style',
    },
  }
}

/**
 * Select episode theme based on episode number
 */
function selectEpisodeTheme(episodeNumber: number): {
  theme: string
  location: string
  titleEn: string
  titleJa: string
  jlptLevel: string
} {
  const themeIndex = (episodeNumber - 1) % EPISODE_THEMES.length
  const levelIndex = (episodeNumber - 1) % JLPT_LEVELS.length

  const episodeTheme = EPISODE_THEMES[themeIndex]
  const jlptLevel = JLPT_LEVELS[levelIndex]

  return {
    theme: episodeTheme.theme,
    location: episodeTheme.location,
    titleEn: episodeTheme.titleEn,
    titleJa: episodeTheme.titleJa,
    jlptLevel,
  }
}

/**
 * Main comic episode generation function
 */
export async function generateComicEpisode(
  adminKey: string,
  options?: {
    theme?: string
    location?: string
    jlptLevel?: string
    episodeNumber?: number
  }
): Promise<{
  success: boolean
  episodeId?: string
  draftId?: string
  error?: string
  duration: number
}> {
  const startTime = Date.now()

  try {
    // Get next episode number
    const episodeNumber = options?.episodeNumber || (await getNextEpisodeNumber())

    // Select or use provided theme
    const themeData = selectEpisodeTheme(episodeNumber)
    const theme = options?.theme || themeData.theme
    const location = options?.location || themeData.location
    const jlptLevel = options?.jlptLevel || themeData.jlptLevel

    logger.info('[ComicScheduler] Starting comic episode generation', {
      episodeNumber,
      theme,
      location,
      jlptLevel,
      timestamp: new Date().toISOString(),
    })

    // Load Moshi character reference
    const moshiRef = await loadMoshiReference()
    if (!moshiRef) {
      throw new Error('Moshi character reference not found. Run setup script first.')
    }

    // Step 1: Create draft and generate outline
    logger.info('[ComicScheduler] Step 1/8: Generating outline...')
    const outlineResult = await callComicAPI(
      '/api/admin/comics/generate',
      {
        step: 'outline',
        seriesId: MOSHI_SERIES_ID,
        episodeNumber,
        theme,
        location,
        jlptLevel,
        characterRef: moshiRef,
      },
      adminKey
    )

    if (!outlineResult.success || !outlineResult.draftId) {
      throw new Error('Failed to generate outline')
    }

    const draftId = outlineResult.draftId
    logger.info('[ComicScheduler] Outline created', { draftId })

    // Step 2: Generate panel dialogues
    logger.info('[ComicScheduler] Step 2/8: Generating dialogues...')
    const dialogueResult = await callComicAPI(
      '/api/admin/comics/generate',
      {
        step: 'dialogues',
        draftId,
        jlptLevel,
      },
      adminKey
    )

    if (!dialogueResult.success) {
      throw new Error('Failed to generate dialogues')
    }
    logger.info('[ComicScheduler] Dialogues created')

    // Step 3: Generate panel images (with character consistency)
    logger.info('[ComicScheduler] Step 3/8: Generating panel images...')
    const panelCount = outlineResult.panelCount || 6

    let imagesGenerated = 0
    let imagesFailed = 0

    for (let panelNum = 1; panelNum <= panelCount; panelNum++) {
      logger.info(`[ComicScheduler] Generating image for panel ${panelNum}/${panelCount}...`)

      const imageResult = await callComicAPIWithRetry(
        '/api/admin/comics/generate',
        {
          step: 'panel_image',
          draftId,
          panelNumber: panelNum,
          characterRef: moshiRef,
        },
        adminKey,
        3,
        3000
      )

      if (imageResult.success) {
        imagesGenerated++
      } else {
        imagesFailed++
        logger.warn(`[ComicScheduler] Image failed for panel ${panelNum}`, {
          error: imageResult.error,
        })
      }
    }

    logger.info('[ComicScheduler] Panel images completed', {
      generated: imagesGenerated,
      failed: imagesFailed,
    })

    // Step 4: Extract vocabulary
    logger.info('[ComicScheduler] Step 4/8: Extracting vocabulary...')
    try {
      await callComicAPI(
        '/api/admin/comics/generate',
        {
          step: 'vocabulary',
          draftId,
          jlptLevel,
        },
        adminKey
      )
      logger.info('[ComicScheduler] Vocabulary extracted')
    } catch (vocabError) {
      logger.warn('[ComicScheduler] Vocabulary extraction failed, continuing...', {
        error: vocabError instanceof Error ? vocabError.message : 'Unknown',
      })
    }

    // Step 5: Generate cultural notes
    logger.info('[ComicScheduler] Step 5/8: Generating cultural notes...')
    try {
      await callComicAPI(
        '/api/admin/comics/generate',
        {
          step: 'cultural_notes',
          draftId,
          location,
        },
        adminKey
      )
      logger.info('[ComicScheduler] Cultural notes created')
    } catch (cultureError) {
      logger.warn('[ComicScheduler] Cultural notes failed, continuing...', {
        error: cultureError instanceof Error ? cultureError.message : 'Unknown',
      })
    }

    // Step 6: Generate quiz
    logger.info('[ComicScheduler] Step 6/8: Generating quiz...')
    try {
      await callComicAPI(
        '/api/admin/comics/generate',
        {
          step: 'quiz',
          draftId,
          jlptLevel,
        },
        adminKey
      )
      logger.info('[ComicScheduler] Quiz created')
    } catch (quizError) {
      logger.warn('[ComicScheduler] Quiz generation failed, continuing...', {
        error: quizError instanceof Error ? quizError.message : 'Unknown',
      })
    }

    // Step 7: Generate audio for dialogues
    logger.info('[ComicScheduler] Step 7/8: Generating audio...')
    try {
      await callComicAPI(
        '/api/admin/comics/generate',
        {
          step: 'audio',
          draftId,
        },
        adminKey
      )
      logger.info('[ComicScheduler] Audio generated')
    } catch (audioError) {
      logger.warn('[ComicScheduler] Audio generation failed, continuing...', {
        error: audioError instanceof Error ? audioError.message : 'Unknown',
      })
    }

    // Step 8: Publish the episode
    logger.info('[ComicScheduler] Step 8/8: Publishing episode...')
    const publishResult = await callComicAPI(
      '/api/admin/comics/publish',
      { draftId },
      adminKey
    )

    const duration = Date.now() - startTime
    const episodeId = publishResult.episodeId

    // Update series episode count
    await db.collection('comic_series').doc(MOSHI_SERIES_ID).update({
      episodeCount: admin.firestore.FieldValue.increment(1),
      publishedEpisodeCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Log success
    await db.collection('comic_generation_logs').add({
      type: 'scheduled',
      success: true,
      seriesId: MOSHI_SERIES_ID,
      episodeId,
      draftId,
      episodeNumber,
      theme,
      location,
      jlptLevel,
      panelCount,
      imagesGenerated,
      imagesFailed,
      duration,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    logger.info('[ComicScheduler] Episode published successfully!', {
      episodeId,
      episodeNumber,
      theme,
      location,
      imagesGenerated,
      durationMs: duration,
      durationMin: (duration / 60000).toFixed(2),
    })

    return {
      success: true,
      episodeId,
      draftId,
      duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    logger.error('[ComicScheduler] Episode generation failed', {
      error: errorMessage,
      durationMs: duration,
    })

    // Log failure
    await db.collection('comic_generation_logs').add({
      type: 'scheduled',
      success: false,
      seriesId: MOSHI_SERIES_ID,
      error: errorMessage,
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
 * Scheduled function - runs weekly on Sunday at 00:00 UTC
 */
export const scheduledComicGeneratorFunction = onSchedule(
  {
    schedule: '0 0 * * 0', // Weekly on Sunday at 00:00 UTC
    timeZone: 'UTC',
    memory: '1GiB',
    timeoutSeconds: 540, // 9 minutes
    retryCount: 1,
    secrets: [OPENAI_API_KEY, MODAL_API_KEY, GEMINI_API_KEY],
  },
  async event => {
    logger.info('[ComicScheduler] Scheduled trigger activated', {
      scheduleTime: event.scheduleTime,
      jobName: event.jobName,
    })

    const adminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY || 'comic-scheduler-2025'

    const result = await generateComicEpisode(adminKey)

    if (!result.success) {
      throw new Error(`Comic generation failed: ${result.error}`)
    }

    logger.info('[ComicScheduler] Weekly comic generation complete', result)
  }
)

/**
 * Manual trigger function for testing
 */
export const manualComicGeneratorFunction = onCall(
  {
    memory: '1GiB',
    timeoutSeconds: 540,
    invoker: 'public',
    secrets: [OPENAI_API_KEY, MODAL_API_KEY, GEMINI_API_KEY],
  },
  async request => {
    const adminKey = request.data?.adminKey
    const expectedAdminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY || 'comic-scheduler-2025'

    if (!request.auth && adminKey !== expectedAdminKey) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated or provide valid admin key'
      )
    }

    if (request.auth) {
      const userDoc = await db.collection('users').doc(request.auth.uid).get()
      const userData = userDoc.data()
      if (!userData?.isAdmin) {
        throw new HttpsError('permission-denied', 'Admin access required')
      }
    }

    logger.info('[ComicScheduler] Manual trigger initiated', {
      userId: request.auth?.uid || 'admin-key',
      customTheme: request.data?.theme,
      customLocation: request.data?.location,
    })

    const result = await generateComicEpisode(adminKey || expectedAdminKey, {
      theme: request.data?.theme,
      location: request.data?.location,
      jlptLevel: request.data?.jlptLevel,
      episodeNumber: request.data?.episodeNumber,
    })

    return result
  }
)
