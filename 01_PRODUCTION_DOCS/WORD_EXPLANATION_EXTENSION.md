# Extending WordExplanationModal to a New Surface/Content Type

This checklist shows how to add the fast-path word details modal (prefetch + cache + audio + context) to any new feature. It assumes you want near-instant taps by precomputing word explanations into Firestore and hydrating the client cache before the user taps.

## Core pieces already in place
- Modal component: `src/components/word/WordExplanationModal.tsx` (renders precomputed audio, context sentence/translation, related tabs, etc.).
- Hook: `src/hooks/useWordExplanation.ts` (in-memory cache, Firestore precompute lookup, chunked prefetch → `/api/word/precompute`, top-up recheck before `/api/word/explain`).
- Precompute pipeline: `src/lib/ai/precompute/wordPrecompute.ts` (tokenizes, generates explanations, full conjugations, context sentence + translation, VOICEVOX audio).
- API endpoints: `/api/word/precompute` (kicks off precompute) and `/api/word/explain` (fallback with entitlements).
- Firestore collections: `news_article_word_explanations`, `book_word_explanations`, `story_word_explanations`, `video_word_explanations`, `comic_word_explanations` (reads public, writes admin).

## Steps to add a new surface (existing content types)
1) **Wire the hook** in your page/component:
   ```ts
   const {
     explainWord, loading, error, explanation,
     reset, prefetch,
   } = useWordExplanation({ articleId | bookId | videoId | comicId });
   ```
2) **Prefetch on load** with full visible text:
   ```ts
   useEffect(() => {
     if (!text) return;
     prefetch({ contentId: id, contentType: 'article' | 'book' | 'story' | 'video' | 'comic', text });
   }, [id, text, prefetch]);
   ```
   - If text is paginated/segmented, call `prefetch` per segment/page as it becomes available.
3) **Handle taps** to open the modal:
   ```ts
   const handleWordTap = async (word: string, context?: string) => {
     setSelectedWord(word.trim());
     setContext(context);
     setModalOpen(true);
     await explainWord(word, context);
   };
   ```
4) **Render the modal**:
   ```tsx
   <WordExplanationModal
     isOpen={modalOpen}
     onClose={handleClose}
     word={selectedWord}
     explanation={explanation}
     loading={loading}
     error={error}
     translationContext={context ? { sentence: context } : undefined}
     onWordLookup={(w) => handleWordTap(w, context)}
   />
   ```

## Adding a brand-new content type (e.g., “podcast”)
1) **Precompute content type support**:
   - Add the type and collection to `COLLECTION_MAP` in `src/lib/ai/precompute/wordPrecompute.ts`.
   - Update the TypeScript union for `contentType` in `useWordExplanation.prefetch` and precompute API validation (if any).
   - Create the Firestore collection (e.g., `podcast_word_explanations`). Reads should be public; writes admin-only.
2) **Hook options**:
   - Add an optional id prop (e.g., `podcastId?: string`) in `useWordExplanation` so the hook knows which collection to read.
3) **Surface wiring**:
   - Call `prefetch({ contentId: podcastId, contentType: 'podcast', text })` when the transcript/visible text is ready.
   - Hook up tap handling and modal render as shown above.

## Data the modal can use (produced during precompute)
- `audioUrl` (VOICEVOX-backed, preferred over client TTS).
- `contextSentence` + `contextTranslation` (first sentence containing the word).
- Full conjugations for verbs/adjectives (if detected).
- Kanji breakdown, related words, usage notes, examples (from the AI response).

## Best practices
- Always pass full visible text into `prefetch` (chunking is automatic, so long content won’t be truncated).
- If content streams by page/segment, prefetch per page as the user lands on it to avoid latency on tap.
- Use `onWordLookup` in the modal to support “related words” clicks.
- If your feature already has per-sentence audio/translations, include those sentences in the `text` you prefetch to maximize cache hits.

## Firestore/Storage notes
- Reads from the precompute collections are allowed by rules; writes are server-side only.
- TTS audio files are stored under `tts/voicevox/...` via `ttsService`; no extra Storage rules are required if bucket defaults match the existing TTS cache. If you introduce a new path, ensure public read or serve via signed URLs.
