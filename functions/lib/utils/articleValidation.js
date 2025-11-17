"use strict";
/**
 * Article validation utilities for news scraping
 * Provides quick validation and AI-enhanced validation for Japanese articles
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLikelyJapanese = isLikelyJapanese;
exports.quickValidate = quickValidate;
exports.filterArticles = filterArticles;
exports.checkDuplicates = checkDuplicates;
exports.estimateDifficulty = estimateDifficulty;
exports.estimateReadingTime = estimateReadingTime;
exports.extractKeyVocabulary = extractKeyVocabulary;
/**
 * Check if text contains enough Japanese characters to be considered a Japanese article
 */
function isLikelyJapanese(text) {
    if (!text || typeof text !== 'string' || text.length < 50) {
        return false;
    }
    // Regex patterns for different character sets
    const japanesePatterns = {
        hiragana: /[\u3040-\u309F]/g,
        katakana: /[\u30A0-\u30FF]/g,
        kanji: /[\u4E00-\u9FAF]/g,
        japanesePunctuation: /[。、！？「」『』（）]/g
    };
    // Count Japanese characters
    const hiraganaCount = (text.match(japanesePatterns.hiragana) || []).length;
    const katakanaCount = (text.match(japanesePatterns.katakana) || []).length;
    const kanjiCount = (text.match(japanesePatterns.kanji) || []).length;
    const japanesePunctuationCount = (text.match(japanesePatterns.japanesePunctuation) || []).length;
    const totalJapaneseChars = hiraganaCount + katakanaCount + kanjiCount + japanesePunctuationCount;
    // Remove all whitespace for accurate character counting
    const textNoSpaces = text.replace(/\s/g, '');
    const totalChars = textNoSpaces.length;
    // Calculate Japanese character ratio
    const japaneseRatio = totalJapaneseChars / totalChars;
    // Article is considered Japanese if:
    // 1. Has at least 30% Japanese characters
    // 2. Has at least some hiragana (every Japanese text has hiragana)
    return japaneseRatio > 0.3 && hiraganaCount > 0;
}
/**
 * Quick validation for article content
 */
function quickValidate(article) {
    const { content, title } = article;
    // Check if content exists
    if (!content || content.trim().length < 50) {
        return {
            passed: false,
            reason: 'Content too short or missing',
            shouldSave: false,
            japaneseRatio: 0,
            visible: false
        };
    }
    // Calculate precise Japanese ratio
    const japanesePatterns = {
        hiragana: /[\u3040-\u309F]/g,
        katakana: /[\u30A0-\u30FF]/g,
        kanji: /[\u4E00-\u9FAF]/g,
        japanesePunct: /[。、「」『』・]/g
    };
    const hiraganaMatches = (content.match(japanesePatterns.hiragana) || []).length;
    const katakanaMatches = (content.match(japanesePatterns.katakana) || []).length;
    const kanjiMatches = (content.match(japanesePatterns.kanji) || []).length;
    const punctMatches = (content.match(japanesePatterns.japanesePunct) || []).length;
    const totalJapanese = hiraganaMatches + katakanaMatches + kanjiMatches + punctMatches;
    const totalChars = content.replace(/\s/g, '').length;
    const japaneseRatio = totalChars > 0 ? (totalJapanese / totalChars) : 0;
    // Check for common scraping errors
    const errorPatterns = [
        /page not found/i,
        /404 error/i,
        /access denied/i,
        /please enable javascript/i,
        /please enable cookies/i,
        /cloudflare/i,
        /robot check/i,
        /captcha/i,
        /please try again/i,
        /temporarily unavailable/i
    ];
    for (const pattern of errorPatterns) {
        if (pattern.test(content) || pattern.test(title)) {
            return {
                passed: false,
                reason: `Detected error pattern: ${pattern}`,
                shouldSave: false,
                japaneseRatio,
                visible: false
            };
        }
    }
    // Check for minimum Japanese content
    if (japaneseRatio < 0.3) {
        return {
            passed: false,
            reason: `Insufficient Japanese content: ${(japaneseRatio * 100).toFixed(1)}%`,
            shouldSave: false,
            japaneseRatio,
            visible: false
        };
    }
    // Check for minimum hiragana (every real Japanese text has hiragana)
    if (hiraganaMatches < 10) {
        return {
            passed: false,
            reason: 'Insufficient hiragana characters',
            shouldSave: false,
            japaneseRatio,
            visible: false
        };
    }
    // Determine visibility based on quality thresholds
    const visible = japaneseRatio > 0.5 && content.length > 200;
    // Quality score based on multiple factors
    const quality = Math.min(100, Math.round((japaneseRatio * 50) + // Japanese ratio contributes 50%
        (Math.min(content.length / 40, 30)) + // Length contributes up to 30%
        (hiraganaMatches > 50 ? 20 : hiraganaMatches / 2.5) // Hiragana count contributes 20%
    ));
    return {
        passed: true,
        shouldSave: true,
        japaneseRatio,
        visible,
        quality
    };
}
/**
 * Filter and validate multiple articles
 */
function filterArticles(articles) {
    const valid = [];
    const rejected = [];
    for (const article of articles) {
        const validation = quickValidate(article);
        if (validation.passed) {
            valid.push(article);
        }
        else {
            rejected.push({
                article,
                reason: validation.reason || 'Failed validation'
            });
        }
    }
    console.log(`[Article Validation] ${valid.length} valid, ${rejected.length} rejected out of ${articles.length} total`);
    return { valid, rejected };
}
/**
 * Check for duplicate articles based on content similarity
 */
function checkDuplicates(articles) {
    const seen = new Map();
    const unique = [];
    for (const article of articles) {
        // Create a fingerprint based on title and first 200 chars of content
        const fingerprint = `${article.title.toLowerCase().trim()}::${article.content.substring(0, 200).toLowerCase().trim()}`;
        if (!seen.has(fingerprint)) {
            seen.set(fingerprint, article);
            unique.push(article);
        }
        else {
            console.log(`[Duplicate Detection] Found duplicate: ${article.title}`);
        }
    }
    return unique;
}
/**
 * Estimate reading difficulty based on character composition
 */
function estimateDifficulty(content) {
    const kanjiCount = (content.match(/[\u4E00-\u9FAF]/g) || []).length;
    const totalChars = content.replace(/\s/g, '').length;
    const kanjiRatio = kanjiCount / totalChars;
    // Simple difficulty estimation based on kanji density
    if (kanjiRatio < 0.1)
        return 'N5'; // Very few kanji
    if (kanjiRatio < 0.2)
        return 'N4'; // Some kanji
    if (kanjiRatio < 0.3)
        return 'N3'; // Moderate kanji
    if (kanjiRatio < 0.4)
        return 'N2'; // Many kanji
    return 'N1'; // Dense kanji
}
/**
 * Calculate estimated reading time for Japanese text
 * Japanese reading speed is typically 400-600 characters per minute for native speakers
 * For learners, we use 200-300 characters per minute
 */
function estimateReadingTime(content, difficulty) {
    const charCount = content.replace(/\s/g, '').length;
    // Adjust reading speed based on difficulty
    const charsPerMinute = {
        'N5': 200, // Beginner
        'N4': 250,
        'N3': 300,
        'N2': 350,
        'N1': 400 // Advanced
    };
    const speed = charsPerMinute[difficulty] || 300;
    return Math.ceil(charCount / speed);
}
/**
 * Extract key vocabulary from article for learning purposes
 * This is a simple version - can be enhanced with AI processing
 */
function extractKeyVocabulary(content, limit = 10) {
    // Extract words in kanji + kana combinations
    const wordPattern = /[\u4E00-\u9FAF]+[\u3040-\u309F\u30A0-\u30FF]*|[\u30A0-\u30FF]{3,}/g;
    const words = content.match(wordPattern) || [];
    // Count frequency
    const frequency = new Map();
    for (const word of words) {
        if (word.length >= 2) { // Skip single characters
            frequency.set(word, (frequency.get(word) || 0) + 1);
        }
    }
    // Sort by frequency and return top words
    const sorted = Array.from(frequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([word]) => word);
    return sorted;
}
//# sourceMappingURL=articleValidation.js.map