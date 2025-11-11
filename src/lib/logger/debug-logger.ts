/**
 * Debug Module Logger
 * Lightweight logging for development using the popular 'debug' package
 *
 * Enable logging with environment variable:
 * DEBUG=app:* npm run dev
 *
 * Or in browser console:
 * localStorage.debug = 'app:*'
 * localStorage.debug = 'app:streak,app:pokemon'
 */

import createDebug from 'debug'

// Ensure createDebug is available
if (!createDebug || typeof createDebug !== 'function') {
  console.error('Debug package not properly loaded')
}

// Safe debug creation function
const safeCreateDebug = (namespace: string) => {
  try {
    return createDebug(namespace)
  } catch (error) {
    console.warn(`Failed to create debug instance for ${namespace}:`, error)
    return () => {} // Return no-op function
  }
}

// Create namespaced debug instances
const debug = {
  streak: safeCreateDebug('app:streak'),
  pokemon: safeCreateDebug('app:pokemon'),
  auth: safeCreateDebug('app:auth'),
  review: safeCreateDebug('app:review'),
  achievement: safeCreateDebug('app:achievement'),
  sync: safeCreateDebug('app:sync'),
  kanji: safeCreateDebug('app:kanji'),
  kana: safeCreateDebug('app:kana'),
  api: safeCreateDebug('app:api'),
  db: safeCreateDebug('app:db'),
  performance: safeCreateDebug('app:performance'),
  error: safeCreateDebug('app:error'),
  subscription: safeCreateDebug('app:subscription'),
  race: safeCreateDebug('app:race'),  // For race condition monitoring
  warning: safeCreateDebug('app:warning')  // For important warnings
}

// Enable colors in browser
if (typeof window !== 'undefined' && createDebug && createDebug.enable) {
  try {
    createDebug.enable(localStorage.debug || '')

    // Add color support
    if (createDebug.formatters) {
      createDebug.formatters.c = (v) => {
        return `color: ${v}`
      }
    }
  } catch (error) {
    console.warn('Failed to enable debug logging:', error)
  }
}

// Dynamic namespace creation function
export const debugLog: any = (namespace?: string) => {
  // If called with namespace, create a new debug instance
  if (namespace) {
    return safeCreateDebug(namespace);
  }
  // Otherwise return the default api logger
  return debug.api;
};

// Add convenience methods to the function
Object.assign(debugLog, {
  streak: (message: string, ...args: any[]) => {
    debug.streak(message, ...args)
  },

  pokemon: (message: string, ...args: any[]) => {
    debug.pokemon(message, ...args)
  },

  auth: (message: string, ...args: any[]) => {
    debug.auth(message, ...args)
  },

  review: (message: string, ...args: any[]) => {
    debug.review(message, ...args)
  },

  achievement: (message: string, ...args: any[]) => {
    debug.achievement(message, ...args)
  },

  sync: (message: string, ...args: any[]) => {
    debug.sync(message, ...args)
  },

  kanji: (message: string, ...args: any[]) => {
    debug.kanji(message, ...args)
  },

  kana: (message: string, ...args: any[]) => {
    debug.kana(message, ...args)
  },

  api: (message: string, ...args: any[]) => {
    debug.api(message, ...args)
  },

  db: (message: string, ...args: any[]) => {
    debug.db(message, ...args)
  },

  performance: (message: string, ...args: any[]) => {
    debug.performance(message, ...args)
  },

  error: (message: string, ...args: any[]) => {
    debug.error('❌', message, ...args)
  },

  subscription: (message: string, ...args: any[]) => {
    debug.subscription(message, ...args)
  },

  race: (message: string, ...args: any[]) => {
    // Always show race condition warnings
    console.warn('🏁 [RACE CONDITION]', message, ...args)
    debug.race('🏁', message, ...args)
  },

  warning: (message: string, ...args: any[]) => {
    // Always show warnings in production
    if (typeof window !== 'undefined') {
      console.warn('⚠️ [WARNING]', message, ...args)
    }
    debug.warning('⚠️', message, ...args)
  },

  // Add generic methods for compatibility
  debug: (message: string, ...args: any[]) => {
    debug.api(message, ...args)
  },

  info: (message: string, ...args: any[]) => {
    debug.api(message, ...args)
  },

  warn: (message: string, ...args: any[]) => {
    debug.error('⚠️', message, ...args)
  },

  // Helper to enable debugging in browser
  enable: (namespaces: string) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.debug = namespaces
        if (createDebug && createDebug.enable) {
          createDebug.enable(namespaces)
        }
        console.log(`✅ Debug enabled for: ${namespaces}`)
      } else {
        process.env.DEBUG = namespaces
        if (createDebug && createDebug.enable) {
          createDebug.enable(namespaces)
        }
      }
    } catch (error) {
      console.warn('Failed to enable debug logging:', error)
    }
  },

  disable: () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('debug')
        if (createDebug && createDebug.disable) {
          createDebug.disable()
        }
        console.log('🚫 Debug logging disabled')
      } else {
        delete process.env.DEBUG
        if (createDebug && createDebug.disable) {
          createDebug.disable()
        }
      }
    } catch (error) {
      console.warn('Failed to disable debug logging:', error)
    }
  },

  // Show current status
  status: () => {
    const enabled = typeof window !== 'undefined'
      ? localStorage.debug
      : process.env.DEBUG

    console.log('📊 Debug Status:')
    console.log('  Enabled namespaces:', enabled || 'None')
    console.log('\n📝 Available namespaces:')
    console.log('  app:streak      - Streak tracking')
    console.log('  app:pokemon     - Pokemon features')
    console.log('  app:auth        - Authentication')
    console.log('  app:review      - Review system')
    console.log('  app:achievement - Achievements')
    console.log('  app:sync        - Data sync')
    console.log('  app:kanji       - Kanji features')
    console.log('  app:kana        - Kana features')
    console.log('  app:api         - API calls')
    console.log('  app:db          - Database operations')
    console.log('  app:*           - All modules')
    console.log('\n💡 Enable in browser:')
    console.log('  localStorage.debug = "app:*"')
    console.log('  localStorage.debug = "app:streak,app:pokemon"')
  }
})

// Export the raw debug instances for advanced usage
export { debug }

// Browser console helpers
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).debug = debugLog

  // Debug logger is available via window.debug
  // To enable: localStorage.debug = 'app:*' or debug.enable('app:*')
  // Removed startup message to reduce console noise
}