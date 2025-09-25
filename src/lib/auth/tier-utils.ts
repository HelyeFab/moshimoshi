/**
 * Utility functions for determining user tier from subscription data
 */

export type UserTier = 'guest' | 'free' | 'premium_monthly' | 'premium_yearly';

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
    const plan = userData.subscription.plan;
    if (plan === 'premium_monthly' || plan === 'premium_yearly') {
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
  return tier === 'premium_monthly' || tier === 'premium_yearly';
}

/**
 * Validates tier format (all tiers now use underscores)
 * @param tier - The tier to validate
 * @returns The validated tier
 */
export function validateTier(tier: string): UserTier {
  const validTiers: UserTier[] = ['guest', 'free', 'premium_monthly', 'premium_yearly'];
  if (validTiers.includes(tier as UserTier)) {
    return tier as UserTier;
  }
  return 'free'; // Default to free for invalid tiers
}