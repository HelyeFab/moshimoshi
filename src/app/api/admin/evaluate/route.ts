import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { evaluateEntitlementWithOverrides } from '@/lib/entitlements/adminEvaluator'
import { FeatureId, EvalContext, PlanType } from '@/types/entitlements'
import { adminFirestore } from '@/lib/firebase/admin'

/**
 * POST /api/admin/evaluate
 * Simulates an entitlement decision for a user/feature combination
 */
export const POST = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    const body = await request.json()
    const { userId, featureId, simulateDate } = body

    // Validate required fields
    if (!userId || !featureId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and featureId' },
        { status: 400 }
      )
    }

    // Import the actual feature IDs from types
    const { FEATURE_IDS } = await import('@/types/FeatureId')
    const validFeatures = FEATURE_IDS

    if (!validFeatures.includes(featureId as FeatureId)) {
      return NextResponse.json(
        { error: `Invalid featureId. Must be one of: ${validFeatures.join(', ')}` },
        { status: 400 }
      )
    }

    // Parse simulate date if provided
    let simDate: Date | undefined
    if (simulateDate) {
      simDate = new Date(simulateDate)
      if (isNaN(simDate.getTime())) {
        return NextResponse.json({ error: 'Invalid simulateDate format' }, { status: 400 })
      }
    }

    // Fetch user data to build EvalContext
    if (!adminFirestore) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }

    const userDoc = await adminFirestore.collection('users').doc(userId).get()
    const userData = userDoc.data()

    // Get user's plan (default to 'free' if not found)
    const userPlan: PlanType = userData?.subscription?.plan || userData?.tier || 'free'

    // Get user's usage for today
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const usageDoc = await adminFirestore
      .collection('usage_buckets')
      .doc(`${userId}_${today}`)
      .get()
    const usageData = usageDoc.data()

    // Build proper EvalContext
    const evalContext: EvalContext = {
      userId,
      plan: userPlan,
      usage: usageData?.counts || {},
      nowUtcISO: (simDate || new Date()).toISOString(),
      simulateDate: simDate,
      skipLogging: false, // Log admin simulations for audit
    }

    // Evaluate the entitlement
    const decision = await evaluateEntitlementWithOverrides(
      userId,
      featureId as FeatureId,
      evalContext
    )

    // Add admin context to response
    const response = {
      ...decision,
      evaluation: {
        userId,
        featureId,
        simulatedDate: simDate?.toISOString() || new Date().toISOString(),
        evaluatedBy: context.user.uid,
        evaluatedAt: new Date().toISOString(),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in admin evaluate:', error)
    return NextResponse.json(
      {
        error: 'Failed to evaluate entitlement',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
