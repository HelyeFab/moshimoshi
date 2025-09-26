/**
 * MigrationManager - Handles data migration when users upgrade from free to premium
 * Automatically detects plan changes and syncs local decks to Firebase
 */

import type { FlashcardDeck } from '@/types/flashcards';
import { flashcardManager } from './FlashcardManager';
import { storageManager } from './StorageManager';

export interface MigrationProgress {
  total: number;
  completed: number;
  failed: number;
  currentDeck: string | null;
  status: 'idle' | 'preparing' | 'migrating' | 'completed' | 'failed';
  errors: string[];
}

export interface MigrationResult {
  success: boolean;
  totalDecks: number;
  syncedDecks: number;
  failedDecks: number;
  errors: string[];
  duration: number;
}

export class MigrationManager {
  private static instance: MigrationManager | null = null;
  private migrationInProgress: boolean = false;
  private lastKnownPlan: string | null = null;
  private progressCallbacks: Set<(progress: MigrationProgress) => void> = new Set();

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): MigrationManager {
    if (!MigrationManager.instance) {
      MigrationManager.instance = new MigrationManager();
    }
    return MigrationManager.instance;
  }

  /**
   * Check if user has upgraded and needs migration
   */
  async checkForUpgrade(userId: string, currentPlan: string): Promise<boolean> {
    // Skip if migration is already in progress
    if (this.migrationInProgress) {
      console.log('[MigrationManager] Migration already in progress');
      return false;
    }

    // Check if this is a plan upgrade
    const isUpgrade = this.isUpgradeDetected(currentPlan);

    if (isUpgrade) {
      console.log('[MigrationManager] Plan upgrade detected:', {
        from: this.lastKnownPlan,
        to: currentPlan
      });

      // Check if there are local decks to migrate
      const localDecks = await flashcardManager.getDecks(userId, false); // Get as free user
      if (localDecks.length > 0) {
        console.log(`[MigrationManager] Found ${localDecks.length} local decks to migrate`);
        return true;
      }
    }

    // Update last known plan
    this.lastKnownPlan = currentPlan;
    return false;
  }

  /**
   * Detect if user has upgraded to premium
   */
  private isUpgradeDetected(currentPlan: string): boolean {
    // First time checking
    if (!this.lastKnownPlan) {
      this.lastKnownPlan = currentPlan;
      return false;
    }

    // Check if upgraded from free to premium
    const wasFree = this.lastKnownPlan === 'free' || this.lastKnownPlan === 'guest';
    const isPremium = currentPlan === 'premium_monthly' || currentPlan === 'premium_yearly';

    return wasFree && isPremium;
  }

  /**
   * Perform bulk migration of all local decks to Firebase
   */
  async migrateAllDecks(userId: string): Promise<MigrationResult> {
    if (this.migrationInProgress) {
      throw new Error('Migration already in progress');
    }

    const startTime = Date.now();
    this.migrationInProgress = true;

    const progress: MigrationProgress = {
      total: 0,
      completed: 0,
      failed: 0,
      currentDeck: null,
      status: 'preparing',
      errors: []
    };

    try {
      // Emit initial progress
      this.emitProgress(progress);

      // Get all local decks
      const localDecks = await flashcardManager.getDecks(userId, false);
      progress.total = localDecks.length;
      progress.status = 'migrating';
      this.emitProgress(progress);

      console.log(`[MigrationManager] Starting migration of ${localDecks.length} decks`);

      // Migrate each deck
      for (const deck of localDecks) {
        progress.currentDeck = deck.name;
        this.emitProgress(progress);

        try {
          console.log(`[MigrationManager] Migrating deck: ${deck.name}`);

          // Sync deck to Firebase
          const success = await flashcardManager.syncDeckToFirebase(deck, userId);

          if (success) {
            progress.completed++;
            console.log(`[MigrationManager] Successfully migrated: ${deck.name}`);
          } else {
            progress.failed++;
            progress.errors.push(`Failed to sync deck: ${deck.name}`);
            console.error(`[MigrationManager] Failed to migrate: ${deck.name}`);
          }
        } catch (error: any) {
          progress.failed++;
          const errorMessage = `Error migrating ${deck.name}: ${error.message}`;
          progress.errors.push(errorMessage);
          console.error(`[MigrationManager] ${errorMessage}`);
        }

        this.emitProgress(progress);
      }

      // Mark migration as completed
      progress.status = progress.failed === 0 ? 'completed' : 'failed';
      progress.currentDeck = null;
      this.emitProgress(progress);

      const duration = Date.now() - startTime;

      const result: MigrationResult = {
        success: progress.failed === 0,
        totalDecks: progress.total,
        syncedDecks: progress.completed,
        failedDecks: progress.failed,
        errors: progress.errors,
        duration
      };

      console.log('[MigrationManager] Migration completed:', result);
      return result;

    } catch (error: any) {
      console.error('[MigrationManager] Migration failed:', error);

      progress.status = 'failed';
      progress.errors.push(`Migration failed: ${error.message}`);
      this.emitProgress(progress);

      return {
        success: false,
        totalDecks: progress.total,
        syncedDecks: progress.completed,
        failedDecks: progress.failed,
        errors: progress.errors,
        duration: Date.now() - startTime
      };
    } finally {
      this.migrationInProgress = false;
    }
  }

  /**
   * Sync a single deck to Firebase
   */
  async migrateSingleDeck(deck: FlashcardDeck, userId: string): Promise<boolean> {
    try {
      console.log(`[MigrationManager] Migrating single deck: ${deck.name}`);
      return await flashcardManager.syncDeckToFirebase(deck, userId);
    } catch (error) {
      console.error(`[MigrationManager] Failed to migrate deck ${deck.name}:`, error);
      return false;
    }
  }

  /**
   * Bulk export all decks for backup
   */
  async exportAllDecks(userId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    const decks = await flashcardManager.getDecks(userId, false);

    if (format === 'json') {
      return JSON.stringify({
        version: '1.0',
        exportDate: new Date().toISOString(),
        userId,
        deckCount: decks.length,
        decks: decks.map(deck => ({
          ...deck,
          // Remove sensitive data
          userId: undefined
        }))
      }, null, 2);
    } else {
      // CSV format - combine all decks
      let csv = 'Deck,Front,Back,Notes,Tags\n';

      for (const deck of decks) {
        for (const card of deck.cards) {
          const front = card.front.text.replace(/"/g, '""');
          const back = card.back.text.replace(/"/g, '""');
          const notes = (card.metadata?.notes || '').replace(/"/g, '""');
          const tags = (card.tags || []).join(';');

          csv += `"${deck.name}","${front}","${back}","${notes}","${tags}"\n`;
        }
      }

      return csv;
    }
  }

  /**
   * Import multiple decks from backup
   */
  async importBulkDecks(data: string, userId: string, isPremium: boolean): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let totalDecks = 0;
    let importedDecks = 0;

    try {
      const parsed = JSON.parse(data);

      if (!parsed.decks || !Array.isArray(parsed.decks)) {
        throw new Error('Invalid backup format');
      }

      totalDecks = parsed.decks.length;

      for (const deckData of parsed.decks) {
        try {
          // Create deck request
          const request = {
            name: deckData.name,
            description: deckData.description || '',
            emoji: deckData.emoji || '🎴',
            color: deckData.color || 'primary',
            cardStyle: deckData.cardStyle || 'minimal',
            settings: deckData.settings,
            initialCards: deckData.cards
          };

          const newDeck = await flashcardManager.createDeck(request, userId, isPremium);
          if (newDeck) {
            importedDecks++;
          } else {
            errors.push(`Failed to import deck: ${deckData.name}`);
          }
        } catch (error: any) {
          errors.push(`Error importing ${deckData.name}: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        totalDecks,
        syncedDecks: importedDecks,
        failedDecks: totalDecks - importedDecks,
        errors,
        duration: Date.now() - startTime
      };

    } catch (error: any) {
      return {
        success: false,
        totalDecks: 0,
        syncedDecks: 0,
        failedDecks: 0,
        errors: [`Import failed: ${error.message}`],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get storage analysis and recommendations
   */
  async analyzeStorage(userId: string): Promise<{
    localDecks: number;
    cloudDecks: number;
    storageUsed: string;
    recommendations: string[];
  }> {
    const localDecks = await flashcardManager.getDecks(userId, false);
    const storageInfo = await storageManager.getStorageInfo();
    const recommendations: string[] = [];

    // Calculate total size
    let totalSize = 0;
    for (const deck of localDecks) {
      totalSize += storageManager.calculateDeckSize(deck);
    }

    // Generate recommendations
    if (!storageInfo.persistent) {
      recommendations.push('Enable persistent storage to protect your local data');
    }

    if (storageInfo.percentage > 80) {
      recommendations.push('Storage usage is high. Consider upgrading to premium for cloud storage');
    }

    if (localDecks.length > 20) {
      recommendations.push('You have many decks. Premium users get unlimited cloud storage');
    }

    return {
      localDecks: localDecks.length,
      cloudDecks: 0, // This would need to be fetched from server
      storageUsed: storageManager.formatBytes(totalSize),
      recommendations
    };
  }

  /**
   * Register progress callback
   */
  onProgress(callback: (progress: MigrationProgress) => void): void {
    this.progressCallbacks.add(callback);
  }

  /**
   * Remove progress callback
   */
  offProgress(callback: (progress: MigrationProgress) => void): void {
    this.progressCallbacks.delete(callback);
  }

  /**
   * Emit progress to all listeners
   */
  private emitProgress(progress: MigrationProgress): void {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('[MigrationManager] Error in progress callback:', error);
      }
    });
  }

  /**
   * Check if migration is in progress
   */
  isMigrating(): boolean {
    return this.migrationInProgress;
  }

  /**
   * Reset migration state (for testing)
   */
  reset(): void {
    this.migrationInProgress = false;
    this.lastKnownPlan = null;
    this.progressCallbacks.clear();
  }
}

// Export singleton instance
export const migrationManager = MigrationManager.getInstance();