/**
 * useSentenceData Hook
 * Fetches pre-cached sentence audio and translations for articles, stories, and books
 * Provides instant playback and translation without API calls
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { doc, getDoc } from 'firebase/firestore'
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

  /**
   * Update a sentence's translation in Firebase and local state
   * Called after user fetches a translation on-demand
   * Uses API endpoint to bypass Firestore security rules
   */
  const updateSentenceTranslation = useCallback(
    async (
      sentenceText: string,
      translation: SentenceTranslation
    ): Promise<boolean> => {
      if (!articleId || !sentenceText || !translation.translatedText) {
        return false
      }

      try {
        // Find the sentence index
        const sentenceIndex = sentenceData.findIndex(
          s => s.text === sentenceText || s.translation?.originalText === sentenceText
        )

        if (sentenceIndex === -1) {
          console.warn('[SentenceData] Sentence not found for update:', sentenceText.substring(0, 30))
          return false
        }

        // Update local state first (optimistic update)
        const updatedSentences = [...sentenceData]
        updatedSentences[sentenceIndex] = {
          ...updatedSentences[sentenceIndex],
          translation,
        }
        setSentenceData(updatedSentences)

        // Persist to Firebase via API endpoint
        const response = await fetch('/api/books/cache-sentence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentId: articleId,
            contentType: 'article',
            sentenceIndex,
            translation,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          console.error('[SentenceData] API error:', data.error)
          return false
        }

        console.log(`[SentenceData] Updated translation for sentence ${sentenceIndex} in article ${articleId}`)
        return true
      } catch (err) {
        console.error('[SentenceData] Failed to update sentence translation:', err)
        return false
      }
    },
    [articleId, sentenceData]
  )

  /**
   * Update a sentence's audio URL in Firebase and local state
   * Uses API endpoint to bypass Firestore security rules
   */
  const updateSentenceAudio = useCallback(
    async (sentenceText: string, audioUrl: string): Promise<boolean> => {
      if (!articleId || !sentenceText || !audioUrl) {
        return false
      }

      try {
        const sentenceIndex = sentenceData.findIndex(
          s => s.text === sentenceText || s.translation?.originalText === sentenceText
        )

        if (sentenceIndex === -1) {
          return false
        }

        // Update local state (optimistic update)
        const updatedSentences = [...sentenceData]
        updatedSentences[sentenceIndex] = {
          ...updatedSentences[sentenceIndex],
          audioUrl,
        }
        setSentenceData(updatedSentences)

        // Persist to Firebase via API endpoint
        const response = await fetch('/api/books/cache-sentence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentId: articleId,
            contentType: 'article',
            sentenceIndex,
            audioUrl,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          console.error('[SentenceData] API error:', data.error)
          return false
        }

        console.log(`[SentenceData] Updated audio for sentence ${sentenceIndex} in article ${articleId}`)
        return true
      } catch (err) {
        console.error('[SentenceData] Failed to update sentence audio:', err)
        return false
      }
    },
    [articleId, sentenceData]
  )

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
    updateSentenceTranslation,
    updateSentenceAudio,
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

  /**
   * Find which page and sentence index contains the given text
   */
  const findSentenceLocation = useCallback(
    (sentenceText: string): { pageNumber: number; sentenceIndex: number } | null => {
      for (const page of pageData) {
        const sentenceIndex = page.sentences.findIndex(
          s => s.text === sentenceText || s.translation?.originalText === sentenceText
        )
        if (sentenceIndex !== -1) {
          return { pageNumber: page.pageNumber, sentenceIndex }
        }
      }
      return null
    },
    [pageData]
  )

  /**
   * Update a sentence's translation in Firebase and local state
   * Called after user fetches a translation on-demand
   * Uses API endpoint to bypass Firestore security rules
   */
  const updateSentenceTranslation = useCallback(
    async (
      sentenceText: string,
      translation: SentenceTranslation
    ): Promise<boolean> => {
      if (!storyId || !sentenceText || !translation.translatedText) {
        return false
      }

      try {
        const location = findSentenceLocation(sentenceText)
        if (!location) {
          console.warn('[SentenceData] Sentence not found for update:', sentenceText.substring(0, 30))
          return false
        }

        const { pageNumber, sentenceIndex } = location

        // Update local state first (optimistic update)
        const updatedPages = [...pageData]
        const pageIndex = updatedPages.findIndex(p => p.pageNumber === pageNumber)
        if (pageIndex !== -1) {
          updatedPages[pageIndex] = {
            ...updatedPages[pageIndex],
            sentences: updatedPages[pageIndex].sentences.map((s, idx) =>
              idx === sentenceIndex ? { ...s, translation } : s
            ),
          }
          setPageData(updatedPages)
        }

        // Persist to Firebase via API endpoint
        const response = await fetch('/api/books/cache-sentence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentId: storyId,
            contentType: 'story',
            pageNumber,
            sentenceIndex,
            translation,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          console.error('[SentenceData] API error:', data.error)
          return false
        }

        console.log(`[SentenceData] Updated translation for page ${pageNumber} sentence ${sentenceIndex} in story ${storyId}`)
        return true
      } catch (err) {
        console.error('[SentenceData] Failed to update sentence translation:', err)
        return false
      }
    },
    [storyId, pageData, findSentenceLocation]
  )

  /**
   * Update a sentence's audio URL in Firebase and local state
   * Uses API endpoint to bypass Firestore security rules
   */
  const updateSentenceAudio = useCallback(
    async (sentenceText: string, audioUrl: string): Promise<boolean> => {
      if (!storyId || !sentenceText || !audioUrl) {
        return false
      }

      try {
        const location = findSentenceLocation(sentenceText)
        if (!location) {
          return false
        }

        const { pageNumber, sentenceIndex } = location

        // Update local state (optimistic update)
        const updatedPages = [...pageData]
        const pageIndex = updatedPages.findIndex(p => p.pageNumber === pageNumber)
        if (pageIndex !== -1) {
          updatedPages[pageIndex] = {
            ...updatedPages[pageIndex],
            sentences: updatedPages[pageIndex].sentences.map((s, idx) =>
              idx === sentenceIndex ? { ...s, audioUrl } : s
            ),
          }
          setPageData(updatedPages)
        }

        // Persist to Firebase via API endpoint
        const response = await fetch('/api/books/cache-sentence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentId: storyId,
            contentType: 'story',
            pageNumber,
            sentenceIndex,
            audioUrl,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          console.error('[SentenceData] API error:', data.error)
          return false
        }

        console.log(`[SentenceData] Updated audio for page ${pageNumber} sentence ${sentenceIndex} in story ${storyId}`)
        return true
      } catch (err) {
        console.error('[SentenceData] Failed to update sentence audio:', err)
        return false
      }
    },
    [storyId, pageData, findSentenceLocation]
  )

  return {
    pageData,
    isLoading,
    error,
    hasCachedData,
    getPageSentences,
    getSentenceByText,
    updateSentenceTranslation,
    updateSentenceAudio,
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

  /**
   * Update a sentence's translation in Firebase and local state
   * Called after user fetches a translation on-demand
   * Uses API endpoint to bypass Firestore security rules
   */
  const updateSentenceTranslation = useCallback(
    async (
      sentenceText: string,
      translation: SentenceTranslation
    ): Promise<boolean> => {
      if (!bookId || !sentenceText || !translation.translatedText) {
        return false
      }

      try {
        // Find the sentence index
        const sentenceIndex = sentenceData.findIndex(
          s => s.text === sentenceText || s.translation?.originalText === sentenceText
        )

        if (sentenceIndex === -1) {
          console.warn('[SentenceData] Sentence not found for update:', sentenceText.substring(0, 30))
          return false
        }

        // Update local state first (optimistic update)
        const updatedSentences = [...sentenceData]
        updatedSentences[sentenceIndex] = {
          ...updatedSentences[sentenceIndex],
          translation,
        }
        setSentenceData(updatedSentences)

        // Persist to Firebase via API endpoint
        const response = await fetch('/api/books/cache-sentence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId,
            sentenceIndex,
            translation,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          console.error('[SentenceData] API error:', data.error)
          return false
        }

        console.log(`[SentenceData] Updated translation for sentence ${sentenceIndex} in book ${bookId}`)
        return true
      } catch (err) {
        console.error('[SentenceData] Failed to update sentence translation:', err)
        return false
      }
    },
    [bookId, sentenceData]
  )

  /**
   * Update a sentence's audio URL in Firebase and local state
   * Uses API endpoint to bypass Firestore security rules
   */
  const updateSentenceAudio = useCallback(
    async (sentenceText: string, audioUrl: string): Promise<boolean> => {
      if (!bookId || !sentenceText || !audioUrl) {
        return false
      }

      try {
        const sentenceIndex = sentenceData.findIndex(
          s => s.text === sentenceText || s.translation?.originalText === sentenceText
        )

        if (sentenceIndex === -1) {
          return false
        }

        // Update local state (optimistic update)
        const updatedSentences = [...sentenceData]
        updatedSentences[sentenceIndex] = {
          ...updatedSentences[sentenceIndex],
          audioUrl,
        }
        setSentenceData(updatedSentences)

        // Persist to Firebase via API endpoint
        const response = await fetch('/api/books/cache-sentence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId,
            sentenceIndex,
            audioUrl,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          console.error('[SentenceData] API error:', data.error)
          return false
        }

        console.log(`[SentenceData] Updated audio for sentence ${sentenceIndex} in book ${bookId}`)
        return true
      } catch (err) {
        console.error('[SentenceData] Failed to update sentence audio:', err)
        return false
      }
    },
    [bookId, sentenceData]
  )

  return {
    sentenceData,
    sentenceMap,
    isLoading,
    error,
    hasCachedData,
    getSentenceByText,
    getSentenceByIndex,
    updateSentenceTranslation,
    updateSentenceAudio,
  }
}

// ============================================
// Export types
// ============================================

export type {
  GrammarNote as SentenceGrammarNote,
  KeyVocabulary as SentenceKeyVocabulary,
}
