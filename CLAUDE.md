# CLAUDE.md - Moshimoshi Project Context

## Project Overview
**Project**: Moshimoshi - Comprehensive Japanese Learning Platform
**Core Feature**: Universal Review Engine with advanced SRS implementation
**Tech Stack**: Next.js 15.5.2, TypeScript, Firebase, Redis, Stripe, PWA

## Universal Review Engine Specialist Knowledge

### Architecture (71 files, 12 modules)
```
/src/lib/review-engine/
├── core/           # Types: ReviewableContent, ReviewSession interfaces
├── adapters/       # Content transformation (Registry pattern)
├── srs/           # SM-2 algorithm (<10ms performance)
├── session/       # Event-driven lifecycle management
├── validation/    # Multi-strategy with fuzzy matching
├── offline/       # IndexedDB + circuit breaker sync
├── queue/         # Smart prioritization algorithm
└── __tests__/     # 80%+ coverage requirement
```

### Key Files & Line References
```typescript
// Core definitions
src/lib/review-engine/core/interfaces.ts:42      // ReviewableContent interface
src/lib/review-engine/core/types.ts:18           // ReviewSession type
src/lib/review-engine/core/events.ts:65          // Event system

// SRS Implementation
src/lib/review-engine/srs/algorithm.ts:156       // calculateNext() - main algorithm
src/lib/review-engine/srs/state-manager.ts:89    // State transitions
src/lib/review-engine/srs/difficulty.ts:34       // Difficulty calculations

// Adapters
src/lib/review-engine/adapters/registry.ts:23    // Registry pattern
src/lib/review-engine/adapters/KanjiAdapter.ts:78 // Kanji transformation

// Validation
src/lib/review-engine/validation/BaseValidator.ts:234 // Fuzzy matching
src/lib/review-engine/validation/factory.ts:45   // Validator factory

// Session Management
src/lib/review-engine/session/manager.ts:412     // Event emission
src/lib/review-engine/session/statistics.ts:67   // Stats tracking

// React Integration
src/components/review-engine/ReviewEngine.tsx:156 // Main component
src/hooks/useReviewEngine.ts:89                  // React hook
```

### SRS Algorithm Configuration
```typescript
const SRS_CONFIG = {
  initialEaseFactor: 2.5,
  minEaseFactor: 1.3,
  maxEaseFactor: 2.5,
  learningSteps: [0.0069, 0.0208], // 10min, 30min
  graduatingInterval: 1, // 1 day
  maxInterval: 365,
  leechThreshold: 8
}

// State flow: NEW → LEARNING → REVIEW → MASTERED
// Mastery: 21+ days with 90% accuracy
```

### Queue Prioritization Algorithm
- Overdue items: +100 points max (1 day = 10 points)
- Priority levels: High +50, Normal +25, Low +0
- New items: +30 boost
- Learning items: +20 boost
- Low success (<60%): +40 boost
- Recent reviews (1hr): -60 penalty
- Leech items: +35 boost

### Performance Requirements
- SRS calculation: <10ms (actual: <1ms)
- Queue generation: <100ms for 1000 items
- Session operations: <50ms
- Offline sync: <100ms per item
- Success rate: >99.9% normal conditions

### Offline Architecture
- **Storage**: IndexedDB with proper initialization
- **Sync Queue**: Exponential backoff (1s, 2s, 4s... max 30s)
- **Circuit Breaker**: 5 failures threshold, 30s reset
- **Conflict Resolution**: Last-Write-Wins with timestamp
- **Recovery**: <30s from network issues, 0% data loss

### Validation System
- **Strategies**: Exact, Fuzzy (Levenshtein), Custom
- **Japanese Support**: Hiragana/Katakana variants, Okurigana flexibility
- **Fuzzy Threshold**: 0.8 similarity for acceptance
- **Partial Credit**: Score based on similarity percentage

### Testing Coverage Requirements
- Global: 80% minimum
- Core modules: 90% minimum
- SRS Algorithm: 95% minimum
- Validation: 85% minimum

## Common Tasks Quick Reference

### Add New Content Type
1. Create adapter extending `BaseContentAdapter` in `/adapters/`
2. Register in `AdapterRegistry`
3. Create validator extending `BaseValidator` in `/validation/`
4. Register in `ValidatorFactory`

### Customize SRS
- Modify config in `src/lib/review-engine/srs/configs/`
- Adjust ease factors for difficulty
- Change learning steps for pacing

### Debug Performance
```typescript
localStorage.setItem('debug:srs', 'true')  // Enable SRS logging
localStorage.setItem('debug:queue', 'true') // Enable queue logging
```

### Force Offline Sync
```typescript
await offlineManager.forceSyncAll()
```

## Project-Specific Commands
- `npm run dev` - Development server
- `npm run test:review-engine` - Test review engine
- `npm run build:prod` - Production build
- `kubectl apply -f k8s/production/` - Deploy to production

## Recent Architectural Decisions
- Server-side auth only with Firebase Admin SDK
- JWT sessions in Redis with 24hr expiry
- IndexedDB for offline session storage
- Circuit breaker pattern for sync resilience
- Event-driven architecture for real-time updates

## Documentation
- `/docs/REVIEW_ENGINE_DEEP_DIVE.md` - Complete technical architecture
- `/docs/REVIEW_ENGINE_PRACTICAL_GUIDE.md` - Implementation examples
- `/src/lib/review-engine/__tests__/TEST_STYLE_GUIDE.md` - Testing methodology

## Key Insights
1. Everything extends from `ReviewableContent` interface
2. Adapters transform content types to universal format
3. Validation is multi-strategy with Japanese language support
4. Offline-first with optimistic updates and background sync
5. Performance-critical paths use memoization and lazy loading

---
Last Updated: 2025-01-10
Specialist Knowledge: Universal Review Engine