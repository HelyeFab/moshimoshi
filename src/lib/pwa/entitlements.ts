// PWA Feature Entitlements System
// Controls which PWA features are available per user tier

export type UserTier = 'guest' | 'free' | 'premium'

export type FeatureId =
  | 'push'
  | 'bgSync'
  | 'periodicSync'
  | 'shareTarget'
  | 'fsAccess'
  | 'badging'
  | 'mediaSession'

interface FeatureConfig {
  guest: boolean
  free: boolean
  premium: boolean
}

const FEATURE_MATRIX: Record<FeatureId, FeatureConfig> = {
  push: {
    guest: false,
    free: true,
    premium: true,
  },
  bgSync: {
    guest: false,
    free: true,
    premium: true,
  },
  periodicSync: {
    guest: false,
    free: false,
    premium: true,
  },
  shareTarget: {
    guest: false,
    free: true,
    premium: true,
  },
  fsAccess: {
    guest: false,
    free: false,
    premium: true,
  },
  badging: {
    guest: false,
    free: true,
    premium: true,
  },
  mediaSession: {
    guest: true,
    free: true,
    premium: true,
  },
}

export function can(feature: FeatureId, userTier: UserTier = 'guest'): boolean {
  const config = FEATURE_MATRIX[feature]
  if (!config) {
    console.warn(`Unknown feature: ${feature}`)
    return false
  }

  return config[userTier]
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