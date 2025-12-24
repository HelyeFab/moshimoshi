import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth';
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';

/**
 * GET /api/admin/analytics/visitors
 *
 * Fetches visitor counts from Firestore (custom tracking)
 * Requires admin authentication
 *
 * Returns counts for both landing page and waitlist page
 */
export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }

    // Get visitor counts for both pages
    const [landingDoc, waitlistDoc] = await Promise.all([
      adminFirestore.collection('analytics').doc('page_landing').get(),
      adminFirestore.collection('analytics').doc('page_waitlist').get(),
    ]);

    const landingData = landingDoc.data();
    const waitlistData = waitlistDoc.data();

    return NextResponse.json({
      success: true,
      landing: {
        visitors: landingData?.totalVisitors || 0,
        lastVisit: landingData?.lastVisit?.toDate?.()?.toISOString() || null,
      },
      waitlist: {
        visitors: waitlistData?.totalVisitors || 0,
        lastVisit: waitlistData?.lastVisit?.toDate?.()?.toISOString() || null,
      },
      total: (landingData?.totalVisitors || 0) + (waitlistData?.totalVisitors || 0),
    });

  } catch (error: any) {
    console.error('[API /admin/analytics/visitors] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Unknown error',
        landing: { visitors: 0, lastVisit: null },
        waitlist: { visitors: 0, lastVisit: null },
        total: 0,
      },
      { status: 200 } // Return 200 to prevent UI errors
    );
  }
});
