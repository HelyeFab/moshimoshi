# 📊 Learning Progress System - Technical Documentation

**Last Updated**: 2025-10-03
**Status**: Phase 1 Implemented (Drills Only)
**Approach**: Bunpro Multi-Track Personalized Progress

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture Philosophy](#architecture-philosophy)
3. [Current Implementation (Phase 1)](#current-implementation-phase-1)
4. [Progress Calculation Formula](#progress-calculation-formula)
5. [How to Extend to Other Content Types](#how-to-extend-to-other-content-types)
6. [API Reference](#api-reference)
7. [Future Roadmap](#future-roadmap)

---

## Overview

The Learning Progress System tracks a user's **actual learning mastery** across different content categories (drills, kana, kanji, vocabulary) using a **personalized multi-track approach** inspired by Bunpro.

### Key Principles

1. **"You Only Progress What You Practice"**
   - Progress only counts items the user has **actually started**
   - Solves the "User A vs User B vs User C" problem (different learning paths)

2. **Mastery Over Completion**
   - Progress = **quality of learning** (mastery score), not just quantity
   - A user with 10 drills at 90% accuracy shows more progress than 100 drills at 50%

3. **Separated from Gamification**
   - Learning Progress ≠ Achievement Completion
   - Gamification tracks engagement, Learning Progress tracks mastery

4. **Expandable Architecture**
   - Start with one content type (drills)
   - Easily add more categories (kana, kanji, vocab) without breaking existing code

---

## Architecture Philosophy

### Problem Statement

**Challenge**: Different users follow different learning paths
- User A: Hiragana only
- User B: Kanji JLPT N2 only
- User C: Kanji + Minna Vol 2 only

**Question**: How do we show meaningful progress for all three?

### Solution: Bunpro Multi-Track Approach

**Industry Analysis**:
- ❌ **Duolingo**: Progress = XP (engagement, not mastery)
- ❌ **WaniKani**: Fixed path (forces everyone through same levels)
- ✅ **Bunpro**: Multi-track progress (N5 20%, Genki 40%, etc.)
- ✅ **Anki**: Personal deck progress (mastered / total in your decks)

**Our Implementation**:
```
Progress = (Items Mastered / Items Started) × 100
```

**Why This Works**:
- User A: 20 of 46 hiragana mastered = **43% progress** ✅
- User B: 50 of 200 N2 kanji mastered = **25% progress** ✅
- User C: 70 of 250 items mastered = **28% progress** ✅

All three see meaningful, motivating progress!

---

## Current Implementation (Phase 1)

### Phase 1: Drills Only

**Status**: ✅ Implemented (2025-10-03)

**Components**:
1. Hook: `useLearningProgress()` - `/src/hooks/useLearningProgress.ts`
2. Manager: `DrillProgressManager` - `/src/lib/review-engine/progress/DrillProgressManager.ts`
3. UI: Dashboard + Account Page

### Data Flow

```
┌─────────────────────────────────────┐
│  User completes drill session       │
└─────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────┐
│  DrillProgressManager.trackSession() │
│  - Updates totalDrills              │
│  - Updates accuracy                 │
│  - Updates perfectDrills            │
│  - Saves to IndexedDB               │
└─────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────┐
│  useLearningProgress() hook         │
│  - Loads drill stats                │
│  - Calculates mastery score         │
│  - Returns structured progress      │
└─────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────┐
│  UI displays progress               │
│  - Dashboard: Overall %             │
│  - Account: Detailed breakdown      │
└─────────────────────────────────────┘
```

### Files Modified

#### 1. Created Hook
**File**: `/src/hooks/useLearningProgress.ts`

```typescript
export interface LearningProgress {
  overall: {
    progressPercentage: number  // 0-100
    categoriesStarted: number
  }
  categories: {
    drills?: CategoryProgress
    // Future: hiragana, katakana, kanji, vocabulary...
  }
  loading: boolean
  error: Error | null
}
```

#### 2. Updated Dashboard
**File**: `/src/app/dashboard/page.tsx`

```typescript
// Line 23: Import
import { useLearningProgress } from '@/hooks/useLearningProgress'

// Line 60: Use hook
const { overall: learningProgress } = useLearningProgress()

// Line 170: Use for progress stat
const completionPercentage = learningProgress.progressPercentage
```

#### 3. Updated Account Page
**File**: `/src/app/account/page.tsx`

```typescript
// Line 12: Import
import { useLearningProgress } from '@/hooks/useLearningProgress'

// Line 65: Use hook
const { overall: learningProgress, categories } = useLearningProgress()

// Line 503: Display learning progress
{Math.round(learningProgress.progressPercentage)}%
{categories.drills?.totalDrills} drills • {categories.drills?.accuracy}% accuracy
```

---

## Progress Calculation Formula

### Drill Mastery Score (0-100)

**Method**: `DrillProgressManager.calculateMasteryLevel()`
**File**: `/src/lib/review-engine/progress/DrillProgressManager.ts:245-263`

```typescript
calculateMasteryLevel(data: DrillProgressData): number {
  let score = 0

  // Factor 1: Total drills completed (max 30 points)
  score += Math.min(30, data.totalDrills * 0.3)
  // 100 drills = 30 points (maxed out)

  // Factor 2: Average accuracy (max 40 points)
  score += (data.averageAccuracy / 100) * 40
  // 90% accuracy = 36 points

  // Factor 3: Perfect drills ratio (max 20 points)
  const perfectRatio = data.totalDrills > 0
    ? data.perfectDrills / data.totalDrills
    : 0
  score += perfectRatio * 20
  // 50% perfect = 10 points

  // Factor 4: Variety of words studied (max 10 points)
  const totalWords = data.verbsStudied.size + data.adjectivesStudied.size
  score += Math.min(10, totalWords * 0.1)
  // 100 unique words = 10 points (maxed out)

  return Math.round(score) // 0-100
}
```

### Examples

#### Example 1: Beginner (10 drills, 75% accuracy)
```
Factor 1: min(30, 10 * 0.3) = 3 points
Factor 2: (75/100) * 40 = 30 points
Factor 3: (2/10) * 20 = 4 points (2 perfect drills)
Factor 4: ~5 points (50 unique words)

Total: 42 points → 42% progress
```

#### Example 2: Intermediate (50 drills, 85% accuracy)
```
Factor 1: min(30, 50 * 0.3) = 15 points
Factor 2: (85/100) * 40 = 34 points
Factor 3: (20/50) * 20 = 8 points
Factor 4: 10 points (100+ words)

Total: 67 points → 67% progress
```

#### Example 3: Advanced (100 drills, 90% accuracy)
```
Factor 1: min(30, 100 * 0.3) = 30 points (maxed)
Factor 2: (90/100) * 40 = 36 points
Factor 3: (50/100) * 20 = 10 points
Factor 4: 10 points (maxed)

Total: 86 points → 86% progress
```

### Why These Weights?

- **40% Accuracy**: Most important - shows true understanding
- **30% Volume**: Encourages practice but doesn't dominate
- **20% Perfection**: Rewards excellence
- **10% Variety**: Prevents gaming the system with one word

---

## How to Extend to Other Content Types

### Adding a New Category (e.g., Hiragana)

Follow these steps to add hiragana (or any other content type) to the learning progress system:

#### Step 1: Verify Progress Manager Exists

Check if content type has a progress manager:
- **Kana**: `KanaProgressManagerV2` ✅ (exists at `/src/utils/kanaProgressManagerV2.ts`)
- **Kanji**: Need to create or verify
- **Vocabulary**: Need to create or verify

#### Step 2: Add to `useLearningProgress()` Hook

**File**: `/src/hooks/useLearningProgress.ts`

```typescript
export interface CategoryProgress {
  started: boolean
  masteryScore: number
  totalDrills?: number       // Drills only
  accuracy?: number          // Drills only
  learned?: number           // Kana/Kanji/Vocab
  total?: number             // Kana/Kanji/Vocab
  displayName: string
}

export interface LearningProgress {
  overall: {
    progressPercentage: number
    categoriesStarted: number
  }
  categories: {
    drills?: CategoryProgress
    hiragana?: CategoryProgress    // ADD NEW
    katakana?: CategoryProgress    // ADD NEW
    kanji?: CategoryProgress       // ADD NEW
    vocabulary?: CategoryProgress  // ADD NEW
  }
  loading: boolean
  error: Error | null
}
```

#### Step 3: Load Progress in Hook

Add to `loadProgress()` function in `useLearningProgress()`:

```typescript
const loadProgress = async () => {
  try {
    // Existing drill code...
    const drillManager = DrillProgressManager.getInstance()
    const drillStats = await drillManager.getDrillStats(user.uid, isPremium || false)

    // ADD: Load hiragana progress
    const kanaManager = KanaProgressManagerV2.getInstance()
    const hiraganaProgress = await kanaManager.getProgress(user.uid, 'hiragana', isPremium || false)

    let categoriesStarted = 0
    const categoryScores: number[] = []
    const categories: LearningProgress['categories'] = {}

    // Existing drill logic...
    if (drillStats && drillStats.totalDrills > 0) {
      categoriesStarted++
      const drillMasteryScore = drillManager.calculateMasteryLevel(drillStats)
      categoryScores.push(drillMasteryScore)
      categories.drills = { /* ... */ }
    }

    // ADD: Hiragana logic
    if (hiraganaProgress.size > 0) {
      categoriesStarted++

      // Calculate hiragana mastery
      let started = 0
      let mastered = 0

      hiraganaProgress.forEach((progressData) => {
        if (progressData.viewCount > 0) started++
        if (progressData.accuracy >= 80 || progressData.status === 'mastered') {
          mastered++
        }
      })

      const hiraganaScore = started > 0
        ? Math.round((mastered / started) * 100)
        : 0

      categoryScores.push(hiraganaScore)

      categories.hiragana = {
        started: true,
        masteryScore: hiraganaScore,
        learned: mastered,
        total: started,
        displayName: 'Hiragana'
      }
    }

    // Calculate overall as average of all started categories
    const overallProgress = categoryScores.length > 0
      ? Math.round(categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length)
      : 0

    setProgress({
      overall: {
        progressPercentage: overallProgress,
        categoriesStarted
      },
      categories,
      loading: false,
      error: null
    })
  } catch (error) {
    // ...
  }
}
```

#### Step 4: Update UI (Optional - Detailed Breakdown)

**Account Page** - Show category breakdown:

```typescript
// In Account Page stats section
{categories.hiragana && (
  <div className="mt-4 p-4 bg-white/50 dark:bg-dark-700/50 rounded-lg">
    <h4 className="text-sm font-semibold mb-2">Hiragana Progress</h4>
    <div className="flex justify-between items-center">
      <span className="text-sm">
        {categories.hiragana.learned} of {categories.hiragana.total} mastered
      </span>
      <span className="text-lg font-bold text-primary-600">
        {categories.hiragana.masteryScore}%
      </span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
      <div
        className="bg-primary-500 h-2 rounded-full"
        style={{ width: `${categories.hiragana.masteryScore}%` }}
      />
    </div>
  </div>
)}
```

#### Step 5: Define Mastery Criteria

For each content type, define what "mastered" means:

**Drills**:
- Complex formula (volume + accuracy + perfect ratio + variety)

**Hiragana/Katakana**:
- `accuracy >= 80%` OR `status === 'mastered'`
- Simple: If you get it right 80%+ of the time, you've mastered it

**Kanji**:
- `accuracy >= 80%` AND `reviewCount >= 5` (must review at least 5 times)
- Higher bar: Need consistency over time

**Vocabulary**:
- `accuracy >= 85%` AND `reviewCount >= 3`
- Slightly higher accuracy threshold

---

## API Reference

### `useLearningProgress()` Hook

**Location**: `/src/hooks/useLearningProgress.ts`

**Import**:
```typescript
import { useLearningProgress } from '@/hooks/useLearningProgress'
```

**Usage**:
```typescript
const { overall, categories, loading, error } = useLearningProgress()
```

**Returns**:
```typescript
interface LearningProgress {
  overall: {
    progressPercentage: number  // 0-100 overall mastery
    categoriesStarted: number   // How many categories user has begun
  }
  categories: {
    drills?: {
      started: boolean
      masteryScore: number      // 0-100
      totalDrills: number
      accuracy: number
      displayName: string
    }
    // Future: hiragana, katakana, kanji, vocabulary...
  }
  loading: boolean
  error: Error | null
}
```

**Example**:
```typescript
function MyComponent() {
  const { overall, categories, loading } = useLearningProgress()

  if (loading) return <Spinner />

  return (
    <div>
      <h2>Overall Progress: {overall.progressPercentage}%</h2>
      {categories.drills && (
        <p>{categories.drills.totalDrills} drills completed</p>
      )}
    </div>
  )
}
```

### `DrillProgressManager.calculateMasteryLevel()`

**Location**: `/src/lib/review-engine/progress/DrillProgressManager.ts:245`

**Import**:
```typescript
import { DrillProgressManager } from '@/lib/review-engine/progress/DrillProgressManager'
```

**Usage**:
```typescript
const drillManager = DrillProgressManager.getInstance()
const drillStats = await drillManager.getDrillStats(userId, isPremium)
const masteryScore = drillManager.calculateMasteryLevel(drillStats)
// Returns: 0-100
```

**Input**:
```typescript
interface DrillProgressData {
  totalDrills: number
  averageAccuracy: number
  perfectDrills: number
  verbsStudied: Set<string>
  adjectivesStudied: Set<string>
}
```

**Output**: `number` (0-100)

---

## Future Roadmap

### Phase 2: Add Kana (Hiragana + Katakana)

**Timeline**: Next sprint
**Complexity**: Low (KanaProgressManagerV2 already exists)

**Changes**:
1. Add `hiragana` and `katakana` to `useLearningProgress()`
2. Calculate mastery: `(items with accuracy >= 80) / (items viewed)`
3. Update UI to show kana breakdown

**Expected Result**:
```
Overall Progress: 60%
├─ Drills: 42%
├─ Hiragana: 87%
└─ Katakana: 45%
```

### Phase 3: Add Kanji

**Timeline**: 2-3 sprints
**Complexity**: Medium (need to unify kanji progress tracking)

**Challenges**:
- Multiple kanji sources (JLPT levels, Kanji Mastery, etc.)
- Need to aggregate across sources
- Higher mastery threshold (accuracy + review count)

**Approach**:
```typescript
// Query UniversalProgressManager for all kanji content types
const kanjiTypes = ['kanji_jlpt_n5', 'kanji_jlpt_n4', 'kanji_mastery']
const allKanjiProgress = new Map()

for (const type of kanjiTypes) {
  const progress = await universalManager.getProgress(userId, type, isPremium)
  progress.forEach((item, id) => allKanjiProgress.set(id, item))
}

// Calculate mastery
let started = 0, mastered = 0
allKanjiProgress.forEach((item) => {
  if (item.viewCount > 0) started++
  if (item.accuracy >= 80 && item.reviewCount >= 5) mastered++
})
```

### Phase 4: Add Vocabulary

**Timeline**: 3-4 sprints
**Complexity**: High (many textbook sources)

**Vocabulary Sources**:
- Minna 1, Minna 2
- Genki 1, Genki 2
- Kaishi 15K
- Kanji in Context
- Custom user decks

**Approach**: Same as kanji, aggregate across all vocabulary sources

### Phase 5: Weighted Categories

**Timeline**: Future
**Complexity**: Low (simple formula change)

**Concept**: Different categories have different weights

```typescript
const weights = {
  drills: 0.2,      // 20% of overall
  hiragana: 0.1,    // 10%
  katakana: 0.1,    // 10%
  kanji: 0.3,       // 30%
  vocabulary: 0.3   // 30%
}

// Only count started categories
const weightedScore =
  (drillScore * 0.2 + kanjiScore * 0.3 + vocabScore * 0.3) /
  (0.2 + 0.3 + 0.3) // Sum of active weights
```

---

## Best Practices

### DO ✅

- **Use the hook**: Always use `useLearningProgress()` for UI display
- **Check `started`**: Only show categories user has begun
- **Handle loading**: Check `loading` state before rendering
- **Show details**: Display breakdown (e.g., "20 drills • 85% accuracy")
- **Separate concerns**: Learning Progress ≠ Gamification Achievements

### DON'T ❌

- **Don't hardcode**: Never hardcode total counts (use started counts)
- **Don't force paths**: Never show 0% for categories user hasn't started
- **Don't dilute**: Don't divide by "all possible content" - only what's started
- **Don't confuse metrics**: Keep learning progress separate from XP/achievements
- **Don't skip mastery**: Don't just count completions - calculate quality

---

## Troubleshooting

### Issue: Progress shows 0% but user has completed drills

**Cause**: `DrillProgressManager` not loading data from IndexedDB

**Debug**:
```typescript
// Check IndexedDB
// Chrome DevTools → Application → IndexedDB → moshimoshi-universal-progress
// Look for records with contentType = 'drill'

// Check drill stats
const drillManager = DrillProgressManager.getInstance()
const stats = await drillManager.getDrillStats(userId, isPremium)
console.log('Drill stats:', stats)
```

**Solution**: Ensure drill sessions are being tracked via `trackDrillSession()`

### Issue: Progress is the same as achievement completion

**Cause**: Using old calculation instead of new hook

**Solution**: Check that dashboard uses `useLearningProgress()`:
```typescript
// WRONG (old way)
const completionPercentage = (unlockedAchievements.length / 10) * 100

// CORRECT (new way)
const { overall } = useLearningProgress()
const completionPercentage = overall.progressPercentage
```

### Issue: Categories not showing up

**Cause**: User hasn't started that category yet

**Expected Behavior**: Categories only appear when `started > 0`

```typescript
// Check if category has been started
if (categories.hiragana) {
  // User has viewed at least one hiragana character
  console.log('Hiragana progress:', categories.hiragana.masteryScore)
} else {
  // User hasn't started hiragana yet - don't show it
}
```

---

## Summary

The Learning Progress System provides a **personalized, meaningful, and expandable** way to track user mastery across all learning content. By following the Bunpro multi-track approach, we solve the "different learning paths" problem and always show progress that matters to each individual user.

**Phase 1 (Completed)**: Drills only
**Next Steps**: Add kana, then kanji, then vocabulary
**End Goal**: Comprehensive multi-category progress tracking

---

**Questions?** Check:
1. This document (you're reading it!)
2. `/src/hooks/useLearningProgress.ts` (hook source code)
3. `/src/lib/review-engine/progress/DrillProgressManager.ts` (drill mastery calculation)
4. `/docs/gamification-new/DEVELOPER_INTEGRATION_GUIDE.md` (related gamification docs)
