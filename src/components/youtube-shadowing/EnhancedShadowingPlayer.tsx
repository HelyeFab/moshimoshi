'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ShadowingSession, TranscriptLine } from '@/types/youtubeShadowing';
import { Settings, VideoOff, ChevronDown, Trash2, Keyboard } from 'lucide-react';
import { useYouTubePracticeTracking } from '@/hooks/useYouTubePracticeTracking';
import { extractVideoId } from '@/utils/youtubeHelpers';
import { YouTubePlayerWithPlayer } from './YouTubePlayerNew';

import { useShadowingPlayer } from '@/hooks/useShadowingPlayer';
import type { TranscriptSegment } from '@/types/youtube-player';
import { cn } from '@/lib/utils';
import { GrammarLegend } from '@/components/reading/GrammarHighlightedText';
import Dialog from '@/components/ui/Dialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

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
  onClearSession?: () => void;
}

export default function EnhancedShadowingPlayer({
  session,
  onLineChange,
  onPlayerReady,
  onTimeUpdate,
  onPlayStateChange,
  showVideo = true,
  showFurigana = true,
  onToggleFurigana,
  showGrammar = false,
  onToggleGrammar,
  grammarMode = 'content',
  onGrammarModeChange,
  className,
  formattedAvailable: _formattedAvailable,
  useEnhancedTranscript: _useEnhancedTranscript,
  onToggleTranscriptSource: _onToggleTranscriptSource,
  canRequestAiEnhancement: _canRequestAiEnhancement,
  onRequestAiEnhancement: _onRequestAiEnhancement,
  aiEnhancementStatus: _aiEnhancementStatus,
  aiEnhancementError: _aiEnhancementError,
  onClearSession,
}: EnhancedShadowingPlayerProps) {
  const videoId = extractVideoId(session.videoUrl);
  const segments: TranscriptLine[] = session.transcript || [];

  const [showSettings, setShowSettings] = useState(false);
  const [showGrammarLegend, setShowGrammarLegend] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const transcriptSegments = useMemo<TranscriptSegment[]>(
    () =>
      segments.map((segment) => ({
        start: segment.startTime,
        end: segment.endTime,
        duration: Math.max(0, segment.endTime - segment.startTime),
        startTime: segment.startTime,
        endTime: segment.endTime,
        text: segment.text,
        words: segment.words,
      })),
    [segments]
  );

  const playerData = useShadowingPlayer(videoId || '', {
    transcript: transcriptSegments,
    repeatCount: 3,
    pauseDuration: 1500,
    onSegmentChange: (index) => {
      if (index >= 0) {
        onLineChange(index);
      }
    },
  });

  const { state: playerState, actions, isReady } = playerData;
  const {
    play,
    pause,
    seekTo,
    setRepeatCount,
    setPauseDuration,
  } = actions;

  const { practiceTime } = useYouTubePracticeTracking({
    videoId: videoId || null,
    videoUrl: session.videoUrl,
    videoTitle: session.videoTitle || null,
    thumbnailUrl: session.videoMetadata?.thumbnails?.medium?.url,
    channelName: session.videoMetadata?.channelTitle,
    duration: session.videoMetadata?.duration ? parseInt(session.videoMetadata.duration.toString()) : undefined,
    metadata: session.videoMetadata,
    isPlaying: playerState.playing,
    currentTime: playerState.currentTime,
  });

  // Keyboard shortcuts for shadowing player
  const { getShortcutsHelp } = useKeyboardShortcuts({
    enabled: true,
    bindings: [
      {
        key: ' ',
        description: 'Play/Pause',
        handler: () => {
          if (playerState.playing) pause();
          else play();
        }
      },
      {
        key: 'ArrowLeft',
        description: 'Previous segment',
        handler: () => actions.skipToPreviousSegment?.()
      },
      {
        key: 'ArrowRight',
        description: 'Next segment',
        handler: () => actions.skipToNextSegment?.()
      },
      {
        key: 'ArrowUp',
        description: 'Increase repeat count',
        handler: () => {
          const current = playerState.repeatConfig.count;
          setRepeatCount(Math.min(current + 1, 20));
        }
      },
      {
        key: 'ArrowDown',
        description: 'Decrease repeat count',
        handler: () => {
          const current = playerState.repeatConfig.count;
          setRepeatCount(Math.max(current - 1, 1));
        }
      },
      {
        key: 'r',
        description: 'Restart current segment',
        handler: () => {
          if (playerState.currentSegmentIndex >= 0) {
            actions.playSegment?.(playerState.currentSegmentIndex);
          }
        }
      },
      {
        key: 'm',
        description: 'Mute/Unmute',
        handler: () => {
          if (playerState.muted) actions.unmute?.();
          else actions.mute?.();
        }
      },
      {
        key: 'ArrowLeft',
        shiftKey: true,
        description: 'Seek backward 5s',
        handler: () => {
          seekTo(Math.max(0, playerState.currentTime - 5));
        }
      },
      {
        key: 'ArrowRight',
        shiftKey: true,
        description: 'Seek forward 5s',
        handler: () => {
          seekTo(Math.min(playerState.duration, playerState.currentTime + 5));
        }
      },
      {
        key: '?',
        shiftKey: true,
        description: 'Show keyboard shortcuts',
        handler: () => {
          setShowSettings(true);
          setShowShortcutsHelp(true);
        },
        preventDefault: true
      },
      // Number keys 1-9 for quick repeat selection
      ...Array.from({ length: 9 }, (_, i) => ({
        key: String(i + 1),
        description: `Set repeat count to ${i + 1}`,
        handler: () => setRepeatCount(i + 1)
      }))
    ]
  });

  useEffect(() => {
    onTimeUpdate?.(playerState.currentTime);
  }, [playerState.currentTime, onTimeUpdate]);

  const previousPlayStateRef = useRef(playerState.playing);
  useEffect(() => {
    if (previousPlayStateRef.current !== playerState.playing) {
      previousPlayStateRef.current = playerState.playing;
      onPlayStateChange?.(playerState.playing);
    }
  }, [playerState.playing, onPlayStateChange]);

  const playingRef = useRef(playerState.playing);
  useEffect(() => {
    playingRef.current = playerState.playing;
  }, [playerState.playing]);

  const playerReadyRef = useRef(false);
  useEffect(() => {
    if (!isReady || !onPlayerReady || playerReadyRef.current) {
      return;
    }

    const togglePlayPause = () => {
      if (playingRef.current) {
        pause();
      } else {
        play();
      }
    };

    onPlayerReady(seekTo, togglePlayPause);
    playerReadyRef.current = true;
  }, [isReady, onPlayerReady, pause, play, seekTo]);

  useEffect(() => {
    playerReadyRef.current = false;
  }, [session.videoUrl]);

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
      {showVideo && (
        <div className="relative">
          <YouTubePlayerWithPlayer
            videoId={videoId}
            playerData={playerData as any}
            config={{
              height: 360,
              autoplay: false,
            }}
            onReady={() => {
              console.log('[EnhancedShadowingPlayer] Player ready');
            }}
            onPlay={() => {
              console.log('[EnhancedShadowingPlayer] Playing');
            }}
            onPause={() => {
              console.log('[EnhancedShadowingPlayer] Paused');
            }}
            onEnd={() => {
              console.log('[EnhancedShadowingPlayer] Video ended');
            }}
            onError={(error) => {
              console.error('[EnhancedShadowingPlayer] Error:', error);
            }}
            className="w-full"
          />

          {playerState.repeatConfig.enabled && playerState.repeatConfig.count > 1 && playerState.playing && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-500/90 backdrop-blur-sm text-white text-sm font-semibold rounded-lg z-10 flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              Repeat {Math.min(playerState.repeatConfig.currentRepeat + 1, playerState.repeatConfig.count)}/
              {playerState.repeatConfig.count}
            </div>
          )}

          <div className="absolute bottom-4 right-4 px-3 py-1 bg-dark-800/80 backdrop-blur-sm text-dark-300 text-xs rounded-lg z-10">
            {(practiceTime / 60).toFixed(1)} min
          </div>
        </div>
      )}

      {!showVideo && (
        <div className="bg-dark-800 rounded-xl p-8 text-center">
          <VideoOff className="w-16 h-16 text-dark-400 mx-auto mb-4" />
          <p className="text-dark-300 text-sm">Video player hidden</p>
        </div>
      )}

      {/* Floating Settings Button - Glassmorphism */}
      <button
        onClick={() => setShowSettings(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center p-4 bg-dark-800/70 hover:bg-dark-700/80 backdrop-blur-xl border border-white/20 dark:border-white/20 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 group"
        title="Player Settings"
      >
        <Settings className="w-6 h-6 text-primary-400 dark:text-primary-400 hover:text-primary-300 dark:hover:text-primary-300 transition-colors" />
      </button>

      {/* Compact Floating Settings Menu */}
      {showSettings && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[90] bg-transparent"
            onClick={() => setShowSettings(false)}
          />
          
          {/* Floating Menu */}
          <div className="fixed bottom-20 right-6 z-[100] w-80 max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="bg-dark-800/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary-400" />
                  <span className="text-sm font-semibold text-dark-50">Settings</span>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-dark-300 hover:text-dark-50 transition-colors p-1 hover:bg-white/10 rounded"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Compact Settings */}
              <div className="space-y-3">
                {/* Display Options */}
                {(showFurigana !== undefined || showGrammar !== undefined) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-dark-300 uppercase tracking-wide">Display</h4>
                    
                    {showFurigana !== undefined && onToggleFurigana && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-dark-100">Furigana</span>
                        <button
                          onClick={onToggleFurigana}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            showFurigana ? 'bg-primary-500' : 'bg-dark-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                              showFurigana ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    )}

                    {showGrammar !== undefined && onToggleGrammar && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-dark-100">Grammar Colors</span>
                          <button
                            onClick={onToggleGrammar}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              showGrammar ? 'bg-primary-500' : 'bg-dark-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                showGrammar ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {showGrammar && grammarMode && onGrammarModeChange && (
                          <div className="ml-4 space-y-2">
                            <div className="flex flex-wrap gap-1">
                              {[
                                { key: 'all', label: 'All' },
                                { key: 'content', label: 'Content' },
                                { key: 'grammar', label: 'Grammar' }
                              ].map(({ key, label }) => (
                                <button
                                  key={key}
                                  onClick={() => onGrammarModeChange(key as any)}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    grammarMode === key
                                      ? 'bg-primary-500 text-white'
                                      : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => setShowGrammarLegend(!showGrammarLegend)}
                              className={`text-xs px-2 py-1 rounded transition-colors ${
                                showGrammarLegend
                                  ? 'bg-primary-500 text-white'
                                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                              }`}
                            >
                              {showGrammarLegend ? 'Hide' : 'Show'} Legend
                            </button>
                            {showGrammarLegend && (
                              <div className="mt-2 p-2 bg-dark-900/50 rounded-lg">
                                <GrammarLegend />
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Repeat Controls */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-dark-300 uppercase tracking-wide">Repeat</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-dark-100">Count</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRepeatCount(Math.max(1, playerState.repeatConfig.count - 1))}
                          className="w-6 h-6 flex items-center justify-center bg-dark-700 hover:bg-dark-600 text-dark-200 rounded text-xs transition-colors"
                        >
                          -
                        </button>
                        <span className="text-sm font-mono text-dark-50 w-6 text-center">
                          {playerState.repeatConfig.count}
                        </span>
                        <button
                          onClick={() => setRepeatCount(Math.min(20, playerState.repeatConfig.count + 1))}
                          className="w-6 h-6 flex items-center justify-center bg-dark-700 hover:bg-dark-600 text-dark-200 rounded text-xs transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-dark-100">Pause</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPauseDuration(Math.max(500, playerState.repeatConfig.pauseDuration - 250))}
                          className="w-6 h-6 flex items-center justify-center bg-dark-700 hover:bg-dark-600 text-dark-200 rounded text-xs transition-colors"
                        >
                          -
                        </button>
                        <span className="text-xs font-mono text-dark-50 w-12 text-center">
                          {(playerState.repeatConfig.pauseDuration / 1000).toFixed(1)}s
                        </span>
                        <button
                          onClick={() => setPauseDuration(Math.min(3000, playerState.repeatConfig.pauseDuration + 250))}
                          className="w-6 h-6 flex items-center justify-center bg-dark-700 hover:bg-dark-600 text-dark-200 rounded text-xs transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>


                  </div>
                </div>

                {/* Keyboard Shortcuts - Desktop Only */}
                <div className="hidden sm:block space-y-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium text-dark-300 uppercase tracking-wide">Keyboard Shortcuts</h4>
                    <button
                      onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
                      className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      {showShortcutsHelp ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  {showShortcutsHelp && (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {getShortcutsHelp().map(({ keys, description }) => (
                        <div key={keys} className="flex justify-between items-center p-2 bg-dark-900/50 rounded text-xs gap-2">
                          <span className="text-dark-300 flex-1">{description}</span>
                          <kbd className="px-2 py-1 bg-dark-700 rounded border border-white/10 text-dark-50 font-mono text-[10px] whitespace-nowrap">
                            {keys}
                          </kbd>
                        </div>
                      ))}
                      <p className="text-dark-400 text-[10px] text-center pt-2 border-t border-white/5">
                        Press <kbd className="px-1 py-0.5 bg-dark-700 rounded border border-white/10 text-dark-50 font-mono">Shift + ?</kbd> to toggle
                      </p>
                    </div>
                  )}
                </div>

                {/* Session Management */}
                {onClearSession && (
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <h4 className="text-xs font-medium text-dark-300 uppercase tracking-wide">Session</h4>
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        setShowClearConfirmation(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-lg transition-colors text-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear Video
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Clear Video Confirmation Dialog */}
      <Dialog
        isOpen={showClearConfirmation}
        onClose={() => setShowClearConfirmation(false)}
        onConfirm={() => {
          onClearSession?.();
          setShowClearConfirmation(false);
        }}
        title="Clear Video Session?"
        message="Are you sure you want to clear the current video and return to the input screen? Your progress will be saved locally."
        confirmText="Yes, Clear"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
