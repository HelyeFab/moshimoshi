# User Profile Structure

## Overview

The user profile system in Moshimoshi uses a **flat data structure** optimized for Firestore queries and maintainability. This document defines the complete user data model, tier system, and data lifecycle.

## User Tier System

### Tier Definitions

| Tier | Identifier | Description | Stripe Required |
|------|------------|-------------|-----------------|
| **Guest** | `guest` | Unauthenticated users | No |
| **Free** | `free` | Registered users without subscription | No |
| **Premium Monthly** | `premium.monthly` | Active monthly subscription | Yes |
| **Premium Yearly** | `premium.yearly` | Active yearly subscription | Yes |

### Feature Matrix

```typescript
const TIER_FEATURES = {
  guest: {
    lessonsPerDay: 3,
    hasAds: true,
    canSaveProgress: false,
    hasStreaks: false,
    hasOfflineMode: false,
    maxPracticeDecks: 0,
    canExportData: false,
    supportPriority: 'none'
  },
  free: {
    lessonsPerDay: 5,
    hasAds: true,
    canSaveProgress: true,
    hasStreaks: true,
    hasOfflineMode: false,
    maxPracticeDecks: 3,
    canExportData: false,
    supportPriority: 'standard'
  },
  'premium.monthly': {
    lessonsPerDay: -1, // unlimited
    hasAds: false,
    canSaveProgress: true,
    hasStreaks: true,
    hasOfflineMode: true,
    maxPracticeDecks: -1, // unlimited
    canExportData: true,
    supportPriority: 'priority',
    hasAdvancedStats: true,
    hasCustomDecks: true,
    hasSRSCustomization: true
  },
  'premium.yearly': {
    // Same as monthly with discount
    lessonsPerDay: -1,
    hasAds: false,
    canSaveProgress: true,
    hasStreaks: true,
    hasOfflineMode: true,
    maxPracticeDecks: -1,
    canExportData: true,
    supportPriority: 'priority',
    hasAdvancedStats: true,
    hasCustomDecks: true,
    hasSRSCustomization: true,
    // Yearly exclusive
    hasEarlyAccess: true,
    yearlyBadge: true
  }
}
```

## Complete User Profile Schema

### TypeScript Interface

```typescript
interface UserProfile {
  // ==================
  // Identity Fields
  // ==================
  uid: string;                    // Firebase UID (primary key)
  email: string;                  // User email (unique index)
  emailVerified: boolean;         // Email verification status
  authProvider: 'email' | 'google' | 'magiclink'; // How user signed up
  
  // ==================
  // Profile Data
  // ==================
  displayName?: string;           // User's display name
  photoURL?: string;              // Profile picture URL
  username?: string;              // Unique username (optional)
  bio?: string;                   // User bio (max 200 chars)
  
  // ==================
  // Subscription Data (Flat)
  // ==================
  tier: 'guest' | 'free' | 'premium.monthly' | 'premium.yearly';
  stripeCustomerId?: string;      // Stripe customer ID
  stripeSubscriptionId?: string;  // Active subscription ID
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
  subscriptionValidUntil?: Timestamp;     // Current period end
  subscriptionCanceledAt?: Timestamp;     // When user canceled
  subscriptionLastVerified?: Timestamp;   // Last Stripe sync
  trialEndsAt?: Timestamp;               // Trial expiration
  
  // ==================
  // Learning Progress (Flat)
  // ==================
  currentLevel: 'beginner' | 'elementary' | 'intermediate' | 'advanced';
  totalXp: number;                // Total experience points
  currentStreak: number;          // Days in a row
  longestStreak: number;          // Best streak ever
  lastStudyDate?: Timestamp;      // Last activity
  lessonsCompleted: number;       // Total lessons done
  minutesStudied: number;         // Total study time
  wordsLearned: number;          // Vocabulary count
  kanjiLearned: number;          // Kanji count
  accuracyRate: number;          // Overall accuracy (0-100)
  
  // ==================
  // Learning Preferences (Flat)
  // ==================
  dailyGoalMinutes: number;       // Daily study goal (default: 10)
  reminderTime?: string;          // Daily reminder "HH:MM"
  reminderTimezone?: string;      // User's timezone
  theme: 'light' | 'dark' | 'auto'; // UI theme
  fontSize: 'small' | 'medium' | 'large'; // Text size preference
  autoPlayAudio: boolean;         // Auto-play pronunciation
  showFurigana: boolean;          // Show reading hints
  studyMode: 'casual' | 'regular' | 'intensive'; // Pace preference
  
  // ==================
  // System Metadata (Flat)
  // ==================
  createdAt: Timestamp;           // Account creation
  updatedAt: Timestamp;           // Last profile update
  lastLoginAt: Timestamp;         // Last sign in
  loginCount: number;             // Total logins
  lastActiveAt?: Timestamp;       // Last user activity
  userState: 'active' | 'suspended' | 'deleted' | 'banned';
  suspensionReason?: string;      // Why suspended
  deletedAt?: Timestamp;          // Soft delete timestamp
  
  // ==================
  // Platform & Device (Flat)
  // ==================
  platform?: 'web' | 'ios' | 'android' | 'pwa';
  deviceId?: string;              // For offline sync
  appVersion?: string;            // Client version
  lastSyncAt?: Timestamp;         // Offline sync timestamp
  
  // ==================
  // Administrative (Flat)
  // ==================
  isAdmin?: boolean;              // Admin access
  isBetaTester?: boolean;         // Beta features access
  isContentCreator?: boolean;     // Can create content
  flags?: string[];               // Feature flags
  
  // ==================
  // Analytics & Attribution (Flat)
  // ==================
  referralSource?: string;        // How user found us
  referralCode?: string;          // User's referral code
  referredBy?: string;            // Who referred them
  utmSource?: string;             // UTM campaign source
  utmMedium?: string;             // UTM campaign medium
  utmCampaign?: string;           // UTM campaign name
  cohort?: string;                // User cohort for A/B
  experiments?: Record<string, string>; // A/B test groups
  
  // ==================
  // Compliance & Legal (Flat)
  // ==================
  gdprConsentAt?: Timestamp;      // GDPR consent timestamp
  marketingConsentAt?: Timestamp; // Marketing email consent
  termsAcceptedAt?: Timestamp;    // ToS acceptance
  dataExportRequestedAt?: Timestamp; // GDPR export request
  accountDeletionRequestedAt?: Timestamp; // Deletion request
}
```

### Firestore Document Example

```json
{
  "uid": "usr_abc123def456",
  "email": "user@example.com",
  "emailVerified": true,
  "authProvider": "google",
  
  "displayName": "Tanaka Yuki",
  "photoURL": "https://storage.googleapis.com/...",
  "username": "yuki_learns",
  
  "tier": "premium.monthly",
  "stripeCustomerId": "cus_Abc123Def456",
  "stripeSubscriptionId": "sub_1234567890",
  "subscriptionStatus": "active",
  "subscriptionValidUntil": "2024-02-08T00:00:00Z",
  "subscriptionLastVerified": "2024-01-08T12:00:00Z",
  
  "currentLevel": "intermediate",
  "totalXp": 12500,
  "currentStreak": 42,
  "longestStreak": 67,
  "lastStudyDate": "2024-01-08T09:30:00Z",
  "lessonsCompleted": 324,
  "minutesStudied": 4280,
  "wordsLearned": 856,
  "kanjiLearned": 234,
  "accuracyRate": 87.5,
  
  "dailyGoalMinutes": 15,
  "reminderTime": "20:00",
  "reminderTimezone": "Asia/Tokyo",
  "theme": "auto",
  "fontSize": "medium",
  "autoPlayAudio": true,
  "showFurigana": true,
  "studyMode": "regular",
  
  "createdAt": "2023-06-15T10:00:00Z",
  "updatedAt": "2024-01-08T12:00:00Z",
  "lastLoginAt": "2024-01-08T08:00:00Z",
  "loginCount": 245,
  "userState": "active",
  
  "platform": "pwa",
  "appVersion": "1.2.3",
  
  "referralSource": "google_search",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "japanese_learning_2024"
}
```

## Data Lifecycle

### 1. Guest → Free User Migration

```typescript
async function migrateGuestToUser(guestData: GuestProgress, userId: string) {
  // Preserve guest progress
  const userProfile: Partial<UserProfile> = {
    uid: userId,
    tier: 'free',
    createdAt: Timestamp.now(),
    
    // Migrate learning progress
    totalXp: guestData.xp || 0,
    lessonsCompleted: guestData.lessonsCompleted || 0,
    wordsLearned: guestData.wordsLearned || 0,
    
    // Set defaults
    currentLevel: 'beginner',
    currentStreak: 0,
    dailyGoalMinutes: 10,
    theme: 'auto',
    userState: 'active'
  };
  
  await db.collection('users').doc(userId).set(userProfile);
  
  // Clear guest data from localStorage
  localStorage.removeItem('guestProgress');
}
```

### 2. Free → Premium Upgrade

```typescript
async function upgradeToPremiun(
  userId: string, 
  tier: 'premium.monthly' | 'premium.yearly',
  stripeData: StripeSubscription
) {
  const updates: Partial<UserProfile> = {
    tier,
    stripeCustomerId: stripeData.customerId,
    stripeSubscriptionId: stripeData.subscriptionId,
    subscriptionStatus: 'active',
    subscriptionValidUntil: stripeData.currentPeriodEnd,
    subscriptionLastVerified: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  await db.collection('users').doc(userId).update(updates);
  
  // Clear all caches
  await redis.del([
    `tier:${userId}`,
    `profile:${userId}`,
    `features:${userId}`
  ]);
  
  // Log upgrade event
  await logAuditEvent('user.tier_upgraded', { userId, tier });
}
```

### 3. Premium → Free Downgrade

```typescript
async function downgradeToFree(userId: string, reason: string) {
  const updates: Partial<UserProfile> = {
    tier: 'free',
    subscriptionStatus: 'canceled',
    subscriptionCanceledAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  // Keep Stripe IDs for history
  await db.collection('users').doc(userId).update(updates);
  
  // Preserve premium content access until subscriptionValidUntil
  
  // Clear caches
  await redis.del([`tier:${userId}`, `profile:${userId}`]);
  
  // Log downgrade
  await logAuditEvent('user.tier_downgraded', { userId, reason });
}
```

### 4. Account Deletion (Soft Delete)

```typescript
async function deleteUserAccount(userId: string) {
  // Soft delete - preserve data for 30 days
  const updates: Partial<UserProfile> = {
    userState: 'deleted',
    deletedAt: Timestamp.now(),
    email: `deleted_${userId}@deleted.local`, // Anonymize
    displayName: null,
    photoURL: null,
    updatedAt: Timestamp.now()
  };
  
  await db.collection('users').doc(userId).update(updates);
  
  // Cancel active subscriptions
  if (user.stripeSubscriptionId) {
    await stripe.subscriptions.cancel(user.stripeSubscriptionId);
  }
  
  // Schedule hard delete after 30 days
  await scheduleJob('hard_delete_user', userId, { 
    runAt: Date.now() + 30 * 24 * 60 * 60 * 1000 
  });
}
```

## Indexing Strategy

### Firestore Composite Indexes

```javascript
// Required composite indexes for efficient queries

// 1. Premium users by status
users: tier ASC, subscriptionStatus ASC

// 2. Active users by last login
users: userState ASC, lastLoginAt DESC

// 3. Streak leaderboard
users: currentStreak DESC, totalXp DESC

// 4. Subscription expiration check
users: tier ASC, subscriptionValidUntil ASC

// 5. User search
users: username ASC, displayName ASC
```

## Profile Validation

### Zod Schema for Validation

```typescript
import { z } from 'zod';

const UserProfileSchema = z.object({
  // Required fields
  uid: z.string().min(1),
  email: z.string().email(),
  tier: z.enum(['guest', 'free', 'premium.monthly', 'premium.yearly']),
  createdAt: z.date(),
  userState: z.enum(['active', 'suspended', 'deleted', 'banned']),
  
  // Optional fields with constraints
  displayName: z.string().max(50).optional(),
  bio: z.string().max(200).optional(),
  username: z.string()
    .regex(/^[a-zA-Z0-9_]{3,20}$/)
    .optional(),
  
  // Numbers with ranges
  totalXp: z.number().min(0).default(0),
  currentStreak: z.number().min(0).default(0),
  dailyGoalMinutes: z.number().min(5).max(120).default(10),
  accuracyRate: z.number().min(0).max(100).default(0),
  
  // Subscription fields
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  subscriptionStatus: z.enum([
    'active', 'canceled', 'past_due', 'trialing', 'paused'
  ]).optional()
});

// Usage
function validateProfile(data: unknown): UserProfile {
  return UserProfileSchema.parse(data);
}
```

## Privacy Considerations

### PII Classification

| Field | PII Level | Encryption | Export | Delete |
|-------|-----------|------------|--------|--------|
| email | High | Yes | Yes | Anonymize |
| displayName | Medium | No | Yes | Yes |
| photoURL | Low | No | Yes | Yes |
| stripeCustomerId | High | No | No | Retain |
| learningProgress | Low | No | Yes | Optional |

### GDPR Compliance

```typescript
// Data export format
async function exportUserData(userId: string): Promise<UserDataExport> {
  const profile = await db.collection('users').doc(userId).get();
  const progress = await db.collection('progress').where('userId', '==', userId).get();
  
  return {
    profile: sanitizeForExport(profile.data()),
    progress: progress.docs.map(d => d.data()),
    exportedAt: new Date().toISOString(),
    format: 'json'
  };
}
```

---

*Next: [Authentication Flows →](./03-authentication-flows.md)*