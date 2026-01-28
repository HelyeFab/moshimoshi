# Quota System Testing Guide

## Overview

This document describes how to test the quota tracking system that counts videos on load (not practice duration).

## System Architecture

### Quota Counting Strategy
- **When**: Video loads (transcript extraction) - BEFORE expensive operations
- **Where**: `/api/youtube/extract` endpoint
- **Field**: `firstAccessed` in `userPracticeHistory` collection
- **Repeat Videos**: Don't count toward quota (unlimited practice)

### Collections
1. **userPracticeHistory** - Quota tracking and practice stats (all authenticated users)
   - `firstAccessed`: When video first loaded (quota counting)
   - `firstPracticed`: When user first watched 30+ seconds
   - `lastPracticed`: Last practice timestamp
   - `practiceCount`: Number of 30s+ practice sessions
   - `totalPracticeTime`: Total seconds practiced

2. **userYouTubeHistory** - Full video metadata (premium users only)
   - Separate from quota tracking
   - Used by My Videos page

## Test Results

### Unit Tests ✅
Location: `__tests__/quota-system.test.js`

```bash
npm test -- __tests__/quota-system.test.js
```

**Results**: 11/11 tests passed
- ✅ Quota counting for new videos
- ✅ No quota count for repeat videos
- ✅ Quota check before expensive operations
- ✅ Quota limits match feature config
- ✅ firstAccessed field for quota counting
- ✅ Lazy migration fallback
- ✅ 429 status for quota exceeded
- ✅ Document ID format
- ✅ firstAccessed vs firstPracticed logic

### Integration Tests

#### 1. Automated Test Script
Location: `scripts/test-quota-system.js`

```bash
node scripts/test-quota-system.js
```

Tests:
- New video extraction
- Repeat video extraction
- Quota status check
- Practice tracking

**Note**: Requires video with Japanese captions

#### 2. Authenticated User Test
Location: `scripts/test-quota-authenticated.js`

```bash
node scripts/test-quota-authenticated.js
```

Prerequisites:
- Dev server running on port 3002
- User signed in via browser
- Video with Japanese captions

Tests:
- Quota before extraction
- New video extraction (counts toward quota)
- Repeat video extraction (doesn't count)
- Quota after extraction

## Manual Testing Steps

### Test 1: New Video Flow (First Access)

**Expected Behavior**: Video counts toward quota

1. Start dev server: `npm run dev`
2. Sign in as Free tier user (3 videos/day limit)
3. Go to YouTube Shadowing page
4. Paste a YouTube URL with Japanese captions
5. Check server logs:
   ```
   [Quota] New video {videoId} - will count toward quota
   ✅ Created userPracticeHistory for {userId}_{videoId}
   ```
6. Verify quota increased: Check Popular Videos page or `/api/youtube/popular`

### Test 2: Repeat Video Flow (Unlimited Practice)

**Expected Behavior**: Same video doesn't count toward quota

1. Paste the SAME video URL again
2. Check server logs:
   ```
   [Quota] Repeat video {videoId} - free unlimited practice
   ```
3. Video should load successfully
4. Quota should NOT increase

### Test 3: Quota Exhausted Flow

**Expected Behavior**: Shows error and redirects to pricing

1. As Free user, paste 3 different videos (exhaust quota)
2. Try to paste a 4th video
3. Expected response:
   ```json
   {
     "success": false,
     "error": "QUOTA_EXCEEDED",
     "message": "Daily video limit reached",
     "quotaInfo": { "used": 3, "limit": 3, "remaining": 0 }
   }
   ```
4. UI should show error message
5. After 3 seconds, redirect to `/pricing?reason=quota_exceeded`

### Test 4: Practice Tracking (30s+ Watch)

**Expected Behavior**: Updates existing doc without counting quota

1. Load a video
2. Watch for 30+ seconds
3. Check server logs:
   ```
   [Practice Track] ✅ Updated userPracticeHistory for {userId}_{videoId}
   Setting firstPracticed for {userId}_{videoId}
   ```
4. Quota should NOT increase
5. `practiceCount` should increment

### Test 5: Lazy Migration

**Expected Behavior**: Old docs get `firstAccessed` field

1. Find an old doc in Firestore without `firstAccessed` field
2. Watch that video for 30+ seconds (trigger practice tracking)
3. Check server logs:
   ```
   [MIGRATION] Setting firstAccessed from firstPracticed
   ```
4. Verify doc now has `firstAccessed` field

## Quota Limits

From `config/features.v1.json`:
- Guest: 0 videos/day
- Free: 3 videos/day
- Premium: 20 videos/day

## Firestore Queries

### Check user's quota usage today
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);
const todayTimestamp = Timestamp.fromDate(today);

const snapshot = await db.collection('userPracticeHistory')
  .where('userId', '==', userId)
  .get();

const todayCount = snapshot.docs.filter(doc => {
  const data = doc.data();
  return data.contentType === 'youtube' &&
         data.firstAccessed &&
         data.firstAccessed.seconds >= todayTimestamp.seconds;
}).length;
```

### Check if video is repeat
```javascript
const docId = `${userId}_${videoId}`;
const doc = await db.collection('userPracticeHistory').doc(docId).get();
const isRepeat = doc.exists;
```

## Key Behaviors

### ✅ Correct Behavior
- Quota counted on video load (/api/youtube/extract)
- Repeat videos don't count (unlimited practice)
- Quota check happens BEFORE transcript extraction
- 429 error when quota exceeded
- Lazy migration for backward compatibility

### ❌ Previous Behavior (Fixed)
- ~~Quota counted after 30s watching~~
- ~~Users could paste unlimited URLs~~
- ~~Expensive operations happened before quota check~~

## Debugging

### Enable quota logging
Server logs automatically show:
- `[Quota]` - Quota checking messages
- `[Practice Track]` - Practice tracking messages
- `[MIGRATION]` - Lazy migration events

### Check quota status
```bash
curl http://localhost:3002/api/youtube/popular | jq '.userQuota'
```

### Inspect Firestore doc
1. Go to Firestore Console
2. Navigate to `userPracticeHistory`
3. Find doc with ID: `{userId}_{videoId}`
4. Check fields:
   - `firstAccessed` - When video first loaded
   - `firstPracticed` - When first watched 30s+
   - `practiceCount` - Number of practice sessions
   - `totalPracticeTime` - Total seconds

## Known Limitations

1. **Guest Users**: No quota tracking (quota = 0, can't access any videos)
2. **Cached Transcripts**: Still respects quota (quota is checked before cache lookup)
3. **Manual Testing Required**: Integration tests need authenticated session

## Future Improvements

1. Add E2E tests with Playwright/Cypress
2. Add quota analytics dashboard
3. Implement quota reset at midnight (currently resets at 00:00 local time)
4. Add rate limiting for API endpoints
5. Track quota usage metrics in analytics

## Related Files

- `/src/app/api/youtube/extract/route.ts` - Quota enforcement
- `/src/app/api/practice/track/route.ts` - Practice tracking and lazy migration
- `/src/app/api/youtube/popular/route.ts` - Quota status display
- `/src/components/youtube-shadowing/TranscriptDisplay.tsx` - Client error handling
- `__tests__/quota-system.test.js` - Unit tests
- `scripts/test-quota-system.js` - Integration test script

## Summary

✅ **11 unit tests passing**
✅ **Integration test scripts created**
✅ **Manual testing steps documented**
✅ **Lazy migration implemented**
✅ **Client error handling added**

The quota system now follows industry standards and prevents quota bypass!
