'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useTTS } from '@/hooks/useTTS';
import { TTSOptions } from '@/lib/tts/types';
import { RepeatModeConfig } from '@/types/youtube-player';
import { GrammarHighlightedText } from '@/components/reading/GrammarHighlightedText';
import { useBottomNav } from '@/contexts/BottomNavContext';
import MobileSettingsToolbar from './CompactSettingsToolbar';
import { useShadowingSession } from '@/components/shadowing/hooks/useShadowingSession';
import RepeatControls from '@/components/shadowing/shared/RepeatControls';
import NavigationControls from '@/components/shadowing/shared/NavigationControls';
import SentenceDisplay from '@/components/shadowing/shared/SentenceDisplay';
import { ShadowingSentence, ShadowingSettings } from '@/components/shadowing/types';
import {
  Volume2,
  X,
  ArrowLeft,
  Type,
  Languages,
  Palette,
  Play,
  ChevronDown,
  ChevronUp,
  Settings
} from 'lucide-react';

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  summary: string;
  url: string;
  imageUrl?: string;
  publishDate: string | Date;
  source: string;
  category: string;
  difficulty: string;
  tags?: string[];
  metadata?: {
    wordCount?: number;
    readingTime?: number;
    hasFurigana?: boolean;
  };
}

interface ReadingSettings {
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  showFurigana: boolean;
  highlightGrammar: boolean;
  highlightMode: 'none' | 'all' | 'content' | 'grammar';
  audioSpeed: number;
  showTranslation: boolean;
  shadowingMode: boolean;
}

interface VocabularyWord {
  word: string;
  reading: string;
  meaning: string;
  type: string;
  level: string;
}

// Component to render text with furigana using the API
function FuriganaText({
  text,
  showFurigana,
  fontSize,
  highlightGrammar,
  highlightMode,
  onWordClick,
  className = ''
}: {
  text: string;
  showFurigana: boolean;
  fontSize: string;
  highlightGrammar: boolean;
  highlightMode: 'none' | 'all' | 'content' | 'grammar';
  onWordClick?: (word: string, event: React.MouseEvent) => void;
  className?: string;
}) {
  const [furiganaHtml, setFuriganaHtml] = useState<string>(text);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchFurigana = async () => {
      if (!showFurigana || !text) {
        setFuriganaHtml(text);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch('/api/furigana', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.result) {
            setFuriganaHtml(data.result);
          }
        }
      } catch (error) {
        console.error('Failed to fetch furigana:', error);
        setFuriganaHtml(text);
      } finally {
        setLoading(false);
      }
    };

    fetchFurigana();
  }, [text, showFurigana]);

  const getFontSizeStyle = () => {
    const sizes = {
      small: 'var(--font-size-article-small)',
      medium: 'var(--font-size-article-medium)',
      large: 'var(--font-size-article-large)',
      xlarge: 'var(--font-size-article-xlarge)'
    };
    return sizes[fontSize as keyof typeof sizes];
  };

  // If grammar highlighting is enabled, use the GrammarHighlightedText component
  if (highlightGrammar && highlightMode !== 'none') {
    return (
      <div
        style={{
          fontSize: getFontSizeStyle(),
          lineHeight: showFurigana ? 'var(--line-height-article-furigana)' : 'var(--line-height-article-base)',
          letterSpacing: 'var(--letter-spacing-article)'
        }}
      >
        <GrammarHighlightedText
          text={text}
          highlightMode={highlightMode}
          onWordClick={onWordClick}
          showFurigana={showFurigana}
          className={className}
        />
      </div>
    );
  }

  // Otherwise, render with furigana only
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onWordClick) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (selectedText && selectedText.length > 0) {
      onWordClick(selectedText, e);
    }
  };

  if (loading) {
    return (
      <div
        className={`${className} animate-pulse`}
        style={{
          fontSize: getFontSizeStyle(),
          lineHeight: 'var(--line-height-article-base)',
          color: 'var(--article-text-secondary)'
        }}
      >
        {text}
      </div>
    );
  }

  return (
    <div
      className={`japanese-text ${className} cursor-pointer transition-colors duration-200`}
      dangerouslySetInnerHTML={{ __html: furiganaHtml }}
      onClick={handleClick}
      style={{
        fontSize: getFontSizeStyle(),
        lineHeight: showFurigana ? 'var(--line-height-article-furigana)' : 'var(--line-height-article-base)',
        letterSpacing: 'var(--letter-spacing-article)',
        color: 'var(--article-text)',
        fontFamily: '"Noto Sans JP", "Hiragino Sans", "Meiryo", sans-serif'
      }}
    />
  );
}

// Vocabulary popup for word lookup
function VocabularyPopup({
  word,
  position,
  onClose,
  onSaveToList
}: {
  word: string;
  position: { x: number; y: number };
  onClose: () => void;
  onSaveToList: (word: VocabularyWord) => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [wordData, setWordData] = useState<VocabularyWord | null>(null);

  useEffect(() => {
    // Simulate word lookup - in production, this would call an API
    const timer = setTimeout(() => {
      setWordData({
        word,
        reading: 'よみかた',
        meaning: 'Example meaning',
        type: 'Noun',
        level: 'N3'
      });
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [word]);

  return (
    <div
      className="fixed z-50 animate-spring-in"
      style={{
        left: Math.min(position.x, window.innerWidth - 340),
        top: position.y + 10,
        maxWidth: 'calc(100vw - 2rem)'
      }}
    >
      <div
        className="rounded-2xl shadow-2xl p-5 w-80 backdrop-blur-xl"
        style={{
          backgroundColor: 'var(--article-bg)',
          border: '1px solid var(--article-border)',
          boxShadow: '0 20px 25px -5px var(--article-shadow), 0 10px 10px -5px var(--article-shadow)'
        }}
      >
        <div className="flex justify-between items-start mb-4">
          <h3
            className="font-bold text-xl"
            style={{ color: 'var(--article-text)' }}
          >
            {word}
          </h3>
          <button
            onClick={onClose}
            className="transition-all duration-200 hover:scale-110 rounded-lg p-1"
            style={{
              color: 'var(--article-text-secondary)',
              backgroundColor: 'var(--article-hover-bg)'
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div
            className="text-center py-6 text-sm"
            style={{ color: 'var(--article-text-secondary)' }}
          >
            {t('common.loading')}
          </div>
        ) : wordData && (
          <div className="space-y-3">
            <div>
              <div
                className="text-xs font-medium mb-1 uppercase tracking-wide"
                style={{ color: 'var(--article-text-secondary)' }}
              >
                {t('reading.vocabulary.reading')}
              </div>
              <div
                className="font-medium text-base"
                style={{ color: 'var(--article-text)' }}
              >
                {wordData.reading}
              </div>
            </div>
            <div>
              <div
                className="text-xs font-medium mb-1 uppercase tracking-wide"
                style={{ color: 'var(--article-text-secondary)' }}
              >
                {t('reading.vocabulary.meaning')}
              </div>
              <div
                className="text-base"
                style={{ color: 'var(--article-text)' }}
              >
                {wordData.meaning}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: 'var(--article-accent-bg)',
                  color: 'var(--article-text-secondary)'
                }}
              >
                {wordData.type}
              </span>
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: 'rgb(var(--palette-primary-500) / 0.15)',
                  color: 'rgb(var(--palette-primary-600))'
                }}
              >
                {wordData.level}
              </span>
            </div>
            <button
              onClick={() => onSaveToList(wordData)}
              className="w-full mt-3 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: 'rgb(var(--palette-primary-500))',
                color: 'white'
              }}
            >
              {t('reading.vocabulary.saveToList')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact Settings Toolbar
function CompactSettingsToolbar({
  settings,
  onSettingsChange,
  isScrolled
}: {
  settings: ReadingSettings;
  onSettingsChange: (settings: ReadingSettings) => void;
  isScrolled: boolean;
}) {
  const { t } = useI18n();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div
      className={`fixed z-40 transition-all duration-300 ${
        isScrolled ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-90'
      }`}
      style={{
        bottom: 'env(safe-area-inset-bottom, 1rem)',
        right: '1rem',
        left: '1rem'
      }}
    >
      <div className="max-w-lg mx-auto lg:ml-auto lg:mr-0">
        <div
          className="rounded-full shadow-2xl backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-3 lg:rounded-2xl"
          style={{
            backgroundColor: 'var(--article-bg)',
            border: '1px solid var(--article-border)',
            boxShadow: '0 20px 25px -5px var(--article-shadow), 0 10px 10px -5px var(--article-shadow)'
          }}
        >
          {/* Font Size Button */}
          <button
            onClick={() => toggleSection('fontSize')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 relative"
            style={{
              backgroundColor: expandedSection === 'fontSize' ? 'var(--article-hover-bg)' : 'transparent',
              color: 'var(--article-text)'
            }}
            title={t('news.reader.fontSize')}
          >
            <Type className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-medium">{settings.fontSize[0].toUpperCase()}</span>
          </button>

          {/* Furigana Toggle */}
          <button
            onClick={() => onSettingsChange({ ...settings, showFurigana: !settings.showFurigana })}
            className="px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: settings.showFurigana ? 'rgb(var(--palette-primary-500) / 0.15)' : 'transparent',
              color: settings.showFurigana ? 'rgb(var(--palette-primary-600))' : 'var(--article-text-secondary)'
            }}
            title={t('news.reader.showFurigana')}
          >
            <Languages className="w-5 h-5" />
          </button>

          {/* Grammar Highlighting Toggle */}
          <button
            onClick={() => toggleSection('grammar')}
            className="px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: settings.highlightGrammar ? 'rgb(var(--palette-primary-500) / 0.15)' : 'transparent',
              color: settings.highlightGrammar ? 'rgb(var(--palette-primary-600))' : 'var(--article-text-secondary)'
            }}
            title={t('news.reader.highlightGrammar')}
          >
            <Palette className="w-5 h-5" />
          </button>

          {/* Audio Toggle */}
          <button
            onClick={() => onSettingsChange({ ...settings, shadowingMode: !settings.shadowingMode })}
            className="px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: settings.shadowingMode ? 'rgb(var(--palette-primary-500) / 0.15)' : 'transparent',
              color: settings.shadowingMode ? 'rgb(var(--palette-primary-600))' : 'var(--article-text-secondary)'
            }}
            title={t('news.reader.shadowingMode')}
          >
            <Play className="w-5 h-5" />
          </button>
        </div>

        {/* Expanded Sections */}
        {expandedSection === 'fontSize' && (
          <div
            className="mt-3 rounded-2xl shadow-xl backdrop-blur-xl p-4 animate-scale-in"
            style={{
              backgroundColor: 'var(--article-bg)',
              border: '1px solid var(--article-border)'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--article-text)' }}
              >
                {t('news.reader.fontSize')}
              </span>
              <button
                onClick={() => setExpandedSection(null)}
                style={{ color: 'var(--article-text-secondary)' }}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => {
                    onSettingsChange({ ...settings, fontSize: size });
                    setExpandedSection(null);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: settings.fontSize === size
                      ? 'rgb(var(--palette-primary-500))'
                      : 'var(--article-accent-bg)',
                    color: settings.fontSize === size
                      ? 'white'
                      : 'var(--article-text)'
                  }}
                >
                  {size[0].toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {expandedSection === 'grammar' && (
          <div
            className="mt-3 rounded-2xl shadow-xl backdrop-blur-xl p-4 animate-scale-in"
            style={{
              backgroundColor: 'var(--article-bg)',
              border: '1px solid var(--article-border)'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--article-text)' }}
              >
                {t('news.reader.highlightGrammar')}
              </span>
              <button
                onClick={() => setExpandedSection(null)}
                style={{ color: 'var(--article-text-secondary)' }}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            <label className="flex items-center gap-3 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.highlightGrammar}
                onChange={(e) => onSettingsChange({ ...settings, highlightGrammar: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span
                className="text-sm"
                style={{ color: 'var(--article-text)' }}
              >
                Enable highlighting
              </span>
            </label>

            {settings.highlightGrammar && (
              <div className="space-y-2 ml-1">
                {[
                  { value: 'all', label: t('news.reader.highlightAll') },
                  { value: 'content', label: t('news.reader.highlightContent') },
                  { value: 'grammar', label: t('news.reader.highlightGrammarOnly') }
                ].map(option => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="highlightMode"
                      checked={settings.highlightMode === option.value}
                      onChange={() => onSettingsChange({ ...settings, highlightMode: option.value as any })}
                      className="w-3.5 h-3.5"
                    />
                    <span
                      className="text-sm"
                      style={{ color: 'var(--article-text-secondary)' }}
                    >
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Shadowing mode component for sentence practice using shared components
function ShadowingMode({
  sentences,
  audioSpeed,
  settings,
  onSettingsChange,
  onClose,
  onPlayTTS,
  ttsLoading,
  ttsPlaying
}: {
  sentences: string[];
  audioSpeed: number;
  settings: ReadingSettings;
  onSettingsChange: (settings: ReadingSettings) => void;
  onClose: () => void;
  onPlayTTS: (text: string, options?: TTSOptions) => Promise<void>;
  ttsLoading: boolean;
  ttsPlaying: boolean;
}) {
  const { t } = useI18n();

  // Convert sentences to ShadowingSentence format
  const shadowingSentences: ShadowingSentence[] = sentences.map((text, index) => ({
    id: `sentence-${index}`,
    text,
    startIndex: 0,
    endIndex: text.length
  }));

  // Convert settings to ShadowingSettings format
  const shadowingSettings: ShadowingSettings = {
    showFurigana: settings.showFurigana,
    playbackSpeed: audioSpeed,
    highlightGrammar: settings.highlightGrammar,
    highlightMode: settings.highlightMode,
    fontSize: settings.fontSize
  };

  // Create TTS provider interface
  const ttsProvider = {
    play: onPlayTTS,
    stop: () => {},
    isPlaying: ttsPlaying,
    isLoading: ttsLoading,
    preload: async () => {} // Not implemented in news context
  };

  // Use shared shadowing session hook
  const { session, currentSentence, progress, handlers, canGoNext, canGoPrevious } = useShadowingSession({
    initialSentences: shadowingSentences,
    ttsProvider,
    settings: shadowingSettings,
    onSettingsChange: (newSettings) => {
      onSettingsChange({
        ...settings,
        showFurigana: newSettings.showFurigana,
        highlightGrammar: newSettings.highlightGrammar || false,
        highlightMode: newSettings.highlightMode || 'none',
        fontSize: newSettings.fontSize || 'medium'
      });
    },
    onComplete: onClose
  });

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto animate-fade-in" style={{ backgroundColor: 'var(--article-bg)' }}>
      <div className="min-h-screen w-full relative">
        {/* Close Button - Top Right */}
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-50 rounded-full p-3 transition-all duration-200 hover:scale-110 shadow-lg"
          style={{
            backgroundColor: 'var(--article-hover-bg)',
            color: 'var(--article-text-secondary)'
          }}
          aria-label="Close shadowing mode"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto p-6 pt-16 pb-32">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex justify-between text-sm mb-3">
              <span style={{ color: 'var(--article-text-secondary)' }}>
                {t('common.sentence')} {session.currentIndex + 1} / {session.sentences.length}
              </span>
              <span style={{ color: 'var(--article-text-secondary)' }}>
                {Math.round(progress)}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--article-accent-bg)' }}
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Reading progress: ${Math.round(progress)}%`}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  backgroundColor: 'rgb(var(--palette-primary-500))'
                }}
              />
            </div>
          </div>

          {/* Sentence Display using shared component */}
          <SentenceDisplay
            sentence={currentSentence}
            currentIndex={session.currentIndex}
            totalSentences={session.sentences.length}
            settings={shadowingSettings}
            variant="news"
            className="mb-10"
            currentRepeat={session.repeatConfig.currentRepeat}
            totalRepeats={session.repeatConfig.count}
            colors={{
              primary: 'rgb(var(--palette-primary-600))',
              background: 'var(--article-content-bg)',
              text: 'var(--article-text)',
              secondary: 'var(--article-text-secondary)'
            }}
          />

          {/* Controls */}
          <div className="space-y-6">
            {/* Repeat Controls using shared component */}
            <RepeatControls
              repeatConfig={session.repeatConfig}
              onRepeatCountChange={handlers.onRepeatCountChange}
              onPauseDurationChange={handlers.onPauseDurationChange}
              isPlaying={session.isPlaying}
              variant="buttons"
              colors={{
                primary: 'rgb(var(--palette-primary-500))',
                secondary: 'rgb(var(--palette-primary-600))',
                background: 'var(--article-accent-bg)',
                text: 'var(--article-text)',
                disabled: 'var(--article-text-secondary)'
              }}
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
              variant="news"
              colors={{
                primary: 'rgb(var(--palette-primary-500))',
                background: 'var(--article-accent-bg)',
                text: 'var(--article-text)',
                disabled: 'var(--article-text-secondary)'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Enhanced Article Reader Component
export default function EnhancedArticleReader({
  article,
  onBack
}: {
  article: NewsArticle;
  onBack?: () => void;
}) {
  const { t } = useI18n();
  const { setExtraItem } = useBottomNav();
  const {
    play: playTTS,
    preload,
    loading: ttsLoading,
    error: ttsError,
    playing: ttsPlaying,
    stop: ttsStop
  } = useTTS({
    cacheFirst: true,
    onError: (err) => {
      console.error('TTS Error in article reader:', err);
      // TODO: Could integrate with toast notification system if available
    }
  });
  const [settings, setSettings] = useState<ReadingSettings>({
    fontSize: 'medium',
    showFurigana: true,
    highlightGrammar: false,
    highlightMode: 'none',
    audioSpeed: 1.0,
    showTranslation: false,
    shadowingMode: false
  });

  // Add logging for settings changes
  const handleSettingsChange = (newSettings: ReadingSettings) => {
    console.log('Settings changed:', {
      old: settings,
      new: newSettings,
      shadowingModeToggled: settings.shadowingMode !== newSettings.shadowingMode
    });
    setSettings(newSettings);
  };

  // Special handler for settings changes while in shadowing mode
  const handleShadowingModeSettingsChange = (newSettings: ReadingSettings) => {
    console.log('Settings changed from within shadowing mode');
    // Always preserve shadowingMode = true when called from shadowing mode
    const preservedSettings = { ...newSettings, shadowingMode: true };
    console.log('Preserved settings:', preservedSettings);
    setSettings(preservedSettings);
  };

  const [isScrolled, setIsScrolled] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showMobileSettings, setShowMobileSettings] = useState(false);

  // Add logging for mobile settings state
  useEffect(() => {
    console.log('Mobile settings state changed:', showMobileSettings);
  }, [showMobileSettings]);
  const [vocabularyPopup, setVocabularyPopup] = useState<{
    word: string;
    position: { x: number; y: number };
  } | null>(null);
  const [sentences, setSentences] = useState<string[]>([]);

  // Set up bottom navbar settings button (mobile only)
  useEffect(() => {
    console.log('Setting up bottom nav extra item for settings');
    setExtraItem({
      id: 'reader-settings',
      label: 'Settings',
      icon: Settings,
      activeIcon: Settings,
      action: () => {
        console.log('Bottom nav settings button clicked');
        setShowMobileSettings(true);
      },
      matchPaths: []
    });

    return () => {
      console.log('Cleaning up bottom nav extra item');
      setExtraItem(null);
    };
  }, [setExtraItem]);

  // Split content into sentences for shadowing mode
  useEffect(() => {
    const splitSentences = article.content
      .split(/[。！？]/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim() + '。');
    setSentences(splitSentences);
  }, [article.content]);

  // Preload article content and initial sentences for better performance
  useEffect(() => {
    const preloadContent = async () => {
      try {
        // Preload full article for main play button
        await preload([article.content]);
        console.log('Article content preloaded successfully');

        // Preload first 3 sentences for shadowing mode
        if (sentences.length > 0) {
          const firstSentences = sentences.slice(0, 3);
          await preload(firstSentences);
          console.log(`Preloaded ${firstSentences.length} sentences for shadowing`);
        }
      } catch (err) {
        console.error('TTS preload failed (non-critical):', err);
        // Non-critical error, user can still play on-demand
      }
    };

    // Only preload if article has content
    if (article.content && article.content.trim().length > 0) {
      preloadContent();
    }
  }, [article.content, sentences, preload]);

  // Track scroll position for progress and toolbar visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = (scrollTop / docHeight) * 100;

      setReadingProgress(progress);
      setIsScrolled(scrollTop > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleWordClick = (word: string, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setVocabularyPopup({
      word,
      position: {
        x: event.clientX,
        y: rect.bottom
      }
    });
  };

  const handleSaveToList = (word: VocabularyWord) => {
    // TODO: Implement save to vocabulary list
    console.log('Saving word:', word);
    setVocabularyPopup(null);
  };

  const handlePlayArticle = async () => {
    try {
      await playTTS(article.content, {
        speed: settings.audioSpeed  // Use canonical 'speed' instead of 'rate'
      });
      console.log('Article playback started successfully');
    } catch (error) {
      console.error('Failed to play article:', error);
      // Error already logged by onError callback in useTTS
      // Could show user-facing error notification here if toast system exists
    }
  };

  // Auto-enable highlight mode when grammar highlighting is turned on
  useEffect(() => {
    if (settings.highlightGrammar && settings.highlightMode === 'none') {
      setSettings(prev => ({ ...prev, highlightMode: 'content' }));
    }
  }, [settings.highlightGrammar]);

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: 'var(--article-bg)' }}
    >
      {/* Reading Progress Bar */}
      <div
        className="fixed top-0 left-0 right-0 h-1 z-50 transition-all duration-200"
        style={{
          background: `linear-gradient(to right, rgb(var(--palette-primary-500)) ${readingProgress}%, transparent ${readingProgress}%)`
        }}
      />

      {/* Header */}
      <header className="relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-6">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: 'var(--article-hover-bg)',
                  color: 'var(--article-text)'
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">{t('common.back')}</span>
              </button>
            )}
            <button
              onClick={ttsPlaying ? ttsStop : handlePlayArticle}
              disabled={ttsLoading}
              className={`ml-auto px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-wait disabled:hover:scale-100 ${
                ttsPlaying ? 'animate-pulse' : ''
              }`}
              style={{
                backgroundColor: ttsLoading
                  ? 'rgb(156 163 175)'
                  : ttsPlaying
                    ? 'rgb(249 115 22)'
                    : 'rgb(var(--palette-primary-500))',
                color: 'white'
              }}
              aria-label={
                ttsLoading
                  ? t('common.loading')
                  : ttsPlaying
                    ? t('common.stop')
                    : t('common.play')
              }
              title={
                ttsLoading
                  ? 'Loading audio...'
                  : ttsPlaying
                    ? 'Stop playback'
                    : 'Play article'
              }
            >
              {ttsLoading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  <span className="text-sm font-medium hidden sm:inline">{t('common.loading')}</span>
                </>
              ) : ttsPlaying ? (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                  <span className="text-sm font-medium hidden sm:inline">{t('common.stop')}</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-5 h-5" />
                  <span className="text-sm font-medium hidden sm:inline">{t('common.play')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 pb-32">
        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-3 mb-6 animate-fade-in-up">
          <span
            className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide"
            style={{
              backgroundColor: 'rgb(var(--palette-primary-500) / 0.15)',
              color: 'rgb(var(--palette-primary-600))'
            }}
          >
            {article.category}
          </span>
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: 'var(--article-accent-bg)',
              color: 'var(--article-text-secondary)'
            }}
          >
            {article.difficulty}
          </span>
          <span
            className="text-xs"
            style={{ color: 'var(--article-text-secondary)' }}
          >
            {formatDate(article.publishDate)}
          </span>
          {article.metadata?.readingTime && (
            <span
              className="text-xs"
              style={{ color: 'var(--article-text-secondary)' }}
            >
              {article.metadata.readingTime} min read
            </span>
          )}
        </div>

        {/* Title */}
        <h1
          className="mb-6 font-bold animate-fade-in-up leading-tight"
          style={{
            color: 'var(--article-text)',
            fontSize: 'clamp(1.75rem, 5vw, 2.75rem)',
            lineHeight: 'var(--line-height-article-tight)',
            maxWidth: 'var(--article-content-width)',
            animationDelay: '0.1s'
          }}
        >
          {article.title}
        </h1>

        {/* Source */}
        <div
          className="mb-8 text-sm font-medium animate-fade-in-up"
          style={{
            color: 'var(--article-text-secondary)',
            animationDelay: '0.2s'
          }}
        >
          {article.source}
        </div>

        {/* Summary */}
        {article.summary && (
          <div
            className="mb-10 p-6 rounded-2xl animate-fade-in-up"
            style={{
              backgroundColor: 'var(--article-accent-bg)',
              maxWidth: 'var(--article-content-width)',
              animationDelay: '0.3s'
            }}
          >
            <p
              className="text-lg leading-relaxed"
              style={{
                color: 'var(--article-text-secondary)',
                lineHeight: 'var(--line-height-article-ui)'
              }}
            >
              {article.summary}
            </p>
          </div>
        )}

        {/* Main Content - Elevated Card */}
        <div
          className="animate-fade-in-up p-6 sm:p-8 md:p-10 rounded-2xl shadow-sm dark:shadow-lg"
          style={{
            maxWidth: 'var(--article-content-width)',
            animationDelay: '0.4s',
            backgroundColor: 'var(--article-content-bg)',
            border: '1px solid var(--article-border)'
          }}
        >
          <FuriganaText
            text={article.content}
            showFurigana={settings.showFurigana}
            fontSize={settings.fontSize}
            highlightGrammar={settings.highlightGrammar}
            highlightMode={settings.highlightMode}
            onWordClick={handleWordClick}
          />
        </div>

        {/* Translation Section */}
        {settings.showTranslation && (
          <div
            className="mt-10 p-6 rounded-2xl"
            style={{
              backgroundColor: 'var(--article-accent-bg)',
              maxWidth: 'var(--article-content-width)'
            }}
          >
            <h3
              className="font-semibold mb-3 text-lg"
              style={{ color: 'var(--article-text)' }}
            >
              {t('news.reader.translation')}
            </h3>
            <p style={{ color: 'var(--article-text-secondary)' }}>
              [Translation would appear here]
            </p>
          </div>
        )}

        {/* Footer */}
        <footer
          className="mt-16 pt-8"
          style={{
            borderTop: '1px solid var(--article-border)',
            maxWidth: 'var(--article-content-width)'
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            {article.metadata?.wordCount && (
              <span
                className="px-4 py-2 rounded-full text-sm"
                style={{
                  backgroundColor: 'var(--article-accent-bg)',
                  color: 'var(--article-text-secondary)'
                }}
              >
                {article.metadata.wordCount} words
              </span>
            )}
            {article.url && (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium transition-all duration-200 hover:scale-105 inline-flex items-center gap-1"
                style={{ color: 'rgb(var(--palette-primary-600))' }}
              >
                {t('news.reader.viewOriginal')}
                <span>→</span>
              </a>
            )}
          </div>
        </footer>
      </article>

      {/* Desktop Settings Toolbar */}
      <div className="hidden md:block">
        <CompactSettingsToolbar
          settings={settings}
          onSettingsChange={handleSettingsChange}
          isScrolled={isScrolled}
        />
      </div>

      {/* Mobile Settings (via Bottom Nav + Modal) - Only show when NOT in shadowing mode */}
      {!settings.shadowingMode && (
        <MobileSettingsToolbar
          settings={settings}
          onSettingsChange={handleSettingsChange}
          isScrolled={isScrolled}
          isOpen={showMobileSettings}
          onClose={() => {
            console.log('Closing mobile settings');
            setShowMobileSettings(false);
          }}
        />
      )}

      {/* Vocabulary Popup */}
      {vocabularyPopup && (
        <VocabularyPopup
          word={vocabularyPopup.word}
          position={vocabularyPopup.position}
          onClose={() => setVocabularyPopup(null)}
          onSaveToList={handleSaveToList}
        />
      )}

      {/* Shadowing Mode */}
      {settings.shadowingMode && (
        <>
          <ShadowingMode
            sentences={sentences}
            audioSpeed={settings.audioSpeed}
            settings={settings}
            onSettingsChange={handleShadowingModeSettingsChange}
            onClose={() => setSettings(prev => ({ ...prev, shadowingMode: false }))}
            onPlayTTS={playTTS}
            ttsLoading={ttsLoading}
            ttsPlaying={ttsPlaying}
          />
          {/* Mobile Settings Modal for Shadowing Mode - Only one settings modal at a time */}
          <MobileSettingsToolbar
            settings={settings}
            onSettingsChange={handleShadowingModeSettingsChange}
            isScrolled={isScrolled}
            isOpen={showMobileSettings}
            onClose={() => {
              console.log('Closing mobile settings from shadowing mode');
              setShowMobileSettings(false);
            }}
          />
        </>
      )}
    </div>
  );
}
