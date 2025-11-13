'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import {
  ShadowingSession,
  ShadowingSentence,
  ShadowingRepeatConfig,
  ShadowingSettings,
  ShadowingTTSProvider,
  ShadowingTTSOptions
} from '../types';

interface UseShadowingSessionConfig {
  initialSentences: ShadowingSentence[];
  ttsProvider: ShadowingTTSProvider;
  settings: ShadowingSettings;
  onSettingsChange?: (settings: ShadowingSettings) => void;
  onComplete?: () => void;
}

export function useShadowingSession({
  initialSentences,
  ttsProvider,
  settings,
  onSettingsChange,
  onComplete
}: UseShadowingSessionConfig) {
  const { t } = useI18n();

  // Core session state
  const [session, setSession] = useState<ShadowingSession>({
    sentences: initialSentences,
    currentIndex: 0,
    repeatConfig: {
      enabled: false,
      count: 1,
      currentRepeat: 0,
      pauseDuration: 1000
    },
    isPlaying: false,
    isLoading: false,
    error: null
  });

  // Refs for avoiding closure issues in async operations
  const repeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentRepeatRef = useRef(0);
  const isPlayingSequenceRef = useRef(false);

  // Japanese sentence parser
  const parseSentences = useCallback((text: string): ShadowingSentence[] => {
    const sentenceRegex = /[^。！？]+[。！？]/g;
    const sentences: ShadowingSentence[] = [];
    let match;

    while ((match = sentenceRegex.exec(text)) !== null) {
      sentences.push({
        id: `sentence-${match.index}`,
        text: match[0].trim(),
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    // If no sentences found, treat the whole content as one sentence
    if (sentences.length === 0 && text.trim()) {
      sentences.push({
        id: 'sentence-0',
        text: text.trim(),
        startIndex: 0,
        endIndex: text.length
      });
    }

    return sentences;
  }, []);

  // Update sentences when initial data changes
  useEffect(() => {
    if (initialSentences.length > 0) {
      setSession(prev => ({
        ...prev,
        sentences: initialSentences,
        currentIndex: 0,
        error: null
      }));
    }
  }, [initialSentences]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (repeatTimeoutRef.current) {
        clearTimeout(repeatTimeoutRef.current);
      }
    };
  }, []);

  // Get current sentence
  const currentSentence = session.sentences[session.currentIndex];

  // Play current sentence with repeat logic
  const playCurrentSentence = useCallback(async () => {
    if (!currentSentence) {
      setSession(prev => ({ ...prev, error: t('shadowing.noSentence') }));
      return;
    }

    if (isPlayingSequenceRef.current) return; // Prevent double-play

    setSession(prev => ({ ...prev, isLoading: true, error: null }));
    isPlayingSequenceRef.current = true;

    try {
      // Enhanced repeat logic
      for (let i = 0; i < session.repeatConfig.count; i++) {
        // Update current repeat progress
        currentRepeatRef.current = i;
        setSession(prev => ({
          ...prev,
          repeatConfig: { ...prev.repeatConfig, currentRepeat: i },
          isPlaying: true,
          isLoading: false
        }));

        // Play the sentence
        const ttsOptions: ShadowingTTSOptions = {
          voice: settings.voice === 'female' ? 'ja-JP-Standard-A' : 'ja-JP-Standard-D',
          speed: settings.playbackSpeed
        };

        await ttsProvider.play(currentSentence.text, ttsOptions);

        // Add pause between repeats (except after last repeat)
        if (i < session.repeatConfig.count - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, session.repeatConfig.pauseDuration)
          );
        }
      }

      // Auto-advancement after completing all repeats
      if (session.currentIndex < session.sentences.length - 1) {
        setSession(prev => ({
          ...prev,
          currentIndex: prev.currentIndex + 1,
          repeatConfig: { ...prev.repeatConfig, currentRepeat: 0 },
          isPlaying: false
        }));
      } else {
        // Last sentence completed
        setSession(prev => ({ ...prev, isPlaying: false }));
        onComplete?.();
      }

    } catch (error) {
      console.error('[Shadowing] TTS playback error:', error);
      setSession(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : t('shadowing.playbackError'),
        isPlaying: false,
        isLoading: false
      }));
    } finally {
      isPlayingSequenceRef.current = false;
      currentRepeatRef.current = 0;
      setSession(prev => ({
        ...prev,
        repeatConfig: { ...prev.repeatConfig, currentRepeat: 0 },
        isLoading: false
      }));
    }
  }, [currentSentence, session.repeatConfig, session.currentIndex, session.sentences.length, settings, ttsProvider, t, onComplete]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (session.currentIndex < session.sentences.length - 1) {
      setSession(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
        repeatConfig: { ...prev.repeatConfig, currentRepeat: 0 },
        error: null
      }));
    }
  }, [session.currentIndex, session.sentences.length]);

  const handlePrevious = useCallback(() => {
    if (session.currentIndex > 0) {
      setSession(prev => ({
        ...prev,
        currentIndex: prev.currentIndex - 1,
        repeatConfig: { ...prev.repeatConfig, currentRepeat: 0 },
        error: null
      }));
    }
  }, [session.currentIndex]);

  const handleSentenceSelect = useCallback((index: number) => {
    if (index >= 0 && index < session.sentences.length) {
      ttsProvider.stop(); // Stop current playback
      setSession(prev => ({
        ...prev,
        currentIndex: index,
        repeatConfig: { ...prev.repeatConfig, currentRepeat: 0 },
        isPlaying: false,
        error: null
      }));
    }
  }, [session.sentences.length, ttsProvider]);

  // Playback controls
  const handlePlay = useCallback(() => {
    if (!session.isPlaying && !session.isLoading) {
      playCurrentSentence();
    }
  }, [session.isPlaying, session.isLoading, playCurrentSentence]);

  const handlePause = useCallback(() => {
    ttsProvider.stop();
    if (repeatTimeoutRef.current) {
      clearTimeout(repeatTimeoutRef.current);
    }
    setSession(prev => ({
      ...prev,
      isPlaying: false,
      isLoading: false
    }));
    isPlayingSequenceRef.current = false;
  }, [ttsProvider]);

  const handleStop = useCallback(() => {
    handlePause();
    setSession(prev => ({
      ...prev,
      repeatConfig: { ...prev.repeatConfig, currentRepeat: 0 }
    }));
  }, [handlePause]);

  // Repeat configuration
  const setRepeatCount = useCallback((count: number) => {
    const clampedCount = Math.max(1, Math.min(20, count));
    setSession(prev => ({
      ...prev,
      repeatConfig: {
        ...prev.repeatConfig,
        count: clampedCount,
        enabled: clampedCount > 1,
        currentRepeat: 0
      }
    }));
  }, []);

  const setPauseDuration = useCallback((duration: number) => {
    const clampedDuration = Math.max(500, Math.min(5000, duration));
    setSession(prev => ({
      ...prev,
      repeatConfig: {
        ...prev.repeatConfig,
        pauseDuration: clampedDuration
      }
    }));
  }, []);

  // Calculated values
  const progress = ((session.currentIndex + 1) / session.sentences.length) * 100;
  const canGoNext = session.currentIndex < session.sentences.length - 1;
  const canGoPrevious = session.currentIndex > 0;
  const isFirstSentence = session.currentIndex === 0;
  const isLastSentence = session.currentIndex === session.sentences.length - 1;

  return {
    // State
    session,
    currentSentence,
    progress,

    // Handlers
    handlers: {
      onPlay: handlePlay,
      onPause: handlePause,
      onNext: handleNext,
      onPrevious: handlePrevious,
      onRepeatCountChange: setRepeatCount,
      onPauseDurationChange: setPauseDuration,
      onSentenceSelect: handleSentenceSelect,
      onSettingsChange: onSettingsChange || (() => {}),
      onClose: onComplete || (() => {})
    },

    // Computed state
    canGoNext,
    canGoPrevious,
    isFirstSentence,
    isLastSentence,

    // Utils
    parseSentences
  };
}