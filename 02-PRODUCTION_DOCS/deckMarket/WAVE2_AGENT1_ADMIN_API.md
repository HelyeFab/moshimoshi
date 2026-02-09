# Wave 2 — Agent 1: Admin API Routes

**Role:** spec-impl
**Depends on:** Wave 1 (types, i18n, Firestore rules) — all DONE
**Parallel with:** Agent 2 (Public API)

---

## Objective

Create 4 API route files under `src/app/api/admin/deckmarket/` that let admins manage DeckMarket decks. All routes use the `withAdminAuth` wrapper for authentication.

---

## Files to Create

### File 1: `src/app/api/admin/deckmarket/decks/route.ts`

**Exports:** `GET` (list all decks), `POST` (create deck)

#### GET — List all decks (published + drafts)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore } from '@/lib/firebase/admin'
import { DECKMARKET_COLLECTION } from '@/types/deckmarket'
import type { DeckMarketDeck, DeckListItem } from '@/types/deckmarket'
```

- Wrap with `withAdminAuth`
- Read optional query params: `?search=`, `?published=true|false`
- Query `deckmarket_decks` collection, ordered by `updatedAt` DESC
- If `published` param exists, filter by `isPublished`
- Map documents to `DeckListItem` shape
- Convert Firestore Timestamps to ISO strings: `doc.data().createdAt?.toDate?.()?.toISOString()`
- Return `{ success: true, data: items }`

#### POST — Create new deck

- Wrap with `withAdminAuth`
- Parse body as `CreateDeckRequest` from `@/types/deckmarket`
- Validate: `title` required (non-empty string), `id` (slug) must be lowercase alphanumeric with hyphens (`/^[a-z0-9][a-z0-9-]*[a-z0-9]$/`), minimum 3 chars
- If `id` not provided, auto-generate slug from title: lowercase, replace spaces with hyphens, strip special chars
- Check slug uniqueness: `adminFirestore.collection(DECKMARKET_COLLECTION).doc(slug).get()` — if exists, return 400
- Create document with `adminFirestore.collection(DECKMARKET_COLLECTION).doc(slug).set({...})`
- Document shape:

```typescript
{
  id: slug,
  title: body.title,
  description: body.description || '',
  language: body.language || 'ja',
  jlpt: body.jlpt || null,
  tags: body.tags || [],
  isPublished: false,
  latestVersionId: null,
  downloadCount: 0,
  lastDownloadAt: null,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
}
```

- Return `{ success: true, data: { id: slug } }`

---

### File 2: `src/app/api/admin/deckmarket/decks/[deckId]/route.ts`

**Exports:** `GET` (deck detail), `PATCH` (update deck)

#### GET — Deck detail (admin view, includes all versions)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore } from '@/lib/firebase/admin'
import { DECKMARKET_COLLECTION, VERSIONS_SUBCOLLECTION } from '@/types/deckmarket'
```

- Get `deckId` from `context.params.deckId`
- Fetch deck document: `adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId).get()`
- If not found, return 404
- Fetch versions subcollection ordered by `createdAt` DESC
- Convert all Timestamps to ISO strings
- Return `{ success: true, data: { deck, versions, latestVersion } }`

#### PATCH — Update deck metadata + publish toggle

- Get `deckId` from `context.params.deckId`
- Parse body as `UpdateDeckRequest`
- Verify deck exists (404 if not)
- Build update object with only provided fields (don't overwrite missing fields)
- Always add `updatedAt: FieldValue.serverTimestamp()`
- Run `adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId).update(updateData)`
- Return `{ success: true, data: { id: deckId } }`

---

### File 3: `src/app/api/admin/deckmarket/decks/[deckId]/upload/route.ts`

**Exports:** `POST` (generate presigned upload URL + create version doc)

This is the most critical route. Follow the existing presigned URL pattern exactly.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, FieldValue } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import {
  DECKMARKET_COLLECTION,
  VERSIONS_SUBCOLLECTION,
  DECKMARKET_R2_PREFIX,
  MAX_APKG_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
} from '@/types/deckmarket'
import type { UploadVersionRequest, UploadVersionResponse } from '@/types/deckmarket'
```

**Flow:**

1. Get `deckId` from `context.params.deckId`
2. Parse body as `UploadVersionRequest` (fields: `filename`, `fileSize`, `versionLabel?`, `changelog?`)
3. Validate:
   - Deck exists in Firestore (404 if not)
   - `filename` ends with `.apkg` (check against `ALLOWED_EXTENSIONS`)
   - `fileSize` > 0 and <= `MAX_APKG_SIZE_BYTES` (200MB)
   - Sanitise filename: strip path separators (`/`, `\`, `..`), special chars
4. Generate `versionId` with `uuidv4()`
5. Build R2 key: `deckmarket/${deckId}/${versionId}/${safeFilename}`
6. Get R2 client:

```typescript
const { client, bucket } = getR2Config()
```

7. Generate presigned PUT URL:

```typescript
const command = new PutObjectCommand({
  Bucket: bucket,
  Key: r2Key,
  ContentType: 'application/octet-stream',
})
const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 }) // 15 min
```

8. Create version document in Firestore:

```typescript
await adminFirestore
  .collection(DECKMARKET_COLLECTION)
  .doc(deckId)
  .collection(VERSIONS_SUBCOLLECTION)
  .doc(versionId)
  .set({
    id: versionId,
    deckId,
    versionLabel: body.versionLabel || `v${Date.now()}`,
    changelog: body.changelog || '',
    apkgR2Key: r2Key,
    apkgFilename: safeFilename,
    sizeBytes: body.fileSize,
    sha256: null,
    createdAt: FieldValue.serverTimestamp(),
    createdByUid: context.user.uid,
  })
```

9. Update deck's `latestVersionId` and `updatedAt`:

```typescript
await adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId).update({
  latestVersionId: versionId,
  updatedAt: FieldValue.serverTimestamp(),
})
```

10. Return response:

```typescript
return NextResponse.json({
  success: true,
  uploadUrl,
  versionId,
  r2Key,
  expiresIn: 900,
} as UploadVersionResponse)
```

---

### File 3b: `src/app/api/admin/deckmarket/decks/[deckId]/import-csv/route.ts` (NEW)

**Exports:** `POST` (CSV → .apkg conversion + upload + version doc)

**Flow:**

1. Get `deckId` from `context.params.deckId`
2. Parse `multipart/form-data` with `file` (CSV), optional `versionLabel`, `changelog`
3. Validate:
   - Deck exists in Firestore (404 if not)
   - File extension `.csv` only
4. Write CSV to temp dir
5. Run `scripts/deckmarket/csv_to_apkg.py` using `python3` + `genanki`
6. Upload generated `.apkg` to R2 using `PutObjectCommand`
7. Upload original `.csv` to R2 and store `csvR2Key`, `csvFilename`, `csvSizeBytes`
8. Create `versions/{versionId}` document in Firestore
9. Update deck's `latestVersionId` and `updatedAt`
10. Return `{ success: true, versionId, r2Key }`

**Notes:**
- Requires `genanki` installed on the server host
- CSV format: `front,back,notes` (header optional)

---

### File 4: `src/app/api/admin/deckmarket/decks/[deckId]/versions/[versionId]/route.ts`

**Exports:** `DELETE` (remove a version)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore } from '@/lib/firebase/admin'
import { getR2Config } from '@/lib/r2/r2-client'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { DECKMARKET_COLLECTION, VERSIONS_SUBCOLLECTION } from '@/types/deckmarket'
```

**Flow:**

1. Get `deckId` and `versionId` from `context.params`
2. Fetch version document from `deckmarket_decks/{deckId}/versions/{versionId}`
3. If not found, return 404
4. Delete the R2 objects using the `apkgR2Key` and optional `csvR2Key` from the version document:

```typescript
const { client, bucket } = getR2Config()
await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: versionData.apkgR2Key }))
if (versionData.csvR2Key) {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: versionData.csvR2Key }))
}
```

5. Delete the Firestore version document
6. If the deleted version was the deck's `latestVersionId`, query for the next most recent version and update the deck, or set `latestVersionId` to `null` if no versions remain
7. Return `{ success: true }`

---

## Critical Patterns to Follow

### withAdminAuth wrapper (MANDATORY for all routes)

```typescript
export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  // context.user = { uid, email, isAdmin: true }
  // context.params = { deckId: '...' } (already resolved, NOT a Promise)
  // ...
  return NextResponse.json({ success: true, data: { ... } })
})
```

### Firestore imports

```typescript
import { adminFirestore, FieldValue } from '@/lib/firebase/admin'
```

Note: Some routes use `adminFirestore` directly, some use `getAdminDb()`. Both work. Use `adminFirestore` to match the `withAdminAuth` routes pattern.

### Timestamp serialization

When reading Firestore documents that contain Timestamps, convert to ISO strings:

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
return NextResponse.json({ error: 'User-friendly message' }, { status: 4xx })
```

### Success response shape

```typescript
return NextResponse.json({ success: true, data: { ... } })
```

---

## Reference Files (READ these before coding)

1. `src/lib/admin/adminAuth.ts` — `withAdminAuth` signature and `AdminContext` interface
2. `src/app/api/admin/templates/route.ts` — Example of `withAdminAuth` with GET + POST
3. `src/app/api/flashcards/r2/upload-url/route.ts` — Presigned upload URL pattern
4. `src/lib/r2/r2-client.ts` — `getR2Config()` returns `{ client, bucket, signedUrlTtlSeconds }`
5. `src/types/deckmarket.ts` — All type imports
6. `src/lib/firebase/admin.ts` — `adminFirestore`, `FieldValue`, `Timestamp` exports
7. `scripts/deckmarket/csv_to_apkg.py` — CSV → .apkg conversion script

---

## Validation Checklist (Agent must verify before completion)

- [ ] All 4 files created in correct paths
- [ ] All routes wrapped with `withAdminAuth` (NOT manual session checks)
- [ ] Types imported from `@/types/deckmarket`
- [ ] R2 presigned URL uses `getR2Config()` (not creating new S3Client)
- [ ] Firestore Timestamps converted to ISO strings in all GET responses
- [ ] Upload route validates `.apkg` extension and 200MB size limit
- [ ] Upload route sanitises filename (no `..`, `/`, `\`)
- [ ] Delete version route also deletes R2 object
- [ ] No `import 'server-only'` in route files (not needed for API routes)
- [ ] No new auth patterns introduced
