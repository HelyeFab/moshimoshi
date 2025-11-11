/**
 * Client-safe streak configuration
 * Imports JSON directly without using Node.js fs module
 */

import streakConfigData from './streak.json'
import type { StreakConfig } from './streakConfig'

/**
 * Get streak config for client-side use
 * Safe to use in React components and hooks
 */
export function getStreakConfigClient(): StreakConfig {
  return streakConfigData as StreakConfig
}
