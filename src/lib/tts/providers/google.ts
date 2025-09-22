import { getTtsConfig } from '../config';
import { TTSError, TTSResult } from '../types';
import { TTS_ERROR_CODES } from '../config';

export class GoogleTTSProvider {
  private apiKey: string;
  private endpoint = 'https://texttospeech.googleapis.com/v1/text:synthesize';

  constructor() {
    const config = getTtsConfig();
    if (!config.google.apiKey) {
      throw new Error('Google Cloud TTS API key not configured');
    }
    this.apiKey = config.google.apiKey;
  }

  async synthesize(
    text: string,
    options?: {
      voice?: string;
      speed?: number;
      pitch?: number;
      volume?: number;
    }
  ): Promise<{ audioContent: string }> {
    try {
      const config = getTtsConfig();

      // If voice is just a language code like 'ja-JP', use the default voice
      let voiceName = options?.voice || config.google.defaultVoice;
      if (options?.voice === 'ja-JP' || options?.voice === 'en-US') {
        voiceName = config.google.defaultVoice;
      }

      const requestBody = {
        input: {
          text: text,
        },
        voice: {
          languageCode: config.google.languageCode,
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: config.google.audioConfig.audioEncoding,
          speakingRate: options?.speed || config.google.audioConfig.speakingRate,
          pitch: options?.pitch || config.google.audioConfig.pitch,
          volumeGainDb: options?.volume
            ? (options.volume - 1) * 6 // Convert 0-1 to dB
            : config.google.audioConfig.volumeGainDb,
        },
      };

      const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Google TTS API error');
      }

      const data = await response.json();
      return { audioContent: data.audioContent };
    } catch (error: any) {
      console.error('Google TTS error:', error);
      
      // Determine if error is retryable
      const retryable = error.message?.includes('rate limit') || 
                       error.message?.includes('timeout') ||
                       error.message?.includes('network');
      
      throw {
        code: TTS_ERROR_CODES.PROVIDER_ERROR,
        message: `Google TTS failed: ${error.message}`,
        provider: 'google',
        retryable,
      } as TTSError;
    }
  }

  /**
   * Convert base64 audio to blob
   */
  base64ToBlob(base64: string, contentType: string = 'audio/mp3'): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }

  /**
   * Get available voices for Japanese
   */
  async getVoices(): Promise<Array<{ name: string; gender: string; type: string }>> {
    // Hardcoded list of Japanese voices
    // In production, you might want to fetch this from the API
    return [
      { name: 'ja-JP-Neural2-B', gender: 'FEMALE', type: 'Neural2' },
      { name: 'ja-JP-Neural2-C', gender: 'MALE', type: 'Neural2' },
      { name: 'ja-JP-Neural2-D', gender: 'MALE', type: 'Neural2' },
      { name: 'ja-JP-Wavenet-A', gender: 'FEMALE', type: 'WaveNet' },
      { name: 'ja-JP-Wavenet-B', gender: 'FEMALE', type: 'WaveNet' },
      { name: 'ja-JP-Wavenet-C', gender: 'MALE', type: 'WaveNet' },
      { name: 'ja-JP-Wavenet-D', gender: 'MALE', type: 'WaveNet' },
      { name: 'ja-JP-Standard-A', gender: 'FEMALE', type: 'Standard' },
      { name: 'ja-JP-Standard-B', gender: 'FEMALE', type: 'Standard' },
      { name: 'ja-JP-Standard-C', gender: 'MALE', type: 'Standard' },
      { name: 'ja-JP-Standard-D', gender: 'MALE', type: 'Standard' },
    ];
  }
}