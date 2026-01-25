# Phase 5: QA & Hardening Checklist

**Date:** 2026-01-07
**Status:** 🔄 IN PROGRESS
**Tracks Completed:** Phase 0-4 ✅

---

## Overview

This document provides a comprehensive QA checklist for the R2 Backup MVP. All items must pass before production deployment.

---

## 🧪 Functional Testing

### Upload Flow (Track A)

#### Small Deck Upload (10 cards, 5 media files)
- [ ] Import .apkg file with audio + images
- [ ] Verify BackupStatusBadge shows "uploading..." during upload
- [ ] Check Network tab shows POST requests to `/api/anki/r2/upload-url`
- [ ] Verify 5 concurrent uploads max (check Network waterfall)
- [ ] Confirm all files appear in R2 bucket under correct keys:
  - `users/{uid}/decks/{deckId}/package.apkg`
  - `users/{uid}/decks/{deckId}/manifest.json`
  - `users/{uid}/decks/{deckId}/media/{filename}`
- [ ] Verify manifest.json contains correct SHA-256 hashes
- [ ] Check Firestore `anki_r2_backups/{deckId}` document exists
- [ ] Verify metadata has all required fields (name, cardCount, hasMedia, r2 keys)
- [ ] Confirm BackupStatusBadge shows "backed up ✓" after completion
- [ ] Deck remains usable during upload (study session works)

**Expected Time:** ~5-10 seconds for small deck

#### Large Deck Upload (1000 cards, 500 media files)
- [ ] Import large .apkg file
- [ ] Verify progress updates smoothly (not frozen)
- [ ] UI remains responsive (can navigate away)
- [ ] Upload completes without timeout
- [ ] All 500 media files uploaded successfully
- [ ] Manifest.json contains all 501 entries (package + 500 media)
- [ ] Metadata document <100KB (validate size)
- [ ] No JavaScript console errors

**Expected Time:** ~60-120 seconds depending on connection

#### Upload Error Handling
- [ ] **Network Offline:**
  - Disconnect network mid-upload
  - Verify queue pauses (no failed requests)
  - BackupStatusBadge shows "offline" status
  - Reconnect network
  - Queue resumes automatically
  - Upload completes successfully

- [ ] **Upload Failure (single file):**
  - Simulate 500 error from R2 (mock or temporarily break endpoint)
  - Verify exponential backoff (check Network timing: 1s, 2s, 4s...)
  - After 5 retries, job marked as failed
  - Other files continue uploading
  - BackupStatusBadge shows "failed" with retry button
  - Click retry, upload resumes

- [ ] **Metadata Write Failure:**
  - All files upload successfully
  - Firestore write fails (simulate auth error)
  - Verify retry attempts metadata write
  - Files not re-uploaded (idempotent)

#### Premium-Only Upload
- [ ] **Free user:** Import deck → no backup initiated (verify)
- [ ] **Premium user:** Import deck → backup starts automatically
- [ ] Verify entitlement check happens before queueing

### Restore Flow (Track B)

#### Restore Page Access
- [ ] Navigate to `/flashcards/restore`
- [ ] Page loads without errors
- [ ] Shows loading spinner initially
- [ ] Fetches backups via `GET /api/anki/r2/backups`
- [ ] Empty state shows if no backups

#### Backup List Display
- [ ] BackupCard shows deck name correctly
- [ ] Card count displays
- [ ] "with media" badge shows for decks with media
- [ ] Last backup timestamp formatted correctly (relative time)
- [ ] All user's backups visible

#### Small Deck Restore (10 cards, 5 media)
- [ ] Click "Restore" button on small deck
- [ ] RestoreProgressModal opens
- [ ] Progress bar shows 0% → 100%
- [ ] Phase labels update:
  - "Fetching backup info..."
  - "Downloading manifest..."
  - "Downloading media files..."
  - "Setting up deck..."
  - "Restore complete!"
- [ ] File count shows "Downloading 5/5 media files"
- [ ] Modal closes after completion
- [ ] Success notification appears
- [ ] Page refreshes automatically
- [ ] Restored deck appears in flashcards list
- [ ] Open deck → cards display correctly
- [ ] Media plays (audio + images work)
- [ ] Deck usable offline immediately

**Expected Time:** ~5-10 seconds

#### Large Deck Restore (1000 cards, 500 media)
- [ ] Click "Restore" on large deck
- [ ] Progress updates smoothly (not frozen)
- [ ] File counter shows progress (1/500, 2/500...)
- [ ] Download speed reasonable (~5-10 concurrent)
- [ ] Completes without timeout
- [ ] All 1000 cards restored
- [ ] All 500 media files in IndexedDB
- [ ] Deck fully functional

**Expected Time:** ~60-120 seconds

#### Restore Error Handling
- [ ] **Network Offline:**
  - Start restore
  - Disconnect network mid-download
  - Error message appears
  - Retry button available
  - Reconnect network
  - Click retry
  - Restore completes

- [ ] **Missing Media File:**
  - Delete 1 media file from R2 manually
  - Restore deck
  - Warning logged to console
  - Other media files download successfully
  - Deck still usable
  - Cards with missing media show placeholder (no crash)

- [ ] **SHA-256 Mismatch:**
  - Manually corrupt a file in R2 (change 1 byte)
  - Restore deck
  - Warning logged about hash mismatch
  - Restore continues (partial success OK)
  - Deck still usable

- [ ] **Duplicate Deck:**
  - Import deck locally
  - Restore same deck from R2
  - Confirmation prompt: "Deck already exists. Overwrite?"
  - Click "Overwrite" → old deck replaced
  - Click "Cancel" → restore aborted

#### Fresh Device Scenario (Core Use Case)
- [ ] Open app in new browser profile (clean IndexedDB)
- [ ] Login with account that has backups
- [ ] Navigate to `/flashcards/restore`
- [ ] See all previously backed up decks
- [ ] Restore 2-3 decks
- [ ] All decks usable offline
- [ ] Go offline → all decks still work
- [ ] Study sessions sync when back online

---

## 🔒 Security Testing

### Authentication & Authorization
- [ ] **Upload URL endpoint:**
  - Call without session cookie → 401 Unauthorized
  - Call with invalid session → 401
  - Call with valid session → 200 + signed URL

- [ ] **Download URL endpoint:**
  - Same auth checks as upload

- [ ] **Metadata endpoint:**
  - No auth → 401
  - Valid auth → 200

- [ ] **Backups endpoint:**
  - No auth → 401
  - User A can't see User B's backups

### Key Prefix Validation
- [ ] **Upload URL - Path Traversal:**
  ```bash
  POST /api/anki/r2/upload-url
  Body: {
    "deckId": "abc",
    "key": "users/other-user/decks/abc/media/file.mp3",
    "contentType": "audio/mpeg"
  }
  ```
  Expected: 400 INVALID_KEY (cross-user access blocked)

- [ ] **Upload URL - Directory Traversal:**
  ```bash
  Body: {
    "key": "users/my-user/decks/abc/../../../etc/passwd"
  }
  ```
  Expected: 400 INVALID_KEY (contains `..`)

- [ ] **Download URL - Same Validations:**
  - Cross-user access blocked
  - Path traversal blocked

### Signed URL Security
- [ ] **Upload URL expiration:**
  - Generate upload URL
  - Wait 6 minutes (TTL is 5min default)
  - Attempt PUT to expired URL
  - Expected: 403 Forbidden from R2

- [ ] **Download URL expiration:**
  - Generate download URL
  - Wait 11 minutes (TTL is 10min)
  - Attempt GET to expired URL
  - Expected: 403 Forbidden from R2

### Firestore Security Rules
- [ ] User can only read their own `anki_r2_backups` docs
- [ ] User can only write docs where `userId == auth.uid`
- [ ] Unauthenticated users can't read any docs
- [ ] Metadata doc size limited to <1MB (Firestore limit)

---

## ⚡ Performance Testing

### Upload Performance
- [ ] **SHA-256 hashing benchmark:**
  - Run `benchmarkHashing()` from hashUtils.ts
  - 1KB file: <1ms ✅
  - 10KB file: <2ms ✅
  - 100KB file: <5ms ✅
  - 1MB file: <10ms ✅

- [ ] **Concurrent upload limit:**
  - Import large deck with 100+ media files
  - Open Network tab
  - Verify max 5 parallel uploads at any time
  - No request queue overflow

- [ ] **UI responsiveness during upload:**
  - Start upload of large deck
  - Navigate to different pages
  - Open study session
  - Review cards
  - All interactions smooth (<100ms response)

### Download Performance
- [ ] **Concurrent download limit:**
  - Restore large deck
  - Open Network tab
  - Verify max 5 parallel downloads

- [ ] **Progress update frequency:**
  - Progress bar updates at least every 500ms
  - No UI jank or freezing

### Database Performance
- [ ] **IndexedDB write speed:**
  - Time to write 500 media files to ankiMediaDB
  - Expected: <10 seconds total

- [ ] **Firestore query speed:**
  - GET /api/anki/r2/backups with 20 decks
  - Expected: <500ms response time

---

## 🌐 Cross-Browser Testing

### Desktop Browsers
- [ ] **Chrome/Edge (Chromium):**
  - Upload works
  - Restore works
  - BackupStatusBadge renders correctly
  - RestoreProgressModal renders correctly

- [ ] **Firefox:**
  - Same checks as Chrome
  - crypto.subtle.digest() works (SHA-256)

- [ ] **Safari:**
  - Same checks as Chrome
  - Persistent storage permission requested
  - Warning badge shows if permission denied
  - R2 backup provides recovery after 7-day eviction

### Mobile Browsers
- [ ] **Mobile Safari (iOS):**
  - Upload works on cellular connection
  - Restore works
  - UI responsive on small screen

- [ ] **Mobile Chrome (Android):**
  - Same checks as iOS

- [ ] **PWA Mode:**
  - Upload/restore work in installed PWA
  - Background sync works when app closed

---

## 🌍 Internationalization (i18n)

### All 6 Locales
Test restore page in each locale:

- [ ] **English (en)**
- [ ] **Japanese (ja)**
- [ ] **Italian (it)**
- [ ] **German (de)**
- [ ] **French (fr)**
- [ ] **Spanish (es)**

For each locale:
- [ ] Restore page title/description translated
- [ ] BackupCard labels translated
- [ ] RestoreProgressModal phases translated
- [ ] Success/error messages translated
- [ ] Date formatting correct for locale

---

## 📱 Offline Behavior

### Upload Queue Offline Handling
- [ ] Start app online
- [ ] Import deck (backup starts)
- [ ] Go offline mid-upload
- [ ] Queue pauses (no errors)
- [ ] Badge shows "offline - will resume"
- [ ] Go back online
- [ ] Queue resumes automatically
- [ ] Upload completes

### Restore Offline Handling
- [ ] Start restore online
- [ ] Go offline mid-restore
- [ ] Error message appears
- [ ] Can retry after going back online

### Offline Study (Core Use Case)
- [ ] Import deck with backup
- [ ] Wait for backup to complete
- [ ] Go offline
- [ ] Deck fully usable (cards, media, SRS)
- [ ] Study sessions saved locally
- [ ] Go online → sessions sync to Firestore

---

## 🐛 Edge Cases

### Upload Edge Cases
- [ ] **Empty deck (0 cards):**
  - Import should fail gracefully
  - No backup attempted

- [ ] **Deck with no media:**
  - Upload works (package + manifest only)
  - hasMedia: false in metadata

- [ ] **Very large media file (>50MB):**
  - Upload succeeds or times out gracefully
  - Error message if R2 rejects

- [ ] **Special characters in filename:**
  - Filename: "日本語 audio (1) [test].mp3"
  - Upload succeeds
  - Download succeeds
  - Media plays correctly

- [ ] **Duplicate upload:**
  - Upload deck
  - Upload same deck again
  - Metadata updated (not duplicated)
  - Old files overwritten in R2

### Restore Edge Cases
- [ ] **Corrupted manifest.json:**
  - Invalid JSON in manifest
  - Error message appears
  - Deck not partially restored

- [ ] **Missing package file:**
  - Manifest exists but package.apkg missing in R2
  - Error: "Package file not found"
  - Restore aborted cleanly

- [ ] **Very old backup (1 year old):**
  - Restore still works
  - SRS intervals preserved
  - Study history intact

### Concurrency Edge Cases
- [ ] **Multiple decks uploading simultaneously:**
  - Import 3 decks at once
  - All upload concurrently
  - Global 5-upload limit respected
  - All complete successfully

- [ ] **Upload and restore at same time:**
  - Start upload of Deck A
  - Start restore of Deck B
  - Both complete successfully
  - No resource conflicts

---

## 📊 Monitoring & Logging

### Upload Monitoring
- [ ] Console logs show upload progress
- [ ] Console logs show retry attempts
- [ ] Console logs show completion/failure
- [ ] No sensitive data in logs (no R2 keys)

### Restore Monitoring
- [ ] Console logs show download progress
- [ ] Console logs show hash verification results
- [ ] Console logs show IndexedDB writes
- [ ] Errors logged with context

### Production Telemetry (Future)
- [ ] Track upload success rate
- [ ] Track restore success rate
- [ ] Track average upload time
- [ ] Track average download time
- [ ] Track retry rate
- [ ] Track offline incident rate

---

## 🚀 Production Readiness

### Environment Configuration
- [ ] All R2 env vars set in production:
  - R2_ACCESS_KEY_ID
  - R2_SECRET_ACCESS_KEY
  - R2_BUCKET
  - R2_ENDPOINT
  - R2_REGION (optional)
  - R2_SIGNED_URL_TTL_SECONDS (optional)

- [ ] Firestore security rules deployed
- [ ] R2 CORS configured correctly

### Documentation
- [ ] README updated with R2 setup instructions
- [ ] .env.example has R2 section
- [ ] Phase 0-4 docs complete
- [ ] This QA checklist complete

### Deployment Safety
- [ ] Feature flag for R2 backup (can disable if issues)
- [ ] Graceful degradation if R2 unavailable
- [ ] Rollback plan documented

---

## ✅ Sign-Off Criteria

All items above must pass before production deployment. Any failing items must be:
- Fixed and retested, OR
- Documented as known issue with mitigation plan, OR
- Moved to post-MVP roadmap with supervisor approval

---

## 🎯 Test Results

### Test Session 1: [Date]
**Tester:** [Name]
**Environment:** [Dev/Staging/Prod]
**Browser:** [Chrome/Firefox/Safari]

Results:
- [ ] All functional tests passed
- [ ] All security tests passed
- [ ] All performance tests passed
- [ ] All edge cases handled

**Blockers Found:**
1. [Issue description]
2. [Issue description]

**Status:** ⏸️ BLOCKED / ✅ PASSED

---

### Test Session 2: [Date]
**Tester:** [Name]
**Environment:** [Environment]
**Browser:** [Browser]

Results: [...]

---

## 📝 Notes

- Use Chrome DevTools to monitor Network tab and Console
- Use Firefox Storage Inspector to inspect IndexedDB
- Use Firestore emulator for security rules testing
- Use Cloudflare R2 dashboard to verify file uploads

---

**Last Updated:** 2026-01-07
**Next Review:** After all tests complete
