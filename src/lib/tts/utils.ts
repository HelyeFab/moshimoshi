import crypto from 'crypto'
import { TTSProvider, TTSTextType } from './types'
import { PROVIDER_THRESHOLDS } from './config'

/**
 * Normalize text for consistent caching
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[\u3000]/g, ' ') // Replace full-width space
    .normalize('NFC') // Normalize Unicode
}

/**
 * Generate cache key for text
 */
export function generateCacheKey(text: string, provider: TTSProvider, voice: string): string {
  const normalized = normalizeText(text)
  const input = `${provider}:${voice}:${normalized}`
  return crypto.createHash('md5').update(input).digest('hex')
}

/**
 * Determine text type based on content
 */
export function getTextType(text: string): TTSTextType {
  const length = text.length

  if (length === 1) return 'character'
  if (length < 10) return 'word'
  if (length < 50) return 'sentence'
  if (length < 500) return 'paragraph'
  return 'article'
}

/**
 * Auto-select provider based on text
 * Priority: Kokoro (Sheldon) → ElevenLabs → Edge-TTS
 */
export function selectProvider(text: string): TTSProvider {
  const normalizedText = normalizeText(text)

  // Use Kokoro TTS for all Japanese content - fastest and highest quality
  // Self-hosted on Sheldon, unlimited usage, optimized for Japanese
  return 'kokoro'

  // Note: Fallback chain in TTSService handles failures:
  // Kokoro → ElevenLabs → Edge-TTS → Google (deprecated)
}

/**
 * Check if text is a single Japanese character
 */
export function isSingleCharacter(text: string): boolean {
  if (text.length !== 1) return false

  const code = text.charCodeAt(0)

  // Hiragana: U+3040 - U+309F
  // Katakana: U+30A0 - U+30FF
  // Kanji: U+4E00 - U+9FAF
  return (
    (code >= 0x3040 && code <= 0x309f) ||
    (code >= 0x30a0 && code <= 0x30ff) ||
    (code >= 0x4e00 && code <= 0x9faf)
  )
}

/**
 * Check if text contains only kana
 */
export function isKanaOnly(text: string): boolean {
  return /^[\u3040-\u309F\u30A0-\u30FF\s]+$/.test(text)
}

/**
 * Check if text contains kanji
 */
export function containsKanji(text: string): boolean {
  return /[\u4E00-\u9FAF]/.test(text)
}

/**
 * Validate text for TTS
 */
export function validateText(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Text is empty' }
  }

  if (text.length > 5000) {
    return { valid: false, error: 'Text exceeds maximum length (5000 characters)' }
  }

  // Check for valid Japanese or English characters
  // Include: Hiragana, Katakana, Kanji, ASCII, Japanese punctuation, full-width chars, and special marks
  const validPattern =
    /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u0020-\u007E\u3000-\u303F\uFF00-\uFFEF\s\n\r！-～。、「」『』（）・々〜ー【】〔〕…※＊％°—–−]+$/
  if (!validPattern.test(text)) {
    console.warn(
      '[TTS Validation] Invalid characters found in text:',
      text.substring(0, 100) + '...'
    )
    console.warn(
      '[TTS Validation] First invalid char code:',
      text
        .split('')
        .find(char => !validPattern.test(char))
        ?.charCodeAt(0)
    )
    return {
      valid: false,
      error: 'Text contains invalid characters. Please check for special symbols or formatting.',
    }
  }

  return { valid: true }
}

/**
 * Calculate estimated audio duration (rough estimate)
 */
export function estimateDuration(text: string, speed: number = 1.0): number {
  // Rough estimate: ~150 characters per minute for Japanese
  const charsPerSecond = 2.5 / speed
  return Math.ceil(text.length / charsPerSecond)
}

/**
 * Generate storage path for audio file
 */
export function generateStoragePath(provider: TTSProvider, cacheKey: string): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `tts/${provider}/${year}/${month}/${cacheKey}.mp3`
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
  }

  if (!options) return defaults

  return {
    provider: options.provider || defaults.provider,
    speed: Math.max(0.5, Math.min(2.0, options.speed || defaults.speed)),
    pitch: Math.max(-20, Math.min(20, options.pitch || defaults.pitch)),
    volume: Math.max(0, Math.min(1, options.volume || defaults.volume)),
    voice: options.voice,
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Batch texts by provider for efficient processing
 */
export function batchTextsByProvider(texts: string[]): Record<TTSProvider, string[]> {
  const batches: Record<TTSProvider, string[]> = {
    google: [],
    elevenlabs: [],
    kokoro: [],
    'edge-tts': [],
  }

  texts.forEach(text => {
    const provider = selectProvider(text)
    batches[provider].push(text)
  })

  return batches
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
  }
}
