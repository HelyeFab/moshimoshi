import { NextRequest, NextResponse } from 'next/server';
import { AdminContext } from '@/lib/admin/adminAuth';
import { withAdminAnalyticsRateLimit } from '@/lib/api/admin-analytics-rate-limiter';
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';

/**
 * GET /api/admin/analytics/content-clicks
 *
 * Fetches content click analytics from Firestore
 * Requires admin authentication + rate limiting (60 req/min)
 */
export const GET = withAdminAnalyticsRateLimit(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }

    const searchParams = request.nextUrl.searchParams;
    const typeFilter = searchParams.get('type');
    const limitParam = Number(searchParams.get('limit') || 200);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 200;

    let query = adminFirestore.collection('content_clicks').orderBy('totalClicks', 'desc');
    if (typeFilter === 'resource' || typeFilter === 'video') {
      query = query.where('type', '==', typeFilter);
    }

    const snapshot = await query.limit(limit).get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error('[API /admin/analytics/content-clicks] Error:', error);
    return NextResponse.json(
      { success: false, items: [], error: error.message || 'Unknown error' },
      { status: 200 }
    );
  }
});
