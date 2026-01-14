import { storage } from '@/lib/firebase/admin'
import { ElevenLabsProvider } from './providers/elevenlabs'
import { VoicevoxProvider } from './providers/voicevox'
import { ttsCache } from './cache'
import { TTSProvider, TTSOptions, TTSResult, TTSError } from './types'
import {
  selectProvider,
  validateText,
  generateCacheKey,
  generateStoragePath,
  parseTTSOptions,
  estimateDuration,
} from './utils'
import { getTtsConfig, TTS_ERROR_CODES } from './config'

export class TTSService {
  private voicevoxProvider?: VoicevoxProvider
  private elevenLabsProvider?: ElevenLabsProvider
  private uploadPromises: Map<string, Promise<{ url: string; path: string; size: number }>> =
    new Map()

  constructor() {
    // Initialize providers lazily
  }

  /**
   * Main synthesis method - checks cache first, then synthesizes if needed
   */
  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    // Validate text
    const validation = validateText(text)
    if (!validation.valid) {
      throw {
        code: TTS_ERROR_CODES.INVALID_TEXT,
        message: validation.error!,
        retryable: false,
      } as TTSError
    }

    // Parse options with defaults
    const parsedOptions = parseTTSOptions(options)

    // Determine provider
    const provider =
      parsedOptions.provider === 'auto'
        ? selectProvider(text)
        : (parsedOptions.provider as TTSProvider)

    // Get voice for provider
    const voice = this.getVoiceForProvider(
      provider,
      'voice' in parsedOptions ? parsedOptions.voice : undefined
    )

    // Check cache first
    const cached = await ttsCache.get(text, provider, voice, {
      speed: parsedOptions.speed,
      pitch: parsedOptions.pitch,
      volume: parsedOptions.volume,
    })
    if (cached) {
      console.log(`TTS cache hit for: ${text.substring(0, 50)}...`)
      return {
        audioUrl: cached.audioUrl,
        cached: true,
        duration: cached.duration,
        provider: cached.provider,
        cacheKey: cached.id,
      }
    }

    console.log(`TTS cache miss for: ${text.substring(0, 50)}... - synthesizing with ${provider}`)

    // Synthesize new audio
    try {
      const audioData = await this.synthesizeWithProvider(text, provider, {
        voice,
        speed: parsedOptions.speed,
        pitch: parsedOptions.pitch,
        volume: parsedOptions.volume,
      })

      // Upload to Firebase Storage with deduplication
      const cacheKey = generateCacheKey(text, provider, voice, {
        speed: parsedOptions.speed,
        pitch: parsedOptions.pitch,
        volume: parsedOptions.volume,
      })
      const { url, path, size } = await this.uploadAudioWithDedup(audioData, provider, cacheKey)

      // Estimate duration
      const duration = estimateDuration(text, parsedOptions.speed)

      // Save to cache
      await ttsCache.set(text, provider, voice, url, path, {
        duration,
        size,
        speed: parsedOptions.speed,
        pitch: parsedOptions.pitch,
        volume: parsedOptions.volume,
      })

      return {
        audioUrl: url,
        cached: false,
        duration,
        provider,
        cacheKey: generateCacheKey(text, provider, voice, {
          speed: parsedOptions.speed,
          pitch: parsedOptions.pitch,
          volume: parsedOptions.volume,
        }),
      }
    } catch (error: any) {
      console.error('TTS synthesis error:', error)

      // If it's already a TTSError, rethrow it
      if (error.code && error.message) {
        throw error
      }

      // Otherwise, wrap it
      throw {
        code: TTS_ERROR_CODES.PROVIDER_ERROR,
        message: `Synthesis failed: ${error.message}`,
        provider,
        retryable: true,
      } as TTSError
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
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          text: items[index].text,
          result: result.value,
        }
      } else {
        return {
          text: items[index].text,
          error: result.reason as TTSError,
        }
      }
    })
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
    }

    // Gracefully handle empty array
    if (!texts || texts.length === 0) {
      console.warn('[TTS Preload] No texts provided')
      return stats
    }

    console.log(`[TTS Preload] Starting preload for ${texts.length} texts`)

    for (const text of texts) {
      try {
        // Skip empty or invalid texts
        if (!text || text.trim().length === 0) {
          stats.failed++
          continue
        }

        const result = await this.synthesize(text, options)
        if (result.cached) {
          stats.cached++
        } else {
          stats.synthesized++
        }
      } catch (error: any) {
        stats.failed++
        console.warn(`[TTS Preload] Failed to preload "${text.substring(0, 20)}...":`, error?.message || error)
      }
    }

    console.log(`[TTS Preload] Complete: ${stats.cached} cached, ${stats.synthesized} synthesized, ${stats.failed} failed`)
    return stats
  }

  /**
   * Synthesize with specific provider
   * Priority: VOICEVOX → ElevenLabs (fallback)
   */
  private async synthesizeWithProvider(
    text: string,
    provider: TTSProvider | 'auto',
    options: {
      voice: string
      speed?: number
      pitch?: number
      volume?: number
    }
  ): Promise<Buffer> {
    let lastError: any = null
    const config = getTtsConfig()

    // PRIORITY 1: VOICEVOX TTS via Modal API (highest quality for Japanese)
    if (provider === 'voicevox' || provider === 'auto') {
      try {
        if (!this.voicevoxProvider) {
          this.voicevoxProvider = new VoicevoxProvider()
        }

        // Use configured defaults
        const voicevoxOptions = {
          ...options,
          voice: options.voice || config.voicevox.defaultVoice,
          speed: options.speed ?? config.voicevox.defaultSpeed,
        }

        const result = await this.voicevoxProvider.synthesize(text, voicevoxOptions)
        const audioBuffer = Buffer.from(result.audioContent)

        if (audioBuffer.length < 100) {
          throw new Error('VOICEVOX TTS returned empty or invalid audio data')
        }

        console.log('\x1b[42m\x1b[37m ▶️ TTS PROVIDER: VOICEVOX \x1b[0m')
        return audioBuffer
      } catch (error: any) {
        console.error('[TTS Service] VOICEVOX provider error:', error)
        lastError = error
        console.log(
          '\x1b[43m\x1b[30m ⚠️ VOICEVOX failed, falling back to ElevenLabs... \x1b[0m',
          error.message
        )
        provider = 'elevenlabs'
      }
    }

    // FALLBACK: ElevenLabs (commercial quality backup)
    if (provider === 'elevenlabs') {
      try {
        if (!this.elevenLabsProvider) {
          this.elevenLabsProvider = new ElevenLabsProvider()
        }

        const elevenLabsVoice = this.getVoiceForProvider('elevenlabs')
        const elevenLabsOptions = { ...options, voice: elevenLabsVoice }

        const result = await this.elevenLabsProvider.synthesize(text, elevenLabsOptions)
        const audioBuffer = Buffer.from(result.audioContent)

        if (audioBuffer.length < 100) {
          throw new Error('ElevenLabs TTS returned empty or invalid audio data')
        }

        console.log('\x1b[45m\x1b[37m ▶️ TTS PROVIDER: ElevenLabs (Fallback) \x1b[0m')
        return audioBuffer
      } catch (error: any) {
        console.error('[TTS Service] ElevenLabs provider error:', error)
        lastError = error
      }
    }

    // If all providers fail, throw comprehensive error
    throw {
      code: TTS_ERROR_CODES.PROVIDER_ERROR,
      message: `All TTS providers failed. Last error: ${lastError?.message || 'Unknown error'}. Providers tried: VOICEVOX → ElevenLabs`,
      provider: undefined,
      retryable: false,
    } as TTSError
  }

  /**
   * Upload audio with deduplication to prevent concurrent upload conflicts
   */
  private async uploadAudioWithDedup(
    audioData: Buffer,
    provider: TTSProvider,
    cacheKey: string
  ): Promise<{ url: string; path: string; size: number }> {
    const uploadKey = `${provider}-${cacheKey}`

    // Check if an upload is already in progress for this key
    const existingUpload = this.uploadPromises.get(uploadKey)
    if (existingUpload) {
      console.log(`Upload already in progress for ${uploadKey}, waiting...`)
      return existingUpload
    }

    // Create and store the upload promise
    const uploadPromise = this.uploadAudio(audioData, provider, cacheKey)
    this.uploadPromises.set(uploadKey, uploadPromise)

    try {
      const result = await uploadPromise
      // Clean up after successful upload
      this.uploadPromises.delete(uploadKey)
      return result
    } catch (error) {
      // Clean up after failed upload
      this.uploadPromises.delete(uploadKey)
      throw error
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
    try {
      if (!storage) {
        console.error('Firebase Storage is not initialized, using data URL fallback')
        // Fallback to data URL if Firebase Storage is not available
        const base64 = audioData.toString('base64')
        const dataUrl = `data:audio/mpeg;base64,${base64}`
        return {
          url: dataUrl,
          path: 'local',
          size: audioData.length,
        }
      }

      const path = generateStoragePath(provider, cacheKey)
      const bucket = storage.bucket()
      const file = bucket.file(path)

      // Try to check if file already exists
      try {
        const [exists] = await file.exists()
        if (exists) {
          console.log(`File already exists at ${path}, using existing file`)
          // File already exists, just return the URL
          const url = `https://storage.googleapis.com/${bucket.name}/${path}`
          return {
            url,
            path,
            size: audioData.length,
          }
        }
      } catch (checkError) {
        // Ignore exists check error and proceed with upload
        console.log('Could not check if file exists, proceeding with upload')
      }

      // Upload the audio file, handling conflicts gracefully
      try {
        await file.save(audioData, {
          metadata: {
            contentType: 'audio/mpeg',
            cacheControl: 'public, max-age=31536000', // 1 year cache
            metadata: {
              provider,
              synthesizedAt: new Date().toISOString(),
            },
          },
        })
      } catch (uploadError: any) {
        // If we get a 409 conflict, the file was uploaded by another request
        if (uploadError.code === 409) {
          console.log(`File upload conflict at ${path}, using existing file`)
          // File exists now, return the URL
          const url = `https://storage.googleapis.com/${bucket.name}/${path}`
          return {
            url,
            path,
            size: audioData.length,
          }
        }
        // Re-throw other errors
        throw uploadError
      }

      // Make the file publicly accessible
      await file.makePublic()

      // Get the public URL
      const url = `https://storage.googleapis.com/${bucket.name}/${path}`

      return {
        url,
        path,
        size: audioData.length,
      }
    } catch (error) {
      console.error('Failed to upload audio to Firebase Storage:', error)
      // Fallback to data URL on any upload error
      const base64 = audioData.toString('base64')
      const dataUrl = `data:audio/mpeg;base64,${base64}`
      return {
        url: dataUrl,
        path: 'local',
        size: audioData.length,
      }
    }
  }

  /**
   * Get appropriate voice for provider
   */
  private getVoiceForProvider(provider: TTSProvider, requestedVoice?: string): string {
    if (requestedVoice) {
      return requestedVoice
    }

    const config = getTtsConfig()
    if (provider === 'voicevox') {
      return config.voicevox.defaultVoice
    } else {
      return config.elevenlabs.voiceId
    }
  }

  /**
   * Check if text is in cache
   */
  async isCached(text: string, options?: TTSOptions): Promise<boolean> {
    const parsedOptions = parseTTSOptions(options)
    const provider =
      parsedOptions.provider === 'auto'
        ? selectProvider(text)
        : (parsedOptions.provider as TTSProvider)
    const voice = this.getVoiceForProvider(
      provider,
      'voice' in parsedOptions ? parsedOptions.voice : undefined
    )

    return ttsCache.has(text, provider, voice, {
      speed: parsedOptions.speed,
      pitch: parsedOptions.pitch,
      volume: parsedOptions.volume,
    })
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return ttsCache.getStats()
  }

  /**
   * Clear cache (admin only)
   */
  async clearCache(filter?: { provider?: TTSProvider; olderThan?: Date; pattern?: string }) {
    return ttsCache.clear(filter)
  }
}

// Export singleton instance
export const ttsService = new TTSService()
