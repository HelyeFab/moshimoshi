import { MetadataRoute } from 'next';
import { getGrammarIndex } from '@/lib/grammar/grammarService';
import { locales, defaultLocale, type Locale } from '@/i18n/routing';

const baseUrl = 'https://moshimoshi.app';

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
 * Generate a sitemap entry with language alternates for a specific locale.
 */
function createSitemapEntry(
  locale: Locale,
  path: string,
  lastModified: Date,
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
  priority: number
) {
  return {
    url: `${baseUrl}/${locale}${path}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: generateAlternates(path),
  };
}

/**
 * Generate sitemap index with per-locale grammar sitemaps.
 * This creates separate sitemaps for each locale:
 * - /[locale]/learn/grammar/sitemap.xml (index)
 * - /[locale]/learn/grammar/sitemap/0.xml (en)
 * - /[locale]/learn/grammar/sitemap/1.xml (ja)
 * - etc.
 */
export async function generateSitemaps() {
  return locales.map((locale, index) => ({ id: index.toString() }));
}

/**
 * Generate grammar sitemap for a specific locale.
 *
 * Each sitemap contains:
 * - Grammar hub pages for available levels
 * - All grammar point pages for those levels
 * - Language alternates for all locales
*/
export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap> {
  const localeIndex = parseInt(id, 10);
  const locale: Locale = locales[localeIndex] || defaultLocale;
  const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];

  try {
    const levelIndexes = await Promise.all(
      levels.map(async (level) => {
        try {
          const indexData = await getGrammarIndex(level);
          if (indexData.totalPoints <= 0) return null;
          return { level, indexData };
        } catch {
          return null;
        }
      })
    );

    const grammarUrls: MetadataRoute.Sitemap = [];

    for (const entry of levelIndexes) {
      if (!entry) continue;
      const hubPath = entry.level === 'n5' ? '/learn/grammar' : `/learn/grammar/${entry.level}`;
      const lastModified = new Date(entry.indexData.lastUpdated);

      // Add grammar hub page for the level
      grammarUrls.push(
        createSitemapEntry(locale, hubPath, lastModified, 'weekly', 0.95)
      );

      // Add all grammar point pages
      for (const point of entry.indexData.points) {
        grammarUrls.push(
          createSitemapEntry(
            locale,
            `/learn/grammar/${point.id}`,
            lastModified,
            'monthly',
            0.8
          )
        );
      }
    }

    return grammarUrls;
  } catch (error) {
    console.error('Error generating grammar sitemap:', error);

    // Return at least the grammar hub page if there's an error
    return [
      createSitemapEntry(
        locale,
        '/learn/grammar',
        new Date('2026-01-17'),
        'weekly',
        0.95
      ),
    ];
  }
}
