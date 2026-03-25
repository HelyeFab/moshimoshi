type ReadingKind = 'onyomi' | 'kunyomi'

const PRIMARY_ONYOMI_LIMIT = 2
const PRIMARY_KUNYOMI_LIMIT = 3

export interface PrioritizedKanjiReadings {
  onyomi: string[]
  kunyomi: string[]
  primaryReading: string | null
  hasAdditionalOnyomi: boolean
  hasAdditionalKunyomi: boolean
  source: 'fallback'
}

const readingCache = new Map<string, PrioritizedKanjiReadings>()

function cleanReading(reading: string): string {
  return reading.replace(/[\.\-]/g, '').trim()
}

function isStandaloneStudyReading(reading: string): boolean {
  const trimmed = reading.trim()
  if (!trimmed) return false

  // Prefix/suffix-only readings should not become standalone study targets.
  // We still keep kanji-entry kunyomi like ひと- because the browser surfaces
  // them as real readings for the learner.
  if (trimmed.startsWith('-')) {
    return false
  }

  return true
}

function normalizeReadings(readings: string[], _kind: ReadingKind): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const reading of readings) {
    if (!isStandaloneStudyReading(reading)) continue

    const cleaned = cleanReading(reading)
    if (!cleaned || seen.has(cleaned)) continue

    seen.add(cleaned)
    result.push(cleaned)
  }

  return result
}

export async function getPrioritizedKanjiReadings(
  kanjiChar: string,
  onyomi: string[] = [],
  kunyomi: string[] = []
): Promise<PrioritizedKanjiReadings> {
  const cacheKey = `${kanjiChar}|${onyomi.join(',')}|${kunyomi.join(',')}`
  const cached = readingCache.get(cacheKey)
  if (cached) return cached

  // Source of truth is the kanji entry itself: preserve the browser's listed
  // readings, only normalizing JMdict punctuation markers and removing exact
  // duplicates or affix-style forms that are not standalone study targets.
  const normalizedOnyomi = normalizeReadings(onyomi, 'onyomi')
  const normalizedKunyomi = normalizeReadings(kunyomi, 'kunyomi')

  const result: PrioritizedKanjiReadings = {
    onyomi: normalizedOnyomi.slice(0, PRIMARY_ONYOMI_LIMIT),
    kunyomi: normalizedKunyomi.slice(0, PRIMARY_KUNYOMI_LIMIT),
    primaryReading: normalizedKunyomi[0] || normalizedOnyomi[0] || null,
    hasAdditionalOnyomi: normalizedOnyomi.length > PRIMARY_ONYOMI_LIMIT,
    hasAdditionalKunyomi: normalizedKunyomi.length > PRIMARY_KUNYOMI_LIMIT,
    source: 'fallback',
  }

  readingCache.set(cacheKey, result)
  return result
}
