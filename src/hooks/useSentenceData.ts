/**
 * useSentenceData Hook
 * Fetches pre-cached sentence audio and translations for articles, stories, and books
 * Provides instant playback and translation without API calls
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/client'

// ============================================
// Types
// ============================================

export interface GrammarNote {
  pattern: string
  explanation: string
  example?: string
}

export interface KeyVocabulary {
  word: string
  reading: string
  meaning: string
  jlptLevel?: string
  partOfSpeech?: string
}

export interface SentenceTranslation {
  originalText: string
  translatedText: string
  grammarNotes: GrammarNote[]
  keyVocabulary: KeyVocabulary[]
  confidence: number
}

export interface SentenceData {
  index: number
  text: string
  audioUrl: string
  translation: SentenceTranslation
}

export interface ArticleSentenceCache {
  articleId: string
  sentences: SentenceData[]
  sentencesGeneratedAt?: Date
}

export interface StorySentenceCache {
  storyId: string
  pages: Array<{
    pageNumber: number
    sentences: SentenceData[]
  }>
}

export interface BookSentenceCache {
  bookId: string
  sentences: SentenceData[]
  sentenceCount: number
}

// ============================================
// Hook for Article Sentences
// ============================================

export function useArticleSentenceData(articleId: string | null) {
  const [sentenceData, setSentenceData] = useState<SentenceData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasCachedData, setHasCachedData] = useState(false)

  useEffect(() => {
    if (!articleId) {
      setSentenceData([])
      setHasCachedData(false)
      return
    }

    const fetchSentenceData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const docRef = doc(firestore, 'news_article_translations', articleId)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const data = docSnap.data()
          if (data.sentences && Array.isArray(data.sentences)) {
            setSentenceData(data.sentences)
            setHasCachedData(true)
            console.log(
              `[SentenceData] Loaded ${data.sentences.length} pre-cached sentences for article ${articleId}`
            )
          } else {
            setSentenceData([])
            setHasCachedData(false)
          }
        } else {
          setSentenceData([])
          setHasCachedData(false)
        }
      } catch (err) {
        console.error('[SentenceData] Error fetching article sentences:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch sentence data')
        setSentenceData([])
        setHasCachedData(false)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSentenceData()
  }, [articleId])

  // Get sentence data by text match
  const getSentenceByText = useCallback(
    (text: string): SentenceData | null => {
      return sentenceData.find(s => s.text === text || s.translation?.originalText === text) || null
    },
    [sentenceData]
  )

  // Get sentence data by index
  const getSentenceByIndex = useCallback(
    (index: number): SentenceData | null => {
      return sentenceData.find(s => s.index === index) || null
    },
    [sentenceData]
  )

  // Get audio URL for a sentence
  const getAudioUrl = useCallback(
    (text: string): string | null => {
      const sentence = getSentenceByText(text)
      return sentence?.audioUrl || null
    },
    [getSentenceByText]
  )

  // Get translation for a sentence
  const getTranslation = useCallback(
    (text: string): SentenceTranslation | null => {
      const sentence = getSentenceByText(text)
      return sentence?.translation || null
    },
    [getSentenceByText]
  )

  // Create a map for fast lookups
  const sentenceMap = useMemo(() => {
    const map = new Map<string, SentenceData>()
    sentenceData.forEach(s => {
      map.set(s.text, s)
      if (s.translation?.originalText && s.translation.originalText !== s.text) {
        map.set(s.translation.originalText, s)
      }
    })
    return map
  }, [sentenceData])

  return {
    sentenceData,
    sentenceMap,
    isLoading,
    error,
    hasCachedData,
    getSentenceByText,
    getSentenceByIndex,
    getAudioUrl,
    getTranslation,
  }
}

// ============================================
// Hook for Story Sentences
// ============================================

export function useStorySentenceData(storyId: string | null) {
  const [pageData, setPageData] = useState<StorySentenceCache['pages']>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasCachedData, setHasCachedData] = useState(false)

  useEffect(() => {
    if (!storyId) {
      setPageData([])
      setHasCachedData(false)
      return
    }

    const fetchSentenceData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const docRef = doc(firestore, 'story_sentence_data', storyId)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const data = docSnap.data()
          if (data.pages && Array.isArray(data.pages)) {
            setPageData(data.pages)
            setHasCachedData(true)
            console.log(
              `[SentenceData] Loaded sentence data for ${data.pages.length} pages of story ${storyId}`
            )
          } else {
            setPageData([])
            setHasCachedData(false)
          }
        } else {
          setPageData([])
          setHasCachedData(false)
        }
      } catch (err) {
        console.error('[SentenceData] Error fetching story sentences:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch sentence data')
        setPageData([])
        setHasCachedData(false)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSentenceData()
  }, [storyId])

  // Get sentences for a specific page
  const getPageSentences = useCallback(
    (pageNumber: number): SentenceData[] => {
      const page = pageData.find(p => p.pageNumber === pageNumber)
      return page?.sentences || []
    },
    [pageData]
  )

  // Get sentence by text across all pages
  const getSentenceByText = useCallback(
    (text: string): SentenceData | null => {
      for (const page of pageData) {
        const sentence = page.sentences.find(
          s => s.text === text || s.translation?.originalText === text
        )
        if (sentence) return sentence
      }
      return null
    },
    [pageData]
  )

  return {
    pageData,
    isLoading,
    error,
    hasCachedData,
    getPageSentences,
    getSentenceByText,
  }
}

// ============================================
// Hook for Book Sentences
// ============================================

export function useBookSentenceData(bookId: string | null) {
  const [sentenceData, setSentenceData] = useState<SentenceData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasCachedData, setHasCachedData] = useState(false)

  useEffect(() => {
    if (!bookId) {
      setSentenceData([])
      setHasCachedData(false)
      return
    }

    const fetchSentenceData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const docRef = doc(firestore, 'book_sentence_data', bookId)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const data = docSnap.data()
          if (data.sentences && Array.isArray(data.sentences)) {
            setSentenceData(data.sentences)
            setHasCachedData(true)
            console.log(
              `[SentenceData] Loaded ${data.sentences.length} pre-cached sentences for book ${bookId}`
            )
          } else {
            setSentenceData([])
            setHasCachedData(false)
          }
        } else {
          setSentenceData([])
          setHasCachedData(false)
        }
      } catch (err) {
        console.error('[SentenceData] Error fetching book sentences:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch sentence data')
        setSentenceData([])
        setHasCachedData(false)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSentenceData()
  }, [bookId])

  // Get sentence data by text match
  const getSentenceByText = useCallback(
    (text: string): SentenceData | null => {
      return sentenceData.find(s => s.text === text || s.translation?.originalText === text) || null
    },
    [sentenceData]
  )

  // Get sentence data by index
  const getSentenceByIndex = useCallback(
    (index: number): SentenceData | null => {
      return sentenceData.find(s => s.index === index) || null
    },
    [sentenceData]
  )

  // Create a map for fast lookups
  const sentenceMap = useMemo(() => {
    const map = new Map<string, SentenceData>()
    sentenceData.forEach(s => {
      map.set(s.text, s)
      if (s.translation?.originalText && s.translation.originalText !== s.text) {
        map.set(s.translation.originalText, s)
      }
    })
    return map
  }, [sentenceData])

  return {
    sentenceData,
    sentenceMap,
    isLoading,
    error,
    hasCachedData,
    getSentenceByText,
    getSentenceByIndex,
  }
}

// ============================================
// Export types
// ============================================

export type {
  GrammarNote as SentenceGrammarNote,
  KeyVocabulary as SentenceKeyVocabulary,
}
