import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, isAdminUserCached } from '@/lib/firebase/admin';

export interface AdminContext {
  user: {
    uid: string;
    email: string;
    isAdmin: boolean;
  };
}

/**
 * Middleware to protect admin API routes
 * Uses Firebase Admin SDK to verify tokens and check admin status via Firebase
 */
export function withAdminAuth(
  handler: (request: NextRequest, context: AdminContext) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    try {
      // Get the authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Unauthorized - Missing or invalid authorization header' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);

      // Verify the token using Firebase Admin SDK
      let decodedToken;
      try {
        if (!adminAuth) {
          throw new Error('Firebase Admin Auth not initialized');
        }
        decodedToken = await adminAuth.verifyIdToken(token);
      } catch (tokenError) {
        console.error('[Admin Auth] Token verification failed:', tokenError);
        return NextResponse.json(
          { error: 'Unauthorized - Invalid token' },
          { status: 401 }
        );
      }

      // Check if user is admin using Firebase isAdmin field
      // Uses cached version for performance
      const isAdmin = await isAdminUserCached(decodedToken.uid);

      if (!isAdmin) {
        console.warn(`[Admin Auth] Non-admin user attempted admin access: ${decodedToken.uid.substring(0, 8)}...`);
        return NextResponse.json(
          { error: 'Forbidden - Admin access required' },
          { status: 403 }
        );
      }

      const context: AdminContext = {
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email || '',
          isAdmin: true
        }
      };

      return handler(request, context);
    } catch (error) {
      console.error('[Admin Auth] Unexpected error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Set admin claim on a user
 * This grants admin privileges to a user
 */
export async function setAdminClaim(
  uid: string,
  isAdmin: boolean = true
): Promise<void> {
  try {
    await adminAuth.setCustomUserClaims(uid, { admin: isAdmin });
    console.log(`Admin claim ${isAdmin ? 'set' : 'removed'} for user ${uid}`);
  } catch (error) {
    console.error('Failed to set admin claim:', error);
    throw error;
  }
}