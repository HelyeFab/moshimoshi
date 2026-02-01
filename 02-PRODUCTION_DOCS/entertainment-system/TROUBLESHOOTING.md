# Entertainment System - Troubleshooting Guide

**Status:** ACTIVE
**Last Updated:** 2026-02-01

## Table of Contents

1. [Feature Visibility Issues](#1-feature-visibility-issues)
2. [XP and Gamification Issues](#2-xp-and-gamification-issues)
3. [Leaderboard Problems](#3-leaderboard-problems)
4. [Achievement Issues](#4-achievement-issues)
5. [Review Hub Problems](#5-review-hub-problems)
6. [Game-Specific Issues](#6-game-specific-issues)
7. [Performance Issues](#7-performance-issues)
8. [Data Sync Problems](#8-data-sync-problems)

---

## 1. Feature Visibility Issues

### Problem: Entertainment District Not Showing in Learning Village

**Symptoms:**
- Games, Review Hub, Achievements, or Leaderboard stalls missing from Learning Village
- District appears empty or incomplete

**Common Causes & Solutions:**

#### Cause 1: Feature Flags Not Enabled

**Check:**
```bash
# View .env.local
cat .env.local | grep FEATURE
```

**Should see:**
```bash
NEXT_PUBLIC_FEATURE_GAMES=true
NEXT_PUBLIC_FEATURE_REVIEW_HUB=true
NEXT_PUBLIC_FEATURE_ACHIEVEMENTS=true
NEXT_PUBLIC_FEATURE_LEADERBOARD=true
```

**Fix:**
```bash
# Edit .env.local and set to true
NEXT_PUBLIC_FEATURE_GAMES=true

# CRITICAL: Restart dev server
npm run dev
```

#### Cause 2: Dev Server Not Restarted

**Symptoms:**
- Changed `.env.local` but features still not visible
- Feature flag changes not taking effect

**Fix:**
```bash
# Stop server (Ctrl+C)
# Start again
npm run dev
```

**Why:** Environment variables are read at startup only. Changes require full restart (hot reload doesn't apply to env vars).

#### Cause 3: Firestore Config Has Feature Disabled

**Check localStorage:**
```javascript
// In browser console
JSON.parse(localStorage.getItem('moshimoshi_learning_village_config'))
  ?.stalls
  .find(s => s.id === 'games')

// Output should show:
// { id: 'games', enabled: true, order: 21, isPopular: true }
```

**If `enabled: false`:**
```javascript
// Clear cache and reload
localStorage.removeItem('moshimoshi_learning_village_config')
location.reload()
```

**If still disabled:**
1. Navigate to `/admin/learning-village`
2. Find the feature stall in the table
3. Toggle `enabled` to true
4. Click "Save Changes"

**OR reset to defaults:**
```javascript
// In browser console
fetch('/api/admin/learning-village', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'reset' })
})
.then(r => r.json())
.then(data => {
  console.log('Reset result:', data)
  if (data.success) {
    localStorage.removeItem('moshimoshi_learning_village_config')
    location.reload()
  }
})
```

#### Cause 4: Browser Cache

**Fix:**
```bash
# Hard refresh browser
# Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
# Firefox: Ctrl+F5
```

---

### Problem: Command Palette Not Showing Games/Achievements

**Symptoms:**
- Searching for "games" or "achievements" in Command Palette returns no results
- Shortcuts (`g g`, `g a`) don't work

**Diagnostic:**
```typescript
// Check feature flags in browser console
console.log({
  games: process.env.NEXT_PUBLIC_FEATURE_GAMES,
  achievements: process.env.NEXT_PUBLIC_FEATURE_ACHIEVEMENTS,
  leaderboard: process.env.NEXT_PUBLIC_FEATURE_LEADERBOARD
})

// Should all be 'true'
```

**Fix:**
1. Ensure feature flags set to `true` in `.env.local`
2. Restart dev server
3. Hard refresh browser
4. Try Command Palette again (`Cmd/Ctrl+K`)

---

### Problem: Feature Page Shows But Then Redirects

**Symptoms:**
- Click on Games stall → page loads briefly → redirects to dashboard
- URL changes from `/games` to `/dashboard`

**Cause:** Feature flag check in page component

**Check page component:**
```typescript
// src/app/[locale]/games/page.tsx:18
const isGamesEnabled = process.env.NEXT_PUBLIC_FEATURE_GAMES === 'true'

useEffect(() => {
  if (!isGamesEnabled) {
    router.replace('/dashboard') // ← This is triggering
  }
}, [router])
```

**Fix:**
1. Verify `.env.local` has `NEXT_PUBLIC_FEATURE_GAMES=true`
2. **Restart dev server** (critical step)
3. Clear browser cache
4. Try again

**Still not working?**
```bash
# Check if .env.local is being read
# Add temporary log in page component:
console.log('FEATURE_GAMES:', process.env.NEXT_PUBLIC_FEATURE_GAMES)

# Restart and check browser console
```

---

## 2. XP and Gamification Issues

### Problem: XP Not Being Awarded

**Symptoms:**
- Complete activities but XP counter doesn't increase
- Zustand store shows 0 XP
- No level up notifications

**Diagnostic Steps:**

#### Step 1: Check Browser Console
```javascript
// Open DevTools console (F12)
// Look for errors like:
// - "Failed to award XP"
// - "401 Unauthorized"
// - "Network error"
```

#### Step 2: Check Authentication
```javascript
// In browser console
fetch('/api/gamification/test', {
  method: 'GET'
})
.then(r => r.json())
.then(d => console.log('Auth status:', d))

// Should return user data, not 401
```

**If 401:** User not logged in. Fix authentication first.

#### Step 3: Check Firestore Connection
```javascript
// In browser console
fetch('/api/gamification/status')
  .then(r => r.json())
  .then(d => console.log('Firestore status:', d))
```

#### Step 4: Check Completion Ledger

**Problem:** Duplicate XP awards blocked

**Check:**
```javascript
// In Firestore console
// Navigate to: users/{userId}/completion_ledger/

// Look for recent entries
// If activity already exists, XP won't be re-awarded (by design)
```

**Fix:** This is expected behavior to prevent duplicate XP. If it's a new activity that should award XP, ensure unique `activityId`.

---

### Problem: Zustand Store Out of Sync

**Symptoms:**
- XP awarded server-side but not reflected in UI
- Refresh fixes the issue
- Optimistic update not rolling back on error

**Fix 1: Force Sync from Firebase**
```javascript
// In browser console
import { useGamificationStore } from '@/state/userGamification'

const { loadFromFirebase } = useGamificationStore.getState()
await loadFromFirebase()

// Or simply reload page
location.reload()
```

**Fix 2: Clear IndexedDB Cache**
```javascript
// In browser console
indexedDB.deleteDatabase('gamification-storage')
location.reload()
```

**Fix 3: Check Mutation Queue**
```typescript
// In userGamification.ts store
// Enable debug logging
const store = useGamificationStore.getState()
console.log('Pending operations:', store.operations)

// Should be empty array if everything synced
```

---

### Problem: Level Not Updating

**Symptoms:**
- XP increases but level stays at 1
- XP exceeds level threshold but no level-up

**Diagnostic:**
```javascript
// Check XP thresholds
fetch('/api/gamification/levels')
  .then(r => r.json())
  .then(levels => {
    console.log('Level thresholds:', levels)

    const currentXP = 1500 // Your current XP
    const currentLevel = levels.findIndex((threshold, i) => {
      const nextThreshold = levels[i + 1]
      return currentXP >= threshold && currentXP < nextThreshold
    }) + 1

    console.log('Should be level:', currentLevel)
  })
```

**Fix:** Level calculation in coordinator

**Check:**
```typescript
// src/lib/gamification/services/gamification-coordinator.ts

// Ensure calculateLevel function exists and is called
function calculateLevel(totalXP: number): number {
  const levels = require('@/config/gamification/levels.json')

  for (let i = levels.length - 1; i >= 0; i--) {
    if (totalXP >= levels[i].xpRequired) {
      return levels[i].level
    }
  }

  return 1
}
```

**Manual Fix (Emergency):**
```javascript
// Recalculate and update level via API
await fetch('/api/gamification/recalculate-level', {
  method: 'POST'
})
```

---

## 3. Leaderboard Problems

### Problem: Leaderboard Shows Empty or "No Data"

**Symptoms:**
- Leaderboard page loads but shows no entries
- "No players found" message
- Loading spinner never completes

**Diagnostic:**

#### Step 1: Check Redis Cache
```bash
# If you have Redis CLI access
redis-cli

# Check if leaderboard key exists
EXISTS leaderboard:allTime-latest

# View cached data
GET leaderboard:allTime-latest
```

**If key doesn't exist:** Cache is empty

#### Step 2: Check Firestore Snapshot
```javascript
// In browser console
fetch('/api/admin/leaderboard/status')
  .then(r => r.json())
  .then(d => console.log('Snapshot status:', d))

// Check if leaderboard_snapshots/allTime-latest exists in Firestore
```

**If snapshot doesn't exist:**
```javascript
// Trigger manual generation
await fetch('/api/admin/leaderboard/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})

// Wait 30 seconds, then reload leaderboard page
```

#### Step 3: Check for Users with XP
```javascript
// Verify users have XP data
fetch('/api/admin/users/with-xp')
  .then(r => r.json())
  .then(users => console.log(`${users.length} users with XP`))

// If 0: No users have earned XP yet (expected for new install)
```

---

### Problem: User Rank Not Displaying

**Symptoms:**
- Leaderboard shows but "Your Rank" card is blank
- API returns 404 or null

**Diagnostic:**
```javascript
// Check user rank API
fetch('/api/leaderboard/user-rank')
  .then(r => r.json())
  .then(d => console.log('User rank:', d))

// Expected response:
// {
//   rank: 42,
//   totalXP: 1234,
//   currentLevel: 5,
//   ...
// }
```

**Possible Causes:**

1. **User opted out of leaderboard**
   ```javascript
   // Check opt-out status
   fetch('/api/leaderboard/opt-out/status')
     .then(r => r.json())
     .then(d => console.log('Opted out:', d.optedOut))
   ```

   **Fix:** Toggle visibility in settings

2. **User not in top 100**
   - Leaderboard only tracks top 100 players
   - If user's rank > 100, they won't appear
   - Feature request: Support for showing ranks beyond top 100

3. **Gamification data missing**
   - User has no XP
   - Check Firestore: `users/{userId}/gamification`

---

### Problem: Leaderboard Data Stale

**Symptoms:**
- XP increased but rank hasn't updated
- Data is hours/days old
- Seeing "Last updated" timestamp in the past

**Cause:** Cache TTL not expired

**Check cache age:**
```javascript
fetch('/api/leaderboard')
  .then(r => {
    const age = r.headers.get('age') // Seconds since cached
    console.log(`Cache age: ${age}s (TTL: 300s)`)
    return r.json()
  })
  .then(d => console.log('Last updated:', new Date(d.lastUpdated)))
```

**Force Refresh:**

**Option 1:** Wait for cache to expire (5 minutes)

**Option 2:** Admin trigger
```javascript
await fetch('/api/admin/leaderboard/trigger', {
  method: 'POST'
})
```

**Option 3:** Clear Redis cache (requires admin access)
```bash
redis-cli DEL leaderboard:allTime-latest
```

---

## 4. Achievement Issues

### Problem: Achievement Not Unlocking

**Symptoms:**
- Met conditions but achievement not unlocked
- No notification shown
- Achievement still shows as locked

**Diagnostic:**

#### Step 1: Check Achievement Conditions
```javascript
// View achievement definition
import achievements from '@/config/gamification/achievements.json'

const achievement = achievements.achievements.find(a => a.id === 'your_achievement_id')
console.log('Condition:', achievement.condition)

// Example: { type: 'session_count', operator: '>=', value: 10 }
```

#### Step 2: Check User Stats
```javascript
// In browser console
import { useGamificationStore } from '@/state/userGamification'

const state = useGamificationStore.getState()
console.log({
  sessionCount: state.sessionCount,
  totalXP: state.totalXP,
  currentStreak: state.currentStreak
})

// Compare to achievement condition
```

#### Step 3: Check Achievement Progress
```javascript
const progress = state.achievementProgress['your_achievement_id']
console.log('Progress:', progress, '/', achievement.condition.value)
```

**If condition met but not unlocked:**

**Manual Unlock (Emergency):**
```javascript
await fetch('/api/gamification/achievements/unlock', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ achievementId: 'your_achievement_id' })
})
```

---

### Problem: Achievement Already Unlocked Shows As Locked

**Cause:** Firestore out of sync with client

**Fix:**
```javascript
// Force reload from Firestore
import { useGamificationStore } from '@/state/userGamification'

const { loadFromFirebase } = useGamificationStore.getState()
await loadFromFirebase()

// Or reload page
location.reload()
```

---

### Problem: Achievement Notification Not Showing

**Symptoms:**
- Achievement unlocked (shows in `/achievements`)
- No popup notification appeared
- Event not firing

**Check event listener:**
```typescript
// In browser console
window.addEventListener('achievement-unlocked', (event) => {
  console.log('Achievement unlocked:', event.detail)
})

// Test manual trigger
window.dispatchEvent(new CustomEvent('achievement-unlocked', {
  detail: {
    achievement: {
      id: 'test',
      name: 'Test Achievement',
      description: 'Testing',
      icon: '🏆',
      rarity: 'rare'
    }
  }
}))

// Should see notification
```

**Fix:** Ensure `AchievementNotification` component mounted in app layout

---

## 5. Review Hub Problems

### Problem: Stats Not Loading

**Symptoms:**
- Review Hub shows loading spinner indefinitely
- Stats cards show 0 or "N/A"
- "Failed to load data" error

**Diagnostic:**
```javascript
// Check review data API
fetch('/api/review/stats')
  .then(r => r.json())
  .then(d => console.log('Review stats:', d))
```

**Possible Responses:**

1. **401 Unauthorized:** Not logged in
2. **500 Internal Server Error:** Check server logs
3. **Empty data:** No review sessions yet

**Fix for empty data:**
- Complete at least one review session
- Data will populate automatically

---

### Problem: Progress Heatmap Showing Wrong Data

**Symptoms:**
- Heatmap shows activity on days you didn't study
- Counts seem inflated or deflated
- Visual doesn't match actual activity

**Diagnostic:**
```javascript
// Check raw activity data
fetch('/api/review/activity-log?days=365')
  .then(r => r.json())
  .then(data => {
    console.log('Activity data:', data)

    // Verify specific date
    const today = new Date().toISOString().split('T')[0]
    const todayData = data.find(d => d.date === today)
    console.log('Today:', todayData)
  })
```

**Common Issues:**

1. **Timezone mismatch**
   - Server uses UTC
   - Client displays in local timezone
   - Can cause off-by-one-day errors

   **Fix:** Normalize to user's timezone in query

2. **Duplicate entries**
   - Same session counted multiple times
   - Check completion_ledger for duplicates

---

## 6. Game-Specific Issues

### Problem: Kanji Simon Not Loading

**Symptoms:**
- Board selection shows but clicking doesn't start game
- Game page blank
- Router error

**Check routing:**
```typescript
// Verify dynamic route exists
// Should have: src/app/[locale]/games/kanji-simon/[boardId]/page.tsx

// Check board ID validity
const validBoardIds = ['easy', 'medium', 'hard', 'jlpt-n5', 'jlpt-n4']
```

**Fix:**
```bash
# Check if file exists
ls -la src/app/[locale]/games/kanji-simon/[boardId]/

# If missing, board selection may have wrong route
# Check: src/app/[locale]/games/kanji-simon/page.tsx
# Ensure it links to: /games/kanji-simon/${boardId}
```

---

### Problem: Kana Drop Audio Not Playing

**Symptoms:**
- Game runs but no sound effects
- Audio icons show but clicking does nothing

**Diagnostic:**
```javascript
// Check audio context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
console.log('Audio state:', audioCtx.state) // Should be 'running'

// If 'suspended':
audioCtx.resume().then(() => {
  console.log('Audio resumed')
})
```

**Common Causes:**

1. **Autoplay policy**
   - Browsers block audio until user interaction
   - Audio must be triggered by click/tap

   **Fix:** Play audio only in response to user events

2. **Audio files not loaded**
   ```javascript
   // Check if audio files exist
   fetch('/sounds/correct.mp3')
     .then(r => console.log('Audio file status:', r.status))
   ```

   **Fix:** Ensure audio files in `/public/sounds/`

3. **Muted in game settings**
   ```javascript
   localStorage.getItem('game_audio_muted') // Should be 'false'
   ```

---

### Problem: Kanji Quest Pokemon Not Appearing

**Symptoms:**
- Battle starts but no Pokemon sprite
- "Unable to load Pokemon" error
- Sprite shows as broken image

**Check Pokemon data:**
```typescript
// src/data/pokemonData.ts
import { pokemonData } from '@/data/pokemonData'

console.log('Total Pokemon:', pokemonData.length)

// Check specific ID
const pokemon = pokemonData.find(p => p.id === 1)
console.log('Bulbasaur:', pokemon)
```

**Fix for missing sprites:**
```typescript
// Pokemon sprites should be in:
// /public/pokemon/sprites/

// Check if directory exists
// Verify sprite naming: 1.png, 2.png, etc.

// Fallback to placeholder if sprite missing
const spriteUrl = pokemon.sprite || '/pokemon/sprites/placeholder.png'
```

---

## 7. Performance Issues

### Problem: Learning Village Laggy with Entertainment District

**Symptoms:**
- Scrolling stutters
- Animations janky
- High CPU usage

**Diagnostic:**
```javascript
// Check FPS
let lastTime = performance.now()
let frames = 0

function checkFPS() {
  frames++
  const now = performance.now()

  if (now >= lastTime + 1000) {
    const fps = Math.round((frames * 1000) / (now - lastTime))
    console.log('FPS:', fps)
    frames = 0
    lastTime = now
  }

  requestAnimationFrame(checkFPS)
}

checkFPS()

// FPS < 30 = performance issue
```

**Fixes:**

1. **Enable Low Power Mode**
   ```typescript
   // Click animation control toggle in Learning Village
   // Or set in localStorage:
   localStorage.setItem('animations_enabled', 'false')
   location.reload()
   ```

2. **Reduce visible stalls**
   - Disable unused features
   - Fewer stalls = better performance

3. **Check for memory leaks**
   ```javascript
   // Open DevTools → Performance tab
   // Record while scrolling Learning Village
   // Look for growing memory usage
   ```

---

### Problem: Games Running Slow

**Symptoms:**
- Canvas games lag
- Input delay
- Frame drops

**Diagnostic:**
```javascript
// Check game loop performance
let frameCount = 0
let lastTime = performance.now()

function gameLoop() {
  const now = performance.now()
  const delta = now - lastTime

  if (delta > 16.67) { // > 60fps
    console.warn('Slow frame:', delta, 'ms')
  }

  frameCount++
  lastTime = now

  requestAnimationFrame(gameLoop)
}

gameLoop()
```

**Fixes:**

1. **Optimize rendering**
   - Use `requestAnimationFrame`
   - Clear canvas efficiently
   - Limit draw calls

2. **Reduce entities**
   - Cap max falling objects
   - Cull off-screen entities
   - Use object pooling

3. **Throttle updates**
   ```typescript
   let lastUpdate = 0
   const updateInterval = 16 // 60 FPS

   function gameLoop(timestamp) {
     if (timestamp - lastUpdate >= updateInterval) {
       updateGame()
       lastUpdate = timestamp
     }

     requestAnimationFrame(gameLoop)
   }
   ```

---

## 8. Data Sync Problems

### Problem: Offline Changes Not Syncing

**Symptoms:**
- Made progress offline
- Came back online but data not in Firestore
- IndexedDB has data but Firebase doesn't

**Check sync queue:**
```javascript
// Open IndexedDB in DevTools
// Application tab → IndexedDB → gamification-storage

// Look for pending operations
// Should auto-sync on reconnection
```

**Force sync:**
```typescript
import { useGamificationStore } from '@/state/userGamification'

const { syncToFirebase } = useGamificationStore.getState()
await syncToFirebase()

console.log('Sync complete')
```

**If sync fails:**
```javascript
// Check network
fetch('/api/gamification/ping')
  .then(() => console.log('Network OK'))
  .catch(() => console.error('Network ERROR'))

// Check Firebase rules
// Ensure user has write permission to their own gamification doc
```

---

### Problem: Conflict Between Devices

**Symptoms:**
- Different XP on phone vs desktop
- Achievements unlocked on one device but not other
- Last-write-wins causing data loss

**Diagnostic:**
```javascript
// Check version numbers
fetch('/api/gamification/version')
  .then(r => r.json())
  .then(d => console.log('Server version:', d.version))

// Compare to local
import { useGamificationStore } from '@/state/userGamification'
const localVersion = useGamificationStore.getState().version
console.log('Local version:', localVersion)

// If different: conflict detected
```

**Resolution:**
```javascript
// Force full reload from server (overwrites local)
const { loadFromFirebase } = useGamificationStore.getState()
await loadFromFirebase()

// Or merge strategies (advanced)
```

**Prevention:**
- Always sync before significant actions
- Use version-based conflict detection
- Implement merge strategies for conflicts

---

## Emergency Procedures

### Complete Gamification Reset (Last Resort)

**WARNING:** This deletes ALL gamification data (XP, achievements, streaks). Only use if data is completely corrupted.

```javascript
// 1. Delete IndexedDB
indexedDB.deleteDatabase('gamification-storage')

// 2. Delete Firestore document (requires admin)
await fetch('/api/admin/gamification/reset-user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'USER_ID_HERE' })
})

// 3. Clear localStorage
localStorage.removeItem('gamification-last-sync')

// 4. Reload
location.reload()
```

---

### Debug Mode

Enable verbose logging:

```typescript
// In .env.local
NEXT_PUBLIC_DEBUG_GAMIFICATION=true

// Restart server
// Check browser console for detailed logs
```

---

## Getting Additional Help

### Information to Provide

When reporting issues, include:

1. **Environment**
   - Browser and version
   - OS
   - Device type (desktop/mobile)

2. **Steps to Reproduce**
   - What you did
   - What you expected
   - What actually happened

3. **Console Errors**
   - Open DevTools (F12)
   - Check Console tab
   - Copy any red errors

4. **Network Errors**
   - Open DevTools → Network tab
   - Filter by "Fetch/XHR"
   - Check for 4xx/5xx responses

5. **State Dump**
   ```javascript
   // Run in console
   import { useGamificationStore } from '@/state/userGamification'
   console.log(JSON.stringify(useGamificationStore.getState(), null, 2))
   ```

### Contact Channels

- **GitHub Issues:** Technical bugs
- **Discord:** Community support
- **Email:** support@moshimoshi.app

---

## Prevention Best Practices

1. **Always restart dev server after .env changes**
2. **Hard refresh browser when in doubt**
3. **Check browser console for errors first**
4. **Keep Firebase connection stable**
5. **Sync before making changes on multiple devices**
6. **Don't modify Firestore data manually**
7. **Test feature flags before deploying**

---

*For implementation details, see [FEATURE_GUIDE.md](./FEATURE_GUIDE.md)*

*Last Updated: 2026-02-01*
