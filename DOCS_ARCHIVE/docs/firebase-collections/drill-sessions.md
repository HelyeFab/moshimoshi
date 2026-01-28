# Drill Sessions - Firebase Collections

## Overview
Stores conjugation drill session data including questions, answers, and performance tracking.

## Collections

### `drill_sessions` (Top-Level)

**Description:** Global collection of all drill sessions across all users.

**Access:**
- ✅ All authenticated users (read own only)
- 📍 Location: Top-level collection
- 🔄 Synced from: Drill session completion

**Document Structure:**

```typescript
{
  // Session identifiers
  id: string                        // Session ID
  userId: string                    // User ID who created session

  // Session configuration
  mode: 'random' | 'lists' | 'focused'
  wordTypeFilter: 'all' | 'verbs' | 'adjectives'
  questionsCount: number            // Number of questions (5-50)

  // Questions array
  questions: Array<{
    id: string                      // Question ID
    word: {
      id: string
      kanji: string                 // e.g., "食べる"
      kana: string                  // e.g., "たべる"
      meaning: string               // e.g., "to eat"
      type: 'Ichidan' | 'Godan' | 'Irregular' | 'i-adjective' | 'na-adjective'
      jlpt?: string                 // e.g., "N5"
    }
    targetForm: string              // e.g., "present", "past", "negative"
    stem: string                    // Base form for conjugation
    correctAnswer: string           // Expected answer
    options: string[]               // Multiple choice options
    userAnswer?: string             // User's submitted answer
    isCorrect?: boolean            // Whether answer was correct
    timeSpent?: number             // Time spent on question (ms)
  }>

  // Session timing
  startedAt: string                 // ISO timestamp
  completedAt?: string              // ISO timestamp when completed
  duration?: number                 // Total duration in ms

  // Performance
  score?: number                    // Questions answered correctly
  accuracy?: number                 // Percentage correct
  isPremium: boolean                // User's premium status

  // Metadata
  createdAt: Timestamp              // Server timestamp
  updatedAt?: Timestamp             // Last update
}
```

**Example Document:**
```json
{
  "id": "drill_8onZzlQg3tQxkw8pinSF9ow4Q6j2_1759498970181",
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "mode": "random",
  "wordTypeFilter": "all",
  "questionsCount": 10,
  "questions": [
    {
      "id": "1-present-1759498970181-c6c7puq2x",
      "word": {
        "id": "1",
        "kanji": "食べる",
        "kana": "たべる",
        "meaning": "to eat",
        "type": "Ichidan",
        "jlpt": "N5"
      },
      "targetForm": "present",
      "stem": "食べ",
      "correctAnswer": "食べる",
      "options": ["食べる", "食べた", "食べない", "食べよう"],
      "userAnswer": "食べる",
      "isCorrect": true,
      "timeSpent": 2340
    },
    {
      "id": "2-past-1759498970181-x7k9mwp1y",
      "word": {
        "id": "2",
        "kanji": "飲む",
        "kana": "のむ",
        "meaning": "to drink",
        "type": "Godan",
        "jlpt": "N5"
      },
      "targetForm": "past",
      "stem": "飲",
      "correctAnswer": "飲んだ",
      "options": ["飲む", "飲んだ", "飲まない", "飲もう"],
      "userAnswer": "飲んだ",
      "isCorrect": true,
      "timeSpent": 1890
    }
  ],
  "startedAt": "2025-10-03T13:42:50.181Z",
  "completedAt": "2025-10-03T13:45:23.456Z",
  "duration": 153275,
  "score": 8,
  "accuracy": 80,
  "isPremium": true,
  "createdAt": "2025-10-03T13:42:50.234Z",
  "updatedAt": "2025-10-03T13:45:23.567Z"
}
```

**Firestore Path Example:**
```
drill_sessions/drill_8onZzlQg3tQxkw8pinSF9ow4Q6j2_1759498970181
```

## Question ID Format

Questions have unique IDs:
```
{word.id}-{targetForm}-{timestamp}-{random}
```

Example: `1-present-1759498970181-c6c7puq2x`

## Conjugation Forms

### Verbs
- `present` - 現在形 (e.g., 食べる)
- `past` - 過去形 (e.g., 食べた)
- `negative` - 否定形 (e.g., 食べない)
- `pastNegative` - 過去否定形 (e.g., 食べなかった)
- `teForm` - て形 (e.g., 食べて)
- `taiForm` - たい形 (e.g., 食べたい)
- `volitional` - 意志形 (e.g., 食べよう)
- `potential` - 可能形 (e.g., 食べられる)
- `passive` - 受身形 (e.g., 食べられる)
- `causative` - 使役形 (e.g., 食べさせる)
- `conditional` - 条件形 (e.g., 食べれば)
- `imperative` - 命令形 (e.g., 食べろ)

### Adjectives
- `present` - 現在形 (e.g., 大きい)
- `past` - 過去形 (e.g., 大きかった)
- `negative` - 否定形 (e.g., 大きくない)
- `pastNegative` - 過去否定形 (e.g., 大きくなかった)
- `adverb` - 副詞形 (e.g., 大きく)

## Queries & Indexes

### Required Indexes
```
Collection: drill_sessions
- userId (asc), completedAt (desc)
- userId (asc), accuracy (desc)
- userId (asc), mode (asc), completedAt (desc)
- isPremium (asc), completedAt (desc)
```

### Query Examples

**User's recent drills:**
```javascript
const recentDrills = await db
  .collection('drill_sessions')
  .where('userId', '==', userId)
  .orderBy('completedAt', 'desc')
  .limit(10)
  .get();
```

**User's drill stats:**
```javascript
const drillSnapshot = await db
  .collection('drill_sessions')
  .where('userId', '==', userId)
  .get();

const totalDrills = drillSnapshot.size;
const totalScore = drillSnapshot.docs.reduce((sum, doc) => sum + (doc.data().score || 0), 0);
const avgAccuracy = drillSnapshot.docs.reduce((sum, doc) => sum + (doc.data().accuracy || 0), 0) / totalDrills;
```

**High performers (analytics):**
```javascript
const topPerformers = await db
  .collection('drill_sessions')
  .where('isPremium', '==', true)
  .where('accuracy', '>=', 90)
  .orderBy('accuracy', 'desc')
  .orderBy('completedAt', 'desc')
  .limit(100)
  .get();
```

## Related Collections

- **users/{userId}/progress**: Aggregated drill progress
- **usage**: Daily drill usage tracking
- **user_stats**: Overall user statistics

## Related Files

- API Routes: `/src/app/api/drill/session/route.ts`
- Page: `/src/app/drill/page.tsx`
- Progress Manager: `/src/lib/review-engine/progress/DrillProgressManager.ts`
- Conjugation Engine: `/src/utils/conjugation/`

## API Endpoints

### POST `/api/drill/session`
Create new drill session

**Request:**
```json
{
  "mode": "random",
  "wordTypeFilter": "all",
  "questionsCount": 10,
  "selectedLists": []
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": { /* session object */ },
    "message": "Drill session created"
  }
}
```

### PATCH `/api/drill/session/{sessionId}`
Update session with answers

**Request:**
```json
{
  "answers": [
    { "questionId": "1-present-...", "answer": "食べる", "timeSpent": 2340 }
  ],
  "completed": true
}
```

## Usage Tracking

### Daily Usage Limits
- **Guest**: 0 drills
- **Free**: 3 drills/day
- **Premium**: Unlimited

Usage tracked in `usage` collection:
```json
{
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "conjugation_drill_2025-10-03": 14,
  "lastUpdated": "2025-10-03T14:54:14.413Z"
}
```

## Gamification Integration

Drill completions trigger:
1. **XP Awards**: Based on accuracy
2. **Achievements**: "Perfect Drill", "Conjugation Master", etc.
3. **Streak Updates**: Daily drill streak
4. **Leaderboard**: High scores posted

## Progress Tracking

After drill completion:
1. Update `users/{userId}/progress` with drill stats
2. Track verbs/adjectives studied
3. Record conjugation types practiced
4. Calculate overall accuracy
5. Update study streaks

## Analytics Use Cases

1. **Learning Patterns**: Which conjugations are difficult
2. **Time Analysis**: Average time per question type
3. **Word Difficulty**: Which words need more practice
4. **User Progression**: Accuracy improvement over time
5. **Feature Usage**: Mode popularity, filter usage

## Privacy & Retention

- Sessions are private to user
- Premium users: Retained indefinitely
- Free users: Last 30 days
- Used for personalized learning recommendations
- Can be deleted on user request
