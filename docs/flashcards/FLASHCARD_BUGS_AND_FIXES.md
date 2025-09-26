# Flashcard System - Bug Tracker & Fixes

## 🔴 Critical Bugs

### BUG-001: Duplicate Deck Creation on Sync Failure
**Location**: `FlashcardManager.ts:162-203`
**Issue**: When Firebase save fails for premium users, deck is still saved locally, creating duplicates on retry
**Impact**: High - Data inconsistency
**Fix Status**: Pending
```typescript
// Problem: Deck saved locally even when Firebase fails
if (isPremium && userId !== 'guest') {
  // If this fails, execution continues...
  const response = await fetch('/api/flashcards/decks', {...});
}
// Deck still saved to IndexedDB
await db.put('decks', deck);
```

### BUG-002: UpdateDeck Method Name Collision
**Location**: `FlashcardManager.ts:214,484`
**Issue**: Two methods with same name `updateDeck` with different signatures
**Impact**: High - Confusing API, potential runtime errors
**Fix Status**: Pending

### BUG-003: Memory Leak in StudySession
**Location**: `StudySession.tsx`
**Issue**: Timer and event listeners not cleaned up on unmount
**Impact**: Medium - Performance degradation
**Fix Status**: Pending

## 🟡 Medium Priority Bugs

### BUG-004: Card Metadata Undefined Handling
**Location**: `FlashcardAdapter.ts:52-63`
**Issue**: Optional chaining not consistently used for metadata access
**Impact**: Medium - Potential crashes with malformed data
**Fix Status**: Pending

### BUG-005: Race Condition in Deck Loading
**Location**: `flashcards/page.tsx:55-77`
**Issue**: `loadData` can be called multiple times if user changes quickly
**Impact**: Medium - Duplicate network requests
**Fix Status**: Pending

### BUG-006: Missing Error Boundaries
**Location**: All flashcard components
**Issue**: No error boundaries to catch component crashes
**Impact**: Medium - Entire page crashes on component error
**Fix Status**: Pending

## 🟢 Minor Bugs

### BUG-007: Inconsistent Card Order After Sync
**Location**: `FlashcardManager.ts`
**Issue**: Cards array order not preserved during sync
**Impact**: Low - UX inconsistency
**Fix Status**: Pending

### BUG-008: Export CSV Format Issues
**Location**: `FlashcardManager.ts:588-603`
**Issue**: Special characters not properly escaped in CSV
**Impact**: Low - Export/import data loss
**Fix Status**: Pending

### BUG-009: Stats Not Real-time Updated
**Location**: `flashcards/page.tsx:224-234`
**Issue**: Stats calculated on render, not reactive to changes
**Impact**: Low - Stale UI data
**Fix Status**: Pending

## 🐛 Edge Cases

### EDGE-001: IndexedDB Blocked by User
**Issue**: No fallback when IndexedDB access is denied
**Impact**: High for affected users
**Solution**: Implement in-memory fallback

### EDGE-002: Large Deck Performance
**Issue**: Loading 500+ cards causes UI freeze
**Impact**: Medium for power users
**Solution**: Implement pagination/virtualization

### EDGE-003: Offline Sync Queue Overflow
**Issue**: Sync queue can grow indefinitely offline
**Impact**: Low - Storage exhaustion
**Solution**: Implement queue size limits

## 🔧 Fixed Bugs

### FIXED-001: Undefined Values in Firestore
**Location**: `decks/route.ts:155-195`
**Issue**: Firestore rejects undefined values
**Fix**: Added `cleanFirestoreData` utility
**Date**: Previously fixed
**Solution**:
```typescript
const cleanedDeck = cleanFirestoreData(newDeck);
```

## 📊 Bug Statistics

- **Total Identified**: 12
- **Critical**: 3
- **Medium**: 3
- **Minor**: 3
- **Edge Cases**: 3
- **Fixed**: 1

## 🎯 Priority Fix Order

1. **BUG-001**: Duplicate deck creation
2. **BUG-002**: Method name collision
3. **BUG-005**: Race condition in loading
4. **BUG-003**: Memory leak in StudySession
5. **BUG-004**: Metadata handling
6. **EDGE-001**: IndexedDB fallback

## 🛠️ Quick Fixes Available

### Fix for BUG-002 (Method Collision)
```typescript
// Rename the second updateDeck to updateDeckMetadata
async updateDeckMetadata(deckId: string, updates: UpdateDeckRequest, userId: string, isPremium: boolean)
```

### Fix for BUG-003 (Memory Leak)
```typescript
useEffect(() => {
  return () => {
    // Cleanup timers and listeners
    clearTimeout(timeoutRef.current);
  };
}, []);
```

### Fix for BUG-004 (Metadata Safety)
```typescript
// Use optional chaining consistently
srsLevel: card.metadata?.srsLevel ?? 0,
easeFactor: card.metadata?.easeFactor ?? 2.5,
```

## 🔍 Testing Checklist

- [ ] Test deck creation with network failure
- [ ] Test bulk card operations (100+ cards)
- [ ] Test offline → online sync scenarios
- [ ] Test concurrent deck updates
- [ ] Test import with malformed data
- [ ] Test session cleanup on navigation
- [ ] Test IndexedDB quota exceeded
- [ ] Test Firebase rate limiting

## 📈 Monitoring Points

1. **Error Rate**: Track failures in FlashcardManager operations
2. **Sync Success Rate**: Monitor Firebase sync success/failure ratio
3. **Performance**: Track deck load times by card count
4. **Storage Usage**: Monitor IndexedDB size growth
5. **User Impact**: Track affected users by tier

---

Last Updated: 2025-01-26
Next Review: After implementing Phase 2 fixes