# News XP Integration - Complete Implementation Guide

> **Last Verified Against Codebase**: 2025-12-19

> **Purpose**: This document contains everything needed to integrate new features into the URE system and XP flow. Use this as a template for future integrations (Stories, Books, Videos, etc.)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Complete Data Flow](#complete-data-flow)
3. [Files Reference](#files-reference)
4. [Implementation Patterns](#implementation-patterns)
5. [Code Templates](#code-templates)
6. [Firestore Schema](#firestore-schema)
7. [Testing Checklist](#testing-checklist)
8. [Common Pitfalls](#common-pitfalls)
9. [Future Integration Checklist](#future-integration-checklist)

---

## Architecture Overview

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT SIDE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EnhancedArticleReaderFinal.tsx                                             │
│  ├── useNewsProgress() hook                                                 │
│  │   ├── Manages reading session (start/pause/resume)                       │
│  │   ├── Tracks activeTimeMs via NewsProgressManager                        │
│  │   ├── Visibility API (pause on tab switch)                               │
│  │   └── Returns: { activeTimeMs, isPaused, isCompleted, markComplete }     │
│  │                                                                          │
│  └── handleMarkComplete() → POST /api/news/progress/complete                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVER SIDE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  /api/news/progress/complete/route.ts                                       │
│  ├── Validates session (getSession())                                       │
│  ├── Checks if already completed (no double XP)                             │
│  ├── Calls recordNewsCompletion() from gamification-coordinator             │
│  └── Saves progress to news_progress collection                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GAMIFICATION COORDINATOR                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  gamification-coordinator.ts :: recordNewsCompletion()                      │
│  ├── calculateNewsXP({ readingTimeMs }) → XP amount                         │
│  ├── Firestore Transaction (ATOMIC):                                        │
│  │   ├── Update user_stats.xp.total                                         │
│  │   ├── Update user_stats.xp.level                                         │
│  │   ├── Track daily XP (xp.xpGainedToday, xp.lastXPDate)                   │
│  │   ├── Update user_stats.news.articlesRead                                │
│  │   ├── Update user_stats.news.totalReadingTimeMs                          │
│  │   ├── Call updateStreakWithinTransaction() if daily XP >= threshold      │
│  │   └── Check/unlock achievements                                          │
│  └── Returns: GamificationResult                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision                      | Rationale                                         |
| ----------------------------- | ------------------------------------------------- |
| Linear XP (1 per 20s)         | Simple, predictable, encourages sustained reading |
| 40 XP cap                     | Prevents gaming, aligns with other feature caps   |
| No re-read XP                 | Encourages exploring new content                  |
| Button trigger (not auto)     | User agency, prevents accidental completions      |
| 60s idle timeout              | Balances engagement tracking with user breaks     |
| Singleton NewsProgressManager | Prevents multiple timers, consistent state        |

---

## Complete Data Flow

### Step-by-Step Flow

#### 1. Component Mount (EnhancedArticleReaderFinal.tsx:1052-1063)

```typescript
const {
  activeTimeMs,
  isPaused: isProgressPaused,
  isCompleted: isArticleCompleted,
  isSubmitting: isCompletingArticle,
  markComplete: markArticleComplete,
} = useNewsProgress({
  articleId: article.id,
  difficulty: article.difficulty,
  enabled: true,
})
```

#### 2. Hook Initialization (useNewsProgress.ts:56-77)

```typescript
useEffect(() => {
  if (!enabled || !user?.uid || !articleId) return

  const manager = managerRef.current
  manager.startSession(articleId, user.uid, difficulty)

  // Update active time every second
  intervalRef.current = setInterval(() => {
    setActiveTimeMs(manager.getActiveTimeMs())
    setIsPaused(manager.isPaused())
  }, 1000)

  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    manager.endSession()
  }
}, [articleId, user?.uid, difficulty, enabled])
```

#### 3. Visibility Change Handling (useNewsProgress.ts:79-100)

```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      manager.pauseSession()
      setIsPaused(true)
    } else {
      manager.resumeSession()
      setIsPaused(false)
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [enabled])
```

#### 4. Mark Complete (useNewsProgress.ts:115-183)

```typescript
const markComplete = useCallback(async () => {
  const currentTimeMs = manager.getActiveTimeMs()

  const response = await fetch('/api/news/progress/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articleId,
      readingTimeMs: currentTimeMs,
      difficulty,
    }),
  })

  const result = await response.json()
  if (result.success) setIsCompleted(true)
  return result
}, [articleId, difficulty, user?.uid, isCompleted])
```

#### 5. API Route Processing (route.ts:17-135)

```typescript
export async function POST(request: NextRequest) {
  // 1. Validate session
  const session = await getSession()
  if (!session) return 401

  // 2. Check if already completed (no double XP)
  const odcId = `${session.uid}_${articleId}`
  const progressDoc = await progressRef.get()
  if (progressDoc.exists && progressDoc.data()?.completed) {
    return { success: true, data: { xpEarned: 0, alreadyCompleted: true } }
  }

  // 3. Record gamification
  const gamificationResult = await recordNewsCompletion({
    userId: session.uid,
    articleId,
    readingTimeMs,
    difficulty,
    isPremium,
  })

  // 4. Save progress to Firestore
  await progressRef.set(progressData, { merge: true })

  return { success: true, data: gamificationResult }
}
```

#### 6. Gamification Coordinator (gamification-coordinator.ts:526-688)

```typescript
export async function recordNewsCompletion(params) {
  const xpEarned = calculateNewsXP({ readingTimeMs });

  return await getDb().runTransaction(async (transaction) => {
    // Get current stats
    const statsDoc = await transaction.get(userStatsRef);

    // Calculate new values
    const newTotalXP = currentXP + xpEarned;
    const newLevel = Math.floor(newTotalXP / 1000);
    const newDailyXP = currentDailyXP + xpEarned;

    // Atomic update
    transaction.update(userStatsRef, {
      'xp.total': newTotalXP,
      'xp.level': newLevel,
      'xp.xpGainedToday': newDailyXP,
      'xp.lastXPDate': today,
      'news.articlesRead': FieldValue.increment(1),
      'news.totalReadingTimeMs': FieldValue.increment(readingTimeMs)
    });

    // Update streak if daily XP threshold met
    if (newDailyXP >= minXpForStreak && !streakAlreadyUpdatedToday) {
      await updateStreakWithinTransaction(transaction, userId, newDailyXP, options);
    }

    // Check achievements
    if (articlesRead === 10) unlockAchievement('avid_reader');
    if (articlesRead === 50) unlockAchievement('news_junkie');

    return { xpEarned, newTotalXP, newLevel, streakIncremented, ... };
  });
}
```

---

## Files Reference

### New Files Created

| File                                                    | Purpose                   | Key Exports                                                              |
| ------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| `src/lib/review-engine/progress/news-progress.types.ts` | TypeScript interfaces     | `NewsReadingSession`, `NewsProgressData`, `NewsProgressCompleteResponse` |
| `src/lib/review-engine/progress/NewsProgressManager.ts` | Singleton session manager | `getNewsProgressManager()`, `NewsProgressManager` class                  |
| `src/hooks/useNewsProgress.ts`                          | React hook for components | `useNewsProgress()`                                                      |
| `src/app/api/news/progress/complete/route.ts`           | API endpoint              | `POST` handler                                                           |

### Modified Files

| File                                                        | Line Numbers                    | Changes                                             |
| ----------------------------------------------------------- | ------------------------------- | --------------------------------------------------- |
| `src/lib/gamification/services/gamification-coordinator.ts` | 510-688                         | Added `calculateNewsXP()`, `recordNewsCompletion()` |
| `src/components/news/EnhancedArticleReaderFinal.tsx`        | 41-44, 45, 1052-1076, 1961-2020 | Imports, hook integration, UI components            |
| `firestore.rules`                                           | 401-418                         | Added `news_progress` collection rules              |

### File Locations Quick Reference

```
src/
├── app/api/news/progress/complete/
│   └── route.ts                          # API endpoint
├── components/news/
│   └── EnhancedArticleReaderFinal.tsx    # UI integration (lines 1052-1076, 1961-2020)
├── hooks/
│   └── useNewsProgress.ts                # React hook
└── lib/
    ├── gamification/services/
    │   └── gamification-coordinator.ts   # XP logic (lines 510-688)
    └── review-engine/progress/
        ├── news-progress.types.ts        # Type definitions
        └── NewsProgressManager.ts        # Session manager
```

---

## Implementation Patterns

### Pattern 1: XP Calculation Function

```typescript
// Location: gamification-coordinator.ts
// Pattern: Pure function, no side effects, easy to test

export function calculateNewsXP(params: { readingTimeMs: number }): number {
  const { readingTimeMs } = params
  const baseXP = Math.floor(readingTimeMs / 20000) // 1 XP per 20s
  return Math.min(baseXP, 40) // Cap at 40
}
```

### Pattern 2: Record Completion Function

```typescript
// Location: gamification-coordinator.ts
// Pattern: Firestore transaction for atomic updates

export async function recordNewsCompletion(params: {
  userId: string;
  articleId: string;
  readingTimeMs: number;
  difficulty: string;
  isPremium: boolean;
}): Promise<GamificationResult> {
  // 1. Calculate XP
  const xpEarned = calculateNewsXP({ readingTimeMs });

  // 2. Early return if no XP
  if (xpEarned === 0) return { xpEarned: 0, ... };

  // 3. Transaction for atomic updates
  return await getDb().runTransaction(async (transaction) => {
    // Read current state
    // Calculate new values
    // Write all updates atomically
    // Handle streak
    // Check achievements
    // Return result
  });
}
```

### Pattern 3: React Hook with Session Management

```typescript
// Location: useNewsProgress.ts
// Pattern: Hook manages lifecycle, returns state and actions

export function useNewsProgress(options: UseNewsProgressOptions): UseNewsProgressReturn {
  // State
  const [activeTimeMs, setActiveTimeMs] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Session lifecycle (mount/unmount)
  useEffect(() => { /* start/end session */ }, [deps]);

  // Event handlers (visibility)
  useEffect(() => { /* pause/resume on tab switch */ }, [deps]);

  // Actions
  const markComplete = useCallback(async () => { /* API call */ }, [deps]);

  return { activeTimeMs, isPaused, isCompleted, markComplete, ... };
}
```

### Pattern 4: Singleton Manager

```typescript
// Location: NewsProgressManager.ts
// Pattern: Single instance manages all session state

let instance: NewsProgressManager | null = null

export function getNewsProgressManager(): NewsProgressManager {
  if (!instance) {
    instance = new NewsProgressManager()
  }
  return instance
}

class NewsProgressManager {
  private currentSession: NewsReadingSession | null = null

  startSession(articleId, userId, difficulty) {
    /* ... */
  }
  pauseSession() {
    /* ... */
  }
  resumeSession() {
    /* ... */
  }
  endSession() {
    /* ... */
  }
  getActiveTimeMs(): number {
    /* ... */
  }
  isPaused(): boolean {
    /* ... */
  }
}
```

### Pattern 5: API Route with Double-Submit Protection

```typescript
// Location: route.ts
// Pattern: Check before awarding to prevent double XP

export async function POST(request: NextRequest) {
  // 1. Auth check
  const session = await getSession()
  if (!session) return 401

  // 2. Double-submit protection
  const odcId = `${session.uid}_${articleId}`
  const progressDoc = await progressRef.get()
  if (progressDoc.exists && progressDoc.data()?.completed) {
    return { success: true, data: { xpEarned: 0, alreadyCompleted: true } }
  }

  // 3. Process and save
  const result = await recordNewsCompletion(params)
  await progressRef.set(progressData, { merge: true })

  return { success: true, data: result }
}
```

---

## Code Templates

### Template: New XP Calculation Function

```typescript
/**
 * Calculate XP earned from [FEATURE_NAME]
 * [DESCRIPTION OF FORMULA]
 */
export function calculate[Feature]XP(params: {
  // Add relevant params
  timeMs?: number;
  score?: number;
  accuracy?: number;
}): number {
  const { timeMs = 0 } = params;

  // Base calculation
  const baseXP = Math.floor(timeMs / 30000); // Adjust formula

  // Apply bonuses (if any)
  // const bonus = ...;

  // Apply cap
  const MAX_XP = 40; // Adjust cap
  return Math.min(baseXP, MAX_XP);
}
```

### Template: New Record Completion Function

```typescript
/**
 * Record [FEATURE_NAME] completion and award XP
 */
export async function record[Feature]Completion(params: {
  userId: string;
  contentId: string;
  // Add feature-specific params
  isPremium: boolean;
}): Promise<GamificationResult> {
  const { userId, contentId, isPremium } = params;

  if (!adminDb) throw new Error('Firebase Admin not initialized');

  const xpEarned = calculate[Feature]XP({ /* params */ });

  if (xpEarned === 0) {
    return { xpEarned: 0, newTotalXP: 0, newLevel: 1, ... };
  }

  return await getDb().runTransaction(async (transaction) => {
    const userStatsRef = getDb().collection('user_stats').doc(userId);
    const statsDoc = await transaction.get(userStatsRef);

    // Initialize if doesn't exist
    if (!statsDoc.exists) {
      transaction.set(userStatsRef, {
        xp: { total: 0, level: 1 },
        [featureName]: { /* initial stats */ },
        // ... standard fields
      }, { merge: true });
    }

    const currentStats = statsDoc.data() || {};
    const currentXP = currentStats.xp?.total || 0;
    const newTotalXP = currentXP + xpEarned;
    const newLevel = Math.max(1, Math.floor(newTotalXP / 1000));
    const nowIso = new Date().toISOString();
    const today = nowIso.split('T')[0];

    // Daily XP tracking
    const lastXPDate = currentStats.xp?.lastXPDate || null;
    const isNewDay = lastXPDate !== today;
    const currentDailyXP = isNewDay ? 0 : (currentStats.xp?.xpGainedToday || 0);
    const newDailyXP = currentDailyXP + xpEarned;

    // Update stats
    transaction.update(userStatsRef, {
      'xp.total': newTotalXP,
      'xp.level': newLevel,
      'xp.xpGainedToday': newDailyXP,
      'xp.lastXPDate': today,
      '[featureName].completionCount': FieldValue.increment(1),
      // Add feature-specific stats
      'metadata.lastUpdated': nowIso
    });

    // Streak update (if daily XP threshold met)
    let streakResult = null;
    const minXpForStreak = getMinXpForStreak();
    const lastStreakUpdateDate = currentStats.dates?.lastStreakUpdateDate || null;
    const streakAlreadyUpdatedToday = lastStreakUpdateDate === today;

    if (newDailyXP >= minXpForStreak && !streakAlreadyUpdatedToday) {
      try {
        streakResult = await updateStreakWithinTransaction(
          transaction, userId, newDailyXP,
          { isPremium, db: adminDb!, prefetchedDoc: statsDoc }
        );
        if (streakResult.success) {
          transaction.update(userStatsRef, { 'dates.lastStreakUpdateDate': today });
        }
      } catch (error) {
        console.error('[Gamification] Streak update failed:', error);
      }
    }

    // Achievements
    const achievements: string[] = [];
    // Check feature-specific achievements...

    const fallbackStreak = { current: currentStats.streak?.current || 0, best: currentStats.streak?.best || 0 };
    const streakData = streakResult?.data ?? fallbackStreak;

    return {
      xpEarned,
      newTotalXP,
      newLevel,
      streakIncremented: streakResult?.success ? streakResult.streakIncremented : false,
      currentStreak: streakData.current,
      bestStreak: streakData.best,
      achievementsUnlocked: achievements
    };
  });
}
```

### Template: React Hook

```typescript
'use client'

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface Use[Feature]ProgressOptions {
  contentId: string;
  enabled?: boolean;
}

interface Use[Feature]ProgressReturn {
  activeTimeMs: number;
  isPaused: boolean;
  isCompleted: boolean;
  isSubmitting: boolean;
  markComplete: () => Promise<Response>;
  pause: () => void;
  resume: () => void;
}

export function use[Feature]Progress({
  contentId,
  enabled = true
}: Use[Feature]ProgressOptions): Use[Feature]ProgressReturn {
  const { user } = useAuth();
  const [activeTimeMs, setActiveTimeMs] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Session management effect
  useEffect(() => {
    if (!enabled || !user?.uid || !contentId) return;
    // Start tracking...
    return () => { /* Cleanup */ };
  }, [contentId, user?.uid, enabled]);

  // Visibility change effect
  useEffect(() => {
    if (!enabled) return;
    const handleVisibilityChange = () => {
      if (document.hidden) { /* pause */ }
      else { /* resume */ }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled]);

  const markComplete = useCallback(async () => {
    if (!user?.uid || isCompleted) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/[feature]/progress/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, timeMs: activeTimeMs })
      });
      const result = await response.json();
      if (result.success) setIsCompleted(true);
      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, [contentId, user?.uid, isCompleted, activeTimeMs]);

  return { activeTimeMs, isPaused, isCompleted, isSubmitting, markComplete, pause: () => {}, resume: () => {} };
}
```

### Template: API Route

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { record[Feature]Completion } from '@/lib/gamification/services/gamification-coordinator';
import { getStorageDecision } from '@/lib/api/storage-helper';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' }},
        { status: 401 }
      );
    }

    // 2. Parse & validate body
    const body = await request.json();
    const { contentId, timeMs } = body;
    if (!contentId || typeof timeMs !== 'number') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'contentId and timeMs required' }},
        { status: 400 }
      );
    }

    // 3. Double-submit protection
    const odcId = `${session.uid}_${contentId}`;
    const progressRef = adminDb!.collection('[feature]_progress').doc(odcId);
    const progressDoc = await progressRef.get();

    if (progressDoc.exists && progressDoc.data()?.completed) {
      return NextResponse.json({
        success: true,
        data: { xpEarned: 0, alreadyCompleted: true }
      });
    }

    // 4. Record gamification
    const storageDecision = await getStorageDecision(session);
    const isPremium = storageDecision.shouldWriteToFirebase;

    const result = await record[Feature]Completion({
      userId: session.uid,
      contentId,
      timeMs,
      isPremium
    });

    // 5. Save progress
    const nowIso = new Date().toISOString();
    await progressRef.set({
      odcId,
      userId: session.uid,
      contentId,
      completed: true,
      xpEarned: result.xpEarned,
      completedAt: nowIso,
      totalTimeMs: timeMs,
      version: FieldValue.increment(1),
      updatedAt: nowIso,
      ...(progressDoc.exists ? {} : { firstAccessAt: nowIso })
    }, { merge: true });

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save progress' }},
      { status: 500 }
    );
  }
}
```

### Template: Firestore Rules

```javascript
// Add to firestore.rules

// [Feature] progress collection - users can track their [feature] progress
match /[feature]_progress/{progressId} {
  // Users can read their own progress
  allow read: if isAuthenticated() &&
    resource.data.userId == request.auth.uid;

  // Users can create progress for themselves
  allow create: if isAuthenticated() &&
    request.resource.data.userId == request.auth.uid;

  // Users can update their own progress
  allow update: if isAuthenticated() &&
    resource.data.userId == request.auth.uid &&
    request.resource.data.userId == request.auth.uid;

  // Progress should not be deleted
  allow delete: if false;
}
```

---

## Firestore Schema

### news_progress/{odcId}

```typescript
{
  odcId: string // Composite key: `${userId}_${articleId}`
  userId: string // User ID
  articleId: string // Article ID
  difficulty: string // N5, N4, N3, N2, N1
  firstReadAt: string // ISO timestamp - first access
  lastReadAt: string // ISO timestamp - last access
  totalReadTimeMs: number // Cumulative reading time (uses FieldValue.increment)
  completed: boolean // True after Mark Complete
  xpEarned: number // XP awarded for this article
  version: number // For optimistic concurrency
  updatedAt: string // ISO timestamp
}
```

### user_stats/{userId} (relevant fields)

```typescript
{
  xp: {
    total: number;         // Total XP earned
    level: number;         // Current level (total / 1000)
    xpGainedToday: number; // XP earned today (resets daily)
    lastXPDate: string;    // Date of last XP gain (yyyy-mm-dd)
  };
  news: {
    articlesRead: number;       // Total articles completed
    totalReadingTimeMs: number; // Total reading time
  };
  streak: {
    current: number;       // Current streak days
    best: number;          // Best streak ever
  };
  dates: {
    lastStreakUpdateDate: string; // Prevents multiple streak updates per day
  };
  achievements: {
    unlockedIds: string[];        // Array of unlocked achievement IDs
    progress: { [key]: number };  // Progress toward achievements
  };
}
```

---

## Testing Checklist

### Compilation Tests

- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `npm run build` succeeds
- [ ] Dev server starts without errors

### Page Compilation Tests

- [ ] Feature page loads (200 status)
- [ ] Feature detail page loads (200 status)
- [ ] API endpoint compiles on first request

### API Tests

- [ ] Unauthenticated request returns 401
- [ ] Missing required fields returns 400
- [ ] Valid request returns 200 with XP data
- [ ] Double-submit returns `alreadyCompleted: true`

### XP Calculation Tests

```javascript
// Test all edge cases
calculateNewsXP({ readingTimeMs: 0 }) === 0 // No time
calculateNewsXP({ readingTimeMs: 15000 }) === 0 // Under threshold
calculateNewsXP({ readingTimeMs: 20000 }) === 1 // Exactly 20s
calculateNewsXP({ readingTimeMs: 60000 }) === 3 // 60s
calculateNewsXP({ readingTimeMs: 800000 }) === 40 // At cap (13m20s)
calculateNewsXP({ readingTimeMs: 3600000 }) === 40 // Over cap (1hr)
```

### UI Tests

- [ ] Timer starts on component mount
- [ ] Timer pauses on tab switch (visibility change)
- [ ] Timer resumes when tab becomes visible
- [ ] "Paused" indicator shows when paused
- [ ] Reading time displays correctly (mm:ss format)
- [ ] Mark Complete button is clickable
- [ ] Loading spinner shows during submission
- [ ] "Completed" state shows after success
- [ ] XP notification animates in
- [ ] Button disabled after completion

### Integration Tests

- [ ] XP appears in user's total after completion
- [ ] Daily XP tracks correctly
- [ ] Streak updates if threshold met
- [ ] Achievement unlocks at milestone
- [ ] Progress saved to Firestore

---

## Common Pitfalls

### 1. Forgetting to Export from gamification-coordinator

```typescript
// BAD: Function exists but not exported
function calculateNewsXP() { ... }

// GOOD: Export the function
export function calculateNewsXP() { ... }
```

### 2. Wrong Import Path for useAuth

```typescript
// BAD: Old path
import { useAuth } from '@/lib/auth/AuthContext'

// GOOD: Correct path
import { useAuth } from '@/hooks/useAuth'
```

### 3. Missing Firestore Rules

Don't forget to add rules for new collections in `firestore.rules`:

```javascript
match /[feature]_progress/{progressId} {
  // ... rules
}
```

### 4. Not Handling Double-Submit

Always check if already completed before awarding XP:

```typescript
if (progressDoc.exists && progressDoc.data()?.completed) {
  return { xpEarned: 0, alreadyCompleted: true }
}
```

### 5. Forgetting Daily XP Accumulation

Streak depends on DAILY accumulated XP, not per-action XP:

```typescript
// Track daily XP
const isNewDay = lastXPDate !== today
const currentDailyXP = isNewDay ? 0 : currentStats.xp?.xpGainedToday || 0
const newDailyXP = currentDailyXP + xpEarned
```

### 6. Not Checking Streak Already Updated

Only update streak once per day:

```typescript
const streakAlreadyUpdatedToday = lastStreakUpdateDate === today
if (newDailyXP >= minXpForStreak && !streakAlreadyUpdatedToday) {
  // Update streak
}
```

### 7. Using Nested Transactions

Firestore doesn't support nested transactions. Use `updateStreakWithinTransaction()`:

```typescript
// BAD: Nested transaction
await getDb().runTransaction(async (t1) => {
  await getDb().runTransaction(async (t2) => { ... }); // ERROR!
});

// GOOD: Pass transaction to helper
await updateStreakWithinTransaction(transaction, userId, xp, options);
```

---

## Future Integration Checklist

When adding XP to a new feature, follow these steps:

### Phase 1: Planning

- [ ] Define XP formula (linear, accuracy-based, etc.)
- [ ] Define XP cap
- [ ] Define completion trigger (auto, button, etc.)
- [ ] Define re-completion behavior (XP or no XP)
- [ ] Define idle timeout (if applicable)
- [ ] Define achievements (milestones)

### Phase 2: Backend

- [ ] Add `calculate[Feature]XP()` to gamification-coordinator.ts
- [ ] Add `record[Feature]Completion()` to gamification-coordinator.ts
- [ ] Create API route: `src/app/api/[feature]/progress/complete/route.ts`
- [ ] Add Firestore rules for `[feature]_progress` collection

### Phase 3: Frontend

- [ ] Create types: `src/lib/review-engine/progress/[feature]-progress.types.ts`
- [ ] Create manager (if needed): `src/lib/review-engine/progress/[Feature]ProgressManager.ts`
- [ ] Create hook: `src/hooks/use[Feature]Progress.ts`
- [ ] Integrate hook in component
- [ ] Add UI elements (timer, button, notification)

### Phase 4: Testing

- [ ] TypeScript compilation
- [ ] XP calculation unit tests
- [ ] API endpoint tests (401, 400, 200, double-submit)
- [ ] UI integration tests
- [ ] End-to-end flow test

### Phase 5: Documentation

- [ ] Update this document with new feature details
- [ ] Add to CLAUDE.md if significant

---

## Quick Reference

### XP Formulas by Feature

| Feature | Formula                                          | Cap     | Re-complete |
| ------- | ------------------------------------------------ | ------- | ----------- |
| Drill   | 5 XP/correct + accuracy bonus + completion bonus | ~120 XP | Yes         |
| Review  | 3 XP/correct + accuracy bonus + volume bonus     | ~100 XP | Yes         |
| News    | 1 XP/20s reading                                 | 40 XP   | No          |

### Key Functions

| Function                          | Location                        | Purpose                                      |
| --------------------------------- | ------------------------------- | -------------------------------------------- |
| `calculateNewsXP()`               | gamification-coordinator.ts:510 | Calculate XP from reading time               |
| `recordNewsCompletion()`          | gamification-coordinator.ts:526 | Award XP, update stats, streak, achievements |
| `updateStreakWithinTransaction()` | streakService.ts:563            | Update streak within parent transaction      |
| `getMinXpForStreak()`             | gamification-coordinator.ts:46  | Get daily XP threshold for streak            |

### Important Config Values

| Setting            | Value           | Location                        |
| ------------------ | --------------- | ------------------------------- |
| XP per 20s         | 1               | gamification-coordinator.ts:516 |
| Max XP per article | 40              | gamification-coordinator.ts:519 |
| Min XP for streak  | (from config)   | streakConfig.ts                 |
| Level calculation  | total XP / 1000 | gamification-coordinator.ts:585 |

---

_Last Updated: 2025-12-03_
_Last Verified Against Codebase: 2025-12-19_
_Author: Claude (with Emmanuel)_
