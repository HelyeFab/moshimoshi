# Phase 2.5 Manual Test Matrix - Daily XP Accumulation

**Feature:** Daily XP Accumulation for Streak System
**Created:** 2026-01-03
**Last Updated:** 2026-01-03
**Status:** 3/13 tests complete

---

## Overview

This document tracks manual testing for the Phase 2.5 Daily XP Accumulation feature. The core behavior:

- XP accumulates **per-day** (not per-activity)
- Streak increments when daily XP reaches **25+ threshold**
- Only **ONE streak increment per day** (no double counting)
- Works with **mixed activities** (drills + reviews)
- Daily XP **resets at midnight UTC**

---

## Test Execution Tools

### Streak Time-Travel Script
```bash
streak
# Or: node scripts/streak-time-travel.js
```

### Quick Scenarios
| Code | Description |
|------|-------------|
| s1 | Active streak (1 day ago) |
| s2 | Breaking, can save (2 days ago, 50 XP cost) |
| s3 | Breaking, last chance (3 days ago, 75 XP cost) |
| s4 | Too late (5 days ago, beyond save window) |
| s5 | Active today |
| s6 | Perfect save test (7-day streak, 2 days late, 200 XP) |
| s7 | Insufficient XP (5-day, 3 days late, 50 XP need 75) |

### Firebase User
**User ID:** `8onZzlQg3tQxkw8pinSF9ow4Q6j2`

---

## Test Matrix

### Legend
- ✅ PASSED - Test completed successfully
- ❌ FAILED - Test failed (see notes)
- ⏳ PENDING - Not yet tested
- 🔄 RETEST - Needs retesting after changes

---

## Completed Tests

### Test 1: Same-Day Accumulation
**Status:** ✅ PASSED (2025-11-07)

| Field | Value |
|-------|-------|
| **Objective** | Verify XP accumulates across multiple activities in one day |
| **Setup** | Fresh day, streak = 8, xpGainedToday = 0 |
| **Action** | Complete 3 drills (10+10+10 XP) in one session |
| **Expected** | Daily XP: 30, Streak: 8→9 after reaching 25+ |

**Verification Checklist:**
- [x] xpGainedToday increases with each drill (10→20→30)
- [x] Streak increments only after 25+ XP reached
- [x] Streak increments exactly once (8→9, not 8→10→11)
- [x] lastStreakUpdateDate = today

**Notes:** Core accumulation working correctly.

---

### Test 8: Mixed Activities (WHITE-LABEL PROOF)
**Status:** ✅ PASSED (2025-11-08)

| Field | Value |
|-------|-------|
| **Objective** | Verify both drills AND reviews count toward daily XP |
| **Setup** | Fresh day, streak = 5, xpGainedToday = 0 |
| **Action** | Complete Drill (10 XP) + Review session (15 XP) |
| **Expected** | Daily XP: 25, Streak: 5→6 |

**Verification Checklist:**
- [x] Drill XP adds to daily total
- [x] Review XP adds to daily total
- [x] Combined XP triggers streak increment
- [x] Both activity types use same daily accumulation logic

**Notes:** Proved white-label approach works - any XP source counts.

**Bugs Found & Fixed:**
- Review auth mismatch (fixed)
- Zustand store error (fixed)

---

### Test 11: No Double Increment Protection
**Status:** ✅ PASSED (2025-11-07)

| Field | Value |
|-------|-------|
| **Objective** | Verify streak only increments ONCE per day |
| **Setup** | Same day, already at 70 XP, streak already updated today |
| **Action** | Complete 2 more drills (10+10 XP) |
| **Expected** | Daily XP: 90, Streak stays at 9 (not 10 or 11) |

**Verification Checklist:**
- [x] XP continues to accumulate (70→80→90)
- [x] Streak does NOT increment again
- [x] lastStreakUpdateDate prevents double increment
- [x] No errors thrown

**Notes:** Critical protection working. Uses `lastStreakUpdateDate` guard.

---

## Pending Tests

### Test 2: Cross-Day Reset
**Status:** ⏳ PENDING

| Field | Value |
|-------|-------|
| **Objective** | Verify daily XP resets at midnight UTC |
| **Setup** | Day 1: Complete drills, reach 30 XP, streak increments |
| **Action** | Wait until Day 2 (or time-travel), complete 1 drill (10 XP) |
| **Expected** | xpGainedToday resets to 0, then becomes 10 after drill |

**Verification Checklist:**
- [ ] xpGainedToday = 0 at start of Day 2
- [ ] After drill: xpGainedToday = 10 (NOT 40)
- [ ] Streak NOT incremented yet (10 < 25)
- [ ] lastXPDate = Day 2

**Test Steps:**
1. Run `streak` → select s5 (active today)
2. Set xpGainedToday to 30 via Firebase console
3. Run time-travel to set lastActivityDate to yesterday
4. Open app, complete 1 drill
5. Verify xpGainedToday = drill XP only

**Notes:** _To be filled after testing_

---

### Test 3: Threshold Edge - Exactly 25 XP
**Status:** ⏳ PENDING

| Field | Value |
|-------|-------|
| **Objective** | Verify streak increments at exactly 25 XP (not 26+) |
| **Setup** | Fresh day, xpGainedToday = 0, streak = 5 |
| **Action** | Complete activities totaling exactly 25 XP |
| **Expected** | Streak increments 5→6 at exactly 25 |

**Verification Checklist:**
- [ ] Streak increments at 25 (not waiting for 26+)
- [ ] lastStreakUpdateDate = today
- [ ] Threshold comparison is >= not >

**Test Steps:**
1. Reset daily XP to 0
2. Complete activities to reach exactly 25 XP
3. Verify streak incremented

**Notes:** _To be filled after testing_

---

### Test 4: Threshold Edge - Just Under (24 XP)
**Status:** ⏳ PENDING

| Field | Value |
|-------|-------|
| **Objective** | Verify streak does NOT increment below threshold |
| **Setup** | Fresh day, xpGainedToday = 0, streak = 5 |
| **Action** | Complete activities totaling 24 XP, then stop |
| **Expected** | Streak stays at 5, xpGainedToday = 24 |

**Verification Checklist:**
- [ ] Streak stays at 5 (NOT incremented)
- [ ] xpGainedToday = 24
- [ ] lastStreakUpdateDate ≠ today
- [ ] User can still increment by earning 1+ more XP

**Test Steps:**
1. Reset daily XP to 0
2. Complete activities to reach exactly 24 XP
3. Stop and verify streak unchanged
4. (Optional) Complete 1 more XP activity, verify streak increments

**Notes:** _To be filled after testing_

---

### Test 5: Streak Break → Fresh Start
**Status:** ⏳ PENDING

| Field | Value |
|-------|-------|
| **Objective** | Verify user can start fresh after streak breaks (beyond save window) |
| **Setup** | Use s4 scenario (5+ days late, beyond save window) |
| **Action** | Open dashboard, complete drills to reach 25+ XP |
| **Expected** | Streak resets to 0, then becomes 1 after 25+ XP |

**Verification Checklist:**
- [ ] Modal does NOT appear (beyond save window)
- [ ] Streak is 0 (broken)
- [ ] After 25+ XP: Streak becomes 1 (fresh start)
- [ ] Best streak preserved (not reset)
- [ ] Daily XP tracking works correctly

**Test Steps:**
1. Run `streak` → select s4
2. Open dashboard (no modal should appear)
3. Complete drills to reach 25+ XP
4. Verify streak = 1, best streak unchanged

**Notes:** _To be filled after testing_

---

### Test 6: Auto-Break → Save → Continue
**Status:** ⏳ PENDING

| Field | Value |
|-------|-------|
| **Objective** | Verify full save flow and continuation |
| **Setup** | Use s6 scenario (7-day streak, 2 days late, 200 XP) |
| **Action** | Save streak, then complete activity same day |
| **Expected** | Streak restored to 7, then increments to 8 after 25+ XP |

**Verification Checklist:**
- [ ] Modal appears with correct cost (50 XP)
- [ ] After save: streak = 7 (restored)
- [ ] After save: lastActivityDate = yesterday
- [ ] After save: XP = 150 (200 - 50)
- [ ] After 25+ XP same day: streak = 8
- [ ] No double modal appearance

**Test Steps:**
1. Run `streak` → select s6
2. Open dashboard → modal appears
3. Click "Save Streak"
4. Verify state via streak tool
5. Complete drill to earn 25+ XP
6. Verify streak incremented to 8

**Notes:** _To be filled after testing_

---

### Test 7: Grace Period Continuation
**Status:** ⏳ PENDING

| Field | Value |
|-------|-------|
| **Objective** | Verify streak continues within grace period |
| **Setup** | Streak = 5, lastActivityDate = yesterday (within grace) |
| **Action** | Complete drills to reach 25+ XP |
| **Expected** | Streak increments 5→6 (not reset) |

**Verification Checklist:**
- [ ] No modal appears (within grace, not breaking)
- [ ] Streak increments normally (5→6)
- [ ] Grace period correctly calculated as 1 day
- [ ] lastActivityDate updates to today

**Test Steps:**
1. Run `streak` → select s1 (1 day ago)
2. Open dashboard (no modal)
3. Complete drills to reach 25+ XP
4. Verify streak incremented

**Notes:** _To be filled after testing_

---

### Test 9: Multiple Sessions Same Day
**Status:** ⏳ PENDING

| Field | Value |
|-------|-------|
| **Objective** | Verify XP persists across app opens/closes |
| **Setup** | Fresh day, xpGainedToday = 0, streak = 3 |
| **Action** | 3 separate sessions with app close between each |
| **Expected** | XP accumulates across sessions, streak increments once |

**Verification Checklist:**
- [ ] Session 1: 10 XP → xpGainedToday = 10
- [ ] Session 2: 10 XP → xpGainedToday = 20
- [ ] Session 3: 10 XP → xpGainedToday = 30, streak 3→4
- [ ] Session 4: 10 XP → xpGainedToday = 40, streak stays 4
- [ ] State persists across app opens

**Test Steps:**
1. Reset daily XP to 0
2. Complete 1 drill (10 XP), close app
3. Reopen app, verify xpGainedToday = 10
4. Complete 1 drill (10 XP), close app
5. Reopen app, verify xpGainedToday = 20
6. Complete 1 drill (10 XP)
7. Verify streak incremented

**Notes:** _To be filled after testing_

---

### Test 10: New User First Streak
**Status:** ⏳ PENDING

| Field | Value |
|-------|-------|
| **Objective** | Verify new users can start their first streak |
| **Setup** | New user OR reset existing user's streak to 0 |
| **Action** | Complete drills to reach 25+ XP |
| **Expected** | Streak becomes 1 (first day) |

**Verification Checklist:**
- [ ] Starting streak = 0
- [ ] After 25+ XP: streak = 1
- [ ] Best streak = 1
- [ ] lastActivityDate set correctly
- [ ] No errors for missing previous data

**Test Steps:**
1. Use streak tool option 9 (reset streak to 0)
2. Also clear lastActivityDate if possible
3. Complete drills to reach 25+ XP
4. Verify streak = 1, best = 1

**Notes:** _To be filled after testing_

---

### Test 12: Firebase ↔ UI State Consistency
**Status:** ⏳ PENDING

| Field | Value |
|-------|-------|
| **Objective** | Verify UI and Firebase stay in sync |
| **Setup** | Known state via streak tool |
| **Action** | Complete activity, compare UI and Firebase |
| **Expected** | Both show identical values |

**Verification Checklist:**
- [ ] UI shows correct streak before activity
- [ ] UI updates immediately after activity
- [ ] Firebase matches UI (check via streak tool)
- [ ] No desync between Zustand and Firebase
- [ ] Refresh page, values persist

**Test Steps:**
1. Set known state: streak = 5, xpGainedToday = 20
2. Open dashboard, note displayed values
3. Complete 1 drill (5 XP) → should hit 25 threshold
4. Verify UI shows streak = 6 immediately
5. Run streak tool, verify Firebase shows streak = 6
6. Refresh page, verify values persist

**Notes:** _To be filled after testing_

---

### Test 13: Review Session XP Accumulation
**Status:** ⏳ PENDING

| Field | Value |
|-------|-------|
| **Objective** | Verify Review Engine XP counts toward daily total |
| **Setup** | Fresh day, items due for review |
| **Action** | Complete review session earning 25+ XP |
| **Expected** | Streak increments from review XP alone |

**Verification Checklist:**
- [ ] Review XP adds to xpGainedToday
- [ ] Streak increments after 25+ XP from reviews
- [ ] Works same as drills for streak purposes
- [ ] No special handling needed for review vs drill

**Test Steps:**
1. Reset daily XP to 0
2. Start a review session (Universal Review Engine)
3. Complete enough items to earn 25+ XP
4. Verify streak incremented
5. Verify xpGainedToday reflects review XP

**Notes:** _To be filled after testing_

---

## Test Summary

| # | Test Name | Status | Date | Tester |
|---|-----------|--------|------|--------|
| 1 | Same-day accumulation | ✅ PASSED | 2025-11-07 | - |
| 2 | Cross-day reset | ⏳ PENDING | - | - |
| 3 | Threshold edge - exactly 25 | ⏳ PENDING | - | - |
| 4 | Threshold edge - just under | ⏳ PENDING | - | - |
| 5 | Streak break → fresh start | ⏳ PENDING | - | - |
| 6 | Auto-break → save → continue | ⏳ PENDING | - | - |
| 7 | Grace period continuation | ⏳ PENDING | - | - |
| 8 | Mixed activities | ✅ PASSED | 2025-11-08 | - |
| 9 | Multiple sessions same day | ⏳ PENDING | - | - |
| 10 | New user first streak | ⏳ PENDING | - | - |
| 11 | No double increment | ✅ PASSED | 2025-11-07 | - |
| 12 | Firebase ↔ UI consistency | ⏳ PENDING | - | - |
| 13 | Review session XP | ⏳ PENDING | - | - |

**Progress:** 3/13 complete (23%)

> **Note:** The original YAML mentioned "5/13" but only 3 tests (1, 8, 11) have documented evidence of completion. Tests 2-7, 9-10, 12-13 were never documented with results.

---

## Bugs Found During Testing

### Bug 1: Review Auth Mismatch
- **Found:** Test 8 (2025-11-08)
- **Status:** ✅ FIXED
- **Description:** Review sessions weren't awarding XP due to auth mismatch

### Bug 2: Zustand Store Error
- **Found:** Test 8 (2025-11-08)
- **Status:** ✅ FIXED
- **Description:** Store update error when updating streak

---

## Change Log

| Date | Change | Tests Affected |
|------|--------|----------------|
| 2025-11-07 | Initial testing | 1, 11 |
| 2025-11-08 | Mixed activities test | 8 |
| 2026-01-03 | Created formal test matrix document | All |

---

## Instructions for Testers

### Before Testing
1. Pull latest code from main branch
2. Run `npm run dev` to start local server
3. Have streak time-travel tool ready: `streak`
4. Open browser DevTools console (F12)

### During Testing
1. Follow test steps exactly as written
2. Check ALL verification items
3. Note any unexpected behavior
4. Take screenshots of errors

### After Testing
1. Update test status in this document
2. Fill in Notes section
3. Update Test Summary table
4. Add any bugs found to Bugs section
5. Commit changes to this document

### Updating This Document
```bash
# After completing a test:
git add 01_PRODUCTION_DOCS/5-Quality-Assurance/STREAK_PHASE_2_5_MANUAL_TEST_MATRIX.md
git commit -m "test: Update Phase 2.5 test matrix - Test X completed"
```

---

**Document Owner:** Streak Guardian (Claude)
**Last Updated By:** Claude Code
**Next Review:** After all tests complete
