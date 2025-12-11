'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'

interface NhkAudioPlayerProps {
  url: string
  playbackRate?: number
  autoPlay?: boolean
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  onError?: (error: string) => void
  onReady?: () => void
}

/**
 * NHK Audio Player - Plays HLS m3u8 audio streams from NHK
 * Uses hls.js for cross-browser HLS support, with native fallback for Safari
 */
export function NhkAudioPlayer({
  url,
  playbackRate = 1.0,
  autoPlay = false,
  onPlay,
  onPause,
  onEnded,
  onError,
  onReady,
}: NhkAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Initialize HLS
  useEffect(() => {
    if (!url || !audioRef.current) return

    const audio = audioRef.current

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    // Check if HLS.js is supported (most browsers except Safari)
    if (Hls.isSupported()) {
      console.log('[NhkAudioPlayer] Using HLS.js for m3u8 playback')

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        // Audio-specific optimizations
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      })

      hlsRef.current = hls

      hls.loadSource(url)
      hls.attachMedia(audio)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[NhkAudioPlayer] HLS manifest parsed, ready to play')
        setIsReady(true)
        onReady?.()

        if (autoPlay) {
          audio.play().catch(err => {
            console.error('[NhkAudioPlayer] Autoplay failed:', err)
          })
        }
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('[NhkAudioPlayer] Fatal HLS error:', data)

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover from network error
              console.log('[NhkAudioPlayer] Attempting to recover from network error...')
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('[NhkAudioPlayer] Attempting to recover from media error...')
              hls.recoverMediaError()
              break
            default:
              // Cannot recover
              onError?.('Failed to load NHK audio stream')
              break
          }
        }
      })

      return () => {
        hls.destroy()
        hlsRef.current = null
      }
    }
    // Native HLS support (Safari on iOS/macOS)
    else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('[NhkAudioPlayer] Using native HLS support (Safari)')
      audio.src = url

      audio.addEventListener('loadedmetadata', () => {
        setIsReady(true)
        onReady?.()

        if (autoPlay) {
          audio.play().catch(err => {
            console.error('[NhkAudioPlayer] Autoplay failed:', err)
          })
        }
      })

      audio.addEventListener('error', () => {
        onError?.('Failed to load NHK audio')
      })
    } else {
      console.error('[NhkAudioPlayer] HLS not supported in this browser')
      onError?.('HLS audio not supported in this browser')
    }
  }, [url, autoPlay, onReady, onError])

  // Update playback rate when it changes
  useEffect(() => {
    if (audioRef.current && Number.isFinite(playbackRate)) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  // Audio event handlers
  const handlePlay = useCallback(() => {
    setIsPlaying(true)
    onPlay?.()
  }, [onPlay])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
    onPause?.()
  }, [onPause])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    onEnded?.()
  }, [onEnded])

  // Public methods exposed via ref would go here if needed
  // For now, we expose the audio element directly

  return (
    <audio
      ref={audioRef}
      onPlay={handlePlay}
      onPause={handlePause}
      onEnded={handleEnded}
      style={{ display: 'none' }}
    />
  )
}

/**
 * Hook for using NHK HLS audio playback
 * Returns controls and state for playing NHK m3u8 streams
 */
export function useNhkAudio(url?: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize HLS when URL is provided
  const pendingAutoPlayRef = useRef<{ enabled: boolean; playbackRate?: number }>({
    enabled: false,
    playbackRate: undefined,
  })

  const initialize = useCallback(
    (audioUrl: string, options?: { autoPlay?: boolean; playbackRate?: number }) => {
      // Create audio element if needed
      if (!audioRef.current) {
        audioRef.current = new Audio()
      }

    const audio = audioRef.current
    setIsLoading(true)
    setError(null)
    pendingAutoPlayRef.current = {
      enabled: !!options?.autoPlay,
      playbackRate: options?.playbackRate,
    }

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      })

      hlsRef.current = hls

      hls.loadSource(audioUrl)
      hls.attachMedia(audio)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (pendingAutoPlayRef.current.playbackRate !== undefined && Number.isFinite(pendingAutoPlayRef.current.playbackRate)) {
          audio.playbackRate = pendingAutoPlayRef.current.playbackRate
        }
        setIsReady(true)
        setIsLoading(false)

        if (pendingAutoPlayRef.current.enabled) {
          audio
            .play()
            .then(() => setIsPlaying(true))
            .catch(err => {
              console.error('[useNhkAudio] Autoplay failed after manifest parsed:', err)
              setError('Failed to play audio')
            })
        }
      })

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setError('Failed to load NHK audio')
          setIsLoading(false)
        }
      })
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = audioUrl
      audio.addEventListener(
        'loadedmetadata',
        () => {
          if (pendingAutoPlayRef.current.playbackRate !== undefined && Number.isFinite(pendingAutoPlayRef.current.playbackRate)) {
            audio.playbackRate = pendingAutoPlayRef.current.playbackRate
          }
          setIsReady(true)
          setIsLoading(false)

          if (pendingAutoPlayRef.current.enabled) {
            audio
              .play()
              .then(() => setIsPlaying(true))
              .catch(err => {
                console.error('[useNhkAudio] Autoplay failed after metadata load:', err)
                setError('Failed to play audio')
              })
          }
        },
        { once: true }
      )
      audio.addEventListener(
        'error',
        () => {
          setError('Failed to load NHK audio')
          setIsLoading(false)
        },
        { once: true }
      )
    } else {
      setError('HLS not supported')
      setIsLoading(false)
    }
    },
    []
  )

  // Auto-initialize if URL provided
  useEffect(() => {
    if (url) {
      initialize(url)
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [url, initialize])

  const play = useCallback(async () => {
    if (audioRef.current && isReady) {
      try {
        await audioRef.current.play()
        setIsPlaying(true)
      } catch (err) {
        console.error('[useNhkAudio] Play failed:', err)
        setError('Failed to play audio')
      }
    }
  }, [isReady])

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }, [])

  const setPlaybackRate = useCallback((rate: number) => {
    if (audioRef.current && Number.isFinite(rate)) {
      audioRef.current.playbackRate = rate
    }
  }, [])

  // Setup event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleEnded = () => setIsPlaying(false)
    const handlePause = () => setIsPlaying(false)
    const handlePlay = () => setIsPlaying(true)

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('play', handlePlay)

    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('play', handlePlay)
    }
  }, [])

  return {
    isReady,
    isPlaying,
    isLoading,
    error,
    play,
    pause,
    stop,
    setPlaybackRate,
    initialize,
    audioElement: audioRef.current,
  }
}

export default NhkAudioPlayer
