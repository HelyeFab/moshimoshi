import type { Exercise, ExerciseFile } from './types'
import type { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { GrammarAdapter, GrammarExerciseContent } from '@/lib/review-engine/adapters/grammar.adapter'

export interface GrammarContentContext {
  grammarPointId?: string
  jlptLevel?: string
}

const adapter = new GrammarAdapter()

export function adaptGrammarExercise(
  exercise: Exercise,
  context: GrammarContentContext = {}
): ReviewableContent {
  const enriched: GrammarExerciseContent = {
    ...exercise,
    grammarPointId: context.grammarPointId,
    jlptLevel: context.jlptLevel,
  }
  return adapter.transform(enriched)
}

export function adaptGrammarExercises(
  exercises: Exercise[],
  context: GrammarContentContext = {}
): ReviewableContent[] {
  return exercises.flatMap(exercise => {
    if (exercise.type !== 'sentence-matching') {
      return adaptGrammarExercise(exercise, context)
    }

    return exercise.pairs.map((pair, index) => {
      const derived: GrammarExerciseContent = {
        ...exercise,
        id: `${exercise.id}-pair-${index + 1}`,
        pairs: [pair],
        pairIndex: index,
      }
      return adaptGrammarExercise(derived, context)
    })
  })
}

export function adaptGrammarExerciseFile(
  file: ExerciseFile,
  context: GrammarContentContext = {}
): ReviewableContent[] {
  return adaptGrammarExercises(file.exercises, {
    grammarPointId: file.grammarPointId,
    ...context,
  })
}

export function splitGrammarContentByMode(content: ReviewableContent[]) {
  return content.reduce(
    (acc, item) => {
      if (item.preferredMode === 'recall') {
        acc.recall.push(item)
      } else {
        acc.recognition.push(item)
      }
      return acc
    },
    { recognition: [] as ReviewableContent[], recall: [] as ReviewableContent[] }
  )
}
