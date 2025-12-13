import { MetadataRoute } from 'next';
import { locales, defaultLocale } from '@/i18n/routing';

/**
 * Generate language alternates for a given path.
 * This creates hreflang entries for all supported locales plus x-default.
 */
function generateAlternates(path: string) {
  const baseUrl = 'https://moshimoshi.app';
  return {
    languages: {
      ...Object.fromEntries(
        locales.map(locale => [locale, `${baseUrl}/${locale}${path}`])
      ),
      'x-default': `${baseUrl}/${defaultLocale}${path}`
    }
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
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

  // Generate sitemap entries with locale prefix and language alternates
  const staticPages = pages.map(page => ({
    url: `${baseUrl}/${defaultLocale}${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
    alternates: generateAlternates(page.path),
  }));

  return staticPages;
}
