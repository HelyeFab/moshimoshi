/**
 * Kanji Mastery Validator
 * Specialized validator for kanji mastery sessions with Japanese-specific validation rules
 */

import { BaseValidator, ValidationResult, ValidationOptions } from './base-validator'

export interface KanjiMasteryValidationContext {
  validationType?: 'meaning' | 'reading' | 'writing' | 'example'
  acceptableReadings?: string[]
  allowSynonyms?: boolean
}

export class KanjiMasteryValidator extends BaseValidator {
  constructor(options: ValidationOptions = {}) {
    super({
      caseSensitive: false,
      ignoreSpaces: true,
      fuzzyThreshold: 0.85,
      ...options
    })
  }

  validate(
    userAnswer: string,
    correctAnswer: string | string[],
    context?: KanjiMasteryValidationContext
  ): ValidationResult {
    const validationType = context?.validationType || 'meaning'
    const expected = Array.isArray(correctAnswer) ? correctAnswer.join(', ') : correctAnswer

    // Handle different validation strategies based on type
    switch (validationType) {
      case 'writing':
        return this.validateExact(userAnswer, expected)

      case 'reading':
        return this.validateJapaneseReading(userAnswer, expected, context?.acceptableReadings)

      case 'meaning':
        return this.validateMeaning(userAnswer, expected)

      default:
        return this.validateMeaning(userAnswer, expected)
    }
  }

  private validateExact(input: string, expected: string): ValidationResult {
    const isCorrect = this.normalize(input) === this.normalize(expected)

    return {
      isCorrect,
      confidence: isCorrect ? 1 : 0,
      feedback: isCorrect ? 'Perfect!' : `Expected: ${expected}`,
      corrections: isCorrect ? undefined : [expected]
    }
  }

  private validateMeaning(input: string, expected: string): ValidationResult {
    // For meanings, allow some flexibility
    const inputWords = this.normalize(input).split(/[,\s]+/).filter(w => w.length > 0)
    const expectedWords = this.normalize(expected).split(/[,\s]+/).filter(w => w.length > 0)

    // Check if any of the main meaning words are present
    let matchCount = 0
    for (const inputWord of inputWords) {
      for (const expectedWord of expectedWords) {
        if (this.calculateSimilarity(inputWord, expectedWord) >= (this.options.fuzzyThreshold || 0.8)) {
          matchCount++
          break
        }
      }
    }

    const score = expectedWords.length > 0 ? matchCount / expectedWords.length : 0
    const isCorrect = score >= 0.7 // 70% threshold for meanings

    return {
      isCorrect,
      confidence: score,
      partialCredit: score,
      feedback: this.generateMeaningFeedback(score, expected),
      corrections: isCorrect ? undefined : [expected]
    }
  }

  private validateJapaneseReading(
    input: string,
    expected: string,
    acceptableReadings?: string[]
  ): ValidationResult {
    // Handle multiple acceptable readings (separated by commas)
    const readings = acceptableReadings || expected.split(',').map(r => r.trim())
    const normalizedReadings = readings.map(r => this.normalizeJapanese(r))
    const normalizedInput = this.normalizeJapanese(input)

    // Check exact match first
    if (normalizedReadings.includes(normalizedInput)) {
      return {
        isCorrect: true,
        confidence: 1,
        feedback: 'Correct!'
      }
    }

    // Check with okurigana flexibility
    for (const reading of normalizedReadings) {
      if (this.matchesWithFlexibility(normalizedInput, reading)) {
        return {
          isCorrect: true,
          confidence: 0.95, // Slightly lower score for flexible match
          feedback: 'Correct! (Alternative reading accepted)'
        }
      }
    }

    // Check for partial matches
    const partialScore = this.calculatePartialReadingScore(normalizedInput, normalizedReadings)
    if (partialScore > 0) {
      return {
        isCorrect: false,
        confidence: partialScore,
        partialCredit: partialScore,
        feedback: `Partial credit. Expected: ${expected}`,
        corrections: readings
      }
    }

    return {
      isCorrect: false,
      confidence: 0,
      feedback: `Incorrect. Expected: ${expected}`,
      corrections: readings
    }
  }

  private normalizeJapanese(text: string): string {
    let normalized = text.trim()

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
      const similarity = this.calculateSimilarity(input, reading)
      // Only give partial credit if similarity is above 50%
      if (similarity > 0.5) {
        maxScore = Math.max(maxScore, similarity * 0.5) // Max 50% for partial
      }
    }

    return maxScore
  }

  private generateMeaningFeedback(score: number, expected: string): string {
    if (score >= 1) return 'Perfect!'
    if (score >= 0.9) return 'Excellent! Very close.'
    if (score >= 0.7) return 'Good! Acceptable answer.'
    if (score >= 0.5) return `Partial credit. Full answer: ${expected}`
    return `Incorrect. Expected: ${expected}`
  }
}
