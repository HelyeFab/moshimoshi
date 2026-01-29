/**
 * Learning Village Configuration Types
 *
 * Used for admin-controlled stall ordering and popular badges.
 * Config is stored in Firestore at /config/learningVillage
 */

/**
 * Offline support levels for Learning Village stalls
 * - 'full': Works completely offline (data embedded or precached)
 * - 'partial': Some features work offline (e.g., cached user data)
 * - 'none': Requires network connection
 */
export type OfflineSupport = 'full' | 'partial' | 'none'

/**
 * Offline support mapping for each stall
 * Used to show offline indicators in the UI
 */
export const STALL_OFFLINE_SUPPORT: Record<string, OfflineSupport> = {
  // Foundation - HIGH offline support (data embedded/precached)
  hiragana: 'full', // Kana data embedded in bundle, audio cached
  katakana: 'full', // Kana data embedded in bundle, audio cached
  drill: 'partial', // Kana drills work, user progress needs sync
  'kanji-browser': 'full', // JLPT JSON precached
  'kanji-mastery': 'partial', // Data available, SRS state needs sync
  'blast-mode': 'partial', // Uses mixed content + session flow, some sync needed
  'kanji-connections': 'partial', // Data available, premium features need network
  conjugation: 'partial', // Core data available, some features need network

  // Study - MEDIUM offline support
  vocabulary: 'full', // Jisho has embedded data, page cached for offline
  'my-lists': 'partial', // Uses IndexedDB, sync needed for cloud backup
  'textbook-vocab': 'partial', // Textbook data needs download
  flashcards: 'partial', // User-created decks in IndexedDB
  'mood-boards': 'partial', // Theme data available

  // Immersion - MEDIUM offline support (content cached in IndexedDB)
  stories: 'partial', // Stories cached in IndexedDB after first visit
  news: 'partial', // Articles cached in IndexedDB after first visit
  library: 'partial', // Books cached in IndexedDB after first visit
  comics: 'partial', // Comics cached in IndexedDB after first visit
  'youtube-shadowing': 'none', // Requires YouTube API
  'popular-videos': 'none', // Video streaming
  'youtube-series': 'none', // Video streaming
  'my-videos': 'none', // Video streaming

  // Games & Review - VARIES
  games: 'partial', // Most games use local data
  'review-hub': 'partial', // SRS state in IDB, sync needed

  // Community - LOW offline support
  achievements: 'partial', // Cached achievements, server calculation
  leaderboard: 'none', // Real-time server data
  resources: 'partial', // Static content, some links need network
  blog: 'none', // Server content
  todos: 'partial', // IndexedDB with sync
  qa: 'none', // Q&A forum requires network for posting/voting/moderation
  grammar: 'partial', // Grammar points cached after first visit
}

// All available stall IDs in the Learning Village
export const STALL_IDS = [
  'hiragana',
  'katakana',
  'drill',
  'vocabulary',
  'my-lists',
  'kanji-browser',
  'kanji-mastery',
  'blast-mode',
  'kanji-connections',
  'mood-boards',
  'conjugation',
  'textbook-vocab',
  'stories',
  'news',
  'library',
  'comics',
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
  'grammar',
  'blog',
  'todos',
  'qa',
] as const

export type StallId = (typeof STALL_IDS)[number]

// High-level district grouping (used for personalization and layout ordering)
export type DistrictId = 'foundation' | 'study' | 'immersion' | 'play' | 'community'

export const DEFAULT_DISTRICT_ORDER: DistrictId[] = [
  'foundation',
  'study',
  'immersion',
  'play',
  'community',
]

/**
 * Configuration for a single stall
 */
export interface StallConfig {
  id: StallId
  order: number // Display order (lower = first)
  isPopular: boolean // Show "Popular" badge
  enabled: boolean // Whether stall is visible (respects feature flags too)
}

/**
 * Complete Learning Village configuration
 */
export interface LearningVillageConfig {
  version: string
  updatedAt: string // ISO timestamp
  updatedBy: string // Admin UID who made the change
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
    { id: 'blast-mode', order: 7, isPopular: true, enabled: true },
    { id: 'kanji-connections', order: 8, isPopular: false, enabled: true },
    { id: 'mood-boards', order: 9, isPopular: false, enabled: true },
    { id: 'conjugation', order: 10, isPopular: false, enabled: true },
    { id: 'textbook-vocab', order: 11, isPopular: false, enabled: true },

    // Practice & Immersion
    { id: 'stories', order: 12, isPopular: false, enabled: true },
    { id: 'news', order: 13, isPopular: false, enabled: true },
    { id: 'library', order: 14, isPopular: false, enabled: true },
    { id: 'comics', order: 15, isPopular: true, enabled: true },
    { id: 'youtube-shadowing', order: 16, isPopular: true, enabled: true },
    { id: 'popular-videos', order: 17, isPopular: false, enabled: true },
    { id: 'youtube-series', order: 18, isPopular: false, enabled: true },
    { id: 'my-videos', order: 19, isPopular: false, enabled: true },

    // Review & Games
    { id: 'flashcards', order: 20, isPopular: false, enabled: true },
    { id: 'games', order: 21, isPopular: true, enabled: true },
    { id: 'review-hub', order: 22, isPopular: false, enabled: true },

    // Progress & Community
    { id: 'achievements', order: 23, isPopular: false, enabled: true },
    { id: 'leaderboard', order: 24, isPopular: true, enabled: true },
    { id: 'grammar', order: 25, isPopular: false, enabled: true },
    { id: 'resources', order: 26, isPopular: false, enabled: true },
    { id: 'blog', order: 27, isPopular: false, enabled: true },
    { id: 'todos', order: 28, isPopular: false, enabled: true },
    { id: 'qa', order: 29, isPopular: false, enabled: true },
  ],
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
    enabled: true,
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
    stalls: mergedStalls,
  }
}
