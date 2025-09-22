import crypto from 'crypto';
import { TTSProvider, TTSTextType } from './types';
import { PROVIDER_THRESHOLDS } from './config';

/**
 * Normalize text for consistent caching
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[\u3000]/g, ' ') // Replace full-width space
    .normalize('NFC'); // Normalize Unicode
}

/**
 * Generate cache key for text
 */
export function generateCacheKey(
  text: string,
  provider: TTSProvider,
  voice: string
): string {
  const normalized = normalizeText(text);
  const input = `${provider}:${voice}:${normalized}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

/**
 * Determine text type based on content
 */
export function getTextType(text: string): TTSTextType {
  const length = text.length;
  
  if (length === 1) return 'character';
  if (length < 10) return 'word';
  if (length < 50) return 'sentence';
  if (length < 500) return 'paragraph';
  return 'article';
}

/**
 * Auto-select provider based on text
 */
export function selectProvider(text: string): TTSProvider {
  const normalizedText = normalizeText(text);

  // Use Google for short text or single characters
  if (normalizedText.length < PROVIDER_THRESHOLDS.characterLimit) {
    return 'google';
  }

  // Check if text is single kana or kanji
  if (isSingleCharacter(normalizedText)) {
    return 'google';
  }

  // Use ElevenLabs for longer content
  return 'elevenlabs';
}

/**
 * Check if text is a single Japanese character
 */
export function isSingleCharacter(text: string): boolean {
  if (text.length !== 1) return false;
  
  const code = text.charCodeAt(0);
  
  // Hiragana: U+3040 - U+309F
  // Katakana: U+30A0 - U+30FF
  // Kanji: U+4E00 - U+9FAF
  return (
    (code >= 0x3040 && code <= 0x309F) ||
    (code >= 0x30A0 && code <= 0x30FF) ||
    (code >= 0x4E00 && code <= 0x9FAF)
  );
}

/**
 * Check if text contains only kana
 */
export function isKanaOnly(text: string): boolean {
  return /^[\u3040-\u309F\u30A0-\u30FF\s]+$/.test(text);
}

/**
 * Check if text contains kanji
 */
export function containsKanji(text: string): boolean {
  return /[\u4E00-\u9FAF]/.test(text);
}

/**
 * Validate text for TTS
 */
export function validateText(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Text is empty' };
  }
  
  if (text.length > 5000) {
    return { valid: false, error: 'Text exceeds maximum length (5000 characters)' };
  }
  
  // Check for valid Japanese or English characters
  // Include: Hiragana, Katakana, Kanji, ASCII, Japanese punctuation, and special marks
  const validPattern = /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u0020-\u007E\s\n\r！-～。、「」『』（）・々〜ー【】〔〕…※＊]+$/;
  if (!validPattern.test(text)) {
    return { valid: false, error: 'Text contains invalid characters' };
  }
  
  return { valid: true };
}

/**
 * Calculate estimated audio duration (rough estimate)
 */
export function estimateDuration(text: string, speed: number = 1.0): number {
  // Rough estimate: ~150 characters per minute for Japanese
  const charsPerSecond = 2.5 / speed;
  return Math.ceil(text.length / charsPerSecond);
}

/**
 * Generate storage path for audio file
 */
export function generateStoragePath(
  provider: TTSProvider,
  cacheKey: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  return `tts/${provider}/${year}/${month}/${cacheKey}.mp3`;
}

/**
 * Parse TTS options with defaults
 */
export function parseTTSOptions(options?: any) {
  const defaults = {
    provider: 'auto' as const,
    speed: 1.0,
    pitch: 0,
    volume: 1.0,
  };
  
  if (!options) return defaults;
  
  return {
    provider: options.provider || defaults.provider,
    speed: Math.max(0.5, Math.min(2.0, options.speed || defaults.speed)),
    pitch: Math.max(-20, Math.min(20, options.pitch || defaults.pitch)),
    volume: Math.max(0, Math.min(1, options.volume || defaults.volume)),
    voice: options.voice,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Batch texts by provider for efficient processing
 */
export function batchTextsByProvider(
  texts: string[]
): { google: string[]; elevenlabs: string[] } {
  const batches = {
    google: [] as string[],
    elevenlabs: [] as string[],
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
export function createTTSError(
  code: string,
  message: string,
  provider?: TTSProvider,
  retryable: boolean = false
) {
  return {
    code,
    message,
    provider,
    retryable,
  };
}