'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useTTS } from '@/hooks/useTTS';

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

// Parse and render text with ruby tags for furigana
function parseWithRubyTags(text: string): string {
  // If text already contains HTML ruby tags, return as-is
  if (text.includes('<ruby>') && text.includes('<rt>')) {
    return text;
  }

  // Convert furigana notation like 漢字[かんじ] to <ruby>漢字<rt>かんじ</rt></ruby>
  const rubyPattern = /([一-龯]+)\[([ぁ-ん]+)\]/g;
  return text.replace(rubyPattern, '<ruby>$1<rt>$2</rt></ruby>');
}

// Component to render text with furigana
function FuriganaText({
  text,
  showFurigana,
  fontSize,
  onWordClick
}: {
  text: string;
  showFurigana: boolean;
  fontSize: string;
  onWordClick?: (word: string, event: React.MouseEvent) => void;
}) {
  const processedText = showFurigana ? parseWithRubyTags(text) : text.replace(/<ruby>(.*?)<rt>.*?<\/rt><\/ruby>/g, '$1');

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onWordClick) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (selectedText && selectedText.length > 0) {
      onWordClick(selectedText, e);
    }
  };

  const sizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
    xlarge: 'text-xl'
  };

  return (
    <div
      className={`japanese-text ${sizeClasses[fontSize as keyof typeof sizeClasses]} leading-loose cursor-pointer`}
      dangerouslySetInnerHTML={{ __html: processedText }}
      onClick={handleClick}
      style={{
        lineHeight: showFurigana ? '2.5' : '2',
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
      className="absolute z-50 bg-soft-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-lg shadow-xl p-4 max-w-sm"
      style={{
        left: Math.min(position.x, window.innerWidth - 320),
        top: position.y + 10,
      }}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-bold text-lg">{word}</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xl"
        >
          ×
        </button>
      </div>

      {loading ? (
        <div className="text-center py-4">
          {t('common.loading')}
        </div>
      ) : wordData && (
        <div className="space-y-2">
          <div>
            <div className="text-sm text-muted-foreground">{t('vocabulary.reading')}</div>
            <div className="font-medium">{wordData.reading}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">{t('vocabulary.meaning')}</div>
            <div className="font-medium">{wordData.meaning}</div>
          </div>
          <div className="flex gap-2 text-sm">
            <span className="px-2 py-1 bg-gray-100 dark:bg-dark-700 rounded">{wordData.type}</span>
            <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">{wordData.level}</span>
          </div>
          <button
            onClick={() => onSaveToList(wordData)}
            className="w-full mt-2 px-3 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
          >
            {t('vocabulary.saveToList')}
          </button>
        </div>
      )}
    </div>
  );
}

// Settings panel component
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

  return (
    <div className="absolute top-12 right-0 z-50 bg-soft-white dark:bg-dark-850 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 p-4 w-72">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-foreground">{t('news.reader.settings')}</h3>
        <button onClick={onClose} className="text-xl hover:text-foreground">×</button>
      </div>

      <div className="space-y-4">
        {/* Font Size */}
        <div>
          <label className="text-sm font-medium block mb-2">
            {t('news.reader.fontSize')}
          </label>
          <div className="flex gap-2">
            {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
              <button
                key={size}
                onClick={() => onSettingsChange({ ...settings, fontSize: size })}
                className={`px-3 py-1 rounded text-sm ${
                  settings.fontSize === size
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600'
                }`}
              >
                {size[0].toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Show Furigana */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showFurigana}
            onChange={(e) => onSettingsChange({ ...settings, showFurigana: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm">{t('news.reader.showFurigana')}</span>
        </label>

        {/* Grammar Highlighting */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.highlightGrammar}
            onChange={(e) => onSettingsChange({ ...settings, highlightGrammar: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm">{t('news.reader.highlightGrammar')}</span>
        </label>

        {/* Show Translation */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showTranslation}
            onChange={(e) => onSettingsChange({ ...settings, showTranslation: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm">{t('news.reader.showTranslation')}</span>
        </label>

        {/* Shadowing Mode */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.shadowingMode}
            onChange={(e) => onSettingsChange({ ...settings, shadowingMode: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm">{t('news.reader.shadowingMode')}</span>
        </label>

        {/* Audio Speed */}
        <div>
          <label className="text-sm font-medium block mb-2">
            {t('news.reader.audioSpeed')}: {settings.audioSpeed}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.25"
            value={settings.audioSpeed}
            onChange={(e) => onSettingsChange({ ...settings, audioSpeed: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}

// Shadowing mode component for sentence practice
function ShadowingMode({
  sentences,
  onClose
}: {
  sentences: string[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { play: playTTS } = useTTS();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatCount, setRepeatCount] = useState(1);

  const handlePlay = async () => {
    setIsPlaying(true);
    const sentence = sentences[currentIndex];

    for (let i = 0; i < repeatCount; i++) {
      await playTTS(sentence, { rate: 0.8 });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsPlaying(false);
  };

  const handleNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-soft-white dark:bg-dark-850 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{t('news.reader.shadowingMode')}</h2>
          <button onClick={onClose} className="text-2xl hover:text-foreground">×</button>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span>{t('common.sentence')} {currentIndex + 1} / {sentences.length}</span>
            <span>{Math.round(((currentIndex + 1) / sentences.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / sentences.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Current Sentence */}
        <div className="mb-6 p-6 bg-gray-100/50 dark:bg-dark-800/50 rounded-lg">
          <p className="text-2xl leading-relaxed japanese-text">
            {sentences[currentIndex]}
          </p>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Repeat Count */}
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm">{t('news.reader.repeatCount')}:</span>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map(count => (
                <button
                  key={count}
                  onClick={() => setRepeatCount(count)}
                  className={`px-3 py-1 rounded ${
                    repeatCount === count
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  {count}x
                </button>
              ))}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 disabled:opacity-50"
            >
              ← {t('common.previous')}
            </button>

            <button
              onClick={handlePlay}
              disabled={isPlaying}
              className="px-6 py-3 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
            >
              {isPlaying ? (
                <>
                  <span className="animate-pulse">●</span>
                  {t('common.playing')}
                </>
              ) : (
                <>
                  ▶
                  {t('common.play')}
                </>
              )}
            </button>

            <button
              onClick={handleNext}
              disabled={currentIndex === sentences.length - 1}
              className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 disabled:opacity-50"
            >
              {t('common.next')} →
            </button>
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
  const { play: playTTS, preload } = useTTS();
  const [settings, setSettings] = useState<ReadingSettings>({
    fontSize: 'medium',
    showFurigana: true,
    highlightGrammar: false,
    highlightMode: 'none',
    audioSpeed: 1.0,
    showTranslation: false,
    shadowingMode: false
  });

  const [showSettings, setShowSettings] = useState(false);
  const [vocabularyPopup, setVocabularyPopup] = useState<{
    word: string;
    position: { x: number; y: number };
  } | null>(null);
  const [showShadowing, setShowShadowing] = useState(false);
  const [sentences, setSentences] = useState<string[]>([]);
  const [furiganaContent, setFuriganaContent] = useState(article.content);
  const [loadingFurigana, setLoadingFurigana] = useState(false);

  // Split content into sentences for shadowing mode
  useEffect(() => {
    const splitSentences = article.content
      .split(/[。！？]/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim() + '。');
    setSentences(splitSentences);
  }, [article.content]);

  // Fetch furigana if enabled
  useEffect(() => {
    if (settings.showFurigana && !article.metadata?.hasFurigana) {
      fetchFurigana();
    }
  }, [settings.showFurigana]);

  const fetchFurigana = async () => {
    setLoadingFurigana(true);
    try {
      const response = await fetch('/api/furigana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: article.content })
      });
      const data = await response.json();
      if (data.furiganaText) {
        setFuriganaContent(data.furiganaText);
      }
    } catch (error) {
      console.error('Failed to fetch furigana:', error);
    } finally {
      setLoadingFurigana(false);
    }
  };

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
    await playTTS(article.content, { rate: settings.audioSpeed });
  };

  return (
    <div className="container mx-auto px-4 py-8 relative">
      {/* Header with Controls */}
      <div className="sticky top-0 z-40 bg-soft-white dark:bg-dark-850 border-b border-gray-200 dark:border-dark-700">
        <div className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
            >
              ← {t('common.back')}
            </button>
            <button
              onClick={handlePlayArticle}
              className="p-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
            >
              🔊
            </button>
            {settings.shadowingMode && (
              <button
                onClick={() => setShowShadowing(true)}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
              >
                {t('news.reader.shadowing')}
              </button>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
            >
              ⚙️
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

      {/* Article Content */}
      <article className="max-w-4xl mx-auto mt-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-4 text-foreground dark:text-dark-100">
            {article.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground dark:text-dark-400">
            <span>{article.source}</span>
            <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">
              {article.difficulty}
            </span>
            <span>{new Date(article.publishDate).toLocaleDateString()}</span>
          </div>
        </header>

        {/* Article Summary */}
        {article.summary && (
          <div className="mb-6 p-4 bg-gray-100/50 dark:bg-dark-800/50 rounded-lg">
            <p className="text-lg text-muted-foreground dark:text-dark-400">
              {article.summary}
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="prose prose-lg max-w-none">
          {loadingFurigana ? (
            <div className="text-center py-8 text-muted-foreground dark:text-dark-400">
              {t('common.loading')}
            </div>
          ) : (
            <FuriganaText
              text={furiganaContent}
              showFurigana={settings.showFurigana}
              fontSize={settings.fontSize}
              onWordClick={handleWordClick}
            />
          )}
        </div>

        {/* Translation Section */}
        {settings.showTranslation && (
          <div className="mt-8 p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
            <h3 className="font-medium mb-2">{t('news.reader.translation')}</h3>
            <p className="text-muted-foreground dark:text-dark-400">
              [Translation would appear here]
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground dark:text-dark-400">
              {article.metadata?.wordCount && (
                <span className="px-3 py-1 bg-gray-100 dark:bg-dark-700 text-muted-foreground dark:text-dark-400 rounded-full text-sm">
                  {article.metadata.wordCount} words
                </span>
              )}
            </div>
            {article.url && (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-500 hover:text-primary-600 text-sm"
              >
                {t('news.reader.viewOriginal')} →
              </a>
            )}
          </div>
        </footer>
      </article>

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
      {showShadowing && (
        <ShadowingMode
          sentences={sentences}
          onClose={() => setShowShadowing(false)}
        />
      )}
    </div>
  );
}