'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';
import { useTTS } from '@/hooks/useTTS';
import AudioButton from '@/components/ui/AudioButton';

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

interface ArticleReaderProps {
  article: NewsArticle;
  onBack: () => void;
}

interface ReadingSettings {
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  showFurigana: boolean;
  highlightGrammar: boolean;
}

// Component to render text with ruby tags for furigana
function FuriganaText({ text, showFurigana }: { text: string; showFurigana: boolean }) {
  if (!showFurigana) {
    // Remove ruby tags if furigana is disabled
    const cleanText = text.replace(/<ruby>(.*?)<rt>.*?<\/rt><\/ruby>/g, '$1');
    return <span dangerouslySetInnerHTML={{ __html: cleanText }} />;
  }

  // Render with ruby tags intact
  return <span dangerouslySetInnerHTML={{ __html: text }} />;
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
    <div className="absolute top-12 right-0 z-50 bg-card dark:bg-dark-850 rounded-lg shadow-lg border border-border dark:border-dark-700 p-4 w-64">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-foreground">{t('news.reader.settings', 'Reading Settings')}</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>

      {/* Font Size */}
      <div className="mb-4">
        <label className="text-sm font-medium text-foreground mb-2 block">
          {t('news.reader.fontSize', 'Text Size')}
        </label>
        <div className="grid grid-cols-4 gap-1">
          {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
            <button
              key={size}
              onClick={() => onSettingsChange({ ...settings, fontSize: size })}
              className={`py-1 px-2 rounded text-sm ${
                settings.fontSize === size
                  ? 'bg-primary-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showFurigana}
            onChange={(e) => onSettingsChange({ ...settings, showFurigana: e.target.checked })}
            className="rounded text-primary-600"
          />
          <span className="text-sm text-foreground">{t('news.reader.showFurigana', 'Show Furigana')}</span>
        </label>
      </div>

      {/* Grammar Highlight Toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.highlightGrammar}
            onChange={(e) => onSettingsChange({ ...settings, highlightGrammar: e.target.checked })}
            className="rounded text-primary-600"
          />
          <span className="text-sm text-foreground">{t('news.reader.highlightGrammar', 'Grammar Highlight')}</span>
        </label>
      </div>
    </div>
  );
}

// Vocabulary popup component
function VocabularyPopup({
  word,
  position,
  onClose
}: {
  word: string;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { play: playTTS } = useTTS();
  const [loading, setLoading] = useState(true);
  const [definition, setDefinition] = useState<any>(null);

  useEffect(() => {
    // Simulate fetching word definition
    setTimeout(() => {
      setDefinition({
        word: word,
        reading: 'よみかた',
        meaning: 'Sample definition for ' + word,
        type: '名詞',
        jlpt: 'N3'
      });
      setLoading(false);
    }, 500);
  }, [word]);

  return (
    <div
      className="absolute z-50 bg-card dark:bg-dark-850 rounded-lg shadow-lg border border-border dark:border-dark-700 p-4 max-w-sm"
      style={{
        left: Math.min(position.x, window.innerWidth - 320),
        top: position.y + 20
      }}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground">{word}</h3>
          <AudioButton
            onPlay={async () => {
              await playTTS(word, {
                voice: 'ja-JP',
                rate: 0.8, // Slower for individual words
              });
            }}
            size="sm"
            position="inline"
          />
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div>
      ) : definition ? (
        <div className="space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">{t('news.reader.reading', 'Reading')}:</span>
            <span className="text-foreground">{definition.reading}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">{t('news.reader.meaning', 'Meaning')}:</span>
            <span className="text-foreground">{definition.meaning}</span>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded">
              {definition.jlpt}
            </span>
            <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded">
              {definition.type}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">{t('news.reader.wordNotFound', 'Definition not found')}</div>
      )}
    </div>
  );
}

export default function ArticleReader({ article, onBack }: ArticleReaderProps) {
  const { t } = useI18n();
  const { play: playTTS, stop: stopTTS, playing: isPlaying } = useTTS();
  const [settings, setSettings] = useState<ReadingSettings>({
    fontSize: 'medium',
    showFurigana: true,
    highlightGrammar: false
  });
  const [showSettings, setShowSettings] = useState(false);
  const [selectedWord, setSelectedWord] = useState<{ word: string; position: { x: number; y: number } } | null>(null);
  const [processedContent, setProcessedContent] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Process content with furigana if not already present
    processContent();
  }, [article.content]);

  const processContent = async () => {
    // Check if content already has ruby tags
    if (article.content.includes('<ruby>')) {
      setProcessedContent(article.content);
      return;
    }

    // If the article has furigana flag but no ruby tags, fetch furigana
    if (article.metadata?.hasFurigana || article.source === 'NHK Easy') {
      try {
        const response = await fetch('/api/furigana', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: article.content })
        });

        if (response.ok) {
          const data = await response.json();
          setProcessedContent(data.result || article.content);
        } else {
          setProcessedContent(article.content);
        }
      } catch (error) {
        console.error('Failed to fetch furigana:', error);
        setProcessedContent(article.content);
      }
    } else {
      setProcessedContent(article.content);
    }
  };

  const handleTextClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (selectedText && selectedText.length > 0 && selectedText.length < 20) {
      const rect = selection?.getRangeAt(0).getBoundingClientRect();
      if (rect) {
        setSelectedWord({
          word: selectedText,
          position: { x: rect.left, y: rect.bottom }
        });
      }
    }
  };

  const getFontSizeClass = () => {
    switch (settings.fontSize) {
      case 'small': return 'text-sm';
      case 'medium': return 'text-base';
      case 'large': return 'text-lg';
      case 'xlarge': return 'text-xl';
      default: return 'text-base';
    }
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 bg-card dark:bg-dark-850 border-b border-border dark:border-dark-700 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-foreground hover:text-primary-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
              <span className="text-sm font-medium">{t('common.back', 'Back')}</span>
            </button>

            {/* TTS Button */}
            <AudioButton
              onPlay={async () => {
                // Stop if already playing
                if (isPlaying) {
                  stopTTS();
                  return;
                }

                // Get clean text without ruby tags
                const cleanText = processedContent.replace(/<ruby>(.*?)<rt>.*?<\/rt><\/ruby>/g, '$1');
                const plainText = cleanText.replace(/<[^>]*>/g, ''); // Remove all HTML tags

                // Play the article content
                await playTTS(plainText, {
                  voice: 'ja-JP',
                  rate: 0.9, // Slightly slower for better comprehension
                });
              }}
              size="md"
              position="inline"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label={t('news.reader.settings', 'Settings')}
            >
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
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
      </header>

      {/* Article Content */}
      <article className="max-w-3xl mx-auto px-4 py-8">
        {/* Article Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-foreground mb-4">
              {article.title}
            </h1>
            {/* TTS for Title */}
            <AudioButton
              onPlay={async () => {
                await playTTS(article.title, {
                  voice: 'ja-JP',
                  rate: 0.9,
                });
              }}
              size="sm"
              position="inline"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(article.publishDate)}
            </span>

            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {article.metadata?.readingTime || Math.ceil((article.metadata?.wordCount || 500) / 300)}{t('news.readingTime', 'min')}
            </span>

            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
              article.difficulty === 'N5' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
              article.difficulty === 'N4' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' :
              article.difficulty === 'N3' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' :
              article.difficulty === 'N2' ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' :
              'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
            }`}>
              {article.difficulty}
            </span>

            <span className="text-muted-foreground/80">
              {t('news.source', 'Source')}: {article.source}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-card dark:bg-dark-850 rounded-lg shadow-sm border border-border dark:border-dark-700 p-6">
          <div
            ref={contentRef}
            className={`prose dark:prose-invert max-w-none ${getFontSizeClass()}`}
            onClick={handleTextClick}
            style={{ lineHeight: '2', fontFamily: "'Noto Sans JP', sans-serif" }}
          >
            {processedContent.split('\n\n').map((paragraph, index) => (
              <div key={index} className="mb-4 group relative leading-loose sm:leading-normal">
                <p className="inline">
                  <FuriganaText text={paragraph} showFurigana={settings.showFurigana} />
                </p>
                {/* Per-paragraph TTS button - shown on hover */}
                <div className="inline-block ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <AudioButton
                    onPlay={async () => {
                      // Clean paragraph text
                      const cleanPara = paragraph.replace(/<ruby>(.*?)<rt>.*?<\/rt><\/ruby>/g, '$1');
                      const plainPara = cleanPara.replace(/<[^>]*>/g, '');
                      await playTTS(plainPara, {
                        voice: 'ja-JP',
                        rate: 0.9,
                      });
                    }}
                    size="sm"
                    position="inline"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Original URL */}
        {article.url && (
          <div className="mt-6 text-center">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 underline"
            >
              {t('news.viewOriginal', 'View original article')} →
            </a>
          </div>
        )}
      </article>

      {/* Vocabulary Popup */}
      {selectedWord && (
        <VocabularyPopup
          word={selectedWord.word}
          position={selectedWord.position}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  );
}