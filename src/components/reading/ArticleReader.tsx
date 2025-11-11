'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import { useTTS } from '@/hooks/useTTS';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { GrammarHighlightedText, GrammarLegend } from './GrammarHighlightedText';
import ShadowingAudioPlayer from '@/components/audio/ShadowingAudioPlayer';
import { cleanTextForTTS } from '@/utils/japaneseParser';
import { Play, Pause, Settings, Bookmark, Volume2, Globe, FileText, Headphones } from 'lucide-react';

// Article interface based on Moshimoshi's structure
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
  highlightVocabulary: boolean;
  highlightMode: 'none' | 'all' | 'content' | 'grammar';
}

interface VocabularyWord {
  word: string;
  reading?: string;
  meaning: string;
  type?: string;
  level?: string;
}

interface VocabularyPopupProps {
  word: string;
  position: { x: number; y: number };
  onClose: () => void;
  onSaveToList: (word: VocabularyWord) => void;
}

function VocabularyPopup({ word, position, onClose, onSaveToList }: VocabularyPopupProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [wordData, setWordData] = useState<VocabularyWord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWordData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Mock data for now - replace with actual API call
        setTimeout(() => {
          setWordData({
            word,
            reading: word, // Mock reading
            meaning: 'Definition not available', // Mock meaning
            level: 'N3',
            type: 'noun'
          });
          setLoading(false);
        }, 500);
      } catch (err) {
        setError(t('article.wordLookupError'));
        setLoading(false);
      }
    };

    fetchWordData();
  }, [word, t]);

  const handleSaveToList = () => {
    if (wordData) {
      onSaveToList(wordData);
      showToast(t('article.wordSaved'), 'success');
    }
  };

  return (
    <div
      className="absolute z-50 bg-soft-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-lg shadow-lg p-4 max-w-sm"
      style={{
        left: Math.min(position.x, window.innerWidth - 320),
        top: position.y + 10,
      }}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-medium text-foreground dark:text-dark-100">{word}</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span>{t('article.searching')}</span>
        </div>
      )}

      {error && (
        <div className="text-danger-500 text-sm">{error}</div>
      )}

      {wordData && (
        <div className="space-y-3">
          {wordData.reading && (
            <div>
              <div className="text-sm text-muted-foreground">{t('article.reading')}</div>
              <div className="font-medium">{wordData.reading}</div>
            </div>
          )}

          <div>
            <div className="text-sm text-muted-foreground">{t('article.meaning')}</div>
            <div>{wordData.meaning}</div>
          </div>

          {(wordData.level || wordData.type) && (
            <div className="flex items-center gap-2 text-xs">
              {wordData.level && (
                <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded">
                  {wordData.level}
                </span>
              )}
              {wordData.type && (
                <span className="px-2 py-1 bg-gray-100 dark:bg-dark-700 text-muted-foreground rounded">
                  {wordData.type}
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-dark-700">
            <button
              onClick={handleSaveToList}
              className="px-3 py-1.5 bg-primary-500 text-white rounded text-sm hover:bg-primary-600 transition-colors"
            >
              {t('article.saveToList')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SettingsPanelProps {
  settings: ReadingSettings;
  onSettingsChange: (settings: ReadingSettings) => void;
  onClose: () => void;
}

function SettingsPanel({ settings, onSettingsChange, onClose }: SettingsPanelProps) {
  const { t } = useI18n();

  const handleFontSizeChange = (fontSize: ReadingSettings['fontSize']) => {
    onSettingsChange({ ...settings, fontSize });
  };

  const handleToggleFurigana = () => {
    onSettingsChange({ ...settings, showFurigana: !settings.showFurigana });
  };

  const handleToggleVocabularyHighlight = () => {
    onSettingsChange({ ...settings, highlightVocabulary: !settings.highlightVocabulary });
  };

  const handleHighlightModeChange = (mode: ReadingSettings['highlightMode']) => {
    onSettingsChange({ ...settings, highlightMode: mode });
  };

  return (
    <div className="absolute top-12 right-0 z-40 bg-soft-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-lg shadow-lg p-4 w-64 max-w-[calc(100vw-2rem)] md:max-w-none">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-foreground dark:text-dark-100">{t('article.readingSettings')}</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {/* Font Size */}
        <div>
          <label className="block text-sm font-medium text-foreground dark:text-dark-100 mb-2">
            {t('article.textSize')}
          </label>
          <div className="flex flex-wrap gap-2">
            {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
              <button
                key={size}
                onClick={() => handleFontSizeChange(size)}
                className={`px-3 py-1 rounded text-xs sm:text-sm transition-colors ${
                  settings.fontSize === size
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-dark-700 text-muted-foreground hover:bg-gray-200 dark:hover:bg-dark-600'
                }`}
              >
                {{
                  small: 'S',
                  medium: 'M',
                  large: 'L',
                  xlarge: 'XL'
                }[size]}
              </button>
            ))}
          </div>
        </div>

        {/* Furigana Toggle */}
        <div>
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground dark:text-dark-100">
              {t('article.showFurigana')}
            </span>
            <button
              onClick={handleToggleFurigana}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.showFurigana ? 'bg-primary-500' : 'bg-gray-200 dark:bg-dark-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  settings.showFurigana ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
        </div>

        {/* Vocabulary Highlighting */}
        <div>
          <label className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground dark:text-dark-100">
              {t('article.highlightVocabulary')}
            </span>
            <button
              onClick={handleToggleVocabularyHighlight}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.highlightVocabulary ? 'bg-primary-500' : 'bg-gray-200 dark:bg-dark-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  settings.highlightVocabulary ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>

          {/* Grammar Highlighting Mode */}
          {settings.highlightVocabulary && (
            <div className="mt-2 space-y-2">
              <label className="text-xs text-muted-foreground">{t('article.highlightMode')}:</label>
              <div className="grid grid-cols-2 gap-1">
                {(['all', 'content', 'grammar', 'none'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleHighlightModeChange(mode)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      settings.highlightMode === mode
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-dark-700 text-muted-foreground hover:bg-gray-200 dark:hover:bg-dark-600'
                    }`}
                  >
                    {t(`highlightMode.${mode}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ArticleReaderProps {
  article: NewsArticle;
  onBack?: () => void;
}

export function ArticleReader({ article, onBack }: ArticleReaderProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { play: playTTS, stop: stopTTS, playing: ttsPlaying } = useTTS({ cacheFirst: true });
  const router = useRouter();

  const [settings, setSettings] = useState<ReadingSettings>(() => {
    // Load settings from localStorage
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('moshimoshi-reading-settings');
      if (savedSettings) {
        try {
          return JSON.parse(savedSettings);
        } catch (e) {
          console.error('Failed to parse saved settings:', e);
        }
      }
    }
    return {
      fontSize: 'medium',
      showFurigana: true,
      highlightVocabulary: true,
      highlightMode: 'content'
    };
  });

  const [showSettings, setShowSettings] = useState(false);
  const [selectedWord, setSelectedWord] = useState<{
    word: string;
    position: { x: number; y: number };
  } | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [showShadowingMode, setShowShadowingMode] = useState(false);
  const [showGrammarLegend, setShowGrammarLegend] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [readingStartTime] = useState(new Date());

  const articleRef = useRef<HTMLDivElement>(null);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('moshimoshi-reading-settings', JSON.stringify(settings));
    }
  }, [settings]);

  // Handle word click for vocabulary lookup
  const handleWordClick = useCallback((word: string, event: React.MouseEvent) => {
    if (!settings.highlightVocabulary) return;

    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    setSelectedWord({
      word,
      position: {
        x: rect.left,
        y: rect.top + window.scrollY
      }
    });
  }, [settings.highlightVocabulary]);

  // Save word to study list
  const handleSaveWordToList = async (word: VocabularyWord) => {
    try {
      // TODO: Implement word saving to review engine
      setSelectedWord(null);
      showToast(t('article.wordSaved'), 'success');
    } catch (error) {
      console.error('Failed to save word to list:', error);
      showToast(t('article.wordSaveFailed'), 'error');
    }
  };

  // Handle translation toggle
  const handleTranslationToggle = async () => {
    if (showTranslation && translation) {
      setShowTranslation(false);
      return;
    }

    if (!translation && !translationLoading) {
      setTranslationLoading(true);

      try {
        // TODO: Implement translation API call
        setTimeout(() => {
          setTranslation('Translation not available yet.');
          setShowTranslation(true);
          setTranslationLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Translation error:', error);
        showToast(t('translation.translationError'), 'error');
        setTranslationLoading(false);
      }
    } else {
      setShowTranslation(true);
    }
  };

  // Handle bookmark toggle
  const handleBookmarkToggle = async () => {
    if (!user) {
      showToast(t('common.loginRequired'), 'error');
      return;
    }

    try {
      // TODO: Implement bookmark functionality
      setIsBookmarked(!isBookmarked);
      showToast(
        isBookmarked ? t('article.bookmarkRemoved') : t('article.bookmarkAdded'),
        'success'
      );
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      showToast(t('article.bookmarkError'), 'error');
    }
  };

  // Handle scroll for reading progress
  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY || window.pageYOffset;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    const scrollableHeight = documentHeight - windowHeight;
    const progress = scrollableHeight > 0
      ? Math.min(100, (scrollTop / scrollableHeight) * 100)
      : 100;

    setReadingProgress(progress);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Call once immediately
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Handle text-to-speech
  const handlePlayTTS = async () => {
    try {
      if (ttsPlaying) {
        stopTTS();
      } else {
        await playTTS(article.content, {
          voice: 'ja-JP-Standard-A',
          rate: 0.9
        });
      }
    } catch (error) {
      console.error('TTS error:', error);
      showToast(t('article.ttsError'), 'error');
    }
  };

  const getFontSizeClass = () => {
    const sizes = {
      small: 'text-sm',
      medium: 'text-base',
      large: 'text-lg',
      xlarge: 'text-xl'
    };
    return sizes[settings.fontSize];
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Split content into paragraphs
  const contentParagraphs = article.content.split('\n').filter(p => p.trim());

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-lighter dark:from-dark-900 dark:to-dark-800">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header with controls */}
        <div className="flex items-center justify-between mb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              ← {t('common.back')}
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {/* TTS Button */}
            <button
              onClick={handlePlayTTS}
              className="p-2 rounded-lg bg-soft-white dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
              title={t('article.playAudio')}
            >
              {ttsPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            {/* Options Menu */}
            <div className="relative">
              <button
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-soft-white dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span className="hidden sm:inline">{t('article.options')}</span>
              </button>

              {/* Dropdown Menu */}
              {showOptionsMenu && (
                <div className="absolute top-12 right-0 z-50 bg-soft-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-lg shadow-lg p-1 w-64">
                  {/* Audio Reading */}
                  <button
                    onClick={() => {
                      setShowShadowingMode(true);
                      setShowOptionsMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors text-left"
                  >
                    <Headphones className="w-5 h-5" />
                    <div>
                      <div className="font-medium">{t('article.shadowingMode')}</div>
                      <div className="text-sm text-muted-foreground">{t('article.shadowingModeDesc')}</div>
                    </div>
                  </button>

                  {/* Bookmark */}
                  <button
                    onClick={() => {
                      handleBookmarkToggle();
                      setShowOptionsMenu(false);
                    }}
                    disabled={!user}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
                    <div>
                      <div className="font-medium">
                        {isBookmarked ? t('article.removeBookmark') : t('article.addBookmark')}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {!user ? t('common.loginRequired') : t('article.saveForLater')}
                      </div>
                    </div>
                  </button>

                  {/* Translation */}
                  <button
                    onClick={() => {
                      handleTranslationToggle();
                      setShowOptionsMenu(false);
                    }}
                    disabled={translationLoading}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Globe className="w-5 h-5" />
                    <div>
                      <div className="font-medium">
                        {showTranslation ? t('article.hideTranslation') : t('article.showTranslation')}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {translationLoading ? t('common.loading') : t('article.viewInEnglish')}
                      </div>
                    </div>
                  </button>

                  <div className="border-t border-gray-200 dark:border-dark-700 my-1"></div>

                  {/* Settings */}
                  <button
                    onClick={() => {
                      setShowSettings(true);
                      setShowOptionsMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors text-left"
                  >
                    <Settings className="w-5 h-5" />
                    <div>
                      <div className="font-medium">{t('article.readingSettings')}</div>
                      <div className="text-sm text-muted-foreground">{t('article.readingSettingsDesc')}</div>
                    </div>
                  </button>
                </div>
              )}

              {/* Settings Panel */}
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

        {/* Reading progress bar */}
        <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-1 mb-6">
          <div
            className="bg-primary-500 h-1 rounded-full transition-all duration-300"
            style={{ width: `${readingProgress}%` }}
          />
        </div>

        {/* Article content */}
        <article
          ref={articleRef}
          className="bg-soft-white dark:bg-dark-850 rounded-lg p-4 md:p-8 border border-gray-200 dark:border-dark-700"
        >
          {/* Article header */}
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground dark:text-dark-100 mb-4">
              {article.title}
            </h1>

            {/* Article metadata */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
              <span>📅 {formatDate(article.publishDate)}</span>
              <span>📖 {t('article.estimatedTime', { minutes: article.metadata?.readingTime || 5 })}</span>
              <span>📊 {article.difficulty}</span>
              <span>🏷️ {article.category}</span>
            </div>

            {/* Article image */}
            {article.imageUrl && (
              <div className="w-full max-w-2xl mx-auto mb-6">
                <img
                  src={article.imageUrl}
                  alt={t('article.imageAlt', { title: article.title })}
                  className="w-full rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </header>

          {/* Grammar Legend */}
          {settings.highlightVocabulary && settings.highlightMode !== 'none' && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-dark-800/50 rounded-lg">
              <button
                onClick={() => setShowGrammarLegend(!showGrammarLegend)}
                className="flex items-center gap-2 text-sm font-medium hover:text-primary-500 transition-colors w-full text-left"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showGrammarLegend ? 'rotate-180' : 'rotate-0'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {t('article.grammarGuide')}
              </button>
              {showGrammarLegend && (
                <div className="mt-3">
                  <GrammarLegend />
                </div>
              )}
            </div>
          )}

          {/* Article body */}
          <div className={`prose prose-lg max-w-none leading-[2.5] mt-8 ${getFontSizeClass()}`}>
            {contentParagraphs.map((paragraph, index) => (
              <div key={index} className="mb-6 px-2 md:px-0">
                {settings.highlightVocabulary && settings.highlightMode !== 'none' ? (
                  <GrammarHighlightedText
                    text={paragraph}
                    highlightMode={settings.highlightMode}
                    showFurigana={settings.showFurigana}
                    onWordClick={handleWordClick}
                    className={`${getFontSizeClass()} leading-loose`}
                  />
                ) : (
                  <div
                    className={`japanese-text font-ja ${getFontSizeClass()} leading-relaxed`}
                    dangerouslySetInnerHTML={{ __html: paragraph }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Article footer */}
          <footer className="mt-8 pt-6 border-t border-gray-200 dark:border-dark-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {t('article.readingTime', {
                  minutes: Math.ceil((new Date().getTime() - readingStartTime.getTime()) / 60000)
                })}
              </div>

              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-600 text-sm font-medium bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-md transition-colors"
              >
                <FileText className="w-4 h-4" />
                {t('article.viewOriginal')}
              </a>
            </div>
          </footer>
        </article>

        {/* Translation Section */}
        {showTranslation && (
          <div className="mt-8 bg-soft-white dark:bg-dark-850 rounded-lg p-4 md:p-8 border border-gray-200 dark:border-dark-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Globe className="w-5 h-5" />
                {t('article.englishTranslation')}
              </h3>
              <button
                onClick={() => setShowTranslation(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            {translationLoading ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">{t('article.translatingArticle')}</p>
              </div>
            ) : translation ? (
              <div className="prose prose-lg max-w-none">
                <p className="text-muted-foreground text-sm mb-4">
                  {t('article.translationNote')}
                </p>
                <div className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {translation}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Vocabulary popup */}
        {selectedWord && (
          <VocabularyPopup
            word={selectedWord.word}
            position={selectedWord.position}
            onClose={() => setSelectedWord(null)}
            onSaveToList={handleSaveWordToList}
          />
        )}

        {/* Click outside to close popups */}
        {(selectedWord || showSettings || showOptionsMenu) && (
          <div
            className="fixed inset-0 z-30"
            onClick={() => {
              setSelectedWord(null);
              setShowSettings(false);
              setShowOptionsMenu(false);
            }}
          />
        )}

        {/* Shadowing Mode Modal */}
        {showShadowingMode && (
          <ShadowingAudioPlayer
            content={{
              id: article.id,
              text: cleanTextForTTS(article.content),
              title: article.title,
              type: 'article'
            }}
            onClose={() => setShowShadowingMode(false)}
          />
        )}
      </div>
    </div>
  );
}

export default ArticleReader;