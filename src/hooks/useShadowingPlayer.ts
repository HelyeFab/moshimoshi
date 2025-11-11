'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import {
  seekAndWaitForReady,
  calculateSegmentEndBuffer,
  calculateSegmentBuffers,
  detectVideoFrameRate,
  SegmentBufferCache,
  SeekRequestQueue,
  debugLogger,
} from '@/utils/youtubePlayerUtils';
import {
  YouTubePlayerConfig,
  TranscriptSegment,
  RepeatModeConfig,
  ShadowingPlayerState,
  ShadowingPlayerActions,
  SegmentPlaybackEvent,
} from '@/types/youtube-player';

interface UseShadowingPlayerConfig extends Partial<YouTubePlayerConfig> {
  transcript?: TranscriptSegment[];
  repeatCount?: number;
  pauseDuration?: number;
  onSegmentChange?: (index: number) => void;
  onSegmentComplete?: (event: SegmentPlaybackEvent) => void;
  onRepeatCycleComplete?: (segmentIndex: number) => void;
  enableBufferPreload?: boolean; // Enable predictive buffer preloading (default: true)
  preloadLeadTimeMs?: number;    // Time before pause ends to start preload (default: 500ms)
}

/**
 * Enhanced hook for shadowing player with repeat mode functionality
 * Extends useYouTubePlayer with Miraa-style repeat logic
 */
export function useShadowingPlayer(videoId: string, config: UseShadowingPlayerConfig = {}) {
  const {
    transcript = [],
    repeatCount: initialRepeatCount = 1,
    pauseDuration: initialPauseDuration = 1500,
    onSegmentChange,
    onSegmentComplete,
    onRepeatCycleComplete,
    enableBufferPreload = true,
    preloadLeadTimeMs = 500,
    ...playerConfig
  } = config;

  // Base YouTube player
  const { containerRef, playerRef, state: baseState, actions: baseActions, isReady } = useYouTubePlayer(videoId, playerConfig);

  // Repeat mode state
  const [repeatConfig, setRepeatConfig] = useState<RepeatModeConfig>({
    enabled: initialRepeatCount > 1,
    count: initialRepeatCount,
    currentRepeat: 0,
    pauseDuration: initialPauseDuration,
  });

  const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number>(-1);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [isInRepeatMode, setIsInRepeatMode] = useState(false);
  const [isPausingForRepeat, setIsPausingForRepeat] = useState(false);

  // Refs for avoiding closure issues
  const repeatConfigRef = useRef(repeatConfig);
  const currentSegmentIndexRef = useRef(currentSegmentIndex);
  const transcriptRef = useRef(transcript);
  const isHandlingRepeatRef = useRef(false);

  // Buffer cache for preloading optimization
  const bufferCacheRef = useRef(new SegmentBufferCache({ maxAge: 30000 }));

  // NEW: Seek request queue for debouncing and coalescing
  const seekQueueRef = useRef(new SeekRequestQueue({ debounceWindow: 150, coalesceTolerance: 0.5 }));

  // NEW: Video framerate detection (defaults to 30fps)
  const [videoFrameRate, setVideoFrameRate] = useState<number>(30);

  // Update refs when state changes
  useEffect(() => {
    repeatConfigRef.current = repeatConfig;
  }, [repeatConfig]);

  useEffect(() => {
    currentSegmentIndexRef.current = currentSegmentIndex;
  }, [currentSegmentIndex]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Sync repeat config when initial values change
  useEffect(() => {
    setRepeatConfig(prev => ({
      ...prev,
      enabled: initialRepeatCount > 1,
      count: initialRepeatCount,
    }));
  }, [initialRepeatCount]);

  useEffect(() => {
    setRepeatConfig(prev => ({
      ...prev,
      pauseDuration: initialPauseDuration,
    }));
  }, [initialPauseDuration]);

  // NEW: Detect video framerate when player is ready
  useEffect(() => {
    if (!isReady || !playerRef.current || !baseState.playing) return;

    let isMounted = true;

    detectVideoFrameRate(playerRef.current).then((fps) => {
      if (isMounted) {
        setVideoFrameRate(fps);
        debugLogger.segmentDetection(`Video framerate detected: ${fps}fps`);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isReady, playerRef, baseState.playing]);

  // Find current segment based on time with dynamic buffer
  // Buffer adapts to segment duration and playback rate for precise detection
  const getCurrentSegmentIndex = useCallback((time: number): number => {
    const playbackRate = baseState.playbackRate || 1.0;

    return transcript.findIndex((seg) => {
      const duration = seg.end - seg.start;
      const buffer = calculateSegmentEndBuffer(duration, playbackRate);
      return time >= seg.start && time <= seg.end + buffer;
    });
  }, [transcript, baseState.playbackRate]);

  // Handle segment end and repeat logic
  useEffect(() => {
    if (!isReady || !baseState.playing || transcript.length === 0) return;
    if (isHandlingRepeatRef.current) return;

    const currentTime = baseState.currentTime;
    const segmentIndex = getCurrentSegmentIndex(currentTime);

    // DEBUG: Log current time and segment info (using debugLogger)
    if (segmentIndex !== -1) {
      const segment = transcript[segmentIndex];
      debugLogger.segmentDetection(
        `Time: ${currentTime.toFixed(2)}s, Segment: ${segmentIndex}, End: ${segment.end.toFixed(2)}s, Gap: ${(segment.end - currentTime).toFixed(2)}s`
      );
    }

    // Update current segment if changed
    if (segmentIndex !== currentSegmentIndex && segmentIndex !== -1) {
      setCurrentSegmentIndex(segmentIndex);
      setActiveSegmentId(transcript[segmentIndex]?.start.toString() || null);
      onSegmentChange?.(segmentIndex);

      // Reset repeat count when entering new segment
      if (repeatConfig.count > 1) {
        setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
        setIsInRepeatMode(true);
      }
    }

    // NEW: Check segment end using two-tier buffer system for precision
    if (segmentIndex !== -1) {
      const segment = transcript[segmentIndex];
      const duration = segment.end - segment.start;
      const playbackRate = baseState.playbackRate || 1.0;

      // Calculate both detection and trigger buffers using frame-aware system
      const { detectionBuffer, triggerBuffer } = calculateSegmentBuffers(
        duration,
        playbackRate,
        videoFrameRate
      );

      const isApproachingEnd = currentTime >= segment.end - detectionBuffer;
      const isAtEnd = currentTime >= segment.end - triggerBuffer;

      debugLogger.segmentDetection(
        `Detection: approaching=${isApproachingEnd}, atEnd=${isAtEnd}, ` +
        `detectBuf=${detectionBuffer.toFixed(3)}s, triggerBuf=${triggerBuffer.toFixed(3)}s, ` +
        `count=${repeatConfig.count}, repeat=${repeatConfig.currentRepeat}`
      );

      const shouldRepeat = isAtEnd && repeatConfig.count > 1 && repeatConfig.currentRepeat < repeatConfig.count - 1;
      const shouldMoveNext = isAtEnd && (repeatConfig.count === 1 || repeatConfig.currentRepeat >= repeatConfig.count - 1);

      debugLogger.segmentDetection(
        `Decision: shouldRepeat=${shouldRepeat}, shouldMoveNext=${shouldMoveNext}`
      );

      if (shouldRepeat) {
        // Need to repeat this segment
        isHandlingRepeatRef.current = true;
        setIsPausingForRepeat(true);
        baseActions.pause();

        debugLogger.segmentDetection(
          `Segment ended. Repeat ${repeatConfig.currentRepeat + 1}/${repeatConfig.count}`
        );

        // Notify segment complete
        onSegmentComplete?.({
          segmentIndex,
          repeatNumber: repeatConfig.currentRepeat + 1,
          totalRepeats: repeatConfig.count,
          isLastRepeat: repeatConfig.currentRepeat + 1 === repeatConfig.count,
        });

        // Preload next segment's buffer during pause (if enabled)
        const pauseDuration = repeatConfig.pauseDuration;
        const hasTimeToPreload = pauseDuration > preloadLeadTimeMs + 500;

        if (enableBufferPreload && hasTimeToPreload && segmentIndex < transcript.length - 1) {
          const nextSegmentIndex = segmentIndex + 1;
          const bufferCache = bufferCacheRef.current;

          // Only preload if not already buffered
          if (!bufferCache.isLikelyBuffered(nextSegmentIndex)) {
            setTimeout(() => {
              if (!playerRef.current) return;

              const nextSegment = transcript[nextSegmentIndex];
              debugLogger.bufferPreload(`Preloading segment ${nextSegmentIndex} at ${nextSegment.start}s`);

              // Quick seek to next segment to trigger YouTube buffer
              playerRef.current.seekTo(nextSegment.start, true);

              // Mark as buffered in cache
              bufferCache.markBuffered(nextSegmentIndex);

              // Immediately seek back to current segment start (buffer persists)
              setTimeout(() => {
                if (playerRef.current) {
                  playerRef.current.seekTo(segment.start, true);
                }
              }, 100);
            }, preloadLeadTimeMs);
          }
        }

        // Wait for pause duration, then smart seek and play
        setTimeout(async () => {
          if (!playerRef.current || !isReady) {
            isHandlingRepeatRef.current = false;
            return;
          }

          try {
            // Smart seek with buffering detection
            const { success, waitedMs } = await seekAndWaitForReady(
              playerRef.current,
              segment.start,
              {
                maxWaitMs: 3000,
                pollIntervalMs: 50,
                priority: 'normal',  // NEW: Repeat seeks are normal priority
                onProgress: (elapsed) => {
                  if (elapsed > 1000) {
                    debugLogger.seekPerformance(`Slow seek: ${elapsed}ms`);
                  }
                }
              }
            );

            debugLogger.seekPerformance(`Seek completed in ${waitedMs}ms, success: ${success}`);

            // Update repeat count
            setRepeatConfig(prev => ({ ...prev, currentRepeat: prev.currentRepeat + 1 }));

            // Play immediately after seek is ready
            baseActions.play();
            setIsPausingForRepeat(false);
            isHandlingRepeatRef.current = false;

            // Notify with performance tracking
            if (onSegmentComplete) {
              onSegmentComplete({
                segmentIndex,
                repeatNumber: repeatConfig.currentRepeat + 2, // +2 because we just incremented
                totalRepeats: repeatConfig.count,
                isLastRepeat: false,
                seekDurationMs: waitedMs,
                wasSeekSlow: waitedMs > 1000,
              });
            }

          } catch (error) {
            debugLogger.seekPerformance('Smart seek failed, falling back', error);
            // Fallback to old behavior
            baseActions.seekTo(segment.start);
            setRepeatConfig(prev => ({ ...prev, currentRepeat: prev.currentRepeat + 1 }));
            setTimeout(() => {
              baseActions.play();
              setIsPausingForRepeat(false);
              isHandlingRepeatRef.current = false;
            }, 100);
          }
        }, repeatConfig.pauseDuration);

      } else if (shouldMoveNext) {
        // Finished all repeats, move to next segment or stop
        if (segmentIndex < transcript.length - 1) {
          debugLogger.segmentDetection(`Cycle complete for segment ${segmentIndex}, moving to next ${segmentIndex + 1}`);

          // Set lock to prevent re-triggering during transition
          isHandlingRepeatRef.current = true;

          onRepeatCycleComplete?.(segmentIndex);

          const nextSegment = transcript[segmentIndex + 1];
          const nextIndex = segmentIndex + 1;

          // Use async smart seek to ensure we're at the next segment before continuing
          (async () => {
            try {
              await seekAndWaitForReady(playerRef.current, nextSegment.start, {
                maxWaitMs: 2000,
                pollIntervalMs: 50,
                priority: 'normal'  // NEW: Transition seeks are normal priority
              });

              debugLogger.segmentDetection(`Successfully moved to segment ${nextIndex}`);

              // Update segment index and reset repeat count AFTER seek completes
              setCurrentSegmentIndex(nextIndex);
              currentSegmentIndexRef.current = nextIndex;
              setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
              repeatConfigRef.current = { ...repeatConfigRef.current, currentRepeat: 0 };

              // Release lock after a delay to allow currentTime to update
              // This prevents re-detection of the old segment
              setTimeout(() => {
                isHandlingRepeatRef.current = false;
              }, 150);
            } catch (error) {
              debugLogger.segmentDetection('Failed to move to next segment', error);
              // Fallback
              baseActions.seekTo(nextSegment.start);
              setCurrentSegmentIndex(nextIndex);
              currentSegmentIndexRef.current = nextIndex;
              setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
              repeatConfigRef.current = { ...repeatConfigRef.current, currentRepeat: 0 };

              setTimeout(() => {
                isHandlingRepeatRef.current = false;
              }, 300);
            }
          })();
        } else {
          // Last segment, stop playing
          debugLogger.segmentDetection('Last segment complete, stopping');
          baseActions.pause();
          setIsInRepeatMode(false);
        }
      }
    }
  }, [
    isReady,
    baseState.playing,
    baseState.currentTime,
    transcript,
    currentSegmentIndex,
    repeatConfig,
    baseActions,
    playerRef,
    getCurrentSegmentIndex,
    onSegmentChange,
    onSegmentComplete,
    onRepeatCycleComplete,
  ]);

  // Miraa-style repeat count handler
  const setRepeatCount = useCallback((newCount: number) => {
    const clampedCount = Math.max(1, Math.min(20, newCount));
    const oldCount = repeatConfigRef.current.count;
    const currentRep = repeatConfigRef.current.currentRepeat;

    debugLogger.segmentDetection(`Changing repeat count from ${oldCount} to ${clampedCount}, currently on repeat ${currentRep + 1}`);

    setRepeatConfig(prev => ({ ...prev, count: clampedCount, enabled: clampedCount > 1 }));

    // Handle Miraa-style logic during active playback
    if (baseState.playing && isInRepeatMode) {
      if (clampedCount < oldCount && currentRep >= clampedCount) {
        // Already past new limit, advance to next segment
        debugLogger.segmentDetection(`Current repeat (${currentRep + 1}) exceeds new count (${clampedCount}), advancing`);

        const nextIndex = currentSegmentIndexRef.current + 1;
        if (nextIndex < transcriptRef.current.length && playerRef.current) {
          const nextSegment = transcriptRef.current[nextIndex];

          // Use seek queue with high priority (user-initiated repeat count change)
          seekQueueRef.current.enqueue(playerRef.current, nextSegment.start, {
            priority: 'high',
            maxWaitMs: 2000
          }).then(() => {
            setCurrentSegmentIndex(nextIndex);
            setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
            onSegmentChange?.(nextIndex);
          }).catch(() => {
            // Fallback
            baseActions.seekTo(nextSegment.start);
            setCurrentSegmentIndex(nextIndex);
            setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
            onSegmentChange?.(nextIndex);
          });
        }
      }
    }
  }, [baseState.playing, isInRepeatMode, baseActions, onSegmentChange]);

  const setPauseDuration = useCallback((duration: number) => {
    const clampedDuration = Math.max(500, Math.min(3000, duration));
    setRepeatConfig(prev => ({ ...prev, pauseDuration: clampedDuration }));
  }, []);

  // NEW: User-initiated seeks use the seek queue with HIGH priority
  const skipToNextSegment = useCallback(async () => {
    const nextIndex = currentSegmentIndex + 1;
    if (nextIndex < transcript.length && playerRef.current) {
      const nextSegment = transcript[nextIndex];

      try {
        // Use seek queue with high priority (user-initiated)
        await seekQueueRef.current.enqueue(playerRef.current, nextSegment.start, {
          priority: 'high',
          maxWaitMs: 2000
        });

        setCurrentSegmentIndex(nextIndex);
        setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
        onSegmentChange?.(nextIndex);
      } catch (error) {
        // Fallback to direct seek if queue fails
        debugLogger.seekPerformance('Seek queue failed, using direct seek', error);
        baseActions.seekTo(nextSegment.start);
        setCurrentSegmentIndex(nextIndex);
        setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
        onSegmentChange?.(nextIndex);
      }
    }
  }, [currentSegmentIndex, transcript, playerRef, baseActions, onSegmentChange]);

  const skipToPreviousSegment = useCallback(async () => {
    const prevIndex = currentSegmentIndex - 1;
    if (prevIndex >= 0 && playerRef.current) {
      const prevSegment = transcript[prevIndex];

      try {
        // Use seek queue with high priority (user-initiated)
        await seekQueueRef.current.enqueue(playerRef.current, prevSegment.start, {
          priority: 'high',
          maxWaitMs: 2000
        });

        setCurrentSegmentIndex(prevIndex);
        setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
        onSegmentChange?.(prevIndex);
      } catch (error) {
        // Fallback to direct seek if queue fails
        debugLogger.seekPerformance('Seek queue failed, using direct seek', error);
        baseActions.seekTo(prevSegment.start);
        setCurrentSegmentIndex(prevIndex);
        setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
        onSegmentChange?.(prevIndex);
      }
    }
  }, [currentSegmentIndex, transcript, playerRef, baseActions, onSegmentChange]);

  const playSegment = useCallback(async (index: number) => {
    if (index >= 0 && index < transcript.length && playerRef.current) {
      const segment = transcript[index];

      try {
        // Use seek queue with high priority (user-initiated)
        await seekQueueRef.current.enqueue(playerRef.current, segment.start, {
          priority: 'high',
          maxWaitMs: 2000
        });

        setCurrentSegmentIndex(index);
        setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
        onSegmentChange?.(index);
        if (!baseState.playing) {
          baseActions.play();
        }
      } catch (error) {
        // Fallback to direct seek if queue fails
        debugLogger.seekPerformance('Seek queue failed, using direct seek', error);
        baseActions.seekTo(segment.start);
        setCurrentSegmentIndex(index);
        setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
        onSegmentChange?.(index);
        if (!baseState.playing) {
          baseActions.play();
        }
      }
    }
  }, [transcript, playerRef, baseActions, baseState.playing, onSegmentChange]);

  const stopRepeats = useCallback(() => {
    setIsInRepeatMode(false);
    setIsPausingForRepeat(false);
    setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
    isHandlingRepeatRef.current = false;
  }, []);

  // Extended state
  const extendedState: ShadowingPlayerState = {
    ...baseState,
    isInRepeatMode,
    isPausingForRepeat,
    repeatConfig,
    currentSegmentIndex,
    activeSegmentId,
  };

  // Extended actions
  const extendedActions: ShadowingPlayerActions = {
    ...baseActions,
    setRepeatCount,
    setPauseDuration,
    skipToNextSegment,
    skipToPreviousSegment,
    playSegment,
    stopRepeats,
  };

  return {
    containerRef,
    playerRef,
    state: extendedState,
    actions: extendedActions,
    isReady,
  };
}
