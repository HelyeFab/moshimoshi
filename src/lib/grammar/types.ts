export interface ExerciseFile {
  grammarPointId: string
  version: string
  totalExercises: number
  exercises: Exercise[]
}

export type ExerciseType = 'multiple-choice' | 'fill-in-blank' | 'sentence-matching'

export interface BaseExercise {
  id: string
  type: ExerciseType
  question: string
  questionRomaji?: string
  correctFeedback: string
  incorrectFeedback: string
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface MultipleChoiceExercise extends BaseExercise {
  type: 'multiple-choice'
  options: MultipleChoiceOption[]
  correctAnswer: string // "a", "b", "c", "d"
}

export interface MultipleChoiceOption {
  id: string
  text: string
  romaji?: string
}

export interface FillInBlankExercise extends BaseExercise {
  type: 'fill-in-blank'
  correctAnswer: string
  acceptedVariations?: string[]
  hints?: string[]
}

export interface SentenceMatchingExercise extends BaseExercise {
  type: 'sentence-matching'
  pairs: SentencePair[]
}

export interface SentencePair {
  japanese: string
  romaji: string
  english: string
}

export type Exercise =
  | MultipleChoiceExercise
  | FillInBlankExercise
  | SentenceMatchingExercise

export interface ExerciseResult {
  isCorrect: boolean
  message: string
  correctAnswer?: string
  explanation?: string
}

export interface GrammarPointIndex {
  id: string
  order: number
  category: string
  title: {
    ja: string
    romaji: string
    en: string
  }
  shortDescription: string
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export interface GrammarPoint {
  id: string
  version: string
  title: {
    ja: string
    romaji: string
    en: string
  }
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  category: string
  explanation: {
    en: string
    ja: string
  }
  structure: {
    pattern: string
    components: StructureComponent[]
  }
  examples: Example[]
  relatedPoints: string[]
  commonMistakes?: CommonMistake[]
  tags: string[]
}

export interface StructureComponent {
  part: string
  explanation: string
  examples: string[]
}

export interface Example {
  japanese: string
  romaji: string
  english: string
  breakdown: Record<string, string>
  notes?: string
}

export interface CommonMistake {
  mistake: string
  correction: string
  example: string
}

export interface GrammarIndexFile {
  version: string
  jlptLevel: string
  totalPoints: number
  lastUpdated: string
  points: GrammarPointIndex[]
}

export interface GrammarPointsIndexMap {
  version: string
  lastUpdated: string
  points: Record<string, string>
}

export interface GrammarChapter {
  id: string
  order: number
  title: Record<string, string>
  points: string[]
}

export interface GrammarChaptersFile {
  version: string
  jlptLevel: string
  lastUpdated: string
  chapters: GrammarChapter[]
}

export interface GrammarCategoryLabelsFile {
  version: string
  lastUpdated: string
  labels: Record<string, Record<string, string>>
}
