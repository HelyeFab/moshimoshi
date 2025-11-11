'use client';

import { useState, useCallback, useRef } from 'react';
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

      // Check component-level cache
      const cacheKey = word.toLowerCase();
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setExplanation(cached);
        setLoading(false);
        options?.onSuccess?.(cached);
        return cached;
      }

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
