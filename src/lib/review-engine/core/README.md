# Core Interfaces Module

## Status: ✅ COMPLETED

This module defines all TypeScript interfaces, types, and contracts for the Universal Review Engine.

## Files

- **interfaces.ts** - ReviewableContent interface and content-specific metadata
- **types.ts** - Review modes, configurations, and type definitions  
- **session.types.ts** - Session management types and statistics
- **events.ts** - Event system definitions and payloads
- **errors.ts** - Custom error classes and error handling
- **config.types.ts** - Configuration structures and defaults
- **index.ts** - Central export point for all core types

## Key Interfaces

### ReviewableContent
The base interface for all reviewable content. Content adapters transform specific content types (kana, kanji, vocabulary, etc.) into this universal format.

### ReviewSession
Represents a single review session with timing, progress, and configuration.

### ReviewEvent
Event-driven architecture for tracking all system activities.

### ReviewEngineConfig
Complete configuration structure for the entire review engine.

## Usage

```typescript
import {
  ReviewableContent,
  ReviewSession,
  ReviewMode,
  ReviewEngineError,
  DEFAULT_CONFIG
} from '@/lib/review-engine/core'

// Create content
const content: ReviewableContent = {
  id: 'hiragana-a',
  contentType: 'kana',
  primaryDisplay: 'あ',
  primaryAnswer: 'a',
  // ... other fields
}

// Create session
const session: ReviewSession = {
  id: 'session-123',
  userId: 'user-456',
  mode: 'recognition',
  // ... other fields
}
```

## Testing

Unit tests are located in `__tests__/core/interfaces.test.ts` with >95% coverage.

## Integration Points

- **Content Adapters** - Implement ReviewableContent interface
- **Session Manager** - Uses ReviewSession types
- **Validators** - Use ValidationError class
- **UI Components** - Consume all interfaces
- **API** - Serialize/deserialize these types

## Next Steps

With core interfaces complete, other modules can now be developed in parallel:
- Content Adapters (Module 2)
- Session Management (Module 3)
- Offline Sync (Module 4)
- UI Components (Module 5)
- Validation System (Module 6)