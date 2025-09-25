// Universal logger interface
interface Logger {
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
  http(message: string, meta?: any): void;
}

// Client-side logger - uses console to avoid circular dependency
class ClientLogger implements Logger {
  private sentryClient: any = null;

  constructor() {
    // Only load Sentry on client side if available
    if (typeof window !== 'undefined') {
      this.initSentry();
    }
  }

  private async initSentry() {
    try {
      // Dynamic import to avoid bundling issues
      const SentryModule = await import('@sentry/nextjs');
      this.sentryClient = SentryModule;
    } catch (error) {
      // Sentry not available, continue without it
      console.debug('Sentry not available for logging');
    }
  }

  error(message: string, meta?: any) {
    // Use console directly to avoid circular dependency
    if (process.env.NODE_ENV === 'development') {
      console.error(message, meta);
    }
    // Send errors to Sentry if available
    if (this.sentryClient) {
      this.sentryClient.captureException(new Error(message), {
        level: 'error',
        extra: meta
      });
    }
  }

  warn(message: string, meta?: any) {
    // Use console directly to avoid circular dependency
    if (process.env.NODE_ENV === 'development') {
      console.warn(message, meta);
    }
    // Send warnings to Sentry if available
    if (this.sentryClient) {
      this.sentryClient.captureMessage(message, {
        level: 'warning',
        extra: meta
      });
    }
  }

  info(message: string, meta?: any) {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.info(message, meta);
    }
  }

  debug(message: string, meta?: any) {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.debug(message, meta);
    }
  }

  http(message: string, meta?: any) {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[HTTP] ${message}`, meta);
    }
  }
}

// Server-side logger using winston (if available)
class ServerLogger implements Logger {
  private winston: any = null;
  private logger: any = null;
  private sentryServer: any = null;

  constructor() {
    if (typeof window === 'undefined') {
      this.loadWinston();
      this.loadSentry();
    }
  }

  private async loadWinston() {
    try {
      // Use dynamic import for server-side only module
      const winston = await import('winston');
      this.winston = winston;
      this.initializeWinston();
    } catch (error) {
      console.warn('Winston not available, falling back to console logging');
    }
  }

  private async loadSentry() {
    try {
      // Dynamic import to avoid bundling issues
      const SentryModule = await import('@sentry/nextjs');
      this.sentryServer = SentryModule;
    } catch (error) {
      // Sentry not available, continue without it
      console.debug('Sentry not available for server logging');
    }
  }

  private initializeWinston() {
    if (!this.winston) return;

    const format = this.winston.format.combine(
      this.winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
      this.winston.format.errors({ stack: true }),
      this.winston.format.splat(),
      this.winston.format.json()
    );

    const consoleFormat = this.winston.format.combine(
      this.winston.format.colorize({ all: true }),
      this.winston.format.printf(
        (info: any) => `${info.timestamp} ${info.level}: ${info.message} ${info.stack || ''}`
      )
    );

    const transports = [
      new this.winston.transports.Console({
        format: process.env.NODE_ENV === 'production' ? format : consoleFormat
      })
    ];

    this.logger = this.winston.createLogger({
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      format,
      transports,
      exitOnError: false
    });
  }

  error(message: string, meta?: any) {
    if (this.logger) {
      this.logger.error(message, meta);
    } else {
      console.error(message, meta);
    }

    // Send to Sentry if available
    if (this.sentryServer) {
      this.sentryServer.captureException(new Error(message), {
        level: 'error',
        extra: meta
      });
    }
  }

  warn(message: string, meta?: any) {
    if (this.logger) {
      this.logger.warn(message, meta);
    } else {
      console.warn(message, meta);
    }

    // Send to Sentry if available
    if (this.sentryServer) {
      this.sentryServer.captureMessage(message, {
        level: 'warning',
        extra: meta
      });
    }
  }

  info(message: string, meta?: any) {
    if (this.logger) {
      this.logger.info(message, meta);
    } else {
      console.info(message, meta);
    }
  }

  debug(message: string, meta?: any) {
    if (this.logger) {
      this.logger.debug(message, meta);
    } else {
      console.debug(message, meta);
    }
  }

  http(message: string, meta?: any) {
    if (this.logger) {
      this.logger.http(message, meta);
    } else {
      console.log(`[HTTP] ${message}`, meta);
    }
  }
}

// Create appropriate logger based on environment
const baseLogger: Logger = typeof window === 'undefined' 
  ? new ServerLogger() 
  : new ClientLogger();

// Component logger for namespaced logging
export class ComponentLogger implements Logger {
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  error(message: string, meta?: any) {
    baseLogger.error(`[${this.component}] ${message}`, meta);
  }

  warn(message: string, meta?: any) {
    baseLogger.warn(`[${this.component}] ${message}`, meta);
  }

  info(message: string, meta?: any) {
    baseLogger.info(`[${this.component}] ${message}`, meta);
  }

  debug(message: string, meta?: any) {
    baseLogger.debug(`[${this.component}] ${message}`, meta);
  }

  http(message: string, meta?: any) {
    baseLogger.http(`[${this.component}] ${message}`, meta);
  }
}

// Default logger instance
export const logger = baseLogger;

// Create component-specific loggers
export const reviewLogger = new ComponentLogger('ReviewEngine');
export const authLogger = new ComponentLogger('Auth');
export const redisLogger = new ComponentLogger('Redis');
export const firestoreLogger = new ComponentLogger('Firestore');
export const apiLogger = new ComponentLogger('API');

// Monitoring utilities
export const createLogger = (component: string) => new ComponentLogger(component);

// Performance logging
export const logPerformance = (operation: string, duration: number, meta?: any) => {
  logger.info(`Performance: ${operation} completed in ${duration}ms`, meta);
};

// Error boundary logging
export const logReactError = (error: Error, errorInfo: any) => {
  logger.error('React Error Boundary caught error', {
    error: error.message,
    stack: error.stack,
    errorInfo
  });
};

// Request logging middleware helper
export const logRequest = (method: string, url: string, duration?: number, meta?: any) => {
  const message = duration 
    ? `${method} ${url} - ${duration}ms`
    : `${method} ${url}`;
  
  logger.http(message, meta);
};

export default logger;