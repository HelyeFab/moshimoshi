import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getLearningVillagePageKey, normalizeLearningVillagePath } from '@/lib/analytics/learningVillageRoutes';

/**
 * POST /api/waitlist/track-visit
 *
 * Tracks a visitor to landing pages (anonymous - no auth required)
 * Increments counters in Firestore for admin dashboard analytics
 *
 * Body: { page: 'landing' | 'waitlist', isUniqueVisitor: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }

    // Get page and visitor type from request body
    const body = await request.json();
    const page = typeof body.page === 'string' ? body.page : 'unknown';
    const isUniqueVisitor = body.isUniqueVisitor === true;
    const durationMs = typeof body.durationMs === 'number' ? body.durationMs : null;

    let pageKey = 'unknown';
    let routePath: string | null = null;

    if (page === 'landing' || page === 'waitlist') {
      pageKey = page;
    } else {
      const normalizedPath = normalizeLearningVillagePath(page);
      const learningVillageKey = getLearningVillagePageKey(normalizedPath);
      if (learningVillageKey) {
        pageKey = learningVillageKey;
        routePath = normalizedPath;
      }
    }

    // Reference to analytics document for this page
    const analyticsRef = adminFirestore.collection('analytics').doc(`page_${pageKey}`);

    // Build update object
    const updateData: any = {
      page: pageKey,
      totalPageViews: FieldValue.increment(1), // Always increment page views
      lastVisit: FieldValue.serverTimestamp(),
    };

    if (routePath) {
      updateData.route = routePath;
    }

    // Only increment unique visitors if this is a first-time visitor
    if (isUniqueVisitor) {
      updateData.uniqueVisitors = FieldValue.increment(1);
    }

    if (durationMs !== null && Number.isFinite(durationMs) && durationMs > 0) {
      updateData.totalDurationMs = FieldValue.increment(Math.round(durationMs));
      updateData.durationCount = FieldValue.increment(1);
    }

    // Update counters
    await analyticsRef.set(updateData, { merge: true });

    return NextResponse.json({ success: true, page: pageKey, tracked: { pageView: true, uniqueVisitor: isUniqueVisitor } });

  } catch (error: any) {
    console.error('[API /waitlist/track-visit] Error:', error);
    // Return success anyway to avoid blocking the page
    return NextResponse.json({ success: true });
  }
}
