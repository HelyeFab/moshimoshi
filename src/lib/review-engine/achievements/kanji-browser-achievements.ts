/**
 * Kanji Browser Achievements
 * Achievements specific to the Kanji Browser feature
 */

import { Achievement, AchievementCriteria } from '../progress/achievement-system';

export const KANJI_BROWSER_ACHIEVEMENTS: Achievement[] = [
  // Explorer Achievements
  {
    id: 'kanji_explorer_10',
    name: 'Kanji Explorer',
    description: 'Browse 10 unique kanji',
    icon: '🔍',
    category: 'progress',
    rarity: 'common',
    points: 10,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.uniqueKanjiBrowsed >= 10,
      progressCalculation: (stats) => Math.min(stats.uniqueKanjiBrowsed || 0, 10),
      requirement: 10
    }
  },
  {
    id: 'kanji_explorer_50',
    name: 'Kanji Researcher',
    description: 'Browse 50 unique kanji',
    icon: '📚',
    category: 'progress',
    rarity: 'uncommon',
    points: 25,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.uniqueKanjiBrowsed >= 50,
      progressCalculation: (stats) => Math.min(stats.uniqueKanjiBrowsed || 0, 50),
      requirement: 50
    }
  },
  {
    id: 'kanji_explorer_100',
    name: 'Kanji Scholar',
    description: 'Browse 100 unique kanji',
    icon: '🎓',
    category: 'progress',
    rarity: 'rare',
    points: 50,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.uniqueKanjiBrowsed >= 100,
      progressCalculation: (stats) => Math.min(stats.uniqueKanjiBrowsed || 0, 100),
      requirement: 100
    }
  },
  {
    id: 'kanji_explorer_500',
    name: 'Kanji Master Explorer',
    description: 'Browse 500 unique kanji',
    icon: '🏆',
    category: 'progress',
    rarity: 'epic',
    points: 100,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.uniqueKanjiBrowsed >= 500,
      progressCalculation: (stats) => Math.min(stats.uniqueKanjiBrowsed || 0, 500),
      requirement: 500
    }
  },

  // Bookmark Achievements
  {
    id: 'kanji_collector_25',
    name: 'Kanji Collector',
    description: 'Bookmark 25 kanji for later study',
    icon: '📌',
    category: 'progress',
    rarity: 'common',
    points: 15,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.kanjiBookmarked >= 25,
      progressCalculation: (stats) => Math.min(stats.kanjiBookmarked || 0, 25),
      requirement: 25
    }
  },
  {
    id: 'kanji_collector_50',
    name: 'Kanji Curator',
    description: 'Bookmark 50 kanji for later study',
    icon: '📖',
    category: 'progress',
    rarity: 'uncommon',
    points: 30,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.kanjiBookmarked >= 50,
      progressCalculation: (stats) => Math.min(stats.kanjiBookmarked || 0, 50),
      requirement: 50
    }
  },
  {
    id: 'kanji_collector_100',
    name: 'Kanji Librarian',
    description: 'Bookmark 100 kanji for later study',
    icon: '📚',
    category: 'progress',
    rarity: 'rare',
    points: 60,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.kanjiBookmarked >= 100,
      progressCalculation: (stats) => Math.min(stats.kanjiBookmarked || 0, 100),
      requirement: 100
    }
  },

  // JLPT Completionist Achievements
  {
    id: 'jlpt_n5_explorer',
    name: 'JLPT N5 Explorer',
    description: 'Browse all N5 kanji (80 kanji)',
    icon: '🌱',
    category: 'special',
    rarity: 'uncommon',
    points: 40,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.jlptN5Browsed >= 80,
      progressCalculation: (stats) => Math.min(stats.jlptN5Browsed || 0, 80),
      requirement: 80
    }
  },
  {
    id: 'jlpt_n4_explorer',
    name: 'JLPT N4 Explorer',
    description: 'Browse all N4 kanji (170 kanji)',
    icon: '🌿',
    category: 'special',
    rarity: 'rare',
    points: 75,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.jlptN4Browsed >= 170,
      progressCalculation: (stats) => Math.min(stats.jlptN4Browsed || 0, 170),
      requirement: 170
    }
  },
  {
    id: 'jlpt_n3_explorer',
    name: 'JLPT N3 Explorer',
    description: 'Browse all N3 kanji (370 kanji)',
    icon: '🌲',
    category: 'special',
    rarity: 'epic',
    points: 150,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.jlptN3Browsed >= 370,
      progressCalculation: (stats) => Math.min(stats.jlptN3Browsed || 0, 370),
      requirement: 370
    }
  },

  // Daily Browser Achievements
  {
    id: 'daily_browser_7',
    name: 'Week of Discovery',
    description: 'Browse kanji 7 days in a row',
    icon: '📅',
    category: 'streak',
    rarity: 'common',
    points: 20,
    criteria: {
      type: 'simple',
      condition: (stats) => stats.kanjiBrowseStreak >= 7
    }
  },
  {
    id: 'daily_browser_30',
    name: 'Month of Exploration',
    description: 'Browse kanji 30 days in a row',
    icon: '📆',
    category: 'streak',
    rarity: 'rare',
    points: 100,
    criteria: {
      type: 'simple',
      condition: (stats) => stats.kanjiBrowseStreak >= 30
    }
  },
  {
    id: 'daily_browser_100',
    name: 'Century of Knowledge',
    description: 'Browse kanji 100 days in a row',
    icon: '💯',
    category: 'streak',
    rarity: 'legendary',
    points: 500,
    criteria: {
      type: 'simple',
      condition: (stats) => stats.kanjiBrowseStreak >= 100
    }
  },

  // Review Queue Achievements
  {
    id: 'review_builder_10',
    name: 'Review Builder',
    description: 'Add 10 kanji to your review queue',
    icon: '➕',
    category: 'progress',
    rarity: 'common',
    points: 10,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.kanjiAddedToReview >= 10,
      progressCalculation: (stats) => Math.min(stats.kanjiAddedToReview || 0, 10),
      requirement: 10
    }
  },
  {
    id: 'review_builder_50',
    name: 'Review Architect',
    description: 'Add 50 kanji to your review queue',
    icon: '🏗️',
    category: 'progress',
    rarity: 'uncommon',
    points: 30,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.kanjiAddedToReview >= 50,
      progressCalculation: (stats) => Math.min(stats.kanjiAddedToReview || 0, 50),
      requirement: 50
    }
  },
  {
    id: 'review_builder_100',
    name: 'Review Master Builder',
    description: 'Add 100 kanji to your review queue',
    icon: '🏛️',
    category: 'progress',
    rarity: 'rare',
    points: 60,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.kanjiAddedToReview >= 100,
      progressCalculation: (stats) => Math.min(stats.kanjiAddedToReview || 0, 100),
      requirement: 100
    }
  },

  // Special Achievements
  {
    id: 'speed_browser',
    name: 'Speed Browser',
    description: 'Browse 20 kanji in a single session',
    icon: '⚡',
    category: 'special',
    rarity: 'uncommon',
    points: 25,
    criteria: {
      type: 'simple',
      condition: (stats) => stats.maxKanjiInSession >= 20
    }
  },
  {
    id: 'thorough_researcher',
    name: 'Thorough Researcher',
    description: 'Spend over 5 minutes studying a single kanji',
    icon: '🔬',
    category: 'special',
    rarity: 'uncommon',
    points: 20,
    criteria: {
      type: 'simple',
      condition: (stats) => stats.maxTimeOnKanji >= 300 // 5 minutes in seconds
    }
  },
  {
    id: 'early_bird_browser',
    name: 'Early Bird Browser',
    description: 'Browse kanji before 6 AM',
    icon: '🌅',
    category: 'special',
    rarity: 'common',
    points: 15,
    criteria: {
      type: 'simple',
      condition: (stats) => stats.hasEarlyMorningBrowse === true
    }
  },
  {
    id: 'night_owl_browser',
    name: 'Night Owl Browser',
    description: 'Browse kanji after midnight',
    icon: '🦉',
    category: 'special',
    rarity: 'common',
    points: 15,
    criteria: {
      type: 'simple',
      condition: (stats) => stats.hasLateNightBrowse === true
    }
  }
];

/**
 * Helper function to check browse achievements
 */
export function checkKanjiBrowseAchievements(stats: any): string[] {
  const unlockedAchievements: string[] = [];

  for (const achievement of KANJI_BROWSER_ACHIEVEMENTS) {
    if (achievement.criteria.condition(stats)) {
      unlockedAchievements.push(achievement.id);
    }
  }

  return unlockedAchievements;
}

/**
 * Calculate progress for all progressive achievements
 */
export function calculateBrowseAchievementProgress(stats: any): Map<string, number> {
  const progress = new Map<string, number>();

  for (const achievement of KANJI_BROWSER_ACHIEVEMENTS) {
    if (achievement.criteria.type === 'progressive' && achievement.criteria.progressCalculation) {
      const currentProgress = achievement.criteria.progressCalculation(stats);
      progress.set(achievement.id, currentProgress / (achievement.criteria.requirement || 1));
    }
  }

  return progress;
}