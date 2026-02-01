# Phase 1 Complete - R2 Signed URL Endpoints

**Date:** 2026-01-07
**Status:** ✅ COMPLETED
**Next:** Phase 2/3 (Track A) + Phase 4 (Track B) - Parallel execution

---

## Deliverables

### 1. R2 Client (`src/lib/r2/r2-client.ts`)
- ✅ Config loader with validation (throws on missing env vars)
- ✅ S3Client singleton with caching
- ✅ Configurable TTL via `R2_SIGNED_URL_TTL_SECONDS` (default: 300s, min: 60s)
- ✅ Auto region support (`R2_REGION` defaults to 'auto')
- ✅ Force path-style URLs for R2 compatibility

### 2. Key Validation Helpers (`src/lib/r2/r2-keys.ts`)
- ✅ `buildDeckPrefix(userId, deckId)` - Constructs `users/{userId}/decks/{deckId}/`
- ✅ `isValidDeckKey(key, prefix)` - Security validation:
  - Rejects keys not starting with user's prefix (prevents cross-user access)
  - Rejects `..` (path traversal)
  - Rejects leading `/` (absolute paths)
  - Rejects backslashes `\` (Windows path confusion)

### 3. Upload URL Endpoint (`src/app/api/anki/r2/upload-url/route.ts`)
- ✅ Authentication via `requireAuth()` (session-based)
- ✅ Zod schema validation:
  - `deckId` (required, min 1 char)
  - `key` (required, min 1 char)
  - `contentType` (optional, for MIME type)
- ✅ Key prefix validation (must be within user's deck path)
- ✅ Pre-signed PUT URL generation with configurable expiry
- ✅ Error handling: 400 (validation), 401 (auth), 500 (server)

### 4. Download URL Endpoint (`src/app/api/anki/r2/download-url/route.ts`)
- ✅ Authentication via `requireAuth()`
- ✅ Zod schema validation (deckId, key)
- ✅ Key prefix validation (same security as upload)
- ✅ Pre-signed GET URL generation
- ✅ Error handling (consistent with upload endpoint)

### 5. Dependencies
- ✅ Added `@aws-sdk/client-s3`
- ✅ Added `@aws-sdk/s3-request-presigner`
- ✅ Updated package-lock.json (106 new packages)

---

## Security Validation

### Path Traversal Protection
```typescript
// BLOCKED: Cross-user access
key: "users/other-user-id/decks/abc/media/file.mp3"
// User's prefix: "users/my-user-id/decks/abc/"
// Result: 400 INVALID_KEY

// BLOCKED: Path traversal
key: "users/my-user-id/decks/abc/../../../etc/passwd"
// Result: 400 INVALID_KEY (contains ..)

// BLOCKED: Absolute path
key: "/etc/passwd"
// Result: 400 INVALID_KEY (starts with /)

// ALLOWED: Valid user path
key: "users/my-user-id/decks/abc/media/audio.mp3"
// Result: 200 + signed URL
```

### Authentication Flow
1. Request includes session cookie
2. `requireAuth()` validates session in Redis
3. Extracts `session.uid` (Firebase User ID)
4. Builds prefix: `users/{session.uid}/decks/{deckId}/`
5. Validates requested key starts with prefix
6. Generates signed URL scoped to that key only

---

## API Response Format

### Success Response (Upload)
```json
{
  "url": "https://e96be1325db4e122ca31691f8c2adbda.r2.cloudflarestorage.com/moshmoshi-anki/users/abc/decks/123/media/audio.mp3?X-Amz-Algorithm=...",
  "expiresIn": 300
}
```

### Success Response (Download)
```json
{
  "url": "https://...",
  "expiresIn": 300
}
```

### Error Responses
```json
// 400 - Invalid key
{
  "error": {
    "code": "INVALID_KEY",
    "message": "Key must be within the user deck prefix"
  }
}

// 400 - Validation error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid upload request",
    "details": [...]
  }
}

// 401 - Not authenticated
{
  "error": {
    "code": "UPLOAD_URL_ERROR",
    "message": "Authentication required"
  }
}
```

---

## Environment Variables Used

```bash
# Required
R2_ACCESS_KEY_ID=85322b7d0d4e7fb1eedc0e6ebe6c0207
R2_SECRET_ACCESS_KEY=dbdc7a7d19aead5c4860f868d725a71f735b100cd320f0f810483d51d558cba5
R2_BUCKET=moshmoshi-anki
R2_ENDPOINT=https://e96be1325db4e122ca31691f8c2adbda.r2.cloudflarestorage.com

# Optional
R2_REGION=auto  # Default: 'auto'
R2_SIGNED_URL_TTL_SECONDS=300  # Default: 300, Min: 60
```

---

## Smoke Test (Manual)

### 1. Start dev server
```bash
npm run dev
```

### 2. Get session cookie
Login via UI and extract session cookie from browser DevTools.

### 3. Test upload URL
```bash
curl -X POST http://localhost:3000/api/anki/r2/upload-url \
  -H "Content-Type: application/json" \
  -b "session=YOUR_SESSION_COOKIE" \
  -d '{
    "deckId": "test-deck-123",
    "key": "users/YOUR_USER_ID/decks/test-deck-123/media/test-audio.mp3",
    "contentType": "audio/mpeg"
  }'
```

Expected: 200 response with `url` and `expiresIn` fields.

### 4. Test upload to R2
```bash
curl -X PUT "SIGNED_URL_FROM_STEP_3" \
  -H "Content-Type: audio/mpeg" \
  --data-binary "@test-file.mp3"
```

Expected: 200 response from R2.

### 5. Test download URL
```bash
curl -X POST http://localhost:3000/api/anki/r2/download-url \
  -H "Content-Type: application/json" \
  -b "session=YOUR_SESSION_COOKIE" \
  -d '{
    "deckId": "test-deck-123",
    "key": "users/YOUR_USER_ID/decks/test-deck-123/media/test-audio.mp3"
  }'
```

Expected: 200 response with download URL.

### 6. Test download from R2
```bash
curl "SIGNED_URL_FROM_STEP_5" --output downloaded-file.mp3
```

Expected: File downloaded successfully.

---

## Alignment with Phase 0 Decisions

| Decision | Implementation | Status |
|----------|----------------|--------|
| Decision 8: R2 Key Structure | `users/{userId}/decks/{deckId}/...` | ✅ Enforced |
| Decision 9: Signed URL Expiry | Configurable via env var (default 300s) | ✅ Implemented |
| Security Validation | Path traversal protection | ✅ Implemented |
| Auth Middleware | Session-based auth via requireAuth | ✅ Implemented |

---

## Not Yet Implemented (Deferred to Later Phases)

- ❌ GET `/api/anki/r2/backups` - List user's backups (Phase 4)
- ❌ SHA-256 performance benchmark (Phase 2)
- ❌ R2 connection integration test (Phase 5)

---

## Next Steps

### Track A: Phase 2+3 (Upload Queue + Metadata)
**Agent:** spec-impl
**Duration:** ~4 days
**Deliverables:**
1. R2UploadQueue class (reuses syncQueue IndexedDB store)
2. Upload orchestrator (5 concurrent uploads)
3. SHA-256 hashing with Web Crypto API
4. Manifest generation
5. Firestore metadata writing
6. POST `/api/anki/r2/metadata` endpoint

### Track B: Phase 4 (Restore Flow)
**Agent:** spec-impl
**Duration:** ~3 days
**Deliverables:**
1. GET `/api/anki/r2/backups` endpoint
2. Restore orchestrator
3. Progress tracking UI component
4. Deck hydration after restore
5. Error handling (missing media, corrupt files)

### Track C: Phase 5 (QA + Hardening)
**Duration:** ~2 days
**Deliverables:**
1. End-to-end tests
2. Large deck performance tests (1000+ cards, 500+ media files)
3. Security penetration tests
4. Safari eviction scenario tests
5. Documentation updates

---

## Review Notes

**Reviewed by:** Supervisor
**Date:** 2026-01-07

**Assessment:** Phase 1 implementation is solid and production-ready. Key validation is thorough, auth integration is correct, and error handling is comprehensive.

**Recommendations for Phase 2/3:**
1. Reuse the same error response format for consistency
2. Add request logging for debugging (with PII redaction)
3. Consider rate limiting for upload URL generation (prevent abuse)

**Recommendations for Phase 4:**
1. Add ETag validation during download (R2 provides this automatically)
2. Implement resumable downloads for large packages
3. Add restore status tracking in Firestore

**Green light:** ✅ Proceed with parallel Track A + Track B execution.
