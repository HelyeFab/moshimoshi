'use client';

import { useState } from 'react';
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

export default function EnhancedArticleReaderSimple({
  article,
  onBack
}: {
  article: NewsArticle;
  onBack?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="mb-4 px-4 py-2 bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600"
        >
          ← {t('common.back')}
        </button>

        <h1 className="text-3xl font-bold mb-4 text-foreground dark:text-dark-100">
          {article.title}
        </h1>

        <div className="flex items-center gap-4 text-sm text-muted-foreground dark:text-dark-400">
          <span>{article.source}</span>
          <span>{article.difficulty}</span>
          <span>{new Date(article.publishDate).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-lg max-w-none">
        <div
          className="text-foreground dark:text-dark-100 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </div>

      {/* Link to original */}
      {article.url && (
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-dark-700">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-500 hover:text-primary-600"
          >
            {t('news.reader.viewOriginal')} →
          </a>
        </div>
      )}
    </div>
  );
}