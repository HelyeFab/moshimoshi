import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getServerSession } from '@/lib/auth/session';

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

    const searchParams = req.nextUrl.searchParams;
    const resourceId = searchParams.get('resourceId');
    const days = parseInt(searchParams.get('days') || '7');

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    if (resourceId) {
      // Get analytics for specific resource
      const viewsSnapshot = await adminDb
        .collection('resource_views')
        .where('resourceId', '==', resourceId)
        .where('date', '>=', startDate.toISOString().split('T')[0])
        .get();

      const views = viewsSnapshot.docs.map(doc => doc.data());

      // Group by date
      const viewsByDate = views.reduce((acc: any, view: any) => {
        const date = view.date;
        if (!acc[date]) {
          acc[date] = {
            date,
            total: 0,
            unique: new Set(),
            anonymous: 0,
            authenticated: 0
          };
        }
        acc[date].total++;
        if (view.userId) {
          acc[date].unique.add(view.userId);
          acc[date].authenticated++;
        } else {
          acc[date].anonymous++;
        }
        return acc;
      }, {});

      // Convert Sets to counts
      const dailyStats = Object.values(viewsByDate).map((day: any) => ({
        date: day.date,
        total: day.total,
        unique: day.unique.size,
        anonymous: day.anonymous,
        authenticated: day.authenticated
      }));

      // Get resource details
      const resourceDoc = await adminDb.collection('resources').doc(resourceId).get();
      const resourceData = resourceDoc.data();

      return NextResponse.json({
        resourceId,
        title: resourceData?.title,
        totalViews: resourceData?.views || 0,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days
        },
        dailyStats: dailyStats.sort((a: any, b: any) => a.date.localeCompare(b.date)),
        summary: {
          totalPeriodViews: views.length,
          uniqueUsers: new Set(views.filter((v: any) => v.userId).map((v: any) => v.userId)).size,
          anonymousViews: views.filter((v: any) => !v.userId).length,
          authenticatedViews: views.filter((v: any) => v.userId).length
        }
      });
    } else {
      // Get overall analytics
      const resourcesSnapshot = await adminDb
        .collection('resources')
        .orderBy('views', 'desc')
        .limit(10)
        .get();

      const topResources = resourcesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          views: data.views || 0,
          category: data.category,
          status: data.status,
          lastViewedAt: data.lastViewedAt?.toDate ? data.lastViewedAt.toDate() : null
        };
      });

      // Get recent views
      const recentViewsSnapshot = await adminDb
        .collection('resource_views')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

      const recentViews = recentViewsSnapshot.docs.map(doc => doc.data());

      // Calculate unique viewers today
      const today = new Date().toISOString().split('T')[0];
      const todayViews = recentViews.filter((v: any) => v.date === today);
      const uniqueViewersToday = new Set(todayViews.filter((v: any) => v.userId).map((v: any) => v.userId)).size;

      return NextResponse.json({
        topResources,
        recentActivity: {
          totalViewsToday: todayViews.length,
          uniqueViewersToday,
          last100Views: recentViews.length
        },
        summary: {
          totalResources: (await adminDb.collection('resources').get()).size,
          publishedResources: (await adminDb.collection('resources').where('status', '==', 'published').get()).size
        }
      });
    }
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}