import * as Sentry from '@sentry/nextjs';

// Initialize Sentry
export function initSentry() {
  const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    debug: environment === 'development',
    
    // Performance Monitoring
    // Note: BrowserTracing and Replay integrations are not directly available in @sentry/nextjs
    // They are automatically configured by the Next.js SDK
    integrations: [],
    
    // Filtering
    beforeSend(event, hint) {
      // Filter out non-critical errors
      if (event.exception) {
        const error = hint.originalException;
        
        // Don't send network errors in development
        if (environment === 'development' && (error as any)?.name === 'NetworkError') {
          return null;
        }
        
        // Filter out expected validation errors
        if ((error as any)?.message?.includes('ValidationError')) {
          event.level = 'warning';
        }
      }
      
      return event;
    },
    
    // Custom tags
    initialScope: {
      tags: {
        component: 'review-engine',
      },
    },
  });
}

// Custom error tracking for review engine
export class ReviewEngineMonitor {
  private static transactionMap = new Map<string, any>();
  
  // Start a performance transaction
  static startTransaction(name: string, op: string = 'review') {
    // Note: startTransaction is not directly available in @sentry/nextjs
    // Performance monitoring is handled automatically by the SDK
    return null;
  }
  
  // End a transaction
  static endTransaction(name: string) {
    const transaction = this.transactionMap.get(name);
    if (transaction) {
      transaction.finish();
      this.transactionMap.delete(name);
    }
  }
  
  // Track review session performance
  static trackSessionPerformance(sessionId: string, metrics: {
    itemCount: number;
    duration: number;
    accuracy: number;
    avgResponseTime: number;
  }) {
    Sentry.addBreadcrumb({
      message: 'Review session completed',
      category: 'review',
      level: 'info',
      data: {
        sessionId,
        ...metrics,
      },
    });
    
    // Send custom metrics
    Sentry.captureMessage('Review Session Metrics', {
      level: 'info',
      tags: {
        sessionId,
      },
      extra: metrics,
    });
  }
  
  // Track API performance
  static trackAPICall(endpoint: string, duration: number, status: number) {
    // Track slow API calls
    if (duration > 1000) {
      Sentry.captureMessage(`Slow API call: ${endpoint}`, {
        level: 'warning',
        extra: {
          endpoint,
          duration,
          status,
        },
      });
    }
  }
  
  // Track queue generation performance
  static trackQueueGeneration(userId: string, metrics: {
    itemCount: number;
    generationTime: number;
    cacheHit: boolean;
  }) {
    // Alert on slow queue generation
    if (metrics.generationTime > 500 && !metrics.cacheHit) {
      Sentry.captureMessage('Slow queue generation', {
        level: 'warning',
        extra: {
          userId,
          ...metrics
        },
      });
    }
  }
  
  // Track validation errors
  static trackValidationError(contentType: string, error: any) {
    Sentry.captureException(error, {
      tags: {
        component: 'validation',
        content_type: contentType,
      },
      level: 'error',
    });
  }
  
  // Track offline sync issues
  static trackSyncError(operation: string, error: any, context?: any) {
    Sentry.captureException(error, {
      tags: {
        component: 'offline-sync',
        operation,
      },
      extra: context,
      level: 'error',
    });
  }
  
  // Track cache performance
  static trackCacheMetrics(metrics: {
    hitRate: number;
    missRate: number;
    avgLatency: number;
    memoryUsage: number;
  }) {
    // Send metrics periodically
    Sentry.captureMessage('Cache Performance Metrics', {
      level: 'info',
      extra: metrics,
    });
    
    // Alert on poor cache performance
    if (metrics.hitRate < 0.8) {
      Sentry.captureMessage('Low cache hit rate', {
        level: 'warning',
        extra: metrics,
      });
    }
  }
  
  // Track user behavior patterns
  static trackUserBehavior(userId: string, event: string, data?: any) {
    Sentry.addBreadcrumb({
      message: event,
      category: 'user-action',
      level: 'info',
      data: {
        userId,
        ...data,
      },
    });
  }
  
  // Custom error context
  static setErrorContext(context: any) {
    // Set context using available Sentry methods
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        Sentry.setTag(key as string, value as string);
      });
    }
    
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        Sentry.setExtra(key as string, value);
      });
    }
    
    if (context.user) {
      Sentry.setUser(context.user);
    }
  }
}

// Export for use in other modules
export { Sentry };