import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/adminAuth';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { getUserOverrides } from '@/lib/entitlements/adminEvaluator';

/**
 * GET /api/admin/users/[uid]
 * Gets detailed information about a specific user including:
 * - Profile data
 * - Subscription info
 * - Current usage
 * - Active overrides
 * - Recent activity
 */
export const GET = withAdminAuth(async (
  request: NextRequest, 
  context: { params: { uid: string }, user: any }
) => {
  try {
    const { uid } = context.params;

    if (!uid) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user profile from Firestore
    const userDoc = await adminDb.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    // Get user auth record for additional info
    let authUser;
    try {
      authUser = await adminAuth.getUser(uid);
    } catch (error) {
      console.warn('Could not get auth user:', error);
    }

    // Get current usage
    // TODO: Implement getUserUsageSummary
    const usage = null; // await getUserUsageSummary(uid);

    // Get active overrides
    const overrides = await getUserOverrides(uid);

    // Get recent activity (last 10 activities)
    const activitySnapshot = await adminDb
      .collection('userActivity')
      .where('userId', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const recentActivity = activitySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get recent entitlement decisions (last 20)
    const decisionsSnapshot = await adminDb
      .collection('logs')
      .doc('entitlements')
      .collection('entries')
      .where('userId', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const recentDecisions = decisionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Build comprehensive user profile
    const userProfile = {
      // Basic info
      id: uid,
      email: authUser?.email || userData?.email,
      displayName: authUser?.displayName || userData?.displayName,
      photoURL: authUser?.photoURL || userData?.photoURL,
      emailVerified: authUser?.emailVerified,
      disabled: authUser?.disabled,
      
      // Custom claims
      customClaims: authUser?.customClaims || {},
      isAdmin: authUser?.customClaims?.admin === true,
      
      // Subscription info
      subscription: userData?.subscription || {
        plan: 'guest',
        status: 'none'
      },
      
      // Profile data
      profile: {
        createdAt: userData?.createdAt,
        lastLoginAt: userData?.lastLoginAt,
        preferences: userData?.preferences || {},
        metadata: userData?.metadata || {}
      },
      
      // Usage & Limits
      usage: {
        today: usage,
        date: new Date().toISOString().split('T')[0]
      },
      
      // Overrides
      overrides,
      overrideCount: Object.keys(overrides).length,
      
      // Recent activity
      recentActivity,
      
      // Recent decisions
      recentDecisions,
      
      // Auth metadata
      authMetadata: authUser ? {
        lastSignInTime: authUser.metadata.lastSignInTime,
        creationTime: authUser.metadata.creationTime,
        lastRefreshTime: authUser.metadata.lastRefreshTime,
        providers: authUser.providerData?.map(p => p.providerId)
      } : null
    };

    return NextResponse.json({
      user: userProfile,
      retrievedBy: context.user.uid,
      retrievedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting user details:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get user details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/admin/users/[uid]
 * Updates user profile data (admin only)
 * Can update subscription plan, custom claims, etc.
 */
export const PATCH = withAdminAuth(async (
  request: NextRequest,
  context: { params: { uid: string }, user: any }
) => {
  try {
    const { uid } = context.params;
    const body = await request.json();

    if (!uid) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const updates: any = {};
    const authUpdates: any = {};

    // Handle subscription plan update
    if (body.plan) {
      const validPlans = ['guest', 'free', 'premium', 'admin'];
      if (!validPlans.includes(body.plan)) {
        return NextResponse.json(
          { error: `Invalid plan. Must be one of: ${validPlans.join(', ')}` },
          { status: 400 }
        );
      }
      updates['subscription.plan'] = body.plan;
      updates['subscription.updatedAt'] = new Date().toISOString();
      updates['subscription.updatedBy'] = context.user.uid;
    }

    // Handle custom claims update
    if (body.customClaims !== undefined) {
      await adminAuth.setCustomUserClaims(uid, body.customClaims);
      authUpdates.customClaims = body.customClaims;
    }

    // Handle account enable/disable
    if (typeof body.disabled === 'boolean') {
      await adminAuth.updateUser(uid, { disabled: body.disabled });
      authUpdates.disabled = body.disabled;
    }

    // Handle display name update
    if (body.displayName !== undefined) {
      await adminAuth.updateUser(uid, { displayName: body.displayName });
      updates.displayName = body.displayName;
      authUpdates.displayName = body.displayName;
    }

    // Update Firestore if there are updates
    if (Object.keys(updates).length > 0) {
      await adminDb.collection('users').doc(uid).update(updates);
    }

    // Log the admin action
    await adminDb
      .collection('logs')
      .doc('admin_actions')
      .collection('entries')
      .add({
        action: 'user_update',
        targetUserId: uid,
        updates: { ...updates, ...authUpdates },
        adminId: context.user.uid,
        timestamp: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      userId: uid,
      updates: { ...updates, ...authUpdates },
      updatedBy: context.user.uid,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});