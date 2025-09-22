# Universal Review Engine - Complete Technical Deep Dive

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Type System](#core-type-system)
3. [SRS Algorithm Implementation](#srs-algorithm-implementation)
4. [Content Adapter System](#content-adapter-system)
5. [Validation System](#validation-system)
6. [Session Management](#session-management)
7. [Queue Generation](#queue-generation)
8. [Offline Functionality](#offline-functionality)
9. [Code Examples](#code-examples)
10. [Performance Optimization](#performance-optimization)

## Architecture Overview

The Universal Review Engine is built with a modular, event-driven architecture consisting of 71 files organized into specialized modules:

```
/src/lib/review-engine/
├── core/           # Type definitions and interfaces
├── adapters/       # Content transformation layer
├── srs/           # Spaced repetition algorithm
├── session/       # Session lifecycle management
├── validation/    # Answer validation system
├── offline/       # Offline sync and storage
├── queue/         # Review queue generation
├── pinning/       # Content pinning system
├── progress/      # Progress tracking
├── resilience/    # Error handling and retries
├── api/          # API client
├── websocket/    # Real-time communication
└── __tests__/    # Comprehensive test suite
```

## Core Type System

### ReviewableContent Interface

The heart of the system - all content types must conform to this interface:

```typescript
interface ReviewableContent {
  id: string
  contentType: 'kana' | 'kanji' | 'vocabulary' | 'sentence' | 'phrase' | 'grammar' | 'custom'
  
  // Display fields
  primaryDisplay: string        // What the user sees (e.g., "水")
  secondaryDisplay?: string     // Supporting info (e.g., "water")
  tertiaryDisplay?: string     // Additional context (e.g., "みず")
  
  // Answer validation
  primaryAnswer: string         // Expected answer
  alternativeAnswers?: string[] // Acceptable alternatives
  
  // Media support
  audioUrl?: string            // For listening mode
  imageUrl?: string           // Visual aids
  videoUrl?: string          // Video content
  
  // Metadata
  difficulty: number          // 0.0 to 1.0
  tags: string[]             // Categorization
  source?: string           // Content source (e.g., "Genki Chapter 3")
  
  // Review configuration
  supportedModes: ReviewMode[] // ['recognition', 'recall', 'listening']
  preferredMode?: ReviewMode   // Default mode
  metadata?: Record<string, any> // Content-specific data
}
```

### Review Session Structure

```typescript
interface ReviewSession {
  id: string
  userId: string
  startedAt: Date
  lastActivityAt: Date
  
  // Session items
  items: ReviewSessionItem[]
  currentIndex: number
  
  // Configuration
  mode: ReviewMode
  config: ReviewModeConfig
  
  // Status tracking
  status: 'active' | 'paused' | 'completed' | 'abandoned'
  source: 'manual' | 'scheduled' | 'quick' | 'test'
  
  // Statistics
  stats: SessionStatistics
}

interface ReviewSessionItem {
  content: ReviewableContent
  srsData?: SRSData
  attempts: number
  hintsUsed: number
  responseTime?: number
  lastAnswer?: string
  validation?: ValidationResult
  finalScore?: number
  confidence?: number
}
```

## SRS Algorithm Implementation

### Core Algorithm (SM-2 with Enhancements)

Location: `/src/lib/review-engine/srs/algorithm.ts`

```typescript
class SRSAlgorithm {
  calculateNext(item: SRSData, response: ReviewResponse): SRSData {
    const { correct, responseTime, confidence } = response
    
    // Calculate performance factor
    const performanceFactor = this.calculatePerformance(
      correct, 
      responseTime, 
      confidence
    )
    
    // Update ease factor
    const newEaseFactor = this.updateEaseFactor(
      item.easeFactor,
      performanceFactor
    )
    
    // Calculate next interval
    const nextInterval = this.calculateInterval(
      item.interval,
      newEaseFactor,
      item.consecutiveCorrect,
      correct
    )
    
    // Update state
    const newState = this.determineState(
      nextInterval,
      item.consecutiveCorrect,
      correct
    )
    
    return {
      ...item,
      easeFactor: newEaseFactor,
      interval: nextInterval,
      nextReviewDate: addDays(new Date(), nextInterval),
      state: newState,
      consecutiveCorrect: correct ? item.consecutiveCorrect + 1 : 0,
      totalReviews: item.totalReviews + 1,
      successRate: this.updateSuccessRate(item, correct)
    }
  }
  
  private calculateInterval(
    currentInterval: number,
    easeFactor: number,
    consecutiveCorrect: number,
    correct: boolean
  ): number {
    if (!correct) {
      // Failed - reset to learning phase
      return 0.0069 // 10 minutes
    }
    
    if (consecutiveCorrect === 0) {
      return 0.0208 // 30 minutes (second learning step)
    }
    
    if (consecutiveCorrect === 1) {
      return 1 // 1 day (graduating interval)
    }
    
    // Apply ease factor for subsequent reviews
    const newInterval = currentInterval * easeFactor
    
    // Cap at maximum interval
    return Math.min(newInterval, this.config.maxInterval)
  }
}
```

### State Progression

```
NEW (never seen)
  ↓ (first review)
LEARNING (intervals < 1 day)
  ↓ (graduated)
REVIEW (intervals >= 1 day)
  ↓ (21+ days with 90% accuracy)
MASTERED

On failure at any state → back to LEARNING
```

### Configuration

```typescript
const DEFAULT_SRS_CONFIG: SRSConfig = {
  // Ease factor bounds
  initialEaseFactor: 2.5,
  minEaseFactor: 1.3,
  maxEaseFactor: 2.5,
  
  // Learning phase (in days)
  learningSteps: [0.0069, 0.0208], // 10 min, 30 min
  graduatingInterval: 1, // 1 day
  
  // Multipliers
  easyMultiplier: 1.3,
  hardMultiplier: 0.6,
  
  // Limits
  maxInterval: 365, // 1 year max
  leechThreshold: 8 // Mark as leech after 8 failures
}
```

## Content Adapter System

### Architecture

The adapter system transforms content-specific data into the universal `ReviewableContent` format:

```typescript
// Base adapter class
abstract class BaseContentAdapter<T> {
  abstract transform(content: T): ReviewableContent
  abstract generateOptions(content: T, count: number): string[]
  abstract prepareForMode(content: T, mode: ReviewMode): ReviewableContent
  abstract calculateDifficulty(content: T): number
  abstract generateHint(content: T, level: number): string
}

// Registry pattern for adapter management
class AdapterRegistry {
  private adapters = new Map<ContentType, BaseContentAdapter<any>>()
  
  register(type: ContentType, adapter: BaseContentAdapter<any>) {
    this.adapters.set(type, adapter)
  }
  
  getAdapter(type: ContentType): BaseContentAdapter<any> {
    const adapter = this.adapters.get(type)
    if (!adapter) {
      throw new Error(`No adapter registered for type: ${type}`)
    }
    return adapter
  }
}
```

### Kanji Adapter Example

```typescript
export class KanjiAdapter extends BaseContentAdapter<KanjiContent> {
  transform(kanji: KanjiContent): ReviewableContent {
    return {
      id: kanji.id,
      contentType: 'kanji',
      
      // Display fields
      primaryDisplay: kanji.character,
      secondaryDisplay: kanji.meanings.join(', '),
      tertiaryDisplay: this.formatReadings(kanji),
      
      // Answers
      primaryAnswer: kanji.meanings[0],
      alternativeAnswers: [
        ...kanji.meanings.slice(1),
        ...kanji.onyomi,
        ...kanji.kunyomi
      ],
      
      // Metadata
      difficulty: this.calculateDifficulty(kanji),
      tags: ['kanji', `jlpt-n${kanji.jlptLevel}`, `grade-${kanji.grade}`],
      source: kanji.source,
      
      // Review configuration
      supportedModes: ['recognition', 'recall', 'writing'],
      preferredMode: 'recognition',
      
      // Kanji-specific metadata
      metadata: {
        strokeCount: kanji.strokeCount,
        radicals: kanji.radicals,
        jlptLevel: kanji.jlptLevel,
        frequency: kanji.frequency
      }
    }
  }
  
  generateOptions(kanji: KanjiContent, count: number): string[] {
    // Generate similar-looking kanji as distractors
    const similarKanji = this.findSimilarKanji(kanji.character)
    const options = [kanji.meanings[0]]
    
    for (const similar of similarKanji) {
      if (options.length >= count) break
      options.push(similar.meanings[0])
    }
    
    return this.shuffle(options)
  }
  
  calculateDifficulty(kanji: KanjiContent): number {
    // Factors: stroke count, JLPT level, frequency
    const strokeDifficulty = Math.min(kanji.strokeCount / 30, 1)
    const jlptDifficulty = (6 - kanji.jlptLevel) / 5
    const frequencyDifficulty = 1 - (kanji.frequency / 2500)
    
    return (strokeDifficulty + jlptDifficulty + frequencyDifficulty) / 3
  }
}
```

## Validation System

### Multi-Strategy Validation

```typescript
class KanjiValidator extends BaseValidator {
  validate(
    userAnswer: string,
    correctAnswer: string | string[],
    context?: KanjiContext
  ): ValidationResult {
    const normalizedUser = this.normalize(userAnswer)
    const correctAnswers = Array.isArray(correctAnswer) 
      ? correctAnswer 
      : [correctAnswer]
    
    // Strategy 1: Exact match
    if (this.exactMatch(normalizedUser, correctAnswers)) {
      return {
        correct: true,
        score: 1.0,
        feedback: 'Perfect!',
        strategy: 'exact'
      }
    }
    
    // Strategy 2: Fuzzy match for meanings
    if (context?.validationType === 'meaning') {
      const fuzzyResult = this.fuzzyMatch(normalizedUser, correctAnswers)
      if (fuzzyResult.similarity > 0.8) {
        return {
          correct: true,
          score: fuzzyResult.similarity,
          feedback: 'Close enough!',
          strategy: 'fuzzy',
          suggestion: fuzzyResult.closest
        }
      }
    }
    
    // Strategy 3: Reading validation with okurigana flexibility
    if (context?.validationType === 'reading') {
      const readingResult = this.validateReading(
        normalizedUser,
        correctAnswers,
        context.allowOkurigana
      )
      if (readingResult.valid) {
        return {
          correct: true,
          score: readingResult.score,
          feedback: readingResult.feedback,
          strategy: 'reading'
        }
      }
    }
    
    // Failed validation
    return {
      correct: false,
      score: 0,
      feedback: this.generateFeedback(normalizedUser, correctAnswers[0]),
      expectedAnswer: correctAnswers[0],
      strategy: 'none'
    }
  }
  
  private fuzzyMatch(input: string, targets: string[]): FuzzyResult {
    let bestMatch = { target: '', similarity: 0 }
    
    for (const target of targets) {
      const similarity = this.calculateSimilarity(input, target)
      if (similarity > bestMatch.similarity) {
        bestMatch = { target, similarity }
      }
    }
    
    return {
      closest: bestMatch.target,
      similarity: bestMatch.similarity
    }
  }
  
  private calculateSimilarity(a: string, b: string): number {
    // Levenshtein distance normalized to 0-1 similarity
    const distance = this.levenshteinDistance(a, b)
    const maxLength = Math.max(a.length, b.length)
    return 1 - (distance / maxLength)
  }
}
```

## Session Management

### Event-Driven Session Manager

```typescript
class SessionManager extends EventEmitter {
  private session: ReviewSession
  private autoSaveInterval: NodeJS.Timeout
  private inactivityTimer: NodeJS.Timeout
  
  async startSession(config: SessionConfig): Promise<ReviewSession> {
    // Initialize session
    this.session = {
      id: generateId(),
      userId: config.userId,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      items: await this.prepareItems(config),
      currentIndex: 0,
      mode: config.mode,
      config: config,
      status: 'active',
      source: config.source || 'manual',
      stats: this.initializeStats()
    }
    
    // Set up auto-save
    this.autoSaveInterval = setInterval(() => {
      this.saveSession()
    }, 30000) // Every 30 seconds
    
    // Set up inactivity detection
    this.resetInactivityTimer()
    
    // Emit start event
    this.emitEvent(ReviewEventType.SESSION_STARTED, {
      sessionId: this.session.id,
      itemCount: this.session.items.length,
      mode: this.session.mode
    })
    
    return this.session
  }
  
  async submitAnswer(
    answer: string,
    confidence?: number
  ): Promise<AnswerResult> {
    const currentItem = this.getCurrentItem()
    const startTime = Date.now()
    
    // Validate answer
    const validation = await this.validateAnswer(
      answer,
      currentItem.content
    )
    
    // Calculate response time
    const responseTime = Date.now() - startTime
    
    // Update item
    currentItem.attempts++
    currentItem.responseTime = responseTime
    currentItem.lastAnswer = answer
    currentItem.validation = validation
    currentItem.confidence = confidence
    
    // Calculate score
    const score = this.calculateScore(
      validation,
      currentItem.hintsUsed,
      currentItem.attempts,
      confidence
    )
    currentItem.finalScore = score
    
    // Update SRS data
    if (currentItem.srsData) {
      currentItem.srsData = await this.updateSRS(
        currentItem.srsData,
        validation.correct,
        responseTime,
        confidence
      )
    }
    
    // Update statistics
    this.updateStats(validation.correct, score, responseTime)
    
    // Emit event
    this.emitEvent(ReviewEventType.ITEM_ANSWERED, {
      itemId: currentItem.content.id,
      correct: validation.correct,
      score,
      responseTime,
      userAnswer: answer,
      expectedAnswer: validation.expectedAnswer,
      confidence,
      attempts: currentItem.attempts
    })
    
    // Check for achievements
    await this.checkAchievements()
    
    return {
      correct: validation.correct,
      score,
      feedback: validation.feedback,
      nextItem: this.moveToNextItem()
    }
  }
  
  private calculateScore(
    validation: ValidationResult,
    hintsUsed: number,
    attempts: number,
    confidence?: number
  ): number {
    let score = validation.score * 100 // Base score
    
    // Hint penalties
    score -= hintsUsed * 10 // -10 per hint
    
    // Attempt penalties
    score -= Math.max(0, attempts - 1) * 5 // -5 per extra attempt
    
    // Confidence bonus/penalty
    if (confidence !== undefined) {
      if (validation.correct && confidence > 0.8) {
        score += 5 // Confident and correct
      } else if (!validation.correct && confidence > 0.8) {
        score -= 10 // Overconfident and wrong
      }
    }
    
    return Math.max(0, Math.min(100, score))
  }
}
```

## Queue Generation

### Smart Prioritization Algorithm

```typescript
class QueueGenerator {
  async generateQueue(
    userId: string,
    pinnedItems: PinnedItem[],
    options: QueueOptions
  ): Promise<QueueResult> {
    // Get all eligible items
    const items = await this.getEligibleItems(userId, options)
    
    // Calculate priorities
    const prioritizedItems = items.map(item => ({
      ...item,
      priority: this.calculatePriority(item)
    }))
    
    // Sort by priority
    prioritizedItems.sort((a, b) => b.priority - a.priority)
    
    // Apply smart shuffling
    const shuffled = this.smartShuffle(prioritizedItems, options)
    
    // Add pinned items at specified positions
    const withPinned = this.insertPinnedItems(shuffled, pinnedItems)
    
    // Limit to requested size
    const limited = withPinned.slice(0, options.limit || 20)
    
    return {
      items: limited,
      stats: this.calculateQueueStats(limited)
    }
  }
  
  private calculatePriority(item: QueueItem): number {
    let priority = 0
    
    // Overdue bonus (max 100 points)
    const daysOverdue = this.getDaysOverdue(item.nextReviewDate)
    priority += Math.min(daysOverdue * 10, 100)
    
    // Priority level bonus
    switch (item.priorityLevel) {
      case 'high': priority += 50; break
      case 'normal': priority += 25; break
      case 'low': priority += 0; break
    }
    
    // State bonus
    switch (item.state) {
      case 'new': priority += 30; break
      case 'learning': priority += 20; break
      case 'review': priority += 10; break
      case 'mastered': priority += 0; break
    }
    
    // Low success rate bonus
    if (item.successRate < 0.6) {
      priority += 40
    }
    
    // Recent review penalty
    const hoursSinceReview = this.getHoursSinceReview(item.lastReviewDate)
    if (hoursSinceReview < 1) {
      priority -= 60
    }
    
    // Leech bonus
    if (item.isLeech) {
      priority += 35
    }
    
    return Math.max(0, priority)
  }
  
  private smartShuffle(
    items: PrioritizedItem[],
    options: QueueOptions
  ): QueueItem[] {
    // Group by priority ranges
    const high = items.filter(i => i.priority > 100)
    const medium = items.filter(i => i.priority >= 50 && i.priority <= 100)
    const low = items.filter(i => i.priority < 50)
    
    // Shuffle within groups
    const shuffledHigh = this.shuffle(high)
    const shuffledMedium = this.shuffle(medium)
    const shuffledLow = this.shuffle(low)
    
    // Interleave for variety while maintaining priority
    const result: QueueItem[] = []
    let i = 0
    
    while (
      i < shuffledHigh.length || 
      i < shuffledMedium.length || 
      i < shuffledLow.length
    ) {
      // Add high priority items more frequently
      if (i < shuffledHigh.length) {
        result.push(shuffledHigh[i])
      }
      if (i % 2 === 0 && i / 2 < shuffledMedium.length) {
        result.push(shuffledMedium[Math.floor(i / 2)])
      }
      if (i % 3 === 0 && i / 3 < shuffledLow.length) {
        result.push(shuffledLow[Math.floor(i / 3)])
      }
      i++
    }
    
    return result
  }
}
```

## Offline Functionality

### Sophisticated Sync System

```typescript
class OfflineSync {
  private syncQueue: ImprovedSyncQueue
  private storage: IndexedDBAdapter
  private circuitBreaker: CircuitBreaker
  
  constructor() {
    this.syncQueue = new ImprovedSyncQueue({
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      deadLetterQueue: true
    })
    
    this.storage = new IndexedDBAdapter('moshimoshi-offline')
    
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenRequests: 1
    })
  }
  
  async saveOffline(data: any): Promise<void> {
    // Save to IndexedDB
    await this.storage.save(data)
    
    // Queue for sync
    await this.syncQueue.enqueue({
      id: generateId(),
      type: 'sync',
      data,
      timestamp: Date.now(),
      retries: 0
    })
    
    // Attempt immediate sync if online
    if (navigator.onLine) {
      this.attemptSync()
    }
  }
  
  private async attemptSync(): Promise<void> {
    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      console.log('Circuit breaker open, skipping sync')
      return
    }
    
    try {
      const items = await this.syncQueue.getItems()
      
      for (const item of items) {
        try {
          await this.circuitBreaker.execute(async () => {
            await this.syncItem(item)
            await this.syncQueue.remove(item.id)
          })
        } catch (error) {
          await this.handleSyncError(item, error)
        }
      }
    } catch (error) {
      console.error('Sync failed:', error)
    }
  }
  
  private async handleSyncError(
    item: SyncQueueItem,
    error: Error
  ): Promise<void> {
    item.retries++
    
    if (item.retries >= this.syncQueue.maxRetries) {
      // Move to dead letter queue
      await this.syncQueue.moveToDeadLetter(item)
      console.error('Item moved to DLQ:', item.id)
    } else {
      // Exponential backoff
      const delay = Math.min(
        this.syncQueue.baseDelay * Math.pow(2, item.retries),
        this.syncQueue.maxDelay
      )
      
      setTimeout(() => {
        this.attemptSync()
      }, delay)
    }
  }
}

class CircuitBreaker {
  private failures = 0
  private lastFailureTime?: number
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  
  canExecute(): boolean {
    if (this.state === 'closed') return true
    
    if (this.state === 'open') {
      const now = Date.now()
      if (
        this.lastFailureTime && 
        now - this.lastFailureTime > this.config.resetTimeout
      ) {
        this.state = 'half-open'
        return true
      }
      return false
    }
    
    return this.state === 'half-open'
  }
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new Error('Circuit breaker is open')
    }
    
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess(): void {
    this.failures = 0
    this.state = 'closed'
  }
  
  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open'
    }
  }
}
```

## Code Examples

### Creating a Review Session

```typescript
// Initialize the review engine
const engine = new ReviewEngine({
  userId: 'user123',
  mode: 'recognition',
  contentType: 'kanji',
  limit: 20,
  config: {
    showFurigana: true,
    autoPlayAudio: false,
    enableHints: true,
    timeLimit: 30 // seconds per item
  }
})

// Start a session
const session = await engine.startSession()

// Handle user answer
const result = await engine.submitAnswer('water', 0.9) // answer, confidence

// Get hint
const hint = await engine.getHint() // Progressive hints with penalties

// Complete session
const summary = await engine.completeSession()
```

### Custom Content Adapter

```typescript
class CustomGrammarAdapter extends BaseContentAdapter<GrammarContent> {
  transform(grammar: GrammarContent): ReviewableContent {
    return {
      id: grammar.id,
      contentType: 'custom',
      primaryDisplay: grammar.pattern,
      secondaryDisplay: grammar.meaning,
      tertiaryDisplay: grammar.example,
      primaryAnswer: grammar.translation,
      alternativeAnswers: grammar.alternativeTranslations,
      difficulty: this.calculateGrammarDifficulty(grammar),
      tags: ['grammar', grammar.level, ...grammar.tags],
      supportedModes: ['recognition', 'recall'],
      metadata: {
        grammarPoint: grammar.point,
        conjugationType: grammar.conjugationType,
        formality: grammar.formality
      }
    }
  }
}

// Register the adapter
adapterRegistry.register('grammar', new CustomGrammarAdapter())
```

### Custom Validator

```typescript
class GrammarValidator extends BaseValidator {
  validate(
    userAnswer: string,
    correctAnswer: string | string[],
    context?: GrammarContext
  ): ValidationResult {
    // Allow flexibility in particle usage
    const normalized = this.normalizeGrammar(userAnswer)
    
    // Check against patterns
    if (this.matchesPattern(normalized, context?.pattern)) {
      return {
        correct: true,
        score: 1.0,
        feedback: 'Excellent grammar usage!'
      }
    }
    
    // Partial credit for close attempts
    const similarity = this.calculateGrammarSimilarity(
      normalized,
      correctAnswer
    )
    
    if (similarity > 0.7) {
      return {
        correct: true,
        score: similarity,
        feedback: 'Good attempt! Minor issues with particles.',
        suggestion: this.generateGrammarCorrection(userAnswer, correctAnswer)
      }
    }
    
    return {
      correct: false,
      score: 0,
      feedback: 'Review the grammar pattern',
      expectedAnswer: Array.isArray(correctAnswer) 
        ? correctAnswer[0] 
        : correctAnswer
    }
  }
}
```

## Performance Optimization

### Key Performance Metrics

```typescript
// Performance requirements
const PERFORMANCE_TARGETS = {
  srsCalculation: 10,      // ms
  queueGeneration: 100,    // ms for 1000 items
  sessionOperation: 50,    // ms
  validation: 20,          // ms
  offlineSync: 100,       // ms per item
  searchOperation: 30,    // ms
  renderTime: 16         // ms (60 FPS)
}

// Performance monitoring
class PerformanceMonitor {
  private metrics = new Map<string, number[]>()
  
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now()
    const result = fn()
    const duration = performance.now() - start
    
    this.recordMetric(name, duration)
    
    if (duration > PERFORMANCE_TARGETS[name]) {
      console.warn(`Performance warning: ${name} took ${duration}ms`)
    }
    
    return result
  }
  
  private recordMetric(name: string, duration: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    
    const metrics = this.metrics.get(name)!
    metrics.push(duration)
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift()
    }
  }
  
  getStats(name: string): PerformanceStats {
    const metrics = this.metrics.get(name) || []
    
    return {
      avg: metrics.reduce((a, b) => a + b, 0) / metrics.length,
      min: Math.min(...metrics),
      max: Math.max(...metrics),
      p95: this.calculatePercentile(metrics, 95),
      p99: this.calculatePercentile(metrics, 99)
    }
  }
}
```

### Optimization Techniques

1. **Lazy Loading**: Content loaded on demand
2. **Memoization**: Cache expensive calculations
3. **Virtual Scrolling**: For large lists
4. **Web Workers**: Offload heavy computations
5. **IndexedDB Batching**: Bulk operations
6. **Request Debouncing**: Reduce API calls
7. **Preloading**: Anticipate next items

---

This document represents the complete technical implementation of the Universal Review Engine. Each component is designed for performance, reliability, and extensibility.