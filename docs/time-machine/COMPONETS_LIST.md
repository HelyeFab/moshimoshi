# Time Machine Components List

## Overview
The Time Machine is a development tool that allows virtual time travel for testing time-sensitive features. When enabled, it overrides the system time with a virtual time that can be manipulated for testing purposes.

## Core Components

### 1. Virtual Clock (`/src/lib/time/virtualClock.ts`)
- Main time management system
- Provides `now()` and `nowDate()` methods
- Handles time offset calculations
- Persists state in localStorage
- Manages freeze/unfreeze functionality

### 2. Time Machine Button (`/src/components/dev/TimeMachineButton.tsx`)
- UI component for the Time Machine interface
- Shows virtual time status
- Provides controls for time travel
- Only visible in development mode

### 3. useVirtualClock Hook (`/src/hooks/useVirtualClock.ts`)
- React hook for accessing virtual clock state
- Provides actions for time manipulation
- Auto-updates components when time changes

## Integrated Systems

###  Streak System (`/src/stores/streakStore.ts`)
**Status**: Fully Integrated
- Uses `virtualClock.now()` for recording activities
- Uses `virtualClock.nowDate()` for date calculations
- Properly calculates streaks based on virtual time
- Allows testing streak progression/breaking without waiting for real time

#### Integration Points:
- `recordActivity()` - Uses virtual time for timestamps
- `checkAndUpdateStreak()` - Uses virtual date for streak validation
- `isStreakActive()` - Checks streak status against virtual date
- `getDaysSinceLastActivity()` - Calculates days using virtual date

### = Review Engine
**Status**: Mentioned as affected in UI warning
- Should use virtual time for SRS calculations
- Needs verification of integration status

### <Æ Achievement System
**Status**: Mentioned as affected in UI warning
- Should use virtual time for achievement unlocks
- Needs verification of integration status

## How to Add Time Machine Support to a Component

To integrate a component with the Time Machine:

1. **Import the virtual clock:**
```typescript
import { virtualClock } from '@/lib/time/virtualClock'
```

2. **Replace time calls:**
```typescript
// Before:
const now = Date.now()
const today = new Date()

// After:
const now = virtualClock.now()
const today = virtualClock.nowDate()
```

3. **Use in date calculations:**
```typescript
// Before:
const daysDiff = differenceInDays(new Date(), someDate)

// After:
const daysDiff = differenceInDays(virtualClock.nowDate(), someDate)
```

## Testing with Time Machine

1. **Enable Time Machine**: Click the "Disabled" button to enable
2. **Travel in Time**: Use Quick Actions buttons (+1 Day, -1 Week, etc.)
3. **Freeze Time**: Stop time progression for consistent testing
4. **Jump to Date**: Go directly to a specific date
5. **Reset**: Return to real time

## Important Notes

  **Development Only**: Time Machine only works in development mode
  **localStorage Persistence**: Changes persist until reset
  **Component Updates**: Components using virtual clock will automatically update when time changes

## Verification Checklist

When adding Time Machine support, verify:
- [ ] Component imports virtualClock
- [ ] All Date.now() calls replaced with virtualClock.now()
- [ ] All new Date() calls replaced with virtualClock.nowDate()
- [ ] Date calculations use virtual time
- [ ] Component updates when virtual time changes
- [ ] Feature works correctly with time travel
- [ ] Feature works correctly when Time Machine is disabled

---
Last Updated: 2025-01-19