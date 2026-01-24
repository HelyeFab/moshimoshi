YOUTUBE SHADOWING: PRECOMPUTE + TRANSLATION ARCHITECTURE
=========================================================

Purpose
-------
Deliver an instant, cache-first experience in the YouTube Shadowing player:
- Word explanation modal should feel instant after transcript loads (precompute + cache).
- English translation toggle should show immediately if translations exist.
- If translations do not exist, generate in background and update UI without page refresh.
- "Work once, reuse many times" across sessions and devices.

Target UX (non-negotiable)
--------------------------
1) Word explanations:
   - On transcript load, precompute word explanations and store them in Firebase.
   - Word modal should read from precomputed cache first and only fall back to API
     when the word truly does not exist in the cache.
2) English translations:
   - Toggle ON: translations appear immediately if they already exist in Firebase.
   - If missing, translations are generated in background and UI refreshes itself.
   - No manual refresh required.

Primary User Flows
------------------
1) Transcript load (YouTube Shadowing)
   - UI loads transcript from /api/youtube/transcript/[videoId].
   - UI immediately triggers word precompute (contentType: "youtube").
   - UI optionally queues translations if user toggles translations on.

2) Word explanation lookup
   - UI tries Firebase precompute document (youtube_word_explanations/{videoId}).
   - If found, return immediately.
   - If missing, falls back to /api/word/explain (and can upsert into cache).

3) Translation toggle
   - If translations exist in transcript cache, UI should show them instantly.
   - If not, UI queues translation generation via /api/youtube/transcript/translate
     and polls status until complete, then refreshes transcript.

Pages / Components Touched
--------------------------
1) src/app/[locale]/youtube-shadowing/page.tsx
   - Fetch transcript from /api/youtube/transcript/[videoId].
   - Prefetch word explanations on transcript load.
   - Translation toggle: queue translation job + poll status + refresh transcript.
   - Uses useWordExplanation with youtubeId.

2) src/hooks/useWordExplanation.ts
   - Unified prefetch logic for youtube content.
   - If precompute is locked/complete, now tries fetch endpoint to hydrate cache.
   - Uses youtube_word_explanations collection for prefetch and lookups.

3) src/hooks/useProgressiveTranscript.ts
   - Removed duplicate precompute trigger to avoid conflicting paths.

APIs (Server)
-------------
1) /api/youtube/transcript/[videoId] (GET)
   - Primary transcript fetch API for YouTube shadowing.
   - Reads from Firebase transcriptCache (contentId = youtube_{videoId}).
   - MUST return translation for each segment if present in cache.

   File: src/app/api/youtube/transcript/[videoId]/route.ts
   Firebase writes:
     - Reads: transcriptCache/{youtube_videoId}
     - Writes: transcriptCache when fetched from external providers.
   Important: response now includes "translation" per segment when present.

2) /api/youtube/transcript/translate (GET/POST)
   - Translate queue + status endpoint for YouTube transcripts.
   - Wrapper around the existing translator logic to avoid 404s.

   File: src/app/api/youtube/transcript/translate/route.ts
   Implementation: re-exports /api/transcript/translate logic.
   Firebase writes:
     - transcriptCache/{youtube_videoId}.transcript[].translation
     - transcriptCache/{youtube_videoId}.metadata.translationStatus / stats

3) /api/transcript/translate (GET/POST) (Legacy)
   - Core translation generation and status logic.
   - Still used by the wrapper above, but UI calls the new youtube path.

   File: src/app/api/transcript/translate/route.ts

4) /api/word/precompute (POST)
   - Precompute word explanations into content-specific collection.
   - For youtube: fetches transcript text from transcriptCache and precomputes words.
   - Uses a Firestore lock to avoid duplicate precompute jobs.

   File: src/app/api/word/precompute/route.ts
   Firebase writes:
     - youtube_word_explanations/{videoId}
       - words[], wordCount, precomputeStatus, precomputeVersion, etc.

5) /api/word/precompute/fetch (GET)
   - Reads precompute document (admin path).
   - Used as fallback if precompute is locked.

   File: src/app/api/word/precompute/fetch/route.ts
   Firebase reads:
     - youtube_word_explanations/{videoId}

6) /api/word/explain (POST)
   - Fallback for words not found in cache.
   - Can upsert the word explanation into youtube_word_explanations.

   File: src/app/api/word/explain/route.ts
   Firebase writes:
     - youtube_word_explanations/{videoId} (append words)
     - wordExplanationCache (global cache)

AI / Processing Layers
----------------------
1) Word Precompute
   File: src/lib/ai/precompute/wordPrecompute.ts
   - Tokenizes transcript, generates AI explanations, adds surfaceForms.
   - Caches to youtube_word_explanations/{videoId}.
   - Generates audio (TTS) when available.

2) Transcript Translation Generator
   File: src/lib/ai/utils/transcriptTranslationGenerator.ts
   - Uses Ollama (Qwen 2.5 32B) when healthy; falls back to OpenAI.
   - Saves translations into transcriptCache transcript[].

Firebase Collections (YouTube Shadowing)
----------------------------------------
1) transcriptCache (collection)
   Doc ID: youtube_{videoId}
   Fields:
     - transcript[]: { id, text, startTime, endTime, translation? }
     - formattedTranscript[] (optional)
     - metadata.translationStatus, translationProvider, stats, etc.

2) youtube_word_explanations (collection)
   Doc ID: {videoId}
   Fields:
     - words[] (WordExplanation)
     - precomputeStatus: generating|complete|failed
     - precomputeVersion
     - precomputeOptions

3) wordExplanationCache (collection)
   Global cache for word explanations across content.

4) translations + translation_cache (collections)
   Used by TranslationProcessor for sentence/word context translation.

5) Firebase Storage
   - TTS audio outputs stored for precomputed word audio.

Key Technical Behaviors
-----------------------
1) Word precompute locking
   - /api/word/precompute uses a lock (precomputeStatus: generating).
   - If a lock is active, server responds: { success: true, skipped: "locked" }.
   - Client prefetch should hydrate from /api/word/precompute/fetch on lock.

2) Translation readiness
   - /api/youtube/transcript/[videoId] must return translation per segment if present.
   - UI should refetch transcript after translation completes.

3) Cache hydration in UI
   - useWordExplanation.prefetch hydrates cache from youtube_word_explanations.
   - Word modal should hit Firebase cache first, then /api/word/explain only if needed.

Known Troubleshooting Checklist
-------------------------------
1) Word modal still hits /api/word/explain:
   - Check /api/word/precompute response:
     - locked: use /api/word/precompute/fetch to hydrate.
     - not found: precompute doc missing; check lock or Firebase Admin.

2) Translation toggle shows nothing:
   - Check /api/youtube/transcript/translate status (GET):
     - complete: translations exist in transcriptCache.
   - Check /api/youtube/transcript/[videoId] response:
     - Does segments[].translation exist?
       If not, the API is not returning cached translations.

3) Translation status returns complete but UI still shows none:
   - Ensure /api/youtube/transcript/[videoId] includes translation fields.
   - Ensure UI refreshes transcript after status completes.

Files Changed in This Iteration
-------------------------------
- src/app/[locale]/youtube-shadowing/page.tsx
- src/hooks/useWordExplanation.ts
- src/hooks/useProgressiveTranscript.ts
- src/app/api/word/precompute/route.ts
- src/app/api/word/precompute/fetch/route.ts (used by prefetch)
- src/app/api/youtube/transcript/[videoId]/route.ts
- src/app/api/youtube/transcript/translate/route.ts (new wrapper)
- src/lib/ai/precompute/wordPrecompute.ts (+ compiled js)
- src/lib/ai/cache/WordExplanationCache.ts
- src/lib/firebase/collections/translations.ts

Operational Notes
-----------------
- Translation generation can take 30–120s depending on transcript size.
- Word precompute can be blocked by a stale lock; prefer fetch fallback.
- Logs are server-side; browser console only shows fetch status.

Developer Onboarding Quickstart
-------------------------------
1) Load a YouTube URL in /youtube-shadowing.
2) Verify transcript is loaded from /api/youtube/transcript/[videoId].
3) Check word precompute:
   - POST /api/word/precompute { contentType: "youtube", fetchContent: true }
   - GET /api/word/precompute/fetch?contentType=youtube&contentId={videoId}
4) Toggle Translation:
   - POST /api/youtube/transcript/translate
  - GET /api/youtube/transcript/translate?status=true
  - Refresh transcript to see translations.

Known Gaps / Not Yet Implemented
--------------------------------
1) Immediate translation display on toggle (zero-delay)
   - Current behavior: translations appear after background generation completes
     and the transcript is re-fetched.
   - Desired: if translations exist already, UI should refetch immediately when
     toggled ON (before queueing a job) to avoid any lag.

2) Stale precompute lock recovery
   - Precompute can return { skipped: "locked" } while the precompute document
     does not exist (found: false). This blocks cache hydration indefinitely.
   - Desired: server should break stale locks automatically (age-based) or
     allow a recovery precompute if no doc exists.

3) Word explanation cache persistence gap
   - Some logs show "Firebase Admin not initialized - cannot cache explanation"
     from WordExplanationCache, which prevents caching in Firestore.
   - Desired: ensure Admin SDK is always initialized for server routes and
     remove any remaining null-path cache calls.

4) Translation endpoint stability
   - /api/youtube/transcript/translate was added as a wrapper, but the legacy
     /api/transcript/translate must remain available and stable in dev/prod.
   - Desired: confirm routing + middleware never 404s these endpoints.

5) Missing visibility into precompute status in UI
   - No user-facing status indicator if precompute is running or locked.
   - Desired: lightweight status/telemetry to avoid confusion when words
     still hit /api/word/explain while precompute is in progress.
