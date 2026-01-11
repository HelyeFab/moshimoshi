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
 * 10. Generate word explanations (comprehensive, instant-lookup) - BEFORE publishing
 * 11. Publish episode
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { precomputeWordExplanations } from '../../../src/lib/ai/precompute/wordPrecompute'

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

// Character IDs - main cast for the series
const CHARACTER_IDS = {
  MOSHI: 'moshi-master',
  SENSEI: 'sensei-panda',
  YUKI: 'yuki-sloth',
  KOA: 'koa-koala',
}

// Character interface for loaded references
// NOTE: We only pass imageUrl (not base64) to avoid payload size limits
// The generate API fetches the actual image data from Storage when needed
interface CharacterRef {
  id: string
  name: string
  nameJa: string
  role: string
  visualDescription: string
  personality: string
  speakingStyle?: string
  imageUrl: string
}

// Episode themes - locations and scenarios in Japan with character combinations
// Each theme specifies which characters appear (Moshi always included)
const EPISODE_THEMES = [
  // Solo Moshi episodes (introductory)
  { theme: 'arrival', location: 'Narita Airport', titleEn: 'Arriving in Japan', titleJa: '日本に到着', characters: ['moshi-master'] },

  // Episodes with Sensei (learning cultural lessons)
  { theme: 'temple', location: 'Senso-ji Temple', titleEn: 'Temple Visit', titleJa: 'お寺参り', characters: ['moshi-master', 'sensei-panda'] },
  { theme: 'geisha', location: 'Kyoto Gion', titleEn: 'Kyoto Magic', titleJa: '京都の魔法', characters: ['moshi-master', 'sensei-panda'] },
  { theme: 'castle', location: 'Osaka Castle', titleEn: 'Castle Adventure', titleJa: 'お城冒険', characters: ['moshi-master', 'sensei-panda'] },
  { theme: 'onsen', location: 'Hot Spring Town', titleEn: 'Onsen Experience', titleJa: '温泉体験', characters: ['moshi-master', 'sensei-panda'] },

  // Episodes with Yuki (relaxed, mindful adventures)
  { theme: 'sakura', location: 'Ueno Park', titleEn: 'Cherry Blossoms', titleJa: '桜を見る', characters: ['moshi-master', 'yuki-sloth'] },
  { theme: 'rain', location: 'Tokyo Streets', titleEn: 'Rainy Day', titleJa: '雨の日', characters: ['moshi-master', 'yuki-sloth'] },
  { theme: 'ramen', location: 'Ramen Shop', titleEn: 'Ramen Quest', titleJa: 'ラーメン探し', characters: ['moshi-master', 'yuki-sloth'] },
  { theme: 'konbini', location: 'Convenience Store', titleEn: 'Konbini Adventure', titleJa: 'コンビニ冒険', characters: ['moshi-master', 'yuki-sloth'] },

  // Episodes with Koa (adventurous exploration)
  { theme: 'train', location: 'Shinkansen', titleEn: 'First Train Ride', titleJa: '初めての電車', characters: ['moshi-master', 'koa-koala'] },
  { theme: 'lost', location: 'Shibuya', titleEn: 'Lost in Tokyo', titleJa: '東京で迷子', characters: ['moshi-master', 'koa-koala'] },
  { theme: 'arcade', location: 'Game Center', titleEn: 'Arcade Challenge', titleJa: 'ゲームセンター', characters: ['moshi-master', 'koa-koala'] },
  { theme: 'snow', location: 'Hokkaido', titleEn: 'Snow Day', titleJa: '雪の日', characters: ['moshi-master', 'koa-koala'] },

  // Group episodes (multiple friends)
  { theme: 'matsuri', location: 'Summer Festival', titleEn: 'Festival Fun', titleJa: 'お祭り', characters: ['moshi-master', 'yuki-sloth', 'koa-koala'] },
  { theme: 'sushi', location: 'Sushi Restaurant', titleEn: 'Sushi Surprise', titleJa: 'お寿司びっくり', characters: ['moshi-master', 'yuki-sloth', 'koa-koala'] },
  { theme: 'karaoke', location: 'Karaoke Box', titleEn: 'Karaoke Night', titleJa: 'カラオケの夜', characters: ['moshi-master', 'yuki-sloth', 'koa-koala'] },
  { theme: 'deer', location: 'Nara Park', titleEn: 'Deer Friends', titleJa: '鹿の友達', characters: ['moshi-master', 'yuki-sloth', 'koa-koala'] },
  { theme: 'fishing', location: 'Tsukiji Market', titleEn: 'Fish Market Morning', titleJa: '魚市場の朝', characters: ['moshi-master', 'sensei-panda', 'koa-koala'] },
  { theme: 'school', location: 'Japanese School', titleEn: 'Making Friends', titleJa: '友達を作る', characters: ['moshi-master', 'sensei-panda', 'yuki-sloth', 'koa-koala'] },

  // Finale with all characters
  { theme: 'goodbye', location: 'Tokyo Station', titleEn: 'Until Next Time', titleJa: 'また会う日まで', characters: ['moshi-master', 'sensei-panda', 'yuki-sloth', 'koa-koala'] },
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

      // CRITICAL FIX: Check if the API response itself indicates failure
      // Some endpoints return HTTP 200 with {success: false, error: "..."}
      if (result && typeof result.success === 'boolean' && !result.success) {
        const errorMsg = result.error || 'API returned success: false'
        throw new Error(errorMsg)
      }

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
 * Get and reserve the next episode number for the series using a transaction.
 * This ensures idempotency - concurrent calls will get different episode numbers.
 */
async function getNextEpisodeNumber(): Promise<number> {
  const seriesRef = db.collection('comic_series').doc(MOSHI_SERIES_ID)

  return db.runTransaction(async transaction => {
    const seriesDoc = await transaction.get(seriesRef)

    if (!seriesDoc.exists) {
      // Create the series if it doesn't exist with episodeCount = 1 (reserving episode 1)
      transaction.set(seriesRef, {
        id: MOSHI_SERIES_ID,
        slug: 'moshi-goes-to-japan',
        title: 'Moshi Goes to Japan',
        titleJa: 'もしの日本旅行',
        description: 'Follow Moshi the red panda on adventures across Japan while learning Japanese!',
        descriptionJa: 'レッサーパンダのもしと一緒に日本を冒険しながら日本語を学ぼう！',
        mainCharacterId: CHARACTER_IDS.MOSHI,
        defaultJlptLevel: 'N5',
        visualStyle: 'Kawaii manga style, soft colors, children\'s book illustration',
        episodeCount: 1, // Reserve episode 1
        publishedEpisodeCount: 0,
        totalViews: 0,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      return 1
    }

    const data = seriesDoc.data()
    const nextEpisodeNumber = (data?.episodeCount || 0) + 1

    // Atomically reserve this episode number
    transaction.update(seriesRef, {
      episodeCount: nextEpisodeNumber,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    logger.info(`[ComicScheduler] Reserved episode number ${nextEpisodeNumber}`)
    return nextEpisodeNumber
  })
}

/**
 * Load multiple character references for an episode
 * Only loads metadata and imageUrl - the generate API fetches base64 when needed
 * This keeps the payload small to avoid 413 errors
 */
async function loadCharacters(characterIds: string[]): Promise<CharacterRef[]> {
  const characters: CharacterRef[] = []

  for (const characterId of characterIds) {
    const charDoc = await db.collection('saved_characters').doc(characterId).get()

    if (!charDoc.exists) {
      logger.warn(`[ComicScheduler] Character ${characterId} not found, skipping...`)
      continue
    }

    const data = charDoc.data()
    const imageUrl = data?.referenceImageUrl || ''

    if (!imageUrl) {
      logger.warn(`[ComicScheduler] No reference image URL for ${data?.name || characterId} - character may be inconsistent`)
    }

    characters.push({
      id: characterId,
      name: data?.name || characterId,
      nameJa: data?.nameJa || '',
      role: data?.role || 'friend',
      visualDescription: data?.visualDescription || '',
      personality: data?.personality || '',
      speakingStyle: data?.speakingStyle || '',
      imageUrl,
    })
  }

  logger.info(`[ComicScheduler] Loaded ${characters.length} characters: ${characters.map(c => c.name).join(', ')}`)
  return characters
}

/**
 * Build character sheet for prompt generation (legacy compatibility)
 */
function buildCharacterSheet(characters: CharacterRef[]) {
  const mainCharacter = characters.find(c => c.role === 'protagonist') || characters[0]
  const supportingCharacters = characters.filter(c => c.id !== mainCharacter?.id)

  return {
    mainCharacter: {
      id: mainCharacter?.id,
      name: mainCharacter?.name || 'Moshi',
      nameJa: mainCharacter?.nameJa || 'もし',
      visualDescription: mainCharacter?.visualDescription || '',
      personality: mainCharacter?.personality || '',
      speakingStyle: mainCharacter?.speakingStyle || '',
    },
    supportingCharacters: supportingCharacters.map(c => ({
      id: c.id,
      name: c.name,
      nameJa: c.nameJa,
      role: c.role,
      visualDescription: c.visualDescription,
      personality: c.personality,
      speakingStyle: c.speakingStyle,
    })),
    allCharacters: characters.map(c => ({
      id: c.id,
      name: c.name,
      nameJa: c.nameJa,
      role: c.role,
    })),
    visualStyle: 'Kawaii manga style',
  }
}

/**
 * Queue item interface for scheduled generation
 */
interface ComicQueueItem {
  id: string
  theme: string
  location: string
  titleEn?: string
  titleJa?: string
  characterIds: string[]
  jlptLevel: string
  priority: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

/**
 * Get the next episode from the generation queue
 * Returns null if queue is empty
 */
async function getNextFromQueue(): Promise<ComicQueueItem | null> {
  try {
    const queueSnapshot = await db
      .collection('comic_generation_queue')
      .where('status', '==', 'pending')
      .orderBy('priority', 'asc')
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get()

    if (queueSnapshot.empty) {
      logger.info('[ComicScheduler] Queue is empty, will use auto-cycle')
      return null
    }

    const doc = queueSnapshot.docs[0]
    const data = doc.data()

    logger.info('[ComicScheduler] Found queue item:', {
      id: doc.id,
      theme: data.theme,
      location: data.location,
    })

    return {
      id: doc.id,
      theme: data.theme,
      location: data.location,
      titleEn: data.titleEn,
      titleJa: data.titleJa,
      characterIds: data.characterIds || ['moshi-master'],
      jlptLevel: data.jlptLevel || 'N5',
      priority: data.priority,
      status: data.status,
    }
  } catch (error) {
    logger.error('[ComicScheduler] Error fetching queue:', error)
    return null
  }
}

/**
 * Mark queue item as processing
 */
async function markQueueItemProcessing(queueItemId: string): Promise<void> {
  await db.collection('comic_generation_queue').doc(queueItemId).update({
    status: 'processing',
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

/**
 * Mark queue item as completed with episode ID
 */
async function markQueueItemCompleted(queueItemId: string, episodeId: string): Promise<void> {
  await db.collection('comic_generation_queue').doc(queueItemId).update({
    status: 'completed',
    episodeId,
  })
}

/**
 * Mark queue item as failed with error
 */
async function markQueueItemFailed(queueItemId: string, error: string): Promise<void> {
  await db.collection('comic_generation_queue').doc(queueItemId).update({
    status: 'failed',
    error,
  })
}

/**
 * Select episode theme based on episode number (fallback when queue is empty)
 */
function selectEpisodeTheme(episodeNumber: number): {
  theme: string
  location: string
  titleEn: string
  titleJa: string
  jlptLevel: string
  characterIds: string[]
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
    characterIds: [...episodeTheme.characters], // Characters for this episode
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
  let startLogId: string | null = null
  let queueItem: ComicQueueItem | null = null

  try {
    // Get next episode number
    const episodeNumber = options?.episodeNumber || (await getNextEpisodeNumber())

    // First check if there's a queued episode to generate
    // Queue takes priority over auto-cycle (unless manual options are provided)
    let theme: string
    let location: string
    let jlptLevel: string
    let characterIds: string[]

    if (!options?.theme && !options?.location) {
      // No manual options provided, check queue first
      queueItem = await getNextFromQueue()
    }

    if (queueItem) {
      // Use queue item settings
      theme = queueItem.theme
      location = queueItem.location
      jlptLevel = queueItem.jlptLevel
      characterIds = queueItem.characterIds

      // Mark queue item as processing
      await markQueueItemProcessing(queueItem.id)

      logger.info('[ComicScheduler] Using queue item settings', {
        queueItemId: queueItem.id,
        theme,
        location,
        jlptLevel,
        characters: characterIds,
      })
    } else {
      // Fallback to auto-cycle based on episode number
      const themeData = selectEpisodeTheme(episodeNumber)
      theme = options?.theme || themeData.theme
      location = options?.location || themeData.location
      jlptLevel = options?.jlptLevel || themeData.jlptLevel
      characterIds = themeData.characterIds

      logger.info('[ComicScheduler] Using auto-cycle settings', {
        episodeNumber,
        theme,
        location,
      })
    }

    logger.info('[ComicScheduler] Starting comic episode generation', {
      episodeNumber,
      theme,
      location,
      jlptLevel,
      characters: characterIds,
      timestamp: new Date().toISOString(),
    })

    // Log generation start to Firestore for audit trail
    const startLogRef = await db.collection('comic_generation_logs').add({
      type: queueItem ? 'queued' : 'scheduled',
      status: 'started',
      seriesId: MOSHI_SERIES_ID,
      episodeNumber,
      theme,
      location,
      jlptLevel,
      characterIds,
      queueItemId: queueItem?.id || null,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    startLogId = startLogRef.id
    logger.info(`[ComicScheduler] Generation log created: ${startLogId}`)

    // Load all characters for this episode (supports multi-character stories)
    const characters = await loadCharacters(characterIds)
    if (characters.length === 0) {
      throw new Error('No characters loaded. Run setup scripts first.')
    }

    // Build character sheet and refs for API
    // NOTE: We pass imageUrl instead of base64 to keep payload small
    // The generate API fetches base64 from the URL when needed
    const characterSheet = buildCharacterSheet(characters)
    const characterRefs = characters.map(c => ({
      id: c.id,
      name: c.name,
      nameJa: c.nameJa,
      role: c.role,
      visualDescription: c.visualDescription,
      personality: c.personality,
      speakingStyle: c.speakingStyle,
      imageUrl: c.imageUrl,
    }))

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
        characterSheet, // Full character info for prompts
        characterRefs, // Character references with image URLs (API fetches base64)
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
          characterRefs, // Pass all character references for multi-character consistency
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
    logger.info('[ComicScheduler] Step 7/9: Generating audio...')
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

    // Step 7.5: Generate word explanations (before publishing, same as story scheduler)
    logger.info('[ComicScheduler] Step 7.5/9: Generating word explanations...')

    try {
      // Extract comic text from panels (dialogues + narrations)
      const wordDraftDoc = await db.collection('comic_drafts').doc(draftId).get()
      const wordDraftData = wordDraftDoc.data()

      if (wordDraftData?.panels && Array.isArray(wordDraftData.panels)) {
        const comicText = wordDraftData.panels
          .map((panel: any) => {
            const dialogueText = panel.dialogues?.map((d: any) => d.textJa || '').join(' ') || ''
            const narrationText = panel.narration?.textJa || ''
            return `${dialogueText} ${narrationText}`.trim()
          })
          .filter((text: string) => text.length > 0)
          .join('\n')

        // Check timeout before starting (leave 2min buffer for publish step)
        const timeElapsed = Date.now() - startTime
        const timeRemaining = 540000 - timeElapsed // 540s = 9min Cloud Function limit

        if (timeRemaining < 120000) {
          logger.warn('[ComicScheduler] Skipping word explanations - insufficient time', {
            timeRemaining: Math.round(timeRemaining / 1000),
            timeElapsed: Math.round(timeElapsed / 1000),
          })
        } else {
          // Attempt word explanation generation with timeout protection
          const wordResult = await Promise.race([
            precomputeWordExplanations({
              contentId: draftId,
              contentType: 'comic',
              text: comicText,
              limit: 1000,
              jlptLevel: jlptLevel as any,
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Word explanation timeout')), timeRemaining - 30000)
            )
          ])

          logger.info('[ComicScheduler] Word explanations complete', {
            total: (wordResult as any).total,
            generated: (wordResult as any).generated,
            cached: (wordResult as any).cached,
          })
        }
      } else {
        logger.warn('[ComicScheduler] No panels found for word explanation generation', { draftId })
      }
    } catch (wordError) {
      logger.warn('[ComicScheduler] Word explanation generation failed - continuing', {
        error: wordError instanceof Error ? wordError.message : 'Unknown error',
      })

      // Non-critical - comic will still publish without word explanations
    }

    // Step 8: Publish the episode
    logger.info('[ComicScheduler] Step 8/9: Publishing episode...')
    const publishResult = await callComicAPI(
      '/api/admin/comics/publish',
      { draftId },
      adminKey
    )

    const episodeId = publishResult.episodeId

    const duration = Date.now() - startTime

    // Update series published count (episodeCount was already incremented when we reserved the number)
    await db.collection('comic_series').doc(MOSHI_SERIES_ID).update({
      publishedEpisodeCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Mark queue item as completed if we used one
    if (queueItem) {
      await markQueueItemCompleted(queueItem.id, episodeId)
      logger.info('[ComicScheduler] Queue item marked as completed', {
        queueItemId: queueItem.id,
        episodeId,
      })
    }

    // Update start log with completion status
    if (startLogId) {
      await db.collection('comic_generation_logs').doc(startLogId).update({
        status: 'completed',
        success: true,
        episodeId,
        draftId,
        panelCount,
        imagesGenerated,
        imagesFailed,
        duration,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

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

    // Mark queue item as failed if we used one
    if (queueItem) {
      await markQueueItemFailed(queueItem.id, errorMessage)
      logger.info('[ComicScheduler] Queue item marked as failed', {
        queueItemId: queueItem.id,
        error: errorMessage,
      })
    }

    // Update start log with failure status (or create new if start log failed)
    if (startLogId) {
      await db.collection('comic_generation_logs').doc(startLogId).update({
        status: 'failed',
        success: false,
        error: errorMessage,
        duration,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    } else {
      // Start log wasn't created, so create a failure log
      await db.collection('comic_generation_logs').add({
        type: 'scheduled',
        status: 'failed',
        success: false,
        seriesId: MOSHI_SERIES_ID,
        error: errorMessage,
        duration,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

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

    // Use same fallback pattern as story scheduler for autonomous operation
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

    // Validate admin key if provided
    if (adminKey) {
      if (adminKey !== expectedAdminKey) {
        throw new HttpsError('unauthenticated', 'Invalid admin key')
      }
    } else if (!request.auth) {
      // No admin key and no auth
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated or provide valid admin key'
      )
    }

    // If authenticated, verify admin role
    if (request.auth) {
      const userDoc = await db.collection('users').doc(request.auth.uid).get()
      const userData = userDoc.data()
      if (!userData?.isAdmin) {
        throw new HttpsError('permission-denied', 'Admin access required')
      }
    }

    // Get the admin key to use for API calls
    const apiAdminKey = adminKey || expectedAdminKey
    if (!apiAdminKey) {
      throw new HttpsError('internal', 'No admin key available for API calls')
    }

    logger.info('[ComicScheduler] Manual trigger initiated', {
      userId: request.auth?.uid || 'admin-key',
      customTheme: request.data?.theme,
      customLocation: request.data?.location,
    })

    const result = await generateComicEpisode(apiAdminKey, {
      theme: request.data?.theme,
      location: request.data?.location,
      jlptLevel: request.data?.jlptLevel,
      episodeNumber: request.data?.episodeNumber,
    })

    return result
  }
)
