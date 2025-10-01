# Time Machine Developer Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Adding Components to Time Machine](#adding-components-to-time-machine)
5. [Removing Components](#removing-components)
6. [Testing Guide](#testing-guide)
7. [Pre-Production Checklist](#pre-production-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Time Machine is a **development-only** feature that allows you to manipulate time in your application for testing time-dependent features like:
- Streak calculations
- SRS (Spaced Repetition System) review scheduling
- Achievement unlock dates
- Any date/time-based functionality

**⚠️ CRITICAL: This feature MUST be disabled in production!**

---

## Architecture

### Core Components

```
/src/lib/time/
├── virtualClock.ts          # Main virtual clock implementation
└── dateProvider.ts          # Date provider abstraction (optional)

/src/hooks/
└── useVirtualClock.ts       # React hook for time machine UI

/src/stores/
└── streakStore.ts           # Example: Uses virtualClock for streak dates
```

### How It Works

1. **Virtual Clock** - Provides offset-based time manipulation
   - Stores offset in localStorage: `virtualClock`
   - Exposes `now()`, `nowDate()`, `addOffset()`, `reset()` methods

2. **Admin Mode** - Required to see Time Machine UI
   - Controlled by localStorage: `isAdmin = 'true'`
   - Shows purple beaker button (🧪) in bottom-right

3. **Integration Pattern** - Components import and use `virtualClock` instead of `Date.now()`

---

## Getting Started

### Enable Time Machine (Development Only)

**Option 1: Browser Console**
```javascript
// Enable admin mode and virtual clock
localStorage.setItem('isAdmin', 'true')
localStorage.setItem('virtualClock', JSON.stringify({
  offsetMs: 0,
  frozenTime: null,
  isEnabled: true,
  history: []
}))
location.reload()
```

**Option 2: Run Enable Script**
```bash
# Copy contents of scripts/enable-time-machine.js
# Paste into browser console
```

### Verify It's Working

After enabling, you should see:
1. Purple beaker button (🧪) in bottom-right corner
2. Click it to open Time Machine modal
3. Use controls to travel through time

---

## Adding Components to Time Machine

### Step 1: Import Virtual Clock

```typescript
// ❌ BEFORE (regular time)
import { format } from 'date-fns'

const today = format(new Date(), 'yyyy-MM-dd')
const timestamp = Date.now()

// ✅ AFTER (virtual time)
import { virtualClock } from '@/lib/time/virtualClock'
import { format } from 'date-fns'

const today = format(virtualClock.nowDate(), 'yyyy-MM-dd')
const timestamp = virtualClock.now()
```

### Step 2: Replace All Time References

**Common Patterns to Update:**

| Old Code | New Code |
|----------|----------|
| `Date.now()` | `virtualClock.now()` |
| `new Date()` | `virtualClock.nowDate()` |
| `Date.now() / 1000` | `virtualClock.now() / 1000` |
| `new Date().getTime()` | `virtualClock.now()` |

### Step 3: Update Date Calculations

```typescript
// ❌ BEFORE
import { differenceInDays, parseISO } from 'date-fns'

const daysSince = differenceInDays(
  new Date(),
  parseISO(lastActiveDay)
)

// ✅ AFTER
import { differenceInDays, parseISO, startOfDay } from 'date-fns'
import { virtualClock } from '@/lib/time/virtualClock'

const daysSince = differenceInDays(
  startOfDay(virtualClock.nowDate()),
  startOfDay(parseISO(lastActiveDay))
)
```

### Step 4: Example - Full Integration

**File: `/src/stores/myFeatureStore.ts`**

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format, differenceInDays, parseISO, startOfDay } from 'date-fns'
import { virtualClock } from '@/lib/time/virtualClock'

interface MyFeatureState {
  lastUpdated: string | null
  checkIfExpired: () => boolean
  updateTimestamp: () => void
}

export const useMyFeatureStore = create<MyFeatureState>()(
  persist(
    (set, get) => ({
      lastUpdated: null,

      checkIfExpired: () => {
        const { lastUpdated } = get()
        if (!lastUpdated) return false

        // ✅ Use virtualClock for time calculations
        const daysSince = differenceInDays(
          startOfDay(virtualClock.nowDate()),
          startOfDay(parseISO(lastUpdated))
        )

        return daysSince > 7 // Expires after 7 days
      },

      updateTimestamp: () => {
        // ✅ Use virtualClock for new timestamps
        const today = format(virtualClock.nowDate(), 'yyyy-MM-dd')
        set({ lastUpdated: today })
      },
    }),
    {
      name: 'my-feature-storage',
    }
  )
)

// ✅ Run initial check using virtualClock
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useMyFeatureStore.getState().checkIfExpired()
  }, 0)
}
```

### Step 5: Test Your Integration

1. Enable Time Machine
2. Record current state (e.g., streak count)
3. Travel forward 2 days
4. Verify feature behaves correctly (e.g., streak still active)
5. Travel forward 7 days
6. Verify expiration logic works (e.g., streak broken)
7. Reset time and verify state returns to normal

---

## Removing Components

### When to Remove

- Feature is deprecated
- Migrating to server-side time (recommended for security)
- Simplifying codebase

### Step 1: Replace Virtual Clock with Real Time

```typescript
// ❌ Remove this
import { virtualClock } from '@/lib/time/virtualClock'
const timestamp = virtualClock.now()

// ✅ Replace with this
const timestamp = Date.now()
```

### Step 2: Update All Usages

Use find-and-replace:
- `virtualClock.now()` → `Date.now()`
- `virtualClock.nowDate()` → `new Date()`

### Step 3: Test Thoroughly

```bash
# Search for any remaining references
grep -r "virtualClock" src/

# Should only find:
# - src/lib/time/virtualClock.ts (core file)
# - src/hooks/useVirtualClock.ts (UI hook)
# - Components you intentionally kept
```

### Step 4: Verify Build

```bash
npm run build

# Ensure no errors related to time functions
```

---

## Testing Guide

### Manual Testing Scenarios

#### Scenario 1: Streak Expiration
```javascript
// 1. Record current streak
console.log('Current streak:', useStreakStore.getState().currentStreak)

// 2. Travel 2 days forward (should still be valid)
vcState = JSON.parse(localStorage.getItem('virtualClock'))
vcState.offsetMs = 2 * 24 * 60 * 60 * 1000
localStorage.setItem('virtualClock', JSON.stringify(vcState))
location.reload()

// 3. Check streak is still valid
console.log('After 2 days:', useStreakStore.getState().currentStreak)

// 4. Travel 7 days forward (should break)
vcState.offsetMs = 7 * 24 * 60 * 60 * 1000
localStorage.setItem('virtualClock', JSON.stringify(vcState))
location.reload()

// 5. Verify streak is broken
console.log('After 7 days:', useStreakStore.getState().currentStreak)
```

#### Scenario 2: SRS Review Intervals
```javascript
// 1. Complete a review
// 2. Check next review date
// 3. Travel to that date
// 4. Verify item appears in review queue
// 5. Travel back and verify it disappears
```

#### Scenario 3: Achievement Unlocks
```javascript
// 1. Note which achievements are locked
// 2. Travel to future date
// 3. Complete required actions
// 4. Verify achievements unlock with future timestamp
// 5. Reset and verify timestamps are correct
```

### Automated Testing

**File: `/src/__tests__/time-machine.test.ts`**

```typescript
import { virtualClock } from '@/lib/time/virtualClock'
import { useStreakStore } from '@/stores/streakStore'

describe('Time Machine Integration', () => {
  beforeEach(() => {
    // Reset virtual clock
    virtualClock.reset()
    localStorage.removeItem('streak-storage')
  })

  it('should allow time travel for streak testing', () => {
    const store = useStreakStore.getState()

    // Record activity today
    store.recordActivity('review_session')
    expect(store.currentStreak).toBe(1)

    // Travel 1 day forward
    virtualClock.addOffset(24 * 60 * 60 * 1000)
    store.recordActivity('review_session')
    expect(store.currentStreak).toBe(2)

    // Travel 3 days forward (breaks streak)
    virtualClock.addOffset(3 * 24 * 60 * 60 * 1000)
    store.checkAndUpdateStreak()
    expect(store.currentStreak).toBe(0)
  })

  it('should reset to real time', () => {
    const realNow = Date.now()

    virtualClock.addOffset(7 * 24 * 60 * 60 * 1000)
    const virtualNow = virtualClock.now()
    expect(virtualNow).toBeGreaterThan(realNow)

    virtualClock.reset()
    const resetNow = virtualClock.now()
    expect(Math.abs(resetNow - realNow)).toBeLessThan(1000)
  })
})
```

### Run Tests

```bash
npm test -- time-machine.test.ts
```

---

## Pre-Production Checklist

### 🚨 CRITICAL: Before Deploying to Production

**Run this checklist EVERY TIME before production deployment:**

### ✅ Step 1: Verify No Time Machine UI in Production

```bash
# Search for Time Machine UI components
grep -r "useVirtualClock" src/components/ src/app/

# Expected: NO RESULTS (or only in dev-mode-protected components)
```

**If found, add dev-mode check:**
```typescript
// ✅ CORRECT - Protected by dev mode
'use client'
import { useVirtualClock } from '@/hooks/useVirtualClock'

export default function MyComponent() {
  const isDev = process.env.NODE_ENV === 'development'
  const { isEnabled } = useVirtualClock()

  if (!isDev || !isEnabled) return null

  return <div>Time Machine UI</div>
}
```

### ✅ Step 2: Verify Admin Mode Protection

```bash
# Search for admin checks
grep -r "isAdmin" src/

# Verify all Time Machine UI requires:
localStorage.getItem('isAdmin') === 'true'
```

### ✅ Step 3: Check Virtual Clock Usage

```bash
# Find all virtualClock imports
grep -r "from '@/lib/time/virtualClock'" src/

# Review each file - verify it's:
# 1. A legitimate time-based feature (streaks, reviews, etc.)
# 2. NOT accidentally left from testing
# 3. NOT exposing time manipulation to end users
```

### ✅ Step 4: Review Environment Variables

```bash
# Check for time-related dev flags
grep -r "TIME_MACHINE\|VIRTUAL_CLOCK\|DEV_TIME" .env* next.config.*

# Remove or document any found
```

### ✅ Step 5: Test Production Build

```bash
# Build for production
npm run build

# Check bundle for time machine code
# (Should be tree-shaken out if properly protected)
grep -r "virtualClock" .next/static/chunks/

# Acceptable: Only in admin/dev routes
# NOT acceptable: In main bundle
```

### ✅ Step 6: Verify localStorage Keys

```javascript
// In production browser console:
console.log('Admin mode:', localStorage.getItem('isAdmin'))
console.log('Virtual clock:', localStorage.getItem('virtualClock'))

// Both should be null/undefined in production
```

### ✅ Step 7: Check Server-Side Time

```bash
# Ensure server-side code uses REAL time
grep -r "virtualClock" src/app/api/

# Expected: NO RESULTS
# API routes should ALWAYS use Date.now() or server time
```

### ✅ Step 8: Security Audit

**Questions to answer:**

1. ✅ Can users manipulate time on production?
   - **NO** - Admin mode required

2. ✅ Are streak/achievement timestamps verified server-side?
   - **YES** - Server validates with real timestamps

3. ✅ Can time travel affect other users?
   - **NO** - Time offset stored in localStorage (client-only)

4. ✅ Are financial/payment features using real time?
   - **YES** - Payment APIs use server time only

### ✅ Step 9: Documentation Check

- [ ] Time Machine usage documented in this file
- [ ] Team aware of pre-production checklist
- [ ] CI/CD pipeline includes time machine checks
- [ ] Code review guidelines mention time machine verification

### ✅ Step 10: Final Smoke Test

**In Production (After Deploy):**

```javascript
// Open production site console
localStorage.setItem('isAdmin', 'true')
location.reload()

// Verify:
// 1. NO Time Machine button appears
// 2. virtualClock is not available
// 3. Time-based features work normally
```

---

## Common Integration Points

### Current Components Using Virtual Clock

| Component | File | Purpose |
|-----------|------|---------|
| Streak System | `/src/stores/streakStore.ts` | Streak expiration checks |
| Review Engine | `/src/lib/review-engine/srs/algorithm.ts` | SRS interval calculations |
| Achievement System | (Future) | Unlock timestamps |

### How to Find Components

```bash
# List all files using virtualClock
grep -r "virtualClock" src/ --include="*.ts" --include="*.tsx" -l

# Detailed usage by file
grep -r "virtualClock" src/ --include="*.ts" --include="*.tsx" -n
```

---

## Troubleshooting

### Issue: Time Machine Button Not Appearing

**Check:**
```javascript
// 1. Admin mode enabled?
console.log(localStorage.getItem('isAdmin'))
// Should be: 'true'

// 2. Virtual clock enabled?
console.log(localStorage.getItem('virtualClock'))
// Should be: {"offsetMs":0,"isEnabled":true,...}

// 3. Development mode?
console.log(process.env.NODE_ENV)
// Should be: 'development'
```

**Fix:**
```javascript
localStorage.setItem('isAdmin', 'true')
localStorage.setItem('virtualClock', JSON.stringify({
  offsetMs: 0,
  frozenTime: null,
  isEnabled: true,
  history: []
}))
location.reload()
```

### Issue: Time Not Changing

**Check:**
```javascript
// 1. Verify offset is set
const vc = JSON.parse(localStorage.getItem('virtualClock'))
console.log('Offset:', vc.offsetMs)

// 2. Test virtual clock directly
import { virtualClock } from '@/lib/time/virtualClock'
console.log('Real time:', Date.now())
console.log('Virtual time:', virtualClock.now())
console.log('Difference:', virtualClock.now() - Date.now())
```

**Fix:**
```javascript
// Manually set offset (7 days forward)
const vc = JSON.parse(localStorage.getItem('virtualClock'))
vc.offsetMs = 7 * 24 * 60 * 60 * 1000
localStorage.setItem('virtualClock', JSON.stringify(vc))
location.reload()
```

### Issue: Component Not Using Virtual Time

**Symptoms:**
- Time Machine shows offset
- Feature still uses real time

**Diagnosis:**
```bash
# Check if component imports virtualClock
grep -n "virtualClock" src/path/to/component.ts

# Check for Date.now() usage
grep -n "Date.now()\|new Date()" src/path/to/component.ts
```

**Fix:**
Follow [Adding Components to Time Machine](#adding-components-to-time-machine)

### Issue: Time Machine Visible in Production

**🚨 CRITICAL SECURITY ISSUE**

**Immediate Fix:**
```typescript
// Add protection to component
'use client'
import { useVirtualClock } from '@/hooks/useVirtualClock'

export default function TimeMachineButton() {
  // ✅ Add this check
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const { isEnabled } = useVirtualClock()
  if (!isEnabled) return null

  // ... rest of component
}
```

**Long-term Fix:**
- Review pre-production checklist
- Add CI/CD checks for Time Machine references
- Implement build-time removal of dev features

---

## Best Practices

### ✅ DO

1. **Always use virtualClock in time-dependent features**
   - Streaks, reviews, achievements, etc.

2. **Protect Time Machine UI with admin checks**
   ```typescript
   if (localStorage.getItem('isAdmin') !== 'true') return null
   ```

3. **Document all virtualClock usage**
   - Add comments explaining why virtual time is needed

4. **Test time travel scenarios**
   - Forward 1 day, 7 days, 30 days
   - Backward time travel
   - Freeze time

5. **Use descriptive offset comments**
   ```typescript
   // Travel 7 days forward to test streak expiration
   virtualClock.addOffset(7 * 24 * 60 * 60 * 1000)
   ```

### ❌ DON'T

1. **Don't use virtualClock in API routes**
   ```typescript
   // ❌ BAD - Server should always use real time
   export async function POST() {
     const timestamp = virtualClock.now() // NO!
   }
   ```

2. **Don't expose time manipulation to users**
   - Time Machine is dev-only
   - Never add user-facing time controls

3. **Don't commit with Time Machine enabled**
   ```javascript
   // ❌ Don't commit this
   localStorage.setItem('isAdmin', 'true')
   ```

4. **Don't skip pre-production checklist**
   - Even for "small" deployments
   - Time bugs can affect all users

5. **Don't use virtualClock for logging/analytics**
   ```typescript
   // ❌ BAD - Analytics needs real time
   logger.info('Event at:', virtualClock.now()) // NO!

   // ✅ GOOD
   logger.info('Event at:', Date.now())
   ```

---

## Quick Reference

### Enable Time Machine
```javascript
localStorage.setItem('isAdmin', 'true')
localStorage.setItem('virtualClock', JSON.stringify({
  offsetMs: 0, frozenTime: null, isEnabled: true, history: []
}))
location.reload()
```

### Disable Time Machine
```javascript
localStorage.removeItem('isAdmin')
localStorage.removeItem('virtualClock')
location.reload()
```

### Common Time Offsets
```javascript
const offsets = {
  oneHour: 60 * 60 * 1000,
  oneDay: 24 * 60 * 60 * 1000,
  oneWeek: 7 * 24 * 60 * 60 * 1000,
  oneMonth: 30 * 24 * 60 * 60 * 1000,
  oneYear: 365 * 24 * 60 * 60 * 1000,
}
```

### Time Travel (Browser Console)
```javascript
// Forward 7 days
vc = JSON.parse(localStorage.getItem('virtualClock'))
vc.offsetMs = 7 * 24 * 60 * 60 * 1000
localStorage.setItem('virtualClock', JSON.stringify(vc))
location.reload()

// Backward 3 days
vc.offsetMs = -3 * 24 * 60 * 60 * 1000
localStorage.setItem('virtualClock', JSON.stringify(vc))
location.reload()

// Reset
vc.offsetMs = 0
localStorage.setItem('virtualClock', JSON.stringify(vc))
location.reload()
```

---

## Support

**Questions or Issues?**

1. Check this documentation
2. Review existing virtualClock usage in codebase
3. Search for similar time-based features
4. Test with Time Machine enabled

**Found a Bug?**

1. Document the scenario
2. Note the time offset used
3. Check if feature is using virtualClock correctly
4. Add test case to prevent regression

---

**Last Updated:** 2025-10-01
**Version:** 1.0
**Maintainer:** Development Team
