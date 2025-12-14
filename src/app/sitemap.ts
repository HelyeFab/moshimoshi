import { MetadataRoute } from 'next';
import { locales, defaultLocale, type Locale } from '@/i18n/routing';

const baseUrl = 'https://moshimoshi.app';

// Page definitions with path, priority, and change frequency
const pages = [
  { path: '', priority: 1, changeFrequency: 'daily' as const },
  { path: '/kanji-browser', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/news', priority: 0.9, changeFrequency: 'daily' as const },
  { path: '/stories', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: '/youtube-shadowing', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: '/dashboard', priority: 0.7, changeFrequency: 'daily' as const },
  { path: '/review', priority: 0.9, changeFrequency: 'daily' as const },
  { path: '/kanji-moods', priority: 0.7, changeFrequency: 'weekly' as const },
  { path: '/kanji-connection', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/learn', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: '/tools/kanji-mastery', priority: 0.7, changeFrequency: 'weekly' as const },
  { path: '/tools/textbook-vocabulary', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/pricing', priority: 0.5, changeFrequency: 'weekly' as const },
  { path: '/settings', priority: 0.3, changeFrequency: 'monthly' as const },
  { path: '/account', priority: 0.3, changeFrequency: 'monthly' as const },
  { path: '/favourites', priority: 0.5, changeFrequency: 'weekly' as const },
  { path: '/my-items', priority: 0.5, changeFrequency: 'weekly' as const },
  { path: '/contact', priority: 0.3, changeFrequency: 'yearly' as const },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' as const },
  { path: '/terms', priority: 0.2, changeFrequency: 'yearly' as const },
  { path: '/showcase', priority: 0.4, changeFrequency: 'weekly' as const },
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
 * Generate sitemap index with per-locale sitemaps.
 * This creates separate sitemaps for each locale:
 * - /sitemap.xml (index)
 * - /sitemap/0.xml (en)
 * - /sitemap/1.xml (ja)
 * - /sitemap/2.xml (de)
 * - /sitemap/3.xml (es)
 * - /sitemap/4.xml (fr)
 * - /sitemap/5.xml (it)
 */
export async function generateSitemaps() {
  return locales.map((locale, index) => ({ id: index.toString() }));
}

/**
 * Generate sitemap for a specific locale.
 * Each locale gets its own sitemap with URLs for that locale,
 * plus alternates pointing to all other locale versions.
 */
export default function sitemap({ id }: { id: string }): MetadataRoute.Sitemap {
  const localeIndex = parseInt(id, 10);
  const locale: Locale = locales[localeIndex] || defaultLocale;

  // Generate sitemap entries for this locale with language alternates
  return pages.map(page => ({
    url: `${baseUrl}/${locale}${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
    alternates: generateAlternates(page.path),
  }));
}
