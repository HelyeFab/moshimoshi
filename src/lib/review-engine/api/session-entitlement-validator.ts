/**
 * Session Entitlement Validator
 * Server-side validation to prevent client bypass of entitlement limits
 *
 * This validator ensures that review sessions respect tier-based limits:
 * - Guest: No persistence (sessions not saved)
 * - Free: 5 sessions per day per feature
 * - Premium: Unlimited sessions
 */

import { evaluate, EvalContext } from '@/lib/entitlements/evaluator'
import { FeatureId, Decision, PlanType } from '@/types/entitlements'
import { ReviewableContent } from '../core/interfaces'
import { adminFirestore as db } from '@/lib/firebase/admin'
import { reviewLogger } from '@/lib/monitoring/logger'

export interface SessionValidationResult {
  allowed: boolean
  decision: Decision
  featureId?: FeatureId
  reason?: string
}

/**
 * Maps content types to feature IDs for entitlement checking
 */
function contentTypeToFeatureId(contentType: string): FeatureId | null {
  const mapping: Record<string, FeatureId> = {
    'kana': 'hiragana_practice',
    'kana-hiragana': 'hiragana_practice',
    'kana-katakana': 'katakana_practice',
    'hiragana': 'hiragana_practice',
    'katakana': 'katakana_practice',
  }

  return mapping[contentType.toLowerCase()] || null
}

/**
 * Get current usage for a user and feature
 * Counts sessions created today for the specific feature
 */
async function getCurrentUsage(
  userId: string,
  featureId: FeatureId
): Promise<number> {
  if (!db) {
    reviewLogger.error('[SessionValidator] Database not initialized')
    return 0
  }

  try {
    // Get start of day in UTC
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfDayTimestamp = startOfDay.getTime()

    // Query sessions created today for this feature
    const sessionsSnapshot = await db
      .collection('reviewSessions')
      .where('userId', '==', userId)
      .where('startedAt', '>=', startOfDayTimestamp)
      .where('metadata.entitlement.featureId', '==', featureId)
      .count()
      .get()

    return sessionsSnapshot.data().count
  } catch (error) {
    reviewLogger.error('[SessionValidator] Error getting usage:', error)
    return 0
  }
}

/**
 * Validate if a user can start a review session based on their tier and usage
 */
export async function validateSessionEntitlement(
  userId: string,
  plan: PlanType,
  content: ReviewableContent[]
): Promise<SessionValidationResult> {
  // Guest users: allow but no persistence
  if (plan === 'guest') {
    return {
      allowed: true,
      decision: {
        allow: true,
        remaining: -1,
        reason: 'ok',
        policyVersion: '1.0',
        featureId: 'hiragana_practice' as FeatureId,
        userId,
        plan
      },
      reason: 'Guest session - no persistence'
    }
  }

  // Determine feature ID from content type
  if (!content || content.length === 0) {
    return {
      allowed: false,
      reason: 'No content provided',
      decision: {
        allow: false,
        remaining: 0,
        reason: 'invalid_request',
        policyVersion: '1.0',
        featureId: 'hiragana_practice' as FeatureId,
        userId,
        plan
      }
    }
  }

  const primaryContent = content[0]
  const featureId = contentTypeToFeatureId(primaryContent.contentType)

  if (!featureId) {
    // Content type doesn't require entitlement check
    return {
      allowed: true,
      decision: {
        allow: true,
        remaining: -1,
        reason: 'ok',
        policyVersion: '1.0',
        featureId: 'hiragana_practice' as FeatureId,
        userId,
        plan
      },
      reason: 'Content type does not require entitlement check'
    }
  }

  // Get current usage for this feature
  const currentUsage = await getCurrentUsage(userId, featureId)

  // Build evaluation context
  const ctx: EvalContext = {
    userId,
    plan,
    nowUtcISO: new Date().toISOString(),
    usage: {
      [featureId]: currentUsage
    }
  }

  // Evaluate entitlement
  const decision = evaluate(featureId, ctx)

  return {
    allowed: decision.allow,
    decision,
    featureId,
    reason: decision.allow
      ? 'Session allowed'
      : `Limit reached: ${decision.remaining} remaining (${decision.reason})`
  }
}

/**
 * Format entitlement error for API response
 */
export function formatEntitlementError(validation: SessionValidationResult) {
  const { decision, featureId } = validation

  if (decision.plan === 'free' && !decision.allow) {
    return {
      error: 'LIMIT_REACHED',
      message: `You've reached your daily limit for this feature. Upgrade to Premium for unlimited access.`,
      details: {
        featureId,
        remaining: decision.remaining,
        resetAt: decision.resetAtUtc,
        currentPlan: decision.plan,
        upgradeTo: 'premium_monthly'
      }
    }
  }

  return {
    error: 'ENTITLEMENT_DENIED',
    message: validation.reason || 'You do not have access to this feature',
    details: {
      featureId,
      reason: decision.reason,
      currentPlan: decision.plan
    }
  }
}
