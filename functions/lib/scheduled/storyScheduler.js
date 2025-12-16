"use strict";
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
 * 9. Publish story
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualStoryGeneratorFunction = exports.scheduledStoryGeneratorFunction = void 0;
exports.generateDailyStory = generateDailyStory;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const sentencePreGenerator_1 = require("../utils/sentencePreGenerator");
const alertNotifier_1 = require("../utils/alertNotifier");
// Define secrets needed for story generation
const OPENAI_API_KEY = (0, params_1.defineSecret)('OPENAI_API_KEY');
const MODAL_API_KEY = (0, params_1.defineSecret)('MODAL_API_KEY');
const GEMINI_API_KEY = (0, params_1.defineSecret)('GEMINI_API_KEY');
const RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
// Initialize Firestore
const db = admin.firestore();
// App URL for API calls
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app';
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
];
// JLPT levels to rotate through (weighted towards beginner)
const JLPT_LEVELS = ['N5', 'N5', 'N5', 'N4', 'N4', 'N3'];
/**
 * Helper to make API calls with admin authentication
 */
async function callStoryAPI(endpoint, body, adminKey) {
    const url = `${APP_URL}${endpoint}`;
    logger.info('[StoryScheduler] Calling API', { endpoint, step: body.step });
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Admin-Key': adminKey,
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
    }
    return response.json();
}
/**
 * Helper to call API with retry logic
 * Used for potentially slow operations like image generation
 */
async function callStoryAPIWithRetry(endpoint, body, adminKey, maxRetries = 2, delayMs = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await callStoryAPI(endpoint, body, adminKey);
            return { success: true, data: result };
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.warn(`[StoryScheduler] API call failed (attempt ${attempt}/${maxRetries})`, {
                endpoint,
                step: body.step,
                error: errorMsg,
            });
            if (attempt < maxRetries) {
                // Wait before retrying (exponential backoff)
                const waitTime = delayMs * attempt;
                logger.info(`[StoryScheduler] Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            else {
                return { success: false, error: errorMsg };
            }
        }
    }
    return { success: false, error: 'Max retries exceeded' };
}
/**
 * Select today's theme, level, and page count
 * Uses day of year to rotate through themes predictably
 * Page count is randomized between 3-4 for variety
 */
function selectThemeAndLevel() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    const theme = STORY_THEMES[dayOfYear % STORY_THEMES.length];
    const jlptLevel = JLPT_LEVELS[dayOfYear % JLPT_LEVELS.length];
    // Random page count between 3 and 4 (inclusive)
    const pageCount = Math.floor(Math.random() * 2) + 3;
    return { theme, jlptLevel, pageCount };
}
/**
 * Main story generation function
 */
async function generateDailyStory(adminKey) {
    const startTime = Date.now();
    const { theme, jlptLevel, pageCount } = selectThemeAndLevel();
    let draftId; // Declare here so it's accessible in catch block
    logger.info('[StoryScheduler] Starting daily story generation', {
        theme,
        jlptLevel,
        pageCount,
        timestamp: new Date().toISOString(),
    });
    try {
        // Step 1: Generate Character Sheet
        logger.info('[StoryScheduler] Step 1/9: Generating character sheet...');
        const characterResult = await callStoryAPI('/api/admin/generate-story', {
            step: 'character_sheet',
            theme,
            jlptLevel,
            pageCount,
        }, adminKey);
        if (!characterResult.success || !characterResult.draftId) {
            throw new Error('Failed to generate character sheet');
        }
        draftId = characterResult.draftId;
        logger.info('[StoryScheduler] Character sheet created', { draftId });
        // Step 2: Generate Outline
        logger.info('[StoryScheduler] Step 2/9: Generating outline...');
        const outlineResult = await callStoryAPI('/api/admin/generate-story', {
            step: 'outline',
            theme,
            jlptLevel,
            pageCount,
            draftId,
        }, adminKey);
        if (!outlineResult.success) {
            throw new Error('Failed to generate outline');
        }
        logger.info('[StoryScheduler] Outline created');
        // Step 3: Generate Pages
        logger.info('[StoryScheduler] Step 3/9: Generating pages...');
        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
            logger.info(`[StoryScheduler] Generating page ${pageNum}/${pageCount}...`);
            const pageResult = await callStoryAPI('/api/admin/generate-story', {
                step: 'generate_page',
                jlptLevel,
                pageNumber: pageNum,
                draftId,
            }, adminKey);
            if (!pageResult.success) {
                logger.warn(`[StoryScheduler] Page ${pageNum} generation failed, continuing...`);
            }
        }
        logger.info('[StoryScheduler] All pages generated');
        // Step 4: Generate Quiz
        logger.info('[StoryScheduler] Step 4/9: Generating quiz...');
        try {
            await callStoryAPI('/api/admin/generate-story', {
                step: 'generate_quiz',
                jlptLevel,
                draftId,
            }, adminKey);
            logger.info('[StoryScheduler] Quiz created');
        }
        catch (quizError) {
            logger.warn('[StoryScheduler] Quiz generation failed, continuing...', {
                error: quizError instanceof Error ? quizError.message : 'Unknown',
            });
        }
        // Step 5: Generate Model Sheet (for character consistency) - with retry
        logger.info('[StoryScheduler] Step 5/9: Generating model sheet...');
        const modelSheetResult = await callStoryAPIWithRetry('/api/admin/generate-story', {
            step: 'generate_model_sheet',
            draftId,
        }, adminKey, 2, // 2 attempts
        3000);
        if (modelSheetResult.success) {
            logger.info('[StoryScheduler] Model sheet created');
        }
        else {
            logger.warn('[StoryScheduler] Model sheet generation failed after retries, continuing...', {
                error: modelSheetResult.error,
            });
        }
        // Step 6: Generate Page Images (with retry logic)
        logger.info('[StoryScheduler] Step 6/9: Generating page images...');
        let imagesGenerated = 0;
        let imagesFailed = 0;
        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
            logger.info(`[StoryScheduler] Generating image for page ${pageNum}/${pageCount}...`);
            const imageResult = await callStoryAPIWithRetry('/api/admin/generate-story', {
                step: 'generate_page_image',
                draftId,
                pageNumber: pageNum,
            }, adminKey, 3, // 3 attempts for images
            3000 // 3 second delay between retries
            );
            if (imageResult.success) {
                imagesGenerated++;
                logger.info(`[StoryScheduler] Image generated for page ${pageNum}`);
            }
            else {
                imagesFailed++;
                logger.warn(`[StoryScheduler] Image generation failed for page ${pageNum} after all retries`, {
                    error: imageResult.error,
                });
            }
        }
        logger.info('[StoryScheduler] Page images completed', {
            generated: imagesGenerated,
            failed: imagesFailed,
            total: pageCount,
        });
        // Step 7: Generate Audio
        logger.info('[StoryScheduler] Step 7/9: Generating audio...');
        try {
            await callStoryAPI('/api/admin/generate-story', {
                step: 'generate_audio',
                draftId,
                voice: '23', // Standard VOICEVOX voice (energetic female)
            }, adminKey);
            logger.info('[StoryScheduler] Audio generated');
        }
        catch (audioError) {
            logger.warn('[StoryScheduler] Audio generation failed', {
                error: audioError instanceof Error ? audioError.message : 'Unknown',
            });
        }
        // Step 8: Pre-generate sentence-level audio and translations
        logger.info('[StoryScheduler] Step 8/9: Generating sentence-level data...');
        try {
            // Fetch the draft to get page texts
            const draftDoc = await db.collection('story_drafts').doc(draftId).get();
            const draftData = draftDoc.data();
            if ((draftData === null || draftData === void 0 ? void 0 : draftData.pages) && Array.isArray(draftData.pages)) {
                const pages = draftData.pages.map((page, index) => ({
                    pageNumber: page.pageNumber || index + 1,
                    text: page.text || '',
                })).filter((page) => page.text.length > 0);
                logger.info('[StoryScheduler] Pre-generating sentences for pages', {
                    draftId,
                    pageCount: pages.length,
                });
                await (0, sentencePreGenerator_1.preGenerateStorySentences)(draftId, pages);
                logger.info('[StoryScheduler] Sentence pre-generation completed', {
                    draftId,
                    pageCount: pages.length,
                });
            }
            else {
                logger.warn('[StoryScheduler] No pages found in draft for sentence pre-generation', {
                    draftId,
                });
            }
        }
        catch (sentenceError) {
            logger.warn('[StoryScheduler] Sentence pre-generation failed', {
                error: sentenceError instanceof Error ? sentenceError.message : 'Unknown',
            });
            // Continue - don't fail story generation if sentences fail
        }
        // Step 9: Publish the story
        logger.info('[StoryScheduler] Step 9/9: Publishing story...');
        const publishResult = await callStoryAPI('/api/admin/stories/publish-draft', { draftId }, adminKey);
        const duration = Date.now() - startTime;
        const storyId = publishResult.storyId;
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
        });
        logger.info('[StoryScheduler] Story published successfully!', {
            storyId,
            draftId,
            theme,
            jlptLevel,
            imagesGenerated,
            imagesFailed,
            durationMs: duration,
            durationMin: (duration / 60000).toFixed(2),
        });
        // Send warning alert if some images failed
        if (imagesFailed > 0) {
            const warnings = [];
            warnings.push(`${imagesFailed} of ${pageCount} page images failed to generate`);
            await (0, alertNotifier_1.sendStoryGenerationWarningAlert)(RESEND_API_KEY.value(), storyId, warnings, {
                theme,
                jlptLevel,
                imagesGenerated,
                imagesFailed,
                pageCount,
                durationMs: duration,
            });
        }
        return {
            success: true,
            storyId,
            draftId,
            duration,
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[StoryScheduler] Story generation failed', {
            error: errorMessage,
            theme,
            jlptLevel,
            durationMs: duration,
        });
        // Log failure to Firestore
        await db.collection('story_generation_logs').add({
            type: 'scheduled',
            success: false,
            error: errorMessage,
            theme,
            jlptLevel,
            duration,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Send email alert for the failure
        await (0, alertNotifier_1.sendStoryGenerationFailureAlert)(RESEND_API_KEY.value(), draftId || 'unknown', 'unknown', errorMessage, {
            theme,
            jlptLevel,
            durationMs: duration,
        });
        return {
            success: false,
            error: errorMessage,
            duration,
        };
    }
}
/**
 * Scheduled function - runs weekly on Sunday at 00:00 UTC
 */
exports.scheduledStoryGeneratorFunction = (0, scheduler_1.onSchedule)({
    schedule: '0 0 * * 0', // Weekly on Sunday at 00:00 UTC
    timeZone: 'UTC',
    memory: '1GiB',
    timeoutSeconds: 540, // 9 minutes (max allowed)
    retryCount: 1, // Retry once on failure
    secrets: [OPENAI_API_KEY, MODAL_API_KEY, GEMINI_API_KEY, RESEND_API_KEY],
}, async (event) => {
    logger.info('[StoryScheduler] Scheduled trigger activated', {
        scheduleTime: event.scheduleTime,
        jobName: event.jobName,
    });
    // Get admin key from environment
    const adminKey = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025';
    const result = await generateDailyStory(adminKey);
    if (!result.success) {
        // Throw to trigger retry
        throw new Error(`Story generation failed: ${result.error}`);
    }
    logger.info('[StoryScheduler] Daily story generation complete', result);
});
/**
 * Manual trigger function for testing
 */
exports.manualStoryGeneratorFunction = (0, https_1.onCall)({
    memory: '1GiB',
    timeoutSeconds: 540,
    invoker: 'public', // Auth checked inside
    secrets: [OPENAI_API_KEY, MODAL_API_KEY, GEMINI_API_KEY, RESEND_API_KEY],
}, async (request) => {
    var _a, _b, _c, _d;
    // Check authentication
    const adminKey = (_a = request.data) === null || _a === void 0 ? void 0 : _a.adminKey;
    const expectedAdminKey = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025';
    if (!request.auth && adminKey !== expectedAdminKey) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated or provide valid admin key');
    }
    // Check if user is admin (if authenticated)
    if (request.auth) {
        const userDoc = await db.collection('users').doc(request.auth.uid).get();
        const userData = userDoc.data();
        if (!(userData === null || userData === void 0 ? void 0 : userData.isAdmin)) {
            throw new https_1.HttpsError('permission-denied', 'Admin access required');
        }
    }
    logger.info('[StoryScheduler] Manual trigger initiated', {
        userId: ((_b = request.auth) === null || _b === void 0 ? void 0 : _b.uid) || 'admin-key',
        customTheme: (_c = request.data) === null || _c === void 0 ? void 0 : _c.theme,
        customLevel: (_d = request.data) === null || _d === void 0 ? void 0 : _d.jlptLevel,
    });
    const result = await generateDailyStory(expectedAdminKey);
    return result;
});
//# sourceMappingURL=storyScheduler.js.map