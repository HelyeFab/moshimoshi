# i18n/Locale System Documentation

## Overview

Moshimoshi uses **next-intl v4.5.8** as the primary internationalization library, integrated with a custom translation layer for flexible string management.

---

## Supported Locales

| Code | Language | Status |
|------|----------|--------|
| `en` | English | Default |
| `ja` | Japanese | |
| `de` | German | |
| `es` | Spanish | |
| `fr` | French | |
| `it` | Italian | |

---

## Architecture

### Key Files

| File | Purpose |
|------|---------|
| `src/i18n.ts` | next-intl server config, default export for plugin |
| `src/i18n/routing.ts` | Locale definitions and next-intl routing config |
| `src/i18n/config.ts` | Translation imports and helper functions |
| `src/i18n/I18nContext.tsx` | Client-side i18n provider and hooks |
| `src/i18n/server.ts` | Server-side translation utilities |
| `src/middleware.ts` | Request middleware for locale handling |
| `next.config.ts` | next-intl plugin initialization |

### Translation Files

Location: `src/i18n/locales/[locale]/strings.ts`

Each locale has a TypeScript file exporting a `strings` object with nested translations:

```typescript
export const strings = {
  landing: {
    hero: {
      headline: 'Master Japanese with Revolutionary Learning Tools',
      subheadline: 'The only platform combining...',
      ctaPrimary: 'Start Learning Free',
    },
  },
  shadowing: {
    title: 'Shadowing Practice',
    noSentence: 'No sentence to play',
  },
  common: {
    loading: 'Loading...',
    cancel: 'Cancel',
  },
  // ...
}
```

---

## URL Routing

### Pattern

All routes use prefix-based locale routing:

```
/:locale/:path
```

### Examples

- `/en/dashboard` - English dashboard
- `/ja/dashboard` - Japanese dashboard
- `/fr/youtube-shadowing` - French shadowing page
- `/en/admin/users` - English admin route

### Configuration

```typescript
// src/i18n/routing.ts
export const routing = defineRouting({
  locales: ['en', 'ja', 'de', 'es', 'fr', 'it'],
  defaultLocale: 'en',
  localePrefix: 'always',    // All routes require /[locale]/ prefix
  localeDetection: false,    // No Accept-Language auto-detection
});
```

### File Structure

Routes are nested under the `[locale]` dynamic segment:

```
src/app/
├── [locale]/
│   ├── layout.tsx          # Locale-specific layout with I18nProvider
│   ├── page.tsx            # Landing page
│   ├── dashboard/
│   ├── youtube-shadowing/
│   └── ...
├── layout.tsx              # Root layout
└── api/                    # API routes (no locale prefix)
```

---

## Usage

### Client Components

```typescript
'use client'
import { useI18n } from '@/i18n/I18nContext'

export default function MyComponent() {
  const { t, language, strings } = useI18n()

  return (
    <div>
      <h1>{t('landing.hero.headline')}</h1>
      <p>{t('shadowing.sentenceProgress', { current: 5, total: 20 })}</p>
      <span>Current language: {language}</span>
    </div>
  )
}
```

### Server Components

```typescript
import { getTranslations } from '@/i18n/server'

export default async function ServerPage() {
  const { t, strings } = await getTranslations()

  return <h1>{t('landing.hero.headline')}</h1>
}
```

### Translation Function Features

| Feature | Syntax | Example |
|---------|--------|---------|
| Dot notation | `t('path.to.key')` | `t('landing.hero.headline')` |
| Interpolation | `t('key', { param: value })` | `t('progress', { current: 1, total: 10 })` |
| Placeholders | `{{paramName}}` in strings | `"Page {{current}} of {{total}}"` |
| Fallback | Automatic | Missing translations default to English |

---

## Locale Detection & Resolution

### Priority Order

1. **URL path** - Extract locale from `/:locale/` prefix
2. **Cookie** - Check `NEXT_LOCALE` cookie
3. **Default** - Fall back to `en`

> Note: Accept-Language header detection is disabled. Locale must be explicit.

### Middleware Logic

```typescript
// src/middleware.ts
function extractLocaleFromPath(pathname: string): string {
  const localeMatch = pathname.match(/^\/([a-z]{2})(?:\/|$)/);
  if (localeMatch && routing.locales.includes(localeMatch[1])) {
    return localeMatch[1];
  }
  return routing.defaultLocale;
}
```

---

## Language Switching

### Component

`src/components/ui/LanguageSelector.tsx` provides the UI dropdown.

### Flow

1. User selects new language from dropdown
2. `setLanguage()` is called from `useI18n()`
3. Preference saved to localStorage and `NEXT_LOCALE` cookie
4. Router navigates to new locale URL: `/ja/current-path`
5. Page re-renders with new language

### Storage

| Storage | Key | Purpose |
|---------|-----|---------|
| localStorage | `moshimoshi-language` | Global preference |
| localStorage | `moshimoshi-user-language-{userId}` | Per-user preference |
| Cookie | `NEXT_LOCALE` | Server-side detection |

---

## Navigation Utilities

### Exported from I18nContext

```typescript
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

### Custom Helpers

```typescript
// Get locale-prefixed path
const localePath = useLocalePath()

// Build locale URL manually
const url = buildLocalePath('/dashboard', 'ja')  // => '/ja/dashboard'

// Extract locale from current path
const locale = getLocaleFromPath()
```

---

## SEO & Metadata

### Localized Metadata Generator

```typescript
export async function generateLocalizedMetadata(
  options: LocalizedMetadataOptions
): Promise<Metadata>
```

Features:
- Creates SEO-friendly metadata with language alternates
- Generates `hreflang` tags for all locales
- Maps locales to OpenGraph format

### OpenGraph Locale Mapping

```typescript
const ogLocaleMap: Record<Locale, string> = {
  en: 'en_US',
  ja: 'ja_JP',
  de: 'de_DE',
  es: 'es_ES',
  fr: 'fr_FR',
  it: 'it_IT',
};
```

---

## Adding a New Locale

### Steps

1. **Add locale code** to `src/i18n/routing.ts`:
   ```typescript
   locales: ['en', 'ja', 'de', 'es', 'fr', 'it', 'pt'],
   ```

2. **Create translation file** at `src/i18n/locales/pt/strings.ts`:
   ```typescript
   export const strings = {
     // Copy structure from en/strings.ts and translate
   }
   ```

3. **Register in config** at `src/i18n/config.ts`:
   ```typescript
   import { strings as ptStrings } from './locales/pt/strings'

   const translations = {
     // ...existing
     pt: ptStrings,
   }
   ```

4. **Add to type definitions** if using TypeScript strict mode

5. **Update OpenGraph mapping** if needed for SEO

---

## Adding New Translation Keys

### Steps

1. **Add to English strings** first (source of truth):
   ```typescript
   // src/i18n/locales/en/strings.ts
   export const strings = {
     myFeature: {
       title: 'My Feature',
       description: 'Feature description here',
     },
   }
   ```

2. **Add to all other locale files** with translations

3. **Use in components**:
   ```typescript
   const { t } = useI18n()
   return <h1>{t('myFeature.title')}</h1>
   ```

---

## Debugging

### Console Logging

The translation function logs warnings for missing keys in development:

```
Warning: Missing translation key: myFeature.unknownKey
```

### Check Current Locale

```typescript
const { language } = useI18n()
console.log('Current locale:', language)
```

---

## Related Documentation

- `MULTILANGUAGE_SEO_REPORT.md` - SEO considerations for multi-language support

---

*Last Updated: 2025-12-15*
