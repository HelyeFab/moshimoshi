# Universal Review Engine Documentation

## Overview

The Universal Review Engine is a comprehensive, content-agnostic learning system that powers all review activities in Moshimoshi. It provides a unified interface for reviewing kana, kanji, vocabulary, sentences, and custom content types while leveraging the Spaced Repetition System (SRS) for optimal learning outcomes.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer                             │
│  ReviewEngine.tsx │ ReviewCard.tsx │ SessionSummary.tsx     │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                       API Layer                              │
│  /api/review/session │ /api/review/queue │ /api/review/pin  │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                    Review Engine Core                        │
├─────────────────────────────────────────────────────────────┤
│  Session Manager │ Queue Generator │ Progress Tracker       │
│  SRS Algorithm  │ Pin Manager     │ Achievement System      │
│  Content Adapters │ Validators    │ Event System            │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                             │
│  Firebase Firestore │ Redis Cache │ IndexedDB (Offline)     │
└─────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. ReviewableContent

The universal interface for all content types:

```typescript
interface ReviewableContent {
  id: string                    // Unique identifier
  contentType: ContentType       // kana | kanji | vocabulary | sentence | custom
  primaryDisplay: string         // What the user sees
  primaryAnswer: string          // Expected answer
  alternativeAnswers?: string[]  // Accept these too
  hint?: string                  // Optional help
  metadata?: ContentMetadata     // Type-specific data
  difficulty: number             // 0-1 difficulty score
  tags: string[]                 // jlpt-n5, common, etc.
  supportedModes: ReviewMode[]   // recognition, recall, etc.
  srsData?: SRSData              // Spaced repetition info
  pinned?: boolean               // User pinned for focus
}
```

### 2. Review Modes

Different ways to review content:

- **Recognition**: See content, provide meaning
- **Recall**: See meaning, provide content  
- **Writing**: Draw/type the content
- **Listening**: Audio-based review
- **Speaking**: Voice-based review

### 3. Content Adapters

Transform specific content types into ReviewableContent:

```typescript
// Kana Adapter Example
const kanaAdapter = new KanaAdapter()
const reviewable = kanaAdapter.transform({
  character: 'あ',
  reading: 'a',
  type: 'hiragana'
})
```

### 4. Session Management

Review sessions track progress and timing:

```typescript
interface ReviewSession {
  id: string
  userId: string
  mode: ReviewMode
  contentTypes: ContentType[]
  items: ReviewableContent[]
  progress: SessionProgress
  startedAt: Date
  completedAt?: Date
  configuration: SessionConfig
}
```

## Getting Started

### Basic Review Flow

```typescript
import { ReviewEngine } from '@/lib/review-engine'

// 1. Initialize the engine
const engine = new ReviewEngine({
  userId: 'user-123',
  contentTypes: ['kana', 'kanji'],
  mode: 'recognition',
  itemCount: 20
})

// 2. Start a session
const session = await engine.startSession()

// 3. Get current item
const item = session.getCurrentItem()

// 4. Submit answer
const result = await session.submitAnswer('answer', {
  responseTime: 3000,
  confidence: 4
})

// 5. Move to next item
session.next()

// 6. Complete session
const summary = await session.complete()
```

### Custom Content Types

Register your own content adapters:

```typescript
import { BaseAdapter, ContentAdapter } from '@/lib/review-engine/adapters'

class CustomAdapter extends BaseAdapter implements ContentAdapter {
  transform(item: any): ReviewableContent {
    return {
      id: item.id,
      contentType: 'custom',
      primaryDisplay: item.question,
      primaryAnswer: item.answer,
      // ... map your fields
    }
  }
  
  validate(answer: string, expected: string): boolean {
    // Custom validation logic
    return answer.toLowerCase() === expected.toLowerCase()
  }
}

// Register the adapter
ReviewEngine.registerAdapter('custom', new CustomAdapter())
```

## API Endpoints

### Session Management

#### Start Session
```http
POST /api/review/session/start
Content-Type: application/json

{
  "contentTypes": ["kana", "kanji"],
  "mode": "recognition",
  "itemCount": 20,
  "configuration": {
    "shuffleItems": true,
    "includeNew": true,
    "includeDue": true
  }
}
```

#### Submit Answer
```http
POST /api/review/sessions/{sessionId}
Content-Type: application/json

{
  "itemId": "item-123",
  "answer": "answer",
  "responseTime": 3000,
  "confidence": 4
}
```

#### Get Session Status
```http
GET /api/review/sessions/{sessionId}
```

### Queue Management

#### Get Review Queue
```http
GET /api/review/queue?types=kana,kanji&limit=50
```

#### Get Custom Queue
```http
POST /api/review/queue/custom
Content-Type: application/json

{
  "filters": {
    "tags": ["jlpt-n5"],
    "difficulty": { "min": 0.3, "max": 0.7 }
  },
  "sorting": "srs_priority",
  "limit": 30
}
```

### Pin Management

#### Pin Items
```http
POST /api/review/pin
Content-Type: application/json

{
  "itemIds": ["item-1", "item-2"],
  "releaseStrategy": "manual"
}
```

#### Check Pinned Items
```http
GET /api/review/pin/check
```

## SRS Integration

The review engine deeply integrates with the Spaced Repetition System:

### Algorithm Configuration

```typescript
const srsConfig = {
  initialEaseFactor: 2.5,
  minEaseFactor: 1.3,
  maxEaseFactor: 2.5,
  learningSteps: [0.0069, 0.0208], // 10 min, 30 min
  graduatingInterval: 1,
  maxInterval: 365,
  leechThreshold: 8
}
```

### State Progression

```
NEW → LEARNING → REVIEW → MASTERED
 ↑        ↓         ↓         ↓
 ←────────←─────────←─────────←
      (on failure)
```

### Performance Tracking

```typescript
// Get SRS statistics
const stats = await engine.getStats()
// {
//   total: 1500,
//   new: 100,
//   learning: 200,
//   review: 800,
//   mastered: 400,
//   due: 150,
//   overdue: 50
// }

// Get learning forecast
const forecast = await engine.getForecast(7) // Next 7 days
```

## Offline Support

The engine provides full offline capability:

### IndexedDB Storage

```typescript
// Automatic offline persistence
const engine = new ReviewEngine({
  offline: {
    enabled: true,
    syncInterval: 30000, // 30 seconds
    maxRetries: 3
  }
})

// Manual sync
await engine.syncOffline()
```

### Conflict Resolution

```typescript
// Define merge strategy
engine.setConflictResolver((local, remote) => {
  // Custom logic to resolve conflicts
  return remote.updatedAt > local.updatedAt ? remote : local
})
```

## Progress Tracking

### Session Progress

```typescript
interface SessionProgress {
  completed: number
  remaining: number
  correct: number
  incorrect: number
  accuracy: number
  averageResponseTime: number
  streak: number
  experience: number
}
```

### Achievement System

```typescript
// Listen for achievements
engine.on('achievement', (achievement) => {
  console.log(`Unlocked: ${achievement.name}`)
})

// Achievement types:
// - streak: Daily streak milestones
// - accuracy: High accuracy sessions
// - speed: Fast response times
// - volume: Total items reviewed
// - mastery: Items mastered
```

### Learning Village Integration

Progress automatically syncs with the Learning Village:

```typescript
// Stall progress mapping
// 0-33%: New/Learning items
// 34-66%: Review items
// 67-100%: Mastered items
```

## Validation System

### Built-in Validators

```typescript
// Kana validation (handles variations)
const kanaValidator = new KanaValidator()
kanaValidator.validate('shi', 'し') // true (accepts romaji)

// Kanji validation (handles readings)
const kanjiValidator = new KanjiValidator()
kanjiValidator.validate('sun', '日') // true
kanjiValidator.validate('にち', '日') // true

// Vocabulary validation (fuzzy matching)
const vocabValidator = new VocabularyValidator({
  strictness: 'medium',
  allowSynonyms: true
})
```

### Custom Validators

```typescript
class CustomValidator extends BaseValidator {
  validate(answer: string, expected: string, options?: any): boolean {
    // Your validation logic
    return this.normalize(answer) === this.normalize(expected)
  }
  
  normalize(text: string): string {
    // Custom normalization
    return text.toLowerCase().trim()
  }
}
```

## Event System

The engine emits events for tracking and integration:

```typescript
// Available events
engine.on('session:start', (session) => {})
engine.on('session:complete', (summary) => {})
engine.on('item:answered', (result) => {})
engine.on('progress:update', (progress) => {})
engine.on('achievement:unlocked', (achievement) => {})
engine.on('sync:complete', (stats) => {})
engine.on('error', (error) => {})

// Event payloads include detailed information
engine.on('item:answered', (event) => {
  console.log(`
    Item: ${event.itemId}
    Correct: ${event.correct}
    Time: ${event.responseTime}ms
    New SRS: ${event.srsData.nextReviewAt}
  `)
})
```

## WebSocket Support

Real-time updates for collaborative features:

```typescript
import { ReviewWebSocket } from '@/lib/review-engine/websocket'

const ws = new ReviewWebSocket({
  url: process.env.NEXT_PUBLIC_WS_URL,
  reconnect: true
})

// Listen for real-time updates
ws.on('progress:sync', (data) => {
  // Update UI with other users' progress
})

// Broadcast your progress
ws.emit('progress:update', progress)
```

## Performance Optimization

### Caching Strategy

```typescript
// Redis caching for frequently accessed data
const engine = new ReviewEngine({
  cache: {
    enabled: true,
    ttl: 3600, // 1 hour
    strategy: 'lru'
  }
})
```

### Queue Optimization

```typescript
// Intelligent queue generation
const queue = await engine.generateQueue({
  algorithm: 'balanced', // balanced | priority | random
  balanceFactors: {
    difficulty: 0.3,
    srsUrgency: 0.5,
    userPreference: 0.2
  }
})
```

### Batch Operations

```typescript
// Process multiple reviews efficiently
const results = await engine.batchSubmit([
  { itemId: 'item-1', answer: 'answer1' },
  { itemId: 'item-2', answer: 'answer2' },
  { itemId: 'item-3', answer: 'answer3' }
])
```

## Testing

### Unit Tests

```bash
# Run all review engine tests
npm test src/lib/review-engine

# Run specific module tests
npm test src/lib/review-engine/srs
npm test src/lib/review-engine/adapters
npm test src/lib/review-engine/validation
```

### Integration Tests

```bash
# Test full review flow
npm run test:integration review-engine

# Test offline sync
npm run test:offline review-engine
```

### Performance Tests

```bash
# Benchmark SRS calculations
npm run bench:srs

# Stress test with large datasets
npm run stress:review-engine -- --items=10000
```

## Configuration Reference

### Complete Configuration Object

```typescript
interface ReviewEngineConfig {
  // Core settings
  userId: string
  contentTypes: ContentType[]
  mode: ReviewMode
  
  // Session settings
  session: {
    itemCount: number
    timeLimit?: number // minutes
    shuffleItems: boolean
    allowSkip: boolean
    showProgress: boolean
  }
  
  // SRS settings
  srs: {
    enabled: boolean
    algorithm: 'sm2' | 'fsrs'
    config: SRSConfig
  }
  
  // Queue settings
  queue: {
    includeNew: boolean
    includeDue: boolean
    includeOverdue: boolean
    priorityWeights: {
      overdue: number
      due: number
      new: number
    }
  }
  
  // Validation settings
  validation: {
    strictness: 'strict' | 'medium' | 'lenient'
    allowTypos: boolean
    maxTypoDistance: number
    caseSensitive: boolean
  }
  
  // Progress settings
  progress: {
    trackAccuracy: boolean
    trackSpeed: boolean
    trackStreak: boolean
    updateInterval: number // ms
  }
  
  // Offline settings
  offline: {
    enabled: boolean
    syncInterval: number
    maxRetries: number
    conflictResolution: 'local' | 'remote' | 'custom'
  }
  
  // Cache settings
  cache: {
    enabled: boolean
    provider: 'redis' | 'memory'
    ttl: number
    maxSize: number
  }
  
  // WebSocket settings
  websocket: {
    enabled: boolean
    url: string
    reconnect: boolean
    maxReconnectAttempts: number
  }
  
  // Achievement settings
  achievements: {
    enabled: boolean
    notifications: boolean
    sound: boolean
  }
  
  // Analytics settings
  analytics: {
    enabled: boolean
    trackingId: string
    sampleRate: number
  }
}
```

## Best Practices

### 1. Session Configuration

```typescript
// Optimal session for beginners
const beginnerSession = {
  itemCount: 10,
  mode: 'recognition',
  validation: { strictness: 'lenient' },
  includeNew: true,
  includeDue: false
}

// Optimal session for advanced users
const advancedSession = {
  itemCount: 30,
  mode: 'recall',
  validation: { strictness: 'strict' },
  includeNew: false,
  includeDue: true,
  includeOverdue: true
}
```

### 2. Error Handling

```typescript
try {
  const result = await engine.submitAnswer(answer)
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
    showHint(error.hint)
  } else if (error instanceof NetworkError) {
    // Handle offline scenario
    await engine.queueForSync(answer)
  } else {
    // Generic error handling
    console.error('Review error:', error)
  }
}
```

### 3. Performance Monitoring

```typescript
// Track session performance
engine.on('session:complete', (summary) => {
  analytics.track('Review Session', {
    duration: summary.duration,
    accuracy: summary.accuracy,
    itemsReviewed: summary.itemCount,
    averageResponseTime: summary.avgResponseTime
  })
})
```

### 4. Progressive Enhancement

```typescript
// Start with basic features, enhance progressively
const engine = new ReviewEngine({
  // Core features (always enabled)
  contentTypes: ['kana'],
  mode: 'recognition',
  
  // Enhanced features (check support)
  websocket: { enabled: supportsWebSocket() },
  offline: { enabled: supportsIndexedDB() },
  analytics: { enabled: hasConsent() }
})
```

## Troubleshooting

### Common Issues

#### Items Not Appearing in Queue
- Check SRS next review dates
- Verify content type filters
- Ensure items aren't pinned
- Check user entitlements

#### Validation Always Failing
- Review validator configuration
- Check answer normalization
- Verify alternative answers
- Test with exact expected answer

#### Offline Sync Not Working
- Verify IndexedDB support
- Check sync interval settings
- Review conflict resolution
- Monitor sync events

#### Poor Performance
- Reduce session item count
- Enable caching
- Use batch operations
- Optimize queue generation

### Debug Mode

```typescript
// Enable debug logging
const engine = new ReviewEngine({
  debug: true,
  logLevel: 'verbose'
})

// Debug specific modules
engine.enableDebug(['srs', 'validation', 'sync'])

// Performance profiling
engine.profile((metrics) => {
  console.table(metrics)
})
```

## Migration Guide

### From Legacy Review System

```typescript
// Old system
const items = await getReviewItems()
items.forEach(item => {
  reviewItem(item)
})

// New Universal Review Engine
const engine = new ReviewEngine(config)
const session = await engine.startSession()
await session.reviewAll()
```

### Custom Content Migration

```typescript
// 1. Create adapter for your content
class LegacyAdapter extends BaseAdapter {
  transform(legacy) {
    return {
      id: legacy.uuid,
      contentType: 'custom',
      primaryDisplay: legacy.question,
      primaryAnswer: legacy.answer,
      // Map other fields
    }
  }
}

// 2. Register adapter
ReviewEngine.registerAdapter('legacy', new LegacyAdapter())

// 3. Use in sessions
const engine = new ReviewEngine({
  contentTypes: ['legacy']
})
```

## Roadmap

### Upcoming Features

- **FSRS Algorithm**: More accurate spacing algorithm
- **Multi-device Sync**: Seamless cross-device progress
- **AI Difficulty**: ML-based difficulty prediction
- **Voice Review**: Native speech recognition
- **Collaborative Learning**: Study groups and competitions
- **Advanced Analytics**: Detailed learning insights
- **Custom Review Strategies**: User-defined algorithms
- **Gamification**: More engaging review experience

## Support

For issues, questions, or contributions:

- GitHub Issues: [moshimoshi/issues](https://github.com/moshimoshi/issues)
- Documentation: [docs.moshimoshi.app](https://docs.moshimoshi.app)
- Discord: [Join our community](https://discord.gg/moshimoshi)

## License

Copyright © 2024 Moshimoshi. All rights reserved.