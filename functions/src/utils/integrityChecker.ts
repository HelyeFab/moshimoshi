/**
 * Content Integrity Checker
 * Checks and repairs missing translations, word explanations, and audio
 * for news articles and stories.
 *
 * Runs every 6 hours, checks content from the last 7 days.
 * Auto-repairs up to 3 articles and 1 story per run.
 *
 * Features:
 * - Repair cooldown to prevent repeatedly failing on same content
 * - Circuit breaker pattern for content with multiple failures
 * - Tracks repair attempts for observability
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { generateBatchAudio } from './newsAudioGenerator'
import { generateBatchTranslations } from './translationPreGenerator'
import { generateBatchWordExplanations } from './wordExplanationPreGenerator'
import { extractTopWords } from './wordExtractor'
import { canRepairContent, recordRepairAttempt, updateCheckProgress } from './integrityIdempotency'

const db = admin.firestore()

// Configuration
const CONFIG = {
  MAX_ARTICLES_PER_RUN: 3,
  MAX_STORIES_PER_RUN: 1,
  LOOKBACK_DAYS: 7,
  RETRY_COOLDOWN_HOURS: 6, // Skip items that failed repair in last 6 hours
}

// App URL for story API calls
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'

export interface IntegrityCheckResult {
  newsArticles: {
    checked: number
    missingAudio: string[]
    missingTranslations: string[]
    missingWordExplanations: string[]
    failedAudio: string[]
    repaired: {
      audio: number
      translations: number
      wordExplanations: number
    }
    repairFailed: {
      audio: number
      translations: number
      wordExplanations: number
    }
  }
  stories: {
    checked: number
    missingAudio: string[]
    missingImages: string[]
    stalledDrafts: string[]
    repaired: {
      audio: number
      images: number
    }
    repairFailed: {
      audio: number
      images: number
    }
  }
  duration: number
  timestamp: string
}

/**
 * Check news articles for missing content and auto-repair
 */
export async function checkNewsArticles(
  checkId?: string
): Promise<IntegrityCheckResult['newsArticles']> {
  const result: IntegrityCheckResult['newsArticles'] = {
    checked: 0,
    missingAudio: [],
    missingTranslations: [],
    missingWordExplanations: [],
    failedAudio: [],
    repaired: { audio: 0, translations: 0, wordExplanations: 0 },
    repairFailed: { audio: 0, translations: 0, wordExplanations: 0 },
  }

  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - CONFIG.LOOKBACK_DAYS)

  logger.info('[IntegrityChecker] Checking news articles', {
    lookbackDays: CONFIG.LOOKBACK_DAYS,
    since: lookbackDate.toISOString(),
  })

  try {
    // Get articles from the last 7 days
    const articlesSnapshot = await db
      .collection('news_articles')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(lookbackDate))
      .orderBy('createdAt', 'desc')
      .get()

    if (articlesSnapshot.empty) {
      logger.info('[IntegrityChecker] No articles found in lookback period')
      return result
    }

    result.checked = articlesSnapshot.size

    // Get all article IDs for batch checking
    const articleIds = articlesSnapshot.docs.map(doc => doc.id)

    // Batch check translations (Firestore 'in' limit is 30)
    const translationIds = new Set<string>()
    for (let i = 0; i < articleIds.length; i += 30) {
      const batch = articleIds.slice(i, i + 30)
      const translationsSnap = await db
        .collection('news_article_translations')
        .where(admin.firestore.FieldPath.documentId(), 'in', batch)
        .get()
      translationsSnap.docs.forEach(doc => translationIds.add(doc.id))
    }

    // Batch check word explanations
    const wordExplanationIds = new Set<string>()
    for (let i = 0; i < articleIds.length; i += 30) {
      const batch = articleIds.slice(i, i + 30)
      const explanationsSnap = await db
        .collection('news_article_word_explanations')
        .where(admin.firestore.FieldPath.documentId(), 'in', batch)
        .get()
      explanationsSnap.docs.forEach(doc => wordExplanationIds.add(doc.id))
    }

    // Check each article for missing content
    for (const doc of articlesSnapshot.docs) {
      const data = doc.data()
      const articleId = doc.id

      // Check audio (either TTS or NHK audio)
      const hasAudio = !!(data.generatedContentAudioUrl || data.nhkAudioUrl)
      const hasFailed = data.audioStatus === 'failed' || data.audioStatus === 'partial'

      if (!hasAudio) {
        result.missingAudio.push(articleId)
      }
      if (hasFailed) {
        result.failedAudio.push(articleId)
      }

      // Check translations
      if (!translationIds.has(articleId)) {
        result.missingTranslations.push(articleId)
      }

      // Check word explanations
      if (!wordExplanationIds.has(articleId)) {
        result.missingWordExplanations.push(articleId)
      }
    }

    logger.info('[IntegrityChecker] News article check complete', {
      checked: result.checked,
      missingAudio: result.missingAudio.length,
      missingTranslations: result.missingTranslations.length,
      missingWordExplanations: result.missingWordExplanations.length,
      failedAudio: result.failedAudio.length,
    })

    // Auto-repair: Pick up to MAX_ARTICLES_PER_RUN articles to repair
    const articlesToRepair = selectArticlesForRepair(result, CONFIG.MAX_ARTICLES_PER_RUN)

    if (articlesToRepair.length > 0) {
      await repairNewsArticles(articlesToRepair, result, checkId)
    }

    return result
  } catch (error) {
    logger.error('[IntegrityChecker] Error checking news articles', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return result
  }
}

/**
 * Select articles to repair based on what's missing
 */
function selectArticlesForRepair(
  result: IntegrityCheckResult['newsArticles'],
  maxArticles: number
): string[] {
  const articlesToRepair = new Set<string>()

  // Prioritize articles missing multiple things
  const allMissing = [
    ...result.missingAudio,
    ...result.missingTranslations,
    ...result.missingWordExplanations,
    ...result.failedAudio,
  ]

  // Count occurrences (articles missing multiple things get priority)
  const counts = new Map<string, number>()
  for (const id of allMissing) {
    counts.set(id, (counts.get(id) || 0) + 1)
  }

  // Sort by count descending
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])

  for (const [articleId] of sorted) {
    if (articlesToRepair.size >= maxArticles) break
    articlesToRepair.add(articleId)
  }

  return [...articlesToRepair]
}

/**
 * Repair missing content for selected articles
 */
async function repairNewsArticles(
  articleIds: string[],
  result: IntegrityCheckResult['newsArticles'],
  checkId?: string
): Promise<void> {
  logger.info('[IntegrityChecker] Starting article repairs', {
    articleCount: articleIds.length,
    articleIds,
    checkId,
  })

  // Fetch article data
  const articlesSnapshot = await db
    .collection('news_articles')
    .where(admin.firestore.FieldPath.documentId(), 'in', articleIds)
    .get()

  const articles = articlesSnapshot.docs.map(doc => ({
    id: doc.id,
    title: doc.data().title as string,
    summary: doc.data().summary as string,
    content: doc.data().content as string,
    source: doc.data().source as string,
    nhkAudioUrl: doc.data().nhkAudioUrl as string | undefined,
  }))

  // Repair audio for articles that need it
  const articlesNeedingAudio = articles.filter(
    a => result.missingAudio.includes(a.id) || result.failedAudio.includes(a.id)
  )

  if (articlesNeedingAudio.length > 0 && checkId) {
    await updateCheckProgress(checkId, 'repairing_article_audio', {
      total: articlesNeedingAudio.length,
    })
  }

  for (const article of articlesNeedingAudio) {
    // Check cooldown before attempting repair
    const canRepair = await canRepairContent(article.id, 'news_article', 'audio')

    if (!canRepair.allowed) {
      logger.info('[IntegrityChecker] Skipping audio repair (cooldown)', {
        articleId: article.id,
        reason: canRepair.reason,
      })
      continue
    }

    try {
      logger.info('[IntegrityChecker] Repairing audio', { articleId: article.id, checkId })
      await generateBatchAudio(article)
      result.repaired.audio++

      // Record successful attempt
      if (checkId) {
        await recordRepairAttempt(article.id, 'news_article', 'audio', checkId, true)
      }
    } catch (error) {
      result.repairFailed.audio++
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      // Record failed attempt
      if (checkId) {
        await recordRepairAttempt(article.id, 'news_article', 'audio', checkId, false, errorMsg)
      }

      logger.error('[IntegrityChecker] Audio repair failed', {
        articleId: article.id,
        checkId,
        error: errorMsg,
      })
    }
  }

  // Repair translations for articles that need it
  const articlesNeedingTranslations = articles.filter(a =>
    result.missingTranslations.includes(a.id)
  )

  // Filter out articles in cooldown for translations
  const articlesForTranslationRepair: typeof articles = []
  for (const article of articlesNeedingTranslations) {
    const canRepair = await canRepairContent(article.id, 'news_article', 'translations')
    if (canRepair.allowed) {
      articlesForTranslationRepair.push(article)
    } else {
      logger.info('[IntegrityChecker] Skipping translation repair (cooldown)', {
        articleId: article.id,
        reason: canRepair.reason,
      })
    }
  }

  if (articlesForTranslationRepair.length > 0) {
    if (checkId) {
      await updateCheckProgress(checkId, 'repairing_translations', {
        total: articlesForTranslationRepair.length,
      })
    }

    try {
      logger.info('[IntegrityChecker] Repairing translations', {
        articleCount: articlesForTranslationRepair.length,
        checkId,
      })
      const translationResults = await generateBatchTranslations(articlesForTranslationRepair)
      result.repaired.translations = translationResults.successCount
      result.repairFailed.translations = translationResults.failureCount

      // Record attempts for each article
      if (checkId) {
        for (const article of articlesForTranslationRepair) {
          // Assume success if successCount > 0 (batch operation)
          const success = translationResults.successCount > 0
          await recordRepairAttempt(
            article.id,
            'news_article',
            'translations',
            checkId,
            success,
            success ? undefined : 'Batch translation failed'
          )
        }
      }
    } catch (error) {
      result.repairFailed.translations = articlesForTranslationRepair.length
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      // Record failed attempts
      if (checkId) {
        for (const article of articlesForTranslationRepair) {
          await recordRepairAttempt(
            article.id,
            'news_article',
            'translations',
            checkId,
            false,
            errorMsg
          )
        }
      }

      logger.error('[IntegrityChecker] Translation repair failed', {
        checkId,
        error: errorMsg,
      })
    }
  }

  // Repair word explanations for articles that need it
  const articlesNeedingWordExplanations = articles.filter(a =>
    result.missingWordExplanations.includes(a.id)
  )

  // Filter out articles in cooldown for word explanations
  const articlesForWordRepair: typeof articles = []
  for (const article of articlesNeedingWordExplanations) {
    const canRepair = await canRepairContent(article.id, 'news_article', 'wordExplanations')
    if (canRepair.allowed) {
      articlesForWordRepair.push(article)
    } else {
      logger.info('[IntegrityChecker] Skipping word explanation repair (cooldown)', {
        articleId: article.id,
        reason: canRepair.reason,
      })
    }
  }

  if (articlesForWordRepair.length > 0) {
    if (checkId) {
      await updateCheckProgress(checkId, 'repairing_word_explanations', {
        total: articlesForWordRepair.length,
      })
    }

    try {
      logger.info('[IntegrityChecker] Repairing word explanations', {
        articleCount: articlesForWordRepair.length,
        checkId,
      })

      // Extract words first
      const articlesWithWords = articlesForWordRepair.map(article => {
        const words = extractTopWords(article.content, 100)
        return {
          id: article.id,
          content: article.content,
          words: words.words,
        }
      })

      const wordResults = await generateBatchWordExplanations(articlesWithWords)
      result.repaired.wordExplanations = wordResults.successCount
      result.repairFailed.wordExplanations = wordResults.failureCount

      // Record attempts for each article
      if (checkId) {
        for (const article of articlesForWordRepair) {
          const success = wordResults.successCount > 0
          await recordRepairAttempt(
            article.id,
            'news_article',
            'wordExplanations',
            checkId,
            success,
            success ? undefined : 'Batch word explanation failed'
          )
        }
      }
    } catch (error) {
      result.repairFailed.wordExplanations = articlesForWordRepair.length
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      // Record failed attempts
      if (checkId) {
        for (const article of articlesForWordRepair) {
          await recordRepairAttempt(
            article.id,
            'news_article',
            'wordExplanations',
            checkId,
            false,
            errorMsg
          )
        }
      }

      logger.error('[IntegrityChecker] Word explanation repair failed', {
        checkId,
        error: errorMsg,
      })
    }
  }

  logger.info('[IntegrityChecker] Article repairs complete', {
    checkId,
    repairedAudio: result.repaired.audio,
    repairedTranslations: result.repaired.translations,
    repairedWordExplanations: result.repaired.wordExplanations,
    failedAudio: result.repairFailed.audio,
    failedTranslations: result.repairFailed.translations,
    failedWordExplanations: result.repairFailed.wordExplanations,
  })
}

/**
 * Check stories for missing content and auto-repair
 */
export async function checkStories(
  adminKey: string,
  checkId?: string
): Promise<IntegrityCheckResult['stories']> {
  const result: IntegrityCheckResult['stories'] = {
    checked: 0,
    missingAudio: [],
    missingImages: [],
    stalledDrafts: [],
    repaired: { audio: 0, images: 0 },
    repairFailed: { audio: 0, images: 0 },
  }

  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - CONFIG.LOOKBACK_DAYS)

  logger.info('[IntegrityChecker] Checking stories', {
    lookbackDays: CONFIG.LOOKBACK_DAYS,
    since: lookbackDate.toISOString(),
  })

  try {
    // Check published stories
    const storiesSnapshot = await db
      .collection('stories')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(lookbackDate))
      .orderBy('createdAt', 'desc')
      .get()

    result.checked = storiesSnapshot.size

    // Check each story for missing content
    for (const doc of storiesSnapshot.docs) {
      const data = doc.data()
      const storyId = doc.id
      const pageCount = data.pageCount || 5

      // Check audio
      const hasFullAudio = !!data.fullAudioUrl
      const audioStatus = data.audioStatus
      const hasFailed = audioStatus === 'failed' || audioStatus === 'partial'

      if (!hasFullAudio || hasFailed) {
        result.missingAudio.push(storyId)
      }

      // Check images
      const hasCoverImage = !!data.coverImageUrl
      const pages = data.pages || []
      const missingPageImages = pages.filter((p: any) => !p.imageUrl).length

      if (!hasCoverImage || missingPageImages > 0) {
        result.missingImages.push(storyId)
      }
    }

    // Check for stalled drafts (older than 24 hours)
    // Simplified query to avoid composite index requirement
    const stalledThreshold = new Date()
    stalledThreshold.setHours(stalledThreshold.getHours() - 24)

    try {
      const draftsSnapshot = await db
        .collection('ai_story_drafts')
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(stalledThreshold))
        .limit(20)
        .get()

      // Filter in-memory for non-complete status
      result.stalledDrafts = draftsSnapshot.docs
        .filter(doc => {
          const status = doc.data().status
          return status !== 'complete' && status !== 'published'
        })
        .map(doc => doc.id)
    } catch (draftError) {
      // Non-critical - just log and continue
      logger.warn('[IntegrityChecker] Could not check stalled drafts', {
        error: draftError instanceof Error ? draftError.message : 'Unknown error',
      })
    }

    logger.info('[IntegrityChecker] Story check complete', {
      checked: result.checked,
      missingAudio: result.missingAudio.length,
      missingImages: result.missingImages.length,
      stalledDrafts: result.stalledDrafts.length,
    })

    // Auto-repair: Pick up to MAX_STORIES_PER_RUN stories to repair
    if (result.missingAudio.length > 0 || result.missingImages.length > 0) {
      const storyToRepair = result.missingAudio[0] || result.missingImages[0]
      if (storyToRepair) {
        await repairStory(storyToRepair, result, adminKey, checkId)
      }
    }

    return result
  } catch (error) {
    logger.error('[IntegrityChecker] Error checking stories', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return result
  }
}

/**
 * Repair missing content for a story
 */
async function repairStory(
  storyId: string,
  result: IntegrityCheckResult['stories'],
  adminKey: string,
  checkId?: string
): Promise<void> {
  logger.info('[IntegrityChecker] Starting story repair', { storyId, checkId })

  try {
    const storyDoc = await db.collection('stories').doc(storyId).get()
    if (!storyDoc.exists) {
      logger.warn('[IntegrityChecker] Story not found', { storyId })
      return
    }

    const storyData = storyDoc.data()!

    // Repair audio if missing
    if (result.missingAudio.includes(storyId)) {
      // Check cooldown before attempting repair
      const canRepair = await canRepairContent(storyId, 'story', 'audio')

      if (!canRepair.allowed) {
        logger.info('[IntegrityChecker] Skipping story audio repair (cooldown)', {
          storyId,
          reason: canRepair.reason,
        })
      } else {
        // Update progress
        if (checkId) {
          await updateCheckProgress(checkId, 'repairing_story_audio', { stage: storyId })
        }

        try {
          logger.info('[IntegrityChecker] Repairing story audio', { storyId, checkId })

          // Get pages from story data
          const pages = storyData.pages || []
          if (pages.length === 0) {
            logger.warn('[IntegrityChecker] Story has no pages, skipping audio repair', { storyId })
            result.repairFailed.audio++

            if (checkId) {
              await recordRepairAttempt(storyId, 'story', 'audio', checkId, false, 'No pages')
            }
            return
          }

          const response = await fetch(`${APP_URL}/api/admin/generate-story-audio`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Admin-Key': adminKey,
            },
            body: JSON.stringify({
              storyId,
              pages: pages.map((p: any) => ({
                text: p.text || p.textJa || '',
                pageNumber: p.pageNumber,
              })),
              voice: 'nemo',
              generateFullAudio: true,
              generatePageAudio: true,
            }),
          })

          if (response.ok) {
            result.repaired.audio++
            logger.info('[IntegrityChecker] Story audio repaired', { storyId, checkId })

            if (checkId) {
              await recordRepairAttempt(storyId, 'story', 'audio', checkId, true)
            }
          } else {
            result.repairFailed.audio++
            const errorText = await response.text()

            if (checkId) {
              await recordRepairAttempt(
                storyId,
                'story',
                'audio',
                checkId,
                false,
                `HTTP ${response.status}: ${errorText.substring(0, 200)}`
              )
            }

            logger.error('[IntegrityChecker] Story audio repair failed', {
              storyId,
              checkId,
              status: response.status,
              error: errorText,
            })
          }
        } catch (error) {
          result.repairFailed.audio++
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'

          if (checkId) {
            await recordRepairAttempt(storyId, 'story', 'audio', checkId, false, errorMsg)
          }

          logger.error('[IntegrityChecker] Story audio repair error', {
            storyId,
            checkId,
            error: errorMsg,
          })
        }
      }
    }

    // Repair images if missing
    if (result.missingImages.includes(storyId)) {
      // Check cooldown before attempting repair
      const canRepair = await canRepairContent(storyId, 'story', 'images')

      if (!canRepair.allowed) {
        logger.info('[IntegrityChecker] Skipping story image repair (cooldown)', {
          storyId,
          reason: canRepair.reason,
        })
      } else {
        // Check if story has characterSheet (required for image generation)
        if (!storyData.characterSheet) {
          logger.warn('[IntegrityChecker] Story has no characterSheet, cannot repair images', {
            storyId,
            checkId,
          })
        } else {
          // Update progress
          if (checkId) {
            const missingPages = storyData.pages?.filter((p: any) => !p.imageUrl).length || 0
            await updateCheckProgress(checkId, 'repairing_story_images', {
              stage: storyId,
              total: missingPages,
            })
          }

          try {
            logger.info('[IntegrityChecker] Repairing story images', {
              storyId,
              checkId,
              missingPages: storyData.pages?.filter((p: any) => !p.imageUrl).length,
              totalPages: storyData.pages?.length,
            })

            const response = await fetch(`${APP_URL}/api/admin/repair-story-images`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Admin-Key': adminKey,
              },
              body: JSON.stringify({ storyId }),
            })

            if (response.ok) {
              const repairResult = await response.json()
              result.repaired.images = repairResult.pagesRepaired?.length || 0
              logger.info('[IntegrityChecker] Story images repaired', {
                storyId,
                checkId,
                pagesRepaired: repairResult.pagesRepaired,
                modelSheetGenerated: repairResult.modelSheetGenerated,
              })

              if (checkId) {
                await recordRepairAttempt(storyId, 'story', 'images', checkId, true)
              }
            } else {
              result.repairFailed.images++
              const errorText = await response.text()

              if (checkId) {
                await recordRepairAttempt(
                  storyId,
                  'story',
                  'images',
                  checkId,
                  false,
                  `HTTP ${response.status}: ${errorText.substring(0, 200)}`
                )
              }

              logger.error('[IntegrityChecker] Story image repair failed', {
                storyId,
                checkId,
                status: response.status,
                error: errorText,
              })
            }
          } catch (error) {
            result.repairFailed.images++
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'

            if (checkId) {
              await recordRepairAttempt(storyId, 'story', 'images', checkId, false, errorMsg)
            }

            logger.error('[IntegrityChecker] Story image repair error', {
              storyId,
              checkId,
              error: errorMsg,
            })
          }
        }
      }
    }
  } catch (error) {
    logger.error('[IntegrityChecker] Story repair error', {
      storyId,
      checkId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Run the full integrity check
 */
export async function runIntegrityCheck(
  adminKey: string,
  checkId?: string
): Promise<IntegrityCheckResult> {
  const startTime = Date.now()

  logger.info('[IntegrityChecker] Starting full integrity check', {
    checkId,
    maxArticles: CONFIG.MAX_ARTICLES_PER_RUN,
    maxStories: CONFIG.MAX_STORIES_PER_RUN,
    lookbackDays: CONFIG.LOOKBACK_DAYS,
  })

  // Update progress: checking articles
  if (checkId) {
    await updateCheckProgress(checkId, 'checking_articles')
  }

  const newsResult = await checkNewsArticles(checkId)

  // Update progress: checking stories
  if (checkId) {
    await updateCheckProgress(checkId, 'checking_stories')
  }

  const storiesResult = await checkStories(adminKey, checkId)

  const duration = Date.now() - startTime

  const result: IntegrityCheckResult = {
    newsArticles: newsResult,
    stories: storiesResult,
    duration,
    timestamp: new Date().toISOString(),
  }

  logger.info('[IntegrityChecker] Full integrity check complete', {
    durationMs: duration,
    newsChecked: newsResult.checked,
    newsRepaired:
      newsResult.repaired.audio +
      newsResult.repaired.translations +
      newsResult.repaired.wordExplanations,
    storiesChecked: storiesResult.checked,
    storiesRepaired: storiesResult.repaired.audio + storiesResult.repaired.images,
  })

  return result
}
