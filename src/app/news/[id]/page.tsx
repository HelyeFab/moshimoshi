'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import EnhancedArticleReader from '@/components/news/EnhancedArticleReaderFinal';
// Navigation is now global via NavigationWrapper in root layout;
import { useI18n } from '@/i18n/I18nContext';
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

export default function NewsArticlePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadArticle();
  }, [params.id]);

  const loadArticle = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/news/article/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch article');

      const data = await response.json();
      if (data.success && data.article) {
        setArticle(data.article);
      } else {
        throw new Error('Article not found');
      }
    } catch (err) {
      console.error('Failed to load article:', err);
      setError(t('news.error.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/news');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-dark-850">
        {/* Navigation is now global - rendered in root layout */}
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-dark-400">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-dark-850">
        {/* Navigation is now global - rendered in root layout */}
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{error || t('news.error.articleNotFound')}</p>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              {t('news.backToNews')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-dark-850">
      {/* Navigation is now global - rendered in root layout */}
      <EnhancedArticleReader article={article} onBack={handleBack} />
    </div>
  );
}