# Word Explanation Fast Path (Precompute + Instant Modal)

This guide explains the end-to-end setup that makes `WordExplanationModal` respond instantly by precomputing word explanations into Firestore and hydrating the client cache before the first tap.

## Overview
- Surfaces: Article reader, Story reader (page-aware), Book reader, Moshiplayer (video transcripts) — all using `WordExplanationModal`.
- Flow:
  1. Content loads → `useWordExplanation.prefetch` runs with `contentId`, `contentType`, and full text.
  2. Prefetch hydrates from existing Firestore doc, triggers `/api/word/precompute` with the text, and polls briefly for the doc to land.
  3. `WordExplanationModal` taps resolve from: in-memory cache → precompute doc → (top-up retry) → API fallback (last resort).
- Data stored in Firestore collections (public read, server-only writes):
  - `news_article_word_explanations`
  - `book_word_explanations`
  - `story_word_explanations`
  - `video_word_explanations`

## Key Files
- `src/hooks/useWordExplanation.ts`
  - `prefetch` triggers precompute, hydrates cache, logs, and waits for doc readiness.
  - Checks precompute docs on tap; if missing, attempts a top-up precompute before API fallback.
- `src/lib/ai/precompute/wordPrecompute.ts`
  - Tokenizes text (kuromoji), processes missing words in order with small concurrency.
  - Uses `AIService.explainWord` and caches globally.
- `src/app/api/word/precompute/route.ts`
  - API endpoint to run precompute (auth required but called server-side or via fetch on the page).
- `firestore.rules`
  - Public read access for precompute caches; writes blocked to clients.
- Surfaces wiring:
  - Article reader: `src/components/news/EnhancedArticleReaderFinal.tsx` → `prefetchWordExplanations` with article text.
  - Story pages: same file, `prefetchWordExplanations` per page (`contentId: articleId:page-X`, `contentType: story`).
  - Moshiplayer: `src/app/youtube-shadowing/page.tsx` → prefetch after transcript load (`contentType: video`).
  - Book reader: passes `bookId` to `useWordExplanation`; ensure `prefetch` is called with full text.

## Runtime Behavior & Logs
- On load: `PREFETCH START` → `PRECOMPUTE TRIGGER` → `PREFETCH DOC READY` (when doc lands).
- On tap:
  - Hits memory/precompute cache: `SOURCE: FIREBASE PRE-CACHE (fast)`.
  - If missing: `Word not in pre-cache, attempting top-up then API` + `TOP-UP PRECOMPUTE` → `TOP-UP HIT (precompute)` if successful.
  - Only then falls back to `/api/word/explain`.

## Limits & Safeguards
- Precompute text is truncated at ~18k chars to avoid payload rejection (consider chunking for very long content).
- Prefetch polling: ~12 attempts × 200ms; top-up polling: ~15 attempts × 200ms before API fallback.
- Writes are Admin-only; reads are public for these caches.

## How to Verify
1. Open content; check console for `PRECOMPUTE TRIGGER` and `PREFETCH DOC READY`.
2. Tap an early word; expect instant response and no `/api/word/explain` if the doc is ready.
3. If a word is missing, watch for `TOP-UP PRECOMPUTE`/`TOP-UP HIT`; only if those fail will the API be used.

## Known Gaps / Next Steps
- Very long texts: consider chunked precompute instead of truncation to avoid missing tail words.
- If a surface doesn’t pass text into `prefetch`, precompute won’t run; ensure every use of `WordExplanationModal` calls `prefetch` with the full visible text.
- Consider a “no-API fallback” mode for critical flows if precompute must be present before showing the modal.
