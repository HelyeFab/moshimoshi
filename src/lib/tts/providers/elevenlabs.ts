import { getTtsConfig } from '../config';
import { TTSError } from '../types';
import { TTS_ERROR_CODES } from '../config';

export class ElevenLabsProvider {
  private apiKey: string;
  private voiceId: string;
  private endpoint = 'https://api.elevenlabs.io/v1';

  constructor() {
    const config = getTtsConfig();
    if (!config.elevenlabs.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }
    if (!config.elevenlabs.voiceId) {
      throw new Error('ElevenLabs voice ID not configured');
    }
    this.apiKey = config.elevenlabs.apiKey;
    this.voiceId = config.elevenlabs.voiceId;
  }

  async synthesize(
    text: string,
    options?: {
      voice?: string;
      speed?: number;
      volume?: number;
    }
  ): Promise<{ audioContent: ArrayBuffer }> {
    try {
      // Ignore language codes like 'ja-JP', use the configured voice ID
      let voiceId = this.voiceId;
      if (options?.voice && options.voice !== 'ja-JP' && options.voice !== 'en-US') {
        voiceId = options.voice;
      }
      const url = `${this.endpoint}/text-to-speech/${voiceId}`;

      const config = getTtsConfig();
      const requestBody = {
        text: text,
        model_id: config.elevenlabs.modelId || 'eleven_multilingual_v2',
        voice_settings: {
          stability: config.elevenlabs.voiceSettings?.stability || 0.5,
          similarity_boost: config.elevenlabs.voiceSettings?.similarityBoost || 0.75,
          style: config.elevenlabs.voiceSettings?.style || 0,
          use_speaker_boost: config.elevenlabs.voiceSettings?.useSpeakerBoost || true,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'ElevenLabs API error');
      }

      const audioContent = await response.arrayBuffer();
      return { audioContent };
    } catch (error: any) {
      console.error('ElevenLabs TTS error:', error);
      
      // Determine if error is retryable
      const retryable = error.message?.includes('rate limit') || 
                       error.message?.includes('timeout') ||
                       error.message?.includes('network');
      
      throw {
        code: TTS_ERROR_CODES.PROVIDER_ERROR,
        message: `ElevenLabs TTS failed: ${error.message}`,
        provider: 'elevenlabs',
        retryable,
      } as TTSError;
    }
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<Array<{ voice_id: string; name: string; labels: any }>> {
    try {
      const response = await fetch(`${this.endpoint}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch voices');
      }

      const data = await response.json();
      return data.voices;
    } catch (error) {
      console.error('Error fetching ElevenLabs voices:', error);
      return [];
    }
  }

  /**
   * Get subscription info (for quota checking)
   */
  async getSubscriptionInfo(): Promise<{
    character_count: number;
    character_limit: number;
  }> {
    try {
      const response = await fetch(`${this.endpoint}/user/subscription`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription info');
      }

      const data = await response.json();
      return {
        character_count: data.character_count,
        character_limit: data.character_limit,
      };
    } catch (error) {
      console.error('Error fetching subscription info:', error);
      return {
        character_count: 0,
        character_limit: 0,
      };
    }
  }

  /**
   * Convert ArrayBuffer to base64
   */
  arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}