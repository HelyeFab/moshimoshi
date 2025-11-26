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
}

export function useWordExplanation(options?: UseWordExplanationOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<WordExplanation | null>(null);
  const [currentWord, setCurrentWord] = useState<string | null>(null);

  // Component-level memory cache
  const cacheRef = useRef<Map<string, WordExplanation>>(new Map());

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
            } else {
              console.log('[WordExplanation] Word not in pre-cache, will use API', { word });
            }
          } else {
            console.log('[WordExplanation] No pre-cache document found for article');
          }
        } catch (firebaseError) {
          console.warn('[WordExplanation] Firebase pre-cache check failed, falling back to API:', firebaseError);
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
    clearCache,
  };
}
