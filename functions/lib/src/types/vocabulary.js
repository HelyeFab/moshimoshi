"use strict";
/**
 * Vocabulary Types
 * Types for Japanese words, verbs, adjectives, and other vocabulary items
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDrillable = isDrillable;
exports.getRecommendedListType = getRecommendedListType;
exports.hasKanji = hasKanji;
/**
 * Helper function to determine if a word is drillable (verb or adjective)
 */
function isDrillable(word) {
    if (!word.type)
        return false;
    const drillableTypes = ['verb', 'i-adjective', 'na-adjective', 'Ichidan', 'Godan', 'Irregular'];
    // Check if type matches any drillable type
    if (drillableTypes.includes(word.type)) {
        return true;
    }
    // Also check parts of speech
    if (word.partsOfSpeech) {
        const posLower = word.partsOfSpeech.map(pos => pos.toLowerCase()).join(' ');
        return posLower.includes('verb') ||
            posLower.includes('adjective') ||
            posLower.includes('ichidan') ||
            posLower.includes('godan');
    }
    return false;
}
/**
 * Determine the appropriate list type for a word
 */
function getRecommendedListType(word) {
    return isDrillable(word) ? 'drillable' : 'flashcard';
}
/**
 * Check if word contains kanji characters
 */
function hasKanji(text) {
    const kanjiRegex = /[\u4e00-\u9faf\u3400-\u4dbf]/;
    return kanjiRegex.test(text);
}
//# sourceMappingURL=vocabulary.js.map