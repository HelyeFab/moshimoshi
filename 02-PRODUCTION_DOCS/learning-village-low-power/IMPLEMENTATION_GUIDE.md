# Learning Village Low Power Mode - Implementation Guide

**Status:** ACTIVE
**Last Updated:** 2026-01-29

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Implementation Patterns](#implementation-patterns)
3. [Code Examples](#code-examples)
4. [Component-by-Component Breakdown](#component-by-component-breakdown)
5. [Testing Guidelines](#testing-guidelines)
6. [Common Pitfalls](#common-pitfalls)

---

## Core Concepts

### 1. Single Source of Truth

The `reduce-motion` class on `<html>` element is the **single source of truth** for animation state:

```tsx
// AnimationControl.tsx:46-52
if (animationsEnabled) {
  document.documentElement.classList.remove('reduce-motion')
  document.documentElement.style.setProperty('--animation-play-state', 'running')
} else {
  document.documentElement.classList.add('reduce-motion')
  document.documentElement.style.setProperty('--animation-play-state', 'paused')
}
```

### 2. Hook-Based Detection

Components use `useAnimationControl()` hook to reactively detect animation state:

```tsx
// AnimationControl.tsx:244-267
export function useAnimationControl() {
  const [animationsEnabled, setAnimationsEnabled] = useState(true)

  useEffect(() => {
    const checkAnimationState = () => {
      const isReduced = document.documentElement.classList.contains('reduce-motion')
      setAnimationsEnabled(!isReduced)
    }

    checkAnimationState()

    const observer = new MutationObserver(checkAnimationState)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  return animationsEnabled
}
```

**Key Points:**
- Uses `MutationObserver` to watch `<html>` class changes
- Re-renders components when animation state changes
- Cleanup on unmount prevents memory leaks

### 3. Prop Drilling vs Context

**Current Implementation:** Prop drilling (passing `lowPower` prop)

**Why not Context?**
- Simpler implementation for single-page feature
- Better performance (no context re-renders)
- Explicit data flow easier to debug

**When to use Context:**
If multiple unrelated components need low power state, consider:

```tsx
// LowPowerContext.tsx (not currently implemented)
const LowPowerContext = createContext<boolean>(false)

export function LowPowerProvider({ children }) {
  const lowPower = !useAnimationControl()
  return <LowPowerContext.Provider value={lowPower}>{children}</LowPowerContext.Provider>
}

export const useLowPower = () => useContext(LowPowerContext)
```

---

## Implementation Patterns

### Pattern 1: Conditional CSS Classes

**Use Case:** Remove GPU-intensive CSS effects

```tsx
// LearningVillage.tsx:240-243
<div
  className={`
    relative overflow-hidden rounded-2xl
    bg-white/5 dark:bg-dark-800/5 ${lowPower ? '' : 'backdrop-blur-md'}
    border border-white/40 dark:border-white/20
    hover:border-primary-400/80 dark:hover:border-primary-500/80
    ${lowPower ? '' : `shadow-xl hover:shadow-2xl ${stall.glow}`}
    transition-all duration-300 cursor-pointer
  `}
>
```

**Pattern:**
```tsx
className={`base-classes ${lowPower ? '' : 'expensive-effects'}`}
```

**Effects to Remove:**
- `backdrop-blur-*` (High GPU cost)
- `shadow-*` (Medium GPU cost)
- `filter drop-shadow-*` (Medium GPU cost)
- Complex `hover:` states (Low GPU cost)

### Pattern 2: Conditional Rendering

**Use Case:** Completely remove animated elements from render tree

```tsx
// LearningVillage.tsx:430-435
{!lowPower && (
  <>
    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary-500/30 via-primary-400/10 to-transparent blur-xl pointer-events-none z-20" />
    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-primary-400/20 to-transparent blur-md pointer-events-none z-20" />
  </>
)}
```

**Pattern:**
```tsx
{!lowPower && <ExpensiveAnimatedComponent />}
// OR
{animationsEnabled && <FloatingElements />}
```

**When to Use:**
- Elements exist solely for visual flair
- No impact on functionality when removed
- High render cost (many elements)

### Pattern 3: Variant Switching

**Use Case:** Switch component to static variant

```tsx
// LearningVillage.tsx:870, 1473
<DoshiMascot size="medium" variant={lowPower ? 'static' : 'animated'} />
```

**Pattern:**
```tsx
<Component variant={lowPower ? 'static' : 'animated'} />
<Component animation={lowPower ? 'none' : 'bounce'} />
<Component quality={lowPower ? 'low' : 'high'} />
```

**When to Use:**
- Component must always render (functional importance)
- Component supports multiple variants
- Visual degradation acceptable

### Pattern 4: MotionConfig Wrapper

**Use Case:** Apply reduced motion to entire component tree

```tsx
// LearningVillage.tsx:415
<MotionConfig reducedMotion={animationsEnabled ? 'never' : 'always'}>
  <div className="relative overflow-hidden rounded-none sm:rounded-2xl">
    {/* All motion.* components inherit this config */}
  </div>
</MotionConfig>
```

**Effect:**
- All `motion.div`, `motion.span`, etc. respect `reducedMotion` prop
- Framer Motion automatically reduces/removes animations
- Works recursively for nested components

**Best Practice:**
Place at highest possible level in component tree for maximum effect.

---

## Code Examples

### Example 1: Converting Existing Component to Support Low Power

**Before:**
```tsx
export function FeatureCard({ title, icon }: Props) {
  return (
    <motion.div
      className="rounded-xl bg-white backdrop-blur-md shadow-xl"
      whileHover={{ scale: 1.05 }}
    >
      <span className="text-4xl filter drop-shadow-lg animate-bounce">
        {icon}
      </span>
      <h3>{title}</h3>
    </motion.div>
  )
}
```

**After:**
```tsx
export function FeatureCard({ title, icon, lowPower }: Props & { lowPower: boolean }) {
  return (
    <motion.div
      className={`rounded-xl bg-white ${lowPower ? '' : 'backdrop-blur-md shadow-xl'}`}
      whileHover={lowPower ? {} : { scale: 1.05 }}
    >
      <span className={`text-4xl ${lowPower ? '' : 'filter drop-shadow-lg animate-bounce'}`}>
        {icon}
      </span>
      <h3>{title}</h3>
    </motion.div>
  )
}
```

**Changes:**
1. Added `lowPower` prop to component interface
2. Conditional classes for `backdrop-blur-md shadow-xl`
3. Conditional classes for `filter drop-shadow-lg animate-bounce`
4. Conditional `whileHover` animation (empty object disables)

### Example 2: Conditional Animation Elements

**Before:**
```tsx
export function FloatingBanner() {
  return (
    <div className="relative">
      <h1>Welcome</h1>
      {[...Array(10)].map((_, i) => (
        <FloatingParticle key={i} delay={i * 0.5} />
      ))}
    </div>
  )
}
```

**After:**
```tsx
export function FloatingBanner() {
  const animationsEnabled = useAnimationControl()

  return (
    <div className="relative">
      <h1>Welcome</h1>
      {animationsEnabled && (
        <>
          {[...Array(10)].map((_, i) => (
            <FloatingParticle key={i} delay={i * 0.5} />
          ))}
        </>
      )}
    </div>
  )
}
```

**Changes:**
1. Import and use `useAnimationControl()` hook
2. Wrap particle rendering in `{animationsEnabled && ...}`
3. Particles only render when animations enabled

### Example 3: Gradient Animation Toggle

**Before:**
```tsx
<motion.span
  className="bg-gradient-to-r from-primary-400 via-pink-500 to-primary-600 bg-clip-text text-transparent"
  animate={{ backgroundPosition: ['0%', '100%', '0%'] }}
  transition={{ duration: 5, repeat: Infinity }}
  style={{ backgroundSize: '300%' }}
>
  学習村
</motion.span>
```

**After:**
```tsx
{animationsEnabled ? (
  <motion.span
    className="bg-gradient-to-r from-primary-400 via-pink-500 to-primary-600 bg-clip-text text-transparent"
    animate={{ backgroundPosition: ['0%', '100%', '0%'] }}
    transition={{ duration: 5, repeat: Infinity }}
    style={{ backgroundSize: '300%' }}
  >
    学習村
  </motion.span>
) : (
  <span className="bg-gradient-to-r from-primary-400 via-pink-500 to-primary-600 bg-clip-text text-transparent">
    学習村
  </span>
)}
```

**Changes:**
1. Ternary operator: animated vs static
2. Static version has same gradient but no `motion.span`
3. No `animate` or `transition` props in static version

---

## Component-by-Component Breakdown

### LearningVillage.tsx

**Lines 506:** Low power flag derivation
```tsx
const animationsEnabled = useAnimationControl()
const lowPower = !animationsEnabled
```

**Lines 415-754:** Main container with MotionConfig
```tsx
<MotionConfig reducedMotion={animationsEnabled ? 'never' : 'always'}>
  <div className="relative overflow-hidden rounded-none sm:rounded-2xl">
    {/* All content */}
  </div>
</MotionConfig>
```

**Lines 421-427:** Low Power Mode badge
```tsx
{!animationsEnabled && (
  <div className="absolute top-4 left-[88px] z-50">
    <div className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-black/60 text-white border border-white/20">
      Low Power Mode
    </div>
  </div>
)}
```

**Lines 430-435:** Bottom glow effects (conditional)
```tsx
{!lowPower && (
  <>
    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary-500/30 via-primary-400/10 to-transparent blur-xl pointer-events-none z-20" />
    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-primary-400/20 to-transparent blur-md pointer-events-none z-20" />
  </>
)}
```

**Lines 438-503:** Floating lanterns (conditional block)
```tsx
{animationsEnabled && (
  <div className="absolute inset-0 pointer-events-none z-10">
    {/* 8 distributed lanterns */}
    {[...Array(8)].map((_, i) => (
      <motion.div key={`distributed-lantern-${i}`} {...animationProps}>
        🏮
      </motion.div>
    ))}

    {/* 3 bottom glow lanterns */}
    {[...Array(3)].map((_, i) => (
      <motion.div key={`bottom-glow-lantern-${i}`} {...animationProps}>
        🏮
      </motion.div>
    ))}
  </div>
)}
```

**Lines 515-524:** Night stars (conditional)
```tsx
{timeOfDay === 'night' && animationsEnabled && (
  <div className="absolute inset-0">
    {[...Array(50)].map((_, i) => (
      <motion.div key={i} {...starProps}>
        {/* Star */}
      </motion.div>
    ))}
  </div>
)}
```

**Lines 546-563:** Chinese lantern emojis (conditional)
```tsx
{animationsEnabled && (
  <div className="absolute inset-0 h-full overflow-hidden pointer-events-none">
    {filteredStalls.slice(0, 5).map((stall, i) => (
      <FloatingLantern key={`lantern-${i}`} delay={i * 4} color={stall.lanternColor} />
    ))}
    <ChineseLantern delay={0} size="small" />
    {/* ...more lanterns */}
  </div>
)}
```

**Lines 586-601:** Twinkling lights (conditional)
```tsx
{animationsEnabled && (
  <>
    <TwinklingLight delay={0} x="10%" y="20%" color="#fbbf24" />
    <TwinklingLight delay={0.3} x="15%" y="60%" color="#f59e0b" />
    {/* ...12 total */}
  </>
)}
```

**Lines 639-660:** Gradient text animation (conditional)
```tsx
{animationsEnabled ? (
  <motion.span
    className="bg-gradient-to-r from-primary-400 via-pink-500 to-primary-600 bg-clip-text text-transparent animate-gradient"
    animate={{ backgroundPosition: ['0%', '100%', '0%'] }}
    transition={{ duration: 5, repeat: Infinity }}
  >
    学習村
  </motion.span>
) : (
  <span className="bg-gradient-to-r from-primary-400 via-pink-500 to-primary-600 bg-clip-text text-transparent">
    学習村
  </span>
)}
```

### StallCard Component

**Lines 209, 215:** Props interface
```tsx
function StallCard({
  stall,
  index,
  isPopular,
  isOnline,
  lowPower,  // ← New prop
}: {
  stall: any
  index: number
  isPopular: boolean
  isOnline: boolean
  lowPower: boolean  // ← Type definition
})
```

**Lines 240-250:** Card styling with conditional effects
```tsx
<div
  className={`
    relative overflow-hidden rounded-2xl
    bg-white/5 dark:bg-dark-800/5 ${lowPower ? '' : 'backdrop-blur-md'}
    border border-white/40 dark:border-white/20
    hover:border-primary-400/80 dark:hover:border-primary-500/80
    ${lowPower ? '' : `shadow-xl hover:shadow-2xl ${stall.glow}`}
    transition-all duration-300 cursor-pointer
    group flex flex-col
    ${heightClass}
    before:absolute before:inset-0
    before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent
    before:pointer-events-none
    ${lowPower ? '' : 'after:absolute after:inset-0 after:shadow-inner after:rounded-2xl after:pointer-events-none'}
  `}
>
```

**Lines 263-271:** Lantern glow effect (conditional)
```tsx
{!lowPower && (
  <div
    className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-0 group-hover:opacity-50 transition-opacity duration-500"
    style={{
      background: `radial-gradient(circle, ${stall.lanternColor}40 0%, transparent 70%)`,
      filter: `blur(20px)`,
    }}
  />
)}
```

**Lines 299:** Icon with conditional effects
```tsx
<span
  className={`${lowPower ? '' : 'filter drop-shadow-lg group-hover:animate-bounce'} flex-shrink-0 ${isFeatured ? 'text-xl sm:text-4xl' : 'text-lg sm:text-3xl'}`}
>
  {stall.icon}
</span>
```

### MobileStallCard Component

**Lines 382, 387:** Props interface (similar to StallCard)

**Lines 401-403:** Card styling
```tsx
<motion.div
  whileTap={{ scale: 0.98 }}
  className={`relative flex items-center p-3 sm:p-4 rounded-xl bg-white/10 dark:bg-dark-800/10 ${lowPower ? '' : 'backdrop-blur-md'}
             border border-white/40 dark:border-white/20 hover:border-primary-400/80 dark:hover:border-primary-500/80
             shadow-none ${lowPower ? '' : `group-hover:${stall.glow}`} transition-all duration-300 cursor-pointer h-20 sm:h-24 overflow-hidden
             group-hover:scale-[1.01] gap-x-2`}
>
```

**Lines 444:** Icon effects
```tsx
<span className={`text-2xl sm:text-3xl ${lowPower ? '' : 'filter drop-shadow-lg group-hover:scale-110 group-hover:rotate-6'} transition-transform duration-200`}>
  {stall.icon}
</span>
```

### PerfDebugPanel Component

**Lines 35-199:** Full implementation

Key features:
- FPS tracking via `requestAnimationFrame`
- Long task detection via `PerformanceObserver`
- Event loop lag measurement
- Memory usage via `performance.memory`
- Animation state detection via `reduce-motion` class check

**Enable via URL:**
```
?debugPerf=1
```

**Enable via localStorage:**
```javascript
localStorage.setItem('debugPerfPanel', '1')
```

---

## Testing Guidelines

### Manual Testing Checklist

#### Visual Verification

- [ ] Click animation toggle button (top-left)
- [ ] "Low Power Mode" badge appears when animations disabled
- [ ] Floating lanterns disappear
- [ ] Twinkling lights disappear
- [ ] Doshi mascot becomes static
- [ ] Card backdrop blur removed
- [ ] Card shadows removed
- [ ] Gradient text stops animating
- [ ] Night stars disappear (if night time)

#### Performance Verification

1. Enable PerfDebugPanel: `?debugPerf=1`
2. Record baseline metrics with animations ON:
   - FPS: ~60
   - Long tasks: (baseline)
   - JS heap: (baseline)
3. Toggle animations OFF
4. Observe improvements:
   - FPS: Should remain stable 60
   - Long tasks: Should decrease
   - JS heap: Minimal change (DOM elements removed)
5. Check "Animations paused: yes"

#### Browser Testing

Test in:
- Chrome (Windows, Mac, Linux)
- Firefox (Windows, Mac, Linux)
- Safari (Mac, iOS)
- Mobile Chrome (Android)
- Mobile Safari (iOS)

### Automated Testing

#### Unit Tests

```tsx
// AnimationControl.test.tsx
describe('useAnimationControl', () => {
  it('should return true when reduce-motion class is not present', () => {
    document.documentElement.classList.remove('reduce-motion')
    const { result } = renderHook(() => useAnimationControl())
    expect(result.current).toBe(true)
  })

  it('should return false when reduce-motion class is present', () => {
    document.documentElement.classList.add('reduce-motion')
    const { result } = renderHook(() => useAnimationControl())
    expect(result.current).toBe(false)
  })

  it('should update when reduce-motion class changes', async () => {
    const { result } = renderHook(() => useAnimationControl())

    act(() => {
      document.documentElement.classList.add('reduce-motion')
    })

    await waitFor(() => {
      expect(result.current).toBe(false)
    })
  })
})
```

#### Integration Tests

```tsx
// LearningVillage.test.tsx
describe('LearningVillage Low Power Mode', () => {
  it('should render floating lanterns when animations enabled', () => {
    document.documentElement.classList.remove('reduce-motion')
    render(<LearningVillage />)

    // Should find lantern elements
    expect(screen.getAllByText('🏮')).toHaveLength(11) // 8 + 3
  })

  it('should not render floating lanterns when animations disabled', () => {
    document.documentElement.classList.add('reduce-motion')
    render(<LearningVillage />)

    // Should not find lantern elements
    expect(screen.queryAllByText('🏮')).toHaveLength(0)
  })

  it('should pass lowPower prop to StallCard', () => {
    document.documentElement.classList.add('reduce-motion')
    render(<LearningVillage />)

    const stallCard = screen.getByTestId('stall-card-kanji')
    expect(stallCard).not.toHaveClass('backdrop-blur-md')
  })
})
```

#### Visual Regression Tests

Use Playwright or Cypress for screenshot comparisons:

```typescript
// learning-village.spec.ts
test('Learning Village low power mode visual comparison', async ({ page }) => {
  await page.goto('/dashboard')

  // Baseline: Animations ON
  await expect(page).toHaveScreenshot('village-animations-on.png')

  // Toggle animations off
  await page.click('[aria-label="Pause animations"]')

  // Verify low power mode
  await expect(page.locator('text=Low Power Mode')).toBeVisible()
  await expect(page).toHaveScreenshot('village-low-power.png')

  // Toggle back on
  await page.click('[aria-label="Play animations"]')
  await expect(page.locator('text=Low Power Mode')).not.toBeVisible()
})
```

---

## Common Pitfalls

### Pitfall 1: Forgetting to Pass `lowPower` Prop

**Problem:**
```tsx
// Parent
const lowPower = !useAnimationControl()
return <StallCard stall={stall} /> // ❌ Missing lowPower prop
```

**Solution:**
```tsx
// Parent
const lowPower = !useAnimationControl()
return <StallCard stall={stall} lowPower={lowPower} /> // ✅
```

### Pitfall 2: Using `animationsEnabled` Instead of `lowPower`

**Problem:**
```tsx
const animationsEnabled = useAnimationControl()
<div className={`${animationsEnabled ? '' : 'backdrop-blur-md'}`} /> // ❌ Inverted logic
```

**Solution:**
```tsx
const lowPower = !useAnimationControl()
<div className={`${lowPower ? '' : 'backdrop-blur-md'}`} /> // ✅
```

### Pitfall 3: Not Removing Elements from DOM

**Problem:**
```tsx
<motion.div
  className={lowPower ? 'opacity-0' : ''}
  animate={lowPower ? {} : { y: [0, -100] }}
>
  🏮
</motion.div>
// ❌ Still in DOM, still using GPU for layout/paint
```

**Solution:**
```tsx
{!lowPower && (
  <motion.div animate={{ y: [0, -100] }}>
    🏮
  </motion.div>
)}
// ✅ Not in DOM at all when in low power mode
```

### Pitfall 4: Inconsistent Conditional Logic

**Problem:**
```tsx
// Some places use lowPower
{!lowPower && <Lantern />}

// Other places use animationsEnabled
{animationsEnabled && <Stars />}

// Confusing and error-prone
```

**Solution:**
Pick one convention and stick to it:
```tsx
// Use lowPower for CSS effects (removes classes)
<div className={`${lowPower ? '' : 'blur'}`} />

// Use animationsEnabled for elements (positive logic clearer)
{animationsEnabled && <AnimatedElement />}
```

### Pitfall 5: Forgetting MotionConfig

**Problem:**
```tsx
// No MotionConfig wrapper
<div>
  <motion.div animate={{ scale: 1.1 }} />
  <motion.div animate={{ rotate: 360 }} />
  {/* All motion components still animate */}
</div>
```

**Solution:**
```tsx
<MotionConfig reducedMotion={animationsEnabled ? 'never' : 'always'}>
  <div>
    <motion.div animate={{ scale: 1.1 }} />
    <motion.div animate={{ rotate: 360 }} />
    {/* Animations automatically reduced/removed */}
  </div>
</MotionConfig>
```

### Pitfall 6: Testing Only in Chrome

**Problem:**
PerformanceObserver long task detection not available in Firefox/Safari.

**Solution:**
```tsx
// PerfDebugPanel.tsx:83-86
const longTaskObserver =
  typeof PerformanceObserver !== 'undefined' && (PerformanceObserver as any).supportedEntryTypes
    ? (PerformanceObserver as any).supportedEntryTypes.includes('longtask')
    : false

// Gracefully degrades when not available
```

---

## Performance Optimization Tips

### 1. Measure First

Always enable PerfDebugPanel before and after changes:
```
?debugPerf=1
```

Track:
- FPS (target: 60)
- Long tasks (target: <5%)
- Event loop lag (target: <10ms)

### 2. Prioritize Effect Removal

**Impact Ranking (High → Low):**
1. `backdrop-blur-*` (Very expensive)
2. `blur-*` on large areas (Expensive)
3. `shadow-*` on many elements (Medium)
4. `filter drop-shadow-*` (Medium)
5. Transform animations (Low-Medium)

### 3. Remove DOM Elements

Hiding with `opacity-0` or `display: none` still costs:
- Layout calculation
- Paint (even if transparent)
- Memory

**Better:**
```tsx
{!lowPower && <ExpensiveComponent />}
```

### 4. Batch Updates

Instead of:
```tsx
{!lowPower && <Lantern1 />}
{!lowPower && <Lantern2 />}
{!lowPower && <Lantern3 />}
```

Use:
```tsx
{!lowPower && (
  <>
    <Lantern1 />
    <Lantern2 />
    <Lantern3 />
  </>
)}
```

Reduces conditional checks and improves readability.

### 5. Use CSS Variables

For global animation control:
```css
/* AnimationControl.tsx:48 */
document.documentElement.style.setProperty('--animation-play-state', 'running')
```

Then in CSS:
```css
.animated-element {
  animation: float 3s infinite;
  animation-play-state: var(--animation-play-state);
}
```

---

## Related Resources

- [Framer Motion - Reduced Motion](https://www.framer.com/motion/guide-accessibility/)
- [MDN - prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [Web Performance - GPU vs CPU](https://web.dev/animations-guide/)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)

---

*Last Updated: 2026-01-29*
