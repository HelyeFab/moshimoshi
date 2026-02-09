# Wave 6 — Agent 3: UX Polish

**Role:** spec-impl
**Depends on:** Waves 1-5 (all DONE)
**Parallel with:** Agent 1 (Backend Hardening), Agent 2 (SEO)

---

## Objective

Add error boundaries, loading states, accessibility improvements, and download error UX to the DeckMarket pages. These are all frontend-only changes — no API modifications.

---

## Task 1: Error Boundaries (error.tsx)

Create `error.tsx` files for DeckMarket route groups. These catch React rendering errors and show a user-friendly fallback instead of a white screen.

### Check for existing patterns first

Read any existing `error.tsx` in the app to follow the same pattern:
- `src/app/[locale]/error.tsx` (if it exists)
- Or any other `error.tsx` in the app

If no existing pattern, use this:

### File 1: `src/app/[locale]/deckmarket/error.tsx`

```tsx
'use client'

export default function DeckMarketError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Something went wrong
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Failed to load the deck catalogue. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
```

### File 2: `src/app/[locale]/admin/deckmarket/error.tsx`

Same pattern but with admin-appropriate messaging:

```tsx
'use client'

export default function AdminDeckMarketError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Something went wrong
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
```

---

## Task 2: Loading States (loading.tsx)

Create `loading.tsx` files that show while the page component is loading. These leverage React Suspense.

### File 1: `src/app/[locale]/deckmarket/loading.tsx`

```tsx
export default function DeckMarketLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
        <div className="h-4 w-72 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
      </div>

      {/* Search bar skeleton */}
      <div className="h-10 w-full bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />

      {/* Filter pills skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-14 bg-gray-200 dark:bg-dark-700 rounded-full animate-pulse" />
        ))}
      </div>

      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 p-4 space-y-3">
            <div className="h-5 w-3/4 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-6 w-10 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
              <div className="h-6 w-16 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### File 2: `src/app/[locale]/admin/deckmarket/loading.tsx`

```tsx
export default function AdminDeckMarketLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />
      </div>

      {/* Search + filters skeleton */}
      <div className="flex gap-4">
        <div className="h-10 flex-1 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />
        <div className="h-10 w-32 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-dark-700 last:border-0">
            <div className="h-5 flex-1 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
            <div className="h-5 w-16 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
            <div className="h-8 w-20 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Task 3: Accessibility Improvements

### File 1: `src/app/[locale]/deckmarket/page.tsx` — Public Catalogue

Read the file first, then apply these changes:

**a) Search input — add aria-label:**

Find the search `<input>` element and add an `aria-label`:

```tsx
<input
  // ... existing props
  aria-label="Search decks by title or description"
  role="searchbox"
/>
```

**b) JLPT filter buttons — add aria-pressed:**

Find the JLPT filter buttons (the row of N5/N4/N3/N2/N1/All pills). Each button should have:

```tsx
<button
  // ... existing props
  aria-pressed={jlptFilter === level}
  aria-label={level ? `Filter by JLPT ${level}` : 'Show all JLPT levels'}
>
```

**c) Results region — add aria-live:**

Wrap the results grid in a region that announces changes to screen readers:

```tsx
<div role="region" aria-label="Deck search results" aria-live="polite">
  {/* existing grid content */}
</div>
```

**d) Pagination — add aria-current and aria-label:**

On the current page button, add `aria-current="page"`. On prev/next buttons, add `aria-label`:

```tsx
<button aria-label="Previous page" disabled={page === 1}>
  {/* ... */}
</button>
<button aria-current="page" aria-label={`Page ${page}`}>
  {page}
</button>
<button aria-label="Next page">
  {/* ... */}
</button>
```

### File 2: `src/app/[locale]/deckmarket/[deckId]/page.tsx` — Detail Page

**a) Download button — add aria-label:**

```tsx
<button
  // ... existing props
  aria-label={`Download ${deck.title} Anki deck`}
>
```

**b) Version download buttons — add aria-label:**

For per-version download buttons in the versions list:

```tsx
<button
  // ... existing props
  aria-label={`Download version ${version.versionLabel}`}
>
```

**c) Back link — add aria-label:**

```tsx
<a href="/deckmarket" aria-label="Back to DeckMarket catalogue">
```

---

## Task 4: Download Error UX

### File: `src/app/[locale]/deckmarket/[deckId]/page.tsx`

Currently, download errors are caught and `console.error`'d silently. The user sees nothing. Add a visible error banner.

**Step 1:** Find or add a `downloadError` state:

```tsx
const [downloadError, setDownloadError] = useState<string | null>(null)
```

**Step 2:** In the download handler's catch block, set the error:

```tsx
} catch (err) {
  console.error('Download error:', err)
  setDownloadError('Failed to start download. Please try again.')
}
```

**Step 3:** Clear the error when starting a new download:

```tsx
const handleDownload = async () => {
  setDownloadError(null)
  // ... existing download logic
}
```

**Step 4:** Render the error banner above the download button:

```tsx
{downloadError && (
  <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded-lg text-sm">
    {downloadError}
  </div>
)}
```

Follow the same error banner pattern used in the admin pages (e.g., `src/app/[locale]/admin/deckmarket/new/page.tsx` lines 224-228).

**Also apply to per-version downloads** if there's a separate handler for those.

---

## Validation Checklist

- [ ] `src/app/[locale]/deckmarket/error.tsx` created
- [ ] `src/app/[locale]/admin/deckmarket/error.tsx` created
- [ ] `src/app/[locale]/deckmarket/loading.tsx` created with skeleton UI
- [ ] `src/app/[locale]/admin/deckmarket/loading.tsx` created with skeleton UI
- [ ] Search input has `aria-label` and `role="searchbox"`
- [ ] JLPT filter buttons have `aria-pressed` and `aria-label`
- [ ] Results grid wrapped with `aria-live="polite"`
- [ ] Pagination buttons have `aria-current` and `aria-label`
- [ ] Download buttons have descriptive `aria-label`
- [ ] Download error state added with visible banner
- [ ] Per-version download error handled with visible feedback
- [ ] All files use correct dark mode classes (`dark:bg-dark-*`, `dark:text-*`)
- [ ] Build passes: `npm run build`
