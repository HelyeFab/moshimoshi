import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { isAdminUser } from '@/lib/firebase/admin';
import { createSessionToken, generateFingerprint } from '@/lib/auth/jwt';
import { serialize } from 'cookie';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({
        message: 'No session found. Please sign in first.',
        success: false,
      });
    }

    // Check Firebase admin status
    const isAdmin = await isAdminUser(session.uid);

    // Generate fingerprint from request headers
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') || 'unknown';
    const fingerprint = generateFingerprint(userAgent, ipAddress);

    // Create new session token with current admin status
    const sessionToken = await createSessionToken({
      uid: session.uid,
      email: session.email,
      tier: session.tier || 'free',
      fingerprint,
      admin: isAdmin, // This is the key - set admin flag based on Firebase
    }, 7 * 24 * 60 * 60 * 1000); // 7 days

    // Set new cookie
    const cookie = serialize('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    const response = NextResponse.json({
      message: 'Session refreshed successfully',
      success: true,
      oldAdminFlag: session.admin,
      newAdminFlag: isAdmin,
      firebaseAdmin: isAdmin,
    });

    response.headers.set('Set-Cookie', cookie);

    return response;
  } catch (error) {
    return NextResponse.json({
      message: 'Error refreshing session',
      error: (error as Error).message,
      success: false,
    });
  }
}