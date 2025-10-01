'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTTS } from '@/hooks/useTTS';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Settings, Bookmark } from 'lucide-react';

interface ShadowingAudioPlayerProps {
  content: {
    id: string;
    text: string;
    title: string;
    type: 'story' | 'article';
  };
  onClose?: () => void;
}

interface SentenceData {
  text: string;
  startIndex: number;
  endIndex: number;
  furiganaText?: string;
  translation?: string;
}

export default function ShadowingAudioPlayer({ content, onClose }: ShadowingAudioPlayerProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { showToast } = useToast();

  // State
  const [sentences, setSentences] = useState<SentenceData[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voice, setVoice] = useState<'male' | 'female'>('female');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [repeatCount, setRepeatCount] = useState(3);
  const [pauseBetweenRepeats, setPauseBetweenRepeats] = useState(2000); // ms
  const [showSettings, setShowSettings] = useState(false);
  const [currentRepeat, setCurrentRepeat] = useState(0);
  const [showFurigana, setShowFurigana] = useState(false);
  const [loadingFurigana, setLoadingFurigana] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [loadingTranslations, setLoadingTranslations] = useState(false);

  // Refs
  const repeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentRepeatRef = useRef<number>(0);

  // Handle audio playback completion
  const handleAudioEnd = useCallback(() => {
    const currentRepeatValue = currentRepeatRef.current;

    if (currentRepeatValue < repeatCount - 1) {
      // More repeats to go
      const nextRepeat = currentRepeatValue + 1;
      currentRepeatRef.current = nextRepeat;
      setCurrentRepeat(nextRepeat);

      // Pause before repeating
      repeatTimeoutRef.current = setTimeout(() => {
        playCurrentSentence();
      }, pauseBetweenRepeats);
    } else {
      // Done with repeats, reset
      currentRepeatRef.current = 0;
      setCurrentRepeat(0);
    }
  }, [repeatCount, pauseBetweenRepeats]);

  // Initialize useTTS with proper callbacks
  const { play: playTTS, preload, playing: isPlaying, stop: stopTTS } = useTTS({
    cacheFirst: true,
    onEnd: handleAudioEnd,
    onError: (err) => {
      console.error('[Shadowing] TTS error:', err);
      setError(err.message || t('shadowing.playbackError'));
      setIsLoading(false);
    }
  });

  // Parse sentences on mount
  useEffect(() => {
    if (content?.text) {
      const parsedSentences = parseSentences(content.text);
      setSentences(parsedSentences);

      // Preload first few sentences
      if (parsedSentences.length > 0) {
        const preloadCount = Math.min(3, parsedSentences.length);
        const textsToPreload = parsedSentences.slice(0, preloadCount).map(s => s.text);
        preload(textsToPreload, {
          voice: voice === 'female' ? 'ja-JP-Standard-A' : 'ja-JP-Standard-D',
          speed: playbackSpeed
        });
      }
    }
  }, [content, preload, voice, playbackSpeed]);

  // Cleanup
  useEffect(() => {
    return () => {
      stop();
      if (repeatTimeoutRef.current) {
        clearTimeout(repeatTimeoutRef.current);
      }
    };
  }, []);

  // Parse content into sentences
  const parseSentences = (text: string): SentenceData[] => {
    // Japanese sentence endings: 。！？
    const sentenceRegex = /[^。！？]+[。！？]/g;
    const sentenceList: SentenceData[] = [];
    let match;

    while ((match = sentenceRegex.exec(text)) !== null) {
      sentenceList.push({
        text: match[0].trim(),
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    // If no sentences found, treat the whole content as one sentence
    if (sentenceList.length === 0 && text.trim()) {
      sentenceList.push({
        text: text.trim(),
        startIndex: 0,
        endIndex: text.length
      });
    }

    return sentenceList;
  };

  // Play current sentence
  const playCurrentSentence = useCallback(async () => {
    if (currentSentenceIndex >= sentences.length || !sentences[currentSentenceIndex]) {
      setError(t('shadowing.noSentence'));
      return;
    }

    const sentence = sentences[currentSentenceIndex];
    setIsLoading(true);
    setError(null);

    try {
      // Use TTS hook to play - onEnd callback will handle completion
      await playTTS(sentence.text, {
        voice: voice === 'female' ? 'ja-JP-Standard-A' : 'ja-JP-Standard-D',
        speed: playbackSpeed
      });

      setIsLoading(false);
    } catch (err) {
      console.error('[Shadowing] Error playing sentence:', err);
      setError(err instanceof Error ? err.message : t('shadowing.playbackError'));
      setIsLoading(false);
    }
  }, [currentSentenceIndex, sentences, playTTS, voice, playbackSpeed, t]);

  // Control functions
  const play = () => {
    if (!isPlaying && !isLoading) {
      currentRepeatRef.current = 0;
      setCurrentRepeat(0);
      setError(null);
      playCurrentSentence();
    }
  };

  const pause = () => {
    stopTTS();
    if (repeatTimeoutRef.current) {
      clearTimeout(repeatTimeoutRef.current);
    }
  };

  const stop = () => {
    stopTTS();
    if (repeatTimeoutRef.current) {
      clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    currentRepeatRef.current = 0;
    setCurrentRepeat(0);
    setIsLoading(false);
  };

  const nextSentence = () => {
    stop();
    if (currentSentenceIndex < sentences.length - 1) {
      const newIndex = currentSentenceIndex + 1;
      setCurrentSentenceIndex(newIndex);
      currentRepeatRef.current = 0;
      setCurrentRepeat(0);

      // Preload next sentence
      if (sentences[newIndex]) {
        preload([sentences[newIndex].text], {
          voice: voice === 'female' ? 'ja-JP-Standard-A' : 'ja-JP-Standard-D',
          speed: playbackSpeed
        });
      }
    }
  };

  const previousSentence = () => {
    stop();
    if (currentSentenceIndex > 0) {
      const newIndex = currentSentenceIndex - 1;
      setCurrentSentenceIndex(newIndex);
      currentRepeatRef.current = 0;
      setCurrentRepeat(0);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };

  // Generate furigana for current sentence when showFurigana is enabled
  useEffect(() => {
    const generateCurrentSentenceFurigana = async () => {
      if (!showFurigana || !sentences[currentSentenceIndex] || sentences[currentSentenceIndex].furiganaText) {
        return;
      }

      setLoadingFurigana(true);
      try {
        // Call furigana API
        const response = await fetch('/api/furigana/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: sentences[currentSentenceIndex].text })
        });

        if (response.ok) {
          const data = await response.json();
          // Update the specific sentence with furigana
          setSentences(prev => prev.map((sentence, index) =>
            index === currentSentenceIndex
              ? { ...sentence, furiganaText: data.furigana }
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
  }, [showFurigana, currentSentenceIndex, sentences]);

  // Handle sentence bookmark
  const handleBookmarkSentence = async (sentence: SentenceData) => {
    if (!user) {
      showToast(t('common.loginRequired'), 'error');
      return;
    }

    try {
      // TODO: Implement bookmark functionality with review engine
      showToast(t('shadowing.sentenceSaved'), 'success');
    } catch (error) {
      console.error('Failed to bookmark sentence:', error);
      showToast(t('shadowing.saveFailed'), 'error');
    }
  };

  // Get current sentence
  const currentSentence = sentences[currentSentenceIndex];

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-soft-white dark:bg-dark-850 border border-gray-100 dark:border-dark-700 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t('shadowing.title')}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-soft-white dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-soft-white dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border-b border-gray-100 dark:border-dark-700 bg-soft-white/50 dark:bg-dark-800/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Voice Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">
                  {t('shadowing.voice')}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVoice('male')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      voice === 'male'
                        ? 'bg-primary-500 text-white'
                        : 'bg-soft-white dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600'
                    }`}
                  >
                    {t('shadowing.male')}
                  </button>
                  <button
                    onClick={() => setVoice('female')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      voice === 'female'
                        ? 'bg-primary-500 text-white'
                        : 'bg-soft-white dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600'
                    }`}
                  >
                    {t('shadowing.female')}
                  </button>
                </div>
              </div>

              {/* Speed Control */}
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">
                  {t('shadowing.speed')}: {playbackSpeed.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={playbackSpeed}
                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Repeat Count */}
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">
                  {t('shadowing.repeatCount')}: {repeatCount}
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Pause Duration */}
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">
                  {t('shadowing.pauseDuration')}: {pauseBetweenRepeats / 1000}s
                </label>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  step="500"
                  value={pauseBetweenRepeats}
                  onChange={(e) => setPauseBetweenRepeats(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Furigana Toggle */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFurigana}
                    onChange={(e) => setShowFurigana(e.target.checked)}
                    className="rounded border-gray-300 dark:border-dark-600"
                  />
                  <div>
                    <span className="text-sm font-medium">{t('shadowing.showFurigana')}</span>
                    <p className="text-xs text-muted-foreground">{t('shadowing.furiganaDescription')}</p>
                  </div>
                  {loadingFurigana && (
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="p-6">
          {/* Sentence Display */}
          <div className="mb-6">
            <div className="text-sm text-muted-foreground mb-2">
              {t('shadowing.sentenceProgress', {
                current: currentSentenceIndex + 1,
                total: sentences.length
              })}
              {repeatCount > 1 && (isPlaying || currentRepeat > 0) &&
                ` (${t('shadowing.repeatProgress', { current: currentRepeat + 1, total: repeatCount })})`
              }
            </div>
            <div className="bg-soft-white/50 dark:bg-dark-800/50 rounded-lg p-6 min-h-[150px] flex items-center justify-center relative">
              {currentSentence ? (
                <>
                  <div className="text-2xl leading-relaxed text-center japanese-text pr-12">
                    {showFurigana && currentSentence.furiganaText ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: currentSentence.furiganaText }}
                        className="ruby-text"
                      />
                    ) : (
                      <p>{currentSentence.text}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleBookmarkSentence(currentSentence)}
                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-background/80 transition-colors text-muted-foreground hover:text-foreground"
                    title={t('shadowing.saveSentence')}
                  >
                    <Bookmark className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <p className="text-muted-foreground">{t('shadowing.noSentenceAvailable')}</p>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="text-xs text-muted-foreground mb-1">
              {repeatCount > 1 ? t('shadowing.repeatProgressLabel') : t('shadowing.sentenceProgressLabel')}
            </div>
            <div className="bg-gray-100 dark:bg-dark-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary-500 h-full transition-all duration-300"
                style={{
                  width: repeatCount > 1
                    ? `${((currentRepeat + (isPlaying ? 1 : 0)) / repeatCount) * 100}%`
                    : `${((currentSentenceIndex + 1) / sentences.length) * 100}%`
                }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={previousSentence}
              disabled={currentSentenceIndex === 0}
              className="p-3 rounded-full bg-soft-white dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SkipBack className="w-6 h-6" />
            </button>

            <button
              onClick={isPlaying ? pause : play}
              disabled={isLoading || !currentSentence}
              className="p-4 rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>

            <button
              onClick={nextSentence}
              disabled={currentSentenceIndex === sentences.length - 1}
              className="p-3 rounded-full bg-soft-white dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SkipForward className="w-6 h-6" />
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-center">
              {error}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 text-sm text-muted-foreground text-center">
            <p>{t('shadowing.instructions1')}</p>
            <p>{t('shadowing.instructions2')}</p>
          </div>
        </div>

        {/* Sentence List */}
        <div className="border-t border-gray-100 dark:border-dark-700 max-h-[200px] overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium mb-2">{t('shadowing.allSentences')}</h3>
            <div className="space-y-1">
              {sentences.map((sentence, index) => (
                <button
                  key={index}
                  onClick={() => {
                    stop();
                    setCurrentSentenceIndex(index);
                  }}
                  className={`w-full text-left p-2 rounded-lg transition-colors text-sm ${
                    index === currentSentenceIndex
                      ? 'bg-primary-100 dark:bg-primary-900/30 font-medium'
                      : 'hover:bg-soft-white dark:hover:bg-dark-700'
                  }`}
                >
                  <span className="text-muted-foreground mr-2">{index + 1}.</span>
                  {sentence.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}