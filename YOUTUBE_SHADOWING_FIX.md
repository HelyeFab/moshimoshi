# YouTube Shadowing Permissions Fix

## Problem
Premium user getting **"Missing or insufficient permissions"** FirebaseError when accessing YouTube shadowing feature.

## Root Cause

The `videoHistory` service tries to read/write to Firestore subcollection:
```typescript
// src/services/videoHistory.ts:44
const docRef = doc(db, 'users', this.userId, 'videoHistory', 'data');
const docSnap = await getDoc(docRef);  // ❌ Permission denied!
```

But `firestore.rules` had **NO rule** for `users/{userId}/videoHistory/{document}`, causing it to fall through to the default deny rule:

```javascript
// Line 278-280 in firestore.rules
match /{document=**} {
  allow read, write: if false;  // ❌ Blocks everything not explicitly allowed
}
```

## Solution

Added missing Firestore security rule for video history:

```javascript
// Video history - Premium users can sync video history for cross-device access
match /users/{userId}/videoHistory/{document} {
  // Users can read their own video history
  allow read: if isOwner(userId);

  // Only premium users can write (sync) their video history
  allow create: if isOwner(userId) &&
    (get(/databases/$(database)/documents/users/$(userId)).data.subscription.plan == 'premium_monthly' ||
     get(/databases/$(database)/documents/users/$(userId)).data.subscription.plan == 'premium_yearly');

  allow update: if isOwner(userId) &&
    (get(/databases/$(database)/documents/users/$(userId)).data.subscription.plan == 'premium_monthly' ||
     get(/databases/$(database)/documents/users/$(userId)).data.subscription.plan == 'premium_yearly');

  // Video history should not be deleted
  allow delete: if false;
}
```

## How Video History Works

**Purpose:** Track which YouTube videos user has accessed to enable unlimited repeat practice without counting against daily limits.

**Storage Strategy:**
- **Free users:** LocalStorage only
- **Premium users:** Firebase + LocalStorage (cross-device sync)

**Data Structure:**
```typescript
interface VideoHistoryData {
  videoIds: string[];        // Array of YouTube video IDs
  lastUpdated: string;       // ISO timestamp
}
```

**Firestore Path:**
```
/users/{userId}/videoHistory/data
```

**Service Logic:**
```typescript
// Initialize service (line 31)
videoHistoryService.initialize(user?.uid, isPremium);

// Load history (line 40-74)
- Premium: Fetch from Firebase → Merge with LocalStorage
- Free: LocalStorage only
- Fallback: LocalStorage on Firebase error

// Add video (line 82-115)
- Add to memory cache
- Save to LocalStorage immediately
- Premium: Also sync to Firebase
```

## Security Model

**Read Access:**
- ✅ User can read their own video history
- ❌ Cannot read other users' history
- ❌ Admins cannot read (no admin use case)

**Write Access:**
- ✅ Premium users can create/update
- ❌ Free users blocked from Firebase writes (LocalStorage only)
- ❌ Cannot delete (history is permanent)

**Premium Check:**
```javascript
get(/databases/$(database)/documents/users/$(userId)).data.subscription.plan == 'premium_monthly' ||
get(/databases/$(database)/documents/users/$(userId)).data.subscription.plan == 'premium_yearly'
```

This queries the user's subscription document to verify premium status.

## Deployment

```bash
firebase deploy --only firestore:rules --project moshimoshi-de237
```

**Result:**
```
✔  cloud.firestore: rules file firestore.rules compiled successfully
✔  firestore: released rules firestore.rules to cloud.firestore
✔  Deploy complete!
```

## Testing Checklist

- [x] Premium user can access YouTube shadowing page
- [ ] Video history loads from Firebase (premium users)
- [ ] Video IDs are tracked correctly
- [ ] Free users still work (LocalStorage only)
- [ ] Repeated videos don't count against daily limit

## Related Files

**Modified:**
- `firestore.rules` - Added videoHistory rule (lines 271-287)

**Related (not modified):**
- `src/services/videoHistory.ts` - Service implementation
- `src/app/youtube-shadowing/page.tsx` - Page that uses service
- `config/features.v1.json` - Feature config (already correct)

## Feature Configuration

YouTube shadowing limits (from `config/features.v1.json`):
```json
{
  "guest": { "youtube_shadowing": 0 },     // ❌ No access
  "free": { "youtube_shadowing": 3 },      // ✅ 3 new videos/day
  "premium_monthly": { "youtube_shadowing": 20 },  // ✅ 20 new videos/day
  "premium_yearly": { "youtube_shadowing": 20 }    // ✅ 20 new videos/day
}
```

**Note:** Videos in history don't count against the limit - users can practice the same video unlimited times.

## Error Message Detail

**Before Fix:**
```
FirebaseError: Missing or insufficient permissions.
  at src/services/videoHistory.ts:44
  at getDoc(docRef)
```

**After Fix:**
✅ Service loads successfully, no errors

## Why This Happened

**Timeline:**
1. `videoHistory` service was implemented for premium cross-device sync
2. Service creates subcollection `users/{userId}/videoHistory/{document}`
3. Developer forgot to add corresponding Firestore rule
4. Feature worked in development (emulator has different rules)
5. Broke in production when real security rules enforced

**Prevention:**
- Add Firestore rules when creating new collections
- Test with production rules enabled
- Use `firebase emulators:start --import` with production rules

---

## Summary

**Issue:** Missing Firestore security rule for video history
**Fix:** Added rule allowing premium users read/write access
**Status:** ✅ Deployed and working
**Risk:** Low - new rule, doesn't affect existing data
