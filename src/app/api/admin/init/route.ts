import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, setAdminClaims, isAdminUser, adminFirestore } from '@/lib/firebase/admin';
import { validateSession } from '@/lib/auth/session';

/**
 * This endpoint manages admin privileges using Firebase isAdmin field
 * It allows verified admins to refresh their custom claims
 */
export async function POST(request: NextRequest) {
  try {
    // Validate that the requester is logged in
    const session = await validateSession(request);
    if (!session.valid || !session.payload) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const uid = session.payload.uid;

    // Check if the user has isAdmin field in Firebase
    const isAdmin = await isAdminUser(uid);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'You are not authorized as admin. Admin status is managed through Firebase.' },
        { status: 403 }
      );
    }

    // Check if Firebase Admin is initialized
    if (!adminAuth) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK not initialized' },
        { status: 500 }
      );
    }

    // Refresh the admin custom claim to sync with Firebase
    await setAdminClaims(uid, true);

    // Update the adminUpdatedAt timestamp
    if (adminFirestore) {
      await adminFirestore.collection('users').doc(uid).update({
        adminUpdatedAt: adminFirestore.FieldValue.serverTimestamp(),
        updatedAt: adminFirestore.FieldValue.serverTimestamp()
      });
    }

    // Log the admin claim refresh
    console.log(`✅ Admin claims refreshed for user: ${session.payload.email} (${uid.substring(0, 8)}...)`);

    return NextResponse.json({
      success: true,
      message: 'Admin privileges have been refreshed. Please sign out and sign back in for changes to take effect.',
      uid: uid.substring(0, 8) + '...' // Only return partial UID for security
    });
  } catch (error) {
    console.error('Error refreshing admin claims:', error);
    return NextResponse.json(
      { error: 'Failed to refresh admin privileges' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if current user is admin
export async function GET(request: NextRequest) {
  try {
    // Validate session
    const session = await validateSession(request);
    if (!session.valid || !session.payload) {
      return NextResponse.json({
        authenticated: false,
        isAdmin: false,
        hasAdminClaim: false,
        message: 'Not authenticated',
      });
    }

    const uid = session.payload.uid;

    // Check Firebase admin status
    const isAdmin = await isAdminUser(uid);
    const hasAdminClaim = session.payload.admin === true;

    // Check if claims are in sync
    const claimsInSync = isAdmin === hasAdminClaim;

    return NextResponse.json({
      authenticated: true,
      isAdmin,
      hasAdminClaim,
      claimsInSync,
      currentUser: session.payload.email,
      message: isAdmin
        ? claimsInSync
          ? 'You have full admin privileges'
          : 'Admin status confirmed, but claims need refresh (use POST to refresh)'
        : 'You do not have admin privileges',
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json(
      { error: 'Failed to check admin status' },
      { status: 500 }
    );
  }
}