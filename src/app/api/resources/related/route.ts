import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get('category');
    const excludeId = searchParams.get('exclude');

    if (!category) {
      return NextResponse.json({ resources: [] });
    }

    // Fetch related resources in the same category
    let query = adminDb
      .collection('resources')
      .where('status', '==', 'published')
      .where('category', '==', category)
      .orderBy('views', 'desc')
      .limit(5);

    const snapshot = await query.get();

    const resources = snapshot.docs
      .filter(doc => doc.id !== excludeId) // Exclude current resource
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          description: data.description,
          category: data.category,
          views: data.views || 0,
          publishedAt: data.publishedAt?.toDate ? data.publishedAt.toDate() : data.publishedAt,
        };
      })
      .slice(0, 4); // Return max 4 related resources

    return NextResponse.json({ resources });
  } catch (error) {
    console.error('Error fetching related resources:', error);
    return NextResponse.json({ resources: [] });
  }
}