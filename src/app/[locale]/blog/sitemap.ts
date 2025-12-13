import { MetadataRoute } from 'next';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { locales, defaultLocale } from '@/i18n/routing';

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
 * Generate a sitemap entry with language alternates.
 */
function createSitemapEntry(
  path: string,
  lastModified: Date,
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
  priority: number
) {
  return {
    url: `${baseUrl}/${defaultLocale}${path}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: generateAlternates(path),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    // Check if adminDb is available
    if (!adminDb) {
      console.warn('adminDb not available for sitemap generation');
      return [createSitemapEntry('/blog', new Date(), 'daily', 0.9)];
    }

    // Fetch all published blog posts
    const postsSnapshot = await adminDb
      .collection('blogPosts')
      .where('status', '==', 'published')
      .get();

    const blogPosts: MetadataRoute.Sitemap = postsSnapshot.docs.map((doc) => {
      const data = doc.data();
      const updatedAt = data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : new Date(data.updatedAt || Date.now());

      return createSitemapEntry(`/blog/${data.slug}`, updatedAt, 'weekly', 0.8);
    });

    // Add the main blog listing page
    return [
      createSitemapEntry('/blog', new Date(), 'daily', 0.9),
      ...blogPosts,
    ];
  } catch (error) {
    console.error('Error generating blog sitemap:', error);

    // Return at least the blog homepage if there's an error
    return [createSitemapEntry('/blog', new Date(), 'daily', 0.9)];
  }
}
