/**
 * Professional Logger using Pino
 * High-performance structured logging for production
 */

import pino from 'pino'

// Determine if we're in browser or server
const isBrowser = typeof window !== 'undefined'
const isDevelopment = process.env.NODE_ENV === 'development'

// Create different transports based on environment
const createLogger = () => {
  if (isBrowser) {
    // Browser configuration - no pino-pretty in browser
    return pino({
      browser: {
        asObject: true,
        serialize: true
      },
      level: isDevelopment ? 'debug' : 'error'
    })
  } else {
    // Server configuration
    return pino({
      level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
      serializers: {
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
        err: pino.stdSerializers.err
      },
      // Add context information
      base: {
        env: process.env.NODE_ENV,
        revision: process.env.VERCEL_GIT_COMMIT_SHA
      }
    })
  }
}

// Create the base logger
const baseLogger = createLogger()

// Create child loggers for different modules
export const loggers = {
  streak: baseLogger.child({ module: 'streak' }),
  pokemon: baseLogger.child({ module: 'pokemon' }),
  auth: baseLogger.child({ module: 'auth' }),
  review: baseLogger.child({ module: 'review' }),
  achievement: baseLogger.child({ module: 'achievement' }),
  sync: baseLogger.child({ module: 'sync' }),
  kanji: baseLogger.child({ module: 'kanji' }),
  kana: baseLogger.child({ module: 'kana' }),
  api: baseLogger.child({ module: 'api' }),
  db: baseLogger.child({ module: 'database' })
}

// Main logger export for general use
export const logger = baseLogger

// Convenience methods that match our custom logger interface
export const log = {
  // Module-specific methods
  streak: (message: string, data?: any) => {
    loggers.streak.info({ ...data }, message)
  },

  pokemon: (message: string, data?: any) => {
    loggers.pokemon.info({ ...data }, message)
  },

  auth: (message: string, data?: any) => {
    loggers.auth.info({ ...data }, message)
  },

  review: (message: string, data?: any) => {
    loggers.review.info({ ...data }, message)
  },

  achievement: (message: string, data?: any) => {
    loggers.achievement.info({ ...data }, message)
  },

  sync: (message: string, data?: any) => {
    loggers.sync.info({ ...data }, message)
  },

  kanji: (message: string, data?: any) => {
    loggers.kanji.info({ ...data }, message)
  },

  kana: (message: string, data?: any) => {
    loggers.kana.info({ ...data }, message)
  },

  api: (message: string, data?: any) => {
    loggers.api.info({ ...data }, message)
  },

  db: (message: string, data?: any) => {
    loggers.db.info({ ...data }, message)
  },

  // Generic methods
  debug: (message: string, data?: any) => {
    logger.debug({ ...data }, message)
  },

  info: (message: string, data?: any) => {
    logger.info({ ...data }, message)
  },

  warn: (message: string, data?: any) => {
    logger.warn({ ...data }, message)
  },

  error: (message: string, error?: any) => {
    if (error instanceof Error) {
      logger.error({ err: error }, message)
    } else {
      logger.error({ error }, message)
    }
  },

  // Performance logging
  time: (label: string) => {
    if (isBrowser) {
      console.time(label)
    } else {
      return logger.startTimer()
    }
  },

  timeEnd: (label: string, message?: string) => {
    if (isBrowser) {
      console.timeEnd(label)
    } else {
      // Timer instance would be returned from time()
      logger.info({ duration: label }, message || 'Operation completed')
    }
  },

  // Add missing methods from debug logger
  enable: (namespaces: string) => {
    console.log(`Pino logger active - enable() is a debug-only feature`)
  },

  disable: () => {
    console.log(`Pino logger active - disable() is a debug-only feature`)
  },

  status: () => {
    console.log('📊 Pino Logger Status:')
    console.log('  Mode: Production')
    console.log('  Level:', logger.level)
  }
}

// Browser console helper for development
if (isBrowser && isDevelopment) {
  (window as any).log = log
  (window as any).logger = logger

  // Add helper to change log level
  (window as any).setLogLevel = (level: string) => {
    logger.level = level
    console.log(`✅ Log level set to: ${level}`)
  }

  console.log(`
🚀 Pino Logger initialized!
Available in console:
  - log.streak(message, data)
  - log.pokemon(message, data)
  - log.error(message, error)
  - setLogLevel('debug' | 'info' | 'warn' | 'error')

Current level: ${logger.level}
  `)
}