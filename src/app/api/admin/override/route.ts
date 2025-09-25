import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/adminAuth';
import { 
  setOverride, 
  removeOverride, 
  getUserOverrides 
} from '@/lib/entitlements/adminEvaluator';
import { FeatureId, FeatureOverride } from '@/types/entitlements';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * GET /api/admin/override?userId={userId}
 * Gets all overrides for a user
 */
export const GET = withAdminAuth(async (request: NextRequest, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    const overrides = await getUserOverrides(userId);

    return NextResponse.json({
      userId,
      overrides,
      retrievedBy: context.user.uid,
      retrievedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting overrides:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get overrides',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/override
 * Creates or updates an override for a user/feature
 */
export const POST = withAdminAuth(async (request: NextRequest, context) => {
  try {
    const body = await request.json();
    const { userId, featureId, override } = body;

    // Validate required fields
    if (!userId || !featureId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and featureId' },
        { status: 400 }
      );
    }

    // Validate featureId
    const { FEATURE_IDS } = await import('@/types/FeatureId');

    if (!FEATURE_IDS.includes(featureId as FeatureId)) {
      return NextResponse.json(
        { error: `Invalid featureId. Must be one of: ${FEATURE_IDS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate override object
    if (!override || typeof override !== 'object') {
      return NextResponse.json(
        { error: 'Invalid override object' },
        { status: 400 }
      );
    }

    // Build the override object
    const overrideData: Partial<FeatureOverride> = {};

    // Handle limit
    if ('limit' in override) {
      if (override.limit !== null && (typeof override.limit !== 'number' || override.limit < 0)) {
        return NextResponse.json(
          { error: 'Invalid limit: must be a positive number or null' },
          { status: 400 }
        );
      }
      overrideData.limit = override.limit;
    }

    // Handle allow
    if ('allow' in override) {
      if (override.allow !== null && typeof override.allow !== 'boolean') {
        return NextResponse.json(
          { error: 'Invalid allow: must be boolean or null' },
          { status: 400 }
        );
      }
      overrideData.allow = override.allow;
    }

    // Handle note
    if ('note' in override) {
      if (override.note !== null && typeof override.note !== 'string') {
        return NextResponse.json(
          { error: 'Invalid note: must be string or null' },
          { status: 400 }
        );
      }
      overrideData.note = override.note;
    }

    // Handle expiry
    if ('expiresAt' in override) {
      if (override.expiresAt !== null) {
        const expiryDate = new Date(override.expiresAt);
        if (isNaN(expiryDate.getTime())) {
          return NextResponse.json(
            { error: 'Invalid expiresAt: must be a valid date string or null' },
            { status: 400 }
          );
        }
        overrideData.expiresAt = Timestamp.fromDate(expiryDate);
      } else {
        overrideData.expiresAt = undefined;
      }
    }

    // Set the override
    await setOverride(
      userId,
      featureId as FeatureId,
      overrideData,
      context.user.uid
    );

    return NextResponse.json({
      success: true,
      userId,
      featureId,
      override: overrideData,
      updatedBy: context.user.uid,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error setting override:', error);
    return NextResponse.json(
      { 
        error: 'Failed to set override',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/override
 * Removes an override for a user/feature
 */
export const DELETE = withAdminAuth(async (request: NextRequest, context) => {
  try {
    const body = await request.json();
    const { userId, featureId } = body;

    // Validate required fields
    if (!userId || !featureId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and featureId' },
        { status: 400 }
      );
    }

    // Validate featureId
    const { FEATURE_IDS } = await import('@/types/FeatureId');

    if (!FEATURE_IDS.includes(featureId as FeatureId)) {
      return NextResponse.json(
        { error: `Invalid featureId. Must be one of: ${FEATURE_IDS.join(', ')}` },
        { status: 400 }
      );
    }

    // Remove the override
    await removeOverride(
      userId,
      featureId as FeatureId,
      context.user.uid
    );

    return NextResponse.json({
      success: true,
      userId,
      featureId,
      removedBy: context.user.uid,
      removedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error removing override:', error);
    return NextResponse.json(
      { 
        error: 'Failed to remove override',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});