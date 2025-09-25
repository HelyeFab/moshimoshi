import { BaseContentAdapter } from './BaseContentAdapter'
import { ReviewableContent } from '../core/interfaces'
import { ContentType } from '../core/types'

export interface KanjiMasteryContent {
  id: string
  character: string
  meaning: string[]
  onyomi: string[]
  kunyomi: string[]
  jlpt?: string
  grade?: number
  strokes?: number
  examples?: Array<{
    word: string
    reading: string
    meaning: string
  }>
  sentences?: Array<{
    japanese: string
    english: string
  }>
  round?: number // Current round in the mastery session
  sessionId?: string
}

export class KanjiMasteryAdapter extends BaseContentAdapter<KanjiMasteryContent> {
  getContentType(): ContentType {
    return 'kanji'
  }

  async transform(content: KanjiMasteryContent): Promise<ReviewableContent> {
    // Determine validation type based on round
    const validationType = this.determineValidationType(content.round)

    return {
      id: `kanji_mastery_${content.id}_${content.sessionId || Date.now()}`,
      type: this.getContentType(),
      content: {
        question: this.formatQuestion(content, validationType),
        answer: this.formatAnswer(content, validationType),
        alternatives: this.getAlternatives(content, validationType),
        hint: this.formatHint(content),
        explanation: this.formatExplanation(content)
      },
      metadata: {
        kanjiId: content.id,
        character: content.character,
        jlpt: content.jlpt,
        grade: content.grade,
        strokes: content.strokes,
        round: content.round || 1,
        sessionId: content.sessionId,
        validationType,
        difficulty: this.calculateDifficulty(content),
        tags: this.generateTags(content),
        lastReviewed: new Date().toISOString()
      },
      validation: {
        strategy: this.getValidationStrategy(validationType),
        acceptableAnswers: this.getAcceptableAnswers(content, validationType),
        caseSensitive: false,
        fuzzyMatchThreshold: validationType === 'writing' ? 1.0 : 0.85,
        partialCreditEnabled: validationType !== 'writing',
        customRules: this.getCustomValidationRules(content, validationType)
      }
    }
  }

  private determineValidationType(round?: number): 'meaning' | 'reading' | 'writing' | 'example' {
    // Round 1: Learn (no validation needed, just exposure)
    // Round 2: Test (various types)
    // Round 3: Evaluate (self-assessment)

    if (!round || round === 1) return 'meaning'
    if (round === 2) {
      // Randomly select validation type for round 2
      const types: Array<'meaning' | 'reading' | 'writing'> = ['meaning', 'reading', 'writing']
      return types[Math.floor(Math.random() * types.length)]
    }
    return 'meaning' // Default for round 3 (self-evaluation)
  }

  private formatQuestion(content: KanjiMasteryContent, validationType: string): string {
    switch (validationType) {
      case 'meaning':
        return content.character
      case 'reading':
        return `${content.character} (${content.meaning[0]})`
      case 'writing':
        return content.meaning[0]
      case 'example':
        return content.examples?.[0]?.word || content.character
      default:
        return content.character
    }
  }

  private formatAnswer(content: KanjiMasteryContent, validationType: string): string {
    switch (validationType) {
      case 'meaning':
        return content.meaning.join(', ')
      case 'reading':
        return [...content.onyomi, ...content.kunyomi].join(', ')
      case 'writing':
        return content.character
      case 'example':
        return content.examples?.[0]?.meaning || content.meaning[0]
      default:
        return content.meaning[0]
    }
  }

  private getAlternatives(content: KanjiMasteryContent, validationType: string): string[] {
    // Return alternative valid answers
    switch (validationType) {
      case 'meaning':
        return content.meaning
      case 'reading':
        return [...content.onyomi, ...content.kunyomi]
      case 'writing':
        return [content.character]
      default:
        return []
    }
  }

  private formatHint(content: KanjiMasteryContent): string {
    const hints = []
    if (content.jlpt) hints.push(`JLPT ${content.jlpt}`)
    if (content.strokes) hints.push(`${content.strokes} strokes`)
    if (content.examples?.length) {
      hints.push(`Example: ${content.examples[0].word}`)
    }
    return hints.join(' • ')
  }

  private formatExplanation(content: KanjiMasteryContent): string {
    const parts = []

    parts.push(`Kanji: ${content.character}`)
    parts.push(`Meaning: ${content.meaning.join(', ')}`)

    if (content.onyomi.length > 0) {
      parts.push(`On'yomi: ${content.onyomi.join(', ')}`)
    }

    if (content.kunyomi.length > 0) {
      parts.push(`Kun'yomi: ${content.kunyomi.join(', ')}`)
    }

    if (content.examples?.length) {
      const example = content.examples[0]
      parts.push(`Example: ${example.word} (${example.reading}) - ${example.meaning}`)
    }

    return parts.join('\n')
  }

  private calculateDifficulty(content: KanjiMasteryContent): number {
    // Calculate difficulty based on JLPT level, stroke count, and reading count
    let difficulty = 0.5 // Base difficulty

    // JLPT level contribution
    if (content.jlpt) {
      const jlptLevels: Record<string, number> = {
        'N5': 0.2, 'N4': 0.35, 'N3': 0.5, 'N2': 0.7, 'N1': 0.9
      }
      difficulty = jlptLevels[content.jlpt] || 0.5
    }

    // Stroke count contribution
    if (content.strokes) {
      const strokeDifficulty = Math.min(content.strokes / 25, 1) * 0.2
      difficulty += strokeDifficulty
    }

    // Reading complexity
    const readingCount = content.onyomi.length + content.kunyomi.length
    const readingDifficulty = Math.min(readingCount / 10, 1) * 0.1
    difficulty += readingDifficulty

    return Math.min(Math.max(difficulty, 0), 1) // Clamp between 0 and 1
  }

  private generateTags(content: KanjiMasteryContent): string[] {
    const tags = ['kanji_mastery']

    if (content.jlpt) tags.push(`jlpt_${content.jlpt.toLowerCase()}`)
    if (content.grade) tags.push(`grade_${content.grade}`)
    if (content.round) tags.push(`round_${content.round}`)

    // Add difficulty tags
    const difficulty = this.calculateDifficulty(content)
    if (difficulty < 0.33) tags.push('beginner')
    else if (difficulty < 0.66) tags.push('intermediate')
    else tags.push('advanced')

    return tags
  }

  private getValidationStrategy(validationType: string): 'exact' | 'fuzzy' | 'custom' {
    switch (validationType) {
      case 'writing':
        return 'exact' // Kanji character must be exact
      case 'meaning':
        return 'fuzzy' // Allow some flexibility in English meanings
      case 'reading':
        return 'custom' // Use custom Japanese validation rules
      default:
        return 'fuzzy'
    }
  }

  private getAcceptableAnswers(content: KanjiMasteryContent, validationType: string): string[] {
    switch (validationType) {
      case 'meaning':
        return content.meaning
      case 'reading':
        // Include all readings with and without okurigana
        const readings = [...content.onyomi, ...content.kunyomi]
        const variations: string[] = []

        readings.forEach(reading => {
          variations.push(reading)
          // Add hiragana-only version if it contains kanji
          if (/[\u4e00-\u9faf]/.test(reading)) {
            // This would need a proper kanji-to-hiragana converter
            variations.push(reading)
          }
        })

        return variations
      case 'writing':
        return [content.character]
      default:
        return []
    }
  }

  private getCustomValidationRules(content: KanjiMasteryContent, validationType: string): Record<string, any> {
    if (validationType === 'reading') {
      return {
        allowHiraganaKatakanaVariation: true,
        allowOkuriganaOmission: true,
        allowLongVowelVariation: true, // ou vs ō
        acceptableReadings: [...content.onyomi, ...content.kunyomi]
      }
    }

    if (validationType === 'meaning') {
      return {
        allowSynonyms: true,
        ignoredWords: ['the', 'a', 'an', 'to'], // Common articles/particles
        allowPartialMatch: true,
        minMatchRatio: 0.7
      }
    }

    return {}
  }

  async validate(userInput: string, expected: ReviewableContent): Promise<boolean> {
    const validationType = expected.metadata?.validationType || 'meaning'

    // Use the appropriate validator based on validation type
    if (validationType === 'reading') {
      return this.validateJapaneseReading(userInput, expected)
    }

    return super.validate(userInput, expected)
  }

  private validateJapaneseReading(userInput: string, expected: ReviewableContent): boolean {
    const acceptableAnswers = expected.validation?.acceptableAnswers || []
    const normalizedInput = this.normalizeJapanese(userInput)

    for (const answer of acceptableAnswers) {
      const normalizedAnswer = this.normalizeJapanese(answer)

      if (normalizedInput === normalizedAnswer) {
        return true
      }

      // Check with okurigana flexibility
      if (this.matchesWithOkuriganaFlexibility(normalizedInput, normalizedAnswer)) {
        return true
      }
    }

    return false
  }

  private normalizeJapanese(text: string): string {
    // Convert katakana to hiragana for comparison
    return text.replace(/[\u30A0-\u30FF]/g, char => {
      return String.fromCharCode(char.charCodeAt(0) - 0x60)
    })
  }

  private matchesWithOkuriganaFlexibility(input: string, expected: string): boolean {
    // Remove potential okurigana (hiragana at the end) and compare
    const inputBase = input.replace(/[\u3040-\u309F]+$/, '')
    const expectedBase = expected.replace(/[\u3040-\u309F]+$/, '')

    return inputBase === expectedBase && inputBase.length > 0
  }
}