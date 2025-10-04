# Module 7: Progress Integration

**Status**: 🔴 Not Started  
**Priority**: MEDIUM  
**Owner**: Agent 7  
**Dependencies**: Session Management (Module 3)  
**Estimated Time**: 3-4 hours  

## Overview
Integrate the review engine with the existing progress tracking system, updating the LearningVillage stall progress bars, triggering achievements, and maintaining user statistics across the application.

## Deliverables

### 1. Progress Event Emitter

```typescript
// lib/review-engine/progress/event-emitter.ts

import { EventEmitter } from 'events';
import { SessionStatistics, ReviewEvent, ReviewEventType } from '../core/interfaces';

export interface ProgressUpdate {
  contentType: string;
  learned: number;
  learning: number;
  notStarted: number;
  totalReviewed: number;
  accuracy: number;
  timeSpent: number;
  lastActivity: Date;
}

export interface StallProgress {
  stallId: string;
  progress: number; // 0-100
  itemsCompleted: number;
  totalItems: number;
  level: 'beginner' | 'intermediate' | 'advanced' | 'master';
  nextMilestone: number;
}

export class ProgressEventEmitter extends EventEmitter {
  private static instance: ProgressEventEmitter;
  
  static getInstance(): ProgressEventEmitter {
    if (!this.instance) {
      this.instance = new ProgressEventEmitter();
    }
    return this.instance;
  }
  
  emitProgressUpdate(update: ProgressUpdate) {
    this.emit('progress:updated', update);
  }
  
  emitStallProgress(progress: StallProgress) {
    this.emit('stall:progress', progress);
  }
  
  emitAchievement(achievement: Achievement) {
    this.emit('achievement:unlocked', achievement);
  }
  
  emitMilestone(milestone: Milestone) {
    this.emit('milestone:reached', milestone);
  }
  
  emitStreak(streak: StreakData) {
    this.emit('streak:updated', streak);
  }
}
```

### 2. Progress Tracker

```typescript
// lib/review-engine/progress/tracker.ts

export class ProgressTracker {
  private emitter: ProgressEventEmitter;
  private storage: ProgressStorage;
  
  constructor() {
    this.emitter = ProgressEventEmitter.getInstance();
    this.storage = new ProgressStorage();
  }
  
  async trackSessionComplete(
    userId: string,
    statistics: SessionStatistics,
    items: ReviewSessionItem[]
  ): Promise<void> {
    // Calculate progress updates
    const progressByType = this.groupByContentType(items);
    
    for (const [contentType, typeItems] of progressByType.entries()) {
      const update = await this.calculateProgress(userId, contentType, typeItems);
      
      // Update storage
      await this.storage.updateProgress(userId, contentType, update);
      
      // Emit progress event
      this.emitter.emitProgressUpdate(update);
      
      // Update stall progress
      const stallProgress = await this.updateStallProgress(userId, contentType, update);
      if (stallProgress) {
        this.emitter.emitStallProgress(stallProgress);
      }
    }
    
    // Check for achievements
    await this.checkAchievements(userId, statistics);
    
    // Update streaks
    await this.updateStreaks(userId);
    
    // Check for milestones
    await this.checkMilestones(userId, statistics);
  }
  
  private async calculateProgress(
    userId: string,
    contentType: string,
    items: ReviewSessionItem[]
  ): Promise<ProgressUpdate> {
    const existing = await this.storage.getProgress(userId, contentType);
    
    const learned = items.filter(i => 
      i.correct && i.content.metadata?.status === 'mastered'
    ).length;
    
    const learning = items.filter(i => 
      i.content.metadata?.status === 'learning'
    ).length;
    
    const totalReviewed = existing.totalReviewed + items.length;
    const correctItems = items.filter(i => i.correct).length;
    const accuracy = (correctItems / items.length) * 100;
    const timeSpent = items.reduce((sum, i) => sum + (i.responseTime || 0), 0);
    
    return {
      contentType,
      learned: existing.learned + learned,
      learning: existing.learning + learning,
      notStarted: existing.notStarted - (learned + learning),
      totalReviewed,
      accuracy: (existing.accuracy * existing.totalReviewed + accuracy * items.length) / totalReviewed,
      timeSpent: existing.timeSpent + timeSpent,
      lastActivity: new Date()
    };
  }
  
  private async updateStallProgress(
    userId: string,
    contentType: string,
    update: ProgressUpdate
  ): Promise<StallProgress | null> {
    // Map content type to stall ID
    const stallMapping: Record<string, string> = {
      'kana': 'hiragana',
      'hiragana': 'hiragana',
      'katakana': 'katakana',
      'kanji': 'kanji',
      'vocabulary': 'vocabulary',
      'sentence': 'grammar',
      'grammar': 'grammar',
      'listening': 'listening'
    };
    
    const stallId = stallMapping[contentType];
    if (!stallId) return null;
    
    // Calculate progress percentage
    const total = update.learned + update.learning + update.notStarted;
    const progress = total > 0 ? Math.round((update.learned / total) * 100) : 0;
    
    // Determine level
    let level: StallProgress['level'] = 'beginner';
    if (progress >= 80) level = 'master';
    else if (progress >= 60) level = 'advanced';
    else if (progress >= 30) level = 'intermediate';
    
    // Calculate next milestone
    const milestones = [10, 25, 50, 75, 90, 100];
    const nextMilestone = milestones.find(m => m > progress) || 100;
    
    const stallProgress: StallProgress = {
      stallId,
      progress,
      itemsCompleted: update.learned,
      totalItems: total,
      level,
      nextMilestone
    };
    
    // Update LearningVillage component state
    await this.updateLearningVillageUI(stallProgress);
    
    return stallProgress;
  }
  
  private async updateLearningVillageUI(progress: StallProgress): Promise<void> {
    // This would integrate with the LearningVillage component
    // Using a global store or context
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('stallProgressUpdate', {
        detail: progress
      }));
    }
  }
}
```

### 3. Achievement System

```typescript
// lib/review-engine/progress/achievements.ts

export interface Achievement {
  id: string;
  type: 'milestone' | 'streak' | 'mastery' | 'speed' | 'accuracy' | 'special';
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  unlockedAt?: Date;
  progress?: number; // For progressive achievements
  maxProgress?: number;
}

export class AchievementManager {
  private achievements: Map<string, Achievement> = new Map();
  
  constructor() {
    this.registerAchievements();
  }
  
  private registerAchievements() {
    // Milestone achievements
    this.register({
      id: 'first_review',
      type: 'milestone',
      title: 'First Steps',
      description: 'Complete your first review session',
      icon: '👶',
      rarity: 'common',
      points: 10
    });
    
    this.register({
      id: 'hundred_reviews',
      type: 'milestone',
      title: 'Century',
      description: 'Complete 100 review items',
      icon: '💯',
      rarity: 'rare',
      points: 50
    });
    
    // Streak achievements
    this.register({
      id: 'week_streak',
      type: 'streak',
      title: 'Week Warrior',
      description: 'Maintain a 7-day review streak',
      icon: '🔥',
      rarity: 'rare',
      points: 30
    });
    
    this.register({
      id: 'month_streak',
      type: 'streak',
      title: 'Dedicated Learner',
      description: 'Maintain a 30-day review streak',
      icon: '🏆',
      rarity: 'epic',
      points: 100
    });
    
    // Mastery achievements
    this.register({
      id: 'hiragana_master',
      type: 'mastery',
      title: 'Hiragana Master',
      description: 'Master all hiragana characters',
      icon: '🎌',
      rarity: 'epic',
      points: 75
    });
    
    this.register({
      id: 'kanji_100',
      type: 'mastery',
      title: 'Kanji Centurion',
      description: 'Master 100 kanji characters',
      icon: '🈷️',
      rarity: 'epic',
      points: 100
    });
    
    // Speed achievements
    this.register({
      id: 'speed_demon',
      type: 'speed',
      title: 'Speed Demon',
      description: 'Answer 10 items correctly in under 30 seconds',
      icon: '⚡',
      rarity: 'rare',
      points: 40
    });
    
    // Accuracy achievements
    this.register({
      id: 'perfect_session',
      type: 'accuracy',
      title: 'Perfectionist',
      description: 'Complete a session with 100% accuracy (min 20 items)',
      icon: '✨',
      rarity: 'rare',
      points: 35
    });
    
    this.register({
      id: 'accuracy_master',
      type: 'accuracy',
      title: 'Precision Master',
      description: 'Maintain 95% accuracy over 500 items',
      icon: '🎯',
      rarity: 'legendary',
      points: 150
    });
  }
  
  private register(achievement: Achievement) {
    this.achievements.set(achievement.id, achievement);
  }
  
  async checkAchievements(
    userId: string,
    statistics: SessionStatistics,
    userStats: UserStatistics
  ): Promise<Achievement[]> {
    const unlocked: Achievement[] = [];
    
    // Check milestone achievements
    if (userStats.totalReviews === 1) {
      unlocked.push(await this.unlock(userId, 'first_review'));
    }
    
    if (userStats.totalReviews >= 100 && !await this.isUnlocked(userId, 'hundred_reviews')) {
      unlocked.push(await this.unlock(userId, 'hundred_reviews'));
    }
    
    // Check streak achievements
    if (userStats.currentStreak >= 7 && !await this.isUnlocked(userId, 'week_streak')) {
      unlocked.push(await this.unlock(userId, 'week_streak'));
    }
    
    if (userStats.currentStreak >= 30 && !await this.isUnlocked(userId, 'month_streak')) {
      unlocked.push(await this.unlock(userId, 'month_streak'));
    }
    
    // Check session achievements
    if (statistics.accuracy === 100 && statistics.totalItems >= 20) {
      unlocked.push(await this.unlock(userId, 'perfect_session'));
    }
    
    // Check speed achievements
    const fastItems = statistics.items?.filter(i => 
      i.correct && i.responseTime < 3000
    ).length || 0;
    
    if (fastItems >= 10 && !await this.isUnlocked(userId, 'speed_demon')) {
      unlocked.push(await this.unlock(userId, 'speed_demon'));
    }
    
    return unlocked;
  }
  
  private async unlock(userId: string, achievementId: string): Promise<Achievement> {
    const achievement = this.achievements.get(achievementId)!;
    achievement.unlockedAt = new Date();
    
    // Save to database
    await this.saveUnlock(userId, achievement);
    
    // Trigger notification
    this.showAchievementNotification(achievement);
    
    return achievement;
  }
  
  private showAchievementNotification(achievement: Achievement) {
    // This would show a toast or modal
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('achievementUnlocked', {
        detail: achievement
      }));
    }
  }
}
```

### 4. Statistics Aggregator

```typescript
// lib/review-engine/progress/statistics.ts

export class StatisticsAggregator {
  async aggregateUserStats(userId: string): Promise<UserStatistics> {
    const sessions = await this.getRecentSessions(userId, 30); // Last 30 days
    
    const totalItems = sessions.reduce((sum, s) => sum + s.totalItems, 0);
    const correctItems = sessions.reduce((sum, s) => sum + s.correctItems, 0);
    const totalTime = sessions.reduce((sum, s) => sum + s.totalTime, 0);
    
    // Group by content type
    const byContentType = new Map<string, ContentTypeStats>();
    
    for (const session of sessions) {
      for (const item of session.items) {
        const type = item.content.contentType;
        const stats = byContentType.get(type) || {
          total: 0,
          correct: 0,
          timeSpent: 0,
          mastered: 0
        };
        
        stats.total++;
        if (item.correct) stats.correct++;
        stats.timeSpent += item.responseTime || 0;
        if (item.content.metadata?.status === 'mastered') stats.mastered++;
        
        byContentType.set(type, stats);
      }
    }
    
    // Calculate learning velocity
    const learningVelocity = this.calculateLearningVelocity(sessions);
    
    // Predict next milestone
    const nextMilestone = this.predictNextMilestone(userId, learningVelocity);
    
    return {
      userId,
      totalReviews: totalItems,
      correctReviews: correctItems,
      accuracy: totalItems > 0 ? (correctItems / totalItems) * 100 : 0,
      totalTimeSpent: totalTime,
      avgTimePerItem: totalItems > 0 ? totalTime / totalItems : 0,
      contentTypeStats: Object.fromEntries(byContentType),
      learningVelocity,
      nextMilestone,
      lastActivity: sessions[0]?.endedAt || new Date()
    };
  }
  
  private calculateLearningVelocity(sessions: ReviewSession[]): number {
    if (sessions.length < 2) return 0;
    
    // Items mastered per day
    const days = (sessions[0].endedAt.getTime() - sessions[sessions.length - 1].startedAt.getTime()) 
      / (1000 * 60 * 60 * 24);
    
    const mastered = sessions.reduce((sum, s) => 
      sum + s.items.filter(i => i.content.metadata?.status === 'mastered').length, 0
    );
    
    return days > 0 ? mastered / days : 0;
  }
  
  private predictNextMilestone(userId: string, velocity: number): Milestone {
    // Based on current velocity, predict when user will reach next milestone
    // Implementation details...
    
    return {
      type: 'mastery',
      target: 'Master 50 kanji',
      estimatedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      progress: 35,
      total: 50
    };
  }
}
```

### 5. Integration Hooks

```typescript
// hooks/useProgressIntegration.ts

export function useProgressIntegration() {
  const [stallProgress, setStallProgress] = useState<Record<string, StallProgress>>({});
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userStats, setUserStats] = useState<UserStatistics | null>(null);
  
  useEffect(() => {
    const emitter = ProgressEventEmitter.getInstance();
    
    // Subscribe to progress updates
    const handleProgressUpdate = (update: ProgressUpdate) => {
      // Update local state or global store
      console.log('Progress updated:', update);
    };
    
    const handleStallProgress = (progress: StallProgress) => {
      setStallProgress(prev => ({
        ...prev,
        [progress.stallId]: progress
      }));
    };
    
    const handleAchievement = (achievement: Achievement) => {
      setAchievements(prev => [...prev, achievement]);
      
      // Show notification
      showAchievementNotification(achievement);
    };
    
    emitter.on('progress:updated', handleProgressUpdate);
    emitter.on('stall:progress', handleStallProgress);
    emitter.on('achievement:unlocked', handleAchievement);
    
    // Listen for custom window events
    window.addEventListener('stallProgressUpdate', handleStallProgress);
    window.addEventListener('achievementUnlocked', handleAchievement);
    
    return () => {
      emitter.off('progress:updated', handleProgressUpdate);
      emitter.off('stall:progress', handleStallProgress);
      emitter.off('achievement:unlocked', handleAchievement);
      
      window.removeEventListener('stallProgressUpdate', handleStallProgress);
      window.removeEventListener('achievementUnlocked', handleAchievement);
    };
  }, []);
  
  return {
    stallProgress,
    achievements,
    userStats,
    refreshStats: async () => {
      const aggregator = new StatisticsAggregator();
      const stats = await aggregator.aggregateUserStats(userId);
      setUserStats(stats);
    }
  };
}
```

## Testing Requirements

```typescript
describe('Progress Integration', () => {
  describe('Progress Tracker', () => {
    it('should calculate progress correctly');
    it('should update stall progress');
    it('should emit progress events');
  });
  
  describe('Achievement System', () => {
    it('should unlock achievements on conditions');
    it('should not unlock same achievement twice');
    it('should calculate progressive achievements');
  });
  
  describe('Statistics Aggregator', () => {
    it('should aggregate stats correctly');
    it('should calculate learning velocity');
    it('should predict milestones');
  });
});
```

## Acceptance Criteria

- [ ] Real-time progress updates to LearningVillage
- [ ] Achievement notifications working
- [ ] Streak tracking accurate
- [ ] Statistics aggregation correct
- [ ] Milestone predictions reasonable
- [ ] Integration with existing UI smooth
- [ ] 85% test coverage