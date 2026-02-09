# Wave 2 — Agent 2: Public API Routes

**Role:** spec-impl
**Depends on:** Wave 1 (types, i18n, Firestore rules) — all DONE
**Parallel with:** Agent 1 (Admin API)

---

## Objective

Create 4 API route files under `src/app/api/deckmarket/` that let logged-in users browse and download published decks. All routes use `getSession()` for authentication — **NOT** `withAdminAuth`.

**Key constraint:** Public routes must ONLY return decks where `isPublished === true`. Never expose draft decks to non-admin users.

---

## Files to Create

### File 1: `src/app/api/deckmarket/decks/route.ts`

**Exports:** `GET` (list published decks, paginated)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { DECKMARKET_COLLECTION } from '@/types/deckmarket'
import type { DeckListItem, DeckListResponse } from '@/types/deckmarket'
```

**Flow:**

1. Auth check:

```typescript
const session = await getSession()
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

2. Read query params: `?page=1`, `?pageSize=20`, `?search=`, `?jlpt=N5`, `?language=ja`
3. Build Firestore query:

```typescript
let query = adminFirestore
  .collection(DECKMARKET_COLLECTION)
  .where('isPublished', '==', true)
  .orderBy('updatedAt', 'desc')
```

4. Apply optional filters:
   - If `jlpt` param: `.where('jlpt', '==', jlptValue)`
   - If `language` param: `.where('language', '==', languageValue)`
5. For pagination: use `.limit(pageSize)` and `.offset((page - 1) * pageSize)`
6. For total count: run a separate count query or fetch all IDs (keep it simple for MVP — just return items without exact total, or do a separate `.count().get()` if available)
7. Map to `DeckListItem` shape, converting Timestamps to ISO strings
8. Return paginated response:

```typescript
return NextResponse.json({
  success: true,
  data: {
    items,
    page,
    pageSize,
    total, // best effort count
  }
} as DeckListResponse)
```

**Search:** For MVP, if `search` param is provided, do client-side filtering after fetching (Firestore doesn't support full-text search). Alternatively, fetch a reasonable limit (e.g., 100) and filter in-memory by title/description containing the search string (case-insensitive).

---

### File 2: `src/app/api/deckmarket/decks/[deckId]/route.ts`

**Exports:** `GET` (deck detail + versions)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { DECKMARKET_COLLECTION, VERSIONS_SUBCOLLECTION } from '@/types/deckmarket'
import type { DeckDetailResponse } from '@/types/deckmarket'
```

**Flow:**

1. Auth check with `getSession()` — 401 if null
2. Get `deckId` from route params:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const { deckId } = await params
```

3. Fetch deck document
4. **CRITICAL:** Check `isPublished === true`. If not published, return 404 (don't reveal existence of drafts)
5. Fetch versions subcollection ordered by `createdAt` DESC
6. Find `latestVersion` by matching `deck.latestVersionId`
7. Convert all Timestamps to ISO strings
8. Return:

```typescript
return NextResponse.json({
  success: true,
  data: {
    deck: serializedDeck,
    versions: serializedVersions,
    latestVersion: serializedLatestVersion || null,
  }
} as DeckDetailResponse)
```

---

### File 3: `src/app/api/deckmarket/decks/[deckId]/download/route.ts`

**Exports:** `GET` (download latest version — returns presigned URL + increments download count)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, FieldValue } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DECKMARKET_COLLECTION, VERSIONS_SUBCOLLECTION } from '@/types/deckmarket'
import type { DeckDownloadResponse } from '@/types/deckmarket'
```

**Flow:**

1. Auth check with `getSession()` — 401 if null
2. Get `deckId` from route params (same pattern as File 2)
3. Fetch deck document
4. **CRITICAL:** Verify `isPublished === true` — return 404 if not
5. Get `latestVersionId` from deck — return 404 with message "No version available" if null
6. Fetch the version document from subcollection
7. Generate presigned download URL:

```typescript
const { client, bucket } = getR2Config()

const command = new GetObjectCommand({
  Bucket: bucket,
  Key: versionData.apkgR2Key,
})
const downloadUrl = await getSignedUrl(client, command, { expiresIn: 3600 }) // 1 hour
```

8. Atomically increment download count on the deck document:

```typescript
await adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId).update({
  downloadCount: FieldValue.increment(1),
  lastDownloadAt: FieldValue.serverTimestamp(),
})
```

9. Return:

```typescript
return NextResponse.json({
  success: true,
  downloadUrl,
  filename: versionData.apkgFilename,
  sizeBytes: versionData.sizeBytes,
  expiresIn: 3600,
} as DeckDownloadResponse)
```

---

### File 4: `src/app/api/deckmarket/decks/[deckId]/versions/[versionId]/download/route.ts`

**Exports:** `GET` (download a specific version)

Same pattern as File 3, but:

1. Get both `deckId` and `versionId` from route params:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string; versionId: string }> }
) {
  const { deckId, versionId } = await params
```

2. Verify deck exists AND `isPublished === true`
3. Fetch the specific version document (not latest)
4. Generate presigned download URL for that version's `apkgR2Key`
5. **Also** increment `downloadCount` on the deck (same as latest download)
6. Return same `DeckDownloadResponse` shape

---

## Critical Patterns to Follow

### Auth pattern (NOT withAdminAuth)

Public routes use `getSession()` directly — **NOT** `withAdminAuth`:

```typescript
export async function GET(request: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // session.uid, session.email available
}
```

### No entitlement checks

DeckMarket is available to ALL logged-in users (free + premium). Do NOT import or check `evaluateFeatureAccess` or `getUserPlan`. Just check `getSession()` is non-null.

### Route params in Next.js 15

Params are a Promise in Next.js 15. Always await them:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const { deckId } = await params
```

### isPublished guard

Every public route that returns deck data MUST check `isPublished === true`. This is a security requirement. Draft decks must not be visible to non-admin users.

### Firestore imports

```typescript
import { adminFirestore, FieldValue } from '@/lib/firebase/admin'
```

### R2 presigned download URL

```typescript
import { getR2Config } from '@/lib/r2/r2-client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const { client, bucket } = getR2Config()
const command = new GetObjectCommand({ Bucket: bucket, Key: r2Key })
const url = await getSignedUrl(client, command, { expiresIn: 3600 })
```

### Timestamp serialization

```typescript
const data = doc.data()
const serialized = {
  ...data,
  createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
  updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
}
```

### Error response shape

```typescript
return NextResponse.json({ error: 'Message' }, { status: 4xx })
```

### Success response shape

```typescript
return NextResponse.json({ success: true, data: { ... } })
```

---

## Reference Files (READ these before coding)

1. `src/lib/auth/session.ts` — `getSession()` returns `SessionUser | null` with `{ uid, email, tier, admin, sessionId }`
2. `src/app/api/flashcards/decks/route.ts` — Example public route with `getSession()` auth
3. `src/app/api/flashcards/r2/[deckId]/route.ts` — Presigned download URL pattern (GetObjectCommand)
4. `src/lib/r2/r2-client.ts` — `getR2Config()` returns `{ client, bucket, signedUrlTtlSeconds }`
5. `src/types/deckmarket.ts` — All type imports
6. `src/lib/firebase/admin.ts` — `adminFirestore`, `FieldValue` exports

---

## Validation Checklist (Agent must verify before completion)

- [ ] All 4 files created in correct paths
- [ ] All routes use `getSession()` for auth (NOT `withAdminAuth`)
- [ ] No entitlement/feature access checks (DeckMarket is free for all logged-in users)
- [ ] Every route that returns deck data checks `isPublished === true`
- [ ] Draft decks return 404 (not 403) to avoid revealing existence
- [ ] Route params awaited as Promises (`const { deckId } = await params`)
- [ ] Download routes use `getR2Config()` for R2 client
- [ ] Download routes increment `downloadCount` via `FieldValue.increment(1)`
- [ ] Download routes update `lastDownloadAt` via `FieldValue.serverTimestamp()`
- [ ] Presigned download URLs use 3600 second TTL (1 hour)
- [ ] All Firestore Timestamps converted to ISO strings in responses
- [ ] Types imported from `@/types/deckmarket`
- [ ] No new auth patterns introduced
