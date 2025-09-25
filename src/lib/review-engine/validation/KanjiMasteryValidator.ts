import { BaseValidator } from './BaseValidator'
import { ValidationResult, ValidationStrategy } from './types'

export class KanjiMasteryValidator extends BaseValidator {
  validate(userInput: string, expectedAnswer: string, strategy: ValidationStrategy): ValidationResult {
    // Normalize inputs for Japanese text
    const normalizedInput = this.normalizeJapanese(userInput.trim())
    const normalizedExpected = this.normalizeJapanese(expectedAnswer.trim())

    // Handle different validation strategies
    switch (strategy) {
      case 'exact':
        return this.validateExact(normalizedInput, normalizedExpected)

      case 'fuzzy':
        return this.validateFuzzy(normalizedInput, normalizedExpected)

      case 'custom':
        return this.validateJapaneseReading(normalizedInput, normalizedExpected)

      default:
        return super.validate(userInput, expectedAnswer, strategy)
    }
  }

  private validateExact(input: string, expected: string): ValidationResult {
    const isCorrect = input === expected

    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      feedback: isCorrect ? 'Perfect!' : `Expected: ${expected}`,
      details: {
        userAnswer: input,
        expectedAnswer: expected,
        validationType: 'exact'
      }
    }
  }

  private validateFuzzy(input: string, expected: string): ValidationResult {
    // For meanings, allow some flexibility
    const inputWords = input.toLowerCase().split(/[,\s]+/).filter(w => w.length > 0)
    const expectedWords = expected.toLowerCase().split(/[,\s]+/).filter(w => w.length > 0)

    // Check if any of the main meaning words are present
    let matchCount = 0
    for (const inputWord of inputWords) {
      for (const expectedWord of expectedWords) {
        if (this.isSimilar(inputWord, expectedWord, 0.8)) {
          matchCount++
          break
        }
      }
    }

    const score = expectedWords.length > 0 ? matchCount / expectedWords.length : 0
    const isCorrect = score >= 0.7 // 70% threshold for meanings

    return {
      isCorrect,
      score,
      feedback: this.generateMeaningFeedback(score, expected),
      details: {
        userAnswer: input,
        expectedAnswer: expected,
        validationType: 'fuzzy',
        matchRatio: score
      }
    }
  }

  private validateJapaneseReading(input: string, expected: string): ValidationResult {
    // Handle multiple acceptable readings (separated by commas)
    const acceptableReadings = expected.split(',').map(r => this.normalizeJapanese(r.trim()))
    const normalizedInput = this.normalizeJapanese(input)

    // Check exact match first
    if (acceptableReadings.includes(normalizedInput)) {
      return {
        isCorrect: true,
        score: 1,
        feedback: 'Correct!',
        details: {
          userAnswer: input,
          expectedAnswer: expected,
          validationType: 'japanese_reading'
        }
      }
    }

    // Check with okurigana flexibility
    for (const reading of acceptableReadings) {
      if (this.matchesWithFlexibility(normalizedInput, reading)) {
        return {
          isCorrect: true,
          score: 0.95, // Slightly lower score for flexible match
          feedback: 'Correct! (Alternative reading accepted)',
          details: {
            userAnswer: input,
            expectedAnswer: expected,
            validationType: 'japanese_reading_flexible'
          }
        }
      }
    }

    // Check for partial matches (e.g., only on'yomi when kun'yomi was expected)
    const partialScore = this.calculatePartialReadingScore(normalizedInput, acceptableReadings)
    if (partialScore > 0) {
      return {
        isCorrect: false,
        score: partialScore,
        feedback: `Partial credit. Expected: ${expected}`,
        details: {
          userAnswer: input,
          expectedAnswer: expected,
          validationType: 'japanese_reading_partial',
          partialScore
        }
      }
    }

    return {
      isCorrect: false,
      score: 0,
      feedback: `Incorrect. Expected: ${expected}`,
      details: {
        userAnswer: input,
        expectedAnswer: expected,
        validationType: 'japanese_reading'
      }
    }
  }

  private normalizeJapanese(text: string): string {
    let normalized = text

    // Convert full-width characters to half-width
    normalized = normalized.replace(/[Ａ-Ｚａ-ｚ０-９]/g, char => {
      return String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
    })

    // Convert katakana to hiragana for comparison
    normalized = normalized.replace(/[\u30A1-\u30FA]/g, char => {
      return String.fromCharCode(char.charCodeAt(0) - 0x60)
    })

    // Handle long vowels (ー to う)
    normalized = normalized.replace(/ー/g, 'う')

    // Remove spaces
    normalized = normalized.replace(/\s+/g, '')

    return normalized
  }

  private matchesWithFlexibility(input: string, expected: string): boolean {
    // Check if matches without okurigana
    const inputBase = this.removeOkurigana(input)
    const expectedBase = this.removeOkurigana(expected)

    if (inputBase === expectedBase && inputBase.length > 0) {
      return true
    }

    // Check if one is a substring of the other (for compound readings)
    if (input.includes(expected) || expected.includes(input)) {
      return true
    }

    // Check for common variations
    const variations = this.generateCommonVariations(expected)
    return variations.includes(input)
  }

  private removeOkurigana(text: string): string {
    // Remove hiragana at the end (okurigana)
    return text.replace(/[\u3040-\u309F]+$/, '')
  }

  private generateCommonVariations(text: string): string[] {
    const variations = [text]

    // Add variation with 'う' replaced by 'ー'
    variations.push(text.replace(/う/g, 'ー'))

    // Add variation with small tsu doubled consonant
    variations.push(text.replace(/っ(.)/g, '$1$1'))

    // Add variations for common sound changes
    const soundChanges = [
      { from: 'づ', to: 'ず' },
      { from: 'ぢ', to: 'じ' },
      { from: 'を', to: 'お' }
    ]

    for (const change of soundChanges) {
      if (text.includes(change.from)) {
        variations.push(text.replace(new RegExp(change.from, 'g'), change.to))
      }
      if (text.includes(change.to)) {
        variations.push(text.replace(new RegExp(change.to, 'g'), change.from))
      }
    }

    return variations
  }

  private calculatePartialReadingScore(input: string, acceptableReadings: string[]): number {
    let maxScore = 0

    for (const reading of acceptableReadings) {
      // Calculate Levenshtein distance for partial credit
      const distance = this.levenshteinDistance(input, reading)
      const maxLength = Math.max(input.length, reading.length)

      if (maxLength > 0) {
        const similarity = 1 - (distance / maxLength)
        // Only give partial credit if similarity is above 50%
        if (similarity > 0.5) {
          maxScore = Math.max(maxScore, similarity * 0.5) // Max 50% for partial
        }
      }
    }

    return maxScore
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  private isSimilar(str1: string, str2: string, threshold: number): boolean {
    if (str1 === str2) return true

    const distance = this.levenshteinDistance(str1, str2)
    const maxLength = Math.max(str1.length, str2.length)

    if (maxLength === 0) return true

    const similarity = 1 - (distance / maxLength)
    return similarity >= threshold
  }

  private generateMeaningFeedback(score: number, expected: string): string {
    if (score >= 1) return 'Perfect!'
    if (score >= 0.9) return 'Excellent! Very close.'
    if (score >= 0.7) return 'Good! Acceptable answer.'
    if (score >= 0.5) return `Partial credit. Full answer: ${expected}`
    return `Incorrect. Expected: ${expected}`
  }

  // Override the base validateCustom to handle Japanese-specific rules
  validateCustom(userInput: string, expectedAnswer: string, customRules?: Record<string, any>): ValidationResult {
    if (customRules?.acceptableReadings) {
      // Use Japanese reading validation
      return this.validateJapaneseReading(userInput, customRules.acceptableReadings.join(', '))
    }

    if (customRules?.allowSynonyms && customRules?.validationType === 'meaning') {
      // Use fuzzy validation for meanings with synonym support
      return this.validateFuzzy(userInput, expectedAnswer)
    }

    return super.validateCustom(userInput, expectedAnswer, customRules)
  }
}