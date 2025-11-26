import { TTSProvider, TTSOptions, TTSResult } from '../types';
import { getTtsConfig } from '../config';

interface KokoroTTSOptions {
  voice: string;
  speed?: number;
  pitch?: number;
  volume?: number;
}

interface KokoroResponse {
  audioContent: ArrayBuffer;
  duration?: number;
}

export class KokoroProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.SHELDON_API_KEY || '';
    this.baseUrl = 'https://api.selfmind.dev/kokoro/v1/audio';

    if (!this.apiKey) {
      console.warn('SHELDON_API_KEY not found - Kokoro TTS will fail');
    }
  }

  async synthesize(
    text: string,
    options: KokoroTTSOptions
  ): Promise<KokoroResponse> {
    if (!this.apiKey) {
      throw new Error('SHELDON_API_KEY is required for Kokoro TTS');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Kokoro API expects specific voice IDs
    const voice = this.mapVoiceToKokoro(options.voice);
    const speed = Math.max(0.5, Math.min(2.0, options.speed || 1.0));

    console.log('[Kokoro TTS] Generating audio', {
      textLength: text.length,
      voice,
      speed,
      textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
    });

    try {
      const response = await fetch(`${this.baseUrl}/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'User-Agent': 'Moshimoshi/TTS-Service'
        },
        body: JSON.stringify({
          model: 'kokoro',
          input: text,
          voice: voice,
          response_format: 'mp3',
          speed: speed
        }),
        timeout: 30000 // 30 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Kokoro TTS] API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });

        if (response.status === 401) {
          throw new Error('Kokoro API authentication failed - check SHELDON_API_KEY');
        } else if (response.status === 429) {
          throw new Error('Kokoro API rate limit exceeded');
        } else if (response.status >= 500) {
          throw new Error(`Kokoro API server error (${response.status}): ${errorText}`);
        } else {
          throw new Error(`Kokoro API error (${response.status}): ${errorText}`);
        }
      }

      const audioBuffer = await response.arrayBuffer();

      if (audioBuffer.byteLength === 0) {
        throw new Error('Kokoro API returned empty audio data');
      }

      console.log('[Kokoro TTS] Audio generated successfully', {
        size: (audioBuffer.byteLength / 1024).toFixed(2) + ' KB',
        voice,
        speed
      });

      return {
        audioContent: audioBuffer,
        duration: this.estimateDuration(text, speed)
      };

    } catch (error: any) {
      console.error('[Kokoro TTS] Request failed:', error);

      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        throw new Error('Kokoro API request timeout - Sheldon server may be overloaded');
      }

      // Re-throw our custom errors as-is
      if (error.message?.startsWith('Kokoro API')) {
        throw error;
      }

      // Network errors
      throw new Error(`Kokoro TTS network error: ${error.message}`);
    }
  }

  /**
   * Map generic voice names to Kokoro-specific voice IDs
   */
  private mapVoiceToKokoro(voice: string): string {
    const voiceMapping: Record<string, string> = {
      'ja-JP-Standard-A': 'jf_alpha',
      'ja-JP-Standard-B': 'jf_alpha',
      'ja-JP-Standard-C': 'jf_alpha',
      'ja-JP-Standard-D': 'jf_alpha',
      'ja-JP-Wavenet-A': 'jf_alpha',
      'ja-JP-Wavenet-B': 'jf_alpha',
      'ja-JP-Wavenet-C': 'jf_alpha',
      'ja-JP-Wavenet-D': 'jf_alpha',
      'japanese-female': 'jf_alpha',
      'japanese-male': 'jf_alpha', // Only female voice available for now
      'default': 'jf_alpha'
    };

    return voiceMapping[voice] || 'jf_alpha';
  }

  /**
   * Estimate audio duration based on text length and speed
   * Japanese text: ~4 characters per second at normal speed
   */
  private estimateDuration(text: string, speed: number = 1.0): number {
    const charactersPerSecond = 4 * speed;
    const duration = text.length / charactersPerSecond;
    return Math.max(0.5, duration); // Minimum 0.5 seconds
  }

  /**
   * Check if the Kokoro API is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'User-Agent': 'Moshimoshi/Health-Check'
        },
        timeout: 5000
      });

      return response.ok;
    } catch (error) {
      console.warn('[Kokoro TTS] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get supported voices
   */
  getSupportedVoices(): string[] {
    return ['jf_alpha']; // Currently only one voice available
  }

  /**
   * Get provider info
   */
  getProviderInfo() {
    return {
      name: 'Kokoro TTS',
      provider: 'kokoro',
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
      supportedLanguages: ['ja-JP'],
      supportedFormats: ['mp3'],
      maxTextLength: 5000 // Kokoro limit
    };
  }
}