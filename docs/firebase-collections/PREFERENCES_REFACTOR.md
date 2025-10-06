# User Preferences Refactor

## Overview
This document describes the refactoring of user preferences storage in Moshimoshi to eliminate confusion and enable full preferences sync for premium users.

## Changes Made

### 1. Collection Rename: `userPreferences` → `villageLayout`

**Problem**: The `userPreferences` collection was misleading. It only stored stall order for the learning village, NOT actual user preferences (theme, language, notifications, etc.).

**Solution**: Renamed to `villageLayout` to clarify its purpose.

**Files Changed**:
- `src/hooks/useStallOrder.ts` - Updated FIREBASE_COLLECTION constant
- `scripts/download-user-firebase-data.js` - Updated collection list

**Migration**: Run `node scripts/migrate-userPreferences-to-villageLayout.js` to migrate existing data.

---

### 2. Full Preferences Sync to Firebase

**Problem**: Only `theme`, `language`, and `palette` were syncing to Firebase. Full preferences (notifications, learning, privacy, accessibility) were only stored in IndexedDB, meaning premium users lost these settings across devices.

**Solution**: Extended the `/api/user/profile` endpoint to accept and return ALL preference fields.

**Files Changed**:
- `src/app/api/user/profile/route.ts`
  - Added `preferences` field to `ProfileUpdateSchema` with all sub-fields
  - Updated `UserProfile` interface to include full preferences structure
  - Modified PATCH handler to save complete preferences object
  - Modified GET handler to return preferences from Firebase

- `src/utils/preferencesManager.ts`
  - Updated `syncToFirebase()` to send all preference fields
  - Updated `getPreferencesFromFirebase()` to read all preference fields

---

## Storage Architecture (Updated)

### Guest Users
- **Storage**: None (session only)
- **Persistence**: No

### Free Users
- **Storage**: IndexedDB only
- **Persistence**: Per-device
- **Sync**: No cross-device sync

### Premium Users
- **Storage**: IndexedDB + Firebase (`users/{uid}.preferences`)
- **Persistence**: Cross-device
- **Sync**: Automatic (debounced 500ms)

---

## Firebase Structure

### `users/{userId}`
Main user document with nested preferences field:

```typescript
{
  // ... other user fields
  preferences: {
    theme: 'light' | 'dark' | 'system',
    language: 'en' | 'ja' | 'fr' | 'it' | 'de' | 'es',
    palette: string,
    notifications: {
      dailyReminder: boolean,
      achievementAlerts: boolean,
      weeklyProgress: boolean,
      marketingEmails: boolean
    },
    learning: {
      autoplay: boolean,
      furigana: boolean,
      romaji: boolean,
      soundEffects: boolean,
      hapticFeedback: boolean
    },
    privacy: {
      publicProfile: boolean,
      showProgress: boolean,
      shareAchievements: boolean,
      hideFromLeaderboard: boolean
    },
    accessibility: {
      largeText: boolean,
      highContrast: boolean,
      reduceMotion: boolean,
      screenReader: boolean
    }
  }
}
```

### `villageLayout/{userId}` (formerly `userPreferences`)
Stores learning village stall customization:

```typescript
{
  stallOrder: string[],  // Array of feature IDs
  lastUpdated: Timestamp
}
```

### `leaderboard_optouts/{userId}`
Privacy feature - separate collection for GDPR compliance:

```typescript
{
  userId: string,
  optedOut: boolean,
  updatedAt: Timestamp
}
```

---

## API Endpoints

### `PATCH /api/user/profile`
Update user profile including preferences.

**Request Body** (all fields optional):
```json
{
  "displayName": "string",
  "preferences": {
    "theme": "dark",
    "language": "en",
    "palette": "sakura",
    "notifications": { ... },
    "learning": { ... },
    "privacy": { ... },
    "accessibility": { ... }
  }
}
```

### `GET /api/user/profile`
Get user profile including preferences.

**Response**:
```json
{
  "success": true,
  "data": {
    "uid": "...",
    "email": "...",
    "preferences": { ... }
  }
}
```

---

## Migration Steps

### For Development/Testing
1. Run migration script:
   ```bash
   node scripts/migrate-userPreferences-to-villageLayout.js
   ```

2. Verify data in Firebase Console:
   - Check `villageLayout` collection has all user data
   - Verify `stallOrder` arrays are intact

3. Test in app:
   - Premium users should see their preferences sync across devices
   - Stall order customization should still work

### For Production
1. Deploy code changes
2. Run migration script in production environment
3. Monitor logs for errors
4. After 2-3 weeks of verification, manually delete old `userPreferences` collection

---

## Testing Checklist

- [ ] Guest users: Settings apply for session only
- [ ] Free users: Settings save to IndexedDB
- [ ] Premium users: Settings sync to Firebase
- [ ] Premium users: Settings persist across devices
- [ ] Village layout customization still works
- [ ] Leaderboard opt-out still works independently
- [ ] Migration script completes without errors

---

## Breaking Changes

### For Users
- **None** - Migration is transparent
- Premium users will now benefit from full preferences sync

### For Developers
- Update any direct references to `userPreferences` collection
- Use `villageLayout` for stall order operations
- Use `users/{uid}.preferences` for user settings

---

## Future Improvements

1. Add versioning to preferences schema
2. Implement conflict resolution for offline edits
3. Add preferences export/import for user control
4. Consider moving `leaderboard_optouts` into `users/{uid}.preferences.privacy.hideFromLeaderboard` for consistency

---

## Questions?

Contact: [Your contact info]
Created: 2025-10-06
Last Updated: 2025-10-06
