# Agent 4: End-to-End Verification Plan

## Overview

This document provides a concrete verification plan to prove that vocabulary exposure tracking works end-to-end from UI → IndexedDB → Firebase.

**Version:** 1.0
**Date:** 2026-03-24
**Agent:** 4 (Progress Tracking)

---

## What Needs Verification

1. ✅ **Study flow calls tracking** - `trackVocabularyExposure()` is invoked when vocabulary cards are shown
2. ✅ **IndexedDB persistence** - Nested `readingsExposed` data saves correctly to local storage
3. ✅ **Firebase sync (premium)** - Vocabulary fields sync to Firestore for premium users
4. ✅ **Cloud/local merge** - Restored data merges correctly with preserved nested structure

---

## Verification Method: Manual End-to-End Test

### Prerequisites

- [ ] Development environment running (`npm run dev`)
- [ ] Browser DevTools open (Console + Application tabs)
- [ ] Test user account (both free and premium)
- [ ] Vocabulary-first card generation working (Agent 1)
- [ ] Study UI rendering vocabulary cards (Agent 3)

---

## Test 1: Tracking is Called in Study Flow

**Objective:** Verify `trackVocabularyExposure()` is actually invoked

**Steps:**
1. Start development server: `npm run dev`
2. Navigate to Kanji Browser
3. Select 2-3 kanji
4. Click "Start Study Session"
5. Ensure session mode is `vocabulary-first`
6. Open browser console
7. Advance through cards by clicking "Next"

**Expected Console Logs:**
```
[Kanji Study] Vocabulary exposure tracked: {
  kanji: "日",
  reading: "ひ",
  word: "日本"
}
```

**Pass Criteria:**
- [ ] Log appears when advancing FROM a vocabulary card
- [ ] Log does NOT appear for meaning cards or reading summary cards
- [ ] Kanji, reading, and word values are correct
- [ ] No errors in console

**Failure Scenarios:**
- ❌ No log appears → tracking not wired up
- ❌ Log appears for all cards → wrong card type check
- ❌ Error in console → integration bug

---

## Test 2: IndexedDB Persistence

**Objective:** Verify vocabulary data is saved to IndexedDB

**Steps:**
1. Continue from Test 1 (or start fresh)
2. Advance through at least 2 vocabulary cards
3. Open DevTools → Application → IndexedDB
4. Expand `moshimoshi-universal-progress` database
5. Open `progress` object store
6. Find entry with `compositeKey`: `{userId}:kanji:{kanjiCharacter}`
7. Expand `data` field

**Expected IndexedDB Structure:**
```javascript
{
  id: 123,
  userId: "test-user-123",
  contentType: "kanji",
  contentId: "日",
  compositeKey: "test-user-123:kanji:日",
  data: {
    contentId: "日",
    contentType: "kanji",
    character: "日",
    jlptLevel: "N5",
    status: "learning",
    viewCount: 1,
    vocabularySeenCount: 2, // ← NEW
    readingsExposed: { // ← NEW (nested object)
      "ひ": {
        reading: "ひ",
        readingType: "kunyomi",
        exposureCount: 2,
        lastWord: "日本",
        lastWordMeaning: "Japan",
        lastSeenAt: "2026-03-24T10:15:30.123Z"
      }
    },
    lastVocabularyTimestamp: "2026-03-24T10:15:30.123Z", // ← NEW
    updatedAt: "2026-03-24T10:15:30.123Z",
    version: 1,
    // ... other fields
  },
  updatedAt: Date("2026-03-24T10:15:30.123Z")
}
```

**Pass Criteria:**
- [ ] `vocabularySeenCount` field present and accurate
- [ ] `readingsExposed` is an object (not null/undefined)
- [ ] `readingsExposed[reading]` contains correct data
- [ ] `exposureCount` increments with each card
- [ ] `lastWord` and `lastWordMeaning` match vocabulary card
- [ ] `lastVocabularyTimestamp` is recent ISO timestamp

**Debugging Tips:**
```javascript
// In browser console
const db = await window.indexedDB.open('moshimoshi-universal-progress', 3)
const tx = db.transaction('progress', 'readonly')
const store = tx.objectStore('progress')
const index = store.index('by-composite-key')
const key = 'your-user-id:kanji:日'
const result = await index.get(key)
console.log('Progress data:', result.data)
```

---

## Test 3: Firebase Sync (Premium Users Only)

**Objective:** Verify vocabulary fields sync to Firestore

**Steps:**
1. **Use a premium test account** (or upgrade test account to premium)
2. Complete Test 1 and Test 2 (track vocabulary exposure)
3. Wait 500ms (sync debounce delay)
4. Check Firebase Console or use API

**Method A: Firebase Console**
1. Open Firebase Console → Firestore Database
2. Navigate to collection: `users/{userId}/progress/kanji`
3. Inspect document structure

**Method B: API Request (easier for testing)**
```bash
# In terminal (while logged in as premium user)
curl http://localhost:3000/api/progress/track?contentType=kanji \
  -H "Cookie: your-session-cookie" \
  | jq '.items["日"]'
```

**Expected Firebase Document:**
```json
{
  "userId": "test-user-123",
  "contentType": "kanji",
  "lastUpdated": "2026-03-24T10:15:30.123Z",
  "items": {
    "日": {
      "contentId": "日",
      "character": "日",
      "jlptLevel": "N5",
      "status": "learning",
      "viewCount": 1,
      "vocabularySeenCount": 2,
      "readingsExposed": {
        "ひ": {
          "reading": "ひ",
          "readingType": "kunyomi",
          "exposureCount": 2,
          "lastWord": "日本",
          "lastWordMeaning": "Japan",
          "lastSeenAt": "2026-03-24T10:15:30.123Z"
        }
      },
      "lastVocabularyTimestamp": "2026-03-24T10:15:30.123Z",
      "updatedAt": "2026-03-24T10:15:30.123Z"
    }
  }
}
```

**Pass Criteria:**
- [ ] Document exists in Firestore
- [ ] `vocabularySeenCount` field synced
- [ ] `readingsExposed` object structure preserved (not flattened)
- [ ] Nested `readingsExposed[reading]` data is complete
- [ ] All timestamps are ISO strings
- [ ] No "unknown field" errors in Firestore

**Common Issues:**
- ❌ Document missing → Sync didn't trigger (check debounce delay)
- ❌ Vocabulary fields missing → API not spreading fields (check route.ts)
- ❌ Nested object flattened → Firestore merge issue
- ❌ "Permission denied" → User not actually premium

---

## Test 4: Cloud/Local Merge Behavior

**Objective:** Verify nested `readingsExposed` merges correctly across devices

**Scenario:** User tracks vocabulary on Device A, then loads on Device B

**Steps:**

### Device A (or Browser Profile A)
1. Log in as premium user
2. Track vocabulary exposure for kanji "日" with reading "ひ"
3. Verify IndexedDB has `readingsExposed.ひ`
4. Wait for Firebase sync (500ms + API request time)
5. Verify Firebase has the data (Test 3)

### Device B (or Browser Profile B / Incognito)
1. **Clear all browser data** (localStorage, IndexedDB, cookies)
2. Log in as the SAME premium user
3. Navigate to Kanji Browser
4. Check IndexedDB → should be empty initially
5. **Trigger a progress load** (view kanji or start study session)
6. Check IndexedDB again → data should be restored from Firebase

**Expected Merge Result:**
```javascript
// IndexedDB on Device B (after merge)
{
  contentId: "日",
  vocabularySeenCount: 2, // Restored from Firebase
  readingsExposed: { // Nested structure preserved
    "ひ": {
      reading: "ひ",
      readingType: "kunyomi",
      exposureCount: 2,
      lastWord: "日本",
      lastWordMeaning: "Japan",
      lastSeenAt: "2026-03-24T10:15:30.123Z"
    }
  },
  lastVocabularyTimestamp: "2026-03-24T10:15:30.123Z"
}
```

**Pass Criteria:**
- [ ] IndexedDB on Device B receives vocabulary data from Firebase
- [ ] Nested `readingsExposed` structure is preserved (not flattened)
- [ ] All fields are accurate (no data loss)
- [ ] Timestamps are valid ISO strings

**Failure Scenarios:**
- ❌ IndexedDB still empty → Merge didn't trigger
- ❌ `readingsExposed` is `null` or `undefined` → Merge lost nested data
- ❌ `readingsExposed` is a string → JSON serialization issue
- ❌ Fields have wrong values → Merge conflict resolution bug

---

## Test 5: Immutability Verification

**Objective:** Verify that tracking doesn't mutate existing progress objects

**Steps:**
1. Track vocabulary exposure for kanji "日" with reading "ひ"
2. Get progress object from IndexedDB
3. Store reference to `readingsExposed` object
4. Track ANOTHER exposure for the same kanji, different reading "にち"
5. Check if the original reference was mutated

**Code to Run in Console:**
```javascript
// After first exposure
const progressManager = kanjiProgressManager
const progress1 = await progressManager.getKanjiProgressItem('日', user, isPremium)
const readingsRef = progress1.readingsExposed

console.log('Before second exposure:', readingsRef)

// Track second exposure (different reading)
await progressManager.trackVocabularyExposure(
  '日', 'にち', 'onyomi', '日本', 'Japan', user, isPremium
)

const progress2 = await progressManager.getKanjiProgressItem('日', user, isPremium)

console.log('After second exposure:', readingsRef)
console.log('New progress:', progress2.readingsExposed)

// Test immutability
if (readingsRef === progress2.readingsExposed) {
  console.error('❌ MUTATION BUG: Same object reference!')
} else {
  console.log('✅ Immutability preserved: Different object references')
}
```

**Pass Criteria:**
- [ ] `readingsRef !== progress2.readingsExposed` (different references)
- [ ] Original `readingsRef` object is unchanged
- [ ] New `progress2.readingsExposed` has both readings

---

## Test 6: Free User (No Firebase Sync)

**Objective:** Verify free users store vocabulary data locally only

**Steps:**
1. Log in as **free (non-premium) user**
2. Track vocabulary exposure
3. Check IndexedDB → should have vocabulary data
4. Check Firebase → should NOT have vocabulary data (or entire progress document missing)
5. Verify console logs don't show Firebase sync attempts

**Expected Behavior:**
- ✅ IndexedDB contains vocabulary data
- ✅ No Firebase document created
- ✅ No "failed to sync" errors in console

**Pass Criteria:**
- [ ] Vocabulary data persists locally
- [ ] No Firebase writes attempted
- [ ] Tracking works correctly (IndexedDB only)

---

## Acceptance Criteria

**Before declaring "end-to-end verified":**

- [ ] Test 1: Console log confirms tracking is called
- [ ] Test 2: IndexedDB contains correct nested `readingsExposed` structure
- [ ] Test 3: Firebase (premium) contains vocabulary fields
- [ ] Test 4: Cloud/local merge preserves nested structure
- [ ] Test 5: Immutability is maintained (no mutation)
- [ ] Test 6: Free users work correctly (local-only)

---

## Known Limitations

### What This Verification Does NOT Cover

1. **Scale Testing** - Only tests with 2-3 kanji
2. **Concurrent Updates** - Multi-tab scenarios not tested
3. **Network Failures** - Offline → online sync not tested
4. **Edge Cases** - Unusual readings, special characters, etc.

### Future Testing Needs

- **Load Testing:** 100+ kanji with 5+ vocabulary cards each
- **Conflict Resolution:** Two devices updating same kanji simultaneously
- **Retry Logic:** Network failures during sync
- **Migration:** Upgrading free → premium with existing local data

---

## Debugging Commands

### Check IndexedDB in Console
```javascript
// Open IndexedDB
const openReq = indexedDB.open('moshimoshi-universal-progress', 3)
openReq.onsuccess = () => {
  const db = openReq.result
  const tx = db.transaction('progress', 'readonly')
  const store = tx.objectStore('progress')
  const index = store.index('by-user')

  const req = index.getAll('your-user-id')
  req.onsuccess = () => {
    console.log('All progress:', req.result)
  }
}
```

### Check Firebase Sync Status
```javascript
// In browser console (after tracking)
fetch('/api/progress/track?contentType=kanji')
  .then(r => r.json())
  .then(data => console.log('Firebase data:', data.items))
```

### Force Flush Sync
```javascript
// In browser console
await kanjiProgressManager.flushKanjiSync()
console.log('Sync flushed - check Firebase')
```

---

## Verification Checklist

**Manual Testing Complete:**
- [ ] Logged tracking calls in console (Test 1)
- [ ] Inspected IndexedDB structure (Test 2)
- [ ] Verified Firebase sync for premium (Test 3)
- [ ] Tested cloud/local merge (Test 4)
- [ ] Confirmed immutability (Test 5)
- [ ] Tested free user local-only (Test 6)

**Issues Found:**
- [ ] None found (✅ all tests pass)
- [ ] _______________ (describe issue)

**Sign-Off:**
- [ ] Agent 4: End-to-end flow verified
- [ ] Ready for Agent 6 QA testing

---

**Version:** 1.0
**Status:** ⬜ Pending Manual Verification
**Last Updated:** 2026-03-24
**Agent:** 4 (Progress Tracking)
