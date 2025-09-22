/**
 * Achievement System for review progress
 * Tracks and awards achievements based on user progress
 */

import { EventEmitter } from 'events';
import { ProgressTracker } from './progress-tracker';
import { reviewLogger } from '@/lib/monitoring/logger';
import { statisticsAggregator } from './statistics-aggregator';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'progress' | 'streak' | 'accuracy' | 'speed' | 'special';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  points: number;
  unlockedAt?: number;
  progress?: number;
  maxProgress?: number;
  criteria: AchievementCriteria;
}

export interface AchievementCriteria {
  type: 'simple' | 'progressive' | 'cumulative' | 'conditional';
  condition: (stats: any) => boolean;
  progressCalculation?: (stats: any) => number;
  requirement?: number;
  metadata?: any;
}

export interface UserAchievements {
  userId: string;
  unlocked: Set<string>;
  totalPoints: number;
  recentUnlocks: Achievement[];
  statistics: {
    totalAchievements: number;
    unlockedCount: number;
    percentageComplete: number;
    byCategory: Map<string, number>;
    byRarity: Map<string, number>;
  };
}

export class AchievementSystem extends EventEmitter {
  private achievements: Map<string, Achievement> = new Map();
  private userAchievements: UserAchievements;
  private progressTracker: ProgressTracker;
  private checkQueue: Set<string> = new Set();
  
  constructor(userId: string, progressTracker: ProgressTracker) {
    super();
    this.progressTracker = progressTracker;
    this.userAchievements = this.initializeUserAchievements(userId);
    this.defineAchievements();
    this.setupEventListeners();
    this.loadUserAchievements();
  }
  
  /**
   * Initialize user achievements
   */
  private initializeUserAchievements(userId: string): UserAchievements {
    return {
      userId,
      unlocked: new Set(),
      totalPoints: 0,
      recentUnlocks: [],
      statistics: {
        totalAchievements: 0,
        unlockedCount: 0,
        percentageComplete: 0,
        byCategory: new Map(),
        byRarity: new Map()
      }
    };
  }
  
  /**
   * Define all achievements
   */
  private defineAchievements(): void {
    const achievements: Achievement[] = [
      // Progress Achievements
      {
        id: 'first-step',
        name: 'First Step',
        description: 'Complete your first review session',
        icon: '👶',
        category: 'progress',
        rarity: 'common',
        points: 10,
        criteria: {
          type: 'simple',
          condition: (stats) => stats.totalReviews >= 1
        }
      },
      {
        id: 'dedicated-learner',
        name: 'Dedicated Learner',
        description: 'Complete 100 reviews',
        icon: '📚',
        category: 'progress',
        rarity: 'uncommon',
        points: 25,
        criteria: {
          type: 'progressive',
          condition: (stats) => stats.totalReviews >= 100,
          progressCalculation: (stats) => Math.min(stats.totalReviews, 100),
          requirement: 100
        }
      },
      {
        id: 'review-master',
        name: 'Review Master',
        description: 'Complete 1000 reviews',
        icon: '🎓',
        category: 'progress',
        rarity: 'rare',
        points: 50,
        criteria: {
          type: 'progressive',
          condition: (stats) => stats.totalReviews >= 1000,
          progressCalculation: (stats) => Math.min(stats.totalReviews, 1000),
          requirement: 1000
        }
      },
      {
        id: 'hiragana-master',
        name: 'Hiragana Master',
        description: 'Master all hiragana characters',
        icon: '🇯🇵',
        category: 'progress',
        rarity: 'uncommon',
        points: 30,
        criteria: {
          type: 'simple',
          condition: (stats) => stats.hiraganaProgress >= 100
        }
      },
      {
        id: 'katakana-master',
        name: 'Katakana Master',
        description: 'Master all katakana characters',
        icon: '🗾',
        category: 'progress',
        rarity: 'uncommon',
        points: 30,
        criteria: {
          type: 'simple',
          condition: (stats) => stats.katakanaProgress >= 100
        }
      },
      {
        id: 'kanji-novice',
        name: 'Kanji Novice',
        description: 'Learn your first 10 kanji',
        icon: '🈷',
        category: 'progress',
        rarity: 'common',
        points: 20,
        criteria: {
          type: 'progressive',
          condition: (stats) => stats.kanjiLearned >= 10,
          progressCalculation: (stats) => Math.min(stats.kanjiLearned, 10),
          requirement: 10
        }
      },
      {
        id: 'kanji-apprentice',
        name: 'Kanji Apprentice',
        description: 'Learn 100 kanji',
        icon: '🈯',
        category: 'progress',
        rarity: 'rare',
        points: 50,
        criteria: {
          type: 'progressive',
          condition: (stats) => stats.kanjiLearned >= 100,
          progressCalculation: (stats) => Math.min(stats.kanjiLearned, 100),
          requirement: 100
        }
      },
      
      // Streak Achievements
      {
        id: 'week-warrior',
        name: 'Week Warrior',
        description: 'Maintain a 7-day streak',
        icon: '🔥',
        category: 'streak',
        rarity: 'uncommon',
        points: 20,
        criteria: {
          type: 'simple',
          condition: (stats) => stats.currentStreak >= 7
        }
      },
      {
        id: 'month-marathon',
        name: 'Month Marathon',
        description: 'Maintain a 30-day streak',
        icon: '🏃',
        category: 'streak',
        rarity: 'rare',
        points: 50,
        criteria: {
          type: 'simple',
          condition: (stats) => stats.currentStreak >= 30
        }
      },
      {
        id: 'century-streak',
        name: 'Century Streak',
        description: 'Maintain a 100-day streak',
        icon: '💯',
        category: 'streak',
        rarity: 'epic',
        points: 100,
        criteria: {
          type: 'simple',
          condition: (stats) => stats.currentStreak >= 100
        }
      },
      
      // Accuracy Achievements
      {
        id: 'sharpshooter',
        name: 'Sharpshooter',
        description: 'Achieve 90% accuracy in a session',
        icon: '🎯',
        category: 'accuracy',
        rarity: 'uncommon',
        points: 15,
        criteria: {
          type: 'conditional',
          condition: (stats) => stats.sessionAccuracy >= 90
        }
      },
      {
        id: 'perfect-session',
        name: 'Perfect Session',
        description: 'Complete a session with 100% accuracy',
        icon: '⭐',
        category: 'accuracy',
        rarity: 'rare',
        points: 30,
        criteria: {
          type: 'conditional',
          condition: (stats) => stats.sessionAccuracy === 100 && stats.sessionItems >= 10
        }
      },
      {
        id: 'consistent-performer',
        name: 'Consistent Performer',
        description: 'Maintain 80% overall accuracy',
        icon: '📊',
        category: 'accuracy',
        rarity: 'uncommon',
        points: 25,
        criteria: {
          type: 'simple',
          condition: (stats) => stats.overallAccuracy >= 80
        }
      },
      
      // Speed Achievements
      {
        id: 'speed-demon',
        name: 'Speed Demon',
        description: 'Complete 50 reviews in under 5 minutes',
        icon: '⚡',
        category: 'speed',
        rarity: 'rare',
        points: 40,
        criteria: {
          type: 'conditional',
          condition: (stats) => stats.speedRun50 && stats.speedRun50Time < 300000
        }
      },
      {
        id: 'quick-thinker',
        name: 'Quick Thinker',
        description: 'Average response time under 3 seconds',
        icon: '🧠',
        category: 'speed',
        rarity: 'uncommon',
        points: 20,
        criteria: {
          type: 'simple',
          condition: (stats) => stats.avgResponseTime < 3000
        }
      },
      
      // Special Achievements
      {
        id: 'night-owl',
        name: 'Night Owl',
        description: 'Complete a session after midnight',
        icon: '🦉',
        category: 'special',
        rarity: 'common',
        points: 10,
        criteria: {
          type: 'conditional',
          condition: (stats) => {
            const hour = new Date(stats.lastSessionTime).getHours();
            return hour >= 0 && hour < 6;
          }
        }
      },
      {
        id: 'early-bird',
        name: 'Early Bird',
        description: 'Complete a session before 6 AM',
        icon: '🐦',
        category: 'special',
        rarity: 'common',
        points: 10,
        criteria: {
          type: 'conditional',
          condition: (stats) => {
            const hour = new Date(stats.lastSessionTime).getHours();
            return hour >= 4 && hour < 6;
          }
        }
      },
      {
        id: 'weekend-warrior',
        name: 'Weekend Warrior',
        description: 'Complete sessions on both Saturday and Sunday',
        icon: '🎮',
        category: 'special',
        rarity: 'common',
        points: 15,
        criteria: {
          type: 'conditional',
          condition: (stats) => stats.weekendSessions >= 2
        }
      },
      {
        id: 'polyglot',
        name: 'Polyglot',
        description: 'Learn content from all categories',
        icon: '🌍',
        category: 'special',
        rarity: 'epic',
        points: 75,
        criteria: {
          type: 'conditional',
          condition: (stats) => {
            const categories = ['hiragana', 'katakana', 'kanji', 'vocabulary', 'grammar'];
            return categories.every(cat => stats[`${cat}Progress`] > 0);
          }
        }
      },
      {
        id: 'comeback-kid',
        name: 'Comeback Kid',
        description: 'Return after a 7-day break',
        icon: '🔄',
        category: 'special',
        rarity: 'uncommon',
        points: 20,
        criteria: {
          type: 'conditional',
          condition: (stats) => stats.comebackAfterBreak === true
        }
      }
    ];
    
    // Add achievements to map
    for (const achievement of achievements) {
      this.achievements.set(achievement.id, achievement);
    }
    
    // Update statistics
    this.userAchievements.statistics.totalAchievements = achievements.length;
  }
  
  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for progress updates
    this.progressTracker.on('progress.updated', () => {
      this.checkAchievements();
    });
    
    this.progressTracker.on('milestone.reached', () => {
      this.checkAchievements();
    });
    
    // Listen for session completions
    this.progressTracker.on('session.completed', (sessionStats: any) => {
      this.checkSessionAchievements(sessionStats);
    });
  }
  
  /**
   * Check all achievements
   */
  async checkAchievements(): Promise<void> {
    const stats = await this.gatherStatistics();
    
    for (const [id, achievement] of this.achievements) {
      if (this.userAchievements.unlocked.has(id)) continue;
      
      // Check if criteria is met
      if (achievement.criteria.condition(stats)) {
        this.unlockAchievement(achievement, stats);
      } else if (achievement.criteria.type === 'progressive') {
        // Update progress for progressive achievements
        this.updateProgress(achievement, stats);
      }
    }
    
    this.saveUserAchievements();
  }
  
  /**
   * Check session-specific achievements
   */
  private checkSessionAchievements(sessionStats: any): void {
    const stats = {
      ...sessionStats,
      sessionAccuracy: (sessionStats.correct / sessionStats.total) * 100,
      sessionItems: sessionStats.total
    };
    
    for (const [id, achievement] of this.achievements) {
      if (this.userAchievements.unlocked.has(id)) continue;
      
      if (achievement.category === 'accuracy' || achievement.category === 'speed') {
        if (achievement.criteria.condition(stats)) {
          this.unlockAchievement(achievement, stats);
        }
      }
    }
  }
  
  /**
   * Unlock an achievement
   */
  private unlockAchievement(achievement: Achievement, stats: any): void {
    if (this.userAchievements.unlocked.has(achievement.id)) return;
    
    // Mark as unlocked
    achievement.unlockedAt = Date.now();
    this.userAchievements.unlocked.add(achievement.id);
    this.userAchievements.totalPoints += achievement.points;
    
    // Add to recent unlocks
    this.userAchievements.recentUnlocks.unshift(achievement);
    if (this.userAchievements.recentUnlocks.length > 10) {
      this.userAchievements.recentUnlocks.pop();
    }
    
    // Update statistics
    this.updateStatistics();
    
    // Emit unlock event
    this.emit('achievement.unlocked', {
      achievement,
      totalPoints: this.userAchievements.totalPoints,
      timestamp: achievement.unlockedAt
    });
    
    // Show notification
    this.showUnlockNotification(achievement);
  }
  
  /**
   * Update progress for progressive achievements
   */
  private updateProgress(achievement: Achievement, stats: any): void {
    if (!achievement.criteria.progressCalculation) return;
    
    const progress = achievement.criteria.progressCalculation(stats);
    const maxProgress = achievement.criteria.requirement || 100;
    
    achievement.progress = progress;
    achievement.maxProgress = maxProgress;
    
    // Emit progress update
    this.emit('achievement.progress', {
      achievementId: achievement.id,
      progress,
      maxProgress,
      percentage: (progress / maxProgress) * 100
    });
  }
  
  /**
   * Gather statistics for achievement checking
   */
  private async gatherStatistics(): Promise<any> {
    const snapshot = this.progressTracker.getSnapshot();
    const categories = snapshot.categories;

    // Get aggregated statistics from the statistics aggregator
    const userId = this.userAchievements.userId;
    const aggregatedStats = await statisticsAggregator.getStatistics(userId);

    // Combine progress tracker snapshot with aggregated stats
    const stats = {
      totalReviews: aggregatedStats.totalReviews,
      currentStreak: snapshot.streak,
      overallAccuracy: aggregatedStats.overallAccuracy,
      avgResponseTime: aggregatedStats.avgResponseTime,
      hiraganaProgress: categories.get('hiragana')?.percentage || 0,
      katakanaProgress: categories.get('katakana')?.percentage || 0,
      kanjiLearned: categories.get('kanji')?.learnedItems || 0,
      vocabularyProgress: categories.get('vocabulary')?.percentage || 0,
      grammarProgress: categories.get('grammar')?.percentage || 0,
      lastSessionTime: aggregatedStats.lastActivity?.getTime() || Date.now(),
      weekendSessions: aggregatedStats.weekendSessions,
      comebackAfterBreak: aggregatedStats.daysSinceLastActivity >= 7,
      // Additional stats from aggregator
      speedRun50: aggregatedStats.speedRun50,
      speedRun50Time: aggregatedStats.speedRun50Time,
      sessionAccuracy: aggregatedStats.overallAccuracy,
      perfectSessions: aggregatedStats.perfectSessions,
      nightOwlSessions: aggregatedStats.nightOwlSessions,
      earlyBirdSessions: aggregatedStats.earlyBirdSessions
    };

    return stats;
  }
  
  // Note: These methods are no longer needed as we use statisticsAggregator
  // Keeping them for backwards compatibility but they now delegate to aggregator

  /**
   * @deprecated Use statisticsAggregator.getStatistics() instead
   */
  private async getTotalReviews(): Promise<number> {
    const stats = await statisticsAggregator.getStatistics(this.userAchievements.userId);
    return stats.totalReviews;
  }

  /**
   * @deprecated Use statisticsAggregator.getStatistics() instead
   */
  private async getOverallAccuracy(): Promise<number> {
    const stats = await statisticsAggregator.getStatistics(this.userAchievements.userId);
    return stats.overallAccuracy;
  }

  /**
   * @deprecated Use statisticsAggregator.getStatistics() instead
   */
  private async getAverageResponseTime(): Promise<number> {
    const stats = await statisticsAggregator.getStatistics(this.userAchievements.userId);
    return stats.avgResponseTime;
  }

  /**
   * @deprecated Use statisticsAggregator.getStatistics() instead
   */
  private async getWeekendSessions(): Promise<number> {
    const stats = await statisticsAggregator.getStatistics(this.userAchievements.userId);
    return stats.weekendSessions;
  }

  /**
   * @deprecated Use statisticsAggregator.getStatistics() instead
   */
  private async checkComebackStatus(): Promise<boolean> {
    const stats = await statisticsAggregator.getStatistics(this.userAchievements.userId);
    return stats.daysSinceLastActivity >= 7;
  }
  
  /**
   * Update user statistics
   */
  private updateStatistics(): void {
    const stats = this.userAchievements.statistics;
    
    stats.unlockedCount = this.userAchievements.unlocked.size;
    stats.percentageComplete = (stats.unlockedCount / stats.totalAchievements) * 100;
    
    // Update category counts
    stats.byCategory.clear();
    stats.byRarity.clear();
    
    for (const id of this.userAchievements.unlocked) {
      const achievement = this.achievements.get(id);
      if (!achievement) continue;
      
      // By category
      const categoryCount = stats.byCategory.get(achievement.category) || 0;
      stats.byCategory.set(achievement.category, categoryCount + 1);
      
      // By rarity
      const rarityCount = stats.byRarity.get(achievement.rarity) || 0;
      stats.byRarity.set(achievement.rarity, rarityCount + 1);
    }
  }
  
  /**
   * Show unlock notification
   */
  private showUnlockNotification(achievement: Achievement): void {
    this.emit('notification.show', {
      type: 'achievement',
      title: 'Achievement Unlocked!',
      message: `${achievement.icon} ${achievement.name}`,
      description: achievement.description,
      points: `+${achievement.points} points`,
      rarity: achievement.rarity,
      duration: 5000
    });
  }
  
  /**
   * Get user achievements
   */
  getUserAchievements(): UserAchievements {
    return this.userAchievements;
  }
  
  /**
   * Get all achievements
   */
  getAllAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }
  
  /**
   * Get achievement by ID
   */
  getAchievement(id: string): Achievement | undefined {
    return this.achievements.get(id);
  }
  
  /**
   * Get achievements by category
   */
  getAchievementsByCategory(category: string): Achievement[] {
    return Array.from(this.achievements.values())
      .filter(a => a.category === category);
  }
  
  /**
   * Get achievements by rarity
   */
  getAchievementsByRarity(rarity: string): Achievement[] {
    return Array.from(this.achievements.values())
      .filter(a => a.rarity === rarity);
  }
  
  /**
   * Get next achievable achievements
   */
  getNextAchievable(limit: number = 5): Achievement[] {
    const achievable: Achievement[] = [];
    
    for (const [id, achievement] of this.achievements) {
      if (this.userAchievements.unlocked.has(id)) continue;
      
      if (achievement.progress && achievement.maxProgress) {
        const percentage = (achievement.progress / achievement.maxProgress) * 100;
        if (percentage >= 50) {
          achievable.push(achievement);
        }
      }
    }
    
    // Sort by progress percentage
    achievable.sort((a, b) => {
      const aPercent = (a.progress! / a.maxProgress!) * 100;
      const bPercent = (b.progress! / b.maxProgress!) * 100;
      return bPercent - aPercent;
    });
    
    return achievable.slice(0, limit);
  }
  
  /**
   * Save user achievements to storage
   */
  private saveUserAchievements(): void {
    const serialized = {
      userId: this.userAchievements.userId,
      unlocked: Array.from(this.userAchievements.unlocked),
      totalPoints: this.userAchievements.totalPoints,
      recentUnlocks: this.userAchievements.recentUnlocks.map(a => a.id),
      timestamp: Date.now()
    };
    
    localStorage.setItem(`achievements_${this.userAchievements.userId}`, JSON.stringify(serialized));
  }
  
  /**
   * Load user achievements from storage
   */
  private loadUserAchievements(): void {
    const saved = localStorage.getItem(`achievements_${this.userAchievements.userId}`);
    if (!saved) return;
    
    try {
      const parsed = JSON.parse(saved);
      
      this.userAchievements.unlocked = new Set(parsed.unlocked || []);
      this.userAchievements.totalPoints = parsed.totalPoints || 0;

      // Restore recent unlocks (with safety check)
      this.userAchievements.recentUnlocks = (parsed.recentUnlocks || [])
        .map((id: string) => this.achievements.get(id))
        .filter(Boolean) as Achievement[];
      
      this.updateStatistics();
    } catch (error) {
      reviewLogger.error('Failed to load achievements:', error);
    }
  }
  
  /**
   * Reset achievements (for testing)
   */
  resetAchievements(): void {
    this.userAchievements = this.initializeUserAchievements(this.userAchievements.userId);
    this.saveUserAchievements();
    
    this.emit('achievements.reset', {
      timestamp: Date.now()
    });
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.saveUserAchievements();
    this.removeAllListeners();
    this.achievements.clear();
    this.checkQueue.clear();
  }
}