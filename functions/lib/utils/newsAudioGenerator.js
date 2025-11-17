"use strict";
/**
 * News Audio Generator - TTS utility for news article scraping
 * Generates audio using Kokoro TTS API and stores in Firebase Storage
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
// TTS API configuration
const KOKORO_TTS_ENDPOINT = 'https://api.selfmind.dev/kokoro/v1/audio/speech';
const EDGE_TTS_ENDPOINT = 'https://tts.selfmind.dev/speak';
const KOKORO_API_KEY = (0, params_1.defineSecret)('KOKORO_API_KEY');
// Kokoro voices (10-30x faster, higher quality)
const DEFAULT_KOKORO_VOICE = 'jf_alpha'; // Female Japanese voice
const DEFAULT_EDGE_VOICE = 'ja-JP-NanamiNeural'; // Fallback voice
const MAX_TEXT_LENGTH = 5000; // TTS limit
/**
 * Generate audio for news article using Edge-TTS
 *
 * @param text - Text to convert to speech (max 5000 chars)
 * @param articleId - Unique article identifier
 * @param source - News source (e.g., 'nhk-easy', 'mainichi-news')
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
            articleId
        });
        text = text.substring(0, MAX_TEXT_LENGTH);
    }
    const provider = options.provider || 'kokoro';
    const voice = options.voice || (provider === 'kokoro' ? DEFAULT_KOKORO_VOICE : DEFAULT_EDGE_VOICE);
    logger.info('Generating audio', {
        articleId,
        source,
        audioType,
        textLength: text.length,
        voice,
        provider
    });
    try {
        // Step 1: Generate audio with selected TTS provider
        const audioBuffer = provider === 'kokoro'
            ? await callKokoroTTS(text, voice)
            : await callEdgeTTS(text, {
                voice,
                rate: options.rate || '+0%',
                volume: options.volume || '+0%',
                pitch: options.pitch || '+0Hz'
            });
        // Step 2: Upload to Firebase Storage
        const storagePath = `news-audio/${source}/${articleId}/${audioType}.mp3`;
        const publicUrl = await uploadToFirebaseStorage(audioBuffer, storagePath, {
            articleId,
            source,
            provider,
            voice,
            textLength: text.length,
            audioType
        });
        logger.info('Audio generated successfully', {
            articleId,
            audioType,
            url: publicUrl
        });
        return {
            url: publicUrl,
            provider,
            voice,
            generatedAt: new Date(),
            textLength: text.length,
            audioType
        };
    }
    catch (error) {
        logger.error('Failed to generate audio', {
            articleId,
            audioType,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}
/**
 * Call Kokoro TTS API to generate audio (10-30x faster than Edge-TTS)
 */
async function callKokoroTTS(text, voice) {
    const startTime = Date.now();
    try {
        const response = await (0, node_fetch_1.default)(KOKORO_TTS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': KOKORO_API_KEY.value().trim()
            },
            body: JSON.stringify({
                model: 'kokoro',
                input: text,
                voice: voice,
                response_format: 'mp3',
                speed: 1.0
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Kokoro TTS API error (${response.status}): ${errorText}`);
        }
        const audioBuffer = await response.buffer();
        const duration = Date.now() - startTime;
        logger.debug('Kokoro TTS API call successful', {
            textLength: text.length,
            audioSize: audioBuffer.length,
            durationMs: duration
        });
        return audioBuffer;
    }
    catch (error) {
        logger.error('Kokoro TTS API call failed', {
            endpoint: KOKORO_TTS_ENDPOINT,
            error: error instanceof Error ? error.message : 'Unknown error'
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
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text,
                voice: options.voice,
                rate: options.rate,
                volume: options.volume,
                pitch: options.pitch
            })
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
            durationMs: duration
        });
        return audioBuffer;
    }
    catch (error) {
        logger.error('Edge-TTS API call failed', {
            endpoint: EDGE_TTS_ENDPOINT,
            error: error instanceof Error ? error.message : 'Unknown error'
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
                    generatedAt: new Date().toISOString()
                }
            }
        });
        // Make file publicly accessible
        await file.makePublic();
        // Get public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        logger.debug('File uploaded to Firebase Storage', {
            path: storagePath,
            size: audioBuffer.length,
            url: publicUrl
        });
        return publicUrl;
    }
    catch (error) {
        logger.error('Firebase Storage upload failed', {
            path: storagePath,
            error: error instanceof Error ? error.message : 'Unknown error'
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
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
    }
}
async function generateBatchAudio(article, options = {}) {
    const result = {
        errors: []
    };
    const provider = options.provider || 'kokoro';
    const voice = options.voice || (provider === 'kokoro' ? DEFAULT_KOKORO_VOICE : DEFAULT_EDGE_VOICE);
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
                audioType: 'title'
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
                audioType: 'summary'
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
    // Generate content audio (full article)
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
                audioType: 'content'
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
    return result;
}
//# sourceMappingURL=newsAudioGenerator.js.map