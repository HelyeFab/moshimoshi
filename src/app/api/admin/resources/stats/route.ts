import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getServerSession } from '@/lib/auth/session';
import { ResourceStats } from '@/types/resources';

export async function GET(req: NextRequest) {
  try {
    // Check authentication and admin status
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin status from Firestore
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all resources for stats
    const allPostsSnapshot = await adminDb.collection('resources').get();
    const publishedSnapshot = await adminDb.collection('resources')
      .where('status', '==', 'published')
      .get();
    const draftSnapshot = await adminDb.collection('resources')
      .where('status', '==', 'draft')
      .get();

    let totalViews = 0;
    let mostViewedPost: { id: string; title: string; views: number } | undefined;
    const recentPosts: { id: string; title: string; publishedAt: Date; views: number }[] = [];

    publishedSnapshot.forEach((doc) => {
      const data = doc.data();
      const views = data.views || 0;
      totalViews += views;

      if (!mostViewedPost || views > mostViewedPost.views) {
        mostViewedPost = {
          id: doc.id,
          title: data.title,
          views
        };
      }

      if (data.publishedAt) {
        recentPosts.push({
          id: doc.id,
          title: data.title,
          publishedAt: data.publishedAt.toDate ? data.publishedAt.toDate() : new Date(data.publishedAt),
          views
        });
      }
    });

    // Sort recent posts by date and take top 5
    recentPosts.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    recentPosts.splice(5);

    const stats: ResourceStats = {
      totalPosts: allPostsSnapshot.size,
      publishedPosts: publishedSnapshot.size,
      draftPosts: draftSnapshot.size,
      totalViews,
      mostViewedPost,
      recentPosts
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching resource stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resource stats' },
      { status: 500 }
    );
  }
}