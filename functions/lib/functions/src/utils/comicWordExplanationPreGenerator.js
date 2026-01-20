"use strict";
/**
 * Word Explanation Pre-Generator for Comic Episodes
 * Pre-generates comprehensive word explanations for comic vocabulary
 * Stores in Firestore for instant retrieval by frontend
 *
 * Follows the same pattern as news articles (wordExplanationPreGenerator.ts)
 * Uses Qwen 2.5 32B via Modal Ollama endpoint for cost-effective AI processing
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
exports.generateComicWordExplanations = generateComicWordExplanations;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const params_1 = require("firebase-functions/params");
const wordExtractor_1 = require("./wordExtractor");
const crypto_1 = __importDefault(require("crypto"));
// Initialize Firestore
const db = admin.firestore();
// Define Modal API key for Qwen 2.5 access
const MODAL_API_KEY = (0, params_1.defineSecret)('MODAL_API_KEY');
/**
 * Get API key - supports both Cloud Functions and local environments
 */
function getModalApiKey() {
    try {
        // In Cloud Functions runtime, use defineSecret
        const secretValue = MODAL_API_KEY.value();
        if (secretValue)
            return secretValue;
    }
    catch (error) {
        // defineSecret not available or not configured
    }
    // Fall back to environment variable for local execution
    return process.env.MODAL_API_KEY || '';
}
// Qwen 2.5 configuration via Modal Ollama
const QWEN_CONFIG = {
    baseUrl: 'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run',
    model: 'qwen2.5:32b',
    timeout: 300000, // 5 minutes for 32B model
};
function hashWord(word) {
    return crypto_1.default.createHash('sha256').update(word.trim().toLowerCase()).digest('hex');
}
async function getGlobalCache(words) {
    const cache = new Map();
    if (words.length === 0)
        return cache;
    const docRefs = words.map(word => db.collection('wordExplanationCache').doc(hashWord(word.word)));
    const docs = await db.getAll(...docRefs);
    docs.forEach((doc, idx) => {
        if (!doc.exists)
            return;
        const data = doc.data();
        if (data === null || data === void 0 ? void 0 : data.explanation) {
            cache.set(words[idx].word.trim().toLowerCase(), data.explanation);
        }
    });
    return cache;
}
/**
 * Call Qwen 2.5 via Modal Ollama endpoint
 */
async function callQwen(systemPrompt, userPrompt) {
    var _a, _b, _c, _d, _e;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), QWEN_CONFIG.timeout);
    try {
        const response = await fetch(`${QWEN_CONFIG.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': getModalApiKey(),
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
        return {
            content,
            usage: {
                promptTokens: ((_c = data.usage) === null || _c === void 0 ? void 0 : _c.prompt_tokens) || 0,
                completionTokens: ((_d = data.usage) === null || _d === void 0 ? void 0 : _d.completion_tokens) || 0,
                totalTokens: ((_e = data.usage) === null || _e === void 0 ? void 0 : _e.total_tokens) || 0,
            },
        };
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Qwen API timeout after 5 minutes');
        }
        throw error;
    }
}
/**
 * Generate comprehensive explanation for a single word
 */
async function generateWordExplanation(word, context) {
    const systemPrompt = `You are a Japanese language expert helping learners understand vocabulary from comic episodes.

Generate a comprehensive explanation for the given Japanese word in JSON format with this EXACT structure:

{
  "word": "The word in original form (kanji/hiragana/katakana)",
  "reading": "Hiragana reading",
  "romaji": "Romanized pronunciation",
  "meaning": "Clear English definition",
  "partOfSpeech": "noun/verb/adjective/particle/etc.",
  "kanjiBreakdown": [
    {
      "kanji": "Single kanji character",
      "meaning": "Kanji meaning",
      "kunYomi": ["kun readings"],
      "onYomi": ["on readings"]
    }
  ],
  "conjugation": {
    "dictionary": "Dictionary form",
    "present": "Present form",
    "past": "Past form",
    "negative": "Negative form",
    "teForm": "Te-form"
  },
  "relatedWords": {
    "synonyms": ["Similar words"],
    "antonyms": ["Opposite words"],
    "compounds": ["Compound words"]
  },
  "jlptLevel": "N5/N4/N3/N2/N1",
  "formality": "casual/formal/neutral/both",
  "usageNotes": "When and how to use this word",
  "examples": [
    {
      "japanese": "Example sentence",
      "furigana": "With furigana",
      "translation": "English translation",
      "notes": "Context note"
    }
  ]
}

IMPORTANT:
- Always include kanjiBreakdown if the word contains any kanji
- Always include conjugation for verbs and adjectives
- Include at least 2-3 examples
- Make explanations appropriate for N5-N3 learners`;
    const userPrompt = `Provide a comprehensive explanation for this Japanese word from a comic episode:

"${word.word}"

${context ? `Context where this word appears:\n"${context}"\n\n` : ''}
${word.estimatedJLPT ? `Estimated JLPT Level: ${word.estimatedJLPT}\n` : ''}
Word frequency in episode: ${word.frequency}

Return a valid JSON object as specified.`;
    try {
        const { content, usage } = await callQwen(systemPrompt, userPrompt);
        const parsed = JSON.parse(content);
        // Ensure required fields
        const explanation = {
            word: parsed.word || word.word,
            reading: parsed.reading || '',
            romaji: parsed.romaji || '',
            meaning: parsed.meaning || '',
            partOfSpeech: parsed.partOfSpeech || 'unknown',
            surfaceForms: word.surfaceForms,
            kanjiBreakdown: parsed.kanjiBreakdown || [],
            conjugation: parsed.conjugation,
            relatedWords: parsed.relatedWords || { synonyms: [], antonyms: [], compounds: [] },
            jlptLevel: parsed.jlptLevel || word.estimatedJLPT,
            formality: parsed.formality || 'neutral',
            usageNotes: parsed.usageNotes,
            examples: parsed.examples || [],
        };
        return { explanation, usage };
    }
    catch (error) {
        logger.error('[ComicWordPreGen] Error generating explanation with Qwen', {
            word: word.word,
            model: QWEN_CONFIG.model,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
/**
 * Generate explanations for multiple words
 */
async function generateWordExplanations(words, comicContext) {
    const startTime = Date.now();
    logger.info('[ComicWordPreGen] Starting word explanation generation', {
        wordCount: words.length,
    });
    const explanations = [];
    const cacheMap = await getGlobalCache(words);
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    for (const word of words) {
        try {
            const cached = cacheMap.get(word.word.trim().toLowerCase());
            if (cached) {
                if (!cached.surfaceForms && word.surfaceForms) {
                    cached.surfaceForms = word.surfaceForms;
                }
                explanations.push(cached);
                logger.debug('[ComicWordPreGen] Cache hit', {
                    word: word.word,
                });
                continue;
            }
            const { explanation, usage } = await generateWordExplanation(word, comicContext);
            explanations.push(explanation);
            totalPromptTokens += usage.promptTokens;
            totalCompletionTokens += usage.completionTokens;
            totalTokens += usage.totalTokens;
            logger.debug('[ComicWordPreGen] Word explanation generated', {
                word: word.word,
                meaning: explanation.meaning,
                tokensUsed: usage.totalTokens,
            });
        }
        catch (error) {
            logger.error('[ComicWordPreGen] Failed to generate explanation for word', {
                word: word.word,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Continue with next word
        }
    }
    // Qwen 2.5 via Modal Ollama is self-hosted = $0 cost
    // Keeping token tracking for monitoring purposes
    const totalCost = 0;
    const duration = Date.now() - startTime;
    logger.info('[ComicWordPreGen] Word explanation generation completed', {
        wordsRequested: words.length,
        wordsGenerated: explanations.length,
        durationMs: duration,
        tokensUsed: totalTokens,
        estimatedCost: totalCost.toFixed(4),
        avgTimePerWord: Math.round(duration / words.length),
    });
    return {
        explanations,
        totalCost,
        totalTokens,
    };
}
/**
 * Recursively remove undefined values from an object (Firestore doesn't accept undefined)
 */
function removeUndefinedValues(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => removeUndefinedValues(item));
    }
    if (typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = removeUndefinedValues(value);
            }
        }
        return cleaned;
    }
    return obj;
}
/**
 * Generate and store word explanations for a comic episode
 */
async function generateComicWordExplanations(episodeId, comicText, topWordCount = 100) {
    const startTime = Date.now();
    logger.info('[ComicWordPreGen] Starting comic word explanations', {
        episodeId,
        textLength: comicText.length,
        topWordCount,
    });
    try {
        // Extract top words from comic text using Kuromoji
        const { words } = await (0, wordExtractor_1.extractTopWords)(comicText, topWordCount);
        logger.info('[ComicWordPreGen] Words extracted', {
            episodeId,
            wordCount: words.length,
        });
        // Generate explanations for all words
        const { explanations, totalCost, totalTokens } = await generateWordExplanations(words, comicText.substring(0, 500) // Use first 500 chars as context
        );
        // Calculate token breakdown (rough estimate)
        const promptTokens = Math.floor(totalTokens * 0.4);
        const completionTokens = totalTokens - promptTokens;
        const comicExplanations = {
            episodeId,
            words: explanations,
            wordCount: explanations.length,
            generatedAt: admin.firestore.Timestamp.now(),
            costInfo: {
                promptTokens,
                completionTokens,
                totalTokens,
                estimatedCost: totalCost,
            },
        };
        // Store in Firestore (comic_word_explanations collection)
        const docRef = db.collection('comic_word_explanations').doc(episodeId);
        // Clean undefined values before storing
        const cleanedExplanations = removeUndefinedValues(comicExplanations);
        await docRef.set(Object.assign(Object.assign({}, cleanedExplanations), { generatedAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdated: admin.firestore.FieldValue.serverTimestamp() }));
        logger.info('[ComicWordPreGen] Word explanations stored', {
            episodeId,
            wordCount: explanations.length,
            collection: 'comic_word_explanations',
        });
        const duration = Date.now() - startTime;
        logger.info('[ComicWordPreGen] Comic word explanations completed', {
            episodeId,
            wordCount: explanations.length,
            durationMs: duration,
            estimatedCost: totalCost.toFixed(4),
        });
        return comicExplanations;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger.error('[ComicWordPreGen] Comic word explanations failed', {
            episodeId,
            error: error instanceof Error ? error.message : 'Unknown error',
            durationMs: duration,
        });
        throw error;
    }
}
//# sourceMappingURL=comicWordExplanationPreGenerator.js.map