'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';

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

// Loading skeleton component
function ArticleCardSkeleton() {
  return (
    <div className="bg-card dark:bg-dark-850 rounded-lg shadow-sm border border-border dark:border-dark-700 p-4 animate-pulse">
      <div className="flex gap-4">
        <div className="w-20 h-20 bg-gray-200 dark:bg-dark-700 rounded-lg flex-shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 dark:bg-dark-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-2/3"></div>
          <div className="flex items-center gap-2 mt-3">
            <div className="h-6 bg-gray-200 dark:bg-dark-700 rounded-full w-12"></div>
            <div className="h-6 bg-gray-200 dark:bg-dark-700 rounded-full w-16"></div>
            <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-20"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Article card component
function ArticleCard({ article, onClick }: { article: NewsArticle; onClick: (article: NewsArticle) => void }) {
  const { t } = useI18n();

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      N5: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
      N4: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
      N3: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
      N2: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800',
      N1: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
    };
    return colors[difficulty] || colors.N3;
  };

  const getSourceIcon = (source: string) => {
    const icons: Record<string, string> = {
      'NHK Easy': '📺',
      'Todaii': '📚',
      'Watanoc': '🌸',
      'Mainichi News': '📰',
      'Mainichi Shogakusei': '🎒'
    };
    return icons[source] || '📄';
  };

  return (
    <article
      className="bg-card dark:bg-dark-850 rounded-lg shadow-sm border border-border dark:border-dark-700 p-4 hover:shadow-md dark:hover:shadow-dark-900/50 transition-all cursor-pointer hover:border-primary-300 dark:hover:border-primary-600"
      onClick={() => onClick(article)}
    >
      <div className="flex gap-4">
        {/* Thumbnail or icon */}
        <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-800 dark:to-primary-900 flex-shrink-0 flex items-center justify-center">
          {article.imageUrl ? (
            <img src={article.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
          ) : (
            <span className="text-3xl">{getSourceIcon(article.source)}</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground dark:text-gray-100 line-clamp-2 mb-1">
            {article.title}
          </h3>

          {article.summary && (
            <p className="text-sm text-muted-foreground dark:text-gray-400 line-clamp-2 mb-3">
              {article.summary}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getDifficultyColor(article.difficulty)}`}>
              {article.difficulty}
            </span>

            <span className="text-xs text-muted-foreground dark:text-gray-500 flex items-center gap-1">
              <span className="text-xs">📖</span>
              {article.metadata?.readingTime || Math.ceil((article.metadata?.wordCount || 500) / 300)}
              {t('news.readingTime')}
            </span>

            {article.metadata?.hasFurigana && (
              <span className="text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 px-2 py-0.5 rounded-full">
                {t('news.reader.withFurigana')}
              </span>
            )}

            <span className="text-xs text-gray-500">
              {formatDate(article.publishDate)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

// Filter bar component
function FilterBar({
  selectedLevel,
  selectedSource,
  onLevelChange,
  onSourceChange,
  onRefresh,
  isLoading
}: {
  selectedLevel: string;
  selectedSource: string;
  onLevelChange: (level: string) => void;
  onSourceChange: (source: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}) {
  const { t } = useI18n();
  const [showFilters, setShowFilters] = useState(false);

  const levels = ['All', 'N5', 'N4', 'N3', 'N2', 'N1'];
  const sources = ['All', 'NHK Easy', 'Todaii', 'Watanoc', 'Mainichi News', 'Mainichi Shogakusei'];

  return (
    <div className="bg-card dark:bg-dark-850 rounded-lg shadow-sm border border-border dark:border-dark-700 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-medium text-foreground"
        >
          <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {t('news.filters.title', 'Filters')}
          {(selectedLevel !== 'All' || selectedSource !== 'All') && (
            <span className="ml-1 px-2 py-0.5 bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-full text-xs">
              {t('news.filters.applied', 'Applied')}
            </span>
          )}
        </button>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
        >
          {isLoading ? t('news.loading', 'Loading...') : t('news.refresh', 'Refresh')}
        </button>
      </div>

      {showFilters && (
        <div className="space-y-3 pt-3 border-t border-border dark:border-dark-700">
          {/* Level filter */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('news.filters.level', 'Level')}</label>
            <div className="flex flex-wrap gap-2">
              {levels.map(level => (
                <button
                  key={level}
                  onClick={() => onLevelChange(level)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedLevel === level
                      ? 'bg-primary-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Source filter */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('news.filters.source', 'Source')}</label>
            <div className="flex flex-wrap gap-2">
              {sources.map(source => (
                <button
                  key={source}
                  onClick={() => onSourceChange(source)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedSource === source
                      ? 'bg-primary-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const pageStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Japanese News Reader - Doshi",
  "description": "Read real Japanese news with furigana, vocabulary lookup, and comprehension quizzes",
  "url": "https://doshi.app/news"
};

export default function NewsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [selectedSource, setSelectedSource] = useState('All');

  // Load articles
  useEffect(() => {
    loadArticles();
  }, []);

  // Filter articles when filters change
  useEffect(() => {
    filterArticles();
  }, [articles, selectedLevel, selectedSource]);

  const loadArticles = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/news/articles?limit=50');
      if (!response.ok) throw new Error('Failed to fetch articles');

      const data = await response.json();
      setArticles(data.data || []);
    } catch (err) {
      console.error('Failed to load articles:', err);
      setError('ニュース記事の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const filterArticles = () => {
    let filtered = [...articles];

    if (selectedLevel !== 'All') {
      filtered = filtered.filter(a => a.difficulty === selectedLevel);
    }

    if (selectedSource !== 'All') {
      filtered = filtered.filter(a => a.source === selectedSource);
    }

    setFilteredArticles(filtered);
  };

  const handleArticleClick = (article: NewsArticle) => {
    // Navigate to article reader
    router.push(`/news/${article.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageStructuredData),
        }}
      />

      {/* Navbar */}
      <Navbar
        backLink={{
          href: '/dashboard',
          label: t('common.backToDashboard', 'Back to Dashboard')
        }}
      />

      {/* Page Header */}
      <header className="px-4 pt-6 pb-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground">
            {t('news.title', 'Japanese News')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('news.subtitle', 'Read Japanese articles by level')}
          </p>
        </div>
      </header>

      <div className="px-4 pb-20 max-w-7xl mx-auto">
        {/* Filter Bar */}
        <FilterBar
          selectedLevel={selectedLevel}
          selectedSource={selectedSource}
          onLevelChange={setSelectedLevel}
          onSourceChange={setSelectedSource}
          onRefresh={loadArticles}
          isLoading={loading}
        />

        {/* Articles List */}
        <div className="space-y-3">
          {loading ? (
            // Loading skeletons
            <>
              <ArticleCardSkeleton />
              <ArticleCardSkeleton />
              <ArticleCardSkeleton />
            </>
          ) : error ? (
            // Error state
            <div className="bg-card dark:bg-dark-850 rounded-lg shadow-sm border border-border dark:border-dark-700 p-8 text-center">
              <p className="text-destructive mb-4">{error}</p>
              <button
                onClick={loadArticles}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                {t('common.retry', 'Retry')}
              </button>
            </div>
          ) : filteredArticles.length === 0 ? (
            // Empty state
            <div className="bg-card dark:bg-dark-850 rounded-lg shadow-sm border border-border dark:border-dark-700 p-8 text-center">
              <div className="text-4xl mb-4">📰</div>
              <p className="text-muted-foreground mb-2">{t('news.noArticles', 'No articles found')}</p>
              <p className="text-sm text-muted-foreground/80">{t('news.noArticlesHint', 'Try changing filters or check back later')}</p>
            </div>
          ) : (
            // Articles
            filteredArticles.map(article => (
              <ArticleCard
                key={article.id}
                article={article}
                onClick={handleArticleClick}
              />
            ))
          )}
        </div>

        {/* Load More Button */}
        {!loading && filteredArticles.length >= 20 && (
          <div className="mt-6 text-center">
            <button
              className="px-6 py-2 bg-card dark:bg-dark-850 border border-border dark:border-dark-700 rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              {t('common.loadMore', 'Load More')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}