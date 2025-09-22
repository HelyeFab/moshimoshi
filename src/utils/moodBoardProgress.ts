import { MoodBoardsProgress, BoardProgress } from '@/types/moodboard';

const STORAGE_KEY = 'moshimoshi_mood_boards_progress';

/**
 * Get all mood board progress from localStorage
 */
export function getAllProgress(): MoodBoardsProgress {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error loading mood board progress:', error);
    return {};
  }
}

/**
 * Get progress for a specific board
 */
export function getBoardProgress(boardId: string): BoardProgress | null {
  const allProgress = getAllProgress();
  return allProgress[boardId] || null;
}

/**
 * Save progress for a specific board
 */
export function saveBoardProgress(boardId: string, progress: BoardProgress): void {
  if (typeof window === 'undefined') return;

  try {
    const allProgress = getAllProgress();
    allProgress[boardId] = progress;
    // Use a safe stringify to handle circular references
    const safeStringify = (obj: any) => {
      const seen = new WeakSet();
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return undefined; // Remove circular reference
          }
          seen.add(value);
        }
        // Remove React internal properties
        if (key.startsWith('__react') || key.startsWith('_react')) {
          return undefined;
        }
        return value;
      });
    };
    localStorage.setItem(STORAGE_KEY, safeStringify(allProgress));
  } catch (error) {
    console.error('Error saving mood board progress:', error);
  }
}

/**
 * Toggle learned status for a kanji character
 */
export function toggleKanjiLearned(boardId: string, kanjiChar: string, totalKanji: number): BoardProgress {
  const currentProgress = getBoardProgress(boardId);

  // Initialize progress if it doesn't exist
  let learnedKanji = currentProgress?.learnedKanji || [];

  // Toggle the kanji
  if (learnedKanji.includes(kanjiChar)) {
    learnedKanji = learnedKanji.filter(char => char !== kanjiChar);
  } else {
    learnedKanji = [...learnedKanji, kanjiChar];
  }

  const progressPercentage = calculateProgressPercentage(learnedKanji, totalKanji);
  const isCompleted = progressPercentage === 100;

  const newProgress: BoardProgress = {
    boardId,
    learnedKanji,
    totalKanji,
    progressPercentage,
    lastStudied: new Date(),
    ...(isCompleted && !currentProgress?.completedAt && { completedAt: new Date() })
  };

  saveBoardProgress(boardId, newProgress);
  return newProgress;
}

/**
 * Calculate progress percentage for a board
 */
export function calculateProgressPercentage(learnedKanji: string[], totalKanji: number): number {
  if (totalKanji === 0) return 0;
  return Math.round((learnedKanji.length / totalKanji) * 100);
}

/**
 * Check if a kanji is learned
 */
export function isKanjiLearned(boardId: string, kanjiChar: string): boolean {
  const progress = getBoardProgress(boardId);
  return progress?.learnedKanji.includes(kanjiChar) || false;
}

/**
 * Check if a board is completed
 */
export function isBoardCompleted(boardId: string): boolean {
  const progress = getBoardProgress(boardId);
  return progress?.progressPercentage === 100 || false;
}

/**
 * Get summary statistics for all boards
 */
export function getProgressSummary(allBoardsTotalKanji: Map<string, number>) {
  const allProgress = getAllProgress();
  const boardIds = Object.keys(allProgress);

  const totalBoards = boardIds.length;
  const completedBoards = boardIds.filter(id => isBoardCompleted(id)).length;

  let totalKanji = 0;
  let learnedKanji = 0;

  boardIds.forEach(id => {
    const boardTotal = allBoardsTotalKanji.get(id) || 0;
    totalKanji += boardTotal;

    const progress = allProgress[id];
    learnedKanji += progress?.learnedKanji.length || 0;
  });

  return {
    totalBoards,
    completedBoards,
    totalKanji,
    learnedKanji,
    overallProgress: totalKanji > 0 ? Math.round((learnedKanji / totalKanji) * 100) : 0
  };
}

/**
 * Reset progress for a specific board
 */
export function resetBoardProgress(boardId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const allProgress = getAllProgress();
    delete allProgress[boardId];
    // Use safe stringify here too
    const safeStringify = (obj: any) => {
      const seen = new WeakSet();
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return undefined;
          }
          seen.add(value);
        }
        if (key.startsWith('__react') || key.startsWith('_react')) {
          return undefined;
        }
        return value;
      });
    };
    localStorage.setItem(STORAGE_KEY, safeStringify(allProgress));
  } catch (error) {
    console.error('Error resetting board progress:', error);
  }
}

/**
 * Reset all progress (for testing/debugging)
 */
export function resetAllProgress(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error resetting all progress:', error);
  }
}

/**
 * Migrate progress from old storage key (if needed)
 */
export function migrateProgress(): void {
  if (typeof window === 'undefined') return;

  const OLD_STORAGE_KEY = 'doshi_mood_boards_progress';

  try {
    const oldData = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldData && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, oldData);
      localStorage.removeItem(OLD_STORAGE_KEY);
      console.log('Successfully migrated mood board progress data');
    }
  } catch (error) {
    console.error('Error migrating progress data:', error);
  }
}