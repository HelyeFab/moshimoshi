// PWA Feature Entitlements System
// Controls which PWA features are available per user tier
// Now uses centralized config from features.v1.json

import featuresConfig from '../../../config/features.v1.json'

export type UserTier = 'guest' | 'free' | 'premium'
export type PlanType = 'guest' | 'free' | 'premium_monthly' | 'premium_yearly'

export type FeatureId =
  | 'push'
  | 'bgSync'
  | 'periodicSync'
  | 'shareTarget'
  | 'fsAccess'
  | 'badging'
  | 'mediaSession'

// Map PWA feature IDs to config feature IDs
const FEATURE_ID_MAP: Record<FeatureId, string> = {
  push: 'pwa_push',
  bgSync: 'pwa_bg_sync',
  periodicSync: 'pwa_periodic_sync',
  shareTarget: 'pwa_share_target',
  fsAccess: 'pwa_fs_access',
  badging: 'pwa_badging',
  mediaSession: 'pwa_media_session',
}

// Map simple tier names to plan types (premium covers both monthly and yearly)
function tierToPlan(tier: UserTier): PlanType {
  if (tier === 'premium') return 'premium_monthly' // Both premium plans have same PWA access
  return tier
}

/**
 * Check if a PWA feature is allowed for a given tier
 * Reads from centralized features.v1.json config
 */
export function can(feature: FeatureId, userTier: UserTier = 'guest'): boolean {
  const configFeatureId = FEATURE_ID_MAP[feature]
  if (!configFeatureId) {
    console.warn(`Unknown PWA feature: ${feature}`)
    return false
  }

  const plan = tierToPlan(userTier)
  const limits = featuresConfig.limits as Record<string, { daily?: Record<string, number> }>
  const planLimits = limits[plan]

  if (!planLimits?.daily) {
    return false
  }

  const limit = planLimits.daily[configFeatureId]
  // -1 means unlimited (allowed), 0 means blocked
  return limit === -1
}

export function getCurrentUserTier(): UserTier {
  // This should be integrated with the actual auth/subscription system
  // For now, returning 'free' as default
  if (typeof window === 'undefined') {
    return 'free'
  }

  // Check localStorage or session for user tier
  // This will need to be connected to the actual auth system
  const tier = localStorage.getItem('userTier') as UserTier
  return tier || 'guest'
}

export function canCurrentUser(feature: FeatureId): boolean {
  const tier = getCurrentUserTier()
  return can(feature, tier)
}
