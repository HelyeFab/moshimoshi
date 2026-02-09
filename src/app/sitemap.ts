import { MetadataRoute } from 'next';
import { locales, defaultLocale, type Locale } from '@/i18n/routing';

const baseUrl = 'https://moshimoshi.app';

// Page definitions with path, priority, and change frequency
// IMPORTANT: Only include pages that should be indexed (no noindex pages)
const pages = [
  // Homepage
  { path: '', priority: 1, changeFrequency: 'daily' as const },

  // Core learning features (high priority)
  { path: '/kanji-browser', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/youtube-shadowing', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/youtube-series', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/textbook-vocabulary', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/vocabulary', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: '/flashcards', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: '/deckmarket', priority: 0.8, changeFrequency: 'weekly' as const },

  // Learning pages
  { path: '/learn/hiragana', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/learn/katakana', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/learn/grammar', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/learn/conjugation', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: '/learn/numbers', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: '/learn/word-learning', priority: 0.7, changeFrequency: 'weekly' as const },

  // Kanji connection system (blue ocean feature)
  { path: '/kanji-connection', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/kanji-connection/families', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/kanji-connection/radicals', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/kanji-connection/visual-layout', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: '/kanji-moods', priority: 0.7, changeFrequency: 'weekly' as const },

  // Games
  { path: '/games', priority: 0.7, changeFrequency: 'weekly' as const },
  { path: '/games/kana-drop', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/games/kanji-simon', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/games/sentence-scramble', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/games/stroke-order', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/games/reading-routes', priority: 0.6, changeFrequency: 'monthly' as const },

  // Content pages
  { path: '/news', priority: 0.8, changeFrequency: 'daily' as const },
  { path: '/stories', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: '/blog', priority: 0.8, changeFrequency: 'daily' as const },
  { path: '/popular-videos', priority: 0.7, changeFrequency: 'daily' as const },
  { path: '/resources', priority: 0.6, changeFrequency: 'weekly' as const },

  // Tools
  { path: '/tools/kanji-mastery', priority: 0.7, changeFrequency: 'weekly' as const },
  { path: '/tools/blast-mode', priority: 0.7, changeFrequency: 'weekly' as const },
  { path: '/review-dashboard', priority: 0.7, changeFrequency: 'daily' as const },

  // Community/gamification
  { path: '/leaderboard', priority: 0.5, changeFrequency: 'daily' as const },
  { path: '/achievements', priority: 0.5, changeFrequency: 'weekly' as const },

  // Info pages
  { path: '/about', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/pricing', priority: 0.7, changeFrequency: 'weekly' as const },
  { path: '/contact', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/learning-path', priority: 0.6, changeFrequency: 'weekly' as const },

  // Village
  { path: '/village/tea-house', priority: 0.6, changeFrequency: 'daily' as const },

  // REMOVED: noindex pages - DO NOT add these to sitemap:
  // /dashboard, /review, /settings, /account, /privacy, /terms, /showcase
  // /admin, /auth, /share, /credits, /todos
  // /learn/word-learning/session, /learn/word-learning/complete
  // /tools/kanji-mastery/learn, /tools/blast-mode/learn
];

/**
 * Generate language alternates for a given path.
 * This creates hreflang entries for all supported locales plus x-default.
 */
function generateAlternates(path: string) {
  return {
    languages: {
      ...Object.fromEntries(
        locales.map(locale => [locale, `${baseUrl}/${locale}${path}`])
      ),
      'x-default': `${baseUrl}/${defaultLocale}${path}`
    }
  };
}

/**
 * Root sitemap containing all pages for all locales.
 *
 * This creates a single sitemap at /sitemap.xml with all URLs across all 6 locales.
 * Each URL includes hreflang alternates for proper international SEO.
 *
 * Total URLs: ~228 (38 pages × 6 locales)
 * Blog posts are handled separately in /[locale]/blog/sitemap.ts
 * Grammar pages are handled separately in /[locale]/learn/grammar/sitemap.ts
 *
 * IMPORTANT: Only include indexable pages here. Pages with `robots: { index: false }`
 * should NOT be in the sitemap to avoid confusing search engines.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const allUrls: MetadataRoute.Sitemap = [];

  // Generate URLs for each locale
  for (const locale of locales) {
    for (const page of pages) {
      allUrls.push({
        url: `${baseUrl}/${locale}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: generateAlternates(page.path),
      });
    }
  }

  return allUrls;
}
