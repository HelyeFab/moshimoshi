# Theme System Documentation

## Overview
Moshimoshi features a comprehensive theme system that supports light mode, dark mode, automatic system preference detection, and customizable color palettes. The theme system is built with React Context API and provides smooth transitions between themes without any flash of unstyled content (FOUC).

## Features
- 🌞 **Light Mode** - Clean, bright interface for daytime use
- 🌙 **Dark Mode** - Blue-grey tones (not pure black) for comfortable night-time viewing
- 💻 **System Mode** - Automatically follows OS theme preference
- 🎨 **6 Color Palettes** - Customizable color schemes for personalization
- 💾 **Persistent** - Theme and palette preferences saved to localStorage
- ⚡ **No Flash** - Prevents FOUC with initialization script
- 🎯 **Live Preview** - Instant visual feedback when changing themes/palettes
- ✨ **Smooth Transitions** - CSS transitions for theme changes

## Architecture

### Components
1. **ThemeContext** (`/lib/theme/ThemeContext.tsx`)
   - React Context provider for theme state management
   - Handles theme switching and persistence
   - Listens to system theme changes
   - Loads and applies color palette preferences

2. **ThemeToggle** (`/components/ui/ThemeToggle.tsx`)
   - UI component with three theme options
   - Accessible with ARIA labels
   - Visual feedback for active theme

3. **Theme Script** (`/lib/theme/theme-script.ts`)
   - Prevents flash on initial page load
   - Runs before React hydration

4. **Palette CSS** (`/styles/palettes.css`)
   - Defines color variables for each palette
   - Maps palette colors to Tailwind classes
   - Handles gradients and state variants

### Integration Points
- **Root Layout** (`/app/layout.tsx`) - ThemeProvider wrapper and initialization script
- **Global Styles** (`/styles/globals.css`) - Theme-specific CSS variables and classes
- **Settings Page** (`/app/settings/page.tsx`) - Theme and palette selection UI
- **All UI Components** - Automatic theme and palette adaptation

## Color Palette System

### Available Palettes

#### 1. Sakura 🌸 (Default)
- **Theme**: Cherry blossom inspired red/pink
- **Primary Range**: Soft pink (#fee2e2) to deep red (#7f1d1d)
- **Use Case**: Default aesthetic, warm and welcoming

#### 2. Ocean 🌊
- **Theme**: Calm blues and teals
- **Primary Range**: Light sky (#f0f9ff) to deep ocean (#08475d)
- **Use Case**: Professional, calming interface

#### 3. Matcha 🍵
- **Theme**: Fresh greens inspired by Japanese tea
- **Primary Range**: Mint (#f0fdf4) to forest (#052e16)
- **Use Case**: Natural, refreshing aesthetic

#### 4. Sunset 🌅
- **Theme**: Warm oranges and yellows
- **Primary Range**: Cream (#fff7ed) to burnt orange (#431407)
- **Use Case**: Energetic, warm atmosphere

#### 5. Lavender 💜
- **Theme**: Elegant purples and indigos
- **Primary Range**: Lavender (#faf5ff) to deep purple (#3b0764)
- **Use Case**: Creative, sophisticated look

#### 6. Monochrome ⚫
- **Theme**: Professional grays
- **Primary Range**: Light gray (#f9fafb) to charcoal (#030712)
- **Use Case**: Minimalist, professional

### How Palettes Work

1. **CSS Variables**: Each palette defines `--palette-primary-*` variables
2. **Dynamic Application**: Selected palette sets `data-palette` attribute
3. **Instant Updates**: All primary color classes update immediately
4. **Class Mapping**: Tailwind classes automatically use palette colors

### Affected UI Elements
- Primary buttons and CTAs
- Toggle switches and checkboxes
- Links and interactive elements
- Focus rings and selection states
- Gradients and decorative elements
- Loading states and progress bars
- Badges and status indicators
- Form inputs and borders

## Color System Details

### Primary Colors (Using Active Palette)
```css
/* Dynamically changes based on selected palette */
--palette-primary-50: /* Lightest shade */
--palette-primary-100:
--palette-primary-200:
--palette-primary-300:
--palette-primary-400:
--palette-primary-500: /* Main brand color */
--palette-primary-600:
--palette-primary-700:
--palette-primary-800:
--palette-primary-900:
--palette-primary-950: /* Darkest shade */
```

### Dark Theme Colors (Blue-Grey)
```css
--color-dark-50: #f3f4f6;      /* Lightest text in dark mode */
--color-dark-100: #e5e7eb;
--color-dark-200: #d1d5db;
--color-dark-300: #9ca3af;
--color-dark-400: #6b7280;
--color-dark-500: #4b5563;
--color-dark-600: #374151;
--color-dark-700: #2d3748;     /* Surface variants */
--color-dark-800: #1f2937;
--color-dark-850: #1a202c;     /* Main dark background */
--color-dark-900: #171923;     /* Darker background */
--color-dark-950: #0f1419;     /* Darkest */
```

### Japanese Aesthetic Colors
```css
/* Cherry Blossom Pink */
--color-japanese-sakura: #ffb7c5;
--color-japanese-sakuraDark: #ff8fa3;

/* Black Ink */
--color-japanese-sumi: #1a1a1a;

/* Water Blue */
--color-japanese-mizu: #a8dadc;
--color-japanese-mizuDark: #457b9d;

/* Matcha Green */
--color-japanese-matcha: #95d5b2;
--color-japanese-matchaDark: #52b788;

/* Zen Gold/Orange */
--color-japanese-zen: #e9c46a;
--color-japanese-zenDark: #f4a261;
```

## Usage

### Using the Theme Hook
```typescript
import { useTheme } from '@/lib/theme/ThemeContext';

export function MyComponent() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  
  // theme: 'light' | 'dark' | 'system'
  // resolvedTheme: 'light' | 'dark' (actual applied theme)
  
  return (
    <button onClick={() => setTheme('dark')}>
      Switch to Dark Mode
    </button>
  );
}
```

### Using Palette Colors
```tsx
// Primary button automatically uses active palette
<button className="bg-primary-500 hover:bg-primary-600 text-white">
  Action Button
</button>

// Gradient with palette colors
<div className="bg-gradient-to-r from-primary-400 to-primary-600">
  Gradient Background
</div>

// Dark mode variant with palette
<div className="text-primary-600 dark:text-primary-400">
  Adaptive Text
</div>
```

### Programmatically Setting Palette
```javascript
// Set palette directly
document.documentElement.setAttribute('data-palette', 'ocean');

// Save to preferences
const preferences = {
  palette: 'ocean',
  // ... other preferences
};
localStorage.setItem('user-preferences', JSON.stringify(preferences));
```

### Settings Page Integration
The settings page (`/app/settings/page.tsx`) provides:
- Visual theme selector (Light/Dark/System)
- Color palette grid with previews
- Live preview of selected palette
- Persistent storage of preferences

## CSS Classes Applied

The theme system applies attributes to the document root:
- `.light` or `.dark` - Theme mode classes
- `data-palette="[palette-name]"` - Active color palette

These enable:
- Tailwind's `dark:` variant
- Palette-specific color variables
- Smooth color transitions

## Component Examples

### Theme-Aware Button
```tsx
<button className="
  px-4 py-2 rounded-lg
  bg-primary-500 hover:bg-primary-600
  dark:bg-primary-600 dark:hover:bg-primary-700
  text-white font-medium
  transition-colors duration-200
">
  Palette-Aware Button
</button>
```

### Toggle Switch with Palette
```tsx
<button
  className={`
    relative inline-flex h-6 w-11 rounded-full
    transition-colors duration-200
    ${enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}
  `}
>
  <span className="...toggle-indicator..." />
</button>
```

## Best Practices

1. **Always use palette color classes** (`primary-*`) for themeable elements
2. **Test all 6 palettes** with both light and dark modes
3. **Provide dark mode variants** using `dark:` prefix
4. **Ensure WCAG AA contrast** for all palette/theme combinations
5. **Use semantic color naming** for consistency
6. **Apply transitions** for smooth theme changes
7. **Consider colorblind users** when choosing palettes
8. **Use soft whites** (`bg-soft-white` #eef6fd) instead of pure white for reduced eye strain

## Accessibility

- Theme toggle includes ARIA labels
- All palettes maintain WCAG AA contrast ratios
- Keyboard accessible controls (Tab navigation)
- Visual feedback for active states
- Respects `prefers-reduced-motion`
- High contrast support for each palette

## Performance Considerations

- Theme and palette cached in localStorage
- Minimal re-renders using React Context optimization
- CSS transitions for smooth visual changes
- Script prevents flash on page load
- Lightweight implementation (~4KB gzipped with palettes)
- Single palette loaded at a time

## Testing Combinations

With 3 themes and 6 palettes, test these 18 combinations:
- Light + [Sakura, Ocean, Matcha, Sunset, Lavender, Monochrome]
- Dark + [Sakura, Ocean, Matcha, Sunset, Lavender, Monochrome]
- System + [Sakura, Ocean, Matcha, Sunset, Lavender, Monochrome]

## Future Enhancements

Potential improvements for the theme system:
- [ ] Custom palette creator - Users design their own colors
- [ ] Seasonal themes - Auto-switch based on Japanese seasons
- [ ] Time-based themes - Different palettes for day/night
- [ ] Palette sharing - Export/import color schemes
- [ ] A11y modes - High contrast, colorblind-friendly presets
- [ ] Theme scheduling - Set specific times for theme changes
- [ ] Per-section theming - Different palettes for app sections

## Troubleshooting

### Theme not persisting
- Check localStorage is enabled
- Verify THEME_STORAGE_KEY is consistent
- Check browser privacy settings

### Palette not applying
- Ensure palettes.css is imported in globals.css
- Verify data-palette attribute is set
- Check CSS variable definitions

### Flash of wrong theme
- Ensure theme script is in <head>
- Check suppressHydrationWarning is set
- Verify script runs before hydration

### Dark mode not working
- Ensure Tailwind config includes darkMode: 'class'
- Verify .dark class is applied to root
- Check @custom-variant dark directive

### Colors not changing with palette
- Ensure using `primary-*` classes, not hard-coded colors
- Check palette CSS variables are defined
- Verify class mappings in palettes.css

## Debug Commands

```javascript
// Check current theme
localStorage.getItem('moshimoshi-theme')

// Check current palette
JSON.parse(localStorage.getItem('user-preferences'))?.palette

// Get current palette attribute
document.documentElement.getAttribute('data-palette')

// Force theme and palette
document.documentElement.className = 'dark'
document.documentElement.setAttribute('data-palette', 'ocean')

// List all palette variables
getComputedStyle(document.documentElement)
  .getPropertyValue('--palette-primary-500')
```

## Related Files

- `/src/lib/theme/ThemeContext.tsx` - Theme provider and hook
- `/src/components/ui/ThemeToggle.tsx` - Toggle component
- `/src/lib/theme/theme-script.ts` - Initialization script
- `/src/styles/globals.css` - Theme CSS variables
- `/src/styles/palettes.css` - Palette definitions
- `/src/app/layout.tsx` - Provider integration
- `/src/app/settings/page.tsx` - Theme/palette settings UI
- `/tailwind.config.js` - Tailwind theme configuration