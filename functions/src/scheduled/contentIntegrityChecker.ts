/**
 * Content Integrity Checker Scheduler
 * Runs every 6 hours to check and repair missing content
 *
 * Checks:
 * - News articles: audio, translations, word explanations
 * - Stories: audio, images
 *
 * Auto-repairs up to 3 articles and 1 story per run
 * Looks back 7 days for content to check
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { runIntegrityCheck, IntegrityCheckResult } from '../utils/integrityChecker'

// Define secrets needed for TTS, AI processing, and API calls
const MODAL_API_KEY = defineSecret('MODAL_API_KEY')
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY')

// Initialize Firestore
const db = admin.firestore()

/**
 * Scheduled function - runs every 6 hours
 * 00:00, 06:00, 12:00, 18:00 UTC
 */
export const contentIntegrityCheckerFunction = onSchedule(
  {
    schedule: '0 */6 * * *', // Every 6 hours
    timeZone: 'UTC',
    memory: '2GiB',
    timeoutSeconds: 540, // 9 minutes (max)
    retryCount: 1,
    secrets: [MODAL_API_KEY, OPENAI_API_KEY],
  },
  async event => {
    logger.info('[ContentIntegrityChecker] Scheduled trigger activated', {
      scheduleTime: event.scheduleTime,
      jobName: event.jobName,
    })

    // Get admin key from environment
    const adminKey = process.env.INTEGRITY_CHECKER_ADMIN_KEY || 'integrity-checker-2025'

    try {
      const result = await runIntegrityCheck(adminKey)

      // Log results to Firestore
      await db.collection('integrity_check_logs').add({
        ...result,
        type: 'scheduled',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      logger.info('[ContentIntegrityChecker] Check complete', {
        newsChecked: result.newsArticles.checked,
        newsRepaired:
          result.newsArticles.repaired.audio +
          result.newsArticles.repaired.translations +
          result.newsArticles.repaired.wordExplanations,
        storiesChecked: result.stories.checked,
        storiesRepaired: result.stories.repaired.audio + result.stories.repaired.images,
        durationMs: result.duration,
      })

      // Alert if there are many issues
      const totalMissing =
        result.newsArticles.missingAudio.length +
        result.newsArticles.missingTranslations.length +
        result.newsArticles.missingWordExplanations.length +
        result.stories.missingAudio.length +
        result.stories.missingImages.length

      if (totalMissing > 10) {
        logger.warn('[ContentIntegrityChecker] ALERT: High number of missing content items', {
          totalMissing,
          breakdown: {
            newsAudio: result.newsArticles.missingAudio.length,
            newsTranslations: result.newsArticles.missingTranslations.length,
            newsWordExplanations: result.newsArticles.missingWordExplanations.length,
            storyAudio: result.stories.missingAudio.length,
            storyImages: result.stories.missingImages.length,
          },
        })
        // TODO: Send notification (email, Slack, etc.)
      }
    } catch (error) {
      logger.error('[ContentIntegrityChecker] Fatal error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      // Log error to Firestore
      await db.collection('integrity_check_logs').add({
        type: 'scheduled',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      throw error // Re-throw to trigger retry
    }
  }
)

/**
 * Manual trigger function for testing
 */
export const manualIntegrityCheckerFunction = onCall(
  {
    memory: '2GiB',
    timeoutSeconds: 540,
    invoker: 'public', // Auth checked inside
    secrets: [MODAL_API_KEY, OPENAI_API_KEY],
  },
  async request => {
    // Check authentication
    const adminKey = request.data?.adminKey
    const expectedAdminKey = process.env.INTEGRITY_CHECKER_ADMIN_KEY || 'integrity-checker-2025'

    if (!request.auth && adminKey !== expectedAdminKey) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated or provide valid admin key to run integrity check'
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

    logger.info('[ContentIntegrityChecker] Manual trigger initiated', {
      userId: request.auth?.uid || 'admin-key',
      timestamp: new Date().toISOString(),
    })

    try {
      const result = await runIntegrityCheck(expectedAdminKey)

      // Log results to Firestore
      await db.collection('integrity_check_logs').add({
        ...result,
        type: 'manual',
        triggeredBy: request.auth?.uid || 'admin-key',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      return {
        success: true,
        ...result,
      }
    } catch (error) {
      logger.error('[ContentIntegrityChecker] Manual check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      // Log error to Firestore
      await db.collection('integrity_check_logs').add({
        type: 'manual',
        triggeredBy: request.auth?.uid || 'admin-key',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Integrity check failed'
      )
    }
  }
)
