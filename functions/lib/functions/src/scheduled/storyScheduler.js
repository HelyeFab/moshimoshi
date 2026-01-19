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
 * 8.5. Pre-generate word explanations (100 words)
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
exports.onStoryPublished = exports.dailyStoryRetryScheduler = exports.manualStoryGeneratorFunction = exports.scheduledStoryGeneratorFunction = void 0;
exports.generateDailyStory = generateDailyStory;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
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
// Configuration for checkpoint/resume
const CHECKPOINT_CONFIG = {
    MAX_RETRY_ATTEMPTS: 3, // Max times to retry a failed step
    INCOMPLETE_DRAFT_HOURS: 48, // Look back this many hours for incomplete drafts
    CONCURRENT_IMAGE_LIMIT: 3, // Max parallel image generations
};
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
// JLPT levels to rotate through (beginner-friendly but complete coverage)
// Distribution: N5=37.5%, N4=25%, N3=12.5%, N2=12.5%, N1=12.5%
// Covers all JLPT levels while prioritizing beginner content
const JLPT_LEVELS = ['N5', 'N5', 'N5', 'N4', 'N4', 'N3', 'N2', 'N1'];
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
            // CRITICAL FIX: Check if the API response itself indicates failure
            // Some endpoints return HTTP 200 with {success: false, error: "..."}
            if (result && typeof result.success === 'boolean' && !result.success) {
                const errorMsg = result.error || 'API returned success: false';
                throw new Error(errorMsg);
            }
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
 * Find an incomplete draft that needs to be resumed
 * Looks for drafts with pending_* status from the last 48 hours
 */
async function findIncompleteDraft() {
    var _a;
    const lookbackDate = new Date();
    lookbackDate.setHours(lookbackDate.getHours() - CHECKPOINT_CONFIG.INCOMPLETE_DRAFT_HOURS);
    logger.info('[StoryScheduler] Checking for incomplete drafts', {
        since: lookbackDate.toISOString(),
    });
    try {
        // Query for drafts that need resumption
        const snapshot = await db
            .collection('ai_story_drafts')
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(lookbackDate))
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        // Filter for pending statuses in memory (avoids composite index requirement)
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const status = data.status;
            // Check for pending statuses that need retry
            if (status === null || status === void 0 ? void 0 : status.startsWith('pending_')) {
                const checkpoint = data.checkpoint;
                // Skip if max retries exceeded
                if (checkpoint && checkpoint.failedAttempts >= CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS) {
                    logger.info('[StoryScheduler] Skipping draft - max retries exceeded', {
                        draftId: doc.id,
                        failedAttempts: checkpoint.failedAttempts,
                    });
                    continue;
                }
                logger.info('[StoryScheduler] Found incomplete draft to resume', {
                    draftId: doc.id,
                    status,
                    lastStep: checkpoint === null || checkpoint === void 0 ? void 0 : checkpoint.lastCompletedStep,
                    failedAttempts: (checkpoint === null || checkpoint === void 0 ? void 0 : checkpoint.failedAttempts) || 0,
                });
                return {
                    id: doc.id,
                    draftId: doc.id,
                    status,
                    theme: data.theme || 'Unknown Theme',
                    jlptLevel: data.jlptLevel || 'N5',
                    pageCount: data.pageCount || ((_a = data.pages) === null || _a === void 0 ? void 0 : _a.length) || 5,
                    checkpoint: checkpoint || {
                        lastCompletedStep: 'pages', // Assume pages done if no checkpoint
                        failedAttempts: 0,
                        lastAttemptAt: admin.firestore.Timestamp.now(),
                    },
                    createdAt: data.createdAt,
                };
            }
        }
        logger.info('[StoryScheduler] No incomplete drafts found');
        return null;
    }
    catch (error) {
        logger.warn('[StoryScheduler] Error checking for incomplete drafts', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
    }
}
/**
 * Process tasks with a concurrency limit
 * Used for parallel image generation
 */
async function processWithConcurrency(tasks, limit) {
    const results = [];
    for (let i = 0; i < tasks.length; i += limit) {
        const chunk = tasks.slice(i, i + limit);
        const chunkResults = await Promise.allSettled(chunk.map(fn => fn()));
        chunkResults.forEach((result, idx) => {
            var _a;
            const actualIndex = i + idx;
            if (result.status === 'fulfilled') {
                results.push({ success: true, result: result.value, index: actualIndex });
            }
            else {
                results.push({
                    success: false,
                    error: ((_a = result.reason) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error',
                    index: actualIndex,
                });
            }
        });
    }
    return results;
}
/**
 * Update checkpoint in draft document
 * Uses set with merge to be defensive in case document doesn't exist yet
 */
async function updateCheckpoint(draftId, step, index, error) {
    const checkpointData = {
        lastCompletedStep: step,
        lastAttemptAt: admin.firestore.Timestamp.now(),
    };
    if (index !== undefined) {
        checkpointData.lastCompletedIndex = index;
    }
    if (error) {
        checkpointData.lastError = error;
    }
    await db.collection('ai_story_drafts').doc(draftId).set({
        checkpoint: checkpointData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * Mark draft as pending with incremented failure count
 * First gets current failedAttempts, then sets with merge
 */
async function markDraftAsPending(draftId, pendingStatus, error) {
    var _a, _b;
    // Get current failed attempts count
    const doc = await db.collection('ai_story_drafts').doc(draftId).get();
    const currentAttempts = doc.exists ? (((_b = (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.checkpoint) === null || _b === void 0 ? void 0 : _b.failedAttempts) || 0) : 0;
    await db.collection('ai_story_drafts').doc(draftId).set({
        status: pendingStatus,
        checkpoint: {
            failedAttempts: currentAttempts + 1,
            lastAttemptAt: admin.firestore.Timestamp.now(),
            lastError: error,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * Resume story generation from a checkpoint
 */
async function resumeFromCheckpoint(draft, adminKey) {
    var _a, _b;
    const startTime = Date.now();
    const { draftId, theme, jlptLevel, pageCount, checkpoint } = draft;
    logger.info('[StoryScheduler] Resuming from checkpoint', {
        draftId,
        lastStep: checkpoint.lastCompletedStep,
        lastIndex: checkpoint.lastCompletedIndex,
        failedAttempts: checkpoint.failedAttempts,
    });
    try {
        // Determine which step to resume from
        const stepOrder = [
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
        ];
        const lastStepIndex = stepOrder.indexOf(checkpoint.lastCompletedStep);
        const nextStepIndex = lastStepIndex + 1;
        if (nextStepIndex >= stepOrder.length) {
            // Already complete, just publish
            logger.info('[StoryScheduler] Draft already complete, publishing...');
            return await publishDraft(draftId, theme, jlptLevel, pageCount, startTime, adminKey);
        }
        // Resume from the next step
        const nextStep = stepOrder[nextStepIndex];
        logger.info('[StoryScheduler] Resuming from step', { nextStep, nextStepIndex });
        // Execute remaining steps
        let imagesGenerated = 0;
        let imagesFailed = 0;
        // Step: Page Images (if needed)
        if (nextStep === 'page_images' || stepOrder.indexOf(nextStep) < stepOrder.indexOf('page_images')) {
            const startPage = nextStep === 'page_images' ? (checkpoint.lastCompletedIndex || 0) + 1 : 1;
            const result = await generatePageImagesParallel(draftId, startPage, pageCount, adminKey);
            imagesGenerated = result.generated;
            imagesFailed = result.failed;
            if (imagesFailed > 0) {
                // Save checkpoint and exit - will retry next time
                await markDraftAsPending(draftId, 'pending_images', `${imagesFailed} images failed`);
                return {
                    success: false,
                    draftId,
                    error: `Image generation incomplete: ${imagesFailed} of ${pageCount} failed`,
                    duration: Date.now() - startTime,
                };
            }
            await updateCheckpoint(draftId, 'page_images');
        }
        // Step: Audio (if needed) - with retries
        if (stepOrder.indexOf(nextStep) <= stepOrder.indexOf('audio')) {
            const audioResult = await callStoryAPIWithRetry('/api/admin/generate-story', { step: 'generate_audio', draftId, voice: '23' }, adminKey, 3, // 3 retries
            5000 // 5s, 10s, 15s backoff
            );
            if (audioResult.success) {
                await updateCheckpoint(draftId, 'audio');
            }
            else {
                const errorMsg = audioResult.error || 'Audio generation failed after retries';
                logger.warn('[StoryScheduler] Audio generation failed - saving as pending_audio', {
                    draftId,
                    error: errorMsg,
                });
                await markDraftAsPending(draftId, 'pending_audio', errorMsg);
                return {
                    success: false,
                    draftId,
                    error: `Audio generation failed: ${errorMsg}`,
                    duration: Date.now() - startTime,
                };
            }
        }
        // Step: Sentences (if needed) - with retries
        if (stepOrder.indexOf(nextStep) <= stepOrder.indexOf('sentences')) {
            const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get();
            const draftData = draftDoc.data();
            if ((draftData === null || draftData === void 0 ? void 0 : draftData.pages) && Array.isArray(draftData.pages)) {
                const pages = draftData.pages
                    .map((page, index) => ({
                    pageNumber: page.pageNumber || index + 1,
                    text: page.text || '',
                }))
                    .filter((page) => page.text.length > 0);
                let sentenceSuccess = false;
                let sentenceError;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        await (0, sentencePreGenerator_1.preGenerateStorySentences)(draftId, pages);
                        sentenceSuccess = true;
                        await updateCheckpoint(draftId, 'sentences');
                        break;
                    }
                    catch (error) {
                        sentenceError = error instanceof Error ? error.message : 'Unknown error';
                        logger.warn(`[StoryScheduler] Sentence pre-generation failed (attempt ${attempt}/3)`, {
                            draftId,
                            error: sentenceError,
                        });
                        if (attempt < 3) {
                            const waitTime = 5000 * attempt;
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                        }
                    }
                }
                if (!sentenceSuccess) {
                    const errorMsg = sentenceError || 'Sentence pre-generation failed after retries';
                    logger.warn('[StoryScheduler] Sentence pre-generation failed - saving as pending_sentences', {
                        draftId,
                        error: errorMsg,
                    });
                    await markDraftAsPending(draftId, 'pending_sentences', errorMsg);
                    return {
                        success: false,
                        draftId,
                        error: `Sentence pre-generation failed: ${errorMsg}`,
                        duration: Date.now() - startTime,
                    };
                }
            }
        }
        // All steps complete - publish
        return await publishDraft(draftId, theme, jlptLevel, pageCount, startTime, adminKey, imagesGenerated, imagesFailed);
    }
    catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[StoryScheduler] Resume failed', { error: errorMessage, draftId });
        // Increment failure count (get current then set with merge)
        const failedDoc = await db.collection('ai_story_drafts').doc(draftId).get();
        const currentFailedAttempts = failedDoc.exists ? (((_b = (_a = failedDoc.data()) === null || _a === void 0 ? void 0 : _a.checkpoint) === null || _b === void 0 ? void 0 : _b.failedAttempts) || 0) : 0;
        await db.collection('ai_story_drafts').doc(draftId).set({
            checkpoint: {
                failedAttempts: currentFailedAttempts + 1,
                lastError: errorMessage,
                lastAttemptAt: admin.firestore.Timestamp.now(),
            },
        }, { merge: true });
        return { success: false, draftId, error: errorMessage, duration };
    }
}
/**
 * Generate page images in parallel with concurrency limit
 */
async function generatePageImagesParallel(draftId, startPage, totalPages, adminKey) {
    logger.info('[StoryScheduler] Generating page images in parallel', {
        draftId,
        startPage,
        totalPages,
        concurrency: CHECKPOINT_CONFIG.CONCURRENT_IMAGE_LIMIT,
    });
    const pagesToGenerate = Array.from({ length: totalPages - startPage + 1 }, (_, i) => startPage + i);
    const tasks = pagesToGenerate.map(pageNum => async () => {
        const result = await callStoryAPIWithRetry('/api/admin/generate-story', { step: 'generate_page_image', draftId, pageNumber: pageNum }, adminKey, 3, 3000);
        if (!result.success) {
            throw new Error(result.error || `Page ${pageNum} image failed`);
        }
        return { pageNum, result };
    });
    const results = await processWithConcurrency(tasks, CHECKPOINT_CONFIG.CONCURRENT_IMAGE_LIMIT);
    const generated = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    logger.info('[StoryScheduler] Parallel image generation complete', {
        draftId,
        generated,
        failed,
        total: pagesToGenerate.length,
    });
    // Update checkpoint with last successful page
    const lastSuccessful = results
        .filter(r => r.success)
        .map(r => pagesToGenerate[r.index])
        .sort((a, b) => b - a)[0];
    if (lastSuccessful) {
        await updateCheckpoint(draftId, 'page_images', lastSuccessful);
    }
    return { generated, failed };
}
/**
 * Publish a completed draft
 */
async function publishDraft(draftId, theme, jlptLevel, pageCount, startTime, adminKey, imagesGenerated, imagesFailed) {
    logger.info('[StoryScheduler] Publishing story...', { draftId });
    const publishResult = await callStoryAPI('/api/admin/stories/publish-draft', { draftId }, adminKey);
    const duration = Date.now() - startTime;
    const storyId = publishResult.storyId;
    // Mark draft as complete
    await db.collection('ai_story_drafts').doc(draftId).set({
        status: 'published',
        checkpoint: {
            lastCompletedStep: 'complete',
        },
        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
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
    });
    logger.info('[StoryScheduler] Story published successfully!', {
        storyId,
        draftId,
        duration,
    });
    return { success: true, storyId, draftId, duration };
}
/**
 * Main story generation function
 * Now with checkpoint support and parallel image generation
 */
async function generateDailyStory(adminKey) {
    const startTime = Date.now();
    const { theme, jlptLevel, pageCount } = selectThemeAndLevel();
    let draftId;
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
        }, { merge: true });
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
        await updateCheckpoint(draftId, 'outline');
        await db.collection('ai_story_drafts').doc(draftId).update({
            'metadata.generationStep': 'outline',
            'metadata.progress': 20,
            'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
        });
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
        await updateCheckpoint(draftId, 'pages');
        await db.collection('ai_story_drafts').doc(draftId).update({
            'metadata.generationStep': 'pages',
            'metadata.progress': 40,
            'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info('[StoryScheduler] All pages generated');
        // Step 4: Generate Quiz
        logger.info('[StoryScheduler] Step 4/9: Generating quiz...');
        try {
            await callStoryAPI('/api/admin/generate-story', {
                step: 'generate_quiz',
                jlptLevel,
                draftId,
            }, adminKey);
            await updateCheckpoint(draftId, 'quiz');
            await db.collection('ai_story_drafts').doc(draftId).update({
                'metadata.generationStep': 'quiz',
                'metadata.progress': 50,
                'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
            });
            logger.info('[StoryScheduler] Quiz created');
        }
        catch (quizError) {
            logger.warn('[StoryScheduler] Quiz generation failed, continuing...', {
                error: quizError instanceof Error ? quizError.message : 'Unknown',
            });
            // Quiz is non-critical, still update checkpoint
            await updateCheckpoint(draftId, 'quiz');
            await db.collection('ai_story_drafts').doc(draftId).update({
                'metadata.generationStep': 'quiz',
                'metadata.progress': 50,
                'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        // Step 5: Generate Model Sheet (for character consistency) - with retry
        logger.info('[StoryScheduler] Step 5/9: Generating model sheet...');
        const modelSheetResult = await callStoryAPIWithRetry('/api/admin/generate-story', {
            step: 'generate_model_sheet',
            draftId,
        }, adminKey, 2, 3000);
        if (modelSheetResult.success) {
            logger.info('[StoryScheduler] Model sheet created');
        }
        else {
            logger.warn('[StoryScheduler] Model sheet generation failed after retries, continuing...', {
                error: modelSheetResult.error,
            });
        }
        await updateCheckpoint(draftId, 'model_sheet');
        await db.collection('ai_story_drafts').doc(draftId).update({
            'metadata.generationStep': 'model_sheet',
            'metadata.progress': 60,
            'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
        });
        // Step 6: Generate Page Images (PARALLEL with concurrency limit)
        logger.info('[StoryScheduler] Step 6/9: Generating page images (parallel)...');
        const imageResult = await generatePageImagesParallel(draftId, 1, pageCount, adminKey);
        const imagesGenerated = imageResult.generated;
        const imagesFailed = imageResult.failed;
        logger.info('[StoryScheduler] Page images completed', {
            generated: imagesGenerated,
            failed: imagesFailed,
            total: pageCount,
        });
        // CRITICAL: If images failed, DON'T publish - save as pending and exit
        if (imagesFailed > 0) {
            const errorMsg = `${imagesFailed} of ${pageCount} page images failed to generate`;
            logger.warn('[StoryScheduler] Images incomplete - saving as pending_images', {
                draftId,
                imagesFailed,
                pageCount,
            });
            await markDraftAsPending(draftId, 'pending_images', errorMsg);
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
            });
            // Send warning alert
            await (0, alertNotifier_1.sendStoryGenerationWarningAlert)(RESEND_API_KEY.value(), draftId, [`Story saved as pending - ${errorMsg}`, 'Will retry on next scheduler run'], { theme, jlptLevel, imagesGenerated, imagesFailed, pageCount });
            return {
                success: false,
                draftId,
                error: `Story pending: ${errorMsg}. Will retry next run.`,
                duration: Date.now() - startTime,
            };
        }
        await updateCheckpoint(draftId, 'page_images');
        await db.collection('ai_story_drafts').doc(draftId).update({
            'metadata.generationStep': 'page_images',
            'metadata.progress': 70,
            'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
        });
        // Step 7: Generate Audio (with immediate retries)
        logger.info('[StoryScheduler] Step 7/9: Generating audio...');
        const audioResult = await callStoryAPIWithRetry('/api/admin/generate-story', {
            step: 'generate_audio',
            draftId,
            voice: '23',
        }, adminKey, 3, // 3 retries
        5000 // 5s, 10s, 15s backoff
        );
        if (audioResult.success) {
            await updateCheckpoint(draftId, 'audio');
            await db.collection('ai_story_drafts').doc(draftId).update({
                'metadata.generationStep': 'audio',
                'metadata.progress': 80,
                'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
            });
            logger.info('[StoryScheduler] Audio generated');
        }
        else {
            const errorMsg = audioResult.error || 'Audio generation failed after retries';
            logger.warn('[StoryScheduler] Audio generation failed - saving as pending_audio', {
                draftId,
                error: errorMsg,
            });
            await markDraftAsPending(draftId, 'pending_audio', errorMsg);
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
            });
            // Send warning alert
            await (0, alertNotifier_1.sendStoryGenerationWarningAlert)(RESEND_API_KEY.value(), draftId, [`Story saved as pending - ${errorMsg}`, 'Will retry on next scheduler run'], { theme, jlptLevel, imagesGenerated, imagesFailed, pageCount });
            return {
                success: false,
                draftId,
                error: `Story pending: ${errorMsg}. Will retry next run.`,
                duration: Date.now() - startTime,
            };
        }
        // Step 8: Pre-generate sentence-level audio and translations (with immediate retries)
        logger.info('[StoryScheduler] Step 8/10: Generating sentence-level data...');
        const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get();
        const draftData = draftDoc.data();
        if ((draftData === null || draftData === void 0 ? void 0 : draftData.pages) && Array.isArray(draftData.pages)) {
            const pages = draftData.pages
                .map((page, index) => ({
                pageNumber: page.pageNumber || index + 1,
                text: page.text || '',
            }))
                .filter((page) => page.text.length > 0);
            logger.info('[StoryScheduler] Pre-generating sentences for pages', {
                draftId,
                pageCount: pages.length,
            });
            // Retry logic for sentence generation
            let sentenceSuccess = false;
            let sentenceError;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await (0, sentencePreGenerator_1.preGenerateStorySentences)(draftId, pages);
                    sentenceSuccess = true;
                    await updateCheckpoint(draftId, 'sentences');
                    await db.collection('ai_story_drafts').doc(draftId).update({
                        'metadata.generationStep': 'sentences',
                        'metadata.progress': 90,
                        'metadata.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
                    });
                    logger.info('[StoryScheduler] Sentence pre-generation completed', {
                        draftId,
                        pageCount: pages.length,
                        attempt,
                    });
                    break;
                }
                catch (error) {
                    sentenceError = error instanceof Error ? error.message : 'Unknown error';
                    logger.warn(`[StoryScheduler] Sentence pre-generation failed (attempt ${attempt}/3)`, {
                        draftId,
                        error: sentenceError,
                    });
                    if (attempt < 3) {
                        const waitTime = 5000 * attempt; // 5s, 10s, 15s
                        logger.info(`[StoryScheduler] Retrying sentences in ${waitTime}ms...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }
                }
            }
            if (!sentenceSuccess) {
                const errorMsg = sentenceError || 'Sentence pre-generation failed after retries';
                logger.warn('[StoryScheduler] Sentence pre-generation failed - saving as pending_sentences', {
                    draftId,
                    error: errorMsg,
                });
                await markDraftAsPending(draftId, 'pending_sentences', errorMsg);
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
                });
                // Send warning alert
                await (0, alertNotifier_1.sendStoryGenerationWarningAlert)(RESEND_API_KEY.value(), draftId, [`Story saved as pending - ${errorMsg}`, 'Will retry on next scheduler run'], { theme, jlptLevel, imagesGenerated, imagesFailed, pageCount });
                return {
                    success: false,
                    draftId,
                    error: `Story pending: ${errorMsg}. Will retry next run.`,
                    duration: Date.now() - startTime,
                };
            }
        }
        else {
            logger.warn('[StoryScheduler] No pages found in draft for sentence pre-generation', {
                draftId,
            });
            await updateCheckpoint(draftId, 'sentences');
        }
        // Step 8.5: Pre-generate word explanations (server-side prefetch)
        // Step 8.5: Word explanations now generated async via Firestore trigger (see onStoryPublished below)
        logger.info('[StoryScheduler] Step 8.5/10: Word explanations will be generated async after publish');
        await updateCheckpoint(draftId, 'word_explanations');
        // Step 9: Publish the story (only if all critical assets are present)
        logger.info('[StoryScheduler] Step 9/10: Publishing story...');
        const publishResult = await callStoryAPI('/api/admin/stories/publish-draft', { draftId }, adminKey);
        const duration = Date.now() - startTime;
        const storyId = publishResult.storyId;
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
        }, { merge: true });
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
            draftId,
            durationMs: duration,
        });
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
        });
        // Send email alert for the failure
        await (0, alertNotifier_1.sendStoryGenerationFailureAlert)(RESEND_API_KEY.value(), draftId || 'unknown', 'unknown', errorMessage, {
            theme,
            jlptLevel,
            durationMs: duration,
        });
        return {
            success: false,
            draftId,
            error: errorMessage,
            duration,
        };
    }
}
/**
 * Scheduled function - runs weekly on Sunday at 00:00 UTC
 * Now checks for incomplete drafts first before generating new stories
 */
exports.scheduledStoryGeneratorFunction = (0, scheduler_1.onSchedule)({
    schedule: '0 0 * * 0', // Weekly on Sunday at 00:00 UTC
    timeZone: 'UTC',
    memory: '1GiB',
    timeoutSeconds: 540, // 9 minutes (max allowed)
    retryCount: 1, // Retry once on failure
    secrets: [OPENAI_API_KEY, MODAL_API_KEY, GEMINI_API_KEY, RESEND_API_KEY],
}, async (event) => {
    var _a, _b, _c, _d;
    logger.info('[StoryScheduler] Scheduled trigger activated', {
        scheduleTime: event.scheduleTime,
        jobName: event.jobName,
    });
    const adminKey = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025';
    // FIRST: Check for incomplete drafts that need to be resumed
    const incompleteDraft = await findIncompleteDraft();
    if (incompleteDraft) {
        logger.info('[StoryScheduler] Found incomplete draft - resuming instead of generating new', {
            draftId: incompleteDraft.draftId,
            lastStep: incompleteDraft.checkpoint.lastCompletedStep,
            failedAttempts: incompleteDraft.checkpoint.failedAttempts,
        });
        const result = await resumeFromCheckpoint(incompleteDraft, adminKey);
        if (!result.success) {
            // Check if we've exceeded max retries
            const updatedDraft = await db.collection('ai_story_drafts').doc(incompleteDraft.draftId).get();
            const checkpoint = (_a = updatedDraft.data()) === null || _a === void 0 ? void 0 : _a.checkpoint;
            if (checkpoint && checkpoint.failedAttempts >= CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS) {
                // Mark as failed and send alert
                await db.collection('ai_story_drafts').doc(incompleteDraft.draftId).set({
                    status: 'failed',
                    error: `Max retries (${CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS}) exceeded`,
                }, { merge: true });
                await (0, alertNotifier_1.sendStoryGenerationFailureAlert)(RESEND_API_KEY.value(), incompleteDraft.draftId, 'unknown', `Story generation failed after ${CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS} attempts: ${result.error}`, {
                    theme: incompleteDraft.theme,
                    jlptLevel: incompleteDraft.jlptLevel,
                    durationMs: result.duration,
                });
                logger.error('[StoryScheduler] Draft marked as failed after max retries', {
                    draftId: incompleteDraft.draftId,
                    attempts: checkpoint.failedAttempts,
                });
            }
            // Don't throw - we want to try again next time (unless max retries exceeded)
            logger.warn('[StoryScheduler] Resume incomplete - will retry next run', result);
            return;
        }
        logger.info('[StoryScheduler] Successfully resumed and published story', result);
        return;
    }
    // SECOND: Check if a story was already successfully generated today (idempotency)
    const nowUtc = new Date();
    const todayDateString = nowUtc.toISOString().split('T')[0]; // YYYY-MM-DD
    logger.info('[StoryScheduler] Checking for duplicate generation today', {
        todayDate: todayDateString,
    });
    try {
        const recentLogsSnapshot = await db
            .collection('story_generation_logs')
            .where('type', '==', 'scheduled')
            .where('success', '==', true)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        if (!recentLogsSnapshot.empty) {
            const lastSuccessfulLog = recentLogsSnapshot.docs[0].data();
            const lastLogDate = ((_c = (_b = lastSuccessfulLog.createdAt) === null || _b === void 0 ? void 0 : _b.toDate) === null || _c === void 0 ? void 0 : _c.call(_b))
                ? lastSuccessfulLog.createdAt.toDate().toISOString().split('T')[0]
                : new Date(lastSuccessfulLog.createdAt).toISOString().split('T')[0];
            if (lastLogDate === todayDateString) {
                logger.info('[StoryScheduler] Story already generated today - skipping to prevent duplicate', {
                    todayDate: todayDateString,
                    lastGeneratedDate: lastLogDate,
                    lastStoryId: lastSuccessfulLog.storyId,
                    lastDraftId: lastSuccessfulLog.draftId,
                });
                return;
            }
            logger.info('[StoryScheduler] Last successful generation was on different day - proceeding', {
                todayDate: todayDateString,
                lastGeneratedDate: lastLogDate,
            });
        }
    }
    catch (error) {
        // Don't block generation if idempotency check fails - just log warning
        logger.warn('[StoryScheduler] Idempotency check failed - proceeding with generation', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
    // No incomplete drafts and no story today - generate a new story
    logger.info('[StoryScheduler] No incomplete drafts - generating new story');
    const result = await generateDailyStory(adminKey);
    if (!result.success) {
        // If it failed but created a pending draft, don't throw (will retry next time)
        if ((_d = result.error) === null || _d === void 0 ? void 0 : _d.includes('pending')) {
            logger.warn('[StoryScheduler] Story pending - will retry next run', result);
            return;
        }
        // Throw to trigger Cloud Functions retry for unexpected failures
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
    // Manual trigger always generates NEW story (use dailyStoryRetryScheduler for retries)
    const result = await generateDailyStory(expectedAdminKey);
    return result;
});
/**
 * Daily retry scheduler - runs every day at 06:00 UTC
 * Only retries incomplete drafts, does NOT generate new stories
 * This ensures pending stories get resolved within days, not weeks
 */
exports.dailyStoryRetryScheduler = (0, scheduler_1.onSchedule)({
    schedule: '0 6 * * *', // Daily at 06:00 UTC
    timeZone: 'UTC',
    memory: '1GiB',
    timeoutSeconds: 540,
    retryCount: 1,
    secrets: [OPENAI_API_KEY, MODAL_API_KEY, GEMINI_API_KEY, RESEND_API_KEY],
}, async (event) => {
    var _a;
    logger.info('[DailyRetry] Daily retry scheduler activated', {
        scheduleTime: event.scheduleTime,
        jobName: event.jobName,
    });
    const adminKey = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025';
    // Find incomplete drafts
    const incompleteDraft = await findIncompleteDraft();
    if (!incompleteDraft) {
        logger.info('[DailyRetry] No incomplete drafts found - nothing to retry');
        return;
    }
    logger.info('[DailyRetry] Found incomplete draft - attempting to resume', {
        draftId: incompleteDraft.draftId,
        status: incompleteDraft.status,
        lastStep: incompleteDraft.checkpoint.lastCompletedStep,
        failedAttempts: incompleteDraft.checkpoint.failedAttempts,
    });
    const result = await resumeFromCheckpoint(incompleteDraft, adminKey);
    if (!result.success) {
        // Check if we've exceeded max retries
        const updatedDraft = await db.collection('ai_story_drafts').doc(incompleteDraft.draftId).get();
        const checkpoint = (_a = updatedDraft.data()) === null || _a === void 0 ? void 0 : _a.checkpoint;
        if (checkpoint && checkpoint.failedAttempts >= CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS) {
            // Mark as failed and send alert
            await db.collection('ai_story_drafts').doc(incompleteDraft.draftId).set({
                status: 'failed',
                error: `Max retries (${CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS}) exceeded`,
            }, { merge: true });
            await (0, alertNotifier_1.sendStoryGenerationFailureAlert)(RESEND_API_KEY.value(), incompleteDraft.draftId, 'unknown', `Story generation failed after ${CHECKPOINT_CONFIG.MAX_RETRY_ATTEMPTS} attempts: ${result.error}`, {
                theme: incompleteDraft.theme,
                jlptLevel: incompleteDraft.jlptLevel,
                durationMs: result.duration,
            });
            logger.error('[DailyRetry] Draft marked as failed after max retries', {
                draftId: incompleteDraft.draftId,
                attempts: checkpoint.failedAttempts,
            });
            return;
        }
        logger.warn('[DailyRetry] Resume incomplete - will retry tomorrow', result);
        return;
    }
    logger.info('[DailyRetry] Successfully resumed and published story', result);
});
/**
 * Firestore Trigger: Async Word Explanation Generation
 * Triggers when a new story is published to the 'stories' collection
 * Generates word explanations in the background to avoid timeout issues
 */
exports.onStoryPublished = (0, firestore_1.onDocumentCreated)({
    document: 'stories/{storyId}',
    secrets: [MODAL_API_KEY],
    memory: '512MiB', // Reduced - only extracting words and creating queue
    timeoutSeconds: 120, // 2 minutes - enough to extract words and publish message
}, async (event) => {
    var _a;
    const storyId = event.params.storyId;
    const story = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!story) {
        logger.error('[StoryWordGen] No story data in trigger', { storyId });
        return;
    }
    // Only process non-draft stories
    if (story.status === 'draft') {
        logger.info('[StoryWordGen] Skipping draft story', { storyId });
        return;
    }
    logger.info('[StoryWordGen] Triggered for new story', {
        storyId,
        title: story.title,
        jlptLevel: story.jlptLevel,
    });
    try {
        // Mark as generating
        await db.collection('stories').doc(storyId).update({
            wordExplanationsStatus: 'generating',
            wordExplanationsStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Extract story text from all pages
        const storyText = story.pages
            .map((page) => page.text)
            .filter((text) => text && text.length > 0)
            .join('\n');
        if (!storyText || storyText.length === 0) {
            throw new Error('No text content found in story pages');
        }
        logger.info('[StoryWordGen] Extracting words for batch processing', {
            storyId,
            textLength: storyText.length,
            pageCount: story.pages.length,
        });
        // Extract top words from story text (100 words)
        const { extractTopWords } = await Promise.resolve().then(() => __importStar(require('../utils/wordExtractor')));
        const { words } = await extractTopWords(storyText, 100);
        logger.info('[StoryWordGen] Words extracted, creating batch queue', {
            storyId,
            wordCount: words.length,
        });
        // Create batch queue
        const { createBatchQueue } = await Promise.resolve().then(() => __importStar(require('../utils/storyWordBatchManager')));
        const queue = await createBatchQueue(storyId, words);
        logger.info('[StoryWordGen] Batch queue created, publishing first batch', {
            storyId,
            totalBatches: queue.totalBatches,
            totalWords: queue.totalWords,
        });
        // Update story with batch info
        await db.collection('stories').doc(storyId).update({
            wordExplanationsProgress: {
                totalBatches: queue.totalBatches,
                completedBatches: 0,
                totalWords: queue.totalWords,
                completedWords: 0,
                currentBatch: 1,
                percentComplete: 0,
            },
        });
        // Publish first batch message to Pub/Sub
        const { publishFirstBatch } = await Promise.resolve().then(() => __importStar(require('./storyWordBatchProcessor')));
        await publishFirstBatch(storyId);
        logger.info('[StoryWordGen] First batch published, batch processing started', {
            storyId,
            totalBatches: queue.totalBatches,
            totalWords: queue.totalWords,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[StoryWordGen] Failed to start batch processing', {
            storyId,
            error: errorMessage,
        });
        // Mark as failed
        await db.collection('stories').doc(storyId).update({
            wordExplanationsStatus: 'failed',
            wordExplanationsError: errorMessage,
            wordExplanationsFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
//# sourceMappingURL=storyScheduler.js.map