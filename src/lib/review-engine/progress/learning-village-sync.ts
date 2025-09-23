/**
 * LearningVillage Synchronization
 * Syncs review progress with the stalls in LearningVillage
 */

import { ProgressTracker, CategoryProgress } from './progress-tracker';
import { EventEmitter } from 'events';
import { reviewLogger } from '@/lib/monitoring/logger';
import { UserStorageService } from '@/lib/storage/UserStorageService';

export interface StallConfig {
  id: string;
  name: string;
  icon: string;
  contentTypes: string[];
  totalItems: number;
  requiredForUnlock?: number;
  dependencies?: string[];
}

export interface StallProgress {
  stallId: string;
  percentage: number;
  learnedItems: number;
  totalItems: number;
  isUnlocked: boolean;
  lastUpdated: number;
}

export interface VillageState {
  stalls: Map<string, StallProgress>;
  overallProgress: number;
  unlockedStalls: Set<string>;
  nextUnlock?: string;
}

export class LearningVillageSync extends EventEmitter {
  private progressTracker: ProgressTracker;
  private stallConfigs: Map<string, StallConfig> = new Map();
  private stallProgress: Map<string, StallProgress> = new Map();
  private syncInterval: number | null = null;
  private storage: UserStorageService | null = null;
  private userId: string | null = null;

  constructor(progressTracker: ProgressTracker, userId?: string) {
    super();
    this.progressTracker = progressTracker;
    this.userId = userId || null;
    if (this.userId) {
      this.storage = new UserStorageService(this.userId);
    }
    this.initializeStalls();
    this.setupEventListeners();
  }
  
  /**
   * Initialize stall configurations
   */
  private initializeStalls(): void {
    // Define stall configurations matching LearningVillage
    const stalls: StallConfig[] = [
      {
        id: 'hiragana-stall',
        name: 'Hiragana Stall',
        icon: '🎌',
        contentTypes: ['hiragana'],
        totalItems: 46,
        requiredForUnlock: 0
      },
      {
        id: 'katakana-stall',
        name: 'Katakana Stall',
        icon: '🗾',
        contentTypes: ['katakana'],
        totalItems: 46,
        requiredForUnlock: 30,
        dependencies: ['hiragana-stall']
      },
      {
        id: 'kanji-basics-stall',
        name: 'Basic Kanji Stall',
        icon: '🈷',
        contentTypes: ['kanji-n5', 'kanji-basics'],
        totalItems: 100,
        requiredForUnlock: 50,
        dependencies: ['hiragana-stall', 'katakana-stall']
      },
      {
        id: 'vocabulary-stall',
        name: 'Vocabulary Stall',
        icon: '📚',
        contentTypes: ['vocabulary', 'vocab-n5'],
        totalItems: 500,
        requiredForUnlock: 40,
        dependencies: ['hiragana-stall']
      },
      {
        id: 'grammar-stall',
        name: 'Grammar Stall',
        icon: '📝',
        contentTypes: ['grammar', 'grammar-n5'],
        totalItems: 50,
        requiredForUnlock: 60,
        dependencies: ['vocabulary-stall']
      },
      {
        id: 'listening-stall',
        name: 'Listening Stall',
        icon: '🎧',
        contentTypes: ['listening', 'audio'],
        totalItems: 100,
        requiredForUnlock: 40,
        dependencies: ['hiragana-stall', 'katakana-stall']
      },
      {
        id: 'conversation-stall',
        name: 'Conversation Stall',
        icon: '💬',
        contentTypes: ['conversation', 'phrases'],
        totalItems: 200,
        requiredForUnlock: 70,
        dependencies: ['vocabulary-stall', 'grammar-stall']
      },
      {
        id: 'culture-stall',
        name: 'Culture Stall',
        icon: '🏯',
        contentTypes: ['culture', 'traditions'],
        totalItems: 50,
        requiredForUnlock: 20,
        dependencies: []
      }
    ];
    
    for (const stall of stalls) {
      this.stallConfigs.set(stall.id, stall);
      
      // Initialize progress
      this.stallProgress.set(stall.id, {
        stallId: stall.id,
        percentage: 0,
        learnedItems: 0,
        totalItems: stall.totalItems,
        isUnlocked: stall.requiredForUnlock === 0,
        lastUpdated: Date.now()
      });
    }
  }
  
  /**
   * Setup event listeners for progress updates
   */
  private setupEventListeners(): void {
    // Listen for category progress updates
    this.progressTracker.on('category.progress.updated', (category: CategoryProgress) => {
      this.updateStallProgress(category);
    });
    
    // Listen for milestones
    this.progressTracker.on('category.milestone.reached', (data: any) => {
      this.checkUnlocks();
    });
  }
  
  /**
   * Update stall progress based on category updates
   */
  private updateStallProgress(categoryProgress: CategoryProgress): void {
    // Find stalls that include this content type
    for (const [stallId, config] of this.stallConfigs) {
      if (config.contentTypes.includes(categoryProgress.category)) {
        const currentProgress = this.stallProgress.get(stallId);
        if (!currentProgress) continue;
        
        // Calculate combined progress for stalls with multiple content types
        const allCategories = config.contentTypes.map(type => 
          this.progressTracker.getCategoryProgress(type)
        ).filter(Boolean) as CategoryProgress[];
        
        if (allCategories.length === 0) continue;
        
        const totalLearned = allCategories.reduce((sum, cat) => sum + cat.learnedItems, 0);
        const totalItems = allCategories.reduce((sum, cat) => sum + cat.totalItems, 0);
        const percentage = totalItems > 0 ? Math.round((totalLearned / totalItems) * 100) : 0;
        
        const updatedProgress: StallProgress = {
          ...currentProgress,
          percentage,
          learnedItems: totalLearned,
          totalItems,
          lastUpdated: Date.now()
        };
        
        this.stallProgress.set(stallId, updatedProgress);
        
        // Emit update event
        this.emit('stall.progress.updated', {
          stallId,
          progress: updatedProgress
        });
        
        // Check if this unlocks new stalls
        this.checkUnlocks();
        
        // Update UI if needed
        this.notifyUI(stallId, updatedProgress);
      }
    }
  }
  
  /**
   * Check and update stall unlocks
   */
  private checkUnlocks(): void {
    const unlockedBefore = new Set(
      Array.from(this.stallProgress.values())
        .filter(p => p.isUnlocked)
        .map(p => p.stallId)
    );
    
    for (const [stallId, config] of this.stallConfigs) {
      const progress = this.stallProgress.get(stallId);
      if (!progress || progress.isUnlocked) continue;
      
      // Check if dependencies are met
      const dependenciesMet = this.checkDependencies(config);
      
      // Check if progress requirement is met
      const progressMet = this.checkProgressRequirement(config);
      
      if (dependenciesMet && progressMet) {
        progress.isUnlocked = true;
        this.stallProgress.set(stallId, progress);
        
        // Emit unlock event
        this.emit('stall.unlocked', {
          stallId,
          stallName: config.name,
          timestamp: Date.now()
        });
        
        // Show celebration animation
        this.celebrateUnlock(stallId, config);
      }
    }
    
    const unlockedAfter = new Set(
      Array.from(this.stallProgress.values())
        .filter(p => p.isUnlocked)
        .map(p => p.stallId)
    );
    
    // Check if any new stalls were unlocked
    const newUnlocks = Array.from(unlockedAfter).filter(id => !unlockedBefore.has(id));
    
    if (newUnlocks.length > 0) {
      this.emit('new.stalls.unlocked', {
        stalls: newUnlocks,
        count: newUnlocks.length
      });
    }
  }
  
  /**
   * Check if dependencies for a stall are met
   */
  private checkDependencies(config: StallConfig): boolean {
    if (!config.dependencies || config.dependencies.length === 0) {
      return true;
    }
    
    for (const depId of config.dependencies) {
      const depProgress = this.stallProgress.get(depId);
      if (!depProgress || depProgress.percentage < (config.requiredForUnlock || 0)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check if progress requirement is met
   */
  private checkProgressRequirement(config: StallConfig): boolean {
    if (!config.requiredForUnlock || config.requiredForUnlock === 0) {
      return true;
    }
    
    // Check overall progress or specific dependency progress
    if (config.dependencies && config.dependencies.length > 0) {
      const depProgresses = config.dependencies.map(id => 
        this.stallProgress.get(id)?.percentage || 0
      );
      
      const avgProgress = depProgresses.reduce((sum, p) => sum + p, 0) / depProgresses.length;
      return avgProgress >= config.requiredForUnlock;
    }
    
    return false;
  }
  
  /**
   * Get current village state
   */
  getVillageState(): VillageState {
    const unlockedStalls = new Set(
      Array.from(this.stallProgress.values())
        .filter(p => p.isUnlocked)
        .map(p => p.stallId)
    );
    
    // Calculate overall progress
    const allProgress = Array.from(this.stallProgress.values());
    const overallProgress = allProgress.length > 0
      ? allProgress.reduce((sum, p) => sum + p.percentage, 0) / allProgress.length
      : 0;
    
    // Find next stall to unlock
    const nextUnlock = this.findNextUnlock();
    
    return {
      stalls: new Map(this.stallProgress),
      overallProgress: Math.round(overallProgress),
      unlockedStalls,
      nextUnlock
    };
  }
  
  /**
   * Find the next stall that will be unlocked
   */
  private findNextUnlock(): string | undefined {
    let closestStall: { id: string; progress: number } | undefined;
    
    for (const [stallId, config] of this.stallConfigs) {
      const progress = this.stallProgress.get(stallId);
      if (!progress || progress.isUnlocked) continue;
      
      // Calculate how close this stall is to unlocking
      const depProgresses = (config.dependencies || []).map(id => 
        this.stallProgress.get(id)?.percentage || 0
      );
      
      const avgProgress = depProgresses.length > 0
        ? depProgresses.reduce((sum, p) => sum + p, 0) / depProgresses.length
        : 0;
      
      const progressNeeded = (config.requiredForUnlock || 0) - avgProgress;
      
      if (!closestStall || progressNeeded < closestStall.progress) {
        closestStall = { id: stallId, progress: progressNeeded };
      }
    }
    
    return closestStall?.id;
  }
  
  /**
   * Sync progress to LearningVillage UI
   */
  async syncToUI(): Promise<void> {
    const state = this.getVillageState();
    
    // Update localStorage for persistence
    this.saveToLocalStorage(state);
    
    // Emit sync event for UI components
    this.emit('village.synced', {
      state,
      timestamp: Date.now()
    });
    
    // Update progress bars in LearningVillage component
    for (const [stallId, progress] of state.stalls) {
      this.updateProgressBar(stallId, progress.percentage);
    }
  }
  
  /**
   * Update progress bar for a specific stall
   */
  private updateProgressBar(stallId: string, percentage: number): void {
    // This would interface with the actual DOM or React component
    // For now, emit an event that the UI can listen to
    this.emit('progress.bar.update', {
      stallId,
      percentage,
      animated: true
    });
  }
  
  /**
   * Notify UI of progress changes
   */
  private notifyUI(stallId: string, progress: StallProgress): void {
    // Emit event for UI to update
    this.emit('ui.update.required', {
      stallId,
      progress,
      type: 'progress'
    });
  }
  
  /**
   * Show celebration for stall unlock
   */
  private celebrateUnlock(stallId: string, config: StallConfig): void {
    this.emit('celebration.show', {
      stallId,
      stallName: config.name,
      icon: config.icon,
      message: `🎉 ${config.name} Unlocked!`,
      duration: 3000
    });
  }
  
  /**
   * Save state to user-specific storage
   */
  private saveToLocalStorage(state: VillageState): void {
    if (!this.storage) {
      reviewLogger.warn('Cannot save village state: no user storage available');
      return;
    }

    const serialized = {
      stalls: Array.from(state.stalls.entries()),
      overallProgress: state.overallProgress,
      unlockedStalls: Array.from(state.unlockedStalls),
      nextUnlock: state.nextUnlock,
      timestamp: Date.now()
    };

    this.storage.setItem('learningVillageState', serialized);
  }
  
  /**
   * Load state from user-specific storage
   */
  loadFromLocalStorage(): void {
    if (!this.storage) {
      reviewLogger.warn('Cannot load village state: no user storage available');
      return;
    }

    const saved = this.storage.getItem<any>('learningVillageState');
    if (!saved) return;

    try {
      const parsed = saved;
      
      // Restore stall progress
      for (const [stallId, progress] of parsed.stalls) {
        this.stallProgress.set(stallId, progress);
      }
      
      this.emit('state.restored', {
        timestamp: parsed.timestamp
      });
    } catch (error) {
      reviewLogger.error('Failed to load village state:', error);
    }
  }

  /**
   * Set or update the user ID for storage
   */
  setUserId(userId: string): void {
    this.userId = userId;
    this.storage = new UserStorageService(userId);
    // Reload state for new user
    this.loadFromLocalStorage();
  }
  
  /**
   * Start auto-sync interval
   */
  startAutoSync(intervalMs: number = 60000): void {
    if (this.syncInterval) return;
    
    this.syncInterval = window.setInterval(() => {
      this.syncToUI();
    }, intervalMs);
  }
  
  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAutoSync();
    this.removeAllListeners();
    this.stallConfigs.clear();
    this.stallProgress.clear();
  }
}