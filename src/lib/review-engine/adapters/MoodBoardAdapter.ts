import { BaseContentAdapter } from './base.adapter';
import {
  ReviewableContent,
  ContentMetadata,
  ContentInput,
  ContentDisplay,
  ValidationResult,
  ContentContext,
  ReviewSource
} from '../core/interfaces';
import { MoodBoard, KanjiItem } from '@/types/moodboard';

export interface MoodBoardKanjiInput extends ContentInput {
  kanji: KanjiItem;
  boardId: string;
  boardTitle: string;
}

export class MoodBoardAdapter extends BaseContentAdapter<MoodBoardKanjiInput> {
  protected source: ReviewSource = 'moodboard';

  async transform(input: MoodBoardKanjiInput): Promise<ReviewableContent> {
    const { kanji, boardId, boardTitle } = input;
    const id = `moodboard_${boardId}_${kanji.char}`;

    const metadata: ContentMetadata = {
      source: this.source,
      originalId: kanji.char,
      tags: ['moodboard', boardTitle, kanji.jlpt || 'N5'],
      difficulty: this.calculateDifficulty(kanji),
      lastModified: new Date(),
      customData: {
        boardId,
        boardTitle,
        strokeCount: kanji.strokeCount,
        jlptLevel: kanji.jlpt
      }
    };

    const context: ContentContext = {
      relatedItems: kanji.examples?.map(ex => ({
        id: `${id}_ex_${ex.sentence}`,
        type: 'example',
        content: ex.sentence,
        relationship: 'example'
      })) || [],
      prerequisites: [],
      nextItems: []
    };

    return {
      id,
      type: 'kanji',
      content: {
        primaryDisplay: kanji.char,
        secondaryDisplay: kanji.meaning,
        pronunciation: [...(kanji.readings.on || []), ...(kanji.readings.kun || [])].join(', '),
        meaning: kanji.meaning,
        contentType: 'kanji',
        source: `Mood Board: ${boardTitle}`
      },
      metadata,
      context
    };
  }

  async validate(input: MoodBoardKanjiInput, userInput: string): Promise<ValidationResult> {
    const { kanji } = input;
    const normalizedInput = userInput.trim().toLowerCase();

    // Check meaning
    const meaningValid = kanji.meaning.toLowerCase().includes(normalizedInput) ||
                        normalizedInput.includes(kanji.meaning.toLowerCase());

    // Check readings
    const readingsValid = [...(kanji.readings.on || []), ...(kanji.readings.kun || [])]
      .some(reading => {
        const normalizedReading = reading.toLowerCase();
        return normalizedReading === normalizedInput ||
               this.toHiragana(normalizedReading) === this.toHiragana(normalizedInput);
      });

    const isCorrect = meaningValid || readingsValid;

    return {
      isCorrect,
      score: isCorrect ? 1.0 : 0,
      feedback: isCorrect
        ? `Correct! ${kanji.char} can be read as ${[...kanji.readings.on, ...kanji.readings.kun].join(', ')} and means "${kanji.meaning}".`
        : `Not quite. ${kanji.char} is read as ${[...kanji.readings.on, ...kanji.readings.kun].join(', ')} and means "${kanji.meaning}".`,
      details: {
        expected: {
          meanings: [kanji.meaning],
          readings: [...(kanji.readings.on || []), ...(kanji.readings.kun || [])]
        },
        received: userInput,
        matchType: meaningValid ? 'meaning' : readingsValid ? 'reading' : 'none'
      }
    };
  }

  async getDisplay(input: MoodBoardKanjiInput, mode: 'question' | 'answer'): Promise<ContentDisplay> {
    const { kanji, boardTitle } = input;

    if (mode === 'question') {
      return {
        type: 'kanji',
        primary: kanji.char,
        secondary: `From: ${boardTitle}`,
        hint: kanji.strokeCount ? `${kanji.strokeCount} strokes` : undefined,
        audio: undefined
      };
    } else {
      return {
        type: 'kanji',
        primary: kanji.char,
        secondary: kanji.meaning,
        tertiary: `On: ${kanji.readings.on.join(', ')} | Kun: ${kanji.readings.kun.join(', ')}`,
        examples: kanji.examples?.map(ex => ex.sentence),
        audio: undefined
      };
    }
  }

  async getHint(input: MoodBoardKanjiInput, level: 1 | 2 | 3): Promise<string> {
    const { kanji } = input;

    switch (level) {
      case 1:
        return `This kanji has ${kanji.strokeCount || '?'} strokes and is a ${kanji.jlpt || 'N5'} level kanji.`;
      case 2:
        const firstReading = kanji.readings.on[0] || kanji.readings.kun[0];
        if (firstReading) {
          return `One reading starts with "${firstReading[0]}"`;
        }
        return `The meaning relates to "${kanji.meaning.substring(0, 3)}..."`;
      case 3:
        return `Meaning: ${kanji.meaning}, Readings: ${[...kanji.readings.on, ...kanji.readings.kun].join(', ')}`;
      default:
        return '';
    }
  }

  private calculateDifficulty(kanji: KanjiItem): number {
    // Base difficulty on JLPT level
    const jlptDifficulty: Record<string, number> = {
      'N5': 1,
      'N4': 2,
      'N3': 3,
      'N2': 4,
      'N1': 5
    };

    let difficulty = jlptDifficulty[kanji.jlpt || 'N5'] || 3;

    // Adjust based on stroke count
    if (kanji.strokeCount) {
      if (kanji.strokeCount > 15) difficulty += 0.5;
      if (kanji.strokeCount > 20) difficulty += 0.5;
    }

    // Adjust based on number of readings
    const totalReadings = (kanji.readings.on?.length || 0) + (kanji.readings.kun?.length || 0);
    if (totalReadings > 4) difficulty += 0.3;
    if (totalReadings > 6) difficulty += 0.2;

    return Math.min(5, Math.max(1, difficulty));
  }

  private toHiragana(text: string): string {
    // Convert katakana to hiragana for comparison
    return text.replace(/[\u30A0-\u30FF]/g, (char) => {
      return String.fromCharCode(char.charCodeAt(0) - 0x60);
    });
  }
}

// Factory function
export function createMoodBoardAdapter(): MoodBoardAdapter {
  return new MoodBoardAdapter();
}