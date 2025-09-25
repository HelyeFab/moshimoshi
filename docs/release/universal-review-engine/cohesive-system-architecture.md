# Cohesive Review System Architecture

## Building a Unified Review System from Scratch

Since we're starting fresh, this document outlines how to integrate all milestones into a truly unified system.

## Core Architecture: Three-Layer Design

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer (M5A/5B)                     │
│  Dashboard │ Review Session │ Pin UI │ Gamification     │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│                 Business Logic Layer                      │
│  SRS Engine (M1) │ Pin Manager (M2) │ Queue Generator    │
│  Content Adapters │ Session Manager │ Progress Tracker   │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                            │
│  API Routes (M4) │ Firestore (M3A) │ Redis Cache (M3B)  │
│  IndexedDB (offline) │ WebSocket (real-time)            │
└─────────────────────────────────────────────────────────┘
```

## 1. Unified Data Flow

### Single Source of Truth

```typescript
// Single source of truth for all review items
interface UnifiedReviewItem {
  // Core identity
  id: string
  userId: string
  
  // Content (from adapters)
  content: {
    type: 'kana' | 'kanji' | 'vocabulary' | 'sentence'
    primary: string
    secondary?: string
    tertiary?: string
    audio?: string
    image?: string
  }
  
  // SRS state (M1)
  srs: {
    status: 'new' | 'learning' | 'mastered'
    interval: number
    easeFactor: number
    nextReviewAt: Date
    lastReviewedAt: Date | null
  }
  
  // Pin state (M2)
  pin: {
    isPinned: boolean
    pinnedAt?: Date
    priority: 'low' | 'normal' | 'high'
    releaseSchedule?: 'immediate' | 'gradual'
    tags: string[]
    setIds: string[]
  }
  
  // Statistics
  stats: {
    reviewCount: number
    correctCount: number
    streak: number
    avgResponseTime: number
  }
  
  // Metadata
  meta: {
    createdAt: Date
    updatedAt: Date
    syncedAt: Date
    version: number
  }
}
```

### Data Flow Pattern

```
User Action → UI Component → Business Logic → Data Layer → Cache → Database
     ↑                                                               ↓
     └──────────────────── Real-time Updates ←─────────────────────┘
```

## 2. Reorganized Milestone Dependencies

### Phase 1: Foundation (Week 1)

**M0: Shared Contracts** (NEW - 2 days)
```typescript
// /src/lib/review-engine/contracts/
- interfaces.ts      // UnifiedReviewItem, all shared types
- events.ts         // System-wide events
- errors.ts         // Custom error types
- constants.ts      // Shared constants
```

**M1: Core SRS Algorithm** (3 days)
```typescript
// /src/lib/review-engine/core/
- srs-algorithm.ts   // Pure functions, no dependencies
- content-adapter.ts // Transform any content to UnifiedReviewItem
- validator.ts       // Answer validation with fuzzy matching
```

### Phase 2: State & Storage (Week 2)

**M3A: Database Schema** (3 days)
```typescript
// Define schema BEFORE any features use it
// /src/lib/firebase/
- schema.ts         // Single source of truth for all collections
- migrations.ts     // Version management
```

**M3B: Caching Layer** (2 days - parallel with M3A)
```typescript
// /src/lib/cache/
- redis-client.ts   // Singleton connection
- cache-manager.ts  // Unified caching interface
```

**M2: Pin & Queue System** (3 days - after M3A)
```typescript
// /src/lib/review-engine/features/
- pin-manager.ts    // Uses M3A schema
- queue-generator.ts // Uses M1 algorithm + M2 pins
- session-manager.ts // Orchestrates review sessions
```

### Phase 3: API & Integration (Week 3)

**M4: Unified API Layer** (5 days)
```typescript
// /src/app/api/review/v1/
- items/route.ts    // CRUD for review items
- queue/route.ts    // Queue generation
- session/route.ts  // Session management  
- stats/route.ts    // Statistics
- sync/route.ts     // Offline sync endpoint
```

### Phase 4: User Interface (Week 4)

**M5: Integrated UI** (5 days)
```typescript
// /src/app/review/
- page.tsx          // Dashboard combining M5A + M5B
- session/page.tsx  // Actual review interface
- settings/page.tsx // User preferences

// /src/components/review/
- ReviewEngine.tsx  // Main component orchestrating everything
- PinButton.tsx     // Reusable pin component
- QueueList.tsx     // Queue visualization
- StatsPanel.tsx    // Statistics display
```

## 3. Shared Service Contracts

Create a service layer that all components use:

```typescript
// /src/lib/review-engine/services/review-service.ts
export class ReviewService {
  constructor(
    private srs: SRSAlgorithm,
    private pinManager: PinManager,
    private queueGen: QueueGenerator,
    private storage: StorageService,
    private cache: CacheService
  ) {}
  
  // Single entry point for all review operations
  async pinContent(contentId: string, options?: PinOptions): Promise<UnifiedReviewItem> {
    const item = await this.storage.getItem(contentId)
    const updated = await this.pinManager.pin(item, options)
    await this.cache.invalidate(['queue', 'stats'])
    await this.notifySubscribers('item.pinned', updated)
    return updated
  }
  
  async submitAnswer(itemId: string, result: AnswerResult): Promise<ReviewUpdate> {
    const item = await this.storage.getItem(itemId)
    const srsUpdate = this.srs.calculateNext(item, result)
    const updated = { ...item, srs: srsUpdate, stats: this.updateStats(item.stats, result) }
    await this.storage.saveItem(updated)
    await this.cache.invalidate(['queue', 'stats', `item:${itemId}`])
    await this.notifySubscribers('item.reviewed', updated)
    return updated
  }
  
  async getQueue(options: QueueOptions): Promise<UnifiedReviewItem[]> {
    const cached = await this.cache.get(`queue:${options.userId}`)
    if (cached) return cached
    
    const items = await this.storage.getDueItems(options.userId)
    const pinned = await this.pinManager.getPinned(options.userId)
    const queue = this.queueGen.generate([...items, ...pinned], options)
    
    await this.cache.set(`queue:${options.userId}`, queue, 300) // 5 min TTL
    return queue
  }
}
```

## 4. Unified State Management

### Event-Driven Architecture

```typescript
// /src/lib/review-engine/events/event-bus.ts
export class ReviewEventBus {
  private subscribers = new Map<string, Set<Handler>>()
  
  // All components subscribe to relevant events
  on(event: ReviewEvent, handler: Handler) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set())
    }
    this.subscribers.get(event)!.add(handler)
  }
  
  emit(event: ReviewEvent, data: any) {
    this.subscribers.get(event)?.forEach(handler => handler(data))
  }
}

// Events that tie everything together
type ReviewEvent = 
  | 'item.pinned'
  | 'item.unpinned'
  | 'item.reviewed'
  | 'queue.generated'
  | 'session.started'
  | 'session.completed'
  | 'achievement.unlocked'
  | 'cache.invalidated'
```

### Frontend State (Zustand)

```typescript
// /src/stores/review-store.ts
export const useReviewStore = create((set, get) => ({
  // Single source of truth for UI
  queue: [],
  currentItem: null,
  session: null,
  stats: null,
  
  // Actions call the ReviewService
  pinItem: async (itemId: string) => {
    const updated = await reviewService.pinContent(itemId)
    set(state => ({
      queue: state.queue.map(item => 
        item.id === itemId ? updated : item
      )
    }))
  },
  
  submitAnswer: async (answer: Answer) => {
    const result = await reviewService.submitAnswer(answer)
    set(state => ({
      currentItem: state.queue[state.session.currentIndex + 1],
      session: { ...state.session, currentIndex: state.session.currentIndex + 1 }
    }))
  }
}))
```

### Backend State (Redis)

```typescript
// Cached state for performance
const cacheKeys = {
  queue: (userId: string) => `queue:${userId}`,
  stats: (userId: string) => `stats:${userId}`,
  session: (sessionId: string) => `session:${sessionId}`,
  item: (itemId: string) => `item:${itemId}`
}

// Invalidation on state changes
eventBus.on('item.reviewed', async (item) => {
  await redis.del(cacheKeys.queue(item.userId))
  await redis.del(cacheKeys.stats(item.userId))
})
```

## 5. Integration Testing Strategy

Test the system as a whole, not just parts:

```typescript
// /tests/integration/review-flow.test.ts
describe('Complete Review Flow', () => {
  test('Pin → Queue → Review → Stats Update', async () => {
    // 1. Pin an item
    const pinned = await reviewService.pinContent('kanji-123')
    expect(pinned.pin.isPinned).toBe(true)
    
    // 2. Verify it appears in queue
    const queue = await reviewService.getQueue({ userId })
    expect(queue).toContainEqual(expect.objectContaining({ id: 'kanji-123' }))
    
    // 3. Submit correct answer
    const result = await reviewService.submitAnswer('kanji-123', { correct: true })
    expect(result.srs.interval).toBeGreaterThan(1)
    
    // 4. Verify stats updated
    const stats = await reviewService.getStats(userId)
    expect(stats.correctCount).toBe(1)
    
    // 5. Verify cache invalidation
    const cachedQueue = await cache.get(`queue:${userId}`)
    expect(cachedQueue).toBeNull()
  })
})
```

## Recommended Implementation Approach

### Week 1: Foundation
```
Day 1-2: M0 - Define all interfaces, contracts, events
Day 3-5: M1 - Implement pure SRS algorithm with tests
Day 6-7: M3A - Design Firestore schema matching interfaces
```

### Week 2: Core Services
```
Day 1-2: M3B - Setup Redis caching (parallel)
Day 3-4: M2 - Build PinManager using defined schema
Day 5-7: ReviewService - Wire everything together
```

### Week 3: API & Polish
```
Day 1-3: M4 - API endpoints using ReviewService
Day 4-5: Integration tests
Day 6-7: Performance optimization
```

### Week 4: User Interface
```
Day 1-3: M5A - Dashboard and core UI
Day 4-5: M5B - Gamification features
Day 6-7: E2E testing and polish
```

## Key Differences for Cohesion

1. **Start with contracts** - Define all interfaces BEFORE implementation
2. **Central service layer** - ReviewService orchestrates all operations
3. **Event-driven updates** - Components stay synchronized via events
4. **Unified data model** - Single `UnifiedReviewItem` used everywhere
5. **Proper dependencies** - Each phase builds on the previous
6. **Integration focus** - Test flows, not just units

## Critical Success Factors

### DO:
- ✅ Define clear boundaries between layers
- ✅ Use dependency injection for testability
- ✅ Cache aggressively but invalidate properly
- ✅ Make offline-first with online sync
- ✅ Version your API from day 1 (`/api/review/v1/`)

### DON'T:
- ❌ Let UI components talk directly to database
- ❌ Duplicate state between frontend and backend
- ❌ Hardcode dependencies between modules
- ❌ Skip integration tests
- ❌ Build features in isolation

## Final Architecture Benefits

1. **Scalable** - Can add new content types without changing core
2. **Testable** - Each layer can be tested independently
3. **Maintainable** - Clear separation of concerns
4. **Performant** - Caching at every level
5. **Resilient** - Offline-first with graceful degradation

This approach ensures all milestones work together as a **unified system** rather than separate features bolted together.

## Assessment Summary

### Original Milestone Issues
- **Parallel systems** instead of integrated architecture
- **Hidden dependencies** between milestones
- **Missing integration** with existing components
- **No migration path** for data
- **Timeline unrealistic** for proper dependencies

### Solutions Implemented
- **Unified data model** (`UnifiedReviewItem`)
- **Central service layer** (ReviewService)
- **Event-driven architecture** for loose coupling
- **Proper dependency ordering** with M0 contracts first
- **Integration testing** from day one

### System Cohesion Score
**Before:** 6/10 - Well-designed parts, poor integration
**After:** 9/10 - Unified architecture with clear data flow

The reorganized approach creates a truly cohesive system where:
- All components share the same data model
- State changes propagate automatically via events
- Caching and persistence are handled centrally
- Each layer has clear responsibilities
- Testing covers complete user flows, not just units