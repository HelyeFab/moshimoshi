'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ShadowingSession, TranscriptLine } from '@/types/youtubeShadowing';
import { Settings, X, Video, VideoOff } from 'lucide-react';
import { useYouTubePracticeTracking } from '@/hooks/useYouTubePracticeTracking';
import { extractVideoId } from '@/utils/youtubeHelpers';
import YouTubePlayerNew from './YouTubePlayerNew';
import RepeatControls from './RepeatControls';
import { RepeatModeConfig } from '@/types/youtube-player';
import { cn } from '@/lib/utils';

interface EnhancedShadowingPlayerProps {
  session: ShadowingSession;
  onLineChange: (index: number) => void;
  onPlayerReady?: (seekFn: (time: number) => void, playPauseFn?: () => void) => void;
  onTimeUpdate?: (time: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  showVideo?: boolean;
  showFurigana?: boolean;
  onToggleFurigana?: () => void;
  showGrammar?: boolean;
  onToggleGrammar?: () => void;
  grammarMode?: 'none' | 'all' | 'content' | 'grammar';
  onGrammarModeChange?: (mode: 'none' | 'all' | 'content' | 'grammar') => void;
  formattedAvailable?: boolean;
  useEnhancedTranscript?: boolean;
  onToggleTranscriptSource?: (useEnhanced: boolean) => void;
  className?: string;
  canRequestAiEnhancement?: boolean;
  onRequestAiEnhancement?: () => void | Promise<void>;
  aiEnhancementStatus?: 'idle' | 'running' | 'completed' | 'error';
  aiEnhancementError?: string | null;
}

/**
 * Enhanced Shadowing Player - New Implementation
 * Based on moshi-player architecture with Moshimoshi theme
 * Removed AI transcript features - uses cache-first API
 */
export default function EnhancedShadowingPlayer({
  session,
  onLineChange,
  onPlayerReady,
  onTimeUpdate,
  onPlayStateChange,
  showVideo = true,
  className,
  // AI-related props are ignored (deprecated)
}: EnhancedShadowingPlayerProps) {
  // Extract video ID from session
  const videoId = extractVideoId(session.videoUrl);

  // State
  const [showSettings, setShowSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekFunction, setSeekFunction] = useState<((time: number) => void) | null>(null);
  const [playPauseFunction, setPlayPauseFunction] = useState<(() => void) | null>(null);

  // Repeat mode configuration
  const [repeatConfig, setRepeatConfig] = useState<RepeatModeConfig>({
    enabled: true,
    count: 3,
    currentRepeat: 0,
    pauseDuration: 1500,
  });

  // Practice tracking
  const { startTracking, stopTracking, getTotalTime } = useYouTubePracticeTracking(videoId || '');

  // Start/stop practice tracking based on play state
  useEffect(() => {
    if (isPlaying) {
      startTracking();
    } else {
      stopTracking();
    }
  }, [isPlaying, startTracking, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // Handle player ready
  const handlePlayerReady = useCallback(() => {
    console.log('[EnhancedShadowingPlayer] Player ready');
    if (onPlayerReady && seekFunction && playPauseFunction) {
      onPlayerReady(seekFunction, playPauseFunction);
    }
  }, [onPlayerReady, seekFunction, playPauseFunction]);

  // Handle play callback
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    onPlayStateChange?.(true);
  }, [onPlayStateChange]);

  // Handle pause callback
  const handlePause = useCallback(() => {
    setIsPlaying(false);
    onPlayStateChange?.(false);
  }, [onPlayStateChange]);

  // Handle time update
  const handleTimeUpdate = useCallback((time: number, duration: number) => {
    setCurrentTime(time);
    onTimeUpdate?.(time);
  }, [onTimeUpdate]);

  // Handle seek request from player
  const handleSeekRequest = useCallback((seekFn: (time: number) => void) => {
    setSeekFunction(() => seekFn);
  }, []);

  // Store play/pause function
  useEffect(() => {
    if (!seekFunction) return;

    setPlayPauseFunction(() => () => {
      // Toggle play/pause
      if (isPlaying) {
        // Pause logic handled by player
      } else {
        // Play logic handled by player
      }
    });
  }, [seekFunction, isPlaying]);

  // Call onPlayerReady when functions are available
  useEffect(() => {
    if (seekFunction && playPauseFunction && onPlayerReady) {
      onPlayerReady(seekFunction, playPauseFunction);
    }
  }, [seekFunction, playPauseFunction, onPlayerReady]);

  // Repeat count handlers
  const handleRepeatCountChange = useCallback((count: number) => {
    setRepeatConfig((prev) => ({ ...prev, count, enabled: count > 1 }));
  }, []);

  const handlePauseDurationChange = useCallback((duration: number) => {
    setRepeatConfig((prev) => ({ ...prev, pauseDuration: duration }));
  }, []);

  // Validate video ID
  if (!videoId) {
    return (
      <div className={cn('bg-dark-800 rounded-xl p-8 text-center', className)}>
        <div className="text-red-400 text-4xl mb-4">⚠️</div>
        <h3 className="text-dark-50 font-bold text-lg mb-2">Invalid Video</h3>
        <p className="text-dark-300">Could not extract video ID from URL: {session.videoUrl}</p>
      </div>
    );
  }

  return (
    <div className={cn('enhanced-shadowing-player space-y-4', className)}>
      {/* Video Player */}
      {showVideo && (
        <div className="relative">
          <YouTubePlayerNew
            videoId={videoId}
            config={{
              height: '100%',
              autoplay: false,
            }}
            onReady={handlePlayerReady}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnd={() => {
              console.log('[EnhancedShadowingPlayer] Video ended');
              setIsPlaying(false);
              onPlayStateChange?.(false);
            }}
            onError={(error) => {
              console.error('[EnhancedShadowingPlayer] Error:', error);
            }}
            onTimeUpdate={handleTimeUpdate}
            onSeekRequest={handleSeekRequest}
            className="w-full"
          />

          {/* Settings Toggle Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="absolute top-4 left-4 p-2 bg-dark-800/80 backdrop-blur-sm hover:bg-dark-700/80 text-dark-50 rounded-lg transition-colors border border-white/10 z-10"
            title={showSettings ? 'Hide settings' : 'Show settings'}
          >
            {showSettings ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
          </button>

          {/* Repeat Status Indicator */}
          {repeatConfig.enabled && repeatConfig.count > 1 && isPlaying && (
            <div className="absolute bottom-4 left-4 px-3 py-1 bg-primary-500/90 backdrop-blur-sm text-white text-sm font-semibold rounded-lg z-10 flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              Repeat {repeatConfig.currentRepeat + 1}/{repeatConfig.count}
            </div>
          )}

          {/* Practice Time Display */}
          <div className="absolute bottom-4 right-4 px-3 py-1 bg-dark-800/80 backdrop-blur-sm text-dark-300 text-xs rounded-lg z-10">
            {(getTotalTime() / 1000 / 60).toFixed(1)} min
          </div>
        </div>
      )}

      {/* Video Toggle (for users who want audio-only) */}
      {!showVideo && (
        <div className="bg-dark-800 rounded-xl p-8 text-center">
          <VideoOff className="w-16 h-16 text-dark-400 mx-auto mb-4" />
          <p className="text-dark-300 text-sm">Video player hidden</p>
        </div>
      )}

      {/* Repeat Controls (collapsible) */}
      {showSettings && (
        <RepeatControls
          repeatConfig={repeatConfig}
          onRepeatCountChange={handleRepeatCountChange}
          onPauseDurationChange={handlePauseDurationChange}
          onSkipPrevious={undefined} // Will implement segment navigation later
          onSkipNext={undefined} // Will implement segment navigation later
          isPlaying={isPlaying}
        />
      )}
    </div>
  );
}
