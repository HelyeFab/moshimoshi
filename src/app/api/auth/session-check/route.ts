import { NextRequest, NextResponse } from 'next/server';
import { getSession, getTierForSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/auth/session-check
 * Checks if the current session tier matches the database subscription
 */
export async function GET(request: NextRequest) {
  try {
    // Get current session
    const session = await getSession();
    if (!session) {
      return NextResponse.json({
        error: 'No active session',
        needsRefresh: false
      }, { status: 401 });
    }

    // Get fresh user data from Firestore
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();

    if (!userData) {
      return NextResponse.json({
        error: 'User not found',
        needsRefresh: false
      }, { status: 404 });
    }

    // Determine current tier from subscription
    let actualTier = 'free';
    if (userData.subscription?.status === 'active' && userData.subscription?.plan) {
      actualTier = userData.subscription.plan;
    }

    // Get current tier using hybrid approach (cache or session)
    const currentTier = await getTierForSession(session);

    // Check if current tier matches actual tier
    const needsRefresh = currentTier !== actualTier;

    console.log('[Session Check]', {
      sessionTier: session.tier,  // Original JWT tier for debugging
      currentTier,  // Tier from hybrid approach
      actualTier,   // Tier from database
      needsRefresh,
      subscription: userData.subscription
    });

    return NextResponse.json({
      sessionTier: session.tier,  // Keep for backward compatibility
      currentTier,  // New: tier from hybrid approach
      actualTier,
      needsRefresh,
      subscription: userData.subscription
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { error: 'Failed to check session', needsRefresh: false },
      { status: 500 }
    );
  }
}