import { NextRequest, NextResponse } from 'next/server';
import { AdminContext } from '@/lib/admin/adminAuth';
import { withAdminAnalyticsRateLimit } from '@/lib/api/admin-analytics-rate-limiter';
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';
import { getLearningVillagePageKey, learningVillageTrackedRoutes } from '@/lib/analytics/learningVillageRoutes';

/**
 * GET /api/admin/analytics/visitors
 *
 * Fetches visitor counts from Firestore (custom tracking)
 * Requires admin authentication + rate limiting (60 req/min)
 *
 * Returns counts for both landing page and waitlist page
 */
export const GET = withAdminAnalyticsRateLimit(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }
    const firestore = adminFirestore;

    // Get visitor counts for both pages
    const [landingDoc, waitlistDoc] = await Promise.all([
      firestore.collection('analytics').doc('page_landing').get(),
      firestore.collection('analytics').doc('page_waitlist').get(),
    ]);

    const landingData = landingDoc.data();
    const waitlistData = waitlistDoc.data();

    const learningVillageDocs = await Promise.all(
      learningVillageTrackedRoutes.map((route) => {
        const pageKey = getLearningVillagePageKey(route) || 'unknown';
        return firestore.collection('analytics').doc(`page_${pageKey}`).get();
      })
    );

    const learningVillagePages = learningVillageTrackedRoutes.map((route, index) => {
      const doc = learningVillageDocs[index];
      const data = doc?.data();
      const pageKey = getLearningVillagePageKey(route) || 'unknown';
      const totalDurationMs = data?.totalDurationMs || 0;
      const durationCount = data?.durationCount || 0;
      const avgDurationMs = durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0;

      return {
        route,
        pageKey,
        pageViews: data?.totalPageViews || 0,
        uniqueVisitors: data?.uniqueVisitors || 0,
        avgDurationMs,
        totalDurationMs,
        durationCount,
        lastVisit: data?.lastVisit?.toDate?.()?.toISOString() || null,
      };
    });

    const learningVillageTotals = learningVillagePages.reduce(
      (acc, page) => {
        acc.pageViews += page.pageViews;
        acc.uniqueVisitors += page.uniqueVisitors;
        acc.totalDurationMs += page.totalDurationMs || 0;
        acc.durationCount += page.durationCount || 0;
        return acc;
      },
      { pageViews: 0, uniqueVisitors: 0, totalDurationMs: 0, durationCount: 0 }
    );

    const learningVillageTotalsWithAvg = {
      pageViews: learningVillageTotals.pageViews,
      uniqueVisitors: learningVillageTotals.uniqueVisitors,
      avgDurationMs:
        learningVillageTotals.durationCount > 0
          ? Math.round(learningVillageTotals.totalDurationMs / learningVillageTotals.durationCount)
          : 0,
    };

    return NextResponse.json({
      success: true,
      landing: {
        pageViews: landingData?.totalPageViews || 0,
        uniqueVisitors: landingData?.uniqueVisitors || 0,
        lastVisit: landingData?.lastVisit?.toDate?.()?.toISOString() || null,
      },
      waitlist: {
        pageViews: waitlistData?.totalPageViews || 0,
        uniqueVisitors: waitlistData?.uniqueVisitors || 0,
        lastVisit: waitlistData?.lastVisit?.toDate?.()?.toISOString() || null,
      },
      totals: {
        pageViews: (landingData?.totalPageViews || 0) + (waitlistData?.totalPageViews || 0),
        uniqueVisitors: (landingData?.uniqueVisitors || 0) + (waitlistData?.uniqueVisitors || 0),
      },
      learningVillage: {
        pages: learningVillagePages,
        totals: learningVillageTotalsWithAvg,
      },
    });

  } catch (error: any) {
    console.error('[API /admin/analytics/visitors] Error:', error);
      return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Unknown error',
        landing: { pageViews: 0, uniqueVisitors: 0, lastVisit: null },
        waitlist: { pageViews: 0, uniqueVisitors: 0, lastVisit: null },
        totals: { pageViews: 0, uniqueVisitors: 0 },
        learningVillage: { pages: [], totals: { pageViews: 0, uniqueVisitors: 0, avgDurationMs: 0 } },
      },
      { status: 200 } // Return 200 to prevent UI errors
    );
  }
});
