'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
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
    ...playerConfig
  } = config;

  // Base YouTube player
  const { containerRef, playerRef, state: baseState, actions: baseActions, isReady } = useYouTubePlayer(videoId, playerConfig);

  // Repeat mode state
  const [repeatConfig, setRepeatConfig] = useState<RepeatModeConfig>({
    enabled: repeatCount > 1,
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

  // Find current segment based on time
  const getCurrentSegmentIndex = useCallback((time: number): number => {
    return transcript.findIndex((seg) => time >= seg.start && time <= seg.end);
  }, [transcript]);

  // Handle segment end and repeat logic
  useEffect(() => {
    if (!isReady || !baseState.playing || transcript.length === 0) return;
    if (isHandlingRepeatRef.current) return;

    const currentTime = baseState.currentTime;
    const segmentIndex = getCurrentSegmentIndex(currentTime);

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

    // Check if segment ended
    if (segmentIndex !== -1) {
      const segment = transcript[segmentIndex];
      const isAtEnd = currentTime >= segment.end - 0.1; // Small buffer

      if (isAtEnd && repeatConfig.count > 1 && repeatConfig.currentRepeat < repeatConfig.count - 1) {
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

        // Wait, then restart segment
        setTimeout(() => {
          if (playerRef.current && isReady) {
            baseActions.seekTo(segment.start);
            setRepeatConfig(prev => ({ ...prev, currentRepeat: prev.currentRepeat + 1 }));

            setTimeout(() => {
              baseActions.play();
              setIsPausingForRepeat(false);
              isHandlingRepeatRef.current = false;
            }, 100);
          }
        }, repeatConfig.pauseDuration);

      } else if (isAtEnd && (repeatConfig.count === 1 || repeatConfig.currentRepeat >= repeatConfig.count - 1)) {
        // Finished all repeats, move to next segment or stop
        if (segmentIndex < transcript.length - 1) {
          console.log(`[Repeat] Cycle complete for segment ${segmentIndex}, moving to next`);

          onRepeatCycleComplete?.(segmentIndex);

          const nextSegment = transcript[segmentIndex + 1];
          baseActions.seekTo(nextSegment.start);
          setCurrentSegmentIndex(segmentIndex + 1);
          setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
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
