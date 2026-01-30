/**
 * Blast Mode - Agent C Exports
 * Distractor & Tile Logic
 */

// Types
export type {
  BlastContentType,
  BlastStepType,
  BlastItem,
  BlastStep,
  BlastStepAnswer,
  BlastSessionConfig,
  BlastSessionStats,
  BlastSessionRecord,
  BlastLessonProgressRecord,
  BlastLessonInfo
} from './types'

// Phonetics Utilities
export {
  countMora,
  getPhoneticNeighbor,
  generatePhoneticNeighbors,
  arePhoneticallySimilar,
  normalizeReading,
  filterByMoraCount
} from './phonetics'

// Tile Splitter
export type { TileSplitStrategy, TileSplitResult } from './tile-splitter'
export {
  splitByMorpheme,
  splitByKanaChunk,
  splitByKanjiOrder,
  splitByCharacter,
  splitIntoTiles,
  shuffleTiles,
  validateTileAnswer
} from './tile-splitter'

// Distractors
export type { DistractorPool, DistractorOptions } from './distractors'
export {
  generateMeaningDistractors,
  generateJapaneseDistractors,
  generateReadingDistractors,
  buildMcqOptions,
  generateMeaningMcq,
  generateJapaneseMcq,
  generateReadingMcq
} from './distractors'

// Lesson Utilities
export {
  DEFAULT_LESSON_SIZE,
  splitIntoLessons,
  getLessonSlice,
  getLessonId,
  getNextLessonIndex,
  getMistakeSteps
} from './lesson-utils'
