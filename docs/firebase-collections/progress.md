# Progress Feature - Firebase Collections

## Overview
Tracks user progress across different content types (drill, kana, kanji, etc.) with detailed statistics and learning metrics.

## Collections

### `users/{userId}/progress`

**Description:** Subcollection storing progress data for various content types.

**Access:**
- ✅ All authenticated users
- 📍 Location: Subcollection under user document
- 🔄 Synced from: Client-side progress tracking

**Document Structure:**

```typescript
{
  // Identifiers
  userId: string                    // User ID
  contentId: string                 // Unique content identifier
  contentType: 'drill' | 'overall' | 'kana' | 'kanji' | 'vocabulary'

  // Basic Stats
  reviewCount: number | null        // Total reviews
  correctCount: number | null       // Correct answers
  accuracy: number | null           // Accuracy percentage
  averageAccuracy: number | null    // Average accuracy over time

  // Drill-specific
  totalDrills: number | null        // Total drill sessions
  verbsStudied: string[]            // Array of studied verbs
  adjectivesStudied: string[]       // Array of studied adjectives
  conjugationTypes: {               // Conjugation type tracking
    [type: string]: number          // e.g., "taiForm": 1
  }

  // Progress tracking
  status: 'not-started' | 'in-progress' | 'completed'
  streak: number                    // Current streak
  bestStreak: number               // Best streak achieved
  interactionCount: number         // Total interactions
  viewCount: number                // Total views

  // Metadata
  lastReviewedAt: string           // ISO timestamp
  lastUpdated: Timestamp           // Server timestamp
  createdAt: string                // ISO timestamp

  // Flags
  bookmarked: boolean
  pinned: boolean
  flaggedForReview: boolean
}
```

**Example Documents:**

**Overall Progress:**
```json
{
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "contentId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "contentType": "overall",
  "reviewCount": 45,
  "correctCount": 38,
  "accuracy": 84.4,
  "averageAccuracy": 82.1,
  "totalDrills": 12,
  "verbsStudied": ["食べる", "飲む", "行く"],
  "adjectivesStudied": ["大きい", "小さい"],
  "conjugationTypes": {
    "taiForm": 5,
    "causative": 3,
    "pastNegative": 4
  },
  "lastReviewedAt": "2025-10-03T13:52:11.412Z",
  "lastUpdated": "2025-10-03T13:52:12.396Z"
}
```

**Drill Session Progress:**
```json
{
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "contentId": "drill_8onZzlQg3tQxkw8pinSF9ow4Q6j2_1759499278931",
  "contentType": "drill",
  "status": "not-started",
  "correctCount": 0,
  "accuracy": 0,
  "streak": 0,
  "bestStreak": 0,
  "viewCount": 0,
  "interactionCount": 0,
  "bookmarked": false,
  "pinned": false,
  "flaggedForReview": false,
  "createdAt": "2025-10-03T13:48:48.752Z",
  "lastUpdated": "2025-10-03T13:48:49.757Z"
}
```

**Firestore Path Examples:**
```
users/8onZzlQg3tQxkw8pinSF9ow4Q6j2/progress/8onZzlQg3tQxkw8pinSF9ow4Q6j2
users/8onZzlQg3tQxkw8pinSF9ow4Q6j2/progress/drill_xxx_timestamp
```

## Related Manager Classes

**File:** `/src/lib/review-engine/progress/DrillProgressManager.ts`
- Manages drill-specific progress tracking
- Handles verb/adjective study tracking
- Tracks conjugation type mastery

**File:** `/src/lib/review-engine/progress/UniversalProgressManager.ts`
- Universal progress tracking across all content types
- Manages review statistics
- Handles progress persistence

## API Endpoints

### Progress tracking is handled via:
- Universal Review Engine session events
- Drill completion handlers
- Review session managers

## Queries & Indexes

### Required Indexes
```
Collection: users/{userId}/progress
- contentType (asc), lastUpdated (desc)
- status (asc), lastReviewedAt (desc)
```

### Query Examples

**Get overall progress:**
```javascript
const progressRef = db
  .collection('users')
  .doc(userId)
  .collection('progress')
  .doc(userId)
```

**Get all drill progress:**
```javascript
const drillProgress = await db
  .collection('users')
  .doc(userId)
  .collection('progress')
  .where('contentType', '==', 'drill')
  .orderBy('lastUpdated', 'desc')
  .get()
```

## Related Files

- Progress Managers:
  - `/src/lib/review-engine/progress/DrillProgressManager.ts`
  - `/src/lib/review-engine/progress/UniversalProgressManager.ts`
- API Routes:
  - `/src/app/api/drill/session/route.ts`
  - `/src/app/api/review/progress/route.ts`

## Storage Strategy

1. **IndexedDB (Client-side)**
   - Primary storage for all users
   - Real-time updates during sessions
   - Offline support

2. **Firebase (Cloud)**
   - Synced for authenticated users
   - Premium users get priority sync
   - Acts as backup and cross-device sync

## Notes

- Progress is tracked at both individual item and overall level
- Drill progress includes detailed conjugation type tracking
- Overall progress aggregates all learning activities
- Flagged items are prioritized in review queues
- Bookmarked items can be accessed quickly
