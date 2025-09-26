/**
 * StorageManager - Handles browser storage operations, quota monitoring, and persistence
 * Ensures data safety and provides user-friendly storage management
 */

export interface StorageInfo {
  usage: number;
  quota: number;
  percentage: number;
  persistent: boolean;
}

export interface StorageWarning {
  level: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  suggestion: string;
}

export class StorageManager {
  private static instance: StorageManager | null = null;
  private persistentStorage: boolean = false;
  private lastCheck: number = 0;
  private checkInterval = 60000; // Check every minute
  private warningCallbacks: Set<(warning: StorageWarning) => void> = new Set();

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * Initialize storage manager and request persistent storage
   */
  async initialize(): Promise<boolean> {
    try {
      // Request persistent storage
      this.persistentStorage = await this.requestPersistence();

      // Check initial quota
      const info = await this.getStorageInfo();
      this.checkStorageHealth(info);

      // Set up periodic checks
      this.startPeriodicChecks();

      return true;
    } catch (error) {
      console.error('[StorageManager] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Request persistent storage from the browser
   */
  async requestPersistence(): Promise<boolean> {
    if (!('storage' in navigator) || !('persist' in navigator.storage)) {
      console.warn('[StorageManager] Persistent storage API not available');
      return false;
    }

    try {
      const isPersisted = await navigator.storage.persisted();
      if (isPersisted) {
        console.log('[StorageManager] Storage is already persistent');
        return true;
      }

      const granted = await navigator.storage.persist();
      if (granted) {
        console.log('[StorageManager] Persistent storage granted');
      } else {
        console.warn('[StorageManager] Persistent storage denied');
      }
      return granted;
    } catch (error) {
      console.error('[StorageManager] Error requesting persistence:', error);
      return false;
    }
  }

  /**
   * Get current storage usage information
   */
  async getStorageInfo(): Promise<StorageInfo> {
    const defaultInfo: StorageInfo = {
      usage: 0,
      quota: 0,
      percentage: 0,
      persistent: this.persistentStorage
    };

    if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
      console.warn('[StorageManager] Storage estimate API not available');
      return defaultInfo;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota > 0 ? (usage / quota) * 100 : 0;

      return {
        usage,
        quota,
        percentage: Math.round(percentage * 100) / 100,
        persistent: this.persistentStorage
      };
    } catch (error) {
      console.error('[StorageManager] Error getting storage estimate:', error);
      return defaultInfo;
    }
  }

  /**
   * Check if there's enough space for new data
   */
  async hasEnoughSpace(bytesNeeded: number): Promise<boolean> {
    const info = await this.getStorageInfo();
    const availableSpace = info.quota - info.usage;

    // Leave 10% buffer
    const buffer = info.quota * 0.1;
    return availableSpace - buffer > bytesNeeded;
  }

  /**
   * Estimate size of data in bytes
   */
  estimateSize(data: any): number {
    const str = JSON.stringify(data);
    // Rough estimate: 1 character ≈ 2 bytes in UTF-16
    return str.length * 2;
  }

  /**
   * Check storage health and emit warnings
   */
  private checkStorageHealth(info: StorageInfo): void {
    let warning: StorageWarning | null = null;

    if (info.percentage >= 95) {
      warning = {
        level: 'critical',
        message: 'Storage is critically full (95%+)',
        suggestion: 'Delete unused decks immediately or export them for backup'
      };
    } else if (info.percentage >= 90) {
      warning = {
        level: 'high',
        message: 'Storage is almost full (90%+)',
        suggestion: 'Consider deleting old decks or exporting them'
      };
    } else if (info.percentage >= 80) {
      warning = {
        level: 'medium',
        message: 'Storage usage is high (80%+)',
        suggestion: 'Monitor your storage usage'
      };
    } else if (!info.persistent && info.percentage >= 50) {
      warning = {
        level: 'low',
        message: 'Storage is not persistent and usage is moderate',
        suggestion: 'Enable persistent storage to protect your data'
      };
    }

    if (warning) {
      this.emitWarning(warning);
    }
  }

  /**
   * Handle storage errors with user-friendly messages
   */
  handleStorageError(error: any): { message: string; suggestion: string; canRetry: boolean } {
    const errorName = error?.name || '';
    const errorMessage = error?.message || '';

    if (errorName === 'QuotaExceededError' || errorMessage.includes('quota')) {
      return {
        message: 'Storage quota exceeded. Your device is out of storage space.',
        suggestion: 'Free up space by deleting unused decks or exporting them for backup.',
        canRetry: false
      };
    }

    if (errorName === 'NotFoundError') {
      return {
        message: 'Storage database not found.',
        suggestion: 'Refresh the page to reinitialize storage.',
        canRetry: true
      };
    }

    if (errorName === 'InvalidStateError') {
      return {
        message: 'Storage is in an invalid state.',
        suggestion: 'Clear browser cache and try again.',
        canRetry: true
      };
    }

    if (errorName === 'AbortError') {
      return {
        message: 'Storage operation was interrupted.',
        suggestion: 'Try again. If the problem persists, restart your browser.',
        canRetry: true
      };
    }

    // Generic error
    return {
      message: 'An error occurred while accessing storage.',
      suggestion: 'Try again. If the problem persists, contact support.',
      canRetry: true
    };
  }

  /**
   * Get cleanup suggestions based on current usage
   */
  async getCleanupSuggestions(): Promise<string[]> {
    const suggestions: string[] = [];
    const info = await this.getStorageInfo();

    if (info.percentage >= 80) {
      suggestions.push('Export old decks you haven\'t used in the last 30 days');
      suggestions.push('Delete empty or test decks');
      suggestions.push('Remove duplicate cards from your decks');
    }

    if (info.percentage >= 90) {
      suggestions.push('Archive completed decks to cloud storage (Premium)');
      suggestions.push('Export all decks as backup and start fresh');
      suggestions.push('Consider upgrading to premium for cloud storage');
    }

    if (!info.persistent) {
      suggestions.push('Enable persistent storage to protect your data from browser cleanup');
    }

    return suggestions;
  }

  /**
   * Calculate storage size for a deck
   */
  calculateDeckSize(deck: any): number {
    // Include all deck data
    let size = this.estimateSize(deck);

    // Add extra for IndexedDB overhead (approximately 30%)
    size = Math.ceil(size * 1.3);

    return size;
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Start periodic storage checks
   */
  private startPeriodicChecks(): void {
    setInterval(async () => {
      const now = Date.now();
      if (now - this.lastCheck < this.checkInterval) {
        return;
      }

      this.lastCheck = now;
      const info = await this.getStorageInfo();
      this.checkStorageHealth(info);
    }, this.checkInterval);
  }

  /**
   * Register callback for storage warnings
   */
  onWarning(callback: (warning: StorageWarning) => void): void {
    this.warningCallbacks.add(callback);
  }

  /**
   * Remove warning callback
   */
  offWarning(callback: (warning: StorageWarning) => void): void {
    this.warningCallbacks.delete(callback);
  }

  /**
   * Emit warning to all registered callbacks
   */
  private emitWarning(warning: StorageWarning): void {
    this.warningCallbacks.forEach(callback => {
      try {
        callback(warning);
      } catch (error) {
        console.error('[StorageManager] Error in warning callback:', error);
      }
    });
  }

  /**
   * Clear all storage (with confirmation)
   */
  async clearAllStorage(): Promise<boolean> {
    try {
      // This should only be called after user confirmation
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      }
      return true;
    } catch (error) {
      console.error('[StorageManager] Error clearing storage:', error);
      return false;
    }
  }

  /**
   * Check if storage API is available
   */
  isStorageAvailable(): boolean {
    return 'storage' in navigator && 'estimate' in navigator.storage;
  }

  /**
   * Get storage recommendation based on user type
   */
  getStorageRecommendation(isPremium: boolean): string {
    if (isPremium) {
      return 'Your decks are synced to the cloud. Local storage is used as cache for offline access.';
    } else {
      return 'Your decks are stored locally on this device. Enable persistent storage and regularly export backups to prevent data loss.';
    }
  }
}

// Export singleton instance
export const storageManager = StorageManager.getInstance();