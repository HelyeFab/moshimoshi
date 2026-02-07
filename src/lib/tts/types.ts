export type TTSProvider = 'voicevox' | 'elevenlabs';

export interface TTSOptions {
  provider?: TTSProvider | 'auto';
  voice?: string;
  speed?: number;
  /** Alias for speed - used by some components */
  rate?: number;
  pitch?: number;
  volume?: number;
  /** Skip the Japanese-text-only guard (e.g. for intentional English prompts like "Listen.") */
  skipLanguageCheck?: boolean;
}

export interface TTSResult {
  audioUrl: string;
  cached: boolean;
  duration?: number;
  provider: TTSProvider;
  cacheKey: string;
}

export interface TTSError {
  code: string;
  message: string;
  provider?: TTSProvider;
  retryable: boolean;
}

export interface TTSCacheEntry {
  id: string;
  text: string;
  normalizedText: string;
  provider: TTSProvider;
  voice: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  audioUrl: string;
  storagePath: string;
  duration?: number;
  size?: number;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  metadata?: {
    type?: 'character' | 'word' | 'sentence' | 'paragraph';
    language?: string;
    context?: string;
  };
}

export interface TTSConfig {
  voicevox: {
    apiKey?: string;
    baseUrl: string;
    defaultVoice: string;
    defaultSpeed: number;
    model: string;
    timeout: number;
  };
  elevenlabs: {
    apiKey?: string;
    voiceId: string;
    modelId?: string;
    voiceSettings?: {
      stability: number;
      similarityBoost: number;
      style?: number;
      useSpeakerBoost?: boolean;
    };
  };
  cache: {
    enabled: boolean;
    ttl?: number;
    maxSize?: number;
    offlineEnabled: boolean;
    preloadCommon: boolean;
  };
}

export interface TTSQueueItem {
  id?: string;
  text: string;
  options?: TTSOptions;
  priority?: 'low' | 'normal' | 'high';
  delay?: number;
  callback?: (result: TTSResult | TTSError) => void;
}

export type TTSTextType = 'character' | 'word' | 'sentence' | 'paragraph' | 'article';

export interface TTSPreloadConfig {
  hiragana: string[];
  katakana: string[];
  commonWords: string[];
  commonPhrases: string[];
}
