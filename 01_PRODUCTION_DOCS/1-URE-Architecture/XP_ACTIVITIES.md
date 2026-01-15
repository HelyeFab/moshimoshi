# Moshimoshi XP Activities Guide

> **Last Updated**: 2025-12-20
> **Last Verified Against Codebase**: 2025-12-20

This document describes all activities in the app that reward XP, their mechanisms, and reward amounts.

## Overview

XP (Experience Points) is the core gamification currency in Moshimoshi. Users earn XP by completing various learning activities, which contributes to:
- **Leveling up**: Level = floor(totalXP / 1000) - minimum level is 1
- **Maintaining streaks**: Requires minimum 150 XP per day
- **Unlocking achievements**: Various milestones tied to XP and activity completion

---

## XP Mechanism Summary: URE vs Direct API

This table clarifies which features award XP through URE (Event Hub) vs direct API calls.

| Feature | Uses URE? | XP Mechanism | How It Works |
|---------|-----------|--------------|--------------|
| **Kana Learning** | ✅ Yes | Event Hub | `ReviewSessionUI` → `SESSION_COMPLETED` → `gamificationListener` → `recordReviewCompletion()` |
| **Kanji Browser** | ✅ Yes | Event Hub | Same as Kana Learning |
| **Textbook Vocabulary** | ✅ Yes | Event Hub | Same as Kana Learning |
| **User Lists** | ✅ Yes | Event Hub | Same as Kana Learning |
| **Flashcards** | ✅ Yes | Event Hub | `getEventHub().emit()` → `gamificationListener` → `recordReviewCompletion()` |
| **Drill Sessions** | ❌ No | Direct API | `DrillProgressManager` → `PUT /api/drill/session` → `recordDrillCompletion()` |
| **Anki Study** | ✅ Yes (UI/events) | Event Hub | ReviewSessionUI emits SESSION_COMPLETED; Anki SRS remains in useAnkiStudy |
| **News Reading** | ❌ No | Direct API | `POST /api/news/progress/complete` → `calculateNewsXP()` |
| **Book Reading** | ❌ No | Direct API | `POST /api/library/books/complete` → `calculateBookXP()` |
| **Quiz Completion** | ❌ No | Direct API + Manual Store Update | `POST /api/quiz/complete` → `calculateQuizXP()` + `useGamificationStore` |

### Key Architectural Differences

| Aspect | URE Features | Non-URE Features |
|--------|--------------|------------------|
| **Event Flow** | Event Hub singleton → `gamificationListener` | Direct `fetch()` to API |
| **XP Function** | `recordReviewCompletion()` | Feature-specific (e.g., `recordDrillCompletion()`) |
| **Session Tracking** | `SessionManager` handles lifecycle | Feature manages own state |
| **Celebration UI** | `CelebrationProvider` auto-triggers | ✅ Manual trigger implemented (Quiz, Drill) |

### Code Flow References

**URE XP Flow** (Kana, Kanji, Textbook, Lists, Flashcards):
```
getEventHub().emit(SESSION_COMPLETED)
  → gamificationListener.handleSessionCompleted()
  → POST /api/review/session/complete
  → recordReviewCompletion()
```

**Drill XP Flow**:
```
DrillProgressManager
  → PUT /api/drill/session
  → recordDrillCompletion()
```

---

## Active XP-Rewarding Activities

### 1. Kana Practice (Hiragana & Katakana)

**Location**: `src/components/learn/KanaLearningComponent.tsx`

**API Route**: `POST /api/review/session/complete` (via URE event system)

**Mechanism**: Fully integrated with URE (Universal Review Engine). Uses the same XP formula as Review Sessions.

| Component | XP Amount |
|-----------|-----------|
| Base XP | 3 XP × correct answers |
| Perfect accuracy (100%) | +30 XP bonus |
| Excellent accuracy (90-99%) | +15 XP bonus |
| Good accuracy (80-89%) | +5 XP bonus |
| Volume bonus | +5 XP per 10 items reviewed |

**Integration Flow**:
```
KanaLearningComponent
  → ureEventEmitter.emit(SESSION_COMPLETED)
  → gamificationListener.handleSessionCompleted()
  → POST /api/review/session/complete
  → recordReviewCompletion()
```

**Modes that award XP**:
- ✅ Recognition mode (multiple choice)
- ✅ Recall mode (typing)
- ✅ Listening mode (audio)
- ✅ Study mode (flip cards with completion)

**Notes**:
- URE adapter: `src/lib/review-engine/adapters/kana.adapter.ts`
- Validator: `src/lib/review-engine/validation/kana-validator.ts`
- Supports fuzzy matching for similar characters (ね/れ/わ)
- Progress tracked via `KanaProgressManager` (IndexedDB + Firebase)

---

### 2. Drill Sessions

**Location**: `src/lib/gamification/services/gamification-coordinator.ts` → `calculateDrillXP()`

**API Route**: `PUT /api/drill/session`

**Mechanism**: Score-based with accuracy bonuses

| Component | XP Amount |
|-----------|-----------|
| Base XP | 5 XP × correct answers |
| Perfect accuracy (100%) | +50 XP bonus |
| Excellent accuracy (90-99%) | +25 XP bonus |
| Good accuracy (80-89%) | +10 XP bonus |
| Completion bonus (all correct) | +20 XP bonus |

**Example Calculations**:
- 10/10 correct (100%): `(10 × 5) + 50 + 20 = 120 XP`
- 9/10 correct (90%): `(9 × 5) + 25 = 70 XP`
- 8/10 correct (80%): `(8 × 5) + 10 = 50 XP`
- 7/10 correct (70%): `(7 × 5) + 0 = 35 XP`

---

### 2. Review Sessions (URE - Universal Review Engine)

**Location**: `src/lib/gamification/services/gamification-coordinator.ts` → `calculateReviewXP()`

**API Route**: `POST /api/review/session/complete`

**Mechanism**: Per-item rewards with accuracy and volume bonuses

| Component | XP Amount |
|-----------|-----------|
| Base XP | 3 XP × correct reviews |
| Perfect accuracy (100%) | +30 XP bonus |
| Excellent accuracy (90-99%) | +15 XP bonus |
| Good accuracy (80-89%) | +5 XP bonus |
| Volume bonus | +5 XP per 10 items reviewed |

**Example Calculations**:
- 20 items, 20 correct (100%): `(20 × 3) + 30 + (2 × 5) = 100 XP`
- 20 items, 18 correct (90%): `(18 × 3) + 15 + (2 × 5) = 79 XP`
- 30 items, 24 correct (80%): `(24 × 3) + 5 + (3 × 5) = 92 XP`

---

### 3. News Article Reading

**Location**: `src/lib/gamification/services/gamification-coordinator.ts` → `calculateNewsXP()`

**API Route**: `POST /api/news/progress/complete`

**Mechanism**: Time-based with cap

| Component | XP Amount |
|-----------|-----------|
| Base XP | 1 XP per 30 seconds of reading |
| Maximum cap | 50 XP per article |

**Example Calculations**:
- 5 minutes reading: `floor(300s / 30) = 10 XP`
- 15 minutes reading: `floor(900s / 30) = 30 XP`
- 30 minutes reading: `floor(1800s / 30) = 50 XP` (cap reached)

**Notes**:
- First completion only (no XP on re-reading same article)
- Tracked via `news_progress` Firestore collection

**Achievements**:
- "Avid Reader": Read 10 articles
- "News Junkie": Read 50 articles

---

### 4. Book Reading

**Location**: `src/lib/gamification/services/gamification-coordinator.ts` → `calculateBookXP()`

**API Route**: `POST /api/library/books/complete`

**Mechanism**: Time-based with cap (same as news)

| Component | XP Amount |
|-----------|-----------|
| Base XP | 1 XP per 30 seconds of reading |
| Maximum cap | 50 XP per book |

**Notes**:
- First completion only
- Tracked via `bookProgress` Firestore collection

**Achievements**:
- "Bookworm": Read 5 books
- "Library Master": Read 20 books

---

### 5. Quiz Completion (Stories & Comics)

**Location**: `src/lib/gamification/services/gamification-coordinator.ts` → `calculateQuizXP()`

**API Route**: `POST /api/quiz/complete`

**Mechanism**: Tiered rewards based on score percentage

| Score Range | XP Earned |
|-------------|-----------|
| 80-100% | 30 XP |
| 60-79% | 15 XP |
| 40-59% | 5 XP |
| 0-39% | 0 XP |

**Integration Flow** (Non-URE with manual store update):
```
QuizPlayer Component
  → POST /api/quiz/complete
  → calculateQuizXP()
  → Manual useGamificationStore updates:
      • updateFromServer() - sync XP, level, streak
      • setLastSessionStats() - provide celebration data
      • incrementSessionCount() - trigger CelebrationProvider
```

**Celebration Trigger** (Implemented):
Quiz follows the same pattern as DrillProgressManager for non-URE celebration:
```typescript
// After successful API response
const store = useGamificationStore.getState()
store.updateFromServer({
  totalXP: data.newTotalXP,
  currentLevel: data.newLevel,
  currentStreak: data.currentStreak,
  bestStreak: data.bestStreak
})

store.setLastSessionStats({
  itemsCompleted: totalQuestions,
  accuracy: scorePercentage,
  duration: 0, // Quizzes don't track time
  xpGained: xpEarned
})

store.incrementSessionCount() // Triggers CelebrationProvider watch
```

**Notes**:
- First completion only (retakes show "already completed")
- Same formula for both story and comic quizzes
- Tracked via `quiz_progress` Firestore collection
- ✅ Celebration screen connected (as of 2025-01-13)
- Respects `NEXT_PUBLIC_ENABLE_GAMIFICATION` environment flag

**Achievements**:
- "Quiz Master": Complete 10 quizzes with 80%+ score
- "Perfect Score": Get 100% on any quiz

---

### 6. Manual XP Awards

**Location**: `src/lib/gamification/services/gamification-coordinator.ts` → `awardManualXP()`

**Mechanism**: Admin-only function for special events

| Component | XP Amount |
|-----------|-----------|
| Amount | Variable (admin-specified) |

**Use Cases**:
- Special event bonuses
- Bug fix compensation
- Promotional campaigns
- Achievement unlocks

**Notes**:
- Logged in `xp_logs` collection for audit trail
- Does not automatically trigger streak updates

---

## Activities WITHOUT XP Integration

The following activities exist in the app but do **NOT** currently award XP:

### Kana Drop Game

**Location**: `src/app/[locale]/games/kana-drop/components/KanaDropGame.tsx`

**Status**: No gamification integration

**Issue**: The arcade-style falling kana game displays victory screens with stats but does not emit any URE events or call gamification APIs.

**Recommendation**: Add `ureEventEmitter.emit(SESSION_COMPLETED)` to the victory handler to award XP based on game performance.

---

## Configured but Not Yet Implemented

The following activities are defined in `config/xp-config.json` but not yet fully implemented:

| Activity | Status | Planned Base XP |
|----------|--------|-----------------|
| Flashcards | Configured | 10 XP/correct |
| Kanji Mastery | Configured | 10 XP/kanji |
| Kana Practice | Disabled | 5 XP/correct |
| Word Learning | Disabled | 8 XP/word |
| Kanji Connection | Disabled | 5 XP/connection |
| YouTube Shadowing | Configured | 2 XP/minute |
| Vocabulary Study | Disabled | 7 XP/word |
| Story Reading | Disabled | 25 XP base |
| Conjugation Practice | Disabled | 6 XP/correct |

---

## Streak System

**Configuration**: `src/config/gamification/streak.json`

| Setting | Value |
|---------|-------|
| Minimum XP for streak | 150 XP |
| Grace period | 24 hours |
| Reset time | 00:00 UTC |

### Streak Mechanics

1. **Daily XP Accumulation**: XP from all activities accumulates throughout the day
2. **Streak Increment**: When daily XP reaches 150+, streak increments (once per day)
3. **Streak Break**: If daily XP < 150 and grace period expires, streak resets to 0
4. **Streak Save**: Users can trade XP to save a breaking streak (dynamic pricing)

---

## Anti-Cheat Measures

**Configuration**: `config/xp-config.json`

| Setting | Value |
|---------|-------|
| Global daily limit | 5,000 XP |
| Suspicious threshold | 1,000 XP (triggers logging) |

---

## Level System

| Level | Total XP Required |
|-------|-------------------|
| 1 | 0 - 999 XP |
| 2 | 1,000 - 1,999 XP |
| 3 | 2,000 - 2,999 XP |
| ... | ... |
| N | (N-1) × 1,000 XP |

**Formula**: `Level = max(1, floor(totalXP / 1000))`

---

## Technical Implementation

### Database Collections

| Collection | Purpose |
|------------|---------|
| `user_stats` | Main XP, level, streak data |
| `news_progress` | Article completion tracking |
| `bookProgress` | Book completion tracking |
| `quiz_progress` | Quiz completion tracking |
| `xp_logs` | Manual XP award audit trail |

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/gamification/services/gamification-coordinator.ts` | All XP calculation and recording functions |
| `src/lib/gamification/services/streakService.ts` | Streak management |
| `src/config/gamification/streak.json` | Streak configuration |
| `config/xp-config.json` | Activity XP configuration |
| `firestore.rules` | Database security rules |

### GamificationResult Interface

All XP recording functions return:

```typescript
interface GamificationResult {
  xpEarned: number
  newTotalXP: number
  newLevel: number
  streakIncremented: boolean
  currentStreak: number
  bestStreak: number
  achievementsUnlocked: string[]
}
```

---

## Quick Reference Table

| Activity | Base Formula | Bonuses | Max per Session |
|----------|--------------|---------|-----------------|
| Kana Practice | 3 XP/correct | Accuracy (5-30), Volume (5/10 items) | Unlimited |
| Drill | 5 XP/correct | Accuracy (10-50), Completion (20) | ~120 XP |
| Review (URE) | 3 XP/correct | Accuracy (5-30), Volume (5/10 items) | Unlimited |
| News Reading | 1 XP/30s | None | 50 XP |
| Book Reading | 1 XP/30s | None | 50 XP |
| Quiz | Tiered by score | None | 30 XP |
| Manual | Variable | N/A | N/A |

---

*Last Updated: 2025-01-13*
