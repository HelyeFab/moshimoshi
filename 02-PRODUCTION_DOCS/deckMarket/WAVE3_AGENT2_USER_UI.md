# Wave 3 — Agent 2: User UI Pages + Flashcards Link

**Role:** spec-impl
**Depends on:** Wave 2 (Public API routes) — all DONE
**Parallel with:** Agent 1 (Admin UI)

---

## Objective

Create 2 user-facing pages for browsing and downloading DeckMarket decks, plus add a link to DeckMarket inside the existing Flashcards page. These are NOT admin pages — they use the standard app layout pattern with Navbar.

---

## Files to Create

### File 1: `src/app/[locale]/deckmarket/page.tsx` — Catalogue Page

**URL:** `/deckmarket`
**Auth:** Logged-in only (check client-side)

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { JLPT_LEVELS } from '@/types/deckmarket'
import type { DeckListItem } from '@/types/deckmarket'
import { cn } from '@/lib/utils'
```

**Features:**

1. **Auth check:**

```typescript
const { user, loading: authLoading } = useAuth()
const router = useRouter()

// If not logged in after loading, show login prompt (don't redirect)
```

If no user after auth loading completes, show a centered message using `strings.deckmarket.deck.loginRequired` with a link to `/login`.

2. **State:**
   - `decks: DeckListItem[]`
   - `loading: boolean`
   - `search: string`
   - `jlptFilter: string` (empty string = all)
   - `page: number`
   - `total: number`

3. **Fetch decks:**

```typescript
const loadDecks = useCallback(async () => {
  setLoading(true)
  try {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('pageSize', '20')
    if (search) params.set('search', search)
    if (jlptFilter) params.set('jlpt', jlptFilter)

    const res = await fetch(`/api/deckmarket/decks?${params}`)
    if (!res.ok) throw new Error('Failed to fetch')
    const data = await res.json()
    setDecks(data.data.items)
    setTotal(data.data.total)
  } catch (error) {
    console.error('Failed to fetch decks:', error)
  } finally {
    setLoading(false)
  }
}, [page, search, jlptFilter])
```

Note: Public routes do NOT need `credentials: 'include'` — `getSession()` reads from cookies which are sent automatically. But including it is harmless if preferred.

4. **UI Layout:**

```
┌─────────────────────────────────────────────────┐
│ [Navbar]                                        │
├─────────────────────────────────────────────────┤
│ PageHeader: Deck Market                         │
│ Browse and download Anki decks                  │
├─────────────────────────────────────────────────┤
│ [Search decks...]                               │
│ [All] [N5] [N4] [N3] [N2] [N1]  ← JLPT pills  │
├─────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ Genki II │ │ Tobira   │ │ Kanji 1k │         │
│ │ N5 ● Ja  │ │ N3 ● Ja  │ │ N2 ● Ja  │         │
│ │ 42 dl    │ │ 15 dl    │ │ 127 dl   │         │
│ └──────────┘ └──────────┘ └──────────┘         │
│                                                 │
│ [< Prev]  Page 1 of 3  [Next >]                │
└─────────────────────────────────────────────────┘
│ [MobileNavSpacer]                               │
```

5. **Page shell (background gradient):**

```typescript
<div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
  <div className="hidden sm:block">
    <Navbar user={user} showUserMenu={true} />
  </div>

  <PageHeader
    title={strings.deckmarket.title}
    description={strings.deckmarket.subtitle}
    backHref="/flashcards"
  />

  <div className="container mx-auto px-4 py-8">
    {/* Search + filters + deck grid */}
  </div>

  <MobileNavSpacer />
</div>
```

6. **Search bar:**

```typescript
<input
  type="text"
  value={search}
  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
  placeholder={strings.deckmarket.search}
  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
/>
```

Use debounce (300ms) before triggering fetch.

7. **JLPT filter pills:**

```typescript
const jlptOptions = ['', ...JLPT_LEVELS] // '' = All

{jlptOptions.map((level) => (
  <button
    key={level}
    onClick={() => { setJlptFilter(level); setPage(1) }}
    className={cn(
      'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
      jlptFilter === level
        ? 'bg-primary-500 text-white'
        : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
    )}
  >
    {level || strings.deckmarket.filters.all}
  </button>
))}
```

8. **Deck card:**

```typescript
<Link
  href={`/deckmarket/${deck.id}`}
  className="block bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 hover:shadow-md transition-shadow overflow-hidden"
>
  {/* Placeholder banner (colored bar based on JLPT level) */}
  <div className={cn('h-2', jlptColor(deck.jlpt))} />

  <div className="p-4">
    <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">{deck.title}</h3>
    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{deck.description}</p>

    <div className="flex items-center gap-2 flex-wrap">
      {deck.jlpt && (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
          {deck.jlpt}
        </span>
      )}
      {deck.tags.slice(0, 3).map((tag) => (
        <span key={tag} className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400">
          {tag}
        </span>
      ))}
    </div>

    <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      <span>{deck.downloadCount} {strings.deckmarket.admin.downloads.toLowerCase()}</span>
      <span>{deck.language.toUpperCase()}</span>
    </div>
  </div>
</Link>
```

JLPT color helper:

```typescript
function jlptColor(jlpt: string | null): string {
  switch (jlpt) {
    case 'N5': return 'bg-green-400'
    case 'N4': return 'bg-blue-400'
    case 'N3': return 'bg-yellow-400'
    case 'N2': return 'bg-orange-400'
    case 'N1': return 'bg-red-400'
    default: return 'bg-gray-300 dark:bg-dark-600'
  }
}
```

9. **Deck grid layout:**

```typescript
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {decks.map((deck) => <DeckCard key={deck.id} deck={deck} />)}
</div>
```

10. **Pagination:**

Simple prev/next buttons. Show current page and total pages.

11. **Empty state:**

If no decks and not loading, show `strings.deckmarket.deck.noDecks` centered with a muted icon.

12. **Loading state:** Show skeleton cards or a centered spinner.

---

### File 2: `src/app/[locale]/deckmarket/[deckId]/page.tsx` — Deck Detail + Download

**URL:** `/deckmarket/:deckId`
**Auth:** Logged-in only

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import type { DeckMarketDeck, DeckMarketVersion } from '@/types/deckmarket'
import { cn } from '@/lib/utils'
```

**Data fetching:**

```typescript
const params = useParams()
const deckId = params.deckId as string

const [deck, setDeck] = useState<DeckMarketDeck | null>(null)
const [versions, setVersions] = useState<DeckMarketVersion[]>([])
const [latestVersion, setLatestVersion] = useState<DeckMarketVersion | null>(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
  const loadDeck = async () => {
    try {
      const res = await fetch(`/api/deckmarket/decks/${deckId}`)
      if (!res.ok) throw new Error('Not found')
      const data = await res.json()
      setDeck(data.data.deck)
      setVersions(data.data.versions)
      setLatestVersion(data.data.latestVersion)
    } catch {
      setDeck(null)
    } finally {
      setLoading(false)
    }
  }
  loadDeck()
}, [deckId])
```

**Download handler:**

```typescript
const [downloading, setDownloading] = useState(false)

const handleDownload = async (versionId?: string, format: 'apkg' | 'csv' = 'apkg') => {
  setDownloading(true)
  try {
    const url = versionId
      ? `/api/deckmarket/decks/${deckId}/versions/${versionId}/download?format=${format}`
      : `/api/deckmarket/decks/${deckId}/download?format=${format}`

    const res = await fetch(url)
    if (!res.ok) throw new Error('Download failed')
    const data = await res.json()

    // Trigger browser download via presigned URL
    const a = document.createElement('a')
    a.href = data.downloadUrl
    a.download = data.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (error) {
    console.error('Download error:', error)
  } finally {
    setDownloading(false)
  }
}
```

**UI Layout:**

```
┌─────────────────────────────────────────────────┐
│ [Navbar]                                        │
├─────────────────────────────────────────────────┤
│ PageHeader: Genki II - Lesson 2                 │
│ ← Back to Deck Market                          │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📘 Description text here...                    │
│                                                 │
│ JLPT: N5  │  Language: Japanese  │  42 downloads│
│ Tags: [Genki II] [Vocabulary] [Beginner]       │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Latest Version: v2 (12.5 MB)               │ │
│ │ Updated: Feb 9, 2026                       │ │
│ │           [  ⬇ Download Latest  ]          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ All Versions                                    │
│ ┌──────────────────────────────────────────┐   │
│ │ v2 │ 12.5 MB │ Feb 9 │ Fixed order │ [⬇] │   │
│ │ v1 │ 11.2 MB │ Feb 1 │ Initial     │ [⬇] │   │
│ └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
│ [MobileNavSpacer]                               │
```

**Page shell:** Same gradient background as catalogue page.

**Not found state:** If deck is null after loading, show `strings.deckmarket.deck.notFound`.

**Download buttons (Anki + CSV when available):**

```typescript
<button
  onClick={() => handleDownload(undefined, 'apkg')}
  disabled={downloading || !latestVersion}
  className={cn(
    'px-6 py-3 rounded-lg font-medium text-white transition-colors',
    downloading
      ? 'bg-gray-400 cursor-not-allowed'
      : 'bg-primary-500 hover:bg-primary-600'
  )}
>
  {downloading ? strings.deckmarket.deck.downloading : strings.deckmarket.deck.downloadLatest}
</button>

{latestVersion?.csvR2Key && (
  <button
    onClick={() => handleDownload(undefined, 'csv')}
    disabled={downloading || !latestVersion}
    className="px-6 py-3 rounded-lg font-medium border ..."
  >
    {downloading ? strings.deckmarket.deck.downloading : strings.deckmarket.deck.downloadCsv}
  </button>
)}
```

**Version list:**

Table or list showing all versions with: Label, Size (formatted), Date, Changelog, individual Download button.
If a version has `csvR2Key`, show a second **Download CSV** button using `?format=csv`.

**File size formatting:**

```typescript
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
```

**Date formatting:** Use `new Date(isoString).toLocaleDateString()` or similar. Keep simple.

---

### File 3 (MODIFY): `src/app/[locale]/flashcards/FlashcardsContent.tsx` — Add DeckMarket Link

Add a DeckMarket link/button visible to all logged-in users inside the Flashcards page. Place it near the top of the main content area (after the storage/migration banners, before the deck grid).

**What to add:**

A compact banner/card that links to `/deckmarket`:

```typescript
import { Store } from 'lucide-react'

{/* DeckMarket Link - visible to all logged-in users */}
{initialData.userId && (
  <Link
    href="/deckmarket"
    className="mb-6 flex items-center gap-3 p-4 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm transition-all group"
  >
    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
      <Store className="w-5 h-5 text-primary-600 dark:text-primary-400" />
    </div>
    <div>
      <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {strings.deckmarket.title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{strings.deckmarket.subtitle}</p>
    </div>
  </Link>
)}
```

**Where to place it:** Inside the `<div className="container mx-auto px-4 py-8">` section, AFTER the "Deck Limits Warning" / "starterOnly" banners (around line 2400) and BEFORE the Cloud Storage section. Look for the comment `{/* Cloud Storage & Sync Progress */}` and insert the DeckMarket link just before it.

**Required imports to add at the top of the file:**
- `import Link from 'next/link'` — check if already imported
- `import { Store } from 'lucide-react'` — add to existing lucide-react import line

**This is a MODIFY, not a create.** Use the Edit tool.

---

## Critical Patterns to Follow

### User page layout (NOT admin)

User pages use Navbar + PageHeader + MobileNavSpacer:

```typescript
<div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
  <div className="hidden sm:block">
    <Navbar user={user} showUserMenu={true} />
  </div>
  <PageHeader title="..." description="..." backHref="/flashcards" />
  <div className="container mx-auto px-4 py-8">
    {/* Content */}
  </div>
  <MobileNavSpacer />
</div>
```

### Auth via useAuth hook (NOT useAdmin)

```typescript
import { useAuth } from '@/hooks/useAuth'
const { user, loading: authLoading } = useAuth()
```

### i18n

```typescript
import { useI18n } from '@/i18n/I18nContext'
const { strings } = useI18n()
// strings.deckmarket.title
// strings.deckmarket.subtitle
// strings.deckmarket.search
// strings.deckmarket.deck.download
// etc.
```

### Dark mode (MANDATORY)

Same pairs as admin, always include `dark:` variants.

### cn() utility

```typescript
import { cn } from '@/lib/utils'
```

### Link component

```typescript
import Link from 'next/link'
```

---

## Reference Files (READ these before coding)

1. `src/app/[locale]/flashcards/FlashcardsContent.tsx` — The file to modify (line ~2262 for return statement, ~2400 for where to insert DeckMarket link)
2. `src/app/[locale]/flashcards/page.tsx` — Server component wrapper pattern (for reference)
3. `src/components/layout/Navbar.tsx` — Navbar component
4. `src/components/ui/PageHeader.tsx` — PageHeader props (title, description, backHref, actions)
5. `src/components/layout/MobileNavSpacer.tsx` — Bottom spacer for mobile nav
6. `src/hooks/useAuth.ts` — useAuth hook returns `{ user, loading }`
7. `src/i18n/locales/en/strings.ts` — Search for `deckmarket:` to see all available keys
8. `src/types/deckmarket.ts` — Types and constants

---

## Validation Checklist (Agent must verify before completion)

- [ ] 2 page files created at correct paths
- [ ] FlashcardsContent.tsx modified with DeckMarket link
- [ ] Catalogue page uses `useAuth()` (NOT `useAdmin()`)
- [ ] Catalogue page shows login prompt if not authenticated (not redirect)
- [ ] Catalogue page has search + JLPT filter pills
- [ ] Catalogue page has paginated deck grid
- [ ] Deck cards link to detail page
- [ ] Detail page fetches deck data from public API
- [ ] Detail page shows 404 message for unpublished/missing decks
- [ ] Download button triggers presigned URL download
- [ ] Download button shows "Downloading..." state
- [ ] Version list shows all versions with individual download buttons
- [ ] Both pages have gradient background
- [ ] Both pages use Navbar + PageHeader + MobileNavSpacer
- [ ] All UI elements have `dark:` variants
- [ ] i18n strings used from `strings.deckmarket.*`
- [ ] DeckMarket link in FlashcardsContent visible only to logged-in users
- [ ] No new auth patterns introduced
- [ ] Types imported from `@/types/deckmarket`
