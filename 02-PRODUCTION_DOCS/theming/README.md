# Moshimoshi Theme System

**Status:** ACTIVE
**Last Updated:** 2026-01-30

## Overview

The Moshimoshi theme system is a production-ready, palette-based theming architecture built on Tailwind CSS v4. It features 10 dynamic color palettes, SSR-safe hydration, tiered user preferences, and comprehensive accessibility support.

## Quick Start

### 1. Using Theme in Components

```tsx
import { useTheme } from '@/lib/theme/ThemeContext'

export default function MyComponent() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <div className="bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100">
      <button
        onClick={() => setTheme('dark')}
        className="bg-primary-500 text-white hover:bg-primary-600"
      >
        Dark Mode
      </button>
    </div>
  )
}
```

### 2. Using Palette Colors

```tsx
// These automatically adapt to the active palette (Sakura, Ocean, Matcha, etc.)
<div className="bg-primary-50 dark:bg-primary-900/20">
  <h1 className="text-primary-600 dark:text-primary-400">Title</h1>
</div>
```

### 3. Japanese Aesthetic Colors

```tsx
<div className="text-japanese-sakura">Cherry blossom</div>
<div className="bg-japanese-matcha">Green tea</div>
<svg className="fill-japanese-mizu">Water</svg>
```

## Architecture

### Core Files

```
/src/styles/
├── globals.css          # Theme variables, semantic tokens, utilities
├── palettes.css         # 10 color palettes (Sakura→Amber)
└── fonts.css           # Self-hosted fonts (Noto Sans JP, etc.)

/src/lib/theme/
├── ThemeContext.tsx     # React state management
└── theme-script.ts     # SSR hydration (prevents flash)

/src/utils/
└── preferencesManager.ts # Guest/Free/Premium storage
```

### Theme Layers

1. **Base Layer** - CSS custom properties in `@theme` directive
2. **Palette Layer** - Dynamic colors via `data-palette` attribute
3. **Dark Mode Layer** - Class-based variants (`.dark`)
4. **Component Layer** - Tailwind utilities + semantic tokens

## Features

- **10 Color Palettes** - Sakura, Ocean, Matcha, Sunset, Lavender, Monochrome, Midnight, Cherry, Jade, Amber
- **SSR-Safe** - Zero flash of unstyled content
- **Tiered Storage** - Guest (session), Free (IndexedDB), Premium (Firebase sync)
- **Accessibility** - Large text (+25%), high contrast, reduce motion
- **Japanese Typography** - Self-hosted Noto Sans JP with platform fallbacks
- **PWA Optimized** - Safe area padding for notched devices

## Documentation

| Document | Description |
|----------|-------------|
| [THEME_GUIDE.md](./THEME_GUIDE.md) | Complete implementation guide with patterns and examples |
| [COLOR_REFERENCE.md](./COLOR_REFERENCE.md) | All color tokens, palettes, and usage guidelines |
| [TYPOGRAPHY_GUIDE.md](./TYPOGRAPHY_GUIDE.md) | Font scales, responsive typography, Japanese text handling |

## Key Files

- `src/styles/globals.css:136-230` - @theme directive with all color variables
- `src/styles/palettes.css:1-230` - 10 palette definitions
- `src/lib/theme/ThemeContext.tsx:46-215` - Theme state management
- `src/lib/theme/theme-script.ts:1-22` - SSR hydration script
- `src/utils/preferencesManager.ts:1-558` - Preference storage manager
- `src/app/layout.tsx:327` - Theme script injection
- `src/app/[locale]/layout.tsx:71` - ThemeProvider integration

## Common Patterns

### Semantic Tokens (Recommended)

```tsx
// Auto-adapts to any palette and theme
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
<div className="bg-card text-card-foreground border">
```

### Explicit Dark Mode

```tsx
<div className="bg-white dark:bg-dark-800">
<p className="text-gray-900 dark:text-gray-100">
```

### Conditional Styling

```tsx
const { resolvedTheme } = useTheme()
const isDark = resolvedTheme === 'dark'

<div className={isDark ? 'bg-dark-900' : 'bg-white'}>
```

## Testing Checklist

When implementing new pages:

- [ ] Test all 10 palettes
- [ ] Test light/dark/system modes
- [ ] Test with Large Text enabled
- [ ] Test with High Contrast enabled
- [ ] Test with Reduce Motion enabled
- [ ] Verify no FOUC on page load
- [ ] Test mobile (18px) and desktop (20px) base sizes
- [ ] Verify theme persists across reloads

## Related Resources

- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Noto Sans JP Font](https://fonts.google.com/noto/specimen/Noto+Sans+JP)

---

**Quick Links:**
- [Full Theme Guide](./THEME_GUIDE.md)
- [Color Reference](./COLOR_REFERENCE.md)
- [Typography Guide](./TYPOGRAPHY_GUIDE.md)
