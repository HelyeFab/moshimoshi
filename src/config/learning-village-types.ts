/**
 * Learning Village Configuration Types
 *
 * Used for admin-controlled stall ordering and popular badges.
 * Config is stored in Firestore at /config/learningVillage
 */

// All available stall IDs in the Learning Village
export const STALL_IDS = [
  'hiragana',
  'katakana',
  'drill',
  'vocabulary',
  'my-lists',
  'kanji-browser',
  'kanji-mastery',
  'kanji-connections',
  'mood-boards',
  'conjugation',
  'textbook-vocab',
  'stories',
  'news',
  'library',
  'youtube-shadowing',
  'popular-videos',
  'youtube-series',
  'my-videos',
  'flashcards',
  'games',
  'review-hub',
  'achievements',
  'leaderboard',
  'resources',
  'blog',
  'todos',
] as const

export type StallId = typeof STALL_IDS[number]

/**
 * Configuration for a single stall
 */
export interface StallConfig {
  id: StallId
  order: number        // Display order (lower = first)
  isPopular: boolean   // Show "Popular" badge
  enabled: boolean     // Whether stall is visible (respects feature flags too)
}

/**
 * Complete Learning Village configuration
 */
export interface LearningVillageConfig {
  version: string
  updatedAt: string    // ISO timestamp
  updatedBy: string    // Admin UID who made the change
  stalls: StallConfig[]
}

/**
 * Default configuration - used when no Firestore config exists
 * Order matches current hardcoded order in LearningVillage.tsx
 * Popular badges match current featuredIds
 */
export const DEFAULT_CONFIG: LearningVillageConfig = {
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
  stalls: [
    // Foundation
    { id: 'hiragana', order: 0, isPopular: true, enabled: true },
    { id: 'katakana', order: 1, isPopular: true, enabled: true },
    { id: 'drill', order: 2, isPopular: false, enabled: true },

    // Core Content
    { id: 'vocabulary', order: 3, isPopular: false, enabled: true },
    { id: 'my-lists', order: 4, isPopular: false, enabled: true },
    { id: 'kanji-browser', order: 5, isPopular: false, enabled: true },
    { id: 'kanji-mastery', order: 6, isPopular: true, enabled: true },
    { id: 'kanji-connections', order: 7, isPopular: false, enabled: true },
    { id: 'mood-boards', order: 8, isPopular: false, enabled: true },
    { id: 'conjugation', order: 9, isPopular: false, enabled: true },
    { id: 'textbook-vocab', order: 10, isPopular: false, enabled: true },

    // Practice & Immersion
    { id: 'stories', order: 11, isPopular: false, enabled: true },
    { id: 'news', order: 12, isPopular: false, enabled: true },
    { id: 'library', order: 13, isPopular: false, enabled: true },
    { id: 'youtube-shadowing', order: 14, isPopular: true, enabled: true },
    { id: 'popular-videos', order: 15, isPopular: false, enabled: true },
    { id: 'youtube-series', order: 16, isPopular: false, enabled: true },
    { id: 'my-videos', order: 17, isPopular: false, enabled: true },

    // Review & Games
    { id: 'flashcards', order: 18, isPopular: false, enabled: true },
    { id: 'games', order: 19, isPopular: true, enabled: true },
    { id: 'review-hub', order: 20, isPopular: false, enabled: true },

    // Progress & Community
    { id: 'achievements', order: 21, isPopular: false, enabled: true },
    { id: 'leaderboard', order: 22, isPopular: true, enabled: true },
    { id: 'resources', order: 23, isPopular: false, enabled: true },
    { id: 'blog', order: 24, isPopular: false, enabled: true },
    { id: 'todos', order: 25, isPopular: false, enabled: true },
  ]
}

/**
 * Get default config for a stall ID
 */
export function getDefaultStallConfig(id: StallId): StallConfig {
  const found = DEFAULT_CONFIG.stalls.find(s => s.id === id)
  if (found) return found

  // Fallback for unknown stalls
  return {
    id,
    order: 999,
    isPopular: false,
    enabled: true
  }
}

/**
 * Merge user config with defaults (ensures all stalls have config)
 */
export function mergeWithDefaults(config: Partial<LearningVillageConfig>): LearningVillageConfig {
  const existingIds = new Set(config.stalls?.map(s => s.id) || [])

  // Start with provided stalls
  const mergedStalls = [...(config.stalls || [])]

  // Add any missing stalls from defaults
  for (const defaultStall of DEFAULT_CONFIG.stalls) {
    if (!existingIds.has(defaultStall.id)) {
      mergedStalls.push(defaultStall)
    }
  }

  // Sort by order
  mergedStalls.sort((a, b) => a.order - b.order)

  return {
    version: config.version || DEFAULT_CONFIG.version,
    updatedAt: config.updatedAt || DEFAULT_CONFIG.updatedAt,
    updatedBy: config.updatedBy || DEFAULT_CONFIG.updatedBy,
    stalls: mergedStalls
  }
}
