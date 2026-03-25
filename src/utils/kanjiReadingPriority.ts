import { toHiragana } from 'wanakana'
import { searchJMdictWords } from '@/utils/jmdictLocalSearch'

const PRIMARY_ONYOMI_LIMIT = 2
const PRIMARY_KUNYOMI_LIMIT = 3

type ReadingKind = 'onyomi' | 'kunyomi'

interface ReadingCandidate {
  raw: string
  original: string
  normalized: string
  kind: ReadingKind
  familyKey: string
  score: number
}

export interface PrioritizedKanjiReadings {
  onyomi: string[]
  kunyomi: string[]
  primaryReading: string | null
  hasAdditionalOnyomi: boolean
  hasAdditionalKunyomi: boolean
  source: 'jmdict' | 'fallback'
}

const readingCache = new Map<string, PrioritizedKanjiReadings>()

function cleanReading(reading: string): string {
  return reading.replace(/[\.\-]/g, '').trim()
}

function isStandaloneStudyReading(reading: string): boolean {
  const trimmed = reading.trim()
  if (!trimmed) return false

  // Dictionary-style affix forms like おお- or -てき should not become
  // standalone study targets in vocabulary-first mode.
  if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
    return false
  }

  return true
}

function normalizeKana(text: string): string {
  return toHiragana(cleanReading(text))
}

function getReadingFamilyKey(reading: string, kind: ReadingKind): string {
  const trimmed = reading.trim()
  if (kind === 'onyomi') {
    return cleanReading(trimmed)
  }

  const base = trimmed.split('.')[0] || trimmed
  return cleanReading(base)
}

function dedupeKunyomiFamilies(readings: string[]): string[] {
  const deduped: string[] = []
  const seenFamilies = new Set<string>()

  for (const reading of readings) {
    const familyKey = getReadingFamilyKey(reading, 'kunyomi')
    if (!familyKey || seenFamilies.has(familyKey)) continue
    seenFamilies.add(familyKey)
    deduped.push(reading)
  }

  return deduped
}

function createFallbackReadings(
  onyomi: string[],
  kunyomi: string[]
): PrioritizedKanjiReadings {
  const cleanedOnyomi = Array.from(
    new Set(onyomi.filter(isStandaloneStudyReading).map(cleanReading).filter(Boolean))
  )
  const cleanedKunyomi = dedupeKunyomiFamilies(Array.from(
    new Set(kunyomi.filter(isStandaloneStudyReading).map(cleanReading).filter(Boolean))
  ))

  return {
    onyomi: cleanedOnyomi.slice(0, PRIMARY_ONYOMI_LIMIT),
    kunyomi: cleanedKunyomi.slice(0, PRIMARY_KUNYOMI_LIMIT),
    primaryReading: cleanedKunyomi[0] || cleanedOnyomi[0] || null,
    hasAdditionalOnyomi: cleanedOnyomi.length > PRIMARY_ONYOMI_LIMIT,
    hasAdditionalKunyomi: cleanedKunyomi.length > PRIMARY_KUNYOMI_LIMIT,
    source: 'fallback',
  }
}

function buildCandidates(onyomi: string[], kunyomi: string[]): ReadingCandidate[] {
  const candidates: ReadingCandidate[] = []
  const seen = new Set<string>()

  for (const reading of onyomi) {
    if (!isStandaloneStudyReading(reading)) continue
    const cleaned = cleanReading(reading)
    if (!cleaned) continue
    const key = `onyomi:${cleaned}`
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push({
      raw: reading,
      original: cleaned,
      normalized: normalizeKana(cleaned),
      kind: 'onyomi',
      familyKey: getReadingFamilyKey(reading, 'onyomi'),
      score: 0,
    })
  }

  for (const reading of kunyomi) {
    if (!isStandaloneStudyReading(reading)) continue
    const cleaned = cleanReading(reading)
    if (!cleaned) continue
    const key = `kunyomi:${cleaned}`
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push({
      raw: reading,
      original: cleaned,
      normalized: normalizeKana(cleaned),
      kind: 'kunyomi',
      familyKey: getReadingFamilyKey(reading, 'kunyomi'),
      score: 0,
    })
  }

  return candidates
}

function getTagPriorityScore(tags: string[] = []): number {
  let score = 0

  for (const tag of tags) {
    if (tag === 'news1') score += 120
    else if (tag === 'ichi1') score += 110
    else if (tag === 'spec1') score += 90
    else if (tag === 'news2') score += 70
    else if (tag === 'ichi2') score += 65
    else if (/^nf\d{2}$/.test(tag)) {
      const band = Number(tag.slice(2))
      score += Math.max(0, 50 - band)
    }
  }

  return score
}

function getWordTypeScore(type?: string): number {
  switch (type) {
    case 'noun':
      return 30
    case 'verb':
      return 24
    case 'i-adjective':
    case 'na-adjective':
      return 18
    default:
      return 8
  }
}

function scoreWordForKanji(kanjiChar: string, wordKanji: string, index: number): number {
  let score = Math.max(0, 120 - index * 3)

  if (wordKanji === kanjiChar) {
    score += 180
  } else if (wordKanji.startsWith(kanjiChar) || wordKanji.endsWith(kanjiChar)) {
    score += 45
  }

  if (wordKanji.length === 1) score += 100
  else if (wordKanji.length === 2) score += 60
  else if (wordKanji.length === 3) score += 30
  else if (wordKanji.length >= 5) score -= 20

  return score
}

function scoreReadingMatch(
  candidate: ReadingCandidate,
  kana: string,
  wordKanji: string
): number {
  if (!kana) return 0

  const kanaNorm = normalizeKana(kana)
  if (!kanaNorm) return 0

  if (candidate.kind === 'kunyomi') {
    if (kanaNorm === candidate.normalized) return 170
    if (kanaNorm.startsWith(candidate.normalized)) return 120
    if (kanaNorm.includes(candidate.normalized)) return 85
    return 0
  }

  if (wordKanji.length === 1 && kanaNorm === candidate.normalized) {
    return 75
  }
  if (kanaNorm.includes(candidate.normalized)) return 105
  if (candidate.normalized.includes(kanaNorm)) return 30
  return 0
}

export async function getPrioritizedKanjiReadings(
  kanjiChar: string,
  onyomi: string[] = [],
  kunyomi: string[] = []
): Promise<PrioritizedKanjiReadings> {
  const cacheKey = `${kanjiChar}|${onyomi.join(',')}|${kunyomi.join(',')}`
  const cached = readingCache.get(cacheKey)
  if (cached) return cached

  const fallback = createFallbackReadings(onyomi, kunyomi)
  const candidates = buildCandidates(onyomi, kunyomi)

  if (candidates.length === 0) {
    readingCache.set(cacheKey, fallback)
    return fallback
  }

  try {
    const words = await searchJMdictWords(kanjiChar, 80)
    const relevantWords = words.filter(word => (word.kanji || '').includes(kanjiChar))

    relevantWords.forEach((word, index) => {
      const wordKanji = word.kanji || ''
      const baseScore =
        scoreWordForKanji(kanjiChar, wordKanji, index) +
        getTagPriorityScore(word.tags || []) +
        getWordTypeScore(word.type)

      for (const candidate of candidates) {
        candidate.score += baseScore + scoreReadingMatch(candidate, word.kana || '', wordKanji)
      }
    })

    const rankedOnyomi = candidates
      .filter(candidate => candidate.kind === 'onyomi')
      .sort((a, b) => b.score - a.score)
      .map(candidate => candidate.original)

    const rankedKunyomi = candidates
      .filter(candidate => candidate.kind === 'kunyomi')
      .sort((a, b) => b.score - a.score)
      .filter((candidate, index, list) =>
        list.findIndex(other => other.familyKey === candidate.familyKey) === index
      )
      .map(candidate => candidate.original)

    const result: PrioritizedKanjiReadings = {
      onyomi: (rankedOnyomi.length > 0 ? rankedOnyomi : fallback.onyomi).slice(0, PRIMARY_ONYOMI_LIMIT),
      kunyomi: (rankedKunyomi.length > 0 ? rankedKunyomi : fallback.kunyomi).slice(0, PRIMARY_KUNYOMI_LIMIT),
      primaryReading:
        (rankedKunyomi.length > 0 ? rankedKunyomi[0] : fallback.kunyomi[0]) ||
        (rankedOnyomi.length > 0 ? rankedOnyomi[0] : fallback.onyomi[0]) ||
        null,
      hasAdditionalOnyomi: fallback.hasAdditionalOnyomi,
      hasAdditionalKunyomi: fallback.hasAdditionalKunyomi,
      source: relevantWords.length > 0 ? 'jmdict' : 'fallback',
    }

    readingCache.set(cacheKey, result)
    return result
  } catch (error) {
    console.error('[Kanji Readings] Falling back to default order:', error)
    readingCache.set(cacheKey, fallback)
    return fallback
  }
}
