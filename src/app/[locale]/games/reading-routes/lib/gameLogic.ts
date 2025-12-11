import type { KanjiItem, ReadingOption, GameQuestion } from '../types/reading-routes'
import { kanaToRomaji } from './kanaToRomaji'

// Common word patterns and their contexts
const WORD_CONTEXTS: Record<string, { words: string[]; readingType: 'on' | 'kun' | 'mixed' }> = {
  '水': {
    words: ['水曜日', '水泳', '水分', '水道', '水'],
    readingType: 'mixed' // Uses スイ in compounds, みず alone
  },
  '火': {
    words: ['火曜日', '火事', '火山', '花火', '火'],
    readingType: 'mixed' // Uses カ in compounds, ひ alone
  },
  '木': {
    words: ['木曜日', '木材', '木造', '大木', '木'],
    readingType: 'mixed' // Uses モク/ボク in compounds, き alone
  },
  '金': {
    words: ['金曜日', '金額', '金属', '黄金', '金'],
    readingType: 'mixed' // Uses キン in compounds, かね alone
  },
  '土': {
    words: ['土曜日', '土地', '土砂', '粘土', '土'],
    readingType: 'mixed' // Uses ド in compounds, つち alone
  },
  '日': {
    words: ['日曜日', '日本', '今日', '明日', '日'],
    readingType: 'mixed' // Uses ニチ/ジツ in compounds, ひ alone
  },
  '月': {
    words: ['月曜日', '今月', '月光', '満月', '月'],
    readingType: 'mixed' // Uses ゲツ/ガツ in compounds, つき alone
  },
  '山': {
    words: ['山道', '富士山', '山脈', '登山', '山'],
    readingType: 'mixed' // Uses サン in compounds, やま alone
  },
  '川': {
    words: ['河川', '川岸', '小川', '川'],
    readingType: 'mixed' // Uses セン in some compounds, かわ in others
  },
  '人': {
    words: ['人間', '日本人', '一人', '人々', '人'],
    readingType: 'mixed' // Uses ジン/ニン in compounds, ひと alone
  },
  '大': {
    words: ['大学', '大切', '大きい', '大人', '大'],
    readingType: 'mixed'
  },
  '小': {
    words: ['小学校', '小説', '小さい', '小川', '小'],
    readingType: 'mixed'
  },
  '中': {
    words: ['中学', '中国', '中心', '中', '途中'],
    readingType: 'mixed'
  },
  '上': {
    words: ['上手', '以上', '上る', '上', '屋上'],
    readingType: 'mixed'
  },
  '下': {
    words: ['下手', '以下', '下る', '下', '地下'],
    readingType: 'mixed'
  }
}

// Sentence templates for context
const SENTENCE_TEMPLATES = [
  '{word}はとても大切です。',
  '私は{word}が好きです。',
  '明日は{word}に行きます。',
  '{word}を見てください。',
  'この{word}は美しいです。',
  '{word}について勉強しています。',
  '毎日{word}を練習します。',
  '{word}がありますか。',
  '新しい{word}を買いました。',
  '{word}はどこですか。'
]

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function generateReadingOptions(kanji: KanjiItem, correctType: 'on' | 'kun'): ReadingOption[] {
  const options: ReadingOption[] = []

  // Handle both old (nested) and new (flat) structure for readings
  const onReadings = kanji.readings?.on || kanji.onyomi || []
  const kunReadings = kanji.readings?.kun || kanji.kunyomi || []

  // Add correct reading
  if (correctType === 'on' && onReadings.length > 0) {
    options.push({
      id: `on-0`,
      reading: onReadings[0],
      romaji: kanaToRomaji(onReadings[0]),
      type: 'on'
    })
  } else if (correctType === 'kun' && kunReadings.length > 0) {
    options.push({
      id: `kun-0`,
      reading: kunReadings[0],
      romaji: kanaToRomaji(kunReadings[0]),
      type: 'kun'
    })
  }

  // Add other readings as options
  onReadings.forEach((reading, index) => {
    if (!(correctType === 'on' && index === 0)) {
      options.push({
        id: `on-${index}`,
        reading,
        romaji: kanaToRomaji(reading),
        type: 'on'
      })
    }
  })

  kunReadings.forEach((reading, index) => {
    if (!(correctType === 'kun' && index === 0)) {
      options.push({
        id: `kun-${index}`,
        reading,
        romaji: kanaToRomaji(reading),
        type: 'kun'
      })
    }
  })

  // Ensure we have at least 3 options by adding plausible distractors
  const distractorReadings = {
    on: ['カン', 'セン', 'シン', 'ケン', 'コウ', 'ショウ', 'ジョウ', 'チョウ', 'ソウ', 'トウ', 'ガク', 'セイ', 'ダイ', 'チュウ'],
    kun: ['たつ', 'かえる', 'あう', 'みる', 'きく', 'いう', 'おもう', 'つくる', 'もつ', 'なる', 'おおきい', 'ちいさい', 'うえ', 'した']
  }

  while (options.length < 3) {
    const type = options.length % 2 === 0 ? 'on' : 'kun'
    const availableDistractors = distractorReadings[type].filter(
      reading => !options.some(opt => opt.reading === reading)
    )

    if (availableDistractors.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableDistractors.length)
      const reading = availableDistractors[randomIndex]

      options.push({
        id: `distractor-${options.length}`,
        reading,
        romaji: kanaToRomaji(reading),
        type
      })
    } else {
      // Fallback if we run out of distractors
      break
    }
  }

  // Limit to 4 options max
  return shuffleArray(options.slice(0, 4))
}

export async function generateGameQuestions(kanjiList: KanjiItem[]): Promise<GameQuestion[]> {
  const questions: GameQuestion[] = []

  for (const kanji of kanjiList) {
    const contexts = WORD_CONTEXTS[kanji.char]

    if (contexts && contexts.words.length > 0) {
      // Create questions for different contexts
      const compoundWord = contexts.words.find(w => w.length > 1 && w.includes(kanji.char))
      const standaloneWord = contexts.words.find(w => w === kanji.char)

      // Question 1: Compound word (usually on'yomi)
      if (compoundWord) {
        const correctType = compoundWord.length > 1 ? 'on' : 'kun'
        const onReadings = kanji.readings?.on || kanji.onyomi || []
        const kunReadings = kanji.readings?.kun || kanji.kunyomi || []
        const correctReading = correctType === 'on'
          ? onReadings[0]
          : kunReadings[0]

        if (correctReading) {
          questions.push({
            kanji,
            context: compoundWord,
            contextType: 'word',
            correctReading: {
              id: `${correctType}-0`,
              reading: correctReading,
              romaji: kanaToRomaji(correctReading),
              type: correctType
            },
            options: generateReadingOptions(kanji, correctType),
            explanation: `In compound words, kanji often use ${correctType}'yomi readings.`
          })
        }
      }

      // Question 2: Standalone (usually kun'yomi)
      const kunReadingsStandalone = kanji.readings?.kun || kanji.kunyomi || []
      if (standaloneWord && kunReadingsStandalone.length > 0) {
        questions.push({
          kanji,
          context: standaloneWord,
          contextType: 'word',
          correctReading: {
            id: 'kun-0',
            reading: kunReadingsStandalone[0],
            romaji: kanaToRomaji(kunReadingsStandalone[0]),
            type: 'kun'
          },
          options: generateReadingOptions(kanji, 'kun'),
          explanation: 'When kanji stands alone, it typically uses kun\'yomi reading.'
        })
      }

      // Question 3: In a sentence
      const sentenceTemplate = SENTENCE_TEMPLATES[Math.floor(Math.random() * SENTENCE_TEMPLATES.length)]
      const wordForSentence = contexts.words[Math.floor(Math.random() * contexts.words.length)]
      const sentence = sentenceTemplate.replace('{word}', wordForSentence)
      const sentenceCorrectType = wordForSentence.length > 1 ? 'on' : 'kun'
      const onReadingsSentence = kanji.readings?.on || kanji.onyomi || []
      const kunReadingsSentence = kanji.readings?.kun || kanji.kunyomi || []
      const sentenceCorrectReading = sentenceCorrectType === 'on'
        ? onReadingsSentence[0]
        : kunReadingsSentence[0]

      if (sentenceCorrectReading) {
        questions.push({
          kanji,
          context: sentence,
          contextType: 'sentence',
          correctReading: {
            id: `${sentenceCorrectType}-0`,
            reading: sentenceCorrectReading,
            romaji: kanaToRomaji(sentenceCorrectReading),
            type: sentenceCorrectType
          },
          options: generateReadingOptions(kanji, sentenceCorrectType),
          explanation: `In "${wordForSentence}", the kanji uses ${sentenceCorrectType}'yomi.`
        })
      }
    } else {
      // Fallback for kanji without predefined contexts
      const onReadingsFallback = kanji.readings?.on || kanji.onyomi || []
      const kunReadingsFallback = kanji.readings?.kun || kanji.kunyomi || []

      if (onReadingsFallback.length > 0) {
        questions.push({
          kanji,
          context: kanji.char + '学',
          contextType: 'word',
          correctReading: {
            id: 'on-0',
            reading: onReadingsFallback[0],
            romaji: kanaToRomaji(onReadingsFallback[0]),
            type: 'on'
          },
          options: generateReadingOptions(kanji, 'on'),
          explanation: 'In compound words, on\'yomi reading is commonly used.'
        })
      }

      if (kunReadingsFallback.length > 0) {
        questions.push({
          kanji,
          context: kanji.char,
          contextType: 'word',
          correctReading: {
            id: 'kun-0',
            reading: kunReadingsFallback[0],
            romaji: kanaToRomaji(kunReadingsFallback[0]),
            type: 'kun'
          },
          options: generateReadingOptions(kanji, 'kun'),
          explanation: 'When used alone, kun\'yomi reading is typically used.'
        })
      }
    }
  }

  return shuffleArray(questions).slice(0, 10) // Limit to 10 questions per game
}