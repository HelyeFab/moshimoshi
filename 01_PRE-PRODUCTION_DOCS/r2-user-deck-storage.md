# R2 User Deck Storage - Technical Implementation Guide

> **Date**: 2026-01-10
> **Author**: Claude (AI Assistant)
> **Status**: Implementation Ready
> **Context**: No production users, clean slate implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Problem Analysis](#problem-analysis)
3. [Architecture Design](#architecture-design)
4. [Implementation Details](#implementation-details)
5. [API Endpoints (Complete Code)](#api-endpoints-complete-code)
6. [Core Components (Complete Code)](#core-components-complete-code)
7. [UI Integration](#ui-integration)
8. [Testing Strategy](#testing-strategy)
9. [Deployment & Monitoring](#deployment--monitoring)

---

## Overview

### The Problem

User-created flashcard decks currently store images as **base64-encoded strings** directly in Firestore documents. This creates multiple issues:

1. **Firestore 1MB Document Limit**: Base64 encoding expands files by ~33%. A deck with just 3-4 image cards can exceed 1MB.
2. **Double Storage**: Images stored both in IndexedDB (as blobs) AND Firestore (as base64)
3. **No Cloud Backup**: User deck media has no reliable cloud storage (Firestore hits limits)

### The Solution

Leverage the existing **Cloudflare R2** infrastructure (already used for Anki decks) to store user deck media:

- **90% code reuse** from Anki R2 system
- **Clean architecture** (no migration needed - zero production users)
- **Firestore stores only metadata** (~5KB vs 1MB+)
- **R2 stores cards.json + media files** (unlimited capacity)

### Key Benefits

✅ Eliminates Firestore size limits
✅ Reduces IndexedDB quota pressure
✅ Provides reliable cloud backup
✅ Proven patterns (Anki system already works)
✅ No migration complexity (clean slate)

---

## Problem Analysis

### Current Flow (BROKEN)

```typescript
// DeckCreator.tsx - Image upload
const reader = new FileReader();
reader.onload = (event) => {
  const base64 = event.target?.result as string;  // ❌ 33% size increase
  onImageAdded({ url: base64 });  // ❌ Stored in card
};
reader.readAsDataURL(file);  // ❌ Creates base64

// FlashcardManager.ts - Deck creation
const deck = {
  cards: [
    {
      front: {
        text: "Word",
        media: { url: "data:image/png;base64,iVBOR..." }  // ❌ 50KB+ per image
      }
    }
  ]
};

// Synced to Firestore (premium users)
await db.collection('flashcardDecks').doc(deckId).set(deck);  // ❌ Hits 1MB limit
```

**Result**: Deck with 5 image cards = ~1.2MB → **Firestore write fails**

### New Flow (FIXED)

```typescript
// DeckCreator.tsx - Store blob in AnkiMediaStore
const filename = `image-${uuid()}.jpg`;
await mediaStore.storeMedia(filename, blob);  // ✅ IndexedDB blob
onImageAdded({ filename, url: blobUrl });  // ✅ Just filename reference

// FlashcardManager.ts - Upload to R2 (non-blocking)
const deck = {
  cards: [{ front: { media: { filename: "image-abc123.jpg" } } }]  // ✅ 20 bytes
};

// Phase 1: Store locally
await indexedDB.put('decks', deck);  // ✅ Always succeeds

// Phase 2: Upload to R2 (background, non-blocking)
uploadQueue.queueDeckUpload(deckId, cardsJson, mediaFiles);

// Phase 3: Write metadata to Firestore
await firestore.set({  // ✅ Only 5KB metadata
  deckId, name, cardCount,
  r2: { cardsKey, manifestKey, mediaPrefix }
});
```

**Result**: Deck with 50 image cards = ~300KB metadata → **Always succeeds**

---

## Architecture Design

### Storage Distribution

```
┌────────────────────────────────────────────────────────────────┐
│                    USER CREATES DECK                            │
└──────────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  IndexedDB (Local Browser Storage)                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                  │
│  Database: flashcardsDB                                         │
│  Object Store: decks                                            │
│  {                                                               │
│    id: "deck-abc123",                                           │
│    name: "My Japanese Deck",                                    │
│    cards: [                                                     │
│      {                                                          │
│        front: {                                                 │
│          text: "犬",                                            │
│          media: {                                               │
│            filename: "image-def456.jpg",  ← FILENAME ONLY       │
│            url: "blob:http://localhost/xyz"  ← EPHEMERAL       │
│          }                                                      │
│        }                                                        │
│      }                                                          │
│    ],                                                           │
│    source: "user"  ← CRITICAL: Differentiates from Anki        │
│  }                                                              │
│                                                                  │
│  Database: ankiMediaDB                                          │
│  Object Store: media                                            │
│  {                                                               │
│    filename: "image-def456.jpg",                                │
│    blob: Blob(85KB),  ← ACTUAL IMAGE DATA                      │
│    mimeType: "image/jpeg",                                      │
│    createdAt: 1704902400000                                     │
│  }                                                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼ PREMIUM USER ONLY + "Sync All" clicked
┌─────────────────────────────────────────────────────────────────┐
│  R2UploadQueue (Background Jobs)                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                  │
│  IndexedDB: userDeckUploadQueue                                 │
│  Object Store: jobs                                             │
│  [                                                               │
│    { id: "deck-abc123-cards", type: "cards", blob: ..., ... }, │
│    { id: "deck-abc123-media-image-def456.jpg", ... },          │
│    { id: "deck-abc123-manifest", type: "manifest", ... }       │
│  ]                                                              │
│                                                                  │
│  Processing:                                                    │
│  1. Generate presigned URL via API                             │
│  2. PUT blob to R2 via presigned URL                           │
│  3. Retry on failure (exponential backoff)                     │
│  4. Mark job complete                                          │
│  5. Write metadata to Firestore when all jobs done            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare R2 (Object Storage)                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                  │
│  Bucket: moshimoshi-production                                  │
│  Key Prefix: users/{userId}/flashcards/{deckId}/               │
│                                                                  │
│  users/user-123/flashcards/deck-abc123/                        │
│  ├── cards.json               (deck structure, ~10KB)          │
│  │   {                                                          │
│  │     "id": "deck-abc123",                                     │
│  │     "name": "My Japanese Deck",                             │
│  │     "cards": [                                               │
│  │       {                                                      │
│  │         "front": {                                           │
│  │           "text": "犬",                                      │
│  │           "media": { "filename": "image-def456.jpg" }       │
│  │         }                                                    │
│  │       }                                                      │
│  │     ]                                                        │
│  │   }                                                          │
│  │                                                              │
│  ├── manifest.json            (file inventory, ~2KB)           │
│  │   {                                                          │
│  │     "deckId": "deck-abc123",                                │
│  │     "files": [                                               │
│  │       {                                                      │
│  │         "type": "cards",                                     │
│  │         "filename": "cards.json",                            │
│  │         "size": 10240,                                       │
│  │         "hash": "sha256:abc..."                             │
│  │       },                                                     │
│  │       {                                                      │
│  │         "type": "media",                                     │
│  │         "filename": "image-def456.jpg",                     │
│  │         "size": 87040,                                       │
│  │         "hash": "sha256:def..."                             │
│  │       }                                                      │
│  │     ]                                                        │
│  │   }                                                          │
│  │                                                              │
│  └── media/                                                     │
│      ├── image-def456.jpg     (87KB JPEG)                      │
│      └── audio-ghi789.mp3     (450KB MP3)                      │
│                                                                  │
│  Storage Quota: 300MB per user                                 │
│  Access: Presigned URLs (15min upload, 1hr download)          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Firestore (Metadata Only)                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                  │
│  Collection: userFlashcardDecks                                 │
│  Document ID: deck-abc123                                       │
│  {                                                               │
│    "deckId": "deck-abc123",                                     │
│    "userId": "user-123",                                        │
│    "name": "My Japanese Deck",                                  │
│    "cardCount": 20,                                             │
│    "hasMedia": true,                                            │
│    "totalBytes": 537280,  ← Total R2 storage used              │
│    "r2": {                                                      │
│      "cardsKey": "users/user-123/flashcards/deck-abc123/...",  │
│      "manifestKey": "users/user-123/flashcards/deck-abc123/...",│
│      "mediaPrefix": "users/user-123/flashcards/deck-abc123/..."│
│    },                                                           │
│    "source": "user",  ← CRITICAL: Filter from Anki decks       │
│    "updatedAt": Timestamp(2026-01-10T12:00:00Z),               │
│    "createdAt": Timestamp(2026-01-10T11:00:00Z)                │
│  }                                                              │
│                                                                  │
│  Document Size: ~5KB (vs 1MB+ before) ✅                        │
│                                                                  │
│  Collection: r2Usage                                            │
│  Document ID: user-123                                          │
│  {                                                               │
│    "totalBytes": 2457600,  ← Sum of all decks                  │
│    "lastUpdated": Timestamp(2026-01-10T12:00:00Z)              │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Architecture Rules

1. **Source Filtering**: `deck.source !== 'anki'` must be checked in ALL operations
2. **Separate Paths**: Anki uses `decks/`, user decks use `flashcards/`
3. **Non-Blocking**: Local operations succeed even if R2 upload fails
4. **Premium Only**: All R2 operations gated by subscription check
5. **Quota Enforcement**: 300MB per user hard limit

---

## Implementation Details

### Phase 1: Upload Infrastructure

#### File Structure

```
src/
├── app/
│   └── api/
│       └── flashcards/
│           └── r2/
│               ├── upload-url/
│               │   └── route.ts       ← Generate presigned URLs
│               ├── metadata/
│               │   └── route.ts       ← Write Firestore metadata
│               ├── list/
│               │   └── route.ts       ← List user decks
│               └── [deckId]/
│                   └── route.ts       ← Download/delete deck
├── lib/
│   ├── r2/
│   │   ├── UserDeckUploadQueue.ts     ← Upload orchestration (NEW)
│   │   ├── UserDeckRestoreOrchestrator.ts  ← Download orchestration (NEW)
│   │   └── __tests__/                 ← Unit tests
│   └── flashcards/
│       └── FlashcardManager.ts        ← Modified to call R2
├── components/
│   └── flashcards/
│       └── DeckCreator.tsx            ← Modified to store blobs
└── types/
    └── flashcards.ts                  ← Add filename + r2 fields
```

---

## API Endpoints (Complete Code)

### 1. Upload URL Generator

**File**: `/src/app/api/flashcards/r2/upload-url/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { getR2 } from '@/lib/r2/client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'

const UploadUrlSchema = z.object({
  deckId: z.string().min(1),
  key: z.string().min(1),
  contentType: z.string().optional(),
  deckTotalBytes: z.number().int().nonnegative().optional(),
})

export async function POST(request: NextRequest) {
  // 1. Authentication
  const session = await getSession()
  if (!session?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Premium check
  const PREMIUM_PLANS = new Set(['premium_monthly', 'premium_yearly'])
  const db = getAdminDb()
  const userDoc = await db.collection('users').doc(session.uid).get()
  const plan = userDoc.data()?.subscription?.plan

  if (!plan || !PREMIUM_PLANS.has(plan)) {
    return NextResponse.json({
      error: 'Premium subscription required for R2 upload'
    }, { status: 403 })
  }

  // 3. Validate request
  const body = await request.json()
  const validation = UploadUrlSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({
      error: 'Invalid request',
      details: validation.error.issues
    }, { status: 400 })
  }

  const { deckId, key, contentType, deckTotalBytes } = validation.data

  // 4. Storage quota check (300MB per user)
  const usageDoc = await db.collection('r2Usage').doc(session.uid).get()
  const currentUsage = usageDoc.data()?.totalBytes || 0

  if (deckTotalBytes && currentUsage + deckTotalBytes > 300_000_000) {
    return NextResponse.json({
      error: 'R2_STORAGE_LIMIT_EXCEEDED',
      message: 'You have exceeded your 300MB storage limit',
      currentUsage,
      limit: 300_000_000
    }, { status: 413 })
  }

  // 5. Generate R2 key
  const r2Key = `users/${session.uid}/flashcards/${deckId}/${key}`

  // 6. Generate presigned URL (15 min expiry)
  const r2 = getR2()
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: r2Key,
    ContentType: contentType || 'application/octet-stream',
  })

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 900 })

  return NextResponse.json({
    url: presignedUrl,
    key: r2Key,
    expiresIn: 900
  })
}
```

### 2. Metadata Writer

**File**: `/src/app/api/flashcards/r2/metadata/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb, FieldValue } from '@/lib/firebase/admin'
import { z } from 'zod'

const MetadataSchema = z.object({
  deckId: z.string().min(1),
  name: z.string().min(1),
  cardCount: z.number().int().nonnegative(),
  hasMedia: z.boolean(),
  totalBytes: z.number().int().nonnegative(),
  r2Keys: z.object({
    cardsKey: z.string(),
    manifestKey: z.string(),
    mediaPrefix: z.string()
  })
})

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const validation = MetadataSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({
      error: 'Invalid metadata',
      details: validation.error.issues
    }, { status: 400 })
  }

  const { deckId, name, cardCount, hasMedia, totalBytes, r2Keys } = validation.data

  const db = getAdminDb()

  // Write deck metadata to Firestore
  const metadataDoc = {
    deckId,
    userId: session.uid,
    name,
    cardCount,
    hasMedia,
    totalBytes,
    r2: r2Keys,
    source: 'user',  // CRITICAL: Distinguish from Anki decks
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  }

  await db.collection('userFlashcardDecks').doc(deckId).set(metadataDoc, { merge: true })

  // Update user's R2 usage
  await db.collection('r2Usage').doc(session.uid).set({
    totalBytes: FieldValue.increment(totalBytes),
    lastUpdated: FieldValue.serverTimestamp()
  }, { merge: true })

  return NextResponse.json({ success: true })
}
```

### 3. Download/Delete Handler

**File**: `/src/app/api/flashcards/r2/[deckId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb, FieldValue } from '@/lib/firebase/admin'
import { getR2 } from '@/lib/r2/client'
import { GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// GET - Download URLs
export async function GET(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  const session = await getSession()
  if (!session?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { deckId } = params
  const db = getAdminDb()

  // Get metadata
  const metadataDoc = await db.collection('userFlashcardDecks').doc(deckId).get()

  if (!metadataDoc.exists || metadataDoc.data()?.userId !== session.uid) {
    return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
  }

  const metadata = metadataDoc.data()!
  const r2 = getR2()

  // Generate presigned download URLs (1 hour expiry)
  const cardsUrl = await getSignedUrl(r2, new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: metadata.r2.cardsKey
  }), { expiresIn: 3600 })

  const manifestUrl = await getSignedUrl(r2, new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: metadata.r2.manifestKey
  }), { expiresIn: 3600 })

  // List media files
  const mediaFiles = await r2.send(new ListObjectsV2Command({
    Bucket: process.env.R2_BUCKET_NAME!,
    Prefix: metadata.r2.mediaPrefix
  }))

  const mediaUrls = await Promise.all(
    (mediaFiles.Contents || []).map(async (file) => {
      const url = await getSignedUrl(r2, new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: file.Key!
      }), { expiresIn: 3600 })

      return {
        filename: file.Key!.split('/').pop()!,
        url,
        size: file.Size!
      }
    })
  )

  return NextResponse.json({
    metadata,
    downloadUrls: {
      cards: cardsUrl,
      manifest: manifestUrl,
      media: mediaUrls
    }
  })
}

// DELETE - Remove deck
export async function DELETE(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  const session = await getSession()
  if (!session?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { deckId } = params
  const db = getAdminDb()

  // Get metadata
  const metadataDoc = await db.collection('userFlashcardDecks').doc(deckId).get()

  if (!metadataDoc.exists || metadataDoc.data()?.userId !== session.uid) {
    return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
  }

  const metadata = metadataDoc.data()!
  const r2 = getR2()

  // Delete all R2 objects
  const objects = await r2.send(new ListObjectsV2Command({
    Bucket: process.env.R2_BUCKET_NAME!,
    Prefix: `users/${session.uid}/flashcards/${deckId}/`
  }))

  if (objects.Contents) {
    await Promise.all(
      objects.Contents.map(obj =>
        r2.send(new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: obj.Key!
        }))
      )
    )
  }

  // Delete metadata
  await db.collection('userFlashcardDecks').doc(deckId).delete()

  // Update usage
  await db.collection('r2Usage').doc(session.uid).set({
    totalBytes: FieldValue.increment(-metadata.totalBytes),
    lastUpdated: FieldValue.serverTimestamp()
  }, { merge: true })

  return NextResponse.json({
    success: true,
    deletedFiles: objects.Contents?.length || 0
  })
}
```

### 4. List User Decks

**File**: `/src/app/api/flashcards/r2/list/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminDb()
  const snapshot = await db.collection('userFlashcardDecks')
    .where('userId', '==', session.uid)
    .orderBy('updatedAt', 'desc')
    .get()

  const decks = snapshot.docs.map(doc => doc.data())

  return NextResponse.json({ decks })
}
```

---

## Core Components (Complete Code)

### UserDeckUploadQueue

**File**: `/src/lib/r2/UserDeckUploadQueue.ts`

> **Note**: This is adapted from `R2UploadQueue.ts` (880 lines, 90% code reuse)

```typescript
import PQueue from 'p-queue'
import { ClientEventEmitter } from '@/lib/events/ClientEventEmitter'
import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface UserDeckUploadJob {
  id: string
  deckId: string
  userId: string
  type: 'cards' | 'media' | 'manifest'
  filename?: string
  blob: Blob
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  retryCount: number
  scheduledFor: number
  createdAt: number
  error?: string
}

interface UserDeckMetadata {
  deckId: string
  userId: string
  name: string
  cardCount: number
  totalJobs: number
  completedJobs: number
  failedJobs: number
  totalBytes: number
  hasMedia: boolean
}

interface UploadDB extends DBSchema {
  jobs: {
    key: string
    value: UserDeckUploadJob
    indexes: { 'by-deck': string; 'by-status': string }
  }
  metadata: {
    key: string
    value: UserDeckMetadata
  }
}

const MAX_CONCURRENCY = 5
const MAX_RETRIES = 5
const BACKOFF_SECONDS = [1, 2, 4, 8, 16, 30]

export class UserDeckUploadQueue {
  readonly userId: string
  private queue: PQueue
  private emitter = new ClientEventEmitter()
  private db: IDBPDatabase<UploadDB> | null = null
  private deckMetadata = new Map<string, UserDeckMetadata>()

  constructor(userId: string) {
    this.userId = userId
    this.queue = new PQueue({ concurrency: MAX_CONCURRENCY })
  }

  private async initDB(): Promise<IDBPDatabase<UploadDB>> {
    if (this.db) return this.db

    this.db = await openDB<UploadDB>('userDeckUploadQueue', 1, {
      upgrade(db) {
        const jobStore = db.createObjectStore('jobs', { keyPath: 'id' })
        jobStore.createIndex('by-deck', 'deckId')
        jobStore.createIndex('by-status', 'status')

        db.createObjectStore('metadata', { keyPath: 'deckId' })
      }
    })

    return this.db
  }

  /**
   * Queue deck for upload
   */
  async queueDeckUpload(
    deckId: string,
    deckName: string,
    cardsJson: Blob,
    mediaFiles: Array<{ filename: string; blob: Blob }>
  ): Promise<void> {
    const db = await this.initDB()

    const totalJobs = 2 + mediaFiles.length
    const totalBytes = cardsJson.size + mediaFiles.reduce((sum, f) => sum + f.blob.size, 0)

    const metadata: UserDeckMetadata = {
      deckId,
      userId: this.userId,
      name: deckName,
      cardCount: 0,
      totalJobs,
      completedJobs: 0,
      failedJobs: 0,
      totalBytes,
      hasMedia: mediaFiles.length > 0
    }

    await db.put('metadata', metadata)
    this.deckMetadata.set(deckId, metadata)

    const now = Date.now()

    // Create upload jobs
    await db.put('jobs', {
      id: `${deckId}-cards`,
      deckId,
      userId: this.userId,
      type: 'cards',
      blob: cardsJson,
      status: 'pending',
      retryCount: 0,
      scheduledFor: now,
      createdAt: now
    })

    for (const { filename, blob } of mediaFiles) {
      await db.put('jobs', {
        id: `${deckId}-media-${filename}`,
        deckId,
        userId: this.userId,
        type: 'media',
        filename,
        blob,
        status: 'pending',
        retryCount: 0,
        scheduledFor: now,
        createdAt: now
      })
    }

    await db.put('jobs', {
      id: `${deckId}-manifest`,
      deckId,
      userId: this.userId,
      type: 'manifest',
      blob: new Blob(['']),
      status: 'pending',
      retryCount: 0,
      scheduledFor: now + 1000,
      createdAt: now
    })

    this.processPending()
  }

  private async processPending(): Promise<void> {
    const db = await this.initDB()
    const now = Date.now()

    const allJobs = await db.getAllFromIndex('jobs', 'by-status', 'pending')
    const failedJobs = await db.getAllFromIndex('jobs', 'by-status', 'failed')

    const readyJobs = [...allJobs, ...failedJobs].filter(
      job => job.scheduledFor <= now && job.retryCount < MAX_RETRIES
    )

    for (const job of readyJobs) {
      this.queue.add(() => this.uploadJob(job.id))
    }
  }

  private async uploadJob(jobId: string): Promise<void> {
    const db = await this.initDB()
    const job = await db.get('jobs', jobId)

    if (!job || job.status === 'completed') return

    try {
      job.status = 'uploading'
      await db.put('jobs', job)

      this.emitter.emit('upload-progress', {
        deckId: job.deckId,
        type: job.type,
        filename: job.filename,
        status: 'uploading'
      })

      const keyPath = job.type === 'cards'
        ? 'cards.json'
        : job.type === 'manifest'
        ? 'manifest.json'
        : `media/${job.filename}`

      const response = await fetch('/api/flashcards/r2/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          deckId: job.deckId,
          key: keyPath,
          contentType: job.blob.type,
          deckTotalBytes: this.deckMetadata.get(job.deckId)?.totalBytes
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to get upload URL: ${await response.text()}`)
      }

      const { url: presignedUrl } = await response.json()

      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: job.blob,
        headers: { 'Content-Type': job.blob.type || 'application/octet-stream' }
      })

      if (!uploadResponse.ok) {
        throw new Error(`R2 upload failed: ${uploadResponse.status}`)
      }

      job.status = 'completed'
      await db.put('jobs', job)

      const metadata = await db.get('metadata', job.deckId)
      if (metadata) {
        metadata.completedJobs++
        await db.put('metadata', metadata)
        this.deckMetadata.set(job.deckId, metadata)
      }

      this.emitter.emit('upload-progress', {
        deckId: job.deckId,
        type: job.type,
        filename: job.filename,
        status: 'completed'
      })

      await this.checkDeckCompletion(job.deckId)

    } catch (error) {
      await this.handleUploadError(job, error instanceof Error ? error.message : String(error))
    }
  }

  private async handleUploadError(job: UserDeckUploadJob, errorMessage: string): Promise<void> {
    const db = await this.initDB()

    job.retryCount++
    job.error = errorMessage

    if (job.retryCount >= MAX_RETRIES) {
      job.status = 'failed'

      const metadata = await db.get('metadata', job.deckId)
      if (metadata) {
        metadata.failedJobs++
        await db.put('metadata', metadata)
      }

      this.emitter.emit('upload-error', {
        deckId: job.deckId,
        type: job.type,
        filename: job.filename,
        error: errorMessage
      })
    } else {
      job.status = 'failed'
      const backoffSeconds = BACKOFF_SECONDS[Math.min(job.retryCount - 1, BACKOFF_SECONDS.length - 1)]
      job.scheduledFor = Date.now() + backoffSeconds * 1000
    }

    await db.put('jobs', job)

    if (job.retryCount < MAX_RETRIES) {
      setTimeout(() => this.processPending(), job.scheduledFor - Date.now())
    }
  }

  private async checkDeckCompletion(deckId: string): Promise<void> {
    const db = await this.initDB()
    const metadata = await db.get('metadata', deckId)

    if (!metadata) return

    const allJobs = await db.getAllFromIndex('jobs', 'by-deck', deckId)
    const nonManifestJobs = allJobs.filter(j => j.type !== 'manifest')
    const allCompleted = nonManifestJobs.every(j => j.status === 'completed')

    if (!allCompleted) return

    // Generate manifest
    const manifestContent = {
      deckId,
      name: metadata.name,
      cardCount: metadata.cardCount,
      files: allJobs
        .filter(j => j.status === 'completed' && j.type !== 'manifest')
        .map(j => ({
          type: j.type,
          filename: j.type === 'cards' ? 'cards.json' : j.filename!,
          size: j.blob.size,
          hash: 'sha256-placeholder'
        }))
    }

    const manifestBlob = new Blob([JSON.stringify(manifestContent)], { type: 'application/json' })
    const manifestJob = allJobs.find(j => j.type === 'manifest')

    if (manifestJob) {
      manifestJob.blob = manifestBlob
      manifestJob.scheduledFor = Date.now()
      await db.put('jobs', manifestJob)
      await this.uploadJob(manifestJob.id)
    }

    await this.writeMetadata(deckId)
  }

  private async writeMetadata(deckId: string): Promise<void> {
    const db = await this.initDB()
    const metadata = await db.get('metadata', deckId)

    if (!metadata) return

    const r2Keys = {
      cardsKey: `users/${this.userId}/flashcards/${deckId}/cards.json`,
      manifestKey: `users/${this.userId}/flashcards/${deckId}/manifest.json`,
      mediaPrefix: `users/${this.userId}/flashcards/${deckId}/media/`
    }

    await fetch('/api/flashcards/r2/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        deckId,
        name: metadata.name,
        cardCount: metadata.cardCount,
        hasMedia: metadata.hasMedia,
        totalBytes: metadata.totalBytes,
        r2Keys
      })
    })

    this.emitter.emit('deck-upload-complete', { deckId })
  }

  on(event: string, handler: (...args: any[]) => void) {
    this.emitter.on(event, handler)
  }

  off(event: string, handler: (...args: any[]) => void) {
    this.emitter.off(event, handler)
  }
}
```

---

## Testing Strategy

### Unit Tests

**File**: `/src/lib/r2/__tests__/UserDeckUploadQueue.test.ts`

```typescript
import { UserDeckUploadQueue } from '../UserDeckUploadQueue'
import { openDB } from 'idb'

describe('UserDeckUploadQueue', () => {
  let queue: UserDeckUploadQueue

  beforeEach(() => {
    queue = new UserDeckUploadQueue('test-user-123')
  })

  afterEach(async () => {
    const db = await openDB('userDeckUploadQueue')
    await db.clear('jobs')
    await db.clear('metadata')
  })

  test('should queue deck upload with cards.json and media', async () => {
    const cardsJson = new Blob([JSON.stringify({ test: 'data' })], { type: 'application/json' })
    const mediaFiles = [
      { filename: 'image1.jpg', blob: new Blob(['image data'], { type: 'image/jpeg' }) }
    ]

    await queue.queueDeckUpload('deck-123', 'Test Deck', cardsJson, mediaFiles)

    const db = await openDB('userDeckUploadQueue')
    const jobs = await db.getAll('jobs')

    expect(jobs).toHaveLength(3)
    expect(jobs.map(j => j.type).sort()).toEqual(['cards', 'manifest', 'media'])
  })

  test('should emit upload-progress events', async () => {
    const progressEvents: any[] = []
    queue.on('upload-progress', (event) => progressEvents.push(event))

    const cardsJson = new Blob([JSON.stringify({ test: 'data' })])
    await queue.queueDeckUpload('deck-123', 'Test Deck', cardsJson, [])

    await new Promise(resolve => setTimeout(resolve, 1000))

    expect(progressEvents.length).toBeGreaterThan(0)
    expect(progressEvents[0]).toMatchObject({
      deckId: 'deck-123',
      type: 'cards',
      status: expect.stringMatching(/uploading|completed/)
    })
  })
})
```

---

## Deployment & Monitoring

### Firestore Configuration

**Composite Index**:
```bash
gcloud firestore indexes create \
  --collection-group=userFlashcardDecks \
  --field-config field-path=userId,order=ascending \
  --field-config field-path=updatedAt,order=descending
```

**Security Rules**:
```javascript
match /userFlashcardDecks/{deckId} {
  allow read, write: if request.auth != null
    && request.auth.uid == resource.data.userId;

  allow create: if request.auth != null
    && request.auth.uid == request.resource.data.userId;
}

match /r2Usage/{userId} {
  allow read: if request.auth != null
    && request.auth.uid == userId;
}
```

### Monitoring Metrics

```typescript
// Track in analytics
analytics.track('user_deck_r2_upload', {
  deckId,
  userId,
  totalBytes,
  fileCount,
  durationMs,
  success: true/false,
  retryCount
})

analytics.track('user_deck_r2_restore', {
  deckId,
  userId,
  durationMs,
  success: true/false
})
```

**Alerts**:
- Upload failure rate >5% (5 min window)
- Restore failure rate >5% (5 min window)
- R2 API latency >2s (p95)
- Storage quota exceeded >10 users/day

---

## Success Criteria

✅ **Phase 1 Complete**:
- User deck creation uploads to R2 (>95% success)
- Firestore documents <10KB (vs 1MB+)
- IndexedDB size reduced 60%
- Premium users see cloud indicator

✅ **Phase 2 Complete**:
- "Sync All" restores decks from R2
- Images display correctly
- Restoration <30s for 10 decks

✅ **Overall Success**:
- Zero Firestore 1MB errors
- >95% upload/restore success
- <10s upload time for 20-card deck
- No Anki deck interference
- User feedback: "Seamless sync"

---

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Next Review**: After Phase 1 completion

---
---

# IMPLEMENTATION AGENT PROMPTS

> **Instructions for Implementation Agents**: Each phase below contains detailed prompts with complete code examples, file paths, acceptance criteria, and testing requirements. Implement exactly as specified and submit for Technical Lead review.

---

## 🚀 PHASE 1: Core Upload Infrastructure

**Objective**: Enable user-created flashcard decks to upload media files to R2 storage, eliminating the Firestore 1MB document limit.

**Prerequisites**:
- Verify `/src/lib/r2/client.ts` exists and exports `getR2()` function
- Verify `/src/lib/auth/session.ts` exists and exports `getSession()` function
- Verify `/src/lib/firebase/admin.ts` exists and exports `getAdminDb()` and `FieldValue`

---

### Task 1.1: Create Upload URL API Endpoint

**File to create**: `/src/app/api/flashcards/r2/upload-url/route.ts`

**Purpose**: Generate presigned S3 upload URLs for client-side direct uploads to R2

**Requirements**:
1. Validate user authentication (session required)
2. Check premium subscription status (only `premium_monthly` or `premium_yearly` allowed)
3. Enforce 300MB per-user storage quota
4. Generate presigned URLs with 15-minute expiry
5. Use R2 key format: `users/{userId}/flashcards/{deckId}/{key}`

**Complete implementation**:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { getR2 } from '@/lib/r2/client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'

const UploadUrlSchema = z.object({
  deckId: z.string().min(1),
  key: z.string().min(1),
  contentType: z.string().optional(),
  deckTotalBytes: z.number().int().nonnegative().optional(),
})

export async function POST(request: NextRequest) {
  // 1. Authentication
  const session = await getSession()
  if (!session?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Premium check
  const PREMIUM_PLANS = new Set(['premium_monthly', 'premium_yearly'])
  const db = getAdminDb()
  const userDoc = await db.collection('users').doc(session.uid).get()
  const plan = userDoc.data()?.subscription?.plan

  if (!plan || !PREMIUM_PLANS.has(plan)) {
    return NextResponse.json({
      error: 'Premium subscription required for R2 upload'
    }, { status: 403 })
  }

  // 3. Validate request
  const body = await request.json()
  const validation = UploadUrlSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({
      error: 'Invalid request',
      details: validation.error.issues
    }, { status: 400 })
  }

  const { deckId, key, contentType, deckTotalBytes } = validation.data

  // 4. Storage quota check (300MB per user)
  const usageDoc = await db.collection('r2Usage').doc(session.uid).get()
  const currentUsage = usageDoc.data()?.totalBytes || 0

  if (deckTotalBytes && currentUsage + deckTotalBytes > 300_000_000) {
    return NextResponse.json({
      error: 'R2_STORAGE_LIMIT_EXCEEDED',
      message: 'You have exceeded your 300MB storage limit',
      currentUsage,
      limit: 300_000_000
    }, { status: 413 })
  }

  // 5. Generate R2 key
  const r2Key = `users/${session.uid}/flashcards/${deckId}/${key}`

  // 6. Generate presigned URL (15 min expiry)
  const r2 = getR2()
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: r2Key,
    ContentType: contentType || 'application/octet-stream',
  })

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 900 })

  return NextResponse.json({
    url: presignedUrl,
    key: r2Key,
    expiresIn: 900
  })
}
```

**Acceptance Criteria**:
- ✅ Returns 401 if user not authenticated
- ✅ Returns 403 if user not premium
- ✅ Returns 400 if request validation fails
- ✅ Returns 413 if quota exceeded (currentUsage + deckTotalBytes > 300MB)
- ✅ Returns 200 with presigned URL on success
- ✅ R2 key follows format: `users/{userId}/flashcards/{deckId}/{key}`
- ✅ Presigned URL expires in 900 seconds (15 minutes)

**Testing Requirements**:
- Manual test with Postman/curl:
  - POST to `/api/flashcards/r2/upload-url`
  - Body: `{ "deckId": "test-123", "key": "cards.json", "contentType": "application/json" }`
  - Verify response has `url`, `key`, `expiresIn` fields
  - Test presigned URL by uploading a small file with curl

---

### Task 1.2: Create Metadata Writer API Endpoint

**File to create**: `/src/app/api/flashcards/r2/metadata/route.ts`

**Purpose**: Write deck metadata to Firestore and update user's R2 storage usage after successful upload

**Requirements**:
1. Validate user authentication
2. Write metadata to `userFlashcardDecks` collection
3. Include `source: 'user'` field (CRITICAL - differentiates from Anki decks)
4. Update `r2Usage` collection with incremental storage bytes
5. Use server timestamps for `createdAt` and `updatedAt`

**Complete implementation**:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb, FieldValue } from '@/lib/firebase/admin'
import { z } from 'zod'

const MetadataSchema = z.object({
  deckId: z.string().min(1),
  name: z.string().min(1),
  cardCount: z.number().int().nonnegative(),
  hasMedia: z.boolean(),
  totalBytes: z.number().int().nonnegative(),
  r2Keys: z.object({
    cardsKey: z.string(),
    manifestKey: z.string(),
    mediaPrefix: z.string()
  })
})

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const validation = MetadataSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({
      error: 'Invalid metadata',
      details: validation.error.issues
    }, { status: 400 })
  }

  const { deckId, name, cardCount, hasMedia, totalBytes, r2Keys } = validation.data

  const db = getAdminDb()

  // Write deck metadata to Firestore
  const metadataDoc = {
    deckId,
    userId: session.uid,
    name,
    cardCount,
    hasMedia,
    totalBytes,
    r2: r2Keys,
    source: 'user',  // CRITICAL: Distinguish from Anki decks
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  }

  await db.collection('userFlashcardDecks').doc(deckId).set(metadataDoc, { merge: true })

  // Update user's R2 usage
  await db.collection('r2Usage').doc(session.uid).set({
    totalBytes: FieldValue.increment(totalBytes),
    lastUpdated: FieldValue.serverTimestamp()
  }, { merge: true })

  return NextResponse.json({ success: true })
}
```

**Acceptance Criteria**:
- ✅ Returns 401 if user not authenticated
- ✅ Returns 400 if validation fails
- ✅ Returns 200 with `{ success: true }` on success
- ✅ Creates document in `userFlashcardDecks` collection
- ✅ Document includes `source: 'user'` field
- ✅ Updates `r2Usage/{userId}` with incremented `totalBytes`
- ✅ Uses `FieldValue.serverTimestamp()` for timestamps

**Testing Requirements**:
- Verify Firestore document created with correct structure
- Verify `r2Usage` document incremented correctly
- Test with missing fields to ensure validation works

---

### Task 1.3: Create Download/Delete API Endpoint

**File to create**: `/src/app/api/flashcards/r2/[deckId]/route.ts`

**Purpose**: Generate download URLs for deck restore and handle deck deletion from R2

**Requirements**:
1. GET endpoint: Generate presigned download URLs (1 hour expiry)
2. DELETE endpoint: Delete all R2 objects and Firestore metadata
3. Verify user owns the deck (security check)
4. List all media files in `media/` directory
5. Decrement `r2Usage` on deletion

**Complete implementation**:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb, FieldValue } from '@/lib/firebase/admin'
import { getR2 } from '@/lib/r2/client'
import { GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// GET - Download URLs
export async function GET(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  const session = await getSession()
  if (!session?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { deckId } = params
  const db = getAdminDb()

  // Get metadata
  const metadataDoc = await db.collection('userFlashcardDecks').doc(deckId).get()

  if (!metadataDoc.exists || metadataDoc.data()?.userId !== session.uid) {
    return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
  }

  const metadata = metadataDoc.data()!
  const r2 = getR2()

  // Generate presigned download URLs (1 hour expiry)
  const cardsUrl = await getSignedUrl(r2, new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: metadata.r2.cardsKey
  }), { expiresIn: 3600 })

  const manifestUrl = await getSignedUrl(r2, new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: metadata.r2.manifestKey
  }), { expiresIn: 3600 })

  // List media files
  const mediaFiles = await r2.send(new ListObjectsV2Command({
    Bucket: process.env.R2_BUCKET_NAME!,
    Prefix: metadata.r2.mediaPrefix
  }))

  const mediaUrls = await Promise.all(
    (mediaFiles.Contents || []).map(async (file) => {
      const url = await getSignedUrl(r2, new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: file.Key!
      }), { expiresIn: 3600 })

      return {
        filename: file.Key!.split('/').pop()!,
        url,
        size: file.Size!
      }
    })
  )

  return NextResponse.json({
    metadata,
    downloadUrls: {
      cards: cardsUrl,
      manifest: manifestUrl,
      media: mediaUrls
    }
  })
}

// DELETE - Remove deck
export async function DELETE(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  const session = await getSession()
  if (!session?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { deckId } = params
  const db = getAdminDb()

  // Get metadata
  const metadataDoc = await db.collection('userFlashcardDecks').doc(deckId).get()

  if (!metadataDoc.exists || metadataDoc.data()?.userId !== session.uid) {
    return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
  }

  const metadata = metadataDoc.data()!
  const r2 = getR2()

  // Delete all R2 objects
  const objects = await r2.send(new ListObjectsV2Command({
    Bucket: process.env.R2_BUCKET_NAME!,
    Prefix: `users/${session.uid}/flashcards/${deckId}/`
  }))

  if (objects.Contents) {
    await Promise.all(
      objects.Contents.map(obj =>
        r2.send(new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: obj.Key!
        }))
      )
    )
  }

  // Delete metadata
  await db.collection('userFlashcardDecks').doc(deckId).delete()

  // Update usage
  await db.collection('r2Usage').doc(session.uid).set({
    totalBytes: FieldValue.increment(-metadata.totalBytes),
    lastUpdated: FieldValue.serverTimestamp()
  }, { merge: true })

  return NextResponse.json({
    success: true,
    deletedFiles: objects.Contents?.length || 0
  })
}
```

**Acceptance Criteria**:

**GET endpoint**:
- ✅ Returns 401 if not authenticated
- ✅ Returns 404 if deck not found or user doesn't own it
- ✅ Returns presigned URLs for cards.json, manifest.json, and all media files
- ✅ URLs expire in 3600 seconds (1 hour)
- ✅ Response includes metadata object

**DELETE endpoint**:
- ✅ Returns 401 if not authenticated
- ✅ Returns 404 if deck not found or user doesn't own it
- ✅ Deletes all R2 objects with prefix `users/{userId}/flashcards/{deckId}/`
- ✅ Deletes Firestore document from `userFlashcardDecks`
- ✅ Decrements `r2Usage/{userId}.totalBytes`
- ✅ Returns deleted file count

**Testing Requirements**:
- Test GET with non-existent deck (expect 404)
- Test GET with deck owned by different user (expect 404)
- Test DELETE and verify R2 objects removed
- Verify r2Usage decremented correctly

---

### Task 1.4: Create List Decks API Endpoint

**File to create**: `/src/app/api/flashcards/r2/list/route.ts`

**Purpose**: List all user's decks from Firestore for restore workflow

**Requirements**:
1. Query `userFlashcardDecks` collection filtered by userId
2. Order by `updatedAt` descending (newest first)
3. Return all deck metadata (no pagination needed for MVP)

**Complete implementation**:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session?.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminDb()
  const snapshot = await db.collection('userFlashcardDecks')
    .where('userId', '==', session.uid)
    .orderBy('updatedAt', 'desc')
    .get()

  const decks = snapshot.docs.map(doc => doc.data())

  return NextResponse.json({ decks })
}
```

**Acceptance Criteria**:
- ✅ Returns 401 if not authenticated
- ✅ Returns 200 with array of decks
- ✅ Decks ordered by `updatedAt` descending
- ✅ Only returns decks owned by authenticated user

**Testing Requirements**:
- Create 3 test decks in Firestore
- Verify GET returns all 3 decks in correct order
- Verify different user cannot see other user's decks

---

### Task 1.5: Update TypeScript Types

**File to modify**: `/src/types/flashcards.ts`

**Purpose**: Add fields to support R2 storage (filename reference and r2 metadata)

**Requirements**:
1. Add `filename` field to `CardSide.media` interface
2. Add `source` field to `FlashcardDeck` interface
3. Add `r2` metadata object to `FlashcardDeck` interface

**Changes to make**:

Locate the `CardSide` interface and modify it:

```typescript
export interface CardSide {
  text: string;
  media?: {
    type: 'image' | 'audio' | 'video';
    filename?: string;  // ✅ NEW: Filename reference for R2 storage
    url: string;        // blob URL for preview (ephemeral)
    alt?: string;
  };
}
```

Locate the `FlashcardDeck` interface and add these fields:

```typescript
export interface FlashcardDeck {
  // ... existing fields ...
  source?: 'user' | 'anki';  // ✅ NEW: Source type filter
  r2?: {  // ✅ NEW: R2 metadata (populated after upload)
    cardsKey: string;
    manifestKey: string;
    mediaPrefix: string;
    uploadedAt: number;
  };
}
```

**Acceptance Criteria**:
- ✅ `CardSide.media.filename` is optional string
- ✅ `FlashcardDeck.source` is optional union type ('user' | 'anki')
- ✅ `FlashcardDeck.r2` is optional object with 4 required fields
- ✅ No TypeScript compilation errors

**Testing Requirements**:
- Run `npm run type-check` (or equivalent TypeScript compiler)
- Verify no errors in files importing these types

---

## 📋 PHASE 1 REVIEW CHECKLIST

When submitting Phase 1 for review, ensure ALL of the following:

### Code Quality
- [ ] All files created in correct locations
- [ ] No TypeScript compilation errors
- [ ] All imports resolve correctly
- [ ] Proper error handling (try-catch where needed)
- [ ] Consistent code formatting

### Security
- [ ] All endpoints check authentication
- [ ] Premium endpoints verify subscription
- [ ] User can only access their own decks
- [ ] Storage quota enforced (300MB limit)
- [ ] No SQL injection or XSS vulnerabilities

### Functionality
- [ ] Presigned URLs generated correctly
- [ ] Firestore metadata written with correct structure
- [ ] `source: 'user'` field included (CRITICAL)
- [ ] R2 usage tracking works (increment/decrement)
- [ ] Download URLs include all media files

### Testing
- [ ] Manual API testing completed (Postman/curl)
- [ ] All acceptance criteria met
- [ ] Error cases tested (401, 403, 404, 413)
- [ ] TypeScript types compile successfully

### Documentation
- [ ] Code comments added for complex logic
- [ ] Any deviations from spec documented
- [ ] Known issues or limitations noted

---

**Ready for Review**: Once all tasks complete and checklist items checked, notify Technical Lead for code review.

---

## 🚀 PHASE 2: Upload Queue & Client-Side Integration

**Objective**: Create background upload queue for R2 and integrate with deck creation workflow.

**Prerequisites**:
- ✅ Phase 1 complete and approved
- Verify `/src/lib/r2/R2UploadQueue.ts` exists (Anki implementation to adapt)
- Verify `/src/lib/anki/mediaStore.ts` exists (AnkiMediaStore for blob storage)
- Verify `/src/lib/events/ClientEventEmitter.ts` exists (for progress events)

---

### Task 2.1: Create UserDeckUploadQueue

**File to create**: `/src/lib/r2/UserDeckUploadQueue.ts`

**Purpose**: Background job queue for uploading user deck cards.json and media files to R2 with retry logic

**Strategy**: Adapt from `/src/lib/r2/R2UploadQueue.ts` (90% code reuse)

**Requirements**:
1. Use `p-queue` for 5 concurrent uploads
2. Store jobs in IndexedDB (`userDeckUploadQueue` database)
3. Exponential backoff retry: [1s, 2s, 4s, 8s, 16s, 30s]
4. Call `/api/flashcards/r2/upload-url` to get presigned URLs
5. Upload to R2 via presigned URLs
6. Call `/api/flashcards/r2/metadata` after all uploads complete
7. Emit progress events for UI

**Key Differences from Anki R2UploadQueue**:
- Database name: `userDeckUploadQueue` (not `ankiMediaDB`)
- API endpoints: `/api/flashcards/r2/*` (not `/api/anki/r2/*`)
- Upload file types: `cards.json`, `media/*`, `manifest.json` (not `.apkg`)
- R2 key format: `users/{userId}/flashcards/{deckId}/` (not `users/{userId}/decks/{deckId}/`)

**Implementation Template**:

```typescript
import PQueue from 'p-queue'
import { ClientEventEmitter } from '@/lib/events/ClientEventEmitter'
import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface UserDeckUploadJob {
  id: string
  deckId: string
  userId: string
  type: 'cards' | 'media' | 'manifest'
  filename?: string  // For media files (e.g., "image-abc123.jpg")
  blob: Blob
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  retryCount: number
  scheduledFor: number  // Timestamp when job should run
  createdAt: number
  error?: string
}

interface UserDeckMetadata {
  deckId: string
  userId: string
  name: string
  cardCount: number
  totalJobs: number
  completedJobs: number
  failedJobs: number
  totalBytes: number
  hasMedia: boolean
}

interface UploadDB extends DBSchema {
  jobs: {
    key: string
    value: UserDeckUploadJob
    indexes: { 'by-deck': string; 'by-status': string }
  }
  metadata: {
    key: string
    value: UserDeckMetadata
  }
}

const MAX_CONCURRENCY = 5
const MAX_RETRIES = 5
const BACKOFF_SECONDS = [1, 2, 4, 8, 16, 30]

export class UserDeckUploadQueue {
  readonly userId: string
  private queue: PQueue
  private emitter = new ClientEventEmitter()
  private db: IDBPDatabase<UploadDB> | null = null
  private deckMetadata = new Map<string, UserDeckMetadata>()

  constructor(userId: string) {
    this.userId = userId
    this.queue = new PQueue({ concurrency: MAX_CONCURRENCY })
  }

  private async initDB(): Promise<IDBPDatabase<UploadDB>> {
    if (this.db) return this.db

    this.db = await openDB<UploadDB>('userDeckUploadQueue', 1, {
      upgrade(db) {
        const jobStore = db.createObjectStore('jobs', { keyPath: 'id' })
        jobStore.createIndex('by-deck', 'deckId')
        jobStore.createIndex('by-status', 'status')

        db.createObjectStore('metadata', { keyPath: 'deckId' })
      }
    })

    return this.db
  }

  /**
   * Queue deck for upload to R2
   * @param deckId - Deck ID
   * @param deckName - Deck name (for metadata)
   * @param cardsJson - Blob containing deck structure (cards without media blobs)
   * @param mediaFiles - Array of { filename, blob } for media files
   */
  async queueDeckUpload(
    deckId: string,
    deckName: string,
    cardsJson: Blob,
    mediaFiles: Array<{ filename: string; blob: Blob }>
  ): Promise<void> {
    const db = await this.initDB()

    // Calculate total jobs: cards.json + manifest.json + media files
    const totalJobs = 2 + mediaFiles.length
    const totalBytes = cardsJson.size + mediaFiles.reduce((sum, f) => sum + f.blob.size, 0)

    // Store metadata for tracking
    const metadata: UserDeckMetadata = {
      deckId,
      userId: this.userId,
      name: deckName,
      cardCount: 0,  // Will be updated after cards.json upload
      totalJobs,
      completedJobs: 0,
      failedJobs: 0,
      totalBytes,
      hasMedia: mediaFiles.length > 0
    }

    await db.put('metadata', metadata)
    this.deckMetadata.set(deckId, metadata)

    const now = Date.now()

    // Create job 1: Upload cards.json
    await db.put('jobs', {
      id: `${deckId}-cards`,
      deckId,
      userId: this.userId,
      type: 'cards',
      blob: cardsJson,
      status: 'pending',
      retryCount: 0,
      scheduledFor: now,
      createdAt: now
    })

    // Create jobs 2-N: Upload media files
    for (const { filename, blob } of mediaFiles) {
      await db.put('jobs', {
        id: `${deckId}-media-${filename}`,
        deckId,
        userId: this.userId,
        type: 'media',
        filename,
        blob,
        status: 'pending',
        retryCount: 0,
        scheduledFor: now,
        createdAt: now
      })
    }

    // Create job N+1: Upload manifest.json (placeholder, will be generated later)
    await db.put('jobs', {
      id: `${deckId}-manifest`,
      deckId,
      userId: this.userId,
      type: 'manifest',
      blob: new Blob(['']),  // Placeholder, will be replaced
      status: 'pending',
      retryCount: 0,
      scheduledFor: now + 1000,  // Delay to ensure other uploads finish first
      createdAt: now
    })

    // Start processing queue
    this.processPending()
  }

  private async processPending(): Promise<void> {
    const db = await this.initDB()
    const now = Date.now()

    // Get all jobs ready for processing
    const allJobs = await db.getAllFromIndex('jobs', 'by-status', 'pending')
    const failedJobs = await db.getAllFromIndex('jobs', 'by-status', 'failed')

    const readyJobs = [...allJobs, ...failedJobs].filter(
      job => job.scheduledFor <= now && job.retryCount < MAX_RETRIES
    )

    // Queue all ready jobs
    for (const job of readyJobs) {
      this.queue.add(() => this.uploadJob(job.id))
    }
  }

  private async uploadJob(jobId: string): Promise<void> {
    const db = await this.initDB()
    const job = await db.get('jobs', jobId)

    if (!job || job.status === 'completed') return

    try {
      // Mark as uploading
      job.status = 'uploading'
      await db.put('jobs', job)

      this.emitter.emit('upload-progress', {
        deckId: job.deckId,
        type: job.type,
        filename: job.filename,
        status: 'uploading'
      })

      // Determine R2 key path
      const keyPath = job.type === 'cards'
        ? 'cards.json'
        : job.type === 'manifest'
        ? 'manifest.json'
        : `media/${job.filename}`

      // Step 1: Get presigned upload URL
      const urlResponse = await fetch('/api/flashcards/r2/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          deckId: job.deckId,
          key: keyPath,
          contentType: job.blob.type,
          deckTotalBytes: this.deckMetadata.get(job.deckId)?.totalBytes
        })
      })

      if (!urlResponse.ok) {
        throw new Error(`Failed to get upload URL: ${await urlResponse.text()}`)
      }

      const { url: presignedUrl } = await urlResponse.json()

      // Step 2: Upload blob to R2 via presigned URL
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: job.blob,
        headers: {
          'Content-Type': job.blob.type || 'application/octet-stream'
        }
      })

      if (!uploadResponse.ok) {
        throw new Error(`R2 upload failed: ${uploadResponse.status}`)
      }

      // Mark as completed
      job.status = 'completed'
      await db.put('jobs', job)

      // Update metadata counters
      const metadata = await db.get('metadata', job.deckId)
      if (metadata) {
        metadata.completedJobs++
        await db.put('metadata', metadata)
        this.deckMetadata.set(job.deckId, metadata)
      }

      this.emitter.emit('upload-progress', {
        deckId: job.deckId,
        type: job.type,
        filename: job.filename,
        status: 'completed'
      })

      // Check if all jobs for this deck are done
      await this.checkDeckCompletion(job.deckId)

    } catch (error) {
      await this.handleUploadError(job, error instanceof Error ? error.message : String(error))
    }
  }

  private async handleUploadError(job: UserDeckUploadJob, errorMessage: string): Promise<void> {
    const db = await this.initDB()

    job.retryCount++
    job.error = errorMessage

    if (job.retryCount >= MAX_RETRIES) {
      // Max retries exceeded - mark as permanently failed
      job.status = 'failed'

      const metadata = await db.get('metadata', job.deckId)
      if (metadata) {
        metadata.failedJobs++
        await db.put('metadata', metadata)
      }

      this.emitter.emit('upload-error', {
        deckId: job.deckId,
        type: job.type,
        filename: job.filename,
        error: errorMessage
      })
    } else {
      // Schedule retry with exponential backoff
      job.status = 'failed'
      const backoffSeconds = BACKOFF_SECONDS[Math.min(job.retryCount - 1, BACKOFF_SECONDS.length - 1)]
      job.scheduledFor = Date.now() + backoffSeconds * 1000
    }

    await db.put('jobs', job)

    // Retry if not exceeded max
    if (job.retryCount < MAX_RETRIES) {
      setTimeout(() => this.processPending(), job.scheduledFor - Date.now())
    }
  }

  private async checkDeckCompletion(deckId: string): Promise<void> {
    const db = await this.initDB()
    const metadata = await db.get('metadata', deckId)

    if (!metadata) return

    // Check if all non-manifest jobs are completed
    const allJobs = await db.getAllFromIndex('jobs', 'by-deck', deckId)
    const nonManifestJobs = allJobs.filter(j => j.type !== 'manifest')
    const allCompleted = nonManifestJobs.every(j => j.status === 'completed')

    if (!allCompleted) return

    // Generate manifest.json
    const manifestContent = {
      deckId,
      name: metadata.name,
      cardCount: metadata.cardCount,
      files: allJobs
        .filter(j => j.status === 'completed' && j.type !== 'manifest')
        .map(j => ({
          type: j.type,
          filename: j.type === 'cards' ? 'cards.json' : j.filename!,
          size: j.blob.size,
          hash: 'sha256-placeholder'  // TODO: Calculate actual SHA-256
        }))
    }

    const manifestBlob = new Blob([JSON.stringify(manifestContent)], { type: 'application/json' })

    // Update manifest job with generated content
    const manifestJob = allJobs.find(j => j.type === 'manifest')
    if (manifestJob) {
      manifestJob.blob = manifestBlob
      manifestJob.scheduledFor = Date.now()
      await db.put('jobs', manifestJob)

      // Upload manifest
      await this.uploadJob(manifestJob.id)
    }

    // Write metadata to Firestore
    await this.writeMetadata(deckId)
  }

  private async writeMetadata(deckId: string): Promise<void> {
    const db = await this.initDB()
    const metadata = await db.get('metadata', deckId)

    if (!metadata) return

    const r2Keys = {
      cardsKey: `users/${this.userId}/flashcards/${deckId}/cards.json`,
      manifestKey: `users/${this.userId}/flashcards/${deckId}/manifest.json`,
      mediaPrefix: `users/${this.userId}/flashcards/${deckId}/media/`
    }

    try {
      await fetch('/api/flashcards/r2/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          deckId,
          name: metadata.name,
          cardCount: metadata.cardCount,
          hasMedia: metadata.hasMedia,
          totalBytes: metadata.totalBytes,
          r2Keys
        })
      })

      this.emitter.emit('deck-upload-complete', { deckId })
    } catch (error) {
      console.error('[UserDeckUploadQueue] Failed to write metadata:', error)
      // Non-fatal - files are already uploaded
    }
  }

  // Event subscription methods
  on(event: string, handler: (...args: any[]) => void) {
    this.emitter.on(event, handler)
  }

  off(event: string, handler: (...args: any[]) => void) {
    this.emitter.off(event, handler)
  }
}
```

**Acceptance Criteria**:
- ✅ Creates IndexedDB database `userDeckUploadQueue` with `jobs` and `metadata` stores
- ✅ Queues 3 types of jobs: cards, media, manifest
- ✅ Calls `/api/flashcards/r2/upload-url` for presigned URLs
- ✅ Uploads blobs to R2 via PUT with presigned URLs
- ✅ Implements exponential backoff retry (max 5 attempts)
- ✅ Calls `/api/flashcards/r2/metadata` after all uploads complete
- ✅ Emits progress events: `upload-progress`, `upload-error`, `deck-upload-complete`
- ✅ Handles concurrent uploads (5 max via p-queue)

**Testing Requirements**:
- Create mock deck with 1 cards.json + 2 media files
- Verify 4 jobs created (cards, media1, media2, manifest)
- Verify jobs processed sequentially with correct status transitions
- Test retry logic by simulating network failure
- Verify metadata written to Firestore after completion

---

### Task 2.2: Modify FlashcardManager - Add R2 Upload Methods

**File to modify**: `/src/lib/flashcards/FlashcardManager.ts`

**Purpose**: Integrate UserDeckUploadQueue into deck creation/update/delete workflows

**Requirements**:
1. Import `UserDeckUploadQueue`
2. Add `uploadDeckToR2()` private method
3. Modify `createDeck()` to call upload (non-blocking)
4. Modify `updateDeck()` to re-upload on changes
5. Add `deleteDeckFromR2()` private method
6. Modify `deleteDeck()` to cleanup R2 files

**Implementation Steps**:

**Step 1: Add imports** (top of file)
```typescript
import { UserDeckUploadQueue } from '@/lib/r2/UserDeckUploadQueue'
import ankiMediaStore from '@/lib/anki/mediaStore'
```

**Step 2: Add `uploadDeckToR2()` method** (after `createDeck()`, around line 300)
```typescript
/**
 * Upload deck to R2 storage (non-blocking)
 * Called after deck creation/update for premium users
 */
private async uploadDeckToR2(deck: FlashcardDeck, userId: string): Promise<void> {
  try {
    console.log(`[FlashcardManager.uploadDeckToR2] Starting upload for deck ${deck.id}`)

    // Step 1: Prepare cards.json (deck structure without media blobs)
    const deckData = {
      id: deck.id,
      name: deck.name,
      emoji: deck.emoji,
      description: deck.description,
      cards: deck.cards.map(card => ({
        id: card.id,
        front: {
          text: card.front.text,
          subtext: card.front.subtext,
          media: card.front.media ? {
            type: card.front.media.type,
            filename: card.front.media.filename || this.extractFilename(card.front.media.url),
            alt: card.front.media.alt
          } : undefined
        },
        back: {
          text: card.back.text,
          subtext: card.back.subtext,
          media: card.back.media ? {
            type: card.back.media.type,
            filename: card.back.media.filename || this.extractFilename(card.back.media.url),
            alt: card.back.media.alt
          } : undefined
        },
        metadata: card.metadata
      })),
      stats: deck.stats,
      settings: deck.settings,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt
    }

    const cardsJson = new Blob([JSON.stringify(deckData)], { type: 'application/json' })

    // Step 2: Collect media files from AnkiMediaStore
    const mediaFiles: Array<{ filename: string; blob: Blob }> = []

    for (const card of deck.cards) {
      // Process front media
      if (card.front.media?.filename) {
        const blob = await ankiMediaStore.getMediaBlob(card.front.media.filename)
        if (blob) {
          mediaFiles.push({ filename: card.front.media.filename, blob })
        }
      }

      // Process back media
      if (card.back.media?.filename) {
        const blob = await ankiMediaStore.getMediaBlob(card.back.media.filename)
        if (blob) {
          mediaFiles.push({ filename: card.back.media.filename, blob })
        }
      }
    }

    // Step 3: Queue upload
    const uploadQueue = new UserDeckUploadQueue(userId)
    await uploadQueue.queueDeckUpload(deck.id, deck.name, cardsJson, mediaFiles)

    console.log(`[FlashcardManager.uploadDeckToR2] Queued ${mediaFiles.length} media files for upload`)

  } catch (error) {
    console.error('[FlashcardManager.uploadDeckToR2] Error:', error)
    // Don't throw - local deck is already created
  }
}

/**
 * Extract filename from media URL or generate unique filename
 */
private extractFilename(url: string): string {
  // Try to extract from blob URL or path
  const match = url.match(/\/([^/]+)$/)
  if (match) return match[1]

  // Fallback: generate unique filename
  return `media-${crypto.randomUUID()}.bin`
}
```

**Step 3: Modify `createDeck()` method** (around line 240)
```typescript
// After line: await db.put('decks', deck)
// Add this:

// Upload to R2 for premium users (non-blocking)
if (isPremium && userId !== 'guest' && deck.source !== 'anki') {
  this.uploadDeckToR2(deck, userId).catch(err => {
    console.error('[FlashcardManager.createDeck] R2 upload failed:', err)
  })
}
```

**Step 4: Modify `updateDeck()` method** (around line 680)
```typescript
// Find the existing Firebase sync block
// Change from:
if (isPremium && userId !== 'guest') {

// To:
if (isPremium && userId !== 'guest' && existingDeck.source === 'user') {
  // Re-upload to R2 after update
  this.uploadDeckToR2(updatedDeck, userId).catch(err => {
    console.error('[FlashcardManager.updateDeck] R2 upload failed:', err)
  })
}
```

**Step 5: Add `deleteDeckFromR2()` method** (new method)
```typescript
/**
 * Delete deck from R2 storage (non-blocking)
 */
private async deleteDeckFromR2(deckId: string, userId: string): Promise<void> {
  try {
    const response = await fetch(`/api/flashcards/r2/${deckId}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    if (!response.ok) {
      console.error('[FlashcardManager.deleteDeckFromR2] API error:', await response.text())
    } else {
      console.log(`[FlashcardManager.deleteDeckFromR2] Deleted deck ${deckId} from R2`)
    }
  } catch (error) {
    console.error('[FlashcardManager.deleteDeckFromR2] Error:', error)
    // Non-fatal - deck already deleted locally
  }
}
```

**Step 6: Modify `deleteDeck()` method** (around line 750)
```typescript
// After IndexedDB deletion, add:
if (isPremium && userId !== 'guest' && deck.source === 'user') {
  // Cleanup R2 files (non-blocking)
  this.deleteDeckFromR2(deckId, userId).catch(err => {
    console.error('[FlashcardManager.deleteDeck] R2 cleanup failed:', err)
  })
}
```

**Acceptance Criteria**:
- ✅ `createDeck()` triggers R2 upload for premium user decks (source='user')
- ✅ Upload is non-blocking (uses `.catch()` to prevent throwing)
- ✅ `updateDeck()` re-uploads deck to R2 after changes
- ✅ `deleteDeck()` calls DELETE API to remove R2 files
- ✅ Anki decks (source='anki') are NOT uploaded to user deck R2 flow
- ✅ Free users do NOT trigger R2 uploads
- ✅ Media files collected from AnkiMediaStore by filename

**Testing Requirements**:
- Create premium user deck with 2 images
- Verify `uploadDeckToR2()` called (check console logs)
- Verify UserDeckUploadQueue creates jobs in IndexedDB
- Update deck and verify re-upload triggered
- Delete deck and verify DELETE API called

---

### Task 2.3: Modify DeckCreator - Store Blobs in AnkiMediaStore

**File to modify**: `/src/components/flashcards/DeckCreator.tsx`

**Purpose**: Change image upload from base64 to blob storage

**Current behavior** (PROBLEM):
```typescript
// Line 53-71 (ImageUpload component)
const reader = new FileReader();
reader.onload = (event) => {
  const base64 = event.target?.result as string;  // ❌ Creates base64
  setPreview(base64);
  onImageAdded({
    type: 'image',
    url: base64,  // ❌ Stores base64 in card
    alt: file.name
  });
};
reader.readAsDataURL(file);  // ❌ Reads as base64
```

**New behavior** (FIX):
```typescript
// Import at top of file
import ankiMediaStore from '@/lib/anki/mediaStore'

// Replace ImageUpload onload handler (around line 53-71)
const reader = new FileReader();
reader.onload = async (event) => {
  const arrayBuffer = event.target?.result as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: file.type });

  // Generate unique filename
  const extension = file.name.split('.').pop() || 'bin'
  const filename = `image-${crypto.randomUUID()}.${extension}`;

  try {
    // Store blob in AnkiMediaStore
    await ankiMediaStore.storeMedia(filename, blob);

    // Get blob URL for preview
    const blobUrl = await ankiMediaStore.getMediaUrl(filename);

    if (blobUrl) {
      setPreview(blobUrl);
      onImageAdded({
        type: 'image',
        filename,  // ✅ Store filename reference
        url: blobUrl,  // ✅ Ephemeral blob URL for preview
        alt: file.name
      });
    } else {
      throw new Error('Failed to generate blob URL');
    }
  } catch (error) {
    console.error('[DeckCreator] Failed to store media:', error);
    // Show error to user
    alert('Failed to add image. Please try again.');
  }
};
reader.readAsArrayBuffer(file);  // ✅ Read as ArrayBuffer, not DataURL
```

**Acceptance Criteria**:
- ✅ Image upload stores blob in AnkiMediaStore (not base64)
- ✅ Generates unique filename: `image-{uuid}.{ext}`
- ✅ Calls `ankiMediaStore.storeMedia(filename, blob)`
- ✅ Gets blob URL via `ankiMediaStore.getMediaUrl(filename)`
- ✅ Passes `filename` field to card (not base64 url)
- ✅ Preview still works (blob URL is valid)
- ✅ Error handling with user feedback

**Testing Requirements**:
- Upload image to new card
- Verify blob stored in IndexedDB `ankiMediaDB.media` store
- Verify preview displays correctly
- Verify card.front.media has `filename` field
- Verify card.front.media.url is blob URL (starts with `blob:`)

---

## 📋 PHASE 2 REVIEW CHECKLIST

When submitting Phase 2 for review, ensure ALL of the following:

### Code Quality
- [ ] All files created/modified in correct locations
- [ ] No TypeScript compilation errors
- [ ] All imports resolve correctly
- [ ] Comprehensive error handling with try-catch
- [ ] Console logging for debugging

### Functionality
- [ ] UserDeckUploadQueue creates IndexedDB database
- [ ] Jobs queued correctly (cards, media, manifest)
- [ ] Presigned URLs requested from API
- [ ] Uploads execute via PUT to R2
- [ ] Retry logic works with exponential backoff
- [ ] Metadata written to Firestore after completion
- [ ] FlashcardManager calls upload on create/update
- [ ] DeckCreator stores blobs (not base64)
- [ ] Media files reference filenames

### Integration
- [ ] Upload triggered ONLY for premium users
- [ ] Upload triggered ONLY for source='user' decks
- [ ] Anki decks (source='anki') NOT affected
- [ ] Free users do NOT trigger uploads
- [ ] Non-blocking uploads (local deck creation succeeds even if upload fails)

### Testing
- [ ] Create deck with images - verify upload queued
- [ ] Check IndexedDB for jobs (userDeckUploadQueue database)
- [ ] Verify Firestore metadata written after upload
- [ ] Test retry logic by simulating failure
- [ ] Update deck - verify re-upload triggered
- [ ] Delete deck - verify R2 cleanup called

### Events & Progress
- [ ] UserDeckUploadQueue emits `upload-progress` events
- [ ] UserDeckUploadQueue emits `deck-upload-complete` event
- [ ] Event payloads include deckId, type, filename, status

---

**Ready for Review**: Once all tasks complete and checklist items checked, notify Technical Lead for code review.
# PHASE 3 IMPLEMENTATION PROMPTS

---

## 🎯 PHASE 3: User Deck Restore & Sync Integration

**Scope**: Download user decks from R2 and restore to IndexedDB

**Dependencies**:
- ✅ Phase 1 complete (APIs operational)
- ✅ Phase 2 complete (Upload queue working)

**Deliverables**:
1. **UserDeckRestoreOrchestrator.ts** - Download orchestration (~400 lines)
2. **FlashcardsContent.tsx** - Sync flow integration (~50 lines modified)

**Estimated Time**: 3-4 hours

---

## Task 3.1: Create UserDeckRestoreOrchestrator.ts

**File**: `/src/lib/r2/UserDeckRestoreOrchestrator.ts`

**Purpose**: Download user-created decks from R2 and restore to IndexedDB with proper media hydration.

**Key Differences from Anki RestoreOrchestrator**:
- ✅ Downloads `cards.json` (not `.apkg` package)
- ✅ No Anki parsing needed (already JSON)
- ✅ Media stored in `AnkiMediaStore` with user deck prefix
- ✅ Source set to `'user'` (not `'anki'`)

---

### Complete Implementation

```typescript
import EventEmitter from 'events'
import PQueue from 'p-queue'
import { AnkiMediaStore } from '@/lib/anki/mediaStore'
import { flashcardManager } from '@/lib/flashcards/FlashcardManager'
import type { FlashcardDeck } from '@/types/flashcards'

/**
 * User Deck Manifest structure (from R2)
 */
interface UserDeckManifest {
  deckId: string
  userId: string
  createdAt: string
  files: Array<{
    type: 'cards' | 'media' | 'manifest'
    filename: string
    size: number
    hash: string
  }>
}

/**
 * Restore progress tracking
 */
interface RestoreProgress {
  phase: 'fetching-metadata' | 'downloading-cards' | 'downloading-media' | 'hydrating-deck' | 'complete' | 'error'
  progress: number  // 0-100
  filesDownloaded: number
  totalFiles: number
  currentFile?: string
  error?: string
}

/**
 * User deck metadata from Firestore
 */
interface UserDeckMetadata {
  deckId: string
  userId: string
  name: string
  cardCount: number
  hasMedia: boolean
  totalBytes: number
  r2: {
    cardsKey: string
    manifestKey: string
    mediaPrefix: string
  }
  source: 'user'
  createdAt: { _seconds: number; _nanoseconds: number }
  updatedAt: { _seconds: number; _nanoseconds: number }
}

export class UserDeckRestoreOrchestrator extends EventEmitter {
  private userId: string
  private downloadQueue: PQueue
  private abortSignal?: AbortSignal

  constructor(userId: string, abortSignal?: AbortSignal) {
    super()
    this.userId = userId
    this.downloadQueue = new PQueue({ concurrency: 5 }) // 5 concurrent downloads
    this.abortSignal = abortSignal
  }

  /**
   * Restore a user deck from R2
   * @param metadata - Deck metadata from Firestore (via list API)
   * @returns Restored deck ID
   */
  async restoreDeck(metadata: UserDeckMetadata): Promise<string> {
    if (this.abortSignal?.aborted) {
      throw new Error('Restore cancelled')
    }

    this.emit('progress', {
      phase: 'fetching-metadata',
      progress: 0,
      filesDownloaded: 0,
      totalFiles: 0,
    } as RestoreProgress)

    try {
      console.log('[UserDeckRestoreOrchestrator] Starting restore', {
        deckId: metadata.deckId,
        deckName: metadata.name,
      })

      // Check if deck already exists locally
      const existingDeck = await flashcardManager.getDeck(metadata.deckId, this.userId)
      const needsDeckHydration = !existingDeck || existingDeck.cards?.length === 0

      if (!needsDeckHydration) {
        console.log('[UserDeckRestoreOrchestrator] Deck already exists locally - skipping cards.json download')
      }

      // Step 1: Download manifest (10%)
      const manifest = await this.downloadManifest(metadata.r2.manifestKey)
      if (this.abortSignal?.aborted) {
        throw new Error('Restore cancelled')
      }

      this.emit('progress', {
        phase: 'downloading-cards',
        progress: 10,
        filesDownloaded: 0,
        totalFiles: manifest.files.length,
      } as RestoreProgress)

      // Step 2: Download cards.json (if needed) (10-30%)
      let deck: FlashcardDeck | null = null
      if (needsDeckHydration) {
        const cardsBlob = await this.downloadFile(metadata.r2.cardsKey)
        if (this.abortSignal?.aborted) {
          throw new Error('Restore cancelled')
        }

        const cardsJson = await cardsBlob.text()
        deck = JSON.parse(cardsJson) as FlashcardDeck

        console.log('[UserDeckRestoreOrchestrator] Downloaded cards.json', {
          deckId: deck.id,
          cardCount: deck.cards.length,
        })

        this.emit('progress', {
          phase: 'downloading-media',
          progress: 30,
          filesDownloaded: 0,
          totalFiles: manifest.files.filter(f => f.type === 'media').length,
        } as RestoreProgress)
      } else {
        this.emit('progress', {
          phase: 'downloading-media',
          progress: 30,
          filesDownloaded: 0,
          totalFiles: manifest.files.filter(f => f.type === 'media').length,
        } as RestoreProgress)
      }

      // Step 3: Download media files (30-80%)
      const mediaFiles = await this.downloadMediaBatch(manifest, metadata)
      if (this.abortSignal?.aborted) {
        throw new Error('Restore cancelled')
      }

      this.emit('progress', {
        phase: 'hydrating-deck',
        progress: 80,
        filesDownloaded: mediaFiles.size,
        totalFiles: mediaFiles.size,
      } as RestoreProgress)

      // Step 4: Hydrate IndexedDB (80-100%)
      if (needsDeckHydration && deck) {
        await this.hydrateIndexedDB(deck, mediaFiles, metadata)
      } else if (mediaFiles.size > 0) {
        await this.storeMediaFiles(mediaFiles, metadata.deckId)
      }

      this.emit('progress', {
        phase: 'complete',
        progress: 100,
        filesDownloaded: mediaFiles.size,
        totalFiles: mediaFiles.size,
      } as RestoreProgress)

      console.log('[UserDeckRestoreOrchestrator] Restore complete!', {
        deckId: metadata.deckId,
        mediaFiles: mediaFiles.size,
      })

      return metadata.deckId
    } catch (error: any) {
      console.error('[UserDeckRestoreOrchestrator] Restore failed:', error)

      this.emit('progress', {
        phase: 'error',
        progress: 0,
        filesDownloaded: 0,
        totalFiles: 0,
        error: error.message || 'Restore failed',
      } as RestoreProgress)

      throw error
    }
  }

  /**
   * Download manifest.json
   */
  private async downloadManifest(key: string): Promise<UserDeckManifest> {
    const url = await this.getSignedDownloadUrl(key)
    const response = await fetch(url, { signal: this.abortSignal })

    if (!response.ok) {
      throw new Error('Failed to download manifest')
    }

    return await response.json()
  }

  /**
   * Download a single file from R2
   */
  private async downloadFile(key: string): Promise<Blob> {
    const url = await this.getSignedDownloadUrl(key)
    const response = await fetch(url, { signal: this.abortSignal })

    if (!response.ok) {
      throw new Error(`Failed to download ${key}`)
    }

    return await response.blob()
  }

  /**
   * Download media files in batch with progress tracking
   */
  private async downloadMediaBatch(
    manifest: UserDeckManifest,
    metadata: UserDeckMetadata
  ): Promise<Map<string, Blob>> {
    if (this.abortSignal?.aborted) {
      throw new Error('Restore cancelled')
    }

    const mediaFiles = new Map<string, Blob>()
    const mediaEntries = manifest.files.filter(f => f.type === 'media')
    const mediaStore = AnkiMediaStore.getInstance()

    // Check which media files already exist in IndexedDB
    const existingMedia = new Set<string>()
    for (const entry of mediaEntries) {
      const exists = await mediaStore.getMediaUrl(entry.filename)
      if (exists) {
        existingMedia.add(entry.filename)
      }
    }

    let downloaded = 0
    const total = mediaEntries.length

    console.log('[UserDeckRestoreOrchestrator] Downloading media', {
      total,
      alreadyCached: existingMedia.size,
      toDownload: total - existingMedia.size,
    })

    await this.downloadQueue.addAll(
      mediaEntries.map(entry => async () => {
        if (this.abortSignal?.aborted) {
          return
        }

        // Skip if already cached
        if (existingMedia.has(entry.filename)) {
          downloaded++
          const progress = total === 0 ? 80 : 30 + (50 * downloaded / total)
          this.emit('progress', {
            phase: 'downloading-media',
            progress,
            currentFile: entry.filename,
            filesDownloaded: downloaded,
            totalFiles: total,
          } as RestoreProgress)
          return
        }

        // Build R2 key
        const key = `${metadata.r2.mediaPrefix}${entry.filename}`

        try {
          const blob = await this.downloadFile(key)

          // TODO: Verify hash if needed
          // const hash = await hashBlob(blob)
          // if (hash !== entry.hash) { ... }

          mediaFiles.set(entry.filename, blob)

          console.log('[UserDeckRestoreOrchestrator] Downloaded media', {
            filename: entry.filename,
            size: Math.round(blob.size / 1024) + ' KB',
          })
        } catch (error) {
          console.error(`[UserDeckRestoreOrchestrator] Failed to download ${entry.filename}:`, error)
          // Continue - missing media is OK (user can re-upload)
        }

        downloaded++
        const progress = total === 0 ? 80 : 30 + (50 * downloaded / total)
        this.emit('progress', {
          phase: 'downloading-media',
          progress,
          currentFile: entry.filename,
          filesDownloaded: downloaded,
          totalFiles: total,
        } as RestoreProgress)
      })
    )

    return mediaFiles
  }

  /**
   * Hydrate IndexedDB with deck + media
   */
  private async hydrateIndexedDB(
    deck: FlashcardDeck,
    mediaFiles: Map<string, Blob>,
    metadata: UserDeckMetadata
  ): Promise<void> {
    console.log('[UserDeckRestoreOrchestrator] Hydrating IndexedDB', {
      deckId: deck.id,
      cards: deck.cards.length,
      mediaFiles: mediaFiles.size,
    })

    // Store media files in AnkiMediaStore
    const mediaStore = AnkiMediaStore.getInstance()
    for (const [filename, blob] of mediaFiles.entries()) {
      await mediaStore.storeMedia(filename, blob)
    }

    // Create blob URLs for card media
    const hydratedCards = deck.cards.map(card => {
      const frontFilename = typeof card.front !== 'string' ? card.front.media?.filename : undefined
      const backFilename = typeof card.back !== 'string' ? card.back.media?.filename : undefined

      let frontUrl: string | undefined
      let backUrl: string | undefined

      if (frontFilename && mediaFiles.has(frontFilename)) {
        frontUrl = URL.createObjectURL(mediaFiles.get(frontFilename)!)
      }

      if (backFilename && mediaFiles.has(backFilename)) {
        backUrl = URL.createObjectURL(mediaFiles.get(backFilename)!)
      }

      return {
        ...card,
        front: typeof card.front === 'string' ? card.front : {
          ...card.front,
          media: frontUrl ? {
            ...card.front.media,
            url: frontUrl
          } : card.front.media
        },
        back: typeof card.back === 'string' ? card.back : {
          ...card.back,
          media: backUrl ? {
            ...card.back.media,
            url: backUrl
          } : card.back.media
        },
      }
    })

    // Ensure source is set to 'user'
    const hydratedDeck: FlashcardDeck = {
      ...deck,
      cards: hydratedCards,
      source: 'user',
      userId: this.userId,
      r2: {
        cardsKey: metadata.r2.cardsKey,
        manifestKey: metadata.r2.manifestKey,
        mediaPrefix: metadata.r2.mediaPrefix,
        uploadedAt: Date.now(),
      },
    }

    // Save to IndexedDB via FlashcardManager
    // Use createDeck if doesn't exist, otherwise update
    const existingDeck = await flashcardManager.getDeck(deck.id, this.userId)

    if (!existingDeck) {
      // Create new deck (will NOT trigger R2 upload since source='user')
      await flashcardManager.createDeck({
        name: hydratedDeck.name,
        description: hydratedDeck.description,
        emoji: hydratedDeck.emoji,
        color: hydratedDeck.color,
        cardStyle: hydratedDeck.cardStyle,
        settings: hydratedDeck.settings,
        initialCards: hydratedDeck.cards,
      }, this.userId, false) // isPremium=false to prevent upload loop
    } else {
      // Update existing deck
      await flashcardManager.updateFullDeck(deck.id, {
        name: hydratedDeck.name,
        description: hydratedDeck.description,
        emoji: hydratedDeck.emoji,
        color: hydratedDeck.color,
        cardStyle: hydratedDeck.cardStyle,
        settings: hydratedDeck.settings,
        initialCards: hydratedDeck.cards,
      }, this.userId, false) // isPremium=false to prevent upload loop
    }

    console.log('[UserDeckRestoreOrchestrator] IndexedDB hydration complete')
  }

  /**
   * Store media files only (deck already exists)
   */
  private async storeMediaFiles(mediaFiles: Map<string, Blob>, deckId: string): Promise<void> {
    console.log('[UserDeckRestoreOrchestrator] Storing media files only', {
      deckId,
      count: mediaFiles.size,
    })

    const mediaStore = AnkiMediaStore.getInstance()
    for (const [filename, blob] of mediaFiles.entries()) {
      await mediaStore.storeMedia(filename, blob)
    }
  }

  /**
   * Get signed download URL from API
   */
  private async getSignedDownloadUrl(key: string): Promise<string> {
    // Extract deckId from key (format: users/{userId}/flashcards/{deckId}/...)
    const parts = key.split('/')
    const deckId = parts[3] // users/[userId]/flashcards/[deckId]

    const response = await fetch(`/api/flashcards/r2/${deckId}`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to get download URL')
    }

    const data = await response.json() as {
      metadata: UserDeckMetadata
      downloadUrls: {
        cards: string
        manifest: string
        media: Array<{ filename: string; url: string; size: number }>
      }
    }

    // Determine which URL to return based on key
    if (key.includes('/cards.json')) {
      return data.downloadUrls.cards
    } else if (key.includes('/manifest.json')) {
      return data.downloadUrls.manifest
    } else {
      // Media file - find by filename
      const filename = key.split('/').pop()!
      const mediaUrl = data.downloadUrls.media.find(m => m.filename === filename)
      if (!mediaUrl) {
        throw new Error(`Media URL not found for ${filename}`)
      }
      return mediaUrl.url
    }
  }
}

// Singleton instance getter
let orchestratorInstance: UserDeckRestoreOrchestrator | null = null

export function getUserDeckRestoreOrchestrator(userId: string, abortSignal?: AbortSignal): UserDeckRestoreOrchestrator {
  if (!orchestratorInstance || orchestratorInstance.userId !== userId) {
    orchestratorInstance = new UserDeckRestoreOrchestrator(userId, abortSignal)
  }
  return orchestratorInstance
}
```

---

### Acceptance Criteria for Task 3.1

**UserDeckRestoreOrchestrator.ts:**
- [ ] File created at `/src/lib/r2/UserDeckRestoreOrchestrator.ts`
- [ ] Class extends `EventEmitter`
- [ ] Constructor accepts `userId` and optional `abortSignal`
- [ ] `restoreDeck()` method accepts `UserDeckMetadata` from Firestore
- [ ] Downloads manifest.json from R2
- [ ] Downloads cards.json from R2
- [ ] Downloads media files with 5 concurrent downloads (p-queue)
- [ ] Skips already-cached media files (checks `AnkiMediaStore`)
- [ ] Emits progress events: `fetching-metadata`, `downloading-cards`, `downloading-media`, `hydrating-deck`, `complete`, `error`
- [ ] Progress includes: phase, progress (0-100), filesDownloaded, totalFiles, currentFile, error
- [ ] Hydrates IndexedDB via `flashcardManager.createDeck()` or `updateFullDeck()`
- [ ] Sets `deck.source = 'user'`
- [ ] Prevents upload loop by passing `isPremium=false` to FlashcardManager
- [ ] Handles `abortSignal` cancellation
- [ ] Handles missing media files gracefully (continues restore)
- [ ] TypeScript compiles without errors
- [ ] All imports resolve correctly

---

## Task 3.2: Integrate Restore Flow in FlashcardsContent.tsx

**File**: `/src/app/[locale]/flashcards/FlashcardsContent.tsx`

**Purpose**: Add user deck restore to the "Sync All" button flow.

**Current Flow** (Anki decks only):
1. User clicks "Sync All"
2. Fetches Anki deck list from API
3. Restores Anki decks via `RestoreOrchestrator`
4. Shows progress modal

**New Flow** (User decks + Anki decks):
1. User clicks "Sync All"
2. **PHASE 1 (NEW)**: Fetch user deck list → Restore user decks
3. **PHASE 2 (EXISTING)**: Fetch Anki deck list → Restore Anki decks
4. Shows combined progress modal

---

### Implementation Guide

**Step 1: Find the "Sync All" handler**

Location: `/src/app/[locale]/flashcards/FlashcardsContent.tsx` (around line 446)

Current function signature:
```typescript
const handleBulkSync = async () => {
  // ... existing Anki sync code
}
```

**Step 2: Add User Deck Restore Phase**

Insert BEFORE the existing Anki sync code:

```typescript
const handleBulkSync = async () => {
  // Show progress modal
  setIsSyncing(true)
  setSyncProgress({
    phase: 'fetching-user-decks',
    current: 0,
    total: 0,
    deckName: '',
    failed: 0,
  })

  try {
    // ===== PHASE 1: USER DECK RESTORE (NEW) =====
    console.log('[FlashcardsContent] Starting user deck restore phase...')

    // Fetch user deck list from Firestore
    const userDeckResponse = await fetch('/api/flashcards/r2/list', {
      method: 'GET',
      credentials: 'include',
    })

    if (userDeckResponse.ok) {
      const { decks: userDecks } = await userDeckResponse.json() as { decks: UserDeckMetadata[] }

      console.log('[FlashcardsContent] Found user decks to restore:', userDecks.length)

      if (userDecks.length > 0) {
        setSyncProgress(prev => ({
          ...prev,
          phase: 'restoring-user-decks',
          total: userDecks.length,
        }))

        // Import UserDeckRestoreOrchestrator
        const { getUserDeckRestoreOrchestrator } = await import('@/lib/r2/UserDeckRestoreOrchestrator')
        const orchestrator = getUserDeckRestoreOrchestrator(userId!)

        let restored = 0
        let failed = 0

        // Restore each user deck
        for (const deck of userDecks) {
          try {
            console.log('[FlashcardsContent] Restoring user deck:', deck.name)

            // Track progress
            orchestrator.on('progress', (progress) => {
              setSyncProgress(prev => ({
                ...prev,
                phase: 'restoring-user-decks',
                current: restored,
                total: userDecks.length,
                deckName: deck.name,
                progress: progress.progress,
              }))
            })

            await orchestrator.restoreDeck(deck)
            restored++

            setSyncProgress(prev => ({
              ...prev,
              current: restored,
            }))
          } catch (error) {
            console.error('[FlashcardsContent] User deck restore failed:', error)
            failed++
            setSyncProgress(prev => ({
              ...prev,
              failed: prev.failed + 1,
            }))
          }
        }

        console.log('[FlashcardsContent] User deck restore complete', {
          restored,
          failed,
          total: userDecks.length,
        })
      }
    } else {
      console.warn('[FlashcardsContent] Failed to fetch user decks:', userDeckResponse.status)
    }

    // ===== PHASE 2: ANKI DECK SYNC (EXISTING CODE - NO CHANGES) =====
    console.log('[FlashcardsContent] Starting Anki deck sync phase...')

    // ... existing Anki sync code continues unchanged ...

  } catch (error) {
    console.error('[FlashcardsContent] Sync failed:', error)
    toast.error(t('flashcards.sync.error'))
  } finally {
    setIsSyncing(false)
    await loadDecks() // Refresh deck list
  }
}
```

**Step 3: Update Progress Modal Text**

Find the progress modal rendering (around line 1450):

```typescript
{syncProgress.phase === 'restoring-user-decks' && (
  <p className="text-sm text-gray-600 dark:text-gray-400">
    {t('flashcards.sync.restoringUserDecks', {
      current: syncProgress.current,
      total: syncProgress.total,
    })}
  </p>
)}
```

**Step 4: Add i18n Strings**

Add to `/src/i18n/locales/en/strings.ts` (flashcards section):

```typescript
sync: {
  restoringUserDecks: 'Restoring your decks... ({{current}}/{{total}})',
  userDecksComplete: '{{count}} user decks restored',
  // ... existing strings
}
```

---

### Acceptance Criteria for Task 3.2

**FlashcardsContent.tsx:**
- [ ] File modified at `/src/app/[locale]/flashcards/FlashcardsContent.tsx`
- [ ] `handleBulkSync()` function modified
- [ ] PHASE 1 (User Deck Restore) added BEFORE PHASE 2 (Anki Sync)
- [ ] Fetches user deck list from `/api/flashcards/r2/list`
- [ ] Uses `getUserDeckRestoreOrchestrator()` for restore
- [ ] Progress tracking for each user deck
- [ ] Error handling for failed restores (continues to next deck)
- [ ] Success count tracked
- [ ] Failed count tracked
- [ ] Progress modal shows "Restoring your decks... (X/Y)"
- [ ] i18n strings added for user deck restore
- [ ] TypeScript compiles without errors
- [ ] No impact on existing Anki sync flow

---

## 📋 PHASE 3 REVIEW CHECKLIST

When submitting Phase 3 for review, ensure ALL of the following:

### Code Quality
- [ ] All files created/modified in correct locations
- [ ] No TypeScript compilation errors
- [ ] All imports resolve correctly
- [ ] Comprehensive error handling with try-catch
- [ ] Console logging for debugging
- [ ] JSDoc comments on public methods

### UserDeckRestoreOrchestrator.ts
- [ ] EventEmitter extended correctly
- [ ] Constructor accepts userId and abortSignal
- [ ] restoreDeck() method implemented
- [ ] Downloads manifest.json from R2
- [ ] Downloads cards.json from R2
- [ ] Downloads media files (5 concurrent via p-queue)
- [ ] Skips already-cached media files
- [ ] Emits progress events (6 phases)
- [ ] Progress tracking accurate (0-100%)
- [ ] Hydrates IndexedDB via FlashcardManager
- [ ] Sets deck.source = 'user'
- [ ] Prevents upload loop (isPremium=false)
- [ ] Handles abortSignal cancellation
- [ ] Handles missing media gracefully
- [ ] Singleton pattern implemented

### FlashcardsContent.tsx
- [ ] handleBulkSync() modified correctly
- [ ] User deck restore runs BEFORE Anki sync
- [ ] Fetches /api/flashcards/r2/list endpoint
- [ ] UserDeckRestoreOrchestrator imported dynamically
- [ ] Progress events tracked
- [ ] Error handling for failed restores
- [ ] Success/failed counts tracked
- [ ] Progress modal updated with user deck phase
- [ ] i18n strings added
- [ ] No regression in Anki sync flow

### Integration Testing
- [ ] User deck restore triggered on "Sync All" click
- [ ] Progress modal shows user deck phase
- [ ] User decks downloaded from R2
- [ ] Media files downloaded and stored in AnkiMediaStore
- [ ] Cards hydrated in IndexedDB with blob URLs
- [ ] Deck displayed in UI after restore
- [ ] Images display correctly in cards
- [ ] Anki sync still works (no regression)
- [ ] Failed restores handled gracefully
- [ ] Empty deck list handled gracefully

### Source Filtering
- [ ] Restored decks have source='user'
- [ ] No upload triggered during restore (isPremium=false)
- [ ] User decks and Anki decks remain isolated
- [ ] No cross-contamination of R2 paths

---

## 🧪 TESTING REQUIREMENTS

### Manual Testing Checklist

**Test 1: Basic User Deck Restore**
1. Create a deck with images on Device A (premium user)
2. Wait for upload to complete
3. Open Device B (same user, clear IndexedDB)
4. Click "Sync All"
5. Verify:
   - [ ] Progress modal shows "Restoring your decks... (1/1)"
   - [ ] Deck appears in deck list
   - [ ] Cards display with images
   - [ ] Images are blob URLs (not base64)
   - [ ] Media stored in AnkiMediaStore

**Test 2: Multiple User Decks**
1. Create 5 decks with images on Device A
2. Clear IndexedDB on Device B
3. Click "Sync All"
4. Verify:
   - [ ] Progress shows "Restoring your decks... (X/5)"
   - [ ] All 5 decks restored
   - [ ] All images display correctly

**Test 3: Mixed User + Anki Decks**
1. Have 2 user decks + 2 Anki decks
2. Clear IndexedDB
3. Click "Sync All"
4. Verify:
   - [ ] User decks restore first (Phase 1)
   - [ ] Anki decks sync second (Phase 2)
   - [ ] All 4 decks appear in list
   - [ ] No errors in console
   - [ ] Source types correct (user vs anki)

**Test 4: Failed Restore Handling**
1. Modify R2 bucket to delete a media file
2. Trigger restore
3. Verify:
   - [ ] Restore continues despite missing file
   - [ ] Failed count increments
   - [ ] Console shows error for missing file
   - [ ] Deck still restored (cards without media)

**Test 5: Empty Deck List**
1. User with no user decks (only Anki)
2. Click "Sync All"
3. Verify:
   - [ ] User deck phase skipped gracefully
   - [ ] Anki sync runs normally
   - [ ] No errors

**Test 6: Abort Signal**
1. Start restore of large deck with many media files
2. Close browser tab mid-restore
3. Re-open and trigger restore again
4. Verify:
   - [ ] Previous restore aborted cleanly
   - [ ] New restore starts from beginning
   - [ ] No duplicate media files

---

**Ready for Review**: Once all tasks complete and checklist items checked, notify Technical Lead for Phase 3 code review.
