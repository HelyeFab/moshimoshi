# Async Word Explanation Generation - Stories

## 🎯 Implementation Summary

Story word explanations are generated **asynchronously** using a **Pub/Sub batch processing system**, solving timeout issues while providing real-time progress tracking.

Unlike comics (which use a simple Firestore trigger), stories use a **distributed batch processing architecture** with Pub/Sub message chaining to handle 50+ words efficiently.

## 🔄 How It Works

### Architecture Overview

```
Story Scheduler (120s timeout):
├─ Generate story pages, sentences, audio (~10-15 min)
├─ Publish story to Firestore ✅
└─ Trigger: onStoryPublished (Firestore trigger)
    └─ Extract words from story text (~4s)
    └─ Create batch queue (batches of 10 words)
    └─ Publish first batch to Pub/Sub topic
    └─ EXIT (trigger completes)

Pub/Sub Batch Processor (540s timeout per batch):
└─ processStoryWordBatch (triggered by Pub/Sub message)
    ├─ Load batch from queue
    ├─ Generate word explanations (10 words × ~25s = ~4 min)
    ├─ Store explanations incrementally (idempotent)
    ├─ Update progress in story document
    ├─ Mark batch as complete
    └─ If more batches remain:
        └─ Publish message for next batch → loops back
    └─ If all complete:
        └─ Mark story as complete ✅
```

### Key Design Decisions

1. **Pub/Sub Chaining**: Each batch triggers the next batch, creating a self-healing pipeline
2. **Batch Size**: 10 words per batch (fits comfortably in 540s timeout with buffer)
3. **Idempotent Storage**: Batches can be retried without duplicating data
4. **Progress Tracking**: Real-time updates after each batch completes
5. **Incremental Storage**: Words saved immediately, not waiting for batch completion

## 🚨 Critical Configuration (DO NOT CHANGE)

### Pub/Sub Topic Name (MUST be fully qualified)

```typescript
// ❌ WRONG - Will cause subscription mismatch
const BATCH_TOPIC = 'story-word-batch-processing';

// ✅ CORRECT - Fully qualified with project ID
const PROJECT_ID = process.env.GCLOUD_PROJECT ||
                   process.env.GOOGLE_CLOUD_PROJECT ||
                   process.env.FIREBASE_PROJECT_ID;

const BATCH_TOPIC_NAME = `projects/${PROJECT_ID}/topics/story-word-batch-processing`;
```

**Why This Matters**: Cloud Functions v2 requires fully qualified topic names for Pub/Sub subscriptions to attach correctly. Without this, messages are published but the processor never starts.

### Topic Auto-Creation (REQUIRED)

```typescript
// CRITICAL: Topic must exist before publishing
const topic = pubsub.topic(BATCH_TOPIC_NAME);
await topic.get({ autoCreate: true });  // Creates topic if missing

await topic.publishMessage({
  json: { storyId, batchNumber: 1 }
});
```

**Symptoms if Missing**:
- `onStoryPublished` completes successfully
- "Published first batch message" appears in logs
- `processStoryWordBatch` never executes (zero logs)

## 📋 Story Document Fields

### Status & Progress Fields

```typescript
{
  // Status tracking
  wordExplanationsStatus: 'pending' | 'generating' | 'complete' | 'failed',
  wordExplanationsStartedAt: Timestamp,
  wordExplanationsCompletedAt: Timestamp,
  wordExplanationsLastUpdatedAt: Timestamp,
  wordExplanationsCount: number,  // Words generated so far
  wordExplanationsError: string,  // If failed
  wordExplanationsFailedAt: Timestamp,

  // Real-time progress (updated after each batch)
  wordExplanationsProgress: {
    totalBatches: 5,           // Total batches created
    completedBatches: 3,       // Batches completed
    totalWords: 50,            // Total unique words
    completedWords: 30,        // Words generated so far
    currentBatch: 4,           // Next batch to process
    percentComplete: 60        // 30/50 = 60%
  }
}
```

## 🗄️ Firestore Collections

### 1. `story_word_batch_queue/{storyId}`

Tracks batch processing state:

```typescript
{
  storyId: string,
  totalBatches: 5,
  totalWords: 50,
  completedBatches: 3,
  completedWords: 30,
  status: 'processing' | 'complete' | 'failed',
  createdAt: Timestamp,
  updatedAt: Timestamp,

  batches: [
    {
      batchNumber: 1,
      status: 'complete',
      words: [...],  // Array of 10 word objects
      startedAt: Timestamp,
      completedAt: Timestamp,
      errorCount: 0
    },
    {
      batchNumber: 2,
      status: 'processing',
      words: [...],
      startedAt: Timestamp
    },
    // ...
  ]
}
```

### 2. `story_word_explanations/{storyId}`

Stores generated word explanations:

```typescript
{
  storyId: string,
  words: [
    {
      word: "美香",
      reading: "みか",
      meaning: "A Japanese female given name",
      partOfSpeech: "proper noun",
      exampleSentences: [...],
      // ... full word explanation schema
    },
    // ... 49 more words
  ],
  wordCount: 50,
  total: 50,

  // Batch tracking (for idempotency)
  batchNumbers: [1, 2, 3, 4, 5],  // Batches already stored
  batchWordCounts: {
    "1": 9,   // Batch 1 had 9 successful words
    "2": 10,
    "3": 10,
    "4": 10,
    "5": 10
  },

  // Cost tracking
  costInfo: {
    promptTokens: 21550,
    completionTokens: 23536,
    totalTokens: 45086,
    estimatedCost: 0  // Qwen is self-hosted
  },

  generatedAt: Timestamp,
  lastUpdated: Timestamp
}
```

## 🔧 Key Files

### Cloud Functions

1. **`/functions/src/scheduled/storyScheduler.ts`**
   - `onStoryPublished`: Firestore trigger (runs when story document created)
   - Extracts words using Kuromoji
   - Creates batch queue
   - Publishes first batch to Pub/Sub

2. **`/functions/src/scheduled/storyWordBatchProcessor.ts`**
   - `processStoryWordBatch`: Pub/Sub trigger (runs for each batch)
   - Generates word explanations for 10 words
   - Stores results incrementally
   - Publishes next batch or marks complete

3. **`/functions/src/utils/storyWordBatchManager.ts`**
   - `createBatchQueue()`: Splits words into batches
   - `markBatchProcessing()`: Updates batch status
   - `markBatchComplete()`: Records completion
   - `markBatchFailed()`: Handles errors
   - `isComplete()`: Checks if all batches done

4. **`/functions/src/utils/storyWordExplanationPreGenerator.ts`**
   - `generateWordExplanation()`: Calls Qwen via Modal
   - Returns word explanation + token usage

5. **`/functions/src/index.ts`**
   - Exports `onStoryPublished` and `processStoryWordBatch`

### Configuration

- **Batch size**: 10 words (configurable in `storyWordBatchManager.ts:BATCH_SIZE`)
- **onStoryPublished timeout**: 120s (enough to extract words and publish)
- **processStoryWordBatch timeout**: 540s (9 minutes - enough for 10 words at ~27s each)
- **Memory**: 512MiB for trigger, 1GiB for batch processor

## 📊 Performance Metrics

### Actual Test Results (2026-01-12)

**Story**: "A Visit to the Doctor" (N4 level, 4 pages)

| Metric | Value |
|--------|-------|
| Total words | 50 unique words |
| Total batches | 5 batches |
| Batch size | 10 words/batch |
| Success rate | 98% (49/50 words) |
| Total time | ~14 minutes (10:04 - 10:25) |
| Time per batch | ~4-5 minutes |
| Time per word | ~25 seconds avg |
| Total tokens | 45,086 tokens |
| Prompt tokens | 21,550 |
| Completion tokens | 23,536 |
| Cost | $0 (Qwen self-hosted) |

### Timeline Breakdown

```
10:04:28 - Story published
10:04:34 - First batch message published
10:04:35 - Batch #1 starts (1 second latency!)
10:08:24 - Batch #1 complete (9/10 words, 3m 49s)
10:08:26 - Batch #2 message published
10:08:28 - Batch #2 starts (2 second latency)
10:12:48 - Batch #2 complete (10/10 words, 4m 20s)
10:12:51 - Batch #3 starts
10:17:05 - Batch #3 complete (10/10 words, 4m 14s)
10:17:08 - Batch #4 starts
10:21:27 - Batch #4 complete (10/10 words, 4m 19s)
10:21:29 - Batch #5 starts
10:25:35 - Batch #5 complete (10/10 words, 4m 06s)
10:25:35 - Story marked as complete
```

**Key Observation**: Batch-to-batch latency is only 1-2 seconds (Pub/Sub is fast!)

## 🧪 Testing

### Trigger a Test Story

```bash
# Via admin dashboard:
# Go to /admin/stories and create a new story

# Via Cloud Function:
# Create a test trigger script similar to generate-ep18-test.js
curl -X POST https://us-central1-moshimoshi-de237.cloudfunctions.net/manualStoryGeneratorFunction \
  -H "Content-Type: application/json" \
  -d '{"data":{"adminKey":"comic-scheduler-2025"}}'
```

### Monitor Progress

**Check story status in Firestore:**

```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

async function checkStoryStatus(storyId) {
  const story = await db.collection('stories').doc(storyId).get();
  const data = story.data();

  console.log('Status:', data.wordExplanationsStatus);
  console.log('Progress:', data.wordExplanationsProgress);
  console.log('Words generated:', data.wordExplanationsCount);
}

checkStoryStatus('story_1768211463109_scheduler-system');
```

**Watch batch processing logs:**

```bash
# Watch all batch processing
firebase functions:log --only processStoryWordBatch

# Watch story trigger
firebase functions:log --only onStoryPublished

# Watch specific story
firebase functions:log 2>&1 | grep "story_XXXXXXXXXX"
```

### Expected Log Sequence

**1. Story Published (onStoryPublished):**
```
[StoryWordGen] Triggered for new story
[StoryWordGen] Extracting words for batch processing
[WordExtractor] Kuromoji tokenizer built successfully
[WordExtractor] Extraction complete (Kuromoji) - 50 words
[StoryBatchManager] Batch queue created - 5 batches
[StoryBatchProcessor] Published first batch message
  topic: projects/moshimoshi-de237/topics/story-word-batch-processing
  projectId: moshimoshi-de237
  batchNumber: 1
```

**2. Batch Processing (processStoryWordBatch):**
```
[StoryBatchProcessor] Processing batch - batchNumber: 1
[StoryBatchManager] Batch marked as processing
[StoryBatchProcessor] Generating word explanations - 10 words
[StoryBatchProcessor] Word explanation generated - word: 美香
[StoryBatchProcessor] Word explanation generated - word: ポスター
... (8 more words)
[StoryBatchProcessor] Batch generation complete - 9/10 words, 7942 tokens
[StoryBatchProcessor] Progress updated - 18% complete (9/50 words)
[StoryBatchProcessor] Published message for next batch - batchNumber: 2
```

**3. Final Batch Complete:**
```
[StoryBatchProcessor] Batch generation complete - batchNumber: 5
[StoryBatchProcessor] All batches complete - 49/50 words
[Story marked as wordExplanationsStatus: 'complete']
```

## 🚨 Troubleshooting

### Issue: Batch Processor Never Starts

**Symptoms:**
- `onStoryPublished` completes successfully
- "Published first batch message" in logs
- Zero logs from `processStoryWordBatch`

**Cause**: Pub/Sub topic mismatch - subscription not attached

**Solution:**
1. Verify topic is fully qualified:
   ```typescript
   const BATCH_TOPIC_NAME = `projects/${PROJECT_ID}/topics/story-word-batch-processing`;
   ```

2. Verify topic auto-creation is called:
   ```typescript
   await topic.get({ autoCreate: true });
   ```

3. Check topic exists:
   ```bash
   gcloud pubsub topics list | grep story-word-batch
   ```

4. Redeploy both functions:
   ```bash
   npm run build
   firebase deploy --only functions:processStoryWordBatch,functions:onStoryPublished
   ```

### Issue: Batch Times Out Mid-Processing

**Symptoms:**
- Batch starts processing
- Some words generated
- Function timeout error after 540s
- Batch marked as failed

**Causes:**
- Too many words in batch (>10)
- Qwen/Modal is slow or timing out
- Network issues

**Solution:**
1. Check batch size in logs - should be exactly 10 words
2. Check Qwen response times - should be ~25s per word
3. Reduce batch size if needed (edit `BATCH_SIZE` in `storyWordBatchManager.ts`)
4. Increase timeout if needed (max 540s for Gen 2 functions)

### Issue: Batch Marked Complete But Words Missing

**Symptoms:**
- Progress shows 100% complete
- `story_word_explanations` document has fewer words than expected
- Some batches show 0 words in `batchWordCounts`

**Cause**: Individual word generation failures (JSON parsing errors from Qwen)

**Solution:**
- This is expected behavior - system continues on errors
- Check logs for "[StoryBatchProcessor] Failed to generate word explanation"
- Word failures are logged but don't stop the batch
- Typical success rate: 95-98%

### Issue: Duplicate Batches Processing

**Symptoms:**
- Multiple instances of same batch number in logs
- `batchWordCounts` shows same batch twice

**Cause**: Pub/Sub redelivery (function crashed and message retried)

**Solution:**
- System is idempotent - duplicate processing is safe
- Check for this log: "Batch already stored, skipping append"
- Progress uses stored count, not regenerated count
- No action needed - duplicate is ignored

### Issue: Orphaned Messages in Pub/Sub

**Symptoms:**
- Topic has undelivered messages
- Batches stuck in "processing" status

**Cause**: Function deployment during processing, or repeated failures

**Solution:**
```bash
# Check for orphaned messages
gcloud pubsub subscriptions list | grep story-word-batch

# Acknowledge all messages (clear queue)
gcloud pubsub subscriptions ack story-word-batch-processing --ack-all

# Reset batch queue in Firestore manually
# Delete story_word_batch_queue/{storyId} and re-trigger
```

## 🎯 Monitoring & Alerts

### Key Metrics to Track

1. **Batch Processing Time**: Should be ~4-5 minutes per batch
2. **Batch Success Rate**: Should be >95%
3. **Word Generation Success Rate**: Should be 95-98%
4. **Pub/Sub Latency**: Should be <5 seconds between batches
5. **Token Usage**: ~900-1000 tokens per word

### Recommended Alerts

```javascript
// Alert if batch takes >8 minutes
if (batchDuration > 480000) {
  alert('Batch processing slow');
}

// Alert if success rate drops below 90%
if (wordsGenerated / totalWords < 0.90) {
  alert('High word generation failure rate');
}

// Alert if batch-to-batch latency >30 seconds
if (nextBatchDelay > 30000) {
  alert('Pub/Sub latency high');
}
```

## 🔄 Future Improvements

### Potential Optimizations

1. **Parallel Batch Processing**: Process multiple batches simultaneously (requires careful queue management)
2. **Adaptive Batch Size**: Larger batches for shorter words, smaller for complex words
3. **Retry Logic**: Retry failed words with exponential backoff
4. **Caching**: Cache common word explanations to reduce API calls
5. **Progress Webhooks**: Notify frontend in real-time via WebSocket

### Scaling Considerations

- Current: 50 words = 5 batches = ~14 minutes
- At 100 words: 10 batches = ~28 minutes
- At 200 words: 20 batches = ~56 minutes

**Recommendation**: Keep stories under 100 words for reasonable processing time.

## ✅ Benefits Over Synchronous Approach

1. **No Timeouts**: Each batch has 540s timeout, plenty for 10 words
2. **Real-time Progress**: Users see progress after each batch
3. **Fault Tolerant**: Individual batch failures don't lose all progress
4. **Scalable**: Multiple stories can process in parallel
5. **Idempotent**: Safe to retry batches without duplication
6. **Self-Healing**: Failed batches can be manually retried
7. **Resource Efficient**: Only consumes resources when processing

## 🔗 Related Documentation

- Comics async generation: `/01_PRODUCTION_DOCS/ASYNC_WORD_GENERATION.md`
- Word explanation schema: `/functions/src/types/story.ts`
- Kuromoji tokenizer: `/functions/src/lib/utils/wordExtractor.ts`
- Qwen API integration: `/functions/src/utils/storyWordExplanationPreGenerator.ts`

---

**Last Updated**: 2026-01-12
**Verified Working**: Yes (50 words, 5 batches, 98% success rate)
**Production Status**: Ready for production use