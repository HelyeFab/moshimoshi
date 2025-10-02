/**
 * Mock Achievements Data
 * Static data for the achievements page after gamification removal
 */

export interface MockAchievement {
  id: string
  name: string
  icon: string
  points: number
  category: 'progress' | 'streak' | 'accuracy' | 'speed' | 'special'
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  description: string
  unlocked: boolean
}

export const MOCK_ACHIEVEMENTS: MockAchievement[] = [
  // Row 1
  {
    id: 'first-step',
    name: 'First Step',
    icon: '🏃',
    points: 0,
    category: 'progress',
    rarity: 'common',
    description: 'Complete your first review session',
    unlocked: true
  },
  {
    id: 'study-starter',
    name: 'Study Starter',
    icon: '📚',
    points: 0,
    category: 'progress',
    rarity: 'uncommon',
    description: 'Complete 10 review sessions',
    unlocked: true
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    icon: '🎯',
    points: 0,
    category: 'accuracy',
    rarity: 'rare',
    description: 'Achieve 90% accuracy in a session',
    unlocked: true
  },
  {
    id: 'daily-devotee',
    name: 'Daily Devotee',
    icon: '🇯🇵',
    points: 0,
    category: 'streak',
    rarity: 'uncommon',
    description: 'Practice 7 days in a row',
    unlocked: false
  },
  {
    id: 'quick-learner',
    name: 'Quick Learner',
    icon: '📘',
    points: 0,
    category: 'speed',
    rarity: 'uncommon',
    description: 'Complete a session in under 5 minutes',
    unlocked: false
  },
  {
    id: 'kanji-novice',
    name: 'Kanji Novice',
    icon: '月',
    points: 0,
    category: 'progress',
    rarity: 'common',
    description: 'Learn 10 kanji',
    unlocked: false
  },
  {
    id: 'vocab-builder',
    name: 'Vocab Builder',
    icon: '📝',
    points: 0,
    category: 'progress',
    rarity: 'rare',
    description: 'Learn 100 vocabulary words',
    unlocked: false
  },
  {
    id: 'streak-starter',
    name: 'Streak Starter',
    icon: '🔥',
    points: 0,
    category: 'streak',
    rarity: 'common',
    description: 'Practice 3 days in a row',
    unlocked: false
  },

  // Row 2
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    icon: '⚡',
    points: 0,
    category: 'speed',
    rarity: 'rare',
    description: 'Complete 50 reviews in under 10 minutes',
    unlocked: false
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    icon: '💯',
    points: 0,
    category: 'accuracy',
    rarity: 'epic',
    description: 'Achieve 100% accuracy in a session',
    unlocked: false
  },
  {
    id: 'consistent-performer',
    name: 'Consistent',
    icon: '🎯',
    points: 0,
    category: 'accuracy',
    rarity: 'common',
    description: 'Maintain 80%+ accuracy for 5 sessions',
    unlocked: false
  },
  {
    id: 'review-master',
    name: 'Review Master',
    icon: '⭐',
    points: 0,
    category: 'special',
    rarity: 'uncommon',
    description: 'Complete 100 review sessions',
    unlocked: false
  },

  // Additional achievements
  {
    id: 'night-owl',
    name: 'Night Owl',
    icon: '🦉',
    points: 0,
    category: 'special',
    rarity: 'uncommon',
    description: 'Practice after 10 PM',
    unlocked: false
  },
  {
    id: 'early-bird',
    name: 'Early Bird',
    icon: '🌅',
    points: 0,
    category: 'special',
    rarity: 'uncommon',
    description: 'Practice before 6 AM',
    unlocked: false
  },
  {
    id: 'marathon-runner',
    name: 'Marathon Runner',
    icon: '🏃‍♂️',
    points: 0,
    category: 'progress',
    rarity: 'epic',
    description: 'Complete 1000 reviews',
    unlocked: false
  },
  {
    id: 'kanji-master',
    name: 'Kanji Master',
    icon: '🉐',
    points: 0,
    category: 'progress',
    rarity: 'epic',
    description: 'Learn 500 kanji',
    unlocked: false
  },
  {
    id: 'hiragana-hero',
    name: 'Hiragana Hero',
    icon: 'あ',
    points: 0,
    category: 'progress',
    rarity: 'common',
    description: 'Master all hiragana',
    unlocked: false
  },
  {
    id: 'katakana-king',
    name: 'Katakana King',
    icon: 'カ',
    points: 0,
    category: 'progress',
    rarity: 'common',
    description: 'Master all katakana',
    unlocked: false
  },
  {
    id: 'weekend-warrior',
    name: 'Weekend Warrior',
    icon: '⚔️',
    points: 0,
    category: 'streak',
    rarity: 'uncommon',
    description: 'Practice every weekend for a month',
    unlocked: false
  },
  {
    id: 'legend',
    name: 'Legend',
    icon: '🌟',
    points: 0,
    category: 'special',
    rarity: 'legendary',
    description: 'Unlock all other achievements',
    unlocked: false
  },
]

// Helper functions
export function getMockUnlockedAchievements(): MockAchievement[] {
  return MOCK_ACHIEVEMENTS.filter(a => a.unlocked)
}

export function getMockAchievementsByCategory(category: string): MockAchievement[] {
  if (category === 'all') return MOCK_ACHIEVEMENTS
  return MOCK_ACHIEVEMENTS.filter(a => a.category === category)
}

export function getMockAchievementStats() {
  const unlocked = MOCK_ACHIEVEMENTS.filter(a => a.unlocked).length
  const total = MOCK_ACHIEVEMENTS.length
  return {
    unlockedCount: unlocked,
    totalCount: total,
    totalPoints: 0,
    completionPercentage: Math.round((unlocked / total) * 100)
  }
}
