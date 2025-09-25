# Universal Review Engine - Overview

## Project Goal
Transform the current `KanaReviewMode` component into a production-ready, universal review engine that can handle ANY content type (kana, kanji, vocabulary, sentences, custom lists) while maintaining the three proven review modes: Recognition, Recall, and Listening.

## Architecture Philosophy
- **Modular & Independent**: Each module can be developed by different agents in parallel
- **Content Agnostic**: Works with any reviewable content type
- **Offline-First**: Following industry standards (Duolingo, Anki)
- **Event-Driven**: Progress updates propagate through the system
- **Session-Based**: Maintains review sessions with full tracking

## Module Breakdown

### 1. [Core Interfaces](./01-core-interfaces.md)
**Owner**: Agent 1
**Dependencies**: None
**Output**: TypeScript interfaces and types
- ReviewableContent interface
- ReviewSession types
- ReviewMode configurations
- Event definitions

### 2. [Content Adapters](./02-content-adapters.md)
**Owner**: Agent 2
**Dependencies**: Core Interfaces
**Output**: Adapter classes for each content type
- KanaAdapter
- KanjiAdapter
- VocabularyAdapter
- SentenceAdapter
- CustomContentAdapter

### 3. [Session Management](./03-session-management.md)
**Owner**: Agent 3
**Dependencies**: Core Interfaces
**Output**: Session service and state management
- SessionManager class
- State persistence
- Session analytics
- Progress tracking

### 4. [Offline Sync System](./04-offline-sync.md)
**Owner**: Agent 4
**Dependencies**: Core Interfaces, Session Management
**Output**: Offline-first infrastructure
- IndexedDB storage
- Service Worker setup
- Sync queue management
- Conflict resolution

### 5. [UI Components](./05-ui-components.md)
**Owner**: Agent 5
**Dependencies**: Core Interfaces, Session Management
**Output**: React components
- ReviewEngine component
- ReviewCard variants
- AnswerInput components
- ProgressDisplay components

### 6. [Validation System](./06-validation-system.md)
**Owner**: Agent 6
**Dependencies**: Core Interfaces, Content Adapters
**Output**: Answer validation framework
- Validator interface
- Content-specific validators
- Fuzzy matching algorithms
- Custom validation rules

### 7. [Progress Integration](./07-progress-integration.md)
**Owner**: Agent 7
**Dependencies**: Session Management
**Output**: Integration with existing progress system
- Progress event emitters
- LearningVillage updates
- Statistics aggregation
- Achievement triggers

### 8. [API Integration](./08-api-integration.md)
**Owner**: Agent 8
**Dependencies**: Core Interfaces, Session Management, Offline Sync
**Output**: API client and endpoints
- Review session endpoints
- Progress sync endpoints
- Batch operations
- Error handling

## Development Workflow

1. **Phase 1**: Core Interfaces (blocking)
   - Must be completed first as all other modules depend on it

2. **Phase 2**: Parallel Development
   - Content Adapters
   - Validation System
   - Offline Sync System
   - UI Components (can start with mocks)

3. **Phase 3**: Integration
   - Session Management (needs adapters)
   - API Integration
   - Progress Integration

4. **Phase 4**: Testing & Polish
   - End-to-end testing
   - Performance optimization
   - Accessibility audit

## Success Criteria

- ✅ Works with all content types (kana, kanji, vocabulary, etc.)
- ✅ Maintains three review modes (Recognition, Recall, Listening)
- ✅ Offline-first with automatic sync
- ✅ Session tracking with analytics
- ✅ Updates progress bars in LearningVillage
- ✅ Configurable per content type
- ✅ Custom validators for different content
- ✅ Performance: <100ms response time
- ✅ Accessibility: WCAG 2.1 AA compliant

## File Structure
```
src/
├── lib/
│   ├── review-engine/
│   │   ├── core/
│   │   │   ├── interfaces.ts
│   │   │   ├── types.ts
│   │   │   └── events.ts
│   │   ├── adapters/
│   │   │   ├── base.adapter.ts
│   │   │   ├── kana.adapter.ts
│   │   │   ├── kanji.adapter.ts
│   │   │   ├── vocabulary.adapter.ts
│   │   │   └── sentence.adapter.ts
│   │   ├── session/
│   │   │   ├── manager.ts
│   │   │   ├── state.ts
│   │   │   └── analytics.ts
│   │   ├── offline/
│   │   │   ├── storage.ts
│   │   │   ├── sync.ts
│   │   │   └── queue.ts
│   │   └── validation/
│   │       ├── interface.ts
│   │       ├── exact.validator.ts
│   │       ├── fuzzy.validator.ts
│   │       └── custom.validator.ts
│   └── api/
│       └── review/
│           ├── client.ts
│           └── endpoints.ts
├── components/
│   └── review-engine/
│       ├── ReviewEngine.tsx
│       ├── ReviewCard.tsx
│       ├── AnswerInput.tsx
│       └── ProgressBar.tsx
└── app/
    └── api/
        └── review/
            └── v2/
                ├── session/route.ts
                ├── progress/route.ts
                └── sync/route.ts
```

## Communication Protocol

Each module should expose:
1. **Clear interfaces** for other modules to consume
2. **Event emitters** for state changes
3. **Error boundaries** with descriptive messages
4. **Unit tests** with >90% coverage
5. **Documentation** with usage examples

## Next Steps

1. Review this overview
2. Each agent picks their module
3. Start with Core Interfaces (blocking)
4. Parallel development begins
5. Integration testing
6. Deploy to production