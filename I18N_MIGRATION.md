# i18n Migration Context

> **Purpose**: This document provides context for AI assistants working on the Moshimoshi i18n system upgrade.

## Current State (Pre-Migration)

### Architecture
- **Custom i18n system** - No external library (not using next-intl, react-i18next, etc.)
- **Client-only** - `I18nContext.tsx` uses `'use client'` directive
- **6 locales**: en (reference), ja, de, es, fr, it
- **Storage**: localStorage with keys `moshimoshi-language` and `moshimoshi-user-language-{userId}`

### Key Files
```
src/i18n/
├── config.ts           # Language config, getTranslation() helper
├── I18nContext.tsx     # React Context provider, useI18n() hook
└── locales/
    ├── en/strings.ts   # 6,198 lines (100% - reference)
    ├── ja/strings.ts   # 4,317 lines (~70%)
    ├── de/strings.ts   # 4,103 lines (~66%)
    ├── es/strings.ts   # 4,150 lines (~67%)
    ├── fr/strings.ts   # 4,003 lines (~65%)
    └── it/strings.ts   # 4,126 lines (~67%)
```

### Known Issues
1. **30-35% missing translations** in non-English locales
2. **No server component support** - Can't use i18n in `generateMetadata()`
3. **No locale URL routing** - Single URL structure, language in localStorage only
4. **All metadata hardcoded in English** - 65+ pages with English-only SEO

---

## Migration Goals

### 1. Complete Translation Coverage
- Use AI (Claude API) to generate missing translations
- Manual review for quality assurance
- Target: 100% parity across all locales

### 2. Locale-Based URL Routing
- Pattern: `/en/dashboard`, `/ja/dashboard`, etc.
- Using `next-intl` library
- Middleware handles detection and redirects

### 3. Server-Side Metadata i18n
- Convert `export const metadata` → `generateMetadata()`
- SEO-optimized for all languages
- Keep client I18nContext for UI (minimal disruption)

---

## Migration Architecture

### After Migration Structure
```
src/
├── i18n.ts                    # next-intl configuration
├── middleware.ts              # Locale detection + routing
├── i18n/
│   ├── config.ts              # Keep existing config
│   ├── I18nContext.tsx        # Updated to sync with URL locale
│   ├── server.ts              # NEW: Server translation utilities
│   └── locales/               # Completed translations
│
└── app/
    ├── layout.tsx             # Minimal root layout
    ├── not-found.tsx          # Global 404
    └── [locale]/
        ├── layout.tsx         # Locale-aware layout with I18nProvider
        ├── page.tsx           # Landing page
        ├── dashboard/
        ├── learn/
        └── ...all routes
```

### Key Integration Points

#### Middleware (`src/middleware.ts`)
```typescript
// Locale detection priority:
// 1. URL path (/en/, /ja/)
// 2. Cookie (NEXT_LOCALE)
// 3. Accept-Language header
// 4. Default (en)
```

#### Server Translations (`src/i18n/server.ts`)
```typescript
// Usage in generateMetadata:
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations(locale);
  return { title: t('page.title') };
}
```

#### Client Context (`src/i18n/I18nContext.tsx`)
```typescript
// Updated to:
// - Read locale from URL params (useParams)
// - Keep localStorage as preference override
// - Language switcher navigates to new locale URL
```

---

## Backup & Rollback

- **Backup branch**: `backup/pre-i18n-migration`
- **Rollback**: `git checkout backup/pre-i18n-migration`

---

## Translation Key Structure

The translation files use nested objects with dot-notation access:

```typescript
// Example structure in strings.ts
export const strings = {
  landing: {
    hero: {
      headline: 'Master Japanese...',
      subheadline: '...',
    }
  },
  dashboard: {
    title: 'Dashboard',
    navigation: { ... }
  },
  conjugation: {
    title: 'Conjugation',
    description: '...',  // Added during bug fix
  }
}

// Usage
t('landing.hero.headline')
t('dashboard.title')
```

### Parameter Interpolation
```typescript
// Template: "Hello {{name}}, you have {{count}} items"
t('greeting', { name: 'John', count: 5 })
```

---

## Important Notes for AI Assistants

1. **Don't break existing functionality** - The current i18n system works for client components
2. **Preserve the `strings` object structure** - Many components access `strings.section.key` directly
3. **English is the reference** - All other locales should mirror English structure
4. **Fallback chain**: Missing key → English → Return key path as string
5. **The `t()` function** accepts either `Record<string, string|number>` for params or string (ignored) for legacy compatibility

---

## Testing Checklist

- [ ] All routes accessible with locale prefix (/en/, /ja/, etc.)
- [ ] Root URL (/) redirects to default locale
- [ ] Language switcher updates URL and content
- [ ] Page metadata in correct language (view-source check)
- [ ] Client-side navigation preserves locale
- [ ] Deep links work with locale prefixes
- [ ] 404 pages display correctly with locale
- [ ] Browser back/forward works across locales

---

## Related Documentation

- Plan file: `.claude/plans/snug-soaring-kahan.md`
- next-intl docs: https://next-intl-docs.vercel.app/
- Next.js i18n: https://nextjs.org/docs/app/building-your-application/routing/internationalization
