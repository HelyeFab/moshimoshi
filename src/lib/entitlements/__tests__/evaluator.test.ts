import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator'
import type { EvalContext, FeatureId, PlanType } from '@/types/entitlements'

const NOW = '2025-12-26T12:00:00.000Z'

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

describe('entitlements evaluator', () => {
  it('denies free access to premium-only feature (comics)', () => {
    const decision = evaluate('comics', makeContext('free', { comics: 0 }))
    expect(decision.allow).toBe(false)
    expect(decision.remaining).toBe(0)
    expect(decision.reason).toBe('limit_reached')
  })

  it('allows premium access to premium-only feature (comics)', () => {
    const decision = evaluate('comics', makeContext('premium_monthly', { comics: 0 }))
    expect(decision.allow).toBe(true)
    expect(decision.remaining).toBe(-1)
    expect(decision.reason).toBe('ok')
  })

  it('enforces daily quota for free tier (conjugation_drill)', () => {
    const decision = evaluate('conjugation_drill', makeContext('free', { conjugation_drill: 4 }))
    expect(decision.allow).toBe(true)
    expect(decision.remaining).toBe(1)
    expect(decision.reason).toBe('ok')
  })

  it('blocks when daily quota reached (conjugation_drill)', () => {
    const decision = evaluate('conjugation_drill', makeContext('free', { conjugation_drill: 5 }))
    expect(decision.allow).toBe(false)
    expect(decision.remaining).toBe(0)
    expect(decision.reason).toBe('limit_reached')
  })

  it('enforces monthly quota for free tier (custom_lists)', () => {
    const decision = evaluate('custom_lists', makeContext('free', { custom_lists: 3 }))
    expect(decision.allow).toBe(false)
    expect(decision.remaining).toBe(0)
    expect(decision.reason).toBe('limit_reached')
  })

  it('allows unlimited guest access for resources', () => {
    const decision = evaluate('resources', makeContext('guest', { resources: 0 }))
    expect(decision.allow).toBe(true)
    expect(decision.remaining).toBe(-1)
    expect(decision.reason).toBe('ok')
  })
})

describe('entitlements bucket keys', () => {
  it('uses featureId + date for daily buckets', () => {
    const key = getBucketKey('conjugation_drill', 'user_test', NOW)
    expect(key).toBe('conjugation_drill_2025-12-26')
  })

  it('uses featureId + year-month for monthly buckets', () => {
    const key = getBucketKey('custom_lists', 'user_test', NOW)
    expect(key).toBe('custom_lists_2025-12')
  })
})
