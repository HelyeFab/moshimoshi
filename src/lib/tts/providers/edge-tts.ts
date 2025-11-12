import { getTtsConfig } from '../config';
import { TTSError } from '../types';
import { TTS_ERROR_CODES } from '../config';

export class EdgeTTSProvider {
  private endpoint: string;
  private defaultVoice: string;

  constructor() {
    const config = getTtsConfig();
    this.endpoint = config.edgeTts.endpoint;
    this.defaultVoice = config.edgeTts.defaultVoice;
  }

  async synthesize(
    text: string,
    options?: {
      voice?: string;
      speed?: number;
      pitch?: number;
      volume?: number;
    }
  ): Promise<{ audioContent: ArrayBuffer }> {
    try {
      const voice = options?.voice || this.defaultVoice;

      const requestBody = {
        text: text,
        voice: voice,
        // Edge-TTS parameters (if supported by your backend)
        rate: options?.speed ? `${(options.speed - 1) * 100}%` : '+0%',
        pitch: options?.pitch ? `${options.pitch}Hz` : '+0Hz',
      };

      const response = await fetch(`${this.endpoint}/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Edge-TTS API error');
      }

      const audioContent = await response.arrayBuffer();
      return { audioContent };
    } catch (error: any) {
      console.error('Edge-TTS error:', error);

      // Determine if error is retryable
      const retryable = error.message?.includes('rate limit') ||
                       error.message?.includes('timeout') ||
                       error.message?.includes('network');

      throw {
        code: TTS_ERROR_CODES.PROVIDER_ERROR,
        message: `Edge-TTS failed: ${error.message}`,
        provider: 'edge-tts',
        retryable,
      } as TTSError;
    }
  }

  /**
   * Get available voices for Japanese and English
   */
  async getVoices(): Promise<Array<{ name: string; language: string; gender: string }>> {
    // Common Edge-TTS voices (hardcoded for now)
    // In production, you might want to fetch this from the API
    return [
      // Japanese voices
      { name: 'ja-JP-NanamiNeural', language: 'ja-JP', gender: 'Female' },
      { name: 'ja-JP-KeitaNeural', language: 'ja-JP', gender: 'Male' },
      { name: 'ja-JP-AoiNeural', language: 'ja-JP', gender: 'Female' },
      { name: 'ja-JP-DaichiNeural', language: 'ja-JP', gender: 'Male' },
      { name: 'ja-JP-MayuNeural', language: 'ja-JP', gender: 'Female' },
      { name: 'ja-JP-NaokiNeural', language: 'ja-JP', gender: 'Male' },
      { name: 'ja-JP-ShioriNeural', language: 'ja-JP', gender: 'Female' },
      // English voices
      { name: 'en-US-JennyNeural', language: 'en-US', gender: 'Female' },
      { name: 'en-US-GuyNeural', language: 'en-US', gender: 'Male' },
      { name: 'en-US-AriaNeural', language: 'en-US', gender: 'Female' },
      { name: 'en-US-DavisNeural', language: 'en-US', gender: 'Male' },
    ];
  }

  /**
   * Get health status of the Edge-TTS service
   */
  async getHealth(): Promise<{ status: string; service: string }> {
    try {
      const response = await fetch(`${this.endpoint}/health`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Health check failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking Edge-TTS health:', error);
      throw error;
    }
  }
}
