import { QuestionGenerator } from '@/lib/drill/question-generator'
import type { JapaneseWord } from '@/types/drill'
import type { ExtendedConjugationForms } from '@/types/conjugation'

describe('QuestionGenerator', () => {
  it('includes conjugationType on generated questions', () => {
    const word: JapaneseWord = {
      id: 'word_1',
      kanji: 'akai',
      kana: 'akai',
      meaning: 'red',
      type: 'i-adjective',
    }

    const conjugations = {
      present: 'akai',
      past: 'akatta',
      negative: 'akunai',
      pastNegative: 'akunakatta',
      teForm: 'akakute',
      negativeTeForm: 'akakunakute',
      provisional: 'akakereba',
      conditional: 'akakattara',
      polite: 'akai desu',
      politePast: 'akatta desu',
    } as unknown as ExtendedConjugationForms

    const question = QuestionGenerator.generateSingleQuestion(
      word,
      'past',
      'akatta',
      conjugations,
      'i-adjective'
    )

    expect(question).not.toBeNull()
    expect(question?.conjugationType).toBe('i-adjective')
  })
})
