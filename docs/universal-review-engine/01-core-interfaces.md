# Module 1: Core Interfaces

**Status**: 🔴 Not Started  
**Priority**: CRITICAL (Blocking)  
**Owner**: Agent 1  
**Dependencies**: None  
**Estimated Time**: 2-3 hours  

## Overview
Define all TypeScript interfaces, types, and contracts that other modules will use. This is the foundation of the entire review engine system.

## Deliverables

### 1. ReviewableContent Interface

```typescript
// lib/review-engine/core/interfaces.ts

export interface ReviewableContent {
  // Unique identifier
  id: string;
  
  // Content type for adapter selection
  contentType: 'kana' | 'kanji' | 'vocabulary' | 'sentence' | 'phrase' | 'grammar' | 'custom';
  
  // Display fields
  primaryDisplay: string;        // Main content shown (character, word, sentence)
  secondaryDisplay?: string;      // Supporting info (meaning, translation)
  tertiaryDisplay?: string;       // Additional context (usage, notes)
  
  // Input/Answer fields
  primaryAnswer: string;          // Expected answer for validation
  alternativeAnswers?: string[];  // Acceptable alternatives
  
  // Media assets
  audioUrl?: string;              // For listening mode
  imageUrl?: string;              // Visual aids
  videoUrl?: string;              // Video content
  
  // Metadata
  difficulty: number;             // 0.0 to 1.0
  tags: string[];                 // Categorization
  source?: string;                // Where it came from
  
  // Mode configuration
  supportedModes: ReviewMode[];   // Which modes this content supports
  preferredMode?: ReviewMode;     // Default mode
  
  // Additional data for specific content types
  metadata?: Record<string, any>;
}
```

### 2. Review Mode Configuration

```typescript
// lib/review-engine/core/types.ts

export type ReviewMode = 'recognition' | 'recall' | 'listening';

export interface ReviewModeConfig {
  mode: ReviewMode;
  
  // Display configuration
  showPrimary: boolean;
  showSecondary: boolean;
  showTertiary: boolean;
  showMedia: boolean;
  
  // Input configuration
  inputType: 'multiple-choice' | 'text' | 'drawing' | 'speech' | 'custom';
  
  // Options for multiple choice
  optionCount?: number;
  optionSource?: 'similar' | 'random' | 'curated';
  
  // Timing
  timeLimit?: number;           // Seconds, optional
  minResponseTime?: number;     // Minimum time before accepting answer
  
  // Hints
  allowHints: boolean;
  hintPenalty?: number;         // Score reduction for using hints
  
  // Audio
  autoPlayAudio?: boolean;
  repeatLimit?: number;
}

export interface ContentTypeConfig {
  contentType: string;
  availableModes: ReviewModeConfig[];
  defaultMode: ReviewMode;
  
  // Validation rules
  validationStrategy: 'exact' | 'fuzzy' | 'custom';
  validationOptions?: Record<string, any>;
  
  // Display preferences
  fontSize?: 'small' | 'medium' | 'large' | 'extra-large';
  fontFamily?: string;
  
  // Special features
  features?: {
    strokeOrder?: boolean;      // For kanji
    furigana?: boolean;         // For vocabulary
    pitch?: boolean;            // For pronunciation
    conjugation?: boolean;      // For verbs
  };
}
```

### 3. Review Session Types

```typescript
// lib/review-engine/core/session.types.ts

export interface ReviewSession {
  // Identification
  id: string;
  userId: string;
  
  // Timing
  startedAt: Date;
  endedAt?: Date;
  lastActivityAt: Date;
  
  // Content
  items: ReviewSessionItem[];
  currentIndex: number;
  
  // Configuration
  mode: ReviewMode;
  config: ReviewModeConfig;
  
  // State
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  
  // Metadata
  source: 'manual' | 'scheduled' | 'quick' | 'test';
  tags?: string[];
}

export interface ReviewSessionItem {
  // Reference
  content: ReviewableContent;
  
  // Timing
  presentedAt: Date;
  answeredAt?: Date;
  responseTime?: number;  // milliseconds
  
  // Response
  userAnswer?: string;
  correct?: boolean;
  confidence?: 1 | 2 | 3 | 4 | 5;
  
  // Hints used
  hintsUsed: number;
  
  // Attempts (if retry allowed)
  attempts: number;
  
  // Score calculation
  baseScore: number;
  finalScore: number;
  
  // For spaced repetition
  previousInterval?: number;
  nextInterval?: number;
  easeFactor?: number;
}

export interface SessionStatistics {
  sessionId: string;
  
  // Counts
  totalItems: number;
  completedItems: number;
  correctItems: number;
  incorrectItems: number;
  skippedItems: number;
  
  // Performance
  accuracy: number;          // percentage
  averageResponseTime: number;
  totalTime: number;
  
  // Streaks
  currentStreak: number;
  bestStreak: number;
  
  // By difficulty
  performanceByDifficulty: {
    easy: { correct: number; total: number };
    medium: { correct: number; total: number };
    hard: { correct: number; total: number };
  };
  
  // By mode
  performanceByMode?: {
    [key in ReviewMode]?: {
      correct: number;
      total: number;
      avgTime: number;
    };
  };
}
```

### 4. Event Definitions

```typescript
// lib/review-engine/core/events.ts

export enum ReviewEventType {
  // Session events
  SESSION_STARTED = 'session.started',
  SESSION_PAUSED = 'session.paused',
  SESSION_RESUMED = 'session.resumed',
  SESSION_COMPLETED = 'session.completed',
  SESSION_ABANDONED = 'session.abandoned',
  
  // Item events
  ITEM_PRESENTED = 'item.presented',
  ITEM_ANSWERED = 'item.answered',
  ITEM_SKIPPED = 'item.skipped',
  ITEM_HINT_USED = 'item.hint_used',
  
  // Progress events
  PROGRESS_UPDATED = 'progress.updated',
  STREAK_UPDATED = 'streak.updated',
  ACHIEVEMENT_UNLOCKED = 'achievement.unlocked',
  
  // Sync events
  SYNC_STARTED = 'sync.started',
  SYNC_COMPLETED = 'sync.completed',
  SYNC_FAILED = 'sync.failed',
  
  // Error events
  ERROR_OCCURRED = 'error.occurred',
  VALIDATION_FAILED = 'validation.failed',
}

export interface ReviewEvent<T = any> {
  type: ReviewEventType;
  timestamp: Date;
  sessionId?: string;
  userId?: string;
  data: T;
  metadata?: Record<string, any>;
}

// Event payloads
export interface SessionStartedPayload {
  sessionId: string;
  itemCount: number;
  mode: ReviewMode;
  source: string;
}

export interface ItemAnsweredPayload {
  itemId: string;
  correct: boolean;
  responseTime: number;
  userAnswer: string;
  expectedAnswer: string;
  confidence?: number;
}

export interface ProgressUpdatedPayload {
  sessionId: string;
  current: number;
  total: number;
  correct: number;
  accuracy: number;
  streak: number;
}
```

### 5. Error Types

```typescript
// lib/review-engine/core/errors.ts

export class ReviewEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ReviewEngineError';
  }
}

export class ValidationError extends ReviewEngineError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class SessionError extends ReviewEngineError {
  constructor(message: string, details?: any) {
    super(message, 'SESSION_ERROR', details);
    this.name = 'SessionError';
  }
}

export class SyncError extends ReviewEngineError {
  constructor(message: string, details?: any) {
    super(message, 'SYNC_ERROR', details);
    this.name = 'SyncError';
  }
}

export class ContentError extends ReviewEngineError {
  constructor(message: string, details?: any) {
    super(message, 'CONTENT_ERROR', details);
    this.name = 'ContentError';
  }
}
```

### 6. Configuration Types

```typescript
// lib/review-engine/core/config.types.ts

export interface ReviewEngineConfig {
  // Session defaults
  defaultSessionLength: number;
  maxSessionLength: number;
  
  // Mode defaults
  defaultMode: ReviewMode;
  modeConfigs: Record<ReviewMode, ReviewModeConfig>;
  
  // Content type configurations
  contentConfigs: Record<string, ContentTypeConfig>;
  
  // Offline settings
  offline: {
    enabled: boolean;
    syncInterval: number;      // seconds
    maxQueueSize: number;
    storagequota: number;      // MB
  };
  
  // Performance
  performance: {
    preloadNext: number;       // Number of items to preload
    cacheSize: number;         // Number of items to cache
    debounceDelay: number;     // milliseconds
  };
  
  // Features
  features: {
    streaks: boolean;
    achievements: boolean;
    analytics: boolean;
    hints: boolean;
    audio: boolean;
    images: boolean;
  };
  
  // API endpoints
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
}
```

## Implementation Guidelines

### Type Safety
- Use strict TypeScript settings
- No `any` types except where absolutely necessary
- Prefer interfaces over types for objects
- Use enums for finite sets of values

### Naming Conventions
- Interfaces: PascalCase with 'I' prefix optional
- Types: PascalCase
- Enums: PascalCase for name, SCREAMING_SNAKE_CASE for values
- Constants: SCREAMING_SNAKE_CASE

### Documentation
- Every interface/type must have JSDoc comments
- Include usage examples in comments
- Document edge cases and assumptions

### Versioning
- Add version field to main interfaces for future compatibility
- Use semantic versioning for breaking changes

## Testing Requirements

```typescript
// __tests__/core/interfaces.test.ts

describe('Core Interfaces', () => {
  describe('ReviewableContent', () => {
    it('should accept valid content');
    it('should validate required fields');
    it('should handle optional fields');
  });
  
  describe('ReviewSession', () => {
    it('should track session state');
    it('should calculate statistics correctly');
    it('should handle edge cases');
  });
  
  describe('Events', () => {
    it('should emit correct event types');
    it('should include required payloads');
    it('should maintain event order');
  });
});
```

## Integration Points

- **Content Adapters**: Will implement ReviewableContent
- **Session Manager**: Will use ReviewSession types
- **Validators**: Will use ValidationError
- **UI Components**: Will consume all interfaces
- **API**: Will serialize/deserialize these types

## Acceptance Criteria

- [ ] All interfaces are fully typed with no `any`
- [ ] JSDoc comments on all public interfaces
- [ ] Unit tests with 100% coverage
- [ ] Reviewed by at least one other agent
- [ ] Compatible with existing review system docs
- [ ] No circular dependencies

## Questions to Resolve

1. Should we include a version field in ReviewableContent?
2. Do we need separate interfaces for request/response DTOs?
3. Should metadata be strongly typed per content type?
4. How do we handle custom content types not in our enum?