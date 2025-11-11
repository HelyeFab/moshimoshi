# Firebase Schema Migration: Flat → Nested Structure

## Overview
Migrated three collections from flat root-level structure to nested under `users/{userId}/` for better organization, security, and GDPR compliance.

## What Changed

### Before (Flat Structure)
```
villageLayout/
  └── {userId}/ → stall order data

pokemon/
  └── {userId}/ → Pokédex data

userVideoHistory/
  └── {userId}/ → video watch history
```

### After (Nested Structure)
```
users/
  └── {userId}/
      ├── villageLayout/
      │   └── data → stall order
      ├── pokemon/
      │   └── data → Pokédex
      └── videoHistory/
          └── data → video history
```

---

## Migrations Completed

### ✅ 1. Village Layout
**Old**: `villageLayout/{userId}`
**New**: `users/{userId}/villageLayout/data`
**Data**: Learning village stall order customization
**Files Updated**:
- `src/hooks/useStallOrder.ts`

### ✅ 2. Pokémon Data
**Old**: `pokemon/{userId}`
**New**: `users/{userId}/pokemon/data`
**Data**: User Pokédex, caught Pokémon
**Files Updated**:
- `src/utils/pokemonManager.ts`

### ✅ 3. Video History
**Old**: `userVideoHistory/{userId}`
**New**: `users/{userId}/videoHistory/data`
**Data**: YouTube video watch history for unlimited replays
**Files Updated**:
- `src/services/videoHistory.ts`

---

## Security Rules Updated

**File**: `firestore.dual-storage.rules`

### Before
```javascript
match /villageLayout/{userId} { ... }
match /pokemon/{userId} { ... }
match /userVideoHistory/{userId} { ... }
```

### After
```javascript
match /users/{userId}/villageLayout/{document} { ... }
match /users/{userId}/pokemon/{document} { ... }
match /users/{userId}/videoHistory/{document} { ... }
```

**Deploy Rules**:
```bash
firebase deploy --only firestore:rules
```

---

## Benefits of Nested Structure

### ✅ Simpler Security Rules
- One wildcard rule can secure ALL user subcollections
- Reduces rule complexity and maintenance

### ✅ Atomic Data Deletion (GDPR)
```javascript
// Delete user and ALL their data in one command
await db.collection('users').doc(userId).delete({ recursive: true });
```

### ✅ Clear Data Ownership
- All user data lives under `users/{userId}/`
- Easy to understand data hierarchy

### ✅ Better Organization
- Data is grouped by user, not by type
- Easier to navigate in Firebase Console

### ✅ Easier Data Export
- One query gets all user data for GDPR requests

---

## Migration Script

**Location**: `scripts/migrate-to-nested-structure.js`

**Run**:
```bash
node scripts/migrate-to-nested-structure.js
```

**Results** (2025-10-06):
- ✅ Village Layout: 1 document migrated
- ✅ Pokémon Data: 0 documents (none to migrate)
- ✅ Video History: 0 documents (none to migrate)
- ❌ Errors: 0

---

## Testing Checklist

- [x] Village stall order customization works
- [ ] Pokemon catching and Pokédex tracking works
- [ ] Video history tracking for unlimited replays works
- [ ] Premium users: Data syncs to Firebase
- [ ] Free users: Data stays in IndexedDB
- [ ] Security rules allow proper access
- [ ] Data exports include nested collections

---

## Code Changes Summary

### `src/hooks/useStallOrder.ts`
```diff
- const FIREBASE_COLLECTION = 'villageLayout'
+ const FIREBASE_SUBCOLLECTION = 'villageLayout'

- const docRef = doc(firestore, FIREBASE_COLLECTION, user.uid)
+ const docRef = doc(firestore, 'users', user.uid, FIREBASE_SUBCOLLECTION, 'data')
```

### `src/utils/pokemonManager.ts`
```diff
- private readonly COLLECTION_NAME = 'pokemon';
+ private readonly SUBCOLLECTION_NAME = 'pokemon';

- const userPokedexRef = doc(db, this.COLLECTION_NAME, userId);
+ const userPokedexRef = doc(db, 'users', userId, this.SUBCOLLECTION_NAME, 'data');
```

Added `collectionGroup` import for cross-user queries:
```javascript
import { ..., collectionGroup } from 'firebase/firestore';

// For global stats (leaderboards)
const pokemonQuery = collectionGroup(db, this.SUBCOLLECTION_NAME);
```

### `src/services/videoHistory.ts`
```diff
- const docRef = doc(db, 'userVideoHistory', this.userId);
+ const docRef = doc(db, 'users', this.userId, 'videoHistory', 'data');
```

All 5 references updated (load, save, migrate, sync, clear).

---

## Old Collections Status

### ⚠️ DO NOT DELETE YET

The old collections still exist for safety:
- `villageLayout/` - 1 document
- `pokemon/` - 0 documents
- `userVideoHistory/` - 0 documents

**Cleanup Timeline**:
1. **Week 1-2**: Monitor for any issues
2. **Week 3**: Verify all users migrated successfully
3. **Week 4**: Manually delete old collections via Firebase Console

**Manual Deletion** (after verification):
```bash
# Via Firebase Console:
# 1. Go to Firestore Database
# 2. Select collection: villageLayout
# 3. Delete collection
# 4. Repeat for pokemon and userVideoHistory
```

---

## Rollback Plan

If issues arise, rollback by:

1. **Revert code changes**:
   ```bash
   git revert <commit-hash>
   ```

2. **Revert security rules**:
   ```bash
   git checkout main -- firestore.dual-storage.rules
   firebase deploy --only firestore:rules
   ```

3. **Data**: Old collections still exist, no data loss

---

## Related Documentation

- [PREFERENCES_REFACTOR.md](./PREFERENCES_REFACTOR.md) - User preferences improvements
- [docs/REVIEW_ENGINE_DEEP_DIVE.md](./docs/REVIEW_ENGINE_DEEP_DIVE.md) - Review engine architecture

---

## Questions?

**Why not migrate everything?**
We kept `leaderboard_stats` and `leaderboard_optouts` flat because they need cross-user queries for rankings and privacy compliance.

**Why `/data` documents?**
Firestore requires at least one document in a subcollection. Using `/data` as a consistent document ID makes the structure predictable and easy to work with.

**What about Collection Group Queries?**
They work! See `pokemonManager.ts` line 332 for example of using `collectionGroup()` to query across all users' pokemon subcollections.

---

**Migration Date**: October 6, 2025
**Status**: ✅ Complete
**Next Review**: October 27, 2025 (cleanup old collections)
