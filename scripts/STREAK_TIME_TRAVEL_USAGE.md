# 🕐 Streak Time Travel Tool - Usage Guide

## Quick Start

Simply run from anywhere:
```bash
streak
```

This will launch an interactive console for testing streak functionality.

## Features

### 📊 Status & Viewing
- **View current streak status** - Shows detailed breakdown of user's streak, XP, time since last activity, and save costs
- **View full user data** - Complete Firebase data dump for inspection

### ⏰ Time Travel
- **Set last activity to TODAY** - Makes user active today
- **Set last activity to YESTERDAY** - Places user within grace period (1 day)
- **Set last activity to N days ago** - Custom time travel (e.g., 2, 3, 5 days)
- **Set last activity to SPECIFIC DATE** - Enter exact date in YYYY-MM-DD format

### 💰 Data Modification
- **Add/subtract XP** - Modify user's XP balance (positive or negative)
- **Set streak count** - Manually set current streak value
- **Reset streak to 0** - Completely reset the streak (preserves best streak)

### 🎬 Quick Test Scenarios

Pre-configured scenarios for rapid testing:

#### s1 - Active Streak
- Last activity: 1 day ago
- Status: Within grace period ✅
- Use case: Test normal continuation

#### s2 - Breaking (Can Save)
- Last activity: 2 days ago
- Save cost: 50 XP
- Use case: Test XP-save with affordable cost

#### s3 - Breaking (Last Chance)
- Last activity: 3 days ago
- Save cost: 75 XP
- Use case: Test XP-save at max window

#### s4 - Too Late
- Last activity: 5 days ago
- Status: Beyond save window ❌
- Use case: Test "too late" scenario

#### s5 - Active Today
- Last activity: Today
- Status: Already active
- Use case: Test no-action-needed state

#### s6 - Perfect Save Test
- 7-day streak
- 2 days late
- 1000+ XP
- Use case: Complete save flow testing

#### s7 - Insufficient XP
- 5-day streak
- 3 days late
- Less than 75 XP
- Use case: Test insufficient funds scenario

## Example Workflow

### Test the XP-Save Feature

1. **Run the tool:**
   ```bash
   streak
   ```

2. **Apply perfect save scenario:**
   - Enter: `s6`
   - This sets up: 7-day streak, 2 days late, plenty of XP

3. **Check status:**
   - Enter: `1`
   - Verify: Shows "BREAKING" status, 50 XP save cost, "Can Save!" indicator

4. **Now test in app:**
   - Open your app at http://localhost:3000/dashboard
   - The StreakSaveModal should appear
   - Click "Save Streak" and verify it works

5. **Verify in tool:**
   - Enter: `1` again
   - Confirm: lastActivityDate moved to yesterday, XP deducted

### Test Insufficient XP

1. **Apply insufficient XP scenario:**
   - Enter: `s7`

2. **Check status:**
   - Enter: `1`
   - Verify: Shows "Can afford: ❌ No"

3. **Test in app:**
   - Modal should show "Not enough XP" message

## Status Display Explained

```
🔥 STREAK STATUS
================================================================================
User ID: 8onZzlQg3tQxkw8pinSF9ow4Q6j2
Email: emmanuelfabiani23@gmail.com

📊 CURRENT DATA:
  Streak: 7 days (Best: 7)
  XP: 165 (Level 1)
  Last Activity: 2025-11-04
  Today: 2025-11-06

⏰ TIME STATUS:
  Days since activity: 2 days
  Status: ❌ BREAKING (💾 Can Save!)
  Grace period: ❌ Expired
  Save window: ✅ Can save (2-3 days)

💰 SAVE COST:
  Cost to save: 50 XP (25 × 2 days)
  Can afford: ✅ Yes
  Remaining after save: 115 XP
================================================================================
```

## Firebase User

**Current User:** 8onZzlQg3tQxkw8pinSF9ow4Q6j2 (Emmanuel Fabiani)

To test with a different user, edit line 23 in `scripts/streak-time-travel.js`:
```javascript
const userId = 'YOUR_USER_ID_HERE';
```

## Safety Notes

⚠️ This tool modifies **production Firebase data**. Use carefully!

- All changes are immediately written to Firestore
- Changes are real and persist
- Best used on test/staging environment or test users
- Can always reset data using the tool itself

## Tips

1. **Start with status (option 1)** - Always check current state first
2. **Use quick scenarios** - Faster than manual time travel
3. **Test end-to-end** - Use tool to set up state, then test in app
4. **Reset when done** - Use option 9 to reset streak if needed
5. **Check full data** - Option 2 shows everything in Firebase

## Integration with App Testing

1. **Set up scenario** with this tool
2. **Reload app** in browser (hard refresh: Ctrl+Shift+R)
3. **Verify behavior** in UI
4. **Check result** back in this tool
5. **Reset and repeat** for different scenarios

## Troubleshooting

**Modal not appearing?**
- Check console for errors
- Verify `useStreakSaveDetection` hook is integrated
- Clear localStorage: `localStorage.clear()`

**Save not working?**
- Check API endpoint is running: http://localhost:3000/api/gamification/streak/save
- Check browser console for errors
- Verify Firebase Admin SDK is configured

**Data not updating?**
- Confirm you're testing the right user
- Hard refresh the app (Ctrl+Shift+R)
- Check Firebase Console directly

## Exit

Press `0` or `Ctrl+C` to exit the tool.
