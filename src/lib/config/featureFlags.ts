/**
 * Feature Flags Configuration
 *
 * Centralized feature flag management for gamification system rollout.
 * All flags default to FALSE for safety - must be explicitly enabled.
 *
 * @module featureFlags
 */

/**
 * Feature flag definitions for gamification system
 */
export interface FeatureFlags {
  /**
   * GAMIFICATION_UNIFIED_ONLY
   * When true: Enforces that ALL stat writes go through /api/stats/unified
   * When false: Legacy hooks/stores can still write (compatibility mode)
   *
   * Production rollout: Enable after validating unified API stability
   */
  GAMIFICATION_UNIFIED_ONLY: boolean

  /**
   * SYNC_ENABLED
   * When true: Premium users' data syncs to Firebase on page load
   * When false: Sync disabled (prevents timezone-related data corruption)
   *
   * Production rollout: Enable after timezone handling is fixed
   */
  SYNC_ENABLED: boolean

  /**
   * DEPRECATE_LEGACY_STORES
   * When true: Show deprecation warnings for legacy store usage
   * When false: Legacy stores work silently
   *
   * Production rollout: Enable as migration completes
   */
  DEPRECATE_LEGACY_STORES: boolean

  /**
   * LEADERBOARD_DELTAS
   * When true: Use incremental delta updates for leaderboards
   * When false: Use full-scan materialization (legacy)
   *
   * Production rollout: Enable after delta implementation tested
   */
  LEADERBOARD_DELTAS: boolean
}

/**
 * Get all feature flags from environment variables
 *
 * @returns {FeatureFlags} Object containing all feature flag values
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    GAMIFICATION_UNIFIED_ONLY: process.env.GAMIFICATION_UNIFIED_ONLY === 'true',
    SYNC_ENABLED: process.env.SYNC_ENABLED === 'true',
    DEPRECATE_LEGACY_STORES: process.env.DEPRECATE_LEGACY_STORES === 'true',
    LEADERBOARD_DELTAS: process.env.LEADERBOARD_DELTAS === 'true',
  }
}

/**
 * Check if a specific feature is enabled
 *
 * @param {keyof FeatureFlags} flag - The feature flag to check
 * @returns {boolean} True if enabled, false otherwise
 *
 * @example
 * ```typescript
 * if (isFeatureEnabled('SYNC_ENABLED')) {
 *   await syncDataToFirebase()
 * }
 * ```
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag]
}

/**
 * Get all enabled features as an array of flag names
 * Useful for debugging and logging
 *
 * @returns {string[]} Array of enabled feature flag names
 */
export function getEnabledFeatures(): string[] {
  const flags = getFeatureFlags()
  return Object.entries(flags)
    .filter(([_, value]) => value === true)
    .map(([key]) => key)
}

/**
 * Log current feature flag state (for debugging)
 * Safe to call in production - logs to console only in development
 */
export function logFeatureFlags(): void {
  if (process.env.NODE_ENV === 'development') {
    const flags = getFeatureFlags()
    console.log('[Feature Flags] Current configuration:', flags)
    console.log('[Feature Flags] Enabled features:', getEnabledFeatures())
  }
}

/**
 * Validate that required flags are properly configured
 * Throws error if configuration is invalid
 *
 * @throws {Error} If configuration is invalid
 */
export function validateFeatureFlagConfig(): void {
  const flags = getFeatureFlags()

  // Rule: Cannot enable GAMIFICATION_UNIFIED_ONLY without SYNC_ENABLED
  // (Unified API requires sync to be working)
  if (flags.GAMIFICATION_UNIFIED_ONLY && !flags.SYNC_ENABLED) {
    throw new Error(
      'Invalid flag config: GAMIFICATION_UNIFIED_ONLY requires SYNC_ENABLED to be true'
    )
  }

  // Rule: Cannot enable LEADERBOARD_DELTAS without GAMIFICATION_UNIFIED_ONLY
  // (Delta updates depend on unified write path)
  if (flags.LEADERBOARD_DELTAS && !flags.GAMIFICATION_UNIFIED_ONLY) {
    console.warn(
      '[Feature Flags] Warning: LEADERBOARD_DELTAS enabled but GAMIFICATION_UNIFIED_ONLY is false. ' +
      'Deltas may not work correctly without unified write path.'
    )
  }
}

/**
 * Feature flag rollout percentages (for gradual rollout)
 * NOT IMPLEMENTED YET - placeholder for future canary/percentage-based rollout
 */
export interface RolloutConfig {
  SYNC_ENABLED: {
    enabled: boolean
    percentage: number // 0-100
    userSample: 'hash' | 'random' // How to select users
  }
}

/**
 * Check if a user is in a feature rollout cohort
 *
 * @param {string} userId - User ID to check
 * @param {keyof FeatureFlags} flag - Feature flag to check rollout for
 * @returns {boolean} True if user is in rollout cohort
 *
 * NOTE: Currently returns global flag value. Future: implement percentage-based rollout.
 */
export function isUserInRollout(userId: string, flag: keyof FeatureFlags): boolean {
  // For now, use global flag value
  // Future: implement hash-based percentage rollout
  return isFeatureEnabled(flag)
}

// Export singleton getter for convenience
export default getFeatureFlags
