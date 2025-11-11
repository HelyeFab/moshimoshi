# Review History - Firebase Collections

## Overview
Records individual review events for analytics and progress tracking across all content types.

## Collections

### `users/{userId}/review_history`

**Description:** Event log of all review interactions for analytics and progress tracking.

**Access:**
- ✅ All authenticated users
- 📍 Location: Subcollection under user document
- 🔄 Synced from: Review engine session events

**Document Structure:**

```typescript
{
  // Identifiers
  userId: string                    // User ID
  contentType: 'hiragana' | 'katakana' | 'kanji' | 'vocabulary' | 'drill'
  contentId: string                 // ID of the content item
  content: string                   // The actual content (e.g., "あ", "食べる")
  sessionId: string                 // Associated session ID

  // Event details
  event: 'viewed' | 'completed' | 'skipped' | 'incorrect' | 'correct'
  timestamp: string                 // ISO timestamp
  createdAt: Timestamp              // Server timestamp

  // Answer tracking
  correct?: boolean                 // Whether answer was correct (for completed events)

  // User context
  isPremium: boolean                // User's premium status at time of event
  deviceType: 'mobile' | 'tablet' | 'desktop'
  appVersion: string                // App version (e.g., "1.0.0")
}
```

**Example Documents:**

**Completed Event:**
```json
{
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "contentType": "hiragana",
  "contentId": "u",
  "content": "う",
  "sessionId": "session_1759433216769_98b3j0awa",
  "event": "completed",
  "correct": true,
  "timestamp": "2025-10-02T19:27:04.493Z",
  "createdAt": "2025-10-02T19:27:05.782Z",
  "isPremium": true,
  "deviceType": "desktop",
  "appVersion": "1.0.0"
}
```

**Viewed Event:**
```json
{
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "contentType": "hiragana",
  "contentId": "i",
  "content": "い",
  "sessionId": "session_1759419332167_v0wyb37g3",
  "event": "viewed",
  "timestamp": "2025-10-02T15:35:38.819Z",
  "createdAt": "2025-10-02T15:35:39.652Z",
  "isPremium": true,
  "deviceType": "desktop",
  "appVersion": "1.0.0"
}
```

**Firestore Path Example:**
```
users/8onZzlQg3tQxkw8pinSF9ow4Q6j2/review_history/{auto-id}
```

## Event Types

| Event | Description | When Triggered |
|-------|-------------|----------------|
| `viewed` | Content was displayed | When item is shown in review |
| `completed` | Answer was submitted | After user submits answer |
| `correct` | Correct answer | When answer matches expected |
| `incorrect` | Wrong answer | When answer doesn't match |
| `skipped` | User skipped item | When user skips review item |

## Usage

### Analytics Queries

**Daily review activity:**
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);

const activity = await db
  .collection('users')
  .doc(userId)
  .collection('review_history')
  .where('timestamp', '>=', today.toISOString())
  .orderBy('timestamp', 'desc')
  .get();
```

**Accuracy by content type:**
```javascript
const hiraganaReviews = await db
  .collection('users')
  .doc(userId)
  .collection('review_history')
  .where('contentType', '==', 'hiragana')
  .where('event', '==', 'completed')
  .get();

const correct = hiraganaReviews.docs.filter(d => d.data().correct).length;
const accuracy = (correct / hiraganaReviews.size) * 100;
```

**Session performance:**
```javascript
const sessionEvents = await db
  .collection('users')
  .doc(userId)
  .collection('review_history')
  .where('sessionId', '==', sessionId)
  .orderBy('timestamp', 'asc')
  .get();
```

## Queries & Indexes

### Required Indexes
```
Collection: users/{userId}/review_history
- contentType (asc), timestamp (desc)
- sessionId (asc), timestamp (asc)
- event (asc), timestamp (desc)
- timestamp (desc)
```

## Related Collections

- **review_sessions**: Full session data
- **study_sessions**: Study mode sessions
- **srs_data**: SRS progression tracking
- **progress**: Aggregated progress metrics

## Related Files

- Event Emission: `/src/lib/review-engine/core/events.ts`
- Session Manager: `/src/lib/review-engine/session/manager.ts`
- Review Engine: `/src/components/review-engine/ReviewEngine.tsx`
- API Routes: `/src/app/api/review/activity/route.ts`

## Data Retention

- Events are kept indefinitely for premium users
- Free users: Last 30 days of events
- Used for analytics, progress graphs, and insights
- Can be used to replay/reconstruct sessions

## Privacy Notes

- Events are user-specific and private
- Only accessible by the user and admins
- No personally identifiable content beyond userId
- Device type and app version for debugging only

## Integration with Other Systems

1. **Gamification System**
   - Events trigger XP awards
   - Streak calculations based on daily events
   - Achievement unlocks

2. **SRS System**
   - Correct/incorrect events update SRS data
   - Next review intervals calculated from events
   - Difficulty adjustments

3. **Analytics Dashboard**
   - Progress charts
   - Activity heatmaps
   - Performance insights
