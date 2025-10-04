# Universal Review Engine Integration Handbook 🚀

## For AI Agents: Complete Guide to Adding New Features

### ⚠️ CRITICAL: Read This First

Before you start coding, understand this fundamental architecture:

1. **The Review Engine is ONLY for reviewing content** - It has three modes: `recognition`, `recall`, and `listening`. There is NO "browse" mode in the Review Engine.
2. **Page view modes are different from Review modes** - Pages have `browse` (selection), `study`, and `review` views. Don't confuse these with Review Engine's internal modes.
3. **Everything must extend `ReviewableContent`** - This is the universal interface that all content must conform to.
4. **Check existing patterns** - Look at hiragana/katakana implementation first (`KanaLearningComponent`) - it's the reference implementation.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Step-by-Step Integration Guide](#step-by-step-integration-guide)
3. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
4. [Testing Checklist](#testing-checklist)
5. [Quick Reference](#quick-reference)

---

## 🏗️ Architecture Overview

### Core Components Hierarchy

```
User Interface Layer
├── Learning Pages (browse/study/review modes)
├── LearningPageNavbar (common navigation)
└── Selection UI (grids, checkboxes, etc.)
    ↓
Hook Layer
├── useYourFeature() (manages state & API calls)
└── Integrates with achievement system
    ↓
Review Engine Layer
├── Content Adapters (transform content)
├── ReviewEngine Component (handles review)
└── Validation & SRS algorithms
    ↓
API Layer
├── Browse tracking endpoints
├── Add to review queue endpoints
└── Progress tracking endpoints
    ↓
Database Layer
├── Firebase (premium users)
└── IndexedDB (all users)
```

### Key Concepts

1. **Content Flow**:
   - Browse → Select → Transform → Review → Track → Update Progress

2. **Three-Tier Storage Model**:
   - Guest: No persistence
   - Free: IndexedDB only
   - Premium: IndexedDB + Firebase sync

3. **Entitlements System**:
   - Single source of truth: `/config/features.v1.json`
   - Daily limits enforced server-side
   - Premium features checked via `useSubscription()`

---

## 📝 Step-by-Step Integration Guide

### Step 1: Define Your Feature in Entitlements

**File**: `/config/features.v1.json`

```json
{
  "id": "your_feature",
  "name": "Your Feature",
  "category": "learning",
  "lifecycle": "active",
  "permission": "do_practice",
  "limitType": "daily",
  "notifications": false,
  "limits": {
    "guest": 0,
    "free": 5,
    "premium": 10
  }
}
```

**Then regenerate TypeScript types**:
```bash
npx tsx scripts/gen-entitlements.ts
```

### Step 2: Create Your Content Adapter

**File**: `/src/lib/review-engine/adapters/YourFeatureAdapter.ts`

```typescript
import { BaseContentAdapter } from './base.adapter';  // NOT './BaseContentAdapter' !!
import { ReviewableContent, ReviewMode } from '../core/interfaces';

export interface YourContent {
  id: string;
  // Your specific fields
}

export class YourFeatureAdapter extends BaseContentAdapter<YourContent> {
  transform(content: YourContent): ReviewableContent {
    return {
      id: content.id,
      contentType: 'custom', // or specific type

      // Display fields
      primaryDisplay: content.mainThing,
      secondaryDisplay: content.meaning,
      tertiaryDisplay: content.additionalInfo,

      // Answer fields
      primaryAnswer: content.correctAnswer,
      alternativeAnswers: content.alternativeAnswers,

      // Metadata
      difficulty: this.calculateDifficulty(content),
      tags: this.generateTags(content),
      source: 'your_feature',

      // Review configuration
      supportedModes: ['recognition', 'recall'] as ReviewMode[],
      preferredMode: 'recognition' as ReviewMode,

      metadata: {
        // Your custom metadata
      }
    };
  }
}
```

### Step 3: Create Your React Hook

**File**: `/src/hooks/useYourFeature.ts`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { useAchievementStore } from '@/stores/achievement-store';

interface YourFeatureSession {
  id: string;
  startedAt: Date;
  itemsViewed: string[];
  itemsBookmarked: string[];
  itemsAddedToReview: string[];
}

export function useYourFeature() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { showToast } = useToast();
  const achievementStore = useAchievementStore();

  const [session, setSession] = useState<YourFeatureSession | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [dailyUsage, setDailyUsage] = useState({ added: 0, limit: 5 });

  // Initialize session
  const startSession = useCallback(() => {
    const newSession: YourFeatureSession = {
      id: Math.random().toString(36).substring(7),
      startedAt: new Date(),
      itemsViewed: [],
      itemsBookmarked: [],
      itemsAddedToReview: []
    };
    setSession(newSession);
    sessionStorage.setItem('your_feature_session', JSON.stringify(newSession));
  }, []);

  // Track browse/view events for achievements
  const trackView = useCallback(async (itemId: string) => {
    if (!user?.uid || !session) return;

    try {
      await fetch('/api/your-feature/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          action: 'view',
          sessionId: session.id
        })
      });

      // Update achievement progress
      await achievementStore.updateProgress({
        sessionType: 'your_feature',
        itemsViewed: 1
      });
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  }, [user, session, achievementStore]);

  // Add to review queue with daily limits
  const addToReview = useCallback(async (itemIds: string[]) => {
    if (!user?.uid) {
      showToast('Please sign in to add items to review', 'warning');
      return false;
    }

    try {
      const response = await fetch('/api/your-feature/add-to-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          showToast(`Daily limit reached! ${data.remaining} remaining today.`, 'warning');
        } else {
          throw new Error(data.error);
        }
        return false;
      }

      showToast(`Added ${itemIds.length} items to review queue`, 'success');
      setDailyUsage({ added: data.dailyUsage, limit: data.dailyLimit });
      return true;

    } catch (error) {
      console.error('Failed to add to review:', error);
      showToast('Failed to add items to review', 'error');
      return false;
    }
  }, [user, showToast]);

  return {
    session,
    bookmarks,
    dailyUsage,
    startSession,
    trackView,
    addToReview,
    canAddMore: dailyUsage.added < dailyUsage.limit,
    isPremium
  };
}
```

### Step 4: Create API Endpoints

**File**: `/src/app/api/your-feature/add-to-review/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { itemIds } = body;

    // Check daily limits
    const today = new Date().toISOString().split('T')[0];
    const usageRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('usage')
      .doc(today);

    const usageDoc = await usageRef.get();
    const currentUsage = usageDoc.data()?.your_feature || 0;

    // Get user's tier
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    const subscription = userData?.subscription;

    // Determine limits based on tier
    let dailyLimit = 5; // Free tier default
    if (subscription?.plan === 'premium_monthly' || subscription?.plan === 'premium_yearly') {
      dailyLimit = 10; // Premium limit
    }

    // Check if would exceed limit
    if (currentUsage + itemIds.length > dailyLimit) {
      const remaining = Math.max(0, dailyLimit - currentUsage);
      return NextResponse.json(
        {
          error: 'Daily limit exceeded',
          limit: dailyLimit,
          current: currentUsage,
          remaining
        },
        { status: 429 }
      );
    }

    // Add to review queue
    const batch = adminDb.batch();
    const timestamp = FieldValue.serverTimestamp();

    for (const itemId of itemIds) {
      const queueRef = adminDb
        .collection('users')
        .doc(session.uid)
        .collection('review_queue')
        .doc(itemId);

      batch.set(queueRef, {
        contentId: itemId,
        contentType: 'your_content',
        state: 'new',
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: timestamp,
        addedFrom: 'your_feature',
        addedAt: timestamp
      }, { merge: true });
    }

    // Update usage counter
    batch.set(usageRef, {
      your_feature: FieldValue.increment(itemIds.length),
      lastUpdated: timestamp
    }, { merge: true });

    await batch.commit();

    return NextResponse.json({
      success: true,
      added: itemIds.length,
      dailyUsage: currentUsage + itemIds.length,
      dailyLimit,
      remaining: dailyLimit - (currentUsage + itemIds.length)
    });

  } catch (error) {
    console.error('[Add to Review] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add to review' },
      { status: 500 }
    );
  }
}
```

### Step 5: Create Your UI Component

**File**: `/src/app/your-feature/page.tsx`

```typescript
'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import LearningPageNavbar from '@/components/common/LearningPageNavbar';
import { useYourFeature } from '@/hooks/useYourFeature';
import { YourFeatureAdapter } from '@/lib/review-engine/adapters/YourFeatureAdapter';
import { ReviewableContent } from '@/lib/review-engine/core/interfaces';
import { SessionStatistics } from '@/lib/review-engine/core/session.types';

const ReviewEngine = dynamic(() => import('@/components/review-engine/ReviewEngine'), {
  loading: () => <LoadingOverlay isLoading={true} />,
  ssr: false
});

type ViewMode = 'browse' | 'study' | 'review';

export default function YourFeaturePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [reviewContent, setReviewContent] = useState<ReviewableContent[]>([]);

  const {
    session,
    dailyUsage,
    trackView,
    addToReview,
    canAddMore
  } = useYourFeature();

  const adapter = useMemo(() => new YourFeatureAdapter(), []);

  // Progress stats for navbar
  const progressStats = useMemo(() => {
    const total = 100; // Your total items
    const learned = 0; // Track this properly
    return {
      total,
      learned,
      learnedPercentage: total > 0 ? Math.round((learned / total) * 100) : 0
    };
  }, []);

  const handleStartReview = useCallback(() => {
    const content = Array.from(selectedItems).map(id => {
      // Get your content item by id
      const item = getItemById(id);
      return adapter.transform(item);
    });
    setReviewContent(content);
  }, [selectedItems, adapter]);

  const handleReviewComplete = useCallback((stats: SessionStatistics) => {
    setViewMode('browse');
    setSelectedItems(new Set());
    showToast(`Review complete! Accuracy: ${stats.accuracy.toFixed(1)}%`, 'success');
  }, []);

  // Review/Study mode
  if ((viewMode === 'review' || viewMode === 'study') && reviewContent.length > 0) {
    return (
      <div className="min-h-screen">
        <LearningPageNavbar
          title="Your Feature"
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onStartStudy={() => {
            handleStartReview();
            setViewMode('study');
          }}
          onStartReview={() => {
            handleStartReview();
            setViewMode('review');
          }}
          onClearSelection={() => setSelectedItems(new Set())}
          selectedCount={selectedItems.size}
          progress={progressStats}
        />
        <main className="container mx-auto px-4 py-8">
          <ReviewEngine
            content={reviewContent}
            mode={viewMode === 'study' ? 'practice' : 'test'}
            onComplete={handleReviewComplete}
            onExit={() => setViewMode('browse')}
          />
        </main>
      </div>
    );
  }

  // Browse mode
  return (
    <div className="min-h-screen">
      <LearningPageNavbar
        title="Your Feature"
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onStartStudy={() => {
          if (selectedItems.size === 0) {
            showToast('Please select items to study', 'warning');
            return;
          }
          handleStartReview();
          setViewMode('study');
        }}
        onStartReview={() => {
          if (selectedItems.size === 0) {
            showToast('Please select items to review', 'warning');
            return;
          }
          handleStartReview();
          setViewMode('review');
        }}
        onClearSelection={() => setSelectedItems(new Set())}
        selectedCount={selectedItems.size}
        progress={progressStats}
      />

      <main className="container mx-auto px-4 py-8">
        {/* Your browse/selection UI here */}
        {/* Must include checkboxes for selection */}
      </main>
    </div>
  );
}
```

### Step 6: Add Achievements

**File**: `/src/lib/review-engine/achievements/your-feature-achievements.ts`

```typescript
import { Achievement } from '../progress/achievement-system';

export const YOUR_FEATURE_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'your_feature_explorer_10',
    name: 'Feature Explorer',
    description: 'Browse 10 unique items',
    icon: '🔍',
    category: 'progress',
    rarity: 'common',
    points: 10,
    criteria: {
      type: 'progressive',
      condition: (stats) => stats.uniqueItemsBrowsed >= 10,
      progressCalculation: (stats) => Math.min(stats.uniqueItemsBrowsed || 0, 10),
      requirement: 10
    }
  },
  // Add more achievements
];
```

### Step 7: Update Learning Village Navigation

**File**: `/src/components/dashboard/LearningVillage.tsx`

Add your feature to the `learningStalls` array:

```typescript
{
  id: 'your-feature',
  title: strings.dashboard?.cards?.yourFeature?.title || 'Your Feature',
  subtitle: strings.dashboard?.cards?.yourFeature?.subtitle || 'Subtitle',
  description: strings.dashboard?.cards?.yourFeature?.description || 'Description',
  href: '/your-feature',
  icon: '📚',
  stallType: 'library',
  color: 'from-purple-400 to-violet-600',
  glow: 'shadow-purple-500/50',
  doshiMood: 'happy' as const,
  progress: 0,
  lanternColor: '#8b5cf6',
  stallImage: getRandomStallImage(),
}
```

---

## ⚠️ Common Pitfalls & Solutions

### Pitfall 1: Import Path Errors

❌ **Wrong**:
```typescript
import { BaseContentAdapter } from './BaseContentAdapter';
```

✅ **Correct**:
```typescript
import { BaseContentAdapter } from './base.adapter';
```

### Pitfall 2: Confusing View Modes with Review Modes

❌ **Wrong**: Adding "browse" as a Review Engine mode
✅ **Correct**: "browse" is a page view mode for selection UI

### Pitfall 3: Not Checking User Authentication

❌ **Wrong**: Assuming user is always logged in
✅ **Correct**: Always check `if (!user)` before API calls

### Pitfall 4: Ignoring Daily Limits

❌ **Wrong**: Letting users add unlimited items
✅ **Correct**: Enforce limits server-side based on subscription tier

### Pitfall 5: Not Tracking for Achievements

❌ **Wrong**: Only focusing on review functionality
✅ **Correct**: Track all user actions (browse, bookmark, add to review) for achievements

### Pitfall 6: Creating New Navigation Instead of Reusing

❌ **Wrong**: Creating a custom navbar for your page
✅ **Correct**: Use `LearningPageNavbar` component

### Pitfall 7: Not Looking at Existing Patterns

❌ **Wrong**: Implementing from scratch
✅ **Correct**: Study `KanaLearningComponent` first - it's the reference implementation

---

## ✅ Testing Checklist

Before considering your integration complete:

- [ ] Can users browse/view content without errors?
- [ ] Can users select multiple items with checkboxes?
- [ ] Does the selection count show in navbar?
- [ ] Can users start study mode with selected items?
- [ ] Can users start review mode with selected items?
- [ ] Does review mode properly use ReviewEngine component?
- [ ] Are daily limits enforced (free vs premium)?
- [ ] Do bookmarks work (if applicable)?
- [ ] Is browse tracking working for achievements?
- [ ] Does "Add to Review Queue" respect daily limits?
- [ ] Does the progress bar in navbar show correct stats?
- [ ] Can users exit review and return to browse mode?
- [ ] Are achievements being tracked and unlocked?
- [ ] Does it work for guest/free/premium users appropriately?
- [ ] Is the feature listed in Learning Village dashboard?

---

## 📚 Quick Reference

### Key Files to Study

1. **Reference Implementation**: `/src/components/learn/KanaLearningComponent.tsx`
2. **Common Navbar**: `/src/components/common/LearningPageNavbar.tsx`
3. **Review Engine Types**: `/src/lib/review-engine/core/interfaces.ts`
4. **Entitlements Config**: `/config/features.v1.json`
5. **Achievement Store**: `/src/stores/achievement-store.ts`

### Key Hooks to Use

- `useAuth()` - Get current user
- `useSubscription()` - Check if premium
- `useToast()` - Show notifications
- `useAchievementStore()` - Track achievements

### API Patterns

All APIs follow this pattern:
```typescript
// Check auth
const session = await getSession();
if (!session?.uid) return 401;

// Check limits
const limits = checkDailyLimits(session.uid);
if (exceeded) return 429;

// Perform action
const result = await performAction();

// Track achievement
await updateAchievements();

// Return response
return NextResponse.json(result);
```

### Database Collections

- `/users/{uid}/usage/{date}` - Daily usage tracking
- `/users/{uid}/review_queue/{itemId}` - Review queue items
- `/users/{uid}/your_feature_bookmarks/{itemId}` - Bookmarks
- `/users/{uid}/your_feature_history/{entryId}` - Browse history
- `/users/{uid}/achievements/data` - Achievement progress

---

## 🎯 Final Tips

1. **Start with the UI flow** - Get browse → select → review working first
2. **Add limits later** - Don't overcomplicate initially
3. **Test with different user tiers** - Guest, free, and premium have different experiences
4. **Use existing components** - Don't reinvent the wheel
5. **Ask yourself**: "How does the hiragana page do this?" - It's your best reference
6. **Check the actual file names** - Don't assume, verify with `ls` or `Glob`
7. **Read error messages carefully** - They often tell you exactly what's wrong
8. **Track everything** - Users love achievements, and it drives engagement

---

## 📞 Need Help?

If you get stuck:
1. Check how `KanaLearningComponent` does it
2. Look for similar patterns in existing code
3. Verify your imports match actual file names
4. Make sure you're not confusing UI modes with Review Engine modes
5. Remember: Browse → Select → Transform → Review → Track

Good luck with your implementation! 🚀