# Kanji Import Incident Report

**Date**: 2026-03-23
**User**: emmanuelfabiani23@gmail.com (UID: `8onZzlQg3tQxkw8pinSF9ow4Q6j2`)
**Status**: ❌ INCOMPLETE - Kanji not syncing to frontend

---

## Original Task

**Goal**: Import kanji from two Markdown files (Minna no Nihongo Lessons 8 & 9) into user's Firebase progress document, marking them as "learned" so they appear in the "My Kanji Collection" dashboard.

**Source Files**:
- `/home/helye/Documents/UnSync/Life-Org/04_JapaneseLanguage/Minna/Lesson_8/Kanji_Triage_Lesson_8.md`
- `/home/helye/Documents/UnSync/Life-Org/04_JapaneseLanguage/Minna/Lesson_9/Kanji_Triage_Lesson_9.md`

**Expected Outcome**:
- Extract all kanji from both "Write" (✍️) and "Recognize" (👁️) sections
- Add them to Firebase with `status: 'learned'`, `viewCount: 6`
- Kanji should appear in "My Kanji Collection" dashboard in kanji browser

---

## What Actually Happened

### ✅ Script Created Successfully
- Created: `/home/helye/DevProjects/nextjs/moshimoshi/scripts/import-kanji-to-firebase.js`
- Script parsed markdown files correctly
- Extracted 90 unique kanji total:
  - Lesson 8: 16 write + 34 recognize = 50 kanji
  - Lesson 9: 18 write + 26 recognize = 44 kanji
  - Some overlap between lessons

### ✅ Firebase Update Successful
- Document: `progress/8onZzlQg3tQxkw8pinSF9ow4Q6j2_kanji`
- 90 kanji written to Firebase with correct structure
- All kanji have `status: 'learned'`, `viewCount: 6`

### ❌ Frontend Not Showing New Kanji
- Dashboard still shows only 4 kanji (一, 高, 安, 静)
- Expected: 90 kanji should appear
- **Root Cause**: Kanji are in Firebase but NOT syncing to IndexedDB

### ⚠️ Data Loss Issue
- Original 4 kanji (一, 中, 会, 人) were in IndexedDB only
- Script OVERWROTE Firebase document instead of merging
- Original 4 kanji were lost from Firebase (but still in local IndexedDB)
- Now showing different 4 kanji (一, 高, 安, 静) - unclear origin

---

## Dual-Tier Storage Architecture

### System Design

**Two Storage Layers**:
1. **IndexedDB** (browser local storage)
   - Used by: ALL authenticated users
   - Persists across sessions
   - Offline-capable
   - Primary data source for UI rendering

2. **Firebase Firestore** (cloud storage)
   - Used by: PREMIUM users only
   - Syncs across devices
   - Backup and persistence
   - Secondary data source

### Sync Flow (Premium Users)

```
┌─────────────────────────────────────────────────────────┐
│                    User Opens Page                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│   KanjiBrowserPage.tsx (line 207-246)                  │
│   - Calls refreshKanjiProgress()                        │
│   - Which calls getKanjiProgressMap(user, isPremium)    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│   KanjiProgressManager.getKanjiProgressMap()            │
│   src/utils/kanjiProgressManager.ts (line 82-85)       │
│   - Calls parent getProgress(userId, 'kanji', isPremium)│
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│   UniversalProgressManager.getProgress()                │
│   src/lib/review-engine/progress/                       │
│   UniversalProgressManager.ts (line 601-626)            │
│                                                          │
│   1. Load from IndexedDB (line 612)                     │
│      localData = loadFromIndexedDB(userId, contentType) │
│                                                          │
│   2. IF isPremium && online (line 615):                 │
│      cloudData = loadFromFirebase(userId, contentType)  │
│      return mergeProgress(localData, cloudData)         │
│                                                          │
│   3. ELSE:                                              │
│      return localData only                              │
└─────────────────────────────────────────────────────────┘
```

### Critical Issue: Merge Does NOT Write Back

**Current Behavior** (line 701-713):
```typescript
protected mergeProgress(local: Map<string, T>, cloud: Map<string, T>): Map<string, T> {
  const merged = new Map(local)

  for (const [contentId, cloudItem] of cloud) {
    const localItem = local.get(contentId)

    if (!localItem || cloudItem.updatedAt > localItem.updatedAt) {
      merged.set(contentId, cloudItem)
    }
  }

  return merged  // ⚠️ Returns merged Map but does NOT persist to IndexedDB
}
```

**Problem**:
- Merges Firebase data into memory-only Map
- Does NOT save merged data back to IndexedDB
- On next page refresh, Firebase data is re-merged but never persisted locally
- UI may or may not see the merged data depending on React state management

---

## Files Modified/Created

### Created Scripts
1. **`scripts/import-kanji-to-firebase.js`** ✅
   - Parses markdown kanji triage files
   - Extracts kanji from summary tables
   - Writes to Firebase via Admin SDK
   - **Issue**: Uses `set({ items: updates }, { merge: true })` which overwrites entire `items` map

2. **`scripts/verify-firebase-kanji.js`** ✅
   - Verification script to check Firebase document structure
   - Shows sample kanji and counts

3. **`scripts/check-user-premium.js`** ✅
   - Checks user premium status and subscription

4. **`scripts/compare-kanji-structure.js`** ✅
   - Compares original vs imported kanji field structure

### Modified Files
**NONE** - No application code was modified (only scripts created)

### Files To Review For Fix

1. **`src/lib/review-engine/progress/UniversalProgressManager.ts`**
   - Line 601-626: `getProgress()` - merge logic
   - Line 701-713: `mergeProgress()` - needs to persist to IndexedDB
   - Line 631-669: `loadFromIndexedDB()` - IndexedDB read
   - Line 357-371: `saveProgress()` - IndexedDB write logic

2. **`src/app/[locale]/kanji-browser/KanjiBrowserPage.tsx`**
   - Line 207-246: `refreshKanjiProgress()` - triggers sync
   - Line 552-580: `masteredKanjiByLevel` - filters learned kanji for dashboard

3. **`src/utils/kanjiProgressManager.ts`**
   - Line 82-85: `getKanjiProgressMap()` - entry point

---

## User Context

### User Status
- **Premium User**: YES ✅
  - Plan: `premium_monthly`
  - Status: `active`
  - Expires: April 18, 2026
  - Stripe Customer ID: `cus_TAsFvVwOOjTIv6`

- **Admin**: YES ✅
  - Custom claim: `{ admin: true }`

### Current State

**Firebase** (`progress/8onZzlQg3tQxkw8pinSF9ow4Q6j2_kanji`):
- 90 kanji present
- All have correct structure:
  ```json
  {
    "contentId": "球",
    "contentType": "kanji",
    "status": "learned",
    "viewCount": 6,
    "accuracy": 0,
    "correctCount": 0,
    "incorrectCount": 0,
    "streak": 0,
    "bestStreak": 0,
    "firstViewedAt": "2026-03-23T13:34:50.774Z",
    "lastViewedAt": "2026-03-23T13:34:50.774Z",
    "updatedAt": "2026-03-23T13:34:50.774Z"
  }
  ```
- Sample kanji: 球, 約, 内, 理, 切, 暇, 安, 有, 上, 下...

**IndexedDB** (browser local):
- Only 4 kanji present: 一, 高, 安, 静
- Origin unclear (not the original 4, possibly from previous manual interactions)

**UI Display** (screenshot provided):
- "My Kanji Collection" shows "4 kanji learned"
- Breakdown:
  - N5 (Beginner): 2 mastered (一, 高)
  - N4 (Elementary): 1 mastered (安)
  - N3 (Intermediate): 1 mastered (静)

---

## Root Cause Analysis

### Why Kanji Not Appearing

1. **Premium sync IS happening** (confirmed by code review)
   - `isPremium = true` (verified in user document)
   - `getProgress()` is called on page load
   - `loadFromFirebase()` executes successfully
   - `mergeProgress()` merges Firebase + IndexedDB data

2. **BUT merge is memory-only**
   - Merged Map is returned to React state
   - NOT persisted back to IndexedDB
   - Next page load: re-merges again (inefficient)
   - React state may not reflect merged data correctly

3. **Dashboard renders from `kanjiProgress` state**
   - `kanjiProgress` is set from `getKanjiProgressMap()` result
   - If merge doesn't complete or state doesn't update, UI shows stale data

### Why Script Overwrote Data

**Script logic** (line 79 in import-kanji-to-firebase.js):
```javascript
await docRef.set(
  {
    userId,
    contentType: 'kanji',
    items: updates,  // ⚠️ Entire items map replaced
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  { merge: true }  // ⚠️ merge:true only applies to top-level fields, not nested maps
)
```

**Problem**:
- `merge: true` merges top-level fields only
- The `items` map itself is replaced entirely
- Should use field path updates: `items.球: {...}, items.約: {...}` etc.
- Or fetch existing items first, then merge in JS before writing

---

## Proposed Solution

### Option 1: Fix mergeProgress to Persist (Recommended)

**Modify**: `src/lib/review-engine/progress/UniversalProgressManager.ts`

```typescript
protected async mergeProgress(
  userId: string,
  contentType: string,
  local: Map<string, T>,
  cloud: Map<string, T>
): Promise<Map<string, T>> {
  const merged = new Map(local)
  const itemsToSave: Array<[string, T]> = []

  for (const [contentId, cloudItem] of cloud) {
    const localItem = local.get(contentId)

    if (!localItem || cloudItem.updatedAt > localItem.updatedAt) {
      merged.set(contentId, cloudItem)
      itemsToSave.push([contentId, cloudItem])
    }
  }

  // Persist Firebase items to IndexedDB
  if (itemsToSave.length > 0) {
    await Promise.all(
      itemsToSave.map(([contentId, item]) =>
        this.saveToIndexedDB(userId, contentType, contentId, item)
      )
    )
  }

  return merged
}
```

**Also update**: `getProgress()` to pass userId and contentType to mergeProgress

### Option 2: Fix Import Script to Merge

**Modify**: `scripts/import-kanji-to-firebase.js`

```javascript
// Fetch existing document first
const doc = await docRef.get()
const existingItems = doc.exists ? (doc.data().items || {}) : {}

// Merge with new items (preserve existing)
const updates = { ...existingItems }

// Add new write kanji
writeKanji.forEach(kanji => {
  if (!updates[kanji]) {  // Only add if doesn't exist
    updates[kanji] = createProgressData(kanji, WRITE_KANJI_VIEW_COUNT)
  }
})

// Add new recognize kanji
recognizeKanji.forEach(kanji => {
  if (!updates[kanji]) {  // Only add if doesn't exist
    updates[kanji] = createProgressData(kanji, RECOGNIZE_KANJI_VIEW_COUNT)
  }
})

// Update with merged data
await docRef.set({ items: updates }, { merge: true })
```

### Option 3: Manual IndexedDB Write Script

Create a script to directly populate IndexedDB with the 90 kanji (bypasses sync issue)

---

## Next Steps for Recovery

1. **Immediate**: Verify user has refreshed page multiple times
2. **Check**: Browser DevTools → Application → IndexedDB → check actual contents
3. **Fix**: Implement Option 1 (persist merge to IndexedDB)
4. **Test**: User refreshes page, verify 90 kanji appear
5. **Restore**: Run script again to re-import kanji (with fixed merge logic)

---

## Lessons Learned

1. **Always read existing data before overwriting** in Firebase
2. **Understand sync flows** before modifying storage layers
3. **Test with small datasets first** (e.g., 5 kanji) before bulk import
4. **Verify both storage layers** (IndexedDB + Firebase) after operations
5. **Check browser DevTools** before assuming frontend issues

---

## How to Access Firebase Data

### Firebase Console (Web UI)
1. Go to: https://console.firebase.google.com/
2. Select project: **moshimoshi** (or your project name)
3. Navigate to: **Firestore Database** (left sidebar)
4. Path to document:
   ```
   progress → 8onZzlQg3tQxkw8pinSF9ow4Q6j2_kanji
   ```
5. Inspect the `items` field (map with 90 kanji)

### Firebase Admin SDK (Scripts)
- Service account: `/home/helye/DevProjects/nextjs/moshimoshi/moshimoshi-service-account.json`
- Example script: `scripts/verify-firebase-kanji.js`
- Run: `node scripts/verify-firebase-kanji.js`

### Quick Verification Command
```bash
cd /home/helye/DevProjects/nextjs/moshimoshi
node scripts/verify-firebase-kanji.js
```

Expected output: Shows 90 kanji with status='learned', viewCount=6

---

## THE INCIDENT SUMMARY

### What User Requested
"Add kanji from Lessons 8 & 9 to my Firebase so they show in My Kanji Collection dashboard"

### What Happened
1. ✅ Script successfully imported **90 kanji** to Firebase
2. ❌ **NONE of the 90 kanji are showing** in the dashboard
3. ❌ Dashboard still shows only **4 kanji** (一, 高, 安, 静)
4. ⚠️ Original kanji were overwritten in Firebase (data loss)

### Current Broken State
- **Expected**: 90 kanji visible in "My Kanji Collection"
- **Actual**: Only 4 kanji visible
- **Root Cause**: Firebase data not syncing to IndexedDB (required for UI rendering)
- **Impact**: User cannot study their imported kanji

### Urgency
🔴 **HIGH** - User is premium subscriber expecting feature to work, 90 kanji are inaccessible

---

## Contact

**User**: emmanuelfabiani23@gmail.com
**Firebase UID**: 8onZzlQg3tQxkw8pinSF9ow4Q6j2
**Subscription**: Premium Monthly (Active until April 18, 2026)

**Last Known State**:
- Firebase: 90 kanji ✅
- IndexedDB: 4 kanji ❌
- UI: Showing 4 kanji ❌
- **EXPECTED: 90 kanji visible in dashboard** ⚠️

---

**End of Report**
