# DeckMarket MVP — Agent Brief (Strict)

**Status:** APPROVED
**Last Updated:** 2026-02-09
**Stack:** Next.js 15 API Routes + Firestore + Cloudflare R2

### Key Decisions (2026-02-09)
- **Access tier**: All logged-in users (free + premium) — no premium gating
- **Navigation**: Link visible inside the Flashcards page only (not main nav)
- **Firestore rules**: Updated by implementation team
- **Cover images**: Skipped for MVP — placeholder design (deck color + emoji)
- **Cover API routes**: Not implemented in Phase 1

---

## 1) Objective

Build an extremely simple "DeckMarket" inside Moshimoshi:

- Logged-in users can browse a catalogue of decks
- Users can download `.apkg` files stored in R2
- Admins can create/edit/publish decks and upload new deck versions via an admin page

That's it.

---

## 2) Absolute Constraints (Non-negotiable)

### 2.1 "No new infra patterns"

For these areas, **NO NEW SYSTEMS MAY BE CODED**:

- R2 access pattern
- User authentication
- Admin authorisation / role checks
- API routing conventions
- Database access layer
- File upload strategy
- Logging / error handling patterns
- Environment variable management
- Rate limiting (if it exists; otherwise omit from MVP)

#### What "no new" means in practice

**Allowed:**

- Using the existing R2 client singleton (`src/lib/r2/r2-client.ts` → `getR2Config()`)
- Using the existing presigned URL pattern (`@aws-sdk/client-s3` + `getSignedUrl()`)
- Using `getSession()` from `src/lib/auth/session.ts` for user auth
- Using `withAdminAuth()` from `src/lib/admin/adminAuth.ts` for admin routes
- Using Firestore via `adminFirestore` from `src/lib/firebase/admin.ts`
- Following existing Next.js API route naming and response shapes
- Using existing R2 key validation helpers (`src/lib/r2/r2-keys.ts`)

**Not allowed:**

- Creating a brand-new auth scheme (new JWT signing, custom sessions, new claims)
- Building a new admin/role system
- Introducing a new storage abstraction layer or new SDK
- Switching from Firestore to D1, SQL, or any other DB
- Adding new services (KV, Durable Objects, new queues, etc.)
- Creating new R2 buckets — use the existing `moshmoshi-anki` bucket

### 2.2 Stop rule

If the agent discovers a dependency is missing, they must:

1. **Stop** implementation
2. Produce a short report: what is missing, where they looked, the smallest existing-pattern-compatible option
3. **Wait** for direction (or implement only after a documented decision)

---

## 3) Architecture (Must match existing patterns)

### 3.1 Pattern Map — Existing Code to Reuse

| Pattern | Existing File | What It Does |
|---------|---------------|--------------|
| R2 client | `src/lib/r2/r2-client.ts` | Lazy-loaded S3Client singleton, `getR2Config()` returns `{ client, bucket, signedUrlTtlSeconds }` |
| R2 key helpers | `src/lib/r2/r2-keys.ts` | `buildDeckPrefix()`, `isValidDeckKey()` |
| R2 hashing | `src/lib/r2/hashUtils.ts` | `hashBlob()` for SHA-256 (optional) |
| Presigned upload URL | `src/app/api/flashcards/r2/upload-url/route.ts` | `PutObjectCommand` + `getSignedUrl(client, cmd, { expiresIn: 900 })` |
| Presigned download URL | `src/app/api/flashcards/r2/[deckId]/route.ts` | `GetObjectCommand` + `getSignedUrl(client, cmd, { expiresIn: 3600 })` |
| R2 delete | `src/app/api/flashcards/r2/[deckId]/route.ts` | `DeleteObjectCommand` per object |
| R2 list objects | `src/app/api/flashcards/r2/[deckId]/route.ts` | `ListObjectsV2Command` with prefix |
| User session | `src/lib/auth/session.ts` | `getSession()` → `SessionUser \| null` with `{ uid, email, tier, admin, sessionId }` |
| Admin middleware | `src/lib/admin/adminAuth.ts` | `withAdminAuth(handler)` — cookie-based, returns `context.user` |
| Firestore admin | `src/lib/firebase/admin.ts` | `adminFirestore` — server-only, Firebase Admin SDK |
| Tier utils | `src/lib/auth/tier-utils.ts` | `getUserTier()`, `isPremiumUser()` |
| Admin page pattern | `src/app/[locale]/admin/*/page.tsx` | `'use client'`, `credentials: 'include'`, loading/error states |
| Admin API pattern | `src/app/api/admin/*/route.ts` | `withAdminAuth`, `NextResponse.json({ success, data })` |
| i18n | `src/i18n/I18nContext.tsx` | `useTranslation()`, `strings.deckmarket.*` |
| Theme | `src/lib/theme/ThemeContext.tsx` | Always pair `dark:` variants, use `bg-primary-*` semantic tokens |

### 3.2 Storage (R2)

Deck files are stored in the **existing** R2 bucket (`moshmoshi-anki`) using the existing R2 access method.

Bucket remains **private**. All access through presigned URLs (existing pattern).

**R2 object keys:**

```
deckmarket/{deckId}/{versionId}/{safeFilename}.apkg
deckmarket/{deckId}/cover.png           (optional)
```

The `deckmarket/` prefix keeps DeckMarket files separate from existing user data under `users/`.

### 3.3 Database (Firestore)

Use **Firestore** — the existing and only database in Moshimoshi. No new DB products.

**Collections:**

#### `deckmarket_decks/{deckId}`

Top-level collection. Document ID is the slug (e.g., `genki2-lesson-02`).

```typescript
{
  id: string                    // slug: "genki2-lesson-02"
  title: string                 // "Genki II - Lesson 2"
  description: string           // Markdown or plain text
  language: string              // "ja" (default)
  jlpt: string | null           // "N5" | "N4" | "N3" | "N2" | "N1" | null
  tags: string[]                // ["Genki II", "Vocabulary"]
  coverR2Key: string | null     // "deckmarket/genki2-lesson-02/cover.png" or null
  isPublished: boolean          // false (draft) by default
  latestVersionId: string | null // FK to versions subcollection doc ID
  downloadCount: number         // 0 default, atomic increment on download
  lastDownloadAt: Timestamp | null
  createdAt: Timestamp          // FieldValue.serverTimestamp()
  updatedAt: Timestamp          // FieldValue.serverTimestamp()
}
```

#### `deckmarket_decks/{deckId}/versions/{versionId}`

Subcollection. Each upload creates a new version document.

```typescript
{
  id: string                    // auto-generated UUID
  deckId: string                // parent deck slug
  versionLabel: string          // "v1", "2026-02-09", etc.
  changelog: string             // "" default
  apkgR2Key: string             // "deckmarket/genki2-lesson-02/{versionId}/deck.apkg"
  apkgFilename: string          // original filename (sanitised)
  sizeBytes: number             // file size
  sha256: string | null         // optional, from hashBlob()
  createdAt: Timestamp          // FieldValue.serverTimestamp()
  createdByUid: string          // admin's uid from context.user.uid
}
```

**Indexes required:**

- `deckmarket_decks` composite: `isPublished` ASC + `updatedAt` DESC (for catalogue listing)
- `deckmarket_decks` composite: `isPublished` ASC + `language` ASC (for filtering)
- Subcollection `versions` ordered by `createdAt` DESC (default Firestore behaviour on single field)

**Why not a separate `deck_stats` collection?**
Following the existing `viewCount` pattern on content documents (books, stories, comics), `downloadCount` lives directly on the deck document. Incremented atomically via `FieldValue.increment(1)`.

### 3.4 Auth (User access)

All DeckMarket API endpoints require user login.

**Implementation:** Call `getSession()` inline at the top of each route handler.

```typescript
import { getSession } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // session.uid, session.email available
}
```

This matches the pattern used in all flashcard routes (`src/app/api/flashcards/decks/route.ts:41-44`).

### 3.5 Admin auth

Admin UI + admin API endpoints require admin rights.

**Implementation:** Use the existing `withAdminAuth` wrapper.

```typescript
import { withAdminAuth } from '@/lib/admin/adminAuth'

export const POST = withAdminAuth(async (request, context) => {
  // context.user = { uid, email, isAdmin: true }
  const adminUid = context.user.uid
  // ...
})
```

This matches the pattern used in all admin routes (`src/app/api/admin/*/route.ts`).

**No new admin system may be added.** The existing `isAdminUserCached()` check inside `withAdminAuth` handles everything.

---

## 4) Functional Scope (Phase 1 = MVP)

### 4.1 User features

#### A) Catalogue page

- **Route:** `src/app/[locale]/deckmarket/page.tsx`
- **URL:** `/[locale]/deckmarket`
- **Auth:** Logged-in only
- **Features:**
  - List published decks (paginated)
  - Search by title/description (basic client-side or query param)
  - Optional filters: JLPT level, tags (only if trivial)

#### B) Deck detail page

- **Route:** `src/app/[locale]/deckmarket/[deckId]/page.tsx`
- **URL:** `/[locale]/deckmarket/:deckId`
- **Auth:** Logged-in only
- **Shows:**
  - Title, description, tags, JLPT, language
  - Latest version info (label, size, date)
  - Download button
  - Optional: version list with individual download links (nice-to-have)

#### C) Download

- **Auth:** Logged-in only
- **Only published decks**
- **Method:** Presigned URL (existing pattern)
  - API route validates auth + checks `isPublished`
  - Generates presigned `GetObjectCommand` URL (1hr TTL)
  - Atomically increments `downloadCount` via `FieldValue.increment(1)`
  - Returns presigned URL to client → client triggers download

This matches the existing R2 download pattern in `src/app/api/flashcards/r2/[deckId]/route.ts`.

### 4.2 Admin features (must be included in MVP)

#### A) Admin dashboard

- **Route:** `src/app/[locale]/admin/deckmarket/page.tsx`
- **URL:** `/[locale]/admin/deckmarket`
- **Auth:** Admin only (protected by admin layout)
- **Features:**
  - List all decks (published + drafts)
  - Toggle publish/unpublish
  - Navigate to edit
  - Show download counts
  - Search + filter by published status
- **Sidebar:** Add entry to `AdminLayoutClient.tsx` nav items

#### B) Create deck

- **Route:** `src/app/[locale]/admin/deckmarket/new/page.tsx`
- **URL:** `/[locale]/admin/deckmarket/new`
- **Auth:** Admin only
- **Form:**
  - Title
  - ID (slug) — auto-filled from title, editable
  - Description (textarea)
  - Tags (comma-separated input)
  - JLPT (dropdown: N5-N1 or none)
  - Language (dropdown: ja default)
  - Cover upload (optional)
- **Action:** Creates draft deck in Firestore

#### C) Edit deck + Upload new version

- **Route:** `src/app/[locale]/admin/deckmarket/[deckId]/page.tsx`
- **URL:** `/[locale]/admin/deckmarket/:deckId`
- **Auth:** Admin only
- **Sections:**
  - Metadata editor (title, description, tags, JLPT, language)
  - Publish toggle
  - Upload new version form:
    - File picker (`.apkg` only)
    - Version label (text input)
    - Changelog (textarea)
    - Set as latest (checkbox, default on)
    - Publish now (checkbox, optional)
  - Versions list:
    - Label, size, date, changelog
    - Download test link
    - (Optional) delete version button

### Admin Create Deck — Import Options (NEW)

On `/admin/deckmarket/new`, admins choose **one of two import pipelines**:

1) **Anki `.apkg` upload** (existing presigned upload flow)
2) **CSV → `.apkg` conversion** (server-side conversion using `genanki`)

CSV format must match the existing flashcards import schema:

```
front,back,notes
こんにちは,Hello,Greeting
ありがとう,Thank you,Polite
```

Template file: `02-PRODUCTION_DOCS/deckMarket/deckmarket_template.csv`

**CSV download support:** When importing via CSV, the original CSV is also uploaded to R2 and linked on the version. Users can download either `.apkg` or `.csv` from the deck detail page.

---

## 5) Required API Surface

### Public (logged-in) — `src/app/api/deckmarket/`

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/deckmarket/decks` | List published decks (paginated, filterable) |
| GET | `/api/deckmarket/decks/[deckId]` | Deck detail + versions list |
| GET | `/api/deckmarket/decks/[deckId]/download` | Download latest version (returns presigned URL). Supports `?format=csv` when CSV is available. |
| GET | `/api/deckmarket/decks/[deckId]/versions/[versionId]/download` | Download specific version (optional). Supports `?format=csv` when CSV is available. |
| GET | `/api/deckmarket/decks/[deckId]/cover` | Get cover presigned URL (or 404) |

### Admin (admin only) — `src/app/api/admin/deckmarket/`

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/deckmarket/decks` | List all decks (published + drafts) |
| POST | `/api/admin/deckmarket/decks` | Create new deck metadata |
| GET | `/api/admin/deckmarket/decks/[deckId]` | Get deck detail (admin view) |
| PATCH | `/api/admin/deckmarket/decks/[deckId]` | Update metadata + publish toggle |
| POST | `/api/admin/deckmarket/decks/[deckId]/upload` | Upload new version (.apkg → R2 → Firestore) |
| POST | `/api/admin/deckmarket/decks/[deckId]/import-csv` | Convert CSV → `.apkg` and create version |
| DELETE | `/api/admin/deckmarket/decks/[deckId]/versions/[versionId]` | Delete version (optional, removes R2 object + Firestore doc) |

### Response shapes (match existing conventions)

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "error": "User-friendly message"
}
// with appropriate HTTP status: 400, 401, 403, 404, 500
```

**Paginated list:**
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "page": 1,
    "pageSize": 20,
    "total": 123
  }
}
```

---

## 6) Upload Flow (Important)

### Admin upload: Presigned URL pattern (matches existing)

The existing Moshimoshi pattern uses **presigned PUT URLs**. DeckMarket follows the same approach:

1. Admin selects `.apkg` file in browser
2. Client calls `POST /api/admin/deckmarket/decks/{deckId}/upload` with metadata (versionLabel, changelog, filename, fileSize)
3. API route:
   - Validates admin auth via `withAdminAuth`
   - Validates file extension (`.apkg` only) and size (max 200MB)
   - Generates a UUID for `versionId`
   - Builds R2 key: `deckmarket/{deckId}/{versionId}/{safeFilename}.apkg`
   - Generates presigned PUT URL via `PutObjectCommand` + `getSignedUrl()` (15min TTL)
   - Creates `versions/{versionId}` document in Firestore
   - Updates deck's `latestVersionId` and `updatedAt`
   - Returns `{ uploadUrl, versionId, r2Key }`
4. Client uploads file directly to R2 using the presigned URL (PUT request)
5. Client confirms upload success (optional: `PATCH` to mark version as ready)

### Admin CSV import: Server-side conversion (NEW)

The create flow supports a CSV import option that converts CSV to `.apkg` on the server, uploads the resulting `.apkg` to R2, **and stores the original CSV in R2** for later download.

1. Admin selects `.csv` file in browser
2. Client calls `POST /api/admin/deckmarket/decks/{deckId}/import-csv` with `multipart/form-data`:
   - `file` (CSV)
   - optional `versionLabel`, `changelog`
3. API route:
   - Validates admin auth via `withAdminAuth`
   - Validates file extension (`.csv` only)
   - Writes CSV to a temp dir
   - Runs `scripts/deckmarket/csv_to_apkg.py` with `genanki`
   - Uploads generated `.apkg` to R2 (same bucket + key pattern)
   - Uploads original `.csv` to R2 and stores `csvR2Key`, `csvFilename`, `csvSizeBytes` on the version doc
   - Creates `versions/{versionId}` document in Firestore
   - Updates deck's `latestVersionId` and `updatedAt`

**Requirements:**
- `genanki` must be installed on the server host (dev machine)
- CSV must include at least `front,back` columns

Suggested local install (venv):
```
python3 -m venv .venv
.venv/bin/pip install genanki
```

**Validation:**
- Accept only `.apkg` extension
- Max file size: 200MB (enforced client-side + in presigned URL content-length condition)
- Sanitise filename: strip path separators, special chars
- R2 key validation via existing `isValidDeckKey()` helper pattern

**Why presigned instead of multipart-through-server:**
- Existing pattern in codebase (flashcards, Anki uploads all use presigned URLs)
- No server memory/timeout constraints for large files
- R2 handles the heavy lifting

---

## 7) UI/UX Requirements (Keep it extremely simple)

### General

- Minimal UI (forms + lists + cards)
- Follow existing admin page patterns (`src/app/[locale]/admin/*/page.tsx`)
- Dark mode: always pair `dark:` variants (`bg-white dark:bg-dark-800`)
- Palette-aware: use `bg-primary-*` semantic tokens
- i18n: all user-facing strings via `strings.deckmarket.*`
- Mobile responsive
- Error states: match existing admin patterns (red alert box)
- Loading states: spinner matching existing admin patterns
- Use `credentials: 'include'` on all admin fetch calls
- Use `cn()` utility for conditional class merging

### User pages

- Follow existing page patterns (not admin — standalone feature pages)
- Page background: `bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850`
- Cards for deck list items
- Clean detail page with prominent download button

### Admin pages

- Follow exact admin page template from `DEVELOPER_GUIDE.md`
- Use `Modal` component from `@/components/ui/Modal` for confirmations
- Data tables for deck lists (match existing admin table pattern)
- Form inputs: existing admin input styling

---

## 8) i18n Requirements

Add `deckmarket` namespace to all 6 locale files:

- `src/i18n/locales/en/strings.ts` (English — master, add first)
- `src/i18n/locales/ja/strings.ts`
- `src/i18n/locales/de/strings.ts`
- `src/i18n/locales/es/strings.ts`
- `src/i18n/locales/fr/strings.ts`
- `src/i18n/locales/it/strings.ts`

Minimum keys needed:

```typescript
deckmarket: {
  title: 'Deck Market',
  subtitle: 'Browse and download Anki decks',
  search: 'Search decks...',
  filters: {
    all: 'All',
    jlpt: 'JLPT Level',
    language: 'Language',
  },
  deck: {
    download: 'Download',
    downloadLatest: 'Download Latest',
    version: 'Version',
    versions: 'Versions',
    size: 'Size',
    updated: 'Updated',
    tags: 'Tags',
    noDecks: 'No decks available yet',
    notFound: 'Deck not found',
  },
  admin: {
    title: 'DeckMarket Admin',
    createDeck: 'Create Deck',
    editDeck: 'Edit Deck',
    publish: 'Publish',
    unpublish: 'Unpublish',
    published: 'Published',
    draft: 'Draft',
    uploadVersion: 'Upload New Version',
    versionLabel: 'Version Label',
    changelog: 'Changelog',
    setAsLatest: 'Set as latest',
    publishNow: 'Publish now',
    slug: 'Slug (ID)',
    description: 'Description',
    tags: 'Tags (comma-separated)',
    jlpt: 'JLPT Level',
    language: 'Language',
    cover: 'Cover Image',
    downloads: 'Downloads',
    deleteDeck: 'Delete Deck',
    deleteVersion: 'Delete Version',
    confirmDelete: 'Are you sure?',
  },
}
```

---

## 9) Security Requirements (MVP)

### Auth

- Every public API request must call `getSession()` and reject with 401 if null
- Every admin API request must use `withAdminAuth()` wrapper
- No Firebase client auth imports in admin pages (ESLint rule enforces this)

### R2 access

- Bucket is private — all access via presigned URLs
- Download presigned URLs are short-lived (1hr)
- Upload presigned URLs are short-lived (15min)
- R2 key validation prevents path traversal (`..`, `\`, leading `/`)
- Only `.apkg` files accepted for upload

### Data access

- Public routes: only return `isPublished: true` decks
- Download route: verify `isPublished` before generating presigned URL
- Admin routes: `withAdminAuth` guarantees admin-only access

### Abuse protections (MVP scope)

- Cover images: set `Cache-Control` header for caching
- Do not log sensitive tokens or presigned URLs
- Rate limiting: omit from MVP (existing rate limiter exists at `src/lib/api/admin-analytics-rate-limiter.ts` if needed later)

---

## 10) Minimal Analytics (MVP)

On every successful download:

- Atomically increment `downloadCount` on deck document: `FieldValue.increment(1)`
- Update `lastDownloadAt` on deck document: `FieldValue.serverTimestamp()`

This matches the existing `viewCount` + `lastViewed` pattern used by the unified `/api/track-view` endpoint.

Optional (not required for MVP): per-user download log subcollection.

---

## 11) Operational Workflow (Admin)

### "Upload a new deck"

1. Go to `/admin/deckmarket/new`
2. Fill in title, description, tags, JLPT, language
3. Create (saves as draft)
4. On edit page: upload `.apkg` file as version v1
5. Toggle publish
6. Done — users can see it in the catalogue

### "Update existing deck"

1. Go to `/admin/deckmarket`
2. Click "Edit" on a deck
3. Upload new `.apkg` as new version
4. Optionally add changelog
5. It becomes latest (default)

---

## 12) Definition of Done (Phase 1)

### Functional

- [ ] Logged-in user can list + search + view + download published decks
- [ ] Admin can create a deck + upload version + publish
- [ ] Deck `.apkg` files are stored in R2 via existing presigned URL pattern
- [ ] CSV import converts to `.apkg` server-side and uploads to R2
- [ ] Metadata + versions stored in Firestore
- [ ] Downloads counted (atomic increment)

### Quality

- [ ] Basic error states (upload failure, missing deck, not published)
- [ ] Basic validation (slug format, `.apkg` extension, file size)
- [ ] Works on mobile + desktop (responsive)
- [ ] Dark mode works across all pages
- [ ] i18n strings present in all 6 locales
- [ ] Admin pages follow established admin dashboard patterns

### Non-functional

- [ ] No new infra/auth abstractions added
- [ ] All auth reused exactly from existing patterns
- [ ] R2 accessed via existing `getR2Config()` + presigned URL pattern
- [ ] All admin routes protected with `withAdminAuth`
- [ ] All public routes verify session with `getSession()`

---

## 13) Suggested Implementation Order

1. **Types** — Create `src/types/deckmarket.ts` with all interfaces
2. **Firestore indexes** — Add composite indexes for `deckmarket_decks`
3. **i18n** — Add `deckmarket` namespace to all 6 locale files
4. **Admin API** — `POST /api/admin/deckmarket/decks` (create), `PATCH` (update), `GET` (list)
5. **Admin upload API** — `POST /api/admin/deckmarket/decks/[deckId]/upload` (presigned URL + Firestore version)
6. **Public API** — `GET /api/deckmarket/decks` (list published), `GET .../[deckId]` (detail), `GET .../download` (presigned download + stats)
7. **Admin UI** — Dashboard, create, edit pages (following admin page template)
8. **User UI** — Catalogue page, detail page (following app page patterns)
9. **Sidebar** — Add DeckMarket to admin sidebar navigation

---

## 14) File Structure (Expected)

```
src/
├── types/
│   └── deckmarket.ts                              # TypeScript interfaces
├── app/
│   ├── api/
│   │   ├── deckmarket/
│   │   │   └── decks/
│   │   │       ├── route.ts                       # GET: list published decks
│   │   │       └── [deckId]/
│   │   │           ├── route.ts                   # GET: deck detail
│   │   │           ├── download/
│   │   │           │   └── route.ts               # GET: download latest (presigned URL)
│   │   │           ├── cover/
│   │   │           │   └── route.ts               # GET: cover presigned URL
│   │   │           └── versions/
│   │   │               └── [versionId]/
│   │   │                   └── download/
│   │   │                       └── route.ts       # GET: download specific version
│   │   └── admin/
│   │       └── deckmarket/
│   │           └── decks/
│   │               ├── route.ts                   # GET: list all, POST: create
│   │               └── [deckId]/
│   │                   ├── route.ts               # GET: detail, PATCH: update
│   │                   ├── upload/
│   │                   │   └── route.ts           # POST: upload version (presigned URL)
│   │                   ├── import-csv/
│   │                   │   └── route.ts           # POST: CSV → .apkg conversion
│   │                   └── versions/
│   │                       └── [versionId]/
│   │                           └── route.ts       # DELETE: remove version
│   └── [locale]/
│       ├── deckmarket/
│       │   ├── page.tsx                           # User catalogue page
│       │   └── [deckId]/
│       │       └── page.tsx                       # User deck detail page
│       └── admin/
│           └── deckmarket/
│               ├── page.tsx                       # Admin dashboard
│               ├── new/
│               │   └── page.tsx                   # Admin create deck
│               └── [deckId]/
│                   └── page.tsx                   # Admin edit deck
└── i18n/
    └── locales/
        ├── en/strings.ts                          # + deckmarket namespace
        ├── ja/strings.ts                          # + deckmarket namespace
        ├── de/strings.ts                          # + deckmarket namespace
        ├── es/strings.ts                          # + deckmarket namespace
        ├── fr/strings.ts                          # + deckmarket namespace
        └── it/strings.ts                          # + deckmarket namespace

scripts/
└── deckmarket/
    └── csv_to_apkg.py                              # CSV → .apkg conversion via genanki

02-PRODUCTION_DOCS/
└── deckMarket/
    └── deckmarket_template.csv                     # CSV import template
```

---

## 15) Non-Goals (Explicitly Excluded)

- Payments, subscriptions, storefront checkout
- User-submitted decks / moderation queue
- Ratings / reviews / comments
- Deck sync / automatic updates after download
- In-app study (Anki remains the study tool)
- Complex analytics (only basic download counts)
- New R2 buckets or storage abstractions
- New auth systems or admin role hierarchies
