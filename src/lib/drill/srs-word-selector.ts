/**
 * SRS Word Selector
 * Implements intelligent word selection for spaced repetition drilling
 *
 * Selection Strategy:
 * - 60% due words (overdue first, then leeches, then standard)
 * - 30% new words (never seen before)
 * - 10% recent learning words (reinforcement)
 */

import type { JapaneseWord, WordSRSEntry, JLPTLevel } from '@/types/drill';
import { DrillProgressManager } from '@/lib/review-engine/progress/DrillProgressManager';
import { getConjugatableWordsPractice } from '@/utils/jmdictLocalSearch';

const drillProgressManager = DrillProgressManager.getInstance();

export interface SRSWordSelectionOptions {
  userId: string;
  targetCount: number;
  isPremium: boolean;

  // Distribution ratios (should sum to 1.0)
  dueWordRatio?: number;      // Default: 0.6 (60%)
  newWordRatio?: number;      // Default: 0.3 (30%)
  learningWordRatio?: number; // Default: 0.1 (10%)

  // Optional filters (rarely used - SRS shows ALL studied words by design)
  includeJLPT?: JLPTLevel[];
  maxLeechScore?: number;    // Optionally exclude very difficult words
}

export class SRSWordSelector {
  /**
   * Select words for SRS drill session
   */
  static async selectWords(options: SRSWordSelectionOptions): Promise<JapaneseWord[]> {
    const {
      userId,
      targetCount,
      isPremium,
      dueWordRatio = 0.6,
      newWordRatio = 0.3,
      learningWordRatio = 0.1,
      includeJLPT,
      maxLeechScore
    } = options;

    // Get all SRS data for this user
    const srsData = await drillProgressManager.getSRSData(userId, isPremium);

    // Categorize words
    const now = new Date();
    const dueWords: WordSRSEntry[] = [];
    const learningWords: WordSRSEntry[] = [];
    const otherWords: WordSRSEntry[] = [];

    srsData.forEach((entry: WordSRSEntry) => {
      const nextReview = new Date(entry.srsData.nextReviewAt);

      // Apply leech filter if specified
      if (maxLeechScore !== undefined && entry.leechScore > maxLeechScore) {
        return;
      }

      // Apply JLPT filter if specified
      if (includeJLPT && entry.word.jlpt && !includeJLPT.includes(entry.word.jlpt)) {
        return;
      }

      // Categorize
      if (nextReview <= now) {
        dueWords.push(entry);
      } else if (entry.srsData.status === 'learning') {
        learningWords.push(entry);
      } else {
        otherWords.push(entry);
      }
    });

    // Prioritize due words
    const prioritizedDue = this.prioritizeDueWords(dueWords);

    // Calculate target counts for each category
    const targetDue = Math.floor(targetCount * dueWordRatio);
    const targetNew = Math.floor(targetCount * newWordRatio);
    const targetLearning = targetCount - targetDue - targetNew; // Remainder goes to learning

    // Select words from each category
    const selectedWords: JapaneseWord[] = [];

    // 1. Select due words (highest priority)
    const selectedDue = prioritizedDue.slice(0, targetDue);
    selectedWords.push(...selectedDue.map(entry => this.entryToWord(entry)));

    // 2. Select new words (if we have room and not enough due words)
    const remainingAfterDue = targetCount - selectedWords.length;
    if (remainingAfterDue > 0) {
      const targetNewAdjusted = Math.max(targetNew, remainingAfterDue - targetLearning);
      const newWords = await this.getNewWords(
        userId,
        srsData,
        targetNewAdjusted,
        includeJLPT
      );
      selectedWords.push(...newWords);
    }

    // 3. Select learning words (reinforcement)
    const remainingAfterNew = targetCount - selectedWords.length;
    if (remainingAfterNew > 0 && learningWords.length > 0) {
      // Shuffle learning words for variety
      const shuffledLearning = this.shuffleArray([...learningWords]);
      const selectedLearning = shuffledLearning.slice(0, remainingAfterNew);
      selectedWords.push(...selectedLearning.map(entry => this.entryToWord(entry)));
    }

    // 4. Fill remaining slots with any words if still short
    const finalRemaining = targetCount - selectedWords.length;
    if (finalRemaining > 0 && otherWords.length > 0) {
      const shuffledOther = this.shuffleArray([...otherWords]);
      const selectedOther = shuffledOther.slice(0, finalRemaining);
      selectedWords.push(...selectedOther.map(entry => this.entryToWord(entry)));
    }

    // Shuffle final selection for variety within the session
    return this.shuffleArray(selectedWords);
  }

  /**
   * Prioritize due words by:
   * 1. Overdue time (most overdue first)
   * 2. Leech score (difficult words get more practice)
   * 3. Last reviewed (oldest first)
   */
  private static prioritizeDueWords(dueWords: WordSRSEntry[]): WordSRSEntry[] {
    const now = new Date();

    return dueWords.sort((a, b) => {
      // Calculate how overdue each word is (in days)
      const aOverdue = Math.max(0,
        (now.getTime() - new Date(a.srsData.nextReviewAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const bOverdue = Math.max(0,
        (now.getTime() - new Date(b.srsData.nextReviewAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Priority 1: Most overdue first (>1 day difference matters)
      if (Math.abs(aOverdue - bOverdue) > 1) {
        return bOverdue - aOverdue;
      }

      // Priority 2: Higher leech score (more difficult words)
      if (a.leechScore !== b.leechScore) {
        return b.leechScore - a.leechScore;
      }

      // Priority 3: Oldest review first
      const aLastReview = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0;
      const bLastReview = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0;
      return aLastReview - bLastReview;
    });
  }

  /**
   * Get new words (never seen before in SRS)
   * Fetches from JMDict, excluding words already in SRS
   */
  private static async getNewWords(
    userId: string,
    existingSRSData: Map<string, WordSRSEntry>,
    count: number,
    includeJLPT?: JLPTLevel[]
  ): Promise<JapaneseWord[]> {
    if (count <= 0) return [];

    // Determine JLPT filter for new words
    // If not specified, use N5+N4 for beginners
    const jlptFilter: ('N5' | 'N4' | 'N3+')[] = [];
    if (includeJLPT && includeJLPT.length > 0) {
      if (includeJLPT.includes('N5')) jlptFilter.push('N5');
      if (includeJLPT.includes('N4')) jlptFilter.push('N4');
      if (includeJLPT.includes('N3') || includeJLPT.includes('N2') || includeJLPT.includes('N1')) {
        jlptFilter.push('N3+');
      }
    } else {
      // Default: N5 + N4 for new learners
      jlptFilter.push('N5', 'N4');
    }

    // Fetch more words than needed to account for filtering
    const fetchCount = Math.min(count * 3, 100); // Fetch 3x but cap at 100

    try {
      const allWords = await getConjugatableWordsPractice({
        type: 'all',
        jlptLevels: jlptFilter,
        limit: fetchCount
      });

      // Filter out words already in SRS
      const newWords = allWords.filter(word => {
        const wordId = `${word.kanji || word.kana}:${word.kana}`;
        return !existingSRSData.has(wordId);
      });

      // Shuffle and take what we need
      const shuffled = this.shuffleArray(newWords);
      return shuffled.slice(0, count);
    } catch (error) {
      console.error('[SRSWordSelector] Failed to fetch new words:', error);
      return [];
    }
  }

  /**
   * Convert WordSRSEntry to JapaneseWord
   */
  private static entryToWord(entry: WordSRSEntry): JapaneseWord {
    return {
      id: entry.wordId,
      kanji: entry.word.kanji,
      kana: entry.word.kana,
      meaning: entry.word.meaning,
      type: entry.word.type,
      jlpt: entry.word.jlpt
    };
  }

  /**
   * Fisher-Yates shuffle algorithm
   */
  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get SRS statistics for the user (used for dashboard)
   */
  static async getStats(userId: string, isPremium: boolean) {
    return await drillProgressManager.getSRSStats(userId, isPremium);
  }

  /**
   * Check if user has enough words for SRS mode
   */
  static async hasEnoughWords(userId: string, isPremium: boolean, minWords: number = 5): Promise<boolean> {
    const srsData = await drillProgressManager.getSRSData(userId, isPremium);
    return srsData.size >= minWords;
  }

  /**
   * Get word counts by category (for UI display)
   */
  static async getWordCounts(userId: string, isPremium: boolean): Promise<{
    total: number;
    due: number;
    learning: number;
    new: number;
  }> {
    const srsData = await drillProgressManager.getSRSData(userId, isPremium);
    const now = new Date();

    let dueCount = 0;
    let learningCount = 0;

    srsData.forEach((entry: WordSRSEntry) => {
      const nextReview = new Date(entry.srsData.nextReviewAt);
      if (nextReview <= now) {
        dueCount++;
      } else if (entry.srsData.status === 'learning') {
        learningCount++;
      }
    });

    // "New" is theoretical - we can show a small number based on JLPT pool
    // For now, just show that new words are available
    const newCount = dueCount < 10 ? 10 : 5; // Show more new words if few due words

    return {
      total: srsData.size,
      due: dueCount,
      learning: learningCount,
      new: newCount
    };
  }
}
