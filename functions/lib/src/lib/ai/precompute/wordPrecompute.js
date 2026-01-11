"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractJapaneseWords = extractJapaneseWords;
exports.precomputeWordExplanations = precomputeWordExplanations;
const path_1 = __importDefault(require("path"));
const kuromoji_1 = __importDefault(require("kuromoji"));
const AIService_1 = require("../AIService");
const admin_1 = require("@/lib/firebase/admin");
const WordExplanationCache_1 = require("../cache/WordExplanationCache");
const engine_1 = require("@/lib/conjugation/engine");
const enhancedWordTypeDetection_1 = require("@/utils/enhancedWordTypeDetection");
const service_1 = require("@/lib/tts/service");
const COLLECTION_MAP = {
    article: 'news_article_word_explanations',
    book: 'book_word_explanations',
    story: 'story_word_explanations',
    video: 'video_word_explanations',
    comic: 'comic_word_explanations',
};
// Build kuromoji tokenizer once (server-side only)
let tokenizerPromise = null;
async function getTokenizer() {
    if (!tokenizerPromise) {
        tokenizerPromise = new Promise((resolve, reject) => {
            kuromoji_1.default
                .builder({ dicPath: path_1.default.join(process.cwd(), 'node_modules/kuromoji/dict') })
                .build((err, tokenizer) => {
                if (err || !tokenizer) {
                    reject(err || new Error('Failed to build kuromoji tokenizer'));
                    return;
                }
                resolve(tokenizer);
            });
        });
    }
    return tokenizerPromise;
}
/**
 * Generate full conjugations for a word if it's a verb or adjective.
 * Uses the ExtendedConjugationEngine for accurate 100+ form generation.
 */
async function generateFullConjugations(explanation) {
    var _a;
    const pos = ((_a = explanation.partOfSpeech) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
    // Check if word is conjugatable (verb or adjective)
    const isConjugatable = pos.match(/verb|ichidan|godan|suru|する|adjective|形容詞|形容動詞|adj/);
    if (!isConjugatable) {
        return undefined;
    }
    try {
        // Convert to JapaneseWord format for the engine
        const baseWord = {
            id: `precompute-${explanation.word}`,
            kanji: explanation.word,
            kana: explanation.reading,
            romaji: explanation.romaji,
            meaning: explanation.meaning,
            type: undefined,
        };
        // Detect verb type from partOfSpeech
        if (pos.includes('ichidan') || pos.includes('ru-verb') || pos.includes('一段')) {
            baseWord.type = 'Ichidan';
        }
        else if (pos.includes('godan') || pos.includes('u-verb') || pos.includes('五段')) {
            baseWord.type = 'Godan';
        }
        else if (pos.includes('suru') || pos.includes('する') || pos.includes('irregular')) {
            baseWord.type = 'Irregular';
        }
        else if (pos.includes('i-adj') || pos.includes('い-adj') || pos.includes('形容詞')) {
            baseWord.type = 'i-adjective';
        }
        else if (pos.includes('na-adj') || pos.includes('な-adj') || pos.includes('形容動詞')) {
            baseWord.type = 'na-adjective';
        }
        // Use enhanceWordWithType for accurate type detection
        const enhancedWord = (0, enhancedWordTypeDetection_1.enhanceWordWithType)(baseWord);
        if (!enhancedWord.isConjugatable) {
            return undefined;
        }
        // Generate full conjugations
        const conjugations = await engine_1.ExtendedConjugationEngine.conjugate(enhancedWord);
        // Check if we got valid conjugations
        if (!conjugations || !conjugations.present) {
            return undefined;
        }
        // Convert to plain object (strip any class methods)
        const formsObject = {};
        for (const [key, value] of Object.entries(conjugations)) {
            if (typeof value === 'string' && value.trim() !== '') {
                formsObject[key] = value;
            }
        }
        return {
            conjugationType: enhancedWord.conjugationType || enhancedWord.type || 'unknown',
            forms: formsObject,
        };
    }
    catch (error) {
        console.warn('[WordPrecompute] Failed to generate conjugations for:', explanation.word, error);
        return undefined;
    }
}
/**
 * Split text into rough sentences for context extraction
 */
function splitSentences(text) {
    return (text || '')
        .split(/(?<=[。！？!?.\n])/)
        .map(s => s.trim())
        .filter(s => s.length > 3);
}
/**
 * Find the first sentence containing the word
 */
function findContextSentence(word, sentences) {
    if (!word)
        return undefined;
    return sentences.find(sentence => sentence.includes(word));
}
const MAX_CONTEXT_TRANSLATIONS = 40;
// Remove undefined fields to satisfy Firestore
function sanitizeExplanation(explanation) {
    const copy = Object.assign({}, explanation);
    Object.keys(copy).forEach(key => {
        if (copy[key] === undefined) {
            delete copy[key];
        }
    });
    return copy;
}
/**
 * Enrich explanation with context translation and precomputed audio when possible
 */
async function ensureExtras(explanation, word, sentences, translationCache, jlptLevel) {
    var _a;
    // Context sentence + translation
    if (!explanation.contextSentence) {
        explanation.contextSentence = findContextSentence(word, sentences);
    }
    if (explanation.contextSentence && !explanation.contextTranslation) {
        const cachedTranslation = translationCache.get(explanation.contextSentence);
        if (cachedTranslation) {
            explanation.contextTranslation = cachedTranslation;
        }
        else if (translationCache.size < MAX_CONTEXT_TRANSLATIONS) {
            try {
                const aiService = AIService_1.AIService.getInstance();
                const result = await aiService.translateText(explanation.contextSentence, 'learning', {
                    jlptLevel,
                    cacheResults: true,
                });
                if (result.success && ((_a = result.data) === null || _a === void 0 ? void 0 : _a.translatedText)) {
                    translationCache.set(explanation.contextSentence, result.data.translatedText);
                    explanation.contextTranslation = result.data.translatedText;
                }
            }
            catch (err) {
                console.warn('[WordPrecompute] Context translation failed', { word, err });
            }
        }
    }
    // Precompute audio for short words (skip if already present)
    if (!explanation.audioUrl && explanation.word && explanation.word.length <= 12) {
        try {
            const audio = await service_1.ttsService.synthesize(explanation.word, {
                provider: 'voicevox',
                speed: 1.0,
            });
            if (audio === null || audio === void 0 ? void 0 : audio.audioUrl) {
                explanation.audioUrl = audio.audioUrl;
            }
        }
        catch (err) {
            console.warn('[WordPrecompute] Audio synth failed', { word, err });
        }
    }
}
// Basic tokenizer: extracts base forms of ALL words (including particles, grammar, etc.)
async function extractJapaneseWords(text) {
    const tokenizer = await getTokenizer();
    const tokens = tokenizer.tokenize(text || '');
    const words = tokens
        .map(token => token.basic_form || token.surface_form)
        .filter(Boolean)
        .filter(word => word.length > 1); // filter tiny tokens
    // Deduplicate while preserving order
    const seen = new Set();
    const unique = [];
    for (const word of words) {
        const key = word.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(word);
        }
    }
    return unique;
}
/**
 * Precompute word explanations for a piece of content and persist to Firestore.
 * - Tokenizes text to unique words
 * - Reuses global cache when possible
 * - Generates missing words via AIService
 * - Stores merged results in per-content collection
 */
async function precomputeWordExplanations({ contentId, contentType, text, limit = 1000, // Increased from 400 to 1000 for better completeness
jlptLevel = 'N5', chunkIndex, onProgress, }) {
    var _a;
    if (!admin_1.adminFirestore) {
        throw new Error('Firebase Admin not initialized');
    }
    const collection = COLLECTION_MAP[contentType];
    if (!collection) {
        throw new Error(`Unsupported contentType: ${contentType}`);
    }
    // Extract words and apply limit, keeping original order
    const words = (await extractJapaneseWords(text)).slice(0, limit);
    const docRef = admin_1.adminFirestore.collection(collection).doc(contentId);
    const existingSnap = await docRef.get();
    const existingWords = ((_a = existingSnap.data()) === null || _a === void 0 ? void 0 : _a.words) || [];
    const existingSet = new Set(existingWords.map(w => { var _a, _b; return ((_b = (_a = w.word) === null || _a === void 0 ? void 0 : _a.toLowerCase) === null || _b === void 0 ? void 0 : _b.call(_a)) || ''; }).filter(Boolean));
    const missingWords = words.filter(w => !existingSet.has(w.toLowerCase()));
    const aiService = AIService_1.AIService.getInstance();
    const generatedResults = [];
    let cachedCount = 0;
    const sentences = splitSentences(text);
    const translationCache = new Map();
    // Process in order with configurable concurrency
    // Default: 10 (optimal balance of speed and API limits)
    // Range: 3-20 (3=conservative, 10=recommended, 20=aggressive)
    const rawConcurrency = parseInt(process.env.WORD_PRECOMPUTE_CONCURRENCY || '10', 10);
    const concurrency = Math.max(3, Math.min(20, rawConcurrency)); // Clamp to safe range
    console.log(`[WordPrecompute] Using concurrency: ${concurrency} (env: ${process.env.WORD_PRECOMPUTE_CONCURRENCY || 'default'})`);
    let index = 0;
    let conjugationsGenerated = 0;
    while (index < missingWords.length) {
        const slice = missingWords.slice(index, index + concurrency);
        const results = await Promise.all(slice.map(async (word, sliceIndex) => {
            const globalIndex = index + sliceIndex;
            try {
                const cached = await (0, WordExplanationCache_1.getCachedWordExplanation)(word);
                if (cached) {
                    cachedCount += 1;
                    await ensureExtras(cached, word, sentences, translationCache, jlptLevel);
                    // If cached but missing fullConjugations, generate them now
                    if (!cached.fullConjugations) {
                        const fullConjugations = await generateFullConjugations(cached);
                        if (fullConjugations) {
                            cached.fullConjugations = fullConjugations;
                            conjugationsGenerated += 1;
                            // Update cache with conjugations
                            await (0, WordExplanationCache_1.setCachedWordExplanation)(word, cached);
                        }
                    }
                    // Call progress callback on success
                    if (onProgress) {
                        await onProgress(globalIndex + 1, missingWords.length, word, 'success');
                    }
                    return cached;
                }
                const aiResponse = await aiService.explainWord({ word }, { jlptLevel });
                if (!aiResponse.success || !aiResponse.data) {
                    throw new Error(aiResponse.error || `Failed to generate explanation for ${word}`);
                }
                const explanation = aiResponse.data;
                // Generate full conjugations for verbs/adjectives
                const fullConjugations = await generateFullConjugations(explanation);
                if (fullConjugations) {
                    explanation.fullConjugations = fullConjugations;
                    conjugationsGenerated += 1;
                }
                await ensureExtras(explanation, word, sentences, translationCache, jlptLevel);
                await (0, WordExplanationCache_1.setCachedWordExplanation)(word, explanation);
                // Call progress callback on success
                if (onProgress) {
                    await onProgress(globalIndex + 1, missingWords.length, word, 'success');
                }
                return explanation;
            }
            catch (error) {
                // Call progress callback on failure
                if (onProgress) {
                    await onProgress(globalIndex + 1, missingWords.length, word, 'failed');
                }
                console.error(`[WordPrecompute] Failed to process word: ${word}`, error);
                return null; // Continue processing other words
            }
        }));
        generatedResults.push(...results.filter(r => r !== null));
        index += concurrency;
    }
    console.log(`[WordPrecompute] Generated ${conjugationsGenerated} full conjugation tables`);
    const merged = [...existingWords, ...generatedResults].map(sanitizeExplanation);
    // Firestore document size limit is 1MB
    // Estimated size: ~500 bytes per word explanation
    // 1000 words ≈ 500KB, well within limit
    if (merged.length > 1000) {
        console.warn(`[WordPrecompute] Large word count detected (${merged.length}). ` +
            `May approach Firestore 1MB document limit. Consider implementing sharding.`);
    }
    await docRef.set(Object.assign({ words: merged, wordCount: merged.length, updatedAt: admin_1.Timestamp.now(), source: 'precompute' }, (typeof chunkIndex === 'number' ? { chunkIndex } : {})), { merge: true });
    return {
        contentId,
        contentType,
        generated: generatedResults.length - cachedCount,
        cached: cachedCount,
        skipped: existingWords.length,
        total: merged.length,
    };
}
//# sourceMappingURL=wordPrecompute.js.map