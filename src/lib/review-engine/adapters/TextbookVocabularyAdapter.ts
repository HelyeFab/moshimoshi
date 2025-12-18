/**
 * Textbook Vocabulary Adapter
 * Transforms textbook vocabulary items into ReviewableContent for the URE
 */

import { BaseContentAdapter } from './base.adapter';
import { ReviewableContent } from '../core/interfaces';
import { ReviewMode, ContentTypeConfig } from '../core/types';

export interface TextbookVocabularyItem {
  id: string;
  japanese: string;
  reading: string;
  meaning: string;
  jlptLevel?: string;
  partOfSpeech?: string[];
  examples?: Array<{
    japanese: string;
    reading?: string;
    english: string;
  }>;
  tags?: string[];
  lesson?: number;
  chapter?: number;
  textbook?: string;
  source?: string;
  frequency?: number;
}

// Default config for textbook vocabulary content type
const TEXTBOOK_VOCABULARY_CONFIG: ContentTypeConfig = {
  contentType: 'textbook_vocabulary',
  availableModes: [
    {
      mode: 'recognition',
      showPrimary: true,      // Show meaning as prompt
      showSecondary: false,
      showTertiary: false,
      showMedia: false,
      inputType: 'multiple-choice',
      optionCount: 4,
      optionSource: 'similar',
      allowHints: true,
      hintPenalty: 0.1,
      immediateValidation: true,
      allowRetry: false
    },
    {
      mode: 'listening',
      showPrimary: false,     // Hide text - audio only
      showSecondary: false,
      showTertiary: false,
      showMedia: true,
      inputType: 'multiple-choice',
      optionCount: 4,
      optionSource: 'similar',
      allowHints: false,
      immediateValidation: true,
      allowRetry: false
    }
  ],
  defaultMode: 'recognition',
  validationStrategy: 'fuzzy',
  validationOptions: {
    threshold: 0.8,
    ignoreCase: true
  }
};

export class TextbookVocabularyAdapter extends BaseContentAdapter<TextbookVocabularyItem> {
  constructor(config: ContentTypeConfig = TEXTBOOK_VOCABULARY_CONFIG) {
    super(config);
  }

  /**
   * Transform textbook vocabulary item to reviewable format
   */
  transform(vocab: TextbookVocabularyItem): ReviewableContent {
    const jlptLevel = this.parseJLPTLevel(vocab.jlptLevel);

    return {
      id: vocab.id,
      contentType: 'vocabulary',

      // For recognition mode: show meaning, user selects Japanese
      primaryDisplay: vocab.meaning,
      secondaryDisplay: vocab.reading !== vocab.japanese ? vocab.reading : undefined,
      tertiaryDisplay: undefined,

      // Answer fields
      primaryAnswer: vocab.japanese,
      alternativeAnswers: this.generateAlternativeAnswers(vocab),

      // Media
      audioUrl: undefined, // TTS will be used

      // Metadata
      difficulty: this.calculateDifficulty(vocab),
      tags: this.generateTags(vocab),
      source: vocab.textbook || vocab.source || 'textbook',

      // Review configuration
      supportedModes: ['recognition', 'listening'] as ReviewMode[],
      preferredMode: 'recognition' as ReviewMode,

      // Extended metadata for UI and filtering
      metadata: {
        japanese: vocab.japanese,
        reading: vocab.reading,
        meaning: vocab.meaning,
        jlptLevel: jlptLevel,
        jlpt: vocab.jlptLevel,
        partOfSpeech: vocab.partOfSpeech || [],
        examples: vocab.examples || [],
        lesson: vocab.lesson,
        chapter: vocab.chapter,
        textbook: vocab.textbook,
        hasKanji: this.hasKanji(vocab.japanese)
      }
    };
  }

  /**
   * Generate multiple choice options from the vocabulary pool
   * Uses multi-strategy approach for smart distractor selection
   */
  generateOptions(
    content: ReviewableContent,
    pool: TextbookVocabularyItem[],
    count: number = 4
  ): ReviewableContent[] {
    const correctJapanese = content.primaryAnswer;
    const metadata = content.metadata as any;
    const selectedVocab: TextbookVocabularyItem[] = [];

    // Find the correct item in the pool
    const correctItem = pool.find(v => v.japanese === correctJapanese);
    if (correctItem) {
      selectedVocab.push(correctItem);
    } else {
      // Create minimal version if not found
      selectedVocab.push({
        id: content.id,
        japanese: correctJapanese,
        reading: metadata?.reading || correctJapanese,
        meaning: content.primaryDisplay
      });
    }

    // Filter out the correct answer
    const availablePool = pool.filter(v => v.japanese !== correctJapanese);

    // Strategy 1: Same lesson (highest priority for relevance)
    if (metadata?.lesson) {
      const sameLesson = availablePool.filter(v => v.lesson === metadata.lesson);
      this.addDistractors(selectedVocab, sameLesson, count);
    }

    // Strategy 2: Same textbook, adjacent lessons
    if (metadata?.textbook && metadata?.lesson && selectedVocab.length < count) {
      const adjacentLessons = availablePool.filter(v =>
        v.textbook === metadata.textbook &&
        v.lesson !== metadata.lesson &&
        Math.abs((v.lesson || 0) - metadata.lesson) <= 2
      );
      this.addDistractors(selectedVocab, adjacentLessons, count);
    }

    // Strategy 3: Same JLPT level
    if (metadata?.jlptLevel && selectedVocab.length < count) {
      const sameJLPT = availablePool.filter(v =>
        this.parseJLPTLevel(v.jlptLevel) === metadata.jlptLevel
      );
      this.addDistractors(selectedVocab, sameJLPT, count);
    }

    // Strategy 4: Similar word length
    if (selectedVocab.length < count) {
      const targetLength = correctJapanese.length;
      const similarLength = availablePool.filter(v =>
        Math.abs(v.japanese.length - targetLength) <= 2
      );
      this.addDistractors(selectedVocab, similarLength, count);
    }

    // Strategy 5: Same part of speech
    if (metadata?.partOfSpeech?.length > 0 && selectedVocab.length < count) {
      const samePOS = availablePool.filter(v =>
        v.partOfSpeech?.some(pos => metadata.partOfSpeech.includes(pos))
      );
      this.addDistractors(selectedVocab, samePOS, count);
    }

    // Strategy 6: Random fallback
    if (selectedVocab.length < count) {
      const shuffled = this.shuffle(availablePool);
      this.addDistractors(selectedVocab, shuffled, count);
    }

    // Shuffle final selection and convert to ReviewableContent
    const shuffled = this.shuffle(selectedVocab);
    return shuffled.map(vocab => ({
      id: vocab.id,
      contentType: 'vocabulary',
      primaryDisplay: vocab.japanese, // For options, show the Japanese word
      secondaryDisplay: undefined,
      tertiaryDisplay: undefined,
      primaryAnswer: vocab.japanese,
      alternativeAnswers: [],
      difficulty: this.calculateDifficulty(vocab),
      tags: [],
      source: vocab.textbook || 'textbook',
      supportedModes: ['recognition'] as ReviewMode[],
      preferredMode: 'recognition' as ReviewMode,
      metadata: {
        isOption: true,
        meaning: vocab.meaning,
        reading: vocab.reading
      }
    }));
  }

  /**
   * Prepare content for specific review mode
   */
  prepareForMode(content: ReviewableContent, mode: ReviewMode): ReviewableContent {
    const metadata = content.metadata as any;

    switch (mode) {
      case 'recognition':
        // Show meaning, user selects Japanese word
        return {
          ...content,
          primaryDisplay: metadata?.meaning || content.primaryDisplay,
          secondaryDisplay: undefined,
          tertiaryDisplay: undefined,
          primaryAnswer: metadata?.japanese || content.primaryAnswer
        };

      case 'listening':
        // Hide text, play audio, user selects meaning
        return {
          ...content,
          primaryDisplay: '🔊', // Audio indicator
          secondaryDisplay: undefined,
          tertiaryDisplay: undefined,
          // For listening, answer is the meaning (user identifies what they heard)
          primaryAnswer: metadata?.meaning || content.primaryDisplay
        };

      default:
        return content;
    }
  }

  /**
   * Calculate difficulty based on multiple factors
   */
  calculateDifficulty(vocab: TextbookVocabularyItem): number {
    let difficulty = 0.5; // Base difficulty

    // JLPT level factor (N5 = easier, N1 = harder)
    const jlptLevel = this.parseJLPTLevel(vocab.jlptLevel);
    if (jlptLevel) {
      difficulty += (6 - jlptLevel) * 0.08; // N5=0.08, N1=0.4
    }

    // Word length factor
    const length = vocab.japanese.length;
    if (length > 4) {
      difficulty += Math.min((length - 4) * 0.03, 0.15);
    }

    // Kanji presence factor
    if (this.hasKanji(vocab.japanese)) {
      difficulty += 0.1;
    }

    // Multiple meanings factor
    if (vocab.meaning.includes(',') || vocab.meaning.includes(';')) {
      difficulty += 0.05;
    }

    // Cap difficulty between 0.1 and 0.95
    return Math.max(0.1, Math.min(0.95, difficulty));
  }

  /**
   * Get supported review modes
   */
  getSupportedModes(): ReviewMode[] {
    return ['recognition', 'listening'] as ReviewMode[];
  }

  /**
   * Generate hints for the vocabulary item
   */
  generateHints(content: ReviewableContent): string[] {
    const hints: string[] = [];
    const metadata = content.metadata as any;

    // Hint 1: Reading (if different from Japanese)
    if (metadata?.reading && metadata.reading !== metadata.japanese) {
      hints.push(`Reading: ${metadata.reading}`);
    }

    // Hint 2: First character
    if (metadata?.japanese) {
      hints.push(`Starts with: ${metadata.japanese.charAt(0)}`);
    }

    // Hint 3: Part of speech
    if (metadata?.partOfSpeech?.length > 0) {
      hints.push(`Part of speech: ${metadata.partOfSpeech.join(', ')}`);
    }

    // Hint 4: Word length
    if (metadata?.japanese) {
      hints.push(`${metadata.japanese.length} characters`);
    }

    // Hint 5: Has kanji or not
    if (metadata?.hasKanji !== undefined) {
      hints.push(metadata.hasKanji ? 'Contains kanji' : 'Written in kana only');
    }

    return hints;
  }

  /**
   * Generate alternative answers (synonyms, alternate readings)
   */
  private generateAlternativeAnswers(vocab: TextbookVocabularyItem): string[] {
    const alternatives: string[] = [];

    // Add reading as alternative if different from Japanese
    if (vocab.reading && vocab.reading !== vocab.japanese) {
      alternatives.push(vocab.reading);
    }

    return alternatives;
  }

  /**
   * Generate tags for categorization and filtering
   */
  private generateTags(vocab: TextbookVocabularyItem): string[] {
    const tags: string[] = ['textbook_vocabulary'];

    if (vocab.jlptLevel) {
      tags.push(`jlpt-${vocab.jlptLevel.toLowerCase()}`);
    }

    if (vocab.textbook) {
      tags.push(vocab.textbook);
    }

    if (vocab.lesson) {
      tags.push(`lesson-${vocab.lesson}`);
    }

    if (vocab.chapter) {
      tags.push(`chapter-${vocab.chapter}`);
    }

    if (vocab.partOfSpeech) {
      tags.push(...vocab.partOfSpeech);
    }

    if (this.hasKanji(vocab.japanese)) {
      tags.push('has-kanji');
    } else {
      tags.push('kana-only');
    }

    return tags;
  }

  /**
   * Parse JLPT level string to number
   */
  private parseJLPTLevel(jlpt?: string): number {
    if (!jlpt) return 5;
    const match = jlpt.match(/N(\d)/i);
    return match ? parseInt(match[1]) : 5;
  }

  /**
   * Check if text contains kanji characters
   */
  private hasKanji(text: string): boolean {
    return /[\u4e00-\u9faf]/.test(text);
  }

  /**
   * Add distractors from candidates to selected array
   */
  private addDistractors(
    selected: TextbookVocabularyItem[],
    candidates: TextbookVocabularyItem[],
    maxCount: number
  ): void {
    for (const candidate of candidates) {
      if (selected.length >= maxCount) break;
      if (!selected.some(s => s.japanese === candidate.japanese)) {
        selected.push(candidate);
      }
    }
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

// Export default config for registry initialization
export const TEXTBOOK_VOCABULARY_DEFAULT_CONFIG = TEXTBOOK_VOCABULARY_CONFIG;

// Export a singleton instance
export const textbookVocabularyAdapter = new TextbookVocabularyAdapter();
