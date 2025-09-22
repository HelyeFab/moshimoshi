# Modern Logging Best Practices for Web Applications

## The Problem with console.log
- **No control** - Can't disable in production
- **No levels** - Everything looks the same
- **No context** - Hard to track where logs came from
- **Performance** - console.log can impact performance
- **Security** - May leak sensitive data in production

## Professional Logging Approaches

### 1. Centralized Logger Service
```typescript
// src/lib/logger.ts
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

class Logger {
  private level: LogLevel
  private isDevelopment: boolean

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
    this.level = this.isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR
  }

  debug(message: string, context?: any) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, context || '')
    }
  }

  info(message: string, context?: any) {
    if (this.level <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, context || '')
    }
  }

  warn(message: string, context?: any) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, context || '')
    }
  }

  error(message: string, error?: any) {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, error || '')
      // In production, send to error tracking service
      if (!this.isDevelopment && error) {
        this.sendToErrorTracking(error)
      }
    }
  }

  private sendToErrorTracking(error: any) {
    // Send to Sentry, LogRocket, etc.
  }
}

export const logger = new Logger()
```

### 2. Environment-Based Logging
```typescript
// Only log in development
const log = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args)
    }
  },
  error: (...args: any[]) => {
    console.error(...args) // Always log errors
  }
}
```

### 3. Feature Flag Controlled Logging
```typescript
// src/lib/featureLogger.ts
class FeatureLogger {
  private enabledFeatures: Set<string>

  constructor() {
    // Can be controlled via localStorage, env vars, or remote config
    this.enabledFeatures = new Set(
      (localStorage.getItem('debug_features') || '').split(',')
    )
  }

  log(feature: string, message: string, data?: any) {
    if (this.enabledFeatures.has(feature) || this.enabledFeatures.has('*')) {
      console.log(`[${feature}] ${message}`, data)
    }
  }
}

// Usage:
// localStorage.setItem('debug_features', 'streak,pokemon,auth')
// logger.log('streak', 'Updated streak', { current: 5 })
```

### 4. Popular Logging Libraries

#### Winston (Node.js/Universal)
```typescript
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}
```

#### Pino (High Performance)
```typescript
import pino from 'pino'

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
})
```

#### Debug (Simple & Popular)
```typescript
import debug from 'debug'

// Enable with DEBUG=app:* npm run dev
const logStreak = debug('app:streak')
const logPokemon = debug('app:pokemon')
const logAuth = debug('app:auth')

// Usage
logStreak('Streak updated', { current: 5 })
logPokemon('Pokemon caught', { id: 25 })
```

### 5. Structured Logging Pattern
```typescript
interface LogContext {
  userId?: string
  sessionId?: string
  feature?: string
  action?: string
  metadata?: Record<string, any>
}

class StructuredLogger {
  log(level: string, message: string, context: LogContext) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
      environment: process.env.NODE_ENV
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(logEntry)
    } else {
      // Send to logging service (Datadog, CloudWatch, etc.)
      this.sendToLoggingService(logEntry)
    }
  }
}
```

## Implementation for Your App

Here's a practical logger for Moshimoshi:

```typescript
// src/lib/logger/index.ts
class MoshimoshiLogger {
  private isDev = process.env.NODE_ENV === 'development'
  private enabledModules: Set<string>

  constructor() {
    // Enable specific modules via localStorage
    if (typeof window !== 'undefined') {
      const enabled = localStorage.getItem('debug_modules') || ''
      this.enabledModules = new Set(enabled.split(',').filter(Boolean))
    } else {
      this.enabledModules = new Set()
    }
  }

  private shouldLog(module: string): boolean {
    if (!this.isDev) return false
    return this.enabledModules.has('*') || this.enabledModules.has(module)
  }

  streak(message: string, data?: any) {
    if (this.shouldLog('streak')) {
      console.log(`🔥 [Streak] ${message}`, data || '')
    }
  }

  pokemon(message: string, data?: any) {
    if (this.shouldLog('pokemon')) {
      console.log(`🎮 [Pokemon] ${message}`, data || '')
    }
  }

  auth(message: string, data?: any) {
    if (this.shouldLog('auth')) {
      console.log(`🔐 [Auth] ${message}`, data || '')
    }
  }

  review(message: string, data?: any) {
    if (this.shouldLog('review')) {
      console.log(`📝 [Review] ${message}`, data || '')
    }
  }

  error(message: string, error?: any) {
    // Always log errors
    console.error(`❌ [Error] ${message}`, error)

    // In production, send to error tracking
    if (!this.isDev && typeof window !== 'undefined') {
      // Send to Sentry, LogRocket, etc.
    }
  }

  enableModule(module: string) {
    this.enabledModules.add(module)
    if (typeof window !== 'undefined') {
      localStorage.setItem('debug_modules', Array.from(this.enabledModules).join(','))
    }
  }

  disableAll() {
    this.enabledModules.clear()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('debug_modules')
    }
  }
}

export const logger = new MoshimoshiLogger()

// Usage:
// logger.streak('Streak updated', { current: 5, longest: 10 })
// logger.pokemon('Pokemon caught', { id: 25, name: 'Pikachu' })

// Enable in browser console:
// logger.enableModule('streak')
// logger.enableModule('pokemon')
// logger.enableModule('*') // Enable all
```

## Benefits of Centralized Logging

1. **Single Source of Truth** - All logging goes through one place
2. **Easy to Control** - Turn on/off with environment variables or feature flags
3. **Consistent Format** - All logs follow the same structure
4. **Performance** - Can be completely disabled in production
5. **Security** - Can filter sensitive data before logging
6. **Debugging** - Can enable specific modules for targeted debugging
7. **Analytics** - Can send logs to analytics services
8. **Error Tracking** - Automatic error reporting to services like Sentry

## Best Practices

1. **Never log sensitive data** (passwords, tokens, PII)
2. **Use appropriate log levels** (debug, info, warn, error)
3. **Include context** (userId, sessionId, feature)
4. **Use structured logging** (JSON format for parsing)
5. **Implement log rotation** (don't let log files grow infinitely)
6. **Use correlation IDs** (track requests across services)
7. **Set up alerts** for error-level logs in production

## Quick Implementation for Moshimoshi

1. Create a centralized logger service
2. Replace all `console.log` with `logger.module()`
3. Control via environment variables or localStorage
4. Add error tracking for production
5. Use browser console to enable/disable modules dynamically

Example migration:
```typescript
// Before:
console.log('[StreakStore] Recording activity:', activity)

// After:
logger.streak('Recording activity', { activity, userId })
```

This approach makes your app professional, maintainable, and production-ready!