# Book Generation Deepdive (Admin Flow + Word Precompute)

**Status:** ACTIVE  
**Last Updated:** 2026-02-01  
**Audience:** Senior/Owner-level engineering  
**Scope:** Book generation via admin dashboard, publishing, and word precompute pipeline.

---

## Executive Summary

Books are generated **manually** via the admin dashboard. There is **no scheduled function** for book generation.  
The admin flow initializes a draft, runs a multi-step generation pipeline (summary, translation, cover, audio, word precompute, sentence precompute), then publishes the draft to `books/`.

Word explanations are computed in two ways:

1) **Post-publish Firestore trigger** (`onBookPublished`) that builds a Pub/Sub batch queue.  
2) **On-demand precompute request** (`/api/word/precompute/book`) which triggers a Firestore request and the same batch processor.

---

## High-Level Flow

```
Admin UI (Generate Book)
  └─ /api/admin/books/init-draft  -> book_drafts/{draftId}
  └─ /api/admin/books/generate    -> generation pipeline
  └─ /api/admin/books/publish-draft -> books/{bookId}
          |
          v
onBookPublished (Firestore trigger)
  └─ extractWords -> book_word_batches queue
  └─ publish Pub/Sub batch message
          |
          v
processBookWordBatch (Pub/Sub)
  └─ generate explanations -> book_word_explanations
  └─ update books.metadata.wordProgress
```

---

## Admin UI Flow

**UI:** `src/app/[locale]/admin/books/generate/page.tsx`

### Steps

1) Optional cover upload  
2) Create draft via `/api/admin/books/init-draft` (returns draft ID immediately)  
3) Start generation via `/api/admin/books/generate`  
4) Auto-publish via `/api/admin/books/publish-draft`  

### Realtime Progress

The UI subscribes to:

```
book_drafts/{draftId}
```

and renders `metadata.generationStep` + `metadata.progress`.

---

## Draft Initialization

**Endpoint:** `src/app/api/admin/books/init-draft/route.ts`

Creates:
```
book_drafts/{draftId}
```

Fields:
- `status: "draft"`
- `metadata.generationStep: "content"`
- `metadata.progress: 0`
- `metadata.generateCover` and `metadata.additionalContext`

---

## Generation Pipeline

**Endpoint:** `src/app/api/admin/books/generate/route.ts`

### Step 1: Summary Generation
Uses `bookSummaryProcessor` (`BookSummaryProcessor`) with GPT‑4o‑mini.  
Validates `title`, `titleJa`, `content`, `summary`. If translation is missing, it creates a separate translation via OpenAI chat completion.

### Step 2: Cover Generation (Optional)
If `generateCover` is true and no cover was uploaded:
- Uses DALL‑E 3 via `ImageProcessor`
- Uploads to Firebase Storage (`books/covers/...`)
- Saves `coverImageUrl`

### Step 3: TTS Audio Pre‑cache
Calls:
```
/api/tts/synthesize
```
Stores:
- `audioUrl`
- `metadata.audioStatus`, `metadata.audioProvider`

### Step 4: Word Explanations Precompute (Inline)
Uses `precomputeWordExplanations` with:
- `contentType: 'book'`
- `limit: 1000`
- updates `metadata.wordProgress` as it runs

### Step 5: Sentence Precompute
Uses `preGenerateBookSentences` from `src/lib/ai/utils/sentencePreGenerator.ts`
- Generates per‑sentence audio via `/api/tts/generate-sentence`
- Generates translations via `/api/translate`
- Stores in `book_sentence_data/{bookId}`

### Finalize Draft
Sets:
- `status: 'draft'`
- `metadata.generationStep: 'complete'`
- `metadata.progress: 100`

---

## Publishing

**Endpoint:** `src/app/api/admin/books/publish-draft/route.ts`

Validates required fields:
- `title`, `titleJa`, `content`, `summary`, `bookName`, `jlptLevel`

Writes:
```
books/{bookId}  // bookId == draftId
```

Copies:
- Optional `author`, `translation`, `coverImageUrl`, `audioUrl`, `category`

---

## Word Precompute: Post-Publish Trigger

**Function:** `onBookPublished`  
**File:** `functions/src/scheduled/bookWordScheduler.ts`

Trigger: `books/{bookId}` created with `status: 'published'`

Flow:
1) Skip if word explanations already exist.  
2) Extract words (`extractWords`) with:
   - `limit: 1000`
   - `includeParticles: true`
   - `minLength: 1`
3) Create batch queue in `book_word_batches`.  
4) Publish first Pub/Sub batch (`book-word-batch-processing`).  
5) Update `books.metadata.wordProgress`.

---

## Word Precompute: On-Demand Request

**Endpoint:** `src/app/api/word/precompute/book/route.ts`

Behavior:
- Uses `book_word_explanations/{bookId}` as a lock.
- If unlocked, creates a request in:
  ```
  book_word_precompute_requests
  ```

**Function:** `onBookPrecomputeRequested`  
**File:** `functions/src/scheduled/bookWordScheduler.ts`

Consumes the request, then:
- Extracts words
- Creates batch queue
- Publishes first batch
- Writes `precomputeStatus: 'generating'` into `book_word_explanations`

---

## Batch Processing

**Function:** `processBookWordBatch`  
**File:** `functions/src/scheduled/bookWordBatchProcessor.ts`

Behavior:
- Generates explanations using `generateWordExplanation` (Qwen via Modal).
- Uses `wordExplanationCache` to avoid recomputation.
- Writes/merges into `book_word_explanations`.
- Updates progress in `books.metadata.wordProgress`.
- Publishes next batch until complete.

---

## Batch Manager

**File:** `functions/src/utils/bookWordBatchManager.ts`

Key details:
- Fixed `BATCH_SIZE = 10`
- Stores queue in `book_word_batches`
- Tracks status/attempts

---

## Sentence Precompute

**File:** `src/lib/ai/utils/sentencePreGenerator.ts`

`preGenerateBookSentences()`:
- Splits sentences on `。`
- Generates audio via `/api/tts/generate-sentence`
- Generates translations via `/api/translate`
- Stores:
  ```
  book_sentence_data/{bookId}
  ```

---

## Collections (Book Flow)

```
book_drafts/
books/
book_word_batches/
book_word_explanations/
book_word_precompute_requests/
book_sentence_data/
```

---

## Key Files

- `src/app/[locale]/admin/books/generate/page.tsx`
- `src/app/api/admin/books/init-draft/route.ts`
- `src/app/api/admin/books/generate/route.ts`
- `src/app/api/admin/books/publish-draft/route.ts`
- `functions/src/scheduled/bookWordScheduler.ts`
- `functions/src/scheduled/bookWordBatchProcessor.ts`
- `functions/src/utils/bookWordBatchManager.ts`
- `src/app/api/word/precompute/book/route.ts`
- `src/lib/ai/utils/sentencePreGenerator.ts`

---

## Operational Notes

### No Scheduled Generation
Books are **only** generated via admin UI and API. There is no scheduled story‑style generator.

### Logs
```
gcloud functions logs read processBookWordBatch --project moshimoshi-de237 --gen2 --limit 200
```

### Common Failure Modes
- Missing required fields in draft → publish blocked.
- Large word precompute jobs → batch failure (check `book_word_batches`).
- TTS failures → logged in `metadata.audioError`.

---

**Document End**
