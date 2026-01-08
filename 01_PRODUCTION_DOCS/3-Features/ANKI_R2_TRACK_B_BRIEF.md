# Track B: Phase 4 Implementation Brief

**Agent:** spec-impl
**Priority:** HIGH
**Parallel with:** Track A (Phase 2+3)
**Estimated Duration:** 3 days
**Supervisor:** Claude (this session)

---

## Objective

Implement restore flow to download Anki decks from R2 and hydrate IndexedDB on new devices, enabling seamless cross-device deck restoration.

---

## Success Criteria

1. ✅ User can see list of their backed-up decks from any device
2. ✅ User can restore a deck with one click
3. ✅ Restore downloads:
   - Manifest file (to get file list + hashes)
   - Package file (.apkg)
   - All media files (images, audio)
4. ✅ Downloaded files are written to IndexedDB (FlashcardDB + ankiMediaDB)
5. ✅ Deck is immediately usable offline after restore
6. ✅ UI shows restore progress (downloading 45/100 files...)
7. ✅ Handles errors gracefully (missing media, network failure)
8. ✅ Verifies file integrity using SHA-256 hashes from manifest

---

## Architecture Context

### Existing Infrastructure (DO NOT MODIFY)
- ✅ `src/lib/r2/r2-client.ts` - R2 client config (Phase 1)
- ✅ `src/lib/r2/r2-keys.ts` - Key validation helpers (Phase 1)
- ✅ `POST /api/anki/r2/download-url` - Get signed download URLs (Phase 1)
- ✅ `src/lib/anki/mediaStore.ts` - IndexedDB media storage
- ✅ `src/lib/flashcards/FlashcardManager.ts` - Deck management
- ✅ `src/types/r2.ts` - All R2 type definitions

### Decisions from Phase 0 (BINDING)
- **Decision 3:** Firestore collection `anki_r2_backups`
- **Decision 6:** SHA-256 verification using crypto.subtle.digest()
- **Decision 8:** R2 keys: `users/{uid}/decks/{deckId}/...`
- **Decision 9:** Download URLs expire in 600s (10 minutes)
- **Decision 11:** Fail gracefully - partial restore is OK

---

## Deliverables

### 1. Backups Listing Endpoint (`src/app/api/anki/r2/backups/route.ts`)

**Method:** GET
**Auth:** Required (session-based via `requireAuth()`)
**Query Params:** None (returns all backups for authenticated user)

**Implementation:**
```typescript
export async function GET(request: NextRequest) {
  const session = await requireAuth()

  // Query Firestore for user's backups
  const snapshot = await db
    .collection('anki_r2_backups')
    .where('userId', '==', session.uid)
    .orderBy('updatedAt', 'desc')
    .get()

  const backups: BackupInfo[] = snapshot.docs.map(doc => {
    const data = doc.data() as R2Metadata
    return {
      deckId: data.deckId,
      name: data.name,
      cardCount: data.cardCount,
      hasMedia: data.hasMedia,
      lastBackup: data.updatedAt.toDate(),
      r2Keys: {
        manifestKey: data.r2.manifestKey,
        packageKey: data.r2.packageKey
      }
    }
  })

  return NextResponse.json({ backups })
}
```

**Response:**
```json
{
  "backups": [
    {
      "deckId": "abc123",
      "name": "Japanese Core 2000",
      "cardCount": 2000,
      "hasMedia": true,
      "lastBackup": "2026-01-07T10:30:00Z",
      "r2Keys": {
        "manifestKey": "users/uid/decks/abc123/manifest.json",
        "packageKey": "users/uid/decks/abc123/package.apkg"
      }
    }
  ]
}
```

### 2. Restore Orchestrator (`src/lib/r2/RestoreOrchestrator.ts`)

Main class to coordinate the restore process:

```typescript
export class RestoreOrchestrator extends EventEmitter {
  private userId: string
  private downloadQueue: PQueue

  constructor(userId: string) {
    super()
    this.userId = userId
    this.downloadQueue = new PQueue({ concurrency: 5 }) // 5 concurrent downloads
  }

  /**
   * Restore a deck from R2 backup
   * @param backup - Backup info from list endpoint
   * @returns Restored deck ID
   */
  async restoreDeck(backup: BackupInfo): Promise<string> {
    this.emit('progress', { phase: 'fetching-metadata', progress: 0 })

    // Step 1: Download manifest
    const manifest = await this.downloadManifest(backup.r2Keys.manifestKey)
    this.emit('progress', { phase: 'downloading-manifest', progress: 10 })

    // Step 2: Download package file
    const packageBlob = await this.downloadFile(backup.r2Keys.packageKey!)
    this.emit('progress', { phase: 'downloading-media', progress: 20 })

    // Step 3: Download media files
    const mediaFiles = await this.downloadMediaBatch(manifest, backup.deckId)
    this.emit('progress', { phase: 'hydrating-deck', progress: 80 })

    // Step 4: Write to IndexedDB
    await this.hydrateIndexedDB(packageBlob, mediaFiles, backup)
    this.emit('progress', { phase: 'complete', progress: 100 })

    return backup.deckId
  }

  private async downloadManifest(key: string): Promise<R2Manifest> {
    const url = await this.getSignedDownloadUrl(key)
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to download manifest')
    return await response.json()
  }

  private async downloadFile(key: string): Promise<Blob> {
    const url = await this.getSignedDownloadUrl(key)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to download ${key}`)
    return await response.blob()
  }

  private async downloadMediaBatch(
    manifest: R2Manifest,
    deckId: string
  ): Promise<Map<string, Blob>> {
    const mediaFiles = new Map<string, Blob>()
    const mediaEntries = manifest.files.filter(f => f.type === 'media')

    let downloaded = 0
    const total = mediaEntries.length

    await this.downloadQueue.addAll(
      mediaEntries.map(entry => async () => {
        const key = `users/${this.userId}/decks/${deckId}/media/${entry.name}`

        try {
          const blob = await this.downloadFile(key)

          // Verify hash
          const hash = await hashBlob(blob)
          if (hash !== entry.sha256) {
            console.warn(`Hash mismatch for ${entry.name}`)
            // Continue anyway - partial media is OK
          }

          mediaFiles.set(entry.name, blob)
        } catch (error) {
          console.error(`Failed to download ${entry.name}:`, error)
          // Continue - missing media is OK per Decision 11
        }

        downloaded++
        const progress = 20 + (60 * downloaded / total)
        this.emit('progress', {
          phase: 'downloading-media',
          progress,
          currentFile: entry.name,
          filesDownloaded: downloaded,
          totalFiles: total
        })
      })
    )

    return mediaFiles
  }

  private async hydrateIndexedDB(
    packageBlob: Blob,
    mediaFiles: Map<string, Blob>,
    backup: BackupInfo
  ): Promise<void> {
    // Step 1: Parse package file
    const { deck, media } = await parseAnkiPackage(packageBlob)

    // Step 2: Store deck in FlashcardDB
    const flashcardManager = FlashcardManager.getInstance()
    await flashcardManager.initialize()
    await flashcardManager.importAnkiDeck(deck, backup.deckId)

    // Step 3: Store media in ankiMediaDB
    const mediaStore = AnkiMediaStore.getInstance()
    for (const [filename, blob] of mediaFiles.entries()) {
      await mediaStore.storeMedia(backup.deckId, filename, blob)
    }

    console.log(`[RestoreOrchestrator] Restored deck ${backup.deckId}:`, {
      cardCount: deck.cards.length,
      mediaCount: mediaFiles.size
    })
  }

  private async getSignedDownloadUrl(key: string): Promise<string> {
    // Extract deckId from key pattern
    const match = key.match(/decks\/([^/]+)/)
    if (!match) throw new Error('Invalid key format')
    const deckId = match[1]

    const response = await fetch('/api/anki/r2/download-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId, key })
    })

    if (!response.ok) {
      throw new Error('Failed to get download URL')
    }

    const data = await response.json()
    return data.url
  }
}
```

### 3. Restore UI Hook (`src/hooks/useRestore.ts`)

React hook for UI integration:

```typescript
export function useRestore() {
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState(false)
  const [progress, setProgress] = useState<RestoreProgress | null>(null)

  // Fetch available backups
  useEffect(() => {
    async function fetchBackups() {
      const response = await fetch('/api/anki/r2/backups')
      const data = await response.json()
      setBackups(data.backups)
      setLoading(false)
    }
    fetchBackups()
  }, [])

  // Restore a deck
  const restore = async (backup: BackupInfo) => {
    setRestoring(true)
    setProgress({ phase: 'fetching-metadata', filesDownloaded: 0, totalFiles: 0 })

    try {
      const orchestrator = new RestoreOrchestrator(session.uid)

      orchestrator.on('progress', (data) => {
        setProgress(data)
      })

      await orchestrator.restoreDeck(backup)

      setProgress({ phase: 'complete', filesDownloaded: 1, totalFiles: 1 })
    } catch (error) {
      setProgress({
        phase: 'error',
        filesDownloaded: 0,
        totalFiles: 0,
        error: error.message
      })
    } finally {
      setRestoring(false)
    }
  }

  return { backups, loading, restore, restoring, progress }
}
```

### 4. Restore UI Page (`src/app/[locale]/flashcards/restore/page.tsx`)

User-facing restore page:

```tsx
export default function RestorePage() {
  const { backups, loading, restore, restoring, progress } = useRestore()
  const t = useTranslations('flashcards')

  if (loading) return <LoadingSpinner />

  return (
    <div className="restore-page">
      <h1>{t('restore.title')}</h1>
      <p>{t('restore.description')}</p>

      {backups.length === 0 && (
        <EmptyState message={t('restore.noBackups')} />
      )}

      <div className="backup-list">
        {backups.map(backup => (
          <BackupCard
            key={backup.deckId}
            backup={backup}
            onRestore={() => restore(backup)}
            disabled={restoring}
          />
        ))}
      </div>

      {restoring && progress && (
        <RestoreProgressModal progress={progress} />
      )}
    </div>
  )
}
```

### 5. Restore Progress Component (`src/components/anki/RestoreProgressModal.tsx`)

Modal showing restore progress:

```tsx
export function RestoreProgressModal({ progress }: { progress: RestoreProgress }) {
  const t = useTranslations('flashcards.restore')

  const getPhaseLabel = () => {
    switch (progress.phase) {
      case 'fetching-metadata': return t('fetchingMetadata')
      case 'downloading-manifest': return t('downloadingManifest')
      case 'downloading-media': return t('downloadingMedia')
      case 'hydrating-deck': return t('hydratingDeck')
      case 'complete': return t('complete')
      case 'error': return t('error')
    }
  }

  const progressPercent = progress.phase === 'error' ? 0 :
    ((progress.filesDownloaded / Math.max(progress.totalFiles, 1)) * 100)

  return (
    <Modal isOpen={true}>
      <h2>{t('title')}</h2>
      <p>{getPhaseLabel()}</p>

      {progress.phase === 'downloading-media' && (
        <p>{t('downloadingFile', {
          current: progress.filesDownloaded,
          total: progress.totalFiles,
          filename: progress.currentFile
        })}</p>
      )}

      <ProgressBar value={progressPercent} />

      {progress.phase === 'error' && (
        <ErrorMessage>{progress.error}</ErrorMessage>
      )}

      {progress.phase === 'complete' && (
        <SuccessMessage>{t('success')}</SuccessMessage>
      )}
    </Modal>
  )
}
```

### 6. Backup Card Component (`src/components/anki/BackupCard.tsx`)

Individual backup item in list:

```tsx
export function BackupCard({
  backup,
  onRestore,
  disabled
}: {
  backup: BackupInfo
  onRestore: () => void
  disabled: boolean
}) {
  const t = useTranslations('flashcards.restore')

  return (
    <Card className="backup-card">
      <h3>{backup.name}</h3>
      <div className="backup-stats">
        <span>{backup.cardCount} {t('cards')}</span>
        {backup.hasMedia && <span>📎 {t('withMedia')}</span>}
      </div>
      <div className="backup-date">
        {t('lastBackup')}: {formatDate(backup.lastBackup)}
      </div>
      <Button
        onClick={onRestore}
        disabled={disabled}
      >
        {t('restoreButton')}
      </Button>
    </Card>
  )
}
```

---

## Restore Flow (End-to-End)

### User Journey

1. **User opens restore page** (`/flashcards/restore`)
   - Fetches list of backups via `GET /api/anki/r2/backups`
   - Shows list of available decks with metadata

2. **User clicks "Restore" button**
   - `RestoreOrchestrator` starts
   - Shows progress modal

3. **Download Phase**
   - Download manifest.json (get file list + hashes)
   - Download package.apkg
   - Download media files (5 concurrent, with progress updates)
   - Verify SHA-256 hashes for each file

4. **Hydration Phase**
   - Parse package.apkg (existing code)
   - Write deck to FlashcardDB (existing code)
   - Write media to ankiMediaDB (existing code)

5. **Completion**
   - Show success message
   - Redirect to flashcards page
   - Deck is now usable offline

---

## Error Handling

### Network Failure During Download
- ✅ Show error message with retry button
- ✅ Don't write partial data to IndexedDB
- ✅ Allow user to restart restore from beginning

### Missing Media Files
- ✅ Continue restore even if some media missing
- ✅ Log warnings to console
- ✅ Show notification: "Restored deck with 3 missing media files"
- ✅ Deck is still usable (cards without media work fine)

### SHA-256 Mismatch
- ✅ Log warning but continue (per Decision 11 - partial success OK)
- ✅ Don't block restore for hash mismatch
- ✅ Show notification about potential data corruption

### Duplicate Deck
- ✅ Detect if deck already exists in IndexedDB
- ✅ Ask user: "Deck already exists. Overwrite or skip?"
- ✅ Overwrite: delete existing deck first
- ✅ Skip: cancel restore

### Signed URL Expiry
- ✅ Download URLs expire in 10 minutes
- ✅ If download takes >10min, request new signed URL
- ✅ Resume download with new URL

---

## Testing Requirements

### Unit Tests (`src/lib/r2/__tests__/`)
- ✅ RestoreOrchestrator emits correct progress events
- ✅ SHA-256 verification works correctly
- ✅ Missing media doesn't block restore
- ✅ Hash mismatch is logged but doesn't throw

### Integration Tests
- ✅ Restore small deck (10 cards, 5 media)
- ✅ Restore large deck (1000 cards, 500 media)
- ✅ Restore with network failure (retry works)
- ✅ Restore with missing media (partial success)
- ✅ Restore to existing deck (overwrite flow)

### Manual Smoke Test
```bash
1. Upload deck from Device A using Track A implementation
2. Open app on Device B (clean browser profile)
3. Login with same account
4. Navigate to /flashcards/restore
5. See uploaded deck in list
6. Click "Restore" button
7. Watch progress modal (should take 10-30s for small deck)
8. Verify deck appears in flashcards list
9. Open deck and verify cards work
10. Go offline and verify deck is usable
```

---

## Files to Create

```
src/app/api/anki/r2/backups/
└── route.ts                     # GET endpoint for backup list

src/lib/r2/
├── RestoreOrchestrator.ts       # Main restore coordinator
└── __tests__/
    └── RestoreOrchestrator.test.ts

src/hooks/
└── useRestore.ts                # React hook for restore UI

src/app/[locale]/flashcards/restore/
└── page.tsx                     # Restore page UI

src/components/anki/
├── BackupCard.tsx               # Backup list item component
└── RestoreProgressModal.tsx     # Progress modal during restore
```

---

## Files to Modify

```
src/i18n/locales/*/strings.ts
  - Add translations for restore UI (all 6 locales)
  - Keys: flashcards.restore.* (title, description, etc.)

src/components/navigation/BottomNav.tsx (or similar)
  - Add link to /flashcards/restore page
  - Icon: cloud-download or similar
```

---

## Dependencies

Already installed in Phase 1:
- ✅ `@aws-sdk/client-s3`
- ✅ `@aws-sdk/s3-request-presigner`

New dependencies needed:
```bash
npm install p-queue  # Same as Track A
```

---

## Integration with Track A

**Track A** is implementing upload flow in parallel. Their work will create:
- Manifest files with SHA-256 hashes (you'll consume these)
- Metadata docs in Firestore (you'll query these)
- R2 objects at expected keys (you'll download these)

**No blocking dependencies** - you can implement restore using mock data, then test with real data once Track A completes.

---

## Mock Data for Development

While Track A is in progress, use this mock metadata:

```typescript
// Mock backup in Firestore (create manually)
{
  deckId: 'mock-deck-123',
  userId: 'YOUR_TEST_USER_ID',
  name: 'Mock Japanese Deck',
  cardCount: 10,
  hasMedia: true,
  r2: {
    packageKey: 'users/YOUR_TEST_USER_ID/decks/mock-deck-123/package.apkg',
    manifestKey: 'users/YOUR_TEST_USER_ID/decks/mock-deck-123/manifest.json',
    mediaPrefix: 'users/YOUR_TEST_USER_ID/decks/mock-deck-123/media/'
  },
  updatedAt: Timestamp.now()
}
```

Upload test files to R2 manually to test downloads.

---

## i18n Strings Required

Add to all 6 locales (`en`, `it`, `ja`, `de`, `fr`, `es`):

```typescript
flashcards: {
  restore: {
    title: 'Restore Decks',
    description: 'Restore your Anki decks from cloud backup',
    noBackups: 'No backups found. Import a deck to create a backup.',
    cards: 'cards',
    withMedia: 'with media',
    lastBackup: 'Last backup',
    restoreButton: 'Restore',
    fetchingMetadata: 'Fetching backup info...',
    downloadingManifest: 'Downloading manifest...',
    downloadingMedia: 'Downloading media files...',
    downloadingFile: 'Downloading {current}/{total}: {filename}',
    hydratingDeck: 'Setting up deck...',
    complete: 'Restore complete!',
    success: 'Deck restored successfully. You can now study offline.',
    error: 'Restore failed. Please try again.'
  }
}
```

---

## Success Validation

Before marking Track B complete:

1. ✅ GET /api/anki/r2/backups returns user's backups
2. ✅ Restore page shows list of available backups
3. ✅ Click restore downloads all files
4. ✅ Progress modal shows accurate progress (%)
5. ✅ Restored deck appears in flashcards list
6. ✅ Cards are usable offline immediately
7. ✅ Media hydration works (images/audio display)
8. ✅ Missing media doesn't break restore
9. ✅ Works on fresh browser profile (clean IndexedDB)
10. ✅ Works after Safari eviction (7-day recovery scenario)

---

## Coordination with Supervisor

Report progress daily:
- What's completed
- What's blocking
- ETA for completion

Tag supervisor for:
- API contract changes
- Error handling decisions
- UX flow questions

---

## Deadline

**Target:** 3 days from delegation
**Hard deadline:** 4 days (includes 1 day buffer)

Good luck! 🚀
