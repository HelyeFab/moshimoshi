'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTTS } from '@/hooks/useTTS';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Settings, Bookmark } from 'lucide-react';
import { useShadowingSession } from '@/components/shadowing/hooks/useShadowingSession';
import RepeatControls from '@/components/shadowing/shared/RepeatControls';
import NavigationControls from '@/components/shadowing/shared/NavigationControls';
import SentenceDisplay from '@/components/shadowing/shared/SentenceDisplay';
import { ShadowingSentence, ShadowingSettings } from '@/components/shadowing/types';

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

  // Local settings state
  const [voice, setVoice] = useState<'male' | 'female'>('female');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [showFurigana, setShowFurigana] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  // Parse content into sentences
  const parseSentences = (text: string): ShadowingSentence[] => {
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
  };

  const shadowingSentences = parseSentences(content.text);

  // Convert settings to ShadowingSettings format
  const shadowingSettings: ShadowingSettings = {
    showFurigana,
    playbackSpeed,
    voice,
    showTranslation
  };

  // Initialize TTS
  const { play: playTTS, preload, playing: isPlaying, stop: stopTTS } = useTTS({
    cacheFirst: true,
    onError: (err) => {
      console.error('[Shadowing] TTS error:', err);
    }
  });

  // Create TTS provider interface
  const ttsProvider = {
    play: async (text: string, options?: any) => {
      return playTTS(text, {
        voice: voice === 'female' ? 'ja-JP-Standard-A' : 'ja-JP-Standard-D',
        speed: playbackSpeed,
        ...options
      });
    },
    stop: stopTTS,
    isPlaying,
    isLoading: false,
    preload: async (texts: string[]) => {
      return preload(texts, {
        voice: voice === 'female' ? 'ja-JP-Standard-A' : 'ja-JP-Standard-D',
        speed: playbackSpeed
      });
    }
  };

  // Use shared shadowing session hook
  const { session, currentSentence, progress, handlers, canGoNext, canGoPrevious } = useShadowingSession({
    initialSentences: shadowingSentences,
    ttsProvider,
    settings: shadowingSettings,
    onSettingsChange: (newSettings) => {
      if (newSettings.showFurigana !== undefined) setShowFurigana(newSettings.showFurigana);
      if (newSettings.playbackSpeed !== undefined) setPlaybackSpeed(newSettings.playbackSpeed);
      if (newSettings.voice !== undefined) setVoice(newSettings.voice);
      if (newSettings.showTranslation !== undefined) setShowTranslation(newSettings.showTranslation);
    },
    onComplete: () => {
      onClose?.();
    }
  });

  // Preload first few sentences on mount
  useEffect(() => {
    if (shadowingSentences.length > 0) {
      const preloadCount = Math.min(3, shadowingSentences.length);
      const textsToPreload = shadowingSentences.slice(0, preloadCount).map(s => s.text);
      ttsProvider.preload(textsToPreload);
    }
  }, [voice, playbackSpeed]);

  // Handle bookmark functionality
  const handleBookmarkSentence = async (sentence: ShadowingSentence) => {
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

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };

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
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-soft-white dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
                aria-label="Close"
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
                <div className="flex gap-2" role="group" aria-label="Voice selection">
                  <button
                    onClick={() => setVoice('male')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      voice === 'male'
                        ? 'bg-primary-500 text-white'
                        : 'bg-soft-white dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600'
                    }`}
                    aria-pressed={voice === 'male'}
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
                    aria-pressed={voice === 'female'}
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
                  aria-label={`Playback speed: ${playbackSpeed.toFixed(1)}x`}
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
                    aria-describedby="furigana-description"
                  />
                  <div>
                    <span className="text-sm font-medium">{t('shadowing.showFurigana')}</span>
                    <p id="furigana-description" className="text-xs text-muted-foreground">{t('shadowing.furiganaDescription')}</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="p-6">
          {/* Sentence Display using shared component */}
          <SentenceDisplay
            sentence={currentSentence}
            currentIndex={session.currentIndex}
            totalSentences={session.sentences.length}
            settings={shadowingSettings}
            variant="stories"
            className="mb-6"
            onBookmark={handleBookmarkSentence}
            currentRepeat={session.repeatConfig.currentRepeat}
            totalRepeats={session.repeatConfig.count}
          />

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="text-xs text-muted-foreground mb-1">
              {session.repeatConfig.count > 1 ? t('shadowing.repeatProgressLabel') : t('shadowing.sentenceProgressLabel')}
            </div>
            <div className="bg-gray-100 dark:bg-dark-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary-500 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progress: ${Math.round(progress)}%`}
              />
            </div>
          </div>

          {/* Repeat Controls using shared component */}
          <RepeatControls
            repeatConfig={session.repeatConfig}
            onRepeatCountChange={handlers.onRepeatCountChange}
            onPauseDurationChange={handlers.onPauseDurationChange}
            isPlaying={session.isPlaying}
            variant="sliders"
            className="mb-6"
          />

          {/* Navigation Controls using shared component */}
          <NavigationControls
            isPlaying={session.isPlaying}
            isLoading={session.isLoading}
            canGoPrevious={canGoPrevious}
            canGoNext={canGoNext}
            onPlay={handlers.onPlay}
            onPause={handlers.onPause}
            onPrevious={handlers.onPrevious}
            onNext={handlers.onNext}
            variant="stories"
            className="mb-6"
          />

          {/* Error Display */}
          {session.error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-center" role="alert">
              {session.error}
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
            <div className="space-y-1" role="list">
              {session.sentences.map((sentence, index) => (
                <button
                  key={sentence.id}
                  onClick={() => handlers.onSentenceSelect(index)}
                  className={`w-full text-left p-2 rounded-lg transition-colors text-sm ${
                    index === session.currentIndex
                      ? 'bg-primary-100 dark:bg-primary-900/30 font-medium'
                      : 'hover:bg-soft-white dark:hover:bg-dark-700'
                  }`}
                  role="listitem"
                  aria-label={`Go to sentence ${index + 1}: ${sentence.text.substring(0, 50)}...`}
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