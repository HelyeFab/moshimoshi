import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/waitlist/track-visit
 *
 * Tracks a visitor to landing pages (anonymous - no auth required)
 * Increments a counter in Firestore for admin dashboard analytics
 *
 * Body: { page: 'landing' | 'waitlist' }
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }

    // Get page from request body
    const body = await request.json();
    const page = body.page || 'unknown';

    // Validate page
    const validPages = ['landing', 'waitlist'];
    const pageKey = validPages.includes(page) ? page : 'unknown';

    // Reference to analytics document for this page
    const analyticsRef = adminFirestore.collection('analytics').doc(`page_${pageKey}`);

    // Increment visitor count
    await analyticsRef.set(
      {
        page: pageKey,
        totalVisitors: FieldValue.increment(1),
        lastVisit: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, page: pageKey });

  } catch (error: any) {
    console.error('[API /waitlist/track-visit] Error:', error);
    // Return success anyway to avoid blocking the page
    return NextResponse.json({ success: true });
  }
}
