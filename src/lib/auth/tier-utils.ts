/**
 * Utility functions for determining user tier from subscription data
 */

export type UserTier = 'guest' | 'free' | 'premium.monthly' | 'premium.yearly' | 'premium_monthly' | 'premium_yearly';

/**
 * Derives the user's tier from their subscription data
 * This is the single source of truth for determining user tier
 *
 * @param userData - The user document from Firestore
 * @returns The user's current tier
 */
export function getUserTier(userData: any): UserTier {
  // Check if user has an active subscription
  if (userData?.subscription?.status === 'active' && userData?.subscription?.plan) {
    // Return the subscription plan as the tier
    // Handle both dot notation (premium.monthly) and underscore notation (premium_monthly)
    const plan = userData.subscription.plan;
    if (plan === 'premium_monthly' || plan === 'premium_yearly') {
      return plan;
    }
    // Convert underscore to dot notation if needed for consistency
    if (plan === 'premium.monthly' || plan === 'premium.yearly') {
      return plan;
    }
  }

  // Check legacy tier field (for backward compatibility during migration)
  if (userData?.tier) {
    return userData.tier;
  }

  // Default to free for authenticated users
  return 'free';
}

/**
 * Checks if a user has premium access
 * @param userData - The user document from Firestore
 * @returns true if the user has any premium tier
 */
export function isPremiumUser(userData: any): boolean {
  const tier = getUserTier(userData);
  return tier === 'premium.monthly' ||
         tier === 'premium.yearly' ||
         tier === 'premium_monthly' ||
         tier === 'premium_yearly';
}

/**
 * Normalizes tier format to use underscores (for database consistency)
 * @param tier - The tier in any format
 * @returns The tier with underscores
 */
export function normalizeTier(tier: UserTier): UserTier {
  if (tier === 'premium.monthly') return 'premium_monthly';
  if (tier === 'premium.yearly') return 'premium_yearly';
  return tier;
}