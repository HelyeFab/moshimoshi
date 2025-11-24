'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Book } from '@/types/book';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import EnhancedArticleReaderFinal from '@/components/news/EnhancedArticleReaderFinal';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Eye,
  BookText,
  Calendar,
  Bookmark,
  Share2,
  Tag
} from 'lucide-react';
import Link from 'next/link';
import { getGradientForBook } from '@/lib/utils/gradients';
import { motion } from 'framer-motion';

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
      {/* Fixed Navigation Bar */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-50 bg-white/95 dark:bg-dark-900/95 backdrop-blur-xl border-b border-gray-200 dark:border-dark-700 shadow-sm"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex items-center justify-between py-3">
            {/* Back Button */}
            <Link
              href="/library"
              className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-800 transition-all"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline font-medium">Back to Library</span>
              <span className="sm:hidden font-medium">Back</span>
            </Link>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800 hover:text-primary-600 dark:hover:text-primary-400 transition-all"
                aria-label="Bookmark"
              >
                <Bookmark className="w-5 h-5" />
              </button>
              <button
                className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800 hover:text-primary-600 dark:hover:text-primary-400 transition-all"
                aria-label="Share"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Hero Header with Background */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative overflow-hidden"
      >
        {/* Background Image/Gradient with Overlay */}
        <div className="absolute inset-0 z-0">
          {book.coverImageUrl ? (
            <>
              {/* Blurred background image */}
              <div
                className="absolute inset-0 bg-cover bg-center blur-2xl scale-110 opacity-20 dark:opacity-10"
                style={{ backgroundImage: `url(${book.coverImageUrl})` }}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/90 to-white dark:from-dark-900/80 dark:via-dark-900/90 dark:to-dark-900" />
            </>
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${getGradientForBook(book.id)} opacity-10 dark:opacity-5`} />
          )}
        </div>

        {/* Header Content */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8 sm:py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-6 sm:gap-8 lg:gap-12">
            {/* Cover Image */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex justify-center lg:justify-start"
            >
              {book.coverImageUrl ? (
                <img
                  src={book.coverImageUrl}
                  alt={book.title}
                  className="w-48 sm:w-56 lg:w-64 h-auto aspect-[2/3] object-cover rounded-2xl shadow-2xl ring-1 ring-gray-900/10 dark:ring-white/10"
                />
              ) : (
                <div className={`w-48 sm:w-56 lg:w-64 h-auto aspect-[2/3] bg-gradient-to-br ${getGradientForBook(book.id)} rounded-2xl shadow-2xl ring-1 ring-gray-900/10 dark:ring-white/10 flex items-center justify-center p-8`}>
                  <div className="text-center">
                    <BookOpen className="w-16 h-16 sm:w-20 sm:h-20 text-white/90 mb-4 mx-auto" />
                    <p className="text-white font-bold text-sm sm:text-base line-clamp-4">
                      {book.titleJa}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Book Information */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col justify-center space-y-4 sm:space-y-6"
            >
              {/* JLPT Level Badge */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-full text-sm font-bold shadow-lg shadow-primary-500/30">
                  {book.jlptLevel}
                </span>
                {book.category && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-dark-800 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium">
                    <Tag className="w-3.5 h-3.5" />
                    {book.category}
                  </span>
                )}
              </div>

              {/* Japanese Title */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white leading-tight">
                {book.titleJa}
              </h1>

              {/* English Title */}
              <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 font-medium">
                {book.title}
              </p>

              {/* Original Book Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <BookText className="w-5 h-5 text-gray-400" />
                  <span className="font-semibold">Original:</span>
                  <span>{book.bookName}</span>
                </div>
                {book.author && (
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <span className="w-5 h-5 text-gray-400 flex items-center justify-center text-lg">✍️</span>
                    <span className="font-semibold">Author:</span>
                    <span>{book.author}</span>
                  </div>
                )}
              </div>

              {/* Metadata Stats */}
              <div className="flex flex-wrap gap-4 sm:gap-6 pt-2">
                {book.metadata?.readingTime && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Clock className="w-5 h-5" />
                    <span className="text-sm sm:text-base font-medium">
                      ~{book.metadata.readingTime} min read
                    </span>
                  </div>
                )}
                {book.metadata?.wordCount && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <BookText className="w-5 h-5" />
                    <span className="text-sm sm:text-base font-medium">
                      {book.metadata.wordCount.toLocaleString()} words
                    </span>
                  </div>
                )}
                {book.viewCount !== undefined && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Eye className="w-5 h-5" />
                    <span className="text-sm sm:text-base font-medium">
                      {book.viewCount.toLocaleString()} views
                    </span>
                  </div>
                )}
              </div>

              {/* Summary */}
              {book.summary && (
                <div className="pt-2">
                  <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3 sm:line-clamp-none">
                    {book.summary}
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Bottom fade effect */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-gray-50 dark:from-dark-900 to-transparent z-10" />
      </motion.div>

      {/* Book Reader Content */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl"
      >
        <EnhancedArticleReaderFinal article={articleForReader} />
      </motion.div>
    </div>
  );
}
