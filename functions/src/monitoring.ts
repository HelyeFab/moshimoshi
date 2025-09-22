/**
 * Error monitoring and logging utilities for production
 */

import * as functions from 'firebase-functions';

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  userId?: string;
  customerId?: string;
  subscriptionId?: string;
  eventType?: string;
  eventId?: string;
  [key: string]: any;
}

/**
 * Log error with context for monitoring
 */
export function logError(
  message: string,
  error: Error | unknown,
  severity: ErrorSeverity = ErrorSeverity.ERROR,
  context?: ErrorContext
): void {
  const errorData = {
    message,
    severity,
    timestamp: new Date().toISOString(),
    context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error
  };

  // In production, this would send to monitoring service
  if (severity === ErrorSeverity.CRITICAL) {
    console.error('[CRITICAL]', JSON.stringify(errorData));
  } else if (severity === ErrorSeverity.ERROR) {
    console.error('[ERROR]', JSON.stringify(errorData));
  } else if (severity === ErrorSeverity.WARNING) {
    console.warn('[WARNING]', JSON.stringify(errorData));
  } else {
    console.log('[INFO]', JSON.stringify(errorData));
  }

  // TODO: Send to external monitoring service (Sentry, DataDog, etc)
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(error, { extra: context });
  // }
}

/**
 * Wrap async function with error monitoring
 */
export function withErrorMonitoring<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: ErrorContext
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(
        `Error in ${fn.name || 'anonymous function'}`,
        error,
        ErrorSeverity.ERROR,
        context
      );
      throw error;
    }
  }) as T;
}

/**
 * Monitor webhook processing
 */
export function monitorWebhookProcessing(
  eventType: string,
  eventId: string,
  startTime: number
): void {
  const duration = Date.now() - startTime;

  // Log slow webhooks
  if (duration > 5000) {
    logError(
      'Slow webhook processing',
      { duration },
      ErrorSeverity.WARNING,
      { eventType, eventId, duration }
    );
  }

  // Log metrics (would send to monitoring service)
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify({
      metric: 'webhook.processing',
      eventType,
      duration,
      timestamp: new Date().toISOString()
    }));
  }
}