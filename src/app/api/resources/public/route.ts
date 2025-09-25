import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  try {
    // Fetch only published resources for public view
    // Try without orderBy first to avoid index requirement
    const snapshot = await adminDb
      .collection('resources')
      .where('status', '==', 'published')
      .limit(50)
      .get();

    const resources = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        content: data.content,
        status: data.status,
        category: data.category,
        tags: data.tags || [],
        featured: data.featured || false,
        views: data.views || 0,
        publishedAt: data.publishedAt?.toDate ? data.publishedAt.toDate() : data.publishedAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
      };
    }).sort((a, b) => {
      // Sort by publishedAt date, newest first
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });

    // Increment view count for analytics (optional)
    return NextResponse.json({
      resources,
      total: resources.length
    });
  } catch (error) {
    console.error('Error fetching public resources:', error);

    // Return empty array instead of error for public endpoint
    return NextResponse.json({
      resources: [],
      total: 0
    });
  }
}