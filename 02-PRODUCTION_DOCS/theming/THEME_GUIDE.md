# Theme Implementation Guide

**Status:** ACTIVE
**Last Updated:** 2026-01-30

Complete guide for implementing theme-aware pages and components in the Moshimoshi platform.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Component Patterns](#4-component-patterns)
5. [Dark Mode](#5-dark-mode)
6. [Accessibility](#6-accessibility)
7. [Best Practices](#7-best-practices)
8. [Common Mistakes](#8-common-mistakes)
9. [Testing](#9-testing)
10. [Reference](#10-reference)
11. [Using SVG Icons](#11-using-svg-icons)

---

## 1. Getting Started

### 1.1 Basic Setup

Every new page should follow this structure:

```tsx
'use client'

import { useTheme } from '@/lib/theme/ThemeContext'

export default function MyPage() {
  const { theme, resolvedTheme } = useTheme()

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      {/* Page content */}
    </div>
  )
}
```

### 1.2 Import Theme Hook

```tsx
import { useTheme } from '@/lib/theme/ThemeContext'

// In component
const { theme, resolvedTheme, setTheme } = useTheme()

// theme: 'light' | 'dark' | 'system' (user preference)
// resolvedTheme: 'light' | 'dark' (actual applied theme)
```

### 1.3 Understanding Resolved Theme

```tsx
// ❌ WRONG: Don't use 'theme' for UI decisions
if (theme === 'dark') { ... } // Won't work with 'system'

// ✅ CORRECT: Use 'resolvedTheme'
if (resolvedTheme === 'dark') { ... } // Always works
```

---

## 2. Color System

### 2.1 Semantic Tokens (Recommended)

**Use these for maximum compatibility:**

```tsx
// Backgrounds
<div className="bg-background">          // Page background
<div className="bg-card">                // Card background
<div className="bg-muted">               // Subtle backgrounds

// Text
<p className="text-foreground">          // Primary text
<p className="text-muted-foreground">    // Secondary text
<p className="text-card-foreground">     // Card text

// Accents
<button className="bg-primary text-primary-foreground">
<button className="bg-secondary text-secondary-foreground">
<button className="bg-accent text-accent-foreground">

// Borders
<div className="border border-border">   // Standard border
<input className="border-input">         // Input borders
<button className="focus:ring-ring">     // Focus rings
```

**Why use semantic tokens?**
- Auto-adapt to any color palette
- Work in light and dark modes
- Consistent across all components

### 2.2 Palette Colors

**Dynamic colors that change with palette selection:**

```tsx
// Available shades: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950

// Light mode backgrounds
<div className="bg-primary-50">          // Lightest
<div className="bg-primary-100">         // Very light

// Standard usage
<button className="bg-primary-500">      // Main color
<button className="bg-primary-600">      // Hover state

// Dark mode backgrounds
<div className="bg-primary-900/20">      // Dark + opacity
<div className="bg-primary-950">         // Darkest

// Text colors
<h1 className="text-primary-600 dark:text-primary-400">
<p className="text-primary-700 dark:text-primary-300">
```

### 2.3 Neutral Colors

**For text, borders, and subtle backgrounds:**

```tsx
// Gray scale (light mode)
text-gray-900     // Darkest text
text-gray-700     // Body text
text-gray-600     // Secondary text
text-gray-500     // Muted text
text-gray-400     // Placeholder text

// Dark theme scale (use with dark: prefix)
dark:text-dark-50    // Lightest text
dark:text-dark-100   // Very light text
dark:text-dark-300   // Body text
dark:text-dark-400   // Secondary text
dark:text-dark-500   // Muted text

// Backgrounds
bg-gray-50           // Light mode subtle bg
bg-gray-100          // Light mode card bg
dark:bg-dark-850     // Dark mode page bg
dark:bg-dark-800     // Dark mode card bg
dark:bg-dark-900     // Dark mode deeper bg
```

### 2.4 Japanese Aesthetic Colors

**Special immutable colors for Japanese design elements:**

```tsx
// Text
<span className="text-japanese-sakura">      // Cherry blossom pink
<span className="text-japanese-matcha">      // Green tea
<span className="text-japanese-mizu">        // Water blue
<span className="text-japanese-zen">         // Zen gold
<span className="text-japanese-sumi">        // Ink black

// Backgrounds
<div className="bg-japanese-sakura">
<div className="bg-japanese-matchaDark">     // Darker variants

// SVG fills
<svg className="fill-japanese-mizu">
```

**Use cases:**
- Cultural UI elements
- Brand decorations
- Illustration accents
- Logo components

### 2.5 State Colors

```tsx
// Success
<div className="bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100">
<div className="border-green-500 dark:border-green-600">

// Error
<div className="bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100">
<div className="border-red-500 dark:border-red-600">

// Warning
<div className="bg-yellow-50 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-100">

// Info
<div className="bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100">
```

### 2.6 Gradients

**Common gradient patterns:**

```tsx
// Page backgrounds
className="bg-gradient-to-br from-primary-50 via-white to-primary-100
           dark:from-dark-850 dark:via-dark-900 dark:to-dark-850"

// Card headers
className="bg-gradient-to-r from-primary-500 to-primary-700"

// Text gradients
className="bg-gradient-to-r from-gray-900 to-gray-700
           dark:from-gray-100 dark:to-gray-300
           bg-clip-text text-transparent"

// Alternating gradients (for lists)
const isEven = index % 2 === 0
className={isEven
  ? 'bg-gradient-to-br from-primary-500/10 via-primary-600/5 to-transparent'
  : 'bg-gradient-to-bl from-primary-500/10 via-primary-600/5 to-transparent'
}
```

---

## 3. Typography

### 3.1 Font Scales

```tsx
// Heading scales
<h1 className="text-4xl font-bold">       // 2.25rem (40.5px mobile, 45px desktop)
<h2 className="text-3xl font-bold">       // 1.875rem (33.75px mobile, 37.5px desktop)
<h3 className="text-2xl font-semibold">   // 1.5rem (27px mobile, 30px desktop)
<h4 className="text-xl font-semibold">    // 1.25rem (22.5px mobile, 25px desktop)

// Body text
<p className="text-base">                 // 1rem (18px mobile, 20px desktop)
<p className="text-sm">                   // 0.875rem (15.75px mobile, 17.5px desktop)
<p className="text-xs">                   // 0.75rem (13.5px mobile, 15px desktop)

// Large text
<p className="text-lg">                   // 1.125rem (20.25px mobile, 22.5px desktop)
```

### 3.2 Font Weights

```tsx
font-normal       // 400 - Body text
font-medium       // 500 - Emphasis
font-semibold     // 600 - Subheadings
font-bold         // 700 - Headings
```

### 3.3 Line Heights

```tsx
leading-none      // 1 - Tight headings
leading-tight     // 1.25 - Headings
leading-snug      // 1.375 - Subheadings
leading-normal    // 1.5 - Body text
leading-relaxed   // 1.625 - Comfortable reading
leading-loose     // 2 - Japanese text (default)
```

### 3.4 Japanese Text Handling

```tsx
// Use default font family (Noto Sans JP with fallbacks)
<p className="font-sans">日本語テキスト</p>

// For logo text
<h1 className="font-logo-japanese">もしもし</h1>

// Line height for Japanese
<p className="leading-loose">  // 2.0 for vertical breathing room
  日本語の長いテキスト
</p>
```

---

## 4. Component Patterns

### 4.1 Page Container

```tsx
export default function MyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <div className="container mx-auto px-4 py-8">
        {/* Page content */}
      </div>
    </div>
  )
}
```

### 4.2 Card Component

```tsx
<div className="
  bg-white dark:bg-dark-800
  border border-gray-200 dark:border-dark-700
  rounded-lg
  shadow-sm
  p-6
">
  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
    Card Title
  </h3>
  <p className="text-gray-600 dark:text-gray-400">
    Card content
  </p>
</div>
```

### 4.3 Button Component

```tsx
// Primary button
<button className="
  bg-primary-500
  hover:bg-primary-600
  active:bg-primary-700
  dark:bg-primary-600
  dark:hover:bg-primary-700
  text-white
  px-4 py-2
  rounded-lg
  font-medium
  transition-colors duration-200
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Click me
</button>

// Secondary button
<button className="
  bg-gray-100 dark:bg-dark-700
  hover:bg-gray-200 dark:hover:bg-dark-600
  text-gray-900 dark:text-gray-100
  border border-gray-300 dark:border-dark-600
  px-4 py-2
  rounded-lg
  transition-colors
">
  Cancel
</button>
```

### 4.4 Input Component

```tsx
<input
  type="text"
  className="
    w-full
    bg-white dark:bg-dark-900
    border border-gray-300 dark:border-dark-600
    text-gray-900 dark:text-gray-100
    placeholder-gray-500 dark:placeholder-dark-400
    focus:border-primary-500 dark:focus:border-primary-400
    focus:ring-2 focus:ring-primary-500/20
    rounded-lg
    px-4 py-2
    transition-all duration-200
  "
  placeholder="Enter text..."
/>
```

### 4.5 Modal/Dialog

```tsx
<div className="
  fixed inset-0 z-50
  bg-black/50 dark:bg-black/70
  backdrop-blur-sm
  flex items-center justify-center
  p-4
">
  <div className="
    bg-white dark:bg-dark-800
    border border-gray-200 dark:border-dark-700
    rounded-xl
    shadow-2xl
    max-w-md w-full
    p-6
  ">
    {/* Modal content */}
  </div>
</div>
```

### 4.6 Loading Skeleton

```tsx
<div className="animate-pulse space-y-4">
  <div className="h-6 bg-gray-200 dark:bg-dark-700 rounded w-3/4" />
  <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-full" />
  <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-5/6" />
</div>
```

### 4.7 Alert/Toast

```tsx
// Info alert
<div className="
  bg-blue-50 dark:bg-blue-950
  border border-blue-300 dark:border-blue-700
  text-blue-900 dark:text-blue-100
  rounded-lg
  p-4
">
  <p>Information message</p>
</div>

// Success
<div className="
  bg-green-50 dark:bg-green-950
  border border-green-300 dark:border-green-700
  text-green-900 dark:text-green-100
  rounded-lg
  p-4
">
  <p>Success message</p>
</div>
```

### 4.8 Glassmorphism Effect

```tsx
<div className="
  bg-white/70 dark:bg-dark-800/70
  backdrop-blur-md
  border border-gray-200/50 dark:border-dark-700/50
  shadow-xl
  rounded-xl
  p-6
">
  Glass card content
</div>
```

---

## 5. Dark Mode

### 5.1 Basic Dark Mode Pattern

```tsx
// Always pair light and dark variants
<div className="bg-white dark:bg-dark-800">
<p className="text-gray-900 dark:text-gray-100">
<div className="border-gray-200 dark:border-dark-700">
```

### 5.2 Conditional Dark Mode Logic

```tsx
const { resolvedTheme } = useTheme()
const isDark = resolvedTheme === 'dark'

// For complex styling
const headerStyle = isDark
  ? { background: 'linear-gradient(...)' }
  : { background: '#fff' }

// For class names
const classes = isDark
  ? 'bg-dark-900 text-white'
  : 'bg-white text-black'
```

### 5.3 Image Handling

```tsx
const { resolvedTheme } = useTheme()

<img
  src={resolvedTheme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg'}
  alt="Logo"
  className={resolvedTheme === 'dark' ? 'invert' : ''}
/>
```

### 5.4 Chart/Graph Colors

```tsx
const { resolvedTheme } = useTheme()

const chartColors = {
  primary: resolvedTheme === 'dark' ? '#818cf8' : '#6366f1',
  secondary: resolvedTheme === 'dark' ? '#34d399' : '#10b981',
  text: resolvedTheme === 'dark' ? '#f3f4f6' : '#1f2937',
  grid: resolvedTheme === 'dark' ? '#374151' : '#e5e7eb',
}

<LineChart data={data}>
  <Line stroke={chartColors.primary} />
</LineChart>
```

---

## 6. Accessibility

### 6.1 Large Text Mode

**Automatically increases all text by 25%:**

```tsx
// Applied at root level
document.documentElement.classList.add('text-large')

// All text scales automatically via rem units
// No component changes needed!
```

**Testing:**
```tsx
// Enable in browser console
document.documentElement.classList.add('text-large')

// Verify all text is readable and doesn't break layout
```

### 6.2 High Contrast Mode

**Applied at root level:**

```tsx
document.documentElement.classList.add('high-contrast')
```

**What it does:**
- Increases border opacity
- Makes interactive elements bolder
- Enhances color contrast
- Adjusts shadows for clarity

### 6.3 Reduce Motion

**Respects user preference:**

```tsx
// Check in component
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches

// Conditional animation
{!prefersReducedMotion && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  />
)}
```

### 6.4 Focus Indicators

```tsx
// Always provide visible focus states
<button className="
  focus:outline-none
  focus:ring-2 focus:ring-primary-500
  focus:ring-offset-2 focus:ring-offset-white
  dark:focus:ring-offset-dark-900
">
```

### 6.5 Color Contrast

**Minimum contrast ratios:**
- Normal text: 4.5:1
- Large text (18pt+): 3:1
- Interactive elements: 3:1

**Check contrast:**
- Use browser DevTools
- WebAIM Contrast Checker
- Test with High Contrast mode enabled

---

## 7. Best Practices

### 7.1 Use Semantic Tokens First

```tsx
// ✅ GOOD: Adapts to any palette
<button className="bg-primary text-primary-foreground">

// ❌ AVOID: Hardcoded color
<button className="bg-red-500 text-white">
```

### 7.2 Always Provide Dark Variants

```tsx
// ✅ GOOD
<div className="bg-white dark:bg-dark-800">

// ❌ BAD: Only light mode
<div className="bg-white">
```

### 7.3 Test All Palettes

```tsx
// Test with different palettes
['sakura', 'ocean', 'matcha', 'sunset'].forEach(palette => {
  document.documentElement.setAttribute('data-palette', palette)
  // Visual check
})
```

### 7.4 Use cn() for Class Merging

```tsx
import { cn } from '@/lib/utils'

<div className={cn(
  "bg-white dark:bg-dark-800",
  isPrimary && "border-primary-500",
  className // Props className
)} />
```

### 7.5 Avoid Inline Hex Colors

```tsx
// ❌ AVOID
<div style={{ color: '#ef4444' }}>

// ✅ PREFER
<div style={{ color: 'rgb(var(--palette-primary-500))' }}>
// or
<div className="text-primary-500">
```

### 7.6 Consistent Opacity Values

```tsx
// Use standard opacities
bg-primary-500/10   // 10%
bg-primary-500/20   // 20%
bg-primary-500/50   // 50%
bg-primary-500/80   // 80%
bg-primary-500/90   // 90%

// Avoid arbitrary values
bg-primary-500/47   // ❌ Non-standard
```

### 7.7 Transition Durations

```tsx
transition-all duration-200      // Fast interactions
transition-colors duration-300   // Theme switches
transition-transform duration-500 // Large movements
```

---

## 8. Common Mistakes

### 8.1 ❌ Using `theme` Instead of `resolvedTheme`

```tsx
// WRONG
const { theme } = useTheme()
if (theme === 'dark') { ... } // Fails with 'system'

// CORRECT
const { resolvedTheme } = useTheme()
if (resolvedTheme === 'dark') { ... } // Always works
```

### 8.2 ❌ Missing Dark Mode Variants

```tsx
// WRONG: Only light mode
<div className="bg-gray-100 text-gray-900">

// CORRECT: Both modes
<div className="bg-gray-100 dark:bg-dark-800 text-gray-900 dark:text-gray-100">
```

### 8.3 ❌ Hardcoding Colors in JavaScript

```tsx
// WRONG
const color = '#ef4444'

// CORRECT
const color = getComputedStyle(document.documentElement)
  .getPropertyValue('--palette-primary-500')
```

### 8.4 ❌ Applying dark: to Root Element

```tsx
// WRONG: Specificity issues
<html className="dark:bg-dark-900">

// CORRECT: Applied by ThemeContext
// The .dark class is applied to <html> automatically
```

### 8.5 ❌ Forgetting to Test Accessibility

```tsx
// Always test:
// - Large text mode
// - High contrast mode
// - Keyboard navigation
// - Screen reader support
```

---

## 9. Testing

### 9.1 Theme Testing Checklist

```markdown
## Visual Tests
- [ ] Test all 10 palettes (Sakura → Amber)
- [ ] Test light mode
- [ ] Test dark mode
- [ ] Test system mode (switch OS theme)
- [ ] Test on mobile viewport (18px base)
- [ ] Test on desktop viewport (20px base)

## Accessibility Tests
- [ ] Enable Large Text mode (+25%)
- [ ] Enable High Contrast mode
- [ ] Enable Reduce Motion
- [ ] Test keyboard navigation
- [ ] Test with screen reader

## Persistence Tests
- [ ] Reload page (theme persists)
- [ ] Close/reopen browser (theme persists)
- [ ] Clear localStorage (defaults to dark)

## Performance Tests
- [ ] No FOUC (Flash of Unstyled Content)
- [ ] Theme switch is instant (<100ms)
- [ ] Palette switch is instant (<100ms)
```

### 9.2 Manual Testing Script

```tsx
// Run in browser console
const palettes = ['sakura', 'ocean', 'matcha', 'sunset', 'lavender',
                  'monochrome', 'midnight', 'cherry', 'jade', 'amber']

// Test all palettes
palettes.forEach((p, i) => {
  setTimeout(() => {
    document.documentElement.setAttribute('data-palette', p)
    console.log(`Testing palette: ${p}`)
  }, i * 2000)
})

// Test themes
['light', 'dark', 'system'].forEach((t, i) => {
  setTimeout(() => {
    localStorage.setItem('moshimoshi-theme', t)
    location.reload()
  }, i * 3000)
})

// Test accessibility
document.documentElement.classList.add('text-large')
document.documentElement.classList.add('high-contrast')
document.documentElement.classList.add('reduce-motion')
```

---

## 10. Reference

### 10.1 Color Token Quick Reference

```tsx
// Semantic Tokens
--background, --foreground
--card, --card-foreground
--primary, --primary-foreground
--muted, --muted-foreground
--accent, --accent-foreground
--border, --input, --ring

// Palette Colors (50-950)
primary-50, primary-100, ..., primary-950

// Neutral Scale
gray-50 to gray-900 (light mode)
dark-50 to dark-950 (dark mode)

// Japanese Aesthetic
japanese-sakura, japanese-matcha
japanese-mizu, japanese-zen, japanese-sumi
```

### 10.2 Common Class Combinations

```tsx
// Page Background
"bg-gradient-to-br from-primary-50 via-white to-primary-100
 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850"

// Card
"bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700
 rounded-lg shadow-sm p-6"

// Button
"bg-primary-500 hover:bg-primary-600 text-white rounded-lg px-4 py-2
 transition-colors"

// Input
"bg-white dark:bg-dark-900 border border-gray-300 dark:border-dark-600
 rounded-lg px-4 py-2 focus:border-primary-500 focus:ring-2
 focus:ring-primary-500/20"

// Glass Card
"bg-white/70 dark:bg-dark-800/70 backdrop-blur-md
 border border-gray-200/50 dark:border-dark-700/50 rounded-xl"
```

### 10.3 File Locations

```
Theme Configuration:
  src/styles/globals.css:136-230
  src/styles/palettes.css:1-230
  src/styles/fonts.css:1-221

Theme Logic:
  src/lib/theme/ThemeContext.tsx
  src/lib/theme/theme-script.ts
  src/utils/preferencesManager.ts

Component Examples:
  src/components/ui/button.tsx
  src/components/ui/card.tsx
  src/app/[locale]/tools/blast-mode/page.tsx:600-750
```

### 10.4 Palette Values

```css
/* Sakura (Default) */
--palette-primary-500: 239 68 68    /* #ef4444 */

/* Ocean */
--palette-primary-500: 14 165 233   /* #0ea5e9 */

/* Matcha */
--palette-primary-500: 34 197 94    /* #22c55e */

/* (See palettes.css for all 10 palettes) */
```

---

## Summary

The Moshimoshi theme system provides:

1. **Dynamic Palettes** - 10 colors, runtime switching
2. **Dark Mode** - SSR-safe, class-based
3. **Accessibility** - Large text, high contrast, reduce motion
4. **Japanese Typography** - Self-hosted fonts with fallbacks
5. **Semantic Tokens** - Palette-agnostic component styling

**Key Principles:**
- Use semantic tokens (`bg-primary`) over hardcoded colors
- Always provide dark mode variants (`dark:bg-dark-800`)
- Test with multiple palettes and accessibility features
- Use `resolvedTheme` for conditional logic, not `theme`
- Respect user preferences (motion, contrast, text size)

---

**Need Help?**
- Review example components in `src/components/ui/`
- Check blast mode implementation: `src/app/[locale]/tools/blast-mode/page.tsx:600-750`
- Test with DevTools: Toggle dark mode, switch palettes
- Ask in #dev-help channel with specific code examples

---

## 11. Using SVG Icons

### 11.1 When to Replace Emojis with SVG Icons

**Use SVG icons instead of emojis when:**
- You need consistent cross-platform rendering
- The icon is a core part of your brand/UI
- You want precise control over sizing and colors
- The element needs to scale perfectly at any size
- You're building production-ready features

**Keep emojis when:**
- Quick prototyping or placeholder content
- Casual, informal UI elements
- Icons that don't need brand consistency

### 11.2 Basic Pattern: Icon as String vs Component

**Emoji (string):**
```tsx
const stall = {
  id: 'my-stall',
  title: 'My Stall',
  icon: '🎋',  // Simple string
}

// Rendered as:
<span>{stall.icon}</span>
```

**SVG Icon (component):**
```tsx
import Image from 'next/image'

const stall = {
  id: 'my-stall',
  title: 'My Stall',
  icon: (
    <Image
      src="/ui/flat-icons/village/hiragana.svg"
      alt="Hiragana"
      width={48}
      height={48}
      className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
    />
  ),
}

// Rendered as:
<span>{stall.icon}</span>  // Component works here too!
```

### 11.3 Image Path Pattern

**CRITICAL:** Next.js serves the `/public` folder as the web root.

```tsx
// ❌ WRONG - Don't include "public" in the path
src="/public/ui/flat-icons/village/icon.svg"

// ✅ CORRECT - Path starts from public folder
src="/ui/flat-icons/village/icon.svg"

// Examples:
File location: /public/ui/flat-icons/village/hiragana.svg
Referenced as:   /ui/flat-icons/village/hiragana.svg

File location: /public/ui/icons/logo.png
Referenced as:   /ui/icons/logo.png
```

### 11.4 Handling Different SVG Sizes

**Problem:** SVG files may have different intrinsic dimensions:
- Small SVGs: 64×64px (hiragana.svg, katakana.svg)
- Large SVGs: 512×512px (kanji.svg, mastery.svg, blast.svg)

Using `w-full h-full` will cause larger SVGs to overflow.

**Solution:** Use fixed responsive dimensions:

```tsx
// ❌ WRONG - Large SVGs will overflow
<Image
  src="/ui/flat-icons/village/kanji.svg"
  alt="Kanji"
  width={48}
  height={48}
  className="w-full h-full object-contain"
/>

// ✅ CORRECT - Fixed responsive sizing
<Image
  src="/ui/flat-icons/village/kanji.svg"
  alt="Kanji"
  width={48}
  height={48}
  className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
/>

// Result:
// Mobile: 32px × 32px (w-8 h-8)
// Desktop: 48px × 48px (w-12 h-12)
```

### 11.5 Complete Example: Learning Village Icons

**Before (emojis):**
```tsx
const learningStalls = [
  {
    id: 'hiragana',
    title: 'Hiragana',
    icon: '🎋',
  },
  {
    id: 'katakana',
    title: 'Katakana',
    icon: '⚡',
  },
  {
    id: 'kanji-browser',
    title: 'Kanji Browser',
    icon: '📖',
  },
]
```

**After (SVG icons):**
```tsx
import Image from 'next/image'

const learningStalls = [
  {
    id: 'hiragana',
    title: 'Hiragana',
    icon: (
      <Image
        src="/ui/flat-icons/village/hiragana.svg"
        alt="Hiragana"
        width={48}
        height={48}
        className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
      />
    ),
  },
  {
    id: 'katakana',
    title: 'Katakana',
    icon: (
      <Image
        src="/ui/flat-icons/village/katakana.svg"
        alt="Katakana"
        width={48}
        height={48}
        className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
      />
    ),
  },
  {
    id: 'kanji-browser',
    title: 'Kanji Browser',
    icon: (
      <Image
        src="/ui/flat-icons/village/kanji.svg"
        alt="Kanji Browser"
        width={48}
        height={48}
        className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
      />
    ),
  },
]
```

### 11.6 Recommended Icon Sizes

**For UI elements (cards, buttons, lists):**
```tsx
// Small icons (mobile-first)
className="w-6 h-6 sm:w-8 sm:h-8"    // 24px → 32px

// Medium icons (default)
className="w-8 h-8 sm:w-12 sm:h-12"  // 32px → 48px

// Large icons (featured items)
className="w-12 h-12 sm:w-16 sm:h-16" // 48px → 64px

// Extra large icons (hero sections)
className="w-16 h-16 sm:w-24 sm:h-24" // 64px → 96px
```

**Always include:**
- Responsive sizes (`sm:`, `md:`, `lg:`)
- `object-contain` to preserve aspect ratio
- Proper `width` and `height` props for Next.js Image optimization

### 11.7 SVG Organization Structure

**Recommended folder structure:**
```
/public/ui/
├── flat-icons/
│   ├── village/           # Learning Village stall icons
│   │   ├── hiragana.svg
│   │   ├── katakana.svg
│   │   ├── kanji.svg
│   │   ├── mastery.svg
│   │   └── blast.svg
│   ├── stalls/            # Generic stall backgrounds
│   │   ├── ceramics.png
│   │   └── food-cart.png
│   └── ui/                # UI elements
│       ├── crown.png
│       └── close-button.png
├── icons/                 # App icons
└── images/                # General images
```

### 11.8 Testing Checklist for SVG Icons

Before committing SVG icon changes:

```markdown
## Visual Tests
- [ ] Icons render at correct size on mobile
- [ ] Icons render at correct size on desktop
- [ ] Icons maintain aspect ratio (not stretched)
- [ ] Icons are visible in light mode
- [ ] Icons are visible in dark mode
- [ ] No broken image placeholders

## Technical Tests
- [ ] TypeScript compiles without errors
- [ ] No console warnings about missing images
- [ ] Images are committed to git
- [ ] Image paths start with `/ui/` not `/public/ui/`
- [ ] Next.js Image component used (for optimization)

## Size Verification
- [ ] Check SVG intrinsic dimensions (64×64 vs 512×512)
- [ ] Verify className uses fixed sizes, not w-full/h-full
- [ ] Test different screen sizes (320px to 1920px)
```

### 11.9 Common Patterns from Codebase

**Pattern examples found in production:**

```tsx
// 1. PremiumBadge.tsx - Simple icon
<Image
  src="/ui/flat-icons/ui/crown.png"
  alt="Premium"
  width={40}
  height={40}
  className="w-full h-full object-contain"
/>

// 2. LandingPageClient.tsx - Close button
<Image
  src="/ui/flat-icons/close-button.png"
  alt="Close menu"
  width={24}
  height={24}
  className="w-6 h-6"
/>

// 3. Kana Drop Game - Theme icons (array)
const THEME_ICONS = [
  '/ui/flat-icons/188915-pokemon-go/png/star.png',
  '/ui/flat-icons/188915-pokemon-go/png/pokeball.png',
  '/ui/flat-icons/4193242-animals/svg/002-buffalo.svg',
]

// 4. Learning Village - Stall backgrounds (random)
const stallImages = [
  '/ui/flat-icons/stalls/ceramics.png',
  '/ui/flat-icons/stalls/food-cart.png',
]
const getRandomStallImage = () =>
  stallImages[Math.floor(Math.random() * stallImages.length)]
```

### 11.10 Migration Guide: Emoji to SVG

**Step-by-step process:**

1. **Verify Pattern** (check 10+ examples in codebase)
   ```bash
   # Search for existing image patterns
   grep -r "src=\"/ui/" src/components/
   ```

2. **Place SVG Files**
   ```bash
   # Add to public folder
   /public/ui/flat-icons/[category]/[icon-name].svg
   ```

3. **Check SVG Dimensions**
   ```bash
   # View first 2 lines of SVG
   head -2 /public/ui/flat-icons/village/icon.svg

   # Look for: height="64" or height="512"
   ```

4. **Import Image Component**
   ```tsx
   import Image from 'next/image'
   ```

5. **Replace Emoji with Component**
   ```tsx
   // Before
   icon: '🎋',

   // After
   icon: (
     <Image
       src="/ui/flat-icons/village/hiragana.svg"
       alt="Hiragana"
       width={48}
       height={48}
       className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
     />
   ),
   ```

6. **Test TypeScript**
   ```bash
   npm run type-check
   ```

7. **Visual Verification**
   - Check mobile (320px width)
   - Check desktop (1920px width)
   - Verify no oversized icons

8. **Commit**
   ```bash
   git add src/components/[component].tsx
   git add public/ui/flat-icons/[category]/
   git commit -m "feat: Replace emoji with SVG icons in [component]"
   ```

### 11.11 Troubleshooting

**Issue: Icons too large**
```tsx
// Problem: Using w-full h-full with large SVGs
className="w-full h-full object-contain"

// Solution: Use fixed responsive sizes
className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
```

**Issue: Broken images in production**
```tsx
// Problem: Wrong path
src="/public/ui/icons/logo.svg"

// Solution: Remove "public" from path
src="/ui/icons/logo.svg"
```

**Issue: Images not optimized**
```tsx
// Problem: Using <img> tag
<img src="/ui/icons/logo.svg" />

// Solution: Use Next.js Image
<Image src="/ui/icons/logo.svg" width={48} height={48} />
```

**Issue: Icons disappear on mobile**
```tsx
// Problem: Only desktop size specified
className="sm:w-12 sm:h-12"

// Solution: Include mobile size (without prefix)
className="w-8 h-8 sm:w-12 sm:h-12"
```

---

**Related Files:**
- Implementation: `src/components/dashboard/LearningVillage.tsx:655-810`
- Icons: `/public/ui/flat-icons/village/`
- Example commit: `feat: Replace emoji icons with SVG images in Learning Village`

---

*Last Updated: 2026-01-31*
*Version: 1.1*
