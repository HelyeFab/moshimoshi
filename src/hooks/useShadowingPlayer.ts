'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { seekAndWaitForReady, calculateSegmentEndBuffer, SegmentBufferCache } from '@/utils/youtubePlayerUtils';
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

    // DEBUG: Log current time and segment info
    if (segmentIndex !== -1) {
      const segment = transcript[segmentIndex];
      console.log('[Repeat Debug] Time:', currentTime.toFixed(2), 'Segment:', segmentIndex, 'End:', segment.end.toFixed(2), 'Gap:', (segment.end - currentTime).toFixed(2));
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

    // Check if segment ended with dynamic buffer for precise detection
    if (segmentIndex !== -1) {
      const segment = transcript[segmentIndex];
      const duration = segment.end - segment.start;
      const playbackRate = baseState.playbackRate || 1.0;
      // Use tighter buffer (2% instead of 5%) for end detection
      const endBuffer = calculateSegmentEndBuffer(duration, playbackRate, { bufferRatio: 0.02 });
      const isAtEnd = currentTime >= segment.end - endBuffer;

      console.log('[Repeat Debug] isAtEnd:', isAtEnd, 'repeatConfig.count:', repeatConfig.count, 'currentRepeat:', repeatConfig.currentRepeat);

      const shouldRepeat = isAtEnd && repeatConfig.count > 1 && repeatConfig.currentRepeat < repeatConfig.count - 1;
      const shouldMoveNext = isAtEnd && (repeatConfig.count === 1 || repeatConfig.currentRepeat >= repeatConfig.count - 1);

      console.log('[Repeat Debug] shouldRepeat:', shouldRepeat, 'shouldMoveNext:', shouldMoveNext);

      if (shouldRepeat) {
        // Need to repeat this segment
        isHandlingRepeatRef.current = true;
        setIsPausingForRepeat(true);
        baseActions.pause();

        console.log(
          `[Repeat] Segment ended. Repeat ${repeatConfig.currentRepeat + 1}/${repeatConfig.count}`
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
              console.log(`[BufferPreload] Preloading segment ${nextSegmentIndex} at ${nextSegment.start}s`);

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
                onProgress: (elapsed) => {
                  if (elapsed > 1000) {
                    console.warn(`[Repeat] Slow seek: ${elapsed}ms`);
                  }
                }
              }
            );

            console.log(`[Repeat] Seek completed in ${waitedMs}ms, success: ${success}`);

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
            console.error('[Repeat] Smart seek failed, falling back:', error);
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
          console.log(`[Repeat] Cycle complete for segment ${segmentIndex}, moving to next`);

          // Set lock to prevent re-triggering during transition
          isHandlingRepeatRef.current = true;

          onRepeatCycleComplete?.(segmentIndex);

          const nextSegment = transcript[segmentIndex + 1];
          const nextIndex = segmentIndex + 1;

          baseActions.seekTo(nextSegment.start);
          setCurrentSegmentIndex(nextIndex);
          currentSegmentIndexRef.current = nextIndex; // Update ref immediately to prevent re-trigger
          setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
          repeatConfigRef.current = { ...repeatConfigRef.current, currentRepeat: 0 }; // Update ref too

          // Release lock after a short delay to allow seek to complete
          setTimeout(() => {
            isHandlingRepeatRef.current = false;
          }, 300);
        } else {
          // Last segment, stop playing
          console.log('[Repeat] Last segment complete, stopping');
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

    console.log(`[RepeatCount] Changing from ${oldCount} to ${clampedCount}, currently on repeat ${currentRep + 1}`);

    setRepeatConfig(prev => ({ ...prev, count: clampedCount, enabled: clampedCount > 1 }));

    // Handle Miraa-style logic during active playback
    if (baseState.playing && isInRepeatMode) {
      if (clampedCount < oldCount && currentRep >= clampedCount) {
        // Already past new limit, advance to next segment
        console.log(`[RepeatCount] Current repeat (${currentRep + 1}) exceeds new count (${clampedCount}), advancing`);

        const nextIndex = currentSegmentIndexRef.current + 1;
        if (nextIndex < transcriptRef.current.length) {
          const nextSegment = transcriptRef.current[nextIndex];
          baseActions.seekTo(nextSegment.start);
          setCurrentSegmentIndex(nextIndex);
          setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
          onSegmentChange?.(nextIndex);
        }
      }
    }
  }, [baseState.playing, isInRepeatMode, baseActions, onSegmentChange]);

  const setPauseDuration = useCallback((duration: number) => {
    const clampedDuration = Math.max(500, Math.min(3000, duration));
    setRepeatConfig(prev => ({ ...prev, pauseDuration: clampedDuration }));
  }, []);

  const skipToNextSegment = useCallback(() => {
    const nextIndex = currentSegmentIndex + 1;
    if (nextIndex < transcript.length) {
      const nextSegment = transcript[nextIndex];
      baseActions.seekTo(nextSegment.start);
      setCurrentSegmentIndex(nextIndex);
      setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
      onSegmentChange?.(nextIndex);
    }
  }, [currentSegmentIndex, transcript, baseActions, onSegmentChange]);

  const skipToPreviousSegment = useCallback(() => {
    const prevIndex = currentSegmentIndex - 1;
    if (prevIndex >= 0) {
      const prevSegment = transcript[prevIndex];
      baseActions.seekTo(prevSegment.start);
      setCurrentSegmentIndex(prevIndex);
      setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
      onSegmentChange?.(prevIndex);
    }
  }, [currentSegmentIndex, transcript, baseActions, onSegmentChange]);

  const playSegment = useCallback((index: number) => {
    if (index >= 0 && index < transcript.length) {
      const segment = transcript[index];
      baseActions.seekTo(segment.start);
      setCurrentSegmentIndex(index);
      setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
      onSegmentChange?.(index);
      if (!baseState.playing) {
        baseActions.play();
      }
    }
  }, [transcript, baseActions, baseState.playing, onSegmentChange]);

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
