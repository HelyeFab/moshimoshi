"use strict";
/**
 * Error monitoring and logging utilities for production
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorSeverity = void 0;
exports.logError = logError;
exports.withErrorMonitoring = withErrorMonitoring;
exports.monitorWebhookProcessing = monitorWebhookProcessing;
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["INFO"] = "info";
    ErrorSeverity["WARNING"] = "warning";
    ErrorSeverity["ERROR"] = "error";
    ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
/**
 * Log error with context for monitoring
 */
function logError(message, error, severity = ErrorSeverity.ERROR, context) {
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
    }
    else if (severity === ErrorSeverity.ERROR) {
        console.error('[ERROR]', JSON.stringify(errorData));
    }
    else if (severity === ErrorSeverity.WARNING) {
        console.warn('[WARNING]', JSON.stringify(errorData));
    }
    else {
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
function withErrorMonitoring(fn, context) {
    return (async (...args) => {
        try {
            return await fn(...args);
        }
        catch (error) {
            logError(`Error in ${fn.name || 'anonymous function'}`, error, ErrorSeverity.ERROR, context);
            throw error;
        }
    });
}
/**
 * Monitor webhook processing
 */
function monitorWebhookProcessing(eventType, eventId, startTime) {
    const duration = Date.now() - startTime;
    // Log slow webhooks
    if (duration > 5000) {
        logError('Slow webhook processing', { duration }, ErrorSeverity.WARNING, { eventType, eventId, duration });
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
//# sourceMappingURL=monitoring.js.map