import type { JLPTLevel } from '@/types/kanji'
import { toHiragana } from 'wanakana'

export type OverrideReadingType = 'onyomi' | 'kunyomi'
export type OverrideConfidence = 'high' | 'medium' | 'low'

export interface CuratedVocabularyCandidate {
  word: string
  wordReading: string
  meaning: string
  reason: string
  confidence: OverrideConfidence
  isCommonWord?: boolean
  notes?: string
}

export interface CuratedReadingOverrideSet {
  kunyomi?: Record<string, CuratedVocabularyCandidate[]>
  onyomi?: Record<string, CuratedVocabularyCandidate[]>
}

export interface CuratedKanjiVocabularyOverride extends CuratedReadingOverrideSet {
  jlpt?: JLPTLevel
  notes?: string
}

export type KanjiVocabularyOverrideMap = Record<string, CuratedKanjiVocabularyOverride>

function normalizeReadingKey(reading: string): string {
  return toHiragana(reading.replace(/[\.\-]/g, '').trim())
}

/**
 * Curated vocabulary overrides
 *
 * This is intentionally sparse.
 * The heuristic JMdict-backed ranking remains the global default, and we only
 * add overrides when a kanji+reading pair needs pedagogical correction.
 */
export const kanjiVocabularyOverrides: KanjiVocabularyOverrideMap = {
  子: {
    jlpt: 'N5',
    notes: 'N5 required override: single-mora こ is too ambiguous without curation.',
    kunyomi: {
      こ: [
        {
          word: '子ども',
          wordReading: 'こども',
          meaning: 'child',
          reason: 'Universal beginner vocabulary and the clearest high-frequency realization of 子 as こ.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  人: {
    jlpt: 'N5',
    notes: 'Live QA override: prevent bare affix/counter senses and use stable learner-facing examples for onyomi readings.',
    onyomi: {
      じん: [
        {
          word: '日本人',
          wordReading: 'にほんじん',
          meaning: 'Japanese person',
          reason: 'Concrete, high-frequency, and far better pedagogically than suffix-like bare 人 senses.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
      にん: [
        {
          word: '三人',
          wordReading: 'さんにん',
          meaning: 'three people',
          reason: 'Teaches the counter reading in a natural counted form instead of an unnatural bare dictionary sense.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  生: {
    jlpt: 'N5',
    notes: 'N5 required overrides: preserve core life semantics and avoid okurigana/abstract-compound drift.',
    kunyomi: {
      いきる: [
        {
          word: '生きる',
          wordReading: 'いきる',
          meaning: 'to live',
          reason: 'Core beginner verb and the clearest いきる reading.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
    onyomi: {
      せい: [
        {
          word: '学生',
          wordReading: 'がくせい',
          meaning: 'student',
          reason: 'High-frequency beginner vocabulary that is more pedagogically central than abstract せい compounds.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  上: {
    jlpt: 'N5',
    notes: 'N5 required overrides: separate location, movement, and onyomi usage cleanly. Standalone うえ remains intentional because it is itself a core lexical item.',
    kunyomi: {
      うえ: [
        {
          word: '上',
          wordReading: 'うえ',
          meaning: 'above; top; up',
          reason: 'Best standalone positional example for the core うえ meaning.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
      あがる: [
        {
          word: '上がる',
          wordReading: 'あがる',
          meaning: 'to rise; to go up',
          reason: 'Separates movement from the positional うえ reading.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
    onyomi: {
      じょう: [
        {
          word: '上手',
          wordReading: 'じょうず',
          meaning: 'skillful; good at',
          reason: 'Common N5-level adjective and a much better first onyomi teaching word than abstract compounds.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  下: {
    jlpt: 'N5',
    notes: 'N5 required override: preserve the core positional meaning separately from movement readings. Standalone した remains intentional because it is itself a core lexical item.',
    kunyomi: {
      した: [
        {
          word: '下',
          wordReading: 'した',
          meaning: 'below; under; beneath',
          reason: 'Best standalone positional example and direct pair with 上.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  中: {
    jlpt: 'N5',
    notes: 'N5 required override: prefer fuller lexical items for なか/チュウ while avoiding opaque ジュウ examples.',
    kunyomi: {
      なか: [
        {
          word: '真ん中',
          wordReading: 'まんなか',
          meaning: 'middle; center',
          reason: 'Shows the reading in a real, high-frequency lexical item instead of collapsing back to bare-kanji memorization.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
    onyomi: {
      ちゅう: [
        {
          word: '中学校',
          wordReading: 'ちゅうがっこう',
          meaning: 'junior high school',
          reason: 'A concrete, high-frequency learner word that is better than bare 中 or abstract compounds for first exposure.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
      じゅう: [
        {
          word: '年中',
          wordReading: 'ねんじゅう',
          meaning: 'all year round',
          reason: 'A natural, common ジュウ example and much better teaching material than opaque forms like 間中.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  日: {
    jlpt: 'N5',
    notes: 'Live QA override: avoid bare dictionary-sense onyomi picks and teach 日 through clearer real words.',
    onyomi: {
      にち: [
        {
          word: '一日',
          wordReading: 'いちにち',
          meaning: 'one day',
          reason: 'A much better first real-word anchor for ニチ than bare 日 with context-dependent senses.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
      じつ: [
        {
          word: '本日',
          wordReading: 'ほんじつ',
          meaning: 'today',
          reason: 'Concrete and common enough to teach ジツ more cleanly than abstract alternatives.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  一: {
    jlpt: 'N5',
    notes: 'Live QA override: avoid abstract イツ compounds like 均一 when a simpler lexical item exists.',
    onyomi: {
      いつ: [
        {
          word: '唯一',
          wordReading: 'ゆいいつ',
          meaning: 'only; unique',
          reason: 'A clearer and more usable first イツ example than highly abstract alternatives like 均一.',
          confidence: 'medium',
          isCommonWord: true,
        },
      ],
    },
  },
  度: {
    jlpt: 'N4',
    notes: 'N4 required override: prioritize everyday usage over technical temperature vocabulary.',
    onyomi: {
      ど: [
        {
          word: '何度',
          wordReading: 'なんど',
          meaning: 'how many times; how many degrees',
          reason: 'Much more conversationally useful than 温度 for first exposure.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  歩: {
    jlpt: 'N4',
    notes: 'N4 required override: pick the common everyday onyomi compound.',
    onyomi: {
      ほ: [
        {
          word: '散歩',
          wordReading: 'さんぽ',
          meaning: 'walk; stroll',
          reason: 'Concrete and high-utility compared with more abstract alternatives.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  試: {
    jlpt: 'N4',
    notes: 'N4 required overrides: teach both kun readings and the highest-utility onyomi compound.',
    kunyomi: {
      ためす: [
        {
          word: '試す',
          wordReading: 'ためす',
          meaning: 'to try; to test',
          reason: 'Base verb form is the clearest first exposure for this kun reading.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
      こころみる: [
        {
          word: '試みる',
          wordReading: 'こころみる',
          meaning: 'to attempt; to try',
          reason: 'Ensures the second major kun reading is taught explicitly rather than buried.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
    onyomi: {
      し: [
        {
          word: '試験',
          wordReading: 'しけん',
          meaning: 'exam; examination',
          reason: 'High-frequency and highly relevant vocabulary for learners despite the academic register.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  代: {
    jlpt: 'N4',
    notes: 'N4 required override: keep the first onyomi example concrete and broadly useful.',
    onyomi: {
      だい: [
        {
          word: '時代',
          wordReading: 'じだい',
          meaning: 'era; period',
          reason: 'More concrete and pedagogically accessible than generation/demographic compounds.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  出: {
    jlpt: 'N5',
    notes: 'Live QA override: avoid domain-heavy シュツ compounds and use a more everyday, semantically transparent first example.',
    onyomi: {
      しゅつ: [
        {
          word: '出発',
          wordReading: 'しゅっぱつ',
          meaning: 'departure; to depart',
          reason: 'Much clearer and more broadly useful than media-specific examples like 出演.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  術: {
    jlpt: 'N3',
    notes: 'Validated N3 required override: the live heuristic currently picks bare 術 instead of 技術.',
    onyomi: {
      じゅつ: [
        {
          word: '技術',
          wordReading: 'ぎじゅつ',
          meaning: 'technology; technique',
          reason: 'Broad modern-use vocabulary and a better first teaching word than bare 術 or narrower domain compounds.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  費: {
    jlpt: 'N3',
    notes: 'Validated N3 required override: the live heuristic currently picks bare 費 instead of 費用.',
    onyomi: {
      ひ: [
        {
          word: '費用',
          wordReading: 'ひよう',
          meaning: 'cost; expense',
          reason: 'Practical and semantically transparent vocabulary that teaches the reading better than bare 費.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  乳: {
    jlpt: 'N2',
    notes: 'Validated N2/N1 required override: the live heuristic currently surfaces 乳児 before 牛乳.',
    onyomi: {
      にゅう: [
        {
          word: '牛乳',
          wordReading: 'ぎゅうにゅう',
          meaning: "(cow's) milk",
          reason: 'Everyday vocabulary and a much more appropriate first teaching word than anatomical or age-category compounds.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  準: {
    jlpt: 'N2',
    notes: 'Validated N2 required override: the live heuristic currently picks bare 準 instead of 準備.',
    onyomi: {
      じゅん: [
        {
          word: '準備',
          wordReading: 'じゅんび',
          meaning: 'preparation',
          reason: 'High-frequency practical vocabulary and a stronger first exposure than bare 準 or formal compounds.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
  複: {
    jlpt: 'N2',
    notes: 'Validated N2 required override: the live heuristic currently picks 複合 before 複雑.',
    onyomi: {
      ふく: [
        {
          word: '複雑',
          wordReading: 'ふくざつ',
          meaning: 'complex; complicated',
          reason: 'Common everyday adjective and a better first teaching example than technical compound alternatives.',
          confidence: 'high',
          isCommonWord: true,
        },
      ],
    },
  },
}

export function getCuratedVocabularyCandidates(
  kanjiCharacter: string,
  reading: string,
  readingType: OverrideReadingType
): CuratedVocabularyCandidate[] {
  const override = kanjiVocabularyOverrides[kanjiCharacter]
  if (!override) return []

  const readingMap = readingType === 'kunyomi' ? override.kunyomi : override.onyomi
  if (!readingMap) return []

  const exactCandidates = readingMap[reading]
  if (exactCandidates) {
    return [...exactCandidates]
  }

  const normalizedReading = normalizeReadingKey(reading)
  const normalizedKey = Object.keys(readingMap).find(
    key => normalizeReadingKey(key) === normalizedReading
  )
  const candidates = normalizedKey ? readingMap[normalizedKey] : undefined

  return candidates ? [...candidates] : []
}
