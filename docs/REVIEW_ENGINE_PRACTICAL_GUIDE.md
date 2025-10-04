# Universal Review Engine - Practical Implementation Guide

## Quick Reference

### File Locations Map

```bash
# Core Engine Files
src/lib/review-engine/core/interfaces.ts         # Main type definitions
src/lib/review-engine/core/types.ts              # Supporting types
src/lib/review-engine/core/events.ts             # Event system

# SRS Algorithm
src/lib/review-engine/srs/algorithm.ts           # Main SRS implementation
src/lib/review-engine/srs/state-manager.ts       # State transitions
src/lib/review-engine/srs/difficulty.ts          # Difficulty calculations

# Content Adapters
src/lib/review-engine/adapters/registry.ts       # Adapter registry
src/lib/review-engine/adapters/KanaAdapter.ts    # Hiragana/Katakana
src/lib/review-engine/adapters/KanjiAdapter.ts   # Kanji
src/lib/review-engine/adapters/VocabularyAdapter.ts # Vocabulary

# Validation
src/lib/review-engine/validation/factory.ts      # Validator factory
src/lib/review-engine/validation/BaseValidator.ts # Base validation logic
src/lib/review-engine/validation/KanjiValidator.ts # Kanji-specific

# Session Management
src/lib/review-engine/session/manager.ts         # Main session manager
src/lib/review-engine/session/statistics.ts      # Stats tracking

# React Components
src/components/review-engine/ReviewEngine.tsx    # Main component
src/components/review-engine/ReviewCard.tsx      # Card display
src/components/review-engine/AnswerInput.tsx     # Input handling
src/hooks/useReviewEngine.ts                     # React hook

# API Routes
src/app/api/review/session/start/route.ts        # Start session
src/app/api/review/sessions/[sessionId]/route.ts # Session operations
```

## Common Tasks & Solutions

### 1. Adding a New Content Type

**Task**: Add support for grammar patterns

```typescript
// Step 1: Create the adapter
// File: src/lib/review-engine/adapters/GrammarAdapter.ts

import { BaseContentAdapter } from './BaseContentAdapter'
import { ReviewableContent } from '../core/interfaces'

export class GrammarAdapter extends BaseContentAdapter<GrammarContent> {
  transform(grammar: GrammarContent): ReviewableContent {
    return {
      id: grammar.id,
      contentType: 'grammar',
      primaryDisplay: grammar.pattern,          // e.g., "〜ています"
      secondaryDisplay: grammar.meaning,        // e.g., "continuous action"
      tertiaryDisplay: grammar.example,         // e.g., "本を読んでいます"
      primaryAnswer: grammar.translation,
      alternativeAnswers: grammar.alternatives,
      difficulty: this.calculateDifficulty(grammar),
      tags: ['grammar', `jlpt-n${grammar.jlptLevel}`],
      supportedModes: ['recognition', 'recall'],
      metadata: {
        conjugationType: grammar.conjugationType,
        formality: grammar.formality
      }
    }
  }
  
  generateOptions(grammar: GrammarContent, count: number): string[] {
    // Get similar grammar patterns as distractors
    const similar = this.getSimilarPatterns(grammar.pattern)
    return this.shuffle([grammar.translation, ...similar]).slice(0, count)
  }
  
  calculateDifficulty(grammar: GrammarContent): number {
    const jlptDifficulty = (6 - grammar.jlptLevel) / 5
    const complexityScore = grammar.complexity / 10
    return (jlptDifficulty + complexityScore) / 2
  }
}

// Step 2: Register the adapter
// File: src/lib/review-engine/adapters/registry.ts

import { GrammarAdapter } from './GrammarAdapter'

// In initialization code:
registry.register('grammar', new GrammarAdapter())

// Step 3: Create validator
// File: src/lib/review-engine/validation/GrammarValidator.ts

export class GrammarValidator extends BaseValidator {
  validate(
    userAnswer: string,
    correctAnswer: string | string[],
    context?: GrammarContext
  ): ValidationResult {
    // Allow flexibility in translation
    const normalized = this.normalizeGrammar(userAnswer)
    const correct = this.checkGrammarEquivalence(normalized, correctAnswer)
    
    return {
      correct,
      score: correct ? 1.0 : 0,
      feedback: correct ? 'Correct!' : 'Try again',
      expectedAnswer: Array.isArray(correctAnswer) ? correctAnswer[0] : correctAnswer
    }
  }
  
  private normalizeGrammar(text: string): string {
    return text
      .toLowerCase()
      .replace(/[.,!?]/g, '')  // Remove punctuation
      .replace(/\s+/g, ' ')     // Normalize spaces
      .trim()
  }
}
```

### 2. Customizing SRS Algorithm

**Task**: Make SRS more forgiving for beginners

```typescript
// File: src/lib/review-engine/srs/configs/beginner.ts

export const BEGINNER_SRS_CONFIG: SRSConfig = {
  // More forgiving ease factors
  initialEaseFactor: 2.8,      // Higher starting ease
  minEaseFactor: 1.5,          // Higher minimum
  maxEaseFactor: 3.0,          // Higher maximum
  
  // Shorter learning steps
  learningSteps: [0.0035, 0.0104, 0.0208], // 5min, 15min, 30min
  graduatingInterval: 1,
  
  // More forgiving multipliers
  easyMultiplier: 1.5,         // Bigger boost for easy
  hardMultiplier: 0.8,         // Smaller penalty for hard
  
  // Other settings
  maxInterval: 180,           // 6 months max (shorter)
  leechThreshold: 12          // More attempts before leech
}

// Usage in session initialization:
const session = new SessionManager({
  srsConfig: BEGINNER_SRS_CONFIG,
  // ... other config
})
```

### 3. Implementing Custom Review Mode

**Task**: Add a "writing practice" mode for kanji

```typescript
// File: src/lib/review-engine/modes/writing.ts

export class WritingMode implements ReviewMode {
  name = 'writing'
  
  prepareContent(content: ReviewableContent): ReviewModeContent {
    return {
      display: {
        primary: content.secondaryDisplay,    // Show meaning
        secondary: content.tertiaryDisplay,   // Show reading
        hideCharacter: true                   // Don't show the kanji
      },
      expectedInput: 'canvas',                // Expect drawing input
      validation: 'stroke-order',             // Special validation
      hints: this.generateStrokeHints(content)
    }
  }
  
  validateAnswer(
    strokes: StrokeData[],
    correctKanji: string
  ): ValidationResult {
    const strokeOrder = this.getStrokeOrder(correctKanji)
    const accuracy = this.compareStrokes(strokes, strokeOrder)
    
    return {
      correct: accuracy > 0.8,
      score: accuracy,
      feedback: this.getStrokeFeedback(accuracy),
      details: {
        correctStrokes: strokeOrder.length,
        userStrokes: strokes.length,
        orderAccuracy: this.checkStrokeOrder(strokes, strokeOrder)
      }
    }
  }
}

// Register the mode
// File: src/lib/review-engine/modes/registry.ts
modeRegistry.register('writing', new WritingMode())
```

### 4. Handling Offline Sessions

**Task**: Ensure sessions work offline and sync when reconnected

```typescript
// File: src/lib/review-engine/offline/session-sync.ts

export class OfflineSessionManager {
  private db: IndexedDBAdapter
  private syncQueue: SyncQueue
  
  async saveSession(session: ReviewSession): Promise<void> {
    // Save to IndexedDB immediately
    await this.db.sessions.put(session)
    
    // Queue for sync if online
    if (navigator.onLine) {
      await this.syncSession(session)
    } else {
      await this.syncQueue.add({
        type: 'session',
        data: session,
        timestamp: Date.now()
      })
    }
  }
  
  async syncSession(session: ReviewSession): Promise<void> {
    try {
      // Attempt to sync with server
      const response = await fetch('/api/review/sessions/sync', {
        method: 'POST',
        body: JSON.stringify(session)
      })
      
      if (!response.ok) {
        throw new Error('Sync failed')
      }
      
      // Mark as synced in IndexedDB
      await this.db.sessions.update(session.id, {
        syncStatus: 'synced',
        syncedAt: new Date()
      })
    } catch (error) {
      // Will retry later
      console.error('Sync failed, will retry:', error)
    }
  }
  
  // Set up automatic sync on reconnection
  setupAutoSync() {
    window.addEventListener('online', async () => {
      const pending = await this.syncQueue.getAll()
      
      for (const item of pending) {
        await this.syncSession(item.data)
        await this.syncQueue.remove(item.id)
      }
    })
  }
}
```

### 5. Performance Optimization

**Task**: Optimize queue generation for 1000+ items

```typescript
// File: src/lib/review-engine/queue/optimized-generator.ts

export class OptimizedQueueGenerator {
  private cache = new Map<string, QueueItem[]>()
  
  async generateQueue(
    userId: string,
    options: QueueOptions
  ): Promise<QueueResult> {
    const cacheKey = this.getCacheKey(userId, options)
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return { items: this.cache.get(cacheKey)!, fromCache: true }
    }
    
    // Use Web Worker for heavy computation
    const items = await this.generateInWorker(userId, options)
    
    // Cache for 5 minutes
    this.cache.set(cacheKey, items)
    setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000)
    
    return { items, fromCache: false }
  }
  
  private async generateInWorker(
    userId: string,
    options: QueueOptions
  ): Promise<QueueItem[]> {
    return new Promise((resolve) => {
      const worker = new Worker('/workers/queue-generator.js')
      
      worker.postMessage({ userId, options })
      
      worker.onmessage = (e) => {
        resolve(e.data.items)
        worker.terminate()
      }
    })
  }
}

// Worker file: public/workers/queue-generator.js
self.onmessage = async (e) => {
  const { userId, options } = e.data
  
  // Fetch items in batches
  const items = await fetchItemsInBatches(userId, options)
  
  // Calculate priorities in parallel chunks
  const prioritized = await Promise.all(
    chunkArray(items, 100).map(chunk =>
      chunk.map(item => ({
        ...item,
        priority: calculatePriority(item)
      }))
    )
  ).then(chunks => chunks.flat())
  
  // Sort and shuffle
  const sorted = prioritized.sort((a, b) => b.priority - a.priority)
  const shuffled = smartShuffle(sorted)
  
  self.postMessage({ items: shuffled })
}
```

### 6. Custom Validation Rules

**Task**: Allow typos in vocabulary answers

```typescript
// File: src/lib/review-engine/validation/typo-tolerant.ts

export class TypoTolerantValidator extends BaseValidator {
  private readonly TYPO_THRESHOLD = 0.85 // 85% similarity required
  
  validate(
    userAnswer: string,
    correctAnswer: string | string[]
  ): ValidationResult {
    const normalized = this.normalize(userAnswer)
    const correctAnswers = Array.isArray(correctAnswer) 
      ? correctAnswer 
      : [correctAnswer]
    
    // Check exact match first
    if (correctAnswers.includes(normalized)) {
      return { correct: true, score: 1.0, feedback: 'Perfect!' }
    }
    
    // Check for typos
    for (const correct of correctAnswers) {
      const similarity = this.calculateSimilarity(normalized, correct)
      
      if (similarity >= this.TYPO_THRESHOLD) {
        return {
          correct: true,
          score: similarity,
          feedback: `Close! Did you mean "${correct}"?`,
          warning: 'minor_typo',
          suggestion: correct
        }
      }
    }
    
    // Check if it's a different valid word (wrong answer)
    if (this.isValidWord(normalized)) {
      return {
        correct: false,
        score: 0,
        feedback: 'That\'s a different word',
        expectedAnswer: correctAnswers[0]
      }
    }
    
    return {
      correct: false,
      score: 0,
      feedback: 'Incorrect',
      expectedAnswer: correctAnswers[0]
    }
  }
  
  private calculateSimilarity(a: string, b: string): number {
    // Use Damerau-Levenshtein for transposition support
    const distance = this.damerauLevenshteinDistance(a, b)
    const maxLength = Math.max(a.length, b.length)
    return 1 - (distance / maxLength)
  }
}
```

### 7. Implementing Achievements

**Task**: Add achievement system for milestones

```typescript
// File: src/lib/review-engine/achievements/tracker.ts

export class AchievementTracker {
  private achievements = new Map<string, Achievement>()
  
  async checkAchievements(
    session: ReviewSession,
    userStats: UserStatistics
  ): Promise<Achievement[]> {
    const unlocked: Achievement[] = []
    
    // Check streak achievements
    if (userStats.currentStreak === 7) {
      unlocked.push(this.unlock('week_warrior', session.userId))
    }
    if (userStats.currentStreak === 30) {
      unlocked.push(this.unlock('monthly_master', session.userId))
    }
    
    // Check accuracy achievements
    const accuracy = session.stats.correctCount / session.stats.totalAnswered
    if (accuracy === 1.0 && session.stats.totalAnswered >= 20) {
      unlocked.push(this.unlock('perfect_session', session.userId))
    }
    
    // Check speed achievements
    const avgTime = session.stats.totalTime / session.stats.totalAnswered
    if (avgTime < 3000 && session.stats.totalAnswered >= 20) {
      unlocked.push(this.unlock('speed_demon', session.userId))
    }
    
    // Check total reviews
    if (userStats.totalReviews >= 1000) {
      unlocked.push(this.unlock('thousand_reviews', session.userId))
    }
    
    // Emit events for unlocked achievements
    for (const achievement of unlocked) {
      this.emitAchievementEvent(achievement)
    }
    
    return unlocked
  }
  
  private unlock(achievementId: string, userId: string): Achievement {
    return {
      id: achievementId,
      name: ACHIEVEMENT_DATA[achievementId].name,
      description: ACHIEVEMENT_DATA[achievementId].description,
      icon: ACHIEVEMENT_DATA[achievementId].icon,
      unlockedAt: new Date(),
      userId
    }
  }
}

// Achievement definitions
const ACHIEVEMENT_DATA = {
  week_warrior: {
    name: 'Week Warrior',
    description: '7 day streak!',
    icon: '🔥'
  },
  monthly_master: {
    name: 'Monthly Master',
    description: '30 day streak!',
    icon: '👑'
  },
  perfect_session: {
    name: 'Perfect Session',
    description: '100% accuracy in 20+ reviews',
    icon: '⭐'
  },
  speed_demon: {
    name: 'Speed Demon',
    description: 'Average < 3s per review',
    icon: '⚡'
  },
  thousand_reviews: {
    name: 'Millennium',
    description: '1000 total reviews',
    icon: '🎯'
  }
}
```

### 8. Testing Strategies

**Task**: Write comprehensive tests for the review engine

```typescript
// File: src/lib/review-engine/__tests__/integration.test.ts

describe('Review Engine Integration', () => {
  let engine: ReviewEngine
  let mockData: MockDataFactory
  
  beforeEach(() => {
    engine = new ReviewEngine()
    mockData = new MockDataFactory()
  })
  
  describe('Complete Session Flow', () => {
    it('should handle a full review session', async () => {
      // Setup
      const items = mockData.createKanjiItems(10)
      const session = await engine.startSession({
        items,
        mode: 'recognition',
        userId: 'test-user'
      })
      
      expect(session.status).toBe('active')
      expect(session.items).toHaveLength(10)
      
      // Review all items
      for (let i = 0; i < 10; i++) {
        const current = engine.getCurrentItem()
        expect(current).toBeDefined()
        
        // Submit answer
        const result = await engine.submitAnswer(
          current.content.primaryAnswer,
          0.9
        )
        
        expect(result.correct).toBe(true)
        expect(result.score).toBeGreaterThan(80)
        
        // Move to next
        if (i < 9) {
          engine.nextItem()
        }
      }
      
      // Complete session
      const summary = await engine.completeSession()
      expect(summary.stats.totalAnswered).toBe(10)
      expect(summary.stats.correctCount).toBe(10)
      expect(summary.stats.accuracy).toBe(1.0)
    })
  })
  
  describe('Error Recovery', () => {
    it('should recover from network failures', async () => {
      // Simulate offline
      const originalFetch = global.fetch
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
      
      const session = await engine.startSession({
        items: mockData.createKanjiItems(5),
        mode: 'recall',
        userId: 'test-user'
      })
      
      // Should work offline
      expect(session).toBeDefined()
      expect(session.offline).toBe(true)
      
      // Submit answers offline
      await engine.submitAnswer('test', 0.5)
      
      // Restore network
      global.fetch = originalFetch
      
      // Should sync when online
      await engine.syncOfflineData()
      
      const synced = await engine.getSession(session.id)
      expect(synced.offline).toBe(false)
    })
  })
  
  describe('Performance', () => {
    it('should generate queue for 1000 items in <100ms', async () => {
      const items = mockData.createBulkItems(1000)
      
      const start = performance.now()
      const queue = await engine.generateQueue({
        items,
        limit: 1000
      })
      const duration = performance.now() - start
      
      expect(duration).toBeLessThan(100)
      expect(queue.items).toHaveLength(1000)
    })
    
    it('should calculate SRS for item in <10ms', () => {
      const item = mockData.createSRSItem()
      
      const start = performance.now()
      const updated = engine.calculateSRS(item, { correct: true })
      const duration = performance.now() - start
      
      expect(duration).toBeLessThan(10)
      expect(updated.interval).toBeGreaterThan(item.interval)
    })
  })
})
```

## Debugging Guide

### Common Issues & Solutions

#### 1. Session Not Saving

```typescript
// Check IndexedDB
const db = await openDB('moshimoshi-offline')
const sessions = await db.getAll('sessions')
console.log('Stored sessions:', sessions)

// Check sync queue
const syncQueue = await db.getAll('syncQueue')
console.log('Pending sync:', syncQueue)

// Force sync
await offlineManager.forceSyncAll()
```

#### 2. SRS Calculations Wrong

```typescript
// Enable debug logging
localStorage.setItem('debug:srs', 'true')

// Log all calculations
const original = srsAlgorithm.calculateNext
srsAlgorithm.calculateNext = function(item, response) {
  console.log('Input:', { item, response })
  const result = original.call(this, item, response)
  console.log('Output:', result)
  return result
}
```

#### 3. Validation Too Strict/Lenient

```typescript
// Test validation directly
const validator = new KanjiValidator()
const testCases = [
  { input: 'water', expected: 'water', shouldPass: true },
  { input: 'watr', expected: 'water', shouldPass: false },
  { input: 'Water', expected: 'water', shouldPass: true }
]

for (const test of testCases) {
  const result = validator.validate(test.input, test.expected)
  console.log({
    ...test,
    result,
    passed: result.correct === test.shouldPass
  })
}
```

#### 4. Performance Issues

```typescript
// Profile specific operations
console.profile('Queue Generation')
const queue = await generator.generateQueue(userId, options)
console.profileEnd('Queue Generation')

// Measure with Performance API
performance.mark('queue-start')
const queue = await generator.generateQueue(userId, options)
performance.mark('queue-end')
performance.measure('queue-generation', 'queue-start', 'queue-end')

const measure = performance.getEntriesByName('queue-generation')[0]
console.log(`Queue generation took ${measure.duration}ms`)
```

## Advanced Patterns

### Event-Driven Architecture

```typescript
// Custom event handlers
engine.on('item-answered', (payload) => {
  // Update UI
  updateProgressBar(payload.progress)
  
  // Play sound effect
  if (payload.correct) {
    playSound('correct')
  }
  
  // Track analytics
  analytics.track('review_answer', {
    correct: payload.correct,
    responseTime: payload.responseTime,
    contentType: payload.contentType
  })
})

engine.on('achievement-unlocked', (achievement) => {
  showAchievementNotification(achievement)
  updateUserProfile(achievement)
})

engine.on('streak-milestone', (streak) => {
  if (streak % 7 === 0) {
    showStreakCelebration(streak)
  }
})
```

### Plugin System

```typescript
// Create a plugin
class CustomScoringPlugin implements ReviewEnginePlugin {
  name = 'custom-scoring'
  
  onInit(engine: ReviewEngine) {
    // Override scoring calculation
    engine.calculateScore = this.customScore.bind(this)
  }
  
  customScore(validation: ValidationResult, context: ScoreContext): number {
    let score = validation.score * 100
    
    // Bonus for speed
    if (context.responseTime < 2000) {
      score += 10
    }
    
    // Penalty for hints
    score -= context.hintsUsed * 5
    
    // Confidence adjustment
    if (context.confidence > 0.9 && validation.correct) {
      score += 5
    }
    
    return Math.min(100, Math.max(0, score))
  }
}

// Register plugin
engine.registerPlugin(new CustomScoringPlugin())
```

---

This practical guide provides ready-to-use code snippets and solutions for common Review Engine implementation tasks.