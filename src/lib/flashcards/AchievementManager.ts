/**
 * Achievement Manager for Flashcard System
 * Tracks and awards achievements based on user progress
 */

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // Icon name from lucide-react
  category: 'streak' | 'mastery' | 'speed' | 'accuracy' | 'volume' | 'special';
  requirement: {
    type: string;
    value: number;
    unit?: string;
  };
  points: number; // XP reward
  unlockedAt?: number; // Timestamp when unlocked
  progress?: number; // Current progress towards achievement
}

export class AchievementManager {
  private static instance: AchievementManager | null = null;

  // Define all available achievements
  private readonly achievements: Achievement[] = [
    // Streak Achievements
    {
      id: 'streak_7',
      name: 'Week Warrior',
      description: 'Study for 7 days in a row',
      icon: 'Flame',
      category: 'streak',
      requirement: { type: 'streak', value: 7, unit: 'days' },
      points: 100
    },
    {
      id: 'streak_30',
      name: 'Consistency King',
      description: 'Study for 30 days in a row',
      icon: 'Crown',
      category: 'streak',
      requirement: { type: 'streak', value: 30, unit: 'days' },
      points: 500
    },
    {
      id: 'streak_100',
      name: 'Century Club',
      description: 'Study for 100 days in a row',
      icon: 'Trophy',
      category: 'streak',
      requirement: { type: 'streak', value: 100, unit: 'days' },
      points: 2000
    },

    // Mastery Achievements
    {
      id: 'master_100',
      name: 'Flash Apprentice',
      description: 'Master 100 cards',
      icon: 'GraduationCap',
      category: 'mastery',
      requirement: { type: 'mastered_cards', value: 100 },
      points: 150
    },
    {
      id: 'master_500',
      name: 'Flash Expert',
      description: 'Master 500 cards',
      icon: 'Award',
      category: 'mastery',
      requirement: { type: 'mastered_cards', value: 500 },
      points: 750
    },
    {
      id: 'master_1000',
      name: 'Flash Master',
      description: 'Master 1000 cards',
      icon: 'Star',
      category: 'mastery',
      requirement: { type: 'mastered_cards', value: 1000 },
      points: 2000
    },

    // Speed Achievements
    {
      id: 'speed_50',
      name: 'Quick Learner',
      description: 'Review 50 cards in under 5 minutes',
      icon: 'Zap',
      category: 'speed',
      requirement: { type: 'speed_session', value: 50, unit: 'cards_in_5min' },
      points: 200
    },
    {
      id: 'speed_100',
      name: 'Speed Demon',
      description: 'Review 100 cards in under 10 minutes',
      icon: 'FastForward',
      category: 'speed',
      requirement: { type: 'speed_session', value: 100, unit: 'cards_in_10min' },
      points: 500
    },
    {
      id: 'speed_avg',
      name: 'Lightning Reflexes',
      description: 'Maintain average response time under 3 seconds for 100 cards',
      icon: 'Clock',
      category: 'speed',
      requirement: { type: 'avg_response_time', value: 3, unit: 'seconds' },
      points: 300
    },

    // Accuracy Achievements
    {
      id: 'perfect_session',
      name: 'Perfect Score',
      description: 'Complete a session with 100% accuracy (min 20 cards)',
      icon: 'CheckCircle2',
      category: 'accuracy',
      requirement: { type: 'perfect_session', value: 20 },
      points: 100
    },
    {
      id: 'accuracy_90',
      name: 'Sharp Mind',
      description: 'Maintain 90% accuracy over 500 cards',
      icon: 'Target',
      category: 'accuracy',
      requirement: { type: 'accuracy_threshold', value: 90, unit: 'percent_500' },
      points: 400
    },
    {
      id: 'accuracy_95',
      name: 'Precision Master',
      description: 'Maintain 95% accuracy over 1000 cards',
      icon: 'Crosshair',
      category: 'accuracy',
      requirement: { type: 'accuracy_threshold', value: 95, unit: 'percent_1000' },
      points: 1000
    },

    // Volume Achievements
    {
      id: 'cards_1000',
      name: 'Card Collector',
      description: 'Review 1000 cards total',
      icon: 'Layers',
      category: 'volume',
      requirement: { type: 'total_cards', value: 1000 },
      points: 200
    },
    {
      id: 'cards_5000',
      name: 'Knowledge Seeker',
      description: 'Review 5000 cards total',
      icon: 'BookOpen',
      category: 'volume',
      requirement: { type: 'total_cards', value: 5000 },
      points: 1000
    },
    {
      id: 'cards_10000',
      name: 'Memory Champion',
      description: 'Review 10000 cards total',
      icon: 'Brain',
      category: 'volume',
      requirement: { type: 'total_cards', value: 10000 },
      points: 2500
    },

    // Special Achievements
    {
      id: 'night_owl',
      name: 'Night Owl',
      description: 'Complete 10 sessions after midnight',
      icon: 'Moon',
      category: 'special',
      requirement: { type: 'night_sessions', value: 10 },
      points: 150
    },
    {
      id: 'early_bird',
      name: 'Early Bird',
      description: 'Complete 10 sessions before 6 AM',
      icon: 'Sun',
      category: 'special',
      requirement: { type: 'early_sessions', value: 10 },
      points: 150
    },
    {
      id: 'deck_master',
      name: 'Deck Master',
      description: 'Create and share 10 decks',
      icon: 'Share2',
      category: 'special',
      requirement: { type: 'decks_created', value: 10 },
      points: 500
    },
    {
      id: 'comeback_kid',
      name: 'Comeback Kid',
      description: 'Return after a 7+ day break and complete a session',
      icon: 'RefreshCw',
      category: 'special',
      requirement: { type: 'comeback', value: 7, unit: 'days' },
      points: 200
    },
    {
      id: 'marathon',
      name: 'Marathon Runner',
      description: 'Study for 60 minutes in a single day',
      icon: 'Timer',
      category: 'special',
      requirement: { type: 'daily_minutes', value: 60 },
      points: 300
    }
  ];

  private constructor() {}

  static getInstance(): AchievementManager {
    if (!AchievementManager.instance) {
      AchievementManager.instance = new AchievementManager();
    }
    return AchievementManager.instance;
  }

  /**
   * Get user's achievements from localStorage
   */
  getUserAchievements(userId: string): Achievement[] {
    const saved = localStorage.getItem(`achievements_${userId}`);
    if (!saved) return [];

    const unlockedIds = JSON.parse(saved);
    return this.achievements
      .filter(a => unlockedIds.includes(a.id))
      .map(a => ({ ...a, unlockedAt: unlockedIds[a.id] }));
  }

  /**
   * Check if user has unlocked an achievement
   */
  hasAchievement(userId: string, achievementId: string): boolean {
    const saved = localStorage.getItem(`achievements_${userId}`);
    if (!saved) return false;
    const unlocked = JSON.parse(saved);
    return unlocked.hasOwnProperty(achievementId);
  }

  /**
   * Unlock an achievement for a user
   */
  unlockAchievement(userId: string, achievementId: string): Achievement | null {
    const achievement = this.achievements.find(a => a.id === achievementId);
    if (!achievement) return null;

    // Check if already unlocked
    if (this.hasAchievement(userId, achievementId)) return null;

    // Save to localStorage
    const saved = localStorage.getItem(`achievements_${userId}`) || '{}';
    const unlocked = JSON.parse(saved);
    unlocked[achievementId] = Date.now();
    localStorage.setItem(`achievements_${userId}`, JSON.stringify(unlocked));

    return {
      ...achievement,
      unlockedAt: unlocked[achievementId]
    };
  }

  /**
   * Check achievements based on session stats
   */
  checkSessionAchievements(
    userId: string,
    sessionStats: any
  ): Achievement[] {
    const newAchievements: Achievement[] = [];

    // Check perfect session
    if (sessionStats.accuracy === 1 && sessionStats.cardsStudied >= 20) {
      const achievement = this.unlockAchievement(userId, 'perfect_session');
      if (achievement) newAchievements.push(achievement);
    }

    // Check speed achievements
    if (sessionStats.duration <= 300 && sessionStats.cardsStudied >= 50) { // 5 minutes
      const achievement = this.unlockAchievement(userId, 'speed_50');
      if (achievement) newAchievements.push(achievement);
    }

    if (sessionStats.duration <= 600 && sessionStats.cardsStudied >= 100) { // 10 minutes
      const achievement = this.unlockAchievement(userId, 'speed_100');
      if (achievement) newAchievements.push(achievement);
    }

    // Check time-based special achievements
    const hour = new Date(sessionStats.timestamp).getHours();
    if (hour >= 0 && hour < 6) {
      const earlyStats = this.getProgressStats(userId, 'early_sessions');
      if (earlyStats.count >= 10 && !this.hasAchievement(userId, 'early_bird')) {
        const achievement = this.unlockAchievement(userId, 'early_bird');
        if (achievement) newAchievements.push(achievement);
      }
    } else if (hour >= 0 && hour < 5) {
      const nightStats = this.getProgressStats(userId, 'night_sessions');
      if (nightStats.count >= 10 && !this.hasAchievement(userId, 'night_owl')) {
        const achievement = this.unlockAchievement(userId, 'night_owl');
        if (achievement) newAchievements.push(achievement);
      }
    }

    return newAchievements;
  }

  /**
   * Check achievements based on overall progress
   */
  async checkProgressAchievements(
    userId: string,
    stats: {
      streak: number;
      totalCardsReviewed: number;
      totalMasteredCards: number;
      averageAccuracy: number;
      totalDecksCreated: number;
      totalMinutesStudied: number;
    }
  ): Promise<Achievement[]> {
    const newAchievements: Achievement[] = [];

    // Check streak achievements
    if (stats.streak >= 7 && !this.hasAchievement(userId, 'streak_7')) {
      const achievement = this.unlockAchievement(userId, 'streak_7');
      if (achievement) newAchievements.push(achievement);
    }

    if (stats.streak >= 30 && !this.hasAchievement(userId, 'streak_30')) {
      const achievement = this.unlockAchievement(userId, 'streak_30');
      if (achievement) newAchievements.push(achievement);
    }

    if (stats.streak >= 100 && !this.hasAchievement(userId, 'streak_100')) {
      const achievement = this.unlockAchievement(userId, 'streak_100');
      if (achievement) newAchievements.push(achievement);
    }

    // Check mastery achievements
    if (stats.totalMasteredCards >= 100 && !this.hasAchievement(userId, 'master_100')) {
      const achievement = this.unlockAchievement(userId, 'master_100');
      if (achievement) newAchievements.push(achievement);
    }

    if (stats.totalMasteredCards >= 500 && !this.hasAchievement(userId, 'master_500')) {
      const achievement = this.unlockAchievement(userId, 'master_500');
      if (achievement) newAchievements.push(achievement);
    }

    if (stats.totalMasteredCards >= 1000 && !this.hasAchievement(userId, 'master_1000')) {
      const achievement = this.unlockAchievement(userId, 'master_1000');
      if (achievement) newAchievements.push(achievement);
    }

    // Check volume achievements
    if (stats.totalCardsReviewed >= 1000 && !this.hasAchievement(userId, 'cards_1000')) {
      const achievement = this.unlockAchievement(userId, 'cards_1000');
      if (achievement) newAchievements.push(achievement);
    }

    if (stats.totalCardsReviewed >= 5000 && !this.hasAchievement(userId, 'cards_5000')) {
      const achievement = this.unlockAchievement(userId, 'cards_5000');
      if (achievement) newAchievements.push(achievement);
    }

    if (stats.totalCardsReviewed >= 10000 && !this.hasAchievement(userId, 'cards_10000')) {
      const achievement = this.unlockAchievement(userId, 'cards_10000');
      if (achievement) newAchievements.push(achievement);
    }

    // Check deck creation achievement
    if (stats.totalDecksCreated >= 10 && !this.hasAchievement(userId, 'deck_master')) {
      const achievement = this.unlockAchievement(userId, 'deck_master');
      if (achievement) newAchievements.push(achievement);
    }

    return newAchievements;
  }

  /**
   * Get progress statistics for tracking
   */
  private getProgressStats(userId: string, statType: string): any {
    const key = `achievement_progress_${userId}_${statType}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : { count: 0, lastUpdated: 0 };
  }

  /**
   * Update progress statistics
   */
  updateProgressStats(userId: string, statType: string, increment: number = 1): void {
    const key = `achievement_progress_${userId}_${statType}`;
    const current = this.getProgressStats(userId, statType);
    current.count += increment;
    current.lastUpdated = Date.now();
    localStorage.setItem(key, JSON.stringify(current));
  }

  /**
   * Get all achievements with progress
   */
  getAllAchievementsWithProgress(userId: string, currentStats?: any): Achievement[] {
    const unlocked = this.getUserAchievements(userId);
    const unlockedIds = unlocked.map(a => a.id);

    return this.achievements.map(achievement => {
      if (unlockedIds.includes(achievement.id)) {
        return unlocked.find(a => a.id === achievement.id)!;
      }

      // Calculate progress for locked achievements
      let progress = 0;
      if (currentStats) {
        switch (achievement.requirement.type) {
          case 'streak':
            progress = Math.min(100, (currentStats.streak / achievement.requirement.value) * 100);
            break;
          case 'mastered_cards':
            progress = Math.min(100, (currentStats.totalMasteredCards / achievement.requirement.value) * 100);
            break;
          case 'total_cards':
            progress = Math.min(100, (currentStats.totalCardsReviewed / achievement.requirement.value) * 100);
            break;
          case 'decks_created':
            progress = Math.min(100, (currentStats.totalDecksCreated / achievement.requirement.value) * 100);
            break;
        }
      }

      return {
        ...achievement,
        progress
      };
    });
  }

  /**
   * Get total points earned
   */
  getTotalPoints(userId: string): number {
    const unlocked = this.getUserAchievements(userId);
    return unlocked.reduce((sum, a) => sum + a.points, 0);
  }

  /**
   * Get achievements by category
   */
  getAchievementsByCategory(category: Achievement['category']): Achievement[] {
    return this.achievements.filter(a => a.category === category);
  }
}

// Export singleton instance
export const achievementManager = AchievementManager.getInstance();