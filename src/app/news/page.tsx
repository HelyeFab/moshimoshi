'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';
// Navigation is now global via NavigationWrapper in root layout;
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import NewsArticleFallbackImage from '@/components/news/NewsArticleFallbackImage';

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
    <div className="bg-soft-white dark:bg-dark-850 rounded-lg shadow-sm border border-gray-100 dark:border-dark-700 p-4 animate-pulse">
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
      N5: 'bg-success-100 text-success-700 border-success-200 dark:bg-success-900/20 dark:text-success-400 dark:border-success-800',
      N4: 'bg-info-100 text-info-700 border-info-200 dark:bg-info-900/20 dark:text-info-400 dark:border-info-800',
      N3: 'bg-warning-100 text-warning-700 border-warning-200 dark:bg-warning-900/20 dark:text-warning-400 dark:border-warning-800',
      N2: 'bg-accent-100 text-accent-700 border-accent-200 dark:bg-accent-900/20 dark:text-accent-400 dark:border-accent-800',
      N1: 'bg-danger-100 text-danger-700 border-danger-200 dark:bg-danger-900/20 dark:text-danger-400 dark:border-danger-800'
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
      className="bg-soft-white dark:bg-dark-850 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-4 hover:shadow-md dark:hover:shadow-dark-900/50 transition-all cursor-pointer hover:border-primary-300 dark:hover:border-primary-600"
      onClick={() => onClick(article)}
    >
      <div className="flex gap-4">
        {/* Thumbnail with professional fallback */}
        <div className="w-20 h-20 rounded-lg flex-shrink-0 overflow-hidden">
          <NewsArticleFallbackImage
            imageUrl={article.imageUrl}
            title={article.title}
            source={article.source}
            category={article.category}
            difficulty={article.difficulty}
            height="h-20"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground dark:text-dark-100 line-clamp-2 mb-1">
            {article.title}
          </h3>

          {article.summary && (
            <p className="text-sm text-muted-foreground dark:text-dark-400 line-clamp-2 mb-3">
              {article.summary}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getDifficultyColor(article.difficulty)}`}>
              {article.difficulty}
            </span>

            <span className="text-xs text-muted-foreground dark:text-dark-500 flex items-center gap-1">
              <span className="text-xs">📖</span>
              {article.metadata?.readingTime || Math.ceil((article.metadata?.wordCount || 500) / 300)}
              {t('news.readingTime')}
            </span>

            {article.metadata?.hasFurigana && (
              <span className="text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 px-2 py-0.5 rounded-full">
                {t('news.reader.withFurigana')}
              </span>
            )}

            <span className="text-xs text-muted-foreground dark:text-dark-500">
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
    <div className="bg-soft-white dark:bg-dark-850 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-medium text-foreground"
        >
          <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {t('news.filters.title')}
          {(selectedLevel !== 'All' || selectedSource !== 'All') && (
            <span className="ml-1 px-2 py-0.5 bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-full text-xs">
              {t('news.filters.applied')}
            </span>
          )}
        </button>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="px-3 py-1.5 bg-primary-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
        >
          {isLoading ? t('news.loading') : t('news.refresh')}
        </button>
      </div>

      {showFilters && (
        <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-dark-700">
          {/* Level filter */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('news.filters.level')}</label>
            <div className="flex flex-wrap gap-2">
              {levels.map(level => (
                <button
                  key={level}
                  onClick={() => onLevelChange(level)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedLevel === level
                      ? 'bg-primary-500 text-white'
                      : 'bg-soft-white dark:bg-dark-700 text-muted-foreground hover:bg-gray-100 dark:hover:bg-dark-600'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Source filter */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('news.filters.source')}</label>
            <div className="flex flex-wrap gap-2">
              {sources.map(source => (
                <button
                  key={source}
                  onClick={() => onSourceChange(source)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedSource === source
                      ? 'bg-primary-500 text-white'
                      : 'bg-soft-white dark:bg-dark-700 text-muted-foreground hover:bg-gray-100 dark:hover:bg-dark-600'
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
  const { user, loading: authLoading } = useAuth();
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
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background to-background-dark dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageStructuredData),
        }}
      />

      {/* Navbar */}
      {/* Navigation is now global - rendered in root layout */}

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
            <div className="bg-soft-white dark:bg-dark-850 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-8 text-center">
              <p className="text-danger-600 dark:text-danger-400 mb-4">{error}</p>
              <button
                onClick={loadArticles}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                {t('common.retry')}
              </button>
            </div>
          ) : filteredArticles.length === 0 ? (
            // Empty state
            <div className="bg-soft-white dark:bg-dark-850 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-8 text-center">
              <div className="text-4xl mb-4">📰</div>
              <p className="text-muted-foreground dark:text-dark-400 mb-2">{t('news.noArticles')}</p>
              <p className="text-sm text-muted-foreground/70 dark:text-dark-500">{t('news.noArticlesHint')}</p>
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
              className="px-6 py-2 bg-soft-white dark:bg-dark-850 border border-gray-100 dark:border-dark-700 rounded-lg text-foreground dark:text-dark-100 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
            >
              {t('news.loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}