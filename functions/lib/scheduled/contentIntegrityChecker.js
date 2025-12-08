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
    logger.info('[ContentIntegrityChecker] Scheduled trigger activated', {
      scheduleTime: event.scheduleTime,
      jobName: event.jobName,
    })
    // Get admin key from environment
    const adminKey = process.env.INTEGRITY_CHECKER_ADMIN_KEY || 'integrity-checker-2025'
    try {
      const result = await (0, integrityChecker_1.runIntegrityCheck)(adminKey)
      // Log results to Firestore
      await db
        .collection('integrity_check_logs')
        .add(
          Object.assign(Object.assign({}, result), {
            type: 'scheduled',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        )
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
exports.manualIntegrityCheckerFunction = (0, https_1.onCall)(
  {
    memory: '2GiB',
    timeoutSeconds: 540,
    invoker: 'public', // Auth checked inside
    secrets: [MODAL_API_KEY, OPENAI_API_KEY],
  },
  async request => {
    var _a, _b, _c, _d
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
    logger.info('[ContentIntegrityChecker] Manual trigger initiated', {
      userId: ((_b = request.auth) === null || _b === void 0 ? void 0 : _b.uid) || 'admin-key',
      timestamp: new Date().toISOString(),
    })
    try {
      const result = await (0, integrityChecker_1.runIntegrityCheck)(expectedAdminKey)
      // Log results to Firestore
      await db
        .collection('integrity_check_logs')
        .add(
          Object.assign(Object.assign({}, result), {
            type: 'manual',
            triggeredBy:
              ((_c = request.auth) === null || _c === void 0 ? void 0 : _c.uid) || 'admin-key',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        )
      return Object.assign({ success: true }, result)
    } catch (error) {
      logger.error('[ContentIntegrityChecker] Manual check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Log error to Firestore
      await db.collection('integrity_check_logs').add({
        type: 'manual',
        triggeredBy:
          ((_d = request.auth) === null || _d === void 0 ? void 0 : _d.uid) || 'admin-key',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      throw new https_1.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Integrity check failed'
      )
    }
  }
)
//# sourceMappingURL=contentIntegrityChecker.js.map
