"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPublishedBlogPosts } from "@/services/blogService";
import type { BlogPost } from "@/services/blogService";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog - Japanese Learning Stories & Insights | Moshimoshi",
  description: "Discover the latest in Japanese language learning, cultural insights, and product updates from the Moshimoshi team. Expert tips, tutorials, and guides for mastering Japanese.",
  keywords: ["Japanese learning", "Japanese language blog", "Japanese culture", "language learning tips", "JLPT", "Japanese grammar", "Japanese vocabulary"],
  openGraph: {
    title: "Blog - Japanese Learning Stories & Insights | Moshimoshi",
    description: "Discover the latest in Japanese language learning, cultural insights, and product updates from the Moshimoshi team.",
    type: "website",
    url: "https://moshimoshi.app/blog",
    siteName: "Moshimoshi",
    images: [
      {
        url: "/og-blog.png",
        width: 1200,
        height: 630,
        alt: "Moshimoshi Blog",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog - Japanese Learning Stories & Insights | Moshimoshi",
    description: "Discover the latest in Japanese language learning, cultural insights, and product updates.",
    images: ["/og-blog.png"],
  },
  alternates: {
    canonical: "https://moshimoshi.app/blog",
  },
};

export default function BlogPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        console.log("Fetching published blog posts...");
        const publishedPosts = await getPublishedBlogPosts();
        console.log("Fetched posts:", publishedPosts);
        console.log("Number of posts:", publishedPosts.length);
        setPosts(publishedPosts);
      } catch (error) {
        console.error("Error fetching blog posts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

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

  // Smart featured post selection algorithm
  const getFeaturedPost = (posts: BlogPost[]): BlogPost | null => {
    if (posts.length === 0) return null;

    // Calculate a "featured score" for each post
    const scoredPosts = posts.map((post) => {
      let score = 0;

      // Recency factor (newer posts get higher scores)
      const publishDate = new Date(post.publishDate || Date.now());
      const daysSincePublish =
        (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 100 - daysSincePublish * 2); // Decreases over time
      score += recencyScore * 0.3; // 30% weight

      // View count factor (if available)
      if (post.views && post.views > 0) {
        const viewScore = Math.min(100, post.views / 10); // Cap at 100, 1 point per 10 views
        score += viewScore * 0.4; // 40% weight
      }

      // Content quality indicators
      if (post.excerpt && post.excerpt.length > 100) score += 15; // Good excerpt
      if (post.cover) score += 10; // Has cover image
      if (post.tags && post.tags.length >= 2) score += 10; // Well-tagged
      if (post.readingTime) score += 5; // Has reading time

      // Content length factor (longer posts often indicate more comprehensive content)
      if (post.content) {
        const contentLength = post.content.length;
        if (contentLength > 2000) score += 15; // Comprehensive content
        else if (contentLength > 1000) score += 10; // Good length
        else if (contentLength > 500) score += 5; // Decent length
      }

      // Title quality (avoid very short or very long titles)
      if (post.title) {
        const titleLength = post.title.length;
        if (titleLength >= 30 && titleLength <= 80) score += 10; // Optimal title length
      }

      // Boost for posts with certain high-value tags
      const highValueTags = [
        "tutorial",
        "guide",
        "beginner",
        "advanced",
        "tips",
        "culture",
        "grammar",
      ];
      if (post.tags) {
        const hasHighValueTag = post.tags.some((tag) =>
          highValueTags.some((hvTag) =>
            tag.toLowerCase().includes(hvTag.toLowerCase())
          )
        );
        if (hasHighValueTag) score += 20;
      }

      return { ...post, featuredScore: score };
    });

    // Sort by score and return the highest scoring post
    scoredPosts.sort((a, b) => b.featuredScore - a.featuredScore);
    return scoredPosts[0];
  };

  const featuredPost = getFeaturedPost(posts);

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

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold bg-gradient-to-r from-gray-900 via-primary-600 to-japanese-sakura bg-clip-text text-transparent dark:from-gray-100 dark:via-primary-400 dark:to-japanese-sakuraDark mb-6">
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
            {/* Category Filter */}
            {categories.length > 1 && (
              <div className="mb-12">
                <div className="flex flex-wrap justify-center gap-3">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-6 py-3 rounded-full font-medium transition-all ${
                        selectedCategory === category
                          ? "bg-gradient-to-r from-primary-500 to-japanese-sakura text-white shadow-lg scale-105"
                          : "bg-white/80 dark:bg-surface-dark/80 text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 backdrop-blur-sm"
                      }`}
                    >
                      {category === "all" ? "🌟 All Posts" : `#${category}`}
                    </button>
                  ))}
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

            {/* Posts Grid */}
            <div className="mb-16">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-3 h-3 bg-gradient-to-r from-japanese-matcha to-japanese-zen rounded-full"></div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {selectedCategory === "all"
                    ? "Latest Articles"
                    : `${selectedCategory} Articles`}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(selectedCategory === "all"
                  ? filteredPosts.slice(1)
                  : filteredPosts
                ).map((post, index) => (
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
                ))}
              </div>
            </div>

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
              <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-6 py-4 rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button className="px-8 py-4 bg-gradient-to-r from-primary-500 to-japanese-sakura text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105">
                  Subscribe
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
