# Internationalization (i18n) System

**Status:** ACTIVE
**Last Updated:** 2026-02-03

## Overview

Moshimoshi uses a **hybrid custom TypeScript + next-intl** internationalization system supporting 6 languages with path-based locale routing (`/{locale}/{page}`). The system provides client-side hooks, server-side utilities, automatic fallback to English, and cookie-based language persistence.

## Supported Languages

| Code | Language | Native Name |
|------|----------|-------------|
| `en` | English | English (default) |
| `ja` | Japanese | 日本語 |
| `de` | German | Deutsch |
| `es` | Spanish | Español |
| `fr` | French | Français |
| `it` | Italian | Italiano |

## Quick Start

### Using Translations in Client Components

```typescript
import { useTranslation, useLocalePath } from '@/i18n/I18nContext'

export default function MyComponent() {
  const { t, strings, language } = useTranslation()
  const { getLocalePath } = useLocalePath()

  return (
    <div>
      <h1>{strings.dashboard.title}</h1>
      <p>{t('review.stats.overdue', { count: 5 })}</p>
      <a href={getLocalePath('/settings')}>Settings</a>
    </div>
  )
}
```

### Using Translations in Server Components

```typescript
import { getTranslations } from '@/i18n/server'

export default async function Page() {
  const { t, strings, locale } = await getTranslations()

  return <h1>{t('dashboard.title')}</h1>
}
```

### Switching Languages

```typescript
import { useI18n } from '@/i18n/I18nContext'

export default function LanguageSelector() {
  const { language, setLanguage } = useI18n()

  return (
    <button onClick={() => setLanguage('ja')}>
      Switch to Japanese
    </button>
  )
}
```

## Architecture

```
src/i18n/
├── config.ts              # Language definitions, translation function
├── I18nContext.tsx        # React context provider & hooks
├── routing.ts             # next-intl routing configuration
├── server.ts              # Server-side translation utilities
└── locales/
    ├── en/strings.ts      # English translations (7,817 lines)
    ├── ja/strings.ts      # Japanese translations
    ├── de/strings.ts      # German translations
    ├── es/strings.ts      # Spanish translations
    ├── fr/strings.ts      # French translations
    └── it/strings.ts      # Italian translations
```

### Key Concepts

1. **Path-based Routing**: All URLs prefixed with locale (`/en/dashboard`, `/ja/dashboard`)
2. **Automatic Fallback**: Missing keys fall back to English automatically
3. **Parameter Interpolation**: Use `{{paramName}}` syntax in translations
4. **Cookie Persistence**: `NEXT_LOCALE` cookie preserves user preference
5. **57 Namespaces**: Organized translation categories for all app features

## Documentation

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | This file - overview and quick start |
| [FEATURE_GUIDE.md](./FEATURE_GUIDE.md) | Complete implementation guide with all patterns |

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/i18n/config.ts:8-10` | Language type definitions | 72 |
| `src/i18n/I18nContext.tsx:1` | React context & hooks | 214 |
| `src/i18n/routing.ts:35-57` | next-intl routing config | 68 |
| `src/i18n/server.ts:38-58` | Server-side utilities | 168 |
| `src/middleware.ts:46-52` | Locale extraction & routing | 346 |
| `src/app/[locale]/layout.tsx:69` | I18nProvider setup | 102 |
| `src/components/ui/LanguageSelector.tsx:1` | Language switching UI | 75 |

## Related Systems

- **Middleware**: `src/middleware.ts` handles locale routing and detection
- **Provider Setup**: `I18nProvider` wraps app in `[locale]/layout.tsx`
- **SEO**: OpenGraph locale mapping and hreflang generation in `server.ts`

## Essential Reading For

- Adding new translation keys
- Creating locale-aware components
- Understanding routing with locales
- Implementing server-side translations
- Adding support for new languages
