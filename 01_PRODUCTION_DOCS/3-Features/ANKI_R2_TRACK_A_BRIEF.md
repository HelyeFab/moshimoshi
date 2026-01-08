# Track A: Phase 2+3 Implementation Brief

**Agent:** spec-impl
**Priority:** HIGH
**Parallel with:** Track B (Phase 4)
**Estimated Duration:** 4 days
**Supervisor:** Claude (this session)

---

## Objective

Implement client-side upload queue with background uploads, manifest generation, SHA-256 hashing, and Firestore metadata persistence for R2 Anki deck backups.

---

## Success Criteria

1. ✅ User can import an Anki deck (.apkg file) and it automatically uploads to R2 in the background
2. ✅ Upload doesn't block UI - user can study immediately
3. ✅ Upload queue handles:
   - Package file (.apkg)
   - All media files (images, audio)
   - Manifest file (JSON with SHA-256 hashes)
4. ✅ Failed uploads retry with exponential backoff (max 5 retries)
5. ✅ Metadata document written to Firestore after successful upload
6. ✅ UI shows backup status badge on deck cards (pending/uploading/backed up/failed)
7. ✅ Works offline: queues uploads when offline, syncs when back online
8. ✅ Concurrent upload limit: 5 uploads max across all decks

---

## Architecture Context

### Existing Infrastructure (DO NOT MODIFY)
- ✅ `src/lib/r2/r2-client.ts` - R2 client config (Phase 1)
- ✅ `src/lib/r2/r2-keys.ts` - Key validation helpers (Phase 1)
- ✅ `POST /api/anki/r2/upload-url` - Get signed upload URLs (Phase 1)
- ✅ `src/lib/anki/mediaStore.ts` - IndexedDB with `syncQueue` store (reuse this!)
- ✅ `src/types/r2.ts` - All R2 type definitions

### Decisions from Phase 0 (BINDING)
- **Decision 1:** Reuse existing `syncQueue` in `ankiMediaDB` (src/lib/anki/mediaStore.ts:78-85)
- **Decision 4:** 5 concurrent uploads (global limit)
- **Decision 6:** SHA-256 using `crypto.subtle.digest()` (Web Crypto API)
- **Decision 10:** Firestore metadata docs <100KB
- **Decision 11:** Fail gracefully with partial success

---

## Deliverables

### 1. R2UploadQueue Class (`src/lib/r2/R2UploadQueue.ts`)

**Responsibilities:**
- Manage upload queue in IndexedDB `syncQueue` store
- Generate SHA-256 hashes for all files
- Request signed URLs from API
- Upload files to R2 via signed URLs
- Retry failed uploads with exponential backoff
- Emit events for UI updates

**Key Methods:**
```typescript
class R2UploadQueue {
  // Queue a deck for upload (package + media + manifest)
  async queueDeckUpload(deckId: string, packageBlob: Blob, mediaFiles: Map<string, Blob>): Promise<void>

  // Start processing queue (auto-starts on construction)
  async start(): Promise<void>

  // Stop processing (cleanup on unmount)
  stop(): void

  // Get queue status for a deck
  async getStatus(deckId: string): Promise<R2QueueStatus>

  // Retry failed uploads
  async retryFailed(deckId: string): Promise<void>

  // Listen to upload progress events
  on(event: 'progress' | 'complete' | 'error', handler: (data: any) => void): void
}
```

**Implementation Notes:**
- Use `p-queue` library for concurrency control (5 max concurrent)
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
- Store jobs in IndexedDB `syncQueue` with status: pending/uploading/completed/failed
- Pause queue when offline (listen to `navigator.onLine` events)
- Resume automatically when back online

### 2. SHA-256 Hashing Utility (`src/lib/r2/hashUtils.ts`)

```typescript
/**
 * Hash a Blob using Web Crypto API
 * Target: <5ms for 1MB files
 */
export async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Benchmark hashing performance
 * Log results to console for Phase 1 completion requirement
 */
export async function benchmarkHashing(): Promise<void>
```

### 3. Manifest Generator (`src/lib/r2/manifestGenerator.ts`)

```typescript
/**
 * Generate manifest.json for a deck
 * Includes SHA-256 hashes for all files
 */
export async function generateManifest(
  deckId: string,
  userId: string,
  packageBlob: Blob,
  mediaFiles: Map<string, Blob>
): Promise<R2Manifest> {
  // Hash package file
  const packageHash = await hashBlob(packageBlob)

  // Hash all media files
  const files: R2ManifestFile[] = [
    {
      type: 'package',
      name: 'package.apkg',
      size: packageBlob.size,
      sha256: packageHash
    }
  ]

  for (const [filename, blob] of mediaFiles.entries()) {
    files.push({
      type: 'media',
      name: filename,
      size: blob.size,
      sha256: await hashBlob(blob)
    })
  }

  return {
    deckId,
    userId,
    createdAt: new Date().toISOString(),
    files
  }
}
```

### 4. Metadata API Endpoint (`src/app/api/anki/r2/metadata/route.ts`)

**Method:** POST
**Auth:** Required (session-based via `requireAuth()`)
**Request Body:**
```typescript
{
  deckId: string
  name: string
  cardCount: number
  hasMedia: boolean
  r2: {
    packageKey: string
    manifestKey: string
    mediaPrefix: string
  }
  originalFilename?: string
}
```

**Validation:**
- ✅ Authenticated user matches userId in keys
- ✅ All R2 keys start with `users/{userId}/decks/{deckId}/`
- ✅ Metadata size <100KB (validate before write)

**Firestore Operation:**
```typescript
const metadataDoc = {
  ...requestBody,
  userId: session.uid,
  updatedAt: FieldValue.serverTimestamp()
}

await db.collection('anki_r2_backups').doc(deckId).set(metadataDoc)
```

**Response:**
```json
{ "success": true, "deckId": "abc123" }
```

### 5. Upload Orchestrator Hook (`src/hooks/useR2Upload.ts`)

React hook to integrate upload queue with UI:

```typescript
export function useR2Upload(deckId: string) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'completed' | 'failed'>('idle')
  const [progress, setProgress] = useState(0) // 0-100
  const [error, setError] = useState<string | null>(null)

  const startUpload = async (packageBlob: Blob, mediaFiles: Map<string, Blob>) => {
    // Queue upload
    // Listen to progress events
    // Update status
  }

  const retry = async () => {
    // Retry failed uploads
  }

  return { status, progress, error, startUpload, retry }
}
```

### 6. Backup Status UI Component (`src/components/anki/BackupStatusBadge.tsx`)

Display backup status on deck cards:

```tsx
export function BackupStatusBadge({ deckId }: { deckId: string }) {
  const { status, progress } = useR2Upload(deckId)

  if (status === 'idle') return null

  return (
    <div className="backup-status-badge">
      {status === 'uploading' && <Spinner size="sm" />}
      {status === 'uploading' && <span>{progress}% backed up</span>}
      {status === 'completed' && <CheckIcon />}
      {status === 'failed' && <ErrorIcon />}
    </div>
  )
}
```

**Integration Point:**
- Add to existing deck card component (wherever decks are listed)
- Show in deck details page
- Optional: add to deck import success screen

---

## Upload Flow (End-to-End)

### Trigger: User imports .apkg file

1. **Parse APKG** (existing code in `src/lib/anki/importer.ts`)
   - Extract package.apkg blob
   - Extract media files from `_media` folder
   - Store deck in FlashcardDB (existing)
   - Store media in ankiMediaDB (existing)

2. **Queue Upload** (NEW - your implementation)
   ```typescript
   const uploader = new R2UploadQueue()
   await uploader.queueDeckUpload(deckId, packageBlob, mediaFiles)
   ```

3. **Background Processing** (NEW)
   - Generate SHA-256 hashes for all files
   - Generate manifest.json
   - Request signed upload URLs for:
     - `users/{uid}/decks/{deckId}/package.apkg`
     - `users/{uid}/decks/{deckId}/media/{filename}` (for each media file)
     - `users/{uid}/decks/{deckId}/manifest.json`
   - Upload files to R2 (5 concurrent max)
   - Retry failures with exponential backoff

4. **Metadata Write** (NEW)
   - After all uploads complete successfully
   - Call `POST /api/anki/r2/metadata`
   - Write metadata to Firestore `anki_r2_backups/{deckId}`

5. **UI Update** (NEW)
   - Show "backing up..." badge during upload
   - Show "backed up ✓" badge on success
   - Show "backup failed" with retry button on error

---

## Error Handling Requirements

### Network Offline
- ✅ Pause queue (don't retry while offline)
- ✅ Show "offline - will resume" status
- ✅ Resume automatically when online event fires
- ✅ Don't count offline errors against retry limit

### Upload Failure (individual file)
- ✅ Retry with exponential backoff (max 5 retries)
- ✅ After 5 failures: mark job as failed
- ✅ Continue uploading other files
- ✅ Deck remains usable locally (IndexedDB)

### Partial Upload Success
- ✅ If package.apkg uploads but some media fails:
  - Don't write metadata yet
  - Show "partially backed up" status
  - Allow manual retry
  - Deck still usable locally

### Metadata Write Failure
- ✅ Files are in R2 but metadata not in Firestore
- ✅ Retry metadata write separately
- ✅ Don't re-upload files

---

## Testing Requirements

### Unit Tests (create in `src/lib/r2/__tests__/`)
- ✅ SHA-256 hashing produces correct hashes
- ✅ Manifest generation includes all files
- ✅ Queue respects 5 concurrent limit
- ✅ Exponential backoff timing is correct
- ✅ Offline detection pauses queue

### Integration Tests
- ✅ Small deck upload (10 cards, 5 media files)
- ✅ Large deck upload (1000 cards, 500 media files)
- ✅ Upload with simulated network failure
- ✅ Offline queue persistence (survives page reload)

### Manual Smoke Test
```bash
1. Import small Anki deck with audio+images
2. Check IndexedDB syncQueue has jobs
3. Check Network tab for signed URL requests
4. Verify files appear in R2 bucket
5. Verify metadata doc in Firestore
6. Check deck card shows "backed up ✓" badge
```

---

## Files to Create

```
src/lib/r2/
├── R2UploadQueue.ts        # Main upload queue class
├── hashUtils.ts            # SHA-256 hashing utilities
├── manifestGenerator.ts    # Manifest JSON generation
└── __tests__/
    ├── R2UploadQueue.test.ts
    ├── hashUtils.test.ts
    └── manifestGenerator.test.ts

src/app/api/anki/r2/metadata/
└── route.ts                # POST endpoint for metadata

src/hooks/
└── useR2Upload.ts          # React hook for UI integration

src/components/anki/
└── BackupStatusBadge.tsx   # UI component for backup status
```

---

## Files to Modify

```
src/lib/anki/importer.ts
  - After deck import completes
  - Queue R2 upload automatically
  - Don't block on upload (return immediately)

src/app/[locale]/flashcards/page.tsx (or wherever decks are listed)
  - Add <BackupStatusBadge deckId={deck.id} /> to deck cards
```

---

## Dependencies

Already installed in Phase 1:
- ✅ `@aws-sdk/client-s3`
- ✅ `@aws-sdk/s3-request-presigner`

New dependencies needed:
```bash
npm install p-queue
```

---

## Phase 0 Decisions to Follow

Reference: `01_PRODUCTION_DOCS/3-Features/ANKI_R2_PHASE0_DECISIONS.md`

- **Decision 1:** Reuse `syncQueue` in ankiMediaDB - DON'T create new database
- **Decision 4:** 5 concurrent uploads - Use p-queue with concurrency: 5
- **Decision 6:** SHA-256 via crypto.subtle.digest() - NO external libraries
- **Decision 8:** R2 keys follow `users/{uid}/decks/{deckId}/...` pattern
- **Decision 10:** Metadata <100KB - Validate size before Firestore write
- **Decision 11:** Fail gracefully - Partial success is OK, deck stays usable

---

## Integration Points

### 1. Anki Importer Hook
**File:** `src/lib/anki/importer.ts`
**Location:** After deck saved to FlashcardDB
**Action:** Call `R2UploadQueue.queueDeckUpload()`

### 2. Deck Card Component
**File:** Find deck card component (likely in flashcards page)
**Action:** Add `<BackupStatusBadge deckId={deck.id} />`

### 3. Session Manager
**File:** Existing auth/session management
**Action:** Use existing `requireAuth()` in metadata endpoint

---

## Success Validation

Before marking Track A complete:

1. ✅ Import test deck with 50 cards + 25 media files
2. ✅ Verify all files upload to R2 within 60 seconds
3. ✅ Check manifest.json has correct SHA-256 hashes
4. ✅ Verify metadata doc in Firestore
5. ✅ UI shows "backed up ✓" badge
6. ✅ Disconnect network mid-upload, verify queue pauses
7. ✅ Reconnect network, verify queue resumes
8. ✅ Simulate upload failure, verify retry with backoff
9. ✅ Verify 5 concurrent uploads max (check Network tab)
10. ✅ Deck is immediately usable while upload happens in background

---

## Coordination with Track B

**Track B** is implementing restore flow in parallel. You don't need to wait for them, but:

- ✅ Use same R2 key structure they'll expect
- ✅ Manifest format must match what they'll consume
- ✅ Metadata doc structure must match what they'll read

---

## Questions for Supervisor

If you encounter any blockers or need clarification:

1. Post in #r2-implementation Slack channel
2. Tag supervisor with @Claude
3. Include: file path, error message, decision needed

**Expected response time:** <4 hours during business hours

---

## Deadline

**Target:** 4 days from delegation
**Hard deadline:** 5 days (includes 1 day buffer)

Good luck! 🚀
