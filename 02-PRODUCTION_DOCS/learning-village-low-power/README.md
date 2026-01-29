# Learning Village Low Power Mode

**Status:** ACTIVE
**Last Updated:** 2026-01-29
**Initial Commit:** f81f7012 (2026-01-28)
**localStorage Persistence:** 5672d0be (2026-01-29)

## Overview

The Learning Village Low Power Mode is a performance optimization feature that reduces GPU load and improves battery life by selectively disabling GPU-intensive visual effects when animations are toggled off. This feature addresses idle GPU usage issues caused by effects like backdrop blur, shadows, floating lanterns, and animated mascots.

### Problem Solved

The Learning Village page featured rich visual effects (floating lanterns, backdrop blur, drop shadows, animated Doshi mascot, twinkling lights, gradient animations) that caused:
- Constant GPU utilization even when idle
- Reduced battery life on mobile devices
- Performance degradation on lower-end devices
- Unnecessary resource consumption when visual richness wasn't needed

### Solution

A **conditional rendering system with persistent user preferences** that:
1. Detects when animations are disabled via `AnimationControl`
2. Automatically switches to "Low Power Mode"
3. Removes/disables GPU-intensive CSS effects and animations
4. Provides visual feedback with a "Low Power Mode" badge
5. **Persists user choice in localStorage** across sessions and navigation
6. Maintains functionality while significantly reducing resource usage

---

## Quick Start

### For Users

1. Navigate to the Learning Village (dashboard)
2. Click the **animation control button** (top-left corner)
3. Low Power Mode activates automatically when animations are paused
4. **Your choice is saved** - navigate away and return, preference persists
5. Toggle again to re-enable rich visual effects

### For Developers

```tsx
// The lowPower flag is derived from animationsEnabled
const animationsEnabled = useAnimationControl()
const lowPower = !animationsEnabled

// Conditionally apply effects
<div className={`${lowPower ? '' : 'backdrop-blur-md shadow-xl'}`}>
  {/* Content */}
</div>

// Conditionally render animations
{!lowPower && (
  <FloatingLantern color="#ef4444" />
)}

// Switch mascot variant
<DoshiMascot variant={lowPower ? 'static' : 'animated'} />
```

---

## Architecture

### System Flow

```
User toggles AnimationControl
         ↓
AnimationControl saves to localStorage ('moshimoshi:animationsEnabled')
         ↓
AnimationControl sets/removes 'reduce-motion' class on <html>
         ↓
useAnimationControl() hook detects class change via MutationObserver
         ↓
LearningVillage derives lowPower = !animationsEnabled
         ↓
Conditional rendering applies throughout component tree
         ↓
GPU-intensive effects disabled, "Low Power Mode" badge shown

On page load/navigation:
         ↓
AnimationControl reads from localStorage
         ↓
Restores previous user preference (or falls back to system preference)
         ↓
Low Power Mode state persists across sessions
```

### Key Components

1. **AnimationControl** (`src/components/ui/AnimationControl.tsx:1-267`)
   - Global animation toggle button
   - Manages `reduce-motion` CSS class on `<html>`
   - **Persists user preference to localStorage**
   - Respects system preference `prefers-reduced-motion`
   - Priority: User preference > System preference

2. **useAnimationControl Hook** (`src/components/ui/AnimationControl.tsx:244-267`)
   - Exported hook for reading animation state
   - Uses `MutationObserver` to watch for `reduce-motion` class changes
   - Returns boolean `animationsEnabled`

3. **LearningVillage Component** (`src/components/dashboard/LearningVillage.tsx:506`)
   - Main consumer of low power mode
   - Derives `lowPower = !animationsEnabled`
   - Passes `lowPower` prop to child components

4. **PerfDebugPanel** (`src/components/debug/PerfDebugPanel.tsx:1-199`)
   - Performance monitoring tool
   - Tracks FPS, long tasks, event loop lag, memory usage
   - Displays animation state

---

## localStorage Persistence

### Storage Key
```typescript
const ANIMATIONS_STORAGE_KEY = 'moshimoshi:animationsEnabled'
```

### Priority System

**Load Priority (on mount):**
1. **User preference** from localStorage (`'true'` or `'false'`)
2. **System preference** (`prefers-reduced-motion` media query)
3. **Default** (animations enabled)

### Behavior

**First Visit:**
- No localStorage value
- Respects system `prefers-reduced-motion`
- Defaults to animations ON if no system preference

**User Toggles:**
- Immediately saves to localStorage
- Overrides system preference
- Persists across all page navigation

**Returning User:**
- Reads from localStorage
- Restores exact previous state
- System preference ignored (user choice takes precedence)

**System Preference Changes:**
- Only applies if user has NOT set explicit preference
- Does not override user's saved choice

### Testing

```javascript
// Check current preference
localStorage.getItem('moshimoshi:animationsEnabled')
// Returns: "true" | "false" | null

// Manually set to low power mode
localStorage.setItem('moshimoshi:animationsEnabled', 'false')
// Reload page → Animations OFF

// Clear preference (reset to system default)
localStorage.removeItem('moshimoshi:animationsEnabled')
// Reload page → Uses system preference
```

---

## GPU-Intensive Effects Disabled

### CSS Effects (Conditional Classes)

| Effect | Normal Mode | Low Power Mode | Impact |
|--------|-------------|----------------|--------|
| Backdrop blur | `backdrop-blur-md` | _(removed)_ | High GPU |
| Drop shadows | `shadow-xl shadow-2xl` | _(removed)_ | Medium GPU |
| Filter effects | `filter drop-shadow-lg` | _(removed)_ | Medium GPU |
| Glow effects | `after:shadow-inner` | _(removed)_ | Low GPU |
| Transform animations | `group-hover:animate-bounce` | _(removed)_ | Low GPU |

**Code References:**
- `src/components/dashboard/LearningVillage.tsx:240` - StallCard backdrop blur
- `src/components/dashboard/LearningVillage.tsx:243` - Shadow effects
- `src/components/dashboard/LearningVillage.tsx:299` - Drop shadow & bounce
- `src/components/dashboard/LearningVillage.tsx:401` - Mobile card effects

### Animated Elements (Conditional Rendering)

| Element | Location | Rendering Logic |
|---------|----------|-----------------|
| Floating lanterns (8 distributed) | Line 438 | `{animationsEnabled && <div>...</div>}` |
| Bottom glow lanterns (3) | Line 438 | Same block as distributed lanterns |
| Bottom glow effects (2 layers) | Line 430 | `{!lowPower && <><div>...</div></>}` |
| Twinkling lights (12) | Line 586 | `{animationsEnabled && <>...</>}` |
| Stars (50, night only) | Line 515 | `{timeOfDay === 'night' && animationsEnabled && ...}` |
| Gradient text animation | Line 639 | Conditional `motion.span` vs static `span` |
| Doshi mascot animation | Lines 870, 1473 | `variant={lowPower ? 'static' : 'animated'}` |

### Framer Motion Configuration

```tsx
<MotionConfig reducedMotion={animationsEnabled ? 'never' : 'always'}>
  {/* Entire Learning Village wrapped */}
</MotionConfig>
```

**Location:** `src/components/dashboard/LearningVillage.tsx:415`

This sets Framer Motion's reduced motion mode, affecting all `motion.*` components within the tree.

---

## Performance Metrics

### Monitoring with PerfDebugPanel

Enable performance debugging to measure impact:

```
?debugPerf=1
```

**Key Metrics Tracked:**
- **FPS:** Target 60fps (should improve in low power mode)
- **Long tasks:** <50ms threshold, % of total time
- **Event loop lag:** Measures main thread blocking
- **JS heap:** Memory usage in MB
- **Animations paused:** Confirms low power state

**Implementation:** `src/components/debug/PerfDebugPanel.tsx:35-199`

---

## Documentation

- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - Complete implementation details and code patterns
- [PERFORMANCE_TESTING.md](./PERFORMANCE_TESTING.md) - Testing methodology and benchmarks _(to be created)_

---

## Key Files

| File | Lines | Description |
|------|-------|-------------|
| `src/components/ui/AnimationControl.tsx` | 1-267 | Global animation toggle and `useAnimationControl` hook |
| `src/components/dashboard/LearningVillage.tsx` | 506 | `lowPower` flag derivation |
| `src/components/dashboard/LearningVillage.tsx` | 209-373 | StallCard with `lowPower` prop |
| `src/components/dashboard/LearningVillage.tsx` | 382-497 | MobileStallCard with `lowPower` prop |
| `src/components/dashboard/LearningVillage.tsx` | 415 | MotionConfig wrapper |
| `src/components/dashboard/LearningVillage.tsx` | 430-503 | Conditional lantern rendering |
| `src/components/debug/PerfDebugPanel.tsx` | 35-199 | Performance monitoring panel |
| `src/app/[locale]/layout.tsx` | 82 | PerfDebugPanel integration |

---

## Related Features

- **AnimationControl:** Global animation management system
- **ThemeProvider:** Dark mode and theme switching
- **LearningVillageTracker:** Analytics for village interactions
- **Framer Motion:** Animation library used throughout

---

## Implemented Features

- [x] **User preference persistence (localStorage)** - Completed 2026-01-29 (Commit: 5672d0be)
  - Priority system: User preference > System preference
  - Persists across sessions and navigation
  - Graceful fallback for privacy mode/SSR

## Future Enhancements

- [ ] Auto-enable low power mode on battery saver detection
- [ ] Granular control (disable only specific effects)
- [ ] Performance benchmarks and A/B testing
- [ ] Low power mode indicator in other components
- [ ] User settings panel to customize low power behavior

---

## Troubleshooting

### Low Power Mode Not Activating

**Check:**
1. AnimationControl button is visible (top-left corner)
2. Click the button to toggle animations off
3. Verify "Low Power Mode" badge appears next to button
4. Inspect `<html>` element for `reduce-motion` class

**Debug:**
```javascript
// In browser console
console.log(document.documentElement.classList.contains('reduce-motion'))
// Should return true when in low power mode
```

### Effects Still Visible in Low Power Mode

**Cause:** Component not receiving `lowPower` prop or not checking `animationsEnabled`

**Fix:**
1. Ensure component imports `useAnimationControl`
2. Derive `lowPower = !useAnimationControl()`
3. Apply conditional rendering/classes

### Performance Debug Panel Not Showing

**Enable:**
```
# Add query parameter
yoursite.com?debugPerf=1

# Or in localStorage
localStorage.setItem('debugPerfPanel', '1')
```

**Disable:**
```
# Query parameter
?debugPerf=0

# Or click "Hide" button on panel
```

---

## Security Considerations

- No user data involved
- Purely client-side rendering optimization
- No API calls or backend changes
- Performance metrics stay in browser (not sent to server)

---

## Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 88+ | ✅ Full support |
| Firefox | 89+ | ✅ Full support |
| Safari | 14+ | ✅ Full support |
| Edge | 88+ | ✅ Full support |
| Mobile Safari | 14+ | ✅ Full support |
| Chrome Android | 88+ | ✅ Full support |

**Note:** Uses `PerformanceObserver` for long task detection (Chrome 58+, not available in Firefox/Safari but gracefully degrades).

---

*Last Updated: 2026-01-29*
