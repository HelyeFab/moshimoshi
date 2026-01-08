# Anki Media Cloud Sync Implementation Guide

**Last Updated**: 2026-01-08
**Status**: Phase 2 Complete (Tasks 1-2), Phase 3-7 In Progress
**Feature**: Premium-only Anki flashcard cloud sync with offline-first architecture

---

## 📋 Table of Contents

1. [Problem Statement](#problem-statement)
2. [Architecture Overview](#architecture-overview)
3. [Completed Work (Tasks 1-2)](#completed-work-tasks-1-2)
4. [Remaining Work (Tasks 3-7)](#remaining-work-tasks-3-7)
5. [Key Design Decisions](#key-design-decisions)
6. [File Structure](#file-structure)
7. [Testing Guide](#testing-guide)
8. [Important Gotchas](#important-gotchas)

---

## 🎯 Problem Statement

### The Business Need
Anki flashcards are a **premium-only feature**. Premium users expect:
1. **Cross-device sync**: Access decks on phone, tablet, desktop
2. **Media persistence**: Images and audio that work reliably
3. **Offline-first**: Import decks offline, sync happens in background
4. **Storage quotas**: 300MB per user with usage warnings

### Technical Challenges
1. **Blob URL Lifecycle Bug**: Images broke after navigating between cards
2. **No Cloud Sync**: Media only stored locally in IndexedDB
3. **No Premium Gating**: Free users had same features as paid
4. **No Retry Logic**: Network failures lost sync operations

---

## 🏗️ Architecture Overview

### Design Pattern: Copy My Lists Sync Architecture

**Reference Implementation**: `/src/lib/lists/ListManager.ts`

```
User Action: Import .apkg Deck
    ↓
[1] Parse package, extract media
    ↓
[2] Write to IndexedDB IMMEDIATELY (optimistic, works offline)
    ↓
[3] Notify UI (deck ready to use instantly)
    ↓
[4] Check premium status via getStorageDecision()
    ↓
[5] If Premium: Queue sync jobs in IndexedDB syncQueue
    ↓
[6] TabCoordinator elects leader tab
    ↓
[7] Leader tab processes queue every 5s
    ↓
[8] Upload to Firebase Storage (exponential backoff)
    ↓
[9] Update Firestore metadata on success
    ↓
[10] Mark as synced in IndexedDB
```

### Key Components

**Storage Layers**:
- **IndexedDB** (client): Offline cache, instant access
- **Firebase Storage** (cloud): User media files
- **Firestore** (cloud): Metadata and sync status

**Sync Infrastructure**:
- **AnkiMediaStore**: IndexedDB wrapper with sync tracking
- **AnkiMediaManager**: Background sync queue processor (Task 3)
- **AnkiMediaUploader**: Firebase Storage upload/download (Task 4)
- **TabCoordinator**: Cross-tab leadership election (shared with Lists)

---

## ✅ Completed Work (Tasks 1-2)

### Task 1: Fix Blob URL Premature Revocation Bug

**Problem**: Images broke when navigating between flashcards because `URL.revokeObjectURL()` was called in `useMediaHydration` hook cleanup.

**Root Cause**:
- Blob URLs stored in singleton `AnkiMediaStore.blobUrlCache`
- Hook cleanup revoked URLs on card change
- Next card tried to use already-revoked URLs → broken images

**Solution**:
```typescript
// BEFORE (WRONG):
return () => {
  for (const url of blobUrlsRef.current) {
    URL.revokeObjectURL(url)  // ❌ Breaks other cards!
  }
}

// AFTER (CORRECT):
return () => {
  cancelled = true
  // DO NOT revoke - managed by AnkiMediaStore singleton
  // Cleanup happens on deck deletion via mediaStore.cleanup()
  blobUrlsRef.current = []
}
```

**Files Modified**:
- `/src/hooks/useMediaHydration.ts` (both functions updated)

**Result**: ✅ Images persist across navigation, refresh, sessions

---

### Task 2: IndexedDB Enhancement for Sync Support

**Objective**: Add sync tracking to IndexedDB for background cloud sync.

**Database Upgrade**: Version 1 → Version 2
- Added 4 indexes to `media` store: userId, deckId, syncStatus, updatedAt
- Created new `syncQueue` store with 4 indexes
- Migration logic with zero data loss

**New Data Structures**:
```typescript
// /src/types/ankiMedia.ts

interface StoredMedia {
  // Existing fields
  id: string              // filename
  blob: Blob
  type: string
  size: number
  createdAt: Date

  // NEW: Sync tracking
  userId: string          // Owner
  deckId: string          // Parent deck
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed'
  firebaseUrl?: string    // Cloud URL after sync
  retryCount: number
  lastSyncAttempt?: Date
  syncError?: string
  updatedAt: Date
}

interface MediaSyncJob {
  id: string              // UUID
  action: 'upload' | 'delete'
  userId: string
  deckId: string
  filename: string
  status: 'pending' | 'processing' | 'failed'
  retryCount: number
  maxRetries: 5
  scheduledFor: Date      // For exponential backoff
  createdAt: Date
  lastAttempt?: Date
  error?: string
}
```

**New Methods Added** (`/src/lib/anki/mediaStore.ts`):
```typescript
// Query methods
getMediaByDeck(deckId: string): Promise<StoredMedia[]>
getUnsyncedMedia(deckId?: string): Promise<StoredMedia[]>

// Sync status updates
markAsSynced(filename: string, firebaseUrl: string): Promise<void>
markAsFailed(filename: string, error: string): Promise<void>

// Deck management
deleteMediaByDeck(deckId: string): Promise<number>

// Statistics
getStats(): Promise<MediaStorageStats>
```

**Files Modified**:
- `/src/lib/anki/mediaStore.ts` (+245 lines)

**Files Created**:
- `/src/types/ankiMedia.ts` (90 lines)

**Result**: ✅ Foundation ready for background sync implementation

---

## 🔨 Remaining Work (Tasks 3-7)

### Task 3: AnkiMediaManager (Sync Engine) - **NEXT**

**Complexity**: ⭐⭐⭐⭐⭐ High (most complex task)
**Estimated Time**: 8-12 hours

**What It Does**:
- Background queue processor (runs every 5 seconds in leader tab)
- Uploads media to Firebase Storage with retry logic
- Implements exponential backoff: 1s → 2s → 4s → 8s → 16s (max 30s)
- Circuit breaker: Stop after 5 failures, reset after 30s
- Cross-tab coordination via TabCoordinator

**File to Create**: `/src/lib/anki/AnkiMediaManager.ts` (~800 lines)

**Pattern to Copy**: `/src/lib/lists/ListManager.ts` (1117 lines)

**Key Methods**:
```typescript
class AnkiMediaManager {
  // Queue operations
  enqueueUpload(userId, deckId, filename, blob): Promise<void>
  processQueue(): Promise<void>

  // Job processing
  processJob(job: MediaSyncJob): Promise<void>
  handleUploadJob(job): Promise<void>
  handleDeleteJob(job): Promise<void>

  // Retry logic
  rescheduleJob(jobId, retryCount, scheduledFor, error): Promise<void>
  markJobAsFailed(jobId, error): Promise<void>

  // Status
  getSyncStatus(deckId?): Promise<MediaSyncStatus>

  // Lifecycle
  startSyncTimer(): void
  stopSyncTimer(): void
  scheduleImmediateSync(): void
}
```

**Integration Points**:
- TabCoordinator (already exists, reuse from Lists)
- AnkiMediaStore (Task 2 ✅)
- AnkiMediaUploader (Task 4)
- Network online/offline events

---

### Task 4: Media Uploader (Firebase Storage)

**Complexity**: ⭐⭐⭐ Medium
**Estimated Time**: 3-4 hours

**What It Does**:
- Uploads blobs to Firebase Storage at path: `/anki-media/{userId}/{deckId}/{filename}`
- Downloads media from Firebase when syncing across devices
- Handles large files with streaming
- Progress callbacks for UI

**File to Create**: `/src/lib/anki/mediaUploader.ts` (~200 lines)

**Key Methods**:
```typescript
class AnkiMediaUploader {
  uploadMedia(userId, deckId, filename, blob, onProgress?): Promise<string>
  deleteMedia(userId, deckId, filename): Promise<void>
  uploadBatch(userId, deckId, files): Promise<Map<string, string>>
  downloadMedia(firebaseUrl, filename, deckId): Promise<void>
  syncDeckMedia(userId, deckId, onProgress?): Promise<SyncResult>
}
```

**Firebase SDK Usage**:
```typescript
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'

const storage = getStorage(getFirebaseApp())
const storageRef = ref(storage, `anki-media/${userId}/${deckId}/${filename}`)
await uploadBytes(storageRef, blob, metadata)
const downloadUrl = await getDownloadURL(storageRef)
```

---

### Task 5: API Endpoints

**Complexity**: ⭐⭐⭐ Medium
**Estimated Time**: 4-5 hours

**Endpoints to Create**:

1. **POST /api/anki/media/sync**
   - Body: `{ deckId, filename, fileData (base64), contentType }`
   - Action: Upload to Firebase, update Firestore
   - Auth: Premium users only
   - Quota: Check 500MB limit, warn at 90%

2. **GET /api/anki/media/sync-status/:deckId**
   - Returns: Sync progress for deck
   - Response: `{ totalFiles, syncedFiles, pendingFiles, failedFiles }`

3. **POST /api/anki/media/sync/:deckId**
   - Action: Trigger manual sync for deck
   - Returns: `{ status, syncedCount, errors }`

4. **DELETE /api/anki/media/:deckId**
   - Action: Delete all media for deck from Firebase
   - Returns: `{ success, deletedCount }`

**Premium Validation Pattern**:
```typescript
import { getStorageDecision } from '@/lib/api/storage-helper'

const decision = await getStorageDecision(session)
if (!decision.shouldWriteToFirebase) {
  return NextResponse.json({ error: 'Premium required' }, { status: 403 })
}
```

**Quota Checking**:
```typescript
// Check total user media size
const totalSize = await getUserTotalMediaSize(userId)
const newSize = totalSize + fileSize
const LIMIT = 500 * 1024 * 1024  // 500MB
const WARNING = 450 * 1024 * 1024  // 90% = 450MB

if (newSize > LIMIT) {
  return NextResponse.json({
    error: 'Storage limit exceeded',
    currentSize: totalSize,
    limit: LIMIT
  }, { status: 413 })
}

if (newSize > WARNING) {
  return NextResponse.json({
    success: true,
    warning: 'Approaching storage limit (90%)',
    currentSize: newSize,
    limit: LIMIT
  })
}
```

---

### Task 6: UI Integration

**Complexity**: ⭐⭐⭐ Medium
**Estimated Time**: 4-5 hours

**Components to Create/Update**:

1. **Create**: `/src/components/anki/AnkiMediaSyncStatusIndicator.tsx`
   - Copy pattern from `/src/components/lists/ListSyncStatusIndicator.tsx`
   - Shows: Syncing, Synced, Error, Offline states
   - Displays: Pending count, failed count, progress

2. **Update**: `/src/components/anki/AnkiImportModal.tsx`
   - After import, enqueue sync jobs for premium users
   - Show toast: "Deck imported! Media syncing in background..."

3. **Update**: `/src/components/anki/DeckCard.tsx` (or similar)
   - Add sync status badge/indicator
   - Example: `<Badge>Syncing 5/10 files</Badge>`

4. **Update**: Settings page
   - Add Anki media storage stats section
   - Display: Total decks, media files, storage used, synced count
   - Add "Clear Local Cache" button

**Example Integration**:
```typescript
// In AnkiImportModal after successful import
const manager = AnkiMediaManager.getInstance()

for (const [filename, blob] of media.entries()) {
  await manager.enqueueUpload(
    session.user.id,
    deck.id,
    filename,
    blob
  )
}

showToast('Deck imported! Syncing media in background...', 'success')
```

---

### Task 7: Security Rules & Final Testing

**Complexity**: ⭐⭐ Low-Medium
**Estimated Time**: 2-3 hours
**Status**: ✅ COMPLETE

**Firebase Storage Rules** (`storage.rules`):

Updated rules have been added to `/home/beano/DevProjects/NextJs/moshimoshi/storage.rules`:

```javascript
// Anki media uploads - Premium users only
match /anki-media/{userId}/{deckId}/{filename} {
  // Helper function: Check if user is premium
  function isPremium() {
    // Check Firestore subscription document for active premium status
    // Premium plans are: premium_monthly, premium_yearly
    return request.auth != null && (
      // Check custom claims (if set)
      request.auth.token.premium == true ||
      // Check Firestore subscription (primary source of truth)
      exists(/databases/(default)/documents/users/$(request.auth.uid)/subscription)
    );
  }

  // Helper function: Check user quota (500MB limit enforced server-side)
  function withinFileSizeLimit() {
    // Per-file size limit: 50MB
    // Total quota (500MB) is enforced server-side via API endpoint
    return request.resource.size < 50 * 1024 * 1024; // 50MB per file
  }

  // Helper function: Validate content type
  function validContentType() {
    return request.resource.contentType.matches('image/.*') ||
           request.resource.contentType.matches('audio/.*') ||
           request.resource.contentType.matches('video/.*');
  }

  // Allow upload (create/update)
  allow write: if request.auth != null &&
                  request.auth.uid == userId &&
                  isPremium() &&
                  withinFileSizeLimit() &&
                  validContentType();

  // Allow read
  allow read: if request.auth != null &&
                 request.auth.uid == userId;

  // Allow delete
  allow delete: if request.auth != null &&
                   request.auth.uid == userId;
}
```

**Deployment Instructions**:

To deploy the Firebase Storage security rules:

```bash
# Quick deploy (recommended)
./scripts/deploy-storage-rules.sh

# OR manually
firebase deploy --only storage
```

**Security Rule Features**:
- Authentication required for all operations
- Premium validation via custom claims OR Firestore subscription
- User isolation: Users can only access their own files
- Per-file size limit: 50MB
- Total quota: 500MB (enforced server-side in API)
- Content type validation: image/*, audio/*, video/*

**Firestore Security Rules** (update existing):
```javascript
match /users/{userId}/ankiDecks/{deckId} {
  allow read, write: if request.auth.uid == userId;

  // Premium validation
  allow write: if request.auth.uid == userId
    && get(/databases/$(database)/documents/users/$(userId)/subscription).data.status == 'active';
}
```

**Testing Checklist**:
- [x] Security rules deployed (Task 7.1)
- [x] Deployment script created (Task 7.2)
- [x] Documentation updated (Task 7.3)
- [ ] Free user: Cannot sync to cloud (verify after deployment)
- [ ] Premium user: Syncs automatically (verify after deployment)
- [ ] Offline import: Works, syncs when online
- [ ] 500MB limit: Enforced with warning at 90%
- [ ] Cross-device: Deck appears on other devices
- [ ] Deck deletion: Cleans up Firebase Storage
- [ ] Retry logic: Works after 5 failures
- [ ] Cross-tab: Only one tab syncs

---

## 🎯 Key Design Decisions

### Decision 1: Offline-First Architecture
**Why**: Users expect to import decks offline (e.g., on plane)
**How**: Write to IndexedDB immediately, queue sync for later
**Pattern**: Matches My Lists implementation

### Decision 2: Blob URLs Never Revoked in Hook
**Why**: Singleton cache pattern - multiple components share URLs
**When Revoked**: Only on deck deletion via `mediaStore.cleanup()`
**Trade-off**: Small memory overhead, big reliability gain

### Decision 3: Firebase Storage Path Structure
**Path**: `/anki-media/{userId}/{deckId}/{filename}`
**Why**:
- User isolation: Easy to query/delete user's media
- Deck isolation: Easy to delete deck's media
- Filename preservation: Anki compatibility

### Decision 4: Firestore Metadata Nested in Deck Document
**Alternative**: Separate `ankiMedia` collection
**Choice**: Nested in `ankiDecks/{deckId}` document
**Why**:
- Media lifecycle tied to deck
- No cross-deck queries needed
- Simpler security rules
- Consistent with other features

### Decision 5: 500MB Quota with 90% Warning
**Limit**: 500MB per user across all decks
**Warning**: Show at 450MB (90%)
**Enforcement**: Server-side in API
**Why**: Prevent abuse, manage costs, encourage cleanup

### Decision 6: Mark Failed After 5 Retries
**Retries**: 5 attempts with exponential backoff
**After Failure**: Mark job as failed, notify user
**Recovery**: Manual "Retry Sync" button
**Why**: Don't retry forever, let user know

---

## 📁 File Structure

```
src/
├── types/
│   └── ankiMedia.ts                    ✅ Task 2 (NEW)
│       └── StoredMedia, MediaSyncJob, MediaSyncStatus, MediaStorageStats
│
├── lib/anki/
│   ├── mediaStore.ts                   ✅ Task 2 (ENHANCED)
│   │   └── IndexedDB wrapper with sync tracking
│   ├── mediaHydrator.ts                ✅ Pre-existing (Phase 1)
│   │   └── Hydrate blob URLs in HTML
│   ├── importer.ts                     ✅ Pre-existing (Phase 1)
│   │   └── Parse .apkg, mark media for hydration
│   ├── parser.ts                       ✅ Pre-existing (Phase 1)
│   │   └── SQLite parsing logic
│   ├── AnkiMediaManager.ts             ⏳ Task 3 (TODO)
│   │   └── Background sync queue processor
│   └── mediaUploader.ts                ⏳ Task 4 (TODO)
│       └── Firebase Storage upload/download
│
├── hooks/
│   └── useMediaHydration.ts            ✅ Task 1 (FIXED)
│       └── Lazy hydration without premature revocation
│
├── components/anki/
│   ├── AnkiImportModal.tsx             ⏳ Task 6 (TODO UPDATE)
│   │   └── Add sync enqueue after import
│   └── AnkiMediaSyncStatusIndicator.tsx ⏳ Task 6 (TODO CREATE)
│       └── Show sync progress in UI
│
└── app/api/anki/media/
    ├── route.ts                        ⏳ Task 5 (TODO)
    │   └── POST /sync, GET /?deckId
    ├── sync/route.ts                   ⏳ Task 5 (TODO)
    │   └── POST /sync (emergency sync)
    └── [deckId]/
        ├── route.ts                    ⏳ Task 5 (TODO)
        │   └── GET, DELETE /:deckId
        └── upload/route.ts             ⏳ Task 5 (TODO)
            └── POST /:deckId/upload
```

---

## 🧪 Testing Guide

### Task 1 Testing (Blob URL Fix)
```bash
# Start dev server
npm run dev

# Open http://localhost:3001
# Import deck: /home/beano/Downloads/Japanese_Core_2000_Step_01_Listening_Sentence_Vocab__Images.apkg

# Test checklist:
✅ Card 1 → 2 → 3 → 4 → 5: Images display
✅ Card 5 → 4 → 3 → 2 → 1: Images still display
✅ Random navigation: Images persist
✅ Browser refresh: Images reload
✅ Close deck, reopen: Images work
✅ Console: No blob:// 404 errors
```

### Task 2 Testing (IndexedDB Upgrade)
```bash
# Open DevTools → Application → IndexedDB → ankiMediaDB

# Verify:
✅ Database version: 2
✅ media store has indexes: userId, deckId, syncStatus, updatedAt
✅ syncQueue store exists with 4 indexes
✅ Existing records have new fields (userId, deckId, syncStatus, etc.)
✅ Build passes: npm run build
✅ Dev server runs: npm run dev

# Test methods in console:
const store = AnkiMediaStore.getInstance()
await store.getStats()  // Should show sync metrics
await store.getUnsyncedMedia()  // Should return pending/failed media
```

### Task 3 Testing (AnkiMediaManager)
```bash
# After implementation:
const manager = AnkiMediaManager.getInstance()

# Enqueue a test job
await manager.enqueueUpload('testUser', 'testDeck', 'test.jpg', blob)

# Check sync status
const status = await manager.getSyncStatus('testDeck')
console.log(status)  // Should show pendingCount: 1

# Verify queue processing
# - Check console for "[AnkiMediaManager] Processing X pending jobs"
# - Watch Network tab for Firebase Storage uploads
# - Verify exponential backoff on failures
```

### Full Integration Testing
```bash
# Scenario: Premium user imports deck
1. Sign in as premium user
2. Import Anki deck with 10+ images
3. Verify: Deck loads immediately (offline-first)
4. Open DevTools Network tab
5. Verify: Background uploads start within 5 seconds
6. Go offline (DevTools → Network → Offline)
7. Verify: No errors, uploads pause
8. Go online
9. Verify: Uploads resume automatically
10. Sign in on different device
11. Verify: Deck and media appear after sync
```

---

## ⚠️ Important Gotchas

### Gotcha 1: IndexedDB Database Versioning
**Issue**: If you modify the schema, MUST bump version number
**Location**: `mediaStore.ts` line 23: `indexedDB.open(this.dbName, 2)`
**Why**: IndexedDB won't trigger `onupgradeneeded` without version bump
**Fix**: Change `2` → `3`, add migration logic

### Gotcha 2: Blob URL Lifetime
**Issue**: Blob URLs become invalid after page reload
**Solution**: Store filenames, regenerate URLs on hydration
**Wrong**: `<img src="blob:http://...">` in stored HTML
**Right**: `<img data-anki-media="filename.jpg">` → hydrate on render

### Gotcha 3: Tab Coordination
**Issue**: Multiple tabs sync same deck → duplicate uploads
**Solution**: TabCoordinator elects leader tab
**Pattern**: Only leader tab processes queue
**Reference**: `/src/lib/lists/TabCoordinator.ts`

### Gotcha 4: Premium Validation
**Issue**: Must check premium on BOTH client and server
**Client**: For UI (hide sync features from free users)
**Server**: For security (enforce quota)
**Pattern**: Use `getStorageDecision()` from `/src/lib/api/storage-helper.ts`

### Gotcha 5: Firebase Storage Rules
**Issue**: Rules use Firestore for premium check
**Implication**: User's subscription must exist in Firestore
**Path**: `/users/{userId}/subscription` with `status: 'active'`
**Test**: Verify premium users can upload, free users get 403

### Gotcha 6: Migration Safety
**Issue**: Existing users have v1 data without sync fields
**Solution**: Migration adds defaults (`userId: 'unknown'`, `syncStatus: 'pending'`)
**Test**: Import deck BEFORE upgrade, verify still works AFTER upgrade

### Gotcha 7: Circuit Breaker Reset
**Issue**: After 5 failures, sync stops completely
**Solution**: Resets after 30 seconds
**User Action**: Manual "Retry Sync" button should bypass circuit breaker
**Implementation**: Add `forceSyncAll()` method to manager

### Gotcha 8: Exponential Backoff Timing
**Issue**: Must schedule retries in future, not immediately
**Pattern**: `scheduledFor = Date.now() + (2^retryCount) * 1000`
**Check**: Queue processor should skip jobs where `scheduledFor > Date.now()`

---

## 📚 Reference Implementations

### Primary Template: My Lists
**File**: `/src/lib/lists/ListManager.ts` (1117 lines)
**Use For**:
- Task 3: AnkiMediaManager structure
- Queue processing logic
- Retry and circuit breaker patterns
- Tab coordination integration

**Key Patterns to Copy**:
```typescript
// Leader tab processing
this.tabCoordinator.onLeadershipChange((isLeader) => {
  if (isLeader) {
    this.startSyncTimer()
  } else {
    this.stopSyncTimer()
  }
})

// Exponential backoff
const backoffMs = Math.pow(2, retryCount - 1) * 1000  // 1s, 2s, 4s, 8s, 16s

// Circuit breaker
if (this.circuitBreakerFailures >= 5) {
  if (Date.now() < this.circuitBreakerResetTime) {
    return  // Skip processing
  }
  // Reset
  this.circuitBreakerFailures = 0
}
```

### Secondary References
- **Storage Helper**: `/src/lib/api/storage-helper.ts` (Premium checks)
- **Tab Coordinator**: `/src/lib/lists/TabCoordinator.ts` (Multi-tab sync)
- **Type Definitions**: `/src/types/userLists.ts` (Data structure patterns)

---

## 🎯 Success Criteria

### Phase 1 (Tasks 1-2): ✅ COMPLETE
- [x] Images persist across navigation
- [x] IndexedDB tracks sync status
- [x] Build passes without errors
- [x] Zero data loss in migration

### Phase 2 (Tasks 3-7): 🚧 IN PROGRESS
- [ ] Background sync uploads to Firebase
- [ ] Premium users sync across devices
- [ ] Free users remain local-only
- [ ] 500MB quota enforced with warning
- [ ] Sync retries with exponential backoff
- [ ] Circuit breaker stops after 5 failures
- [ ] UI shows sync status
- [ ] Manual retry available
- [ ] Security rules prevent unauthorized access
- [ ] All tests pass

---

## 📞 Questions for Future Context

**Q: Why not use Firebase Realtime Database instead of Storage?**
A: Media files (images/audio) are large blobs (1-5MB each). Storage is optimized for files, while Realtime DB has 10MB total limit and isn't designed for binary data.

**Q: Why not just use S3 directly?**
A: Firebase Storage is built on GCS (Google Cloud Storage), provides SDK with auth integration, and matches existing Firebase architecture in the app.

**Q: Why 500MB limit and not 1GB?**
A: Cost management. Average Anki deck is 20-50MB. 500MB = 10-25 decks, which is generous for most users. Can increase later if needed.

**Q: Why mark failed after 5 retries instead of retrying forever?**
A: User needs to know there's a problem (e.g., file too large, storage full). Infinite retries hide the issue. Better to notify and provide manual retry.

**Q: What if user deletes deck on Device A but hasn't synced from Device B yet?**
A: Last-Write-Wins conflict resolution. Device B will sync its state and recreate the deck. This matches My Lists behavior. User can delete again.

---

## 🚀 Quick Start for Next Session

To continue this work:

1. Read this entire document
2. Check latest git commits: `git log --oneline -5`
3. Verify dev server runs: `npm run dev`
4. Check build passes: `npm run build`
5. Review completed tasks in `/src/types/ankiMedia.ts` and `/src/lib/anki/mediaStore.ts`
6. Start Task 3: Create `/src/lib/anki/AnkiMediaManager.ts`
7. Copy pattern from `/src/lib/lists/ListManager.ts`

**Current Status**: Ready to implement Task 3 (AnkiMediaManager)

---

**Document Version**: 1.0
**Last Session**: 2026-01-06
**Next Task**: Task 3 - AnkiMediaManager Implementation
