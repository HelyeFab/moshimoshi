interface ErrorEntry {
  id: string;
  timestamp: number;
  error: {
    message: string;
    stack?: string;
    code?: string;
    type: 'sync' | 'storage' | 'network' | 'validation' | 'unknown';
  };
  context: {
    operation: string;
    userId?: string;
    deckId?: string;
    isPremium?: boolean;
    browserInfo?: string;
    networkStatus?: 'online' | 'offline';
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

interface ErrorPattern {
  pattern: RegExp;
  type: ErrorEntry['error']['type'];
  severity: ErrorEntry['severity'];
  suggestedFix?: string;
  autoRecover?: () => Promise<void>;
}

export class ErrorMonitor {
  private errors: Map<string, ErrorEntry> = new Map();
  private errorPatterns: ErrorPattern[] = [];
  private maxErrors = 100;
  private listeners: Set<(error: ErrorEntry) => void> = new Set();
  private errorCounts: Map<string, number> = new Map();
  private reportingEnabled = true;
  private analyticsBuffer: ErrorEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.setupErrorPatterns();
    this.setupGlobalErrorHandlers();
  }

  // Setup known error patterns
  private setupErrorPatterns(): void {
    this.errorPatterns = [
      {
        pattern: /quota.?exceeded/i,
        type: 'storage',
        severity: 'high',
        suggestedFix: 'Clear browser storage or upgrade to premium for cloud storage'
      },
      {
        pattern: /network.?error|failed.?to.?fetch/i,
        type: 'network',
        severity: 'medium',
        suggestedFix: 'Check internet connection',
        autoRecover: async () => {
          // Trigger sync retry
          const { syncManager } = await import('./SyncManager');
          await syncManager.forceSyncNow();
        }
      },
      {
        pattern: /unauthorized|401/i,
        type: 'network',
        severity: 'high',
        suggestedFix: 'Session expired, please log in again'
      },
      {
        pattern: /indexeddb.?blocked|database.?blocked/i,
        type: 'storage',
        severity: 'critical',
        suggestedFix: 'Close other tabs or restart browser'
      },
      {
        pattern: /duplicate.?key|already.?exists/i,
        type: 'validation',
        severity: 'low',
        suggestedFix: 'Item already exists, no action needed'
      },
      {
        pattern: /sync.?conflict/i,
        type: 'sync',
        severity: 'medium',
        suggestedFix: 'Manual conflict resolution required'
      },
      {
        pattern: /timeout|timed.?out/i,
        type: 'network',
        severity: 'medium',
        suggestedFix: 'Operation took too long, will retry automatically'
      },
      {
        pattern: /invalid.?deck.?structure|malformed/i,
        type: 'validation',
        severity: 'high',
        suggestedFix: 'Data corruption detected, restore from backup'
      }
    ];
  }

  // Setup global error handlers
  private setupGlobalErrorHandlers(): void {
    // Catch unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        this.captureError(
          event.reason,
          {
            operation: 'unhandled-promise-rejection',
            networkStatus: navigator.onLine ? 'online' : 'offline'
          }
        );
      });

      // Monitor online/offline status
      window.addEventListener('online', () => {
        this.logInfo('Network status changed to online');
      });

      window.addEventListener('offline', () => {
        this.logWarning('Network status changed to offline');
      });
    }
  }

  // Capture and categorize error
  captureError(
    error: Error | string | unknown,
    context: Partial<ErrorEntry['context']> = {}
  ): string {
    const errorEntry = this.createErrorEntry(error, context);

    // Store error
    this.errors.set(errorEntry.id, errorEntry);

    // Maintain size limit
    if (this.errors.size > this.maxErrors) {
      const firstKey = this.errors.keys().next().value;
      if (firstKey) this.errors.delete(firstKey);
    }

    // Update error counts
    const errorKey = `${errorEntry.error.type}:${errorEntry.error.message}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);

    // Notify listeners
    this.listeners.forEach(listener => listener(errorEntry));

    // Add to analytics buffer
    this.bufferForAnalytics(errorEntry);

    // Auto-recover if possible
    this.attemptAutoRecovery(errorEntry);

    console.error('[ErrorMonitor] Captured error:', errorEntry);

    return errorEntry.id;
  }

  // Create error entry from various error types
  private createErrorEntry(
    error: Error | string | unknown,
    context: Partial<ErrorEntry['context']>
  ): ErrorEntry {
    let errorMessage = 'Unknown error';
    let errorStack: string | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    }

    // Categorize error
    const categorized = this.categorizeError(errorMessage);

    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      error: {
        message: errorMessage,
        stack: errorStack,
        type: categorized.type,
        code: categorized.code
      },
      context: {
        operation: 'unknown',
        ...context,
        browserInfo: this.getBrowserInfo(),
        networkStatus: navigator.onLine ? 'online' : 'offline'
      },
      severity: categorized.severity,
      resolved: false
    };
  }

  // Categorize error based on patterns
  private categorizeError(message: string): {
    type: ErrorEntry['error']['type'];
    severity: ErrorEntry['severity'];
    code?: string;
  } {
    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(message)) {
        return {
          type: pattern.type,
          severity: pattern.severity
        };
      }
    }

    // Default categorization
    return {
      type: 'unknown',
      severity: 'medium'
    };
  }

  // Attempt automatic recovery
  private async attemptAutoRecovery(error: ErrorEntry): Promise<void> {
    const pattern = this.errorPatterns.find(p =>
      p.pattern.test(error.error.message) && p.autoRecover
    );

    if (pattern?.autoRecover) {
      try {
        await pattern.autoRecover();
        error.resolved = true;
        console.log('[ErrorMonitor] Auto-recovery successful for:', error.id);
      } catch (recoveryError) {
        console.error('[ErrorMonitor] Auto-recovery failed:', recoveryError);
      }
    }
  }

  // Buffer errors for analytics
  private bufferForAnalytics(error: ErrorEntry): void {
    if (!this.reportingEnabled) return;

    this.analyticsBuffer.push(error);

    // Flush buffer if it's getting large or schedule flush
    if (this.analyticsBuffer.length >= 10) {
      this.flushAnalytics();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushAnalytics(), 30000); // 30 seconds
    }
  }

  // Send errors to analytics service
  private async flushAnalytics(): Promise<void> {
    if (this.analyticsBuffer.length === 0) return;

    const errors = [...this.analyticsBuffer];
    this.analyticsBuffer = [];

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      // In production, this would send to an analytics service
      console.log('[ErrorMonitor] Would send to analytics:', {
        errors: errors.length,
        types: this.getErrorSummary()
      });
    } catch (error) {
      console.error('[ErrorMonitor] Failed to send analytics:', error);
    }
  }

  // Get browser information
  private getBrowserInfo(): string {
    const ua = navigator.userAgent;
    const browser = ua.match(/(chrome|safari|firefox|edge|opera)/i)?.[0] || 'unknown';
    return `${browser}/${navigator.platform}`;
  }

  // Get error summary statistics
  getErrorSummary(): Record<string, any> {
    const summary = {
      total: this.errors.size,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      topErrors: [] as Array<{ message: string; count: number }>,
      resolvedCount: 0,
      unresolvedCount: 0
    };

    // Count by type and severity
    for (const error of this.errors.values()) {
      summary.byType[error.error.type] = (summary.byType[error.error.type] || 0) + 1;
      summary.bySeverity[error.severity] = (summary.bySeverity[error.severity] || 0) + 1;

      if (error.resolved) {
        summary.resolvedCount++;
      } else {
        summary.unresolvedCount++;
      }
    }

    // Get top errors
    const sortedErrors = Array.from(this.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    summary.topErrors = sortedErrors.map(([message, count]) => ({
      message: message.split(':')[1] || message,
      count
    }));

    return summary;
  }

  // Get recent errors
  getRecentErrors(limit: number = 10): ErrorEntry[] {
    return Array.from(this.errors.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Get errors by type
  getErrorsByType(type: ErrorEntry['error']['type']): ErrorEntry[] {
    return Array.from(this.errors.values())
      .filter(error => error.error.type === type);
  }

  // Get unresolved critical errors
  getCriticalErrors(): ErrorEntry[] {
    return Array.from(this.errors.values())
      .filter(error => error.severity === 'critical' && !error.resolved);
  }

  // Mark error as resolved
  resolveError(errorId: string): void {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
    }
  }

  // Clear all errors
  clearErrors(): void {
    this.errors.clear();
    this.errorCounts.clear();
    this.analyticsBuffer = [];
  }

  // Subscribe to error events
  subscribe(listener: (error: ErrorEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Log levels for non-error events
  logInfo(message: string, context?: any): void {
    console.log(`[INFO] ${message}`, context);
  }

  logWarning(message: string, context?: any): void {
    console.warn(`[WARNING] ${message}`, context);
  }

  // Generate error report
  generateReport(): string {
    const summary = this.getErrorSummary();
    const recent = this.getRecentErrors(20);

    const report = `
# Flashcard System Error Report
Generated: ${new Date().toISOString()}

## Summary
- Total Errors: ${summary.total}
- Resolved: ${summary.resolvedCount}
- Unresolved: ${summary.unresolvedCount}

## By Type
${Object.entries(summary.byType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

## By Severity
${Object.entries(summary.bySeverity).map(([severity, count]) => `- ${severity}: ${count}`).join('\n')}

## Top Errors
${summary.topErrors.map((e, i) => `${i + 1}. ${e.message} (${e.count} occurrences)`).join('\n')}

## Recent Errors
${recent.map(e => `
### ${new Date(e.timestamp).toLocaleString()}
- Type: ${e.error.type}
- Severity: ${e.severity}
- Message: ${e.error.message}
- Context: ${e.context.operation}
- Status: ${e.resolved ? 'Resolved' : 'Unresolved'}
`).join('\n')}
`;

    return report;
  }

  // Export errors to CSV
  exportToCSV(): string {
    const headers = ['Timestamp', 'Type', 'Severity', 'Message', 'Operation', 'Resolved'];
    const rows = Array.from(this.errors.values()).map(e => [
      new Date(e.timestamp).toISOString(),
      e.error.type,
      e.severity,
      e.error.message.replace(/"/g, '""'),
      e.context.operation,
      e.resolved ? 'Yes' : 'No'
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  // Cleanup
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushAnalytics();
    this.listeners.clear();
  }
}

// Export singleton
export const errorMonitor = new ErrorMonitor();