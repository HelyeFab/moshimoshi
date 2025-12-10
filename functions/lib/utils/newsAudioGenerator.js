"use strict";
/**
 * News Audio Generator - TTS utility for news article scraping
 * Generates audio using VOICEVOX TTS API (via Modal) and stores in Firebase Storage
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNewsAudio = generateNewsAudio;
exports.checkExistingAudio = checkExistingAudio;
exports.generateBatchAudio = generateBatchAudio;
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const params_1 = require("firebase-functions/params");
// TTS API configuration - Now using Modal VOICEVOX
const VOICEVOX_TTS_ENDPOINT = 'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech';
const EDGE_TTS_ENDPOINT = 'https://tts.selfmind.dev/speak';
const MODAL_API_KEY = (0, params_1.defineSecret)('MODAL_API_KEY');
// VOICEVOX voices (high quality Japanese TTS)
// Speaker IDs: 1=四国めたん, 3=ずんだもん, 11=玄野武宏(Nemo), 13=青山龍星
const DEFAULT_VOICEVOX_VOICE = '11'; // Nemo - natural female voice
const DEFAULT_EDGE_VOICE = 'ja-JP-NanamiNeural'; // Fallback voice
const MAX_TEXT_LENGTH = 5000; // TTS limit
/**
 * Generate audio for news article using Edge-TTS
 *
 * @param text - Text to convert to speech (max 5000 chars)
 * @param articleId - Unique article identifier
 * @param source - News source (e.g., 'nhk-easy', 'watanoc')
 * @param audioType - Type of audio (title, summary, content)
 * @param options - Optional TTS configuration
 * @returns Public URL of generated audio file
 */
async function generateNewsAudio(text, articleId, source, audioType, options = {}) {
    // Validate text length
    if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
    }
    if (text.length > MAX_TEXT_LENGTH) {
        logger.warn('Text exceeds max length, truncating', {
            originalLength: text.length,
            maxLength: MAX_TEXT_LENGTH,
            articleId,
        });
        text = text.substring(0, MAX_TEXT_LENGTH);
    }
    // Map 'kokoro' to 'voicevox' for backward compatibility
    const provider = options.provider === 'kokoro' ? 'voicevox' : options.provider || 'voicevox';
    const voice = options.voice || (provider === 'voicevox' ? DEFAULT_VOICEVOX_VOICE : DEFAULT_EDGE_VOICE);
    logger.info('Generating audio', {
        articleId,
        source,
        audioType,
        textLength: text.length,
        voice,
        provider,
    });
    try {
        // Step 1: Generate audio with selected TTS provider
        // Note: 'kokoro' is already mapped to 'voicevox' above for backward compatibility
        const audioBuffer = provider === 'voicevox'
            ? await callVoicevoxTTS(text, voice)
            : await callEdgeTTS(text, {
                voice,
                rate: options.rate || '+0%',
                volume: options.volume || '+0%',
                pitch: options.pitch || '+0Hz',
            });
        // Step 2: Upload to Firebase Storage
        const storagePath = `news-audio/${source}/${articleId}/${audioType}.mp3`;
        const publicUrl = await uploadToFirebaseStorage(audioBuffer, storagePath, {
            articleId,
            source,
            provider,
            voice,
            textLength: text.length,
            audioType,
        });
        logger.info('Audio generated successfully', {
            articleId,
            audioType,
            url: publicUrl,
        });
        return {
            url: publicUrl,
            provider,
            voice,
            generatedAt: new Date(),
            textLength: text.length,
            audioType,
        };
    }
    catch (error) {
        logger.error('Failed to generate audio', {
            articleId,
            audioType,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
/**
 * Call VOICEVOX TTS API (via Modal) to generate audio
 * High-quality Japanese TTS with multiple voice options
 */
async function callVoicevoxTTS(text, voice) {
    const startTime = Date.now();
    try {
        const response = await (0, node_fetch_1.default)(VOICEVOX_TTS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': MODAL_API_KEY.value().trim(),
            },
            body: JSON.stringify({
                model: 'voicevox',
                input: text,
                voice: voice,
                speed: 1.0,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`VOICEVOX TTS API error (${response.status}): ${errorText}`);
        }
        const audioBuffer = await response.buffer();
        const duration = Date.now() - startTime;
        logger.debug('VOICEVOX TTS API call successful', {
            textLength: text.length,
            audioSize: audioBuffer.length,
            durationMs: duration,
        });
        return audioBuffer;
    }
    catch (error) {
        logger.error('VOICEVOX TTS API call failed', {
            endpoint: VOICEVOX_TTS_ENDPOINT,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new Error(`TTS generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Call Edge-TTS API to generate audio (fallback option)
 */
async function callEdgeTTS(text, options) {
    const startTime = Date.now();
    try {
        const response = await (0, node_fetch_1.default)(EDGE_TTS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                voice: options.voice,
                rate: options.rate,
                volume: options.volume,
                pitch: options.pitch,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Edge-TTS API error (${response.status}): ${errorText}`);
        }
        const audioBuffer = await response.buffer();
        const duration = Date.now() - startTime;
        logger.debug('Edge-TTS API call successful', {
            textLength: text.length,
            audioSize: audioBuffer.length,
            durationMs: duration,
        });
        return audioBuffer;
    }
    catch (error) {
        logger.error('Edge-TTS API call failed', {
            endpoint: EDGE_TTS_ENDPOINT,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new Error(`TTS generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Upload audio buffer to Firebase Storage
 */
async function uploadToFirebaseStorage(audioBuffer, storagePath, metadata) {
    try {
        const bucket = admin.storage().bucket();
        const file = bucket.file(storagePath);
        // Upload file with metadata
        await file.save(audioBuffer, {
            metadata: {
                contentType: 'audio/mpeg',
                cacheControl: 'public, max-age=31536000', // 1 year
                metadata: {
                    articleId: metadata.articleId,
                    source: metadata.source,
                    provider: metadata.provider,
                    voice: metadata.voice,
                    textLength: metadata.textLength.toString(),
                    audioType: metadata.audioType,
                    generatedAt: new Date().toISOString(),
                },
            },
        });
        // Make file publicly accessible
        await file.makePublic();
        // Get public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        logger.debug('File uploaded to Firebase Storage', {
            path: storagePath,
            size: audioBuffer.length,
            url: publicUrl,
        });
        return publicUrl;
    }
    catch (error) {
        logger.error('Firebase Storage upload failed', {
            path: storagePath,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new Error(`Storage upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Check if audio already exists for an article
 * Returns the public URL if exists, null otherwise
 */
async function checkExistingAudio(articleId, source, audioType) {
    try {
        const bucket = admin.storage().bucket();
        const storagePath = `news-audio/${source}/${articleId}/${audioType}.mp3`;
        const file = bucket.file(storagePath);
        const [exists] = await file.exists();
        if (exists) {
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
            logger.debug('Existing audio found', { articleId, audioType, url: publicUrl });
            return publicUrl;
        }
        return null;
    }
    catch (error) {
        logger.warn('Error checking existing audio', {
            articleId,
            audioType,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
    }
}
async function generateBatchAudio(article, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const result = {
        errors: [],
    };
    // Check if NHK original audio is available - skip content TTS if so
    const hasNhkAudio = !!article.nhkAudioUrl;
    if (hasNhkAudio) {
        logger.info('[AudioGenerator] NHK original audio available - will skip content TTS generation', {
            articleId: article.id,
            nhkAudioUrl: article.nhkAudioUrl,
        });
    }
    // Map 'kokoro' to 'voicevox' for backward compatibility
    const provider = options.provider === 'kokoro' ? 'voicevox' : options.provider || 'voicevox';
    const voice = options.voice || (provider === 'voicevox' ? DEFAULT_VOICEVOX_VOICE : DEFAULT_EDGE_VOICE);
    // Generate title audio
    try {
        const existingTitleUrl = await checkExistingAudio(article.id, article.source, 'title');
        if (existingTitleUrl) {
            logger.info('Using existing title audio', { articleId: article.id });
            result.titleAudio = {
                url: existingTitleUrl,
                provider,
                voice,
                generatedAt: new Date(),
                textLength: article.title.length,
                audioType: 'title',
            };
        }
        else {
            result.titleAudio = await generateNewsAudio(article.title, article.id, article.source, 'title', options);
        }
    }
    catch (error) {
        const errorMsg = `Title audio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        logger.error(errorMsg, { articleId: article.id });
    }
    // Generate summary audio
    try {
        const existingSummaryUrl = await checkExistingAudio(article.id, article.source, 'summary');
        if (existingSummaryUrl) {
            logger.info('Using existing summary audio', { articleId: article.id });
            result.summaryAudio = {
                url: existingSummaryUrl,
                provider,
                voice,
                generatedAt: new Date(),
                textLength: article.summary.length,
                audioType: 'summary',
            };
        }
        else {
            result.summaryAudio = await generateNewsAudio(article.summary, article.id, article.source, 'summary', options);
        }
    }
    catch (error) {
        const errorMsg = `Summary audio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        logger.error(errorMsg, { articleId: article.id });
    }
    // Generate content audio (full article) - SKIP if NHK original audio is available
    if (hasNhkAudio) {
        // NHK audio available - no need to generate TTS for full content
        logger.info('[AudioGenerator] Skipping content TTS - using NHK original audio', {
            articleId: article.id,
            nhkAudioUrl: article.nhkAudioUrl,
        });
        // Don't set contentAudio - the article reader will use nhkAudioUrl instead
    }
    else {
        try {
            const existingContentUrl = await checkExistingAudio(article.id, article.source, 'content');
            if (existingContentUrl) {
                logger.info('Using existing content audio', { articleId: article.id });
                result.contentAudio = {
                    url: existingContentUrl,
                    provider,
                    voice,
                    generatedAt: new Date(),
                    textLength: article.content.length,
                    audioType: 'content',
                };
            }
            else {
                result.contentAudio = await generateNewsAudio(article.content, article.id, article.source, 'content', options);
            }
        }
        catch (error) {
            const errorMsg = `Content audio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            logger.error(errorMsg, { articleId: article.id });
        }
    }
    // Save audio URLs to Firestore news_articles document
    // This enables smart skip detection in future scrapes
    try {
        const db = admin.firestore();
        const updateData = {
            audioGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
            audioProvider: provider,
            audioVoice: voice,
        };
        if ((_a = result.titleAudio) === null || _a === void 0 ? void 0 : _a.url) {
            updateData.generatedTitleAudioUrl = result.titleAudio.url;
        }
        if ((_b = result.summaryAudio) === null || _b === void 0 ? void 0 : _b.url) {
            updateData.generatedSummaryAudioUrl = result.summaryAudio.url;
        }
        if ((_c = result.contentAudio) === null || _c === void 0 ? void 0 : _c.url) {
            updateData.generatedContentAudioUrl = result.contentAudio.url;
        }
        // Determine audio status
        const hasAllAudio = ((_d = result.titleAudio) === null || _d === void 0 ? void 0 : _d.url) && ((_e = result.summaryAudio) === null || _e === void 0 ? void 0 : _e.url) && ((_f = result.contentAudio) === null || _f === void 0 ? void 0 : _f.url);
        const hasAnyAudio = ((_g = result.titleAudio) === null || _g === void 0 ? void 0 : _g.url) || ((_h = result.summaryAudio) === null || _h === void 0 ? void 0 : _h.url) || ((_j = result.contentAudio) === null || _j === void 0 ? void 0 : _j.url);
        if (hasAllAudio) {
            updateData.audioStatus = 'generated';
        }
        else if (hasAnyAudio) {
            updateData.audioStatus = 'partial';
        }
        else if (result.errors.length > 0) {
            updateData.audioStatus = 'failed';
            updateData.audioError = result.errors.join('; ');
        }
        await db.collection('news_articles').doc(article.id).update(updateData);
        logger.info('[AudioGenerator] Audio URLs saved to Firestore', {
            articleId: article.id,
            hasTitle: !!((_k = result.titleAudio) === null || _k === void 0 ? void 0 : _k.url),
            hasSummary: !!((_l = result.summaryAudio) === null || _l === void 0 ? void 0 : _l.url),
            hasContent: !!((_m = result.contentAudio) === null || _m === void 0 ? void 0 : _m.url),
            status: updateData.audioStatus,
        });
    }
    catch (saveError) {
        // Don't fail the whole operation if Firestore save fails
        logger.error('[AudioGenerator] Failed to save audio URLs to Firestore', {
            articleId: article.id,
            error: saveError instanceof Error ? saveError.message : 'Unknown error',
        });
    }
    return result;
}
//# sourceMappingURL=newsAudioGenerator.js.map