// Media Session API Management
// Provides system media controls for TTS playback

import { canCurrentUser } from './entitlements'

interface MediaMetadata {
  title: string
  artist?: string
  album?: string
  artwork?: Array<{
    src: string
    sizes?: string
    type?: string
  }>
}

interface MediaSessionHandlers {
  play?: () => void
  pause?: () => void
  stop?: () => void
  seekBackward?: () => void
  seekForward?: () => void
  seekTo?: (details: { seekTime: number }) => void
  previousTrack?: () => void
  nextTrack?: () => void
}

interface PlaybackState {
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
}

class MediaSessionManager {
  private isSupported = false
  private currentState: PlaybackState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1.0
  }
  private handlers: MediaSessionHandlers = {}

  constructor() {
    if (typeof window !== 'undefined') {
      this.isSupported = 'mediaSession' in navigator
      this.initialize()
    }
  }

  private initialize() {
    if (!this.isSupported) {
      return
    }

    // Set default handlers
    this.setDefaultHandlers()
  }

  private setDefaultHandlers() {
    if (!this.isSupported) return

    try {
      // Default play handler
      navigator.mediaSession.setActionHandler('play', () => {
        this.handlers.play?.()
        this.updatePlaybackState(true)
      })

      // Default pause handler
      navigator.mediaSession.setActionHandler('pause', () => {
        this.handlers.pause?.()
        this.updatePlaybackState(false)
      })

      // Default stop handler
      navigator.mediaSession.setActionHandler('stop', () => {
        this.handlers.stop?.()
        this.updatePlaybackState(false)
        this.clearMetadata()
      })

      // Seek backward (10 seconds)
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        this.handlers.seekBackward?.()
      })

      // Seek forward (10 seconds)
      navigator.mediaSession.setActionHandler('seekforward', () => {
        this.handlers.seekForward?.()
      })

      // Previous/Next for navigating sentences or items
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.handlers.previousTrack?.()
      })

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.handlers.nextTrack?.()
      })

      // Seek to specific position
      if ('setPositionState' in navigator.mediaSession) {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) {
            this.handlers.seekTo?.({ seekTime: details.seekTime })
          }
        })
      }
    } catch (error) {
      console.error('Failed to set media session handlers:', error)
    }
  }

  public isMediaSessionSupported(): boolean {
    return this.isSupported
  }

  public setMetadata(metadata: MediaMetadata): boolean {
    // Check entitlements
    if (!canCurrentUser('mediaSession')) {
      console.warn('User not entitled to use media session')
      return false
    }

    if (!this.isSupported) {
      return false
    }

    try {
      // Create MediaMetadata object with artwork
      const mediaMetadata = new (window as any).MediaMetadata({
        title: metadata.title,
        artist: metadata.artist || 'Moshimoshi',
        album: metadata.album || 'Japanese Learning',
        artwork: metadata.artwork || [
          {
            src: '/favicon-96x96.png',
            sizes: '96x96',
            type: 'image/png'
          },
          {
            src: '/favicon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/favicon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      })

      navigator.mediaSession.metadata = mediaMetadata

      // Track metadata update
      this.trackMetadataUpdate(metadata.title)

      return true
    } catch (error) {
      console.error('Failed to set media metadata:', error)
      return false
    }
  }

  public clearMetadata(): void {
    if (!this.isSupported) return

    try {
      navigator.mediaSession.metadata = null
    } catch (error) {
      console.error('Failed to clear media metadata:', error)
    }
  }

  public updatePlaybackState(isPlaying: boolean): void {
    if (!this.isSupported) return

    this.currentState.isPlaying = isPlaying

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    } catch (error) {
      console.error('Failed to update playback state:', error)
    }
  }

  public setPositionState(duration: number, position: number = 0, playbackRate: number = 1.0): void {
    if (!this.isSupported) return

    this.currentState.duration = duration
    this.currentState.currentTime = position
    this.currentState.playbackRate = playbackRate

    try {
      if ('setPositionState' in navigator.mediaSession) {
        (navigator.mediaSession as any).setPositionState({
          duration,
          playbackRate,
          position
        })
      }
    } catch (error) {
      console.error('Failed to set position state:', error)
    }
  }

  public setHandlers(handlers: MediaSessionHandlers): void {
    this.handlers = { ...this.handlers, ...handlers }

    // Re-apply handlers if supported
    if (this.isSupported) {
      this.setDefaultHandlers()
    }
  }

  public setHandler(action: keyof MediaSessionHandlers, handler: () => void): void {
    this.handlers[action] = handler

    if (this.isSupported && action in this.handlers) {
      try {
        // Map our handler names to MediaSession action names
        const actionMap: Record<string, string> = {
          play: 'play',
          pause: 'pause',
          stop: 'stop',
          seekBackward: 'seekbackward',
          seekForward: 'seekforward',
          previousTrack: 'previoustrack',
          nextTrack: 'nexttrack'
        }

        const mediaAction = actionMap[action]
        if (mediaAction) {
          navigator.mediaSession.setActionHandler(mediaAction as any, handler)
        }
      } catch (error) {
        console.error(`Failed to set handler for ${action}:`, error)
      }
    }
  }

  private trackMetadataUpdate(title: string) {
    // Track analytics event
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'media_session_updated', {
        media_title: title
      })
    }
  }

  // Helper method for TTS integration
  public setupForTTS(
    text: string,
    options: {
      onPlay?: () => void
      onPause?: () => void
      onStop?: () => void
      onPrevious?: () => void
      onNext?: () => void
      onSeek?: (time: number) => void
    } = {}
  ): void {
    // Set metadata for the TTS session
    this.setMetadata({
      title: text.length > 50 ? text.substring(0, 47) + '...' : text,
      artist: 'TTS Engine',
      album: 'Japanese Practice'
    })

    // Set up handlers
    this.setHandlers({
      play: options.onPlay,
      pause: options.onPause,
      stop: options.onStop,
      previousTrack: options.onPrevious,
      nextTrack: options.onNext,
      seekTo: options.onSeek ? (details) => options.onSeek!(details.seekTime) : undefined
    })

    // Set initial state
    this.updatePlaybackState(false)
  }

  // Clean up when TTS ends
  public teardownTTS(): void {
    this.updatePlaybackState(false)
    this.clearMetadata()
    this.handlers = {}
  }
}

// Export singleton instance
export const mediaSessionManager = new MediaSessionManager()

// Hook for React components
import { useEffect, useState } from 'react'

export function useMediaSession() {
  const [isSupported, setIsSupported] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    setIsSupported(mediaSessionManager.isMediaSessionSupported())
  }, [])

  const setMetadata = (metadata: MediaMetadata) => {
    return mediaSessionManager.setMetadata(metadata)
  }

  const updatePlayback = (playing: boolean) => {
    mediaSessionManager.updatePlaybackState(playing)
    setIsPlaying(playing)
  }

  const setPosition = (duration: number, position: number = 0, rate: number = 1.0) => {
    mediaSessionManager.setPositionState(duration, position, rate)
  }

  const setupTTS = (text: string, handlers?: any) => {
    mediaSessionManager.setupForTTS(text, handlers)
  }

  const cleanup = () => {
    mediaSessionManager.teardownTTS()
  }

  return {
    isSupported,
    isPlaying,
    setMetadata,
    updatePlayback,
    setPosition,
    setupTTS,
    cleanup
  }
}