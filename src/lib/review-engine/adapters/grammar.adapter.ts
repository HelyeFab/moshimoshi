/**
 * Adapter for transforming grammar exercises into ReviewableContent
 */

import { BaseContentAdapter } from './base.adapter'
import { ReviewableContent } from '../core/interfaces'
import { ReviewMode } from '../core/types'
import type {
  Exercise,
  MultipleChoiceExercise,
  FillInBlankExercise,
  SentenceMatchingExercise,
} from '@/lib/grammar/types'

export type GrammarExerciseContent = Exercise & {
  grammarPointId?: string
  jlptLevel?: string
  pairIndex?: number
}

export class GrammarAdapter extends BaseContentAdapter<GrammarExerciseContent> {
  transform(exercise: GrammarExerciseContent): ReviewableContent {
    const { primaryAnswer, alternativeAnswers } = this.getAnswerData(exercise)
    const { supportedModes, preferredMode } = this.getModesForExercise(exercise)
    const primaryDisplay =
      exercise.type === 'sentence-matching'
        ? this.getSentencePrimaryDisplay(exercise)
        : exercise.question
    const secondaryDisplay =
      exercise.type === 'sentence-matching'
        ? this.getSentenceSecondaryDisplay(exercise)
        : exercise.questionRomaji

    return {
      id: exercise.id,
      contentType: 'grammar',
      primaryDisplay,
      secondaryDisplay,
      tertiaryDisplay: this.getTertiaryDisplay(exercise),
      primaryAnswer,
      alternativeAnswers,
      difficulty: this.mapDifficulty(exercise.difficulty),
      tags: this.buildTags(exercise),
      supportedModes,
      preferredMode,
      metadata: {
        exerciseType: exercise.type,
        questionRomaji: exercise.questionRomaji,
        correctFeedback: exercise.correctFeedback,
        incorrectFeedback: exercise.incorrectFeedback,
        explanation: exercise.explanation,
        grammarPointId: exercise.grammarPointId,
        jlptLevel: exercise.jlptLevel,
        options: exercise.type === 'multiple-choice' ? exercise.options : undefined,
        hints: exercise.type === 'fill-in-blank' ? exercise.hints : undefined,
        pairs: exercise.type === 'sentence-matching' ? exercise.pairs : undefined,
      },
    }
  }

  private getSentencePrimaryDisplay(exercise: SentenceMatchingExercise): string {
    const pair = this.getSentencePair(exercise)
    if (!pair) return exercise.question
    return `Translate to Japanese: ${pair.english}`
  }

  private getSentenceSecondaryDisplay(exercise: SentenceMatchingExercise): string | undefined {
    const pair = this.getSentencePair(exercise)
    if (!pair) return undefined
    return pair.romaji ? `Romaji: ${pair.romaji}` : undefined
  }

  getSupportedModes(): ReviewMode[] {
    return ['recognition', 'recall']
  }

  prepareForMode(content: ReviewableContent, mode: ReviewMode): ReviewableContent {
    if (mode === 'recall') {
      return {
        ...content,
        secondaryDisplay: content.primaryDisplay,
      }
    }

    return content
  }

  private getModesForExercise(exercise: Exercise): {
    supportedModes: ReviewMode[]
    preferredMode: ReviewMode
  } {
    switch (exercise.type) {
      case 'fill-in-blank':
        return { supportedModes: ['recall'], preferredMode: 'recall' }
      case 'sentence-matching':
        return { supportedModes: ['recall'], preferredMode: 'recall' }
      default:
        return { supportedModes: ['recognition'], preferredMode: 'recognition' }
    }
  }

  private getAnswerData(exercise: Exercise): {
    primaryAnswer: string
    alternativeAnswers?: string[]
  } {
    switch (exercise.type) {
      case 'multiple-choice': {
        const correctOption = exercise.options.find(
          option => option.id === exercise.correctAnswer
        )
        return {
          primaryAnswer: correctOption?.text || exercise.correctAnswer,
        }
      }
      case 'fill-in-blank':
        return {
          primaryAnswer: exercise.correctAnswer,
          alternativeAnswers: exercise.acceptedVariations || [],
        }
      case 'sentence-matching': {
        const pair = this.getSentencePair(exercise)
        if (!pair) {
          return { primaryAnswer: '' }
        }
        const formatted = pair.japanese
        return {
          primaryAnswer: formatted,
          alternativeAnswers: pair.romaji ? [pair.romaji] : undefined,
        }
      }
      default:
        return { primaryAnswer: '' }
    }
  }

  private getTertiaryDisplay(exercise: Exercise): string | undefined {
    if (exercise.type === 'multiple-choice') {
      const options = exercise.options
        .map(option => `${option.id.toUpperCase()}. ${option.text}`)
        .join('\n')
      return options
    }

    if (exercise.type === 'fill-in-blank') {
      return exercise.hints?.length ? exercise.hints.join('\n') : undefined
    }

    if (exercise.type === 'sentence-matching') {
      const pair = this.getSentencePair(exercise)
      if (!pair) return undefined
      return pair.romaji ? `Romaji: ${pair.romaji}` : undefined
    }

    return undefined
  }

  private getSentencePair(exercise: SentenceMatchingExercise) {
    if (exercise.pairs.length === 0) return null
    if (exercise.pairs.length === 1) return exercise.pairs[0]
    const index =
      typeof (exercise as GrammarExerciseContent).pairIndex === 'number'
        ? (exercise as GrammarExerciseContent).pairIndex!
        : 0
    return exercise.pairs[Math.min(index, exercise.pairs.length - 1)]
  }

  private mapDifficulty(
    difficulty: Exercise['difficulty']
  ): number {
    switch (difficulty) {
      case 'easy':
        return 0.25
      case 'medium':
        return 0.55
      case 'hard':
        return 0.8
      default:
        return 0.5
    }
  }

  private buildTags(exercise: GrammarExerciseContent): string[] {
    const tags = ['grammar', exercise.difficulty]
    if (exercise.grammarPointId) {
      tags.push(exercise.grammarPointId)
    }
    if (exercise.jlptLevel) {
      tags.push(exercise.jlptLevel)
    }
    return tags
  }
}
