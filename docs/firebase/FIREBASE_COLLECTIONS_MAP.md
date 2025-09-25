# Firebase Collections Map

## Overview
This document provides a comprehensive mapping of all Firebase Firestore collections used in the Moshimoshi application, including their structure, creation points, and associated user interactions.

## Collections

### 1. `achievements`
**Purpose**: Stores user achievement and progression data including streaks, milestones, and daily activities.

**Structure**:
```typescript
{
  lastActivity: Timestamp,
  streak: {
    current: number,
    best: number,
    lastActivityDate: string // ISO date
  },
  dates: {
    [date: string]: boolean // Track activity dates
  },
  totalStudyTime: number,
  totalReviewTime: number,
  lessonsCompleted: number,
  wordsLearned: number,
  charactersLearned: number,
  sentencesPracticed: number
}
```

**Creation/Update Points**:
- `/src/app/api/achievements/update-activity/route.ts:89` - Updates daily activity and streak data
- `/src/app/api/achievements/activities/route.ts:45` - Fetches achievement data
- `/src/stores/achievementStore.ts:234` - Client-side achievement tracking

**User Interactions**:
- Study sessions (Kanji, Hiragana, Katakana)
- Review sessions
- Daily login tracking
- Progress milestones

### 2. `kanji_bookmarks`
**Purpose**: Stores user's bookmarked kanji for quick access and personal study lists.

**Structure**:
```typescript
{
  kanjiId: string,
  character: string,
  meaning: string[],
  reading: {
    kun: string[],
    on: string[]
  },
  jlptLevel: number,
  grade: number,
  bookmarkedAt: Timestamp,
  tags?: string[],
  notes?: string
}
```

**Creation/Update Points**:
- `/src/components/kanji/KanjiCard.tsx:156` - Bookmark toggle action
- `/src/app/api/kanji/bookmarks/route.ts:34` - Add/remove bookmark
- `/src/hooks/useBookmarks.ts:78` - Client-side bookmark management

**User Interactions**:
- Clicking bookmark icon on Kanji cards
- Managing bookmarked items in bookmarks view
- Adding personal notes to bookmarks

### 3. `kanji_browse_history`
**Purpose**: Tracks user's kanji viewing history for recommendations and quick access to recently viewed items.

**Structure**:
```typescript
{
  kanjiId: string,
  character: string,
  viewedAt: Timestamp,
  viewCount: number,
  lastContext?: string, // Where it was viewed from
  studyTime?: number // Time spent on detail view
}
```

**Creation/Update Points**:
- `/src/app/kanji/[id]/page.tsx:89` - When viewing kanji details
- `/src/components/kanji/KanjiDetailView.tsx:145` - Track time spent
- `/src/app/api/kanji/history/route.ts:23` - Record view history

**User Interactions**:
- Viewing kanji detail pages
- Browsing through kanji lists
- Studying kanji in detail view

### 4. `progress`
**Purpose**: Main collection for tracking user's learning progress across all content types.

**Structure**:
```typescript
{
  contentType: 'kanji' | 'hiragana' | 'katakana' | 'vocabulary',
  contentId: string,
  level: 'new' | 'learning' | 'review' | 'mastered',
  correctCount: number,
  incorrectCount: number,
  lastReviewed: Timestamp,
  nextReview: Timestamp,
  easeFactor: number,
  interval: number,
  studySessions: number,
  totalStudyTime: number,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Creation/Update Points**:
- `/src/lib/review-engine/srs/algorithm.ts:156` - SRS calculation and updates
- `/src/app/api/progress/update/route.ts:67` - Progress updates from review sessions
- `/src/stores/progressStore.ts:234` - Client-side progress tracking
- `/src/components/review-engine/ReviewEngine.tsx:345` - Review session completion

**User Interactions**:
- Completing study sessions
- Review session answers (correct/incorrect)
- Adding items to review queue
- Mastering content items

### 5. `review_history`
**Purpose**: Detailed history of all review sessions for analytics and progress tracking.

**Structure**:
```typescript
{
  sessionId: string,
  contentType: string,
  contentId: string,
  question: string,
  userAnswer: string,
  correctAnswer: string,
  isCorrect: boolean,
  responseTime: number, // milliseconds
  difficulty: number,
  timestamp: Timestamp,
  reviewType: 'scheduled' | 'practice' | 'cram',
  hints?: string[],
  attemptCount: number
}
```

**Creation/Update Points**:
- `/src/lib/review-engine/session/manager.ts:412` - Session completion
- `/src/app/api/review/history/route.ts:45` - Save review history
- `/src/components/review-engine/ReviewSession.tsx:289` - Individual review submission

**User Interactions**:
- Answering review questions
- Completing review sessions
- Using hints during reviews
- Practice sessions

### 6. `review_queue`
**Purpose**: Manages items scheduled for review based on SRS algorithm.

**Structure**:
```typescript
{
  contentType: string,
  contentId: string,
  priority: 'high' | 'normal' | 'low',
  scheduledFor: Timestamp,
  addedAt: Timestamp,
  attempts: number,
  lastAttempt?: Timestamp,
  state: 'pending' | 'active' | 'completed' | 'skipped',
  metadata?: {
    difficulty?: number,
    tags?: string[],
    source?: string
  }
}
```

**Creation/Update Points**:
- `/src/lib/review-engine/queue/manager.ts:123` - Queue prioritization
- `/src/app/api/review/queue/add/route.ts:56` - Adding items to queue
- `/src/app/api/review/queue/update/route.ts:78` - Update queue status
- `/src/components/learn/KanjiCard.tsx:234` - Add to review action

**User Interactions**:
- "Add to Review Queue" button
- Automatic scheduling from SRS
- Manual review scheduling
- Bulk adding from selection

### 7. `searched_words`
**Purpose**: Stores vocabulary search history for premium users, enabling cross-device sync and search analytics.

**Structure**:
```typescript
{
  term: string,                    // The word that was searched
  timestamp: Timestamp,            // When the search was performed
  resultCount: number,            // Number of results returned
  searchSource: 'wanikani' | 'jmdict', // Which dictionary was used
  deviceType: 'mobile' | 'tablet' | 'desktop', // Device used for search
  clickedResults?: string[],      // Words clicked from search results
  userId: string,                 // User ID for queries
  syncedAt?: Timestamp           // When synced to Firebase
}
```

**Creation/Update Points**:
- `/src/utils/vocabularyHistoryManager.ts:96` - Saves search when user performs vocabulary search
- `/src/app/api/vocabulary/history/route.ts:112` - API endpoint for saving search history
- `/src/app/learn/vocabulary/page.tsx:95` - Triggers save after successful search

**User Interactions**:
- Searching for Japanese vocabulary
- Clicking on search results (tracked for analytics)
- Clearing search history
- Premium users: Cross-device sync

**Storage Tiers**:
- Guest: No storage
- Free: localStorage only (last 20 searches)
- Premium: localStorage + Firebase (last 50 searches with sync)

### 8. `sessions`
**Purpose**: Stores user session data for analytics and activity tracking.

**Structure**:
```typescript
{
  sessionId: string,
  userId: string,
  startTime: Timestamp,
  endTime?: Timestamp,
  duration?: number, // seconds
  activityType: 'study' | 'review' | 'browse' | 'practice',
  contentType?: string,
  itemsCompleted?: number,
  accuracy?: number, // percentage
  device?: {
    type: string,
    browser: string,
    os: string
  },
  offline?: boolean
}
```

**Creation/Update Points**:
- `/src/middleware.ts:89` - Session initialization
- `/src/app/api/sessions/track/route.ts:34` - Session tracking
- `/src/stores/sessionStore.ts:145` - Client-side session management
- `/src/lib/review-engine/session/tracker.ts:67` - Review session tracking

**User Interactions**:
- App initialization
- Starting study/review sessions
- Session timeout/completion
- Background activity tracking

### 8. `usage`
**Purpose**: Tracks detailed usage metrics for analytics and premium feature limits.

**Structure**:
```typescript
{
  date: string, // YYYY-MM-DD
  userId: string,
  metrics: {
    ttsUsage: number,
    apiCalls: number,
    storageUsed: number, // bytes
    reviewsCompleted: number,
    studyTime: number, // minutes
    itemsAdded: number,
    offlineSyncs: number
  },
  limits: {
    ttsDaily: number,
    apiDaily: number,
    storageMax: number,
    reviewQueueMax: number
  },
  premiumFeatures?: {
    unlimitedTTS: boolean,
    advancedAnalytics: boolean,
    prioritySync: boolean
  }
}
```

**Creation/Update Points**:
- `/src/app/api/usage/track/route.ts:45` - Usage tracking endpoint
- `/src/app/api/tts/generate/route.ts:89` - TTS usage tracking
- `/src/stores/usageStore.ts:123` - Client-side usage monitoring
- `/src/middleware/rateLimiter.ts:56` - API rate limiting

**User Interactions**:
- TTS audio generation
- API calls (search, filters)
- Adding items to queue (daily limits)
- Premium feature usage
- Storage operations

## Collection Relationships

### Primary Keys
- `achievements`: userId (document ID)
- `kanji_bookmarks`: userId_kanjiId composite
- `kanji_browse_history`: userId_timestamp composite
- `progress`: userId_contentType_contentId composite
- `review_history`: Auto-generated ID
- `review_queue`: userId_contentId composite
- `sessions`: sessionId
- `usage`: userId_date composite

### Indexes
```
// Composite indexes for efficient queries
achievements: userId + lastActivity
progress: userId + contentType + level
review_queue: userId + scheduledFor + state
review_history: userId + timestamp + contentType
sessions: userId + startTime + activityType
```

## Data Flow

1. **Study Flow**:
   - User browses content → `kanji_browse_history`
   - User bookmarks item → `kanji_bookmarks`
   - User studies item → `progress` + `sessions`
   - Daily activity → `achievements` + `usage`

2. **Review Flow**:
   - Items scheduled → `review_queue`
   - Review completed → `review_history` + `progress`
   - Session tracked → `sessions`
   - Achievements updated → `achievements`

3. **Analytics Flow**:
   - All activities → `usage`
   - Session data → `sessions`
   - Progress metrics → `progress` + `achievements`

## Security Rules

All collections follow these patterns:
- Read: Authenticated users can only read their own data
- Write: Authenticated users can only write to their own documents
- Admin: Full read/write access via Admin SDK
- Validation: Server-side validation for all writes

## Backup Strategy

- Daily automated backups via Firebase Admin
- Weekly exports to GCS buckets
- Point-in-time recovery enabled
- 30-day retention policy

## Performance Considerations

- Denormalized data for read performance
- Batch writes for bulk operations
- Offline persistence for critical collections
- Incremental sync for large datasets

---

*Last Updated: 2025-01-18*
*Note: This document is automatically synced with NotebookLM*