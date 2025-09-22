# Firebase Collections Map

## Overview
This document provides a comprehensive mapping of all Firebase Firestore collections used in the Moshimoshi application, detailing their purpose, structure, creation points, and user interactions that trigger them.

## Collection Structure

```
users/
├── {userId}/
│   ├── achievements/
│   │   ├── data (document)
│   │   └── activities (document)
│   ├── kanji_bookmarks/
│   │   └── {kanjiId} (documents)
│   ├── kanji_browse_history/
│   │   └── {historyId} (documents)
│   ├── progress/
│   │   └── {contentId} (documents)
│   ├── review_history/
│   │   └── {sessionId} (documents)
│   ├── review_queue/
│   │   └── {itemId} (documents)
│   ├── statistics/
│   │   └── overall (document)
│   └── usage/
│       └── {date} (documents)
```

## Detailed Collection Documentation

### 1. **achievements** Collection

#### Purpose
Manages user gamification, achievements, and streak tracking.

#### Structure
```typescript
// Sub-document: data
{
  unlocked: string[]           // Achievement IDs that have been unlocked
  totalPoints: number          // Total achievement points earned
  totalXp: number              // Total experience points
  currentLevel: string         // Current user level
  lessonsCompleted: number     // Number of lessons completed
  lastUpdated: Timestamp       // Last update timestamp
  statistics: {
    percentageComplete: number // Percentage of achievements unlocked
    byCategory: Record<string, number> // Achievements by category
  }
}

// Sub-document: activities
{
  dates: Record<string, boolean>  // Daily activity tracking {"2025-01-18": true}
  currentStreak: number            // Current consecutive days streak
  bestStreak: number               // Best streak achieved
  lastActivity: number             // Timestamp of last activity
  lastUpdated: Timestamp           // Server timestamp
}
```

#### Created/Updated By
- **API Routes:**
  - `/api/achievements/data/route.ts` - GET/POST achievement data
  - `/api/achievements/activities/route.ts` - GET/POST activity data
  - `/api/achievements/update-activity/route.ts` - POST activity updates

#### User Interactions
- Completing any learning session (study or review)
- Unlocking achievements
- Daily login/activity
- Progress milestones

#### Access Level
- Premium users: Full Firebase sync
- Free users: LocalStorage only

---

### 2. **kanji_bookmarks** Collection

#### Purpose
Stores user's bookmarked kanji for quick access and personalized learning.

#### Structure
```typescript
{
  kanjiId: string           // Unique kanji identifier
  character: string         // The kanji character
  bookmarkedAt: Timestamp   // When bookmarked
  tags?: string[]           // Optional user tags
  notes?: string            // Optional user notes
}
```

#### Created/Updated By
- **API Routes:**
  - `/api/kanji/bookmarks/route.ts` - GET/POST/DELETE bookmarks
  - `/api/kanji/browse/route.ts` - Checks bookmark status

#### User Interactions
- Clicking bookmark button on kanji cards
- Viewing bookmarked kanji list
- Managing bookmarks in Kanji Browser

#### Access Level
- All authenticated users

---

### 3. **kanji_browse_history** Collection

#### Purpose
Tracks kanji browsing history for analytics and personalized recommendations.

#### Structure
```typescript
{
  kanjiId: string           // Kanji that was viewed
  character: string         // The kanji character
  viewedAt: Timestamp       // When viewed
  duration?: number         // Time spent viewing (ms)
  source: string            // Where viewed from (browse/search/review)
}
```

#### Created/Updated By
- **API Routes:**
  - `/api/kanji/browse/route.ts` (line 161) - Records browse events

#### User Interactions
- Viewing kanji details
- Browsing kanji lists
- Searching for kanji

#### Access Level
- Premium users only (for analytics)

---

### 4. **progress** Collection

#### Purpose
Tracks detailed learning progress for each content item (kanji, vocabulary, etc.).

#### Structure
```typescript
{
  contentId: string         // Unique content identifier
  contentType: string       // Type (kanji/hiragana/katakana/vocabulary)
  learned: number           // Learning percentage (0-100)
  reviewCount: number       // Total times reviewed
  correctCount: number      // Correct answers
  incorrectCount: number    // Incorrect answers
  lastReviewed: number      // Last review timestamp
  nextReview?: number       // Next scheduled review
  srsLevel?: number         // Spaced repetition level
  streak?: number           // Item-specific streak
}
```

#### Created/Updated By
- **API Routes:**
  - `/api/progress/track/route.ts` - Main progress tracking
  - `/api/kanji/browse/route.ts` - Updates when browsing
  - `/api/kanji/add-to-review/route.ts` - Updates when adding to queue

#### User Interactions
- Completing reviews
- Studying new items
- Practice sessions
- Quiz completions

#### Access Level
- All authenticated users

---

### 5. **review_history** Collection

#### Purpose
Maintains historical record of all review sessions for analytics and progress tracking.

#### Structure
```typescript
{
  sessionId: string         // Unique session identifier
  sessionType: string       // Type of session (review/study/practice)
  startedAt: Timestamp      // Session start time
  completedAt: Timestamp    // Session completion time
  itemsReviewed: number     // Number of items reviewed
  correctAnswers: number    // Correct responses
  incorrectAnswers: number  // Incorrect responses
  accuracy: number          // Accuracy percentage
  items: Array<{            // Detailed item results
    contentId: string
    correct: boolean
    responseTime: number
  }>
}
```

#### Created/Updated By
- **API Routes:**
  - `/api/progress/track/route.ts` (line 69) - Records session history

#### User Interactions
- Completing review sessions
- Finishing study sessions
- Practice mode completion

#### Access Level
- Premium users: Full history
- Free users: Limited history (last 7 days)

---

### 6. **review_queue** Collection

#### Purpose
Manages items scheduled for review using spaced repetition algorithm.

#### Structure
```typescript
{
  itemId: string            // Unique item identifier
  contentId: string         // Content being reviewed
  contentType: string       // Type of content
  addedAt: Timestamp        // When added to queue
  nextReview: Timestamp     // Scheduled review time
  priority: number          // Review priority (1-10)
  srsData: {                // Spaced repetition data
    level: number
    easeFactor: number
    interval: number
  }
}
```

#### Created/Updated By
- **API Routes:**
  - `/api/kanji/add-to-review/route.ts` (line 75) - Adds items to queue

#### User Interactions
- Adding kanji to review queue
- Auto-scheduling from SRS algorithm
- Manual queue management

#### Access Level
- All authenticated users

---

### 7. **statistics** Collection

#### Purpose
Aggregated statistics for user dashboard and progress overview.

#### Structure
```typescript
// Sub-document: overall
{
  lastSessionType: string           // Type of last session
  lastSessionDate: Timestamp        // Last session timestamp
  totalSessions: number             // Total sessions completed
  totalItemsReviewed: number        // Total items reviewed
  lastAccuracy: number              // Last session accuracy
  totalStudyTime: number            // Total time spent (ms)
  averageAccuracy: number           // Overall average accuracy
  lastUpdated: Timestamp            // Last update
}
```

#### Created/Updated By
- **API Routes:**
  - `/api/achievements/update-activity/route.ts` (line 88) - Updates stats

#### User Interactions
- Any learning activity
- Session completions
- Progress updates

#### Access Level
- All authenticated users

---

### 8. **usage** Collection

#### Purpose
Tracks feature usage for rate limiting, quotas, and analytics.

#### Structure
```typescript
{
  date: string              // Date (YYYY-MM-DD)
  feature: string           // Feature name
  count: number             // Usage count
  operations: Array<{       // Detailed operations
    timestamp: Timestamp
    operation: string
    metadata?: any
  }>
}
```

#### Created/Updated By
- **System Components:**
  - `/lib/entitlements/firestore-helpers.ts` - Entitlement tracking
  - `/lib/firebase/admin.ts` - Admin operations
  - `/api/kanji/add-to-review/route.ts` - Review additions

#### User Interactions
- API calls
- Feature access
- Resource-intensive operations
- Premium feature usage

#### Access Level
- System-level tracking (automatic)

---

## Collection Creation Triggers

### On User Registration
- No collections created initially (lazy creation on first use)

### On First Activity
- `achievements/activities` - First login/activity
- `progress` - First learning item
- `statistics/overall` - First session

### During Learning Sessions
1. **Study Mode:**
   - Updates `progress`
   - Updates `achievements/activities`
   - Updates `statistics/overall`

2. **Review Mode:**
   - Creates `review_history` entry
   - Updates `progress`
   - Updates `achievements`
   - Modifies `review_queue`

3. **Kanji Browser:**
   - Creates `kanji_browse_history` (premium)
   - Updates `kanji_bookmarks`
   - Updates `progress`

### Premium vs Free Users

| Collection | Premium Users | Free Users |
|------------|--------------|------------|
| achievements | Firebase + LocalStorage | LocalStorage only |
| kanji_bookmarks | Firebase | LocalStorage |
| kanji_browse_history | Firebase | Not tracked |
| progress | Firebase | LocalStorage |
| review_history | Full history | 7-day history |
| review_queue | Firebase | LocalStorage |
| statistics | Firebase | LocalStorage |
| usage | Tracked | Limited tracking |

## Data Retention Policies

- **review_history**: 90 days for free users, unlimited for premium
- **kanji_browse_history**: 30 days rolling window
- **usage**: 30 days for detailed logs, aggregated monthly stats kept
- **All others**: Persistent until account deletion

## Migration and Cleanup

### Data Migration Scripts
- `/scripts/fix-streak-data-corruption.js` - Fixes corrupted streak data
- `/scripts/fix-nested-streak-data.js` - Fixes nested data structures

### Cleanup Operations
- Handled by GDPR compliance module: `/lib/security/gdpr-compliance.ts`
- User data export: `/api/user/export-data/route.ts`
- Account deletion: `/api/user/delete-account/route.ts`

## Security Rules
All collections follow the security rule pattern:
- Users can only read/write their own data
- Service account has full access for backend operations
- Rate limiting applied via usage collection

## Performance Considerations

1. **Indexing**: Collections are indexed on commonly queried fields
2. **Pagination**: Large collections use cursor-based pagination
3. **Caching**: Redis caching layer for frequently accessed data
4. **Batch Operations**: Bulk writes use batch operations for efficiency

## Related Documentation
- [Firebase Architecture](./firebase/FIREBASE_ARCHITECTURE.md)
- [Achievement System Guide](./achievements/ACHIEVEMENT_SYSTEM_GUIDE.md)
- [Review Engine Integration](./REVIEW_ENGINE_INTEGRATION_HANDBOOK.md)
- [Storage Architecture](./storage/UNIFIED_STORAGE_ARCHITECTURE.md)