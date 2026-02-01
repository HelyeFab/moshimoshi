# Anki R2 Backup MVP (IndexedDB-First)

## Purpose
Provide a low-cost, low-complexity backup and restore path for Anki imports without Firebase Storage and without Firestore's 1MB document limit. The local IndexedDB-first experience remains the source of truth for immediate use.

## Non-Goals
- Real-time multi-device sync with conflict resolution.
- Server-side Anki parsing.
- Fine-grained media dedup across users.

## High-Level Idea
- Import remains local and instant via IndexedDB.
- Background uploads store the original `.apkg` and media files in Cloudflare R2.
- Firestore (or any DB) stores only small metadata documents.
- Restore rehydrates IndexedDB from R2 using a manifest file.

## Architecture Overview
```
Client:
  - Anki import -> IndexedDB (instant)
  - Upload queue -> signed R2 URLs
  - Restore -> download manifest + media -> IndexedDB

Server:
  - Auth + access checks
  - Signed URL endpoints for R2 upload/download
  - Metadata writes in Firestore

Storage:
  - R2 bucket: moshimoshi-anki
  - Objects: /users/{userId}/decks/{deckId}/...
```

## Object Storage Layout (R2)
- users/{userId}/decks/{deckId}/package.apkg
- users/{userId}/decks/{deckId}/manifest.json
- users/{userId}/decks/{deckId}/media/{filename}

Manifest format (example):
```json
{
  "deckId": "abc123",
  "userId": "uid123",
  "createdAt": "2026-01-10T12:00:00Z",
  "files": [
    { "type": "media", "name": "audio01.mp3", "size": 12345, "sha256": "..." },
    { "type": "media", "name": "image01.jpg", "size": 45678, "sha256": "..." },
    { "type": "package", "name": "package.apkg", "size": 987654, "sha256": "..." }
  ]
}
```

## Metadata (Firestore or equivalent)
One small doc per deck.
```json
{
  "deckId": "abc123",
  "userId": "uid123",
  "name": "Tae Kim Grammar",
  "cardCount": 1200,
  "hasMedia": true,
  "r2": {
    "packageKey": "users/uid123/decks/abc123/package.apkg",
    "manifestKey": "users/uid123/decks/abc123/manifest.json",
    "mediaPrefix": "users/uid123/decks/abc123/media/"
  },
  "updatedAt": 1712345678
}
```

## MVP Flow
### Import (Client)
1) User imports `.apkg`.
2) Parse and store deck + media in IndexedDB.
3) Create upload jobs for:
   - package.apkg (optional but recommended)
   - each media file
   - manifest.json
4) UI remains usable instantly.

### Upload (Client + Server)
1) Client requests signed upload URL from server:
   - POST /api/anki/r2/upload-url
2) Server validates auth and returns signed URL for a specific key.
3) Client uploads file directly to R2.
4) Client marks job as complete and updates sync status.
5) Client updates metadata doc to mark backup ready.

### Restore (Client + Server)
1) Client fetches deck metadata doc.
2) Client requests signed download URL for manifest:
   - POST /api/anki/r2/download-url
3) Client downloads manifest + media (in batches).
4) Client stores media + deck in IndexedDB.
5) Deck becomes available offline immediately after hydration.

## API Endpoints (Minimal)
Server-only logic, no Firebase Storage.

### POST /api/anki/r2/upload-url
Input:
```json
{ "deckId": "abc123", "key": "users/uid/decks/abc123/media/audio01.mp3", "contentType": "audio/mpeg" }
```
Output:
```json
{ "url": "https://signed-url", "expiresIn": 300 }
```

### POST /api/anki/r2/download-url
Input:
```json
{ "deckId": "abc123", "key": "users/uid/decks/abc123/manifest.json" }
```
Output:
```json
{ "url": "https://signed-url", "expiresIn": 300 }
```

### POST /api/anki/r2/metadata
Write or update the metadata document after a successful upload.

## Security Notes
- Signed URLs only, never expose R2 keys to the client.
- Enforce that the `key` path matches `users/{userId}/...`.
- Use short expiration (5-10 minutes).
- Optional: encrypt APKG and media before upload (client-side).

## Cost Notes (Rule of Thumb)
- R2 storage: very low per GB.
- No egress fees from R2.
- Firestore metadata: tiny docs, minimal cost.

## Implementation Plan (Phased)

### Phase 0 - Prep (Design + Env)
**Goal**: Align on storage layout, security, and local env config.
**Prompt to dispatch**:
```
Review ANKI_R2_BACKUP_MVP.md Phase 0. Confirm storage keys, manifest format, and env vars. Propose any risks or missing details.
```

### Phase 1 - Server Signed URL Endpoints
**Goal**: Provide signed upload/download URLs for R2.
**Prompt to dispatch**:
```
Implement Phase 1 from ANKI_R2_BACKUP_MVP.md: add signed URL endpoints (upload/download) with auth checks and key-prefix validation for users/{userId}/... paths. Include minimal tests or smoke notes.
```

### Phase 2 - Client Upload Queue (IndexedDB)
**Goal**: Background upload of APKG + media + manifest, with retries.
**Prompt to dispatch**:
```
Implement Phase 2 from ANKI_R2_BACKUP_MVP.md: client-side upload queue, batch uploads via signed URLs, retry/backoff, and status updates. Keep IndexedDB-first behavior.
```

### Phase 3 - Metadata Write + Backup Status UI
**Goal**: Persist minimal metadata and expose backup status in the UI.
**Prompt to dispatch**:
```
Implement Phase 3 from ANKI_R2_BACKUP_MVP.md: write metadata doc after upload, and add a simple backup status indicator per deck.
```

### Phase 4 - Restore Flow
**Goal**: Rehydrate IndexedDB on a new device from R2.
**Prompt to dispatch**:
```
Implement Phase 4 from ANKI_R2_BACKUP_MVP.md: download manifest + media in batches, hydrate IndexedDB, and verify deck usability offline.
```

### Phase 5 - QA + Hardening
**Goal**: Validate large decks and edge cases.
**Prompt to dispatch**:
```
Implement Phase 5 from ANKI_R2_BACKUP_MVP.md: add test plan notes, run large deck import, verify retry logic, and document any remaining risks.
```

## Known Risks
- Upload interruptions: queue retries required.
- Large media count: batch uploads with backoff.
- Privacy expectations: update terms and support docs.

## Developer Onboarding (New Contributors)
### Prereqs
- Node.js LTS
- pnpm or npm (use project default)
- Cloudflare R2 credentials for dev (service account)

### Local Setup Steps
1) Install deps:
   - pnpm install
2) Set env vars:
   - R2_ACCESS_KEY_ID
   - R2_SECRET_ACCESS_KEY
   - R2_BUCKET
   - R2_ENDPOINT
   - R2_PUBLIC_BASE (optional for signed URL validation)
3) Run app:
   - pnpm dev

### Dev Workflow
- Import a small `.apkg` to validate upload queue.
- Confirm manifest is uploaded and metadata doc is written.
- Restore on a fresh browser profile and validate hydration.

### Quick Debug Tips
- Check IndexedDB stores: `FlashcardDB`, `ankiMediaDB`, and the upload queue.
- Verify R2 objects exist under expected key prefixes.
- Use server logs to confirm signed URL requests.

## Testing Checklist (MVP)
- Import small deck with audio + image.
- Import large deck (~1000+ cards).
- Background upload completes without blocking UI.
- Restore on a clean profile works end-to-end.
- Deck remains usable offline.

## Future Enhancements (Post-MVP)
- Background sync across devices.
- Partial restore (lazy media downloads).
- Media dedup within user.
- Encrypted backups with user-derived key.
