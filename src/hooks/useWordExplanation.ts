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
  videoId?: string; // Optional: if provided, will check video_word_explanations collection
  comicId?: string; // Optional: if provided, will check comic_word_explanations collection
}

const MAX_PREFETCH_CHARS = 48000;
const PREFETCH_CHUNK_SIZE = 8000;

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
    contentType: 'article' | 'book' | 'story' | 'video' | 'comic';
    text: string;
  } | null>(null);

  const explainWord = useCallback(async (word: string, context?: string) => {
    try {
      setLoading(true);
      setError(null);
      setCurrentWord(word);

      // Check component-level cache first
      const cacheKey = word.toLowerCase();
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
            const preCached = words?.find(w =>
              w.word === word ||
              w.word.toLowerCase() === word.toLowerCase() ||
              w.reading === word
            );

            if (preCached) {
              console.log('%c[WordExplanation] SOURCE: FIREBASE PRE-CACHE (fast)', 'color: #ff9900; font-weight: bold', { word, articleId: options.articleId });
              cacheRef.current.set(cacheKey, preCached);
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
            const preCached = words?.find(w =>
              w.word === word ||
              w.word.toLowerCase() === word.toLowerCase() ||
              w.reading === word
            );

            if (preCached) {
              console.log('%c[WordExplanation] SOURCE: BOOK PRE-CACHE (fast)', 'color: #9900ff; font-weight: bold', { word, bookId: options.bookId });
              cacheRef.current.set(cacheKey, preCached);
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
            const preCached = words?.find(w =>
              w.word === word ||
              w.word.toLowerCase() === word.toLowerCase() ||
              w.reading === word
            );

            if (preCached) {
              console.log('%c[WordExplanation] SOURCE: VIDEO PRE-CACHE (fast)', 'color: #00ccff; font-weight: bold', { word, videoId: options.videoId });
              cacheRef.current.set(cacheKey, preCached);
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

      // If comicId is provided, check comic_word_explanations collection
      if (options?.comicId) {
        try {
          console.log('[WordExplanation] Checking Firebase pre-cache for comicId:', options.comicId);
          const docRef = doc(firestore, 'comic_word_explanations', options.comicId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const words = data.words as WordExplanation[];

            const preCached = words?.find(w =>
              w.word === word ||
              w.word.toLowerCase() === word.toLowerCase() ||
              w.reading === word
            );

            if (preCached) {
              console.log('%c[WordExplanation] SOURCE: COMIC PRE-CACHE (fast)', 'color: #ff66cc; font-weight: bold', { word, comicId: options.comicId });
              cacheRef.current.set(cacheKey, preCached);
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

      // If we recently prefetched this content, re-check the doc once before API
      if (lastPrefetchRef.current && lastPrefetchRef.current.contentId) {
        const refetchedCollection =
          options?.articleId ? 'news_article_word_explanations'
            : options?.bookId ? 'book_word_explanations'
            : options?.videoId ? 'video_word_explanations'
            : options?.comicId ? 'comic_word_explanations'
            : undefined;

        if (refetchedCollection && lastPrefetchRef.current.contentId) {
          try {
            const refDoc = await getDoc(
              doc(firestore, refetchedCollection, lastPrefetchRef.current.contentId)
            );
            if (refDoc.exists()) {
              const data = refDoc.data();
              const words = (data.words as WordExplanation[]) || [];
              const hydrated = words.find(
                w =>
                  w.word === word ||
                  w.word?.toLowerCase() === word.toLowerCase() ||
                  w.reading === word
              );
              if (hydrated) {
                console.log('%c[WordExplanation] SOURCE: PRECOMPUTE DOC (top-up)', 'color: #00c853; font-weight: bold', { word });
                cacheRef.current.set(cacheKey, hydrated);
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
      const response = await fetch('/api/word/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word, context }),
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

      // Cache the result
      console.log('%c[WordExplanation] SOURCE: API (OpenAI)', 'color: #ff0000; font-weight: bold', { word, cached: data.cached });
      cacheRef.current.set(cacheKey, data.explanation);

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
    async (params: { contentId: string; contentType: 'article' | 'book' | 'story' | 'video' | 'comic'; text?: string }) => {
      const { contentId, contentType, text } = params;
      if (!contentId || !contentType) return;

      console.log(
        '%c[WordExplanation] PREFETCH START',
        'color: #1e90ff; font-weight: bold',
        { contentId, contentType, hasText: !!text, textLength: text?.length }
      );

      const collectionMap: Record<'article' | 'book' | 'story' | 'video' | 'comic', string> = {
        article: 'news_article_word_explanations',
        book: 'book_word_explanations',
        story: 'story_word_explanations',
        video: 'video_word_explanations',
        comic: 'comic_word_explanations',
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

      // Try to hydrate from existing doc; do NOT return early so we can still top-up
      try {
        docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as { words?: WordExplanation[] };
          if (data?.words?.length) {
            hydrateCache(data.words);
          }
        }
      } catch (err) {
        console.warn('[WordExplanation] Prefetch doc read failed, continuing to precompute', err);
      }

      // If no precompute exists yet and text provided, kick off precompute and refetch
      if (text) {
        try {
          // Truncate total payload length and chunk to avoid dropping tail words
          const safeText =
            text.length > MAX_PREFETCH_CHARS ? text.slice(0, MAX_PREFETCH_CHARS) : text;
          const chunks = chunkText(safeText, PREFETCH_CHUNK_SIZE).slice(0, 6); // hard cap chunks

          lastPrefetchRef.current = { contentId, contentType, text: safeText };

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
            const resp = await fetch('/api/word/precompute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contentId, contentType, text: chunk, chunkIndex: idx }),
            });
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
      } else {
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
