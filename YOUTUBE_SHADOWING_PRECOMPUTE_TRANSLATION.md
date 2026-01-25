YOUTUBE SHADOWING: PRECOMPUTE + TRANSLATION ARCHITECTURE (ONBOARDING)
=====================================================================

Purpose
-------
This document is the production-ready onboarding guide for the YouTube Shadowing
feature. It includes all code paths, debug tooling, Firebase collections, scripts,
and known issues encountered so far. A TypeScript developer should be able to
stand up, diagnose, and extend the feature using only this doc.

High-Level Goals
----------------
1) Word explanations must feel instant after transcript loads.
2) Translations should show immediately if cached; otherwise generate in background
   and update the UI without refresh.
3) Cache-first, "work once, reuse many times" across devices/sessions.

Key Feature Flow (TL;DR)
------------------------
1) UI loads transcript from /api/youtube/transcript/[videoId].
2) UI triggers word precompute (priority + background batches).
3) UI auto-triggers transcript translation on load.
4) Word modal reads from precompute cache first, falls back to /api/word/explain.
5) Translation polling refreshes transcript when complete.

Pages / Components / Hooks
--------------------------
1) src/app/[locale]/youtube-shadowing/page.tsx
   - Entry point for YouTube Shadowing.
   - Fetches transcript via /api/youtube/transcript/[videoId].
   - Auto-translation on load (showTranslation = true).
   - Triggers word precompute (priority + background).
   - Translation toggle/polling.
   - **Added**: auto-precompute on cached session restore.

2) src/hooks/useWordExplanation.ts
   - Single source of truth for word explanation prefetch + lookup.
   - Prefetch logic:
     - Loads precompute doc from Firebase (youtube_word_explanations).
     - If missing/outdated, sends /api/word/precompute POST in chunks.
     - Background chunks allowed even while a lock is active.
   - Explain flow:
     - Memory cache → Firebase precompute doc → /api/word/explain fallback.
   - **Debug mode**: temporary chunk size can be lowered for visibility.

3) src/hooks/useProgressiveTranscript.ts
   - Alternative transcript loader used in some pages.
   - Word precompute handled elsewhere; no duplicate trigger.

API Routes (Server)
-------------------
1) /api/youtube/transcript/[videoId] (GET)
   File: src/app/api/youtube/transcript/[videoId]/route.ts
   - Cache-first via transcriptCache.get.
   - Returns segments with translation if present.
   - Falls back to Railway → Sheldon → YouTubei → Supa.

2) /api/youtube/transcript/translate (GET/POST)
   File: src/app/api/youtube/transcript/translate/route.ts
   - Wrapper around /api/transcript/translate.

3) /api/transcript/translate (GET/POST)
   File: src/app/api/transcript/translate/route.ts
   - Queues translation generation, or returns status.
   - Uses transcriptTranslationGenerator (Ollama → OpenAI fallback).

4) /api/word/precompute (POST)
   File: src/app/api/word/precompute/route.ts
   - Precompute word explanations by contentType.
   - Uses Firestore lock; supports background= true.
   - For youtube: reads transcript via transcriptCache (can load from Storage).
   - Updates precompute status and chunk progress in doc.

5) /api/word/precompute/fetch (GET)
   File: src/app/api/word/precompute/fetch/route.ts
   - Reads precompute doc via Admin SDK.
   - Accepts full YouTube URL; extracts videoId.
   - Used by debug page for polling.

6) /api/word/explain (POST)
   File: src/app/api/word/explain/route.ts
   - AI fallback for missing words.
   - Upserts into youtube_word_explanations.
   - Skips quota if content lookup header present.

AI / Processing Layers
----------------------
1) Word Precompute
   File: src/lib/ai/precompute/wordPrecompute.ts
   - Tokenization (kuromoji), AI explanations, conjugations, TTS.
   - Writes results to youtube_word_explanations (doc per videoId).

2) Transcript Translation
   File: src/lib/ai/utils/transcriptTranslationGenerator.ts
   - Primary: Ollama (Qwen 2.5 32B), fallback OpenAI.
   - Writes translations back into transcriptCache.
   - **Updated** to use transcriptCache.updateTranscriptWithMetadata to support
     large transcripts stored in Storage.

Firebase Collections
--------------------
1) transcriptCache (collection)
   - Doc ID: youtube_{videoId}
   - Stores transcript and metadata.
   - May store transcriptStoragePath (pointer to Storage JSON).

2) youtube_word_explanations (collection)
   - Doc ID: {videoId}
   - Fields:
     - words[] (WordExplanation)
     - precomputeStatus (generating|complete|failed)
     - precomputeVersion, precomputeOptions
     - precomputeChunkTotal, precomputeChunkIndex, precomputeChunkCompleted

3) wordExplanationCache (collection)
   - Global word explanation cache (cross-content reuse).

4) translations + translation_cache (collections)
   - Used by TranslationProcessor caching.
   - Note: cache can be disabled if Admin init fails (guarded).

5) Firebase Storage (bucket)
   - Path: transcriptCache/{contentId}.json
   - Used when transcript doc exceeds Firestore 1MB limit.
   - Stored JSON: { transcript, formattedTranscript? }

Debug / QA Tools
----------------
1) Debug Page
   Path: /[locale]/debug/precompute
   File: src/app/[locale]/debug/precompute/page.tsx
   - Polls /api/word/precompute/fetch.
   - Shows chunk progress, word count, status.
   - **Force Precompute** button triggers /api/word/precompute (background).

2) Script: check-youtube-transcript
   File: scripts/check-youtube-transcript.js
   Usage:
     node scripts/check-youtube-transcript.js <videoId>
     node scripts/check-youtube-transcript.js <videoId> --read-storage
   - Shows transcriptCache doc + youtube_word_explanations.
   - Optional: downloads Storage JSON and prints size/segment counts.

3) Script: delete-youtube-transcript
   File: scripts/delete-youtube-transcript.js
   - DANGEROUS: deletes transcriptCache + youtube_word_explanations.
   - Use --dry-run to preview.
   - Only use when explicitly requested.

4) Other helpful scripts
   - scripts/checkStoryPrecompute.ts (story precompute)
   - scripts/check-youtube-usage.js (usage tracking)
   - scripts/backfill-youtube-translations.js (batch translations)

Operational Notes & Known Issues
--------------------------------
1) Precompute not triggering
   - Root cause: precompute was only triggered on loadTranscript; cached session
     restore did not trigger precompute.
   - Fix: auto-precompute useEffect added in page.tsx.
   - Debug: check Network for POST /api/word/precompute.

2) Only 1 chunk in precompute
   - Chunking is by character count, not duration.
   - Short transcripts legitimately yield 1 chunk.
   - Debug: check transcript text length via script or Firebase.

3) Firestore 1MB transcript error
   - Observed: “document size exceeds 1,048,576 bytes”.
   - Fix: transcriptCache now stores oversized transcripts in Storage and
     writes only a pointer in Firestore.

4) Translation cache undefined errors
   - Root cause: translationCache could be undefined in runtime.
   - Fix: guards in TranslationProcessor + API route and compiled JS.

5) Background precompute batching blocked
   - Root cause: lock prevented background chunks.
   - Fix: allow background batches while lock active; update chunk index while locked.

How It Works End-to-End (Detailed)
----------------------------------
1) Transcript fetch
   UI calls /api/youtube/transcript/[videoId]
   - If cached, transcriptCache.get returns doc or loads from Storage pointer.
   - API returns segments with translation fields if present.

2) Word precompute
   Triggered from page.tsx via useWordExplanation.prefetch:
   - Priority text (first 3 segments) → chunkIndex 0.
   - Remaining text → background precompute chunks.
   - Each chunk: POST /api/word/precompute { contentId, contentType, text, chunkIndex, totalChunks, background }.
   - Server locks per content doc and writes progress fields.

3) Translation generation
   On load, UI sets showTranslation=true → queues /api/youtube/transcript/translate.
   - Translation generator saves translations into transcriptCache via updateTranscriptWithMetadata.
   - UI polls status and refetches transcript.

How to Debug (Checklist)
------------------------
1) Confirm transcript exists
   node scripts/check-youtube-transcript.js <videoId>

2) Confirm precompute requests are sent
   - Network: POST /api/word/precompute
   - Browser console: [WordExplanation] PRECOMPUTE TRIGGER

3) Confirm precompute doc exists
   - /debug/precompute page
   - Firebase doc: youtube_word_explanations/{videoId}

4) Confirm translations are saving
   - transcriptCache doc has transcript[].translation
   - script shows Has translations: Yes

5) Confirm Storage pointer used for large transcripts
   - transcriptCache doc has transcriptStoragePath
   - scripts/check-youtube-transcript.js --read-storage

How to Verify in Firebase (Quick Checks)
---------------------------------------
Use Firebase Console → Firestore and Storage to confirm what the app saved.

Firestore: transcriptCache
1) Open collection: transcriptCache
2) Find doc: youtube_{videoId}
3) Check fields:
   - transcript.length (should be 0 if pointer is used)
   - transcriptStoragePath (present if offloaded to Storage)
   - language, hasFormatted, updatedAt
4) If translations are generated:
   - transcript entries include translation fields (if stored inline)
   - OR transcriptStoragePath exists and storage JSON contains translations

Firestore: youtube_word_explanations
1) Open collection: youtube_word_explanations
2) Find doc: {videoId}
3) Check fields:
   - precomputeStatus (generating|complete|failed)
   - precomputeChunkTotal / precomputeChunkCompleted
   - precomputeChunkIndex / precomputeChunkLastCompletedIndex
   - words.length (should increase as precompute runs)

Firestore: translation_cache / translations (optional)
1) translation_cache (if enabled):
   - ensure write/read is occurring (docs keyed by hash)
2) translations:
   - verify per-content translations exist for reuse

Storage: transcript JSON (pointer flow)
1) Open Storage bucket
2) Navigate to: transcriptCache/{contentId}.json
3) Download/preview JSON:
   - confirm transcript array length
   - confirm translation fields on segments
   - file size should be > 1MB for large transcripts

Tip: If the Firestore transcript doc is huge (>1MB), it should NOT be stored
inline. You should see transcriptStoragePath and storage JSON present instead.

Key Files (Index)
-----------------
Frontend:
  - src/app/[locale]/youtube-shadowing/page.tsx
  - src/hooks/useWordExplanation.ts
  - src/hooks/useProgressiveTranscript.ts
  - src/app/[locale]/debug/precompute/page.tsx

API:
  - src/app/api/youtube/transcript/[videoId]/route.ts
  - src/app/api/youtube/transcript/translate/route.ts
  - src/app/api/transcript/translate/route.ts
  - src/app/api/word/precompute/route.ts
  - src/app/api/word/precompute/fetch/route.ts
  - src/app/api/word/explain/route.ts

Core Services:
  - src/lib/transcript/cache.ts
  - src/lib/ai/precompute/wordPrecompute.ts
  - src/lib/ai/utils/transcriptTranslationGenerator.ts
  - src/lib/ai/processors/TranslationProcessor.ts (+ .js)
  - src/lib/firebase/collections/translations.ts

Debug Scripts:
  - scripts/check-youtube-transcript.js
  - scripts/delete-youtube-transcript.js
  - scripts/backfill-youtube-translations.js

Current Dev Settings (Temporary)
--------------------------------
- PREFETCH_CHUNK_SIZE temporarily set to 100 in:
  src/hooks/useWordExplanation.ts
  This is for visual debug. Revert after debugging.

Deployment / Rules
------------------
No new Firebase rules required for Storage pointer approach because Admin SDK
reads/writes the Storage objects server-side. If you later allow client-side
access to transcript JSON, you must update storage.rules accordingly.

Next Improvements (Recommended)
-------------------------------
1) Add UI indicator for precompute status on /youtube-shadowing.
2) Add automatic stale-lock recovery on /api/word/precompute.
3) Consider sharding youtube_word_explanations if doc size grows large.
4) Formalize background job queue for precompute (Cloud Tasks/BullMQ).

Contacts / Ownership
--------------------
If you are onboarding, start by reading the files in "Key Files (Index)", then
use /debug/precompute + scripts/check-youtube-transcript.js to validate your
environment end-to-end.
