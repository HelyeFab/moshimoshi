'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ShadowingSession, TranscriptLine } from '@/types/youtubeShadowing';
import { Settings, X, Video, VideoOff, ChevronDown, ChevronUp } from 'lucide-react';
import { useYouTubePracticeTracking } from '@/hooks/useYouTubePracticeTracking';
import { extractVideoId } from '@/utils/youtubeHelpers';
import YouTubePlayerNew from './YouTubePlayerNew';
import RepeatControls from './RepeatControls';
import { RepeatModeConfig } from '@/types/youtube-player';
import { cn } from '@/lib/utils';
import { GrammarLegend } from '@/components/reading/GrammarHighlightedText';

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
  const [showGrammarLegend, setShowGrammarLegend] = useState(false);

  // Repeat mode configuration
  const [repeatConfig, setRepeatConfig] = useState<RepeatModeConfig>({
    enabled: true,
    count: 3,
    currentRepeat: 0,
    pauseDuration: 1500,
  });

  // Practice tracking - hook handles start/stop automatically based on isPlaying
  const { practiceTime } = useYouTubePracticeTracking({
    videoId: videoId || null,
    videoUrl: session.videoUrl,
    videoTitle: session.videoTitle || null,
    thumbnailUrl: session.videoMetadata?.thumbnails?.medium?.url,
    channelName: session.videoMetadata?.channelTitle,
    duration: session.videoMetadata?.duration,
    metadata: session.videoMetadata,
    isPlaying,
    currentTime,
  });

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

          {/* Repeat Status Indicator */}
          {repeatConfig.enabled && repeatConfig.count > 1 && isPlaying && (
            <div className="absolute bottom-4 left-4 px-3 py-1 bg-primary-500/90 backdrop-blur-sm text-white text-sm font-semibold rounded-lg z-10 flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              Repeat {repeatConfig.currentRepeat + 1}/{repeatConfig.count}
            </div>
          )}

          {/* Practice Time Display */}
          <div className="absolute bottom-4 right-4 px-3 py-1 bg-dark-800/80 backdrop-blur-sm text-dark-300 text-xs rounded-lg z-10">
            {(practiceTime / 60).toFixed(1)} min
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

      {/* Settings Panel Below Video */}
      <div className="bg-dark-800/80 backdrop-blur-sm rounded-xl border border-white/10">
        {/* Settings Header - Collapsible */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between p-4 hover:bg-dark-700/50 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-500" />
            <span className="text-dark-50 font-semibold">Player Settings</span>
          </div>
          {showSettings ? (
            <ChevronUp className="w-5 h-5 text-dark-300" />
          ) : (
            <ChevronDown className="w-5 h-5 text-dark-300" />
          )}
        </button>

        {/* Settings Content */}
        {showSettings && (
          <div className="px-4 pb-4 space-y-4">
            {/* Furigana Toggle */}
            {showFurigana !== undefined && onToggleFurigana && (
              <div className="flex items-center justify-between">
                <div className="flex-1 pr-3">
                  <label className="text-sm font-medium text-dark-50 block">Furigana</label>
                  <p className="text-xs text-dark-400 mt-1">
                    Show readings above kanji characters
                  </p>
                </div>
                <button
                  onClick={onToggleFurigana}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showFurigana ? 'bg-primary-500' : 'bg-dark-600'
                  }`}
                  role="switch"
                  aria-checked={showFurigana}
                  aria-label="Toggle furigana"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showFurigana ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Grammar Highlighting Toggle */}
            {showGrammar !== undefined && onToggleGrammar && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <label className="text-sm font-medium text-dark-50 block">Grammar Colors</label>
                    <p className="text-xs text-dark-400 mt-1">
                      Highlight parts of speech with colors
                    </p>
                  </div>
                  <button
                    onClick={onToggleGrammar}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showGrammar ? 'bg-primary-500' : 'bg-dark-600'
                    }`}
                    role="switch"
                    aria-checked={showGrammar}
                    aria-label="Toggle grammar highlighting"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showGrammar ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Grammar Mode Selection */}
                {showGrammar && grammarMode && onGrammarModeChange && (
                  <div className="pl-3 space-y-2">
                    <label className="text-xs text-dark-400 block">Highlight Mode:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onGrammarModeChange('all')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          grammarMode === 'all'
                            ? 'bg-primary-600 text-white'
                            : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                        }`}
                      >
                        All Words
                      </button>
                      <button
                        onClick={() => onGrammarModeChange('content')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          grammarMode === 'content'
                            ? 'bg-primary-600 text-white'
                            : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                        }`}
                      >
                        Content Words
                      </button>
                      <button
                        onClick={() => onGrammarModeChange('grammar')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          grammarMode === 'grammar'
                            ? 'bg-primary-600 text-white'
                            : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                        }`}
                      >
                        Grammar Only
                      </button>
                      <button
                        onClick={() => setShowGrammarLegend(!showGrammarLegend)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors col-span-2 ${
                          showGrammarLegend
                            ? 'bg-primary-600 text-white'
                            : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                        }`}
                      >
                        {showGrammarLegend ? 'Hide' : 'Show'} Legend
                      </button>
                    </div>
                    {showGrammarLegend && (
                      <div className="mt-3 p-3 bg-dark-900/50 rounded-lg">
                        <GrammarLegend />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Divider */}
            <div className="border-t border-white/10 my-4" />

            {/* Repeat Controls */}
            <RepeatControls
              repeatConfig={repeatConfig}
              onRepeatCountChange={handleRepeatCountChange}
              onPauseDurationChange={handlePauseDurationChange}
              onSkipPrevious={undefined} // Will implement segment navigation later
              onSkipNext={undefined} // Will implement segment navigation later
              isPlaying={isPlaying}
              className="!bg-transparent !border-0 !p-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}
