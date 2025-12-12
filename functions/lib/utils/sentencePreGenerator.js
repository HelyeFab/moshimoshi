"use strict";
/**
 * Sentence Pre-Generator
 * Pre-generates audio and translations for individual sentences
 * Used by news articles, stories, and books for instant playback/translation
 *
 * Features:
 * - VOICEVOX TTS audio generation for each sentence
 * - Translation with grammar notes and vocabulary
 * - Firebase Storage for audio, Firestore for translations
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
exports.splitIntoSentences = splitIntoSentences;
exports.preGenerateSentences = preGenerateSentences;
exports.storeSentenceDataForArticle = storeSentenceDataForArticle;
exports.storeSentenceDataForStory = storeSentenceDataForStory;
exports.storeSentenceDataForBook = storeSentenceDataForBook;
exports.preGenerateArticleSentences = preGenerateArticleSentences;
exports.preGenerateStorySentences = preGenerateStorySentences;
exports.preGenerateBookSentences = preGenerateBookSentences;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const params_1 = require("firebase-functions/params");
const crypto_1 = __importDefault(require("crypto"));
// Initialize Firestore and Storage
const db = admin.firestore();
// Define secrets
const MODAL_API_KEY = (0, params_1.defineSecret)('MODAL_API_KEY');
// VOICEVOX configuration
const VOICEVOX_CONFIG = {
    endpoint: 'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech',
    defaultVoice: '23', // Energetic female (same as news audio)
    speed: 0.85,
};
// Qwen 2.5 configuration for translations
const QWEN_CONFIG = {
    baseUrl: 'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run',
    model: 'qwen2.5:32b',
    timeout: 120000, // 2 minutes per sentence (shorter than article)
};
// ============================================
// Sentence Splitting
// ============================================
/**
 * Split Japanese text into sentences by 。
 * Preserves the sentence-ending punctuation
 */
function splitIntoSentences(text) {
    if (!text || text.trim().length === 0) {
        return [];
    }
    // Split by Japanese period, keeping the delimiter
    const parts = text.split(/(。)/);
    const sentences = [];
    let current = '';
    for (const part of parts) {
        if (!part)
            continue;
        if (part === '。') {
            current += part;
            if (current.trim()) {
                sentences.push(current.trim());
                current = '';
            }
        }
        else {
            current += part;
        }
    }
    // Add any remaining text (sentence without ending period)
    if (current.trim()) {
        sentences.push(current.trim());
    }
    return sentences;
}
// ============================================
// Audio Generation
// ============================================
/**
 * Generate VOICEVOX audio for a sentence
 */
async function generateSentenceAudio(sentence, contentId, sentenceIndex, contentType) {
    const sentenceHash = crypto_1.default
        .createHash('md5')
        .update(`${contentId}-${sentenceIndex}-${sentence}`)
        .digest('hex');
    const storagePath = `sentence-audio/${contentType}/${contentId}/${sentenceHash}.mp3`;
    // Check if already exists
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (exists) {
        logger.debug('[SentencePreGen] Using cached audio', {
            contentId,
            sentenceIndex,
            cached: true,
        });
        return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    }
    // Generate new audio
    logger.debug('[SentencePreGen] Generating audio', {
        contentId,
        sentenceIndex,
        textLength: sentence.length,
    });
    const response = await fetch(VOICEVOX_CONFIG.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': MODAL_API_KEY.value().trim(),
        },
        body: JSON.stringify({
            model: 'voicevox',
            input: sentence,
            voice: VOICEVOX_CONFIG.defaultVoice,
            speed: VOICEVOX_CONFIG.speed,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`VOICEVOX API error (${response.status}): ${errorText}`);
    }
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    if (audioBuffer.length === 0) {
        throw new Error('VOICEVOX returned empty audio');
    }
    // Upload to Firebase Storage
    await file.save(audioBuffer, {
        metadata: {
            contentType: 'audio/mpeg',
            cacheControl: 'public, max-age=31536000',
            metadata: {
                contentId,
                contentType,
                sentenceIndex: String(sentenceIndex),
                sentenceHash,
                generatedAt: new Date().toISOString(),
                provider: 'voicevox',
                voice: VOICEVOX_CONFIG.defaultVoice,
            },
        },
    });
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}
/**
 * Generate translation with grammar notes and vocabulary for a sentence
 */
async function generateSentenceTranslation(sentence) {
    var _a, _b, _c;
    const systemPrompt = `You are an expert Japanese-English translator for language learners.
For each sentence, provide:
1. A natural English translation
2. Key grammar patterns with explanations
3. Important vocabulary with readings and meanings

Return a JSON object:
{
  "translatedText": "English translation",
  "confidence": 0.95,
  "grammarNotes": [
    {
      "pattern": "〜ている",
      "explanation": "Progressive/continuous action",
      "example": "食べている (is eating)"
    }
  ],
  "keyVocabulary": [
    {
      "word": "食べる",
      "reading": "たべる",
      "meaning": "to eat",
      "jlptLevel": "N5",
      "partOfSpeech": "verb"
    }
  ]
}`;
    const userPrompt = `Translate this Japanese sentence for language learners:

"${sentence}"

Focus on educational value. Return valid JSON.`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), QWEN_CONFIG.timeout);
    try {
        const response = await fetch(`${QWEN_CONFIG.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': MODAL_API_KEY.value().trim(),
            },
            body: JSON.stringify({
                model: QWEN_CONFIG.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' },
            }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
        }
        const data = (await response.json());
        const content = ((_b = (_a = data.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '{}';
        const parsed = JSON.parse(content);
        const translation = {
            originalText: sentence,
            translatedText: parsed.translatedText || '',
            grammarNotes: parsed.grammarNotes || [],
            keyVocabulary: parsed.keyVocabulary || [],
            confidence: parsed.confidence || 0.9,
        };
        return {
            translation,
            tokens: ((_c = data.usage) === null || _c === void 0 ? void 0 : _c.total_tokens) || 0,
        };
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Qwen API timeout');
        }
        throw error;
    }
}
// ============================================
// Main Pre-Generation Functions
// ============================================
/**
 * Pre-generate audio and translations for all sentences in content
 */
async function preGenerateSentences(contentId, content, contentType) {
    const startTime = Date.now();
    logger.info('[SentencePreGen] Starting sentence pre-generation', {
        contentId,
        contentType,
        contentLength: content.length,
    });
    const sentences = splitIntoSentences(content);
    logger.info('[SentencePreGen] Split content into sentences', {
        contentId,
        sentenceCount: sentences.length,
    });
    const sentenceData = [];
    let totalTokens = 0;
    let audioCount = 0;
    for (let index = 0; index < sentences.length; index++) {
        const sentence = sentences[index];
        try {
            // Generate audio
            const audioUrl = await generateSentenceAudio(sentence, contentId, index, contentType);
            audioCount++;
            // Generate translation
            const { translation, tokens } = await generateSentenceTranslation(sentence);
            totalTokens += tokens;
            sentenceData.push({
                index,
                text: sentence,
                audioUrl,
                translation,
            });
            logger.debug('[SentencePreGen] Sentence processed', {
                contentId,
                index,
                sentenceLength: sentence.length,
                hasAudio: !!audioUrl,
                hasTranslation: !!translation.translatedText,
            });
            // Small delay to avoid rate limiting
            if (index < sentences.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        catch (error) {
            logger.error('[SentencePreGen] Error processing sentence', {
                contentId,
                index,
                sentence: sentence.substring(0, 50) + '...',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Continue with next sentence even if one fails
            // Add partial data without audio/translation if needed
            sentenceData.push({
                index,
                text: sentence,
                audioUrl: '',
                translation: {
                    originalText: sentence,
                    translatedText: '',
                    grammarNotes: [],
                    keyVocabulary: [],
                    confidence: 0,
                },
            });
        }
    }
    const duration = Date.now() - startTime;
    logger.info('[SentencePreGen] Pre-generation completed', {
        contentId,
        contentType,
        sentenceCount: sentences.length,
        successCount: sentenceData.filter(s => s.audioUrl && s.translation.translatedText).length,
        durationMs: duration,
        totalTokens,
        audioCount,
    });
    return {
        contentId,
        contentType,
        sentences: sentenceData,
        generatedAt: admin.firestore.Timestamp.now(),
        costInfo: {
            audioCount,
            translationTokens: totalTokens,
            estimatedCost: 0, // Self-hosted = $0
        },
    };
}
// ============================================
// Storage Functions
// ============================================
/**
 * Store sentence data for a news article
 * Extends the existing news_article_translations document
 */
async function storeSentenceDataForArticle(articleId, sentenceData) {
    try {
        const docRef = db.collection('news_article_translations').doc(articleId);
        const doc = await docRef.get();
        if (doc.exists) {
            // Update existing document with sentence data
            await docRef.update({
                sentences: sentenceData,
                sentencesGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else {
            // Create new document with just sentence data
            await docRef.set({
                articleId,
                sentences: sentenceData,
                sentencesGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        logger.info('[SentencePreGen] Sentence data stored for article', {
            articleId,
            sentenceCount: sentenceData.length,
        });
    }
    catch (error) {
        logger.error('[SentencePreGen] Error storing sentence data for article', {
            articleId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
/**
 * Store sentence data for a story page
 */
async function storeSentenceDataForStory(storyId, pageNumber, sentenceData) {
    try {
        const docRef = db.collection('story_sentence_data').doc(storyId);
        const doc = await docRef.get();
        const pageData = {
            pageNumber,
            sentences: sentenceData,
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (doc.exists) {
            // Update existing document - add/update page data
            const existingData = doc.data();
            const existingPages = (existingData === null || existingData === void 0 ? void 0 : existingData.pages) || [];
            // Find and replace page or add new
            const pageIndex = existingPages.findIndex((p) => p.pageNumber === pageNumber);
            if (pageIndex >= 0) {
                existingPages[pageIndex] = pageData;
            }
            else {
                existingPages.push(pageData);
            }
            await docRef.update({
                pages: existingPages,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else {
            // Create new document
            await docRef.set({
                storyId,
                pages: [pageData],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        logger.info('[SentencePreGen] Sentence data stored for story page', {
            storyId,
            pageNumber,
            sentenceCount: sentenceData.length,
        });
    }
    catch (error) {
        logger.error('[SentencePreGen] Error storing sentence data for story', {
            storyId,
            pageNumber,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
/**
 * Store sentence data for a book
 */
async function storeSentenceDataForBook(bookId, sentenceData) {
    try {
        const docRef = db.collection('book_sentence_data').doc(bookId);
        await docRef.set({
            bookId,
            sentences: sentenceData,
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info('[SentencePreGen] Sentence data stored for book', {
            bookId,
            sentenceCount: sentenceData.length,
        });
    }
    catch (error) {
        logger.error('[SentencePreGen] Error storing sentence data for book', {
            bookId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
// ============================================
// High-Level Integration Functions
// ============================================
/**
 * Pre-generate sentences for a news article and store
 */
async function preGenerateArticleSentences(articleId, content) {
    const result = await preGenerateSentences(articleId, content, 'news_article');
    await storeSentenceDataForArticle(articleId, result.sentences);
}
/**
 * Pre-generate sentences for all pages of a story and store
 */
async function preGenerateStorySentences(storyId, pages) {
    for (const page of pages) {
        const result = await preGenerateSentences(`${storyId}_page${page.pageNumber}`, page.text, 'story');
        await storeSentenceDataForStory(storyId, page.pageNumber, result.sentences);
    }
}
/**
 * Pre-generate sentences for a book and store
 */
async function preGenerateBookSentences(bookId, content) {
    const result = await preGenerateSentences(bookId, content, 'book');
    await storeSentenceDataForBook(bookId, result.sentences);
}
//# sourceMappingURL=sentencePreGenerator.js.map