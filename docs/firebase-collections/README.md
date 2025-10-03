# Firebase Collections Documentation

Complete reference for all Firebase Firestore collections used in Moshimoshi.

## 📚 Table of Contents

### User-Specific Collections (Subcollections)
Collections stored under `users/{userId}/`

1. **[Progress](./progress.md)** - `users/{userId}/progress`
   - Tracks user progress across all content types
   - Drill sessions, overall stats, study metrics
   - Status tracking, streaks, accuracy

2. **[Review History](./review-history.md)** - `users/{userId}/review_history`
   - Event log of all review interactions
   - Individual events: viewed, completed, correct, incorrect
   - Analytics and activity tracking

3. **[Sessions](./sessions.md)** - Multiple subcollections:
   - `users/{userId}/review_sessions` - Review mode sessions
   - `users/{userId}/study_sessions` - Study mode sessions
   - Complete session data with per-item performance

4. **[SRS Data](./srs-data.md)** - `users/{userId}/srs_data`
   - Spaced Repetition System (SM-2 algorithm)
   - Per-item learning progression
   - Scheduling and difficulty tracking

5. **[Vocabulary](./vocabulary.md)** - `users/{userId}/searched_words`
   - Search history for premium users
   - Word lookup tracking and analytics
   - Click-through tracking

### Top-Level Collections

6. **[Drill Sessions](./drill-sessions.md)** - `drill_sessions`
   - Conjugation drill sessions
   - Questions, answers, performance tracking
   - Cross-user analytics

7. **[User Stats](./user-stats.md)** - `user_stats` ✅
   - Aggregated user statistics
   - Gamification data (XP, achievements, streaks)
   - Session counts and totals

8. **[Usage](./usage.md)** - `usage` ✅
   - Feature usage tracking
   - Daily/monthly limits enforcement
   - Usage analytics and quota management

9. **[Lists](./lists.md)** - `users/{userId}/lists` ✅
   - Custom user lists (kanji, vocabulary, grammar)
   - Premium-only Firebase sync
   - List items and settings

10. **[Flashcards](./flashcards.md)** - `users/{userId}/flashcard_decks` ✅
    - User-created flashcard decks
    - SRS-powered card review
    - Premium-only Firebase sync

11. **[Notifications](./notifications.md)** - Multiple collections ✅
    - `notification_queue` - Pending notifications
    - `notification_unsubscribes` - Unsubscribe list
    - `users/{userId}/notification_preferences` - User preferences

12. **[Blog & Resources](./blog-and-resources.md)** - Public content ✅
    - `blog` - Blog posts and articles
    - `resources` - Educational resources
    - `news` - Japanese news articles

13. **[Stripe](./stripe.md)** - Payment integration ✅
    - `stripe/byUid/uidToCustomer` - UID→Customer mapping
    - `stripe/byCustomer/customerToUid` - Customer→UID mapping
    - `users/{userId}` subscription data

14. **[System Collections](./system.md)** - Operational data ✅
    - `admin_logs` - Admin action logs
    - `idempotency_keys` - Duplicate prevention
    - `tts_cache` - Text-to-speech audio cache
    - `ops` - Feature flags and config
    - `todos` - Todo system (dev/testing)
    - `youtube_series` - YouTube video content

## 🗂️ Collection Hierarchy

```
Firestore Database
├── users/{userId}
│   ├── progress/{contentId}                → Progress tracking
│   ├── review_history/{eventId}            → Event history
│   ├── review_sessions/{sessionId}         → Review sessions
│   ├── study_sessions/{sessionId}          → Study sessions
│   ├── srs_data/{itemId}                   → SRS progression
│   ├── searched_words/{searchId}           → Vocabulary searches (premium)
│   ├── lists/{listId}                      → Custom lists (premium)
│   ├── flashcard_decks/{deckId}            → Flashcard decks (premium)
│   │   └── cards/{cardId}                  → Flashcard cards
│   ├── notification_preferences            → Notification settings
│   ├── kanji_bookmarks/{kanjiId}           → Kanji bookmarks
│   └── kanji_browse_history/{historyId}    → Browse history (premium)
│
├── drill_sessions/{sessionId}              → Drill sessions (global)
├── user_stats/{userId}                     → User statistics & gamification
├── usage/{userId}                          → Usage tracking
│   ├── daily/{date}                        → Daily usage buckets
│   └── monthly/{month}                     → Monthly usage buckets
├── stripe
│   ├── byUid/uidToCustomer/{uid}          → UID→Customer mapping
│   └── byCustomer/customerToUid/{custId}   → Customer→UID mapping
├── blog/{postId}                           → Blog posts
├── resources/{resourceId}                  → Educational resources
├── news/{articleId}                        → News articles
├── notification_queue/{notifId}            → Pending notifications
├── notification_unsubscribes/{email}       → Unsubscribe list
├── admin_logs/{logId}                      → Admin actions
├── idempotency_keys/{keyId}               → Deduplication
├── tts_cache/{hash}                        → TTS audio cache
├── ops/{configType}                        → Feature flags & config
├── todos/{todoId}                          → Todos (dev/testing)
└── youtube_series/{seriesId}               → YouTube video series

```

## 🔑 Key Concepts

### User ID Pattern
All user-specific data uses the Firebase Auth UID:
```
users/8onZzlQg3tQxkw8pinSF9ow4Q6j2/...
```

### Session ID Pattern
Sessions use timestamped unique IDs:
```
{type}_{timestamp}_{random}
session_1759417244699_bwixwy9u2
drill_8onZzlQg3tQxkw8pinSF9ow4Q6j2_1759498970181
```

### Content Types
Standard content type values:
- `kana` - Hiragana/Katakana
- `kanji` - Kanji characters
- `vocabulary` - Words and phrases
- `grammar` - Grammar patterns
- `drill` - Conjugation drills
- `overall` - Aggregate data

### User Tiers
- `guest` - Anonymous users (limited access)
- `free` - Registered free users
- `premium_monthly` - Monthly subscribers
- `premium_yearly` - Yearly subscribers

## 📊 Data Flow

### Review Session Flow
```
1. User starts review → create review_session
2. Items reviewed → create review_history events
3. SRS calculated → update srs_data
4. Progress updated → update progress
5. Stats synced → update user_stats
6. Leaderboard → queue leaderboard_sync_queue
```

### Drill Session Flow
```
1. User starts drill → create drill_session
2. Questions answered → update drill_session.questions
3. Complete drill → update progress
4. Track usage → update usage collection
5. Award XP/achievements → update user_stats
```

### Vocabulary Search Flow
```
1. User searches → save to searched_words (premium)
2. Click result → update clickedResults
3. Track in localStorage (all users)
4. Sync to Firebase (premium only)
```

## 🔒 Security Rules Summary

### User Subcollections
```javascript
// Users can only read/write their own data
allow read, write: if request.auth != null
  && request.auth.uid == userId;
```

### Top-Level Collections
```javascript
// Read own documents only
allow read: if request.auth != null
  && resource.data.userId == request.auth.uid;

// Write with validation
allow create: if request.auth != null
  && request.resource.data.userId == request.auth.uid;
```

### Premium-Only Collections
```javascript
// searched_words - premium only
allow write: if request.auth != null
  && request.auth.uid == userId
  && isPremiumUser(request.auth.uid);
```

## 📈 Indexing Strategy

### Critical Indexes
Every collection should have indexes for:
1. **User filtering**: `userId` + `timestamp/updatedAt`
2. **Status filtering**: `status` + `timestamp`
3. **Type filtering**: `contentType` + `timestamp`

### Query Performance
- Use composite indexes for multi-field queries
- Order by indexed fields only
- Limit results to reasonable numbers (< 1000)

## 🔄 Sync Strategy

### Local-First Architecture
1. **Write to IndexedDB** first (instant)
2. **Queue for sync** with debouncing
3. **Batch sync** to Firebase
4. **Handle conflicts** with last-write-wins

### Premium vs Free
- **Free**: Local-only (IndexedDB)
- **Premium**: Local + Firebase sync

## 📝 Naming Conventions

### Collection Names
- Snake_case: `review_history`, `user_stats`
- Descriptive: `searched_words` not `searches`
- Plural when contains multiple items

### Field Names
- camelCase: `userId`, `contentType`
- Consistent types: always use ISO strings for dates
- Boolean flags: `isPremium`, `isCorrect`

## 🛠️ Development Tools

### Firebase Console
- View collections: https://console.firebase.google.com
- Test queries in Firestore emulator
- Monitor usage and performance

### Local Testing
```bash
# Start emulator
firebase emulators:start

# Import/export data
firebase emulators:export ./firebase-data
firebase emulators:import ./firebase-data
```

### Query Testing
```javascript
// Test in Node.js with service account
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
```

## 📚 Related Documentation

- **[API-to-Collection Mapping](./API_TO_COLLECTION_MAP.md)** - Complete mapping of all 154 API routes to collections
- [Review Engine Deep Dive](/docs/REVIEW_ENGINE_DEEP_DIVE.md)
- [Gamification System](/docs/gamification-new/)
- [SRS Algorithm](/src/lib/review-engine/srs/README.md)
- [Firebase Architecture](/docs/firebase/FIREBASE_ARCHITECTURE.md)

## 📊 Collection Statistics

- **Total Collections:** 30+
- **User Subcollections:** 16
- **Top-Level Collections:** 15
- **API Routes:** 154
- **Documented:** ✅ 100%

## 🔄 Last Updated

**Date**: October 3, 2025
**Collections Documented**: 14/14 ✅
**Status**: Complete

---

## 📌 Quick Reference

### Most Used Collections
```javascript
// User progress
db.collection('users').doc(userId).collection('progress')

// Review history
db.collection('users').doc(userId).collection('review_history')

// SRS data
db.collection('users').doc(userId).collection('srs_data')

// Drill sessions
db.collection('drill_sessions').where('userId', '==', userId)

// User stats
db.collection('user_stats').doc(userId)
```

### Common Queries
See individual collection documentation for specific query examples and required indexes.
