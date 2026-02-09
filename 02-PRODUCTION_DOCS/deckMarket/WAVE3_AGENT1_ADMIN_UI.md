# Wave 3 — Agent 1: Admin UI Pages + Sidebar Entry

**Role:** spec-impl
**Depends on:** Wave 2 (Admin API routes) — all DONE
**Parallel with:** Agent 2 (User UI)

---

## Objective

Create 3 admin pages for managing DeckMarket decks, plus add a sidebar entry. All pages follow the existing admin page pattern: `'use client'`, `useAdmin()` hook, `credentials: 'include'` on all fetch calls, dark mode support.

---

## Files to Create

### File 1: `src/app/[locale]/admin/deckmarket/page.tsx` — Dashboard

**URL:** `/admin/deckmarket`
**Pattern:** Copy the structure from `src/app/[locale]/admin/resources/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/hooks/useAdmin'
import { useI18n } from '@/i18n/I18nContext'
import Link from 'next/link'
import type { DeckListItem } from '@/types/deckmarket'
```

**Features:**

1. **Admin guard:**

```typescript
const { isAdmin, isLoading: adminLoading } = useAdmin()
const { strings } = useI18n()

useEffect(() => {
  if (!adminLoading && !isAdmin) {
    router.push('/')
  }
}, [isAdmin, adminLoading, router])
```

2. **State:**
   - `decks: DeckListItem[]`
   - `loading: boolean`
   - `searchQuery: string`
   - `publishFilter: 'all' | 'published' | 'draft'`

3. **Fetch decks:**

```typescript
const loadDecks = async () => {
  setLoading(true)
  try {
    const params = new URLSearchParams()
    if (publishFilter !== 'all') {
      params.set('published', publishFilter === 'published' ? 'true' : 'false')
    }
    const res = await fetch(`/api/admin/deckmarket/decks?${params}`, {
      credentials: 'include',
    })
    const data = await res.json()
    setDecks(data.data || [])
  } catch (error) {
    console.error('Failed to fetch decks:', error)
  } finally {
    setLoading(false)
  }
}
```

4. **Publish toggle** (inline, per row):

```typescript
const handleTogglePublish = async (deckId: string, isPublished: boolean) => {
  await fetch(`/api/admin/deckmarket/decks/${deckId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPublished: !isPublished }),
  })
  loadDecks()
}
```

5. **UI Layout:**

```
┌─────────────────────────────────────────────────┐
│ DeckMarket Admin                 [Create Deck]  │
├─────────────────────────────────────────────────┤
│ [Search...]  [All | Published | Draft]          │
├─────────────────────────────────────────────────┤
│ Title     │ JLPT │ Downloads │ Status  │ Action │
│ Genki II  │ N5   │ 42        │ ✅ Pub  │ [Edit] │
│ Tobira    │ N3   │ 0         │ 📝 Draft│ [Edit] │
└─────────────────────────────────────────────────┘
```

- Header: `strings.deckmarket.admin.title` + Link to `/admin/deckmarket/new`
- Search input: filter by title (client-side from fetched list)
- Filter tabs: All / Published / Draft
- Table with columns: Title, JLPT, Language, Downloads, Status (Published/Draft badge), Actions (Edit link)
- Publish/unpublish toggle button per row
- Edit link navigates to `/admin/deckmarket/${deckId}`
- Empty state: "No decks yet" with create button

6. **Dark mode classes (mandatory):**

```
bg-white dark:bg-dark-800
text-gray-900 dark:text-white
border-gray-200 dark:border-dark-700
hover:bg-gray-50 dark:hover:bg-dark-750
```

7. **Loading state:** Spinner matching existing admin patterns.

---

### File 2: `src/app/[locale]/admin/deckmarket/new/page.tsx` — Create Deck

**URL:** `/admin/deckmarket/new`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/hooks/useAdmin'
import { useI18n } from '@/i18n/I18nContext'
import { JLPT_LEVELS, DECK_LANGUAGES } from '@/types/deckmarket'
```

**Form fields:**

| Field | Type | i18n Key | Notes |
|-------|------|----------|-------|
| Title | text input | `strings.deckmarket.deck.title` (or inline label) | Required |
| Slug (ID) | text input | `strings.deckmarket.admin.slug` | Auto-generated from title, editable. Show helper text: `strings.deckmarket.admin.slugHelp` |
| Description | textarea | `strings.deckmarket.admin.description` | Optional |
| Tags | text input | `strings.deckmarket.admin.tags` | Comma-separated |
| JLPT Level | select dropdown | `strings.deckmarket.admin.jlpt` | Options: None, N5, N4, N3, N2, N1. Use `JLPT_LEVELS` constant. |
| Language | select dropdown | `strings.deckmarket.admin.language` | Options from `DECK_LANGUAGES`. Default: "ja" |
| Import Source | toggle / tabs | `strings.deckmarket.admin.importSource` | Choose **Anki .apkg** or **CSV** |
| Import File | file input | `strings.deckmarket.admin.selectApkgFile` / `selectCsvFile` | `.apkg` (upload) or `.csv` (server-side conversion) |
| Version Label | text input | `strings.deckmarket.admin.versionLabel` | Optional |
| Changelog | text input | `strings.deckmarket.admin.changelog` | Optional |

**Slug auto-generation:**

```typescript
const generateSlug = (title: string) =>
  title.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
```

When user types in Title, auto-update slug (unless user has manually edited slug).

**Submit handler:**

```typescript
const handleSubmit = async () => {
  setSaving(true)
  try {
    const res = await fetch('/api/admin/deckmarket/decks', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: slug,
        title,
        description,
        language,
        jlpt: jlpt || null,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error)

    // If file selected:
    // - apkg: POST /upload (presigned URL) then PUT upload
    // - csv: POST /import-csv (multipart form)
    router.push(`/admin/deckmarket/${data.data.id}`)
  } catch (error) {
    setError(error.message)
  } finally {
    setSaving(false)
  }
}
```

**UI:** Simple form card with Save button. On success, redirect to edit page. On error, show error in red banner.

**Back link:** Link back to `/admin/deckmarket`

---

### File 3: `src/app/[locale]/admin/deckmarket/[deckId]/page.tsx` — Edit Deck + Upload Versions

**URL:** `/admin/deckmarket/:deckId`

This is the most complex page. It has 3 sections:

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAdmin } from '@/hooks/useAdmin'
import { useI18n } from '@/i18n/I18nContext'
import Modal from '@/components/ui/Modal'
import { JLPT_LEVELS, DECK_LANGUAGES, MAX_APKG_SIZE_BYTES, ALLOWED_EXTENSIONS } from '@/types/deckmarket'
import type { DeckMarketDeck, DeckMarketVersion } from '@/types/deckmarket'
```

**Section A: Metadata Editor**

- Same fields as create form (title, description, tags, JLPT, language)
- Plus publish toggle (checkbox or switch)
- "Save" button calls `PATCH /api/admin/deckmarket/decks/${deckId}`
- Show success toast/message on save

**Section B: Upload New Version**

This is the critical section. Follow the presigned URL upload flow.

```
┌─────────────────────────────────────────────────┐
│ Upload New Version                              │
│                                                 │
│ [Select .apkg file]  filename.apkg (12.5 MB)   │
│ Version Label: [v2          ]                   │
│ Changelog:     [Fixed card order...         ]   │
│                                                 │
│ [Upload]                                        │
│ ████████████░░░░ 75% uploading...               │
└─────────────────────────────────────────────────┘
```

**Upload flow (IMPORTANT — follow exactly):**

1. User selects `.apkg` file via `<input type="file" accept=".apkg">`
2. Client validates:
   - Extension is `.apkg`
   - Size <= 200MB (`MAX_APKG_SIZE_BYTES`)
3. User fills version label + changelog (optional)
4. On "Upload" click:

```typescript
// Step 1: Get presigned URL from backend
const metaRes = await fetch(`/api/admin/deckmarket/decks/${deckId}/upload`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filename: file.name,
    fileSize: file.size,
    versionLabel,
    changelog,
  }),
})
const { uploadUrl, versionId } = await metaRes.json()

// Step 2: Upload file directly to R2 via presigned URL
const uploadRes = await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': 'application/octet-stream' },
})

if (!uploadRes.ok) throw new Error('Upload failed')
```

5. Show upload progress using `XMLHttpRequest` with `upload.onprogress` (fetch doesn't support progress). Example:

```typescript
const xhr = new XMLHttpRequest()
xhr.upload.onprogress = (e) => {
  if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
}
xhr.open('PUT', uploadUrl)
xhr.setRequestHeader('Content-Type', 'application/octet-stream')
xhr.onload = () => { /* handle success */ }
xhr.onerror = () => { /* handle error */ }
xhr.send(file)
```

6. On success: show success message, reload versions list

**Section C: Versions List**

- Table showing all versions: Label, Size (formatted), Date, Changelog
- Delete button per version (with confirmation modal using `Modal` component)
- Delete calls `DELETE /api/admin/deckmarket/decks/${deckId}/versions/${versionId}`

**Delete confirmation:**

```typescript
<Modal
  isOpen={deleteConfirm.isOpen}
  onClose={() => setDeleteConfirm({ isOpen: false, versionId: '' })}
  title={strings.deckmarket.admin.deleteVersion}
>
  <p>{strings.deckmarket.admin.confirmDelete}</p>
  <div className="flex justify-end gap-2 mt-4">
    <button onClick={handleCancelDelete}>Cancel</button>
    <button onClick={handleConfirmDelete} className="bg-red-500 text-white ...">Delete</button>
  </div>
</Modal>
```

**Data fetching:**

```typescript
const loadDeck = async () => {
  const res = await fetch(`/api/admin/deckmarket/decks/${deckId}`, {
    credentials: 'include',
  })
  const data = await res.json()
  // data.data = { deck, versions, latestVersion }
}
```

---

### File 4 (MODIFY): `src/app/[locale]/admin/AdminLayoutClient.tsx` — Sidebar Entry

Add DeckMarket to the `navItems` array. Insert it near the content management items.

**Exact edit:** Find the `navItems` array and add:

```typescript
{ href: '/admin/deckmarket', label: 'DeckMarket', icon: '🃏' },
```

Insert it after the `{ href: '/admin/resources', label: 'Resources', icon: '📚' }` entry (around line 111).

**This is a MODIFY, not a create.** Use the Edit tool to add one line to the existing array.

---

## Critical Patterns to Follow

### Admin page boilerplate

Every admin page MUST have:

```typescript
'use client'

import { useAdmin } from '@/hooks/useAdmin'
import { useI18n } from '@/i18n/I18nContext'

export default function AdminXxxPage() {
  const { isAdmin, isLoading: adminLoading } = useAdmin()
  const { strings } = useI18n()
  const router = useRouter()

  useEffect(() => {
    if (!adminLoading && !isAdmin) router.push('/')
  }, [isAdmin, adminLoading, router])

  if (adminLoading) return <LoadingSpinner />
  if (!isAdmin) return null
  // ...
}
```

### Fetch with credentials

ALL admin fetch calls MUST include `credentials: 'include'`:

```typescript
fetch('/api/admin/deckmarket/decks', { credentials: 'include' })
```

### i18n strings

Access via `strings.deckmarket.admin.*` and `strings.deckmarket.deck.*`:

```typescript
const { strings } = useI18n()
// strings.deckmarket.admin.title → "DeckMarket Admin"
// strings.deckmarket.admin.createDeck → "Create Deck"
// strings.deckmarket.deck.noDecks → "No decks available yet"
```

### Dark mode (MANDATORY)

Every UI element must have `dark:` variant. Common pairs:

```
bg-white dark:bg-dark-800
bg-gray-50 dark:bg-dark-850
text-gray-900 dark:text-white
text-gray-600 dark:text-gray-400
border-gray-200 dark:border-dark-700
hover:bg-gray-50 dark:hover:bg-dark-750
```

For primary-colored elements:

```
bg-primary-500 hover:bg-primary-600
text-primary-600 dark:text-primary-400
```

### File size formatting helper

```typescript
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
```

### Modal component import

```typescript
import Modal from '@/components/ui/Modal'
```

Modal props: `isOpen`, `onClose`, `title`, `children`

### useParams for route params

```typescript
const params = useParams()
const deckId = params.deckId as string
```

---

## Reference Files (READ these before coding)

1. `src/app/[locale]/admin/resources/page.tsx` — Admin list page pattern (fetch with credentials, useAdmin, table layout)
2. `src/app/[locale]/admin/AdminLayoutClient.tsx` — Sidebar navItems array (line ~105-130)
3. `src/components/ui/Modal.tsx` — Modal component props
4. `src/types/deckmarket.ts` — Types + constants (JLPT_LEVELS, DECK_LANGUAGES, MAX_APKG_SIZE_BYTES, ALLOWED_EXTENSIONS)
5. `src/i18n/locales/en/strings.ts` — Search for `deckmarket:` to see all available i18n keys
6. `02-PRODUCTION_DOCS/deckMarket/deckmarket_template.csv` — CSV import template

---

## Validation Checklist (Agent must verify before completion)

- [ ] All 3 pages created at correct paths
- [ ] Sidebar entry added to AdminLayoutClient.tsx navItems array
- [ ] All pages have `'use client'` directive
- [ ] All pages use `useAdmin()` hook with redirect guard
- [ ] All pages use `useI18n()` for strings
- [ ] All fetch calls include `credentials: 'include'`
- [ ] All UI elements have `dark:` variants
- [ ] Upload flow uses 2-step pattern (get presigned URL, then PUT to R2)
- [ ] Upload validates `.apkg` extension and 200MB size limit client-side
- [ ] Create page supports CSV import and posts to `/import-csv`
- [ ] Delete version has confirmation modal
- [ ] Edit page loads deck data on mount
- [ ] Create page auto-generates slug from title
- [ ] No new auth patterns introduced
- [ ] Types imported from `@/types/deckmarket`
