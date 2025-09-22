'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Story, ReadingSettings, SelectedWord, StoryPage } from '@/types/story';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import { useTTS } from '@/hooks/useTTS';
import { processTextWithFurigana, cleanTextForTTS, splitIntoSentences } from '@/utils/japaneseParser';
import { GrammarHighlightedText, GrammarLegend } from '@/components/reading/GrammarHighlightedText';
import { useToast } from '@/components/ui/Toast/ToastContext';

interface StoryReaderProps {
  story: Story;
  onComplete?: () => void;
  onExit?: () => void;
}

function SettingsPanel({
  settings,
  onSettingsChange,
  onClose
}: {
  settings: ReadingSettings;
  onSettingsChange: (settings: ReadingSettings) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  const handleFontSizeChange = (fontSize: ReadingSettings['fontSize']) => {
    onSettingsChange({ ...settings, fontSize });
  };

  const handleToggleFurigana = () => {
    onSettingsChange({ ...settings, showFurigana: !settings.showFurigana });
  };

  const handleHighlightModeChange = (mode: ReadingSettings['highlightMode']) => {
    onSettingsChange({ ...settings, highlightMode: mode });
  };

  return (
    <div className="absolute top-12 right-0 z-40 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg shadow-lg p-4 w-64">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-foreground dark:text-dark-100">
          {t('story.readingSettings')}
        </h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground dark:text-dark-400 dark:hover:text-dark-100"
          aria-label={t('common.close')}
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {/* Font Size */}
        <div>
          <label className="block text-sm font-medium mb-2">{t('story.fontSize')}</label>
          <div className="flex flex-wrap gap-2">
            {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
              <button
                key={size}
                onClick={() => handleFontSizeChange(size)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  settings.fontSize === size
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                }`}
              >
                {t(`story.fontSize.${size}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Furigana Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{t('story.showFurigana')}</label>
          <button
            onClick={handleToggleFurigana}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.showFurigana ? 'bg-primary-500' : 'bg-gray-300 dark:bg-dark-600'
            }`}
            aria-label={t('story.toggleFurigana')}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                settings.showFurigana ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Grammar Highlight Mode */}
        <div>
          <label className="block text-sm font-medium mb-2">{t('story.highlightMode')}</label>
          <div className="space-y-2">
            {(['none', 'all', 'content', 'grammar'] as const).map((mode) => (
              <label key={mode} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="highlightMode"
                  checked={settings.highlightMode === mode}
                  onChange={() => handleHighlightModeChange(mode)}
                  className="text-primary-500"
                />
                <span className="text-sm">{t(`story.highlightMode.${mode}`)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StoryReader({ story, onComplete, onExit }: StoryReaderProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { play, isPlaying } = useTTS({ cacheFirst: true });

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedWord, setSelectedWord] = useState<SelectedWord | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGrammarLegend, setShowGrammarLegend] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [settings, setSettings] = useState<ReadingSettings>({
    fontSize: 'medium',
    showFurigana: true,
    highlightVocabulary: true,
    highlightMode: 'content',
    darkMode: false
  });

  const textContainerRef = useRef<HTMLDivElement>(null);
  const currentPage = story.pages[currentPageIndex];

  // Font size classes
  const fontSizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
    xlarge: 'text-xl'
  };

  // Handle page navigation
  const goToPage = (index: number) => {
    if (index >= 0 && index < story.pages.length) {
      setCurrentPageIndex(index);
      setSelectedWord(null);
      setShowTranslation(false);

      // Mark as complete if last page
      if (index === story.pages.length - 1 && onComplete) {
        onComplete();
      }
    }
  };

  const goToPreviousPage = () => goToPage(currentPageIndex - 1);
  const goToNextPage = () => goToPage(currentPageIndex + 1);

  // Handle word click for dictionary lookup
  const handleWordClick = (word: string, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setSelectedWord({
      word,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.bottom
      }
    });
  };

  // Play audio for current page
  const playPageAudio = async () => {
    if (isPlaying) return;

    const cleanText = cleanTextForTTS(currentPage.text);
    try {
      await play(cleanText, {
        voice: 'ja-JP',
        rate: 0.9
      });
    } catch (error) {
      console.error('Failed to play audio:', error);
      showToast(t('error.audioFailed'), 'error');
    }
  };

  // Process text for display
  const processedText = processTextWithFurigana(currentPage.text, settings.showFurigana);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPreviousPage();
      if (e.key === 'ArrowRight') goToNextPage();
      if (e.key === 'Escape') setSelectedWord(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPageIndex]);

  return (
    <div className="min-h-screen bg-background dark:bg-dark-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-dark-850 border-b border-gray-200 dark:border-dark-700">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onExit}
                className="text-muted-foreground hover:text-foreground dark:text-dark-400 dark:hover:text-dark-100"
                aria-label={t('common.back')}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div>
                <h1 className="text-lg font-semibold text-foreground dark:text-dark-100">
                  {story.title}
                </h1>
                <p className="text-xs text-muted-foreground dark:text-dark-400">
                  {t('story.page')} {currentPageIndex + 1} / {story.pages.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Translation toggle */}
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className={`p-2 rounded-lg transition-colors ${
                  showTranslation
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-muted-foreground hover:bg-gray-100 dark:text-dark-400 dark:hover:bg-dark-800'
                }`}
                aria-label={t('story.toggleTranslation')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </button>

              {/* Grammar legend toggle */}
              {settings.highlightMode !== 'none' && (
                <button
                  onClick={() => setShowGrammarLegend(!showGrammarLegend)}
                  className="p-2 rounded-lg text-muted-foreground hover:bg-gray-100 dark:text-dark-400 dark:hover:bg-dark-800"
                  aria-label={t('story.toggleGrammarLegend')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
              )}

              {/* Audio button */}
              <button
                onClick={playPageAudio}
                disabled={isPlaying}
                className="p-2 rounded-lg text-muted-foreground hover:bg-gray-100 dark:text-dark-400 dark:hover:bg-dark-800 disabled:opacity-50"
                aria-label={t('story.playAudio')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isPlaying ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.414a2 2 0 102.828-2.828l0 0a2 2 0 10-2.828 2.828z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  )}
                </svg>
              </button>

              {/* Settings button */}
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 rounded-lg text-muted-foreground hover:bg-gray-100 dark:text-dark-400 dark:hover:bg-dark-800"
                  aria-label={t('common.settings')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {showSettings && (
                  <SettingsPanel
                    settings={settings}
                    onSettingsChange={setSettings}
                    onClose={() => setShowSettings(false)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm">
          {/* Page image */}
          {currentPage.imageUrl && (
            <div className="relative aspect-video w-full rounded-t-lg overflow-hidden bg-gray-100 dark:bg-dark-700">
              <img
                src={currentPage.imageUrl}
                alt={currentPage.imageAlt || `Page ${currentPageIndex + 1}`}
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* Text content */}
          <div className="p-6 md:p-8" ref={textContainerRef}>
            <div className={`${fontSizeClasses[settings.fontSize]} leading-relaxed`}>
              {settings.highlightMode === 'none' || !settings.highlightVocabulary ? (
                <div
                  className="font-japanese whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: processedText }}
                />
              ) : (
                <GrammarHighlightedText
                  text={currentPage.text}
                  highlightMode={settings.highlightMode}
                  showFurigana={settings.showFurigana}
                  onWordClick={handleWordClick}
                  className={fontSizeClasses[settings.fontSize]}
                />
              )}
            </div>

            {/* Translation */}
            {showTranslation && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-700">
                <p className={`${fontSizeClasses[settings.fontSize]} text-muted-foreground dark:text-dark-400`}>
                  {currentPage.translation}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Page navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={goToPreviousPage}
            disabled={currentPageIndex === 0}
            className="px-4 py-2 bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('common.previous')}
          </button>

          {/* Page indicators */}
          <div className="flex gap-1">
            {story.pages.map((_, index) => (
              <button
                key={index}
                onClick={() => goToPage(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentPageIndex
                    ? 'bg-primary-500'
                    : 'bg-gray-300 dark:bg-dark-600'
                }`}
                aria-label={`${t('story.goToPage')} ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={goToNextPage}
            disabled={currentPageIndex === story.pages.length - 1}
            className="px-4 py-2 bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('common.next')}
          </button>
        </div>
      </main>

      {/* Grammar legend */}
      {showGrammarLegend && (
        <div className="fixed bottom-4 right-4 z-40">
          <GrammarLegend onClose={() => setShowGrammarLegend(false)} />
        </div>
      )}

      {/* Word popup */}
      {selectedWord && (
        <div
          className="fixed z-50 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg shadow-lg p-4 max-w-xs"
          style={{
            left: `${selectedWord.position.x}px`,
            top: `${selectedWord.position.y + 10}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <button
            onClick={() => setSelectedWord(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:text-dark-400 dark:hover:text-dark-200"
          >
            ✕
          </button>
          <div className="text-lg font-bold font-japanese mb-2">{selectedWord.word}</div>
          <div className="text-sm text-muted-foreground dark:text-dark-400">
            {t('story.lookupDictionary')}
          </div>
        </div>
      )}
    </div>
  );
}