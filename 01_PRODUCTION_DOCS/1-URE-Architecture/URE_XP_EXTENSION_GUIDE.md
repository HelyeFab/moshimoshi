# Universal Review Engine & XP System Extension Guide

> **Last Updated**: 2025-12-19
> **Last Verified Against Codebase**: 2025-12-19

> **Complete developer guide for extending the URE and XP systems in Moshimoshi**

This document provides detailed instructions for adding XP rewards to new features, creating custom progress managers, and integrating with the Universal Review Engine (URE). It covers two implementation patterns:

1. **Simple Pattern** - News Article Reader (time-based XP, minimal state)
2. **Complex Pattern** - Conjugation Drill (SRS tracking, full URE integration)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [XP System Integration](#xp-system-integration)
3. [Simple Pattern: News Reader](#simple-pattern-news-reader-implementation)
4. [Complex Pattern: Drill Page](#complex-pattern-drill-page-implementation)
5. [Creating a New XP-Enabled Feature](#creating-a-new-xp-enabled-feature)
6. [Creating a Custom Progress Manager](#creating-a-custom-progress-manager)
7. [Adding New Content Types to URE](#adding-new-content-types-to-ure)
8. [Best Practices & Pitfalls](#best-practices--pitfalls)
9. [Testing Your Integration](#testing-your-integration)
10. [Quick Reference](#quick-reference)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │ Feature Page │───▶│ Progress Manager │───▶│ Zustand Store    │  │
│  │ (React)      │    │ (Optional)       │    │ (UI State)       │  │
│  └──────────────┘    └──────────────────┘    └──────────────────┘  │
│         │                     │                       ▲             │
│         │                     │                       │             │
│         ▼                     ▼                       │             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    API Call (fetch)                           │  │
│  │           POST /api/{feature}/complete                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVER SIDE                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌────────────────────────────────────────┐ │
│  │ API Route        │───▶│ Gamification Coordinator               │ │
│  │ (Next.js)        │    │ (Atomic Firestore Transaction)         │ │
│  └──────────────────┘    │                                        │ │
│                          │  1. Calculate XP                       │ │
│                          │  2. Update user_stats document         │ │
│                          │  3. Update streak (if threshold met)   │ │
│                          │  4. Check achievements                 │ │
│                          │  5. Return GamificationResult          │ │
│                          └────────────────────────────────────────┘ │
│                                        │                            │
│                                        ▼                            │
│                          ┌────────────────────────────────────────┐ │
│                          │ Firebase Firestore                     │ │
│                          │ (Single Source of Truth)               │ │
│                          └────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Files

| Component | Location | Purpose |
|-----------|----------|---------|
| Gamification Coordinator | `src/lib/gamification/services/gamification-coordinator.ts` | Server-side XP calculation & atomic updates |
| Streak Service | `src/lib/gamification/services/streakService.ts` | Streak logic within transactions |
| Gamification Store | `src/state/userGamification.ts` | Client-side UI state (Zustand) |
| XP Config | `src/config/gamification/xp.json` | XP values and caps |
| Streak Config | `src/config/gamification/streakConfig.ts` | Streak thresholds |
| Base Progress Manager | `src/lib/review-engine/progress/UniversalProgressManager.ts` | Abstract base class |

---

## XP System Integration

### How XP Is Awarded

All XP awards flow through the **Gamification Coordinator** on the server side:

```typescript
// src/lib/gamification/services/gamification-coordinator.ts

export interface GamificationResult {
  xpEarned: number;           // XP earned this action
  newTotalXP: number;         // User's new total XP
  newLevel: number;           // User's new level (total / 1000)
  streakIncremented: boolean; // Was streak updated?
  currentStreak: number;      // Current streak count
  bestStreak: number;         // Best streak ever
  achievementsUnlocked: string[]; // New achievement IDs
}
```

### XP Calculation Functions

The coordinator provides specialized calculators:

```typescript
// Drill: Performance-based
calculateDrillXP({ score, totalQuestions, accuracy }): number
// - Base: 5 XP per correct answer
// - Accuracy bonus: 50 (100%), 25 (90%+), 10 (80%+)
// - Completion bonus: 20 (all correct)

// Review (URE): Volume-based
calculateReviewXP({ itemsReviewed, correctCount, accuracy }): number
// - Base: 3 XP per correct review
// - Accuracy bonus: 30 (100%), 15 (90%+), 5 (80%+)
// - Volume bonus: 5 XP per 10 items

// News/Books: Time-based
calculateNewsXP({ readingTimeMs }): number
calculateBookXP({ readingTimeSec }): number
// - 1 XP per 30 seconds of active reading
// - Capped at 50 XP per article/book
```

### Streak System

Streaks increment when:
1. Daily XP accumulation reaches threshold (default: 50 XP)
2. Streak hasn't already been updated today
3. User was active yesterday OR it's their first day

```typescript
// Configuration in src/config/gamification/streakConfig.ts
const streakConfig = {
  minXPForStreak: 50,        // Daily XP threshold
  gracePeriodHours: 36,      // Hours before streak breaks
  freezeCount: 3,            // Premium: freeze days available
};
```

---

## Simple Pattern: News Reader Implementation

The News Reader demonstrates the **minimal XP integration** - ideal for features where you just need to track completion and award XP without complex state management.

### Architecture

```
┌──────────────────────┐
│ News Article Page    │
│ (React Component)    │
└──────────┬───────────┘
           │ 1. startSession()
           ▼
┌──────────────────────┐
│ NewsProgressManager  │  In-memory only (no IndexedDB)
│ - Tracks reading time│  - Idle detection (60s)
│ - Scroll detection   │  - Pause/resume
└──────────┬───────────┘
           │ 2. endSession() → returns activeTimeMs
           ▼
┌──────────────────────┐
│ POST /api/news/      │
│ progress/complete    │
└──────────┬───────────┘
           │ 3. recordNewsCompletion()
           ▼
┌──────────────────────┐
│ Gamification         │
│ Coordinator          │
│ (Firestore TX)       │
└──────────────────────┘
```

### Step 1: Create a Lightweight Progress Manager

```typescript
// src/lib/review-engine/progress/NewsProgressManager.ts

export interface NewsReadingSession {
  sessionId: string;
  articleId: string;
  userId: string;
  difficulty: string;
  startedAt: number;        // timestamp
  activeTimeMs: number;     // accumulated active time
  lastActiveAt: number;     // for idle detection
  isPaused: boolean;
  pausedAt?: number;
}

const IDLE_TIMEOUT_MS = 60000; // 60 seconds

export class NewsProgressManager {
  private static instance: NewsProgressManager | null = null;
  private currentSession: NewsReadingSession | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {}

  static getInstance(): NewsProgressManager {
    if (!NewsProgressManager.instance) {
      NewsProgressManager.instance = new NewsProgressManager();
    }
    return NewsProgressManager.instance;
  }

  /**
   * Start tracking a new reading session
   */
  startSession(articleId: string, userId: string, difficulty: string): NewsReadingSession {
    // End any existing session
    if (this.currentSession) {
      this.endSession();
    }

    const now = Date.now();
    this.currentSession = {
      sessionId: crypto.randomUUID(),
      articleId,
      userId,
      difficulty,
      startedAt: now,
      activeTimeMs: 0,
      lastActiveAt: now,
      isPaused: false,
    };

    // Start idle detection
    this.startIdleDetection();

    return this.currentSession;
  }

  /**
   * Record user activity (scroll, click) - resets idle timer
   */
  recordActivity(): void {
    if (!this.currentSession) return;

    if (this.currentSession.isPaused) {
      this.resumeSession();
    } else {
      const now = Date.now();
      this.currentSession.activeTimeMs += now - this.currentSession.lastActiveAt;
      this.currentSession.lastActiveAt = now;
    }

    this.resetIdleTimer();
  }

  /**
   * End session and return total active reading time
   */
  endSession(): { activeTimeMs: number; sessionId: string } | null {
    if (!this.currentSession) return null;

    // Calculate final active time
    if (!this.currentSession.isPaused) {
      const now = Date.now();
      this.currentSession.activeTimeMs += now - this.currentSession.lastActiveAt;
    }

    const result = {
      activeTimeMs: this.currentSession.activeTimeMs,
      sessionId: this.currentSession.sessionId,
    };

    this.stopIdleDetection();
    this.currentSession = null;

    return result;
  }

  // ... idle detection methods (see full implementation)
}
```

### Step 2: Create the API Route

```typescript
// src/app/api/news/progress/complete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { recordNewsCompletion } from '@/lib/gamification/services/gamification-coordinator';

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED' } },
      { status: 401 }
    );
  }

  // 2. Parse request
  const { articleId, readingTimeMs, difficulty } = await request.json();

  // 3. Prevent duplicate XP (check if already completed)
  const progressRef = adminDb.collection('news_progress').doc(`${session.uid}_${articleId}`);
  const progressDoc = await progressRef.get();

  if (progressDoc.exists && progressDoc.data()?.completed) {
    return NextResponse.json({
      success: true,
      data: { xpEarned: 0, alreadyCompleted: true },
    });
  }

  // 4. Record gamification (CRITICAL: Only if feature flag enabled)
  let gamificationResult = null;
  if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true') {
    gamificationResult = await recordNewsCompletion({
      userId: session.uid,
      articleId,
      readingTimeMs,
      difficulty: difficulty || 'N5',
      isPremium: true, // or check subscription
    });
  }

  // 5. Save progress to Firebase
  await progressRef.set({
    userId: session.uid,
    articleId,
    completed: true,
    xpEarned: gamificationResult?.xpEarned || 0,
    lastReadAt: new Date().toISOString(),
  }, { merge: true });

  // 6. Return result
  return NextResponse.json({
    success: true,
    data: {
      xpEarned: gamificationResult?.xpEarned || 0,
      newTotalXP: gamificationResult?.newTotalXP || 0,
      streakIncremented: gamificationResult?.streakIncremented || false,
      currentStreak: gamificationResult?.currentStreak || 0,
    },
  });
}
```

### Step 3: Add XP Calculator to Coordinator

```typescript
// src/lib/gamification/services/gamification-coordinator.ts

/**
 * Calculate XP from news reading
 * Linear: 1 XP per 30 seconds, capped at 50 XP
 */
export function calculateNewsXP(params: { readingTimeMs: number }): number {
  const { readingTimeMs } = params;
  const baseXP = Math.floor(readingTimeMs / 30000); // 1 XP per 30s
  return Math.min(baseXP, 50); // Cap at 50 XP
}

/**
 * Record news completion with atomic updates
 */
export async function recordNewsCompletion(params: {
  userId: string;
  articleId: string;
  readingTimeMs: number;
  difficulty: string;
  isPremium: boolean;
}): Promise<GamificationResult> {
  const { userId, readingTimeMs, isPremium } = params;

  const xpEarned = calculateNewsXP({ readingTimeMs });

  // Skip if no XP earned (read < 30 seconds)
  if (xpEarned === 0) {
    return { xpEarned: 0, newTotalXP: 0, /* ... */ };
  }

  // Atomic Firestore transaction
  return await adminDb.runTransaction(async (transaction) => {
    const userStatsRef = adminDb.collection('user_stats').doc(userId);
    const statsDoc = await transaction.get(userStatsRef);

    const currentStats = statsDoc.data() || {};
    const currentXP = currentStats.xp?.total || 0;
    const newTotalXP = currentXP + xpEarned;
    const newLevel = Math.floor(newTotalXP / 1000);
    const today = new Date().toISOString().split('T')[0];

    // Track daily XP for streak
    const lastXPDate = currentStats.xp?.lastXPDate || null;
    const isNewDay = lastXPDate !== today;
    const newDailyXP = isNewDay ? xpEarned : (currentStats.xp?.xpGainedToday || 0) + xpEarned;

    // Update XP
    transaction.update(userStatsRef, {
      'xp.total': newTotalXP,
      'xp.level': newLevel,
      'xp.xpGainedToday': newDailyXP,
      'xp.lastXPDate': today,
      'news.articlesRead': FieldValue.increment(1),
    });

    // Update streak if daily threshold met
    let streakResult = null;
    if (newDailyXP >= getMinXpForStreak()) {
      streakResult = await updateStreakWithinTransaction(
        transaction, userId, newDailyXP, { isPremium, db: adminDb }
      );
    }

    return {
      xpEarned,
      newTotalXP,
      newLevel,
      streakIncremented: streakResult?.streakIncremented || false,
      currentStreak: streakResult?.data?.current || 0,
      bestStreak: streakResult?.data?.best || 0,
      achievementsUnlocked: [],
    };
  });
}
```

### Step 4: Integrate in React Component

```typescript
// src/app/[locale]/news/[articleId]/page.tsx

'use client';

import { useEffect, useRef } from 'react';
import { NewsProgressManager } from '@/lib/review-engine/progress/NewsProgressManager';
import { useGamificationStore } from '@/state/userGamification';

export default function NewsArticlePage({ params }: { params: { articleId: string } }) {
  const { user } = useAuth();
  const progressManager = useRef(NewsProgressManager.getInstance());
  const hasCompleted = useRef(false);

  // Start session on mount
  useEffect(() => {
    if (user?.uid) {
      progressManager.current.startSession(params.articleId, user.uid, 'N5');
    }

    // Cleanup on unmount
    return () => {
      if (!hasCompleted.current) {
        handleCompletion();
      }
    };
  }, [user?.uid, params.articleId]);

  // Track scroll activity
  useEffect(() => {
    const handleScroll = () => {
      progressManager.current.recordActivity();
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle completion (scroll to bottom or explicit action)
  const handleCompletion = async () => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;

    const result = progressManager.current.endSession();
    if (!result) return;

    try {
      const response = await fetch('/api/news/progress/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: params.articleId,
          readingTimeMs: result.activeTimeMs,
          difficulty: 'N5',
        }),
      });

      const data = await response.json();

      // Update Zustand store to trigger UI celebration
      if (data.success && data.data.xpEarned > 0) {
        const store = useGamificationStore.getState();
        store.updateFromServer({
          totalXP: data.data.newTotalXP,
          currentStreak: data.data.currentStreak,
        });
        store.incrementSessionCount(); // Triggers CelebrationProvider
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  };

  return (
    <article onScrollEnd={handleCompletion}>
      {/* Article content */}
    </article>
  );
}
```

---

## Complex Pattern: Drill Page Implementation

The Drill Page demonstrates **full URE integration** with SRS tracking, question results, and multi-mode support.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DRILL PAGE (CLIENT)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐     ┌─────────────────────────────────────────┐   │
│  │ DrillPage.tsx   │────▶│ DrillProgressManager                    │   │
│  │ (React)         │     │ extends UniversalProgressManager        │   │
│  │                 │     │                                         │   │
│  │ State:          │     │ Features:                               │   │
│  │ - session       │     │ - IndexedDB storage                     │   │
│  │ - questionIndex │     │ - Firebase sync (premium)               │   │
│  │ - score         │     │ - SRS data management                   │   │
│  │ - questionResults│    │ - Session history                       │   │
│  └─────────────────┘     └─────────────────────────────────────────┘   │
│           │                              │                              │
│           │ 1. Start drill              │ 2. Track completion          │
│           ▼                              ▼                              │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ API: POST /api/drill/session (create)                          │    │
│  │ API: PUT  /api/drill/session (complete)                        │    │
│  └─────────────────────────────────────┬──────────────────────────┘    │
│                                         │                               │
└─────────────────────────────────────────┼───────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          SERVER SIDE                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PUT /api/drill/session (action='complete')                             │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 1. Validate request (Zod schema)                                  │  │
│  │ 2. Calculate accuracy (normalize to 0-100)                        │  │
│  │ 3. Update drill_sessions collection (premium only)                │  │
│  │ 4. Call recordDrillCompletion() for gamification                  │  │
│  │ 5. Process questionResults for SRS updates                        │  │
│  │    - For each question: calculate SM-2, update drill-srs          │  │
│  │ 6. Return gamification result + SRS updates                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Components

#### DrillProgressManager

```typescript
// src/lib/review-engine/progress/DrillProgressManager.ts

export interface DrillProgressData extends ReviewProgressData {
  drillType: 'conjugation' | 'vocabulary' | 'mixed';
  verbsStudied: Set<string>;
  adjectivesStudied: Set<string>;
  totalDrills: number;
  perfectDrills: number;
  averageAccuracy: number;
  conjugationTypes: Map<string, number>;
}

export interface QuestionAnswerResult {
  questionId: string;
  wordId: string;
  targetForm: string;
  correct: boolean;
  userAnswer: string;
  correctAnswer: string;
  responseTime: number;
}

export class DrillProgressManager extends UniversalProgressManager<DrillProgressData> {
  private static instance: DrillProgressManager | null = null;

  static getInstance(): DrillProgressManager {
    if (!DrillProgressManager.instance) {
      DrillProgressManager.instance = new DrillProgressManager();
    }
    return DrillProgressManager.instance;
  }

  /**
   * Track a completed drill session
   * Handles API call, gamification, and local storage
   */
  async trackDrillSession(session: DrillSessionData, user: any, isPremium: boolean): Promise<void> {
    // 1. Call API to complete session
    const response = await fetch('/api/drill/session', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.sessionId,
        action: 'complete',
        finalScore: session.correctAnswers,
        accuracy: session.accuracy,
        questionResults: session.questionResults, // For SRS tracking
      }),
    });

    if (response.ok) {
      const result = await response.json();

      // 2. Update Zustand store for UI
      if (result.data?.gamification) {
        const gam = result.data.gamification;
        const store = useGamificationStore.getState();

        store.updateFromServer({
          totalXP: gam.newTotalXP,
          currentLevel: gam.newLevel,
          currentStreak: gam.currentStreak,
          bestStreak: gam.bestStreak,
        });

        store.incrementSessionCount(); // Triggers celebration
      }
    }

    // 3. Update local IndexedDB stats
    await this.saveProgress(user.uid, 'drill', 'overall', {
      // ... drill stats
    }, isPremium);
  }
}
```

#### API Route with SRS Processing

```typescript
// src/app/api/drill/session/route.ts (PUT handler excerpt)

if (action === 'complete') {
  // 1. Normalize accuracy
  const accuracy = Accuracy.normalize(validated.accuracy);

  // 2. Record gamification
  const gamificationResult = await recordDrillCompletion({
    userId: session.uid,
    sessionId,
    score: finalScore,
    totalQuestions: sessionData.questions.length,
    accuracy,
    isPremium,
  });

  // 3. Process question results for SRS (premium only)
  if (isPremium && validated.questionResults?.length > 0) {
    for (const result of validated.questionResults) {
      const question = sessionData.questions.find(q => q.id === result.questionId);
      if (!question) continue;

      const wordId = `${question.word.kanji || question.word.kana}:${question.word.kana}`;
      const wordDocRef = adminDb
        .collection('users')
        .doc(session.uid)
        .collection('drill-srs')
        .doc(wordId);

      const wordDoc = await wordDocRef.get();
      let wordEntry = wordDoc.exists ? wordDoc.data() : initializeNewSRSEntry(wordId, question.word);

      // Update SRS using SM-2 algorithm
      wordEntry.srsData = calculateSM2(wordEntry.srsData, result.correct);
      wordEntry.lastReviewedAt = new Date().toISOString();
      wordEntry.totalReviews++;

      await wordDocRef.set(wordEntry, { merge: true });
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      session: { ...sessionData, completedAt, score, accuracy },
      gamification: gamificationResult,
    },
  });
}
```

#### SM-2 Algorithm Implementation

```typescript
// src/lib/review-engine/srs/drill-srs-utils.ts

export function calculateSM2(currentSRS: any, correct: boolean): any {
  const newSRS = { ...currentSRS };

  if (correct) {
    // Correct answer flow
    if (newSRS.status === 'new') {
      newSRS.status = 'learning';
      newSRS.interval = 1;
      newSRS.repetitions = 1;
    } else if (newSRS.status === 'learning') {
      newSRS.repetitions++;
      if (newSRS.repetitions >= 2) {
        newSRS.status = 'review';
        newSRS.interval = 3;
      }
    } else {
      // Review/Mastered status
      newSRS.repetitions++;
      newSRS.interval = Math.round(newSRS.interval * newSRS.easeFactor);

      // Check for mastery
      if (newSRS.interval >= 21 && newSRS.repetitions >= 5) {
        newSRS.status = 'mastered';
      }
    }

    // Increase ease factor on correct
    newSRS.easeFactor = Math.min(2.5, newSRS.easeFactor + 0.1);
  } else {
    // Incorrect answer - reset progress
    newSRS.lapses++;
    newSRS.repetitions = 0;
    newSRS.interval = 1;
    newSRS.easeFactor = Math.max(1.3, newSRS.easeFactor - 0.2);

    // Demote status
    if (newSRS.status === 'mastered') newSRS.status = 'review';
    else if (newSRS.status === 'review') newSRS.status = 'learning';
  }

  // Calculate next review date
  newSRS.lastReviewedAt = new Date().toISOString();
  newSRS.nextReviewAt = calculateNextReviewDate(newSRS.interval);

  return newSRS;
}

export function calculateNextReviewDate(intervalDays: number): string {
  const next = new Date();
  next.setTime(next.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return next.toISOString();
}
```

---

## Creating a New XP-Enabled Feature

### Decision Tree: Which Pattern?

```
Does your feature need:

├── SRS (spaced repetition) tracking?
│   └── YES → Use Complex Pattern (extend UniversalProgressManager)
│
├── Question/answer tracking with per-item results?
│   └── YES → Use Complex Pattern
│
├── Just time-based or completion-based XP?
│   └── YES → Use Simple Pattern
│
├── IndexedDB for offline support?
│   └── YES → Use Complex Pattern
│
└── Otherwise → Use Simple Pattern
```

### Simple Pattern Checklist

1. **Create Progress Manager** (if needed for state)
   - In-memory singleton
   - Track active time or completion state
   - Export `getInstance()` method

2. **Add XP Calculator** to `gamification-coordinator.ts`
   ```typescript
   export function calculateMyFeatureXP(params: { /* inputs */ }): number {
     // Return XP value (consider caps!)
   }
   ```

3. **Add Record Function** to `gamification-coordinator.ts`
   ```typescript
   export async function recordMyFeatureCompletion(params: {
     userId: string;
     /* feature-specific params */
     isPremium: boolean;
   }): Promise<GamificationResult> {
     const xpEarned = calculateMyFeatureXP(params);
     return await adminDb.runTransaction(async (tx) => {
       // Update user_stats
       // Update streak
       // Check achievements
       // Return result
     });
   }
   ```

4. **Create API Route**
   - Authenticate user
   - Prevent duplicate XP (check completion status)
   - Call `recordMyFeatureCompletion()`
   - Save progress to Firebase
   - Return gamification result

5. **Integrate in React Component**
   - Track activity/completion
   - Call API on completion
   - Update Zustand store
   - Call `incrementSessionCount()` for celebration

### Complex Pattern Checklist

1. **Extend UniversalProgressManager**
   ```typescript
   export interface MyProgressData extends ReviewProgressData {
     // Feature-specific fields
   }

   export class MyProgressManager extends UniversalProgressManager<MyProgressData> {
     // Implement feature-specific tracking
   }
   ```

2. **Create Result Interface** (if tracking per-item)
   ```typescript
   export interface MyItemResult {
     itemId: string;
     correct: boolean;
     responseTime: number;
     // ...
   }
   ```

3. **Create API Schema** (Zod validation)
   ```typescript
   export const MyFeatureCompleteRequestSchema = z.object({
     sessionId: z.string(),
     score: z.number(),
     itemResults: z.array(/* ... */),
   });
   ```

4. **Implement Full API Route**
   - Create session (POST)
   - Update/complete session (PUT)
   - Get stats (GET)
   - Process item results for SRS if applicable

5. **Update Zustand Store**
   - Call `updateFromServer()` with new values
   - Call `incrementSessionCount()` for celebration
   - Handle achievement unlocks

---

## Creating a Custom Progress Manager

### When to Create One

- You need feature-specific statistics beyond basic XP
- You want offline support via IndexedDB
- You need to sync data between client and Firebase
- You want mastery/status progression

### Step-by-Step Guide

#### 1. Define Your Progress Data Interface

```typescript
// src/lib/review-engine/progress/MyProgressManager.ts

import { UniversalProgressManager } from './UniversalProgressManager';
import { ReviewProgressData } from '../core/progress.types';

export interface MyProgressData extends ReviewProgressData {
  // Feature-specific fields
  myFeatureCount: number;
  bestScore: number;
  itemsCompleted: Set<string>;
  categoryStats: Map<string, number>;
}
```

#### 2. Create the Manager Class

```typescript
export class MyProgressManager extends UniversalProgressManager<MyProgressData> {
  private static instance: MyProgressManager | null = null;

  private constructor() {
    super();
  }

  static getInstance(): MyProgressManager {
    if (!MyProgressManager.instance) {
      MyProgressManager.instance = new MyProgressManager();
    }
    return MyProgressManager.instance;
  }

  /**
   * Initialize progress for a user
   */
  async initializeProgress(userId: string): Promise<void> {
    await this.initDB();

    const existing = await this.getProgress(userId, 'my-feature', false);
    if (!existing || existing.size === 0) {
      const now = new Date().toISOString();
      await this.saveProgress(userId, 'my-feature', 'overall', {
        contentId: 'overall',
        contentType: 'my-feature',
        status: 'not-started',
        // ... base fields from ReviewProgressData
        // Feature-specific defaults:
        myFeatureCount: 0,
        bestScore: 0,
        itemsCompleted: new Set(),
        categoryStats: new Map(),
      }, false);
    }
  }

  /**
   * Track a completed session
   */
  async trackSession(data: MySessionData, user: any, isPremium: boolean): Promise<void> {
    await this.initDB();

    // 1. Call API for gamification
    const response = await fetch('/api/my-feature/complete', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // 2. Update Zustand store
    const result = await response.json();
    if (result.data?.gamification) {
      useGamificationStore.getState().updateFromServer({
        totalXP: result.data.gamification.newTotalXP,
        // ...
      });
    }

    // 3. Update local stats
    const progressMap = await this.getProgress(user.uid, 'my-feature', isPremium);
    const current = progressMap?.get('overall') || this.createDefault();

    current.myFeatureCount++;
    current.bestScore = Math.max(current.bestScore, data.score);
    // ... update other stats

    // Convert Sets/Maps for serialization
    const serializable = {
      ...current,
      itemsCompleted: Array.from(current.itemsCompleted),
      categoryStats: Object.fromEntries(current.categoryStats),
    };

    await this.saveProgress(user.uid, 'my-feature', 'overall', serializable, isPremium);
  }

  /**
   * Get stats for dashboard display
   */
  async getStats(userId: string, isPremium: boolean): Promise<MyProgressData | null> {
    await this.initDB();

    const progressMap = await this.getProgress(userId, 'my-feature', isPremium);
    const raw = progressMap?.get('overall');

    if (!raw) return null;

    // Reconstitute Sets/Maps
    return {
      ...raw,
      itemsCompleted: new Set(raw.itemsCompleted || []),
      categoryStats: new Map(Object.entries(raw.categoryStats || {})),
    } as MyProgressData;
  }
}

// Export for use in components
export const getMyProgressManager = () => MyProgressManager.getInstance();
```

#### 3. Handle Serialization Properly

Sets and Maps can't be stored directly in IndexedDB or Firebase:

```typescript
// Before saving:
const serializable = {
  ...data,
  mySet: Array.from(data.mySet),
  myMap: Object.fromEntries(data.myMap),
};

// After loading:
const reconstituted = {
  ...raw,
  mySet: new Set(raw.mySet || []),
  myMap: new Map(Object.entries(raw.myMap || {})),
};
```

#### 4. Key Methods from UniversalProgressManager

```typescript
// Initialize IndexedDB connection
await this.initDB();

// Save progress (handles IndexedDB + Firebase sync for premium)
await this.saveProgress(userId, contentType, contentId, data, isPremium);

// Get progress (returns Map<contentId, ProgressData>)
const progressMap = await this.getProgress(userId, contentType, isPremium);

// Load directly from Firebase (bypasses local cache)
const cloudData = await this.loadFromFirebase(userId, contentType);

// Track an event (for analytics/history)
await this.trackProgress(contentType, contentId, ProgressEvent.COMPLETED, user, isPremium, metadata);
```

---

## Adding New Content Types to URE

If you want to add a completely new reviewable content type (like vocabulary, kanji, sentences), you need to create an **Adapter**.

### What Is an Adapter?

An adapter is a **transformer** that converts your raw content (kanji, vocabulary, flashcards, etc.) into the universal `ReviewableContent` interface that the review engine understands.

#### The Problem It Solves

You might have content from many different sources with different shapes:

```typescript
// Kanji from dictionary
{ character: "漢", meanings: ["Chinese", "Han"], onyomi: "カン", strokeCount: 13 }

// Vocabulary from user list
{ word: "食べる", reading: "たべる", english: "to eat", jlpt: "N5" }

// Flashcard from Anki import
{ front: "Hello", back: "こんにちは", deck: "Greetings" }
```

The URE can't handle all these different formats directly. The adapter transforms them into **one universal format**:

```typescript
interface ReviewableContent {
  id: string;
  contentType: string;

  // What user sees
  primaryDisplay: string;      // Main content (e.g., "漢")
  secondaryDisplay?: string;   // Supporting info (e.g., "Chinese character")
  tertiaryDisplay?: string;    // Extra context (e.g., "カン / かん")

  // What's considered correct
  primaryAnswer: string;
  alternativeAnswers?: string[];

  // Metadata
  difficulty: number;          // 0.0 to 1.0
  tags: string[];
  supportedModes: ReviewMode[];
}
```

#### Visual Summary

```
Raw Content (many formats)          Universal Format (one format)
─────────────────────────           ─────────────────────────────

┌─────────────────┐                 ┌──────────────────────────┐
│ Kanji Dict      │──┐              │                          │
│ {character,...} │  │              │   ReviewableContent      │
└─────────────────┘  │              │                          │
                     │  Adapters    │   - primaryDisplay       │
┌─────────────────┐  │  ────────▶   │   - primaryAnswer        │
│ Vocabulary List │──┼──────────▶   │   - difficulty           │
│ {word, reading} │  │              │   - supportedModes       │
└─────────────────┘  │              │   - ...                  │
                     │              │                          │
┌─────────────────┐  │              └──────────────────────────┘
│ Anki Import     │──┘                         │
│ {front, back}   │                            │
└─────────────────┘                            ▼
                                    ┌──────────────────────────┐
                                    │   Review Engine          │
                                    │   (SRS, Queue, Session)  │
                                    │                          │
                                    │   Works with ANY content │
                                    │   that's been adapted    │
                                    └──────────────────────────┘
```

#### Why This Matters

The adapter pattern means:
- **Add new content types** without changing the review engine
- **Same SRS algorithm** works for kanji, vocab, flashcards, sentences
- **Same session management** for all content
- **Same validation system** (with content-specific validators if needed)

It's essentially the **"universal translator"** that makes the URE truly universal.

#### Real Example: KanjiAdapter

```typescript
class KanjiAdapter extends BaseContentAdapter<RawKanjiData> {

  transform(kanji: RawKanjiData): ReviewableContent {
    return {
      id: kanji.character,
      contentType: 'kanji',

      // Display
      primaryDisplay: kanji.character,           // 漢
      secondaryDisplay: kanji.meanings[0],       // "Chinese"
      tertiaryDisplay: `${kanji.onyomi} / ${kanji.kunyomi}`,

      // Validation
      primaryAnswer: kanji.meanings[0],
      alternativeAnswers: kanji.meanings.slice(1),

      // Metadata
      difficulty: this.calculateDifficulty(kanji),
      tags: [`jlpt-n${kanji.jlptLevel}`],
      supportedModes: ['recognition', 'recall', 'writing'],
    };
  }

  calculateDifficulty(kanji: RawKanjiData): number {
    const strokeFactor = kanji.strokeCount / 30;
    const jlptFactor = (5 - kanji.jlptLevel) / 5;
    return strokeFactor * 0.6 + jlptFactor * 0.4;
  }
}
```

#### The Registry Pattern

All adapters are registered in a central registry:

```typescript
// src/lib/review-engine/adapters/registry.ts

AdapterRegistry.registerAdapter('kanji', new KanjiAdapter());
AdapterRegistry.registerAdapter('vocabulary', new VocabularyAdapter());
AdapterRegistry.registerAdapter('flashcard', new FlashcardAdapter());
// ... 10+ adapters

// Usage anywhere in the app:
const adapter = AdapterRegistry.getAdapter('kanji');
const reviewable = adapter.transform(rawKanjiData);
```

---

### Creating Your Own Adapter

Now that you understand what adapters do, here's how to create one:

### Step 1: Create an Adapter

```typescript
// src/lib/review-engine/adapters/MyContentAdapter.ts

import { BaseContentAdapter } from './base.adapter';
import { ReviewableContent, ReviewMode } from '../core/interfaces';

interface MyRawContent {
  id: string;
  // Your content's native structure
}

export class MyContentAdapter extends BaseContentAdapter<MyRawContent> {
  /**
   * Transform your content into URE's universal format
   */
  transform(raw: MyRawContent): ReviewableContent {
    return {
      id: raw.id,
      contentType: 'my-content',

      // What user sees
      primaryDisplay: raw.term,
      secondaryDisplay: raw.definition,
      tertiaryDisplay: raw.examples?.join(', '),

      // What's considered correct
      primaryAnswer: raw.definition,
      alternativeAnswers: raw.synonyms || [],

      // Media (optional)
      audioUrl: raw.audio,
      imageUrl: raw.image,

      // Metadata
      difficulty: this.calculateDifficulty(raw),
      tags: raw.categories || [],
      supportedModes: ['recognition', 'recall'],
      metadata: {
        source: raw.source,
        frequency: raw.frequency,
      },
    };
  }

  /**
   * Calculate difficulty (0.0 to 1.0)
   */
  calculateDifficulty(content: MyRawContent): number {
    // Example: based on complexity
    const lengthFactor = Math.min(content.term.length / 20, 1);
    const frequencyFactor = content.frequency ? 1 - (content.frequency / 10000) : 0.5;
    return (lengthFactor + frequencyFactor) / 2;
  }

  getSupportedModes(): ReviewMode[] {
    return ['recognition', 'recall'];
  }
}
```

### Step 2: Register the Adapter

```typescript
// src/lib/review-engine/adapters/registry.ts

import { MyContentAdapter } from './MyContentAdapter';

AdapterRegistry.registerAdapter('my-content', new MyContentAdapter(config));
```

### Step 3: Create a Validator (Optional)

If your content needs custom validation logic:

```typescript
// src/lib/review-engine/validation/MyContentValidator.ts

import { BaseValidator, ValidationResult } from './base-validator';

export class MyContentValidator extends BaseValidator {
  validate(userAnswer: string, expectedAnswer: string, content: any): ValidationResult {
    // Normalize both answers
    const normalizedUser = this.normalize(userAnswer);
    const normalizedExpected = this.normalize(expectedAnswer);

    // Check exact match
    if (normalizedUser === normalizedExpected) {
      return { isCorrect: true, confidence: 1.0 };
    }

    // Check alternatives
    const alternatives = content.alternativeAnswers || [];
    for (const alt of alternatives) {
      if (normalizedUser === this.normalize(alt)) {
        return { isCorrect: true, confidence: 0.95 };
      }
    }

    // Fuzzy match (optional)
    const similarity = this.calculateSimilarity(normalizedUser, normalizedExpected);
    if (similarity >= 0.8) {
      return {
        isCorrect: true,
        confidence: similarity,
        partialCredit: similarity - 0.5,
      };
    }

    return { isCorrect: false, confidence: similarity };
  }

  private normalize(str: string): string {
    return str.toLowerCase().trim().replace(/[^\w\s]/g, '');
  }
}
```

---

## Best Practices & Pitfalls

### Do's

1. **Always use atomic transactions** for XP updates
   ```typescript
   // GOOD
   return await adminDb.runTransaction(async (tx) => {
     // All updates in one transaction
   });
   ```

2. **Prevent duplicate XP awards**
   ```typescript
   // Check completion status BEFORE awarding XP
   if (progressDoc.exists && progressDoc.data()?.completed) {
     return { xpEarned: 0, alreadyCompleted: true };
   }
   ```

3. **Normalize accuracy values**
   ```typescript
   import { Accuracy } from '@/lib/statistics/accuracy';
   const normalized = Accuracy.normalize(rawAccuracy); // Ensures 0-100
   ```

4. **Update Zustand store after API success**
   ```typescript
   if (result.data?.gamification) {
     store.updateFromServer({ ... });
     store.incrementSessionCount(); // Triggers celebration!
   }
   ```

5. **Check feature flag before gamification**
   ```typescript
   if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true') {
     gamificationResult = await recordXXXCompletion(...);
   }
   ```

### Don'ts

1. **Don't nest Firestore transactions**
   ```typescript
   // BAD - will fail!
   await adminDb.runTransaction(async (tx1) => {
     await adminDb.runTransaction(async (tx2) => { ... });
   });

   // GOOD - use single transaction
   await adminDb.runTransaction(async (tx) => {
     // All operations in one transaction
   });
   ```

2. **Don't forget to serialize Sets/Maps**
   ```typescript
   // BAD - IndexedDB will fail
   await this.saveProgress(userId, type, id, { mySet: new Set() });

   // GOOD
   await this.saveProgress(userId, type, id, { mySet: Array.from(mySet) });
   ```

3. **Don't import browser-only code in API routes**
   ```typescript
   // BAD in API route - idb requires browser
   import { DrillProgressManager } from './DrillProgressManager';

   // GOOD - use server-safe utilities
   import { calculateSM2 } from './drill-srs-utils';
   ```

4. **Don't award XP on client side**
   ```typescript
   // BAD - can be manipulated
   const xp = calculateXP();
   store.addXP(xp);

   // GOOD - server calculates and returns XP
   const response = await fetch('/api/.../complete', ...);
   const { xpEarned } = response.data;
   ```

5. **Don't forget error handling**
   ```typescript
   try {
     gamificationResult = await recordCompletion(...);
   } catch (error) {
     console.error('Gamification failed:', error);
     // Don't fail the whole request - continue without XP
   }
   ```

---

## Testing Your Integration

### Manual Testing Checklist

- [ ] XP is awarded on first completion
- [ ] No duplicate XP on repeat completion
- [ ] Streak increments when daily XP threshold is met
- [ ] Streak doesn't increment twice on same day
- [ ] Zustand store updates correctly
- [ ] Celebration animation triggers
- [ ] Works for both free and premium users
- [ ] Offline mode (if applicable) works correctly
- [ ] Data syncs to Firebase for premium users

### Debug Logging

```typescript
// Enable in gamification-coordinator.ts
console.log('[Gamification] Daily XP Accumulation:', {
  lastXPDate,
  today,
  isNewDay,
  currentDailyXP,
  newDailyXP,
  minXpForStreak,
});
```

### Testing API Directly

```bash
# Test completion endpoint
curl -X POST http://localhost:3000/api/my-feature/complete \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"featureId": "test", "score": 100}'
```

### Firebase Emulator

```bash
# Run with emulator
FIRESTORE_EMULATOR_HOST=localhost:8080 npm run dev
```

---

## Quick Reference

### XP Formulas

| Feature | Formula | Cap |
|---------|---------|-----|
| Drill | `5*correct + accuracyBonus(10-50) + completionBonus(20)` | None |
| Review (URE) | `3*correct + accuracyBonus(5-30) + volumeBonus(5/10items)` | None |
| News/Books | `1 XP per 30 seconds` | 50 XP |

### Streak Thresholds

| Setting | Default | Location |
|---------|---------|----------|
| Min XP for streak | 50 | `streakConfig.ts` |
| Grace period | 36 hours | `streakConfig.ts` |
| Premium freeze days | 3 | `streakConfig.ts` |

### Key Imports

```typescript
// Gamification
import { recordDrillCompletion, recordReviewCompletion, recordNewsCompletion } from '@/lib/gamification/services/gamification-coordinator';
import { useGamificationStore } from '@/state/userGamification';

// Progress Managers
import { DrillProgressManager } from '@/lib/review-engine/progress/DrillProgressManager';
import { NewsProgressManager } from '@/lib/review-engine/progress/NewsProgressManager';

// Utilities
import { Accuracy } from '@/lib/statistics/accuracy';
import { calculateSM2, calculateNextReviewDate } from '@/lib/review-engine/srs/drill-srs-utils';
```

### Firestore Collections

| Collection | Purpose | Premium Only |
|------------|---------|--------------|
| `user_stats` | XP, level, streak, achievements | No |
| `drill_sessions` | Drill session data | Yes |
| `users/{uid}/drill-srs` | Per-word SRS data | Yes |
| `news_progress` | News article completion | No |
| `xp_logs` | Manual XP award audit | No |

---

## Conclusion

The Moshimoshi XP and URE systems are designed for extensibility:

- **Simple features** → Use the News Reader pattern (time-based, minimal state)
- **Complex features** → Use the Drill pattern (SRS, per-item tracking)
- **New content types** → Create adapters for URE integration

Key principles:
1. All XP calculation happens **server-side**
2. All updates use **atomic Firestore transactions**
3. Client updates Zustand store **after** server success
4. Duplicate XP is prevented by **completion status checks**
5. Streaks use **daily accumulated XP**, not per-action XP

For questions or issues, check:
- `/docs/REVIEW_ENGINE_DEEP_DIVE.md` - Full URE architecture
- `/docs/REVIEW_ENGINE_PRACTICAL_GUIDE.md` - Implementation examples
- `CLAUDE.md` - Quick reference and file locations

---

*Last Updated: 2025-01-10*
*Maintainer: Moshimoshi Development Team*
