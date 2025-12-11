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
    contentType: 'article' | 'book' | 'story' | 'video';
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
    async (params: { contentId: string; contentType: 'article' | 'book' | 'story' | 'video'; text?: string }) => {
      const { contentId, contentType, text } = params;
      if (!contentId || !contentType) return;

      console.log(
        '%c[WordExplanation] PREFETCH START',
        'color: #1e90ff; font-weight: bold',
        { contentId, contentType, hasText: !!text, textLength: text?.length }
      );

      const collectionMap: Record<'article' | 'book' | 'story' | 'video', string> = {
        article: 'news_article_word_explanations',
        book: 'book_word_explanations',
        story: 'story_word_explanations',
        video: 'video_word_explanations',
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
          // Truncate very long payloads to avoid server rejection and speed precompute
          const MAX_TEXT = 18000;
          const truncatedText = text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;

          console.log(
            '%c[WordExplanation] PRECOMPUTE TRIGGER',
            'color: #00bfff; font-weight: bold',
            { contentId, contentType, wordCountEstimate: truncatedText.length / 2, truncated: text.length > MAX_TEXT }
          );
          const resp = await fetch('/api/word/precompute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentId, contentType, text: truncatedText }),
          });
          if (!resp.ok) {
            const details = await resp.json().catch(() => ({}));
            console.warn('[WordExplanation] Precompute failed', { status: resp.status, details });
            return;
          }

          lastPrefetchRef.current = { contentId, contentType, text: truncatedText };

          // Wait briefly for precompute doc to appear (to avoid API fallback on first tap)
          const attempts = 12;
          for (let i = 0; i < attempts; i++) {
            const refreshed = await getDoc(docRef);
            if (refreshed.exists()) {
              const data = refreshed.data() as { words?: WordExplanation[] };
              if (data?.words?.length) {
                hydrateCache(data.words);
                console.log(
                  '%c[WordExplanation] PREFETCH DOC READY',
                  'color: #00c853; font-weight: bold',
                  { contentId, contentType, words: data.words?.length }
                );
                break;
              }
            }
            await new Promise(res => setTimeout(res, 200)); // small backoff
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
