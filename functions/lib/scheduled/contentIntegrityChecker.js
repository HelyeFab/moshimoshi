'use strict'
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
 *
 * Features:
 * - Idempotency tracking to prevent duplicate repairs
 * - Distributed locking to prevent concurrent runs
 * - Repair cooldown with circuit breaker
 */
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        var desc = Object.getOwnPropertyDescriptor(m, k)
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k]
            },
          }
        }
        Object.defineProperty(o, k2, desc)
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        o[k2] = m[k]
      })
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v })
      }
    : function (o, v) {
        o['default'] = v
      })
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = []
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k
          return ar
        }
      return ownKeys(o)
    }
    return function (mod) {
      if (mod && mod.__esModule) return mod
      var result = {}
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i])
      __setModuleDefault(result, mod)
      return result
    }
  })()
Object.defineProperty(exports, '__esModule', { value: true })
exports.manualIntegrityCheckerFunction = exports.contentIntegrityCheckerFunction = void 0
const admin = __importStar(require('firebase-admin'))
const logger = __importStar(require('firebase-functions/logger'))
const scheduler_1 = require('firebase-functions/v2/scheduler')
const https_1 = require('firebase-functions/v2/https')
const params_1 = require('firebase-functions/params')
const integrityChecker_1 = require('../utils/integrityChecker')
const integrityIdempotency_1 = require('../utils/integrityIdempotency')
// Define secrets needed for TTS, AI processing, and API calls
const MODAL_API_KEY = (0, params_1.defineSecret)('MODAL_API_KEY')
const OPENAI_API_KEY = (0, params_1.defineSecret)('OPENAI_API_KEY')
// Initialize Firestore
const db = admin.firestore()
/**
 * Scheduled function - runs every 6 hours
 * 00:00, 06:00, 12:00, 18:00 UTC
 */
exports.contentIntegrityCheckerFunction = (0, scheduler_1.onSchedule)(
  {
    schedule: '0 */6 * * *', // Every 6 hours
    timeZone: 'UTC',
    memory: '2GiB',
    timeoutSeconds: 540, // 9 minutes (max)
    retryCount: 1,
    secrets: [MODAL_API_KEY, OPENAI_API_KEY],
  },
  async event => {
    const scheduleTime = event.scheduleTime
    const checkId = (0, integrityIdempotency_1.generateCheckId)('scheduled', scheduleTime)
    const instanceId = `scheduled_${scheduleTime}_${Date.now()}`
    logger.info('[ContentIntegrityChecker] Scheduled trigger activated', {
      scheduleTime,
      checkId,
      instanceId,
      jobName: event.jobName,
    })
    // 1. Check idempotency - skip if already processed
    if (await (0, integrityIdempotency_1.wasCheckProcessed)(checkId)) {
      logger.info('[ContentIntegrityChecker] Check already processed, skipping', {
        checkId,
      })
      return
    }
    // 2. Try to acquire distributed lock
    const lockAcquired = await (0, integrityIdempotency_1.tryAcquireLock)(instanceId)
    if (!lockAcquired) {
      logger.info('[ContentIntegrityChecker] Another instance is running, skipping', {
        instanceId,
      })
      return
    }
    // Get admin key from environment
    const adminKey = process.env.INTEGRITY_CHECKER_ADMIN_KEY || 'integrity-checker-2025'
    try {
      // 3. Mark check as started
      await (0, integrityIdempotency_1.markCheckStarted)(
        checkId,
        'scheduled',
        'scheduler',
        scheduleTime
      )
      const result = await (0, integrityChecker_1.runIntegrityCheck)(adminKey, checkId)
      // Log results to Firestore
      await db
        .collection('integrity_check_logs')
        .add(
          Object.assign(Object.assign({}, result), {
            type: 'scheduled',
            checkId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        )
      // 4. Mark check as completed
      await (0, integrityIdempotency_1.markCheckCompleted)(checkId, 'completed')
      // 5. Run cleanup (opportunistic)
      await (0, integrityIdempotency_1.cleanupOldRecords)()
      logger.info('[ContentIntegrityChecker] Check complete', {
        checkId,
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
          checkId,
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
      // Mark check as failed
      await (0, integrityIdempotency_1.markCheckCompleted)(
        checkId,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      )
      logger.error('[ContentIntegrityChecker] Fatal error', {
        checkId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Log error to Firestore
      await db.collection('integrity_check_logs').add({
        type: 'scheduled',
        checkId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      throw error // Re-throw to trigger retry
    } finally {
      // Always release lock
      await (0, integrityIdempotency_1.releaseLock)(instanceId)
    }
  }
)
/**
 * Manual trigger function for testing
 */
exports.manualIntegrityCheckerFunction = (0, https_1.onCall)(
  {
    memory: '2GiB',
    timeoutSeconds: 540,
    invoker: 'public', // Auth checked inside
    secrets: [MODAL_API_KEY, OPENAI_API_KEY],
  },
  async request => {
    var _a, _b
    // Check authentication
    const adminKey = (_a = request.data) === null || _a === void 0 ? void 0 : _a.adminKey
    const expectedAdminKey = process.env.INTEGRITY_CHECKER_ADMIN_KEY || 'integrity-checker-2025'
    if (!request.auth && adminKey !== expectedAdminKey) {
      throw new https_1.HttpsError(
        'unauthenticated',
        'User must be authenticated or provide valid admin key to run integrity check'
      )
    }
    // Check if user is admin (if authenticated)
    if (request.auth) {
      const userDoc = await db.collection('users').doc(request.auth.uid).get()
      const userData = userDoc.data()
      if (!(userData === null || userData === void 0 ? void 0 : userData.isAdmin)) {
        throw new https_1.HttpsError('permission-denied', 'Admin access required')
      }
    }
    const triggeredBy =
      ((_b = request.auth) === null || _b === void 0 ? void 0 : _b.uid) || 'admin-key'
    const checkId = (0, integrityIdempotency_1.generateCheckId)(
      'manual',
      undefined,
      `${triggeredBy}_${Date.now()}`
    )
    const instanceId = `manual_${checkId}`
    logger.info('[ContentIntegrityChecker] Manual trigger initiated', {
      checkId,
      userId: triggeredBy,
      timestamp: new Date().toISOString(),
    })
    // Try to acquire lock (manual can fail if another check is running)
    const lockAcquired = await (0, integrityIdempotency_1.tryAcquireLock)(instanceId)
    if (!lockAcquired) {
      throw new https_1.HttpsError(
        'already-exists',
        'Another integrity check is currently running. Please try again later.'
      )
    }
    try {
      await (0, integrityIdempotency_1.markCheckStarted)(checkId, 'manual', triggeredBy)
      const result = await (0, integrityChecker_1.runIntegrityCheck)(expectedAdminKey, checkId)
      // Log results to Firestore
      await db
        .collection('integrity_check_logs')
        .add(
          Object.assign(Object.assign({}, result), {
            type: 'manual',
            checkId,
            triggeredBy,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        )
      await (0, integrityIdempotency_1.markCheckCompleted)(checkId, 'completed')
      return Object.assign({ success: true, checkId }, result)
    } catch (error) {
      await (0, integrityIdempotency_1.markCheckCompleted)(
        checkId,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      )
      logger.error('[ContentIntegrityChecker] Manual check failed', {
        checkId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Log error to Firestore
      await db.collection('integrity_check_logs').add({
        type: 'manual',
        checkId,
        triggeredBy,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      throw new https_1.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Integrity check failed'
      )
    } finally {
      await (0, integrityIdempotency_1.releaseLock)(instanceId)
    }
  }
)
//# sourceMappingURL=contentIntegrityChecker.js.map
