import { BaseContentAdapter } from './base.adapter';
import {
  ReviewableContent,
  ValidationResult
} from '../core/interfaces';
import { ReviewMode, ContentTypeConfig } from '../core/types';
import { KanjiItem } from '@/types/moodboard';

export interface MoodBoardKanjiInput {
  kanji: KanjiItem;
  boardId: string;
  boardTitle: string;
}

// Default config for moodboard content type
const MOODBOARD_CONFIG: ContentTypeConfig = {
  contentType: 'kanji',
  availableModes: [
    {
      mode: 'recognition',
      showPrimary: true,
      showSecondary: false,
      showTertiary: false,
      showMedia: true,
      inputType: 'multiple-choice',
      optionCount: 4,
      optionSource: 'similar',
      allowHints: true,
      hintPenalty: 0.1,
      immediateValidation: true,
      allowRetry: false
    },
    {
      mode: 'recall',
      showPrimary: false,
      showSecondary: true,
      showTertiary: true,
      showMedia: false,
      inputType: 'text',
      allowHints: true,
      hintPenalty: 0.2,
      immediateValidation: true,
      allowRetry: true,
      maxRetries: 2
    }
  ],
  defaultMode: 'recognition',
  validationStrategy: 'fuzzy',
  validationOptions: {
    threshold: 0.8,
    ignoreCase: true
  }
};

export class MoodBoardAdapter extends BaseContentAdapter<MoodBoardKanjiInput> {
  constructor(config: ContentTypeConfig = MOODBOARD_CONFIG) {
    super(config);
  }

  transform(input: MoodBoardKanjiInput): ReviewableContent {
    const { kanji, boardId, boardTitle } = input;
    const id = `moodboard_${boardId}_${kanji.char}`;

    // Get readings safely
    const onReadings = kanji.readings?.on ?? kanji.onyomi ?? [];
    const kunReadings = kanji.readings?.kun ?? kanji.kunyomi ?? [];
    const allReadings = [...onReadings, ...kunReadings];

    return {
      id,
      contentType: 'kanji',
      primaryDisplay: kanji.char,
      secondaryDisplay: kanji.meaning,
      tertiaryDisplay: allReadings.join(', '),
      primaryAnswer: kanji.meaning,
      alternativeAnswers: allReadings,
      difficulty: this.calculateDifficulty(input),
      tags: ['moodboard', boardTitle, kanji.jlpt ?? 'N5'],
      source: `Mood Board: ${boardTitle}`,
      supportedModes: this.getSupportedModes(),
      preferredMode: 'recognition',
      metadata: {
        boardId,
        boardTitle,
        strokeCount: kanji.strokeCount,
        jlptLevel: kanji.jlpt,
        examples: this.getExampleSentences(kanji)
      }
    };
  }

  generateOptions(
    content: ReviewableContent,
    pool: MoodBoardKanjiInput[],
    count: number
  ): ReviewableContent[] {
    // Filter out the current content and transform the rest
    const options = pool
      .filter(item => `moodboard_${item.boardId}_${item.kanji.char}` !== content.id)
      .slice(0, count - 1)
      .map(item => this.transform(item));

    // Shuffle and include correct answer
    const allOptions = [content, ...options];
    return this.shuffleArray(allOptions);
  }

  getSupportedModes(): ReviewMode[] {
    return ['recognition', 'recall'];
  }

  prepareForMode(content: ReviewableContent, mode: ReviewMode): ReviewableContent {
    // Adjust display based on mode
    if (mode === 'recall') {
      return {
        ...content,
        primaryDisplay: content.secondaryDisplay ?? '', // Show meaning
        secondaryDisplay: undefined // Hide character
      };
    }
    return content;
  }

  calculateDifficulty(input: MoodBoardKanjiInput): number {
    const kanji = input.kanji;

    // Base difficulty on JLPT level
    const jlptDifficulty: Record<string, number> = {
      'N5': 0.2,
      'N4': 0.4,
      'N3': 0.6,
      'N2': 0.8,
      'N1': 1.0
    };

    let difficulty = jlptDifficulty[kanji.jlpt ?? 'N5'] ?? 0.6;

    // Adjust based on stroke count
    if (kanji.strokeCount) {
      if (kanji.strokeCount > 15) difficulty = Math.min(1.0, difficulty + 0.05);
      if (kanji.strokeCount > 20) difficulty = Math.min(1.0, difficulty + 0.05);
    }

    // Adjust based on number of readings
    const onReadings = kanji.readings?.on ?? kanji.onyomi ?? [];
    const kunReadings = kanji.readings?.kun ?? kanji.kunyomi ?? [];
    const totalReadings = onReadings.length + kunReadings.length;
    if (totalReadings > 4) difficulty = Math.min(1.0, difficulty + 0.03);
    if (totalReadings > 6) difficulty = Math.min(1.0, difficulty + 0.02);

    return Math.min(1.0, Math.max(0.0, difficulty));
  }

  generateHints(content: ReviewableContent): string[] {
    const hints: string[] = [];
    const metadata = content.metadata as {
      strokeCount?: number;
      jlptLevel?: string;
      examples?: string[];
    } | undefined;

    // Level 1: Basic info
    hints.push(
      `This kanji has ${metadata?.strokeCount ?? '?'} strokes and is ${metadata?.jlptLevel ?? 'N5'} level.`
    );

    // Level 2: Partial reading
    if (content.tertiaryDisplay) {
      const firstReading = content.tertiaryDisplay.split(',')[0]?.trim();
      if (firstReading) {
        hints.push(`One reading starts with "${firstReading[0]}"`);
      }
    }

    // Level 3: Full answer
    hints.push(
      `Meaning: ${content.secondaryDisplay}, Readings: ${content.tertiaryDisplay}`
    );

    return hints;
  }

  /**
   * Validate user input against the kanji
   * Note: This is a custom method, not from base class
   */
  validateAnswer(input: MoodBoardKanjiInput, userInput: string): ValidationResult {
    const { kanji } = input;
    const normalizedInput = userInput.trim().toLowerCase();

    // Check meaning
    const meaningValid = kanji.meaning.toLowerCase().includes(normalizedInput) ||
                        normalizedInput.includes(kanji.meaning.toLowerCase());

    // Get readings safely
    const onReadings = kanji.readings?.on ?? kanji.onyomi ?? [];
    const kunReadings = kanji.readings?.kun ?? kanji.kunyomi ?? [];
    const allReadings = [...onReadings, ...kunReadings];

    // Check readings
    const readingsValid = allReadings.some(reading => {
      const normalizedReading = reading.toLowerCase();
      return normalizedReading === normalizedInput ||
             this.toHiragana(normalizedReading) === this.toHiragana(normalizedInput);
    });

    const isCorrect = meaningValid || readingsValid;
    const confidence = isCorrect ? 1.0 : this.calculateSimilarity(normalizedInput, kanji.meaning.toLowerCase());

    return {
      isCorrect,
      confidence,
      corrections: isCorrect ? undefined : {
        expected: kanji.meaning,
        received: userInput,
        differences: [`Expected: ${kanji.meaning}, Got: ${userInput}`]
      },
      partialCredit: confidence > 0.6 ? confidence : undefined,
      feedback: isCorrect
        ? `Correct! ${kanji.char} can be read as ${allReadings.join(', ')} and means "${kanji.meaning}".`
        : `Not quite. ${kanji.char} is read as ${allReadings.join(', ')} and means "${kanji.meaning}".`
    };
  }

  /**
   * Get display info for the kanji (custom method)
   */
  getDisplayInfo(input: MoodBoardKanjiInput, mode: 'question' | 'answer'): {
    type: string;
    primary: string;
    secondary?: string;
    tertiary?: string;
    hint?: string;
    examples?: string[];
  } {
    const { kanji, boardTitle } = input;
    const onReadings = kanji.readings?.on ?? kanji.onyomi ?? [];
    const kunReadings = kanji.readings?.kun ?? kanji.kunyomi ?? [];

    if (mode === 'question') {
      return {
        type: 'kanji',
        primary: kanji.char,
        secondary: `From: ${boardTitle}`,
        hint: kanji.strokeCount ? `${kanji.strokeCount} strokes` : undefined
      };
    } else {
      return {
        type: 'kanji',
        primary: kanji.char,
        secondary: kanji.meaning,
        tertiary: `On: ${onReadings.join(', ')} | Kun: ${kunReadings.join(', ')}`,
        examples: this.getExampleSentences(kanji)
      };
    }
  }

  /**
   * Get progressive hint (custom method)
   */
  getHintByLevel(input: MoodBoardKanjiInput, level: 1 | 2 | 3): string {
    const { kanji } = input;
    const onReadings = kanji.readings?.on ?? kanji.onyomi ?? [];
    const kunReadings = kanji.readings?.kun ?? kanji.kunyomi ?? [];
    const allReadings = [...onReadings, ...kunReadings];

    switch (level) {
      case 1:
        return `This kanji has ${kanji.strokeCount ?? '?'} strokes and is a ${kanji.jlpt ?? 'N5'} level kanji.`;
      case 2:
        const firstReading = onReadings[0] ?? kunReadings[0];
        if (firstReading) {
          return `One reading starts with "${firstReading[0]}"`;
        }
        return `The meaning relates to "${kanji.meaning.substring(0, 3)}..."`;
      case 3:
        return `Meaning: ${kanji.meaning}, Readings: ${allReadings.join(', ')}`;
      default:
        return '';
    }
  }

  /**
   * Extract example sentences from kanji (handles union type)
   */
  private getExampleSentences(kanji: KanjiItem): string[] {
    if (!kanji.examples || kanji.examples.length === 0) {
      return [];
    }

    return kanji.examples.map(ex => {
      if (typeof ex === 'string') {
        return ex;
      }
      return ex.sentence;
    });
  }

  private toHiragana(text: string): string {
    // Convert katakana to hiragana for comparison
    return text.replace(/[\u30A0-\u30FF]/g, (char) => {
      return String.fromCharCode(char.charCodeAt(0) - 0x60);
    });
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

// Factory function
export function createMoodBoardAdapter(config?: ContentTypeConfig): MoodBoardAdapter {
  return new MoodBoardAdapter(config);
}
