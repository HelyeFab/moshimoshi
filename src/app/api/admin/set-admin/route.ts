import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/adminAuth';
import { setAdminClaim } from '@/lib/admin/adminAuth';
import { adminDb } from '@/lib/firebase/admin';

/**
 * POST /api/admin/set-admin
 * Grants or revokes admin privileges for a user
 * This is a highly sensitive operation that should be logged
 */
export const POST = withAdminAuth(async (request: NextRequest, context) => {
  try {
    const body = await request.json();
    const { userId, isAdmin } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    if (typeof isAdmin !== 'boolean') {
      return NextResponse.json(
        { error: 'isAdmin must be a boolean value' },
        { status: 400 }
      );
    }

    // Prevent self-demotion
    if (userId === context.user.uid && !isAdmin) {
      return NextResponse.json(
        { error: 'Cannot remove your own admin privileges' },
        { status: 400 }
      );
    }

    // Set the admin claim
    const result = await setAdminClaim(userId, isAdmin);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Failed to set admin claim',
          details: result.error
        },
        { status: 500 }
      );
    }

    // Update the user's profile to reflect admin status
    await adminDb.collection('users').doc(userId).update({
      isAdmin,
      adminStatusUpdatedAt: new Date().toISOString(),
      adminStatusUpdatedBy: context.user.uid
    });

    // Log this critical action
    await adminDb
      .collection('logs')
      .doc('admin_actions')
      .collection('entries')
      .add({
        action: isAdmin ? 'grant_admin' : 'revoke_admin',
        targetUserId: userId,
        performedBy: context.user.uid,
        timestamp: new Date().toISOString(),
        metadata: {
          critical: true,
          requiresAudit: true
        }
      });

    return NextResponse.json({
      success: true,
      userId,
      isAdmin,
      updatedBy: context.user.uid,
      updatedAt: new Date().toISOString(),
      message: isAdmin 
        ? 'Admin privileges granted successfully' 
        : 'Admin privileges revoked successfully'
    });
  } catch (error) {
    console.error('Error setting admin claim:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update admin status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});