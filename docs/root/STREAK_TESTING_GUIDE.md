# Streak Testing Guide - Complete Step-by-Step Instructions

## Prerequisites
1. Make sure you're logged in (not as guest)
2. Open browser DevTools Console (F12) to see debug logs
3. You should see logs like:
   - `[useAuth] Auth state changed: {uid: "YOUR_USER_ID", ...}`
   - `[KanaLearningComponent] User from useAuth: {uid: "YOUR_USER_ID", ...}`

## Method 1: Testing with Study Mode (Quickest)

### Step 1: Navigate to Hiragana Learning Page
1. Go to the Hiragana learning page
2. You should see the Grid view with all hiragana characters

### Step 2: Select Specific Characters
1. Click on these EXACT 3 characters to select them:
   - **あ (a)** - First character in the grid
   - **い (i)** - Second character
   - **う (u)** - Third character
2. You should see "Study (3)" and "Review (3)" buttons in the navbar

### Step 3: Enter Study Mode
1. Click the **"Study (3)"** button
2. You'll see the first character (あ) in flashcard format

### Step 4: Mark as Learned (Triggers Streak)
1. Click the **"Mark as Learned"** button (green button)
2. In the console, you should see:
   ```
   [KanaStudyMode] Recorded daily activity for marking item as learned
   ```
3. The card will automatically advance to い (i)

### Step 5: Verify Streak Increased
1. Click the back arrow or "Grid" button to return to grid view
2. Navigate to your dashboard or profile
3. Your streak should now show **1 day** 🔥

## Method 2: Testing with Review Mode

### Step 1: Select Characters
1. From the Grid view, select these 3 characters:
   - **か (ka)**
   - **き (ki)**
   - **く (ku)**

### Step 2: Start Review
1. Click the **"Review (3)"** button
2. You'll enter the review/quiz mode

### Step 3: Complete the Review
1. Answer each question (doesn't matter if correct or wrong)
   - For recognition mode: Click the correct character
   - For recall mode: Type the romaji (ka, ki, ku)
2. Complete all 3 items
3. Review session will complete automatically

### Step 4: Check Console Logs
You should see:
```
[KanaLearningComponent] Passing userId to ReviewEngine: YOUR_USER_ID
[ReviewEngine] Session completed
```

### Step 5: Verify Streak
1. Return to dashboard
2. Streak should show **1 day** (or increment if you already had a streak)

## Method 3: Complete Study Session (Alternative)

### Step 1: Select More Characters
1. Select exactly these 5 characters:
   - **さ (sa)**
   - **し (shi)**
   - **す (su)**
   - **せ (se)**
   - **そ (so)**

### Step 2: Study All Characters
1. Click **"Study (5)"**
2. Use the Next button (→) to go through all 5 characters
3. Don't need to mark as learned, just navigate through them

### Step 3: Reach the Last Character
1. When you reach **そ (so)** (character 5 of 5)
2. Console should show:
   ```
   [KanaStudyMode] Recorded daily activity for study session completion
   ```

### Step 4: Verify Streak
1. Return to dashboard
2. Streak should be incremented

## Debugging Checklist

### If Streak Doesn't Update:

1. **Check User Authentication**
   ```javascript
   // In browser console, type:
   localStorage.getItem('activities_' + 'YOUR_USER_ID')
   ```
   Should return something like: `{"2025-01-15": true}`

2. **Check Activity Was Recorded**
   Look for console logs:
   - `[KanaStudyMode] Recorded daily activity...`
   - `[KanaLearningComponent] Passing userId to ReviewEngine: [not "anonymous"]`

3. **Manually Check Streak Calculation**
   The streak looks for:
   - Activities in `localStorage.getItem('activities_YOUR_USER_ID')`
   - Items with `lastReviewed` dates in progress data

4. **Common Issues:**
   - ❌ userId shows "anonymous" → Not properly logged in
   - ❌ No console logs → Check browser console filter settings
   - ❌ Activities not saving → Check localStorage permissions

## Expected localStorage Data

After completing any of the above methods, check localStorage:

```javascript
// Check activities (this is what tracks streaks)
localStorage.getItem('activities_r7r6at83BUPIjD69XatI4EGIECr1')
// Should show: {"2025-01-15": true}

// Check progress (character-specific data)
localStorage.getItem('kana-progress-hiragana-r7r6at83BUPIjD69XatI4EGIECr1')
// Should show progress for characters you've studied/reviewed
```

## Testing Multiple Days

To test a 2-day streak:
1. Complete one of the methods above today
2. Change your system date to tomorrow
3. Repeat any method
4. Your streak should show **2 days**

## Reset Testing

To reset and start fresh:
```javascript
// In browser console:
localStorage.removeItem('activities_' + 'YOUR_USER_ID')
localStorage.removeItem('kana-progress-hiragana-' + 'YOUR_USER_ID')
localStorage.removeItem('kana-progress-katakana-' + 'YOUR_USER_ID')
```

## Success Indicators

✅ You've successfully increased your streak when:
1. Console shows activity recorded message
2. localStorage contains today's date in activities
3. Dashboard/profile shows streak count > 0
4. Streak flame icon 🔥 appears with number

## Notes

- Only ONE activity per day counts (multiple activities same day won't increase streak)
- Streak requires CONSECUTIVE days
- Missing a day resets streak to 0
- Both Study and Review modes count equally toward streak
- Guest users cannot maintain streaks (no userId)