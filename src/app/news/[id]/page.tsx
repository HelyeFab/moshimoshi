'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ArticleReader from '@/components/ArticleReader';
import Navbar from '@/components/layout/Navbar';
import { useI18n } from '@/i18n/I18nContext';

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

      const response = await fetch(`/api/news/articles?id=${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch article');

      const data = await response.json();
      if (data.data && data.data.length > 0) {
        setArticle(data.data[0]);
      } else {
        throw new Error('Article not found');
      }
    } catch (err) {
      console.error('Failed to load article:', err);
      setError(t('news.error.loadFailed', 'Failed to load article'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/news');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar backLink={{
          href: '/news',
          label: t('news.backToNews', 'Back to news list')
        }} />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">{t('news.loading', 'Loading...')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar backLink={{
          href: '/news',
          label: t('news.backToNews', 'Back to news list')
        }} />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-destructive mb-4">{error || t('news.error.articleNotFound', 'Article not found')}</p>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {t('news.backToNews', 'Back to news list')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar backLink={{
        href: '/news',
        label: t('news.backToNews', 'Back to news list')
      }} />
      <ArticleReader article={article} onBack={handleBack} />
    </div>
  );
}