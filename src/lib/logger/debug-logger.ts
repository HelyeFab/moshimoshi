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

// Create namespaced debug instances
const debug = {
  streak: createDebug('app:streak'),
  pokemon: createDebug('app:pokemon'),
  auth: createDebug('app:auth'),
  review: createDebug('app:review'),
  achievement: createDebug('app:achievement'),
  sync: createDebug('app:sync'),
  kanji: createDebug('app:kanji'),
  kana: createDebug('app:kana'),
  api: createDebug('app:api'),
  db: createDebug('app:db'),
  performance: createDebug('app:performance'),
  error: createDebug('app:error'),
  subscription: createDebug('app:subscription'),
  race: createDebug('app:race'),  // For race condition monitoring
  warning: createDebug('app:warning')  // For important warnings
}

// Enable colors in browser
if (typeof window !== 'undefined') {
  createDebug.enable(localStorage.debug || '')

  // Add color support
  createDebug.formatters.c = (v) => {
    return `color: ${v}`
  }
}

// Dynamic namespace creation function
export const debugLog: any = (namespace?: string) => {
  // If called with namespace, create a new debug instance
  if (namespace) {
    return createDebug(namespace);
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
    if (typeof window !== 'undefined') {
      localStorage.debug = namespaces
      createDebug.enable(namespaces)
      console.log(`✅ Debug enabled for: ${namespaces}`)
    } else {
      process.env.DEBUG = namespaces
      createDebug.enable(namespaces)
    }
  },

  disable: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('debug')
      createDebug.disable()
      console.log('🚫 Debug logging disabled')
    } else {
      delete process.env.DEBUG
      createDebug.disable()
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

  // Show instructions in console
  console.log(`
🐛 Debug Logger Available!

Enable logging:
  localStorage.debug = 'app:*'           // All modules
  localStorage.debug = 'app:streak'      // Just streak
  localStorage.debug = 'app:streak,app:pokemon'  // Multiple

Or use helper:
  debug.enable('app:*')
  debug.disable()
  debug.status()

Current: ${localStorage.debug || 'Disabled'}
  `)
}