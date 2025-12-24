import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

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
    const page = body.page || 'unknown';
    const isUniqueVisitor = body.isUniqueVisitor === true;

    // Validate page
    const validPages = ['landing', 'waitlist'];
    const pageKey = validPages.includes(page) ? page : 'unknown';

    // Reference to analytics document for this page
    const analyticsRef = adminFirestore.collection('analytics').doc(`page_${pageKey}`);

    // Build update object
    const updateData: any = {
      page: pageKey,
      totalPageViews: FieldValue.increment(1), // Always increment page views
      lastVisit: FieldValue.serverTimestamp(),
    };

    // Only increment unique visitors if this is a first-time visitor
    if (isUniqueVisitor) {
      updateData.uniqueVisitors = FieldValue.increment(1);
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
