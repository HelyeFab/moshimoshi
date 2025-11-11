# YouTube Quota System

## Overview

Fair quota tracking system that counts videos when they're loaded (industry standard approach) instead of after watching duration.

## Problem Solved

**Before**: Users could bypass quota by pasting unlimited URLs since quota only counted after 30 seconds of watching.

**After**: Quota counts on video load (when transcript is extracted), preventing abuse while allowing unlimited repeat practice.

## How It Works

```
User pastes YouTube URL
    ↓
Check if video accessed before
    ↓
    ├─ New video → Check quota → Extract transcript (counts toward quota)
    └─ Repeat video → Extract transcript (FREE unlimited practice)
```

## Quota Limits

From `config/features.v1.json`:

| User Tier | Daily Limit |
|-----------|------------|
| Guest     | 0 videos   |
| Free      | 3 videos   |
| Premium   | 20 videos  |

## Key Fields

### userPracticeHistory Collection

```typescript
{
  userId: string;
  videoId: string;                    // Format: "youtube_{youtubeVideoId}"
  contentType: "youtube";

  // QUOTA TRACKING (NEW)
  firstAccessed: Timestamp;           // When video first loaded ⭐ Used for quota

  // PRACTICE TRACKING
  firstPracticed: Timestamp | null;   // When first watched 30+ seconds
  lastPracticed: Timestamp;           // Last practice session
  practiceCount: number;              // Number of 30s+ sessions
  totalPracticeTime: number;          // Total seconds practiced

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## API Endpoints

### POST /api/youtube/extract
**Purpose**: Extract transcript and enforce quota

**Flow**:
1. Check if video is repeat (exists in userPracticeHistory)
2. If new video:
   - Check quota (count videos with `firstAccessed` today)
   - If quota exceeded → Return 429 error
   - If quota available → Create userPracticeHistory doc
3. Extract transcript (expensive operation)

**Response (Quota Exceeded)**:
```json
{
  "success": false,
  "error": "QUOTA_EXCEEDED",
  "message": "Daily video limit reached",
  "quotaInfo": {
    "used": 3,
    "limit": 3,
    "remaining": 0
  }
}
```

### POST /api/practice/track
**Purpose**: Track practice sessions (30s+ watch)

**Flow**:
1. Find existing userPracticeHistory doc
2. Update practice stats (practiceCount, totalPracticeTime)
3. Set `firstPracticed` if first 30s+ watch
4. Lazy migration: Set `firstAccessed` from `firstPracticed` if missing

**Note**: Does NOT count toward quota (only updates existing docs)

### GET /api/youtube/popular
**Purpose**: Show popular videos and user's quota status

**Returns**:
```json
{
  "success": true,
  "videos": [...],
  "userQuota": {
    "used": 2,
    "limit": 3,
    "remaining": 1
  }
}
```

## Client-Side Error Handling

Location: `src/components/youtube-shadowing/TranscriptDisplay.tsx`

```typescript
if (response.status === 429 && data.error === 'QUOTA_EXCEEDED') {
  // Show error message
  setError(`Daily video limit reached (${quotaInfo.used}/${quotaInfo.limit})`);

  // Redirect to pricing after 3 seconds
  setTimeout(() => {
    window.location.href = '/pricing?reason=quota_exceeded';
  }, 3000);
}
```

## Migration Strategy

**Lazy Migration**: Old docs without `firstAccessed` are automatically migrated when user practices:

```typescript
// In /api/practice/track
if (!existingStats?.firstAccessed && existingStats?.firstPracticed) {
  updateData.firstAccessed = existingStats.firstPracticed;
  console.log('[MIGRATION] Setting firstAccessed from firstPracticed');
}
```

**Benefits**:
- No breaking changes
- No manual data migration needed
- Backward compatible

## Testing

See [TESTING.md](./TESTING.md) for comprehensive testing guide.

**Quick Test**:
```bash
# Run unit tests
npm test -- __tests__/quota-system.test.js

# Run integration tests
node scripts/test-quota-authenticated.js
```

## Files Changed

### Core Implementation
- `/src/app/api/youtube/extract/route.ts` - Quota enforcement
- `/src/app/api/practice/track/route.ts` - Practice tracking + lazy migration
- `/src/app/api/youtube/popular/route.ts` - Quota status display
- `/src/components/youtube-shadowing/TranscriptDisplay.tsx` - Error handling

### Tests
- `__tests__/quota-system.test.js` - 11 unit tests
- `scripts/test-quota-system.js` - Integration tests
- `scripts/test-quota-authenticated.js` - Authenticated flow tests

### Documentation
- `docs/youtube-quota-system/README.md` - This file
- `docs/youtube-quota-system/TESTING.md` - Testing guide

## Key Behaviors

### ✅ Correct Behavior
- ✅ Quota counted when video loads (before transcript extraction)
- ✅ Repeat videos don't count (unlimited practice)
- ✅ Quota check before expensive operations
- ✅ 429 error with quota info when exceeded
- ✅ Client redirects to pricing page
- ✅ Lazy migration for old docs

### 🔄 What Changed
| Before | After |
|--------|-------|
| Count after 30s watching | Count on video load |
| Quota in `/api/practice/track` | Quota in `/api/youtube/extract` |
| Used `lastPracticed` field | Use `firstAccessed` field |
| Unlimited URL pasting | Fair quota enforcement |

## Industry Standard

This approach matches what successful language learning apps do:

- **Duolingo**: Counts lesson start, not completion time
- **LingQ**: Counts on content open, not reading time
- **Anki**: Counts new cards on import, not review time

**Why**: Expensive operations (transcript extraction, AI processing) happen immediately on load. Fair to count quota at that point.

## Debugging

### Check quota status
```bash
curl http://localhost:3002/api/youtube/popular | jq '.userQuota'
```

### View server logs
```bash
# Look for these patterns:
[Quota] New video {videoId} - will count toward quota
[Quota] Repeat video {videoId} - free unlimited practice
[Practice Track] Setting firstPracticed
[MIGRATION] Setting firstAccessed from firstPracticed
```

### Inspect Firestore
1. Go to Firestore Console
2. Collection: `userPracticeHistory`
3. Document ID: `{userId}_{videoId}`
4. Check fields: `firstAccessed`, `firstPracticed`, `practiceCount`

## Future Improvements

- [ ] Add quota analytics dashboard
- [ ] Implement server-side quota reset job (midnight UTC)
- [ ] Add rate limiting for API endpoints
- [ ] Track quota usage metrics
- [ ] Add E2E tests with Playwright
- [ ] Implement quota grace period (e.g., 1 extra video on first day)

## Related Documentation

- [Testing Guide](./TESTING.md) - Comprehensive testing instructions
- [API Documentation](../api/README.md) - API endpoint details
- [Feature Flags](../../config/features.v1.json) - Quota limits configuration

## Support

For issues or questions:
1. Check [TESTING.md](./TESTING.md) for debugging steps
2. Review server logs for `[Quota]` messages
3. Inspect Firestore `userPracticeHistory` collection
4. Check user's subscription status in `users` collection
