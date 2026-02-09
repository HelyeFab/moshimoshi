# Wave 6 — Agent 1: Backend Hardening

**Role:** spec-impl
**Depends on:** Waves 1-5 (all DONE)
**Parallel with:** Agent 2 (SEO), Agent 3 (UX Polish)

---

## Objective

Harden the DeckMarket backend for production: add Firestore composite indexes, rate limit download endpoints, add input validation length limits to admin API, and tighten Firestore security rules. All changes are surgical — existing behavior stays identical.

---

## Task 1: Firestore Composite Indexes

**File:** `firestore.indexes.json`

The public list route (`src/app/api/deckmarket/decks/route.ts`) queries:
- `where('isPublished', '==', true)` + `orderBy('updatedAt', 'desc')`
- Optionally + `where('jlpt', '==', value)`
- Optionally + `where('language', '==', value)`

The admin list route (`src/app/api/admin/deckmarket/decks/route.ts`) queries:
- Optionally `where('isPublished', '==', true/false)` + `orderBy('updatedAt', 'desc')`

Without composite indexes, these queries fail at scale. Add **4 indexes** to the existing `indexes` array in `firestore.indexes.json`:

```json
{
  "collectionGroup": "deckmarket_decks",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "isPublished", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "deckmarket_decks",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "isPublished", "order": "ASCENDING" },
    { "fieldPath": "jlpt", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "deckmarket_decks",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "isPublished", "order": "ASCENDING" },
    { "fieldPath": "language", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "deckmarket_decks",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "isPublished", "order": "ASCENDING" },
    { "fieldPath": "jlpt", "order": "ASCENDING" },
    { "fieldPath": "language", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
}
```

**Steps:**
1. Read `firestore.indexes.json`
2. Add the 4 indexes to the end of the `indexes` array (before the closing `]`)
3. Verify valid JSON

---

## Task 2: Rate Limiting on Download Routes

**Pattern to follow:** `src/app/api/furigana/route.ts` — uses `rateLimitMiddleware` from `@/lib/api/rate-limiter.ts`

The app uses Upstash Redis-based rate limiting via `AdaptiveRateLimiter`. The existing `RateLimitConfigs` object in `src/lib/api/rate-limiter.ts` defines per-endpoint configs.

### Step 2a: Add DeckMarket config to `src/lib/api/rate-limiter.ts`

Add a new `deckmarket` category to `RateLimitConfigs`:

```typescript
// DeckMarket endpoints - protect downloads from abuse
deckmarket: {
  download: { requests: 20, window: '1h' },
  list: { requests: 60, window: '1m' },
},
```

Place it after the `furigana` entry and before the `admin` entry.

### Step 2b: Add rate limiting to download routes

**File 1:** `src/app/api/deckmarket/decks/[deckId]/download/route.ts`

Add rate limiting at the start of the GET function, right after the auth check:

```typescript
import { rateLimitMiddleware } from '@/lib/api/rate-limiter'

export async function GET(request: NextRequest, ...) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit downloads
    const rateLimitResult = await rateLimitMiddleware(request, {
      category: 'deckmarket',
      endpoint: 'download',
      tier: 'free',
    })
    if (rateLimitResult) return rateLimitResult

    // ... rest of existing code unchanged
```

**File 2:** `src/app/api/deckmarket/decks/[deckId]/versions/[versionId]/download/route.ts`

Same pattern — add rate limiting right after auth check.

**Do NOT** rate limit the public list route (`/api/deckmarket/decks`) — it's read-only and the standard 60/min default is fine through general middleware.

### Reference: how furigana route uses it

```typescript
// src/app/api/furigana/route.ts (lines 1-3, then in POST handler)
import { rateLimitMiddleware, getRateLimitHeaders } from '@/lib/api/rate-limiter';

// Inside handler:
const rateLimitResult = await rateLimitMiddleware(request, {
  category: 'furigana',
  endpoint: 'generate',
  tier: session?.tier === 'premium' ? 'premium' : 'free',
});
if (rateLimitResult) return rateLimitResult;
```

---

## Task 3: Input Validation — String Length Limits

**Files to modify:**
- `src/app/api/admin/deckmarket/decks/route.ts` (POST handler)
- `src/app/api/admin/deckmarket/decks/[deckId]/route.ts` (PATCH handler)
- `src/app/api/admin/deckmarket/decks/[deckId]/upload/route.ts` (POST — versionLabel/changelog)
- `src/app/api/admin/deckmarket/decks/[deckId]/import-csv/route.ts` (POST — versionLabel/changelog from FormData)

### Add constants to `src/types/deckmarket.ts`:

```typescript
// Input validation limits
export const DECK_LIMITS = {
  TITLE_MAX: 255,
  DESCRIPTION_MAX: 2000,
  TAGS_MAX_COUNT: 10,
  TAG_MAX_LENGTH: 50,
  CHANGELOG_MAX: 500,
  VERSION_LABEL_MAX: 100,
} as const
```

### Admin decks POST route — add after the title check:

```typescript
import { DECK_LIMITS } from '@/types/deckmarket'

// After: if (!body?.title || typeof body.title !== 'string' || !body.title.trim())
if (body.title.trim().length > DECK_LIMITS.TITLE_MAX) {
  return NextResponse.json({ error: `Title must be ${DECK_LIMITS.TITLE_MAX} characters or less` }, { status: 400 })
}

if (body.description && typeof body.description === 'string' && body.description.length > DECK_LIMITS.DESCRIPTION_MAX) {
  return NextResponse.json({ error: `Description must be ${DECK_LIMITS.DESCRIPTION_MAX} characters or less` }, { status: 400 })
}

if (body.tags && Array.isArray(body.tags)) {
  if (body.tags.length > DECK_LIMITS.TAGS_MAX_COUNT) {
    return NextResponse.json({ error: `Maximum ${DECK_LIMITS.TAGS_MAX_COUNT} tags allowed` }, { status: 400 })
  }
  if (body.tags.some((tag: string) => typeof tag !== 'string' || tag.length > DECK_LIMITS.TAG_MAX_LENGTH)) {
    return NextResponse.json({ error: `Each tag must be ${DECK_LIMITS.TAG_MAX_LENGTH} characters or less` }, { status: 400 })
  }
}
```

### Admin [deckId] PATCH route — add before building updateData:

Same length checks for title, description, tags — but only if those fields are present in the body (they're optional in PATCH).

### Upload and import-csv routes — add versionLabel/changelog checks:

```typescript
// After extracting versionLabel/changelog:
if (body.versionLabel && typeof body.versionLabel === 'string' && body.versionLabel.length > DECK_LIMITS.VERSION_LABEL_MAX) {
  return NextResponse.json({ error: `Version label must be ${DECK_LIMITS.VERSION_LABEL_MAX} characters or less` }, { status: 400 })
}

if (body.changelog && typeof body.changelog === 'string' && body.changelog.length > DECK_LIMITS.CHANGELOG_MAX) {
  return NextResponse.json({ error: `Changelog must be ${DECK_LIMITS.CHANGELOG_MAX} characters or less` }, { status: 400 })
}
```

---

## Task 4: Tighten Firestore Security Rules

**File:** `firestore.rules`

**Current rules (lines 840-849):**
```
match /deckmarket_decks/{deckId} {
  allow read: if request.auth != null;
  allow write: if false;

  match /versions/{versionId} {
    allow read: if request.auth != null;
    allow write: if false;
  }
}
```

**Problem:** Any authenticated user can read unpublished/draft decks directly via Firestore client SDK.

**Replace with:**
```
// DeckMarket - deck catalogue (public reads published only, admin reads via Admin SDK)
match /deckmarket_decks/{deckId} {
  allow read: if request.auth != null && resource.data.isPublished == true;
  allow write: if false; // Writes via Admin SDK only

  match /versions/{versionId} {
    allow read: if request.auth != null &&
      get(/databases/$(database)/documents/deckmarket_decks/$(deckId)).data.isPublished == true;
    allow write: if false; // Writes via Admin SDK only
  }
}
```

**Key:** Admin SDK bypasses security rules entirely, so admin routes continue to read drafts. Only client-side reads (if any) are restricted.

---

## Validation Checklist

- [ ] `firestore.indexes.json` — 4 new composite indexes added, valid JSON
- [ ] `src/lib/api/rate-limiter.ts` — `deckmarket` category added to `RateLimitConfigs`
- [ ] `src/app/api/deckmarket/decks/[deckId]/download/route.ts` — rate limiting after auth
- [ ] `src/app/api/deckmarket/decks/[deckId]/versions/[versionId]/download/route.ts` — rate limiting after auth
- [ ] `src/types/deckmarket.ts` — `DECK_LIMITS` constants added
- [ ] Admin POST route — title/description/tags length validation
- [ ] Admin PATCH route — title/description/tags length validation
- [ ] Upload route — versionLabel/changelog length validation
- [ ] Import-csv route — versionLabel/changelog length validation
- [ ] `firestore.rules` — `isPublished == true` guard on read
- [ ] Build passes: `npm run build`
- [ ] Existing tests still pass: `npx jest src/app/api/admin/deckmarket --verbose && npx jest src/app/api/deckmarket --verbose`
