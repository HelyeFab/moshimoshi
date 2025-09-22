# Logger Usage Examples

## Quick Start

The app now uses a professional logging system that automatically switches between:
- **Debug module** in development (lightweight, namespace-based)
- **Pino** in production (high-performance, structured)

## Basic Usage

```typescript
// Import the unified logger
import logger from '@/lib/logger'

// Use module-specific methods
logger.streak('Streak updated', { current: 5 })
logger.pokemon('Pokemon caught', { id: 25 })
logger.auth('User logged in', { userId: user.id })
logger.review('Review completed', { score: 0.85 })
logger.error('Failed to sync', error)
```

## Browser Console Controls (Development)

### Enable Logging
Open browser console and run:

```javascript
// Enable all logs
localStorage.debug = 'app:*'

// Enable specific modules only
localStorage.debug = 'app:streak'
localStorage.debug = 'app:streak,app:pokemon'

// Or use the helper
debug.enable('app:*')
```

### Disable Logging
```javascript
// Disable all
localStorage.debug = ''

// Or use helper
debug.disable()
```

### Check Status
```javascript
// See what's enabled
debug.status()
```

## Real-World Examples

### In Streak Store
```typescript
import logger from '@/lib/logger'

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      recordActivity: (activity: StreakActivity) => {
        logger.streak('Recording activity', { activity, timestamp: Date.now() })

        // ... streak logic ...

        if (daysDiff > 1) {
          logger.streak('Gap detected, resetting streak', { daysDiff })
          // ... reset logic ...
        }
      }
    })
  )
)
```

### In Review Engine
```typescript
import logger from '@/lib/logger'

export function processReview(item: ReviewItem, answer: string) {
  logger.review('Processing review', { itemId: item.id, type: item.type })

  try {
    const result = validateAnswer(item, answer)
    logger.review('Review validated', { correct: result.isCorrect })
    return result
  } catch (error) {
    logger.error('Review validation failed', error)
    throw error
  }
}
```

### In API Routes
```typescript
import logger from '@/lib/logger'

export async function POST(req: Request) {
  const { userId, action } = await req.json()

  logger.api('API request received', { endpoint: '/api/sync', userId })

  try {
    const result = await syncUserData(userId)
    logger.sync('Sync completed', { userId, items: result.count })
    return Response.json(result)
  } catch (error) {
    logger.error('Sync failed', error)
    return Response.json({ error: 'Sync failed' }, { status: 500 })
  }
}
```

## Performance Tips

1. **Development**: Use namespace filtering to reduce noise
   ```javascript
   localStorage.debug = 'app:streak,app:review' // Only these two
   ```

2. **Production**: Logs are automatically optimized by Pino
   - Only errors are logged by default
   - Structured format for log aggregation services

3. **Conditional Logging**: Already handled by the logger
   ```typescript
   // This won't execute in production (except errors)
   logger.streak('Debug info', expensiveComputation())
   ```

## Available Modules

| Module | Purpose | Example |
|--------|---------|---------|
| `app:streak` | Streak tracking | User activity, streak calculations |
| `app:pokemon` | Pokemon features | Catches, evolutions, battles |
| `app:auth` | Authentication | Login, logout, session management |
| `app:review` | Review system | SRS calculations, validations |
| `app:achievement` | Achievements | Unlocks, progress tracking |
| `app:sync` | Data sync | Firebase operations, offline sync |
| `app:kanji` | Kanji features | Character lookups, learning |
| `app:kana` | Kana features | Hiragana/Katakana operations |
| `app:api` | API calls | Request/response logging |
| `app:db` | Database | Queries, transactions |

## Migration from console.log

Replace all `console.log` statements with appropriate logger calls:

```typescript
// Before
console.log('Streak updated:', currentStreak)
console.log('[Pokemon] Caught:', pokemonName)
console.error('Error:', error)

// After
logger.streak('Streak updated', { current: currentStreak })
logger.pokemon('Pokemon caught', { name: pokemonName })
logger.error('Operation failed', error)
```

## Testing

```bash
# Run with debug enabled
DEBUG=app:* npm run dev

# Run specific modules only
DEBUG=app:streak,app:review npm run dev

# Run tests with logging
DEBUG=app:* npm test
```

## Production Considerations

In production, the logger automatically:
- Switches to Pino for performance
- Only logs errors by default
- Outputs structured JSON for log aggregation
- Includes metadata (timestamp, environment, git commit)

## Environment Variables

```bash
# Development
DEBUG=app:*           # Enable all debug logging
LOG_LEVEL=debug      # Pino log level

# Production
LOG_LEVEL=error      # Only log errors
```