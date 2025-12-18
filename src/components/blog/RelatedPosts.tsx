'use client';

import Link from 'next/link';
import type { BlogPost } from '@/services/blogService';

interface RelatedPostsProps {
  posts: BlogPost[];
}

export function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) {
    return null;
  }

  const formatDate = (date: string | Date | any) => {
    if (!date) return "";

    try {
      let dateObj: Date;

      if (typeof date === "string") {
        dateObj = new Date(date);
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (date._seconds !== undefined) {
        dateObj = new Date(date._seconds * 1000);
      } else if (typeof date === "object" && date.toDate) {
        dateObj = date.toDate();
      } else {
        return "";
      }

      if (isNaN(dateObj.getTime())) {
        return "";
      }

      return dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return "";
    }
  };

  return (
    <section className="mt-16 pt-12 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-3 h-3 bg-gradient-to-r from-japanese-matcha to-japanese-zen rounded-full"></div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          Related Articles
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group bg-white/80 dark:bg-surface-dark/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 overflow-hidden hover:-translate-y-1"
          >
            {post.cover && (
              <div className="aspect-video overflow-hidden relative">
                <img
                  src={post.cover}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            )}

            <div className="p-6">
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {post.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-primary-100 dark:bg-gray-700 text-primary-700 dark:text-gray-100 rounded-full text-xs font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                {post.title}
              </h3>

              {post.excerpt && (
                <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 text-sm leading-relaxed">
                  {post.excerpt}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-700">
                {formatDate(post.publishDate) && (
                  <time className="flex items-center gap-1">
                    📅 {formatDate(post.publishDate)}
                  </time>
                )}
                {post.readingTime && (
                  <span className="flex items-center gap-1">
                    ⏱️ {post.readingTime}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
