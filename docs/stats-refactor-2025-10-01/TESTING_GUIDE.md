# Testing Guide - Stats System Refactor

**Date:** 2025-10-01
**Status:** ✅ ALL MIGRATIONS COMPLETE
**Ready for:** End-to-End Testing

---

## 🎯 What Was Accomplished

### **7 Commits Total:**
1. `689fd234` - Fix double-write bug in achievement-store
2. `85d61805` - Fix XP tracking field name (add → amount)
3. `bc70c82a` - Consolidate streak logic (10+ XP per session rule)
4. `c59da592` - Migrate drill component to useUserStats
5. `bf3ccd58` - Migrate KanaLearningComponent to useUserStats
6. `ac6ef8ee` - Migrate KanjiMastery LearnContent to useUserStats
7. Plus backup branch created

### **Components Migrated (3):**
- ✅ Drill (`/src/app/drill/page.tsx`)
- ✅ Kana Learning (`/src/components/learn/KanaLearningComponent.tsx`)
- ✅ Kanji Mastery (`/src/app/kanji-mastery/learn/LearnContent.tsx`)

### **Architecture Changes:**
- **Before:** useXP + useAchievementStore (double-write, race conditions)
- **After:** useUserStats (single source of truth, clean flow)

---

## 🧪 Testing Checklist

### **Phase 1: Basic Functionality**

#### **Test 1: Drill Component** 🎯
**Path:** `/drill`

**Steps:**
1. Start a new drill session
2. Answer questions (get 70%+ accuracy to earn 10+ XP)
3. Complete the session

**Expected Results:**
- [ ] Session completes successfully
- [ ] XP toast notification shows (+X XP)
- [ ] Streak counter increases (if first session today)
- [ ] No errors in browser console
- [ ] No duplicate Firebase writes (check Network tab)

**Check Firebase:**
- [ ] Single write to `user_stats` collection
- [ ] `xp.total` increased correctly
- [ ] `streak.current` increased (if applicable)
- [ ] `sessions.totalSessions` increased by 1

---

#### **Test 2: Kana Learning Component** 📝
**Path:** `/learn/kana` or `/learn/hiragana`

**Steps:**
1. Start a review session with 5-10 characters
2. Complete the session with good accuracy
3. Check stats

**Expected Results:**
- [ ] Session completes successfully
- [ ] XP calculated based on accuracy × items × 5
- [ ] Streak updates if XP >= 10
- [ ] Session completion toast appears
- [ ] No errors in console

**Check Firebase:**
- [ ] Single write to `user_stats`
- [ ] XP increased correctly
- [ ] Streak updated correctly (if >= 10 XP earned)

---

#### **Test 3: Kanji Mastery** 🈯
**Path:** `/tools/kanji-mastery` → Start Learning

**Steps:**
1. Start a kanji mastery session (5 kanji)
2. Complete all 3 rounds
3. Finish the session

**Expected Results:**
- [ ] All 3 rounds complete
- [ ] XP awarded (typically 20+ for kanji mastery)
- [ ] Streak updates (kanji usually earns 10+ XP)
- [ ] Session complete modal shows
- [ ] No errors in console

**Check Firebase:**
- [ ] Single write to `user_stats`
- [ ] XP total increased
- [ ] Streak current increased (if first today)

---

### **Phase 2: Streak Logic Testing**

#### **Test 4: 10+ XP Rule** ⚡
**Goal:** Verify streak updates only with 10+ XP

**Test A: High XP Session (Should Update Streak)**
1. Complete drill with 80%+ accuracy (~25 XP)
2. Check streak counter

**Expected:**
- [ ] Streak increases by 1 (if first session today)
- [ ] Toast shows streak increase

**Test B: Low XP Session (Should NOT Update Streak)**
1. Complete drill with 40% accuracy (~5 XP)
2. Check streak counter

**Expected:**
- [ ] Streak does NOT increase
- [ ] XP still increases (5 XP)
- [ ] No streak toast

---

#### **Test 5: Once Per Day Rule** 📅
**Goal:** Verify streak only updates once per day

**Steps:**
1. Complete drill session (10+ XP) - **Streak should update**
2. Complete another drill (10+ XP) - **Streak should NOT update again**
3. Check streak counter after both sessions

**Expected:**
- [ ] First session: Streak increases
- [ ] Second session: Streak stays same
- [ ] XP increases both times
- [ ] No errors

---

#### **Test 6: Exactly 10 XP** 🎯
**Goal:** Test boundary condition

**Steps:**
1. Complete session that earns exactly 10 XP
2. Check streak

**Expected:**
- [ ] Streak increases (10 XP is >= threshold)

---

### **Phase 3: User Tier Testing**

#### **Test 7: Free User Flow** 💾
**Requirements:** Test as free user (or log out and use as guest)

**Steps:**
1. Complete a drill session
2. Close browser
3. Reopen browser
4. Check if stats persisted

**Expected:**
- [ ] Stats saved to localStorage
- [ ] Stats load on page refresh
- [ ] XP total correct
- [ ] Streak correct
- [ ] No attempts to write to Firebase (check Network tab)

---

#### **Test 8: Premium User Flow** ⭐
**Requirements:** Premium subscription active

**Steps:**
1. Complete a drill session
2. Check Firebase Console immediately
3. Complete another session
4. Verify both sessions saved

**Expected:**
- [ ] Stats saved to Firebase `user_stats`
- [ ] Stats also cached in localStorage
- [ ] Leaderboard updated (check `/leaderboard`)
- [ ] All data consistent across pages

---

### **Phase 4: Edge Cases**

#### **Test 9: Multiple Sessions Same Day** 🔄
**Steps:**
1. Complete drill (10+ XP) → Note streak
2. Complete kana (10+ XP) → Check streak
3. Complete kanji (10+ XP) → Check streak

**Expected:**
- [ ] Streak increases only once (first session)
- [ ] XP accumulates from all sessions
- [ ] Total sessions count = 3

---

#### **Test 10: Offline → Online** 📡
**Steps:**
1. Turn off network (DevTools → Network → Offline)
2. Complete a drill session
3. Turn network back on
4. Complete another session

**Expected:**
- [ ] First session: Saves to localStorage only
- [ ] Second session: Syncs first session + records second
- [ ] No data loss
- [ ] Firebase eventually consistent

---

#### **Test 11: Cross-Component Consistency** 🔗
**Steps:**
1. Check streak on dashboard: `X` days
2. Navigate to `/drill`
3. Check streak counter: Should be `X` days
4. Navigate to `/learn/kana`
5. Check streak counter: Should be `X` days
6. Complete a session
7. Navigate between pages

**Expected:**
- [ ] Streak value identical across all pages
- [ ] After session, all pages show updated streak
- [ ] No flickering or inconsistent values

---

### **Phase 5: Error Handling**

#### **Test 12: API Failures** ❌
**Steps:**
1. Block `/api/stats/unified` in Network tab (DevTools)
2. Complete a drill session
3. Check behavior

**Expected:**
- [ ] Session still completes
- [ ] Fallback to localStorage
- [ ] User sees completion message
- [ ] No app crash
- [ ] Console shows error (expected)

---

#### **Test 13: Invalid Data** 🔧
**Steps:**
1. Complete a session with 0 items reviewed
2. Complete a session with negative accuracy (if possible)

**Expected:**
- [ ] Graceful handling
- [ ] No app crash
- [ ] XP defaults to 0
- [ ] Session recorded with actual values

---

### **Phase 6: Firebase Verification**

#### **Test 14: Single Write Verification** ✅
**Goal:** Confirm no more double-writes

**Steps:**
1. Open Browser DevTools → Network tab
2. Filter for `stats/unified`
3. Complete any learning session
4. Count POST requests to `/api/stats/unified`

**Expected:**
- [ ] Exactly **2 POST requests**:
  - 1 for XP (addXP call)
  - 1 for session (recordSession call)
- [ ] **NOT 3 or 4** (that would indicate double-write bug)

**Check Firebase Console:**
- [ ] `user_stats/{userId}` has ONE recent write timestamp
- [ ] No duplicate writes within same second

---

#### **Test 15: Leaderboard Sync** 🏆
**Goal:** Verify leaderboard materializer works

**Steps:**
1. Note current position on leaderboard
2. Complete high-XP session (25+ XP)
3. Navigate to `/leaderboard`
4. Check your rank/stats

**Expected:**
- [ ] Total XP increased on leaderboard
- [ ] Streak current matches user_stats
- [ ] Rank updated appropriately
- [ ] `leaderboard_stats` collection updated

---

## 🐛 Known Issues to Watch For

### **Issue 1: IndexedDB Constraint Error** ⚠️
```
ConstraintError: Unable to add key to index 'by-session'
```

**What to check:**
- Does it block the session?
- Does it prevent stats from saving?
- Is it just a warning?

**If it occurs:** Document the exact steps to reproduce

---

### **Issue 2: achievementManager 400 Error** ⚠️
```
Failed to sync to Firebase: Error: Failed to sync to Firebase: 400
```

**Expected:** Should be GONE after migrations
**If it still occurs:** This indicates achievement-store still being called somewhere

**Action:** Report immediately with stack trace

---

### **Issue 3: Streak Not Updating** 🔥
**Symptoms:**
- User completes session with 10+ XP
- Streak doesn't increase
- No error messages

**Check:**
1. Is this the first session today? (Check `user_stats.streak.lastActivityDate`)
2. Was XP actually >= 10? (Check console logs)
3. Did session call `recordSession` with `xpEarned`? (Check Network tab)

---

## 📊 Success Criteria

**All Tests Pass When:**
- [ ] ✅ All 3 components (drill, kana, kanji) complete sessions
- [ ] ✅ XP tracked correctly for all activities
- [ ] ✅ Streak updates with 10+ XP rule
- [ ] ✅ Streak updates only once per day
- [ ] ✅ Free users: localStorage persists data
- [ ] ✅ Premium users: Firebase syncs data
- [ ] ✅ No double-writes (verified in Network tab)
- [ ] ✅ No errors in browser console
- [ ] ✅ Stats consistent across all pages
- [ ] ✅ Leaderboard updates correctly

---

## 🔧 Debugging Tips

### **Console Logging**
Enable debug logging in browser console:
```javascript
localStorage.setItem('debug:stats', 'true')
localStorage.setItem('debug:srs', 'true')
localStorage.setItem('debug:queue', 'true')
```

### **Check Firebase Directly**
Firebase Console → Firestore Database → `user_stats` → Your user ID
- Check `xp.total` value
- Check `streak.current` value
- Check `streak.dates` object (should have today's date)
- Check `metadata.lastUpdated` timestamp

### **Network Tab Analysis**
DevTools → Network → Filter: `stats`
- Look for `/api/stats/unified` calls
- Check request payloads
- Check response data
- Verify no 400/500 errors

### **localStorage Inspection**
DevTools → Application → Local Storage
- Look for `user_stats_cache_{userId}`
- Check if data is current
- Verify structure matches Firebase

---

## 📞 Reporting Issues

**If you find a bug, please note:**

1. **What you were doing:** (e.g., "Completing drill session")
2. **What you expected:** (e.g., "Streak should increase")
3. **What actually happened:** (e.g., "Streak stayed the same")
4. **Browser console errors:** (Copy full error message)
5. **Network tab:** (Screenshot of API calls)
6. **User tier:** (Free or Premium)
7. **Steps to reproduce:** (Exact sequence)

---

## 🚀 Next Steps After Testing

### **If All Tests Pass:**
1. Mark Phase 4 as complete ✅
2. Consider Phase 5 (localStorage consolidation)
3. Consider Phase 6 (remove deprecated code)
4. Monitor production for 1-2 weeks

### **If Tests Fail:**
1. Document the failure
2. Identify root cause
3. Create focused fix
4. Retest specific scenario
5. Verify no regressions

---

## 📈 Testing Progress Tracker

**Phase 1: Basic Functionality**
- [ ] Test 1: Drill Component
- [ ] Test 2: Kana Learning
- [ ] Test 3: Kanji Mastery

**Phase 2: Streak Logic**
- [ ] Test 4: 10+ XP Rule
- [ ] Test 5: Once Per Day Rule
- [ ] Test 6: Exactly 10 XP

**Phase 3: User Tiers**
- [ ] Test 7: Free User Flow
- [ ] Test 8: Premium User Flow

**Phase 4: Edge Cases**
- [ ] Test 9: Multiple Sessions
- [ ] Test 10: Offline → Online
- [ ] Test 11: Cross-Component Consistency

**Phase 5: Error Handling**
- [ ] Test 12: API Failures
- [ ] Test 13: Invalid Data

**Phase 6: Firebase Verification**
- [ ] Test 14: Single Write Verification
- [ ] Test 15: Leaderboard Sync

---

**Status:** Ready for Testing! 🚀
**Estimated Testing Time:** 2-3 hours for comprehensive coverage

