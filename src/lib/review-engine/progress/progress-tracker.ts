/**
 * Progress Tracker for review sessions
 * Manages progress updates and synchronization with LearningVillage
 */

import { EventEmitter } from 'events';

export interface ProgressData {
  contentId: string;
  contentType: string;
  learned: number; // 0-100 percentage
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  lastReviewed: number;
  nextReview?: number;
  srsLevel?: number;
  streak?: number;
}

export interface CategoryProgress {
  category: string;
  totalItems: number;
  learnedItems: number;
  percentage: number;
  lastUpdated: number;
  subCategories?: Map<string, CategoryProgress>;
}

export interface ProgressUpdate {
  contentId: string;
  delta: {
    learned?: number;
    reviewCount?: number;
    correctCount?: number;
    incorrectCount?: number;
  };
  timestamp: number;
}

export interface ProgressSnapshot {
  userId: string;
  timestamp: number;
  categories: Map<string, CategoryProgress>;
  totalProgress: number;
  streak: number;
  lastActivity: number;
}

export class ProgressTracker extends EventEmitter {
  private progressData: Map<string, ProgressData> = new Map();
  private categoryProgress: Map<string, CategoryProgress> = new Map();
  private pendingUpdates: ProgressUpdate[] = [];
  private userId: string;
  private autoSaveInterval: number | null = null;
  
  constructor(userId: string) {
    super();
    this.userId = userId;
  }
  
  /**
   * Initialize progress tracker with existing data
   */
  async initialize(existingProgress?: ProgressData[]): Promise<void> {
    if (existingProgress) {
      for (const progress of existingProgress) {
        this.progressData.set(progress.contentId, progress);
      }
    }
    
    this.calculateCategoryProgress();
    this.startAutoSave();
    
    this.emit('initialized', {
      itemCount: this.progressData.size,
      categories: Array.from(this.categoryProgress.keys())
    });
  }
  
  /**
   * Update progress for a specific content item
   */
  updateProgress(contentId: string, update: Partial<ProgressData>): void {
    const existing = this.progressData.get(contentId) || this.createDefaultProgress(contentId);
    
    const updated: ProgressData = {
      ...existing,
      ...update,
      lastReviewed: Date.now()
    };
    
    // Calculate learned percentage based on SRS level and accuracy
    if (update.correctCount !== undefined || update.incorrectCount !== undefined) {
      updated.learned = this.calculateLearnedPercentage(updated);
    }
    
    this.progressData.set(contentId, updated);
    
    // Queue update for batch processing
    this.queueUpdate({
      contentId,
      delta: {
        learned: updated.learned - existing.learned,
        reviewCount: (update.reviewCount || 0) - existing.reviewCount,
        correctCount: (update.correctCount || 0) - existing.correctCount,
        incorrectCount: (update.incorrectCount || 0) - existing.incorrectCount
      },
      timestamp: Date.now()
    });
    
    // Recalculate category progress
    this.updateCategoryProgress(updated.contentType);
    
    // Emit events
    this.emit('progress.updated', updated);
    
    // Check for milestones
    this.checkMilestones(updated);
  }
  
  /**
   * Batch update multiple items
   */
  batchUpdate(updates: Array<{ contentId: string; update: Partial<ProgressData> }>): void {
    const affectedCategories = new Set<string>();
    
    for (const { contentId, update } of updates) {
      const existing = this.progressData.get(contentId) || this.createDefaultProgress(contentId);
      
      const updated: ProgressData = {
        ...existing,
        ...update,
        lastReviewed: Date.now()
      };
      
      if (update.correctCount !== undefined || update.incorrectCount !== undefined) {
        updated.learned = this.calculateLearnedPercentage(updated);
      }
      
      this.progressData.set(contentId, updated);
      affectedCategories.add(updated.contentType);
    }
    
    // Update all affected categories
    for (const category of affectedCategories) {
      this.updateCategoryProgress(category);
    }
    
    this.emit('progress.batch-updated', {
      count: updates.length,
      categories: Array.from(affectedCategories)
    });
  }
  
  /**
   * Get progress for a specific content item
   */
  getProgress(contentId: string): ProgressData | undefined {
    return this.progressData.get(contentId);
  }
  
  /**
   * Get progress for a category
   */
  getCategoryProgress(category: string): CategoryProgress | undefined {
    return this.categoryProgress.get(category);
  }
  
  /**
   * Get overall progress snapshot
   */
  getSnapshot(): ProgressSnapshot {
    const totalItems = this.progressData.size;
    const learnedItems = Array.from(this.progressData.values())
      .filter(p => p.learned >= 80).length;
    
    const totalProgress = totalItems > 0 ? (learnedItems / totalItems) * 100 : 0;
    
    return {
      userId: this.userId,
      timestamp: Date.now(),
      categories: new Map(this.categoryProgress),
      totalProgress,
      streak: this.calculateStreak(),
      lastActivity: this.getLastActivity()
    };
  }
  
  /**
   * Get progress for LearningVillage stalls
   */
  getStallProgress(): Map<string, number> {
    const stallProgress = new Map<string, number>();
    
    // Map content types to stall names
    const contentTypeToStall: { [key: string]: string } = {
      'hiragana': 'hiragana',
      'katakana': 'katakana',
      'kanji': 'kanji',
      'vocabulary': 'vocabulary',
      'grammar': 'grammar',
      'listening': 'listening'
    };
    
    for (const [contentType, stallName] of Object.entries(contentTypeToStall)) {
      const category = this.categoryProgress.get(contentType);
      if (category) {
        stallProgress.set(stallName, category.percentage);
      }
    }
    
    return stallProgress;
  }
  
  /**
   * Calculate learned percentage based on review performance
   */
  private calculateLearnedPercentage(progress: ProgressData): number {
    const { correctCount, incorrectCount, srsLevel = 0 } = progress;
    const total = correctCount + incorrectCount;
    
    if (total === 0) return 0;
    
    const accuracy = correctCount / total;
    const srsBonus = Math.min(srsLevel * 10, 50); // Up to 50% bonus from SRS level
    
    // Base learned percentage on accuracy and SRS level
    const learned = Math.min(100, (accuracy * 50) + srsBonus);
    
    return Math.round(learned);
  }
  
  /**
   * Update category progress
   */
  private updateCategoryProgress(category: string): void {
    const items = Array.from(this.progressData.values())
      .filter(p => p.contentType === category);
    
    if (items.length === 0) return;
    
    const learnedItems = items.filter(p => p.learned >= 80).length;
    const percentage = Math.round((learnedItems / items.length) * 100);
    
    const categoryProgress: CategoryProgress = {
      category,
      totalItems: items.length,
      learnedItems,
      percentage,
      lastUpdated: Date.now()
    };
    
    this.categoryProgress.set(category, categoryProgress);
    
    this.emit('category.progress.updated', categoryProgress);
  }
  
  /**
   * Calculate all category progress
   */
  private calculateCategoryProgress(): void {
    const categories = new Map<string, ProgressData[]>();
    
    // Group by category
    for (const progress of this.progressData.values()) {
      const items = categories.get(progress.contentType) || [];
      items.push(progress);
      categories.set(progress.contentType, items);
    }
    
    // Calculate progress for each category
    for (const [category, items] of categories) {
      const learnedItems = items.filter(p => p.learned >= 80).length;
      const percentage = Math.round((learnedItems / items.length) * 100);
      
      this.categoryProgress.set(category, {
        category,
        totalItems: items.length,
        learnedItems,
        percentage,
        lastUpdated: Date.now()
      });
    }
  }
  
  /**
   * Check for milestone achievements
   */
  private checkMilestones(progress: ProgressData): void {
    const milestones = [
      { threshold: 25, name: 'quarter-complete' },
      { threshold: 50, name: 'half-complete' },
      { threshold: 75, name: 'three-quarters' },
      { threshold: 100, name: 'mastered' }
    ];
    
    for (const milestone of milestones) {
      if (progress.learned >= milestone.threshold && 
          progress.learned - (progress.learned % milestone.threshold) === milestone.threshold) {
        this.emit('milestone.reached', {
          contentId: progress.contentId,
          milestone: milestone.name,
          percentage: milestone.threshold
        });
      }
    }
    
    // Check category milestones
    const category = this.categoryProgress.get(progress.contentType);
    if (category) {
      for (const milestone of milestones) {
        if (category.percentage >= milestone.threshold &&
            category.percentage - (category.percentage % milestone.threshold) === milestone.threshold) {
          this.emit('category.milestone.reached', {
            category: progress.contentType,
            milestone: milestone.name,
            percentage: milestone.threshold
          });
        }
      }
    }
  }
  
  /**
   * Queue update for batch processing
   */
  private queueUpdate(update: ProgressUpdate): void {
    this.pendingUpdates.push(update);
    
    // Process immediately if queue is large
    if (this.pendingUpdates.length >= 10) {
      this.processPendingUpdates();
    }
  }
  
  /**
   * Process pending updates
   */
  private async processPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.length === 0) return;
    
    const updates = [...this.pendingUpdates];
    this.pendingUpdates = [];
    
    try {
      // Save to storage
      await this.saveProgress(updates);
      
      this.emit('progress.saved', {
        count: updates.length,
        timestamp: Date.now()
      });
    } catch (error) {
      // Re-queue failed updates
      this.pendingUpdates.unshift(...updates);
      
      this.emit('progress.save.error', error);
    }
  }
  
  /**
   * Save progress to storage
   */
  private async saveProgress(updates: ProgressUpdate[]): Promise<void> {
    // This will be implemented to save to localStorage/IndexedDB/API
    // For now, just simulate async save
    return new Promise((resolve) => {
      setTimeout(() => {
        // Save to localStorage as backup
        const progressArray = Array.from(this.progressData.values());
        localStorage.setItem(`progress_${this.userId}`, JSON.stringify(progressArray));
        resolve();
      }, 100);
    });
  }
  
  /**
   * Start auto-save interval
   */
  private startAutoSave(): void {
    if (this.autoSaveInterval) return;
    
    this.autoSaveInterval = window.setInterval(() => {
      this.processPendingUpdates();
    }, 30000); // Save every 30 seconds
  }
  
  /**
   * Stop auto-save interval
   */
  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    
    // Save any pending updates
    this.processPendingUpdates();
  }
  
  /**
   * Record daily activity (study or review)
   * This updates the streak by calling the API
   */
  async recordDailyActivity(sessionType: string = 'review'): Promise<void> {
    // Only works in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // Call the API to update activity and streak
      const response = await fetch('/api/achievements/update-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionType: sessionType,
          itemsReviewed: 0, // Will be updated by actual session stats
          accuracy: 0,
          duration: 0
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[ProgressTracker] Activity recorded - streak: ${data.currentStreak}`);

        // Also update localStorage for immediate access
        const today = new Date().toISOString().split('T')[0];
        const activities = JSON.parse(
          localStorage.getItem(`activities_${this.userId}`) || '{}'
        );
        activities[today] = true;
        localStorage.setItem(`activities_${this.userId}`, JSON.stringify(activities));
      }
    } catch (error) {
      console.error('[ProgressTracker] Failed to record activity:', error);

      // Fallback to localStorage only
      const today = new Date().toISOString().split('T')[0];
      const activities = JSON.parse(
        localStorage.getItem(`activities_${this.userId}`) || '{}'
      );
      activities[today] = true;
      localStorage.setItem(`activities_${this.userId}`, JSON.stringify(activities));
    }
  }

  /**
   * Calculate user's streak (includes both study and review activities)
   */
  private calculateStreak(): number {
    // Get review activities from progress data
    const reviewDays = new Set<string>();
    Array.from(this.progressData.values()).forEach(p => {
      if (p.lastReviewed) {
        const day = new Date(p.lastReviewed).toISOString().split('T')[0];
        reviewDays.add(day);
      }
    });

    // Get all daily activities (study sessions) - only in browser
    let dailyActivities: Record<string, boolean> = {};
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      dailyActivities = JSON.parse(
        localStorage.getItem(`activities_${this.userId}`) || '{}'
      );
    }

    // Merge both activity types
    const allActivityDays = new Set<string>([
      ...reviewDays,
      ...Object.keys(dailyActivities)
    ]);

    // If no activities at all, return 0
    if (allActivityDays.size === 0) return 0;

    // Calculate consecutive days
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let streak = 0;
    let currentDate = new Date(today);

    // Check consecutive days backwards from today
    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0];

      if (allActivityDays.has(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (streak === 0 && dateStr === todayStr) {
        // Today hasn't been done yet, check yesterday
        currentDate.setDate(currentDate.getDate() - 1);
        continue;
      } else {
        // Gap found or reached beginning of activities
        break;
      }
    }

    return streak;
  }
  
  /**
   * Get last activity timestamp
   */
  private getLastActivity(): number {
    let lastActivity = 0;
    
    for (const progress of this.progressData.values()) {
      if (progress.lastReviewed > lastActivity) {
        lastActivity = progress.lastReviewed;
      }
    }
    
    return lastActivity;
  }
  
  /**
   * Create default progress for new item
   */
  private createDefaultProgress(contentId: string): ProgressData {
    return {
      contentId,
      contentType: 'unknown',
      learned: 0,
      reviewCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      lastReviewed: Date.now()
    };
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAutoSave();
    this.removeAllListeners();
    this.progressData.clear();
    this.categoryProgress.clear();
    this.pendingUpdates = [];
  }
}