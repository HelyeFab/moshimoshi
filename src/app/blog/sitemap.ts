import { MetadataRoute } from 'next';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
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

      return {
        url: `https://moshimoshi.app/blog/${data.slug}`,
        lastModified: updatedAt,
        changeFrequency: 'weekly',
        priority: 0.8,
      };
    });

    // Add the main blog listing page
    return [
      {
        url: 'https://moshimoshi.app/blog',
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.9,
      },
      ...blogPosts,
    ];
  } catch (error) {
    console.error('Error generating blog sitemap:', error);

    // Return at least the blog homepage if there's an error
    return [
      {
        url: 'https://moshimoshi.app/blog',
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.9,
      },
    ];
  }
}
