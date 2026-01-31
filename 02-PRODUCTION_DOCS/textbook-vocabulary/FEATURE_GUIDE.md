# Textbook Vocabulary Feature Implementation Guide

**Status:** ACTIVE
**Last Updated:** 2026-01-31
**Target Audience:** Developers implementing or modifying the textbook vocabulary feature

---

## Table of Contents

1. [Component Architecture](#component-architecture)
2. [Data Flow & State Management](#data-flow--state-management)
3. [URE Integration](#ure-integration)
4. [Progress Tracking System](#progress-tracking-system)
5. [Study Mode Implementation](#study-mode-implementation)
6. [Review Mode Implementation](#review-mode-implementation)
7. [Audio System Integration](#audio-system-integration)
8. [Entitlements & Gating](#entitlements--gating)
9. [Adding New Features](#adding-new-features)
10. [Performance Optimization](#performance-optimization)
11. [Code Examples](#code-examples)

---

## Component Architecture

### Component Hierarchy

```
TextbookVocabularyPage (Main Orchestrator)
├── Navbar (Desktop only, hidden during active sessions)
├── PageHeader / LearningPageHeader (Conditional)
├── FeatureUsageIndicator (Entitlement display)
│
├── AnimatePresence (View Mode Router)
│   ├── TextbookSelector (textbook === null)
│   │   └── TextbookGrid with 10 textbook cards
│   │
│   ├── VocabularyDisplay (Browse/Selection Mode)
│   │   ├── FilterControls (Search, Lesson selector)
│   │   ├── ViewModeToggle (Grid/List/Cards)
│   │   └── VocabularyRenderer (Grid/List/Cards views)
│   │       └── VocabularyCard (Individual items)
│   │
│   ├── TextbookVocabularyStudyMode (Study Mode)
│   │   ├── ProgressIndicator
│   │   ├── FlashCard (Front/Back flip animation)
│   │   ├── InteractivePills (Meaning, Reading, Examples)
│   │   ├── TatoebaSentences (Dynamic fetch)
│   │   └── NavigationControls
│   │
│   └── ReviewSessionUI (Review Mode - URE)
│       ├── QuestionPrompt
│       ├── AnswerOptions (Multiple choice)
│       ├── ValidationFeedback
│       └── SessionStatistics
```

### File Organization

```
src/
├── app/[locale]/textbook-vocabulary/
│   ├── page.tsx                          # Route wrapper
│   ├── layout.tsx                        # Metadata generation
│   ├── TextbookVocabularyPage.tsx        # Main component ⭐
│   └── components/
│       ├── TextbookSelector.tsx          # Textbook selection grid
│       └── VocabularyDisplay.tsx         # Browse/search interface
│
├── components/
│   └── textbook-vocabulary/
│       └── TextbookVocabularyStudyMode.tsx  # Flashcard study mode
│
├── lib/review-engine/
│   └── adapters/
│       └── TextbookVocabularyAdapter.ts  # URE adapter ⭐
│
├── utils/
│   └── textbookVocabularyProgressManager.ts  # Progress tracking ⭐
│
└── data/textbooks/
    ├── index.json                        # Textbook registry
    ├── genki-1/
    │   ├── all.json                      # All vocabulary
    │   ├── metadata.json                 # Stats
    │   └── lesson-N.json                 # Per-lesson files
    └── [other-textbooks]/
```

---

## Data Flow & State Management

### State Architecture (TextbookVocabularyPage.tsx)

```typescript
// Core navigation state
const [selectedTextbook, setSelectedTextbook] = useState<string | null>(null)
const [viewMode, setViewMode] = useState<ViewMode>('browse' | 'study' | 'review')

// Vocabulary data
const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([])
const [filteredVocabulary, setFilteredVocabulary] = useState<VocabularyItem[]>([])
const [currentLesson, setCurrentLesson] = useState<number | 'all'>('all')

// Selection state (for batch operations)
const [selectedVocab, setSelectedVocab] = useState<Set<string>>(new Set())

// Study mode state
const [selectedVocabData, setSelectedVocabData] = useState<VocabularyItem[]>([])
const [currentStudyIndex, setCurrentStudyIndex] = useState(0)

// Review mode state (URE integration)
const [reviewContent, setReviewContent] = useState<ReviewableContent[]>([])
const [reviewContentPool, setReviewContentPool] = useState<ReviewableContent[]>([])

// Progress tracking
const [vocabProgress, setVocabProgress] = useState<Map<string, TextbookVocabProgressData>>(new Map())
```

### State Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                    State Flow Diagram                        │
└─────────────────────────────────────────────────────────────┘

Initial State
    └─> selectedTextbook = null
    └─> viewMode = 'browse'

User Selects Textbook (handleTextbookSelect)
    └─> selectedTextbook = 'genki-1'
    └─> Load vocabulary data
    └─> Load progress from IndexedDB
    └─> viewMode = 'browse'

User Filters by Lesson (handleLessonChange)
    └─> Check entitlement (3/day for free users)
    └─> Update filteredVocabulary
    └─> Clear selection

User Selects Vocabulary (handleToggleSelection)
    └─> Update selectedVocab Set
    └─> Enable Study/Review buttons

User Clicks "Study" (handleStartStudy)
    └─> selectedVocabData = filtered items
    └─> viewMode = 'study'
    └─> currentStudyIndex = 0

User Clicks "Review" (handleStartReview)
    └─> Transform items to ReviewableContent via adapter
    └─> reviewContent = transformed items
    └─> reviewContentPool = all lesson items (for distractors)
    └─> viewMode = 'review'

User Completes Session
    └─> Study: Emit SESSION_COMPLETED via Event Hub
    └─> Review: URE handles automatically
    └─> refreshProgress()
    └─> viewMode = 'browse'
```

### Data Loading Flow

```typescript
// 1. Component mounts
useEffect(() => {
  if (user?.uid) {
    initializeEventHub(user.uid)  // For gamification
  }
}, [user?.uid])

// 2. User selects textbook
const handleTextbookSelect = (textbookId: string) => {
  setIsLoading(true)
  setSelectedTextbook(textbookId)
  // VocabularyDisplay loads data automatically
}

// 3. VocabularyDisplay loads JSON
useEffect(() => {
  const loadVocabulary = async () => {
    // Dynamic import - Next.js bundles at build time
    const module = await import(`@/data/textbooks/${textbookId}/all.json`)
    const rawData = module.default || []
    const vocabData = rawData.map(sanitizeVocabularyItem)
    setVocabulary(vocabData)
    onVocabularyLoaded?.(vocabData)
  }
  loadVocabulary()
}, [textbookId])

// 4. Load progress from IndexedDB
const refreshProgress = useCallback(async () => {
  if (user && selectedTextbook) {
    const progress = await textbookVocabularyProgressManager.getTextbookProgress(
      user,
      isPremium ?? false,
      selectedTextbook
    )
    setVocabProgress(progress)
  }
}, [user, isPremium, selectedTextbook])
```

---

## URE Integration

### Adapter Pattern Implementation

The `TextbookVocabularyAdapter` transforms vocabulary items into the Universal Review Engine's `ReviewableContent` format.

#### Key Methods

```typescript
/**
 * Transform vocabulary item to ReviewableContent
 * @see src/lib/review-engine/adapters/TextbookVocabularyAdapter.ts:78-121
 */
transform(vocab: TextbookVocabularyItem): ReviewableContent {
  return {
    id: vocab.id,
    contentType: 'vocabulary',

    // Display fields (what user sees)
    primaryDisplay: vocab.meaning,      // "hot spring"
    secondaryDisplay: vocab.reading,    // "おんせん"
    tertiaryDisplay: undefined,

    // Answer fields (what user must provide)
    primaryAnswer: vocab.japanese,      // "温泉"
    alternativeAnswers: [vocab.reading],

    // Media
    audioUrl: undefined,  // TTS will be used

    // Configuration
    supportedModes: ['recognition', 'listening'],
    preferredMode: 'recognition',

    // Metadata (preserved for UI and filtering)
    metadata: {
      japanese: vocab.japanese,
      reading: vocab.reading,
      meaning: vocab.meaning,
      jlptLevel: this.parseJLPTLevel(vocab.jlptLevel),
      partOfSpeech: vocab.partOfSpeech || [],
      examples: vocab.examples || [],
      lesson: vocab.lesson,
      textbook: vocab.textbook,
      hasKanji: this.hasKanji(vocab.japanese)
    }
  }
}
```

#### Distractor Generation (6-Strategy Approach)

**Problem:** In multiple-choice reviews, we need realistic wrong answers (distractors) that are similar enough to be challenging but clearly incorrect.

**Solution:** Multi-strategy approach with prioritization

```typescript
/**
 * Generate smart distractors from vocabulary pool
 * @see src/lib/review-engine/adapters/TextbookVocabularyAdapter.ts:127-221
 */
generateOptions(
  content: ReviewableContent,
  pool: TextbookVocabularyItem[],
  count: number = 4
): ReviewableContent[] {

  // Priority 1: Same lesson (highest relevance)
  // Students study lessons together - these words are most confusing
  if (metadata?.lesson) {
    const sameLesson = pool.filter(v => v.lesson === metadata.lesson)
    this.addDistractors(selected, sameLesson, count)
  }

  // Priority 2: Adjacent lessons (contextually similar)
  // Words from nearby lessons share themes
  if (metadata?.lesson && selected.length < count) {
    const adjacentLessons = pool.filter(v =>
      v.textbook === metadata.textbook &&
      Math.abs((v.lesson || 0) - metadata.lesson) <= 2
    )
    this.addDistractors(selected, adjacentLessons, count)
  }

  // Priority 3: Same JLPT level (similar difficulty)
  // N5 words shouldn't distract from N1 words
  if (metadata?.jlptLevel && selected.length < count) {
    const sameJLPT = pool.filter(v =>
      this.parseJLPTLevel(v.jlptLevel) === metadata.jlptLevel
    )
    this.addDistractors(selected, sameJLPT, count)
  }

  // Priority 4: Similar word length (visual similarity)
  // 温泉 (2 chars) vs 日本語 (3 chars) vs こんにちは (5 chars)
  if (selected.length < count) {
    const targetLength = correctJapanese.length
    const similarLength = pool.filter(v =>
      Math.abs(v.japanese.length - targetLength) <= 2
    )
    this.addDistractors(selected, similarLength, count)
  }

  // Priority 5: Same part of speech (grammatical similarity)
  // Don't mix verbs with nouns
  if (metadata?.partOfSpeech?.length > 0 && selected.length < count) {
    const samePOS = pool.filter(v =>
      v.partOfSpeech?.some(pos => metadata.partOfSpeech.includes(pos))
    )
    this.addDistractors(selected, samePOS, count)
  }

  // Priority 6: Random fallback (last resort)
  if (selected.length < count) {
    const shuffled = this.shuffle(pool)
    this.addDistractors(selected, shuffled, count)
  }

  // Shuffle final selection and return
  return this.shuffle(selected).map(vocab => this.transform(vocab))
}
```

#### Difficulty Calculation

```typescript
/**
 * Calculate difficulty score (0.1 to 0.95)
 * @see src/lib/review-engine/adapters/TextbookVocabularyAdapter.ts:259-286
 */
calculateDifficulty(vocab: TextbookVocabularyItem): number {
  let difficulty = 0.5  // Base difficulty

  // Factor 1: JLPT level (N5 easier, N1 harder)
  const jlptLevel = this.parseJLPTLevel(vocab.jlptLevel)
  difficulty += (6 - jlptLevel) * 0.08  // N5=0.08, N1=0.4

  // Factor 2: Word length (longer = harder)
  const length = vocab.japanese.length
  if (length > 4) {
    difficulty += Math.min((length - 4) * 0.03, 0.15)
  }

  // Factor 3: Kanji presence (+0.1 if contains kanji)
  if (this.hasKanji(vocab.japanese)) {
    difficulty += 0.1
  }

  // Factor 4: Multiple meanings (+0.05)
  if (vocab.meaning.includes(',') || vocab.meaning.includes(';')) {
    difficulty += 0.05
  }

  // Cap between 0.1 and 0.95
  return Math.max(0.1, Math.min(0.95, difficulty))
}
```

---

## Progress Tracking System

### Architecture Overview

```
textbookVocabularyProgressManager (Singleton)
    └─> extends UniversalProgressManager<TextbookVocabProgressData>
        └─> IndexedDB Storage
            ├─> progress table (by user, contentType, contentId)
            ├─> sessions table (session summaries)
            └─> syncQueue table (pending Firebase syncs)
```

### Progress Data Structure

```typescript
interface TextbookVocabProgressData extends ReviewProgressData {
  // Base fields (from ReviewProgressData)
  contentId: string        // vocab.id
  contentType: string      // 'textbook_vocabulary'
  status: 'not-started' | 'viewing' | 'learning' | 'learned' | 'mastered'
  viewCount: number        // How many times viewed in study mode
  correctCount: number     // Correct answers in review mode
  incorrectCount: number   // Incorrect answers
  lastReviewDate: string   // ISO timestamp
  createdAt: string        // ISO timestamp
  updatedAt: string        // ISO timestamp

  // Textbook-specific fields
  japanese?: string        // For display
  textbook?: string        // 'genki-1'
  lesson?: number          // 5
  chapter?: number         // Optional
  jlptLevel?: string       // 'N5'
}
```

### Status Progression

```
not-started (default)
    └─> User views in study mode (1st time)
        └─> viewing
            └─> User views 6+ times OR achieves 90% accuracy (3+ attempts)
                └─> learned
                    └─> (Future: Auto-promotion to mastered via URE)
```

### Key Methods

```typescript
/**
 * Track vocabulary view in study mode
 * @see src/utils/textbookVocabularyProgressManager.ts:38-69
 */
async trackVocabView(
  vocabId: string,
  user: any,
  isPremium: boolean,
  metadata?: { textbook?: string; lesson?: number }
): Promise<void> {
  // 1. Record VIEW event
  await this.trackProgress(
    'textbook_vocabulary',
    vocabId,
    ProgressEvent.VIEWED,
    user,
    isPremium
  )

  // 2. Update textbook-specific metadata
  const existing = await this.getProgressItem(user.uid, 'textbook_vocabulary', vocabId)
  const updated = {
    ...existing,
    textbook: metadata.textbook,
    lesson: metadata.lesson,
    // Status auto-updated by updateProgressForEvent()
  }
  await this.saveProgress(user.uid, 'textbook_vocabulary', vocabId, updated, isPremium)
}

/**
 * Track vocabulary review (correct/incorrect answer)
 * @see src/utils/textbookVocabularyProgressManager.ts:74-107
 */
async trackVocabReview(
  vocabId: string,
  user: any,
  isPremium: boolean,
  correct: boolean,
  metadata?: { textbook?: string; lesson?: number }
): Promise<void> {
  await this.trackProgress(
    'textbook_vocabulary',
    vocabId,
    correct ? ProgressEvent.COMPLETED : ProgressEvent.INTERACTED,
    user,
    isPremium,
    { correct }
  )
}

/**
 * Auto-promote status based on thresholds
 * @see src/utils/textbookVocabularyProgressManager.ts:240-269
 */
protected updateProgressForEvent(
  progress: TextbookVocabProgressData,
  event: ProgressEvent,
  metadata?: Partial<any>
): TextbookVocabProgressData {
  const updated = super.updateProgressForEvent(progress, event, metadata)

  // Threshold 1: 6 views = learned
  const views = updated.viewCount || 0
  if (views >= this.LEARNED_VIEW_THRESHOLD) {
    updated.status = 'learned'
  }

  // Threshold 2: 90% accuracy over 3+ attempts = learned
  const attempts = (updated.correctCount || 0) + (updated.incorrectCount || 0)
  const accuracy = attempts > 0 ? (updated.correctCount || 0) / attempts : 0
  if (attempts >= 3 && accuracy >= 0.9) {
    updated.status = 'learned'
  }

  return updated
}
```

### Sync Strategy (Premium Users)

```
User Action → Local Write (IndexedDB) → Sync Queue
                    ↓
          Immediate UI Update (Optimistic)
                    ↓
          Background Sync → Firebase API (/api/progress/track)
                    ↓
          On Success: Mark synced, remove from queue
          On Failure: Exponential backoff, retry
```

---

## Study Mode Implementation

### Component Structure

```typescript
// src/components/textbook-vocabulary/TextbookVocabularyStudyMode.tsx
export default function TextbookVocabularyStudyMode({
  vocabulary,      // Current vocabulary item
  onNext,          // Advance to next item
  onPrevious,      // Go back
  onBack,          // Exit study mode
  currentIndex,    // 1-based index
  totalItems,      // Total items in session
  onProgressUpdate // Callback to update progress
}: TextbookVocabularyStudyModeProps)
```

### Flashcard Flip Animation

```typescript
const [isFlipped, setIsFlipped] = useState(false)

<AnimatePresence mode="wait">
  {!isFlipped ? (
    // FRONT: Japanese word + reading
    <motion.div
      key="front"
      initial={{ rotateY: 0 }}
      exit={{ rotateY: 90 }}
      transition={{ duration: 0.3 }}
      onClick={() => setIsFlipped(true)}
    >
      <div className="text-5xl">{vocabulary.japanese}</div>
      <div className="text-xl">{vocabulary.reading}</div>
    </motion.div>
  ) : (
    // BACK: Interactive recall pills
    <motion.div
      key="back"
      initial={{ rotateY: -90 }}
      animate={{ rotateY: 0 }}
      transition={{ duration: 0.3 }}
      onClick={() => setIsFlipped(false)}
    >
      <RecallPills vocabulary={vocabulary} />
    </motion.div>
  )}
</AnimatePresence>
```

### Interactive Recall Pills

**Concept:** Active recall testing without explicit quiz interface

```typescript
// State for each pill
const [showMeaning, setShowMeaning] = useState(false)
const [showReading, setShowReading] = useState(false)
const [showExamples, setShowExamples] = useState(false)

// Auto-hide after 5 seconds
const meaningTimerRef = useRef<NodeJS.Timeout | null>(null)

const handleMeaningClick = () => {
  if (meaningTimerRef.current) {
    clearTimeout(meaningTimerRef.current)
  }
  setShowMeaning(!showMeaning)
  if (!showMeaning) {
    meaningTimerRef.current = setTimeout(() => {
      setShowMeaning(false)
    }, 5000)
  }
}

// Pill UI
<button onClick={handleMeaningClick} className="pill">
  {showMeaning ? vocabulary.meaning : "Tap to reveal"}
</button>
```

### Progress Tracking in Study Mode

```typescript
// Track view when component mounts
useEffect(() => {
  const trackView = async () => {
    if (vocabulary && user && !hasTrackedView) {
      await textbookVocabularyProgressManager.trackVocabView(
        vocabulary.id,
        user,
        isPremium ?? false,
        {
          textbook: vocabulary.textbook,
          lesson: vocabulary.lesson,
          chapter: vocabulary.chapter
        }
      )
      onProgressUpdate?.(vocabulary.id, { status: 'learning' })
      setHasTrackedView(true)
    }
  }
  trackView()
}, [vocabulary.id, user, hasTrackedView])
```

### Tatoeba Integration

**Tatoeba** provides real example sentences from native content.

```typescript
const [tatoebaSentences, setTatoebaSentences] = useState<Array<{
  japanese: string;
  english: string;
}>>([])

useEffect(() => {
  const fetchSentences = async () => {
    const response = await fetch(
      `/api/tatoeba/search?kanji=${encodeURIComponent(vocabulary.japanese)}&limit=2`
    )
    if (response.ok) {
      const data = await response.json()
      setTatoebaSentences(data.sentences || [])
    }
  }
  fetchSentences()
}, [vocabulary.japanese])
```

### XP Award on Completion

**Product Requirement:** Study mode awards XP despite being passive learning.

```typescript
const handleStudyNext = () => {
  if (currentStudyIndex < selectedVocabData.length - 1) {
    setCurrentStudyIndex(prev => prev + 1)
  } else {
    // Session complete - emit XP event
    const sessionDuration = Date.now() - studySessionStartTime
    const totalItems = selectedVocabData.length

    getEventHub().emit(ReviewEventType.SESSION_COMPLETED, {
      data: {
        sessionId: `study_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        statistics: {
          correctItems: totalItems,  // Assume all correct
          accuracy: 100,
          averageResponseTime: sessionDuration / totalItems,
          bestStreak: totalItems
        },
        duration: sessionDuration
      }
    })

    showToast('Study session complete!', 'success')
    setViewMode('browse')
  }
}
```

---

## Review Mode Implementation

### URE Session Configuration

```typescript
// Transform selected vocabulary to ReviewableContent
const vocabToReview = vocabulary.filter(v => selectedVocab.has(v.id))
const content = vocabToReview.map(v => vocabAdapter.transform(v))

// Create distractor pool from filtered vocabulary (same lesson)
const poolItems = filteredVocabulary.map(v => vocabAdapter.transform(v))

<ReviewSessionUI
  content={content}              // Items to review
  contentPool={poolItems}        // Distractor source
  mode="recognition"             // or "listening"
  onComplete={handleReviewComplete}
  onCancel={handleReviewCancel}
  userId={user.uid}
  shuffle={false}                // Maintain lesson order
/>
```

### Session Lifecycle

```
User Clicks "Review" Button
    ↓
handleStartReview()
    ↓
Transform vocabulary → ReviewableContent
    ↓
Set viewMode = 'review'
    ↓
ReviewSessionUI mounts
    ↓
URE SessionManager initializes
    ↓
User answers questions
    ↓
URE tracks progress automatically
    ↓
Session completes
    ↓
URE emits SESSION_COMPLETED (automatic)
    ↓
handleReviewComplete(statistics)
    ↓
Celebration screen shows
    ↓
User clicks "Close"
    ↓
handleReviewCancel()
    ↓
Clear session state, return to browse
```

### Automatic Progress Tracking

**Key Insight:** Review mode progress is tracked automatically by URE. No manual tracking needed.

```typescript
const handleReviewComplete = useCallback((statistics: SessionStatistics) => {
  // URE SessionManager emits SESSION_COMPLETED automatically
  // Gamification happens via Event Hub
  // Progress saved to IndexedDB via URE

  console.log('[Textbook Vocabulary] SESSION COMPLETE!', {
    correctItems: statistics.correctItems,
    accuracy: statistics.accuracy,
    totalTime: statistics.totalTime
  })

  // DO NOT setViewMode here - celebration screen must show
  refreshProgress()  // Reload from IndexedDB
}, [refreshProgress])

const handleReviewCancel = useCallback(() => {
  // User closed celebration screen or cancelled mid-session
  setViewMode('browse')
  showToast('Review session complete!', 'success')
}, [])
```

---

## Audio System Integration

### TTS Hook Usage

```typescript
import { useTTS } from '@/hooks/useTTS'

const { play, preload, loading, playing, currentText } = useTTS({
  cacheFirst: true  // Use cached audio when available
})
```

### Preloading Strategy

**Goal:** Instant playback for visible vocabulary items

```typescript
// Preload first 20 visible items
useEffect(() => {
  if (filteredVocab.length === 0) return

  const visibleCount = viewMode === 'grid' ? 20 : 15
  const visibleItems = filteredVocab.slice(0, visibleCount)

  const textsToPreload: string[] = []
  visibleItems.forEach(item => {
    textsToPreload.push(item.japanese)
    if (item.reading !== item.japanese) {
      textsToPreload.push(item.reading)
    }
  })

  // Chunk into groups of 10 to avoid API overload
  const chunkSize = 10
  for (let i = 0; i < textsToPreload.length; i += chunkSize) {
    const chunk = textsToPreload.slice(i, i + chunkSize)
    const chunkIndex = i / chunkSize

    // Stagger requests by 1s
    setTimeout(() => {
      preload(chunk).catch(err => {
        console.warn('[VocabularyDisplay] Preload failed:', err)
      })
    }, chunkIndex * 1000)
  }
}, [filteredVocab, viewMode, preload])
```

### Playback with Fallback

```typescript
const handlePlayAudio = async (text: string) => {
  try {
    // Primary: TTS service (VOICEVOX → ElevenLabs)
    await play(text)
  } catch (error) {
    // Fallback: Browser Web Speech API
    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ja-JP'
      utterance.rate = 0.9

      const voices = window.speechSynthesis.getVoices()
      const jpVoice = voices.find(voice => voice.lang.startsWith('ja'))
      if (jpVoice) utterance.voice = jpVoice

      window.speechSynthesis.speak(utterance)
    } else {
      showToast('Audio not available', 'warning')
    }
  }
}
```

---

## Entitlements & Gating

### Feature Configuration

```json
// config/features.v1.json
{
  "textbook_vocabulary": {
    "id": "textbook_vocabulary",
    "name": "Textbook Vocabulary",
    "limits": {
      "guest": {
        "daily": 0,
        "monthly": 0
      },
      "free": {
        "daily": 3,      // 3 lessons per day
        "monthly": 90
      },
      "premium": {
        "daily": -1,     // Unlimited
        "monthly": -1
      }
    }
  }
}
```

### Client-Side Gating

```typescript
import { useFeature } from '@/hooks/useFeature'
import { useFeatureUsage } from '@/components/entitlements/FeatureUsageIndicator'

// Get check function and usage data
const { checkAndTrack } = useFeature('textbook_vocabulary')
const usageData = useFeatureUsage('textbook_vocabulary')

// Check before allowing lesson access
const handleLessonChange = async (lesson: number | 'all') => {
  if (lesson === 'all') {
    // "All Lessons" only for premium
    if (!isPremium) return false
    setCurrentLesson('all')
    return true
  }

  // Check entitlement (shows upgrade UI if limit reached)
  const allowed = await checkAndTrack({
    showUI: true,
    metadata: { itemId: `${selectedTextbook}:${lesson}` }
  })

  if (!allowed) return false

  setCurrentLesson(lesson)
  return true
}

// Display usage indicator
<FeatureUsageIndicator featureId="textbook_vocabulary" />
<DesktopCircularIndicator
  remaining={usageData.remaining}
  limitCount={usageData.limitCount}
  usedCount={usageData.usedCount}
  color={usageData.color}
/>
```

### Server-Side Enforcement

```typescript
// API route: /api/usage/textbook_vocabulary/check
// Called automatically by useFeature hook
// Returns: { allowed: boolean, remaining: number }
```

---

## Adding New Features

### Add New Review Mode

**Example:** Add "writing" mode where user must type the Japanese word

```typescript
// 1. Add to adapter configuration
const TEXTBOOK_VOCABULARY_CONFIG: ContentTypeConfig = {
  availableModes: [
    // ... existing modes
    {
      mode: 'writing',
      showPrimary: true,       // Show meaning as prompt
      showSecondary: false,
      showTertiary: false,
      showMedia: false,
      inputType: 'text-input', // User types answer
      allowHints: true,
      hintPenalty: 0.2,
      immediateValidation: false,  // Validate on submit
      allowRetry: true
    }
  ]
}

// 2. Implement mode preparation
prepareForMode(content: ReviewableContent, mode: ReviewMode) {
  switch (mode) {
    case 'writing':
      return {
        ...content,
        primaryDisplay: content.metadata?.meaning,
        primaryAnswer: content.metadata?.japanese,
        // Fuzzy validation for typing
        validationOptions: { threshold: 0.8, ignoreCase: true }
      }
  }
}

// 3. Update supported modes
getSupportedModes(): ReviewMode[] {
  return ['recognition', 'listening', 'writing']
}
```

### Add Custom Filtering

**Example:** Filter by part of speech

```typescript
// 1. Add state
const [selectedPOS, setSelectedPOS] = useState<string | 'all'>('all')

// 2. Update filter logic
useEffect(() => {
  let filtered = vocabulary

  if (selectedLesson !== 'all') {
    filtered = filtered.filter(item => item.lesson === selectedLesson)
  }

  if (selectedPOS !== 'all') {
    filtered = filtered.filter(item =>
      item.partOfSpeech?.includes(selectedPOS)
    )
  }

  setFilteredVocab(filtered)
}, [vocabulary, selectedLesson, selectedPOS])

// 3. Add UI control
<select value={selectedPOS} onChange={(e) => setSelectedPOS(e.target.value)}>
  <option value="all">All Parts of Speech</option>
  <option value="noun">Nouns</option>
  <option value="verb">Verbs</option>
  <option value="adjective">Adjectives</option>
</select>
```

### Add Export Feature

```typescript
const handleExportProgress = async () => {
  if (!user || !selectedTextbook) return

  const progress = await textbookVocabularyProgressManager.getTextbookProgress(
    user,
    isPremium ?? false,
    selectedTextbook
  )

  const exportData = {
    textbook: selectedTextbook,
    exportDate: new Date().toISOString(),
    items: Array.from(progress.entries()).map(([id, data]) => ({
      vocabId: id,
      japanese: data.japanese,
      status: data.status,
      viewCount: data.viewCount,
      correctCount: data.correctCount,
      incorrectCount: data.incorrectCount,
      lastReviewDate: data.lastReviewDate
    }))
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `moshimoshi-${selectedTextbook}-progress-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## Performance Optimization

### Virtual Scrolling for Large Datasets

**Problem:** Rendering 9,279 items (Kanji in Context) causes lag

**Solution:** Use `react-window` for virtualized rendering

```typescript
import { FixedSizeGrid as Grid } from 'react-window'

<Grid
  columnCount={4}
  columnWidth={250}
  height={800}
  rowCount={Math.ceil(filteredVocab.length / 4)}
  rowHeight={200}
  width={1000}
>
  {({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * 4 + columnIndex
    if (index >= filteredVocab.length) return null

    const item = filteredVocab[index]
    return (
      <div style={style}>
        <VocabularyCard item={item} />
      </div>
    )
  }}
</Grid>
```

### Debounced Search

```typescript
import { useMemo } from 'react'
import debounce from 'lodash/debounce'

const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    const filtered = vocabulary.filter(item =>
      item.japanese.includes(query) ||
      item.reading.includes(query) ||
      item.meaning.toLowerCase().includes(query.toLowerCase())
    )
    setFilteredVocab(filtered)
  }, 300),
  [vocabulary]
)

<input
  onChange={(e) => debouncedSearch(e.target.value)}
  placeholder="Search..."
/>
```

### Memoized Calculations

```typescript
// Expensive stats calculation
const stats = useMemo(() => {
  const total = filteredVocabulary.length
  let learned = 0
  vocabProgress.forEach((progress) => {
    if (progress.status === 'learned' || progress.status === 'mastered') {
      learned++
    }
  })
  return { total, learned, percentComplete: (learned / total) * 100 }
}, [filteredVocabulary, vocabProgress])

// Adapter instance (should only be created once)
const vocabAdapter = useMemo(
  () => new TextbookVocabularyAdapter({
    contentType: 'textbook_vocabulary',
    availableModes: [...],
    defaultMode: 'recognition',
    validationStrategy: 'fuzzy'
  }),
  []
)
```

---

## Code Examples

### Complete Study Session Flow

```typescript
// 1. User selects vocabulary items
const [selectedVocab, setSelectedVocab] = useState<Set<string>>(new Set())

const handleToggleSelection = (id: string) => {
  setSelectedVocab(prev => {
    const newSet = new Set(prev)
    newSet.has(id) ? newSet.delete(id) : newSet.add(id)
    return newSet
  })
}

// 2. User starts study session
const handleStartStudy = () => {
  if (selectedVocab.size === 0) {
    showToast('Please select vocabulary items', 'warning')
    return
  }

  const vocabToStudy = vocabulary.filter(v => selectedVocab.has(v.id))
  setSelectedVocabData(vocabToStudy)
  setCurrentStudyIndex(0)
  setStudySessionStartTime(Date.now())
  setViewMode('study')
}

// 3. Study mode component renders
<TextbookVocabularyStudyMode
  vocabulary={selectedVocabData[currentStudyIndex]}
  onNext={handleStudyNext}
  onPrevious={handleStudyPrevious}
  onBack={handleStudyBack}
  currentIndex={currentStudyIndex + 1}
  totalItems={selectedVocabData.length}
  onProgressUpdate={handleProgressUpdate}
/>

// 4. User navigates through items
const handleStudyNext = () => {
  if (currentStudyIndex < selectedVocabData.length - 1) {
    setCurrentStudyIndex(prev => prev + 1)
  } else {
    // Session complete - emit XP
    const duration = Date.now() - studySessionStartTime
    getEventHub().emit(ReviewEventType.SESSION_COMPLETED, {
      data: {
        sessionId: `study_${Date.now()}`,
        statistics: {
          correctItems: selectedVocabData.length,
          accuracy: 100,
          averageResponseTime: duration / selectedVocabData.length,
          bestStreak: selectedVocabData.length
        },
        duration
      }
    })
    setViewMode('browse')
    refreshProgress()
  }
}
```

### Complete Review Session Flow

```typescript
// 1. Transform vocabulary to ReviewableContent
const vocabAdapter = new TextbookVocabularyAdapter()

const handleStartReview = () => {
  if (selectedVocab.size === 0) {
    showToast('Please select vocabulary items', 'warning')
    return
  }

  const vocabToReview = vocabulary.filter(v => selectedVocab.has(v.id))

  // Transform for URE
  const content = vocabToReview.map(v => vocabAdapter.transform(v))
  setReviewContent(content)

  // Pool for distractor generation (all items in current lesson)
  const poolItems = filteredVocabulary.map(v => vocabAdapter.transform(v))
  setReviewContentPool(poolItems)

  setViewMode('review')
}

// 2. ReviewSessionUI handles the session
<ReviewSessionUI
  content={reviewContent}
  contentPool={reviewContentPool}
  mode="recognition"
  onComplete={(stats) => {
    console.log('Review complete:', stats)
    refreshProgress()
  }}
  onCancel={() => {
    setViewMode('browse')
  }}
  userId={user.uid}
  shuffle={false}
/>

// URE automatically:
// - Generates questions with distractors
// - Tracks answers
// - Saves progress to IndexedDB
// - Emits SESSION_COMPLETED event
// - Shows celebration screen
```

---

## Best Practices

### Do's ✅

1. **Always sanitize vocabulary data** - Use `stripHtmlTags()` before display
2. **Preload audio for visible items** - Better UX with instant playback
3. **Clear state when switching modes** - Prevent data leaks between sessions
4. **Use URE adapter for all review content** - Consistent transformation
5. **Track progress locally first** - Optimistic updates, sync later
6. **Memoize expensive calculations** - stats, adapters, filtered lists

### Don'ts ❌

1. **Don't render all items without virtualization** - Performance issues
2. **Don't manually emit SESSION_COMPLETED in review mode** - URE handles it
3. **Don't forget to refresh progress after sessions** - UI won't update
4. **Don't use hardcoded textbook IDs** - Load from `index.json`
5. **Don't skip entitlement checks** - Free users get 3 lessons/day
6. **Don't use bash scripts for data editing** - Use Edit tool for TypeScript

---

## Related Documentation

- [README.md](./README.md) - Feature overview
- [DATA_PIPELINE_GUIDE.md](./DATA_PIPELINE_GUIDE.md) - Anki conversion process
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and fixes
- [Universal Review Engine Deep Dive](../../docs/REVIEW_ENGINE_DEEP_DIVE.md)
- [Entitlements System](../entitlements/FEATURE_GUIDE.md)
- [TTS System Guide](../tts/TTS_SYSTEM_GUIDE.md)

---

**Last Updated:** 2026-01-31
**Maintainer:** Development Team
