import { storage } from '@/lib/firebase/admin';
import { GoogleTTSProvider } from './providers/google';
import { ElevenLabsProvider } from './providers/elevenlabs';
import { ttsCache } from './cache';
import { 
  TTSProvider, 
  TTSOptions, 
  TTSResult, 
  TTSError,
  TTSCacheEntry 
} from './types';
import {
  normalizeText,
  selectProvider,
  validateText,
  generateCacheKey,
  generateStoragePath,
  parseTTSOptions,
  estimateDuration,
} from './utils';
import { getTtsConfig, TTS_ERROR_CODES } from './config';

export class TTSService {
  private googleProvider?: GoogleTTSProvider;
  private elevenLabsProvider?: ElevenLabsProvider;

  constructor() {
    // Initialize providers lazily
  }

  /**
   * Main synthesis method - checks cache first, then synthesizes if needed
   */
  async synthesize(
    text: string,
    options?: TTSOptions
  ): Promise<TTSResult> {
    // Validate text
    const validation = validateText(text);
    if (!validation.valid) {
      throw {
        code: TTS_ERROR_CODES.INVALID_TEXT,
        message: validation.error!,
        retryable: false,
      } as TTSError;
    }

    // Parse options with defaults
    const parsedOptions = parseTTSOptions(options);
    
    // Determine provider
    const provider = parsedOptions.provider === 'auto' 
      ? selectProvider(text)
      : parsedOptions.provider as TTSProvider;
    
    // Get voice for provider
    const voice = this.getVoiceForProvider(provider, 'voice' in parsedOptions ? parsedOptions.voice : undefined);
    
    // Check cache first
    const cached = await ttsCache.get(text, provider, voice);
    if (cached) {
      console.log(`TTS cache hit for: ${text.substring(0, 50)}...`);
      return {
        audioUrl: cached.audioUrl,
        cached: true,
        duration: cached.duration,
        provider: cached.provider,
        cacheKey: cached.id,
      };
    }

    console.log(`TTS cache miss for: ${text.substring(0, 50)}... - synthesizing with ${provider}`);
    
    // Synthesize new audio
    try {
      const audioData = await this.synthesizeWithProvider(
        text,
        provider,
        {
          voice,
          speed: parsedOptions.speed,
          pitch: parsedOptions.pitch,
          volume: parsedOptions.volume,
        }
      );

      // Upload to Firebase Storage
      const { url, path, size } = await this.uploadAudio(
        audioData,
        provider,
        generateCacheKey(text, provider, voice)
      );

      // Estimate duration
      const duration = estimateDuration(text, parsedOptions.speed);

      // Save to cache
      await ttsCache.set(
        text,
        provider,
        voice,
        url,
        path,
        {
          duration,
          size,
        }
      );

      return {
        audioUrl: url,
        cached: false,
        duration,
        provider,
        cacheKey: generateCacheKey(text, provider, voice),
      };
    } catch (error: any) {
      console.error('TTS synthesis error:', error);
      
      // If it's already a TTSError, rethrow it
      if (error.code && error.message) {
        throw error;
      }
      
      // Otherwise, wrap it
      throw {
        code: TTS_ERROR_CODES.PROVIDER_ERROR,
        message: `Synthesis failed: ${error.message}`,
        provider,
        retryable: true,
      } as TTSError;
    }
  }

  /**
   * Batch synthesize multiple texts
   */
  async batchSynthesize(
    items: Array<{ text: string; options?: TTSOptions }>
  ): Promise<Array<{ text: string; result?: TTSResult; error?: TTSError }>> {
    const results = await Promise.allSettled(
      items.map(item => this.synthesize(item.text, item.options))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          text: items[index].text,
          result: result.value,
        };
      } else {
        return {
          text: items[index].text,
          error: result.reason as TTSError,
        };
      }
    });
  }

  /**
   * Preload texts into cache
   */
  async preload(
    texts: string[],
    options?: TTSOptions
  ): Promise<{ cached: number; synthesized: number; failed: number }> {
    const stats = {
      cached: 0,
      synthesized: 0,
      failed: 0,
    };

    for (const text of texts) {
      try {
        const result = await this.synthesize(text, options);
        if (result.cached) {
          stats.cached++;
        } else {
          stats.synthesized++;
        }
      } catch (error) {
        stats.failed++;
        console.error(`Failed to preload: ${text}`, error);
      }
    }

    return stats;
  }

  /**
   * Synthesize with specific provider
   */
  private async synthesizeWithProvider(
    text: string,
    provider: TTSProvider,
    options: {
      voice: string;
      speed?: number;
      pitch?: number;
      volume?: number;
    }
  ): Promise<Buffer> {
    if (provider === 'google') {
      if (!this.googleProvider) {
        this.googleProvider = new GoogleTTSProvider();
      }
      
      const result = await this.googleProvider.synthesize(text, options);
      // Convert base64 to Buffer
      return Buffer.from(result.audioContent, 'base64');
    } else {
      if (!this.elevenLabsProvider) {
        this.elevenLabsProvider = new ElevenLabsProvider();
      }
      
      const result = await this.elevenLabsProvider.synthesize(text, options);
      // Convert ArrayBuffer to Buffer
      return Buffer.from(result.audioContent);
    }
  }

  /**
   * Upload audio to Firebase Storage
   */
  private async uploadAudio(
    audioData: Buffer,
    provider: TTSProvider,
    cacheKey: string
  ): Promise<{ url: string; path: string; size: number }> {
    if (!storage) {
      throw new Error('Firebase Storage is not initialized');
    }
    const path = generateStoragePath(provider, cacheKey);
    const bucket = storage.bucket();
    const file = bucket.file(path);

    // Upload the audio file
    await file.save(audioData, {
      metadata: {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000', // 1 year cache
        metadata: {
          provider,
          synthesizedAt: new Date().toISOString(),
        },
      },
    });

    // Make the file publicly accessible
    await file.makePublic();

    // Get the public URL
    const url = `https://storage.googleapis.com/${bucket.name}/${path}`;

    return {
      url,
      path,
      size: audioData.length,
    };
  }

  /**
   * Get appropriate voice for provider
   */
  private getVoiceForProvider(provider: TTSProvider, requestedVoice?: string): string {
    if (requestedVoice) {
      return requestedVoice;
    }

    const config = getTtsConfig();
    if (provider === 'google') {
      return config.google.defaultVoice;
    } else {
      return config.elevenlabs.voiceId;
    }
  }

  /**
   * Check if text is in cache
   */
  async isCached(text: string, options?: TTSOptions): Promise<boolean> {
    const parsedOptions = parseTTSOptions(options);
    const provider = parsedOptions.provider === 'auto' 
      ? selectProvider(text)
      : parsedOptions.provider as TTSProvider;
    const voice = this.getVoiceForProvider(provider, 'voice' in parsedOptions ? parsedOptions.voice : undefined);
    
    return ttsCache.has(text, provider, voice);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return ttsCache.getStats();
  }

  /**
   * Clear cache (admin only)
   */
  async clearCache(filter?: {
    provider?: TTSProvider;
    olderThan?: Date;
    pattern?: string;
  }) {
    return ttsCache.clear(filter);
  }
}

// Export singleton instance
export const ttsService = new TTSService();