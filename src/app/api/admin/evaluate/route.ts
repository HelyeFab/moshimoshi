import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/adminAuth';
import { evaluateEntitlementWithOverrides } from '@/lib/entitlements/adminEvaluator';
import { FeatureId } from '@/types/entitlements';

/**
 * POST /api/admin/evaluate
 * Simulates an entitlement decision for a user/feature combination
 */
export const POST = withAdminAuth(async (request: NextRequest, context) => {
  try {
    const body = await request.json();
    const { userId, featureId, simulateDate } = body;

    // Validate required fields
    if (!userId || !featureId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and featureId' },
        { status: 400 }
      );
    }

    // Validate featureId
    const validFeatures: FeatureId[] = [
      'reviews', 'drills', 'customLists', 'flashcards',
      'analytics', 'export', 'apiAccess', 'premiumContent',
      'offlineMode', 'themes'
    ];

    if (!validFeatures.includes(featureId as FeatureId)) {
      return NextResponse.json(
        { error: `Invalid featureId. Must be one of: ${validFeatures.join(', ')}` },
        { status: 400 }
      );
    }

    // Parse simulate date if provided
    let simDate: Date | undefined;
    if (simulateDate) {
      simDate = new Date(simulateDate);
      if (isNaN(simDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid simulateDate format' },
          { status: 400 }
        );
      }
    }

    // Evaluate the entitlement
    const decision = await evaluateEntitlementWithOverrides(
      userId,
      featureId as FeatureId,
      {
        simulateDate: simDate,
        skipLogging: false // Log admin simulations for audit
      }
    );

    // Add admin context to response
    const response = {
      ...decision,
      evaluation: {
        userId,
        featureId,
        simulatedDate: simDate?.toISOString() || new Date().toISOString(),
        evaluatedBy: context.user.uid,
        evaluatedAt: new Date().toISOString()
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in admin evaluate:', error);
    return NextResponse.json(
      { 
        error: 'Failed to evaluate entitlement',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});