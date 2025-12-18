# Phase 2: URE Feature Migration - Agent Implementation Prompt

**Agent Role**: You are a senior React/TypeScript developer tasked with migrating features from a legacy ReviewEngine component to the new Universal Review Engine (URE) architecture.

**Project**: Moshimoshi Japanese Learning Platform
**Branch**: `ure-migration`
**Phase**: Phase 2 - Feature Migration
**Prerequisites**: Phase 1 (Infrastructure) and Phase 1.5 (Testing) are COMPLETE ✅

---

## 🎯 Your Mission

Migrate 5 features from the legacy `ReviewEngine.tsx` component (738 lines, bypasses proper architecture) to the new URE architecture using `useSessionManager` hook and a new `ReviewSessionUI` component.

**Success Criteria**:
- Create `ReviewSessionUI` component
- Migrate all 5 features to use new architecture
- Remove all legacy `ReviewEngine` usage
- Maintain 100% feature parity
- Ensure gamification XP awards work correctly
- All tests pass
- No regressions

---

## 📚 Required Reading (CRITICAL)

Before starting, you MUST read and understand these files:

### 1. Architecture & Plan
```
/01_PRODUCTION_DOCS/URE_ARCHITECTURE_AND_MIGRATION_PLAN.md
```
**Focus**: Sections 2, 3, 5, and 7
- Section 2: URE Architecture Deep Dive
- Section 3: Where URE is Properly Implemented
- Section 5: How to Implement URE Correctly
- Section 7: Migration Plan (Steps 4-5)

### 2. Current Status
```
/01_PRODUCTION_DOCS/TESTING_SUMMARY.md
```
**Focus**: What's been completed, what infrastructure exists

### 3. Core Implementation Files

**Infrastructure (already built)**:
```typescript
src/lib/review-engine/core/client-event-emitter.ts    // Browser EventEmitter
src/lib/review-engine/core/event-hub.ts               // Global event singleton
src/hooks/useSessionManager.ts                         // React hook (374 lines)
src/lib/review-engine/session/manager.ts              // SessionManager core
```

**Test Files (your reference)**:
```typescript
src/lib/review-engine/__tests__/client-event-emitter.test.ts
src/hooks/__tests__/useSessionManager.test.tsx
src/lib/review-engine/__tests__/session-manager-integration.test.ts
```
Read these to understand how to use the hook properly!

### 4. Existing Components (reuse these)
```typescript
src/components/review-engine/ReviewCard.tsx
src/components/review-engine/AnswerInput.tsx
src/components/review-engine/ProgressBar.tsx
src/components/review-engine/SessionSummary.tsx   // ✅ exists
src/components/review-engine/ConfidenceSlider.tsx
```

---

## 📋 Phase 2 Tasks (In Order)

### Task 1: Create ReviewSessionUI Component (Day 1-2)

**Objective**: Build a reusable wrapper component that replaces legacy `ReviewEngine.tsx`

#### 1.1 Component Requirements

**File to Create**: `src/components/review-engine/ReviewSessionUI.tsx`

**Interface**:
```typescript
interface ReviewSessionUIProps {
  // Content to review (already adapted to ReviewableContent format)
  content: ReviewableContent[];

  // Optional pool for generating multiple choice distractors
  contentPool?: ReviewableContent[];

  // User ID for session tracking
  userId: string;

  // Review mode
  mode?: ReviewMode;

  // Callbacks
  onComplete: (statistics: SessionStatistics) => void;
  onCancel: () => void;
  onProgressUpdate?: (progress: ProgressData) => void;

  // Configuration
  config?: ReviewEngineConfig;
  shuffle?: boolean;
}
```

#### 1.2 Implementation Pattern

```typescript
'use client'

import { useEffect } from 'react'
import { useSessionManager } from '@/hooks/useSessionManager'
import { initializeEventHub } from '@/lib/review-engine/core/event-hub'
import ReviewCard from './ReviewCard'
import AnswerInput from './AnswerInput'
import ProgressBar from './ProgressBar'
import SessionSummary from './SessionSummary'
import ConfidenceSlider from './ConfidenceSlider'

export default function ReviewSessionUI({
  content,
  contentPool,
  userId,
  mode = 'recognition',
  onComplete,
  onCancel,
  onProgressUpdate,
  config,
  shuffle = false
}: ReviewSessionUIProps) {

  // Initialize event hub once for gamification
  useEffect(() => {
    if (userId) {
      initializeEventHub(userId)
    }
  }, [userId])

  // Use SessionManager hook
  const {
    state,
    startSession,
    submitAnswer,
    nextItem,
    skipItem,
    useHint,
    pauseSession,
    resumeSession
  } = useSessionManager({
    userId,
    mode,
    content,
    onComplete: (stats) => {
      // SessionManager + Event Hub automatically handle gamification
      onComplete(stats)
    },
    onError: (error) => {
      console.error('[ReviewSessionUI] Error:', error)
      // Handle error appropriately
    },
    shuffle
  })

  // Start session on mount
  useEffect(() => {
    if (content.length > 0) {
      startSession()
    }
  }, [content.length])

  // Report progress updates
  useEffect(() => {
    if (onProgressUpdate && state.progress) {
      onProgressUpdate(state.progress)
    }
  }, [state.progress, onProgressUpdate])

  // Handle loading state
  if (!state.isActive && !state.isCompleted) {
    return <LoadingSpinner />
  }

  // Handle completed state
  if (state.isCompleted && state.statistics) {
    return (
      <SessionSummary
        statistics={state.statistics}
        onClose={onCancel}
      />
    )
  }

  // Handle active session
  const currentItem = state.currentItem
  if (!currentItem) return null

  return (
    <div className="review-session-container">
      {/* Progress Bar */}
      <ProgressBar
        current={state.progress.current}
        total={state.progress.total}
        correct={state.progress.correct}
        incorrect={state.progress.incorrect}
      />

      {/* Review Card */}
      <ReviewCard
        item={currentItem}
        mode={mode}
        config={config}
      />

      {/* Answer Input */}
      <AnswerInput
        mode={mode}
        onSubmit={async (answer, confidence) => {
          await submitAnswer(answer, confidence)
          await nextItem()
        }}
        onSkip={skipItem}
        onHint={useHint}
        currentItem={currentItem}
      />

      {/* Cancel Button */}
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}
```

#### 1.3 Acceptance Criteria - Task 1

- [ ] Component file created at correct path
- [ ] Uses `useSessionManager` hook (not direct SessionManager)
- [ ] Calls `initializeEventHub(userId)` on mount
- [ ] Automatically starts session when content provided
- [ ] Composes existing sub-components (ReviewCard, AnswerInput, etc.)
- [ ] Handles loading, active, and completed states
- [ ] Emits progress updates
- [ ] **CRITICAL**: Does NOT emit SESSION_COMPLETED manually (hook handles this)
- [ ] **CRITICAL**: Does NOT create own EventEmitter (uses global hub)
- [ ] TypeScript compiles without errors
- [ ] Component is export default (for dynamic import compatibility)

#### 1.4 What NOT to Do

❌ **DO NOT**:
- Create your own EventEmitter
- Manually emit SESSION_COMPLETED events
- Call SessionManager directly (use the hook!)
- Manually initialize gamificationListener (event hub handles this)
- Copy code from legacy ReviewEngine.tsx (start fresh!)
- Use localStorage directly (SessionManager handles storage)

✅ **DO**:
- Use the hook
- Trust the event hub
- Compose existing components
- Keep it simple
- Let SessionManager handle business logic

---

### Task 2: Migrate Kana Learning (Day 3-4)

**Objective**: Complete the partial migration of Kana Learning feature

#### 2.1 File to Modify
```
src/components/learn/KanaLearningComponent.tsx
```

#### 2.2 Current State (Verified)
- Line 48: Has legacy `ReviewEngine` dynamic import ⚠️
- Has `useSessionManager` import ✅ (but unclear if used properly)
- Still renders `<ReviewEngine>` component (1 occurrence)

#### 2.3 Migration Steps

**Step 1**: Remove legacy imports
```typescript
// DELETE THIS (around line 48)
const ReviewEngine = dynamic(() => import('@/components/review-engine/ReviewEngine'))
```

**Step 2**: Add new import
```typescript
// ADD THIS
const ReviewSessionUI = dynamic(() => import('@/components/review-engine/ReviewSessionUI'))
```

**Step 3**: Find the review mode rendering (search for `viewMode === 'review'`)

**Current code** (approximately):
```typescript
{viewMode === 'review' && (
  <ReviewEngine
    content={reviewContent}
    contentPool={reviewContentPool.length > 0 ? reviewContentPool : reviewContent}
    userId={user?.uid || 'anonymous'}
    onComplete={handleReviewComplete}
    onCancel={() => setViewMode('browse')}
    mode="recognition"
    config={...}
  />
)}
```

**Replace with**:
```typescript
{viewMode === 'review' && (
  <ReviewSessionUI
    content={reviewContent}
    contentPool={reviewContentPool.length > 0 ? reviewContentPool : reviewContent}
    userId={user?.uid || 'anonymous'}
    onComplete={handleReviewComplete}
    onCancel={() => setViewMode('browse')}
    mode="recognition"
    config={...}
    shuffle={false}
  />
)}
```

**Step 4**: Verify `handleReviewComplete` callback

**Current callback** (verify it looks like this):
```typescript
const handleReviewComplete = (stats: SessionStatistics) => {
  // Should be SIMPLE - no manual event emission needed
  setLastSessionStats(stats)
  setViewMode('browse')
  // Event Hub automatically handles gamification!
}
```

**If you find manual event emission**, DELETE it:
```typescript
// DELETE ANY CODE LIKE THIS:
ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {...})
gamificationListener.initialize(...)
```

**Step 5**: Remove any manual gamification setup

Search for these patterns and DELETE:
```typescript
// DELETE these if found:
const ureEventEmitter = new EventEmitter()
gamificationListener.initialize(user.uid, ureEventEmitter)
```

The Event Hub handles all of this automatically!

#### 2.4 Testing - Kana Learning

**Manual Test Flow**:
1. Navigate to Kana Learning page
2. Select some characters (e.g., あ, い, う)
3. Click "Start Review"
4. Answer all questions correctly
5. Complete session

**Verify**:
- [ ] Review session starts without errors
- [ ] Can answer questions
- [ ] Progress bar updates
- [ ] Session completes successfully
- [ ] **CRITICAL**: XP is awarded (check user profile XP increases)
- [ ] **CRITICAL**: Celebration screen appears (if applicable)
- [ ] No console errors
- [ ] Session summary shows correct statistics

**Check Browser Console**:
- Should see: `[EventHub] Initialized for user: <userId>`
- Should NOT see any errors
- Should NOT see duplicate event emissions

#### 2.5 Acceptance Criteria - Task 2

- [ ] Legacy `ReviewEngine` import removed
- [ ] `ReviewSessionUI` import added
- [ ] JSX updated to use `ReviewSessionUI`
- [ ] No manual event emission code
- [ ] No manual gamificationListener initialization
- [ ] TypeScript compiles without errors
- [ ] Feature works identically to before
- [ ] **GAMIFICATION TEST PASSES**: XP awarded correctly
- [ ] No console errors in browser
- [ ] Code is cleaner (fewer lines)

---

### Task 3: Migrate Kanji Browser (Day 5-6)

**Objective**: Complete the migration (appears ~75% done)

#### 3.1 File to Modify
```
src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx
```

#### 3.2 Current State
- Has `useSessionManager` import ✅
- Status unclear - needs verification

#### 3.3 Migration Steps

Follow the EXACT same pattern as Kana Learning (Task 2):

1. Find legacy `ReviewEngine` import (if exists)
2. Replace with `ReviewSessionUI`
3. Update JSX rendering
4. Remove manual event emission
5. Remove manual gamificationListener setup
6. Test thoroughly

#### 3.4 Adapter Verification

Kanji Browser uses `KanjiAdapter`. Verify it's registered:

```typescript
// Check this exists (should already be there)
import { AdapterRegistry } from '@/lib/review-engine/adapters/registry'

// Verify kanji content is adapted:
const adapter = AdapterRegistry.getAdapter('kanji')
const reviewableContent = kanjiData.map(k => adapter.transform(k))
```

#### 3.5 Testing - Kanji Browser

Same test flow as Kana Learning, but with kanji characters.

**Verify**:
- [ ] All same checks as Kana Learning
- [ ] Multiple choice works (if applicable)
- [ ] Kanji details display correctly
- [ ] XP awarded for kanji reviews

---

### Task 4: Migrate Textbook Vocabulary (Day 7-8)

**Objective**: First migration starting from scratch

#### 4.1 File to Modify
```
src/app/[locale]/textbook-vocabulary/page.tsx
```

#### 4.2 Current State
- ❌ Not started
- Uses legacy ReviewEngine (expected)

#### 4.3 Special Considerations

Uses `TextbookVocabularyAdapter` - verify it exists:

```typescript
// Should exist at:
src/lib/review-engine/adapters/TextbookVocabularyAdapter.ts

// Verify registration:
AdapterRegistry.getAdapter('textbook_vocabulary')
```

#### 4.4 Migration Steps

Same pattern:
1. Remove legacy import
2. Add ReviewSessionUI
3. Update rendering
4. Clean up event code
5. Test

---

### Task 5: Migrate Anki Study (Day 9-10)

**Objective**: Most complex migration (external deck format)

#### 5.1 File to Modify
```
src/app/[locale]/anki-study/[deckId]/page.tsx
```

#### 5.2 Special Considerations

**Anki cards** use `AnkiAdapter`:
```typescript
src/lib/review-engine/adapters/anki.adapter.ts
```

**Complexity**: Anki decks have custom format

**Verify**:
```typescript
const adapter = AdapterRegistry.getAdapter('anki-card')
const reviewableContent = ankiCards.map(card => adapter.transform(card))
```

**Deck Metadata**: Ensure deck metadata (name, description) is preserved

#### 5.3 Testing - Anki Study

Extra test cases:
- [ ] Import deck works
- [ ] All card types supported
- [ ] Front/back rendering correct
- [ ] Multimedia cards work (if applicable)
- [ ] Deck progress saved

---

### Task 6: Migrate User Lists (Day 11-12)

**Objective**: Final migration (user-created content)

#### 6.1 File to Modify
```
src/app/[locale]/lists/[listId]/page.tsx
```

#### 6.2 Special Considerations

Uses **dynamic adapter** (UserListAdapter):

```typescript
// Created per-instance, not registered globally
import { createUserListAdapter } from '@/lib/review-engine/adapters/user-list.adapter'

const adapter = createUserListAdapter(listConfig)
const reviewableContent = listItems.map(item => adapter.transform(item))
```

#### 6.3 Testing - User Lists

Extra test cases:
- [ ] Custom list content works
- [ ] Sharing functionality unaffected
- [ ] List editing still works
- [ ] Progress tracked per list

---

## 🧪 Testing Requirements (CRITICAL)

### For EACH Feature Migration

#### 1. TypeScript Compilation
```bash
npm run type-check
# MUST pass with 0 errors
```

#### 2. Build Verification
```bash
npm run build
# MUST complete successfully
```

#### 3. Manual Testing Checklist

For each feature, perform this test:

**Pre-Migration Baseline**:
1. Test feature on `main` branch
2. Note exact behavior
3. Screenshot if possible
4. Record XP gain amount

**Post-Migration Verification**:
1. Test feature on `ure-migration` branch
2. Verify IDENTICAL behavior
3. **CRITICAL**: Verify XP gain matches baseline
4. Check browser console for errors
5. Verify session persistence (refresh during review)

#### 4. Gamification Integration Test

**This is the MOST CRITICAL test**:

```typescript
// Test procedure for EACH feature:
1. Note starting XP: ___
2. Complete a review session (all correct)
3. Note ending XP: ___
4. Calculate gain: ___
5. Verify celebration screen appears (if threshold met)

// PASS CRITERIA:
✅ XP increases
✅ Correct amount awarded
✅ Celebration appears when expected
✅ No console errors
```

**If gamification fails**:
- Check Event Hub is initialized
- Check SESSION_COMPLETED event is emitted
- Check payload contains statistics
- Review `01_PRODUCTION_DOCS/URE_ARCHITECTURE_AND_MIGRATION_PLAN.md` Section 3.3

#### 5. Regression Testing

After all migrations:
```bash
# Run all existing tests
npm test

# ALL must pass - no regressions
```

---

## 📊 Deliverables

### 1. Code Files

**Created**:
- [ ] `src/components/review-engine/ReviewSessionUI.tsx`

**Modified** (5 files):
- [ ] `src/components/learn/KanaLearningComponent.tsx`
- [ ] `src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx`
- [ ] `src/app/[locale]/textbook-vocabulary/page.tsx`
- [ ] `src/app/[locale]/anki-study/[deckId]/page.tsx`
- [ ] `src/app/[locale]/lists/[listId]/page.tsx`

### 2. Test Evidence

**For Each Feature**, provide:
```markdown
## Feature: [Name]

### Before Migration
- Lines of code: ___
- Uses ReviewEngine: Yes/No
- Manual event emission: Yes/No

### After Migration
- Lines of code: ___
- Uses ReviewSessionUI: Yes/No
- Manual event emission: No ✅

### Test Results
- TypeScript: ✅ Pass
- Build: ✅ Pass
- Manual test: ✅ Pass
- Gamification: ✅ XP awarded correctly
- Console errors: None ✅

### Screenshots
[Attach before/after if helpful]
```

### 3. Migration Summary Document

Create: `01_PRODUCTION_DOCS/PHASE_2_COMPLETION_REPORT.md`

Include:
- Summary of all changes
- Total lines removed
- Total lines added
- All test results
- Any issues encountered
- Any deviations from plan

---

## ⚠️ Common Pitfalls (AVOID THESE)

### Pitfall 1: Manual Event Emission ❌
```typescript
// WRONG - DO NOT DO THIS
ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {...})

// RIGHT - Let SessionManager handle it
onComplete={(stats) => {
  // Just use the stats, events are automatic
  setLastSessionStats(stats)
}}
```

### Pitfall 2: Creating Own EventEmitter ❌
```typescript
// WRONG
const ureEventEmitter = new EventEmitter()

// RIGHT
// Don't create one - Event Hub is global singleton
```

### Pitfall 3: Manual Gamification Setup ❌
```typescript
// WRONG
gamificationListener.initialize(user.uid, ureEventEmitter)

// RIGHT
initializeEventHub(user.uid) // Only this, in ReviewSessionUI
```

### Pitfall 4: Not Using the Hook ❌
```typescript
// WRONG
const manager = new SessionManager(storage, analytics)

// RIGHT
const { state, startSession, submitAnswer } = useSessionManager({...})
```

### Pitfall 5: Copying Legacy Code ❌
```typescript
// WRONG
// Copy-pasting from ReviewEngine.tsx

// RIGHT
// Use ReviewSessionUI which uses the hook properly
```

---

## 🎯 Success Metrics

### Code Quality
- [ ] Total lines reduced by ~1,500+ (5 features × ~300 lines each)
- [ ] No code duplication
- [ ] All TypeScript errors resolved
- [ ] ESLint passing

### Functionality
- [ ] All 5 features work identically to before
- [ ] No new bugs introduced
- [ ] Session persistence works
- [ ] Offline support maintained

### Gamification (CRITICAL)
- [ ] XP awarded correctly for all 5 features
- [ ] Celebration screens appear when expected
- [ ] Streak tracking works
- [ ] No missed SESSION_COMPLETED events

### Performance
- [ ] No performance degradation
- [ ] Session start time < 100ms
- [ ] Answer validation < 50ms
- [ ] No memory leaks

---

## 📞 When You're Stuck

### Debugging Steps

**If gamification doesn't work**:
```typescript
// Add this temporarily to see events:
const hub = getEventHub()
console.log('Listener count:', hub.listenerCount(ReviewEventType.SESSION_COMPLETED))

// Should be > 0
```

**If TypeScript errors**:
1. Check imports are correct
2. Verify interfaces match
3. Run `npm run type-check` for details

**If session doesn't start**:
1. Check content is provided
2. Check useSessionManager receives content
3. Check autoStart or manual startSession call
4. Check browser console for errors

### Reference Files

When stuck, refer to these working examples:

**Test files** show correct usage:
```typescript
src/hooks/__tests__/useSessionManager.test.tsx
```

**Server-side** shows correct SessionManager usage:
```typescript
src/app/api/review/session/start/route.ts
```

**Gamification listener** shows correct event handling:
```typescript
src/lib/gamification/gamificationListener.ts
```

---

## 🏁 Completion Checklist

### Phase 2 Complete When:

- [ ] ReviewSessionUI component created and tested
- [ ] All 5 features migrated
- [ ] Legacy ReviewEngine usage completely removed
- [ ] All TypeScript errors resolved
- [ ] All tests pass (existing + new)
- [ ] All features tested manually
- [ ] **Gamification verified working for all 5 features**
- [ ] No console errors in production build
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Completion report written

### Final Verification

```bash
# 1. Clean build
npm run build

# 2. Run all tests
npm test

# 3. Type check
npm run type-check

# 4. Lint
npm run lint

# ALL MUST PASS ✅
```

---

## 📋 Timeline

**Total Estimate**: 10-12 days

- Days 1-2: ReviewSessionUI component
- Days 3-4: Kana Learning
- Days 5-6: Kanji Browser
- Days 7-8: Textbook Vocabulary
- Days 9-10: Anki Study
- Days 11-12: User Lists + Testing + Documentation

**Daily Standup Questions**:
1. What feature did you migrate today?
2. Did all tests pass?
3. Did gamification work?
4. Any blockers?

---

## 🎓 Final Notes

### Remember

1. **The infrastructure is proven** - all Phase 1 components work correctly
2. **The tests prove it works** - 74 tests, all passing
3. **Event Hub handles gamification** - you just need to use it correctly
4. **Keep it simple** - let the hook handle complexity
5. **Trust the architecture** - don't reinvent what exists

### Your Goal

Transform this mess:
```typescript
// Before: Each feature has ~300 lines of duplicate session logic
<ReviewEngine /> // 738 lines of bypassing proper architecture
```

Into this clean pattern:
```typescript
// After: Shared component, proper architecture
<ReviewSessionUI /> // Uses hook, uses event hub, clean
```

### Questions?

If confused, re-read:
1. `/01_PRODUCTION_DOCS/URE_ARCHITECTURE_AND_MIGRATION_PLAN.md` - Section 5
2. `src/hooks/__tests__/useSessionManager.test.tsx` - Working examples
3. `src/lib/review-engine/core/event-hub.ts` - How events work

---

**Good luck! The infrastructure is solid. You've got this.** 🚀

---

**Document Version**: 1.0
**Created**: 2025-12-18
**For**: Phase 2 Implementation Agent
**Checker**: Original URE Architecture Specialist
