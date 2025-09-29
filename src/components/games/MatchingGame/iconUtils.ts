// Icon utilities for Matching Game
// Using moshimoshi's existing flat-icons

const ICON_COLLECTIONS = [
  {
    path: '/ui/flat-icons/stalls/',
    icons: [
      'ceramics.png',
      'food-cart (1).png',
      'food-cart.png',
      'food-stall (1).png',
      'food-stall (2).png',
      'food-stall.png',
      'food-stand (1).png',
      'food-stand.png',
      'stall (1).png',
      'stall-food.png',
      'stall.png',
      'stand.png',
      'street-food.png',
    ]
  },
  // We can add more icon collections as they're added to moshimoshi
]

// Flatten all icons into a single array
const ALL_ICONS = ICON_COLLECTIONS.flatMap(collection =>
  collection.icons.map(icon => collection.path + icon)
)

// Add some emoji fallbacks if not enough icons
const EMOJI_ICONS = [
  '🎋', '⚡', '📚', '🎯', '🔮', '🗺️', '🔤', '🎴',
  '🎮', '📖', '🏆', '🥇', '🎌', '✅', '🗞️', '📺',
  '🔥', '🎬', '🌸', '🍜', '🍣', '🍱', '🎎', '🏮',
  '⛩️', '🗾', '🌊', '🗻', '🏯', '🎏', '🧧', '🎐'
]

/**
 * Get random unique icons for the tiles
 * @param count Number of unique icons needed
 * @returns Array of icon paths or emojis
 */
export function getRandomIcons(count: number): string[] {
  // Combine file icons and emojis for variety
  const allAvailable = [...ALL_ICONS]

  // If we need more icons than available files, add emojis
  if (count > allAvailable.length) {
    const needed = count - allAvailable.length
    const shuffledEmojis = [...EMOJI_ICONS].sort(() => Math.random() - 0.5)
    allAvailable.push(...shuffledEmojis.slice(0, needed))
  }

  // Shuffle and return the requested count
  const shuffled = allAvailable.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

/**
 * Get a set of random icons for tile backs
 * Each tile gets a unique icon for variety
 * @param tileCount Number of tiles in the game
 * @returns Array of icon paths or emojis
 */
export function getIconsForPairs(tileCount: number): string[] {
  const iconPool = [...ALL_ICONS]

  // If we don't have enough file icons, add emojis
  if (iconPool.length < tileCount) {
    const shuffledEmojis = [...EMOJI_ICONS].sort(() => Math.random() - 0.5)
    iconPool.push(...shuffledEmojis)
  }

  const result: string[] = []

  // Fill the result array with random icons
  for (let i = 0; i < tileCount; i++) {
    const randomIndex = Math.floor(Math.random() * iconPool.length)
    result.push(iconPool[randomIndex])
  }

  return result
}

/**
 * Check if a string is an emoji (not a file path)
 */
export function isEmoji(str: string): boolean {
  return !str.startsWith('/')
}