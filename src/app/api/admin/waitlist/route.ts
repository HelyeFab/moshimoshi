/**
 * Admin Waitlist API
 *
 * Returns waitlist count and list of entries for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth';
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';

export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized();

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized');
    }

    // Fetch all waitlist entries, ordered by join date (newest first)
    const waitlistSnapshot = await adminFirestore
      .collection('waitlist')
      .orderBy('joinedAt', 'desc')
      .get();

    const entries = waitlistSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        joinedAt: data.joinedAt?.toDate?.()?.toISOString() || null,
        linkedUid: data.linkedUid || null,
        discountGranted: data.discountGranted || false,
      };
    });

    return NextResponse.json({
      success: true,
      count: entries.length,
      entries,
    });

  } catch (error: any) {
    console.error('[API /admin/waitlist] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch waitlist data' },
      { status: 500 }
    );
  }
});
