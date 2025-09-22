# Production Rollback Guide

## Overview

This document outlines all changes made to implement the Time Machine testing tool and provides clear instructions for reverting these changes if needed for production deployment.

## Changes Made

### 1. New Files Created

These files can be safely deleted for production as they are development-only tools:

```bash
# Core Time Machine files
/src/lib/time/virtualClock.ts
/src/lib/time/dateProvider.ts
/src/hooks/useVirtualClock.ts
/src/components/dev/TimeMachineButton.tsx
/scripts/enable-time-machine.js

# Documentation
/docs/time-machine/TIME_MACHINE_GUIDE.md
/docs/time-machine/PRODUCTION_ROLLBACK.md
```

### 2. Modified Files

#### `/src/lib/review-engine/srs/algorithm.ts`

**Changes:**
- Added import: `import { nowDate, daysFromNow } from '@/lib/time/dateProvider'`
- Replaced `new Date()` with `nowDate()`
- Replaced date calculation with `daysFromNow()`

**Rollback:**
```typescript
// Remove import
- import { nowDate, daysFromNow } from '@/lib/time/dateProvider'

// Revert line 168
- newSRS.lastReviewedAt = nowDate()
+ newSRS.lastReviewedAt = new Date()

// Revert line 183
- nextReviewAt: nowDate(),
+ nextReviewAt: new Date(),

// Revert line 392-395
- private calculateNextReviewDate(interval: number): Date {
-   return daysFromNow(interval)
- }
+ private calculateNextReviewDate(interval: number): Date {
+   const date = new Date()
+   date.setDate(date.getDate() + interval)
+   return date
+ }
```

#### `/src/stores/achievement-store.ts`

**Changes:**
- Added import: `import { now, nowDate, startOfToday } from '@/lib/time/dateProvider'`
- Replaced all `Date.now()` with `now()`
- Replaced all `new Date()` with `nowDate()`
- Replaced date calculations with `startOfToday()`

**Rollback:**
```typescript
// Remove import
- import { now, nowDate, startOfToday } from '@/lib/time/dateProvider'

// Revert all now() back to Date.now()
- lastUpdated: now(),
+ lastUpdated: Date.now(),

// Revert all nowDate() back to new Date()
- lastStreakUpdate: nowDate()
+ lastStreakUpdate: new Date()

// Revert startOfToday() back to manual calculation
- const todayDate = startOfToday()
+ const todayDate = new Date()
+ todayDate.setHours(0, 0, 0, 0)
```

#### `/src/app/layout.tsx`

**Changes:**
- Added dynamic import for TimeMachineButton
- Added conditional rendering in development mode

**Rollback:**
```typescript
// Remove imports
- import dynamic from 'next/dynamic'
- const TimeMachineButton = dynamic(
-   () => import('@/components/dev/TimeMachineButton'),
-   { ssr: false }
- )

// Remove from JSX
- {process.env.NODE_ENV === 'development' && <TimeMachineButton />}
```

## Automated Rollback Script

Create and run this script to automatically revert all changes:

```bash
#!/bin/bash
# rollback-time-machine.sh

echo "🔄 Rolling back Time Machine changes..."

# 1. Delete Time Machine files
echo "Removing Time Machine files..."
rm -rf src/lib/time/
rm -f src/hooks/useVirtualClock.ts
rm -rf src/components/dev/
rm -f scripts/enable-time-machine.js
rm -rf docs/time-machine/

# 2. Revert SRS algorithm
echo "Reverting SRS algorithm..."
sed -i '' '/import.*dateProvider/d' src/lib/review-engine/srs/algorithm.ts
sed -i '' 's/nowDate()/new Date()/g' src/lib/review-engine/srs/algorithm.ts
sed -i '' 's/daysFromNow(interval)/new Date(new Date().setDate(new Date().getDate() + interval))/g' src/lib/review-engine/srs/algorithm.ts

# 3. Revert Achievement Store
echo "Reverting Achievement Store..."
sed -i '' '/import.*dateProvider/d' src/stores/achievement-store.ts
sed -i '' 's/now()/Date.now()/g' src/stores/achievement-store.ts
sed -i '' 's/nowDate()/new Date()/g' src/stores/achievement-store.ts
sed -i '' 's/startOfToday()/(() => { const d = new Date(); d.setHours(0,0,0,0); return d; })()/g' src/stores/achievement-store.ts

# 4. Revert Layout
echo "Reverting Layout..."
sed -i '' '/import dynamic/d' src/app/layout.tsx
sed -i '' '/TimeMachineButton/d' src/app/layout.tsx

echo "✅ Rollback complete!"
```

## Manual Verification Checklist

After rollback, verify:

- [ ] No imports from `@/lib/time/dateProvider` remain
- [ ] No references to `virtualClock` in the codebase
- [ ] All `new Date()` calls work normally
- [ ] All `Date.now()` calls work normally
- [ ] No TimeMachineButton component in layout
- [ ] Review Engine schedules items correctly
- [ ] Achievement streaks calculate correctly
- [ ] No console errors in development or production

## Alternative: Production-Safe Implementation

If you want to keep the Time Machine infrastructure but ensure it's completely disabled in production:

### Option 1: Environment Variable Guard

Add to all Time Machine files:
```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error('Time Machine cannot be used in production')
}
```

### Option 2: Build-Time Exclusion

In `next.config.js`:
```javascript
module.exports = {
  webpack: (config, { isServer, dev }) => {
    if (!dev) {
      config.resolve.alias['@/lib/time/dateProvider'] = '@/lib/time/dateProvider.prod'
    }
    return config
  }
}
```

Create `/src/lib/time/dateProvider.prod.ts`:
```typescript
export const now = () => Date.now()
export const nowDate = () => new Date()
export const daysFromNow = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}
// ... other functions using real Date
```

### Option 3: Conditional Exports

Use package.json exports field:
```json
{
  "exports": {
    "./time/*": {
      "development": "./src/lib/time/*.ts",
      "default": null
    }
  }
}
```

## Testing After Rollback

Run these tests to ensure everything works correctly after rollback:

```bash
# 1. Build production
npm run build

# 2. Run production locally
npm run start

# 3. Test Review Engine
# - Create review items
# - Check scheduling works
# - Verify due dates are correct

# 4. Test Achievements
# - Complete activities
# - Check streak counting
# - Verify achievement unlocking

# 5. Check for console errors
# - Open browser console
# - Navigate through app
# - Ensure no errors
```

## Git Commands for Rollback

If you committed the Time Machine changes and want to revert:

```bash
# Find the commit before Time Machine was added
git log --oneline

# Revert to that commit (replace COMMIT_HASH)
git revert COMMIT_HASH

# Or create a new branch without Time Machine
git checkout -b production-ready COMMIT_HASH
```

## Summary

The Time Machine implementation is designed to be:

1. **Isolated** - All core functionality in separate files
2. **Non-invasive** - Minimal changes to existing code
3. **Reversible** - Easy to remove completely
4. **Production-safe** - Only active in development mode

For production deployment, you can either:
- Keep it (it won't activate in production)
- Remove it completely (use this guide)
- Make it even more production-safe (use alternatives above)

---

Last Updated: 2025-01-16
Version: 1.0.0