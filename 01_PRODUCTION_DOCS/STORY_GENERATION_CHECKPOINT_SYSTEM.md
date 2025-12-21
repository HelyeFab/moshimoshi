# Story Generation Checkpoint & Retry System

## Status: TESTING NOT COMPLETE

> **WARNING**: This system has been implemented but comprehensive testing has not been completed yet. The daily retry scheduler runs automatically at 6am UTC. Monitor the first few runs to ensure correct behavior.

---

## Overview

The Story Generation system now includes a robust checkpoint/resume capability that prevents incomplete stories from being published and automatically retries failed asset generation.

## Problem Solved

Previously, stories could be published with missing assets (images, audio, sentences) if generation failed partway through. Users would see stories with:
- Missing page images
- No audio
- Incomplete sentence data for the review engine

The integrity checker would eventually fix these, but the damage was done - incomplete stories were visible to users.

## Architecture

### Cloud Functions

| Function | Schedule | Purpose |
|----------|----------|---------|
| `scheduledStoryGeneratorFunction` | Sundays 00:00 UTC | Weekly story generation (checks for pending first) |
| `dailyStoryRetryScheduler` | Daily 06:00 UTC | Retries pending stories ONLY (never generates new) |
| `manualStoryGeneratorFunction` | On-demand | Always generates NEW story (for testing) |

### Flow Diagram

```
Weekly Scheduler (Sunday midnight)
        │
        ├── Check for pending drafts
        │       │
        │       ├── Found pending? → Resume from checkpoint
        │       │                           │
        │       │                    Success? → Publish
        │       │                           │
        │       │                    Failed? → Stay pending (daily retry will handle)
        │       │
        │       └── No pending? → Generate NEW story
        │                               │
        │                        All assets OK? → Publish
        │                               │
        │                        Assets failed? → Mark as pending_*
        │
        └── Done

Daily Retry (6am UTC)
        │
        ├── Check for pending drafts
        │       │
        │       ├── Found pending? → Resume from checkpoint
        │       │                           │
        │       │                    Success? → Publish
        │       │                           │
        │       │                    Failed? → Increment attempt count
        │       │                           │
        │       │                    3+ attempts? → Mark as FAILED
        │       │
        │       └── No pending? → Exit (nothing to do)
        │
        └── Done
```

## Draft Statuses

| Status | Meaning | Action |
|--------|---------|--------|
| `generating` | Currently being generated | Wait |
| `draft` | Initial state | Continue generation |
| `pending_images` | Image generation failed | Retry images |
| `pending_audio` | Audio generation failed | Retry audio |
| `pending_sentences` | Sentence pre-gen failed | Retry sentences |
| `published` | Successfully completed | Done |
| `failed` | Exceeded max retries (3) | Manual intervention needed |

## Checkpoint Data Structure

Each draft stores checkpoint information:

```typescript
interface DraftCheckpoint {
  lastCompletedStep: DraftGenerationStep;  // e.g., 'page_images', 'audio'
  lastCompletedIndex?: number;              // For loops (which page image)
  failedAttempts: number;                   // 0, 1, 2, or 3
  lastAttemptAt: Timestamp;
  lastError?: string;                       // Last error message
}
```

### Generation Steps (in order)

1. `character_sheet` - AI generates character descriptions
2. `outline` - AI creates story outline
3. `pages` - Generate each page's Japanese text
4. `quiz` - Generate comprehension quiz
5. `model_sheet` - Generate character reference image (Gemini)
6. `page_images` - Generate illustration for each page (parallel, 3 at a time)
7. `audio` - Generate VOICEVOX TTS for pages
8. `sentences` - Pre-generate sentence data for review engine
9. `complete` - Ready to publish

## Immediate Retry Logic

Before marking a draft as pending, the system tries immediate retries with exponential backoff:

| Step | Retries | Backoff |
|------|---------|---------|
| Page Images | 3 per image | 3s, 6s, 9s |
| Audio | 3 | 5s, 10s, 15s |
| Sentences | 3 | 5s, 10s, 15s |

Only after all immediate retries fail does the draft get marked as `pending_*`.

## Timeline Example

Worst case scenario:

| Day | Time | Event |
|-----|------|-------|
| Sunday | 00:00 | Weekly scheduler generates story |
| Sunday | 00:03 | Images fail → `pending_images` |
| Monday | 06:00 | Daily retry → attempt 2, still fails |
| Tuesday | 06:00 | Daily retry → attempt 3, still fails |
| Wednesday | 06:00 | Daily retry → 3+ attempts → `failed` status |
| Next Sunday | 00:00 | Weekly generates NEW story (failed one is skipped) |

Best case (transient failure):

| Day | Time | Event |
|-----|------|-------|
| Sunday | 00:00 | Story generates, images fail on attempt 1 |
| Sunday | 00:00 | Immediate retry succeeds on attempt 2 |
| Sunday | 00:01 | Story published successfully |

## Configuration

Located in `functions/src/scheduled/storyScheduler.ts`:

```typescript
const CHECKPOINT_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,           // After 3 failures → mark as failed
  INCOMPLETE_DRAFT_HOURS: 48,      // Only retry drafts < 48 hours old
  CONCURRENT_IMAGE_LIMIT: 3,       // Parallel image generation limit
}
```

## Key Files

| File | Purpose |
|------|---------|
| `functions/src/scheduled/storyScheduler.ts` | Main scheduler logic with checkpoints |
| `functions/src/utils/sentencePreGenerator.ts` | Sentence pre-generation |
| `src/app/api/admin/stories/publish-draft/route.ts` | Publish logic (cover image fix) |
| `src/types/ai-story.ts` | Type definitions for checkpoints |

## Bug Fixes Included

### 1. Cover Image Using Model Sheet
- **Problem**: Cover image was set to the character model sheet instead of page 1 image
- **Fix**: Changed priority in `publish-draft/route.ts` line 184-185
- **Before**: `modelSheet?.imageUrl || pageImages["1"]`
- **After**: `pages?.[0]?.imageUrl || pageImages["1"]`

### 2. FieldValue.serverTimestamp in Arrays
- **Problem**: `FieldValue.serverTimestamp()` can't be used in nested arrays
- **Fix**: Changed to `admin.firestore.Timestamp.now()` in `sentencePreGenerator.ts` line 497

### 3. Firestore Update on Non-existent Documents
- **Problem**: `.update()` fails if document doesn't exist yet
- **Fix**: Changed to `.set()` with `{ merge: true }` throughout

## Monitoring

### Check Draft Status

```bash
node scripts/check-draft-status.js
```

Shows:
- All drafts from last 7 days
- Status summary (how many pending, published, failed)
- Checkpoint details for pending drafts

### Check Specific Draft

```bash
node scripts/check-specific-draft.js draft_1234567890_scheduler-system
```

### Firebase Console

1. Go to Cloud Functions → Logs
2. Filter by function name: `dailyStoryRetryScheduler` or `scheduledStoryGeneratorFunction`
3. Look for `[StoryScheduler]` or `[DailyRetry]` prefixes

## Alert Emails

When a story is saved as pending, an email is sent via Resend with:
- Draft ID
- Which step failed
- Error message
- Theme and JLPT level

When a story exceeds max retries and is marked as failed, a failure alert is sent.

## Manual Intervention

If a story is stuck in `failed` status:

1. Check the draft document in Firestore (`ai_story_drafts` collection)
2. Review the `checkpoint.lastError` field
3. Fix the underlying issue
4. Reset the draft:
   ```javascript
   // In Firebase console or script
   await db.collection('ai_story_drafts').doc(draftId).update({
     status: 'pending_images',  // or appropriate pending status
     'checkpoint.failedAttempts': 0
   })
   ```
5. Wait for daily retry scheduler OR trigger manually

## Testing Checklist

> **STATUS: NOT COMPLETE**

- [ ] Weekly scheduler generates new story successfully
- [ ] Weekly scheduler resumes pending story correctly
- [ ] Daily retry scheduler retries pending story
- [ ] Daily retry scheduler exits cleanly when no pending stories
- [ ] Immediate retries work for images
- [ ] Immediate retries work for audio
- [ ] Immediate retries work for sentences
- [ ] Max retry limit correctly marks as failed
- [ ] Email alerts sent on pending
- [ ] Email alerts sent on failure
- [ ] Cover image uses page 1 (not model sheet)
- [ ] Sentence data stores correctly (no FieldValue error)

## Deployment

### Firebase Functions

```bash
cd functions
npx firebase deploy --only functions:scheduledStoryGeneratorFunction,functions:dailyStoryRetryScheduler,functions:manualStoryGeneratorFunction
```

### Vercel (for publish-draft fix)

```bash
npx vercel --prod --archive=tgz
```

---

## Version History

| Date | Change |
|------|--------|
| 2025-12-21 | Initial implementation of checkpoint/retry system |
| 2025-12-21 | Added daily retry scheduler |
| 2025-12-21 | Fixed cover image using model sheet |
| 2025-12-21 | Fixed FieldValue.serverTimestamp in arrays |

---

*Last Updated: 2025-12-21*
*Author: Claude Code*
