/**
 * Content Translation Hook
 * Manages translation functionality for Japanese learning content
 */

'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { TranslationMode, ReadingSettings } from '@/types/story'
import {
  TranslationResult,
  TranslationMode as TranslationModeType,
} from '@/lib/ai/processors/TranslationProcessor'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/client'

// Client-side types (avoiding server-side imports)
interface TranslationCacheDocument {
  textHash: string
  translationId: string
  mode: TranslationMode
  userLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  confidence: number
  usageCount: number
  lastUsed: any
  preview: {
    translatedText: string
    keyVocabularyCount: number
    grammarNotesCount: number
  }
}

// ============================================
// Content Translation Hook Types
// ============================================

export interface ContentTranslationSettings {
  mode: TranslationMode
  userLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  showConfidence: boolean
  includeGrammarNotes: boolean
  autoAddToVocabulary: boolean
  articleId?: string // Optional: for pre-cached news article translations
}

export interface TranslationCache {
  [key: string]: {
    hints?: string[]
    partial?: TranslationResult
    full?: TranslationResult
    timestamp: number
  }
}

export interface UseContentTranslationReturn {
  // Settings
  settings: ContentTranslationSettings
  updateSettings: (updates: Partial<ContentTranslationSettings>) => void

  // Translation functions
  translateText: (text: string, mode?: TranslationMode) => Promise<TranslationResult | null>
  getHints: (text: string) => Promise<string[]>
  getPartialTranslation: (text: string) => Promise<TranslationResult | null>
  getFullTranslation: (text: string) => Promise<TranslationResult | null>

  // Batch operations
  translateBatch: (texts: string[], mode?: TranslationMode) => Promise<TranslationResult[]>

  // Cache management
  clearCache: () => void
  getCacheStats: () => {
    memorySize: number
    memoryHitRate: number
    firebaseEnabled: boolean
  }

  // Firebase-specific features
  getPopularTranslations: (limit?: number) => Promise<TranslationCacheDocument[]>
  getCacheAnalytics: () => Promise<{
    totalCachedTranslations: number
    cacheHitRate: number
    costSavings: number
    popularModes: Array<{ mode: TranslationMode; count: number }>
  }>

  // State
  isLoading: boolean
  error: string | null
  firebaseError: string | null

  // Vocabulary management
  addToVocabulary: (word: string, translation: string) => void
  getVocabularyList: () => Array<{ word: string; translation: string; addedAt: Date }>

  // Enhanced statistics
  getUsageStats: () => {
    translationsRequested: number
    hintsRequested: number
    vocabularyAdded: number
    lastUsed: Date | null
    cacheHits: number
    cacheMisses: number
    firebaseCacheHits: number
    costSaved: number
  }
}

// ============================================
// Default Settings
// ============================================

const DEFAULT_SETTINGS: ContentTranslationSettings = {
  mode: 'learning',
  userLevel: 'N5',
  showConfidence: true,
  includeGrammarNotes: true,
  autoAddToVocabulary: false,
}

// ============================================
// Content Translation Hook
// ============================================

export function useContentTranslation(
  initialSettings?: Partial<ContentTranslationSettings>
): UseContentTranslationReturn {
  // ============================================
  // State
  // ============================================

  const [settings, setSettings] = useState<ContentTranslationSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  })

  const [cache, setCache] = useState<TranslationCache>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firebaseError, setFirebaseError] = useState<string | null>(null)
  const [vocabulary, setVocabulary] = useState<
    Array<{ word: string; translation: string; addedAt: Date }>
  >([])
  const [usageStats, setUsageStats] = useState({
    translationsRequested: 0,
    hintsRequested: 0,
    vocabularyAdded: 0,
    lastUsed: null as Date | null,
    cacheHits: 0,
    cacheMisses: 0,
    firebaseCacheHits: 0,
    costSaved: 0,
  })

  // Direct API calls instead of AIService to avoid client/server boundary issues

  // ============================================
  // Local Memory Cache (legacy support)
  // Note: Primary caching now handled by Firebase
  // ============================================

  // Keeping minimal local cache for immediate re-use within the same session
  const getCacheKey = useCallback(
    (text: string, mode: TranslationMode): string => {
      return `${text}_${mode}_${settings.userLevel}_${settings.includeGrammarNotes}`
    },
    [settings.userLevel, settings.includeGrammarNotes]
  )

  // ============================================
  // Settings Management
  // ============================================

  const updateSettings = useCallback((updates: Partial<ContentTranslationSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  // ============================================
  // Translation Functions
  // ============================================

  const translateText = useCallback(
    async (
      text: string,
      mode: TranslationMode = settings.mode
    ): Promise<TranslationResult | null> => {
      console.log(`[Translation] translateText called with:`, {
        text: text.substring(0, 50) + '...',
        mode,
        settingsMode: settings.mode,
        userLevel: settings.userLevel,
        articleId: settings.articleId,
      })

      if (mode === 'off') {
        console.log(`[Translation] Mode is 'off', returning null`)
        return null
      }

      setIsLoading(true)
      setError(null)
      setFirebaseError(null)

      const startTime = Date.now()

      try {
        // 🔥 STEP 0: Check Firebase pre-cached translations for news articles
        if (settings.articleId) {
          try {
            console.log(
              '[Translation] Checking Firebase pre-cache for articleId:',
              settings.articleId
            )
            const docRef = doc(firestore, 'news_article_translations', settings.articleId)
            const docSnap = await getDoc(docRef)

            if (docSnap.exists()) {
              const data = docSnap.data()
              console.log('[Translation] Found pre-cached translations document')

              // Determine which translation to use based on text content
              let preCached: TranslationResult | null = null

              // Check if this is title, summary, or content translation
              if (data.title && text === data.title.originalText) {
                preCached = data.title
                console.log('[Translation] Using pre-cached TITLE translation')
              } else if (data.summary && text === data.summary.originalText) {
                preCached = data.summary
                console.log('[Translation] Using pre-cached SUMMARY translation')
              } else if (data.content && text === data.content.originalText) {
                preCached = data.content
                console.log('[Translation] Using pre-cached CONTENT translation')
              } else if (data.sentences && Array.isArray(data.sentences)) {
                // Check if text matches any pre-cached sentence
                const matchingSentence = data.sentences.find((s: any) => s.originalText === text)
                if (matchingSentence) {
                  preCached = matchingSentence
                  console.log('[Translation] Using pre-cached SENTENCE translation')
                }
              }

              if (preCached) {
                console.log(
                  '%c[Translation] SOURCE: FIREBASE PRE-CACHE (fast)',
                  'color: #ff9900; font-weight: bold',
                  {
                    articleId: settings.articleId,
                    textPreview: text.substring(0, 30) + '...',
                  }
                )
                setUsageStats(prev => ({
                  ...prev,
                  cacheHits: prev.cacheHits + 1,
                  firebaseCacheHits: prev.firebaseCacheHits + 1,
                  lastUsed: new Date(),
                }))
                setIsLoading(false)
                return preCached
              } else {
                console.log('[Translation] Text not in pre-cache, will use API', {
                  textPreview: text.substring(0, 30),
                })
              }
            } else {
              console.log('[Translation] No pre-cache document found for article')
            }
          } catch (firebaseError) {
            console.warn(
              '[Translation] Firebase pre-cache check failed, falling back to API:',
              firebaseError
            )
            // Continue to API fallback
          }
        }

        // 🤖 STEP 1: Make AI request via server-side API with Firebase caching
        console.log(`🔍 Making translation API call for: "${text.substring(0, 50)}..." (${mode})`)

        const requestBody = {
          text,
          mode,
          userLevel: settings.userLevel,
          includeGrammarNotes: settings.includeGrammarNotes,
          preserveGrammarStructure: true, // Default to true for better learning experience
        }
        console.log(`[Translation] Request body:`, requestBody)

        const apiResponse = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        console.log(`[Translation] API Response status:`, {
          ok: apiResponse.ok,
          status: apiResponse.status,
          statusText: apiResponse.statusText,
          headers: Object.fromEntries(apiResponse.headers.entries()),
        })

        if (!apiResponse.ok) {
          throw new Error(`Translation API error: ${apiResponse.statusText}`)
        }

        const response = await apiResponse.json()
        console.log(`[Translation] API Response:`, {
          success: response.success,
          hasData: !!response.data,
          error: response.error,
          response: response,
        })

        if (response.success && response.data) {
          const result = response.data

          // Log cache status
          if (response.cached) {
            console.log(
              '%c[Translation] SOURCE: API CACHE (Firebase translation_cache)',
              'color: #00ff00; font-weight: bold',
              {
                responseTime: response.responseTime + 'ms',
              }
            )
            setUsageStats(prev => ({
              ...prev,
              cacheHits: prev.cacheHits + 1,
              firebaseCacheHits: prev.firebaseCacheHits + 1,
              lastUsed: new Date(),
            }))
          } else {
            console.log(
              '%c[Translation] SOURCE: API (OpenAI)',
              'color: #ff0000; font-weight: bold',
              {
                responseTime: response.responseTime + 'ms',
              }
            )
            setUsageStats(prev => ({
              ...prev,
              translationsRequested: prev.translationsRequested + 1,
              hintsRequested: mode === 'hints' ? prev.hintsRequested + 1 : prev.hintsRequested,
              cacheMisses: prev.cacheMisses + 1,
              costSaved: prev.costSaved + (response.usage?.estimatedCost || 0),
              lastUsed: new Date(),
            }))
          }

          // Auto-add vocabulary if enabled
          if (settings.autoAddToVocabulary && result.keyVocabulary) {
            result.keyVocabulary.forEach(
              (vocab: { word: string; meaning: string; difficulty: string }) => {
                if (vocab.difficulty === 'medium' || vocab.difficulty === 'hard') {
                  addToVocabulary(vocab.word, vocab.meaning)
                }
              }
            )
          }

          setIsLoading(false)
          return result
        } else {
          throw new Error(response.error || 'Translation failed')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Translation failed'
        setError(errorMessage)
        setIsLoading(false)
        return null
      }
    },
    [settings]
  )

  const getHints = useCallback(
    async (text: string): Promise<string[]> => {
      const result = await translateText(text, 'hints')
      return result?.hints?.map(h => h.explanation) || []
    },
    [translateText]
  )

  const getPartialTranslation = useCallback(
    async (text: string): Promise<TranslationResult | null> => {
      return translateText(text, 'partial')
    },
    [translateText]
  )

  const getFullTranslation = useCallback(
    async (text: string): Promise<TranslationResult | null> => {
      return translateText(text, 'full')
    },
    [translateText]
  )

  // ============================================
  // Batch Operations
  // ============================================

  const translateBatch = useCallback(
    async (
      texts: string[],
      mode: TranslationMode = settings.mode
    ): Promise<TranslationResult[]> => {
      if (mode === 'off') return []

      setIsLoading(true)
      setError(null)

      try {
        const results: TranslationResult[] = []

        // Process in chunks to avoid overwhelming the API
        const chunkSize = 3
        for (let i = 0; i < texts.length; i += chunkSize) {
          const chunk = texts.slice(i, i + chunkSize)
          const chunkPromises = chunk.map(text => translateText(text, mode))
          const chunkResults = await Promise.allSettled(chunkPromises)

          chunkResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
              results.push(result.value)
            } else {
              console.error(
                `Failed to translate text ${i + index}:`,
                result.status === 'rejected' ? result.reason : 'No result'
              )
            }
          })

          // Small delay between chunks
          if (i + chunkSize < texts.length) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }

        setIsLoading(false)
        return results
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Batch translation failed'
        setError(errorMessage)
        setIsLoading(false)
        return []
      }
    },
    [translateText, settings.mode]
  )

  // ============================================
  // Vocabulary Management
  // ============================================

  const addToVocabulary = useCallback((word: string, translation: string) => {
    setVocabulary(prev => {
      // Avoid duplicates
      if (prev.some(v => v.word === word)) return prev

      const newEntry = { word, translation, addedAt: new Date() }
      const updated = [...prev, newEntry]

      // Keep only last 100 entries
      return updated.slice(-100)
    })

    setUsageStats(prev => ({
      ...prev,
      vocabularyAdded: prev.vocabularyAdded + 1,
    }))
  }, [])

  const getVocabularyList = useCallback(() => {
    return vocabulary.slice().reverse() // Most recent first
  }, [vocabulary])

  // ============================================
  // Cache and Stats
  // ============================================

  const clearCache = useCallback(() => {
    setCache({}) // Clear local memory cache
    // Note: Firebase cache is persistent and managed separately
  }, [])

  const getCacheStats = useCallback(() => {
    const memorySize = Object.keys(cache).length
    const total = usageStats.cacheHits + usageStats.cacheMisses
    const memoryHitRate = total > 0 ? usageStats.cacheHits / total : 0

    return {
      memorySize,
      memoryHitRate,
      firebaseEnabled: true, // We're using Firebase cache
    }
  }, [cache, usageStats])

  // ============================================
  // Firebase-specific Features
  // ============================================

  const getPopularTranslations = useCallback(
    async (limit: number = 10): Promise<TranslationCacheDocument[]> => {
      try {
        // TODO: Implement API endpoint for popular translations
        // For now, return empty array to avoid server-side imports
        console.warn('getPopularTranslations: API endpoint not yet implemented')
        return []
      } catch (error) {
        console.error('Failed to get popular translations:', error)
        setFirebaseError(
          error instanceof Error ? error.message : 'Failed to get popular translations'
        )
        return []
      }
    },
    []
  )

  const getCacheAnalytics = useCallback(async () => {
    try {
      // TODO: Implement API endpoint for cache analytics
      // For now, return default values to avoid server-side imports
      console.warn('getCacheAnalytics: API endpoint not yet implemented')
      return {
        totalCachedTranslations: 0,
        cacheHitRate: 0,
        costSavings: 0,
        popularModes: [],
      }
    } catch (error) {
      console.error('Failed to get cache analytics:', error)
      setFirebaseError(error instanceof Error ? error.message : 'Failed to get analytics')
      return {
        totalCachedTranslations: 0,
        cacheHitRate: 0,
        costSavings: 0,
        popularModes: [],
      }
    }
  }, [])

  const getUsageStatsData = useCallback(
    () => ({
      translationsRequested: usageStats.translationsRequested,
      hintsRequested: usageStats.hintsRequested,
      vocabularyAdded: usageStats.vocabularyAdded,
      lastUsed: usageStats.lastUsed,
      cacheHits: usageStats.cacheHits,
      cacheMisses: usageStats.cacheMisses,
      firebaseCacheHits: usageStats.firebaseCacheHits,
      costSaved: usageStats.costSaved,
    }),
    [usageStats]
  )

  // ============================================
  // Persistence (localStorage)
  // ============================================

  useEffect(() => {
    // Load settings from localStorage
    if (typeof window !== 'undefined') {
      try {
        const savedSettings = localStorage.getItem('content_translation_settings')
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings)
          setSettings(prev => ({ ...prev, ...parsed }))
        }

        const savedVocabulary = localStorage.getItem('content_translation_vocabulary')
        if (savedVocabulary) {
          const parsed = JSON.parse(savedVocabulary)
          setVocabulary(
            parsed.map((v: any) => ({
              ...v,
              addedAt: new Date(v.addedAt),
            }))
          )
        }

        const savedStats = localStorage.getItem('content_translation_stats')
        if (savedStats) {
          const parsed = JSON.parse(savedStats)
          setUsageStats(prev => ({
            ...prev,
            ...parsed,
            lastUsed: parsed.lastUsed ? new Date(parsed.lastUsed) : null,
          }))
        }
      } catch (error) {
        console.error('Failed to load content translation data from localStorage:', error)
      }
    }
  }, [])

  useEffect(() => {
    // Save settings to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('content_translation_settings', JSON.stringify(settings))
      } catch (error) {
        console.error('Failed to save content translation settings:', error)
      }
    }
  }, [settings])

  useEffect(() => {
    // Save vocabulary to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('content_translation_vocabulary', JSON.stringify(vocabulary))
      } catch (error) {
        console.error('Failed to save content translation vocabulary:', error)
      }
    }
  }, [vocabulary])

  useEffect(() => {
    // Save stats to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('content_translation_stats', JSON.stringify(usageStats))
      } catch (error) {
        console.error('Failed to save content translation stats:', error)
      }
    }
  }, [usageStats])

  // ============================================
  // Return Hook Interface
  // ============================================

  return {
    // Settings
    settings,
    updateSettings,

    // Translation functions
    translateText,
    getHints,
    getPartialTranslation,
    getFullTranslation,

    // Batch operations
    translateBatch,

    // Cache management
    clearCache,
    getCacheStats,

    // Firebase-specific features
    getPopularTranslations,
    getCacheAnalytics,

    // State
    isLoading,
    error,
    firebaseError,

    // Vocabulary management
    addToVocabulary,
    getVocabularyList,

    // Enhanced statistics
    getUsageStats: getUsageStatsData,
  }
}

// ============================================
// Hook for Reading Settings Integration
// ============================================

export function useContentTranslationFromReadingSettings(readingSettings: ReadingSettings) {
  return useContentTranslation({
    mode: readingSettings.translationMode,
    userLevel: readingSettings.translationUserLevel,
    showConfidence: readingSettings.showTranslationConfidence,
    includeGrammarNotes: readingSettings.includeGrammarNotes,
    autoAddToVocabulary: readingSettings.autoAddToVocabulary,
  })
}

export default useContentTranslation
