/**
 * QuotaGuard - IndexedDB Storage Quota Management Utility
 *
 * Provides quota checking and guarded write operations to prevent
 * storage quota exceeded errors in IndexedDB operations.
 */

/**
 * Storage quota status information
 */
export interface QuotaStatus {
  /** Whether storage is available for writes (false if >= 95%) */
  available: boolean;
  /** Current usage in bytes */
  usage: number;
  /** Total quota in bytes */
  quota: number;
  /** Usage percentage (0.0 to 1.0) */
  percentage: number;
  /** Warning flag (true if >= 90%) */
  warning?: boolean;
  /** Critical flag (true if >= 95%) */
  critical?: boolean;
}

/**
 * Cleanup suggestion for user guidance
 */
export interface CleanupSuggestion {
  /** Action identifier */
  action: string;
  /** Human-readable description */
  description: string;
}

/**
 * Custom error for quota-related failures
 */
export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaError';
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, QuotaError.prototype);
  }
}

/**
 * QuotaGuard - Static utility class for storage quota management
 */
export class QuotaGuard {
  /** Warning threshold: 90% of quota */
  private static readonly WARNING_THRESHOLD = 0.90;

  /** Block threshold: 95% of quota */
  private static readonly BLOCK_THRESHOLD = 0.95;

  /** Cache for quota status (valid for 30 seconds) */
  private static quotaCache: {
    status: QuotaStatus | null;
    timestamp: number;
  } = {
    status: null,
    timestamp: 0
  };

  /** Cache validity duration in milliseconds */
  private static readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * Check if Storage API is available in the current browser
   */
  private static isStorageAPIAvailable(): boolean {
    return typeof navigator !== 'undefined' &&
           'storage' in navigator &&
           typeof navigator.storage.estimate === 'function';
  }

  /**
   * Check current storage quota status
   *
   * @returns QuotaStatus object with current storage information
   */
  static async checkQuota(): Promise<QuotaStatus> {
    // Check cache first
    const now = Date.now();
    if (this.quotaCache.status && (now - this.quotaCache.timestamp) < this.CACHE_DURATION) {
      return this.quotaCache.status;
    }

    // If Storage API is not available, return optimistic status
    if (!this.isStorageAPIAvailable()) {
      const fallbackStatus: QuotaStatus = {
        available: true,
        usage: 0,
        quota: Number.MAX_SAFE_INTEGER,
        percentage: 0,
        warning: false,
        critical: false
      };

      // Cache the fallback status
      this.quotaCache = {
        status: fallbackStatus,
        timestamp: now
      };

      return fallbackStatus;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || Number.MAX_SAFE_INTEGER;
      const percentage = quota > 0 ? usage / quota : 0;

      const status: QuotaStatus = {
        available: percentage < this.BLOCK_THRESHOLD,
        usage,
        quota,
        percentage,
        warning: percentage >= this.WARNING_THRESHOLD,
        critical: percentage >= this.BLOCK_THRESHOLD
      };

      // Cache the status
      this.quotaCache = {
        status,
        timestamp: now
      };

      return status;
    } catch (error) {
      console.warn('[QuotaGuard] Failed to estimate storage quota:', error);

      // Return optimistic status on error
      const fallbackStatus: QuotaStatus = {
        available: true,
        usage: 0,
        quota: Number.MAX_SAFE_INTEGER,
        percentage: 0,
        warning: false,
        critical: false
      };

      return fallbackStatus;
    }
  }

  /**
   * Execute an IndexedDB write operation with quota protection
   *
   * Pre-checks quota before operation and provides meaningful errors
   * when quota is exceeded.
   *
   * @param operation - The async operation to execute
   * @param context - Context string for error messages (e.g., 'createList', 'addItem')
   * @returns Result of the operation
   * @throws QuotaError if quota is exceeded or critically low
   */
  static async guardedWrite<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    // Pre-check quota status
    const quotaStatus = await this.checkQuota();

    // Block writes if critical (>= 95%)
    if (quotaStatus.critical) {
      const usedMB = (quotaStatus.usage / (1024 * 1024)).toFixed(2);
      const quotaMB = (quotaStatus.quota / (1024 * 1024)).toFixed(2);
      const percentStr = (quotaStatus.percentage * 100).toFixed(1);

      throw new QuotaError(
        `Storage quota critically low (${percentStr}% used: ${usedMB}MB / ${quotaMB}MB). ` +
        `Cannot perform operation: ${context}. Please free up space before continuing.`
      );
    }

    // Warn if approaching quota (>= 90%)
    if (quotaStatus.warning) {
      const usedMB = (quotaStatus.usage / (1024 * 1024)).toFixed(2);
      const quotaMB = (quotaStatus.quota / (1024 * 1024)).toFixed(2);
      const percentStr = (quotaStatus.percentage * 100).toFixed(1);

      console.warn(
        `[QuotaGuard] Storage quota warning for ${context}: ` +
        `${percentStr}% used (${usedMB}MB / ${quotaMB}MB). ` +
        `Consider cleaning up storage soon.`
      );
    }

    // Execute the operation with error handling
    try {
      const result = await operation();

      // Invalidate cache after successful write
      this.quotaCache.timestamp = 0;

      return result;
    } catch (error: any) {
      // Check if it's a quota exceeded error
      if (this.isQuotaExceededError(error)) {
        const quotaStatus = await this.checkQuota();
        const usedMB = (quotaStatus.usage / (1024 * 1024)).toFixed(2);
        const quotaMB = (quotaStatus.quota / (1024 * 1024)).toFixed(2);

        throw new QuotaError(
          `Storage quota exceeded during ${context}. ` +
          `Current usage: ${usedMB}MB / ${quotaMB}MB. ` +
          `Please free up space and try again.`
        );
      }

      // Re-throw other errors as-is
      throw error;
    }
  }

  /**
   * Check if an error is a quota exceeded error
   *
   * @param error - Error to check
   * @returns true if the error indicates quota exceeded
   */
  private static isQuotaExceededError(error: any): boolean {
    if (!error) return false;

    // Check error name
    if (error.name === 'QuotaExceededError') return true;

    // Check DOMException code (legacy browsers)
    if (error instanceof DOMException && error.code === 22) return true;

    // Check error message
    const message = error.message?.toLowerCase() || '';
    return message.includes('quota') &&
           (message.includes('exceeded') || message.includes('full'));
  }

  /**
   * Generate cleanup suggestions based on current quota status
   *
   * @returns Array of cleanup suggestions
   */
  static async suggestCleanup(): Promise<CleanupSuggestion[]> {
    const quotaStatus = await this.checkQuota();
    const suggestions: CleanupSuggestion[] = [];

    // Always include basic cleanup suggestions
    suggestions.push({
      action: 'clear-old-sync-queue',
      description: 'Clear old sync queue items that have already been processed or failed multiple times'
    });

    suggestions.push({
      action: 'delete-unused-lists',
      description: 'Delete unused or empty lists to free up storage space'
    });

    suggestions.push({
      action: 'clear-browser-cache',
      description: 'Clear browser cache and temporary files through browser settings'
    });

    // Add critical suggestions if quota is high
    if (quotaStatus.percentage >= this.WARNING_THRESHOLD) {
      suggestions.push({
        action: 'export-and-archive',
        description: 'Export important lists and archive them externally, then delete local copies'
      });

      suggestions.push({
        action: 'upgrade-to-premium',
        description: 'Upgrade to Premium for cloud storage and remove dependency on local storage limits'
      });
    }

    if (quotaStatus.critical) {
      suggestions.unshift({
        action: 'immediate-cleanup',
        description: 'URGENT: Storage is critically full. Delete unnecessary data immediately to continue using the app'
      });
    }

    return suggestions;
  }

  /**
   * Format quota status as a human-readable string
   *
   * @param status - QuotaStatus object
   * @returns Formatted string
   */
  static formatQuotaStatus(status: QuotaStatus): string {
    const usedMB = (status.usage / (1024 * 1024)).toFixed(2);
    const quotaMB = (status.quota / (1024 * 1024)).toFixed(2);
    const percentStr = (status.percentage * 100).toFixed(1);

    let statusStr = `Storage: ${usedMB}MB / ${quotaMB}MB (${percentStr}%)`;

    if (status.critical) {
      statusStr += ' - CRITICAL';
    } else if (status.warning) {
      statusStr += ' - WARNING';
    } else {
      statusStr += ' - OK';
    }

    return statusStr;
  }

  /**
   * Clear the quota status cache
   * Use this after significant storage operations to get fresh data
   */
  static clearCache(): void {
    this.quotaCache.timestamp = 0;
  }
}
