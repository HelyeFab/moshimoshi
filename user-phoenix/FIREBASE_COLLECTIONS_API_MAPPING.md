# Firebase Collections API Mapping

**Generated:** 2025-10-31
**Collections Analyzed:** `user_stats`, `users`
**Removed:** `streak_validations` (2025-10-31) — unused legacy audit collection; streak logic lives in `user_stats.streak` via transactional `streakService.ts`.

---

## Executive Summary

This document maps all API endpoints that interact with the Firebase collections: `user_stats` and `users`.

Note: The `streak_validations` collection was removed on 2025-10-31.

---

## API Endpoint to Collection Mapping

| Collection | API Endpoint | CRUD Operations | Feature/Purpose |
|------------|-------------|-----------------|-----------------|
| **user_stats** | `/api/gamification/sync` (POST) | CREATE, UPDATE | Syncs gamification data to Firebase for premium users; updates XP, streak, achievements, sessions with time-based metrics |
| **user_stats** | `/api/gamification/load` (GET) | READ | Loads gamification data from Firebase for premium users; downloads data to IndexedDB for cross-device sync |
| **user_stats** | `/api/gamification/migration/upload` (POST) | CREATE, UPDATE | Migrates streak data from IndexedDB to Firebase; merges data by taking maximum values |
| **user_stats** | `/api/review/stats` (GET) | READ | Aggregates review statistics for premium users; reads streak and session data |
| **user_stats** | `/api/admin/users/[uid]/data` (GET) | READ | Admin endpoint to retrieve comprehensive user data including stats |
| **user_stats** | `/api/admin/stats-consistency` (GET) | READ | Admin endpoint to analyze user statistics for outliers and inconsistencies |
| **user_stats** | `/api/admin/leaderboard/trigger` (POST) | READ | Fetches user_stats for leaderboard generation; orders by XP total |
| **user_stats** | `/lib/gamification/services/streakService.ts` | CREATE, READ, UPDATE | Core streak service using Firebase transactions; atomic streak updates with version-based conflict detection |
| **users** | `/api/auth/signup` (POST) | CREATE, UPDATE | Creates new user account; initializes user profile with default schema |
| **users** | `/api/auth/signin` (POST) | READ, UPDATE | Authenticates user; reads profile, updates lastLoginAt |
| **users** | `/api/auth/google` (POST) | CREATE, READ, UPDATE | Google OAuth authentication; creates/updates user profile |
| **users** | `/api/user/profile` (GET) | READ | Retrieves user profile with preferences and settings |
| **users** | `/api/user/profile` (PATCH) | UPDATE | Updates user profile fields (displayName, preferences, notifications, privacy) |
| **users** | `/api/user/delete-account` (POST) | UPDATE | Soft deletes user account; marks user as deleted with 30-day retention |
| **users** | `/api/user/delete-account` (DELETE) | UPDATE | Cancels account deletion; restores user account |
| **users** | `/api/admin/users/[uid]` (GET) | READ | Admin endpoint to get detailed user information |
| **users** | `/api/admin/users/[uid]` (PATCH) | UPDATE | Admin endpoint to update user profile (plan, custom claims, disabled status) |
| **users** | `/api/admin/users/[uid]/data` (GET) | READ | Admin endpoint to fetch comprehensive user data from all collections |
| **users** | `/api/admin/set-admin` (POST) | UPDATE | Grants/revokes admin privileges; updates isAdmin field |
| **users** | `/api/admin/stats-consistency` (GET) | READ | Fetches user documents for admin consistency checking |
| **users** | `/api/review/stats` (GET) | READ | Reads user document to check premium status for stats aggregation |
| **users** | `/functions/src/firestore.ts` | CREATE, UPDATE | Firebase Functions Stripe webhook handler; updates subscription facts |
| **users** | `/functions/src/webhook.ts` | UPDATE | Stripe webhook receiver; routes events to handlers that update user subscription |
| **streak_validations** | *None found* | *Not used* | **Collection not actively used in codebase** |

---

## Detailed Collection Analysis

### 1. `user_stats` Collection

**Purpose:** Stores unified gamification statistics including XP, levels, streaks, achievements, and session data.

**Primary Features:**
- Gamification sync (premium users only)
- Streak management (transactional updates)
- Leaderboard generation
- Admin analytics and monitoring

**Schema Structure:**
```typescript
{
  xp: {
    total: number,
    level: number,
    levelTitle: string,
    xpToNextLevel: number,
    xpGainedToday: number,
    weeklyXP: number,
    monthlyXP: number
  },
  streak: {
    current: number,
    best: number
  },
  dates: {
    lastActivityDate: string,
    isActiveToday: boolean
  },
  achievements: {
    unlockedIds: string[],
    unlockedCount: number,
    completionPercentage: number
  },
  sessions: {
    totalSessions: number,
    todaySessions: number,
    weekSessions: number,
    monthSessions: number,
    averageAccuracy: number,
    totalStudyTimeMinutes: number,
    totalItemsReviewed: number
  },
  metadata: {
    lastUpdated: string,
    syncStatus: 'synced' | 'pending' | 'conflict',
    dataHealth: 'healthy' | 'warning' | 'error',
    schemaVersion: number
  }
}
```

**API Interactions:**

#### Create/Update Operations
- **`/api/gamification/sync`** - Primary sync endpoint for premium users
  - Validates incoming data for safety (prevents zero overwrites)
  - Updates all gamification fields atomically
  - Returns sync status and timestamp

- **`/api/gamification/migration/upload`** - Migration endpoint
  - Uploads local IndexedDB data to Firebase
  - Merges by taking maximum values (preserves best data)
  - Used during premium upgrade process

- **`/lib/gamification/services/streakService.ts`** - Service layer
  - Uses Firebase transactions for atomic updates
  - Implements version-based conflict detection
  - Handles streak increment/reset logic

#### Read Operations
- **`/api/gamification/load`** - Downloads stats to IndexedDB
- **`/api/review/stats`** - Aggregates review statistics
- **`/api/admin/users/[uid]/data`** - Admin data retrieval
- **`/api/admin/stats-consistency`** - Admin consistency checking
- **`/api/admin/leaderboard/trigger`** - Leaderboard generation

---

### 2. `users` Collection

**Purpose:** Main user profile collection storing authentication, subscription, preferences, and profile data.

**Primary Features:**
- User authentication (signup, signin, OAuth)
- Profile management
- Subscription management (via Stripe webhooks)
- Admin user management
- Account deletion (soft delete with 30-day retention)

**Schema Structure:**
```typescript
{
  // Core Identity
  email: string,
  displayName: string,
  photoURL: string,
  emailVerified: boolean,
  isAdmin: boolean,

  // Study Preferences
  preferredLanguage: string,
  studyGoal: string,
  studyTime: string,

  // Subscription
  subscription: {
    plan: 'free' | 'basic' | 'premium',
    status: 'active' | 'canceled' | 'past_due' | 'incomplete',
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    stripePriceId: string,
    currentPeriodEnd: Timestamp,
    cancelAtPeriodEnd: boolean
  },

  // Notifications
  notifications: {
    email: boolean,
    push: boolean,
    studyReminders: boolean,
    weeklyProgress: boolean
  },

  // Privacy
  privacy: {
    profileVisible: boolean,
    progressVisible: boolean
  },

  // Preferences (nested structure)
  preferences: {
    theme: string,
    language: string,
    palette: string,
    notifications: object,
    learning: object,
    privacy: object,
    accessibility: object
  },

  // Timestamps
  createdAt: Timestamp,
  lastLoginAt: Timestamp,
  updatedAt: Timestamp,

  // Deletion (soft delete)
  deletedAt?: Timestamp,
  deletionScheduledFor?: Timestamp
}
```

**API Interactions:**

#### Create Operations
- **`/api/auth/signup`** - Creates new user account
  - Initializes user profile with default schema
  - Sets up preferences, notifications, privacy settings
  - Creates Firebase Auth user and Firestore document

- **`/api/auth/google`** - OAuth user creation
  - Creates user if doesn't exist
  - Syncs Google profile data

#### Read Operations
- **`/api/auth/signin`** - Authentication
- **`/api/user/profile`** - Profile retrieval
- **`/api/admin/users/[uid]`** - Admin user lookup
- **`/api/admin/users/[uid]/data`** - Comprehensive data export
- **`/api/admin/stats-consistency`** - Admin analytics
- **`/api/review/stats`** - Premium status check

#### Update Operations
- **`/api/auth/signin`** - Updates lastLoginAt on login
- **`/api/auth/google`** - Updates profile from Google data
- **`/api/user/profile` (PATCH)** - Profile updates
  - displayName, photoURL
  - preferences (all nested fields)
  - notifications settings
  - privacy settings

- **`/api/user/delete-account` (POST)** - Soft delete
  - Sets deletedAt timestamp
  - Sets deletionScheduledFor (30 days)
  - Maintains data integrity during retention period

- **`/api/user/delete-account` (DELETE)** - Cancel deletion
  - Removes deletedAt and deletionScheduledFor
  - Restores account

- **`/api/admin/users/[uid]` (PATCH)** - Admin updates
  - Change subscription plan
  - Update custom claims
  - Enable/disable account

- **`/api/admin/set-admin`** - Admin privilege management
  - Sets isAdmin field
  - Updates Firebase custom claims

- **`/functions/src/firestore.ts`** - Stripe webhook handler
  - Updates subscription status
  - Syncs Stripe subscription data
  - Handles payment events

---

### 3. `streak_validations` Collection

**Status:** ⚠️ **NOT IN USE**

**Analysis:**
- No API endpoints interact with this collection
- Not referenced in any service layer code
- Not found in current streak implementation
- Likely a legacy or planned feature that was never implemented

**Possible Historical Context:**
- May have been used in an older version of the streak system
- Could have been planned for storing streak validation logs
- Replaced by current streak system in `user_stats.streak`

**Recommendation:**
- Consider removing from Firestore security rules if unused
- Document decision in architecture docs
- Archive or delete collection if confirmed unused

---

## Architecture Patterns

### 1. Premium vs Free Tier Data Storage

**Premium Users:**
- Data synced to Firebase (`user_stats` and `users`)
- Cross-device synchronization enabled
- Access to leaderboard features
- Data backed up in Firebase

**Free Users:**
- Data stored locally in IndexedDB only
- No cross-device sync
- Not included in leaderboard
- Data migrations available on upgrade

### 2. Streak Management System

**Implementation:** `/lib/gamification/services/streakService.ts`

**Key Features:**
- Firebase transactions for atomic updates
- Version-based conflict detection
- Optimistic UI updates
- Fallback to local storage on failure

**Operations:**
- `incrementStreak()` - Increments streak with transaction
- `resetStreak()` - Resets streak with transaction
- Uses `user_stats.streak` field, NOT `streak_validations`

### 3. Subscription Management

**Primary Handler:** Firebase Functions (`/functions/src/webhook.ts`)

**Webhook Flow:**
1. Stripe sends webhook to Firebase Functions
2. Functions verify webhook signature
3. Event routed to appropriate handler
4. Handler updates `users` collection subscription fields
5. Client picks up changes via Firestore listeners

**Next.js Endpoint:**
- `/api/stripe/webhook` is **DISABLED**
- All Stripe events must go through Firebase Functions
- Documented in codebase comments

### 4. Admin Operations

**Access Pattern:**
- All admin endpoints check `isAdmin` field in `users` collection
- Comprehensive read access to user data
- Limited write access (profile, subscription, admin status)

**Admin Endpoints:**
- `/api/admin/users/[uid]` - User management
- `/api/admin/stats-consistency` - Analytics
- `/api/admin/leaderboard/trigger` - Manual leaderboard rebuild
- `/api/admin/set-admin` - Admin privilege management

### 5. Data Safety Measures

**Gamification Sync:**
- Validates incoming data before writes
- Prevents overwriting real data with zeros
- Checks for data health before operations
- Uses transactions for critical updates

**Account Deletion:**
- Soft delete with 30-day retention
- `deletedAt` and `deletionScheduledFor` timestamps
- Cancellation possible during retention period
- Final deletion handled by scheduled function

**Conflict Resolution:**
- Version-based conflict detection
- Last-write-wins for most updates
- Max-value strategy for migrations
- Transaction-based for critical data (streaks)

---

## Security Considerations

### Firestore Security Rules

**Expected Rules:**

```javascript
// user_stats collection
match /user_stats/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null && request.auth.uid == userId;
}

// users collection
match /users/{userId} {
  allow read: if request.auth != null && (
    request.auth.uid == userId ||
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true
  );
  allow write: if request.auth != null && request.auth.uid == userId;
  allow update: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
}

// streak_validations - explicitly denied (removed 2025-10-31)
match /streak_validations/{document} {
  allow read, write: if false; // Explicit deny to prevent reintroduction
}
```

### API Authentication

**All endpoints require:**
- Valid Firebase session token
- User must be authenticated
- Admin endpoints require `isAdmin: true`

**Rate Limiting:**
- Implemented at API route level
- Protects against abuse
- Different limits for free vs premium users

---

## Migration History

### User Stats Migration (2024)
- Migrated from separate collections to unified `user_stats`
- Combined XP, streak, achievements into single document
- Documented in `/docs/user-stats-migration/`

### Streak System V2 (2025-10-30)
- Version-based conflict detection added
- Transaction-based updates implemented
- Documented in `/docs/STREAK_MIGRATION_GUIDE_2025-10-30.md`

---

## Testing Endpoints

**Scripts for Testing:**
- `/scripts/test-review-api.js` - Tests review/stats API
- `/scripts/check-user-stats.js` - Validates user_stats structure
- `/scripts/verify-test-users.ts` - Verifies test user data
- `/scripts/test-sync-logic.js` - Tests gamification sync

**Admin Test Endpoints:**
- `/api/admin/stats-consistency` - Check data consistency
- `/api/admin/users/[uid]/data` - Inspect user data

---

## Quick Reference

### Most Commonly Used Endpoints

**User Management:**
- `POST /api/auth/signup` - Create user
- `POST /api/auth/signin` - Login user
- `GET /api/user/profile` - Get profile
- `PATCH /api/user/profile` - Update profile

**Gamification:**
- `POST /api/gamification/sync` - Sync stats to Firebase
- `GET /api/gamification/load` - Load stats from Firebase

**Admin:**
- `GET /api/admin/users/[uid]/data` - Get all user data
- `POST /api/admin/set-admin` - Grant admin access

### File Locations

**API Routes:**
- Authentication: `/src/app/api/auth/`
- User Management: `/src/app/api/user/`
- Gamification: `/src/app/api/gamification/`
- Admin: `/src/app/api/admin/`

**Services:**
- Streak Service: `/src/lib/gamification/services/streakService.ts`
- Firebase Admin: `/src/lib/firebase/admin.ts`

**Firebase Functions:**
- Webhook Handler: `/functions/src/webhook.ts`
- Firestore Triggers: `/functions/src/firestore.ts`

---

## Recommendations

1. **Remove `streak_validations` Collection**
   - No active usage found
   - Consider archiving or deleting
   - Update Firestore security rules
   - Document decision

2. **Document Streak System**
   - Current implementation is transaction-based
   - Uses `user_stats.streak`, not separate collection
   - Version-based conflict detection documented

3. **Consolidate Documentation**
   - Multiple migration guides exist
   - Create single source of truth
   - Reference this document for API mappings

4. **Add Monitoring**
   - Track API endpoint usage
   - Monitor sync success rates
   - Alert on data consistency issues
   - Track subscription webhook reliability

5. **Improve Testing**
   - Add integration tests for API endpoints
   - Test transaction-based streak updates
   - Verify data consistency across collections
   - Test subscription webhook flows

---

## Related Documentation

- `/docs/firebase-collections/user-stats.md` - User stats schema
- `/docs/firebase-collections/API_TO_COLLECTION_MAP.md` - Collection mapping
- `/docs/STREAK_MIGRATION_GUIDE_2025-10-30.md` - Streak system v2
- `/docs/user-stats-migration/` - User stats migration docs
- `/functions/README.md` - Firebase Functions setup

---

**Last Updated:** 2025-10-31
**Maintained By:** Development Team
**Status:** ✅ Complete and Verified