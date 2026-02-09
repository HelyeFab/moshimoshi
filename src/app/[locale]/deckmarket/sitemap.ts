import { MetadataRoute } from 'next'
import { adminFirestore } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { locales, defaultLocale, type Locale } from '@/i18n/routing'
import { DECKMARKET_COLLECTION } from '@/types/deckmarket'

const baseUrl = 'https://moshimoshi.app'

/**
 * DeckMarket Sitemap
 *
 * After deploying, submit these sitemaps in Google Search Console:
 * - https://moshimoshi.app/en/deckmarket/sitemap.xml
 * - https://moshimoshi.app/ja/deckmarket/sitemap.xml
 * (+ de, es, fr, it variants)
 *
 * Also verify:
 * 1. robots.txt is accessible: https://moshimoshi.app/robots.txt
 * 2. Main sitemap includes /deckmarket: https://moshimoshi.app/sitemap.xml
 * 3. URL Inspection tool on a published deck page
 * 4. Rich Results Test on a deck detail page (check LearningResource schema)
 */

/**
 * Generate language alternates for a given path.
 * This creates hreflang entries for all supported locales plus x-default.
 */
function generateAlternates(path: string) {
  return {
    languages: {
      ...Object.fromEntries(
        locales.map((locale) => [locale, `${baseUrl}/${locale}${path}`])
      ),
      'x-default': `${baseUrl}/${defaultLocale}${path}`,
    },
  }
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
  }
}

/**
 * Generate sitemap index — one per locale.
 * Creates: /[locale]/deckmarket/sitemap/0.xml, /[locale]/deckmarket/sitemap/1.xml, etc.
 */
export async function generateSitemaps() {
  return locales.map((locale, index) => ({ id: index.toString() }))
}

/**
 * Generate DeckMarket sitemap for a specific locale.
 * Includes the catalogue page + all published deck detail pages.
 */
export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap> {
  const localeIndex = parseInt(id, 10)
  const locale: Locale = locales[localeIndex] || defaultLocale

  try {
    if (!adminFirestore) {
      console.warn('[DeckMarket Sitemap] adminFirestore not available')
      return [createSitemapEntry(locale, '/deckmarket', new Date(), 'weekly', 0.8)]
    }

    const snapshot = await adminFirestore
      .collection(DECKMARKET_COLLECTION)
      .where('isPublished', '==', true)
      .get()

    const deckEntries: MetadataRoute.Sitemap = snapshot.docs.map((doc) => {
      const data = doc.data()
      const updatedAt =
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate()
          : new Date(data.updatedAt || Date.now())

      return createSitemapEntry(locale, `/deckmarket/${doc.id}`, updatedAt, 'weekly', 0.7)
    })

    return [
      createSitemapEntry(locale, '/deckmarket', new Date(), 'weekly', 0.8),
      ...deckEntries,
    ]
  } catch (error) {
    console.error('[DeckMarket Sitemap] Error:', error)
    return [createSitemapEntry(locale, '/deckmarket', new Date(), 'weekly', 0.8)]
  }
}
