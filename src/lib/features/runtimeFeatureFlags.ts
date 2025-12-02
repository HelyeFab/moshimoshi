/**
 * Runtime Feature Flags
 *
 * These flags can be toggled in real-time via the admin panel.
 * They override environment variables and take effect immediately.
 */

import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

export type FeatureFlag =
  | 'COMMAND_PALETTE'
  | 'BOTTOM_NAV'
  | 'AUTO_HIDE_NAV'
  | 'GLASSMORPHISM_NAV'
  | 'LEARNING_VILLAGE'
  | 'ANIMATION_CONTROL'
  | 'STREAK_SYSTEM'
  | 'LEADERBOARD'
  | 'ACHIEVEMENTS'
  | 'YOUTUBE_SHADOWING'
  | 'AI_STORIES'
  | 'BLOG'
  | 'NEWSLETTER'
  | 'NOTIFICATIONS'
  | 'DRILL_PRACTICE'
  | 'KANJI_BROWSER'
  | 'ANKI_IMPORT'
  | 'CUSTOM_LISTS'
  | 'REVIEW_ENGINE'
  | 'FLASHCARDS'
  | 'GAMES'

export interface FeatureMetadata {
  name: string
  description: string
  category: string
  defaultEnabled: boolean
}

export const FEATURE_METADATA: Record<FeatureFlag, FeatureMetadata> = {
  COMMAND_PALETTE: {
    name: 'Command Palette',
    description: 'Quick navigation search (Cmd/Ctrl+K)',
    category: 'Navigation',
    defaultEnabled: true,
  },
  BOTTOM_NAV: {
    name: 'Bottom Navigation',
    description: 'Mobile bottom navigation bar',
    category: 'Navigation',
    defaultEnabled: true,
  },
  AUTO_HIDE_NAV: {
    name: 'Auto-hide Navigation',
    description: 'Auto-hiding top navbar on mobile',
    category: 'Navigation',
    defaultEnabled: true,
  },
  GLASSMORPHISM_NAV: {
    name: 'Glassmorphism Effect',
    description: 'Glassmorphism styling on navigation',
    category: 'Navigation',
    defaultEnabled: true,
  },
  LEARNING_VILLAGE: {
    name: 'Learning Village',
    description: 'Interactive learning village on dashboard',
    category: 'Dashboard',
    defaultEnabled: true,
  },
  ANIMATION_CONTROL: {
    name: 'Animation Control',
    description: 'Pause/play button for animations',
    category: 'UX',
    defaultEnabled: true,
  },
  STREAK_SYSTEM: {
    name: 'Streak System',
    description: 'Daily streak tracking and rewards',
    category: 'Gamification',
    defaultEnabled: true,
  },
  LEADERBOARD: {
    name: 'Leaderboard',
    description: 'Global leaderboard rankings',
    category: 'Gamification',
    defaultEnabled: true,
  },
  ACHIEVEMENTS: {
    name: 'Achievements',
    description: 'Achievement badges and rewards',
    category: 'Gamification',
    defaultEnabled: true,
  },
  YOUTUBE_SHADOWING: {
    name: 'YouTube Shadowing',
    description: 'Practice with YouTube videos',
    category: 'Learning',
    defaultEnabled: true,
  },
  AI_STORIES: {
    name: 'AI Stories',
    description: 'AI-generated reading stories',
    category: 'Learning',
    defaultEnabled: true,
  },
  BLOG: {
    name: 'Blog',
    description: 'Blog section and articles',
    category: 'Content',
    defaultEnabled: true,
  },
  NEWSLETTER: {
    name: 'Newsletter',
    description: 'Email newsletter subscription',
    category: 'Content',
    defaultEnabled: true,
  },
  NOTIFICATIONS: {
    name: 'Notifications',
    description: 'Push notifications system',
    category: 'Engagement',
    defaultEnabled: true,
  },
  DRILL_PRACTICE: {
    name: 'Drill Practice',
    description: 'Quick drill exercises',
    category: 'Learning',
    defaultEnabled: true,
  },
  KANJI_BROWSER: {
    name: 'Kanji Browser',
    description: 'Browse and study kanji',
    category: 'Learning',
    defaultEnabled: true,
  },
  ANKI_IMPORT: {
    name: 'Anki Import',
    description: 'Import Anki decks',
    category: 'Learning',
    defaultEnabled: true,
  },
  CUSTOM_LISTS: {
    name: 'Custom Lists',
    description: 'Create custom study lists',
    category: 'Learning',
    defaultEnabled: true,
  },
  REVIEW_ENGINE: {
    name: 'Review Engine',
    description: 'Universal SRS review system',
    category: 'Learning',
    defaultEnabled: true,
  },
  FLASHCARDS: {
    name: 'Flashcards',
    description: 'Flashcard study system',
    category: 'Learning',
    defaultEnabled: true,
  },
  GAMES: {
    name: 'Learning Games',
    description: 'Educational games',
    category: 'Learning',
    defaultEnabled: true,
  },
}

// In-memory cache for feature flags
let cachedFlags: Record<string, boolean> | null = null
let lastFetch = 0
const CACHE_TTL = 60000 // 1 minute

/**
 * Get all feature flags from Firestore
 */
export async function getAllFeatureFlags(): Promise<Record<FeatureFlag, boolean>> {
  // Return cached if fresh
  const now = Date.now()
  if (cachedFlags && now - lastFetch < CACHE_TTL) {
    return cachedFlags as Record<FeatureFlag, boolean>
  }

  try {
    if (!db) {
      return getDefaultFlags()
    }
    const docRef = doc(db, 'config', 'featureFlags')
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      cachedFlags = { ...getDefaultFlags(), ...data }
    } else {
      // Initialize with defaults
      const defaults = getDefaultFlags()
      await setDoc(docRef, defaults)
      cachedFlags = defaults
    }

    lastFetch = now
    return cachedFlags as Record<FeatureFlag, boolean>
  } catch (error) {
    console.error('Error fetching feature flags:', error)
    // Return defaults on error
    return getDefaultFlags()
  }
}

/**
 * Get default feature flags
 */
function getDefaultFlags(): Record<FeatureFlag, boolean> {
  const defaults: Partial<Record<FeatureFlag, boolean>> = {}

  for (const [key, metadata] of Object.entries(FEATURE_METADATA)) {
    defaults[key as FeatureFlag] = metadata.defaultEnabled
  }

  return defaults as Record<FeatureFlag, boolean>
}

/**
 * Check if a specific feature is enabled
 */
export async function isFeatureEnabled(flag: FeatureFlag): Promise<boolean> {
  const flags = await getAllFeatureFlags()
  return flags[flag] ?? FEATURE_METADATA[flag]?.defaultEnabled ?? false
}

/**
 * Update a feature flag (Admin only)
 */
export async function updateFeatureFlag(flag: FeatureFlag, enabled: boolean): Promise<void> {
  try {
    if (!db) {
      throw new Error('Firestore not initialized')
    }
    const docRef = doc(db, 'config', 'featureFlags')
    const currentFlags = await getAllFeatureFlags()

    const updatedFlags = {
      ...currentFlags,
      [flag]: enabled,
    }

    await setDoc(docRef, updatedFlags, { merge: true })

    // Update cache
    cachedFlags = updatedFlags
    lastFetch = Date.now()
  } catch (error) {
    console.error('Error updating feature flag:', error)
    throw error
  }
}

/**
 * Reset all flags to defaults
 */
export async function resetAllFeatureFlags(): Promise<void> {
  try {
    if (!db) {
      throw new Error('Firestore not initialized')
    }
    const defaults = getDefaultFlags()
    const docRef = doc(db, 'config', 'featureFlags')
    await setDoc(docRef, defaults)

    // Update cache
    cachedFlags = defaults
    lastFetch = Date.now()
  } catch (error) {
    console.error('Error resetting feature flags:', error)
    throw error
  }
}

/**
 * Clear the cache (useful after updates)
 */
export function clearFeatureFlagCache(): void {
  cachedFlags = null
  lastFetch = 0
}
