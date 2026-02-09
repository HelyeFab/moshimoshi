# DeckMarket MVP — Implementation Tasks

**Status:** IN PROGRESS
**Last Updated:** 2026-02-09
**Tech Lead:** Senior Agent

---

## Wave 1 — Foundation (Parallel)

### Task 1.1: TypeScript Interfaces
**Agent:** spec-impl
**File:** `src/types/deckmarket.ts`
**Status:** PENDING

Create all TypeScript interfaces for:
- `DeckMarketDeck` — Firestore deck document shape
- `DeckMarketVersion` — Firestore version subdocument shape
- `CreateDeckRequest` / `UpdateDeckRequest` — admin API request bodies
- `UploadVersionRequest` / `UploadVersionResponse` — upload flow types
- `DeckListResponse` / `DeckDetailResponse` — API response shapes
- `DeckDownloadResponse` — presigned URL response
- Constants: JLPT levels, languages, max file size, allowed extensions

### Task 1.2: i18n Strings (All 6 Locales)
**Agent:** spec-impl
**Status:** PENDING

Add `deckmarket` namespace to:
- `src/i18n/locales/en/strings.ts` (English — master)
- `src/i18n/locales/ja/strings.ts` (Japanese)
- `src/i18n/locales/de/strings.ts` (German)
- `src/i18n/locales/es/strings.ts` (Spanish)
- `src/i18n/locales/fr/strings.ts` (French)
- `src/i18n/locales/it/strings.ts` (Italian)

Keys defined in DECKMARKET.md section 8.

### Task 1.3: Firestore Security Rules
**Agent:** spec-impl
**Status:** PENDING

Update `firestore.rules` to add:
- `deckmarket_decks` collection: read for any authenticated user, write for admin only
- `deckmarket_decks/{deckId}/versions` subcollection: same rules

---

## Wave 2 — Backend API (Parallel)

### Task 2.1: Admin API Routes
**Agent:** spec-impl
**Depends on:** Task 1.1 (types)
**Status:** PENDING

Files to create:
- `src/app/api/admin/deckmarket/decks/route.ts` — GET (list all), POST (create)
- `src/app/api/admin/deckmarket/decks/[deckId]/route.ts` — GET (detail), PATCH (update)
- `src/app/api/admin/deckmarket/decks/[deckId]/upload/route.ts` — POST (presigned upload URL)
- `src/app/api/admin/deckmarket/decks/[deckId]/import-csv/route.ts` — POST (CSV → .apkg conversion + upload)
- `src/app/api/admin/deckmarket/decks/[deckId]/versions/[versionId]/route.ts` — DELETE (remove version)

All routes use `withAdminAuth`. Follow patterns from existing admin API routes.

### Task 2.2: Public API Routes
**Agent:** spec-impl
**Depends on:** Task 1.1 (types)
**Status:** PENDING

Files to create:
- `src/app/api/deckmarket/decks/route.ts` — GET (list published, paginated)
- `src/app/api/deckmarket/decks/[deckId]/route.ts` — GET (deck detail + versions)
- `src/app/api/deckmarket/decks/[deckId]/download/route.ts` — GET (presigned download URL + stats increment)
- `src/app/api/deckmarket/decks/[deckId]/versions/[versionId]/download/route.ts` — GET (specific version download)

All routes use `getSession()`. Only return `isPublished: true` decks.

---

## Wave 3 — Frontend UI (Parallel)

### Task 3.1: Admin UI Pages
**Agent:** spec-impl
**Depends on:** Task 2.1 (admin API)
**Status:** PENDING

Files to create:
- `src/app/[locale]/admin/deckmarket/page.tsx` — Dashboard (list all, publish toggle, search)
- `src/app/[locale]/admin/deckmarket/new/page.tsx` — Create deck form
- `src/app/[locale]/admin/deckmarket/[deckId]/page.tsx` — Edit deck + upload versions + versions list

Also: Add DeckMarket entry to admin sidebar in `AdminLayoutClient.tsx`.

Notes:
- Create page supports two import pipelines: `.apkg` upload or CSV import.
- CSV template file: `02-PRODUCTION_DOCS/deckMarket/deckmarket_template.csv`

### Task 3.2: User UI Pages + Flashcards Link
**Agent:** spec-impl
**Depends on:** Task 2.2 (public API)
**Status:** PENDING

Files to create:
- `src/app/[locale]/deckmarket/page.tsx` — Catalogue (list published, search, JLPT filter)
- `src/app/[locale]/deckmarket/[deckId]/page.tsx` — Deck detail + download button

Also: Add DeckMarket link/button inside the Flashcards page (`src/app/[locale]/flashcards/FlashcardsContent.tsx` or similar).

---

## Wave 4 — Integration

### Task 4.1: Build Verification
**Agent:** Bash
**Depends on:** All above
**Status:** DONE

- Run `npm run build` to verify no TypeScript errors — **PASSED (zero errors)**
- All 14 DeckMarket routes compiled successfully
- No missing imports or broken references

### Task 4.2: Review & Fix
**Agent:** Tech Lead (me)
**Depends on:** Task 4.1
**Status:** DONE

- Reviewed all code against DECKMARKET.md spec — **PASSED**
- Auth patterns verified (getSession for public, withAdminAuth for admin)
- R2 patterns verified (getR2Config, presigned upload/download URLs)
- Dark mode verified on all pages
- i18n strings used correctly throughout
- Security verified (isPublished guard, filename sanitization, isValidDeckKey)
- CSV import pipeline verified end-to-end

---

## Wave 5 — Tests (Parallel)

### Task 5.1: Admin API Route Tests
**Agent:** spec-impl
**Depends on:** Wave 4 (review passed)
**Status:** DONE
**Prompt:** `WAVE5_AGENT1_ADMIN_API_TESTS.md`

5 test files for admin API routes:
- `src/app/api/admin/deckmarket/decks/__tests__/route.test.ts` — GET + POST
- `src/app/api/admin/deckmarket/decks/[deckId]/__tests__/route.test.ts` — GET + PATCH
- `src/app/api/admin/deckmarket/decks/[deckId]/upload/__tests__/route.test.ts` — POST (presigned upload)
- `src/app/api/admin/deckmarket/decks/[deckId]/import-csv/__tests__/route.test.ts` — POST (CSV import)
- `src/app/api/admin/deckmarket/decks/[deckId]/versions/[versionId]/__tests__/route.test.ts` — DELETE

### Task 5.2: Public API Route Tests
**Agent:** spec-impl
**Depends on:** Wave 4 (review passed)
**Status:** DONE
**Prompt:** `WAVE5_AGENT2_PUBLIC_API_TESTS.md`

4 test files for public API routes:
- `src/app/api/deckmarket/decks/__tests__/route.test.ts` — GET (list published)
- `src/app/api/deckmarket/decks/[deckId]/__tests__/route.test.ts` — GET (detail)
- `src/app/api/deckmarket/decks/[deckId]/download/__tests__/route.test.ts` — GET (download latest)
- `src/app/api/deckmarket/decks/[deckId]/versions/[versionId]/download/__tests__/route.test.ts` — GET (download specific version)

---

## Wave 6 — Production Hardening (Parallel, 3 Agents)

### Task 6.1: Backend Hardening
**Agent:** spec-impl
**Depends on:** Wave 5
**Status:** PENDING
**Prompt:** `WAVE6_AGENT1_BACKEND_HARDENING.md`

- Firestore composite indexes (4 indexes for public queries)
- Rate limiting on download routes (Upstash Redis, existing pattern)
- Input validation string length limits (title, description, tags, changelog)
- Firestore security rules tightened (isPublished guard on reads)

### Task 6.2: SEO & Discoverability
**Agent:** spec-impl
**Depends on:** Wave 5
**Status:** PENDING
**Prompt:** `WAVE6_AGENT2_SEO.md`

- SEO i18n strings for all 6 locales (seo.deckmarket.list, seo.deckmarket.detail)
- generateMetadata on public pages (layout.tsx with generateLocalizedMetadata)
- Dynamic sitemap for published decks (per-locale, like blog sitemap)
- Main sitemap updated with /deckmarket entry
- robots.txt updated with 6 deckmarket sitemap URLs
- Structured data (LearningResource JSON-LD on deck detail)
- Google Search Console submission notes

### Task 6.3: UX Polish
**Agent:** spec-impl
**Depends on:** Wave 5
**Status:** PENDING
**Prompt:** `WAVE6_AGENT3_UX_POLISH.md`

- Error boundaries (error.tsx for deckmarket + admin/deckmarket)
- Loading skeletons (loading.tsx with animated placeholders)
- Accessibility (aria-labels, aria-pressed, aria-live, aria-current)
- Download error UX (visible error banner instead of silent console.error)

---

## Tracking

| Task | Status | Agent | Notes |
|------|--------|-------|-------|
| 1.1 Types | DONE | spec-impl | Reviewed & approved |
| 1.2 i18n | DONE | spec-impl | Reviewed & approved (all 6 locales) |
| 1.3 Firestore rules | DONE | spec-impl | Reviewed & approved |
| 2.1 Admin API | DONE | spec-impl | Reviewed & approved |
| 2.2 Public API | DONE | spec-impl | Reviewed & approved |
| 3.1 Admin UI | DONE | spec-impl | Reviewed & approved |
| 3.2 User UI | DONE | spec-impl | Reviewed & approved |
| 4.1 Build | DONE | Bash | Zero errors, all 14 routes compiled |
| 4.2 Review | DONE | Tech Lead | Full spec review passed |
| 5.1 Admin API Tests | DONE | spec-impl | 5 suites, 46 tests passed |
| 5.2 Public API Tests | DONE | spec-impl | 4 suites, 26 tests passed |
| 6.1 Backend Hardening | PENDING | spec-impl | Indexes, rate limits, validation, rules |
| 6.2 SEO & Discoverability | PENDING | spec-impl | Metadata, sitemap, robots.txt, JSON-LD |
| 6.3 UX Polish | PENDING | spec-impl | Error boundaries, a11y, download UX |
