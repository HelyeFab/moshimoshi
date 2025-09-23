'use client'

import { useState, useCallback } from 'react'
import { Kanji } from '@/types/kanji'

/**
 * Shared hook for managing KanjiDetailsModal state across the application
 *
 * Usage:
 * ```tsx
 * const { modalKanji, openKanjiDetails, closeKanjiDetails } = useKanjiDetails()
 *
 * // In your component:
 * <button onClick={() => openKanjiDetails(kanji)}>View Details</button>
 * <KanjiDetailsModal
 *   kanji={modalKanji}
 *   isOpen={!!modalKanji}
 *   onClose={closeKanjiDetails}
 * />
 * ```
 */
export function useKanjiDetails() {
  const [modalKanji, setModalKanji] = useState<Kanji | null>(null)

  const openKanjiDetails = useCallback((kanji: Kanji | string) => {
    if (typeof kanji === 'string') {
      // If only a kanji character is provided, create a minimal Kanji object
      // The modal will fetch additional data if needed
      setModalKanji({
        kanji: kanji,
        meaning: 'Loading...', // Will be fetched
        onyomi: [],
        kunyomi: [],
        jlpt: undefined,
        grade: undefined,
        frequency: undefined
      })
    } else {
      setModalKanji(kanji)
    }
  }, [])

  const closeKanjiDetails = useCallback(() => {
    setModalKanji(null)
  }, [])

  return {
    modalKanji,
    openKanjiDetails,
    closeKanjiDetails,
    isOpen: !!modalKanji
  }
}

/**
 * Helper function to extract kanji characters from text
 * Useful for vocabulary pages where kanji appears within words
 */
export function extractKanjiFromText(text: string): string[] {
  const kanjiRegex = /[\u4e00-\u9faf]/g
  const matches = text.match(kanjiRegex)
  return matches ? [...new Set(matches)] : []
}

/**
 * Helper function to check if a character is kanji
 */
export function isKanji(char: string): boolean {
  return /[\u4e00-\u9faf]/.test(char)
}