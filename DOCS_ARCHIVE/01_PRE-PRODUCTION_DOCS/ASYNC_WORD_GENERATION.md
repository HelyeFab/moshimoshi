# Async Word Explanation Generation

## 🎯 Implementation Summary

Comic word explanations are now generated **asynchronously** using a Firestore trigger, solving the timeout issues.

## 🔄 How It Works

### Before (Synchronous - Had Timeouts):
```
Comic Scheduler (540s timeout):
├─ Generate outline, dialogues, images, audio (~480s)
├─ Generate word explanations (~120s) ❌ Often skipped due to time
└─ Publish episode
```

### After (Asynchronous - No Timeouts):
```
Comic Scheduler (540s timeout):
├─ Generate outline, dialogues, images, audio (~480s)
└─ Publish episode ✅ Always completes

Firestore Trigger (automatic):
└─ Detects new comic published
└─ Generate word explanations (~120s)
└─ Updates status fields in comic doc
```

## 📋 Status Fields Added to Comic Documents

Each published comic now has these fields:

- `wordExplanationsStatus`: `'generating'` | `'complete'` | `'failed'` | `undefined`
- `wordExplanationsStartedAt`: Timestamp
- `wordExplanationsCompletedAt`: Timestamp
- `wordExplanationsCount`: number (words generated)
- `wordExplanationsError`: string (if failed)
- `wordExplanationsFailedAt`: Timestamp (if failed)

## 🎨 Admin Dashboard Visual Indicator

Each comic title now shows a colored dot:

- 🟢 **Green**: Word explanations complete (hover shows count)
- 🟡 **Yellow** (pulsing): Currently generating
- 🔴 **Red**: Failed or not generated (hover shows error)

## 🔧 Files Modified

### Cloud Functions:
1. `/functions/src/scheduled/comicScheduler.ts`
   - Removed synchronous word generation (Step 7.5)
   - Added `onComicPublished` Firestore trigger function
   - Updated flow comments

2. `/functions/src/index.ts`
   - Exported `onComicPublished` function

### Frontend:
3. `/src/app/[locale]/admin/comics/page.tsx`
   - Added status dot indicator next to comic titles
   - Shows green/yellow/red based on `wordExplanationsStatus`

4. `/src/app/[locale]/admin/comics/generate/page.tsx`
   - Removed manual word generation API call (Step 9)
   - Now relies on Firestore trigger

5. `/src/app/api/admin/comics/word-explanations/route.ts`
   - Changed `maxDuration` from 300s → 30s (no longer needs long timeout)

## ✅ Benefits

1. **No More Timeouts**: Episodes always publish successfully
2. **Faster Publishing**: Episode available immediately, words follow
3. **Better Monitoring**: Visual indicators show status at a glance
4. **Automatic Retry**: Trigger can be retried independently
5. **Scalable**: Multiple episodes can process word generation in parallel

## 🧪 Testing

Generate a new episode via admin dashboard or Cloud Function:

```bash
# Via admin dashboard:
# Go to /admin/comics/generate and create episode

# Via Cloud Function:
node generate-ep18-scheduled.js

# Check status:
node check-ep18-status.js
```

Watch for:
1. Episode publishes immediately
2. Word explanation status starts as red (undefined)
3. Changes to yellow (pulsing) when generating
4. Turns green when complete (~1-2 minutes after publish)

## 📊 Monitoring

Check Firestore trigger logs:
```bash
firebase functions:log --only onComicPublished
```

Look for:
- `[ComicWordGen] Triggered for new episode`
- `[ComicWordGen] Generating word explanations`
- `[ComicWordGen] Word explanations completed successfully`

## 🔗 Related Files

- Cloud Functions word generator: `/functions/src/utils/comicWordExplanationPreGenerator.ts`
- Word explanation storage: Firestore collection `comic_word_explanations/{episodeId}`
- Status tracking: Firestore collection `comics/{episodeId}.wordExplanationsStatus`
