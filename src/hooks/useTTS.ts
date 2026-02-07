import { useState, useRef, useCallback, useEffect } from 'react'
import { TTSOptions, TTSResult, TTSError } from '@/lib/tts/types'
import { OfflineTTSCache } from '@/lib/tts/offlineCache'
import { ttsLoadingState } from '@/lib/tts/loadingState'
import { unlockAudioOnUserGesture } from '@/utils/audioUnlock'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'

/** Returns true if text is Japanese-only (contains Japanese characters and no Latin letters) */
const isJapaneseOnly = (text: string): boolean =>
  /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text) && !/[a-zA-Z]/.test(text)

interface UseTTSOptions {
  autoPlay?: boolean
  preloadOnMount?: string[]
  cacheFirst?: boolean
  /** Enable Web Speech API fallback when server TTS fails (default: true) */
  enableFallback?: boolean
  onPlay?: () => void
  onEnd?: () => void
  onError?: (error: Error) => void
  /** Called when falling back to browser TTS */
  onFallback?: () => void
}

interface UseTTSReturn {
  // State
  playing: boolean
  /** Alias for `playing` - for component compatibility */
  isPlaying: boolean
  loading: boolean
  error: Error | null
  currentText: string | null
  /** True when using browser's Web Speech API fallback */
  usingFallback: boolean
  /** True when fetching audio from API (not cache) - use for loading animations */
  isFetchingFromAPI: boolean

  // Methods
  play: (text: string, options?: TTSOptions) => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => void
  preload: (texts: string[], options?: TTSOptions) => Promise<void>
  queue: (items: Array<{ text: string; delay?: number }>) => void
  clearQueue: () => void

  // Audio element ref
  audioRef: React.RefObject<HTMLAudioElement | null>
}

/**
 * Check if Web Speech API is available
 */
function isWebSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Get Japanese voice from available voices
 */
function getJapaneseVoice(): SpeechSynthesisVoice | null {
  if (!isWebSpeechSupported()) return null

  const voices = speechSynthesis.getVoices()
  // Prefer Japanese voices, fallback to any available
  const japaneseVoice = voices.find(v => v.lang.startsWith('ja'))
  return japaneseVoice || voices[0] || null
}

/**
 * Get human-readable error message from MediaError
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaError/code
 */
function getMediaErrorMessage(error: MediaError | null | undefined): string {
  if (!error) return 'Audio playback failed (unknown error)'

  switch (error.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'Audio playback was aborted'
    case MediaError.MEDIA_ERR_NETWORK:
      return 'Network error while loading audio'
    case MediaError.MEDIA_ERR_DECODE:
      return 'Audio decoding failed - file may be corrupted'
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'Audio format not supported or source unavailable'
    default:
      return error.message || `Audio playback failed (code: ${error.code})`
  }
}

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const {
    autoPlay = false,
    preloadOnMount = [],
    cacheFirst = true,
    enableFallback = true,
    onPlay,
    onEnd,
    onError,
    onFallback,
  } = options

  const { showToast } = useToast()
  const { t } = useTranslation()

  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [currentText, setCurrentText] = useState<string | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)
  const [isFetchingFromAPI, setIsFetchingFromAPI] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const queueRef = useRef<Array<{ text: string; delay?: number }>>([])
  const isProcessingQueue = useRef(false)

  /**
   * Play audio using Web Speech API (browser native TTS)
   * Used as fallback when server TTS fails
   */
  const playWithWebSpeech = useCallback(
    (text: string, speed: number = 1.0): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!isWebSpeechSupported()) {
          reject(new Error('Web Speech API not supported'))
          return
        }

        // Cancel any ongoing speech
        speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(text)
        utteranceRef.current = utterance

        // Configure utterance
        utterance.lang = 'ja-JP'
        utterance.rate = Math.max(0.5, Math.min(2.0, speed))
        utterance.pitch = 1.0
        utterance.volume = 1.0

        // Try to get Japanese voice
        const voice = getJapaneseVoice()
        if (voice) {
          utterance.voice = voice
        }

        // Event handlers
        utterance.onstart = () => {
          setPlaying(true)
          setUsingFallback(true)
          onPlay?.()
          onFallback?.()
          console.log('[useTTS] Playing with Web Speech API fallback')
        }

        utterance.onend = () => {
          setPlaying(false)
          setCurrentText(null)
          setUsingFallback(false)
          utteranceRef.current = null
          onEnd?.()
          processQueue()
          resolve()
        }

        utterance.onerror = event => {
          const error = new Error(`Web Speech API error: ${event.error}`)
          console.error('[useTTS] Web Speech API error:', event.error)
          setPlaying(false)
          setCurrentText(null)
          setUsingFallback(false)
          utteranceRef.current = null
          reject(error)
        }

        // Speak
        setLoading(false)
        speechSynthesis.speak(utterance)
      })
    },
    [onPlay, onEnd, onFallback]
  )

  // Preload on mount and ensure voices are loaded
  useEffect(() => {
    if (preloadOnMount.length > 0) {
      preload(preloadOnMount)
    }

    // Preload voices for Web Speech API (needed on some browsers)
    if (isWebSpeechSupported()) {
      // Voices might not be loaded immediately
      speechSynthesis.getVoices()
      // Listen for voiceschanged event
      speechSynthesis.onvoiceschanged = () => {
        speechSynthesis.getVoices()
      }
    }

    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
      // Cancel any ongoing Web Speech
      if (isWebSpeechSupported()) {
        speechSynthesis.cancel()
      }
      utteranceRef.current = null
    }
  }, [])

  const play = useCallback(
    async (text: string, ttsOptions?: TTSOptions) => {
      const debug = (message: string, data?: Record<string, unknown>) => {
        if (typeof window === 'undefined') return
        window.dispatchEvent(
          new CustomEvent('moshi-debug', {
            detail: { message, data },
          })
        )
      }

      // Guard: skip TTS for non-Japanese text unless explicitly opted out
      if (!ttsOptions?.skipLanguageCheck && !isJapaneseOnly(text)) {
        console.log(`[useTTS] Skipping non-Japanese text: "${text.substring(0, 40)}"`)
        showToast(t('tts.warnings.nonJapaneseText'), 'warning', 3000)
        return
      }

      try {
        setLoading(true)
        setError(null)
        setCurrentText(text)
        unlockAudioOnUserGesture()

        // Stop current audio if playing (but don't remove it)
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        }

        // Prepare TTS parameters
        const voice = ttsOptions?.voice || '23'
        const speed = ttsOptions?.speed || ttsOptions?.rate || 0.85
        const pitch = ttsOptions?.pitch // Optional - not used by server providers
        const provider = 'voicevox' // VOICEVOX via Modal - primary provider

        let result: TTSResult

        // Check offline cache first if cacheFirst is enabled
        if (cacheFirst) {
          const offlineCache = OfflineTTSCache.getInstance()
          const cachedResult = await offlineCache.get(text, provider, voice, speed, pitch)

          if (cachedResult) {
            // Use cached audio
            result = {
              audioUrl: cachedResult.audioUrl,
              provider,
              cached: true,
              duration: 0, // We don't store duration in offline cache yet
              cacheKey: `${text}_${provider}_${voice}_${speed}`,
            }
            console.log(
              `%c[useTTS] ⚡ CACHE HIT - Instant playback from IndexedDB | Text: "${text.substring(0, 40)}..."`,
              'color: #00ff00; font-weight: bold; background: #001a00; padding: 2px 4px'
            )
          } else {
            // Cache miss, proceed with API call
            console.log(
              `%c[useTTS] 🔄 Cache miss - Fetching from API | Text: "${text.substring(0, 40)}..."`,
              'color: #ff9800; font-weight: bold'
            )
            debug('[useTTS] API request', { textPreview: text.substring(0, 40) })
            setIsFetchingFromAPI(true)
            ttsLoadingState.setFetching(true)

            const response = await fetch('/api/tts/synthesize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text,
                language: ttsOptions?.voice === 'ja-JP' || ttsOptions?.voice === 'ja' ? 'ja' : 'en',
                voice: ttsOptions?.voice,
                speed: speed,
                pitch,
              }),
            })

            if (!response.ok) {
              let errorMessage = 'TTS synthesis failed'
              let errorDetails = null
              try {
                const errorData = await response.json()
                errorMessage = errorData.error?.message || errorData.message || errorMessage
                errorDetails = errorData
              } catch (e) {
                // If parsing fails, use response status
                errorMessage = `TTS synthesis failed (${response.status} ${response.statusText})`
              }
              console.error('TTS API Error:', {
                status: response.status,
                errorDetails,
                requestBody: { text: text.substring(0, 50) + '...' },
              })
              throw new Error(errorMessage)
            }

            const data = await response.json()
            result = data.data

            // DON'T dismiss modal yet - wait until audio is ready to play
            // setIsFetchingFromAPI(false)
            // ttsLoadingState.setFetching(false)

            // Cache the result for offline use (fire and forget)
            // Route Firebase Storage URLs through proxy to avoid CORS issues
            // iOS FIX: Cache the direct Firebase URL (not proxied)
            // This allows iOS to play cached audio properly
            offlineCache
              .set(text, provider, voice, speed, result.audioUrl, result.duration || 0, pitch)
              .then(() => {
                console.log(
                  `%c[useTTS] 💾 Cached to IndexedDB | Text: "${text.substring(0, 40)}..."`,
                  'color: #2196f3; font-weight: bold'
                )
              })
              .catch(error => {
                console.warn('[useTTS] ⚠️  Failed to cache audio offline:', error)
              })

            console.log(
              `%c[useTTS] ✅ API Success | Provider: ${result.provider} | Server Cached: ${result.cached} | Text: "${text.substring(0, 40)}..."`,
              'color: #4caf50; font-weight: bold'
            )
            debug('[useTTS] API success', {
              provider: result.provider,
              cached: result.cached,
              textPreview: text.substring(0, 40),
            })
          }
        } else {
          // Cache disabled, always call API
          setIsFetchingFromAPI(true)
          ttsLoadingState.setFetching(true)
          const response = await fetch('/api/tts/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              language: ttsOptions?.voice === 'ja-JP' || ttsOptions?.voice === 'ja' ? 'ja' : 'en',
              voice: ttsOptions?.voice,
              speed: speed,
              pitch: ttsOptions?.pitch || 0,
            }),
          })

          if (!response.ok) {
            let errorMessage = 'TTS synthesis failed'
            let errorDetails = null
            try {
              const errorData = await response.json()
              errorMessage = errorData.error?.message || errorData.message || errorMessage
              errorDetails = errorData
            } catch (e) {
              // If parsing fails, use response status
              errorMessage = `TTS synthesis failed (${response.status} ${response.statusText})`
            }
            console.error('TTS API Error:', {
              status: response.status,
              errorDetails,
              requestBody: { text: text.substring(0, 50) + '...' },
            })
            throw new Error(errorMessage)
          }

          const data = await response.json()
          result = data.data

          // DON'T dismiss modal yet - wait until audio is ready to play
          // setIsFetchingFromAPI(false)
          // ttsLoadingState.setFetching(false)

          console.log(
            `TTS Provider: ${result.provider}, Cached: ${result.cached}, Text: "${text.substring(0, 30)}..."`
          )
        }

        // Create audio element only if it doesn't exist
        if (!audioRef.current) {
          audioRef.current = new Audio()

          // CRITICAL for iOS Safari + Firebase Storage CORS
          // Safari requires explicit crossOrigin setting for Firebase Storage URLs
          audioRef.current.crossOrigin = 'anonymous'

          // iOS-specific: Preload metadata for better event reliability
          audioRef.current.preload = 'metadata'

          // Set up permanent event handlers
          audioRef.current.onplay = () => {
            setPlaying(true)
            onPlay?.()
          }

          audioRef.current.onended = () => {
            setPlaying(false)
            setCurrentText(null)
            onEnd?.()
            processQueue()
          }

          audioRef.current.onerror = () => {
            const mediaError = audioRef.current?.error

            // Ignore aborted loads (happens when switching audio quickly)
            // MEDIA_ERR_ABORTED = 1, or null error (stopped mid-load)
            if (!mediaError || mediaError.code === MediaError.MEDIA_ERR_ABORTED) {
              console.log('[useTTS] Ignoring aborted audio load')
              return
            }

            const errorMessage = getMediaErrorMessage(mediaError)
            const error = new Error(errorMessage)
            console.error('Audio playback error:', {
              code: mediaError?.code,
              message: mediaError?.message,
              errorMessage,
              src: audioRef.current?.src?.substring(0, 100),
            })
            setError(error)
            setPlaying(false)
            setCurrentText(null)
            onError?.(error)
          }
        }

        const audio = audioRef.current

        // Load and play audio
        // Route Firebase Storage URLs through TTS proxy to handle CORS
        // iOS FIX: Use direct Firebase Storage URLs instead of proxy
        // The proxy causes audio.play() promise to hang forever on iOS Safari
        // CORS must be configured on Firebase Storage bucket instead
        const audioUrl = result.audioUrl

        console.log('Setting audio source:', audioUrl)
        debug('[useTTS] Audio URL', {
          isDirect: !audioUrl.includes('/proxy'),
          isFirebase: audioUrl.includes('firebasestorage') || audioUrl.includes('storage.googleapis.com'),
          urlPreview: audioUrl.substring(0, 100)
        })
        setLoading(false)

        // Wait for audio to be ready before playing
        // IMPORTANT: Set up listeners BEFORE setting src to avoid race conditions
        // iOS 17.4+ FIX: Use loadedmetadata instead of canplaythrough (which never fires on iOS)
        await new Promise<void>((resolve, reject) => {
          let resolved = false
          let timeoutId: ReturnType<typeof setTimeout>

          const cleanup = () => {
            audio.removeEventListener('loadstart', onLoadStart)
            audio.removeEventListener('loadedmetadata', onLoadedMetadata)
            audio.removeEventListener('canplaythrough', onCanPlaythrough)
            audio.removeEventListener('error', onError)
            if (timeoutId) clearTimeout(timeoutId)
          }

          const onLoadStart = () => {
            debug('[useTTS] loadstart event fired')
            // Don't resolve yet, wait for metadata
          }

          const onLoadedMetadata = () => {
            if (!resolved) {
              resolved = true
              cleanup()
              debug('[useTTS] loadedmetadata event fired - ready to play (iOS compatible)')
              resolve()
            }
          }

          const onCanPlaythrough = () => {
            if (!resolved) {
              resolved = true
              cleanup()
              debug('[useTTS] canplaythrough event fired - ready to play')
              resolve()
            }
          }

          const onError = () => {
            if (!resolved) {
              resolved = true
              cleanup()
              const mediaError = audio.error

              // Ignore aborted loads (happens when switching audio quickly)
              if (!mediaError || mediaError.code === MediaError.MEDIA_ERR_ABORTED) {
                console.log('[useTTS] Ignoring aborted audio load during setup')
                reject(new Error('Audio load aborted'))
                return
              }

              const errorMessage = getMediaErrorMessage(mediaError)
              console.error('[useTTS] Audio load error:', {
                code: mediaError?.code,
                message: mediaError?.message,
                errorMessage,
                src: audio.src?.substring(0, 100),
              })
              reject(new Error(errorMessage))
            }
          }

          // iOS 17.4+ workaround: Listen to multiple events for maximum compatibility
          // - loadstart: Fires when loading begins (iOS always fires this)
          // - loadedmetadata: Fires when metadata is loaded (iOS 17.4+ reliable)
          // - canplaythrough: Fires on other browsers (iOS 17.4+ may not fire)
          audio.addEventListener('loadstart', onLoadStart)
          audio.addEventListener('loadedmetadata', onLoadedMetadata)
          audio.addEventListener('canplaythrough', onCanPlaythrough)
          audio.addEventListener('error', onError)

          // FIRST set the new source (this resets readyState)
          audio.src = audioUrl
          audio.load()

          // iOS-specific: Check if metadata already loaded
          // readyState >= 1 means HAVE_METADATA (minimum for play() to work)
          if (audio.readyState >= 1) {
            debug('[useTTS] Metadata already loaded (readyState >= 1), resolving immediately')
            onLoadedMetadata()
            return
          }

          // If it's a data/blob URL, give iOS a moment to process
          if (audioUrl.startsWith('data:audio') || audioUrl.startsWith('blob:')) {
            debug('[useTTS] Data/Blob URL detected, waiting for metadata')
            // iOS needs a tick to process blob URLs
            setTimeout(() => {
              if (!resolved && audio.readyState >= 1) {
                debug('[useTTS] Blob URL processed, metadata ready')
                onLoadedMetadata()
              }
            }, 50)
            return
          }

          // THEN check if audio loaded instantly (browser cache for this specific URL)
          // readyState >= 3 means HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
          if (audio.readyState >= 3) {
            debug('[useTTS] Audio fully cached (readyState >= 3), resolving immediately')
            onCanPlaythrough()
            return
          }

          // Timeout fallback (reduced for iOS - iOS loads faster but events are unreliable)
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
          const timeout = isIOS ? 15000 : 30000 // 15s for iOS, 30s for others

          timeoutId = setTimeout(() => {
            if (!resolved) {
              resolved = true
              cleanup()
              console.error('[useTTS] Audio loading timed out', {
                isIOS,
                readyState: audio.readyState,
                networkState: audio.networkState,
                src: audio.src?.substring(0, 100),
                duration: timeout / 1000 + 's'
              })
              reject(new Error(`Audio loading timed out after ${timeout / 1000} seconds`))
            }
          }, timeout)
        })

        // Play the audio
        try {
          debug('[useTTS] Attempting to play audio', {
            textPreview: text.substring(0, 40),
            readyState: audio.readyState,
            paused: audio.paused,
            src: audio.src?.substring(0, 50)
          })

          const playWithRetry = async () => {
            try {
              debug('[useTTS] Calling audio.play()')
              const playPromise = audio.play()
              debug('[useTTS] audio.play() called, waiting for promise')
              await playPromise
              debug('[useTTS] audio.play() promise resolved successfully')
              return
            } catch (playError: any) {
              debug('[useTTS] audio.play() threw error', {
                name: playError?.name,
                message: playError?.message,
                code: playError?.code
              })

              if (playError?.name === 'NotAllowedError') {
                debug('[useTTS] NotAllowedError - user gesture lost, trying unlock')
                unlockAudioOnUserGesture()

                // Try one more time
                try {
                  debug('[useTTS] Retrying audio.play() after unlock')
                  await audio.play()
                  debug('[useTTS] Retry succeeded')
                  return
                } catch (retryError: any) {
                  debug('[useTTS] Retry failed', {
                    name: retryError?.name,
                    message: retryError?.message
                  })
                  throw retryError
                }
              }
              throw playError
            }
          }

          await playWithRetry()
          console.log('%c[useTTS] ✅ Audio playing successfully', 'color: #00ff00; font-weight: bold')
          debug('[useTTS] Audio playback started successfully')

          // NOW dismiss the loading modal - audio is actually playing
          setIsFetchingFromAPI(false)
          ttsLoadingState.setFetching(false)
        } catch (playError: any) {
          console.error('%c[useTTS] ❌ Audio play failed:', 'color: #ff0000; font-weight: bold', playError)

          // CRITICAL: Dismiss modal on error too, otherwise it hangs forever
          setIsFetchingFromAPI(false)
          ttsLoadingState.setFetching(false)

          // Ignore AbortError if it's because we're switching to a new audio
          if (playError.name !== 'AbortError') {
            debug('[useTTS] Audio play failed - final error', {
              name: playError?.name,
              message: playError?.message,
              textPreview: text.substring(0, 40),
            })

            // Don't throw - just log the error and let user retry
            // Throwing here would break the UI flow
            console.warn('[useTTS] Play failed, but not throwing to allow retry')
          }
        }
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err))

        // Ignore aborted loads (happens when switching audio quickly)
        if (error.message === 'Audio load aborted') {
          console.log('[useTTS] Audio load was aborted, not treating as error')
          setLoading(false)
          setIsFetchingFromAPI(false)
          ttsLoadingState.setFetching(false)
          return
        }

        console.error('[useTTS] Server TTS failed:', error.message)

        // Try Web Speech API fallback if enabled
        if (enableFallback && isWebSpeechSupported()) {
          console.log('[useTTS] Attempting Web Speech API fallback...')
          try {
            const speed = ttsOptions?.speed || ttsOptions?.rate || 1.0
            await playWithWebSpeech(text, speed)
            // Fallback succeeded, don't throw
            return
          } catch (fallbackError) {
            console.error('[useTTS] Web Speech API fallback also failed:', fallbackError)
            // Continue to throw the original error
          }
        }

        setError(error)
        setLoading(false)
        setIsFetchingFromAPI(false)
        ttsLoadingState.setFetching(false)
        setCurrentText(null)
        onError?.(error)
        debug('[useTTS] Error', { message: error.message, textPreview: text.substring(0, 40) })
        throw error
      }
    },
    [autoPlay, onPlay, onEnd, onError, enableFallback, playWithWebSpeech]
  )

  const pause = useCallback(() => {
    if (usingFallback && isWebSpeechSupported()) {
      // Pause Web Speech API
      speechSynthesis.pause()
      setPlaying(false)
    } else if (audioRef.current && playing) {
      audioRef.current.pause()
      setPlaying(false)
    }
  }, [playing, usingFallback])

  const resume = useCallback(() => {
    if (usingFallback && isWebSpeechSupported()) {
      // Resume Web Speech API
      speechSynthesis.resume()
      setPlaying(true)
    } else if (audioRef.current && !playing) {
      audioRef.current.play()
      setPlaying(true)
    }
  }, [playing, usingFallback])

  const stop = useCallback(() => {
    if (usingFallback && isWebSpeechSupported()) {
      // Cancel Web Speech API
      speechSynthesis.cancel()
      setPlaying(false)
      setCurrentText(null)
      setUsingFallback(false)
      utteranceRef.current = null
    } else if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlaying(false)
      setCurrentText(null)
    }
  }, [usingFallback])

  const preload = useCallback(async (texts: string[], ttsOptions?: TTSOptions) => {
    console.log(
      `%c[useTTS] 🔄 Preloading ${texts.length} audio items...`,
      'color: #9c27b0; font-weight: bold'
    )
    console.log('[useTTS] Texts to preload:', texts.map(t => t.substring(0, 30) + (t.length > 30 ? '...' : '')))

    try {
      const startTime = Date.now()
      const response = await fetch('/api/tts/preload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts,
          options: ttsOptions,
          priority: 'normal',
        }),
      })

      if (!response.ok) {
        throw new Error('Preload failed')
      }

      const duration = Date.now() - startTime
      console.log(
        `%c[useTTS] ✅ Preload complete | ${texts.length} items | ${duration}ms`,
        'color: #00c853; font-weight: bold'
      )
    } catch (err) {
      console.error('%c[useTTS] ❌ Preload error:', 'color: #f44336; font-weight: bold', err)
    }
  }, [])

  const queue = useCallback(
    (items: Array<{ text: string; delay?: number }>) => {
      queueRef.current = [...queueRef.current, ...items]
      if (!isProcessingQueue.current && !playing) {
        processQueue()
      }
    },
    [playing]
  )

  const clearQueue = useCallback(() => {
    queueRef.current = []
    isProcessingQueue.current = false
  }, [])

  const processQueue = useCallback(async () => {
    if (queueRef.current.length === 0 || isProcessingQueue.current) {
      return
    }

    isProcessingQueue.current = true
    const item = queueRef.current.shift()

    if (item) {
      if (item.delay) {
        await new Promise(resolve => setTimeout(resolve, item.delay))
      }

      try {
        await play(item.text)
      } catch (error) {
        console.error('Queue processing error:', error)
        // Continue with next item even if current one fails
        isProcessingQueue.current = false
        processQueue()
      }
    } else {
      isProcessingQueue.current = false
    }
  }, [play])

  return {
    // State
    playing,
    isPlaying: playing,
    loading,
    error,
    currentText,
    usingFallback,
    isFetchingFromAPI,

    // Methods
    play,
    pause,
    resume,
    stop,
    preload,
    queue,
    clearQueue,

    // Audio element ref
    audioRef,
  }
}
