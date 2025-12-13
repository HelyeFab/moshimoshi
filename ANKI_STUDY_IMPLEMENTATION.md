# Anki Study Session Implementation

> **Date**: December 2024
> **Status**: Complete
> **Features**: Daily limits, SRS integration, cross-device sync

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Changes](#architecture-changes)
3. [Firestore Collection Restructure](#firestore-collection-restructure)
4. [Anki Study Session](#anki-study-session)
5. [File Reference](#file-reference)
6. [Daily Limits Logic](#daily-limits-logic)
7. [SRS Integration](#srs-integration)
8. [Testing](#testing)
9. [Deployment Notes](#deployment-notes)

---

## Overview

This document covers the implementation of the Anki study session feature with daily limits enforcement. The work included:

1. **Firestore Collection Restructure**: Migrated from nested collections (`users/{userId}/flashcardDecks`) to top-level collections (`flashcardDecks` with `userId` field)
2. **Sync Fixes**: Resolved IndexedDB caching issues and added composite indexes
3. **Anki Study Session**: Full study session with `newCardsPerDay` and `reviewsPerDay` enforcement using the existing SM-2+ SRS algorithm

---

## Architecture Changes

### Before (Nested Collections)
```
users/
  {userId}/
    flashcardDecks/
      {deckId}
    ankiDecks/
      {deckId}
```

### After (Top-Level Collections)
```
flashcardDecks/
  {deckId}  // Contains userId field
ankiDecks/
  {deckId}  // Contains userId field
```

**Rationale**:
- Simpler query patterns
- Better scalability
- Easier cross-user operations (future sharing features)
- Standard Firestore pattern for user-owned documents

---

## Firestore Collection Restructure

### Firestore Rules (`firestore.rules`)

```javascript
// Flashcard decks - top-level collection with userId field
match /flashcardDecks/{deckId} {
  allow read: if isAuthenticated() &&
    resource.data.userId == request.auth.uid;
  allow write: if false; // Server-side only
}

// Anki decks - top-level collection with userId field
match /ankiDecks/{deckId} {
  allow read: if isAuthenticated() &&
    resource.data.userId == request.auth.uid;
  allow write: if false; // Server-side only
}
```

### Composite Indexes (`firestore.indexes.json`)

Required for `where('userId', '==', uid).orderBy('updatedAt', 'desc')` queries:

```json
{
  "collectionGroup": "flashcardDecks",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "ankiDecks",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
}
```

### API Route Changes

All API routes updated to use top-level collections:

```typescript
// Before (nested)
const decksRef = adminDb
  .collection('users')
  .doc(session.uid)
  .collection('flashcardDecks')

// After (top-level with userId filter)
const decksRef = adminDb.collection('flashcardDecks')
const snapshot = await decksRef
  .where('userId', '==', session.uid)
  .orderBy('updatedAt', 'desc')
  .get()
```

---

## Anki Study Session

### Core Components

#### 1. AnkiStudyManager (`src/lib/anki/AnkiStudyManager.ts`)

Singleton class managing study sessions:

```typescript
class AnkiStudyManager {
  private srsAlgorithm: SRSAlgorithm  // Reuses existing SM-2+

  // Initialize SRS data for a card
  initializeCardSRS(card: AnkiCard): AnkiCardWithSRS

  // Get today's progress for a deck
  getTodayProgress(deckId: string, userId: string): Promise<AnkiDailyProgress>

  // Get cards due for study, respecting daily limits
  getDueCards(deck: StoredAnkiDeck, userId: string): Promise<DueCardsResult>

  // Record card as studied (update daily progress)
  recordCardStudied(deckId: string, cardId: string, userId: string, isNew: boolean): Promise<void>

  // Process review result using SRSAlgorithm
  processReviewResult(card: AnkiCard, result: ReviewResult): AnkiCardWithSRS

  // Save updated card SRS to deck
  updateCardInDeck(deckId: string, card: AnkiCardWithSRS, userId: string, isPremium: boolean): Promise<void>
}
```

#### 2. useAnkiStudy Hook (`src/hooks/useAnkiStudy.ts`)

React hook for session management:

```typescript
function useAnkiStudy(deckId: string) {
  return {
    // State
    deck: StoredAnkiDeck | null,
    isLoading: boolean,
    error: string | null,

    // Due cards
    newCards: AnkiCard[],
    reviewCards: AnkiCard[],

    // Progress
    todayProgress: AnkiDailyProgress | null,
    remainingNew: number,
    remainingReviews: number,

    // Session
    sessionCards: AnkiCard[],
    currentCardIndex: number,
    sessionStats: AnkiSessionStats,

    // Actions
    loadDeck: () => Promise<void>,
    startSession: () => void,
    recordAnswer: (cardId: string, result: ReviewResult) => Promise<void>,
    nextCard: () => void,
    endSession: () => Promise<SessionSummary>,
    resetSession: () => void,
  }
}
```

#### 3. Study Page (`src/app/[locale]/anki-study/[deckId]/page.tsx`)

Three-state page:

1. **Preview**: Shows deck stats, card counts, daily limits, "Start Study" button
2. **Studying**: Renders `ReviewEngine` component with transformed cards
3. **Complete**: Shows session summary (cards studied, time, accuracy)

### Data Schemas

#### CardSRSData (per-card SRS state)

```typescript
interface CardSRSData {
  status: 'new' | 'learning' | 'review' | 'mastered'
  interval: number           // Days until next review
  easeFactor: number         // SM-2 ease factor (1.3 - 2.5)
  repetitions: number        // Successful review count
  nextReviewAt: Date | null  // When card is due
  reviewCount: number        // Total reviews
  correctCount: number       // Correct reviews
  streak: number             // Current streak
  bestStreak: number         // Best streak ever
  lastReviewedAt: Date | null
}
```

#### AnkiDailyProgress (IndexedDB)

```typescript
interface AnkiDailyProgress {
  id: string              // `${deckId}_${YYYY-MM-DD}`
  deckId: string
  userId: string
  date: string            // YYYY-MM-DD
  newCardsStudied: number
  reviewCardsStudied: number
  totalTime: number       // milliseconds
  cardIds: string[]       // Cards studied today
  updatedAt: number
}
```

---

## File Reference

### Created Files

| File | Description |
|------|-------------|
| `src/lib/anki/AnkiStudyManager.ts` | Core study session logic with SRS integration |
| `src/hooks/useAnkiStudy.ts` | React hook for session state management |
| `src/app/[locale]/anki-study/[deckId]/page.tsx` | Study session page component |
| `src/app/[locale]/anki-study/[deckId]/layout.tsx` | Layout with SEO metadata |

### Modified Files

| File | Changes |
|------|---------|
| `firestore.rules` | Added top-level collection rules for flashcardDecks and ankiDecks |
| `firestore.indexes.json` | Added composite indexes for userId + updatedAt queries |
| `src/app/api/flashcards/decks/route.ts` | Changed to top-level collection queries |
| `src/app/api/flashcards/decks/[id]/route.ts` | Added ownership verification |
| `src/app/api/anki/decks/route.ts` | Changed to top-level collection queries |
| `src/app/api/anki/decks/[id]/route.ts` | Added ownership verification |
| `src/app/[locale]/anki-import/page.tsx` | Wired up "Start Review" button, added remaining cards display |
| `src/lib/flashcards/FlashcardManager.ts` | Added `clearLocalData()` and `forceSyncFromServer()` methods |
| `src/i18n/locales/*/strings.ts` | Added study-related translations (6 locales) |

### Test Files

| File | Status |
|------|--------|
| `src/app/api/anki/decks/__tests__/route.test.ts` | Updated mocks for top-level collections |
| `src/app/api/anki/decks/[id]/__tests__/route.test.ts` | Updated mocks for top-level collections |

---

## Daily Limits Logic

### How Limits Are Enforced

```typescript
// When loading cards for study:
const todayProgress = await getTodayProgress(deckId, userId)
const settings = deck.settings // { newCardsPerDay: 20, reviewsPerDay: 100 }

// Calculate remaining allowance
const remainingNew = Math.max(0, settings.newCardsPerDay - todayProgress.newCardsStudied)
const remainingReviews = Math.max(0, settings.reviewsPerDay - todayProgress.reviewCardsStudied)

// Categorize cards
const newCards = allCards.filter(c => c.srsData.status === 'new')
const reviewCards = allCards.filter(c =>
  c.srsData.status !== 'new' &&
  c.srsData.nextReviewAt <= now
)

// Apply limits
const sessionNewCards = newCards.slice(0, remainingNew)
const sessionReviewCards = reviewCards.slice(0, remainingReviews)
```

### Example Timeline

```
Deck: 2000 cards, newCardsPerDay=20, reviewsPerDay=100

Day 1:
  - New: 20 cards shown
  - Reviews: 0 (none due yet)

Day 2:
  - New: 20 cards shown
  - Reviews: Cards from Day 1 that are due

Day 3:
  - New: 20 cards shown
  - Reviews: Cards from Days 1-2 that are due

...continues until all 2000 cards are introduced (100 days)
```

### Progress Resets

Daily progress resets at midnight (local time) based on date string comparison:

```typescript
private getTodayDateString(): string {
  return nowDate().toISOString().split('T')[0]  // YYYY-MM-DD
}
```

---

## SRS Integration

### Reusing Existing Algorithm

The implementation reuses the existing `SRSAlgorithm` class from the Universal Review Engine:

```typescript
// src/lib/review-engine/srs/algorithm.ts
class SRSAlgorithm {
  calculateNextReview(item: ReviewableContentWithSRS, result: ReviewResult): SRSData
}
```

### SM-2+ Features Used

- **Ease Factor**: 1.3 - 2.5 range with dynamic adjustment
- **Learning Steps**: 10min, 30min before graduating
- **Interval Randomization**: ±5% to prevent batch reviews
- **Overdue Bonus**: +20-50% interval for items 7+ days overdue
- **Leech Detection**: Visual indicator at 8+ failures

### Card State Flow

```
NEW → LEARNING → REVIEW → MASTERED
         ↓          ↓
         └──────────┴── (on incorrect answer, back to LEARNING)

Mastery Criteria:
- Interval >= 21 days
- Accuracy >= 90%
```

---

## Testing

### Running Tests

```bash
# Run all Anki tests
npm test -- --testPathPatterns="anki"

# Run specific test file
npm test -- src/app/api/anki/decks/__tests__/route.test.ts
```

### Test Results

```
Test Suites: 3 passed, 3 total
Tests:       46 passed, 46 total
```

### TypeScript Validation

```bash
npx tsc --noEmit  # No errors
```

---

## Deployment Notes

### Firebase Deployment

After making Firestore changes, deploy indexes and rules:

```bash
# Deploy everything
firebase deploy --only firestore

# Or separately
firebase deploy --only firestore:indexes
firebase deploy --only firestore:rules
```

### Index Build Time

Composite indexes take 5-10 minutes to build. During this time, queries will fail with:

```
Error: 9 FAILED_PRECONDITION: The query requires an index.
```

The API routes handle this gracefully:

```typescript
if (error?.code === 9 || error?.message?.includes('index')) {
  return NextResponse.json({
    error: 'Database index not ready. Please wait a few minutes and try again.',
    details: 'Missing composite index for ankiDecks collection',
  }, { status: 503 })
}
```

### Migration Notes

If migrating existing data from nested to top-level collections:

1. Export data from nested collections
2. Add `userId` field to each document
3. Import to top-level collections
4. Deploy new indexes
5. Wait for indexes to build
6. Deploy new API routes
7. Clear client IndexedDB caches

---

## Future Enhancements

Potential improvements for future iterations:

1. **Deck Sharing**: Top-level collections make this easier
2. **Study Reminders**: Push notifications when cards are due
3. **Heatmap Calendar**: Visualize study streaks
4. **Custom Learning Steps**: User-configurable learning intervals
5. **Suspend/Bury Cards**: Temporarily remove cards from rotation
6. **Card Tags**: Filter study by tags
7. **Import SRS Data**: Preserve Anki's existing scheduling data on import

---

## Troubleshooting

### Cards Not Showing

1. Check daily limits haven't been reached
2. Verify IndexedDB has the deck data
3. Check browser console for API errors
4. Ensure Firestore indexes are built

### Sync Issues

1. Clear IndexedDB: `await ankiDeckManager.clearLocalData()`
2. Force sync: `await ankiDeckManager.forceSyncFromServer(userId)`
3. Check Firebase console for data

### SRS Not Working

1. Verify card has `srsData` after first review
2. Check `nextReviewAt` date is being set
3. Ensure `processReviewResult` is being called

---

*Last Updated: December 2024*
