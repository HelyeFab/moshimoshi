'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTTS } from '@/hooks/useTTS';
import { TTSOptions } from '@/lib/tts/types';
import { RepeatModeConfig } from '@/types/youtube-player';
import { useI18n } from '@/i18n/I18nContext';
import {
  X,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Settings,
  Bookmark,
  Volume2
} from 'lucide-react';

interface UnifiedShadowingModeProps {
  sentences: string[];
  title?: string;
  contentId?: string;
  contentType?: 'article' | 'story';
  audioSpeed?: number;
  showFurigana?: boolean;
  highlightGrammar?: boolean;
  highlightMode?: 'none' | 'all' | 'content' | 'grammar';
  onClose: () => void;
  onBookmarkSentence?: (sentence: string, index: number) => void;
}

interface SentenceData {
  text: string;
  furiganaHtml?: string;
  translation?: string;
}

export default function UnifiedShadowingMode({
  sentences: rawSentences,
  title,
  contentId,
  contentType = 'article',
  audioSpeed: initialSpeed = 1.0,
  showFurigana: initialShowFurigana = false,
  highlightGrammar = false,
  highlightMode = 'none',
  onClose,
  onBookmarkSentence
}: UnifiedShadowingModeProps) {
  const { t } = useI18n();

  // State
  const [sentences, setSentences] = useState<SentenceData[]>(
    rawSentences.map(text => ({ text }))
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Settings state
  const [audioSpeed, setAudioSpeed] = useState(initialSpeed);
  const [showFurigana, setShowFurigana] = useState(initialShowFurigana);
  const [loadingFurigana, setLoadingFurigana] = useState(false);
  const [voice, setVoice] = useState<'male' | 'female'>('female');

  // Debug: Log when settings change
  useEffect(() => {
    console.log('[Shadowing] Settings updated:', { voice, audioSpeed });
  }, [voice, audioSpeed]);

  // Repeat configuration
  const [repeatConfig, setRepeatConfig] = useState<RepeatModeConfig>({
    enabled: true,
    count: 3,
    currentRepeat: 0,
    pauseDuration: 1000,
  });

  // Refs
  const repeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handlePlayRef = useRef<(() => Promise<void>) | null>(null);

  // Handle audio playback completion
  const handleAudioEnd = useCallback(() => {
    const currentRepeatValue = repeatConfig.currentRepeat;

    if (currentRepeatValue < repeatConfig.count - 1) {
      // More repeats to go
      const nextRepeat = currentRepeatValue + 1;
      setRepeatConfig(prev => ({ ...prev, currentRepeat: nextRepeat }));

      // Pause before repeating
      repeatTimeoutRef.current = setTimeout(() => {
        if (handlePlayRef.current) {
          handlePlayRef.current();
        }
      }, repeatConfig.pauseDuration);
    } else {
      // Done with repeats
      setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
      setIsPlayingSequence(false);

      // Auto-advance to next sentence
      if (currentIndex < sentences.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // Last sentence completed - close shadowing mode
        onClose();
      }
    }
  }, [repeatConfig.currentRepeat, repeatConfig.count, repeatConfig.pauseDuration, currentIndex, sentences.length, onClose]);

  // Initialize useTTS with proper callbacks
  const {
    play: playTTS,
    stop: stopTTS,
    preload,
    loading: ttsLoading,
    playing: ttsPlaying
  } = useTTS({
    cacheFirst: true,
    onEnd: handleAudioEnd,
    onError: (err) => {
      console.error('[Shadowing] TTS error:', err);
      setIsPlayingSequence(false);
    }
  });

  // Preload first few sentences on mount
  useEffect(() => {
    if (sentences.length > 0) {
      const preloadCount = Math.min(3, sentences.length);
      const textsToPreload = sentences.slice(0, preloadCount).map(s => s.text);
      preload(textsToPreload, {
        voice: voice === 'female' ? 'ja-JP-NanamiNeural' : 'ja-JP-KeitaNeural',
        speed: audioSpeed,
        rate: audioSpeed // Compatibility with both speed and rate parameters
      });
    }
  }, [voice, audioSpeed]); // Only on mount and when voice/speed changes

  // Cleanup
  useEffect(() => {
    return () => {
      stopTTS();
      if (repeatTimeoutRef.current) {
        clearTimeout(repeatTimeoutRef.current);
      }
    };
  }, [stopTTS]);

  // Generate furigana for current sentence when showFurigana is enabled
  useEffect(() => {
    const generateCurrentSentenceFurigana = async () => {
      if (!showFurigana || !sentences[currentIndex] || sentences[currentIndex].furiganaHtml) {
        return;
      }

      setLoadingFurigana(true);
      try {
        const response = await fetch('/api/furigana', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: sentences[currentIndex].text })
        });

        if (response.ok) {
          const data = await response.json();
          setSentences(prev => prev.map((sentence, index) =>
            index === currentIndex
              ? { ...sentence, furiganaHtml: data.result }
              : sentence
          ));
        }
      } catch (error) {
        console.error('Failed to generate furigana:', error);
      } finally {
        setLoadingFurigana(false);
      }
    };

    if (showFurigana) {
      generateCurrentSentenceFurigana();
    }
  }, [showFurigana, currentIndex, sentences]);

  // Play current sentence
  const handlePlay = useCallback(async () => {
    if (isPlayingSequence || ttsLoading) return;

    setIsPlayingSequence(true);
    const sentence = sentences[currentIndex];

    console.log('[Shadowing] Playing with settings:', { voice, audioSpeed, text: sentence.text.substring(0, 30) });

    try {
      await playTTS(sentence.text, {
        voice: voice === 'female' ? 'ja-JP-NanamiNeural' : 'ja-JP-KeitaNeural',
        speed: audioSpeed,
        rate: audioSpeed // Compatibility with both speed and rate parameters
      });
    } catch (error) {
      console.error('TTS playback error:', error);
      setIsPlayingSequence(false);
      setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
    }
  }, [isPlayingSequence, ttsLoading, sentences, currentIndex, voice, audioSpeed, playTTS]);

  // Update the ref whenever handlePlay changes
  useEffect(() => {
    handlePlayRef.current = handlePlay;
  }, [handlePlay]);

  const handleStop = () => {
    stopTTS();
    if (repeatTimeoutRef.current) {
      clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    setIsPlayingSequence(false);
    setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }));
  };

  // Navigation handlers
  const handleNext = useCallback(() => {
    handleStop();
    if (currentIndex < sentences.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);

      // Preload next sentence
      if (sentences[newIndex]) {
        preload([sentences[newIndex].text], {
          voice: voice === 'female' ? 'ja-JP-NanamiNeural' : 'ja-JP-KeitaNeural',
          speed: audioSpeed,
          rate: audioSpeed
        });
      }
    }
  }, [currentIndex, sentences, voice, audioSpeed, preload]);

  const handlePrevious = () => {
    handleStop();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Repeat configuration handlers
  const setRepeatCount = (newCount: number) => {
    const clampedCount = Math.max(1, Math.min(20, newCount));
    setRepeatConfig(prev => ({
      ...prev,
      count: clampedCount,
      enabled: clampedCount > 1,
      currentRepeat: 0
    }));
  };

  const setPauseDuration = (duration: number) => {
    const clampedDuration = Math.max(500, Math.min(3000, duration));
    setRepeatConfig(prev => ({ ...prev, pauseDuration: clampedDuration }));
  };

  const handleBookmark = () => {
    if (onBookmarkSentence) {
      onBookmarkSentence(sentences[currentIndex].text, currentIndex);
    }
  };

  const currentSentence = sentences[currentIndex];

  return (
    <div
      className="fixed inset-0 z-30 overflow-y-auto animate-fade-in"
      style={{ backgroundColor: 'var(--article-bg)' }}
    >
      <div className="min-h-screen w-full relative">
        {/* Header - Close and Settings Buttons */}
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="rounded-full p-3 transition-all duration-200 hover:scale-110 shadow-lg"
            style={{
              backgroundColor: 'var(--article-hover-bg)',
              color: 'var(--article-text-secondary)'
            }}
            title="Settings"
          >
            <Settings className="w-6 h-6" />
          </button>
          <button
            onClick={onClose}
            className="rounded-full p-3 transition-all duration-200 hover:scale-110 shadow-lg"
            style={{
              backgroundColor: 'var(--article-hover-bg)',
              color: 'var(--article-text-secondary)'
            }}
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto p-6 pt-16 pb-32">
          {/* Settings Panel */}
          {showSettings && (
            <div
              className="mb-8 p-6 rounded-2xl shadow-lg animate-fade-in"
              style={{
                backgroundColor: 'var(--article-content-bg)',
                border: '1px solid var(--article-border)'
              }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--article-text)' }}>
                Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Voice Selection */}
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--article-text-secondary)' }}>
                    Voice
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVoice('male')}
                      className="flex-1 px-4 py-2 rounded-lg font-medium transition-all"
                      style={{
                        backgroundColor: voice === 'male'
                          ? 'rgb(var(--palette-primary-500))'
                          : 'var(--article-accent-bg)',
                        color: voice === 'male' ? 'white' : 'var(--article-text)'
                      }}
                    >
                      Male
                    </button>
                    <button
                      onClick={() => setVoice('female')}
                      className="flex-1 px-4 py-2 rounded-lg font-medium transition-all"
                      style={{
                        backgroundColor: voice === 'female'
                          ? 'rgb(var(--palette-primary-500))'
                          : 'var(--article-accent-bg)',
                        color: voice === 'female' ? 'white' : 'var(--article-text)'
                      }}
                    >
                      Female
                    </button>
                  </div>
                </div>

                {/* Speed Control */}
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--article-text-secondary)' }}>
                    Speed: {audioSpeed.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={audioSpeed}
                    onChange={(e) => setAudioSpeed(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--article-text-secondary)' }}>
                    <span>0.5x</span>
                    <span>2.0x</span>
                  </div>
                </div>

                {/* Furigana Toggle */}
                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showFurigana}
                      onChange={(e) => setShowFurigana(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--article-text)' }}>
                        Show Furigana
                      </span>
                      <p className="text-xs" style={{ color: 'var(--article-text-secondary)' }}>
                        Display reading hints above kanji characters
                      </p>
                    </div>
                    {loadingFurigana && (
                      <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          <div className="mb-8">
            <div className="flex justify-between text-sm mb-3">
              <span style={{ color: 'var(--article-text-secondary)' }}>
                Sentence {currentIndex + 1} / {sentences.length}
              </span>
              <span style={{ color: 'var(--article-text-secondary)' }}>
                {Math.round(((currentIndex + 1) / sentences.length) * 100)}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--article-accent-bg)' }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${((currentIndex + 1) / sentences.length) * 100}%`,
                  backgroundColor: 'rgb(var(--palette-primary-500))'
                }}
              />
            </div>
          </div>

          {/* Current Sentence */}
          <div
            className="mb-10 p-10 rounded-3xl shadow-lg relative"
            style={{
              backgroundColor: 'var(--article-content-bg)',
              border: '1px solid var(--article-border)'
            }}
          >
            {onBookmarkSentence && (
              <button
                onClick={handleBookmark}
                className="absolute top-4 right-4 p-2 rounded-lg transition-colors hover:scale-110"
                style={{
                  color: 'var(--article-text-secondary)'
                }}
                title="Bookmark this sentence"
              >
                <Bookmark className="w-5 h-5" />
              </button>
            )}

            <div className="text-center mb-4">
              <span
                className="text-sm font-medium px-3 py-1 rounded-full"
                style={{
                  backgroundColor: 'rgb(var(--palette-primary-500) / 0.1)',
                  color: 'rgb(var(--palette-primary-600))'
                }}
              >
                Sentence {currentIndex + 1} of {sentences.length}
              </span>
            </div>

            <div className="text-center" style={{ fontSize: '2rem' }}>
              {showFurigana && currentSentence.furiganaHtml ? (
                <div
                  dangerouslySetInnerHTML={{ __html: currentSentence.furiganaHtml }}
                  className="japanese-text text-center font-medium"
                  style={{
                    lineHeight: 'var(--line-height-article-furigana)',
                    color: 'var(--article-text)'
                  }}
                />
              ) : (
                <div
                  className="japanese-text text-center font-medium"
                  style={{
                    lineHeight: 'var(--line-height-article-base)',
                    color: 'var(--article-text)'
                  }}
                >
                  {currentSentence.text}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-6">
            {/* Repeat Count */}
            <div className="flex flex-col items-center gap-4">
              <span className="text-lg font-semibold" style={{ color: 'var(--article-text)' }}>
                Repeat Count
              </span>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setRepeatCount(repeatConfig.count - 1)}
                  disabled={repeatConfig.count <= 1}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: repeatConfig.count <= 1
                      ? 'var(--article-accent-bg)'
                      : 'rgb(var(--palette-primary-500) / 0.1)',
                    color: repeatConfig.count <= 1
                      ? 'var(--article-text-secondary)'
                      : 'rgb(var(--palette-primary-600))'
                  }}
                >
                  <ChevronDown className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center">
                  <div className="text-4xl font-bold tabular-nums" style={{ color: 'rgb(var(--palette-primary-600))' }}>
                    {repeatConfig.count}
                  </div>
                  <div className="text-xs font-medium" style={{ color: 'var(--article-text-secondary)' }}>
                    {repeatConfig.count === 1 ? 'time' : 'times'}
                  </div>
                  {isPlayingSequence && repeatConfig.count > 1 && (
                    <div className="text-xs mt-1" style={{ color: 'rgb(var(--palette-primary-600))' }}>
                      {repeatConfig.currentRepeat + 1}/{repeatConfig.count}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setRepeatCount(repeatConfig.count + 1)}
                  disabled={repeatConfig.count >= 20}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: repeatConfig.count >= 20
                      ? 'var(--article-accent-bg)'
                      : 'rgb(var(--palette-primary-500) / 0.1)',
                    color: repeatConfig.count >= 20
                      ? 'var(--article-text-secondary)'
                      : 'rgb(var(--palette-primary-600))'
                  }}
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Select Buttons */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-center" style={{ color: 'var(--article-text-secondary)' }}>
                  Quick Select
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 5, 10].map(count => (
                    <button
                      key={count}
                      onClick={() => setRepeatCount(count)}
                      className="w-12 h-9 rounded-lg font-bold transition-all duration-200 hover:scale-105 active:scale-95 text-sm"
                      style={{
                        backgroundColor: repeatConfig.count === count
                          ? 'rgb(var(--palette-primary-500))'
                          : 'var(--article-accent-bg)',
                        color: repeatConfig.count === count ? 'white' : 'var(--article-text)',
                        ...(repeatConfig.count === count && {
                          boxShadow: '0 4px 12px rgb(var(--palette-primary-500) / 0.3)',
                          border: '2px solid rgb(var(--palette-primary-500) / 0.5)'
                        })
                      }}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pause Duration Controls */}
            {repeatConfig.count > 1 && (
              <div className="flex flex-col items-center gap-4">
                <span className="text-lg font-semibold" style={{ color: 'var(--article-text)' }}>
                  Pause Between Repeats
                </span>

                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setPauseDuration(repeatConfig.pauseDuration - 500)}
                    disabled={repeatConfig.pauseDuration <= 500}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: repeatConfig.pauseDuration <= 500
                        ? 'var(--article-accent-bg)'
                        : 'rgb(var(--palette-primary-500) / 0.1)',
                      color: repeatConfig.pauseDuration <= 500
                        ? 'var(--article-text-secondary)'
                        : 'rgb(var(--palette-primary-600))'
                    }}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>

                  <div className="flex flex-col items-center">
                    <div className="text-4xl font-bold tabular-nums" style={{ color: 'rgb(var(--palette-primary-600))' }}>
                      {(repeatConfig.pauseDuration / 1000).toFixed(1)}
                    </div>
                    <div className="text-xs font-medium" style={{ color: 'var(--article-text-secondary)' }}>
                      seconds
                    </div>
                  </div>

                  <button
                    onClick={() => setPauseDuration(repeatConfig.pauseDuration + 500)}
                    disabled={repeatConfig.pauseDuration >= 3000}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: repeatConfig.pauseDuration >= 3000
                        ? 'var(--article-accent-bg)'
                        : 'rgb(var(--palette-primary-500) / 0.1)',
                      color: repeatConfig.pauseDuration >= 3000
                        ? 'var(--article-text-secondary)'
                        : 'rgb(var(--palette-primary-600))'
                    }}
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Select Buttons for Pause Duration */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-center" style={{ color: 'var(--article-text-secondary)' }}>
                    Quick Select
                  </div>
                  <div className="flex gap-2">
                    {[0.5, 1.0, 1.5, 2.0, 3.0].map(seconds => (
                      <button
                        key={seconds}
                        onClick={() => setPauseDuration(seconds * 1000)}
                        className="w-12 h-9 rounded-lg font-bold transition-all duration-200 hover:scale-105 active:scale-95 text-xs"
                        style={{
                          backgroundColor: repeatConfig.pauseDuration === seconds * 1000
                            ? 'rgb(var(--palette-primary-500))'
                            : 'var(--article-accent-bg)',
                          color: repeatConfig.pauseDuration === seconds * 1000 ? 'white' : 'var(--article-text)',
                          ...(repeatConfig.pauseDuration === seconds * 1000 && {
                            boxShadow: '0 4px 12px rgb(var(--palette-primary-500) / 0.3)',
                            border: '2px solid rgb(var(--palette-primary-500) / 0.5)'
                          })
                        }}
                      >
                        {seconds}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="w-12 h-12 rounded-full flex items-center justify-center font-medium transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--article-accent-bg)',
                  color: 'var(--article-text)'
                }}
                title="Previous"
              >
                ←
              </button>

              <button
                onClick={isPlayingSequence ? handleStop : handlePlay}
                disabled={ttsLoading}
                className="w-16 h-16 rounded-full font-semibold transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-70 flex items-center justify-center shadow-lg"
                style={{
                  backgroundColor: 'rgb(var(--palette-primary-500))',
                  color: 'white'
                }}
                title={isPlayingSequence ? 'Stop' : 'Play'}
              >
                {ttsLoading ? (
                  <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isPlayingSequence || ttsPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" fill="currentColor" />
                )}
              </button>

              <button
                onClick={handleNext}
                disabled={currentIndex === sentences.length - 1}
                className="w-12 h-12 rounded-full flex items-center justify-center font-medium transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--article-accent-bg)',
                  color: 'var(--article-text)'
                }}
                title="Next"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
