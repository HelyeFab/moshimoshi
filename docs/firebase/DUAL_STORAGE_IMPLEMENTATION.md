# Dual Storage Implementation Guide

## Overview

The Moshimoshi app implements a three-tier storage model that ensures appropriate data persistence for different user types while respecting the premium business model.

## User Tiers & Storage Patterns

### 1. Guest Users (Not Authenticated)
- **Storage:** None
- **Data Persistence:** Session memory only
- **Features:** Limited exploration mode
- **Implementation:** All data exists in React state only

### 2. Free Users (Authenticated, Non-Premium)
- **Storage:** IndexedDB/LocalStorage ONLY
- **Data Persistence:** Local device storage
- **Features:** Full functionality with local-only data
- **Implementation:**
  - Data saved to IndexedDB for offline access
  - No Firebase writes
  - No cloud sync

### 3. Premium Users (Authenticated, Premium Subscription)
- **Storage:** BOTH IndexedDB + Firebase
- **Data Persistence:** Local + Cloud sync
- **Features:** Full functionality with cloud backup
- **Implementation:**
  - Data saved to IndexedDB for offline access
  - Data synced to Firebase for cloud backup
  - Cross-device synchronization

## Critical Implementation Pattern

### API Route Pattern

Every API route that handles user data MUST check premium status before Firebase operations:

```typescript
import { getStorageDecision } from '@/lib/api/storage-helper'

export async function POST(request: NextRequest) {
  const session = await getSession()

  // Check storage decision
  const decision = await getStorageDecision(session)

  if (decision.shouldWriteToFirebase) {
    // Premium user - save to Firebase
    await adminDb.collection('...').doc('...').set(data)
  }

  // Return storage location in response
  return NextResponse.json({
    data: result,
    storage: {
      location: decision.storageLocation, // 'local' or 'both'
      syncEnabled: decision.shouldWriteToFirebase
    }
  })
}
```

### Client Component Pattern

Client components must handle the storage location from API responses:

```typescript
const response = await fetch('/api/resource', { method: 'POST' })
const data = await response.json()

if (data.storage?.location === 'local') {
  // Free user - save to IndexedDB only
  await saveToIndexedDB(data.data)
} else if (data.storage?.location === 'both') {
  // Premium user - save to IndexedDB and data is already in Firebase
  await saveToIndexedDB(data.data)
}
```

## Storage Helper Utility

Location: `/src/lib/api/storage-helper.ts`

### Key Functions

#### `getStorageDecision(session)`
Determines storage location based on user's premium status.
- **CRITICAL:** Always fetches fresh user data from Firestore
- **Never** trusts cached session tier information
- Returns: `{ shouldWriteToFirebase, storageLocation, isPremium, plan }`

#### `createStorageResponse(data, decision)`
Creates consistent API responses with storage metadata.

#### `conditionalFirebaseWrite(decision, writeFunction)`
Conditionally executes Firebase operations based on premium status.

## Updated Components & APIs

### API Routes (Fixed)
- `/api/lists/route.ts` - List management
- `/api/todos/route.ts` - Todo management
- `/api/achievements/data/route.ts` - Achievement tracking
- `/api/progress/track/route.ts` - Progress tracking
- `/api/sessions/save/route.ts` - Session management
- `/api/review-sessions/route.ts` - Review sessions
- `/api/flashcards/decks/route.ts` - Flashcard decks
- `/api/drill/session/route.ts` - Drill sessions
- `/api/resources/route.ts` - Resources

### Client Components (Updated)
- `ListManager.ts` - Dual storage for lists
- `TodoStorage.ts` - IndexedDB management for todos
- `useTodos.ts` - Hook with storage location handling
- `AchievementStore.tsx` - Achievement storage
- `UniversalProgressManager.ts` - Progress tracking
- `DrillProgressManager.ts` - Drill-specific progress
- `KanjiMasteryProgressManager.ts` - Kanji progress

### Hooks (Already Correct)
- `useReviewData.ts` - Properly checks isPremium
- `useSubscription.ts` - Provides isPremium status

## Testing Checklist

### Free User Testing
1. Create a free account
2. Verify all features save to IndexedDB
3. Check Network tab - no Firebase writes
4. Verify data persists locally
5. Check offline functionality

### Premium User Testing
1. Create/upgrade to premium account
2. Verify features save to both IndexedDB and Firebase
3. Check Network tab - Firebase writes present
4. Test cross-device sync
5. Verify cloud backup works

## Common Pitfalls to Avoid

### ❌ DON'T
- Trust cached session.tier information
- Write directly to Firebase without checking premium status
- Assume all authenticated users are premium
- Skip the storage helper utility

### ✅ DO
- Always fetch fresh user data for premium checks
- Use the storage helper utility consistently
- Return storage location in API responses
- Handle both storage patterns in client code
- Test with both free and premium accounts

## Architecture Benefits

1. **Cost Optimization**: Free users don't consume Firebase resources
2. **Offline Support**: All users get offline functionality via IndexedDB
3. **Premium Value**: Cloud sync is a clear premium benefit
4. **Data Privacy**: Free users' data stays on their device
5. **Scalability**: Reduced Firebase usage = lower costs

## Migration Notes

For existing users who may have data in Firebase from before this change:
- Premium users: No impact, continue syncing
- Free users downgraded from premium: Data remains in Firebase but becomes read-only
- Free users who never had premium: No Firebase data exists

## Monitoring & Debugging

### Debug Flags
```javascript
// Enable storage debugging
localStorage.setItem('debug:storage', 'true')

// Check current storage location
console.log('[Storage] Location:', response.storage?.location)
```

### Common Issues

1. **Free user data appearing in Firebase**
   - Check: API route missing premium check
   - Fix: Add getStorageDecision() check

2. **Premium user data not syncing**
   - Check: API returning wrong storage location
   - Fix: Verify premium status check logic

3. **Offline data not persisting**
   - Check: IndexedDB initialization
   - Fix: Ensure IndexedDB save happens for all users

## Future Enhancements

1. **Sync Queue**: Implement queue for premium users to sync when coming online
2. **Migration Tool**: Help free users migrate data when upgrading
3. **Storage Analytics**: Track storage usage patterns
4. **Compression**: Optimize IndexedDB storage size
5. **Selective Sync**: Let premium users choose what to sync

---

Last Updated: 2025-01-25
Author: System Architecture Team