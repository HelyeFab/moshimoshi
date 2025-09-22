import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { isAdminUser } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({
        message: 'No session found',
        authenticated: false,
      });
    }

    const firebaseAdmin = await isAdminUser(session.uid);

    return NextResponse.json({
      message: 'Admin status check',
      session: {
        uid: session.uid,
        email: session.email,
        admin: session.admin,
        tier: session.tier,
      },
      firebaseAdmin,
      shouldHaveAccess: firebaseAdmin && session.admin,
      debugInfo: {
        sessionHasAdminFlag: session.admin === true,
        firebaseHasAdminFlag: firebaseAdmin === true,
        bothFlagsSet: session.admin === true && firebaseAdmin === true,
      }
    });
  } catch (error) {
    return NextResponse.json({
      message: 'Error checking admin status',
      error: (error as Error).message,
    });
  }
}