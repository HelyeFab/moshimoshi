# Story Generation Deepdive (Scheduler, Admin, Word Precompute)

**Status:** ACTIVE  
**Last Updated:** 2026-02-01  
**Audience:** Senior/Owner-level engineering  
**Scope:** Story generation across Cloud Functions + Next.js API, admin UI, and post-generation word precompute.

---

## Executive Summary

Story generation has two entry points that converge on the same Next.js API endpoints:

1) **Scheduled generation (Cloud Functions)** orchestrates a multi-step pipeline weekly and retries daily.  
2) **Admin dashboard (Next.js UI)** triggers the same pipeline manually, step-by-step.

Post-generation, **word explanations are precomputed immediately after publish** via a Firestore trigger that builds a Pub/Sub batch queue. Batches are processed by a separate function that writes to `story_word_explanations`.

The most recent production failure (2026-02-01) in `processStoryWordBatch` was caused by Firestore rejecting `undefined` values in `words[].conjugation`. A sanitizer was added in `functions/src/scheduled/storyWordBatchProcessor.ts` to strip undefined values before writes.

---

## System Overview (High-Level Flow)

```
Scheduler (Cloud Function) or Admin UI
        |
        v
Next.js API: /api/admin/generate-story
  - character sheet
  - outline
  - pages
  - quiz
  - model sheet
  - page images
  - audio (via /api/admin/generate-story-audio)
        |
        v
/api/admin/stories/publish-draft
  - validates
  - writes to stories
        |
        v
Firestore onCreate: stories/{storyId}
  - extracts words
  - creates batch queue (story_word_batches)
  - publishes Pub/Sub message
        |
        v
processStoryWordBatch (Pub/Sub)
  - generates explanations
  - writes story_word_explanations
  - updates progress on stories
```

---

## Entry Point #1: Scheduled Generation (Cloud Functions)

**File:** `functions/src/scheduled/storyScheduler.ts`

### Key Functions

- `scheduledStoryGeneratorFunction`  
  - **Cron:** `0 0 * * 0` (Sunday 00:00 UTC)  
  - Resumes incomplete drafts first, then generates a new story if none pending.

- `dailyStoryRetryScheduler`  
  - **Cron:** `0 6 * * *` (Daily 06:00 UTC)  
  - Retries pending drafts only.

- `manualStoryGeneratorFunction`  
  - Callable function for admin-triggered scheduled pipeline (not UI flow).

### Pipeline Steps (Scheduler)

1. `character_sheet`
2. `outline`
3. `generate_page` (loop)
4. `generate_quiz`
5. `generate_model_sheet`
6. `generate_page_image` (parallel)
7. `generate_audio` (via /api/admin/generate-story-audio)
8. `preGenerateStorySentences` (Qwen; translations + per-sentence audio)
9. `publish` (moves draft -> stories)
10. **Word explanations** are now generated **after publish** via Firestore trigger (see below).

### Checkpoints and Pending States

Drafts use `checkpoint` fields for resumption.

Pending states:
- `pending_images`
- `pending_audio`
- `pending_sentences`

### Admin Key

Scheduler uses an admin key:

- `STORY_SCHEDULER_ADMIN_KEY`  
- Default fallback: `story-scheduler-2025`

---

## Entry Point #2: Admin Dashboard (Next.js UI)

**UI:** `src/app/[locale]/admin/stories/generate/page.tsx`

Flow:

1) Character sheet  
2) Outline  
3) Pages (loop)  
4) Quiz (optional)  
5) Model sheet + page images (optional)  
6) Publish

Uses **session auth** and admin check in `/api/admin/generate-story`.

---

## Core Generation API

**Endpoint:** `src/app/api/admin/generate-story/route.ts`

Steps:
- `character_sheet` -> `ai_story_drafts` doc
- `outline` -> updates draft
- `generate_page` -> updates `pages[]`
- `generate_quiz`
- `generate_model_sheet` -> Gemini image stored in Firebase Storage
- `generate_page_image` -> Gemini image, transaction update for pages
- `generate_audio` -> forwards to `/api/admin/generate-story-audio`

**Key Behavior:**
- Admin key bypass for scheduler.
- Session + admin check for dashboard.
- Uses `AIService` + `MultiStepStoryProcessor`.
- **Image generation uses Gemini**, with optional character consistency from model sheet.

---

## Audio Generation

**Endpoint:** `src/app/api/admin/generate-story-audio/route.ts`

Uses VOICEVOX (Modal) and writes:

- `fullAudioUrl`
- `pages[].audioUrl`
- `audioStatus` (`complete` | `partial` | `failed`)

**Important safeguard:**  
It reads existing pages from Firestore first and only updates `audioUrl` to avoid overwriting `textWithFurigana`, translations, etc. This was added after a production data loss incident (fixed 2026-01-25).

---

## Publish + Validation

**Endpoint:** `src/app/api/admin/stories/publish-draft/route.ts`

Responsibilities:
- Validates pages have `text`, `textWithFurigana`, `translation`.
- Validates quiz bilingual fields.
- Transforms draft into `stories` schema.
- Deletes draft once published.

On validation failure, logs to `ai_validation_errors`.

---

## Word Precompute (Immediate After Publish)

### Trigger

**Function:** `onStoryPublished`  
**File:** `functions/src/scheduled/storyScheduler.ts`

On `stories/{storyId}` creation:

1. Marks status as `wordExplanationsStatus: generating`.
2. Extracts full story text from `stories.pages[].text`.
3. Extracts words using `extractWords`.
4. Creates batch queue (`story_word_batches`) via `storyWordBatchManager`.
5. Publishes first batch to Pub/Sub topic `story-word-batch-processing`.

### Batch Processing

**Function:** `processStoryWordBatch`  
**File:** `functions/src/scheduled/storyWordBatchProcessor.ts`

For each batch:
- Generates explanations using Qwen via `storyWordExplanationPreGenerator`.
- Writes/merges into `story_word_explanations`.
- Updates progress in `stories.wordExplanationsProgress`.
- Publishes next batch until complete.

### Batch Manager

**File:** `functions/src/utils/storyWordBatchManager.ts`

Key behavior:
- Dynamic batch size based on total word count.
- Tracks per-batch status and retries.
- Stores queue in `story_word_batches`.

---

## Precompute API (On-Demand Client Fallback)

**Endpoint:** `src/app/api/word/precompute/route.ts`

Used by `useWordExplanation` hook to:
- Check existing precompute doc.
- Trigger server-side precompute if missing or stale.
- Write to `{contentType}_word_explanations` collections.

Core implementation lives in:

**File:** `src/lib/ai/precompute/wordPrecompute.ts`

Features:
- Kuromoji tokenization
- Context sentence translation
- Optional TTS for short words

---

## Schemas and Structured Outputs

**File:** `src/lib/ai/schemas/story-schemas.ts`

Key schemas:
- `StoryPageSchema` (text, textWithFurigana, translation required)
- `QuizQuestionsResponseSchema` (bilingual fields required)
- `CharacterSheetSchema`, `StoryOutlineSchema`

Used via `BaseProcessor.callOpenAIWithSchema()` in `AIService`.

---

## Storage and Collections

### Drafts
`ai_story_drafts/{draftId}`

### Published
`stories/{storyId}`

### Word Explanations
`story_word_explanations/{storyId}`

### Batch Queue
`story_word_batches/{storyId}`

### Logs
`story_generation_logs/`

---

## Key Config and Secrets

### Functions Secrets
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `MODAL_API_KEY`
- `RESEND_API_KEY`

### Next.js Env
- `NEXT_PUBLIC_APP_URL`
- `STORY_SCHEDULER_ADMIN_KEY`
- `FIREBASE_ADMIN_*` (project/client/private key)

---

## Recent Production Incident (2026-02-01)

**Symptom:** `processStoryWordBatch` failed with:

```
Cannot use "undefined" as a Firestore value (found in field "words.24.conjugation")
```

**Root Cause:**  
Generated word explanation contained `undefined` fields, which Firestore rejects.

**Fix:**  
Sanitize all explanations and payloads before writing.

**Patch:**  
`functions/src/scheduled/storyWordBatchProcessor.ts`
- Added `stripUndefined` helper.
- Applied to `mergedExplanations` and write payload.

---

## Operational Notes

### Logs (Gen2 Functions)

```
gcloud functions logs read processStoryWordBatch --project moshimoshi-de237 --gen2 --limit 200
```

### Manual Trigger (Scheduler Flow)

```
firebase functions:call manualStoryGeneratorFunction --data '{"adminKey":"your-admin-key"}'
```

### Story Generation API (Admin)

```
POST /api/admin/generate-story
```

### Publish Draft

```
POST /api/admin/stories/publish-draft
```

---

## File Map (Most Relevant)

**Scheduler / Functions**
- `functions/src/scheduled/storyScheduler.ts`
- `functions/src/scheduled/storyWordBatchProcessor.ts`
- `functions/src/utils/storyWordBatchManager.ts`
- `functions/src/utils/storyWordExplanationPreGenerator.ts`

**Next.js API**
- `src/app/api/admin/generate-story/route.ts`
- `src/app/api/admin/generate-story-audio/route.ts`
- `src/app/api/admin/stories/publish-draft/route.ts`
- `src/app/api/word/precompute/route.ts`

**Core AI**
- `src/lib/ai/AIService.ts`
- `src/lib/ai/processors/MultiStepStoryProcessor.ts`
- `src/lib/ai/schemas/story-schemas.ts`

**Admin UI**
- `src/app/[locale]/admin/stories/generate/page.tsx`

---

## Troubleshooting Checklist

1) **Batch failures**
   - Check logs for Firestore validation errors.
   - Inspect `story_word_batches` for failed batches.

2) **Missing word explanations**
   - Check `stories.wordExplanationsStatus`.
   - Ensure Pub/Sub topic exists: `story-word-batch-processing`.

3) **Publish failures**
   - Validate `textWithFurigana` and `translation` presence.
   - Check `ai_validation_errors` collection.

4) **Audio issues**
   - Confirm `MODAL_API_KEY` and VOICEVOX endpoint.
   - Ensure audio endpoint does not overwrite `pages`.

---

## Notes on Docs vs Code

- `content-generation/README.md` references `src/lib/content/story-generator.ts`, but the active implementation is in `src/lib/ai/*` and API routes.
- Word explanations are now generated **post-publish** via Firestore trigger, not inline in the scheduler.

---

**Document End**  
