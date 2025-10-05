"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getBlogPostBySlug, getRelatedPosts } from "@/services/blogService";
import type { BlogPost } from "@/services/blogService";
import Navbar from "@/components/layout/Navbar";
import DOMPurify from "isomorphic-dompurify";
import { RelatedPosts } from "@/components/blog/RelatedPosts";
import { CommentSection } from "@/components/blog/CommentSection";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { ReadingProgress } from "@/components/blog/ReadingProgress";
import Head from "next/head";

export default function BlogPostPage() {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ uid: string; admin?: boolean } | null>(null);

  // Fetch current user session
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setCurrentUser({ uid: data.user.uid, admin: data.user.admin });
          }
        }
      } catch (err) {
        // Not logged in, that's fine
        console.log('User not authenticated');
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        setError(null);
        const slug = params.slug as string;
        const fetchedPost = await getBlogPostBySlug(slug);

        if (!fetchedPost) {
          setError("Blog post not found");
          return;
        }

        setPost(fetchedPost);

        // Fetch related posts
        if (fetchedPost && fetchedPost.tags && fetchedPost.tags.length > 0) {
          const related = await getRelatedPosts(slug, fetchedPost.tags, 3);
          setRelatedPosts(related);
        }
      } catch (err) {
        console.error("Error fetching blog post:", err);
        setError("Failed to load blog post");
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [params.slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-40 h-40 bg-japanese-sakura/20 dark:bg-japanese-sakuraDark/15 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-60 right-20 w-48 h-48 bg-japanese-matcha/20 dark:bg-japanese-matchaDark/15 rounded-full blur-3xl animate-pulse delay-700" />
          <div className="absolute bottom-40 left-1/3 w-44 h-44 bg-japanese-zen/20 dark:bg-japanese-zenDark/15 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
        <Navbar showUserMenu={true} />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center relative z-10">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 dark:border-primary-800 mx-auto"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-500 mx-auto absolute top-0 left-1/2 transform -translate-x-1/2"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Loading your story...
          </p>
        </div>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-40 h-40 bg-japanese-sakura/20 dark:bg-japanese-sakuraDark/15 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-60 right-20 w-48 h-48 bg-japanese-matcha/20 dark:bg-japanese-matchaDark/15 rounded-full blur-3xl animate-pulse delay-700" />
          <div className="absolute bottom-40 left-1/3 w-44 h-44 bg-japanese-zen/20 dark:bg-japanese-zenDark/15 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
        <Navbar showUserMenu={true} />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center relative z-10">
          <div className="text-8xl mb-6">🔍</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {error || "Story not found"}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
            The story you're looking for seems to have wandered off. Let's get
            you back to our collection.
          </p>
          <button
            type="button"
            onClick={() => router.push("/blog")}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-500 to-japanese-sakura text-white rounded-full hover:from-primary-600 hover:to-japanese-sakuraDark transition-all font-medium shadow-lg hover:shadow-xl hover:scale-105"
          >
            <span>←</span>
            <span>Explore All Stories</span>
          </button>
        </div>
      </main>
    );
  }

  const formatDate = (date: string | Date | any) => {
    if (!date) return "Unknown date";

    try {
      let dateObj: Date;

      // Handle different date formats
      if (typeof date === "string") {
        dateObj = new Date(date);
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (date._seconds !== undefined) {
        // Firestore Timestamp format
        dateObj = new Date(date._seconds * 1000);
      } else if (typeof date === "object" && date.toDate) {
        // Firestore Timestamp with toDate method
        dateObj = date.toDate();
      } else {
        console.error("Unknown date format:", date);
        return "Invalid date";
      }

      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return "Invalid date";
      }

      return dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error, date);
      return "Invalid date";
    }
  };

  // Generate JSON-LD structured data for rich search results
  const jsonLd = post ? {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt || "",
    "image": post.cover || "",
    "datePublished": post.publishDate ? new Date(post.publishDate).toISOString() : "",
    "dateModified": post.updatedAt ? new Date(post.updatedAt).toISOString() : "",
    "author": {
      "@type": "Person",
      "name": post.author || "Moshimoshi Team",
      "image": post.authorImage || "",
    },
    "publisher": {
      "@type": "Organization",
      "name": "Moshimoshi",
      "logo": {
        "@type": "ImageObject",
        "url": "https://moshimoshi.app/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://moshimoshi.app/blog/${post.slug}`
    },
    "keywords": post.tags?.join(", ") || "",
    "articleSection": post.tags?.[0] || "Japanese Learning",
    "wordCount": post.content ? post.content.split(/\s+/).length : 0,
    "timeRequired": post.readingTime || "",
  } : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 overflow-hidden">
      {/* Reading Progress Bar */}
      <ReadingProgress />

      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Decorative elements - hidden on mobile for better performance */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none hidden sm:block">
        <div className="absolute top-20 left-10 w-32 h-32 bg-japanese-sakura/30 dark:bg-japanese-sakuraDark/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-60 right-20 w-40 h-40 bg-japanese-matcha/30 dark:bg-japanese-matchaDark/20 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute bottom-40 left-1/3 w-36 h-36 bg-japanese-zen/30 dark:bg-japanese-zenDark/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <Navbar showUserMenu={true} />

      <article className="max-w-4xl mx-auto px-4 py-8 sm:py-12 relative z-10">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => router.push("/blog")}
          className="group inline-flex items-center gap-2 mb-6 sm:mb-8 text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5 transform group-hover:-translate-x-1 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back to Blog</span>
        </button>

        {/* Cover Image */}
        {post.cover && (
          <div className="mb-8 sm:mb-12 rounded-2xl overflow-hidden shadow-2xl">
            <img
              src={post.cover}
              alt={post.title}
              className="w-full h-64 sm:h-96 object-cover"
            />
          </div>
        )}

        {/* Header */}
        <header className="mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              {post.authorImage && (
                <img
                  src={post.authorImage}
                  alt={post.author}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span>{post.author}</span>
            </div>
            <span>•</span>
            <time>{formatDate(post.publishDate)}</time>
            {post.readingTime && (
              <>
                <span>•</span>
                <span>{post.readingTime}</span>
              </>
            )}
            {post.views !== undefined && (
              <>
                <span>•</span>
                <span>{post.views} views</span>
              </>
            )}
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 sm:mt-6">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Excerpt */}
        {post.excerpt && (
          <div className="mb-8 sm:mb-12 p-4 sm:p-6 bg-white dark:bg-surface-dark rounded-2xl shadow-md border-l-4 border-primary-500">
            <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 italic">
              {post.excerpt}
            </p>
          </div>
        )}

        {/* Content */}
        <div className="prose prose-lg dark:prose-invert max-w-none mb-12 sm:mb-16">
          <div
            className="bg-white dark:bg-surface-dark rounded-2xl shadow-md p-6 sm:p-8 text-gray-800 dark:text-gray-200 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(post.content, {
                ALLOWED_TAGS: [
                  "p",
                  "br",
                  "strong",
                  "em",
                  "s",
                  "h1",
                  "h2",
                  "h3",
                  "h4",
                  "h5",
                  "h6",
                  "ul",
                  "ol",
                  "li",
                  "a",
                  "code",
                  "pre",
                  "blockquote",
                ],
                ALLOWED_ATTR: ["href", "target", "rel", "class"],
              }),
            }}
          />
        </div>

        {/* Share Buttons */}
        {post && (
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <ShareButtons
              url={`https://moshimoshi.app/blog/${post.slug}`}
              title={post.title}
              description={post.excerpt}
            />
          </div>
        )}

        {/* Comments Section */}
        {post && (
          <CommentSection
            postId={post.id}
            currentUserId={currentUser?.uid}
            isAdmin={currentUser?.admin}
          />
        )}

        {/* Related Posts */}
        {relatedPosts.length > 0 && <RelatedPosts posts={relatedPosts} />}

        {/* Footer */}
        <footer className="pt-8 border-t border-gray-200 dark:border-gray-700 mt-12">
          <button
            type="button"
            onClick={() => router.push("/blog")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl shadow-md hover:shadow-lg border-2 border-transparent hover:border-primary-400 dark:hover:border-primary-500 transition-all font-medium"
          >
            ← Back to all posts
          </button>
        </footer>
      </article>
    </main>
  );
}
