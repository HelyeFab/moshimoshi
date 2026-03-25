# Agent 2: Session Persistence Test Plan

## Overview

This document provides a comprehensive test plan for verifying the new card-level session persistence architecture.

**Testing Date:** _________
**Tester:** _________
**Build:** _________

---

## Prerequisites

1. User must be logged in
2. Kanji browser page is accessible
3. Browser console is open for debugging (F12)
4. Multiple kanji are available for selection

---

## Test Scenarios

### ✅ Test 1: Fresh Session Creation (Manual Selection)

**Objective:** Verify new sessions are created with correct structure

**Steps:**
1. Navigate to Kanji Browser
2. Select 3-5 kanji
3. Click "Start Study Session"
4. Open browser DevTools → Application → Local Storage
5. Find key: `kanji-browser-study-session:{userId}`
6. Inspect the JSON value

**Expected Result:**
```json
{
  "version": 1,
  "mode": "traditional",
  "kanji": [
    {
      "kanjiId": "日",
      "kanjiData": { /* full kanji object */ },
      "cards": [
        {
          "id": "日-meaning",
          "type": "meaning",
          "kanjiCharacter": "日",
          "primaryMeaning": "sun",
          "allMeanings": ["sun", "day"],
          ...
        }
      ],
      "currentCardIndex": 0,
      "completed": false
    },
    ...
  ],
  "currentKanjiIndex": 0,
  "startedAt": <timestamp>,
  "source": "manual-selection",
  "totalCards": 5,
  "completedCards": 0
}
```

**Pass Criteria:**
- [ ] Session has `version: 1`
- [ ] Session has `mode: "traditional"`
- [ ] Each kanji has full `kanjiData` stored
- [ ] Each kanji has a `cards` array with at least one meaning card
- [ ] `currentKanjiIndex` is 0
- [ ] `source` is "manual-selection"

---

### ✅ Test 2: Session Persistence on Refresh

**Objective:** Verify session survives page refresh

**Steps:**
1. Start a study session with 5 kanji
2. Navigate to 2nd or 3rd kanji (click Next a few times)
3. **Hard refresh the page** (Ctrl+Shift+R or Cmd+Shift+R)
4. Wait for page load

**Expected Result:**
- Study mode automatically resumes
- Toast message: "Resumed your kanji study session"
- You're on the same kanji you were viewing before refresh
- Progress indicator shows correct position

**Pass Criteria:**
- [ ] Session automatically restores
- [ ] Resume toast appears
- [ ] Correct kanji is displayed
- [ ] `currentKanjiIndex` matches pre-refresh position
- [ ] Can navigate forward and backward

---

### ✅ Test 3: Session Persistence on Browser Close

**Objective:** Verify session survives browser close/reopen

**Steps:**
1. Start a study session
2. Navigate to 3rd kanji
3. **Close the entire browser** (not just the tab)
4. **Reopen browser** and navigate back to Kanji Browser

**Expected Result:**
- Session automatically resumes on page load
- Same kanji position as before browser close

**Pass Criteria:**
- [ ] Session restores after browser restart
- [ ] Correct position maintained
- [ ] All session data intact

---

### ✅ Test 4: Session Completion Clears Storage

**Objective:** Verify session is cleared after completion

**Steps:**
1. Start a study session with 2-3 kanji
2. Navigate through **all** kanji until completion
3. Click "Next" on the last kanji
4. Check localStorage for session key

**Expected Result:**
- "Study session complete!" toast appears
- You're returned to browse mode
- localStorage key is **deleted**

**Pass Criteria:**
- [ ] Completion toast appears
- [ ] View mode returns to browse
- [ ] `kanji-browser-study-session:{userId}` key is removed from localStorage
- [ ] Starting a new session works correctly

---

### ✅ Test 5: Manual Exit Preserves Session

**Objective:** Verify clicking "Exit" returns to browse mode while keeping the study session resumable

**Steps:**
1. Start a study session
2. Navigate to 2nd kanji
3. Note: Individual kanji progress is already tracked (view counts, learned status)
4. Click the **"Exit" or "Back"** button
5. You should return to browse mode
6. Check localStorage for session key
7. **Refresh the page**

**Expected Result:**
- Session is **still present in localStorage**
- Refresh restores the session automatically
- Individual kanji progress is preserved (check kanji status indicators)

**Pass Criteria:**
- [ ] Session key remains in localStorage after exit
- [ ] Refresh restores the session at the previous position
- [ ] Kanji progress indicators show viewed/learned status correctly
- [ ] Can start a new session without issues

**Rationale:** Manual exit means "leave the screen for now," not "discard my place." This matches the current product behavior for kanji study resume while still preserving per-kanji progress separately.

---

### ✅ Test 6: Collection Study Session

**Objective:** Verify "My Kanji Collection" study sessions work

**Steps:**
1. Mark 3-5 kanji as "learned" (checkmark icon)
2. Navigate to "My Kanji Collection" section (if available)
3. Click "Study All Learned Kanji"
4. Navigate through a few kanji
5. Refresh the page

**Expected Result:**
- Session is created with `source: "collection"`
- Session resumes after refresh

**Pass Criteria:**
- [ ] Session has `source: "collection"`
- [ ] Session persists and resumes correctly
- [ ] Completion works as expected

---

### ✅ Test 7: Legacy Session Migration

**Objective:** Verify old sessions are gracefully cleared

**Steps:**
1. **Manually create a legacy session** in localStorage:
   ```javascript
   // In browser console:
   const userId = "your-user-id-here"; // Get from user object
   const legacySession = {
     items: [
       { kanji: "日", meanings: ["sun", "day"], onyomi: ["ニチ"], kunyomi: ["ひ"], strokeCount: 4, jlpt: "N5" }
     ],
     currentIndex: 0,
     startedAt: Date.now(),
     source: "manual-selection"
     // No version field!
   };
   localStorage.setItem(`kanji-browser-study-session:${userId}`, JSON.stringify(legacySession));
   ```
2. Refresh the page
3. Check console logs
4. Check localStorage

**Expected Result:**
- Console log: "Detected legacy session, clearing..."
- Toast: "Previous study session format is outdated and has been cleared. Please start a new session."
- Session key is deleted

**Pass Criteria:**
- [ ] Legacy session is detected (check console)
- [ ] Session is cleared from localStorage
- [ ] Toast message informs user
- [ ] No errors thrown
- [ ] Starting a new session works

---

### ✅ Test 8: Multiple Kanji Navigation

**Objective:** Verify forward/backward navigation works correctly

**Steps:**
1. Start a session with 5 kanji
2. Click "Next" 3 times → should be on 4th kanji
3. Click "Previous" 2 times → should be on 2nd kanji
4. Refresh page
5. Verify position is maintained
6. Continue navigating

**Expected Result:**
- Navigation increments/decrements `currentKanjiIndex`
- Position indicator shows correct index (e.g., "2 / 5")
- Session persists position accurately

**Pass Criteria:**
- [ ] Next button advances kanji
- [ ] Previous button goes back
- [ ] Position indicator is accurate
- [ ] Refresh maintains position
- [ ] Cannot go before first kanji
- [ ] Next on last kanji completes session

---

### ✅ Test 9: Session Data Integrity

**Objective:** Verify all kanji data is stored correctly

**Steps:**
1. Start a session with kanji that have various properties:
   - Different JLPT levels
   - Multiple meanings
   - Multiple onyomi/kunyomi readings
2. Inspect localStorage session data
3. Verify each `kanjiData` object

**Expected Result:**
- Each `kanjiData` contains:
  - `kanji` (character)
  - `meanings` array
  - `onyomi` array
  - `kunyomi` array
  - `strokeCount`
  - `jlpt` level
  - Other properties from original Kanji type

**Pass Criteria:**
- [ ] Full kanji data is serialized
- [ ] No data loss on save/restore
- [ ] Complex kanji (many readings) handled correctly

---

### ✅ Test 10: Progress Tracking Integration

**Objective:** Verify progress tracking still works

**Steps:**
1. Start a study session
2. View a kanji (should auto-track view)
3. Click "Mark as Learned" button
4. Navigate to next kanji
5. Complete session
6. Return to browse mode
7. Check if kanji shows as "learned" (visual indicator)

**Expected Result:**
- Progress tracking events fire correctly
- Kanji status updates to "learned"
- Visual indicators reflect progress

**Pass Criteria:**
- [ ] Viewing kanji tracks progress
- [ ] Marking learned works
- [ ] Visual progress indicators update
- [ ] Session completion emits XP event (check console)

---

### ✅ Test 11: Concurrent Sessions (Multi-Tab)

**Objective:** Verify session behavior with multiple tabs

**Steps:**
1. Open Kanji Browser in Tab A
2. Start a study session
3. Navigate to 2nd kanji in Tab A
4. Open Kanji Browser in **Tab B** (same browser, same user)
5. Observe Tab B behavior
6. Refresh Tab B

**Expected Result:**
- Tab B should restore the session from localStorage
- Both tabs share the same session state (localStorage is shared)

**Pass Criteria:**
- [ ] Tab B detects existing session
- [ ] Refreshing Tab B restores session
- [ ] Editing session in one tab affects the other (after refresh)

**Note:** Real-time sync between tabs is not required, but localStorage should be shared.

---

### ✅ Test 12: Invalid Session Handling

**Objective:** Verify corrupted sessions are handled gracefully

**Steps:**
1. **Manually corrupt a session** in localStorage:
   ```javascript
   const userId = "your-user-id-here";
   localStorage.setItem(`kanji-browser-study-session:${userId}`, 'invalid json {{{');
   ```
2. Refresh the page
3. Check console for errors

**Expected Result:**
- Error logged to console
- Session is cleared
- No app crash
- User can start a new session

**Pass Criteria:**
- [ ] Parse error caught gracefully
- [ ] Session cleared
- [ ] No UI errors
- [ ] App remains functional

---

## Summary Checklist

After completing all tests, verify:

- [ ] All 12 test scenarios pass
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No console errors in browser
- [ ] Session schema matches specification
- [ ] Legacy sessions are migrated/cleared
- [ ] Progress tracking integration works
- [ ] User experience is smooth (no jarring behavior)

---

## Known Limitations

Document any limitations or edge cases discovered during testing:

1. _____________________________________________
2. _____________________________________________
3. _____________________________________________

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Old sessions break new system | High | Legacy session detection and auto-clear |
| Session data too large for localStorage | Medium | Limit kanji selection count if needed |
| Progress tracking regression | High | Comprehensive progress integration tests |
| Browser compatibility issues | Medium | Test on Chrome, Firefox, Safari |

---

## Sign-Off

**Agent 2 Implementation:** ✅ Complete
**Testing:** ⬜ Pending Manual Verification
**Approved By:** _________
**Date:** _________

---

**Next Steps:**
- User should manually execute all 12 test scenarios
- Document any issues found
- Agent 3 can begin UI implementation once tests pass
