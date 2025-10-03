'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPublishedBlogPosts } from '@/services/blogService';
import type { BlogPost } from '@/services/blogService';
import Navbar from '@/components/layout/Navbar';
import Link from 'next/link';

export default function BlogPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        console.log('Fetching published blog posts...');
        const publishedPosts = await getPublishedBlogPosts();
        console.log('Fetched posts:', publishedPosts);
        console.log('Number of posts:', publishedPosts.length);
        setPosts(publishedPosts);
      } catch (error) {
        console.error('Error fetching blog posts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const formatDate = (date: string | Date | any) => {
    if (!date) return 'Unknown date';

    try {
      let dateObj: Date;

      // Handle different date formats
      if (typeof date === 'string') {
        dateObj = new Date(date);
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (date._seconds !== undefined) {
        // Firestore Timestamp format
        dateObj = new Date(date._seconds * 1000);
      } else if (typeof date === 'object' && date.toDate) {
        // Firestore Timestamp with toDate method
        dateObj = date.toDate();
      } else {
        console.error('Unknown date format:', date);
        return 'Invalid date';
      }

      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return 'Invalid date';
      }

      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return 'Invalid date';
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 overflow-hidden">
      {/* Decorative elements - hidden on mobile for better performance */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none hidden sm:block">
        <div className="absolute top-20 left-10 w-32 h-32 bg-japanese-sakura/30 dark:bg-japanese-sakuraDark/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-60 right-20 w-40 h-40 bg-japanese-matcha/30 dark:bg-japanese-matchaDark/20 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute bottom-40 left-1/3 w-36 h-36 bg-japanese-zen/30 dark:bg-japanese-zenDark/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <Navbar showUserMenu={true} />

      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 relative z-10">
        {/* Header */}
        <header className="mb-12 sm:mb-16 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            📚 Blog
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Insights, tips, and updates from the Moshimoshi team
          </p>
        </header>

        {/* Posts Grid */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4">Loading posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              No posts yet
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Check back soon for our latest updates!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group bg-white dark:bg-surface-dark rounded-2xl shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-primary-400 dark:hover:border-primary-500 overflow-hidden"
              >
                {/* Cover Image */}
                {post.cover && (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={post.cover}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                )}

                <div className="p-6">
                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {post.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Title */}
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                    {post.title}
                  </h2>

                  {/* Excerpt */}
                  {post.excerpt && (
                    <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 text-sm">
                      {post.excerpt}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-500 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <time>{formatDate(post.publishDate)}</time>
                    {post.readingTime && <span>{post.readingTime}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
