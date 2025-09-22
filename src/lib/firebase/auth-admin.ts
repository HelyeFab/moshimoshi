/**
 * Firebase Admin Auth Helper
 * Simple admin role checking using existing Firebase admin auth
 */

import { adminAuth } from '@/lib/firebase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Check if a user has admin role
 * Used by content generation routes
 */
export async function checkAdminRole(request: NextRequest): Promise<{
  isAdmin: boolean;
  uid?: string;
  error?: string;
}> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { isAdmin: false, error: 'No authorization token provided' };
    }

    const token = authHeader.substring(7);

    // Verify the token using Firebase Admin SDK
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Check if user is admin using Firebase isAdmin field
    const { isAdminUser } = await import('@/lib/firebase/admin')
    const isAdmin = await isAdminUser(decodedToken.uid);

    return {
      isAdmin,
      uid: decodedToken.uid
    };
  } catch (error) {
    console.error('Admin role check failed:', error);
    return {
      isAdmin: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    };
  }
}