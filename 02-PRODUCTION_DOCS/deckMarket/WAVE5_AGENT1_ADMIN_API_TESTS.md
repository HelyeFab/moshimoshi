# Wave 5 — Agent 1: Admin API Route Tests

**Role:** spec-impl
**Depends on:** Wave 2 (Admin API routes) — all DONE
**Parallel with:** Agent 2 (Public API tests)

---

## Objective

Create 5 test files for the DeckMarket admin API routes. Follow the existing flashcard API test patterns exactly: Jest with ts-jest, `__tests__/` directories alongside route code, mock all external dependencies.

---

## Mocking Strategy (CRITICAL — read carefully)

### The `withAdminAuth` challenge

Admin routes use `withAdminAuth` which:
1. Imports `'server-only'` at module top (must be mocked or Jest crashes)
2. Dynamically imports `getSession` from `@/lib/auth/session`
3. Calls `isAdminUserCached` from `@/lib/firebase/admin`
4. Resolves route params as Promises (Next.js 15)
5. Passes `AdminContext` to the handler

### Standard mock block for ALL admin route tests

Every admin test file MUST start with these mocks:

```typescript
import { NextRequest } from 'next/server'

// Mock server-only (withAdminAuth imports it)
jest.mock('server-only', () => ({}))

// Mock auth/session for withAdminAuth's dynamic import
jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

// Mock firebase/admin
jest.mock('@/lib/firebase/admin', () => ({
  adminAuth: null,
  isAdminUserCached: jest.fn(),
  adminFirestore: null, // Will be set per test via mockAdminFirestore
  ensureAdminInitialized: jest.fn(),
  FieldValue: {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n: number) => `INCREMENT_${n}`),
  },
}))

import { getSession } from '@/lib/auth/session'
import { isAdminUserCached, FieldValue } from '@/lib/firebase/admin'

const mockedGetSession = getSession as jest.Mock
const mockedIsAdmin = isAdminUserCached as jest.Mock
```

### Setting up admin auth for success cases

```typescript
function mockAdminAuth() {
  mockedGetSession.mockResolvedValue({
    uid: 'admin-1',
    email: 'admin@test.com',
    admin: true,
    tier: 'admin',
    sessionId: 'sess-1',
  })
  mockedIsAdmin.mockResolvedValue(true)
}
```

### Setting up auth for failure cases

```typescript
// No session (401)
mockedGetSession.mockResolvedValue(null)

// Not admin (403)
mockedGetSession.mockResolvedValue({ uid: 'user-1', email: 'user@test.com' })
mockedIsAdmin.mockResolvedValue(false)
```

### Mocking adminFirestore

Since `adminFirestore` is a module-level export, we need to set it dynamically. The pattern:

```typescript
// At the top after the jest.mock block:
import * as firebaseAdmin from '@/lib/firebase/admin'

// In beforeEach or individual tests:
function setMockFirestore(mockDb: any) {
  Object.defineProperty(firebaseAdmin, 'adminFirestore', {
    value: mockDb,
    writable: true,
    configurable: true,
  })
}
```

### Building mock Firestore

Follow the chained query pattern from existing tests:

```typescript
function createMockFirestore(collections: Record<string, any>) {
  return {
    collection: jest.fn((name: string) => collections[name] || {
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ exists: false }),
            set: jest.fn().mockResolvedValue(undefined),
          })),
          orderBy: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ docs: [] }),
            limit: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({ docs: [] }),
            })),
          })),
        })),
      })),
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [] }),
        })),
      })),
      orderBy: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ docs: [] }),
      })),
    }),
  }
}
```

### Mocking R2 (for upload + delete routes)

```typescript
jest.mock('@/lib/r2/r2-client', () => ({
  getR2Config: jest.fn(() => ({
    client: { send: jest.fn().mockResolvedValue({}) },
    bucket: 'test-bucket',
    signedUrlTtlSeconds: 900,
  })),
}))

jest.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: jest.fn().mockImplementation((params) => params),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => params),
}))

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned-url.example.com/upload'),
}))
```

---

## Files to Create

### File 1: `src/app/api/admin/deckmarket/decks/__tests__/route.test.ts`

**Tests for:** GET (list decks) + POST (create deck)

```typescript
import { GET, POST } from '../route'
```

**Test cases:**

```
describe('/api/admin/deckmarket/decks GET', () => {
  it('returns 401 when no session')
  it('returns 403 when user is not admin')
  it('returns empty array when no decks exist')
  it('returns all decks with serialized timestamps')
  it('filters by published=true')
  it('filters by published=false')
  it('filters by search query')
})

describe('/api/admin/deckmarket/decks POST', () => {
  it('returns 401 when no session')
  it('returns 400 when title is missing')
  it('returns 400 when title is empty string')
  it('returns 400 for invalid slug format')
  it('returns 400 when slug already exists')
  it('returns 400 for invalid JLPT level')
  it('creates deck with correct document shape')
  it('auto-generates slug from title when id not provided')
})
```

**GET success mock example:**

```typescript
it('returns all decks with serialized timestamps', async () => {
  mockAdminAuth()

  const mockDoc = {
    id: 'genki-1',
    data: () => ({
      title: 'Genki 1',
      description: 'A deck',
      tags: ['vocabulary'],
      jlpt: 'N5',
      language: 'ja',
      downloadCount: 42,
      isPublished: true,
      updatedAt: { toDate: () => new Date('2026-02-09T00:00:00Z') },
      createdAt: { toDate: () => new Date('2026-02-01T00:00:00Z') },
    }),
  }

  const mockCollection = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({ docs: [mockDoc] }),
    })),
  }

  setMockFirestore({
    collection: jest.fn(() => mockCollection),
  })

  const request = new NextRequest('http://localhost/api/admin/deckmarket/decks')
  const response = await GET(request, { params: Promise.resolve({}) })
  const data = await response.json()

  expect(response.status).toBe(200)
  expect(data.success).toBe(true)
  expect(data.data).toHaveLength(1)
  expect(data.data[0].id).toBe('genki-1')
  expect(data.data[0].title).toBe('Genki 1')
  expect(data.data[0].isPublished).toBe(true)
  expect(data.data[0].updatedAt).toBe('2026-02-09T00:00:00.000Z')
})
```

**POST success mock example:**

```typescript
it('creates deck with correct document shape', async () => {
  mockAdminAuth()

  const mockSet = jest.fn().mockResolvedValue(undefined)
  const mockGet = jest.fn().mockResolvedValue({ exists: false })

  setMockFirestore({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: mockGet,
        set: mockSet,
      })),
    })),
  })

  const request = new NextRequest('http://localhost/api/admin/deckmarket/decks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Test Deck',
      id: 'test-deck',
      description: 'A test deck',
      language: 'ja',
      jlpt: 'N5',
      tags: ['test'],
    }),
  })

  const response = await POST(request, { params: Promise.resolve({}) })
  const data = await response.json()

  expect(response.status).toBe(200)
  expect(data.success).toBe(true)
  expect(data.data.id).toBe('test-deck')
  expect(mockSet).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'test-deck',
      title: 'Test Deck',
      isPublished: false,
      downloadCount: 0,
    })
  )
})
```

**Calling convention for admin routes:**

Admin routes wrapped with `withAdminAuth` are exported as `const GET = withAdminAuth(handler)`. The returned function signature is `(request: NextRequest, routeContext: { params: Promise<Record<string, string>> })`. So call them like:

```typescript
// Routes with no path params
await GET(request, { params: Promise.resolve({}) })

// Routes with path params
await GET(request, { params: Promise.resolve({ deckId: 'genki-1' }) })
```

---

### File 2: `src/app/api/admin/deckmarket/decks/[deckId]/__tests__/route.test.ts`

**Tests for:** GET (deck detail) + PATCH (update deck)

```typescript
import { GET, PATCH } from '../route'
```

**Test cases:**

```
describe('/api/admin/deckmarket/decks/[deckId] GET', () => {
  it('returns 401 when no session')
  it('returns 404 when deck does not exist')
  it('returns deck with versions and latestVersion')
  it('returns empty versions array when no versions exist')
})

describe('/api/admin/deckmarket/decks/[deckId] PATCH', () => {
  it('returns 404 when deck does not exist')
  it('returns 400 when no valid fields provided')
  it('updates only provided fields')
  it('updates isPublished toggle')
  it('always includes updatedAt in update')
})
```

**GET detail mock — need nested subcollection:**

```typescript
const mockDeckDoc = {
  exists: true,
  data: () => ({
    title: 'Genki 1',
    description: 'Test',
    language: 'ja',
    jlpt: 'N5',
    tags: ['vocab'],
    isPublished: true,
    latestVersionId: 'v-1',
    downloadCount: 10,
    lastDownloadAt: { toDate: () => new Date('2026-02-09') },
    createdAt: { toDate: () => new Date('2026-02-01') },
    updatedAt: { toDate: () => new Date('2026-02-09') },
  }),
}

const mockVersionDoc = {
  id: 'v-1',
  data: () => ({
    deckId: 'genki-1',
    versionLabel: 'v1',
    changelog: 'Initial',
    apkgR2Key: 'deckmarket/genki-1/v-1/genki.apkg',
    apkgFilename: 'genki.apkg',
    sizeBytes: 1024000,
    sha256: null,
    createdAt: { toDate: () => new Date('2026-02-01') },
    createdByUid: 'admin-1',
  }),
}
```

Build the Firestore mock so `.collection('deckmarket_decks').doc('genki-1').get()` returns the deck and `.collection('deckmarket_decks').doc('genki-1').collection('versions').orderBy('createdAt', 'desc').get()` returns versions.

---

### File 3: `src/app/api/admin/deckmarket/decks/[deckId]/upload/__tests__/route.test.ts`

**Tests for:** POST (presigned upload URL + version doc creation)

**Additional mocks needed:** R2 + uuid

```typescript
jest.mock('@/lib/r2/r2-client', () => ({
  getR2Config: jest.fn(() => ({
    client: { send: jest.fn().mockResolvedValue({}) },
    bucket: 'test-bucket',
  })),
}))

jest.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: jest.fn().mockImplementation((p) => p),
}))

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned.example.com/put'),
}))
```

Note: `uuid` is already mocked via `moduleNameMapper` in jest.config.js → returns `'00000000-0000-4000-8000-000000000000'`.

**Test cases:**

```
describe('/api/admin/deckmarket/decks/[deckId]/upload POST', () => {
  it('returns 401 when no session')
  it('returns 404 when deck does not exist')
  it('returns 400 when filename is missing')
  it('returns 400 when fileSize is zero')
  it('returns 400 when fileSize exceeds 200MB')
  it('returns 400 for non-.apkg extension')
  it('returns 400 for filename with path traversal')
  it('returns presigned URL and creates version doc')
  it('updates deck latestVersionId')
})
```

**Success case verification:**

```typescript
it('returns presigned URL and creates version doc', async () => {
  mockAdminAuth()
  // ... set up mock Firestore with deck existing

  const response = await POST(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
  const data = await response.json()

  expect(response.status).toBe(200)
  expect(data.success).toBe(true)
  expect(data.uploadUrl).toBe('https://presigned.example.com/put')
  expect(data.versionId).toBe('00000000-0000-4000-8000-000000000000') // mocked uuid
  expect(data.r2Key).toContain('deckmarket/test-deck/')
  expect(data.expiresIn).toBe(900)
  expect(mockVersionSet).toHaveBeenCalledWith(
    expect.objectContaining({
      deckId: 'test-deck',
      sizeBytes: 1024,
      createdByUid: 'admin-1',
    })
  )
})
```

---

### File 4: `src/app/api/admin/deckmarket/decks/[deckId]/import-csv/__tests__/route.test.ts`

**Tests for:** POST (CSV import)

**Additional mocks:** R2, fs, os, child_process

```typescript
jest.mock('@/lib/r2/r2-client', () => ({
  getR2Config: jest.fn(() => ({
    client: { send: jest.fn().mockResolvedValue({}) },
    bucket: 'test-bucket',
  })),
}))

jest.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: jest.fn().mockImplementation((p) => p),
}))

// Mock child_process.execFile
jest.mock('child_process', () => ({
  execFile: jest.fn((_cmd, _args, callback) => {
    callback(null, 'OK', '')
  }),
}))

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    mkdtemp: jest.fn().mockResolvedValue('/tmp/deckmarket-abc'),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from('fake-apkg-content')),
    rm: jest.fn().mockResolvedValue(undefined),
  },
}))
```

**Test cases:**

```
describe('/api/admin/deckmarket/decks/[deckId]/import-csv POST', () => {
  it('returns 401 when no session')
  it('returns 404 when deck does not exist')
  it('returns 400 when no file provided')
  it('returns 400 for non-.csv file')
  it('returns 400 for empty file')
  it('converts CSV and uploads to R2')
  it('creates version doc in Firestore')
  it('cleans up temp directory on success')
  it('cleans up temp directory on error')
})
```

**Note:** For multipart form data, create a `FormData`-like mock or use the Web API `FormData`. Since we're in Node/Jest, test with:

```typescript
const formData = new FormData()
formData.append('file', new File(['front,back\nhello,world'], 'test.csv', { type: 'text/csv' }))
formData.append('versionLabel', 'v1')

const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/import-csv', {
  method: 'POST',
  body: formData,
})
```

If `File` / `FormData` are not available in the test environment, you may need to polyfill or use `node:buffer` Blob. Check if the existing Jest config handles this. If not, skip the multipart parsing tests and focus on the non-file validation paths.

---

### File 5: `src/app/api/admin/deckmarket/decks/[deckId]/versions/[versionId]/__tests__/route.test.ts`

**Tests for:** DELETE (remove version)

**Additional mocks:** R2

```typescript
jest.mock('@/lib/r2/r2-client', () => ({
  getR2Config: jest.fn(() => ({
    client: { send: jest.fn().mockResolvedValue({}) },
    bucket: 'test-bucket',
  })),
}))

jest.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: jest.fn().mockImplementation((p) => p),
}))
```

**Test cases:**

```
describe('/api/admin/deckmarket/decks/[deckId]/versions/[versionId] DELETE', () => {
  it('returns 401 when no session')
  it('returns 404 when deck does not exist')
  it('returns 404 when version does not exist')
  it('deletes R2 object and Firestore doc')
  it('cascades latestVersionId to next version when deleting latest')
  it('sets latestVersionId to null when deleting the only version')
})
```

**Cascade test mock:**

```typescript
it('cascades latestVersionId to next version when deleting latest', async () => {
  mockAdminAuth()

  const mockUpdate = jest.fn().mockResolvedValue(undefined)
  const mockDeleteDoc = jest.fn().mockResolvedValue(undefined)

  // Deck has latestVersionId = 'v-1' (the one we're deleting)
  const deckData = { latestVersionId: 'v-1' }
  // After deletion, next most recent is 'v-2'
  const nextVersionSnapshot = {
    docs: [{ id: 'v-2' }],
  }

  // Set up mock so:
  // - deckRef.get() returns deck with latestVersionId: 'v-1'
  // - versionRef.get() returns version with apkgR2Key
  // - versionRef.delete() succeeds
  // - deckRef.collection('versions').orderBy().limit(1).get() returns v-2
  // - deckRef.update() records the new latestVersionId

  // ... (build Firestore mock)

  const request = new NextRequest('http://localhost/api/admin/deckmarket/decks/test-deck/versions/v-1', {
    method: 'DELETE',
  })
  const response = await DELETE(request, {
    params: Promise.resolve({ deckId: 'test-deck', versionId: 'v-1' }),
  })

  expect(response.status).toBe(200)
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ latestVersionId: 'v-2' })
  )
})
```

---

## Critical Patterns to Follow

### Test file naming
`__tests__/route.test.ts` inside the same directory as the route file.

### Import the route handlers
```typescript
import { GET, POST } from '../route'   // or PATCH, DELETE
```

### Calling admin route handlers
Admin routes return a function from `withAdminAuth`. The outer function expects `(request, { params: Promise<...> })`:

```typescript
// No path params
await GET(request, { params: Promise.resolve({}) })

// With deckId
await GET(request, { params: Promise.resolve({ deckId: 'test-deck' }) })

// With deckId + versionId
await DELETE(request, { params: Promise.resolve({ deckId: 'test-deck', versionId: 'v-1' }) })
```

### Asserting responses
```typescript
const response = await GET(request, { params: Promise.resolve({}) })
expect(response.status).toBe(200)
const data = await response.json()
expect(data.success).toBe(true)
```

### beforeEach cleanup
```typescript
beforeEach(() => {
  jest.clearAllMocks()
})
```

---

## Reference Files (READ these before coding)

1. `src/app/api/flashcards/decks/__tests__/route.test.ts` — Best example of route test pattern with Firestore mocking
2. `src/app/api/flashcards/r2/upload-url/__tests__/route.test.ts` — Upload URL test pattern
3. `src/app/api/flashcards/r2/[deckId]/__tests__/route.test.ts` — Route with path params + FieldValue mock
4. `jest.config.js` — Test configuration (uuid mock mapping, ts-jest settings)
5. `src/__mocks__/uuid.ts` — UUID mock (returns fixed value)
6. `src/lib/admin/adminAuth.ts` — `withAdminAuth` implementation (understand what to mock)
7. `src/lib/firebase/admin.ts` — Exports to mock: `adminFirestore`, `ensureAdminInitialized`, `FieldValue`, `isAdminUserCached`

---

## Validation Checklist

- [ ] All 5 test files created at correct `__tests__/` paths
- [ ] All tests use Jest (not Vitest)
- [ ] `server-only` is mocked in every admin test file
- [ ] `getSession` + `isAdminUserCached` mocked for auth
- [ ] `adminFirestore` mocked with chainable Firestore queries
- [ ] `FieldValue.serverTimestamp()` and `FieldValue.increment()` mocked
- [ ] R2 mocked for upload + delete routes (`getR2Config`, S3 commands, `getSignedUrl`)
- [ ] UUID mock returns deterministic value (via jest.config.js mapping)
- [ ] Auth failure tests (401 no session, 403 not admin) in each file
- [ ] All tests pass: `npx jest src/app/api/admin/deckmarket --verbose`
- [ ] No actual Firestore, R2, or network calls made during tests
