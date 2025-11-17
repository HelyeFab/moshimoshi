'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Book } from '@/types/book';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import EnhancedArticleReaderFinal from '@/components/news/EnhancedArticleReaderFinal';
import { ArrowLeft, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { getGradientForBook } from '@/lib/utils/gradients';

export default function BookReaderPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params?.id as string;

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) return;

    const loadBook = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/library/books?id=${bookId}`);

        if (!response.ok) {
          throw new Error('Book not found');
        }

        const data = await response.json();
        setBook(data.data);
      } catch (err) {
        console.error('Error loading book:', err);
        setError(err instanceof Error ? err.message : 'Failed to load book');
      } finally {
        setLoading(false);
      }
    };

    loadBook();
  }, [bookId]);

  if (loading) {
    return <LoadingOverlay />;
  }

  if (error || !book) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900">
        <div className="text-center px-4">
          <BookOpen className="w-20 h-20 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Book Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || "The book you're looking for doesn't exist."}
          </p>
          <Link
            href="/library"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  // Convert Book to NewsArticle format for the reader component
  const articleForReader = {
    id: book.id,
    title: book.titleJa,
    content: book.content,
    summary: book.summary,
    url: `/library/${book.id}`,
    imageUrl: book.coverImageUrl,
    publishDate: book.createdAt,
    source: 'Toshokan Library',
    category: book.category || 'books',
    difficulty: book.jlptLevel,
    tags: book.tags,
    metadata: {
      wordCount: book.metadata?.wordCount,
      readingTime: book.metadata?.readingTime,
      hasFurigana: true
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      {/* Back Button */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-dark-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-dark-700">
        <div className="container mx-auto px-4 py-3">
          <Link
            href="/library"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Library</span>
          </Link>
        </div>
      </div>

      {/* Book Header */}
      <div className="bg-gradient-to-b from-primary-50 to-white dark:from-primary-900/20 dark:to-dark-850 py-8 border-b border-gray-200 dark:border-dark-700">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-start gap-6">
            {/* Cover Image or Gradient */}
            <div className="flex-shrink-0">
              {book.coverImageUrl ? (
                <img
                  src={book.coverImageUrl}
                  alt={book.title}
                  className="w-32 h-48 object-cover rounded-lg shadow-lg border border-gray-200 dark:border-dark-700"
                />
              ) : (
                <div className={`w-32 h-48 bg-gradient-to-br ${getGradientForBook(book.id)} rounded-lg shadow-lg flex items-center justify-center p-4`}>
                  <div className="text-center">
                    <BookOpen className="w-10 h-10 text-white/80 mb-2 mx-auto" />
                    <p className="text-white font-bold text-xs line-clamp-3">
                      {book.titleJa}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Book Info */}
            <div className="flex-1">
              <div className="inline-block px-3 py-1 bg-primary-500 text-white rounded-full text-xs font-bold mb-3">
                {book.jlptLevel}
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {book.titleJa}
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                {book.title}
              </p>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  <span className="font-medium">Original:</span> {book.bookName}
                </p>
                {book.author && (
                  <p>
                    <span className="font-medium">Author:</span> {book.author}
                  </p>
                )}
                {book.metadata?.readingTime && (
                  <p>
                    <span className="font-medium">Reading Time:</span> ~{book.metadata.readingTime} minutes
                  </p>
                )}
              </div>

              {/* Summary */}
              {book.summary && (
                <div className="mt-4 p-4 bg-white/50 dark:bg-dark-800/50 rounded-lg border border-gray-200 dark:border-dark-700">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {book.summary}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Book Reader (using EnhancedArticleReaderFinal) */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <EnhancedArticleReaderFinal article={articleForReader} />
      </div>
    </div>
  );
}
