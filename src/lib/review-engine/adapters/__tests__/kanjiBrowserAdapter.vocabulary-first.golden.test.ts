import fs from 'node:fs/promises'
import path from 'node:path'
import { KanjiBrowserAdapter } from '../KanjiBrowserAdapter'
import type { KanjiStudyCard } from '@/types/kanji-study'
import { normalizeKana } from '@/utils/kanjiVocabularyLookup'

type GoldenReadingExpectation = {
  kanji: string
  jlpt: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  reading: string
  readingType: 'onyomi' | 'kunyomi'
  expectedWord: string
  expectedReading: string
  expectedMeaningIncludes?: string
}

type AntiRegressionExpectation = {
  kanji: string
  jlpt: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  reading: string
  readingType: 'onyomi' | 'kunyomi'
  forbiddenWord?: string
  forbiddenMeaningIncludes?: string
}

const GOLDEN_SET: GoldenReadingExpectation[] = [
  {
    kanji: '人',
    jlpt: 'N5',
    reading: 'ジン',
    readingType: 'onyomi',
    expectedWord: '日本人',
    expectedReading: 'にほんじん',
    expectedMeaningIncludes: 'Japanese person',
  },
  {
    kanji: '人',
    jlpt: 'N5',
    reading: 'ニン',
    readingType: 'onyomi',
    expectedWord: '三人',
    expectedReading: 'さんにん',
    expectedMeaningIncludes: 'people',
  },
  {
    kanji: '一',
    jlpt: 'N5',
    reading: 'イチ',
    readingType: 'onyomi',
    expectedWord: '一番',
    expectedReading: 'いちばん',
    expectedMeaningIncludes: 'first',
  },
  {
    kanji: '日',
    jlpt: 'N5',
    reading: 'ニチ',
    readingType: 'onyomi',
    expectedWord: '一日',
    expectedReading: 'いちにち',
    expectedMeaningIncludes: 'day',
  },
  {
    kanji: '日',
    jlpt: 'N5',
    reading: 'ジツ',
    readingType: 'onyomi',
    expectedWord: '本日',
    expectedReading: 'ほんじつ',
    expectedMeaningIncludes: 'today',
  },
  {
    kanji: '子',
    jlpt: 'N5',
    reading: 'こ',
    readingType: 'kunyomi',
    expectedWord: '子ども',
    expectedReading: 'こども',
    expectedMeaningIncludes: 'child',
  },
  {
    kanji: '中',
    jlpt: 'N5',
    reading: 'なか',
    readingType: 'kunyomi',
    expectedWord: '真ん中',
    expectedReading: 'まんなか',
    expectedMeaningIncludes: 'middle',
  },
  {
    kanji: '中',
    jlpt: 'N5',
    reading: 'チュウ',
    readingType: 'onyomi',
    expectedWord: '中学校',
    expectedReading: 'ちゅうがっこう',
    expectedMeaningIncludes: 'school',
  },
  {
    kanji: '中',
    jlpt: 'N5',
    reading: 'ジュウ',
    readingType: 'onyomi',
    expectedWord: '年中',
    expectedReading: 'ねんじゅう',
    expectedMeaningIncludes: 'year',
  },
  {
    kanji: '出',
    jlpt: 'N5',
    reading: 'シュツ',
    readingType: 'onyomi',
    expectedWord: '出発',
    expectedReading: 'しゅっぱつ',
    expectedMeaningIncludes: 'depart',
  },
  {
    kanji: '上',
    jlpt: 'N5',
    reading: 'うえ',
    readingType: 'kunyomi',
    expectedWord: '上',
    expectedReading: 'うえ',
    expectedMeaningIncludes: 'above',
  },
  {
    kanji: '上',
    jlpt: 'N5',
    reading: 'ジョウ',
    readingType: 'onyomi',
    expectedWord: '上手',
    expectedReading: 'じょうず',
    expectedMeaningIncludes: 'skillful',
  },
  {
    kanji: '下',
    jlpt: 'N5',
    reading: 'した',
    readingType: 'kunyomi',
    expectedWord: '下',
    expectedReading: 'した',
    expectedMeaningIncludes: 'below',
  },
  {
    kanji: '生',
    jlpt: 'N5',
    reading: 'せい',
    readingType: 'onyomi',
    expectedWord: '学生',
    expectedReading: 'がくせい',
    expectedMeaningIncludes: 'student',
  },
  {
    kanji: '十',
    jlpt: 'N5',
    reading: 'ジュウ',
    readingType: 'onyomi',
    expectedWord: '十字',
    expectedReading: 'じゅうじ',
    expectedMeaningIncludes: 'cross',
  },
  {
    kanji: '土',
    jlpt: 'N5',
    reading: 'つち',
    readingType: 'kunyomi',
    expectedWord: '土',
    expectedReading: 'つち',
    expectedMeaningIncludes: 'earth',
  },
  {
    kanji: '度',
    jlpt: 'N4',
    reading: 'ど',
    readingType: 'onyomi',
    expectedWord: '何度',
    expectedReading: 'なんど',
    expectedMeaningIncludes: 'how many',
  },
  {
    kanji: '歩',
    jlpt: 'N4',
    reading: 'ホ',
    readingType: 'onyomi',
    expectedWord: '散歩',
    expectedReading: 'さんぽ',
    expectedMeaningIncludes: 'walk',
  },
  {
    kanji: '代',
    jlpt: 'N4',
    reading: 'ダイ',
    readingType: 'onyomi',
    expectedWord: '時代',
    expectedReading: 'じだい',
    expectedMeaningIncludes: 'era',
  },
  {
    kanji: '試',
    jlpt: 'N4',
    reading: 'シ',
    readingType: 'onyomi',
    expectedWord: '試験',
    expectedReading: 'しけん',
    expectedMeaningIncludes: 'exam',
  },
  {
    kanji: '試',
    jlpt: 'N4',
    reading: 'ためす',
    readingType: 'kunyomi',
    expectedWord: '試す',
    expectedReading: 'ためす',
    expectedMeaningIncludes: 'try',
  },
  {
    kanji: '術',
    jlpt: 'N3',
    reading: 'ジュツ',
    readingType: 'onyomi',
    expectedWord: '技術',
    expectedReading: 'ぎじゅつ',
    expectedMeaningIncludes: 'technology',
  },
  {
    kanji: '費',
    jlpt: 'N3',
    reading: 'ヒ',
    readingType: 'onyomi',
    expectedWord: '費用',
    expectedReading: 'ひよう',
    expectedMeaningIncludes: 'expense',
  },
  {
    kanji: '費',
    jlpt: 'N3',
    reading: 'ついやす',
    readingType: 'kunyomi',
    expectedWord: '費やす',
    expectedReading: 'ついやす',
    expectedMeaningIncludes: 'spend',
  },
  {
    kanji: '乳',
    jlpt: 'N2',
    reading: 'ニュウ',
    readingType: 'onyomi',
    expectedWord: '牛乳',
    expectedReading: 'ぎゅうにゅう',
    expectedMeaningIncludes: 'milk',
  },
  {
    kanji: '印',
    jlpt: 'N2',
    reading: 'イン',
    readingType: 'onyomi',
    expectedWord: '印鑑',
    expectedReading: 'いんかん',
    expectedMeaningIncludes: 'stamp',
  },
  {
    kanji: '城',
    jlpt: 'N2',
    reading: 'ジョウ',
    readingType: 'onyomi',
    expectedWord: '城郭',
    expectedReading: 'じょうかく',
    expectedMeaningIncludes: 'castle',
  },
  {
    kanji: '寺',
    jlpt: 'N2',
    reading: 'ジ',
    readingType: 'onyomi',
    expectedWord: '寺院',
    expectedReading: 'じいん',
    expectedMeaningIncludes: 'temple',
  },
  {
    kanji: '祭',
    jlpt: 'N2',
    reading: 'サイ',
    readingType: 'onyomi',
    expectedWord: '祭壇',
    expectedReading: 'さいだん',
    expectedMeaningIncludes: 'altar',
  },
  {
    kanji: '準',
    jlpt: 'N2',
    reading: 'ジュン',
    readingType: 'onyomi',
    expectedWord: '準備',
    expectedReading: 'じゅんび',
    expectedMeaningIncludes: 'preparation',
  },
  {
    kanji: '複',
    jlpt: 'N2',
    reading: 'フク',
    readingType: 'onyomi',
    expectedWord: '複雑',
    expectedReading: 'ふくざつ',
    expectedMeaningIncludes: 'complex',
  },
]

const ANTI_REGRESSION_SET: AntiRegressionExpectation[] = [
  {
    kanji: '子',
    jlpt: 'N5',
    reading: 'こ',
    readingType: 'kunyomi',
    forbiddenWord: '子',
  },
  {
    kanji: '人',
    jlpt: 'N5',
    reading: 'ジン',
    readingType: 'onyomi',
    forbiddenWord: '人',
    forbiddenMeaningIncludes: '-ian',
  },
  {
    kanji: '人',
    jlpt: 'N5',
    reading: 'ニン',
    readingType: 'onyomi',
    forbiddenWord: '人',
    forbiddenMeaningIncludes: 'counter for people',
  },
  {
    kanji: '一',
    jlpt: 'N5',
    reading: 'イチ',
    readingType: 'onyomi',
    forbiddenWord: '均一',
    forbiddenMeaningIncludes: 'uniformity',
  },
  {
    kanji: '中',
    jlpt: 'N5',
    reading: 'なか',
    readingType: 'kunyomi',
    forbiddenWord: '中',
  },
  {
    kanji: '中',
    jlpt: 'N5',
    reading: 'チュウ',
    readingType: 'onyomi',
    forbiddenWord: '中',
  },
  {
    kanji: '中',
    jlpt: 'N5',
    reading: 'ジュウ',
    readingType: 'onyomi',
    forbiddenWord: '間中',
    forbiddenMeaningIncludes: 'during',
  },
  {
    kanji: '出',
    jlpt: 'N5',
    reading: 'シュツ',
    readingType: 'onyomi',
    forbiddenWord: '出演',
    forbiddenMeaningIncludes: 'appearance',
  },
  {
    kanji: '日',
    jlpt: 'N5',
    reading: 'ニチ',
    readingType: 'onyomi',
    forbiddenWord: '日',
    forbiddenMeaningIncludes: 'sunday',
  },
  {
    kanji: '日',
    jlpt: 'N5',
    reading: 'ジツ',
    readingType: 'onyomi',
    forbiddenWord: '日',
  },
  {
    kanji: '乳',
    jlpt: 'N2',
    reading: 'ニュウ',
    readingType: 'onyomi',
    forbiddenWord: '乳児',
  },
  {
    kanji: '準',
    jlpt: 'N2',
    reading: 'ジュン',
    readingType: 'onyomi',
    forbiddenWord: '準',
  },
  {
    kanji: '複',
    jlpt: 'N2',
    reading: 'フク',
    readingType: 'onyomi',
    forbiddenWord: '複合',
  },
]

async function loadKanji(level: GoldenReadingExpectation['jlpt'], character: string) {
  const levelNumber = level.replace('N', '')
  const filePath = path.join(process.cwd(), 'public', 'data', 'kanji', `jlpt_${levelNumber}.json`)
  const raw = await fs.readFile(filePath, 'utf8')
  const list = JSON.parse(raw) as Array<{ kanji: string }>
  const entry = list.find(item => item.kanji === character)
  if (!entry) return entry

  return {
    ...entry,
    jlpt: level,
    jlptLevel: Number(levelNumber),
  }
}

function findVocabularyCard(
  cards: KanjiStudyCard[],
  reading: string,
  readingType: 'onyomi' | 'kunyomi'
) {
  return cards.find(
    card =>
      card.type === 'vocabulary' &&
      normalizeKana(card.targetReading) === normalizeKana(reading) &&
      card.readingType === readingType
  )
}

describe('KanjiBrowserAdapter vocabulary-first golden set', () => {
  const adapter = new KanjiBrowserAdapter()

  it.each(GOLDEN_SET)(
    'keeps $kanji $readingType $reading anchored to $expectedWord',
    async expectation => {
      const kanji = await loadKanji(expectation.jlpt, expectation.kanji)
      expect(kanji).toBeDefined()

      const sequence = await adapter.generateStudySequence(kanji)
      const card = findVocabularyCard(sequence.cards, expectation.reading, expectation.readingType)

      expect(card).toBeDefined()
      expect(card?.type).toBe('vocabulary')
      expect(card?.word).toBe(expectation.expectedWord)
      expect(card?.wordReading).toBe(expectation.expectedReading)

      if (expectation.expectedMeaningIncludes) {
        expect(card?.wordMeaning.toLowerCase()).toContain(
          expectation.expectedMeaningIncludes.toLowerCase()
        )
      }
    }
  )

  it.each(ANTI_REGRESSION_SET)(
    'does not regress $kanji $readingType $reading to historical bad picks',
    async expectation => {
      const kanji = await loadKanji(expectation.jlpt, expectation.kanji)
      expect(kanji).toBeDefined()

      const sequence = await adapter.generateStudySequence(kanji)
      const card = findVocabularyCard(sequence.cards, expectation.reading, expectation.readingType)

      expect(card).toBeDefined()
      expect(card?.type).toBe('vocabulary')

      if (expectation.forbiddenWord) {
        expect(card?.word).not.toBe(expectation.forbiddenWord)
      }

      if (expectation.forbiddenMeaningIncludes) {
        expect(card?.wordMeaning.toLowerCase()).not.toContain(
          expectation.forbiddenMeaningIncludes.toLowerCase()
        )
      }
    }
  )

  it('does not surface a bad N5 onyomi anchor for 一 / イツ', async () => {
    const kanji = await loadKanji('N5', '一')
    expect(kanji).toBeDefined()

    const sequence = await adapter.generateStudySequence(kanji)
    const card = findVocabularyCard(sequence.cards, 'イツ', 'onyomi')

    expect(card).toBeUndefined()
  })

  it('adds a reading-match reinforcement card after the summary when multiple vocabulary cards exist', async () => {
    const kanji = await loadKanji('N5', '見')
    expect(kanji).toBeDefined()

    const sequence = await adapter.generateStudySequence(kanji)
    const summaryIndex = sequence.cards.findIndex(card => card.type === 'reading-summary')
    const readingMatchCard = sequence.cards.find(card => card.type === 'reading-match')

    expect(summaryIndex).toBeGreaterThan(-1)
    expect(readingMatchCard).toBeDefined()
    expect(readingMatchCard?.type).toBe('reading-match')

    if (readingMatchCard?.type === 'reading-match') {
      expect(readingMatchCard.pairs.length).toBeGreaterThanOrEqual(2)
      expect(sequence.cards[summaryIndex + 1]?.id).toBe(readingMatchCard.id)

      const vocabularyWords = sequence.cards
        .filter((card): card is Extract<KanjiStudyCard, { type: 'vocabulary' }> => card.type === 'vocabulary')
        .map(card => card.word)

      expect(readingMatchCard.pairs.every(pair => vocabularyWords.includes(pair.word))).toBe(true)
    }
  })
})
