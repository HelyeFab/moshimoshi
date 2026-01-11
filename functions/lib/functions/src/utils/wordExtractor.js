"use strict";
/**
 * Word Extractor Utility - KUROMOJI VERSION
 * Extracts Japanese words from article content using proper tokenization
 * Uses Kuromoji for accurate word boundary detection
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
exports.extractTopWords = extractTopWords;
exports.extractWordsFromArticles = extractWordsFromArticles;
const logger = __importStar(require("firebase-functions/logger"));
const kuromoji_1 = __importDefault(require("kuromoji"));
const path_1 = __importDefault(require("path"));
// Build kuromoji tokenizer once (server-side only)
let tokenizerPromise = null;
async function getTokenizer() {
    if (!tokenizerPromise) {
        tokenizerPromise = new Promise((resolve, reject) => {
            // Try multiple possible dictionary paths
            const possiblePaths = [
                path_1.default.join(process.cwd(), 'node_modules/kuromoji/dict'),
                path_1.default.join(process.cwd(), '../node_modules/kuromoji/dict'),
                path_1.default.join(__dirname, '../../node_modules/kuromoji/dict'),
                path_1.default.join(__dirname, '../../../node_modules/kuromoji/dict'),
            ];
            let lastError = null;
            let attemptIndex = 0;
            const tryNextPath = () => {
                if (attemptIndex >= possiblePaths.length) {
                    reject(lastError ||
                        new Error(`Failed to build kuromoji tokenizer. Tried paths: ${possiblePaths.join(', ')}`));
                    return;
                }
                const dicPath = possiblePaths[attemptIndex];
                attemptIndex++;
                kuromoji_1.default.builder({ dicPath }).build((err, tokenizer) => {
                    if (err || !tokenizer) {
                        lastError = err || new Error('Failed to build kuromoji tokenizer');
                        logger.debug('[WordExtractor] Failed with path:', { dicPath, error: err === null || err === void 0 ? void 0 : err.message });
                        tryNextPath();
                        return;
                    }
                    logger.info('[WordExtractor] Kuromoji tokenizer built successfully', { dicPath });
                    resolve(tokenizer);
                });
            };
            tryNextPath();
        });
    }
    return tokenizerPromise;
}
// Common particles to filter out
const COMMON_PARTICLES = new Set([
    'は',
    'が',
    'を',
    'に',
    'へ',
    'と',
    'で',
    'の',
    'や',
    'か',
    'も',
    'から',
    'まで',
    'より',
    'など',
    'ので',
    'のに',
    'ば',
    'たら',
    'けど',
    'けれど',
    'けれども',
    'し',
    'て',
    'た',
    'だ',
    'です',
    'ます',
    'する',
    'いる',
    'ある',
    'なる',
]);
// Common N5 words that don't need explanation
const BASIC_WORDS = new Set([
    'これ',
    'それ',
    'あれ',
    'ここ',
    'そこ',
    'あそこ',
    'どこ',
    'この',
    'その',
    'あの',
    'どの',
    'だれ',
    'なに',
    'なん',
    'はい',
    'いいえ',
    'ええ',
    'うん',
    'ううん',
    'こと',
    'もの',
    'ため',
    'よう',
]);
/**
 * Extract words using Kuromoji tokenizer (proper Japanese NLP)
 */
async function extractJapaneseWordsKuromoji(text) {
    const tokenizer = await getTokenizer();
    const tokens = tokenizer.tokenize(text || '');
    const words = tokens
        .map(token => token.basic_form || token.surface_form)
        .filter(Boolean)
        .filter(word => word.length > 1); // Filter tiny tokens
    return words;
}
/**
 * Extract top N words from article content using Kuromoji tokenization
 */
async function extractTopWords(content, limit = 100) {
    const startTime = Date.now();
    try {
        // Clean and normalize content
        const normalizedContent = normalizeText(content);
        // Extract all Japanese words using Kuromoji
        const wordMatches = await extractJapaneseWordsKuromoji(normalizedContent);
        // Count word frequencies
        const wordFrequency = countWordFrequency(wordMatches);
        // Filter out particles, basic words, and very short words
        const filteredWords = filterWords(wordFrequency);
        // Sort by frequency and importance
        const sortedWords = sortWordsByImportance(filteredWords);
        // Take top N words
        const topWords = sortedWords.slice(0, limit);
        const duration = Date.now() - startTime;
        logger.info('[WordExtractor] Extraction complete (Kuromoji)', {
            totalWordCount: wordMatches.length,
            uniqueWordCount: Object.keys(wordFrequency).length,
            extractedCount: topWords.length,
            durationMs: duration,
        });
        return {
            words: topWords,
            totalWordCount: wordMatches.length,
            uniqueWordCount: Object.keys(wordFrequency).length,
            extractedCount: topWords.length,
        };
    }
    catch (error) {
        logger.error('[WordExtractor] Error extracting words', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return {
            words: [],
            totalWordCount: 0,
            uniqueWordCount: 0,
            extractedCount: 0,
        };
    }
}
/**
 * Normalize text by removing HTML, special characters, etc.
 */
function normalizeText(text) {
    // Remove HTML tags
    let normalized = text.replace(/<[^>]*>/g, ' ');
    // Remove URLs
    normalized = normalized.replace(/https?:\/\/[^\s]+/g, ' ');
    // Remove numbers
    normalized = normalized.replace(/[0-9]+/g, ' ');
    // Remove punctuation but keep Japanese characters
    normalized = normalized.replace(/[.,!?;:()「」『』【】〈〉《》〔〕［］｛｝]/g, ' ');
    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized;
}
/**
 * Count word frequency
 */
function countWordFrequency(words) {
    const frequency = {};
    words.forEach(word => {
        frequency[word] = (frequency[word] || 0) + 1;
    });
    return frequency;
}
/**
 * Filter out particles, basic words, and very short words
 */
function filterWords(wordFrequency) {
    const filtered = {};
    Object.entries(wordFrequency).forEach(([word, count]) => {
        // Skip if too short (less than 2 characters)
        if (word.length < 2)
            return;
        // Skip if it's a common particle
        if (COMMON_PARTICLES.has(word))
            return;
        // Skip if it's a basic word
        if (BASIC_WORDS.has(word))
            return;
        // Skip if it's pure hiragana and very short (likely particle)
        if (word.length <= 2 && /^[\u3040-\u309F]+$/.test(word))
            return;
        filtered[word] = count;
    });
    return filtered;
}
/**
 * Sort words by importance (frequency + character complexity)
 */
function sortWordsByImportance(wordFrequency) {
    const words = [];
    Object.entries(wordFrequency).forEach(([word, frequency]) => {
        const type = determineWordType(word);
        const estimatedJLPT = estimateJLPTLevel(word, type);
        words.push({
            word,
            frequency,
            type,
            estimatedJLPT,
        });
    });
    // Sort by frequency (higher is better)
    words.sort((a, b) => b.frequency - a.frequency);
    return words;
}
/**
 * Determine word type based on characters
 */
function determineWordType(word) {
    const hasKanji = /[\u4E00-\u9FAF\u3400-\u4DBF]/.test(word);
    const hasHiragana = /[\u3040-\u309F]/.test(word);
    const hasKatakana = /[\u30A0-\u30FF]/.test(word);
    if (hasKanji && (hasHiragana || hasKatakana))
        return 'mixed';
    if (hasKanji)
        return 'kanji';
    if (hasHiragana)
        return 'hiragana';
    if (hasKatakana)
        return 'katakana';
    return 'mixed';
}
/**
 * Calculate word importance score
 */
function calculateImportance(word, frequency) {
    let score = frequency;
    // Boost kanji words (more important for learning)
    if (/[\u4E00-\u9FAF]/.test(word)) {
        score *= 1.5;
    }
    // Boost longer words (likely more specific/important)
    if (word.length >= 3) {
        score *= 1.2;
    }
    return score;
}
/**
 * Estimate JLPT level based on word characteristics
 */
function estimateJLPTLevel(word, type) {
    // Pure katakana words are often loanwords (N4-N3)
    if (type === 'katakana') {
        return word.length <= 3 ? 'N4' : 'N3';
    }
    // Pure hiragana words are often basic (N5-N4)
    if (type === 'hiragana') {
        return word.length <= 3 ? 'N5' : 'N4';
    }
    // Kanji words - estimate by length and complexity
    if (type === 'kanji' || type === 'mixed') {
        if (word.length <= 2)
            return 'N5';
        if (word.length === 3)
            return 'N4';
        if (word.length === 4)
            return 'N3';
        return 'N2'; // Longer words are generally more advanced
    }
    return undefined;
}
/**
 * Batch extract words from multiple articles
 */
async function extractWordsFromArticles(articles, limit = 100) {
    // Combine all article content
    const combinedContent = articles.map(a => a.content).join(' ');
    // Extract words
    const result = await extractTopWords(combinedContent, limit);
    return result.words;
}
//# sourceMappingURL=wordExtractor.js.map