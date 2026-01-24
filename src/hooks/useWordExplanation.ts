'use client';

import { useState, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/client';
import type { WordExplanation } from '@/lib/ai/types';

interface WordExplanationResponse {
  success: boolean;
  explanation?: WordExplanation;
  cached?: boolean;
  error?: string;
  decision?: {
    allow: boolean;
    reason?: string;
    limit?: number;
    remaining?: number;
  };
}

interface UseWordExplanationOptions {
  onError?: (error: string) => void;
  onSuccess?: (explanation: WordExplanation) => void;
  articleId?: string; // Optional: if provided, will check Firebase pre-cached explanations first
  bookId?: string; // Optional: if provided, will check book_word_explanations collection
  storyId?: string; // Optional: if provided, will check story_word_explanations collection
  youtubeId?: string; // Optional: if provided, will check youtube_word_explanations collection
  videoId?: string; // Optional: if provided, will check video_word_explanations collection
  comicId?: string; // Optional: if provided, will check comic_word_explanations collection
  flashcardId?: string; // Optional: if provided, will check flashcard_word_explanations collection
}

const MAX_PREFETCH_CHARS = 48000;
// Temporary: smaller chunk size for debugging background batching visibility.
const PREFETCH_CHUNK_SIZE = 100;
const PRECOMPUTE_VERSION = 'v2_all_tokens';

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

export function useWordExplanation(options?: UseWordExplanationOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<WordExplanation | null>(null);
  const [currentWord, setCurrentWord] = useState<string | null>(null);

  // Component-level memory cache
  const cacheRef = useRef<Map<string, WordExplanation>>(new Map());
  const lastPrefetchRef = useRef<{
    contentId: string;
    contentType: 'article' | 'book' | 'story' | 'youtube' | 'video' | 'comic' | 'flashcard';
    text: string;
  } | null>(null);
  const repairTriggeredRef = useRef<Set<string>>(new Set());

  const normalizeWord = useCallback((value: string | undefined | null) => {
    if (!value) return '';
    let normalized = value.trim();
    try {
      normalized = normalized.normalize('NFKC');
    } catch {
      // ignore if normalize not supported
    }
    normalized = normalized
      .replace(
        /^[\s「」『』（）()［］【】〈〉《》〔〕｛｝、。・！!？\?"'’”‘\-—–〜~…]+|[\s「」『』（）()［］【】〈〉《》〔〕｛｝、。・！!？\?"'’”‘\-—–〜~…]+$/g,
        ''
      )
      .trim();
    return normalized.toLowerCase();
  }, []);

  const cacheExplanation = useCallback((explanation: WordExplanation) => {
    const keys = new Set<string>();
    const pushKey = (v?: string) => {
      const key = normalizeWord(v);
      if (key) keys.add(key);
    };
    pushKey(explanation.word);
    pushKey(explanation.reading);
    if (Array.isArray((explanation as any).surfaceForms)) {
      for (const sf of (explanation as any).surfaceForms) pushKey(sf);
    }
    for (const key of keys) {
      cacheRef.current.set(key, explanation);
    }
  }, [normalizeWord]);

  const explainWord = useCallback(async (word: string, context?: string) => {
    try {
      setLoading(true);
      setError(null);
      setCurrentWord(word);

      // Check component-level cache first
      const cacheKey = normalizeWord(word);
      if (!cacheKey) {
        setLoading(false);
        setError('Invalid word');
        return null;
      }
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        console.log('%c[WordExplanation] SOURCE: MEMORY CACHE (instant)', 'color: #00ff00; font-weight: bold', { word });
        setExplanation(cached);
        setLoading(false);
        options?.onSuccess?.(cached);
        return cached;
      }

      // If articleId is provided, check Firebase pre-cached explanations first
      if (options?.articleId) {
        try {
          console.log('[WordExplanation] Checking Firebase pre-cache for articleId:', options.articleId);
          const docRef = doc(firestore, 'news_article_word_explanations', options.articleId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const words = data.words as WordExplanation[];

            // Find the word in pre-cached explanations
            const normalized = normalizeWord(word);
            const preCached = words?.find(w => {
              const surfaceForms = (w as any).surfaceForms as string[] | undefined;
              return (
                normalizeWord(w.word) === normalized ||
                normalizeWord(w.reading) === normalized ||
                (surfaceForms || []).some(sf => normalizeWord(sf) === normalized)
              );
            });

            if (preCached) {
              console.log('%c[WordExplanation] SOURCE: FIREBASE PRE-CACHE (fast)', 'color: #ff9900; font-weight: bold', { word, articleId: options.articleId });
              cacheExplanation(preCached);
              setExplanation(preCached);
              setLoading(false);
              options?.onSuccess?.(preCached);
              return preCached;
            }
          } else {
            console.log('[WordExplanation] No pre-cache document found for article');
          }
        } catch (firebaseError) {
          console.warn('[WordExplanation] Firebase pre-cache check failed, falling back to API:', firebaseError);
          // Continue to API fallback
        }
      }

      // If bookId is provided, check book_word_explanations collection
      if (options?.bookId) {
        try {
          console.log('[WordExplanation] Checking Firebase pre-cache for bookId:', options.bookId);
          const docRef = doc(firestore, 'book_word_explanations', options.bookId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const words = data.words as WordExplanation[];

            // Find the word in pre-cached explanations
            const normalized = normalizeWord(word);
            const preCached = words?.find(w => {
              const surfaceForms = (w as any).surfaceForms as string[] | undefined;
              return (
                normalizeWord(w.word) === normalized ||
                normalizeWord(w.reading) === normalized ||
                (surfaceForms || []).some(sf => normalizeWord(sf) === normalized)
              );
            });

            if (preCached) {
              console.log('%c[WordExplanation] SOURCE: BOOK PRE-CACHE (fast)', 'color: #9900ff; font-weight: bold', { word, bookId: options.bookId });
              cacheExplanation(preCached);
              setExplanation(preCached);
              setLoading(false);
              options?.onSuccess?.(preCached);
              return preCached;
            }
          } else {
            console.log('[WordExplanation] No pre-cache document found for book');
          }
        } catch (firebaseError) {
          console.warn('[WordExplanation] Book pre-cache check failed, falling back to API:', firebaseError);
          // Continue to API fallback
        }
      }

      // If youtubeId is provided, check youtube_word_explanations collection
      if (options?.youtubeId) {
        try {
          console.log('[WordExplanation] Checking Firebase pre-cache for youtubeId:', options.youtubeId);
          const docRef = doc(firestore, 'youtube_word_explanations', options.youtubeId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const words = data.words as WordExplanation[];

            // Find the word in pre-cached explanations
            const normalized = normalizeWord(word);
            const preCached = words?.find(w => {
              const surfaceForms = (w as any).surfaceForms as string[] | undefined;
              return (
                normalizeWord(w.word) === normalized ||
                normalizeWord(w.reading) === normalized ||
                (surfaceForms || []).some(sf => normalizeWord(sf) === normalized)
              );
            });

            if (preCached) {
              console.log('%c[WordExplanation] SOURCE: YOUTUBE PRE-CACHE (fast)', 'color: #00ccff; font-weight: bold', { word, youtubeId: options.youtubeId });
              cacheExplanation(preCached);
              setExplanation(preCached);
              setLoading(false);
              options?.onSuccess?.(preCached);
              return preCached;
            }
          } else {
            console.log('[WordExplanation] No pre-cache document found for youtube');
          }
        } catch (firebaseError) {
          console.warn('[WordExplanation] YouTube pre-cache check failed, falling back to API:', firebaseError);
          // Continue to API fallback
        }
      }

      // If videoId is provided, check video_word_explanations collection
      if (options?.videoId) {
        try {
          console.log('[WordExplanation] Checking Firebase pre-cache for videoId:', options.videoId);
          const docRef = doc(firestore, 'video_word_explanations', options.videoId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const words = data.words as WordExplanation[];

            // Find the word in pre-cached explanations
            const normalized = normalizeWord(word);
            const preCached = words?.find(w => {
              const surfaceForms = (w as any).surfaceForms as string[] | undefined;
              return (
                normalizeWord(w.word) === normalized ||
                normalizeWord(w.reading) === normalized ||
                (surfaceForms || []).some(sf => normalizeWord(sf) === normalized)
              );
            });

            if (preCached) {
              console.log('%c[WordExplanation] SOURCE: VIDEO PRE-CACHE (fast)', 'color: #00ccff; font-weight: bold', { word, videoId: options.videoId });
              cacheExplanation(preCached);
              setExplanation(preCached);
              setLoading(false);
              options?.onSuccess?.(preCached);
              return preCached;
            }
          } else {
            console.log('[WordExplanation] No pre-cache document found for video');
          }
        } catch (firebaseError) {
          console.warn('[WordExplanation] Video pre-cache check failed, falling back to API:', firebaseError);
          // Continue to API fallback
        }
      }

      // If storyId is provided, check story_word_explanations collection
      if (options?.storyId) {
        try {
          console.log('[WordExplanation] Checking Firebase pre-cache for storyId:', options.storyId);
          const docRef = doc(firestore, 'story_word_explanations', options.storyId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const words = data.words as WordExplanation[];

            const normalized = normalizeWord(word);
            const preCached = words?.find(w => {
              const surfaceForms = (w as any).surfaceForms as string[] | undefined;
              return (
                normalizeWord(w.word) === normalized ||
                normalizeWord(w.reading) === normalized ||
                (surfaceForms || []).some(sf => normalizeWord(sf) === normalized)
              );
            });

            if (preCached) {
              console.log('%c[WordExplanation] SOURCE: STORY PRE-CACHE (fast)', 'color: #33cc66; font-weight: bold', { word, storyId: options.storyId });
              cacheExplanation(preCached);
              setExplanation(preCached);
              setLoading(false);
              options?.onSuccess?.(preCached);
              return preCached;
            }
          } else {
            console.log('[WordExplanation] No pre-cache document found for story');
          }
        } catch (firebaseError) {
          console.warn('[WordExplanation] Story pre-cache check failed, falling back to API:', firebaseError);
        }
      }

      // If comicId is provided, check comic_word_explanations collection
      if (options?.comicId) {
        try {
          console.log('[WordExplanation] Checking Firebase pre-cache for comicId:', options.comicId);
          const docRef = doc(firestore, 'comic_word_explanations', options.comicId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const words = data.words as WordExplanation[];

            const normalized = normalizeWord(word);
            const preCached = words?.find(w => {
              const surfaceForms = (w as any).surfaceForms as string[] | undefined;
              return (
                normalizeWord(w.word) === normalized ||
                normalizeWord(w.reading) === normalized ||
                (surfaceForms || []).some(sf => normalizeWord(sf) === normalized)
              );
            });

            if (preCached) {
              console.log('%c[WordExplanation] SOURCE: COMIC PRE-CACHE (fast)', 'color: #ff66cc; font-weight: bold', { word, comicId: options.comicId });
              cacheExplanation(preCached);
              setExplanation(preCached);
              setLoading(false);
              options?.onSuccess?.(preCached);
              return preCached;
            }
          } else {
            console.log('[WordExplanation] No pre-cache document found for comic');
          }
        } catch (firebaseError) {
          console.warn('[WordExplanation] Comic pre-cache check failed, falling back to API:', firebaseError);
          // Continue to API fallback
        }
      }

      // If flashcardId is provided, check flashcard_word_explanations collection
      if (options?.flashcardId) {
        try {
          console.log('[WordExplanation] Checking Firebase pre-cache for flashcardId:', options.flashcardId);
          const docRef = doc(firestore, 'flashcard_word_explanations', options.flashcardId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const words = data.words as WordExplanation[];

            const normalized = normalizeWord(word);
            const preCached = words?.find(w => {
              const surfaceForms = (w as any).surfaceForms as string[] | undefined;
              return (
                normalizeWord(w.word) === normalized ||
                normalizeWord(w.reading) === normalized ||
                (surfaceForms || []).some(sf => normalizeWord(sf) === normalized)
              );
            });

            if (preCached) {
              console.log('%c[WordExplanation] SOURCE: FLASHCARD PRE-CACHE (fast)', 'color: #c2185b; font-weight: bold', { word, flashcardId: options.flashcardId });
              cacheExplanation(preCached);
              setExplanation(preCached);
              setLoading(false);
              options?.onSuccess?.(preCached);
              return preCached;
            }
          } else {
            console.log('[WordExplanation] No pre-cache document found for flashcard');
          }
        } catch (firebaseError) {
          console.warn('[WordExplanation] Flashcard pre-cache check failed, falling back to API:', firebaseError);
          // Continue to API fallback
        }
      }

      // If we recently prefetched this content, re-check the doc once before API
      if (lastPrefetchRef.current && lastPrefetchRef.current.contentId) {
        const refetchedCollection =
          options?.articleId ? 'news_article_word_explanations'
            : options?.bookId ? 'book_word_explanations'
            : options?.storyId ? 'story_word_explanations'
            : options?.youtubeId ? 'youtube_word_explanations'
            : options?.videoId ? 'video_word_explanations'
            : options?.comicId ? 'comic_word_explanations'
            : options?.flashcardId ? 'flashcard_word_explanations'
            : undefined;

        if (refetchedCollection && lastPrefetchRef.current.contentId) {
          try {
            const refDoc = await getDoc(
              doc(firestore, refetchedCollection, lastPrefetchRef.current.contentId)
            );
            if (refDoc.exists()) {
              const data = refDoc.data();
              const words = (data.words as WordExplanation[]) || [];
              const normalized = normalizeWord(word);
              const hydrated = words.find(w => {
                const surfaceForms = (w as any).surfaceForms as string[] | undefined;
                return (
                  normalizeWord(w.word) === normalized ||
                  normalizeWord(w.reading) === normalized ||
                  (surfaceForms || []).some(sf => normalizeWord(sf) === normalized)
                );
              });
              if (hydrated) {
                console.log('%c[WordExplanation] SOURCE: PRECOMPUTE DOC (top-up)', 'color: #00c853; font-weight: bold', { word });
                cacheExplanation(hydrated);
                setExplanation(hydrated);
                setLoading(false);
                options?.onSuccess?.(hydrated);
                return hydrated;
              }
            }
          } catch (err) {
            console.warn('[WordExplanation] Top-up precompute check failed', err);
          }
        }
      }

      // Fallback: Call API for word explanation
      // Pass content context to skip quota check for prefetched content
      const contentId =
        options?.articleId ||
        options?.bookId ||
        options?.storyId ||
        options?.youtubeId ||
        options?.comicId ||
        options?.flashcardId

      const response = await fetch('/api/word/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Tell API this is a content lookup (no quota needed for prefetched words)
          ...(contentId && { 'x-content-id': contentId }),
          ...(options?.articleId && { 'x-content-type': 'article' }),
          ...(options?.bookId && { 'x-content-type': 'book' }),
          ...(options?.storyId && { 'x-content-type': 'story' }),
          ...(options?.youtubeId && { 'x-content-type': 'youtube' }),
          ...(options?.comicId && { 'x-content-type': 'comic' }),
          ...(options?.flashcardId && { 'x-content-type': 'flashcard' }),
        },
        body: JSON.stringify({ word: cacheKey, context }),
      });

      const data: WordExplanationResponse = await response.json();

      if (!response.ok) {
        if (data.error === 'LIMIT_REACHED') {
          const limitError = `Daily limit reached. ${data.decision?.remaining ?? 0} explanations remaining.`;
          setError(limitError);
          options?.onError?.(limitError);
          setLoading(false);
          return null;
        }

        const errorMessage = data.error || 'Failed to fetch word explanation';
        setError(errorMessage);
        options?.onError?.(errorMessage);
        setLoading(false);
        return null;
      }

      if (!data.success || !data.explanation) {
        const errorMessage = 'Invalid response from server';
        setError(errorMessage);
        options?.onError?.(errorMessage);
        setLoading(false);
        return null;
      }

      // If we had a prefetch context and this word was missing, trigger background repair once
      if (lastPrefetchRef.current?.contentId && lastPrefetchRef.current?.contentType) {
        const repairKey = `${lastPrefetchRef.current.contentType}:${lastPrefetchRef.current.contentId}`;
        if (!repairTriggeredRef.current.has(repairKey)) {
          repairTriggeredRef.current.add(repairKey);
          const endpoint =
            lastPrefetchRef.current.contentType === 'book'
              ? '/api/word/precompute/book'
              : '/api/word/precompute';
          fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contentId: lastPrefetchRef.current.contentId,
              contentType: lastPrefetchRef.current.contentType,
              text: lastPrefetchRef.current.text.slice(0, MAX_PREFETCH_CHARS),
              allowWhileGenerating: true,
              ...(lastPrefetchRef.current.contentType !== 'video'
                ? { includeParticles: true, minLength: 1 }
                : {}),
            }),
          }).catch(() => {});
        }
      }

      // Cache the result
      console.log('%c[WordExplanation] SOURCE: API (OpenAI)', 'color: #ff0000; font-weight: bold', { word, cached: data.cached });
      cacheExplanation(data.explanation);

      setExplanation(data.explanation);
      setLoading(false);
      options?.onSuccess?.(data.explanation);
      return data.explanation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      setError(errorMessage);
      options?.onError?.(errorMessage);
      setLoading(false);
      return null;
    }
  }, [options]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setExplanation(null);
    setCurrentWord(null);
  }, []);

  /**
   * Prefetch explanations for a content item by loading its precompute doc.
   * If the doc doesn't exist and text is provided, trigger server-side precompute.
   */
  const prefetch = useCallback(
    async (params: { contentId: string; contentType: 'article' | 'book' | 'story' | 'youtube' | 'video' | 'comic' | 'flashcard'; text?: string; background?: boolean }) => {
      const { contentId, contentType, text, background = false } = params;
      if (!contentId || !contentType) return;

      console.log(
        '%c[WordExplanation] PREFETCH START',
        'color: #1e90ff; font-weight: bold',
        { contentId, contentType, hasText: !!text, textLength: text?.length }
      );

      const collectionMap: Record<'article' | 'book' | 'story' | 'youtube' | 'video' | 'comic' | 'flashcard', string> = {
        article: 'news_article_word_explanations',
        book: 'book_word_explanations',
        story: 'story_word_explanations',
        youtube: 'youtube_word_explanations',
        video: 'video_word_explanations',
        comic: 'comic_word_explanations',
        flashcard: 'flashcard_word_explanations',
      };

      const collection = collectionMap[contentType];
      const docRef = doc(firestore, collection, contentId);
      let docSnap: any = null;

      const hydrateCache = (words: WordExplanation[]) => {
        let hydrated = 0;
        for (const w of words || []) {
          const key = w.word?.toLowerCase();
          if (key && !cacheRef.current.has(key)) {
            cacheRef.current.set(key, w);
            hydrated += 1;
          }
        }
        if (hydrated > 0) {
          // eslint-disable-next-line no-console
          console.log(
            '%c[WordExplanation] SOURCE: PRECOMPUTE DOC (hydrated)',
            'color: #ff9900; font-weight: bold',
            { contentId, contentType, hydrated }
          );
        }
      };

      // Try to hydrate from existing doc; decide if we should trigger background precompute
      let shouldPrecompute = true
      let desiredChunkTotal: number | undefined
      try {
        docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as { words?: WordExplanation[] };
          const precomputeStatus = (data as any)?.precomputeStatus;
          const precomputeVersion = (data as any)?.precomputeVersion;
          const precomputeOptions = (data as any)?.precomputeOptions || {};
          const existingChunkTotal = (data as any)?.precomputeChunkTotal;
          if (data?.words?.length) {
            hydrateCache(data.words);
          const expectedOptions = contentType !== 'video'
              ? { includeParticles: true, minLength: 1 }
              : {};
          const optionsMismatch = contentType !== 'video' && (
              precomputeOptions?.includeParticles !== expectedOptions.includeParticles ||
              precomputeOptions?.minLength !== expectedOptions.minLength
            );
            shouldPrecompute = precomputeVersion !== PRECOMPUTE_VERSION || optionsMismatch;
            if (background && text) {
              const safeText =
                text.length > MAX_PREFETCH_CHARS ? text.slice(0, MAX_PREFETCH_CHARS) : text;
              const chunks = chunkText(safeText, PREFETCH_CHUNK_SIZE).slice(0, 6);
              desiredChunkTotal = chunks.length;
              if (
                typeof existingChunkTotal !== 'number' ||
                desiredChunkTotal > existingChunkTotal
              ) {
                shouldPrecompute = true;
              }
            }
            if (shouldPrecompute) {
              console.log('[WordExplanation] Prefetch repair needed (version mismatch)', {
                contentId,
                contentType,
                precomputeVersion,
                expected: PRECOMPUTE_VERSION,
                precomputeOptions,
                expectedOptions,
                words: data?.words?.length || 0,
              });
            }
          } else if (precomputeStatus === 'generating') {
            // Allow background batches to continue while a lock is held.
            shouldPrecompute = background;
          }
        }
      } catch (err) {
        console.warn('[WordExplanation] Prefetch doc read failed, continuing to precompute', err);
      }

      // If no precompute exists yet and text provided, kick off precompute and refetch
      if (text && shouldPrecompute) {
        try {
          // Truncate total payload length and chunk to avoid dropping tail words
          const safeText =
            text.length > MAX_PREFETCH_CHARS ? text.slice(0, MAX_PREFETCH_CHARS) : text;
          const chunks = chunkText(safeText, PREFETCH_CHUNK_SIZE).slice(0, 6); // hard cap chunks
          const includeAllTokens = contentType !== 'video';
          const isBook = contentType === 'book';

          lastPrefetchRef.current = { contentId, contentType, text: safeText };

          if (isBook) {
            await fetch('/api/word/precompute/book', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contentId }),
            });
            return;
          }

          for (let idx = 0; idx < chunks.length; idx++) {
            const chunk = chunks[idx];
            console.log(
              '%c[WordExplanation] PRECOMPUTE TRIGGER',
              'color: #00bfff; font-weight: bold',
              {
                contentId,
                contentType,
                chunk: idx + 1,
                chunks: chunks.length,
                wordCountEstimate: chunk.length / 2,
              }
            );
            const endpoint = isBook ? '/api/word/precompute/book' : '/api/word/precompute';
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contentId,
                contentType,
                text: chunk,
                chunkIndex: idx,
                totalChunks: chunks.length,
                allowWhileGenerating: idx > 0 || background,
                background,
                ...(includeAllTokens ? { includeParticles: true, minLength: 1 } : {}),
              }),
            });
            if (resp.ok) {
              const payload = await resp.json().catch(() => null);
              if (payload?.skipped && payload.skipped !== 'locked') {
                break;
              }
              if (payload?.skipped === 'locked') {
                break;
              }
            }
            if (!resp.ok) {
              const details = await resp.json().catch(() => ({}));
              console.warn('[WordExplanation] Precompute failed', { status: resp.status, details });
              continue;
            }

            // Poll briefly for this chunk to hydrate cache
            const attempts = 8;
            for (let i = 0; i < attempts; i++) {
              const refreshed = await getDoc(docRef);
              if (refreshed.exists()) {
                const data = refreshed.data() as { words?: WordExplanation[] };
                if (data?.words?.length) {
                  hydrateCache(data.words);
                  console.log(
                    '%c[WordExplanation] PREFETCH DOC READY',
                    'color: #00c853; font-weight: bold',
                    { contentId, contentType, words: data.words?.length, chunk: idx + 1 }
                  );
                  break;
                }
              }
              await new Promise(res => setTimeout(res, 200));
            }
          }
        } catch (e) {
          console.warn('[WordExplanation] Prefetch failed', e);
        }
        return
      }

      if (shouldPrecompute) {
        try {
          if (contentType === 'book') {
            console.log(
              '%c[WordExplanation] PREFETCH QUEUED (book fetch)',
              'color: #00bfff; font-weight: bold',
              { contentId, contentType }
            );
            await fetch('/api/word/precompute/book', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contentId }),
            });
            return;
          }

          if (contentType !== 'video') {
            console.log(
              '%c[WordExplanation] PREFETCH QUEUED (server fetch)',
              'color: #00bfff; font-weight: bold',
              { contentId, contentType }
            );
            await fetch('/api/word/precompute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contentId,
                contentType,
                fetchContent: true,
                includeParticles: true,
                minLength: 1,
              }),
            });
            return;
          }
        } catch (e) {
          console.warn('[WordExplanation] Prefetch (server fetch) failed', e);
        }
      }

      if (!shouldPrecompute) {
        console.log(
          '%c[WordExplanation] PREFETCH SKIPPED (up-to-date)',
          'color: #999999; font-weight: bold',
          { contentId, contentType }
        );
        return;
      }

      if (!text) {
        console.log(
          '%c[WordExplanation] PREFETCH SKIPPED (no text provided)',
          'color: #ffa500; font-weight: bold',
          { contentId, contentType }
        );
      }
    },
    []
  );

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    explainWord,
    loading,
    error,
    explanation,
    currentWord,
    reset,
    prefetch,
    clearCache,
  };
}
