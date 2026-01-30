/**
 * Blast Mode Step Generator
 * Generates adaptive step sequences based on content type and available data
 */

import { BlastItem, BlastStep, BlastStepType } from './types'
import {
  generateMeaningMcq,
  generateJapaneseMcq,
  generateReadingMcq,
  DistractorPool
} from './distractors'
import { splitIntoTiles, shuffleTiles } from './tile-splitter'

interface GenerationContext {
  usedDistractors: Set<string>
}

/**
 * Generate blast steps for all items
 * Applies adaptive rules based on content type and available data
 * @param items - Array of BlastItems to generate steps for
 * @param pool - Optional distractor pool
 * @param rng - Optional random number generator (0-1), defaults to Math.random
 */
export function generateBlastSteps(items: BlastItem[], pool?: DistractorPool, rng?: () => number): BlastStep[] {
  const steps: BlastStep[] = []
  const ctx: GenerationContext = { usedDistractors: new Set() }

  for (const item of items) {
    const itemSteps = generateStepsForItem(item, pool, ctx, rng)
    steps.push(...itemSteps)
  }

  return steps
}

/**
 * Generate steps for a single item with adaptive rules
 */
function generateStepsForItem(
  item: BlastItem,
  pool: DistractorPool | undefined,
  ctx: GenerationContext,
  rng?: () => number
): BlastStep[] {
  const steps: BlastStep[] = []

  // Step 1: Meaning → Japanese (MCQ)
  // Always included for all content types
  steps.push(createMeaningToJpStep(item, pool, ctx, rng))

  // Step 2: Reassemble (Tiles)
  // Included for all except pure sentences (to be refined by Agent D)
  if (item.contentType !== 'sentence' || item.tokens) {
    steps.push(createReassembleStep(item, pool, ctx, rng))
  }

  // Steps 3-5: Reading MCQs (for items with readings metadata)
  // Include reading steps when item.readings exists, even for non-kanji items
  if (item.readings) {
    // Step 3: Onyomi (if available)
    if (item.readings.onyomi && item.readings.onyomi.length > 0) {
      steps.push(createOnyomiStep(item, pool, ctx, rng))
    }

    // Step 4: Kunyomi (if available)
    if (item.readings.kunyomi && item.readings.kunyomi.length > 0) {
      steps.push(createKunyomiStep(item, pool, ctx, rng))
    }

    // Step 5: Other Reading (secondary reading if available)
    const otherReading = pickOtherReading(item.readings)
    if (otherReading) {
      steps.push(createOtherReadingStep(item, otherReading, pool, ctx, rng))
    }
  }

  // Step 6: Japanese → Meaning (MCQ)
  // Always included for all content types
  steps.push(createJpToMeaningStep(item, pool, ctx, rng))

  return steps
}

function pickOtherReading(
  readings?: BlastItem['readings']
): string | null {
  if (!readings) return null

  const onyomi = readings.onyomi || []
  const kunyomi = readings.kunyomi || []
  const other = readings.other || []

  const candidates = [...onyomi.slice(1), ...kunyomi.slice(1), ...other]
  return candidates[0] || null
}

/**
 * Step 1: Meaning → Japanese (MCQ)
 */
function createMeaningToJpStep(
  item: BlastItem,
  pool: DistractorPool | undefined,
  ctx: GenerationContext,
  rng?: () => number
): BlastStep {
  const correctAnswer = item.kanji || item.kana || ''
  const mcq = generateJapaneseMcq(item, pool, Array.from(ctx.usedDistractors), rng)
  mcq.options.forEach(option => {
    if (option !== correctAnswer) ctx.usedDistractors.add(option)
  })

  return {
    stepType: 'meaning_to_jp_mcq',
    itemId: item.id,
    prompt: item.meaningEn,
    answer: correctAnswer,
    options: mcq.options,
    metadata: {
      contentType: item.contentType,
      correctIndex: mcq.correctIndex
    }
  }
}

/**
 * Step 2: Reassemble (Tiles)
 */
function createReassembleStep(
  item: BlastItem,
  pool: DistractorPool | undefined,
  ctx: GenerationContext,
  rng?: () => number
): BlastStep {
  // Use Agent C's tile splitter which is item-aware and deterministic
  const tileResult = splitIntoTiles(item)
  const correctTiles = tileResult.tiles

  // Single-tile case: add distractor tiles so user must pick the correct tile
  let tiles = correctTiles
  if (correctTiles.length === 1) {
    const mcq = generateJapaneseMcq(item, pool, Array.from(ctx.usedDistractors), rng)
    tiles = mcq.options
    mcq.options.forEach(option => {
      if (option !== correctTiles[0]) ctx.usedDistractors.add(option)
    })
  } else if (correctTiles.length < 4) {
    const needed = 4 - correctTiles.length
    const distractors = pickDistractorTiles(item, pool, ctx, correctTiles, needed)
    tiles = [...correctTiles, ...distractors]
    distractors.forEach(d => ctx.usedDistractors.add(d))
  }

  const shuffledTiles = shuffleTiles(tiles, rng)

  return {
    stepType: 'jp_reassemble',
    itemId: item.id,
    prompt: item.meaningEn,
    answer: correctTiles,
    tiles: shuffledTiles,
    metadata: {
      contentType: item.contentType,
      tileSplitStrategy: tileResult.strategy,
      confidence: tileResult.confidence,
      singleTileWithDistractors: correctTiles.length === 1
    }
  }
}

function pickDistractorTiles(
  item: BlastItem,
  pool: DistractorPool | undefined,
  ctx: GenerationContext,
  correctTiles: string[],
  needed: number
): string[] {
  if (!pool || needed <= 0) return []

  const candidates: string[] = []

  if (pool.kanji && pool.kanji.length > 0) {
    candidates.push(...pool.kanji)
  }

  if (pool.vocabulary && pool.vocabulary.length > 0) {
    for (const vocab of pool.vocabulary) {
      const text = vocab.kanji || vocab.kana
      if (!text) continue
      candidates.push(...text.split(''))
    }
  }

  const unique = Array.from(
    new Set(
      candidates.filter(
        t => t && !correctTiles.includes(t) && !ctx.usedDistractors.has(t)
      )
    )
  )

  // Prefer kanji for kanji content
  const filtered = item.contentType === 'kanji'
    ? unique.filter(t => /[\u4E00-\u9FFF]/.test(t))
    : unique

  return filtered.slice(0, needed)
}

/**
 * Step 3: Onyomi (MCQ)
 */
function createOnyomiStep(
  item: BlastItem,
  pool: DistractorPool | undefined,
  ctx: GenerationContext,
  rng?: () => number
): BlastStep {
  const correctAnswer = item.readings?.onyomi?.[0] || ''
  const mcq = generateReadingMcq(correctAnswer, 'onyomi', pool, Array.from(ctx.usedDistractors), rng)
  mcq.options.forEach(option => {
    if (option !== correctAnswer) ctx.usedDistractors.add(option)
  })

  return {
    stepType: 'onyomi_mcq',
    itemId: item.id,
    prompt: item.kanji || item.kana || '',
    answer: correctAnswer,
    options: mcq.options,
    metadata: {
      contentType: item.contentType,
      readingType: 'onyomi',
      correctIndex: mcq.correctIndex
    }
  }
}

/**
 * Step 4: Kunyomi (MCQ)
 */
function createKunyomiStep(
  item: BlastItem,
  pool: DistractorPool | undefined,
  ctx: GenerationContext,
  rng?: () => number
): BlastStep {
  const correctAnswer = item.readings?.kunyomi?.[0] || ''
  const mcq = generateReadingMcq(correctAnswer, 'kunyomi', pool, Array.from(ctx.usedDistractors), rng)
  mcq.options.forEach(option => {
    if (option !== correctAnswer) ctx.usedDistractors.add(option)
  })

  return {
    stepType: 'kunyomi_mcq',
    itemId: item.id,
    prompt: item.kanji || item.kana || '',
    answer: correctAnswer,
    options: mcq.options,
    metadata: {
      contentType: item.contentType,
      readingType: 'kunyomi',
      correctIndex: mcq.correctIndex
    }
  }
}

/**
 * Step 5: Other Reading (MCQ)
 */
function createOtherReadingStep(
  item: BlastItem,
  otherReading: string,
  pool: DistractorPool | undefined,
  ctx: GenerationContext,
  rng?: () => number
): BlastStep {
  const correctAnswer = otherReading
  const readingType = item.readings?.onyomi?.includes(otherReading) ? 'onyomi' : 'kunyomi'
  const mcq = generateReadingMcq(correctAnswer, readingType, pool, Array.from(ctx.usedDistractors), rng)
  mcq.options.forEach(option => {
    if (option !== correctAnswer) ctx.usedDistractors.add(option)
  })

  return {
    stepType: 'other_reading_mcq',
    itemId: item.id,
    prompt: item.kanji || item.kana || '',
    answer: correctAnswer,
    options: mcq.options,
    metadata: {
      contentType: item.contentType,
      readingType,
      correctIndex: mcq.correctIndex
    }
  }
}

/**
 * Step 6: Japanese → Meaning (MCQ)
 */
function createJpToMeaningStep(
  item: BlastItem,
  pool: DistractorPool | undefined,
  ctx: GenerationContext,
  rng?: () => number
): BlastStep {
  const correctAnswer = item.meaningEn
  const mcq = generateMeaningMcq(item, pool, Array.from(ctx.usedDistractors), rng)
  mcq.options.forEach(option => {
    if (option !== correctAnswer) ctx.usedDistractors.add(option)
  })

  return {
    stepType: 'jp_to_meaning_mcq',
    itemId: item.id,
    prompt: item.kanji || item.kana || '',
    answer: correctAnswer,
    options: mcq.options,
    metadata: {
      contentType: item.contentType,
      correctIndex: mcq.correctIndex
    }
  }
}
