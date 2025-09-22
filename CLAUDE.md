# CLAUDE.md - Moshimoshi Project Context

## Project Overview
**Project**: Moshimoshi - Comprehensive Japanese Learning Platform
**Core Feature**: Universal Review Engine with advanced SRS implementation
**Tech Stack**: Next.js 15.5.2, TypeScript, Firebase, Redis, Stripe, PWA

## CRITICAL: Task Planning Requirements
**BEFORE starting ANY implementation task, you MUST:**
1. Use the TodoWrite tool to create a detailed todo list of implementation steps
2. Include the specific plan/approach for each step
3. Clearly state the final goal to achieve
4. Mark tasks as in_progress when working on them
5. Mark tasks as completed immediately after finishing them
6. Keep exactly ONE task in_progress at any time

This ensures organized development, clear progress tracking, and helps maintain focus on the end goal.

## CRITICAL: i18n Requirements - NO HARDCODED TEXT
**MANDATORY: The app uses a comprehensive i18n system. You MUST follow these rules:**

### Never Hardcode Text
1. **NEVER use hardcoded strings** in components (e.g., `"Loading..."`, `"Submit"`, `"Cancel"`)
2. **ALWAYS use the i18n system** for ALL user-facing text
3. **NO EXCEPTIONS** - This includes:
   - Button labels
   - Headings and titles
   - Error messages
   - Success messages
   - Placeholder text
   - Alt text for images
   - Aria labels
   - Toast notifications
   - Form validation messages

### How to Use i18n
```typescript
// CORRECT - Always use i18n
import { useI18n } from '@/i18n/I18nContext'
const { t, strings } = useI18n()

// Use dot notation for paths
<button>{t('common.submit')}</button>
<h1>{t('dashboard.welcome')}</h1>

// With parameters
<p>{t('user.greeting', { name: userName })}</p>

// Direct typed access
<span>{strings.common.loading}</span>

// WRONG - Never do this
<button>Submit</button>  // ❌ Hardcoded text
<h1>Welcome</h1>         // ❌ Hardcoded text
<p>Loading...</p>        // ❌ Hardcoded text
```

### Adding New Translations
When adding new UI text:
1. Add the string to ALL 6 language files in `/src/i18n/locales/[lang]/strings.ts`
2. Use consistent key naming in the nested structure
3. Ensure translations are contextually appropriate for each language
4. Test that the text displays correctly in all supported languages

### Supported Languages
- **en**: English (default)
- **ja**: Japanese (日本語)
- **fr**: French (Français)
- **it**: Italian (Italiano)
- **de**: German (Deutsch)
- **es**: Spanish (Español)

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

## App Theme System
**IMPORTANT: The app has a sophisticated theme system that MUST be followed**

### Theme Architecture
- **Location**: `/docs/root/THEME_SYSTEM.md` - Full theme documentation
- **Core Files**:
  - `/src/lib/theme/ThemeContext.tsx` - Theme provider
  - `/src/styles/globals.css` - Theme variables
  - `/src/styles/palettes.css` - Palette definitions

### Color Usage Rules
1. **NEVER use hardcoded colors** (e.g., `bg-red-500`, `text-blue-600`)
2. **ALWAYS use theme-aware classes**:
   - Primary colors: `bg-primary-500`, `text-primary-600`, etc.
   - Dark mode: Use `dark:` prefix (e.g., `dark:bg-dark-800`)
   - Backgrounds: `bg-soft-white` or `bg-gray-50` (not `bg-white`), `dark:bg-dark-900`
3. **6 Color Palettes Available**: Sakura (default), Ocean, Matcha, Sunset, Lavender, Monochrome
4. **Softer whites**: Use `bg-soft-white` (#eef6fd) or `bg-gray-50` instead of `bg-white` for less eye strain

### Dark Mode Colors (Blue-Grey, NOT pure black)
```css
--color-dark-850: #1a202c;  /* Main dark background */
--color-dark-900: #171923;  /* Darker background */
```

## TTS (Text-to-Speech) System
**CRITICAL: The app has a sophisticated multi-layer TTS system that MUST be used correctly**

### TTS Architecture (3 Layers)
1. **Pre-recorded Audio** (Kana only)
   - Location: `/public/audio/kana/{hiragana|katakana}/{id}.mp3`
   - Function: `playKanaAudio()` from `@/data/kanaData`
   - Use for: Hiragana and Katakana characters ONLY

2. **Cloud TTS API** (Dynamic content)
   - Hook: `useTTS()` from `@/hooks/useTTS`
   - Endpoints: `/api/tts/synthesize`, `/api/tts/preload`
   - Providers: Google TTS (short), ElevenLabs (long)
   - Caching: Firebase Storage with Firestore metadata
   - Use for: Kanji, vocabulary, sentences

3. **Browser Speech Synthesis** (Fallback)
   - API: `window.speechSynthesis`
   - Use only as last resort when APIs unavailable

### Implementation Rules
```typescript
// CORRECT - For Kanji/Vocabulary/Dynamic content
import { useTTS } from '@/hooks/useTTS'
const { play, preload } = useTTS({ cacheFirst: true })
await play(text, { voice: 'ja-JP', rate: 0.9 })

// CORRECT - For Kana characters
import { playKanaAudio } from '@/data/kanaData'
await playKanaAudio(kanaId, 'hiragana')

// AVOID - Browser synthesis (only as fallback)
window.speechSynthesis.speak(utterance)
```

### Audio UI Components
- **AudioButton**: Standard speaker button (use consistently)
- **SpeakerIcon**: Integrated with useTTS hook
- **TTSText**: Text with inline speaker icon

## Common Components Usage
**MANDATORY: Use existing components instead of creating new ones**

### Navigation
- **Navbar**: `/src/components/layout/Navbar.tsx`
  - Use on ALL pages (no custom headers)
  - Props: `user`, `showUserMenu`, `backLink`
  - Example: `<Navbar user={user} showUserMenu={true} />`

### Learning Pages Special Header
- **LearningPageHeader**: `/src/components/learn/LearningPageHeader.tsx`
  - Use for ALL learning content pages (Kanji, Kana, Vocabulary)
  - Provides: Mode selector, stats, progress bar, action buttons
  - Props: `title`, `description`, `mode`, `onModeChange`, `stats`, etc.
  - Example:
```tsx
<LearningPageHeader
  title="Kanji Browser"
  description="Master Japanese kanji step by step"
  mode={viewMode}
  onModeChange={setViewMode}
  stats={{ total: 100, learned: 25 }}
  selectionMode={selectionMode}
  onToggleSelection={() => setSelectionMode(!selectionMode)}
/>
```

### UI Components
- **LoadingOverlay**: Use for loading states
- **DoshiMascot**: App mascot component
- **Toast**: Use `useToast()` hook for notifications
- **Modal**: Standard modal wrapper
- **Checkbox**: Consistent checkbox component

## Learning Content Page Structure
**REQUIRED: All learning pages MUST follow this structure**

```tsx
export default function LearningPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light...">
      {/* 1. Always use standard Navbar */}
      <Navbar user={user} showUserMenu={true} />

      {/* 2. Always use LearningPageHeader for learning content */}
      <LearningPageHeader
        title="Page Title"
        description="Page description"
        mode={viewMode}
        onModeChange={setViewMode}
        // ... other props
      />

      {/* 3. Main content area */}
      <div className="container mx-auto px-4">
        {/* Content based on mode */}
      </div>
    </div>
  )
}
```

### Mobile Responsiveness
- Use responsive classes: `sm:`, `md:`, `lg:`
- Test on mobile viewport
- Avoid crowded button layouts on mobile
- Use grid layouts that stack on small screens

---
Last Updated: 2025-01-18
Specialist Knowledge: Universal Review Engine, Theme System, TTS Implementation, Component Architecture