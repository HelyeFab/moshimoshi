import { TTSConfig } from './types';

// Use a function to get the config so environment variables are read at runtime
export function getTtsConfig(): TTSConfig {
  return {
    google: {
      apiKey: process.env.GOOGLE_CLOUD_TTS_API_KEY,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      defaultVoice: 'ja-JP-Neural2-B', // Female Japanese voice
      languageCode: 'ja-JP',
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0,
        volumeGainDb: 0,
      },
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: process.env.ELEVENLABS_VOICE_ID || '', // Will be provided by user
      modelId: 'eleven_multilingual_v2',
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0,
        useSpeakerBoost: true,
      },
    },
    cache: {
      enabled: true,
      ttl: undefined, // Permanent cache
      maxSize: 5000, // 5GB max cache size in MB
      offlineEnabled: true,
      preloadCommon: true,
    },
  };
}

// Export the config for backward compatibility
export const ttsConfig = getTtsConfig();

// Provider selection thresholds
export const PROVIDER_THRESHOLDS = {
  characterLimit: 10, // Use Google for text < 10 chars
  googleMaxLength: 5000, // Max length for Google TTS
  elevenLabsMaxLength: 5000, // Max length for ElevenLabs
};

// Audio format settings
export const AUDIO_FORMAT = {
  format: 'mp3' as const,
  bitrate: 128, // kbps
  sampleRate: 22050, // Hz
  channels: 1, // Mono
};

// Cache key prefixes
export const CACHE_PREFIXES = {
  audio: 'tts_audio_',
  metadata: 'tts_meta_',
  queue: 'tts_queue_',
};

// Error codes
export const TTS_ERROR_CODES = {
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INVALID_TEXT: 'INVALID_TEXT',
  INVALID_OPTIONS: 'INVALID_OPTIONS',
  CACHE_ERROR: 'CACHE_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  UNSUPPORTED: 'UNSUPPORTED',
} as const;

// Common Japanese phrases for preloading
export const PRELOAD_CONTENT = {
  hiragana: [
    'あ', 'い', 'う', 'え', 'お',
    'か', 'き', 'く', 'け', 'こ',
    'さ', 'し', 'す', 'せ', 'そ',
    'た', 'ち', 'つ', 'て', 'と',
    'な', 'に', 'ぬ', 'ね', 'の',
    'は', 'ひ', 'ふ', 'へ', 'ほ',
    'ま', 'み', 'む', 'め', 'も',
    'や', 'ゆ', 'よ',
    'ら', 'り', 'る', 'れ', 'ろ',
    'わ', 'を', 'ん',
  ],
  katakana: [
    'ア', 'イ', 'ウ', 'エ', 'オ',
    'カ', 'キ', 'ク', 'ケ', 'コ',
    'サ', 'シ', 'ス', 'セ', 'ソ',
    'タ', 'チ', 'ツ', 'テ', 'ト',
    'ナ', 'ニ', 'ヌ', 'ネ', 'ノ',
    'ハ', 'ヒ', 'フ', 'ヘ', 'ホ',
    'マ', 'ミ', 'ム', 'メ', 'モ',
    'ヤ', 'ユ', 'ヨ',
    'ラ', 'リ', 'ル', 'レ', 'ロ',
    'ワ', 'ヲ', 'ン',
  ],
  commonPhrases: [
    'おはよう',
    'おはようございます',
    'こんにちは',
    'こんばんは',
    'ありがとう',
    'ありがとうございます',
    'すみません',
    'はい',
    'いいえ',
    'わかりました',
  ],
};