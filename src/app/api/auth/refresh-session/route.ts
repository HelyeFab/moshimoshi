import { NextRequest, NextResponse } from 'next/server';
import { getSession, createSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/refresh-session
 * Forces a session refresh to sync with current subscription status
 */
export async function POST(request: NextRequest) {
  try {
    // Get current session
    const currentSession = await getSession();
    if (!currentSession) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    // Get fresh user data from Firestore
    const userDoc = await adminDb.collection('users').doc(currentSession.uid).get();
    const userData = userDoc.data();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine current tier from subscription
    let tier = 'free';
    if (userData.subscription?.status === 'active' && userData.subscription?.plan) {
      tier = userData.subscription.plan;
    }

    console.log('[Refresh Session] Old tier:', currentSession.tier, 'New tier:', tier);

    // Create new session with updated tier
    const newSession = await createSession(
      {
        uid: currentSession.uid,
        email: currentSession.email,
        tier: tier as any,
        admin: currentSession.admin
      },
      {
        userAgent: request.headers.get('user-agent') || 'unknown',
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        rememberMe: true
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Session refreshed',
      oldTier: currentSession.tier,
      newTier: tier,
      subscription: userData.subscription
    });
  } catch (error) {
    console.error('Session refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh session' },
      { status: 500 }
    );
  }
}