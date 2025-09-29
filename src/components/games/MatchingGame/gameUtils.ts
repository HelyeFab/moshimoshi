import { JapaneseWord } from '@/types/vocabulary'
import { Tile, GAME_CONFIG } from './types'
import { getIconsForPairs } from './iconUtils'

/**
 * Create tiles for the game from the selected words with mixed match types
 * @param words Array of Japanese words from user's lists
 * @param targetPairCount Target number of pairs to create
 * @returns Array of tiles
 */
export function createTiles(words: JapaneseWord[], targetPairCount: number): Tile[] {
  const tiles: Tile[] = []
  // Limit words to what we need
  const maxWordsNeeded = targetPairCount
  const shuffledWords = [...words].sort(() => Math.random() - 0.5)
  const availableWords = shuffledWords.slice(0, maxWordsNeeded)
  const usedWordIds = new Set<string>()

  // Calculate how many pairs we can create with each match type
  const wordsPerType = Math.floor(targetPairCount / 3)
  const remainder = targetPairCount % 3

  // Create pairs with different match types
  let pairCount = 0
  let wordIndex = 0

  // Type 1: Exact word matching (word to word)
  const exactPairs = wordsPerType + (remainder > 0 ? 1 : 0)
  for (let i = 0; i < exactPairs && wordIndex < availableWords.length; i++) {
    // Skip if word already used
    while (wordIndex < availableWords.length && usedWordIds.has(availableWords[wordIndex].id)) {
      wordIndex++
    }
    if (wordIndex >= availableWords.length) break

    const word = availableWords[wordIndex]
    usedWordIds.add(word.id)
    const displayText = word.kanji || word.kana
    tiles.push(
      {
        id: `exact-${pairCount}-1`,
        position: 0,
        word: word,
        displayText: displayText,
        matchingText: `exact-${word.id}`,
        isFlipped: false,
        isMatched: false,
        backIcon: ''
      },
      {
        id: `exact-${pairCount}-2`,
        position: 0,
        word: word,
        displayText: displayText,
        matchingText: `exact-${word.id}`,
        isFlipped: false,
        isMatched: false,
        backIcon: ''
      }
    )
    pairCount++
    wordIndex++
  }

  // Type 2: Word to reading matching (if kana is different from kanji)
  const readingPairs = wordsPerType + (remainder > 1 ? 1 : 0)
  for (let i = 0; i < readingPairs && wordIndex < availableWords.length; i++) {
    // Skip if word already used
    while (wordIndex < availableWords.length && usedWordIds.has(availableWords[wordIndex].id)) {
      wordIndex++
    }
    if (wordIndex >= availableWords.length) break

    const word = availableWords[wordIndex]
    // Only create reading pairs if kanji exists and is different from kana
    if (word.kanji && word.kana && word.kanji !== word.kana) {
      usedWordIds.add(word.id)
      tiles.push(
        {
          id: `reading-${pairCount}-1`,
          position: 0,
          word: word,
          displayText: word.kanji,
          matchingText: `reading-${word.id}`,
          isFlipped: false,
          isMatched: false,
          backIcon: ''
        },
        {
          id: `reading-${pairCount}-2`,
          position: 0,
          word: word,
          displayText: word.kana,
          matchingText: `reading-${word.id}`,
          isFlipped: false,
          isMatched: false,
          backIcon: ''
        }
      )
      pairCount++
    }
    wordIndex++
  }

  // Type 3: Word to meaning matching
  const meaningPairs = wordsPerType
  for (let i = 0; i < meaningPairs && wordIndex < availableWords.length; i++) {
    // Skip if word already used
    while (wordIndex < availableWords.length && usedWordIds.has(availableWords[wordIndex].id)) {
      wordIndex++
    }
    if (wordIndex >= availableWords.length) break

    const word = availableWords[wordIndex]
    // Ensure we have a valid meaning
    if (word.meaning && word.meaning.trim()) {
      usedWordIds.add(word.id)
      const firstMeaning = word.meaning.split(';')[0].trim() || word.meaning.split(',')[0].trim()
      if (firstMeaning) {
        const displayText = word.kanji || word.kana
        tiles.push(
          {
            id: `meaning-${pairCount}-1`,
            position: 0,
            word: word,
            displayText: displayText,
            matchingText: `meaning-${word.id}`,
            isFlipped: false,
            isMatched: false,
            backIcon: ''
          },
          {
            id: `meaning-${pairCount}-2`,
            position: 0,
            word: word,
            displayText: firstMeaning,
            matchingText: `meaning-${word.id}`,
            isFlipped: false,
            isMatched: false,
            backIcon: ''
          }
        )
        pairCount++
      }
    }
    wordIndex++
  }

  // If we don't have enough pairs, fill with more exact matches
  while (tiles.length < targetPairCount * 2 && wordIndex < availableWords.length) {
    // Skip if word already used
    while (wordIndex < availableWords.length && usedWordIds.has(availableWords[wordIndex].id)) {
      wordIndex++
    }
    if (wordIndex >= availableWords.length) break

    const word = availableWords[wordIndex]
    usedWordIds.add(word.id)
    const displayText = word.kanji || word.kana
    tiles.push(
      {
        id: `extra-${pairCount}-1`,
        position: 0,
        word: word,
        displayText: displayText,
        matchingText: `extra-${word.id}`,
        isFlipped: false,
        isMatched: false,
        backIcon: ''
      },
      {
        id: `extra-${pairCount}-2`,
        position: 0,
        word: word,
        displayText: displayText,
        matchingText: `extra-${word.id}`,
        isFlipped: false,
        isMatched: false,
        backIcon: ''
      }
    )
    pairCount++
    wordIndex++
  }

  // Get random back icons - one unique icon per tile for variety
  const backIcons = getIconsForPairs(tiles.length)
  tiles.forEach((tile, index) => {
    tile.backIcon = backIcons[index]
  })

  // Shuffle tile positions
  return shuffleTiles(tiles)
}

/**
 * Shuffle tiles randomly
 */
function shuffleTiles(tiles: Tile[]): Tile[] {
  const shuffled = [...tiles].sort(() => Math.random() - 0.5)
  return shuffled.map((tile, index) => ({
    ...tile,
    position: index
  }))
}

/**
 * Check if two tiles match
 */
export function checkMatch(tile1: Tile, tile2: Tile): boolean {
  return tile1.matchingText === tile2.matchingText && tile1.id !== tile2.id
}

/**
 * Calculate score based on moves and time
 */
export function calculateScore(moves: number, timeTaken: number): number {
  const baseScore = 1000
  const movePenalty = Math.max(0, (moves - GAME_CONFIG.MAX_PAIRS) * 10)
  const timePenalty = Math.floor(timeTaken / 1000) * 2 // 2 points per second

  return Math.max(0, baseScore - movePenalty - timePenalty)
}

/**
 * Get performance message based on the game stats
 */
export function getPerformanceMessage(moves: number, perfectMoves: number): string {
  const efficiency = perfectMoves / moves

  if (efficiency === 1) {
    return 'Perfect! You found all pairs without any mistakes!'
  } else if (efficiency >= 0.8) {
    return 'Excellent memory! Very few mistakes!'
  } else if (efficiency >= 0.6) {
    return 'Good job! You\'re getting the hang of it!'
  } else if (efficiency >= 0.4) {
    return 'Nice effort! Practice makes perfect!'
  } else {
    return 'Completed! Try to remember the positions better next time!'
  }
}