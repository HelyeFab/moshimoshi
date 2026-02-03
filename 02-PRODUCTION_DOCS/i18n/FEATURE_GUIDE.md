# i18n Feature Guide

**Status:** ACTIVE
**Last Updated:** 2026-02-03

Complete implementation guide for the Moshimoshi internationalization system.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Language Configuration](#language-configuration)
3. [Translation Files](#translation-files)
4. [Client-Side Usage](#client-side-usage)
5. [Server-Side Usage](#server-side-usage)
6. [Routing & Navigation](#routing--navigation)
7. [Language Switching](#language-switching)
8. [Parameter Interpolation](#parameter-interpolation)
9. [Fallback Mechanism](#fallback-mechanism)
10. [Adding New Translations](#adding-new-translations)
11. [Adding New Languages](#adding-new-languages)
12. [SEO & Metadata](#seo--metadata)
13. [Middleware Configuration](#middleware-configuration)
14. [Namespaces Reference](#namespaces-reference)
15. [Troubleshooting](#troubleshooting)

---

## System Architecture

### Framework Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Routing | next-intl | Middleware, locale detection, path prefixing |
| Translation | Custom TypeScript | Translation lookup, fallback, interpolation |
| State | React Context | Language state, hooks, persistence |
| Storage | Cookie + localStorage | Language preference persistence |

### Data Flow

```
URL Request (/ja/dashboard)
       ↓
Middleware (src/middleware.ts)
  - Extract locale from path
  - Set x-locale header
       ↓
Layout (src/app/[locale]/layout.tsx)
  - Read locale from params
  - Wrap with I18nProvider
       ↓
Component
  - useTranslation() hook
  - Access strings object
  - Call t() function
```

---

## Language Configuration

### Type Definition

**File:** `src/i18n/config.ts:8-10`

```typescript
export type Language = 'en' | 'ja' | 'fr' | 'it' | 'de' | 'es'
export const languages: Language[] = ['en', 'ja', 'fr', 'it', 'de', 'es']
export const defaultLanguage: Language = 'en'
```

### Display Names

**File:** `src/i18n/config.ts:14-21`

```typescript
export const languageNames: Record<Language, string> = {
  en: 'English',
  ja: '日本語',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  es: 'Español',
}
```

### Routing Configuration

**File:** `src/i18n/routing.ts:35-57`

```typescript
export const routing = defineRouting({
  locales: ['en', 'ja', 'de', 'es', 'fr', 'it'],
  defaultLocale: 'en',
  localePrefix: 'always',      // All URLs have locale prefix
  localeDetection: false,      // Browser Accept-Language disabled
})
```

---

## Translation Files

### Location

All translation files are in `src/i18n/locales/{lang}/strings.ts`

### Structure

Each file exports a `strings` object with nested namespaces:

```typescript
// src/i18n/locales/en/strings.ts
export const strings = {
  common: {
    loading: 'Loading...',
    error: 'An error occurred',
    save: 'Save',
    cancel: 'Cancel',
  },
  dashboard: {
    title: 'Dashboard',
    welcome: 'Welcome back, {{name}}!',
    stats: {
      totalItems: 'Total Items',
      reviewed: 'Reviewed Today',
    },
  },
  // ... 57 namespaces total
}
```

### File Sizes

| Language | Lines | Notes |
|----------|-------|-------|
| English | ~7,817 | Master file, most complete |
| Japanese | ~6,500 | Native content for learning |
| German | ~6,000 | Community contributed |
| Spanish | ~6,000 | Community contributed |
| French | ~6,000 | Community contributed |
| Italian | ~6,000 | Community contributed |

---

## Client-Side Usage

### Available Hooks

**File:** `src/i18n/I18nContext.tsx`

#### `useI18n()` - Full Context

```typescript
const { language, setLanguage, t, strings } = useI18n()
```

| Property | Type | Description |
|----------|------|-------------|
| `language` | `Language` | Current language code |
| `setLanguage` | `(lang: Language) => void` | Change language (navigates) |
| `t` | `(path: string, params?) => string` | Translation function |
| `strings` | `TranslationStrings` | Full translation object |

#### `useTranslation()` - Common Pattern

```typescript
const { t, language, strings } = useTranslation()
```

Alias for commonly needed properties from `useI18n()`.

#### `useLocalePath()` - URL Building

```typescript
const { getLocalePath, language } = useLocalePath()

// Usage
const url = getLocalePath('/dashboard')  // Returns '/en/dashboard' or '/ja/dashboard'
```

### Usage Examples

#### Direct Object Access

```typescript
const { strings } = useTranslation()

return <h1>{strings.landing.hero.headline}</h1>
```

#### Using t() Function

```typescript
const { t } = useTranslation()

// Simple key
return <p>{t('common.loading')}</p>

// With parameters
return <p>{t('dashboard.welcome', { name: 'Taro' })}</p>
```

#### Building Locale-Aware Links

```typescript
const { getLocalePath } = useLocalePath()

return (
  <Link href={getLocalePath('/settings')}>
    Settings
  </Link>
)
```

---

## Server-Side Usage

### `getTranslations()`

**File:** `src/i18n/server.ts:38-58`

```typescript
import { getTranslations } from '@/i18n/server'

export default async function Page() {
  const { t, strings, locale } = await getTranslations()

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <p>{strings.dashboard.stats.totalItems}</p>
    </div>
  )
}
```

### With Locale Override

```typescript
const { t } = await getTranslations('ja')  // Force Japanese
```

### Metadata Generation

```typescript
import { getTranslations } from '@/i18n/server'

export async function generateMetadata() {
  const { t } = await getTranslations()

  return {
    title: t('seo.dashboard.title'),
    description: t('seo.dashboard.description'),
  }
}
```

---

## Routing & Navigation

### URL Structure

All routes follow the pattern: `/{locale}/{path}`

| URL | Locale | Page |
|-----|--------|------|
| `/en/dashboard` | English | Dashboard |
| `/ja/dashboard` | Japanese | Dashboard |
| `/de/kanji/browse` | German | Kanji Browser |

### Locale Detection Priority

**File:** `src/middleware.ts:85-89`

1. **URL Path** - `/ja/dashboard` (highest priority)
2. **Cookie** - `NEXT_LOCALE` value
3. **Default** - `en` (fallback)

Note: Browser `Accept-Language` header is **disabled** (`localeDetection: false`)

### Extracting Locale from Path

**File:** `src/middleware.ts:46-52`

```typescript
function extractLocaleFromPath(pathname: string): string {
  const localeMatch = pathname.match(/^\/([a-z]{2})(?:\/|$)/)
  if (localeMatch && routing.locales.includes(localeMatch[1])) {
    return localeMatch[1]
  }
  return routing.defaultLocale
}
```

---

## Language Switching

### How It Works

**File:** `src/i18n/I18nContext.tsx:103-115`

When `setLanguage()` is called:

1. Updates localStorage (`moshimoshi-language`)
2. Updates user-specific localStorage (`moshimoshi-user-language-{userId}`)
3. Sets `NEXT_LOCALE` cookie (1-year expiry)
4. Navigates to same path with new locale prefix

```typescript
const handleSetLanguage = (lang: Language) => {
  // Persist preference
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  if (userId) {
    localStorage.setItem(`${USER_LANGUAGE_STORAGE_KEY}-${userId}`, lang)
  }

  // Set cookie for server-side detection
  document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000; SameSite=Lax`

  // Navigate to new locale URL
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '')
  router.push(`/${lang}${pathWithoutLocale}`)
}
```

### LanguageSelector Component

**File:** `src/components/ui/LanguageSelector.tsx`

```typescript
import { useI18n } from '@/i18n/I18nContext'
import { languageNames } from '@/i18n/config'

export default function LanguageSelector() {
  const { language, setLanguage } = useI18n()

  return (
    <select value={language} onChange={(e) => setLanguage(e.target.value)}>
      {Object.entries(languageNames).map(([code, name]) => (
        <option key={code} value={code}>{name}</option>
      ))}
    </select>
  )
}
```

---

## Parameter Interpolation

### Syntax

Use `{{paramName}}` in translation strings:

```typescript
// In strings.ts
welcome: 'Welcome back, {{name}}!',
itemCount: 'You have {{count}} items',
progress: '{{current}} of {{total}} completed',
```

### Implementation

**File:** `src/i18n/config.ts:65-68`

```typescript
if (params) {
  Object.entries(params).forEach(([key, val]) => {
    value = value.replace(new RegExp(`{{${key}}}`, 'g'), String(val))
  })
}
```

### Usage

```typescript
const { t } = useTranslation()

t('dashboard.welcome', { name: 'Taro' })
// → "Welcome back, Taro!"

t('review.itemCount', { count: 5 })
// → "You have 5 items"

t('progress.status', { current: 10, total: 50 })
// → "10 of 50 completed"
```

### Common Parameters

| Parameter | Usage |
|-----------|-------|
| `{{count}}` | Numeric counts |
| `{{name}}` | User names, item names |
| `{{date}}` | Formatted dates |
| `{{current}}` / `{{total}}` | Progress indicators |
| `{{kanji}}` | Kanji characters |
| `{{accuracy}}` | Percentage values |

---

## Fallback Mechanism

### How It Works

**File:** `src/i18n/config.ts:40-58`

When a translation key is requested:

1. Look up key in current language
2. If not found, look up in English (`en`)
3. If still not found, return the dot-notation path

```typescript
export function getTranslation(
  language: Language,
  path: string,
  params?: Record<string, string | number>
): string {
  const keys = path.split('.')
  let value: unknown = allStrings[language]

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      // Fallback to English
      value = enStrings
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k]
        } else {
          return path  // Return path if not found
        }
      }
      break
    }
  }

  // Apply parameter interpolation...
  return String(value)
}
```

### Example

```typescript
// German strings missing 'newFeature' key
const { t, language } = useTranslation()  // language = 'de'

t('dashboard.newFeature')
// 1. Check deStrings.dashboard.newFeature → not found
// 2. Check enStrings.dashboard.newFeature → found: "New Feature"
// 3. Return "New Feature"
```

---

## Adding New Translations

### Step 1: Add to English (Master)

**File:** `src/i18n/locales/en/strings.ts`

```typescript
export const strings = {
  // ... existing namespaces

  myFeature: {
    title: 'My Feature',
    description: 'This is my new feature',
    actions: {
      start: 'Start',
      stop: 'Stop',
    },
  },
}
```

### Step 2: Add to Other Languages

Add the same structure to each language file:

- `src/i18n/locales/ja/strings.ts`
- `src/i18n/locales/de/strings.ts`
- `src/i18n/locales/es/strings.ts`
- `src/i18n/locales/fr/strings.ts`
- `src/i18n/locales/it/strings.ts`

```typescript
// Japanese example
myFeature: {
  title: '私の機能',
  description: 'これは私の新機能です',
  actions: {
    start: '開始',
    stop: '停止',
  },
},
```

### Step 3: Use in Components

```typescript
const { strings, t } = useTranslation()

return (
  <div>
    <h1>{strings.myFeature.title}</h1>
    <p>{t('myFeature.description')}</p>
    <button>{strings.myFeature.actions.start}</button>
  </div>
)
```

### Best Practices

1. **Always add to English first** - It's the fallback language
2. **Use consistent key naming** - camelCase for keys
3. **Group related translations** - Use nested objects
4. **Include context in key names** - `button.save` vs just `save`
5. **Use parameters for dynamic content** - Don't concatenate strings

---

## Adding New Languages

### Step 1: Update Type Definition

**File:** `src/i18n/config.ts`

```typescript
export type Language = 'en' | 'ja' | 'fr' | 'it' | 'de' | 'es' | 'pt'  // Add 'pt'
export const languages: Language[] = ['en', 'ja', 'fr', 'it', 'de', 'es', 'pt']
```

### Step 2: Add Display Name

```typescript
export const languageNames: Record<Language, string> = {
  // ... existing
  pt: 'Português',
}
```

### Step 3: Create Translation File

Create `src/i18n/locales/pt/strings.ts`:

```typescript
export const strings = {
  // Copy structure from en/strings.ts and translate
}
```

### Step 4: Import in Config

**File:** `src/i18n/config.ts`

```typescript
import { strings as ptStrings } from './locales/pt/strings'

const allStrings: Record<Language, TranslationStrings> = {
  // ... existing
  pt: ptStrings,
}
```

### Step 5: Update Routing

**File:** `src/i18n/routing.ts`

```typescript
export const locales = ['en', 'ja', 'de', 'es', 'fr', 'it', 'pt'] as const
```

### Step 6: Add OpenGraph Locale

**File:** `src/i18n/server.ts`

```typescript
const ogLocaleMap: Record<Locale, string> = {
  // ... existing
  pt: 'pt_BR',  // or 'pt_PT' for Portugal
}
```

---

## SEO & Metadata

### OpenGraph Locale Mapping

**File:** `src/i18n/server.ts:10-17`

```typescript
const ogLocaleMap: Record<Locale, string> = {
  en: 'en_US',
  ja: 'ja_JP',
  de: 'de_DE',
  es: 'es_ES',
  fr: 'fr_FR',
  it: 'it_IT',
}
```

### Hreflang Generation

**File:** `src/i18n/server.ts:113-119`

```typescript
export function generateAlternateLinks(path: string) {
  const links = locales.map(locale => ({
    hrefLang: locale,
    href: `${BASE_URL}/${locale}${path}`,
  }))

  // Add x-default (English)
  links.push({
    hrefLang: 'x-default',
    href: `${BASE_URL}/en${path}`,
  })

  return links
}
```

### Usage in Metadata

```typescript
export async function generateMetadata({ params }) {
  const { t } = await getTranslations(params.locale)

  return {
    title: t('seo.page.title'),
    alternates: {
      languages: generateAlternateLinks('/page'),
    },
  }
}
```

---

## Middleware Configuration

### Main Middleware

**File:** `src/middleware.ts`

```typescript
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'

const intlMiddleware = createMiddleware(routing)

export default async function middleware(request: NextRequest) {
  // ... auth checks, admin checks

  // Apply i18n middleware
  const response = intlMiddleware(request)

  // Set locale header for server components
  response.headers.set('x-locale', extractLocaleFromPath(request.nextUrl.pathname))

  return response
}
```

### Matcher Configuration

**File:** `src/middleware.ts:334-345`

```typescript
export const config = {
  matcher: [
    // Skip static files and images
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
```

---

## Namespaces Reference

The i18n system uses **57 top-level namespaces** to organize translations:

### Core App

| Namespace | Description |
|-----------|-------------|
| `common` | Shared UI elements (buttons, labels) |
| `navigation` | Nav menus, breadcrumbs |
| `dashboard` | Dashboard page content |
| `settings` | User settings |
| `auth` | Login, signup, password reset |
| `errors` | Error messages |

### Learning Features

| Namespace | Description |
|-----------|-------------|
| `kanji` | Kanji learning content |
| `kana` | Hiragana/Katakana content |
| `vocabulary` | Vocabulary system |
| `conjugation` | Verb conjugation |
| `grammar` | Grammar explanations |
| `reading` | Reading practice |

### Review System

| Namespace | Description |
|-----------|-------------|
| `review` | Review session UI |
| `reviewDashboard` | Review statistics |
| `reviewPrompts` | Review prompts and feedback |
| `flashcards` | Flashcard system |
| `blastMode` | Blast Mode feature |

### Content

| Namespace | Description |
|-----------|-------------|
| `stories` | Story content |
| `library` | Content library |
| `studyLists` | User study lists |
| `textbookVocabulary` | Textbook vocab |

### Account & Billing

| Namespace | Description |
|-----------|-------------|
| `account` | Account management |
| `subscription` | Subscription info |
| `pricing` | Pricing page |
| `entitlements` | Feature gating |

### Marketing

| Namespace | Description |
|-----------|-------------|
| `landing` | Landing page |
| `seo` | SEO metadata |
| `announcements` | Announcements |
| `banners` | Promotional banners |

---

## Troubleshooting

### Translation Key Not Found

**Symptom:** Seeing dot-notation paths like `dashboard.title` instead of translated text

**Causes & Solutions:**

1. **Key doesn't exist in current language**
   - Check the key exists in English (fallback)
   - Add the key to the translation file

2. **Typo in key path**
   - Verify the exact path: `strings.dashboard.title` vs `t('dashboard.title')`

3. **TypeScript not picking up new keys**
   - Restart TypeScript server in IDE

### Language Not Switching

**Symptom:** Clicking language selector doesn't change language

**Causes & Solutions:**

1. **Cookie not being set**
   - Check browser allows cookies
   - Verify `document.cookie` in console

2. **Navigation blocked**
   - Check for `router.push` errors in console

3. **Middleware not processing**
   - Verify URL has locale prefix

### Hydration Mismatch

**Symptom:** Console warning about hydration mismatch on language

**Causes & Solutions:**

1. **Server/client locale mismatch**
   - Ensure `I18nProvider` receives correct `initialLanguage` from route params
   - Don't read from localStorage during SSR

2. **Cookie vs URL mismatch**
   - Clear `NEXT_LOCALE` cookie and refresh

### Missing Translations in Production

**Symptom:** Some keys show English in non-English languages

**Causes & Solutions:**

1. **Keys added to English but not other languages**
   - This is expected (fallback mechanism)
   - Add translations to all language files

2. **Build caching issue**
   - Clear `.next` folder and rebuild

---

## Debug Tools

### Enable Translation Logging

```typescript
// In browser console
localStorage.setItem('debug:i18n', 'true')
```

### Check Current Locale

```typescript
// Client-side
const { language } = useI18n()
console.log('Current language:', language)

// Check cookie
document.cookie.split(';').find(c => c.includes('NEXT_LOCALE'))

// Check localStorage
localStorage.getItem('moshimoshi-language')
```

### Verify Translation File Loading

```typescript
import { strings as enStrings } from '@/i18n/locales/en/strings'
console.log('EN namespace count:', Object.keys(enStrings).length)
```

---

*Last Updated: 2026-02-03*
