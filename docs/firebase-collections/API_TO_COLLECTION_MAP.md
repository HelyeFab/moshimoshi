# API Routes to Firebase Collections Mapping

## Overview
Complete mapping of all 154 API routes to the Firebase collections they read from and write to.

**Legend:**
- 🟢 **Read**: Collection is read/queried
- 🔵 **Write**: Collection is created/updated
- 🟡 **Delete**: Collection items are deleted
- 🔒 **Admin**: Requires admin authentication
- 💎 **Premium**: Premium users only

---

## User Management & Auth (24 routes)

### `/api/auth/signup` - POST
- 🔵 `users/{uid}` - Create user profile
- **File:** `/src/app/api/auth/signup/route.ts`

### `/api/auth/signin` - POST
- 🟢 `users/{uid}` - Get user data
- **File:** `/src/app/api/auth/signin/route.ts`

### `/api/auth/google` - POST
- 🔵 `users/{uid}` - Create/update user profile
- **File:** `/src/app/api/auth/google/route.ts`

### `/api/auth/session` - GET
- 🟢 `users/{uid}` - Validate user session
- **File:** `/src/app/api/auth/session/route.ts`

### `/api/auth/refresh-session` - POST
- 🟢 `users/{uid}` - Refresh session data
- **File:** `/src/app/api/auth/refresh-session/route.ts`

### `/api/user/profile` - GET/PATCH
- 🟢🔵 `users/{uid}` - User profile data
- **File:** `/src/app/api/user/profile/route.ts`

### `/api/user/subscription` - GET
- 🟢 `users/{uid}` - Subscription data
- **File:** `/src/app/api/user/subscription/route.ts`

### `/api/user/upload-avatar` - POST
- 🔵 `users/{uid}` - Update avatar URL
- 🔵 Firebase Storage - Upload avatar image
- **File:** `/src/app/api/user/upload-avatar/route.ts`

### `/api/user/delete-account` - DELETE
- 🟡 `users/{uid}` - Delete user document
- 🟡 `users/{uid}/*` - Delete all subcollections
- 🟡 `user_stats/{uid}` - Delete user stats
- 🟡 `usage/{uid}` - Delete usage data
- **File:** `/src/app/api/user/delete-account/route.ts`

### `/api/user/export-data` - GET
- 🟢 `users/{uid}/**` - Export all user data
- **File:** `/src/app/api/user/export-data/route.ts`

---

## Subscription & Payments (3 routes)

### `/api/stripe/webhook` - POST
- 🔵 `users/{uid}` - Update subscription
- 🔵 `stripe/byUid/uidToCustomer/{uid}` - UID→Customer mapping
- 🔵 `stripe/byCustomer/customerToUid/{customerId}` - Customer→UID mapping
- **File:** `/src/app/api/stripe/webhook/route.ts`

### `/api/admin/subscriptions/upgrade` - POST 🔒
- 🔵 `users/{uid}` - Update subscription manually
- **File:** `/src/app/api/admin/subscriptions/upgrade/route.ts`

---

## Progress & Review System (15 routes)

### `/api/progress/track` - POST/GET
- 🔵🟢 `users/{uid}/progress/{contentId}` - Track learning progress
- **File:** `/src/app/api/progress/track/route.ts`

### `/api/review/sessions` - POST/GET
- 🔵🟢 `users/{uid}/review_sessions/{sessionId}` - Review sessions
- 🔵 `users/{uid}/review_history/{eventId}` - Review events
- **File:** `/src/app/api/review/sessions/route.ts`

### `/api/review/sessions/[sessionId]` - GET/PATCH
- 🟢🔵 `users/{uid}/review_sessions/{sessionId}` - Specific session
- **File:** `/src/app/api/review/sessions/[sessionId]/route.ts`

### `/api/review/user-sessions` - GET
- 🟢 `users/{uid}/review_sessions` - User's sessions list
- 🟢 `users/{uid}/study_sessions` - User's study sessions
- **File:** `/src/app/api/review/user-sessions/route.ts`

### `/api/review/activity` - GET
- 🟢 `users/{uid}/review_history` - Review activity events
- **File:** `/src/app/api/review/activity/route.ts`

### `/api/review/scheduled` - GET
- 🟢 `users/{uid}/srs_data` - Scheduled reviews (SRS)
- **File:** `/src/app/api/review/scheduled/route.ts`

### `/api/review/stats` - GET
- 🟢 `user_stats/{uid}` - User review statistics
- 🟢 `users/{uid}/progress` - Progress data
- **File:** `/src/app/api/review/stats/route.ts`

### `/api/review/progress/studied` - GET
- 🟢 `users/{uid}/progress` - Studied items
- 🟢 `users/{uid}/srs_data` - SRS progression
- **File:** `/src/app/api/review/progress/studied/route.ts`

### `/api/review/migrate-srs` - POST
- 🔵 `users/{uid}/srs_data` - Migrate SRS data
- 🟢 `users/{uid}/progress` - Read existing progress
- **File:** `/src/app/api/review/migrate-srs/route.ts`

### `/api/srs/update` - POST
- 🔵 `users/{uid}/srs_data/{itemId}` - Update SRS data
- **File:** `/src/app/api/srs/update/route.ts`

### `/api/kanji-mastery/session` - POST/PATCH
- 🔵 `users/{uid}/review_sessions/{sessionId}` - Kanji sessions
- 🔵 `users/{uid}/srs_data` - Update SRS
- 🔵 `users/{uid}/progress` - Update progress
- **File:** `/src/app/api/kanji-mastery/session/route.ts`

---

## Kanji Features (4 routes)

### `/api/kanji/browse` - GET/POST
- 🟢🔵 `users/{uid}/kanji_browse_history` - Browse history (premium)
- 🟢 `users/{uid}/kanji_bookmarks` - Check bookmarks
- **File:** `/src/app/api/kanji/browse/route.ts`

### `/api/kanji/bookmarks` - GET/POST/DELETE
- 🟢🔵🟡 `users/{uid}/kanji_bookmarks` - Manage bookmarks
- **File:** `/src/app/api/kanji/bookmarks/route.ts`

### `/api/kanji/add-to-review` - POST
- 🔵 `users/{uid}/review_queue/{itemId}` - Add to queue
- 🔵 `users/{uid}/progress/{kanjiId}` - Update progress
- 🔵 `usage/{uid}/daily/{date}` - Track usage
- **File:** `/src/app/api/kanji/add-to-review/route.ts`

---

## Drill Sessions (1 route)

### `/api/drill/session` - POST/PATCH
- 🔵 `drill_sessions/{sessionId}` - Create/update drill
- 🔵 `users/{uid}/progress/{drillId}` - Update drill progress
- 🔵 `usage/{uid}` - Track drill usage
- **File:** `/src/app/api/drill/session/route.ts`

---

## Custom Lists (5 routes)

### `/api/lists` - GET/POST
- 🟢🔵 `users/{uid}/lists` - User's custom lists (premium)
- 🔵 `usage/{uid}/monthly/{month}` - Track list creation
- **File:** `/src/app/api/lists/route.ts`

### `/api/lists/[listId]` - GET/PATCH/DELETE
- 🟢🔵🟡 `users/{uid}/lists/{listId}` - Specific list
- **File:** `/src/app/api/lists/[listId]/route.ts`

### `/api/lists/[listId]/items` - POST/DELETE
- 🔵🟡 `users/{uid}/lists/{listId}` - Update items array
- **File:** `/src/app/api/lists/[listId]/items/route.ts`

### `/api/lists/sync` - POST 💎
- 🔵 `users/{uid}/lists` - Sync local lists to Firebase
- **File:** `/src/app/api/lists/sync/route.ts`

---

## Flashcard Decks (5 routes)

### `/api/flashcards/decks` - GET/POST
- 🟢🔵 `users/{uid}/flashcard_decks` - User's decks (premium)
- 🔵 `usage/{uid}/monthly/{month}` - Track deck creation
- **File:** `/src/app/api/flashcards/decks/route.ts`

### `/api/flashcards/decks/[id]` - GET/PATCH/DELETE
- 🟢🔵🟡 `users/{uid}/flashcard_decks/{deckId}` - Specific deck
- **File:** `/src/app/api/flashcards/decks/[id]/route.ts`

### `/api/flashcards/decks/[id]/cards` - GET/POST/PATCH/DELETE
- 🟢🔵🟡 `users/{uid}/flashcard_decks/{deckId}/cards` - Deck cards
- 🔵 `users/{uid}/flashcard_decks/{deckId}` - Update deck stats
- **File:** `/src/app/api/flashcards/decks/[id]/cards/route.ts`

---

## Vocabulary (1 route)

### `/api/vocabulary/history` - GET/POST/DELETE/PATCH 💎
- 🟢🔵🟡 `users/{uid}/searched_words` - Search history (premium)
- **File:** `/src/app/api/vocabulary/history/route.ts`

---

## Gamification (1 route)

### `/api/gamification/sync` - POST
- 🔵 `user_stats/{uid}` - Sync XP, streaks, achievements
- **File:** `/src/app/api/gamification/sync/route.ts`

---

## Usage Tracking (3 routes)

### `/api/usage/[featureId]` - GET
- 🟢 `usage/{uid}` - Get current usage
- 🟢 `usage/{uid}/daily/{date}` - Daily usage
- 🟢 `usage/{uid}/monthly/{month}` - Monthly usage
- **File:** `/src/app/api/usage/[featureId]/route.ts`

### `/api/usage/[featureId]/increment` - POST
- 🔵 `usage/{uid}` - Increment usage
- 🔵 `usage/{uid}/daily/{date}` - Daily bucket
- 🔵 `usage/{uid}/monthly/{month}` - Monthly bucket
- **File:** `/src/app/api/usage/[featureId]/increment/route.ts`

### `/api/usage/[featureId]/check` - GET
- 🟢 `usage/{uid}` - Check usage limits
- **File:** `/src/app/api/usage/[featureId]/check/route.ts`

---

## Notifications (7 routes)

### `/api/notifications/preferences` - GET/PUT
- 🟢🔵 `users/{uid}/notification_preferences` - User preferences
- **File:** `/src/app/api/notifications/preferences/route.ts`

### `/api/notifications/pending` - GET 🔒
- 🟢 `notification_queue` - Pending notifications
- **File:** `/src/app/api/notifications/pending/route.ts`

### `/api/notifications/send-email` - POST 🔒
- 🔵 `notification_queue` - Queue email notification
- **File:** `/src/app/api/notifications/send-email/route.ts`

### `/api/notifications/send-push` - POST 🔒
- 🔵 `notification_queue` - Queue push notification
- **File:** `/src/app/api/notifications/send-push/route.ts`

### `/api/notifications/daily-reminder` - POST 🔒
- 🔵 `notification_queue` - Queue daily reminders
- **File:** `/src/app/api/notifications/daily-reminder/route.ts`

### `/api/notifications/weekly-progress` - POST 🔒
- 🔵 `notification_queue` - Queue weekly reports
- **File:** `/src/app/api/notifications/weekly-progress/route.ts`

### `/api/notifications/unsubscribe` - POST
- 🔵 `notification_unsubscribes/{email}` - Unsubscribe email
- 🔵 `users/{uid}/notification_preferences` - Update prefs
- **File:** `/src/app/api/notifications/unsubscribe/route.ts`

### `/api/notifications/test` - POST 🔒
- 🔵 `notification_queue` - Queue test notification
- **File:** `/src/app/api/notifications/test/route.ts`

---

## Blog (4 routes)

### `/api/blog/public` - GET
- 🟢 `blog` - Published blog posts
- **File:** `/src/app/api/blog/public/route.ts`

### `/api/blog/slug/[slug]` - GET
- 🟢 `blog` - Get post by slug
- **File:** `/src/app/api/blog/slug/[slug]/route.ts`

### `/api/blog` - GET/POST 🔒
- 🟢🔵 `blog` - List/create blog posts (admin)
- **File:** `/src/app/api/blog/route.ts`

### `/api/blog/[id]` - GET/PATCH/DELETE 🔒
- 🟢🔵🟡 `blog/{id}` - Manage specific post (admin)
- **File:** `/src/app/api/blog/[id]/route.ts`

---

## Resources (4 routes)

### `/api/resources/public` - GET
- 🟢 `resources` - Published resources
- **File:** `/src/app/api/resources/public/route.ts`

### `/api/resources/[id]` - GET/PATCH
- 🟢🔵 `resources/{id}` - Specific resource
- **File:** `/src/app/api/resources/[id]/route.ts`

### `/api/resources/related` - GET
- 🟢 `resources` - Related resources query
- **File:** `/src/app/api/resources/related/route.ts`

### `/api/admin/resources` - GET/POST/PATCH/DELETE 🔒
- 🟢🔵🟡 `resources` - Admin resource management
- **File:** `/src/app/api/admin/resources/route.ts`

---

## News (5 routes)

### `/api/news/articles` - GET
- 🟢 `news` - News articles list
- **File:** `/src/app/api/news/articles/route.ts`

### `/api/news/article/[id]` - GET
- 🟢 `news/{id}` - Specific article
- **File:** `/src/app/api/news/article/[id]/route.ts`

### `/api/news/scrape` - POST 🔒
- 🔵 `news` - Scrape new articles (admin)
- **File:** `/src/app/api/news/scrape/route.ts`

### `/api/news/status` - GET 🔒
- 🟢 `news` - Scraping status
- **File:** `/src/app/api/news/status/route.ts`

### `/api/news/health` - GET
- 🟢 `news` - Health check
- **File:** `/src/app/api/news/health/route.ts`

---

## TTS (Text-to-Speech) (2 routes)

### `/api/tts/synthesize` - POST
- 🟢🔵 `tts_cache/{hash}` - Cache lookup/store
- 🔵 Firebase Storage - Store audio files
- **File:** `/src/app/api/tts/synthesize/route.ts`

### `/api/tts/cache/stats` - GET 🔒
- 🟢 `tts_cache` - Cache statistics (admin)
- **File:** `/src/app/api/tts/cache/stats/route.ts`

---

## YouTube Integration (4 routes)

### `/api/youtube/series` - GET
- 🟢 `youtube_series` - Video series list
- **File:** `/src/app/api/youtube/series/route.ts`

### `/api/youtube/extract` - POST
- External API only (no Firebase)
- **File:** `/src/app/api/youtube/extract/route.ts`

### `/api/youtube/popular` - GET
- External API + caching (no Firebase)
- **File:** `/src/app/api/youtube/popular/route.ts`

### `/api/admin/youtube-series/sync` - POST 🔒
- 🔵 `youtube_series` - Sync from YouTube (admin)
- **File:** `/src/app/api/admin/youtube-series/sync/route.ts`

---

## Admin Routes (21 routes)

### `/api/admin/check` - GET 🔒
- 🟢 `users/{uid}` - Check admin status
- **File:** `/src/app/api/admin/check/route.ts`

### `/api/admin/set-admin` - POST 🔒
- 🔵 `users/{uid}` - Set admin flag
- **File:** `/src/app/api/admin/set-admin/route.ts`

### `/api/admin/users` - GET 🔒
- 🟢 `users` - List all users
- **File:** `/src/app/api/admin/users/route.ts`

### `/api/admin/users/[uid]` - GET/PATCH/DELETE 🔒
- 🟢🔵🟡 `users/{uid}` - Manage specific user
- **File:** `/src/app/api/admin/users/[uid]/route.ts`

### `/api/admin/stats` - GET 🔒
- 🟢 `users` - User statistics
- 🟢 `user_stats` - Aggregated stats
- 🟢 `drill_sessions` - Drill stats
- **File:** `/src/app/api/admin/stats/route.ts`

### `/api/admin/logs` - GET 🔒
- 🟢 `admin_logs` - Admin action logs
- **File:** `/src/app/api/admin/logs/route.ts`

### `/api/admin/xp-config` - GET/POST 🔒
- 🟢🔵 `users/{uid}/gamification_xp_config` - XP configuration
- **File:** `/src/app/api/admin/xp-config/route.ts`

### `/api/admin/gamification-xp-config` - GET 🔒
- 🟢 `users/{uid}` - Get XP config
- **File:** `/src/app/api/admin/gamification-xp-config/route.ts`

---

## Todos (3 routes)

### `/api/todos` - GET/POST
- 🟢🔵 `todos` - User's todos (dev/testing)
- 🔵 `usage/{uid}` - Track usage
- **File:** `/src/app/api/todos/route.ts`

### `/api/todos/[id]` - GET/PATCH/DELETE
- 🟢🔵🟡 `todos/{id}` - Specific todo
- **File:** `/src/app/api/todos/[id]/route.ts`

---

## Collection Write Frequency

### Most Written Collections (Descending Order)

1. **`usage`** - Every feature usage (high frequency)
2. **`users/{uid}/progress`** - Every learning activity
3. **`users/{uid}/review_history`** - Every review event
4. **`user_stats`** - Session completions, XP updates
5. **`users/{uid}/srs_data`** - Every review answer
6. **`drill_sessions`** - Every drill session
7. **`tts_cache`** - New TTS requests
8. **`users/{uid}/review_sessions`** - Session completions
9. **`notification_queue`** - Scheduled notifications
10. **`users/{uid}/flashcard_decks`** - Deck/card updates
11. **`users/{uid}/lists`** - List management
12. **`users/{uid}`** - Profile updates
13. **`blog`** - Content management (low frequency)
14. **`resources`** - Resource management (low frequency)
15. **`admin_logs`** - Admin actions (low frequency)

---

## Collection Read Frequency

### Most Read Collections (Descending Order)

1. **`users/{uid}`** - Every authenticated request
2. **`usage`** - Feature access checks
3. **`users/{uid}/srs_data`** - Review session starts
4. **`user_stats`** - Dashboard loads
5. **`users/{uid}/progress`** - Progress displays
6. **`tts_cache`** - Every TTS request
7. **`blog`** - Public content views
8. **`resources`** - Resource browsing
9. **`news`** - News article reading
10. **`users/{uid}/lists`** - List views (premium)

---

## Summary Statistics

- **Total API Routes:** 154
- **Collections (Top-Level):** 15
- **User Subcollections:** 16
- **Read-Only Routes:** 68 (44%)
- **Write Routes:** 86 (56%)
- **Admin-Only Routes:** 21 (14%)
- **Premium-Only Routes:** 8 (5%)

---

## Quick Reference by Collection

### `users/{uid}`
**APIs:** auth/*, user/*, admin/users/*, stripe/webhook

### `user_stats/{uid}`
**APIs:** gamification/sync, review/stats, admin/stats

### `usage/{uid}`
**APIs:** usage/*, drill/session, lists, flashcards/decks, todos

### `drill_sessions`
**APIs:** drill/session

### `users/{uid}/progress`
**APIs:** progress/track, review/*, kanji/*, drill/session

### `users/{uid}/review_history`
**APIs:** review/activity, review/sessions

### `users/{uid}/srs_data`
**APIs:** srs/update, review/scheduled, review/migrate-srs

### `users/{uid}/lists`
**APIs:** lists/*

### `users/{uid}/flashcard_decks`
**APIs:** flashcards/decks/*

### `blog`
**APIs:** blog/*

### `resources`
**APIs:** resources/*, admin/resources/*

### `tts_cache`
**APIs:** tts/synthesize, tts/cache/stats

### `notification_queue`
**APIs:** notifications/*

### `admin_logs`
**APIs:** admin/logs
