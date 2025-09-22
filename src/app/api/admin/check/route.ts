import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminFirestore } from '@/lib/firebase/admin';
import { debugLog } from '@/lib/logger/debug-logger';

const log = debugLog('app:api:admin:check');

export async function GET(request: NextRequest) {
  try {
    log('Admin check endpoint called');

    // Get the session
    const session = await getSession();
    log('Session:', session);

    if (!session) {
      log('No session found');
      return NextResponse.json({
        authenticated: false,
        isAdmin: false,
        message: 'Not authenticated'
      });
    }

    // Get user data from Firebase
    try {
      log('Fetching user from Firebase, uid:', session.uid);
      const userDoc = await adminFirestore!
        .collection('users')
        .doc(session.uid)
        .get();

      if (!userDoc.exists) {
        log('User document not found in Firebase');
        return NextResponse.json({
          authenticated: true,
          isAdmin: false,
          message: 'User profile not found'
        });
      }

      const userData = userDoc.data();
      const isAdmin = userData?.isAdmin === true;

      const response = {
        authenticated: true,
        isAdmin,
        uid: session.uid,
        email: session.email,
        firebaseIsAdmin: userData?.isAdmin,
        jwtAdmin: session.admin || false,
        message: isAdmin ? 'Admin access confirmed' : 'Not an admin'
      };

      log('Returning response:', response);
      return NextResponse.json(response);

    } catch (error) {
      log('Error checking Firebase:', error);
      return NextResponse.json({
        authenticated: true,
        isAdmin: false,
        message: 'Error checking admin status'
      });
    }

  } catch (error) {
    log('Error in admin check:', error);
    return NextResponse.json({
      authenticated: false,
      isAdmin: false,
      message: 'Error checking authentication'
    });
  }
}