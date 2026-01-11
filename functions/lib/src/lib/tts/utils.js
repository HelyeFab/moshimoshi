"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeText = normalizeText;
exports.generateCacheKey = generateCacheKey;
exports.getTextType = getTextType;
exports.selectProvider = selectProvider;
exports.isSingleCharacter = isSingleCharacter;
exports.isKanaOnly = isKanaOnly;
exports.containsKanji = containsKanji;
exports.validateText = validateText;
exports.estimateDuration = estimateDuration;
exports.generateStoragePath = generateStoragePath;
exports.parseTTSOptions = parseTTSOptions;
exports.formatFileSize = formatFileSize;
exports.batchTextsByProvider = batchTextsByProvider;
exports.createTTSError = createTTSError;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Normalize text for consistent caching
 */
function normalizeText(text) {
    return text
        .trim()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[\u3000]/g, ' ') // Replace full-width space
        .normalize('NFC'); // Normalize Unicode
}
/**
 * Generate cache key for text
 */
function generateCacheKey(text, provider, voice, options) {
    var _a, _b, _c;
    const normalized = normalizeText(text);
    const speed = (_a = options === null || options === void 0 ? void 0 : options.speed) !== null && _a !== void 0 ? _a : 0.75;
    const pitch = (_b = options === null || options === void 0 ? void 0 : options.pitch) !== null && _b !== void 0 ? _b : 0;
    const volume = (_c = options === null || options === void 0 ? void 0 : options.volume) !== null && _c !== void 0 ? _c : 1;
    const input = `${provider}:${voice}:s${speed}:p${pitch}:v${volume}:${normalized}`;
    return crypto_1.default.createHash('md5').update(input).digest('hex');
}
/**
 * Determine text type based on content
 */
function getTextType(text) {
    const length = text.length;
    if (length === 1)
        return 'character';
    if (length < 10)
        return 'word';
    if (length < 50)
        return 'sentence';
    if (length < 500)
        return 'paragraph';
    return 'article';
}
/**
 * Auto-select provider based on text
 * Primary: VOICEVOX
 * Fallback: ElevenLabs
 */
function selectProvider(text) {
    // Always use VOICEVOX as primary - highest quality for Japanese
    // ElevenLabs is only used as fallback when VOICEVOX fails
    return 'voicevox';
}
/**
 * Check if text is a single Japanese character
 */
function isSingleCharacter(text) {
    if (text.length !== 1)
        return false;
    const code = text.charCodeAt(0);
    // Hiragana: U+3040 - U+309F
    // Katakana: U+30A0 - U+30FF
    // Kanji: U+4E00 - U+9FAF
    return ((code >= 0x3040 && code <= 0x309f) ||
        (code >= 0x30a0 && code <= 0x30ff) ||
        (code >= 0x4e00 && code <= 0x9faf));
}
/**
 * Check if text contains only kana
 */
function isKanaOnly(text) {
    return /^[\u3040-\u309F\u30A0-\u30FF\s]+$/.test(text);
}
/**
 * Check if text contains kanji
 */
function containsKanji(text) {
    return /[\u4E00-\u9FAF]/.test(text);
}
/**
 * Validate text for TTS
 */
function validateText(text) {
    var _a;
    if (!text || text.trim().length === 0) {
        return { valid: false, error: 'Text is empty' };
    }
    if (text.length > 5000) {
        return { valid: false, error: 'Text exceeds maximum length (5000 characters)' };
    }
    // Check for valid Japanese or English characters
    // Include: Hiragana, Katakana, Kanji, ASCII, Japanese punctuation, full-width chars, and special marks
    const validPattern = /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u0020-\u007E\u3000-\u303F\uFF00-\uFFEF\s\n\r！-～。、「」『』（）・々〜ー【】〔〕…※＊％°—–−]+$/;
    if (!validPattern.test(text)) {
        console.warn('[TTS Validation] Invalid characters found in text:', text.substring(0, 100) + '...');
        console.warn('[TTS Validation] First invalid char code:', (_a = text
            .split('')
            .find(char => !validPattern.test(char))) === null || _a === void 0 ? void 0 : _a.charCodeAt(0));
        return {
            valid: false,
            error: 'Text contains invalid characters. Please check for special symbols or formatting.',
        };
    }
    return { valid: true };
}
/**
 * Calculate estimated audio duration (rough estimate)
 */
function estimateDuration(text, speed = 1.0) {
    // Rough estimate: ~150 characters per minute for Japanese
    const charsPerSecond = 2.5 / speed;
    return Math.ceil(text.length / charsPerSecond);
}
/**
 * Generate storage path for audio file
 */
function generateStoragePath(provider, cacheKey) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `tts/${provider}/${year}/${month}/${cacheKey}.mp3`;
}
/**
 * Parse TTS options with defaults
 */
function parseTTSOptions(options) {
    const defaults = {
        provider: 'auto',
        speed: 0.85,
        pitch: undefined,
        volume: 1.0,
        voice: undefined,
    };
    if (!options)
        return defaults;
    return {
        provider: options.provider || defaults.provider,
        speed: Math.max(0.5, Math.min(2.0, options.speed || defaults.speed)),
        pitch: options.pitch, // Optional - not used by VOICEVOX
        volume: Math.max(0, Math.min(1, options.volume || defaults.volume)),
        voice: options.voice,
    };
}
/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
/**
 * Batch texts by provider for efficient processing
 */
function batchTextsByProvider(texts) {
    const batches = {
        voicevox: [],
        elevenlabs: [],
    };
    texts.forEach(text => {
        const provider = selectProvider(text);
        batches[provider].push(text);
    });
    return batches;
}
/**
 * Create error response
 */
function createTTSError(code, message, provider, retryable = false) {
    return {
        code,
        message,
        provider,
        retryable,
    };
}
//# sourceMappingURL=utils.js.map