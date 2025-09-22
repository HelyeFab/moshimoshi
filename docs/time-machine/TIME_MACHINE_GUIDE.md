# Time Machine Testing Tool

## Overview

The Time Machine is a development-only tool that allows deterministic testing of time-dependent features in the Moshimoshi application. It provides a virtual clock that can be manipulated to simulate the passage of time, enabling comprehensive testing of:

- FSRS (Spaced Repetition System) scheduling
- Achievement unlocking and milestones
- Streak calculations
- Time-based review queues
- Any other time-dependent functionality

## Architecture

### Core Components

1. **Virtual Clock (`/src/lib/time/virtualClock.ts`)**
   - Singleton instance managing virtual time state
   - Provides offset-based time manipulation
   - Supports freezing time at specific points
   - Maintains history of time travel operations
   - Persists state to localStorage in development mode

2. **Date Provider (`/src/lib/time/dateProvider.ts`)**
   - Centralized API for getting current time
   - Automatically uses virtual clock when enabled
   - Provides utility functions for date calculations
   - Used by Review Engine and Achievement System

3. **React Hook (`/src/hooks/useVirtualClock.ts`)**
   - React integration for virtual clock
   - Real-time updates of virtual time state
   - Provides actions for time manipulation

4. **UI Component (`/src/components/dev/TimeMachineButton.tsx`)**
   - Floating button for admin access
   - Modal interface for time manipulation
   - Visual status indicators
   - History tracking

## Setup

### Enabling Time Machine

1. **In Development Mode:**
   ```bash
   npm run dev
   ```

2. **Enable Admin Mode:**
   Open browser console and run:
   ```javascript
   localStorage.setItem('isAdmin', 'true')
   ```

   Or copy and paste the contents of `/scripts/enable-time-machine.js` into the console.

3. **Access Time Machine:**
   - Look for the purple beaker button in the bottom-right corner
   - Click to open the Time Machine interface

### Disabling Time Machine

To completely disable the Time Machine:

```javascript
localStorage.removeItem('isAdmin')
localStorage.removeItem('virtualClock')
```

Then refresh the page.

## Usage

### Basic Operations

#### Travel Forward/Backward in Time
```javascript
// Using the UI:
// Click "+1 Day", "+1 Week", "+1 Month" buttons

// Programmatically:
import { virtualClock } from '@/lib/time/virtualClock'

virtualClock.travelDays(5)    // Forward 5 days
virtualClock.travelDays(-3)   // Back 3 days
virtualClock.travelHours(12)  // Forward 12 hours
```

#### Jump to Specific Date
```javascript
// Using the UI:
// Select date in "Jump to Specific Date" section

// Programmatically:
virtualClock.jumpTo(new Date('2025-02-01'))
```

#### Freeze/Unfreeze Time
```javascript
// Using the UI:
// Click "Freeze Time" / "Unfreeze Time" button

// Programmatically:
virtualClock.freeze(new Date())  // Freeze at current virtual time
virtualClock.unfreeze()           // Resume time flow
```

#### Reset to Real Time
```javascript
// Using the UI:
// Click "Reset to Real Time" button

// Programmatically:
virtualClock.reset()
```

### Testing Scenarios

#### Testing FSRS Scheduling

1. Complete a review session
2. Fast forward 1 day
3. Check that items appear as due
4. Fast forward 7 days
5. Verify overdue items calculation

```javascript
// Example test flow
virtualClock.reset()
// Complete reviews...
virtualClock.travelDays(1)
// Check due items...
virtualClock.travelDays(6)
// Check overdue items...
```

#### Testing Achievement Streaks

1. Complete daily activity
2. Fast forward 1 day
3. Complete activity again
4. Repeat to build streak
5. Test streak breaking by skipping days

```javascript
// Build 30-day streak
for (let i = 0; i < 30; i++) {
  // Complete daily activity
  virtualClock.travelDays(1)
}
// Check "30 Day Streak" achievement
```

#### Testing Time-Based Milestones

1. Jump to specific dates for testing
2. Freeze time to ensure consistent state
3. Test edge cases around midnight

```javascript
// Test midnight edge case
virtualClock.jumpTo(new Date('2025-01-01 23:59:00'))
// Perform action...
virtualClock.travelMinutes(2)
// Check date transition behavior
```

## Integration Points

### Review Engine

The Review Engine uses the virtual clock for:
- Calculating next review dates
- Determining overdue items
- Managing learning intervals

**Modified Files:**
- `/src/lib/review-engine/srs/algorithm.ts`
  - Lines 168, 183, 392: Uses `nowDate()` and `daysFromNow()`

### Achievement System

The Achievement System uses the virtual clock for:
- Streak calculations
- Activity tracking
- Time-based achievement criteria

**Modified Files:**
- `/src/stores/achievement-store.ts`
  - Multiple lines: Uses `now()`, `nowDate()`, `startOfToday()`

### Other Systems

Any system that needs current time should use:
```javascript
import { now, nowDate } from '@/lib/time/dateProvider'

const timestamp = now()        // Milliseconds
const date = nowDate()         // Date object
```

## API Reference

### VirtualClock Methods

| Method | Description | Example |
|--------|-------------|---------|
| `now()` | Get current virtual timestamp | `virtualClock.now()` |
| `nowDate()` | Get current virtual Date | `virtualClock.nowDate()` |
| `setEnabled(enabled)` | Enable/disable virtual time | `virtualClock.setEnabled(true)` |
| `travelDays(days)` | Travel forward/back by days | `virtualClock.travelDays(7)` |
| `travelHours(hours)` | Travel forward/back by hours | `virtualClock.travelHours(24)` |
| `travelMs(ms)` | Travel forward/back by milliseconds | `virtualClock.travelMs(3600000)` |
| `jumpTo(date)` | Jump to specific date/time | `virtualClock.jumpTo(new Date())` |
| `freeze(date)` | Freeze time at specific point | `virtualClock.freeze(new Date())` |
| `unfreeze()` | Resume time flow | `virtualClock.unfreeze()` |
| `reset()` | Reset to real time | `virtualClock.reset()` |
| `getState()` | Get current state | `virtualClock.getState()` |
| `getInfo()` | Get formatted time info | `virtualClock.getInfo()` |

### Date Provider Utilities

| Function | Description | Example |
|----------|-------------|---------|
| `now()` | Current timestamp | `now()` |
| `nowDate()` | Current Date | `nowDate()` |
| `daysFromNow(days)` | Date in future/past | `daysFromNow(7)` |
| `hoursFromNow(hours)` | Date in future/past | `hoursFromNow(24)` |
| `minutesFromNow(minutes)` | Date in future/past | `minutesFromNow(30)` |
| `isPast(date)` | Check if date is past | `isPast(someDate)` |
| `isFuture(date)` | Check if date is future | `isFuture(someDate)` |
| `daysBetween(date1, date2)` | Days between dates | `daysBetween(d1, d2)` |
| `daysUntil(date)` | Days until date | `daysUntil(futureDate)` |
| `isToday(date)` | Check if date is today | `isToday(someDate)` |
| `startOfToday()` | Today at midnight | `startOfToday()` |
| `endOfToday()` | Today at 23:59:59 | `endOfToday()` |

## Important Considerations

### Development Only

- Time Machine is **only available in development mode**
- Requires admin flag in localStorage
- Not accessible in production builds
- All UI components are dynamically imported with `ssr: false`

### State Persistence

- Virtual clock state persists in localStorage
- Survives page refreshes during development
- Must be manually reset when done testing
- Does not affect other users or production

### Testing Best Practices

1. **Always reset before testing:**
   ```javascript
   virtualClock.reset()
   ```

2. **Use freeze for deterministic tests:**
   ```javascript
   virtualClock.freeze(new Date('2025-01-01'))
   // Run tests with consistent time
   virtualClock.unfreeze()
   ```

3. **Test edge cases:**
   - Midnight transitions
   - Month/year boundaries
   - Leap years
   - Timezone changes

4. **Document test scenarios:**
   - Record time travel steps
   - Note expected outcomes
   - Share reproducible test cases

## Troubleshooting

### Time Machine Not Appearing

1. Check you're in development mode
2. Verify admin flag is set:
   ```javascript
   console.log(localStorage.getItem('isAdmin'))
   ```
3. Refresh the page after enabling

### Time Not Changing

1. Ensure virtual clock is enabled
2. Check the Time Machine UI shows "Enabled"
3. Verify integration in affected components

### Unexpected Behavior

1. Reset to real time
2. Clear localStorage:
   ```javascript
   localStorage.removeItem('virtualClock')
   ```
3. Refresh the page

## Security Notes

- Time Machine is completely disabled in production
- No time manipulation is possible in deployed environments
- Admin flag is client-side only and has no server implications
- Virtual time only affects client-side calculations

## Future Enhancements

Potential improvements for the Time Machine:

1. **Preset Scenarios:**
   - Common test scenarios as one-click presets
   - Automated test sequences

2. **Visual Timeline:**
   - Graphical representation of time travel
   - Visual markers for important events

3. **Export/Import:**
   - Save and share time travel sequences
   - Reproducible test scenarios

4. **Integration Tests:**
   - Automated testing using virtual clock
   - CI/CD integration for time-based tests

---

Last Updated: 2025-01-16
Version: 1.0.0