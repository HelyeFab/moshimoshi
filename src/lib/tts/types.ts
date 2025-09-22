export type TTSProvider = 'google' | 'elevenlabs';

export interface TTSOptions {
  provider?: TTSProvider | 'auto';
  voice?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
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
  google: {
    apiKey?: string;
    projectId?: string;
    defaultVoice: string;
    languageCode: string;
    audioConfig: {
      audioEncoding: string;
      speakingRate?: number;
      pitch?: number;
      volumeGainDb?: number;
    };
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