# Wave 6 — Agent 2: SEO & Discoverability

**Role:** spec-impl
**Depends on:** Waves 1-5 (all DONE)
**Parallel with:** Agent 1 (Backend Hardening), Agent 3 (UX Polish)

---

## Objective

Make DeckMarket fully discoverable by search engines. Follow the app's existing SEO patterns exactly: `generateLocalizedMetadata()` for page metadata, dynamic sitemap for published decks, `robots.txt` updates, structured data via JSON-LD, and i18n SEO strings for all 6 locales.

**IMPORTANT:** Read each reference file listed below before coding. The patterns must match exactly.

---

## Reference Files (READ these first)

1. `src/i18n/server.ts` — `generateLocalizedMetadata()` function (lines 97-141). This is the PRIMARY metadata helper. It generates title, description, canonical URL, hreflang alternates for all 6 locales, and OpenGraph locale.
2. `src/utils/seo.ts` — `generatePageMetadata()` for static pages, `siteConfig` constants, `structuredData` helpers
3. `src/app/sitemap.ts` — Main sitemap with static pages (38 entries × 6 locales). Pattern: `generateAlternates(path)` for hreflang.
4. `src/app/[locale]/blog/sitemap.ts` — Dynamic sitemap per locale for published blog posts. Uses `generateSitemaps()` + Firestore query. **Follow this exact pattern for DeckMarket.**
5. `src/lib/structured-data.ts` — Schema.org JSON-LD helpers: `learningResource()`, `breadcrumb()`, `article()`
6. `src/components/StructuredData.tsx` — Component that renders `<script type="application/ld+json">`
7. `public/robots.txt` — Current sitemap listings (main + blog × 6 locales + grammar × 6 locales)
8. `src/i18n/locales/en/strings.ts` — SEO strings at `seo:` key (starts at line ~7156). See pattern for title/description per page.
9. `src/app/[locale]/learn/grammar/[pointId]/page.tsx` — Best example of dynamic `generateMetadata()` with per-page title, description, keywords, OpenGraph, canonical + hreflang alternates.

---

## Task 1: Add SEO i18n Strings

**Files to modify:** All 6 locale files:
- `src/i18n/locales/en/strings.ts`
- `src/i18n/locales/ja/strings.ts`
- `src/i18n/locales/de/strings.ts`
- `src/i18n/locales/es/strings.ts`
- `src/i18n/locales/fr/strings.ts`
- `src/i18n/locales/it/strings.ts`

Add a `deckmarket` section inside the existing `seo` object. Place it alphabetically (between `drill` and `flashcards`, or wherever `deckmarket` fits alphabetically).

### English (master — all others translate from this):

```typescript
deckmarket: {
  list: {
    title: 'DeckMarket - Free Japanese Anki Decks | JLPT Study Decks',
    description: 'Browse and download free Japanese Anki decks for JLPT N5-N1 preparation. Vocabulary, kanji, grammar, and sentence decks. Import directly into your flashcard system.',
  },
  detail: {
    title: '{deckTitle} - Free Japanese Anki Deck | DeckMarket',
    description: 'Download {deckTitle} for Japanese study. {deckDescription}',
  },
},
```

### For other locales:

Translate the title and description naturally. Keep "DeckMarket", "Anki", and "JLPT N5-N1" in all languages (they're brand/standard terms). The `{deckTitle}` and `{deckDescription}` placeholders stay as-is (they're replaced at runtime).

**Example Japanese:**
```typescript
deckmarket: {
  list: {
    title: 'DeckMarket - 無料日本語Ankiデッキ | JLPT対策デッキ',
    description: 'JLPT N5-N1対策用の無料日本語Ankiデッキをダウンロード。語彙、漢字、文法、例文デッキ。フラッシュカードシステムに直接インポート。',
  },
  detail: {
    title: '{deckTitle} - 無料日本語Ankiデッキ | DeckMarket',
    description: '{deckTitle}をダウンロード。{deckDescription}',
  },
},
```

---

## Task 2: Add `generateMetadata` to Public DeckMarket Pages

### File 1: `src/app/[locale]/deckmarket/page.tsx` — Catalogue Page

This is a **client component** (`'use client'`). Client components CANNOT export `generateMetadata`. You need to create a **layout.tsx** that exports the metadata.

**Create:** `src/app/[locale]/deckmarket/layout.tsx`

```typescript
import type { Metadata } from 'next'
import { generateLocalizedMetadata } from '@/i18n/server'

type Props = {
  params: Promise<{ locale: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params

  const meta = await generateLocalizedMetadata({
    path: '/deckmarket',
    title: 'DeckMarket - Free Japanese Anki Decks | JLPT Study Decks',
    description: 'Browse and download free Japanese Anki decks for JLPT N5-N1 preparation. Vocabulary, kanji, grammar, and sentence decks.',
  })

  return {
    ...meta,
    keywords: [
      'Japanese Anki decks',
      'JLPT deck download',
      'free Japanese flashcards',
      'Anki import',
      'JLPT N5', 'JLPT N4', 'JLPT N3', 'JLPT N2', 'JLPT N1',
      'Japanese vocabulary deck',
      'kanji deck download',
      'Japanese study material',
      'Moshimoshi DeckMarket',
    ],
  }
}

export default function DeckMarketLayout({ children }: Props) {
  return children
}
```

**Note:** If the i18n SEO strings from Task 1 are available via `getTranslations()`, prefer using them:
```typescript
const { t } = await getTranslations(locale as Locale)
// then use t('seo.deckmarket.list.title') and t('seo.deckmarket.list.description')
```

Check how `src/app/[locale]/blog/layout.tsx` does it and follow that pattern.

### File 2: `src/app/[locale]/deckmarket/[deckId]/page.tsx` — Detail Page

This is also a **client component**. Create a layout for it too, OR convert the page to a server component with client sub-components. The cleanest approach is a layout.

**Create:** `src/app/[locale]/deckmarket/[deckId]/layout.tsx`

For the detail page, we need dynamic metadata per deck. Since layout.tsx doesn't have access to the deck data without fetching it, we have two options:

**Option A (Recommended): Create a separate metadata file**

Actually, the best pattern is to keep the page as a client component and use a `layout.tsx` with a generic fallback, OR restructure the page.

**Simplest approach:** Create a server-side `generateMetadata` by adding a **separate metadata-only route segment**. Since Next.js 15 allows `generateMetadata` in layout.tsx at any level:

```typescript
// src/app/[locale]/deckmarket/[deckId]/layout.tsx
import type { Metadata } from 'next'
import { locales, defaultLocale, type Locale } from '@/i18n/routing'

const baseUrl = 'https://moshimoshi.app'

type Props = {
  params: Promise<{ locale: string; deckId: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, deckId } = await params

  // Fetch deck data server-side for metadata
  let title = 'DeckMarket | Moshimoshi'
  let description = 'Download free Japanese Anki decks for JLPT preparation.'
  let jlpt = ''
  let tags: string[] = []

  try {
    // Use admin Firestore to fetch published deck data
    const { adminFirestore } = await import('@/lib/firebase/admin')
    if (adminFirestore) {
      const deckDoc = await adminFirestore.collection('deckmarket_decks').doc(deckId).get()
      if (deckDoc.exists) {
        const data = deckDoc.data()
        if (data?.isPublished) {
          title = `${data.title} - Free Japanese Anki Deck | DeckMarket`
          description = data.description
            ? `Download ${data.title} for Japanese study. ${data.description}`.slice(0, 160)
            : `Download ${data.title} - a free Japanese Anki deck from DeckMarket.`
          jlpt = data.jlpt || ''
          tags = data.tags || []
        }
      }
    }
  } catch {
    // Fallback to generic metadata on error
  }

  // Generate hreflang alternates
  const languages: Record<string, string> = {}
  for (const loc of locales) {
    languages[loc] = `${baseUrl}/${loc}/deckmarket/${deckId}`
  }
  languages['x-default'] = `${baseUrl}/${defaultLocale}/deckmarket/${deckId}`

  const keywords = [
    'Japanese Anki deck',
    'free Japanese flashcards',
    'JLPT study deck',
    ...(jlpt ? [`${jlpt} deck`, `JLPT ${jlpt}`] : []),
    ...tags.map(tag => `Japanese ${tag} deck`),
    'Moshimoshi DeckMarket',
  ]

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}/deckmarket/${deckId}`,
      siteName: 'Moshimoshi',
      type: 'article',
      locale: locale === 'ja' ? 'ja_JP' : locale === 'de' ? 'de_DE' : locale === 'es' ? 'es_ES' : locale === 'fr' ? 'fr_FR' : locale === 'it' ? 'it_IT' : 'en_US',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/${locale}/deckmarket/${deckId}`,
      languages,
    },
  }
}

export default function DeckDetailLayout({ children }: Props) {
  return children
}
```

**Important:** The Firestore import uses the Admin SDK which runs server-side. This is fine in `generateMetadata` (which runs on the server). The `adminFirestore` import should NOT be wrapped in dynamic import — it's already initialized. Check how `src/app/[locale]/blog/sitemap.ts` imports `adminDb` (line 2):

```typescript
import { adminDb } from '@/lib/firebase/admin'
```

Use whichever import pattern the blog sitemap uses. The export name might be `adminDb` or `adminFirestore` — check the file.

---

## Task 3: Dynamic Sitemap for Published Decks

**Create:** `src/app/[locale]/deckmarket/sitemap.ts`

Follow the blog sitemap pattern exactly (`src/app/[locale]/blog/sitemap.ts`).

```typescript
import { MetadataRoute } from 'next'
import { adminFirestore } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { locales, defaultLocale, type Locale } from '@/i18n/routing'
import { DECKMARKET_COLLECTION } from '@/types/deckmarket'

const baseUrl = 'https://moshimoshi.app'

function generateAlternates(path: string) {
  return {
    languages: {
      ...Object.fromEntries(
        locales.map(locale => [locale, `${baseUrl}/${locale}${path}`])
      ),
      'x-default': `${baseUrl}/${defaultLocale}${path}`
    }
  }
}

function createSitemapEntry(
  locale: Locale,
  path: string,
  lastModified: Date,
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
  priority: number
) {
  return {
    url: `${baseUrl}/${locale}${path}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: generateAlternates(path),
  }
}

/**
 * Generate sitemap index — one per locale.
 * Creates: /[locale]/deckmarket/sitemap/0.xml, /[locale]/deckmarket/sitemap/1.xml, etc.
 */
export async function generateSitemaps() {
  return locales.map((locale, index) => ({ id: index.toString() }))
}

/**
 * Generate DeckMarket sitemap for a specific locale.
 * Includes the catalogue page + all published deck detail pages.
 */
export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap> {
  const localeIndex = parseInt(id, 10)
  const locale: Locale = locales[localeIndex] || defaultLocale

  try {
    if (!adminFirestore) {
      console.warn('[DeckMarket Sitemap] adminFirestore not available')
      return [createSitemapEntry(locale, '/deckmarket', new Date(), 'weekly', 0.8)]
    }

    // Fetch all published decks
    const snapshot = await adminFirestore
      .collection(DECKMARKET_COLLECTION)
      .where('isPublished', '==', true)
      .get()

    const deckEntries: MetadataRoute.Sitemap = snapshot.docs.map((doc) => {
      const data = doc.data()
      const updatedAt = data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : new Date(data.updatedAt || Date.now())

      return createSitemapEntry(locale, `/deckmarket/${doc.id}`, updatedAt, 'weekly', 0.7)
    })

    // Catalogue page + all published deck pages
    return [
      createSitemapEntry(locale, '/deckmarket', new Date(), 'weekly', 0.8),
      ...deckEntries,
    ]
  } catch (error) {
    console.error('[DeckMarket Sitemap] Error:', error)
    return [createSitemapEntry(locale, '/deckmarket', new Date(), 'weekly', 0.8)]
  }
}
```

**Note on Firestore import:** The blog sitemap uses `import { adminDb } from '@/lib/firebase/admin'`. Check if `adminFirestore` or `adminDb` is the correct export name for the Firestore instance. Read `src/lib/firebase/admin.ts` to confirm. The DeckMarket routes use `adminFirestore`, so use that.

---

## Task 4: Add DeckMarket to Main Sitemap

**File:** `src/app/sitemap.ts`

Add `/deckmarket` to the `pages` array. Place it near `/flashcards` since they're related:

```typescript
{ path: '/deckmarket', priority: 0.8, changeFrequency: 'weekly' as const },
```

Insert it right after the `/flashcards` entry (line 18). Individual deck pages are handled by the dynamic sitemap from Task 3.

---

## Task 5: Update robots.txt

**File:** `public/robots.txt`

Add DeckMarket sitemap entries after the existing grammar sitemap lines (line 32). Follow the same pattern as blog/grammar — one per locale:

```
Sitemap: https://moshimoshi.app/en/deckmarket/sitemap.xml
Sitemap: https://moshimoshi.app/ja/deckmarket/sitemap.xml
Sitemap: https://moshimoshi.app/de/deckmarket/sitemap.xml
Sitemap: https://moshimoshi.app/es/deckmarket/sitemap.xml
Sitemap: https://moshimoshi.app/fr/deckmarket/sitemap.xml
Sitemap: https://moshimoshi.app/it/deckmarket/sitemap.xml
```

---

## Task 6: Structured Data on Deck Detail Page

**File:** `src/app/[locale]/deckmarket/[deckId]/page.tsx`

Add a `LearningResource` JSON-LD script to the deck detail page. Use the `StructuredData` component from `src/components/StructuredData.tsx`.

Since this is a client component, add the structured data as a `<script>` tag directly in the JSX, after the deck data is loaded:

```tsx
{deck && (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'LearningResource',
        name: deck.title,
        description: deck.description,
        url: `https://moshimoshi.app/deckmarket/${deck.id}`,
        educationalLevel: deck.jlpt ? [`JLPT ${deck.jlpt}`] : ['Beginner', 'Intermediate', 'Advanced'],
        teaches: ['Japanese Language'],
        inLanguage: [deck.language, 'en'],
        learningResourceType: 'Flashcard Deck',
        isAccessibleForFree: true,
        provider: {
          '@type': 'Organization',
          name: 'Moshimoshi',
          url: 'https://moshimoshi.app',
        },
      }),
    }}
  />
)}
```

Place this at the top of the return JSX, before the main content div.

---

## Task 7: Google Search Console Considerations

After deploying these changes, the following manual steps are needed in Google Search Console (document these in a comment at the top of the deckmarket sitemap file):

```typescript
/**
 * DeckMarket Sitemap
 *
 * After deploying, submit these sitemaps in Google Search Console:
 * - https://moshimoshi.app/en/deckmarket/sitemap.xml
 * - https://moshimoshi.app/ja/deckmarket/sitemap.xml
 * (+ de, es, fr, it variants)
 *
 * Also verify:
 * 1. robots.txt is accessible: https://moshimoshi.app/robots.txt
 * 2. Main sitemap includes /deckmarket: https://moshimoshi.app/sitemap.xml
 * 3. URL Inspection tool on a published deck page
 * 4. Rich Results Test on a deck detail page (check LearningResource schema)
 */
```

---

## Validation Checklist

- [ ] SEO strings added to all 6 locale files under `seo.deckmarket`
- [ ] `src/app/[locale]/deckmarket/layout.tsx` created with `generateMetadata`
- [ ] `src/app/[locale]/deckmarket/[deckId]/layout.tsx` created with dynamic `generateMetadata`
- [ ] `src/app/[locale]/deckmarket/sitemap.ts` created following blog sitemap pattern
- [ ] `/deckmarket` added to main sitemap `pages` array
- [ ] `robots.txt` updated with 6 DeckMarket sitemap entries
- [ ] Structured data JSON-LD added to deck detail page
- [ ] `generateMetadata` fetches deck data server-side (only published decks)
- [ ] hreflang alternates include all 6 locales + x-default
- [ ] Canonical URLs are locale-aware
- [ ] Build passes: `npm run build`
