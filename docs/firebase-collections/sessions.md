# Sessions - Firebase Collections

## Overview
Stores complete session data for review and study modes, including character/item performance and SRS data.

## Collections

### `users/{userId}/review_sessions`

**Description:** Complete review session data with per-item performance tracking.

**Access:**
- ✅ All authenticated users
- 📍 Location: Subcollection under user document
- 🔄 Synced from: Review engine session completion

**Document Structure:**

```typescript
{
  // Session identifiers
  userId: string                    // User ID
  sessionId: string                 // Unique session identifier
  sessionType: 'review'             // Session type
  script: 'hiragana' | 'katakana'   // Script being reviewed

  // Character performance
  characters: Array<{
    id: string                      // Character ID (e.g., "katakana-u")
    character: string               // The character (e.g., "ウ")
    romaji: string                  // Romanization (e.g., "u")
    correct: boolean                // Whether answered correctly
    attempts: number                // Number of attempts
    responseTime: number | null     // Response time in ms
    srsData: object | null          // SRS data at time of review
    nextReviewAt: string | null     // Next scheduled review
  }>

  // Session metadata
  startedAt: Timestamp              // When session started
  completedAt: Timestamp            // When session completed
  duration: number                  // Total duration in ms

  // Performance summary
  totalCharacters: number           // Total characters in session
  correctCount: number              // Number correct
  accuracy: number                  // Accuracy percentage
}
```

**Example Document:**
```json
{
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "sessionId": "review_1759433407872_u7sec0cay",
  "sessionType": "review",
  "script": "katakana",
  "characters": [
    {
      "id": "katakana-u",
      "character": "ウ",
      "romaji": "u",
      "correct": false,
      "attempts": 1,
      "responseTime": null,
      "srsData": null,
      "nextReviewAt": null
    },
    {
      "id": "katakana-i",
      "character": "イ",
      "romaji": "i",
      "correct": false,
      "attempts": 1,
      "responseTime": 2340,
      "srsData": {
        "interval": 0.0069,
        "easeFactor": 2.5,
        "repetitions": 1
      },
      "nextReviewAt": "2025-10-02T19:39:31.669Z"
    }
  ]
}
```

**Firestore Path Example:**
```
users/8onZzlQg3tQxkw8pinSF9ow4Q6j2/review_sessions/review_1759433407872_u7sec0cay
```

---

### `users/{userId}/study_sessions`

**Description:** Study mode session data for initial learning.

**Access:**
- ✅ All authenticated users
- 📍 Location: Subcollection under user document
- 🔄 Synced from: Study mode completion

**Document Structure:**

```typescript
{
  // Session identifiers
  userId: string                    // User ID
  sessionId: string                 // Unique session identifier
  sessionType: 'study'              // Session type
  script: 'hiragana' | 'katakana'   // Script being studied

  // Character performance
  characters: Array<{
    id: string                      // Character ID
    character: string               // The character
    romaji: string                  // Romanization
    correct: boolean                // Whether answered correctly
    attempts: number                // Number of attempts
    responseTime: number | null     // Response time in ms
    srsData: object | null          // SRS data snapshot
    nextReviewAt: string | null     // Next scheduled review
  }>

  // Session metadata
  startedAt: Timestamp              // When session started
  completedAt: Timestamp            // When session completed
  duration: number                  // Total duration in ms

  // Study-specific
  newCharactersLearned: number      // Count of new characters
  reviewedCharacters: number        // Count of reviewed characters
}
```

**Example Document:**
```json
{
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "sessionId": "session_1759417244699_bwixwy9u2",
  "sessionType": "study",
  "script": "hiragana",
  "characters": [
    {
      "id": "あ",
      "character": "あ",
      "romaji": "a",
      "correct": true,
      "attempts": 1,
      "responseTime": null,
      "srsData": null,
      "nextReviewAt": null
    },
    {
      "id": "ご",
      "character": "ご",
      "romaji": "go",
      "correct": true,
      "attempts": 1,
      "responseTime": 1850,
      "srsData": {
        "interval": 0.0035,
        "easeFactor": 2.5,
        "repetitions": 0
      },
      "nextReviewAt": "2025-10-02T15:18:50.000Z"
    }
  ],
  "newCharactersLearned": 5,
  "reviewedCharacters": 2
}
```

**Firestore Path Example:**
```
users/8onZzlQg3tQxkw8pinSF9ow4Q6j2/study_sessions/session_1759417244699_bwixwy9u2
```

---

## Session ID Format

Session IDs follow this pattern:
```
{type}_{timestamp}_{random}
```

Examples:
- `session_1759417244699_bwixwy9u2` (study session)
- `review_1759433407872_u7sec0cay` (review session)
- `drill_1759498970181_abc123` (drill session)

## Queries & Indexes

### Required Indexes
```
Collection: users/{userId}/review_sessions
- script (asc), completedAt (desc)
- sessionType (asc), completedAt (desc)

Collection: users/{userId}/study_sessions
- script (asc), completedAt (desc)
- newCharactersLearned (desc), completedAt (desc)
```

### Query Examples

**Recent review sessions:**
```javascript
const recentReviews = await db
  .collection('users')
  .doc(userId)
  .collection('review_sessions')
  .orderBy('completedAt', 'desc')
  .limit(10)
  .get();
```

**Hiragana study sessions:**
```javascript
const hiraganaStudy = await db
  .collection('users')
  .doc(userId)
  .collection('study_sessions')
  .where('script', '==', 'hiragana')
  .orderBy('completedAt', 'desc')
  .get();
```

**Session analysis:**
```javascript
const session = await db
  .collection('users')
  .doc(userId)
  .collection('review_sessions')
  .doc(sessionId)
  .get();

const data = session.data();
const accuracy = data.characters.filter(c => c.correct).length / data.characters.length * 100;
const avgResponseTime = data.characters
  .filter(c => c.responseTime)
  .reduce((sum, c) => sum + c.responseTime, 0) / data.characters.length;
```

## Related Collections

- **review_history**: Individual events from sessions
- **srs_data**: SRS progression for each character
- **progress**: Aggregated progress metrics

## Related Files

- Session Manager: `/src/lib/review-engine/session/manager.ts`
- Review Engine: `/src/components/review-engine/ReviewEngine.tsx`
- Kana Learning: `/src/components/learn/KanaLearningComponent.tsx`
- API Routes:
  - `/src/app/api/review/user-sessions/route.ts`
  - `/src/app/api/kanji-mastery/session/route.ts`

## Usage in App

### Review Sessions
- Created when user completes a review session
- Includes SRS data snapshots for each item
- Used for performance analytics
- Enables session replay functionality

### Study Sessions
- Created when user completes a study session
- Tracks initial learning of new characters
- Distinguishes new vs. reviewed characters
- Used for learning curve analysis

## Data Analytics

Sessions are used for:
1. **Performance Tracking**: Accuracy over time
2. **Learning Curves**: Progress visualization
3. **Problem Items**: Identify difficult characters
4. **Session Insights**: Response times, patterns
5. **Streak Calculations**: Daily activity tracking

## Privacy & Retention

- Sessions are private to the user
- Retained indefinitely for premium users
- Free users: Last 90 days of sessions
- Can be deleted on user request
- Exported in user data download
