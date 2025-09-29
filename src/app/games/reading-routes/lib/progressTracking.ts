// Progress tracking for Reading Routes game
// Uses local storage only, no authentication or usage tracking

import type { ReadingRoutesProgress, KanjiReadingProgress, GameResult } from '../types/reading-routes'

const STORAGE_KEY = 'reading_routes_progress'

// Load all Reading Routes progress from local storage
export async function getAllReadingRoutesProgress(): Promise<Record<string, ReadingRoutesProgress>> {
  try {
    if (typeof window === 'undefined') return {}
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch (error) {
    console.error('Error loading Reading Routes progress:', error)
    return {}
  }
}

// Get progress for a specific board
export async function getBoardProgress(boardId: string): Promise<ReadingRoutesProgress | null> {
  const allProgress = await getAllReadingRoutesProgress()
  return allProgress[boardId] || null
}

// Save progress for a specific board
async function saveBoardProgress(boardId: string, progress: ReadingRoutesProgress): Promise<void> {
  try {
    if (typeof window === 'undefined') return
    const allProgress = await getAllReadingRoutesProgress()
    allProgress[boardId] = progress
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress))
  } catch (error) {
    console.error('Error saving Reading Routes progress:', error)
  }
}

// Update progress for a specific kanji reading
export async function updateKanjiReadingProgress(
  boardId: string,
  kanjiChar: string,
  readingType: 'on' | 'kun',
  isCorrect: boolean
): Promise<void> {
  let progress = await getBoardProgress(boardId)

  if (!progress) {
    progress = {
      boardId,
      kanjiProgress: {},
      lastPlayed: new Date().toISOString(),
      totalGamesPlayed: 0,
      highScore: 0,
      averageAccuracy: 0
    }
  }

  // Initialize kanji progress if doesn't exist
  if (!progress.kanjiProgress[kanjiChar]) {
    progress.kanjiProgress[kanjiChar] = {
      char: kanjiChar,
      onYomiAttempts: 0,
      onYomiCorrect: 0,
      kunYomiAttempts: 0,
      kunYomiCorrect: 0,
      lastSeen: new Date().toISOString(),
      masteryLevel: 0
    }
  }

  const kanjiProgress = progress.kanjiProgress[kanjiChar]

  // Update attempts and correct counts
  if (readingType === 'on') {
    kanjiProgress.onYomiAttempts++
    if (isCorrect) kanjiProgress.onYomiCorrect++
  } else {
    kanjiProgress.kunYomiAttempts++
    if (isCorrect) kanjiProgress.kunYomiCorrect++
  }

  kanjiProgress.lastSeen = new Date().toISOString()

  // Calculate mastery level (0-100)
  const totalAttempts = kanjiProgress.onYomiAttempts + kanjiProgress.kunYomiAttempts
  const totalCorrect = kanjiProgress.onYomiCorrect + kanjiProgress.kunYomiCorrect

  if (totalAttempts >= 3) {
    const accuracy = totalCorrect / totalAttempts
    const attemptBonus = Math.min(totalAttempts * 2, 20) // Max 20 points from attempts
    kanjiProgress.masteryLevel = Math.round((accuracy * 80) + attemptBonus)
  }

  await saveBoardProgress(boardId, progress)
}

// Save game results
export async function saveReadingRoutesProgress(
  boardId: string,
  results: GameResult
): Promise<void> {
  let progress = await getBoardProgress(boardId)

  if (!progress) {
    progress = {
      boardId,
      kanjiProgress: {},
      lastPlayed: new Date().toISOString(),
      totalGamesPlayed: 0,
      highScore: 0,
      averageAccuracy: 0
    }
  }

  progress.totalGamesPlayed++
  progress.lastPlayed = results.timestamp

  // Update high score
  if (results.score > progress.highScore) {
    progress.highScore = results.score
  }

  // Update average accuracy
  const currentAccuracy = results.correctAnswers / results.totalQuestions
  if (progress.totalGamesPlayed === 1) {
    progress.averageAccuracy = currentAccuracy
  } else {
    // Running average
    progress.averageAccuracy =
      (progress.averageAccuracy * (progress.totalGamesPlayed - 1) + currentAccuracy) /
      progress.totalGamesPlayed
  }

  await saveBoardProgress(boardId, progress)
}

// Get overall stats across all boards
export async function getOverallStats(): Promise<{
  totalGamesPlayed: number
  totalKanjiLearned: number
  averageAccuracy: number
  lastPlayed: string | null
}> {
  const allProgress = await getAllReadingRoutesProgress()

  let totalGamesPlayed = 0
  let totalKanjiLearned = new Set<string>()
  let totalAccuracy = 0
  let accuracyCount = 0
  let lastPlayed: string | null = null

  for (const progress of Object.values(allProgress)) {
    totalGamesPlayed += progress.totalGamesPlayed

    // Count kanji with mastery > 50
    for (const kanjiProgress of Object.values(progress.kanjiProgress)) {
      if (kanjiProgress.masteryLevel > 50) {
        totalKanjiLearned.add(kanjiProgress.char)
      }
    }

    if (progress.totalGamesPlayed > 0) {
      totalAccuracy += progress.averageAccuracy * progress.totalGamesPlayed
      accuracyCount += progress.totalGamesPlayed
    }

    if (!lastPlayed || progress.lastPlayed > lastPlayed) {
      lastPlayed = progress.lastPlayed
    }
  }

  return {
    totalGamesPlayed,
    totalKanjiLearned: totalKanjiLearned.size,
    averageAccuracy: accuracyCount > 0 ? totalAccuracy / accuracyCount : 0,
    lastPlayed
  }
}

// Clear all progress (for debugging/reset)
export async function clearAllProgress(): Promise<void> {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}