import { TTSProvider, TTSOptions, TTSResult } from '../types'
import { getTtsConfig } from '../config'

interface KokoroTTSOptions {
  voice: string
  speed?: number
  pitch?: number
  volume?: number
}

interface KokoroResponse {
  audioContent: ArrayBuffer
  duration?: number
}

/**
 * VOICEVOX TTS Provider (via Modal)
 * Previously Kokoro - now uses VOICEVOX for higher quality Japanese TTS
 * Kept as "KokoroProvider" for backward compatibility
 */
export class KokoroProvider {
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.MODAL_API_KEY || ''
    this.baseUrl = 'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio'

    if (!this.apiKey) {
      console.warn('MODAL_API_KEY not found - VOICEVOX TTS will fail')
    }
  }

  async synthesize(text: string, options: KokoroTTSOptions): Promise<KokoroResponse> {
    if (!this.apiKey) {
      throw new Error('MODAL_API_KEY is required for VOICEVOX TTS')
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty')
    }

    // VOICEVOX uses numeric speaker IDs
    const voice = this.mapVoiceToVoicevox(options.voice)
    const speed = Math.max(0.5, Math.min(2.0, options.speed || 1.0))

    console.log('[VOICEVOX TTS] Generating audio', {
      textLength: text.length,
      voice,
      speed,
      textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
    })

    try {
      const response = await fetch(`${this.baseUrl}/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'User-Agent': 'Moshimoshi/TTS-Service',
        },
        body: JSON.stringify({
          model: 'voicevox',
          input: text,
          voice: voice,
          speed: speed,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[VOICEVOX TTS] API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        })

        if (response.status === 401) {
          throw new Error('VOICEVOX API authentication failed - check MODAL_API_KEY')
        } else if (response.status === 429) {
          throw new Error('VOICEVOX API rate limit exceeded')
        } else if (response.status >= 500) {
          throw new Error(`VOICEVOX API server error (${response.status}): ${errorText}`)
        } else {
          throw new Error(`VOICEVOX API error (${response.status}): ${errorText}`)
        }
      }

      const audioBuffer = await response.arrayBuffer()

      if (audioBuffer.byteLength === 0) {
        throw new Error('VOICEVOX API returned empty audio data')
      }

      console.log('[VOICEVOX TTS] Audio generated successfully', {
        size: (audioBuffer.byteLength / 1024).toFixed(2) + ' KB',
        voice,
        speed,
      })

      return {
        audioContent: audioBuffer,
        duration: this.estimateDuration(text, speed),
      }
    } catch (error: any) {
      console.error('[VOICEVOX TTS] Request failed:', error)

      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        throw new Error('VOICEVOX API request timeout - Modal server may be cold starting')
      }

      // Re-throw our custom errors as-is
      if (error.message?.startsWith('VOICEVOX API')) {
        throw error
      }

      // Network errors
      throw new Error(`VOICEVOX TTS network error: ${error.message}`)
    }
  }

  /**
   * Map generic voice names to VOICEVOX speaker IDs
   * VOICEVOX speakers: https://voicevox.hiroshiba.jp/
   * Popular speakers: 1=四国めたん, 3=ずんだもん, 11=玄野武宏(Nemo), 13=青山龍星
   */
  private mapVoiceToVoicevox(voice: string): string {
    const voiceMapping: Record<string, string> = {
      // Map old Kokoro/generic voice names to VOICEVOX speaker IDs
      jf_alpha: '11', // Map old Kokoro voice to Nemo
      'ja-JP-Standard-A': '11', // Female -> Nemo
      'ja-JP-Standard-B': '13', // Male -> 青山龍星
      'ja-JP-Standard-C': '11',
      'ja-JP-Standard-D': '13',
      'ja-JP-Wavenet-A': '11',
      'ja-JP-Wavenet-B': '13',
      'japanese-female': '11', // Nemo - natural female
      'japanese-male': '13', // 青山龍星 - natural male
      default: '11',
      // Direct VOICEVOX speaker IDs
      '1': '1', // 四国めたん
      '3': '3', // ずんだもん
      '11': '11', // 玄野武宏 (Nemo)
      '13': '13', // 青山龍星
    }

    // If it's already a numeric ID, return as-is
    if (/^\d+$/.test(voice)) {
      return voice
    }

    return voiceMapping[voice] || '11' // Default to Nemo
  }

  /**
   * Estimate audio duration based on text length and speed
   * Japanese text: ~4 characters per second at normal speed
   */
  private estimateDuration(text: string, speed: number = 1.0): number {
    const charactersPerSecond = 4 * speed
    const duration = text.length / charactersPerSecond
    return Math.max(0.5, duration) // Minimum 0.5 seconds
  }

  /**
   * Check if the VOICEVOX API is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      // VOICEVOX health endpoint doesn't require auth
      const response = await fetch(
        `https://emmanuelfabiani23--voicevox-tts-serve.modal.run/health`,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'Moshimoshi/Health-Check',
          },
        }
      )

      return response.ok
    } catch (error) {
      console.warn('[VOICEVOX TTS] Health check failed:', error)
      return false
    }
  }

  /**
   * Get supported voices (VOICEVOX speaker IDs)
   */
  getSupportedVoices(): string[] {
    return ['1', '3', '11', '13'] // Popular VOICEVOX speakers
  }

  /**
   * Get provider info
   */
  getProviderInfo() {
    return {
      name: 'VOICEVOX TTS (Modal)',
      provider: 'kokoro', // Keep 'kokoro' for backward compatibility
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
      supportedLanguages: ['ja-JP'],
      supportedFormats: ['wav', 'mp3'],
      maxTextLength: 5000,
    }
  }
}
