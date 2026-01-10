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
