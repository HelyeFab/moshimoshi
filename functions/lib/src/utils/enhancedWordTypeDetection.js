"use strict";
/**
 * Enhanced Word Type Detection Integration
 * Bridges the conjugation word type detector with existing vocabulary systems
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhanceWordWithType = enhanceWordWithType;
exports.enhanceWordsWithTypes = enhanceWordsWithTypes;
exports.filterConjugatableWords = filterConjugatableWords;
exports.groupWordsByConjugationType = groupWordsByConjugationType;
exports.getVerbEnding = getVerbEnding;
exports.needsSpecialConjugation = needsSpecialConjugation;
exports.smartDetectWordType = smartDetectWordType;
exports.migrateVocabularyTypes = migrateVocabularyTypes;
exports.validateTypeDetection = validateTypeDetection;
const wordTypeDetector_1 = require("@/lib/conjugation/wordTypeDetector");
/**
 * Enhance a word with accurate type detection
 */
function enhanceWordWithType(word) {
    // Use our advanced detector
    const detection = (0, wordTypeDetector_1.detectWordTypeWithContext)(word.kanji || word.kana, word.kana, word.partsOfSpeech, word.meaning);
    // Map the detection result to our enhanced word
    const enhanced = Object.assign(Object.assign({}, word), { type: detection.baseType, conjugationType: detection.conjugationType, isConjugatable: detection.isConjugatable, typeConfidence: detection.confidence });
    // Add specific verb type if applicable
    if (detection.conjugationType === 'Ichidan' ||
        detection.conjugationType === 'Godan' ||
        detection.conjugationType === 'Irregular') {
        enhanced.verbType = detection.conjugationType;
    }
    return enhanced;
}
/**
 * Batch enhance multiple words
 */
function enhanceWordsWithTypes(words) {
    return words.map(word => enhanceWordWithType(word));
}
/**
 * Filter words that can be conjugated
 */
function filterConjugatableWords(words) {
    return enhanceWordsWithTypes(words).filter(word => word.isConjugatable);
}
/**
 * Group words by their conjugation type
 */
function groupWordsByConjugationType(words) {
    const enhanced = enhanceWordsWithTypes(words);
    const groups = {
        'Ichidan': [],
        'Godan': [],
        'Irregular': [],
        'i-adjective': [],
        'na-adjective': [],
        'non-conjugatable': []
    };
    enhanced.forEach(word => {
        if (word.conjugationType) {
            groups[word.conjugationType].push(word);
        }
        else {
            groups['non-conjugatable'].push(word);
        }
    });
    return groups;
}
/**
 * Get verb ending for Godan classification
 */
function getVerbEnding(word, reading) {
    const checkWord = reading || word;
    return checkWord.slice(-1);
}
/**
 * Determine if a word needs special conjugation handling
 */
function needsSpecialConjugation(word) {
    // Special cases that need extra attention
    if (word.verbType === 'Irregular')
        return true;
    // 行く has special te-form despite being Godan
    if ((word.kanji === '行く' || word.kana === 'いく') && word.verbType === 'Godan') {
        return true;
    }
    // Godan る verbs might need special attention
    if (word.verbType === 'Godan' && getVerbEnding(word.kanji || word.kana).endsWith('る')) {
        return true;
    }
    return false;
}
/**
 * Smart type detection for vocabulary import
 * This function should be used when importing vocabulary from various sources
 */
function smartDetectWordType(word, reading, partsOfSpeech, meaning, source) {
    // Apply source-specific adjustments
    let adjustedPOS = partsOfSpeech;
    if (source === 'wanikani') {
        // WaniKani uses different POS conventions
        // Map them to JMdict equivalents
        adjustedPOS = partsOfSpeech === null || partsOfSpeech === void 0 ? void 0 : partsOfSpeech.map(pos => {
            const mapping = {
                'intransitive verb': 'vi',
                'transitive verb': 'vt',
                'する verb': 'vs',
                'godan verb': 'v5',
                'ichidan verb': 'v1',
                'い adjective': 'adj-i',
                'な adjective': 'adj-na',
            };
            return mapping[pos.toLowerCase()] || pos;
        });
    }
    return (0, wordTypeDetector_1.detectWordTypeWithContext)(word, reading, adjustedPOS, meaning);
}
/**
 * Migration helper: Update existing vocabulary with proper types
 */
async function migrateVocabularyTypes(vocabulary) {
    console.log(`Migrating types for ${vocabulary.length} words...`);
    const enhanced = vocabulary.map((word, index) => {
        // Show progress for large datasets
        if (index % 100 === 0) {
            console.log(`Processing word ${index + 1}/${vocabulary.length}`);
        }
        return enhanceWordWithType(word);
    });
    // Log statistics
    const stats = {
        total: enhanced.length,
        ichidan: enhanced.filter(w => w.verbType === 'Ichidan').length,
        godan: enhanced.filter(w => w.verbType === 'Godan').length,
        irregular: enhanced.filter(w => w.verbType === 'Irregular').length,
        iAdjective: enhanced.filter(w => w.conjugationType === 'i-adjective').length,
        naAdjective: enhanced.filter(w => w.conjugationType === 'na-adjective').length,
        conjugatable: enhanced.filter(w => w.isConjugatable).length,
        nonConjugatable: enhanced.filter(w => !w.isConjugatable).length,
    };
    console.log('Migration complete:', stats);
    return enhanced;
}
/**
 * Validate conjugation type detection
 * Useful for debugging and testing
 */
function validateTypeDetection(word, expectedType) {
    const detection = (0, wordTypeDetector_1.detectWordTypeWithContext)(word.kanji || word.kana, word.kana, word.partsOfSpeech, word.meaning);
    const isValid = detection.conjugationType === expectedType;
    return {
        isValid,
        message: isValid
            ? `✓ Correctly detected as ${expectedType}`
            : `✗ Expected ${expectedType}, got ${detection.conjugationType}`,
        detection
    };
}
//# sourceMappingURL=enhancedWordTypeDetection.js.map