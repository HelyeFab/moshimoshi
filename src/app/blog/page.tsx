"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPaginatedBlogPosts } from "@/services/blogService";
import type { BlogPost, PaginatedBlogResponse } from "@/services/blogService";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import { NewsletterForm } from "@/components/blog/NewsletterForm";

function BlogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginatedBlogResponse['pagination'] | null>(null);
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    const pageParam = searchParams.get('page');
    if (pageParam) {
      const page = parseInt(pageParam, 10);
      if (!isNaN(page) && page > 0) {
        setCurrentPage(page);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        console.log("Fetching published blog posts...");
        const response = await getPaginatedBlogPosts(currentPage, 18);
        console.log("Fetched posts:", response.posts);
        console.log("Pagination:", response.pagination);
        setPosts(response.posts);
        setPagination(response.pagination);
      } catch (error) {
        console.error("Error fetching blog posts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [currentPage]);

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

  // Get unique categories from posts
  const categories = [
    "all",
    ...Array.from(new Set(posts.flatMap((post) => post.tags || []))),
  ];

  // Filter posts by category
  const filteredPosts =
    selectedCategory === "all"
      ? posts
      : posts.filter((post) => post.tags?.includes(selectedCategory));

  // Get featured post - simple and clear!
  const featuredPost = posts.find(post => post.isFeatured) || null;

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    router.push(`/blog?page=${newPage}`, { scroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      {/* Enhanced Decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-40 h-40 bg-japanese-sakura/20 dark:bg-japanese-sakuraDark/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-60 right-20 w-48 h-48 bg-japanese-matcha/20 dark:bg-japanese-matchaDark/15 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute bottom-40 left-1/3 w-44 h-44 bg-japanese-zen/20 dark:bg-japanese-zenDark/15 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-japanese-mizu/15 dark:bg-japanese-mizuDark/10 rounded-full blur-2xl animate-pulse delay-500" />
      </div>

      <Navbar showUserMenu={true} />

      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12 relative z-10">
        {/* Enhanced Hero Header */}
        <header className="mb-16 sm:mb-20 text-center relative">
          <div className="inline-flex items-center gap-3 mb-6 px-4 py-2 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-sm rounded-full shadow-lg">
            <div className="w-2 h-2 bg-japanese-sakura rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Welcome to our blog
            </span>
            <div className="w-2 h-2 bg-japanese-matcha rounded-full animate-pulse delay-300"></div>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold bg-gradient-to-r from-gray-900 via-primary-600 to-japanese-sakura bg-clip-text text-transparent dark:from-gray-100 dark:via-primary-400 dark:to-japanese-sakuraDark mb-6 pb-2 leading-tight">
            Stories & Insights
          </h1>

          <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8">
            Discover the latest in Japanese language learning, cultural
            insights, and product updates from the Moshimoshi team
          </p>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {posts.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Articles
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-japanese-matcha dark:text-japanese-matchaDark">
                {categories.length - 1}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Topics
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-japanese-zen dark:text-japanese-zenDark">
                ∞
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Learning
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-20">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 dark:border-primary-800 mx-auto"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-500 mx-auto absolute top-0 left-1/2 transform -translate-x-1/2"></div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-6 text-lg">
              Curating amazing content for you...
            </p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-8xl mb-6">✨</div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Something amazing is coming
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
              We're crafting incredible stories and insights just for you. Check
              back soon!
            </p>
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-japanese-sakura text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-all">
              <span>🔔</span>
              <span>Get notified when we publish</span>
            </div>
          </div>
        ) : (
          <>
            {/* Category Filter - Enhanced with Collapse */}
            {categories.length > 1 && (
              <div className="mb-16">
                <div className="text-center mb-6">
                  <button
                    type="button"
                    onClick={() => setShowCategories(!showCategories)}
                    className="inline-flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors group"
                  >
                    <span>Explore Topics</span>
                    <svg
                      className={`w-6 h-6 transition-transform duration-300 ${showCategories ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Filter by your interests
                  </p>
                </div>

                {/* Collapsible Categories */}
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  showCategories ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="flex flex-wrap justify-center gap-3">
                    {categories.map((category, idx) => {
                      const categoryCount = category === "all"
                        ? posts.length
                        : posts.filter(p => p.tags?.includes(category)).length;

                      return (
                        <button
                          type="button"
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`group px-6 py-3 rounded-full font-medium transition-all relative overflow-hidden ${
                            selectedCategory === category
                              ? "bg-gradient-to-r from-primary-500 to-japanese-sakura text-white shadow-lg scale-105"
                              : "bg-white/80 dark:bg-surface-dark/80 text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 backdrop-blur-sm border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-500"
                          }`}
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            {category === "all" ? "🌟 All Posts" : `#${category}`}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              selectedCategory === category
                                ? "bg-white/20"
                                : "bg-gray-200 dark:bg-gray-700"
                            }`}>
                              {categoryCount}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Featured Post */}
            {featuredPost && selectedCategory === "all" && (
              <div className="mb-16">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 bg-gradient-to-r from-japanese-sakura to-japanese-zen rounded-full"></div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Featured Story
                  </h2>
                </div>

                <Link
                  href={`/blog/${featuredPost.slug}`}
                  className="group block bg-gradient-to-r from-white to-japanese-mizu/10 dark:from-surface-dark dark:to-japanese-mizuDark/10 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600"
                >
                  <div className="grid md:grid-cols-2 gap-0">
                    {featuredPost.cover && (
                      <div className="aspect-video md:aspect-square overflow-hidden">
                        <img
                          src={featuredPost.cover}
                          alt={featuredPost.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                      </div>
                    )}
                    <div className="p-8 md:p-12 flex flex-col justify-center">
                      {featuredPost.tags && featuredPost.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {featuredPost.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-3 py-1 bg-gradient-to-r from-primary-100 to-japanese-sakura/20 dark:from-primary-900/30 dark:to-japanese-sakuraDark/20 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {featuredPost.title}
                      </h3>

                      {featuredPost.excerpt && (
                        <p className="text-gray-600 dark:text-gray-400 mb-6 text-lg leading-relaxed">
                          {featuredPost.excerpt}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <time className="flex items-center gap-1">
                          <span>📅</span>
                          {formatDate(featuredPost.publishDate)}
                        </time>
                        {featuredPost.readingTime && (
                          <span className="flex items-center gap-1">
                            <span>⏱️</span>
                            {featuredPost.readingTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {/* Quick Read Section - First 3 non-featured posts */}
            {(() => {
              const nonFeaturedForQuickReads = filteredPosts.filter(post => post.id !== featuredPost?.id);
              const shouldShowQuickReads = selectedCategory === "all" && nonFeaturedForQuickReads.length > 3;

              if (!shouldShowQuickReads) return null;

              return (
              <div className="mb-16">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-japanese-zen to-japanese-mizu rounded-full"></div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      Quick Reads
                    </h2>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ⚡ 5-10 min reads
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {nonFeaturedForQuickReads
                    .slice(0, 3)
                    .map((post, index) => (
                      <Link
                        key={post.id}
                        href={`/blog/${post.slug}`}
                        className="group bg-gradient-to-br from-white to-gray-50 dark:from-surface-dark dark:to-dark-800 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-500 hover:-translate-y-1"
                      >
                        <div className="flex items-start gap-4 mb-4">
                          <div className="text-4xl flex-shrink-0">
                            {post.tags?.[0] === 'tutorial' ? '📚' :
                             post.tags?.[0] === 'culture' ? '🎎' :
                             post.tags?.[0] === 'grammar' ? '✏️' :
                             post.tags?.[0] === 'tips' ? '💡' :
                             '📝'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors mb-2 line-clamp-2">
                              {post.title}
                            </h3>
                            {post.tags && post.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {post.tags.slice(0, 2).map((tag) => (
                                  <span
                                    key={tag}
                                    className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-medium"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {post.excerpt && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                            {post.excerpt}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <time>{formatDate(post.publishDate)}</time>
                          {post.readingTime && <span>⏱️ {post.readingTime}</span>}
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
              );
            })()}

            {/* Posts Grid */}
            <div className="mb-16">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-3 h-3 bg-gradient-to-r from-japanese-matcha to-japanese-zen rounded-full"></div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {selectedCategory === "all"
                    ? "All Articles"
                    : `${selectedCategory} Articles`}
                </h2>
                {selectedCategory === "all" && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                    ({filteredPosts.filter(post => post.id !== featuredPost?.id).length} posts)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(() => {
                  const nonFeaturedPosts = filteredPosts.filter(post => post.id !== featuredPost?.id);
                  const hasQuickReads = selectedCategory === "all" && nonFeaturedPosts.length > 3;

                  const displayPosts = selectedCategory === "all"
                    ? (hasQuickReads ? nonFeaturedPosts.slice(3) : nonFeaturedPosts) // Only skip if Quick Reads is showing
                    : filteredPosts;

                  if (displayPosts.length === 0) {
                    return (
                      <div className="col-span-full text-center py-16">
                        <div className="text-6xl mb-4">🔍</div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                          No posts found
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                          No articles match the selected category yet.
                        </p>
                        <button
                          onClick={() => setSelectedCategory("all")}
                          className="px-6 py-3 bg-gradient-to-r from-primary-500 to-japanese-sakura text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-all"
                        >
                          View All Posts
                        </button>
                      </div>
                    );
                  }

                  return displayPosts.map((post, index) => (
                    <Link
                      key={post.id}
                      href={`/blog/${post.slug}`}
                      className="group bg-white/80 dark:bg-surface-dark/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 overflow-hidden hover:-translate-y-2"
                      style={{ animationDelay: `${index * 100}ms` }}
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
                                className="px-3 py-1 bg-gradient-to-r from-primary-100 to-japanese-sakura/20 dark:from-primary-900/30 dark:to-japanese-sakuraDark/20 text-primary-700 dark:text-primary-300 rounded-full text-xs font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                          {post.title}
                        </h3>

                        {post.excerpt && (
                          <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 text-sm leading-relaxed">
                            {post.excerpt}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-700">
                          <time className="flex items-center gap-1">
                            <span>📅</span>
                            {formatDate(post.publishDate)}
                          </time>
                          {post.readingTime && (
                            <span className="flex items-center gap-1">
                              <span>⏱️</span>
                              {post.readingTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ));
                })()}
              </div>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mb-16">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  {/* Previous Button */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={!pagination.hasPreviousPage}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl shadow-md hover:shadow-lg border-2 border-transparent hover:border-primary-400 dark:hover:border-primary-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:hover:border-transparent"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Previous</span>
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-2">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => {
                      // Show first page, last page, current page, and pages around current
                      const showPage =
                        pageNum === 1 ||
                        pageNum === pagination.totalPages ||
                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1);

                      const showEllipsisBefore = pageNum === currentPage - 2 && currentPage > 3;
                      const showEllipsisAfter = pageNum === currentPage + 2 && currentPage < pagination.totalPages - 2;

                      if (!showPage && !showEllipsisBefore && !showEllipsisAfter) return null;

                      if (showEllipsisBefore || showEllipsisAfter) {
                        return (
                          <span key={pageNum} className="px-2 text-gray-400 dark:text-gray-600">
                            ...
                          </span>
                        );
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg font-medium transition-all ${
                            currentPage === pageNum
                              ? 'bg-gradient-to-r from-primary-500 to-japanese-sakura text-white shadow-lg scale-105'
                              : 'bg-white dark:bg-surface-dark text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl shadow-md hover:shadow-lg border-2 border-transparent hover:border-primary-400 dark:hover:border-primary-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:hover:border-transparent"
                  >
                    <span>Next</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Page Info */}
                <div className="text-center mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Page {pagination.page} of {pagination.totalPages} · {pagination.totalPosts} total posts
                </div>
              </div>
            )}

            {/* Newsletter Signup */}
            <div className="bg-gradient-to-r from-japanese-sakura/10 via-white to-japanese-matcha/10 dark:from-japanese-sakuraDark/10 dark:via-surface-dark dark:to-japanese-matchaDark/10 rounded-3xl p-8 md:p-12 text-center border border-gray-100 dark:border-gray-700 shadow-xl">
              <div className="text-4xl mb-4">💌</div>
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Never miss a story
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto text-lg">
                Get the latest insights on Japanese language learning, cultural
                tips, and product updates delivered to your inbox.
              </p>
              <NewsletterForm source="blog" />
            </div>

            {/* Footer - Contact Section */}
            <footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="text-center sm:text-left">
                  <p className="text-gray-600 dark:text-gray-400">
                    Have questions or feedback?
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    We'd love to hear from you
                  </p>
                </div>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-japanese-sakura text-white rounded-full hover:from-primary-600 hover:to-japanese-sakuraDark transition-all font-medium shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>Get in Touch</span>
                </Link>
              </div>
              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
                <p>© {new Date().getFullYear()} Moshimoshi. All rights reserved.</p>
              </div>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
        <Navbar showUserMenu={true} />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center relative z-10">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 dark:border-primary-800 mx-auto"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-500 mx-auto absolute top-0 left-1/2 transform -translate-x-1/2"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Loading blog posts...
          </p>
        </div>
      </main>
    }>
      <BlogContent />
    </Suspense>
  );
}
