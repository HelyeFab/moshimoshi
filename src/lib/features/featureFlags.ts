/**
 * Feature Flags System
 *
 * Use this to control feature availability in different environments.
 * Features can be enabled/disabled via environment variables without code changes.
 *
 * Usage:
 * - In components: import { isFeatureEnabled } from '@/lib/features/featureFlags'
 * - Check feature: if (isFeatureEnabled('COMMAND_PALETTE')) { ... }
 * - Environment: Set NEXT_PUBLIC_FEATURE_COMMAND_PALETTE=true in .env
 */

export type FeatureFlag =
  | 'COMMAND_PALETTE'           // Command palette search functionality
  | 'BOTTOM_NAV'                // Mobile bottom navigation
  | 'AUTO_HIDE_NAV'             // Auto-hiding top navbar on mobile
  | 'GLASSMORPHISM_NAV'         // Glassmorphism effect on navbars
  | 'LEARNING_VILLAGE'          // Learning village on dashboard
  | 'ANIMATION_CONTROL'         // Animation pause/play control
  | 'STREAK_SYSTEM'             // Streak tracking and saves
  | 'LEADERBOARD'               // Leaderboard feature
  | 'ACHIEVEMENTS'              // Achievements system
  | 'YOUTUBE_SHADOWING'         // YouTube shadowing feature
  | 'AI_STORIES'                // AI-generated stories
  | 'BLOG'                      // Blog section
  | 'NEWSLETTER'                // Newsletter subscription
  | 'NOTIFICATIONS'             // Push notifications
  | 'DRILL_PRACTICE'            // Drill practice mode
  | 'KANJI_BROWSER'             // Kanji browser
  | 'KANJI_BROWSER_STUDY'       // Kanji Browser study rollout
  | 'ANKI_IMPORT'               // Anki deck import
  | 'CUSTOM_LISTS'              // Custom study lists
  | 'REVIEW_ENGINE'             // Universal review engine
  | 'REVIEW_HUB'                // Review hub/dashboard
  | 'FLASHCARDS'                // Flashcard system
  | 'DECKMARKET'                // DeckMarket catalogue
  | 'GAMES'                     // Learning games
  | 'TODOS'                     // Task manager / todos
  | 'BLAST_MODE'                // Blast Mode learning flow
  | 'AI_RESEGMENTATION'         // AI-powered transcript resegmentation (off by default)
  | 'SYNC_PRECISION_V2'         // Enhanced seek verification & adaptive poll timing (off by default)

/**
 * Default feature states
 * - Production: Conservative defaults (stable features only)
 * - Development: All features enabled for testing
 */
const DEFAULT_FEATURES: Record<FeatureFlag, boolean> = {
  // Core Navigation (stable)
  COMMAND_PALETTE: true,
  BOTTOM_NAV: true,
  AUTO_HIDE_NAV: true,
  GLASSMORPHISM_NAV: true,
  LEARNING_VILLAGE: true,
  ANIMATION_CONTROL: true,

  // Core Learning Features (stable)
  REVIEW_ENGINE: true,
  REVIEW_HUB: true,
  FLASHCARDS: true,
  DECKMARKET: true,
  DRILL_PRACTICE: true,
  KANJI_BROWSER: true,
  KANJI_BROWSER_STUDY: false,
  CUSTOM_LISTS: true,

  // Gamification (stable)
  STREAK_SYSTEM: true,
  LEADERBOARD: true,
  ACHIEVEMENTS: true,

  // Productivity (stable)
  TODOS: true,

  // Experimental
  BLAST_MODE: true,

  // Advanced Features (can be toggled off for testing)
  YOUTUBE_SHADOWING: true,
  AI_STORIES: true,
  GAMES: true,
  ANKI_IMPORT: true,

  // Content & Community (stable)
  BLOG: true,
  NEWSLETTER: true,
  NOTIFICATIONS: true,

  // Experimental (off by default)
  AI_RESEGMENTATION: false,
  SYNC_PRECISION_V2: false,
}

/**
 * Production overrides - features disabled in production
 * Add features here that should be OFF in production by default
 */
const PRODUCTION_DISABLED_FEATURES: FeatureFlag[] = [
  // Example: Uncomment to disable in production
  // 'AI_STORIES',
  // 'YOUTUBE_SHADOWING',
  // BLAST_MODE feature flag removed - now always enabled
  'AI_RESEGMENTATION',
  'SYNC_PRECISION_V2',
]

/**
 * Get feature flag value from environment variable
 */
function getEnvFeatureFlag(feature: FeatureFlag): boolean | undefined {
  const envKey = `NEXT_PUBLIC_FEATURE_${feature}`
  const envValue = process.env[envKey]

  if (envValue === undefined) return undefined

  // Parse boolean values
  if (envValue === 'true' || envValue === '1') return true
  if (envValue === 'false' || envValue === '0') return false

  return undefined
}

/**
 * Check if a feature is enabled
 * Priority: Environment Variable > Production Override > Default
 */
export function isFeatureEnabled(feature: FeatureFlag): boolean {
  // 1. Check environment variable (highest priority)
  const envValue = getEnvFeatureFlag(feature)
  if (envValue !== undefined) {
    return envValue
  }

  // 2. Check production overrides
  if (process.env.NODE_ENV === 'production') {
    if (PRODUCTION_DISABLED_FEATURES.includes(feature)) {
      return false
    }
  }

  // 3. Use default value
  return DEFAULT_FEATURES[feature] ?? false
}

/**
 * Get all feature flags and their current states
 * Useful for admin/debug panels
 */
export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  const flags: Partial<Record<FeatureFlag, boolean>> = {}

  for (const feature of Object.keys(DEFAULT_FEATURES) as FeatureFlag[]) {
    flags[feature] = isFeatureEnabled(feature)
  }

  return flags as Record<FeatureFlag, boolean>
}

/**
 * Get feature flag metadata for display
 */
export function getFeatureMetadata(feature: FeatureFlag): {
  name: string
  description: string
  category: string
} {
  const metadata: Record<FeatureFlag, { name: string; description: string; category: string }> = {
    COMMAND_PALETTE: {
      name: 'Command Palette',
      description: 'Quick navigation search (Cmd/Ctrl+K)',
      category: 'Navigation'
    },
    BOTTOM_NAV: {
      name: 'Bottom Navigation',
      description: 'Mobile bottom navigation bar',
      category: 'Navigation'
    },
    AUTO_HIDE_NAV: {
      name: 'Auto-hide Navigation',
      description: 'Auto-hiding top navbar on mobile',
      category: 'Navigation'
    },
    GLASSMORPHISM_NAV: {
      name: 'Glassmorphism Effect',
      description: 'Glassmorphism styling on navigation',
      category: 'Navigation'
    },
    LEARNING_VILLAGE: {
      name: 'Learning Village',
      description: 'Interactive learning village on dashboard',
      category: 'Dashboard'
    },
    ANIMATION_CONTROL: {
      name: 'Animation Control',
      description: 'Pause/play button for animations',
      category: 'UX'
    },
    STREAK_SYSTEM: {
      name: 'Streak System',
      description: 'Daily streak tracking and rewards',
      category: 'Gamification'
    },
    LEADERBOARD: {
      name: 'Leaderboard',
      description: 'Global leaderboard rankings',
      category: 'Gamification'
    },
    ACHIEVEMENTS: {
      name: 'Achievements',
      description: 'Achievement badges and rewards',
      category: 'Gamification'
    },
    YOUTUBE_SHADOWING: {
      name: 'YouTube Shadowing',
      description: 'Practice with YouTube videos',
      category: 'Learning'
    },
    AI_STORIES: {
      name: 'AI Stories',
      description: 'AI-generated reading stories',
      category: 'Learning'
    },
    BLOG: {
      name: 'Blog',
      description: 'Blog section and articles',
      category: 'Content'
    },
    NEWSLETTER: {
      name: 'Newsletter',
      description: 'Email newsletter subscription',
      category: 'Content'
    },
    NOTIFICATIONS: {
      name: 'Notifications',
      description: 'Push notifications system',
      category: 'Engagement'
    },
    DRILL_PRACTICE: {
      name: 'Drill Practice',
      description: 'Quick drill exercises',
      category: 'Learning'
    },
    KANJI_BROWSER: {
      name: 'Kanji Browser',
      description: 'Browse and study kanji',
      category: 'Learning'
    },
    KANJI_BROWSER_STUDY: {
      name: 'Kanji Browser Study',
      description: 'Vocabulary-first kanji study from Kanji Browser',
      category: 'Learning'
    },
    ANKI_IMPORT: {
      name: 'Anki Import',
      description: 'Import Anki decks',
      category: 'Learning'
    },
    CUSTOM_LISTS: {
      name: 'Custom Lists',
      description: 'Create custom study lists',
      category: 'Learning'
    },
    REVIEW_ENGINE: {
      name: 'Review Engine',
      description: 'Universal SRS review system',
      category: 'Learning'
    },
    REVIEW_HUB: {
      name: 'Review Hub',
      description: 'Unified review dashboard',
      category: 'Learning'
    },
    FLASHCARDS: {
      name: 'Flashcards',
      description: 'Flashcard study system',
      category: 'Learning'
    },
    DECKMARKET: {
      name: 'DeckMarket',
      description: 'Browse and download shared Anki decks',
      category: 'Learning'
    },
    GAMES: {
      name: 'Learning Games',
      description: 'Educational games',
      category: 'Learning'
    },
    TODOS: {
      name: 'Task Manager',
      description: 'Study task organization and goals',
      category: 'Productivity'
    },
    BLAST_MODE: {
      name: 'Blast Mode',
      description: 'High-velocity learning flow',
      category: 'Learning'
    },
    AI_RESEGMENTATION: {
      name: 'AI Resegmentation',
      description: 'AI-powered transcript resegmentation fallback (off by default)',
      category: 'Learning'
    },
    SYNC_PRECISION_V2: {
      name: 'Sync Precision V2',
      description: 'Enhanced seek verification, adaptive buffers, and tighter poll timing',
      category: 'Learning'
    },
  }

  return metadata[feature]
}

/**
 * Hook for React components
 */
export function useFeatureFlag(feature: FeatureFlag): boolean {
  return isFeatureEnabled(feature)
}
