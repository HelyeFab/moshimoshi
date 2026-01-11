import { evaluate } from '@/lib/entitlements/evaluator'
import type { EvalContext, FeatureId, PlanType } from '@/types/entitlements'
import featuresConfig from '../../../../config/features.v1.json'

const NOW = '2025-12-26T12:00:00.000Z'
const PLANS: PlanType[] = ['free', 'premium_monthly', 'premium_yearly']

type LimitType = 'daily' | 'monthly'
type FeatureConfig = { id: FeatureId; limitType: LimitType }

function makeContext(
  plan: PlanType,
  usage: Partial<Record<FeatureId, number>>
): EvalContext {
  return {
    userId: 'user_test',
    plan,
    usage,
    nowUtcISO: NOW,
  }
}

function getPlanLimit(plan: PlanType, featureId: FeatureId, limitType: LimitType): number | undefined {
  const limits = featuresConfig.limits as Record<
    PlanType,
    { daily?: Record<FeatureId, number>; monthly?: Record<FeatureId, number> }
  >
  return limits[plan]?.[limitType]?.[featureId]
}

describe('entitlements config-driven limits', () => {
  const features = featuresConfig.features as FeatureConfig[]

  for (const plan of PLANS) {
    for (const feature of features) {
      const limit = getPlanLimit(plan, feature.id, feature.limitType)

      it(`${plan} limit defined for ${feature.id}`, () => {
        expect(limit).toBeDefined()
      })

      if (limit === -1) {
        it(`${plan} allows unlimited ${feature.id}`, () => {
          const decision = evaluate(
            feature.id,
            makeContext(plan, { [feature.id]: 9999 } as Partial<Record<FeatureId, number>>)
          )
          expect(decision.allow).toBe(true)
          expect(decision.remaining).toBe(-1)
          expect(decision.reason).toBe('ok')
        })
      } else if (limit === 0) {
        it(`${plan} blocks ${feature.id} when limit is 0`, () => {
          const decision = evaluate(
            feature.id,
            makeContext(plan, { [feature.id]: 0 } as Partial<Record<FeatureId, number>>)
          )
          expect(decision.allow).toBe(false)
          expect(decision.remaining).toBe(0)
          expect(decision.reason).toBe('limit_reached')
        })
      } else if (typeof limit === 'number') {
        it(`${plan} allows ${feature.id} below limit`, () => {
          const usage = Math.max(0, limit - 1)
          const decision = evaluate(
            feature.id,
            makeContext(plan, { [feature.id]: usage } as Partial<Record<FeatureId, number>>)
          )
          expect(decision.allow).toBe(true)
          expect(decision.remaining).toBe(limit - usage)
          expect(decision.reason).toBe('ok')
        })

        it(`${plan} blocks ${feature.id} at limit`, () => {
          const decision = evaluate(
            feature.id,
            makeContext(plan, { [feature.id]: limit } as Partial<Record<FeatureId, number>>)
          )
          expect(decision.allow).toBe(false)
          expect(decision.remaining).toBe(0)
          expect(decision.reason).toBe('limit_reached')
        })
      }
    }
  }
})
