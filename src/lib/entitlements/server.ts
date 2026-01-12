import { getAdminDb } from '@/lib/firebase/admin'
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator'
import type { EvalContext, PlanType, Decision } from '@/types/entitlements'
import type { FeatureId } from '@/types/FeatureId'

export async function getUserPlan(userId: string): Promise<PlanType> {
  const db = getAdminDb()
  const userDoc = await db.collection('users').doc(userId).get()
  const userData = userDoc.data()
  return (userData?.subscription?.plan || 'free') as PlanType
}

export async function evaluateFeatureAccess(options: {
  featureId: FeatureId
  userId: string
  plan: PlanType
  nowUtcISO: string
  increment?: boolean
  incrementBy?: number
}): Promise<{
  decision: Decision
  currentUsage: number
  bucketKey: string
}> {
  const { featureId, userId, plan, nowUtcISO, increment = false, incrementBy } = options
  const db = getAdminDb()
  const bucketKey = getBucketKey(featureId, userId, nowUtcISO)
  const usageRef = db.collection('users').doc(userId).collection('usage').doc(bucketKey)
  const usageDoc = await usageRef.get()
  const currentUsage = usageDoc.data()?.[featureId] || 0
  const incrementCount = typeof incrementBy === 'number' ? incrementBy : increment ? 1 : 0

  const context: EvalContext = {
    userId,
    plan,
    usage: { [featureId]: currentUsage },
    nowUtcISO,
  }

  const decision = evaluate(featureId, context)

  if (decision.allow && incrementCount > 0) {
    await usageRef.set(
      {
        [featureId]: currentUsage + incrementCount,
        lastUpdated: nowUtcISO,
      },
      { merge: true }
    )

    const limit = decision.limit ?? 0
    decision.remaining =
      limit === -1 ? -1 : Math.max(0, limit - (currentUsage + incrementCount))
  }

  return {
    decision,
    currentUsage,
    bucketKey,
  }
}
