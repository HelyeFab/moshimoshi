"use strict";
/**
 * Word Explanation Pre-Generator for Story Content
 * Pre-generates comprehensive word explanations for story vocabulary
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWordExplanation = generateWordExplanation;
exports.generateStoryWordExplanations = generateStoryWordExplanations;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const params_1 = require("firebase-functions/params");
const wordExtractor_1 = require("./wordExtractor");
const crypto_1 = __importDefault(require("crypto"));
// Initialize Firebase Admin if needed (scripts may not share app instance)
if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = (_a = process.env.FIREBASE_ADMIN_PRIVATE_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, '\n');
    if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    }
    else {
        admin.initializeApp();
    }
}
// Initialize Firestore
const db = admin.firestore();
// Define Modal API key for Qwen 2.5 access
const MODAL_API_KEY = (0, params_1.defineSecret)('MODAL_API_KEY');
/**
 * Get Modal API key with fallback for local execution
 * Supports both Cloud Functions runtime and local development
 */
function getModalApiKey() {
    // Prefer direct env var for local/script execution
    if (process.env.MODAL_API_KEY) {
        return process.env.MODAL_API_KEY;
    }
    // Only access secrets when running inside Functions runtime/emulator
    const inFunctionsRuntime = !!process.env.FUNCTION_TARGET ||
        !!process.env.K_SERVICE ||
        process.env.FUNCTIONS_EMULATOR === 'true';
    if (inFunctionsRuntime) {
        try {
            const secretValue = MODAL_API_KEY.value();
            if (secretValue)
                return secretValue;
        }
        catch (error) {
            // defineSecret not available or not configured
        }
    }
    return '';
}
// Qwen 2.5 configuration via Modal Ollama
const QWEN_CONFIG = {
    baseUrl: process.env.OLLAMA_BASE_URL ||
        'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run',
    model: process.env.OLLAMA_MODEL || 'qwen2.5:32b',
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
        const apiKey = getModalApiKey();
        const headers = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['X-API-Key'] = apiKey;
        }
        const response = await fetch(`${QWEN_CONFIG.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers,
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
function escapeControlCharsInStrings(input) {
    let out = '';
    let inString = false;
    let escape = false;
    for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];
        if (!inString) {
            if (ch === '"') {
                inString = true;
            }
            out += ch;
            continue;
        }
        if (escape) {
            out += ch;
            escape = false;
            continue;
        }
        if (ch === '\\') {
            out += ch;
            escape = true;
            continue;
        }
        if (ch === '"') {
            inString = false;
            out += ch;
            continue;
        }
        const code = ch.charCodeAt(0);
        if (code <= 0x1f) {
            switch (ch) {
                case '\n':
                    out += '\\n';
                    break;
                case '\r':
                    out += '\\r';
                    break;
                case '\t':
                    out += '\\t';
                    break;
                case '\b':
                    out += '\\b';
                    break;
                case '\f':
                    out += '\\f';
                    break;
                default:
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                    break;
            }
            continue;
        }
        out += ch;
    }
    return out;
}
function safeJsonParse(input) {
    try {
        return JSON.parse(input);
    }
    catch (error) {
        const sanitized = escapeControlCharsInStrings(input);
        try {
            return JSON.parse(sanitized);
        }
        catch (sanitizedError) {
            const originalMessage = error instanceof Error ? error.message : 'Unknown parse error';
            const sanitizedMessage = sanitizedError instanceof Error ? sanitizedError.message : 'Unknown sanitized parse error';
            throw new Error(`Failed to parse JSON (original: ${originalMessage}; sanitized: ${sanitizedMessage})`);
        }
    }
}
/**
 * Generate comprehensive explanation for a single word
 */
async function generateWordExplanation(word, context) {
    const systemPrompt = `You are a Japanese language expert helping learners understand vocabulary from stories.

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
    const userPrompt = `Provide a comprehensive explanation for this Japanese word from a story episode:

"${word.word}"

${context ? `Context where this word appears:\n"${context}"\n\n` : ''}
${word.estimatedJLPT ? `Estimated JLPT Level: ${word.estimatedJLPT}\n` : ''}
Word frequency in episode: ${word.frequency}

Return a valid JSON object as specified.`;
    try {
        const { content, usage } = await callQwen(systemPrompt, userPrompt);
        const parsed = safeJsonParse(content);
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
        logger.error('[StoryWordPreGen] Error generating explanation with Qwen', {
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
async function generateWordExplanations(words, storyContext) {
    const startTime = Date.now();
    logger.info('[StoryWordPreGen] Starting word explanation generation', {
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
                logger.debug('[StoryWordPreGen] Cache hit', {
                    word: word.word,
                });
                continue;
            }
            const { explanation, usage } = await generateWordExplanation(word, storyContext);
            explanations.push(explanation);
            totalPromptTokens += usage.promptTokens;
            totalCompletionTokens += usage.completionTokens;
            totalTokens += usage.totalTokens;
            logger.debug('[StoryWordPreGen] Word explanation generated', {
                word: word.word,
                meaning: explanation.meaning,
                tokensUsed: usage.totalTokens,
            });
        }
        catch (error) {
            logger.error('[StoryWordPreGen] Failed to generate explanation for word', {
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
    logger.info('[StoryWordPreGen] Word explanation generation completed', {
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
 * Generate and store word explanations for a story episode
 */
async function generateStoryWordExplanations(storyId, storyText, topWordCount, options) {
    const startTime = Date.now();
    logger.info('[StoryWordPreGen] Starting story word explanations', {
        storyId,
        textLength: storyText.length,
        topWordCount: typeof topWordCount === 'number' ? topWordCount : 'all_filtered',
    });
    try {
        // Extract words from story text using Kuromoji
        const { words } = await (0, wordExtractor_1.extractWords)(storyText, Object.assign(Object.assign({}, (typeof topWordCount === 'number' ? { limit: topWordCount } : {})), (options || {})));
        logger.info('[StoryWordPreGen] Words extracted', {
            storyId,
            wordCount: words.length,
        });
        // Generate explanations for all words
        const { explanations, totalCost, totalTokens } = await generateWordExplanations(words, storyText.substring(0, 500) // Use first 500 chars as context
        );
        // Calculate token breakdown (rough estimate)
        const promptTokens = Math.floor(totalTokens * 0.4);
        const completionTokens = totalTokens - promptTokens;
        const storyExplanations = {
            storyId,
            words: explanations,
            wordCount: explanations.length,
            total: explanations.length, // For compatibility with existing story scheduler code
            generatedAt: admin.firestore.Timestamp.now(),
            costInfo: {
                promptTokens,
                completionTokens,
                totalTokens,
                estimatedCost: totalCost,
            },
        };
        // Store in Firestore (story_word_explanations collection)
        const docRef = db.collection('story_word_explanations').doc(storyId);
        // Clean undefined values before storing
        const cleanedExplanations = removeUndefinedValues(storyExplanations);
        await docRef.set(Object.assign(Object.assign({}, cleanedExplanations), { generatedAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdated: admin.firestore.FieldValue.serverTimestamp() }));
        logger.info('[StoryWordPreGen] Word explanations stored', {
            storyId,
            wordCount: explanations.length,
            collection: 'story_word_explanations',
        });
        const duration = Date.now() - startTime;
        logger.info('[StoryWordPreGen] Story word explanations completed', {
            storyId,
            wordCount: explanations.length,
            durationMs: duration,
            estimatedCost: totalCost.toFixed(4),
        });
        return storyExplanations;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger.error('[StoryWordPreGen] Story word explanations failed', {
            storyId,
            error: error instanceof Error ? error.message : 'Unknown error',
            durationMs: duration,
        });
        throw error;
    }
}
//# sourceMappingURL=storyWordExplanationPreGenerator.js.map