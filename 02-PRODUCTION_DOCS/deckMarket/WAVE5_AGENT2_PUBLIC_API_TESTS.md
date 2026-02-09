# Wave 5 — Agent 2: Public API Route Tests

**Role:** spec-impl
**Depends on:** Wave 2 (Public API routes) — all DONE
**Parallel with:** Agent 1 (Admin API tests)

---

## Objective

Create 4 test files for the DeckMarket public API routes. Follow the existing flashcard API test patterns exactly: Jest with ts-jest, `__tests__/` directories alongside route code, mock all external dependencies.

**Key difference from admin tests:** Public routes use `getSession()` directly (not `withAdminAuth`), don't check entitlements, and must verify the `isPublished` guard.

---

## Mocking Strategy

### Standard mock block for ALL public route tests

```typescript
import { NextRequest } from 'next/server'

// Mock auth session
jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}))

// Mock firebase admin
jest.mock('@/lib/firebase/admin', () => ({
  adminFirestore: null, // Set per test
  FieldValue: {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n: number) => `INCREMENT_${n}`),
  },
}))

import { getSession } from '@/lib/auth/session'
import * as firebaseAdmin from '@/lib/firebase/admin'

const mockedGetSession = getSession as jest.Mock

function setMockFirestore(mockDb: any) {
  Object.defineProperty(firebaseAdmin, 'adminFirestore', {
    value: mockDb,
    writable: true,
    configurable: true,
  })
}
```

### Auth helpers

```typescript
function mockLoggedIn() {
  mockedGetSession.mockResolvedValue({
    uid: 'user-1',
    email: 'user@test.com',
    tier: 'free',
    admin: false,
    sessionId: 'sess-1',
  })
}

function mockNotLoggedIn() {
  mockedGetSession.mockResolvedValue(null)
}
```

### R2 mocks (for download routes)

```typescript
jest.mock('@/lib/r2/r2-client', () => ({
  getR2Config: jest.fn(() => ({
    client: { send: jest.fn().mockResolvedValue({}) },
    bucket: 'test-bucket',
    signedUrlTtlSeconds: 3600,
  })),
}))

jest.mock('@/lib/r2/r2-keys', () => ({
  isValidDeckKey: jest.fn(() => true),
}))

jest.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: jest.fn().mockImplementation((p) => p),
}))

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned.example.com/download'),
}))
```

### Firestore document helpers

```typescript
function createMockDeckDoc(overrides: Record<string, any> = {}) {
  return {
    exists: true,
    id: 'test-deck',
    data: () => ({
      title: 'Test Deck',
      description: 'A test deck',
      language: 'ja',
      jlpt: 'N5',
      tags: ['vocab'],
      isPublished: true,
      latestVersionId: 'v-1',
      downloadCount: 42,
      lastDownloadAt: { toDate: () => new Date('2026-02-08') },
      createdAt: { toDate: () => new Date('2026-02-01') },
      updatedAt: { toDate: () => new Date('2026-02-09') },
      ...overrides,
    }),
  }
}

function createMockVersionDoc(id: string = 'v-1', overrides: Record<string, any> = {}) {
  return {
    exists: true,
    id,
    data: () => ({
      deckId: 'test-deck',
      versionLabel: 'v1',
      changelog: 'Initial release',
      apkgR2Key: `deckmarket/test-deck/${id}/deck.apkg`,
      apkgFilename: 'deck.apkg',
      sizeBytes: 1024000,
      sha256: null,
      createdAt: { toDate: () => new Date('2026-02-01') },
      createdByUid: 'admin-1',
      ...overrides,
    }),
  }
}
```

---

## Files to Create

### File 1: `src/app/api/deckmarket/decks/__tests__/route.test.ts`

**Tests for:** GET (list published decks, paginated)

```typescript
import { GET } from '../route'
```

**Test cases:**

```
describe('/api/deckmarket/decks GET', () => {
  it('returns 401 when no session')
  it('returns published decks only')
  it('returns correct pagination shape')
  it('returns empty items when no published decks')
  it('filters by JLPT level')
  it('filters by language')
  it('searches by title (case-insensitive)')
  it('searches by description')
  it('paginates correctly with page and pageSize')
})
```

**Example: returns 401 when no session:**

```typescript
it('returns 401 when no session', async () => {
  mockNotLoggedIn()

  const request = new NextRequest('http://localhost/api/deckmarket/decks')
  const response = await GET(request)

  expect(response.status).toBe(401)
  const data = await response.json()
  expect(data.error).toBe('Unauthorized')
})
```

**Example: returns published decks only:**

```typescript
it('returns published decks only', async () => {
  mockLoggedIn()

  const mockDocs = [
    {
      id: 'deck-1',
      data: () => ({
        title: 'Genki',
        description: 'A deck',
        tags: [],
        jlpt: 'N5',
        language: 'ja',
        downloadCount: 10,
        isPublished: true,
        updatedAt: { toDate: () => new Date('2026-02-09') },
      }),
    },
  ]

  const mockQuery = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    count: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({ data: () => ({ count: 1 }) }),
    })),
    get: jest.fn().mockResolvedValue({ docs: mockDocs }),
  }

  setMockFirestore({
    collection: jest.fn(() => mockQuery),
  })

  const request = new NextRequest('http://localhost/api/deckmarket/decks?page=1&pageSize=20')
  const response = await GET(request)
  const data = await response.json()

  expect(response.status).toBe(200)
  expect(data.success).toBe(true)
  expect(data.data.items).toHaveLength(1)
  expect(data.data.items[0].id).toBe('deck-1')
  expect(data.data.page).toBe(1)
  expect(data.data.pageSize).toBe(20)
})
```

**Note on the public list route:** It calls `.where('isPublished', '==', true)` — verify the mock's `.where()` is called with these args:

```typescript
expect(mockQuery.where).toHaveBeenCalledWith('isPublished', '==', true)
```

---

### File 2: `src/app/api/deckmarket/decks/[deckId]/__tests__/route.test.ts`

**Tests for:** GET (deck detail + versions)

```typescript
import { GET } from '../route'
```

**Calling convention for routes with params (Next.js 15):**

```typescript
const response = await GET(request, {
  params: Promise.resolve({ deckId: 'test-deck' }),
})
```

**Test cases:**

```
describe('/api/deckmarket/decks/[deckId] GET', () => {
  it('returns 401 when no session')
  it('returns 404 when deck does not exist')
  it('returns 404 when deck is not published (draft)')
  it('returns deck with versions and latestVersion')
  it('returns null latestVersion when latestVersionId is null')
  it('serializes all Firestore Timestamps to ISO strings')
})
```

**Critical test: unpublished returns 404 (security):**

```typescript
it('returns 404 when deck is not published', async () => {
  mockLoggedIn()

  const deckDoc = createMockDeckDoc({ isPublished: false })

  setMockFirestore({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue(deckDoc),
      })),
    })),
  })

  const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck')
  const response = await GET(request, {
    params: Promise.resolve({ deckId: 'test-deck' }),
  })

  expect(response.status).toBe(404)
  const data = await response.json()
  expect(data.error).toBe('Deck not found')
})
```

**Success case — build nested Firestore mock:**

```typescript
it('returns deck with versions and latestVersion', async () => {
  mockLoggedIn()

  const deckDoc = createMockDeckDoc()
  const versionDoc = createMockVersionDoc('v-1')

  const mockDocRef = {
    get: jest.fn().mockResolvedValue(deckDoc),
    collection: jest.fn(() => ({
      orderBy: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ docs: [versionDoc] }),
      })),
    })),
  }

  setMockFirestore({
    collection: jest.fn(() => ({
      doc: jest.fn(() => mockDocRef),
    })),
  })

  const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck')
  const response = await GET(request, {
    params: Promise.resolve({ deckId: 'test-deck' }),
  })
  const data = await response.json()

  expect(response.status).toBe(200)
  expect(data.success).toBe(true)
  expect(data.data.deck.id).toBe('test-deck')
  expect(data.data.deck.isPublished).toBe(true)
  expect(data.data.versions).toHaveLength(1)
  expect(data.data.latestVersion.id).toBe('v-1')
})
```

---

### File 3: `src/app/api/deckmarket/decks/[deckId]/download/__tests__/route.test.ts`

**Tests for:** GET (download latest version — presigned URL + stats)

```typescript
import { GET } from '../route'
```

**Additional mocks needed:** R2 + r2-keys (see mocking strategy above)

**Test cases:**

```
describe('/api/deckmarket/decks/[deckId]/download GET', () => {
  it('returns 401 when no session')
  it('returns 404 when deck does not exist')
  it('returns 404 when deck is not published')
  it('returns 404 when no latestVersionId')
  it('returns 404 when version doc does not exist')
  it('returns presigned download URL')
  it('increments downloadCount on the deck document')
  it('updates lastDownloadAt on the deck document')
  it('returns correct DeckDownloadResponse shape')
})
```

**Success case:**

```typescript
it('returns presigned download URL and increments stats', async () => {
  mockLoggedIn()

  const mockUpdate = jest.fn().mockResolvedValue(undefined)
  const deckDoc = createMockDeckDoc({ latestVersionId: 'v-1' })
  const versionDoc = createMockVersionDoc('v-1')

  const mockDocRef = {
    get: jest.fn().mockResolvedValue(deckDoc),
    update: mockUpdate,
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue(versionDoc),
      })),
    })),
  }

  setMockFirestore({
    collection: jest.fn(() => ({
      doc: jest.fn(() => mockDocRef),
    })),
  })

  const request = new NextRequest('http://localhost/api/deckmarket/decks/test-deck/download')
  const response = await GET(request, {
    params: Promise.resolve({ deckId: 'test-deck' }),
  })
  const data = await response.json()

  expect(response.status).toBe(200)
  expect(data.success).toBe(true)
  expect(data.downloadUrl).toBe('https://presigned.example.com/download')
  expect(data.filename).toBe('deck.apkg')
  expect(data.sizeBytes).toBe(1024000)
  expect(data.expiresIn).toBe(3600)

  // Verify stats were incremented
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      downloadCount: 'INCREMENT_1',
      lastDownloadAt: 'SERVER_TIMESTAMP',
    })
  )
})
```

**Note:** `FieldValue.increment(1)` returns `'INCREMENT_1'` and `FieldValue.serverTimestamp()` returns `'SERVER_TIMESTAMP'` per our mock — so we check the update call with those sentinel values.

---

### File 4: `src/app/api/deckmarket/decks/[deckId]/versions/[versionId]/download/__tests__/route.test.ts`

**Tests for:** GET (download specific version)

```typescript
import { GET } from '../route'
```

**Same mocks as File 3** (R2 + r2-keys)

**Calling convention — two path params:**

```typescript
const response = await GET(request, {
  params: Promise.resolve({ deckId: 'test-deck', versionId: 'v-2' }),
})
```

**Test cases:**

```
describe('/api/deckmarket/decks/[deckId]/versions/[versionId]/download GET', () => {
  it('returns 401 when no session')
  it('returns 404 when deck does not exist')
  it('returns 404 when deck is not published')
  it('returns 404 when specific version does not exist')
  it('returns presigned download URL for specific version')
  it('increments downloadCount on deck (same as latest download)')
  it('returns correct DeckDownloadResponse shape')
})
```

**Note:** This route is nearly identical to File 3, but fetches a specific version doc instead of the latest. The mock setup is the same except the version lookup uses the provided `versionId` instead of `deck.latestVersionId`.

---

## Critical Patterns to Follow

### Test file naming
`__tests__/route.test.ts` inside the same directory as the route file.

### Import the route handler
```typescript
import { GET } from '../route'
```

### Calling public route handlers
Public routes export plain async functions (not wrapped by `withAdminAuth`):

```typescript
// No path params
await GET(request)

// With path params (Next.js 15 — params as Promise)
await GET(request, { params: Promise.resolve({ deckId: 'test-deck' }) })

// With multiple path params
await GET(request, { params: Promise.resolve({ deckId: 'test-deck', versionId: 'v-1' }) })
```

### Asserting responses
```typescript
const response = await GET(request, { params: Promise.resolve({ deckId: 'test-deck' }) })
expect(response.status).toBe(200)
const data = await response.json()
expect(data.success).toBe(true)
expect(data.data.deck.id).toBe('test-deck')
```

### beforeEach cleanup
```typescript
beforeEach(() => {
  jest.clearAllMocks()
})
```

### No entitlement checks
DeckMarket is free for all logged-in users. Do NOT mock or import `evaluateFeatureAccess` or `getUserPlan`. Only mock `getSession()`.

---

## Reference Files (READ these before coding)

1. `src/app/api/flashcards/decks/__tests__/route.test.ts` — Best example of public route test with Firestore mock chains
2. `src/app/api/flashcards/r2/[deckId]/__tests__/route.test.ts` — R2 download test with FieldValue mock + route params
3. `src/app/api/flashcards/r2/upload-url/__tests__/route.test.ts` — Session mock pattern
4. `jest.config.js` — Test config, module aliases
5. `src/__mocks__/uuid.ts` — UUID mock (returns fixed value)
6. `src/lib/auth/session.ts` — `getSession()` returns `SessionUser | null`
7. `src/lib/r2/r2-client.ts` — `getR2Config()` returns `{ client, bucket, signedUrlTtlSeconds }`
8. `src/lib/r2/r2-keys.ts` — `isValidDeckKey()` function to mock

---

## Validation Checklist

- [ ] All 4 test files created at correct `__tests__/` paths
- [ ] All tests use Jest (not Vitest)
- [ ] `getSession` mocked for auth (not `withAdminAuth`)
- [ ] `adminFirestore` mocked with chainable Firestore queries
- [ ] `FieldValue.serverTimestamp()` and `FieldValue.increment()` mocked
- [ ] R2 mocked for download routes (`getR2Config`, `GetObjectCommand`, `getSignedUrl`, `isValidDeckKey`)
- [ ] Auth failure test (401 no session) in each file
- [ ] `isPublished` guard test (404 for drafts) in detail + download routes
- [ ] Download routes verify `downloadCount` increment and `lastDownloadAt` update
- [ ] No entitlement checks imported or mocked
- [ ] All tests pass: `npx jest src/app/api/deckmarket --verbose`
- [ ] No actual Firestore, R2, or network calls made during tests
