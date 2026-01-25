# URE Migration - Manual Testing Guide

**Date**: 2025-12-18
**Tester**: _____________
**Purpose**: Verify all 6 review features work correctly with gamification after Phase 2 cleanup

---

## 🎯 Testing Objectives

1. ✅ Verify **review modes** award XP correctly (6 features)
2. ✅ Verify **study modes** do NOT award XP (3 features)
3. ✅ Check for console errors
4. ✅ Verify celebration screens appear when appropriate
5. ✅ Confirm no regressions

---

## 🛠️ Pre-Testing Setup

### Step 1: Start Development Server

```bash
cd /home/beano/DevProjects/NextJs/moshimoshi
npm run dev
```

**Wait for**: `Ready on http://localhost:3000`

### Step 2: Open Browser

1. Open **Chrome/Firefox** in **Incognito Mode** (fresh session)
2. Navigate to: `http://localhost:3000`
3. Open **DevTools** (F12 or Cmd+Option+I)
4. Click **Console** tab
5. Clear console (click 🚫 button)

### Step 3: Login

1. Login with your test account
2. Navigate to user profile (click avatar/username)
3. **Record Starting XP**: __________ XP

**Important**: Note your current XP before any testing!

---

## 📝 Testing Template (Use for Each Feature)

```
FEATURE: _______________
DATE: _______________
TIME: _______________

PRE-TEST:
- Starting XP: __________ XP
- Console: Clear ✅ / Has errors ❌
- Browser: Chrome / Firefox / Safari / Edge
- Mode: Incognito ✅ / Normal

REVIEW MODE TEST:
1. Navigate to feature: ✅ / ❌
2. Feature loads without errors: ✅ / ❌
3. Console is clear: ✅ / ❌
4. Can start review session: ✅ / ❌
5. First item displays: ✅ / ❌
6. Progress bar shows: ✅ / ❌
7. Can answer correctly: ✅ / ❌
8. Progress updates: ✅ / ❌
9. Can answer incorrectly: ✅ / ❌
10. Feedback shows: ✅ / ❌
11. Complete all items: ✅ / ❌
12. Session summary appears: ✅ / ❌
13. Statistics are correct: ✅ / ❌

GAMIFICATION CHECK:
14. Ending XP: __________ XP
15. XP Increased: YES ✅ / NO ❌
16. XP Gain Amount: __________ XP
17. Gain is reasonable (>0): ✅ / ❌
18. Celebration appeared (if threshold): ✅ / N/A / ❌

CONSOLE CHECK:
19. "[EventHub] Initialized" found: ✅ / ❌
20. No red errors in console: ✅ / ❌
21. No warnings in console: ✅ / ⚠️ (describe)

STUDY MODE TEST (if applicable):
22. Study mode exists: YES / NO
23. Can start study mode: ✅ / ❌ / N/A
24. Items display correctly: ✅ / ❌ / N/A
25. Can navigate through items: ✅ / ❌ / N/A
26. Session completes: ✅ / ❌ / N/A
27. XP did NOT increase: ✅ / ❌ / N/A

RESULT: PASS ✅ / FAIL ❌
NOTES: _______________________________________________
```

---

## 🧪 Feature 1: Kana Learning

### Route
`http://localhost:3000/en/learn/hiragana`

### Pre-Test Setup
1. **Starting XP**: __________ XP
2. Clear browser console

### Review Mode Test Steps

**Step 1**: Navigate to Kana Learning
```
URL: /en/learn/hiragana
or: /en/learn/katakana
```

**Step 2**: Select Characters
- Click on characters: **あ, い, う, え, お** (5 items)
- Characters should highlight when selected
- Counter should show: "5 characters selected"

**Step 3**: Start Review Mode
- Click **"Start Review"** button (NOT "Study Mode")
- Wait for review session to load

**Step 4**: Answer Questions
- Mode should be: **Recognition** (character → romaji)
- Answer first question correctly
- Progress should update: 1/5
- Answer second question incorrectly (test feedback)
- Continue until all 5 items completed

**Step 5**: Check Session Summary
- Summary should appear with statistics
- Check accuracy percentage
- Check response times
- Close summary

**Step 6**: Verify XP
- Go to user profile (click avatar)
- **Ending XP**: __________ XP
- Calculate gain: Ending - Starting = __________
- **Expected**: +20 to +50 XP (roughly +10 per item)

### Study Mode Test Steps (Should NOT Award XP)

**Step 1**: Return to Kana Learning
- Same characters selected

**Step 2**: Start Study Mode
- Click **"Study Mode"** button (NOT "Start Review")

**Step 3**: Go Through Items
- Just view characters (no answering)
- Click "Next" for each item
- Complete all items

**Step 4**: Verify NO XP Gain
- Check user profile
- XP should be **same as after review mode**
- **Expected**: No XP change ✅

### Console Checks

Look for these in console:

**Good Signs** ✅:
```
[EventHub] Initialized for user: <userId>
[Kana Review] handleReviewComplete called
[Kana Study] Session completed: { ... }
```

**Bad Signs** ❌:
- Red error messages
- "undefined is not a function"
- Uncaught exceptions
- Failed to fetch

### Test Results

```
FEATURE: Kana Learning
REVIEW MODE: ✅ / ❌
- XP Awarded: __________ XP
- Result: PASS / FAIL

STUDY MODE: ✅ / ❌
- XP NOT Awarded: ✅ / ❌
- Result: PASS / FAIL

CONSOLE: ✅ / ❌
- Errors: None / List below

OVERALL: PASS ✅ / FAIL ❌
```

---

## 🧪 Feature 2: Kanji Browser

### Route
`http://localhost:3000/en/kanji-browser`

### Pre-Test Setup
1. **Current XP**: __________ XP
2. Clear browser console

### Review Mode Test Steps

**Step 1**: Navigate to Kanji Browser

**Step 2**: Select Kanji
- Select 5-10 kanji from the list
- Kanji should highlight when selected

**Step 3**: Start Review Mode
- Click **"Start Review"** button

**Step 4**: Answer Questions
- Answer format may be multiple choice or typing
- Complete all items

**Step 5**: Check Summary & XP
- **Ending XP**: __________ XP
- **Expected Gain**: +30 to +100 XP

### Study Mode Test (if exists)

**Step 1**: Start Study Mode
- Look for "Study Mode" button

**Step 2**: Go Through Flashcards
- Just view kanji (no answering)

**Step 3**: Verify NO XP Gain
- XP should remain same ✅

### Test Results

```
FEATURE: Kanji Browser
REVIEW MODE: ✅ / ❌
- XP Awarded: __________ XP

STUDY MODE: ✅ / ❌ / N/A
- XP NOT Awarded: ✅ / ❌

CONSOLE: ✅ / ❌

OVERALL: PASS ✅ / FAIL ❌
```

---

## 🧪 Feature 3: Textbook Vocabulary

### Route
`http://localhost:3000/en/textbook-vocabulary`

### Pre-Test Setup
1. **Current XP**: __________ XP
2. Clear browser console

### Review Mode Test Steps

**Step 1**: Navigate to Textbook Vocabulary

**Step 2**: Select Vocabulary
- Choose a lesson or textbook
- Select vocabulary items

**Step 3**: Start Review Mode
- Click "Start Review"

**Step 4**: Answer Questions
- Complete all items
- May include audio playback

**Step 5**: Check Summary & XP
- **Ending XP**: __________ XP
- **Expected Gain**: +30 to +100 XP

### Study Mode Test

**Step 1**: Start Study Mode
- View vocabulary flashcards

**Step 2**: Verify NO XP Gain
- XP should remain same ✅

### Test Results

```
FEATURE: Textbook Vocabulary
REVIEW MODE: ✅ / ❌
- XP Awarded: __________ XP

STUDY MODE: ✅ / ❌
- XP NOT Awarded: ✅ / ❌

CONSOLE: ✅ / ❌

OVERALL: PASS ✅ / FAIL ❌
```

---

## 🧪 Feature 4: Anki Study

### Route
`http://localhost:3000/en/anki-study/<deckId>`

### Pre-Test Setup
1. **Current XP**: __________ XP
2. Clear browser console
3. **Note**: May need to import a deck first

### Review Mode Test Steps

**Step 1**: Navigate to Anki Study
- Select or create a deck

**Step 2**: Start Study Session
- Click "Start Study" or "Begin Review"
- **Note**: Anki's "study" is actually review mode (has SRS)

**Step 3**: Answer Cards
- Follow Anki's SRS prompts
- Answer multiple cards

**Step 4**: Check Summary & XP
- **Ending XP**: __________ XP
- **Expected Gain**: +50 to +150 XP

### Study Mode Test

**Note**: Anki typically only has review mode (SRS), no passive study mode

- Study Mode Exists: YES / NO
- If NO: Mark N/A ✅

### Test Results

```
FEATURE: Anki Study
REVIEW MODE: ✅ / ❌
- XP Awarded: __________ XP

STUDY MODE: N/A ✅
- No study mode exists

CONSOLE: ✅ / ❌

OVERALL: PASS ✅ / FAIL ❌
```

---

## 🧪 Feature 5: User Lists

### Route
`http://localhost:3000/en/lists/<listId>`

### Pre-Test Setup
1. **Current XP**: __________ XP
2. Clear browser console
3. **Note**: May need to create a list first

### Review Mode Test Steps

**Step 1**: Navigate to User Lists
- Create a list or select existing
- Add items to list

**Step 2**: Start Review Mode
- Click "Start Review"

**Step 3**: Answer Questions
- Complete all list items

**Step 4**: Check Summary & XP
- **Ending XP**: __________ XP
- **Expected Gain**: +20 to +100 XP

### Study Mode Test

**Step 1**: Start Study Mode (if exists)
- View list items as flashcards

**Step 2**: Verify NO XP Gain
- XP should remain same ✅

### Test Results

```
FEATURE: User Lists
REVIEW MODE: ✅ / ❌
- XP Awarded: __________ XP

STUDY MODE: ✅ / ❌
- XP NOT Awarded: ✅ / ❌

CONSOLE: ✅ / ❌

OVERALL: PASS ✅ / FAIL ❌
```

---

## 🧪 Feature 6: Review Session

### Route
`http://localhost:3000/en/review/session`

### Pre-Test Setup
1. **Current XP**: __________ XP
2. Clear browser console
3. **Note**: This is a general review session page

### Review Mode Test Steps

**Step 1**: Navigate to Review Session

**Step 2**: Start Session
- Understand what content it reviews
- Start the session

**Step 3**: Answer Questions
- Complete the review session

**Step 4**: Check Summary & XP
- **Ending XP**: __________ XP
- **Expected Gain**: XP should increase

### Study Mode Test

- Study Mode Exists: Check if applicable
- If NO: Mark N/A ✅

### Test Results

```
FEATURE: Review Session
REVIEW MODE: ✅ / ❌
- XP Awarded: __________ XP

STUDY MODE: N/A / ✅ / ❌

CONSOLE: ✅ / ❌

OVERALL: PASS ✅ / FAIL ❌
```

---

## 📊 Summary Testing Report

### Overall Results

| Feature | Review XP | Study No XP | Console | Result |
|---------|-----------|-------------|---------|--------|
| Kana Learning | ✅ / ❌ | ✅ / ❌ | ✅ / ❌ | PASS / FAIL |
| Kanji Browser | ✅ / ❌ | ✅ / ❌ | ✅ / ❌ | PASS / FAIL |
| Textbook Vocab | ✅ / ❌ | ✅ / ❌ | ✅ / ❌ | PASS / FAIL |
| Anki Study | ✅ / ❌ | N/A | ✅ / ❌ | PASS / FAIL |
| User Lists | ✅ / ❌ | ✅ / ❌ | ✅ / ❌ | PASS / FAIL |
| Review Session | ✅ / ❌ | N/A | ✅ / ❌ | PASS / FAIL |

**Total Pass**: ___/6
**Total Fail**: ___/6

### XP Tracking

| Test | Starting XP | Ending XP | Gain | Expected |
|------|-------------|-----------|------|----------|
| Initial | ______ | - | - | - |
| Kana Review | ______ | ______ | ______ | +20-50 |
| Kana Study | ______ | ______ | 0 | 0 |
| Kanji Review | ______ | ______ | ______ | +30-100 |
| Kanji Study | ______ | ______ | 0 | 0 |
| Textbook Review | ______ | ______ | ______ | +30-100 |
| Textbook Study | ______ | ______ | 0 | 0 |
| Anki Review | ______ | ______ | ______ | +50-150 |
| User Lists Review | ______ | ______ | ______ | +20-100 |
| User Lists Study | ______ | ______ | 0 | 0 |
| Review Session | ______ | ______ | ______ | Variable |

### Console Errors Found

**Feature**: _______________
**Error**: _______________
**Screenshot**: _______________

(Repeat for each error found)

---

## ✅ Success Criteria

All of the following MUST be true:

- [x] All 6 review modes award XP ✅
- [x] All 3 study modes do NOT award XP ✅
- [x] No console errors in any feature ✅
- [x] Session summaries appear correctly ✅
- [x] Progress bars work ✅
- [x] Answer validation works ✅

**Overall Status**: PASS ✅ / FAIL ❌

---

## 🐛 Issue Tracking

If any test fails, document here:

### Issue 1
**Feature**: _______________
**Type**: XP Not Awarded / Console Error / UI Bug / Other
**Description**: _______________
**Steps to Reproduce**: _______________
**Expected**: _______________
**Actual**: _______________
**Screenshot**: _______________
**Priority**: High / Medium / Low

(Add more issues as needed)

---

## 📝 Tester Notes

**Overall Testing Experience**: _______________

**Any Concerns**: _______________

**Recommendations**: _______________

**Ready for Production**: YES ✅ / NO ❌

---

## ✍️ Sign-Off

**Tester Name**: _______________
**Date**: _______________
**Time Spent**: _______________
**Result**: All tests passed ✅ / Issues found (see above) ❌

---

**Testing Complete**: YES / NO
**Next Step**: Merge to main / Fix issues
