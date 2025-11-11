# Firebase Collections API Analysis

This document maps all API routes that interact with the `streak_validations`, `user_stats`, and `users` collections in Firebase, detailing their operations and purposes.

## Collection Overview

### 1. `streak_validations`
**Purpose**: Audit log for streak validation events
**Structure**:
- `userId`: User identifier
- `lastActivityDate`: Date of last activity
- `daysSinceActivity` / `hoursSinceActivity`: Time since last activity
- `previousStreak` / `newStreak` / `bestStreak`: Streak values
- `action`: Action taken (e.g., "maintained", "incremented", "reset")
- `reason`: Human-readable reason for the action
- `metadata`: Additional context
- `timestamp`: When validation occurred

### 2. `user_stats`
**Purpose**: Unified gamification and user statistics (replaces legacy separate collections)
**Structure**:
- `userId`, `email`, `displayName`, `photoURL`, `tier`
- `xp`: XP tracking (total, level, xpGainedToday, weeklyXP, monthlyXP)
- `streak`: Streak data (current, best)
- `dates`: Activity dates (lastActivityDate, isActiveToday)
- `achievements`: Unlocked achievements (unlockedIds[], unlockedCount)
- `sessions`: Session tracking (totalSessions, todaySessions, weekSessions, averageAccuracy)
- `metadata`: Sync status and versioning

### 3. `users`
**Purpose**: Main user account data
**Structure**:
- `email`, `emailVerified`, `isAdmin`
- `profile`: Display name, avatar, bio
- `subscription`: Stripe subscription details (plan, status, stripeCustomerId)
- `createdAt`, `lastLoginAt`, `updatedAt`
- `userState`, `locale`, `profileVersion`

---

## API Routes by Collection

## `user_stats` Collection

### Gamification APIs

#### **POST /api/gamification/sync** 
**Operations**: UPDATE
**Feature**: Cross-device sync for premium users
**Description**: Syncs gamification data (XP, streaks, achievements) from client IndexedDB to Firebase. Premium-only feature with safety checks against overwriting real data with zeros.
**Fields Modified**:
- `xp.{total, level, levelTitle, xpToNextLevel, xpGainedToday, weeklyXP, monthlyXP}`
- `streak.{current, best}`
- `dates.{lastActivityDate, isActiveToday}`
- `achievements.{unlockedIds, unlockedCount, completionPercentage}`
- `sessions.{totalSessions, todaySessions, weekSessions, monthSessions}`
- `metadata.{lastUpdated, syncStatus, dataHealth, schemaVersion}`

#### **GET /api/gamification/load**
**Operations**: READ
**Feature**: Cross-device sync for premium users
**Description**: Downloads gamification data from Firebase to IndexedDB for premium users
**Fields Read**: All fields from `user_stats` document

#### **POST /api/gamification/migration/upload**
**Operations**: CREATE/UPDATE
**Feature**: Data migration from legacy collections to unified `user_stats`
**Description**: Migrates data from old schema to new unified schema

### Review Stats APIs

#### **GET /api/review/stats**
**Operations**: READ
**Feature**: Dashboard statistics aggregation
**Description**: Aggregates user statistics for premium users. Reads from `user_stats` for streak/session data and from `users/{userId}/srs_data` for review data.
**Fields Read**: 
- `streak.{current, best}`
- `sessions.{todaySessions, totalStudyTimeMinutes, averageAccuracy}`

### Admin APIs

#### **GET /api/admin/users/[uid]/data**
**Operations**: READ
**Feature**: Admin user data inspection
**Description**: Fetches comprehensive user data across all collections for admin review
**Fields Read**: Entire `user_stats` document

#### **GET /api/admin/stats-consistency**
**Operations**: READ
**Feature**: Data integrity checking
**Description**: Validates consistency between `user_stats` and legacy collections during migration

#### **POST /api/admin/leaderboard/trigger**
**Operations**: READ
**Feature**: Leaderboard generation
**Description**: Reads `user_stats` to generate leaderboard rankings based on XP and streaks
**Fields Read**: `xp.total`, `streak.current`, `streak.best`

---

## `users` Collection

### Authentication & Session APIs

#### **POST /api/auth/signin**
**Operations**: READ, UPDATE
**Feature**: User authentication
**Description**: Authenticates user and updates last login timestamp
**Fields Modified**: `lastLoginAt`

#### **POST /api/auth/signup**
**Operations**: CREATE
**Feature**: User registration
**Description**: Creates new user document with default values
**Fields Created**: All user fields (email, profile, subscription defaults, createdAt, etc.)

#### **POST /api/auth/google**
**Operations**: CREATE/UPDATE
**Feature**: Google OAuth authentication
**Description**: Creates or updates user document for Google sign-in
**Fields Modified**: `email`, `profile.displayName`, `profile.photoURL`, `lastLoginAt`

#### **GET /api/auth/session-check**
**Operations**: READ
**Feature**: Session validation
**Description**: Validates user session by checking user document exists
**Fields Read**: Basic user existence check

#### **POST /api/auth/email/verify**
**Operations**: UPDATE
**Feature**: Email verification
**Description**: Marks user email as verified
**Fields Modified**: `emailVerified`

#### **POST /api/auth/refresh**
**Operations**: READ
**Feature**: Session refresh
**Description**: Refreshes user session by reading current user data
**Fields Read**: `subscription.plan`, `tier`, `isAdmin`

### Subscription & Payment APIs

#### **POST /api/stripe/webhook**
**Operations**: UPDATE
**Feature**: Stripe webhook handler
**Description**: Updates subscription status based on Stripe events (checkout.completed, subscription.updated, subscription.deleted, customer.subscription.deleted)
**Fields Modified**: 
- `subscription.{plan, status, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd}`
- `tier`

#### **POST /api/admin/subscriptions/upgrade**
**Operations**: UPDATE
**Feature**: Admin subscription management
**Description**: Manually upgrades user subscription (admin-only)
**Fields Modified**: `subscription.{plan, status}`, `tier`

### Profile & User Data APIs

#### **GET /api/user/profile**
**Operations**: READ, UPDATE
**Feature**: User profile management
**Description**: Gets or updates user profile data
**Fields Modified**: `profile.{displayName, bio, photoURL}`

#### **POST /api/user/upload-avatar**
**Operations**: UPDATE
**Feature**: Avatar upload
**Description**: Updates user avatar URL
**Fields Modified**: `profile.photoURL`

#### **DELETE /api/user/delete-account**
**Operations**: DELETE
**Feature**: Account deletion
**Description**: Deletes user document and all associated data
**Fields Modified**: Entire document deleted

#### **GET /api/user/export-data**
**Operations**: READ
**Feature**: GDPR data export
**Description**: Exports all user data for GDPR compliance
**Fields Read**: All fields

### Admin User Management APIs

#### **GET /api/admin/users**
**Operations**: READ
**Feature**: Admin user listing
**Description**: Lists all users with pagination
**Fields Read**: All user fields

#### **GET /api/admin/users/[uid]**
**Operations**: READ, UPDATE, DELETE
**Feature**: Admin user management
**Description**: Gets, updates, or deletes specific user
**Fields Modified**: Any field (admin access)

#### **GET /api/admin/users/[uid]/data**
**Operations**: READ
**Feature**: Comprehensive user data view
**Description**: Fetches user data from `users` and all subcollections
**Fields Read**: All fields + subcollections

#### **POST /api/admin/set-admin**
**Operations**: UPDATE
**Feature**: Grant/revoke admin privileges
**Description**: Updates admin status for a user
**Fields Modified**: `isAdmin`

### Feature Usage & Rate Limiting APIs

#### **GET /api/usage/[featureId]/check**
**Operations**: READ
**Feature**: Feature usage validation
**Description**: Checks if user has access to feature based on subscription tier
**Fields Read**: `subscription.plan`, `tier`

#### **POST /api/usage/[featureId]/increment**
**Operations**: READ, UPDATE (subcollection)
**Feature**: Usage tracking
**Description**: Tracks feature usage in `users/{userId}/usage/{featureId}` subcollection
**Fields Read**: `subscription.plan` from users collection

### Notification & Communication APIs

#### **GET /api/notifications/preferences**
**Operations**: READ, UPDATE (subcollection)
**Feature**: Notification preferences
**Description**: Manages user notification preferences in `users/{userId}/notifications` subcollection
**Fields Read**: User email for notification purposes

#### **POST /api/notifications/unsubscribe**
**Operations**: UPDATE (subcollection)
**Feature**: Email unsubscribe
**Description**: Unsubscribes user from email notifications
**Fields Modified**: Notification preferences in subcollection

#### **POST /api/notifications/daily-reminder**
**Operations**: READ
**Feature**: Daily reminder emails
**Description**: Sends daily reminder to users based on their preferences
**Fields Read**: `email`, `profile.displayName`, notification preferences

#### **POST /api/notifications/weekly-progress**
**Operations**: READ
**Feature**: Weekly progress emails
**Description**: Sends weekly progress summary to users
**Fields Read**: `email`, `profile.displayName`

### Content & Learning APIs

#### **GET /api/review/stats**
**Operations**: READ
**Feature**: Review statistics
**Description**: Checks user subscription tier to determine data source (local vs cloud)
**Fields Read**: `subscription.plan`

#### **POST /api/drill/session**
**Operations**: READ
**Feature**: Drill sessions
**Description**: Validates user tier for drill access
**Fields Read**: `subscription.plan`, `tier`

#### **POST /api/kanji/add-to-review**
**Operations**: READ
**Feature**: Kanji review queue
**Description**: Adds kanji to user's review queue
**Fields Read**: `subscription.plan`

#### **GET /api/kanji/browse**
**Operations**: READ (subcollection)
**Feature**: Kanji browsing history
**Description**: Tracks kanji browsing in `users/{userId}/kanji_browse_history`
**Fields Read**: User tier for feature access

#### **POST /api/vocabulary/history**
**Operations**: READ, CREATE, UPDATE, DELETE (subcollection)
**Feature**: Vocabulary history
**Description**: Manages vocabulary history in `users/{userId}/vocabulary_history`
**Fields Read**: User tier for validation

### Lists & Bookmarks APIs

#### **GET /api/lists**
**Operations**: READ, CREATE (subcollection)
**Feature**: Custom learning lists
**Description**: Manages user lists in `users/{userId}/lists` subcollection
**Fields Read**: User ID for ownership validation

#### **GET /api/kanji/bookmarks**
**Operations**: READ, CREATE, DELETE (subcollection)
**Feature**: Kanji bookmarks
**Description**: Manages kanji bookmarks in `users/{userId}/bookmarks` subcollection
**Fields Read**: User tier for feature access

### Flashcards APIs

#### **GET /api/flashcards/decks**
**Operations**: READ, CREATE (subcollection)
**Feature**: Flashcard decks
**Description**: Manages flashcard decks in `users/{userId}/flashcard_decks` subcollection
**Fields Read**: User tier for validation

---

## `streak_validations` Collection

### Streak Validation Service

**Location**: `src/lib/gamification/services/streakService.ts`
**Operations**: CREATE
**Feature**: Streak audit logging
**Description**: Creates audit log entries whenever streaks are validated/updated. This is a write-only audit collection that logs all streak changes for debugging and data integrity.

**Usage Pattern**: Called indirectly through `updateStreakTransaction()` function
- Logs all streak validation decisions
- Records reason for streak maintenance, increment, or reset
- Tracks grace period usage and freeze consumption

**No Direct API Routes**: This collection is written to by the streak service but not directly queried by any API endpoints. It serves as an audit trail.

---

## Key Patterns & Architecture

### Storage Tiers
1. **Free Users**: Data stored only in IndexedDB (client-side)
2. **Premium Users**: Data synced between IndexedDB and Firebase (cross-device)

### Data Flow
1. **Client**: IndexedDB (primary for all users)
2. **Sync Layer**: `/api/gamification/sync` (premium only)
3. **Firebase**: `user_stats` collection (premium only, except for audit)

### Collection Relationships
```
users (main account)
├── subscription data → controls access to premium features
├── profile data → displayed across app
└── subcollections:
    ├── srs_data (review items)
    ├── usage (feature usage tracking)
    ├── lists (custom lists)
    ├── bookmarks (saved items)
    ├── flashcard_decks
    └── notifications (preferences)

user_stats (unified gamification)
├── xp (experience points)
├── streak (daily streaks)
├── achievements (unlocked achievements)
├── sessions (session statistics)
└── metadata (sync status)

streak_validations (audit only)
└── validation events (write-only audit log)
```

### Migration Status
The codebase is in the process of migrating from separate collections (`achievements`, `daily_streaks`, `xp_tracking`) to a unified `user_stats` collection. Both old and new patterns exist in the codebase.

---

## Security Considerations

1. **Premium Features**: All Firebase sync operations check `session.tier` or `subscription.plan`
2. **Admin Routes**: All `/api/admin/*` routes use `withAdminAuth` middleware
3. **Ownership Validation**: Subcollection operations validate user owns the parent document
4. **Rate Limiting**: Usage APIs track and enforce rate limits based on tier

---

## Related Documentation

- **Streak System**: See `docs/STREAK_SYSTEM_INDEX_2025-10-30.md`
- **Data Migration**: See migration scripts in `scripts/`
- **Firebase Rules**: See `firestore.rules`
