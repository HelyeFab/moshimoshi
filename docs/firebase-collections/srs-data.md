# SRS Data - Firebase Collections

## Overview
Stores Spaced Repetition System (SRS) data for individual learning items using the SM-2 algorithm.

## Collections

### `users/{userId}/srs_data`

**Description:** Per-item SRS progression tracking for spaced repetition learning.

**Access:**
- ✅ All authenticated users
- 📍 Location: Subcollection under user document
- 🔄 Synced from: Review engine SRS calculations

**Document Structure:**

```typescript
{
  // Item identification
  itemId: string                    // Unique item identifier
  contentType: 'kana' | 'kanji' | 'vocabulary' | 'grammar'
  character: string                 // The character/word itself
  romaji?: string                   // Romanization (for kana)

  // SRS Algorithm (SM-2)
  easeFactor: number                // Ease factor (1.3 - 2.5)
  interval: number                  // Current interval in days
  repetitions: number               // Successful repetition count

  // Learning status
  status: 'new' | 'learning' | 'review' | 'mastered' | 'relearning'

  // Review tracking
  reviewCount: number               // Total reviews
  correctCount: number              // Correct reviews
  streak: number                    // Current correct streak
  bestStreak: number                // Best streak achieved

  // Scheduling
  lastReviewedAt: string            // ISO timestamp of last review
  nextReviewAt: string              // ISO timestamp of next review

  // Metadata
  updatedAt: Timestamp              // Last update timestamp
  createdAt?: string                // When first created
}
```

**Example Documents:**

**New Item:**
```json
{
  "itemId": "a",
  "contentType": "kana",
  "character": "ア",
  "romaji": "a",
  "easeFactor": 2.5,
  "interval": 0.0035,
  "repetitions": 0,
  "status": "new",
  "reviewCount": 1,
  "correctCount": 0,
  "streak": 0,
  "bestStreak": 0,
  "lastReviewedAt": "2025-10-02T19:29:38.621Z",
  "nextReviewAt": "2025-10-02T19:34:41.020Z",
  "updatedAt": "2025-10-02T19:29:38.724Z"
}
```

**Learning Item:**
```json
{
  "itemId": "i",
  "contentType": "kana",
  "character": "イ",
  "romaji": "i",
  "easeFactor": 2.5,
  "interval": 0.0069,
  "repetitions": 1,
  "status": "learning",
  "reviewCount": 1,
  "correctCount": 1,
  "streak": 1,
  "bestStreak": 1,
  "lastReviewedAt": "2025-10-02T19:29:35.509Z",
  "nextReviewAt": "2025-10-02T19:39:31.669Z",
  "updatedAt": "2025-10-02T19:29:35.616Z"
}
```

**Mastered Item:**
```json
{
  "itemId": "u",
  "contentType": "kana",
  "character": "う",
  "romaji": "u",
  "easeFactor": 2.6,
  "interval": 21,
  "repetitions": 8,
  "status": "mastered",
  "reviewCount": 12,
  "correctCount": 10,
  "streak": 5,
  "bestStreak": 7,
  "lastReviewedAt": "2025-09-12T14:30:00.000Z",
  "nextReviewAt": "2025-10-03T14:30:00.000Z",
  "updatedAt": "2025-09-12T14:30:01.234Z"
}
```

**Firestore Path Example:**
```
users/8onZzlQg3tQxkw8pinSF9ow4Q6j2/srs_data/a
users/8onZzlQg3tQxkw8pinSF9ow4Q6j2/srs_data/i
```

## SRS Status States

| Status | Description | Interval Range | Ease Factor |
|--------|-------------|----------------|-------------|
| `new` | Never reviewed | 0 days | 2.5 (default) |
| `learning` | Initial learning phase | < 1 day | 2.5 |
| `review` | Regular review | 1-21 days | 1.3-2.5 |
| `mastered` | Well learned | 21+ days | Usually > 2.5 |
| `relearning` | Failed review, relearning | < 1 day | Reduced |

## SM-2 Algorithm Configuration

```typescript
const SRS_CONFIG = {
  // Initial settings
  initialEaseFactor: 2.5,
  minEaseFactor: 1.3,
  maxEaseFactor: 2.5,

  // Learning steps (in days)
  learningSteps: [0.0069, 0.0208], // 10min, 30min

  // Intervals
  graduatingInterval: 1,  // 1 day
  maxInterval: 365,       // 1 year

  // Failure threshold
  leechThreshold: 8       // Failed 8 times
}
```

## Interval Calculation

**On Correct Answer:**
```typescript
newInterval = previousInterval * easeFactor
easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
repetitions = repetitions + 1
```

**On Incorrect Answer:**
```typescript
repetitions = 0
interval = learningSteps[0]  // Reset to first learning step
easeFactor = max(1.3, easeFactor - 0.2)
status = 'relearning'
```

## Queries & Indexes

### Required Indexes
```
Collection: users/{userId}/srs_data
- nextReviewAt (asc), status (asc)
- status (asc), nextReviewAt (asc)
- contentType (asc), status (asc)
- lastReviewedAt (desc)
```

### Query Examples

**Due items:**
```javascript
const now = new Date().toISOString();
const dueItems = await db
  .collection('users')
  .doc(userId)
  .collection('srs_data')
  .where('nextReviewAt', '<=', now)
  .where('status', 'in', ['learning', 'review'])
  .orderBy('nextReviewAt', 'asc')
  .limit(20)
  .get();
```

**Mastered items:**
```javascript
const masteredKana = await db
  .collection('users')
  .doc(userId)
  .collection('srs_data')
  .where('contentType', '==', 'kana')
  .where('status', '==', 'mastered')
  .get();
```

**Items needing attention (low ease factor):**
```javascript
const difficultItems = await db
  .collection('users')
  .doc(userId)
  .collection('srs_data')
  .where('easeFactor', '<', 1.8)
  .orderBy('easeFactor', 'asc')
  .limit(10)
  .get();
```

**Review streak:**
```javascript
const streakItems = await db
  .collection('users')
  .doc(userId)
  .collection('srs_data')
  .orderBy('streak', 'desc')
  .limit(5)
  .get();
```

## Related Collections

- **review_history**: Individual review events
- **review_sessions**: Complete session data
- **progress**: Aggregated progress metrics

## Related Files

- SRS Algorithm: `/src/lib/review-engine/srs/algorithm.ts`
- SRS Manager: `/src/lib/review-engine/srs/state-manager.ts`
- Difficulty Logic: `/src/lib/review-engine/srs/difficulty.ts`
- Config: `/src/lib/review-engine/srs/configs/`
- API Routes: `/src/app/api/review/scheduled/route.ts`

## Update Process

1. **Review Completed** → Calculate new SRS values
2. **Update Document** → Write new interval, ease factor, status
3. **Schedule Next Review** → Set nextReviewAt timestamp
4. **Emit Event** → Trigger analytics/gamification

## Performance Optimizations

- **Indexing**: Queries on nextReviewAt and status for fast due item retrieval
- **Batching**: Update multiple items in batch operations
- **Caching**: Local IndexedDB cache for offline support
- **Selective Sync**: Only sync changed items to Firebase

## Mastery Criteria

Item is considered "mastered" when:
- Interval ≥ 21 days
- Ease factor ≥ 2.3
- Accuracy ≥ 90%
- Consecutive correct reviews ≥ 5

## Leech Detection

Item is flagged as "leech" when:
- Failed reviews ≥ 8 times
- Ease factor ≤ 1.3
- Unable to reach learning status

Leeches require:
- Additional study
- Mnemonics
- Different learning approach

## Data Export Format

```json
{
  "itemId": "a",
  "character": "ア",
  "status": "learning",
  "nextReview": "2025-10-03T14:30:00Z",
  "interval": "10 minutes",
  "easeFactor": 2.5,
  "accuracy": "83%"
}
```

## Privacy & Retention

- Private to user only
- Retained indefinitely (core learning data)
- Exported in user data download
- Can be reset on user request
- Not shared with other users
