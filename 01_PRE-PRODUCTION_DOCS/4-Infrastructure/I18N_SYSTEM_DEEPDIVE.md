# i18n System Deep Dive Guide

> **Purpose:** Quick onboarding for AI assistants working on the Moshimoshi i18n system.
> **Last Updated:** 2026-01-14

---

## TL;DR - What You Need to Know in 60 Seconds

1. **Library:** `next-intl` v4.5.8 for routing, custom TypeScript layer for translations
2. **Locales:** `en`, `ja`, `de`, `es`, `fr`, `it` (English is source of truth)
3. **Translation files:** `src/i18n/locales/{locale}/strings.ts` (~7,000 lines each)
4. **Client usage:** `const { t } = useI18n()` then `t('namespace.key')`
5. **Server usage:** `const { t } = await getTranslations()`
6. **URL pattern:** All routes prefixed with locale: `/en/dashboard`, `/ja/dashboard`
7. **Verification script:** `node scripts/i18n/verify-coverage.js`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ROUTING LAYER                            │
│                      (next-intl v4.5.8)                         │
├─────────────────────────────────────────────────────────────────┤
│  next.config.ts ──► withNextIntl plugin                         │
│  src/i18n.ts ──► getRequestConfig (empty messages)              │
│  src/i18n/routing.ts ──► defineRouting, createNavigation        │
│  src/middleware.ts ──► locale extraction, redirects             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TRANSLATION LAYER                           │
│                    (Custom TypeScript)                          │
├─────────────────────────────────────────────────────────────────┤
│  src/i18n/config.ts ──► imports all locales, getTranslation()   │
│  src/i18n/I18nContext.tsx ──► React Context, useI18n() hook     │
│  src/i18n/server.ts ──► getTranslations() for server components │
│  src/i18n/locales/*/strings.ts ──► actual translation strings   │
└─────────────────────────────────────────────────────────────────┘
```

**Key insight:** next-intl handles routing/middleware, but translations use a custom system (not next-intl's message format). The `messages: {}` in `src/i18n.ts` is intentionally empty.

---

## File Reference

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/i18n.ts` | next-intl server config | `locales`, `defaultLocale`, `isValidLocale` |
| `src/i18n/routing.ts` | Routing definitions | `routing`, `Link`, `useRouter`, `usePathname` |
| `src/i18n/config.ts` | Translation loader | `translations`, `getTranslation()`, `Language` |
| `src/i18n/I18nContext.tsx` | Client React context | `useI18n()`, `useTranslation()`, `I18nProvider` |
| `src/i18n/server.ts` | Server utilities | `getTranslations()`, `generateLocalizedMetadata()` |
| `src/middleware.ts` | Request middleware | Locale detection, auth checks, redirects |
| `src/app/[locale]/layout.tsx` | Locale layout | Wraps all routes with `I18nProvider` |
| `src/app/layout.tsx` | Root HTML layout | Sets `<html lang={locale}>` from middleware header |

---

## Translation File Structure

Location: `src/i18n/locales/{locale}/strings.ts`

```typescript
export const strings = {
  // Top-level namespaces (100+ in total)
  common: {
    loading: 'Loading...',
    cancel: 'Cancel',
    retry: 'Retry',
    restart: 'Restart',  // Added 2026-01-14
    // ...
  },
  landing: {
    hero: {
      headline: 'Master Japanese...',
      ctaPrimary: 'Start Learning Free',
    },
  },
  flashcards: {
    sync: {
      deckSync: 'Syncing decks...',
      restoringUserDecks: 'Restoring your decks... ({{current}}/{{total}})',
      userDecksComplete: '{{count}} user decks restored',
    },
  },
  // ... many more namespaces
}
```

**Line counts (approximate):**
- English: 7,409 lines, 4,833 keys
- Other locales: 5,000-5,200 keys each (have extra legacy keys)

---

## How to Add New Translation Keys

### Step 1: Add to English (source of truth)

```typescript
// src/i18n/locales/en/strings.ts
export const strings = {
  myFeature: {
    title: 'My Feature Title',
    description: 'Description with {{param}} interpolation',
  },
}
```

### Step 2: Add to ALL other locales

You MUST add to all 5 other locales: `ja`, `de`, `es`, `fr`, `it`

```typescript
// src/i18n/locales/ja/strings.ts
myFeature: {
  title: '機能タイトル',
  description: '{{param}}を含む説明',
},
```

### Step 3: Verify coverage

```bash
node scripts/i18n/verify-coverage.js
```

### Step 4: Use in components

```typescript
// Client component
'use client'
import { useI18n } from '@/i18n/I18nContext'

function MyComponent() {
  const { t } = useI18n()
  return <h1>{t('myFeature.title')}</h1>
}

// Server component
import { getTranslations } from '@/i18n/server'

async function MyServerComponent() {
  const { t } = await getTranslations()
  return <h1>{t('myFeature.title')}</h1>
}
```

---

## Common Pitfalls & Gotchas

### 1. Verification Script Blind Spot

**Problem:** `verify-coverage.js` only checks locale-to-locale coverage. It does NOT detect keys used in code that don't exist in any translation file.

**Symptom:** UI shows raw key path like `common.restart` instead of translated text.

**Solution:** When you see a raw key in the UI:
1. Check if the key exists in English: `grep -n "keyName" src/i18n/locales/en/strings.ts`
2. If missing, add to ALL 6 locales manually
3. Run TypeScript check: `npx tsc --noEmit`

### 2. Parameter Syntax Mismatch

**Problem:** Some old translations use `{count}`, newer ones use `{{count}}`.

```typescript
// Old format (inconsistent)
decksSynced: '{count} decks synced',

// Current format (standard)
restoringUserDecks: 'Restoring... ({{current}}/{{total}})',
```

The `getTranslation()` function only replaces `{{param}}` format. Keys using `{param}` won't interpolate.

### 3. next-intl Navigation vs Next.js Navigation

**Wrong:**
```typescript
import { useRouter } from 'next/navigation'  // Missing locale handling
```

**Correct:**
```typescript
import { useRouter } from '@/i18n/routing'  // Locale-aware
// OR
import { useI18n } from '@/i18n/I18nContext'
const { language } = useI18n()
router.push(`/${language}/dashboard`)
```

### 4. Locale Cookie Persistence

When user changes language, three things happen:
1. `localStorage['moshimoshi-language']` is set
2. `document.cookie['NEXT_LOCALE']` is set (1 year expiry)
3. Router navigates to new locale URL

If language seems "stuck", check all three.

### 5. Extra Keys in Non-English Locales

The verification script shows >100% coverage for non-English locales because they have orphaned keys that don't exist in English. These are harmless but indicate tech debt.

---

## Debugging Translations

### Find where a key is used
```bash
grep -rn "t('common.restart" src/
grep -rn "'common.restart'" src/
```

### Check if key exists in a locale
```bash
grep -n "restart:" src/i18n/locales/en/strings.ts
```

### Find the common section structure
```bash
grep -n "common:" src/i18n/locales/en/strings.ts -A 50 | head -60
```

### Count keys per locale
```bash
node scripts/i18n/verify-coverage.js
```

### Check for interpolation parameters
```bash
grep -n "{{" src/i18n/locales/en/strings.ts | head -20
```

---

## Locale Detection Flow

```
Request comes in
       │
       ▼
┌──────────────────────┐
│ middleware.ts        │
│ extractLocaleFromPath│
└──────────────────────┘
       │
       ▼
  URL has /xx/ prefix?
       │
   ┌───┴───┐
   │ Yes   │ No
   ▼       ▼
Use URL   Check NEXT_LOCALE cookie
locale         │
       ┌───────┴───────┐
       │ Has cookie    │ No cookie
       ▼               ▼
   Use cookie      Use 'en' default
```

**Important:** `localeDetection: false` in routing config means Accept-Language header is IGNORED. Locale must be explicit (URL or cookie).

---

## SEO Considerations

### Metadata generation
```typescript
import { generateLocalizedMetadata } from '@/i18n/server'

export async function generateMetadata() {
  return generateLocalizedMetadata({
    title: 'Page Title',
    description: 'Page description',
  })
}
```

This automatically adds:
- `hreflang` tags for all 6 locales
- `x-default` pointing to English
- OpenGraph locale tags

### OpenGraph locale mapping
```typescript
const ogLocaleMap = {
  en: 'en_US',
  ja: 'ja_JP',
  de: 'de_DE',
  es: 'es_ES',
  fr: 'fr_FR',
  it: 'it_IT',
}
```

---

## Quick Commands Reference

```bash
# Verify translation coverage
node scripts/i18n/verify-coverage.js

# Find missing translation usage in code
grep -rn "t('" src/components src/app --include="*.tsx" | grep -v node_modules

# Check TypeScript for i18n errors
npx tsc --noEmit 2>&1 | grep -i i18n

# Count lines in translation files
wc -l src/i18n/locales/*/strings.ts

# Find all uses of useI18n hook
grep -rn "useI18n\|useTranslation" src/ --include="*.tsx" | wc -l
```

---

## Adding a New Locale

1. Add to `src/i18n/routing.ts`:
   ```typescript
   export const locales = ['en', 'ja', 'de', 'es', 'fr', 'it', 'pt'] as const
   ```

2. Create translation file: `src/i18n/locales/pt/strings.ts`

3. Register in `src/i18n/config.ts`:
   ```typescript
   import { strings as ptStrings } from './locales/pt/strings'
   export const translations = { ...existing, pt: ptStrings }
   ```

4. Add to `languageNames` in `src/i18n/config.ts`:
   ```typescript
   export const languageNames = { ...existing, pt: 'Português' }
   ```

5. Add OpenGraph mapping in `src/i18n/server.ts`:
   ```typescript
   const ogLocaleMap = { ...existing, pt: 'pt_BR' }
   ```

---

## Related Documentation

- `01_PRODUCTION_DOCS/4-Infrastructure/I18N_LOCALE_SYSTEM.md` - Original system docs
- `01_PRODUCTION_DOCS/4-Infrastructure/MULTILANGUAGE_SEO_REPORT.md` - SEO analysis
- `scripts/i18n/verify-coverage.js` - Coverage verification script source

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-14 | Added `common.restart` to all 6 locales |
| 2026-01-14 | Added `flashcards.sync.restoringUserDecks` and `userDecksComplete` to 5 locales |
| 2026-01-14 | Created this deep dive guide |

---

*This guide was created after a full codebase analysis. Update it when making significant i18n changes.*
