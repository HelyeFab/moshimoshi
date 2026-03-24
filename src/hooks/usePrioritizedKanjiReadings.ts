'use client'

import { useEffect, useState } from 'react'
import {
  getPrioritizedKanjiReadings,
  PrioritizedKanjiReadings,
} from '@/utils/kanjiReadingPriority'

const EMPTY_READINGS: PrioritizedKanjiReadings = {
  onyomi: [],
  kunyomi: [],
  primaryReading: null,
  hasAdditionalOnyomi: false,
  hasAdditionalKunyomi: false,
  source: 'fallback',
}

export function usePrioritizedKanjiReadings(
  kanjiChar?: string,
  onyomi: string[] = [],
  kunyomi: string[] = []
) {
  const [readings, setReadings] = useState<PrioritizedKanjiReadings>(EMPTY_READINGS)

  useEffect(() => {
    let isCancelled = false

    if (!kanjiChar) {
      setReadings(EMPTY_READINGS)
      return
    }

    getPrioritizedKanjiReadings(kanjiChar, onyomi, kunyomi).then(result => {
      if (!isCancelled) {
        setReadings(result)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [kanjiChar, kunyomi, onyomi])

  return readings
}
