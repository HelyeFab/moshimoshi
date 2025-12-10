"use strict";
/**
 * Word Explanation Pre-Generator for News Articles
 * Pre-generates comprehensive word explanations for top vocabulary words
 * Stores in Firestore for instant retrieval by frontend
 *
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWordExplanations = generateWordExplanations;
exports.generateArticleWordExplanations = generateArticleWordExplanations;
exports.storeArticleWordExplanations = storeArticleWordExplanations;
exports.generateBatchWordExplanations = generateBatchWordExplanations;
exports.getCachedWordExplanations = getCachedWordExplanations;
exports.getWordExplanation = getWordExplanation;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const params_1 = require("firebase-functions/params");
// Initialize Firestore
const db = admin.firestore();
// Define Modal API key for Qwen 2.5 access
const MODAL_API_KEY = (0, params_1.defineSecret)('MODAL_API_KEY');
// Qwen 2.5 configuration via Modal Ollama
const QWEN_CONFIG = {
    baseUrl: 'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run',
    model: 'qwen2.5:32b',
    timeout: 300000, // 5 minutes for 32B model
};
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
                'X-API-Key': MODAL_API_KEY.value(),
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
 * Generate explanation for a single word using Qwen 2.5
 */
async function generateWordExplanation(word, context) {
    const systemPrompt = `You are an expert Japanese language dictionary and teacher specializing in comprehensive word explanations.

Your role is to provide detailed, educational word explanations for N5-N3 level students.

EXPLANATION REQUIREMENTS:
1. Basic Definition: Clear translation and meaning
2. Kanji Breakdown: For words with kanji, break down each character with kun/on readings
3. Conjugation Table: For verbs and adjectives, provide conjugation patterns
4. Related Words: Synonyms, antonyms, and compound words
5. JLPT Level: Classify the word's JLPT level
6. Usage Notes: Explain when and how to use the word
7. Examples: Provide 2-3 example sentences showing the word in context

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "word": "The original Japanese word",
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
    const userPrompt = `Provide a comprehensive explanation for this Japanese word:

"${word.word}"

${context ? `Context where this word appears:\n"${context}"\n\n` : ''}
${word.estimatedJLPT ? `Estimated JLPT Level: ${word.estimatedJLPT}\n` : ''}
Word frequency in article: ${word.frequency}

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
        logger.error('[WordExplanationPreGen] Error generating explanation with Qwen', {
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
async function generateWordExplanations(words, articleContext) {
    const startTime = Date.now();
    logger.info('[WordExplanationPreGen] Starting word explanation generation', {
        wordCount: words.length,
    });
    const explanations = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    for (const word of words) {
        try {
            const { explanation, usage } = await generateWordExplanation(word, articleContext);
            explanations.push(explanation);
            totalPromptTokens += usage.promptTokens;
            totalCompletionTokens += usage.completionTokens;
            totalTokens += usage.totalTokens;
            logger.debug('[WordExplanationPreGen] Word explanation generated', {
                word: word.word,
                meaning: explanation.meaning,
                tokensUsed: usage.totalTokens,
            });
        }
        catch (error) {
            logger.error('[WordExplanationPreGen] Failed to generate explanation for word', {
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
    logger.info('[WordExplanationPreGen] Word explanation generation completed', {
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
 * Generate and store word explanations for an article
 */
async function generateArticleWordExplanations(articleId, words, articleContext) {
    const startTime = Date.now();
    logger.info('[WordExplanationPreGen] Starting article word explanations', {
        articleId,
        wordCount: words.length,
    });
    try {
        // Generate explanations for all words
        const { explanations, totalCost, totalTokens } = await generateWordExplanations(words, articleContext);
        // Calculate token breakdown (rough estimate)
        const promptTokens = Math.floor(totalTokens * 0.4);
        const completionTokens = totalTokens - promptTokens;
        const articleExplanations = {
            articleId,
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
        const duration = Date.now() - startTime;
        logger.info('[WordExplanationPreGen] Article word explanations completed', {
            articleId,
            wordCount: explanations.length,
            durationMs: duration,
            estimatedCost: totalCost.toFixed(4),
        });
        return articleExplanations;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger.error('[WordExplanationPreGen] Article word explanations failed', {
            articleId,
            error: error instanceof Error ? error.message : 'Unknown error',
            durationMs: duration,
        });
        throw error;
    }
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
 * Store article word explanations in Firestore
 */
async function storeArticleWordExplanations(explanations) {
    try {
        const docRef = db.collection('news_article_word_explanations').doc(explanations.articleId);
        // Clean undefined values before storing (Firestore doesn't accept undefined)
        const cleanedExplanations = removeUndefinedValues(explanations);
        await docRef.set(Object.assign(Object.assign({}, cleanedExplanations), { generatedAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdated: admin.firestore.FieldValue.serverTimestamp() }));
        logger.info('[WordExplanationPreGen] Word explanations stored', {
            articleId: explanations.articleId,
            wordCount: explanations.wordCount,
            collection: 'news_article_word_explanations',
        });
    }
    catch (error) {
        logger.error('[WordExplanationPreGen] Failed to store word explanations', {
            articleId: explanations.articleId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
/**
 * Generate and store word explanations for multiple articles (batch)
 */
async function generateBatchWordExplanations(articles) {
    const startTime = Date.now();
    logger.info('[WordExplanationPreGen] Starting batch word explanation generation', {
        articleCount: articles.length,
        totalWords: articles.reduce((sum, a) => sum + a.words.length, 0),
    });
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    let totalCost = 0;
    let totalWords = 0;
    for (const article of articles) {
        try {
            // Generate word explanations
            const explanations = await generateArticleWordExplanations(article.id, article.words, article.content.substring(0, 500) // Use first 500 chars as context
            );
            // Store in Firestore
            await storeArticleWordExplanations(explanations);
            // Track success
            results.push({
                articleId: article.id,
                success: true,
                explanations,
            });
            successCount++;
            totalCost += explanations.costInfo.estimatedCost;
            totalWords += explanations.wordCount;
            logger.info('[WordExplanationPreGen] Article word explanations completed', {
                articleId: article.id,
                wordCount: explanations.wordCount,
                successCount,
                remainingArticles: articles.length - successCount - failureCount,
            });
        }
        catch (error) {
            // Track failure
            results.push({
                articleId: article.id,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            failureCount++;
            logger.error('[WordExplanationPreGen] Article word explanations failed', {
                articleId: article.id,
                error: error instanceof Error ? error.message : 'Unknown error',
                failureCount,
            });
        }
    }
    const duration = Date.now() - startTime;
    logger.info('[WordExplanationPreGen] Batch word explanation generation completed', {
        total: articles.length,
        successCount,
        failureCount,
        totalWords,
        totalCost: totalCost.toFixed(4),
        durationMs: duration,
        avgTimePerArticle: Math.round(duration / articles.length),
    });
    return {
        successCount,
        failureCount,
        totalCost,
        totalWords,
        results,
    };
}
/**
 * Get cached word explanations for an article
 */
async function getCachedWordExplanations(articleId) {
    try {
        const docRef = db.collection('news_article_word_explanations').doc(articleId);
        const doc = await docRef.get();
        if (doc.exists) {
            return doc.data();
        }
        return null;
    }
    catch (error) {
        logger.error('[WordExplanationPreGen] Error fetching cached word explanations', {
            articleId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
    }
}
/**
 * Get explanation for a specific word (from cache or generate)
 */
async function getWordExplanation(word, articleId) {
    try {
        // Try to find in article cache first
        if (articleId) {
            const articleExplanations = await getCachedWordExplanations(articleId);
            if (articleExplanations) {
                const found = articleExplanations.words.find(w => w.word === word);
                if (found)
                    return found;
            }
        }
        // Try global word cache
        const wordCacheRef = db.collection('word_explanations_cache').doc(word);
        const wordCacheDoc = await wordCacheRef.get();
        if (wordCacheDoc.exists) {
            return wordCacheDoc.data();
        }
        return null;
    }
    catch (error) {
        logger.error('[WordExplanationPreGen] Error fetching word explanation', {
            word,
            articleId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
    }
}
//# sourceMappingURL=wordExplanationPreGenerator.js.map