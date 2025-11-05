'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  YouTubePlayerState,
  YouTubePlayerConfig,
  YouTubePlayerActions,
  YouTubePlayerStateEnum,
} from '@/types/youtube-player';
import { loadYouTubeAPI } from '@/utils/youtubeHelpers';

/**
 * Custom hook for YouTube player state management
 * Copied from moshi-player with minimal adaptations
 * Will be extended with repeat/shadowing mode in Phase 6
 */
export function useYouTubePlayer(videoId: string, config: Partial<YouTubePlayerConfig> = {}) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAPIReady, setIsAPIReady] = useState(false);

  // Player state
  const [state, setState] = useState<YouTubePlayerState>({
    playing: false,
    muted: config.muted || false,
    volume: 100,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    quality: 'auto',
    fullscreen: false,
    buffered: 0,
    error: null,
    playerState: YouTubePlayerStateEnum.UNSTARTED,
  });

  // Throttled state update function for performance
  const syncPlayerState = useCallback(() => {
    const player = playerRef.current;
    if (!player || typeof player.getCurrentTime !== 'function') {
      return;
    }

    const currentTime = player.getCurrentTime() || 0;
    const duration = player.getDuration?.() || 0;
    const rawVolume = player.getVolume?.();
    const isMuted = player.isMuted?.() ?? false;
    const volume = typeof rawVolume === 'number' ? Math.max(0, Math.min(100, Math.round(rawVolume))) : undefined;
    const loadedFraction = player.getVideoLoadedFraction?.() ?? 0;
    const buffered = duration > 0 ? loadedFraction * duration : loadedFraction;

    setState(prev => {
      const next = {
        ...prev,
        currentTime,
        duration,
        buffered,
        muted: isMuted,
        volume: volume ?? prev.volume,
      };

      if (
        next.currentTime === prev.currentTime &&
        next.duration === prev.duration &&
        next.buffered === prev.buffered &&
        next.muted === prev.muted &&
        next.volume === prev.volume
      ) {
        return prev;
      }

      return next;
    });
  }, []);

  // Load YouTube API on mount
  useEffect(() => {
    loadYouTubeAPI().then(() => {
      setIsAPIReady(true);
    });
  }, []);

  // Initialize player when API is ready
  useEffect(() => {
    if (!isAPIReady || !containerRef.current || playerRef.current || !videoId) return;

    // YouTube IFrame Player API configuration
    const playerConfig = {
      height: config.height || 360,
      width: config.width || 640,
      videoId,
      playerVars: {
        autoplay: config.autoplay ? 1 : 0,
        enablejsapi: 1,
        playsinline: 1,
        // Disable related videos from other channels
        rel: 0,
        // Modest branding
        modestbranding: 1,
      },
      events: {
        onReady: (event: any) => {
          console.log('[useYouTubePlayer] Player ready for video:', videoId);
          setState(prev => ({
            ...prev,
            error: null,
            volume: typeof event?.target?.getVolume === 'function'
              ? Math.max(0, Math.min(100, Math.round(event.target.getVolume())))
              : prev.volume,
            muted: typeof event?.target?.isMuted === 'function' ? event.target.isMuted() : prev.muted,
            duration: typeof event?.target?.getDuration === 'function' ? event.target.getDuration() || prev.duration : prev.duration,
          }));
          syncPlayerState();
        },
        onStateChange: (event: any) => {
          const playerState = event.data;

          // Handle buffering state to prevent sync drift
          if (playerState === YouTubePlayerStateEnum.BUFFERING) {
            console.log('[useYouTubePlayer] Buffering detected');
          }

          setState(prev => ({
            ...prev,
            playing: playerState === YouTubePlayerStateEnum.PLAYING,
            playerState,
          }));

          if (playerState === YouTubePlayerStateEnum.PLAYING) {
            syncPlayerState();
          }
        },
        onPlaybackQualityChange: (event: any) => {
          setState(prev => ({ ...prev, quality: event.data }));
        },
        onPlaybackRateChange: (event: any) => {
          setState(prev => ({ ...prev, playbackRate: event.data }));
        },
        onError: (event: any) => {
          console.error('[useYouTubePlayer] Error for video:', videoId, 'Error code:', event.data);

          const errorMessages: { [key: number]: string } = {
            2: 'Invalid parameter value',
            5: 'Content not playable in HTML5 player',
            100: 'Video not found or has been removed',
            101: 'Video owner does not allow embedding',
            150: 'Video owner does not allow embedding',
          };

          const errorMessage = errorMessages[event.data as number] || `YouTube player error: ${event.data}`;
          console.error('[useYouTubePlayer] Error message:', errorMessage);

          setState(prev => ({
            ...prev,
            error: errorMessage,
          }));
        },
      },
    };

    playerRef.current = new (window as any).YT.Player(containerRef.current, playerConfig);

    return () => {
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [config.height, config.width, config.autoplay, isAPIReady, syncPlayerState, videoId]);

  // Optimized time updates using requestAnimationFrame
  useEffect(() => {
    if (!playerRef.current) return;

    let rafId: number;
    let lastUpdateTime = 0;
    let isTabVisible = !document.hidden;

    // Throttle: 60ms when playing (16 updates/sec), 1000ms when paused (1 update/sec)
    const getUpdateInterval = () => (state.playing ? 60 : 1000);

    const updateLoop = (timestamp: number) => {
      const updateIntervalMs = getUpdateInterval();

      // Only update if tab is visible and enough time has passed
      if (isTabVisible && timestamp - lastUpdateTime >= updateIntervalMs) {
        syncPlayerState();
        lastUpdateTime = timestamp;
      }

      rafId = requestAnimationFrame(updateLoop);
    };

    // Handle visibility changes - sync immediately when tab becomes visible
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        syncPlayerState();
        lastUpdateTime = performance.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    rafId = requestAnimationFrame(updateLoop);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncPlayerState, state.playing]);

  // Player actions
  const actions: YouTubePlayerActions = {
    play: useCallback(() => {
      if (playerRef.current?.playVideo) {
        playerRef.current.playVideo();
      }
    }, []),

    pause: useCallback(() => {
      if (playerRef.current?.pauseVideo) {
        playerRef.current.pauseVideo();
      }
    }, []),

    stop: useCallback(() => {
      if (playerRef.current?.stopVideo) {
        playerRef.current.stopVideo();
      }
    }, []),

    seekTo: useCallback((seconds: number) => {
      if (playerRef.current?.seekTo) {
        playerRef.current.seekTo(seconds, true);
      }
    }, []),

    setVolume: useCallback((volume: number) => {
      if (playerRef.current?.setVolume) {
        playerRef.current.setVolume(Math.max(0, Math.min(100, volume)));
        setState(prev => ({ ...prev, volume: Math.max(0, Math.min(100, volume)) }));
      }
    }, []),

    mute: useCallback(() => {
      if (playerRef.current?.mute) {
        playerRef.current.mute();
        setState(prev => ({ ...prev, muted: true }));
      }
    }, []),

    unmute: useCallback(() => {
      if (playerRef.current?.unMute) {
        playerRef.current.unMute();
        setState(prev => ({ ...prev, muted: false }));
      }
    }, []),

    setPlaybackRate: useCallback((rate: number) => {
      if (playerRef.current?.setPlaybackRate) {
        playerRef.current.setPlaybackRate(rate);
      }
    }, []),

    toggleFullscreen: useCallback(() => {
      setState(prev => ({ ...prev, fullscreen: !prev.fullscreen }));
    }, []),

    loadVideoById: useCallback((newVideoId: string, startSeconds?: number) => {
      if (playerRef.current?.loadVideoById) {
        playerRef.current.loadVideoById(newVideoId, startSeconds || 0);
      }
    }, []),

    loadVideoByUrl: useCallback((url: string, startSeconds?: number) => {
      if (playerRef.current?.loadVideoByUrl) {
        playerRef.current.loadVideoByUrl(url, startSeconds || 0);
      }
    }, []),
  };

  return {
    containerRef,
    playerRef, // Export playerRef for advanced use cases (repeat mode will need this)
    state,
    actions,
    isReady: isAPIReady && !!playerRef.current,
  };
}
