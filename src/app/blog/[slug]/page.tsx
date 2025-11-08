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
import "@/styles/blog-content.css";

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
      {/* Navigation is now global - rendered in root layout */}
          <div className="absolute top-60 right-20 w-48 h-48 bg-japanese-matcha/20 dark:bg-japanese-matchaDark/15 rounded-full blur-3xl animate-pulse delay-700" />
          <div className="absolute bottom-40 left-1/3 w-44 h-44 bg-japanese-zen/20 dark:bg-japanese-zenDark/15 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
      {/* Navigation is now global - rendered in root layout */}

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

      {/* Navigation is now global - rendered in root layout */}
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
        <div className="max-w-none mb-12 sm:mb-16">
          <div
            className="bg-white dark:bg-surface-dark rounded-2xl shadow-lg p-6 sm:p-8 lg:p-12"
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
                  "table",
                  "thead",
                  "tbody",
                  "tr",
                  "th",
                  "td",
                  "div",
                  "span",
                ],
                ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
              }),
            }}
            style={{
              // Enhanced typography and spacing
              fontSize: '18px',
              lineHeight: '1.7',
              color: '#1f2937',
            }}
            className="blog-content"
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
