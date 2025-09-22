/**
 * Kanji Browser Adapter
 * Extends the base KanjiAdapter to add browse-specific functionality
 */

import { BaseContentAdapter } from './base.adapter';
import { ReviewableContent, ReviewMode } from '../core/interfaces';

export interface KanjiContent {
  id: string;
  character: string;
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
  nanori?: string[];
  strokeCount: number;
  jlptLevel: number;
  grade: number;
  frequency?: number;
  radicals: Array<{ character: string; meaning: string }>;
  components?: string[];
  examples?: Array<{
    word: string;
    reading: string;
    meaning: string;
  }>;
  mnemonics?: string;
  strokeOrderData?: string; // SVG or stroke order data
  source?: string;
  meaningNotes?: string;
}

export interface BrowseableContent extends ReviewableContent {
  browseMetadata: {
    jlptLevel: number;
    grade: number;
    frequency?: number;
    strokeCount: number;
    radicals: Array<{ character: string; meaning: string }>;
    components?: string[];
    meanings: {
      primary: string;
      all: string[];
      notes?: string;
    };
    readings: {
      onyomi: string[];
      kunyomi: string[];
      nanori?: string[];
    };
    examples?: Array<{
      word: string;
      reading: string;
      meaning: string;
    }>;
    relatedKanji?: string[];
    mnemonics?: string;
    strokeOrderSvg?: string;
  };
  searchableText: string;
  filters: {
    jlpt: string;
    grade: string;
    strokes: string;
    frequency?: string;
  };
  actions?: string[];
}

export class KanjiBrowserAdapter extends BaseContentAdapter<KanjiContent> {

  /**
   * Transform kanji content to reviewable format
   */
  transform(kanji: KanjiContent | any): ReviewableContent {
    // Handle both KanjiContent (with id) and Kanji type (without id)
    const id = kanji.id || kanji.kanji || kanji.character;

    // Extract JLPT level properly (handle both jlpt and jlptLevel fields)
    const jlptLevel = typeof kanji.jlpt === 'string'
      ? parseInt(kanji.jlpt.replace('N', ''))
      : (kanji.jlptLevel || 5);

    // Store the raw data in metadata for use in KanjiCard
    const metadata: any = {
      strokeCount: kanji.strokeCount,
      radicals: kanji.radicals,
      jlptLevel: jlptLevel,
      jlpt: kanji.jlpt,  // Keep original jlpt string if available
      grade: kanji.grade,
      frequency: kanji.frequency,
      components: kanji.components,
      examples: kanji.examples,
      // Store full kanji data for proper display
      kanjiCharacter: kanji.character || kanji.kanji,
      meanings: kanji.meanings || [kanji.meaning],
      onyomi: kanji.onyomi || [],
      kunyomi: kanji.kunyomi || [],
      meaning: kanji.meaning || kanji.meanings?.[0] || ''
    };

    // Create normalized kanji object for methods that expect jlptLevel as number
    const normalizedKanji = {
      ...kanji,
      jlptLevel: jlptLevel,
      meanings: kanji.meanings || [kanji.meaning]
    };

    return {
      id: id,
      contentType: 'kanji',

      // For recall mode: show meanings as question, kanji as answer
      // The KanjiCard component will use these correctly based on mode
      primaryDisplay: kanji.meaning || kanji.meanings?.join(', ') || '',
      secondaryDisplay: this.formatReadings(kanji),
      tertiaryDisplay: undefined,

      // Answer fields
      primaryAnswer: kanji.character || kanji.kanji,
      alternativeAnswers: kanji.meanings?.slice(1) || [],

      // Media and metadata
      difficulty: this.calculateDifficulty(normalizedKanji),
      tags: this.generateTags(kanji),
      source: kanji.source || 'kanji_browser',

      // Review configuration
      supportedModes: ['recognition', 'recall', 'writing'] as ReviewMode[],
      preferredMode: 'recognition' as ReviewMode,

      // Use the metadata we created above
      metadata: metadata
    };
  }

  /**
   * Transform kanji for browse mode with rich metadata
   */
  transformForBrowse(kanji: KanjiContent): BrowseableContent {
    const base = this.transform(kanji);

    // Extract JLPT level properly
    const jlptLevel = typeof kanji.jlpt === 'string'
      ? parseInt(kanji.jlpt.replace('N', ''))
      : (kanji.jlptLevel || 5);

    return {
      ...base,
      browseMetadata: {
        jlptLevel: jlptLevel,
        grade: kanji.grade,
        frequency: kanji.frequency,
        strokeCount: kanji.strokeCount,
        radicals: kanji.radicals,
        components: kanji.components,
        meanings: {
          primary: kanji.meanings[0],
          all: kanji.meanings,
          notes: kanji.meaningNotes
        },
        readings: {
          onyomi: kanji.onyomi,
          kunyomi: kanji.kunyomi,
          nanori: kanji.nanori
        },
        examples: kanji.examples,
        relatedKanji: this.findRelatedKanji(kanji),
        mnemonics: kanji.mnemonics,
        strokeOrderSvg: kanji.strokeOrderData
      },
      searchableText: this.generateSearchIndex(kanji),
      filters: {
        jlpt: `n${kanji.jlptLevel}`,
        grade: kanji.grade.toString(),
        strokes: this.getStrokeRange(kanji.strokeCount),
        frequency: kanji.frequency ? this.getFrequencyBand(kanji.frequency) : undefined
      },
      actions: ['bookmark', 'addToReview', 'practice', 'viewDetails']
    };
  }

  /**
   * Generate options for multiple choice questions
   * Uses the pool of available kanji to intelligently select distractors
   */
  generateOptions(content: ReviewableContent, pool: KanjiContent[], count: number = 4): ReviewableContent[] {
    // Get the correct kanji character from the content
    const correctKanji = content.primaryAnswer;
    const selectedKanji: KanjiContent[] = [];

    // Find the correct kanji in the pool first
    const correctKanjiData = pool.find(k => (k.character || k.kanji) === correctKanji);
    if (!correctKanjiData) {
      // If not found in pool, create a minimal version
      const minimalKanji: KanjiContent = {
        id: correctKanji,
        character: correctKanji,
        meanings: [content.primaryDisplay],
        onyomi: [],
        kunyomi: [],
        strokeCount: 0,
        jlptLevel: 5,
        grade: 0,
        radicals: []
      };
      selectedKanji.push(minimalKanji);
    } else {
      selectedKanji.push(correctKanjiData);
    }

    // Filter out the correct answer from the pool
    const availablePool = pool.filter(k => (k.character || k.kanji) !== correctKanji);

    // Strategy 1: Find visually similar kanji (similar radicals or components)
    const visuallySimilar = this.findVisuallySimilar(correctKanjiData || selectedKanji[0], availablePool);
    for (const similar of visuallySimilar) {
      if (selectedKanji.length >= count) break;
      if (!selectedKanji.some(s => (s.character || s.kanji) === (similar.character || similar.kanji))) {
        selectedKanji.push(similar);
      }
    }

    // Strategy 2: Find kanji with similar difficulty (JLPT level, stroke count)
    const similarDifficulty = this.findSimilarDifficulty(correctKanjiData || selectedKanji[0], availablePool);
    for (const similar of similarDifficulty) {
      if (selectedKanji.length >= count) break;
      if (!selectedKanji.some(s => (s.character || s.kanji) === (similar.character || similar.kanji))) {
        selectedKanji.push(similar);
      }
    }

    // Strategy 3: Find semantically related kanji (similar meanings)
    const semanticallySimilar = this.findSemanticallySimilar(correctKanjiData || selectedKanji[0], availablePool);
    for (const similar of semanticallySimilar) {
      if (selectedKanji.length >= count) break;
      if (!selectedKanji.some(s => (s.character || s.kanji) === (similar.character || similar.kanji))) {
        selectedKanji.push(similar);
      }
    }

    // Strategy 4: Fill remaining slots with random kanji from pool
    const shuffledPool = this.shuffle([...availablePool]);
    for (const randomKanji of shuffledPool) {
      if (selectedKanji.length >= count) break;
      if (!selectedKanji.some(s => (s.character || s.kanji) === (randomKanji.character || randomKanji.kanji))) {
        selectedKanji.push(randomKanji);
      }
    }

    // If still not enough options (pool too small), duplicate some meanings but indicate they're wrong
    while (selectedKanji.length < count) {
      const placeholder: KanjiContent = {
        id: `placeholder_${selectedKanji.length}`,
        character: '〇', // Placeholder character
        meanings: ['(no more options)'],
        onyomi: [],
        kunyomi: [],
        strokeCount: 0,
        jlptLevel: 5,
        grade: 0,
        radicals: []
      };
      selectedKanji.push(placeholder);
    }

    // Shuffle and convert to ReviewableContent
    const shuffled = this.shuffle(selectedKanji);
    return shuffled.map(kanji => ({
      id: kanji.id || kanji.character || kanji.kanji || '',
      contentType: 'kanji',
      primaryDisplay: kanji.character || kanji.kanji || '', // The kanji character to display
      secondaryDisplay: '', // No secondary display for options
      tertiaryDisplay: undefined,
      primaryAnswer: kanji.character || kanji.kanji || '',
      alternativeAnswers: [],
      difficulty: this.calculateDifficulty(kanji),
      tags: [],
      source: 'kanji_browser',
      supportedModes: ['recognition'] as ReviewMode[],
      preferredMode: 'recognition' as ReviewMode,
      metadata: {
        isOption: true,
        meanings: kanji.meanings,
        strokeCount: kanji.strokeCount,
        jlptLevel: kanji.jlptLevel
      }
    }));
  }

  /**
   * Find visually similar kanji based on shared radicals or components
   */
  private findVisuallySimilar(target: KanjiContent, pool: KanjiContent[]): KanjiContent[] {
    const similar: KanjiContent[] = [];

    // Known confusion pairs
    const confusionPairs: { [key: string]: string[] } = {
      '日': ['月', '目', '白'],
      '月': ['日', '目', '肉'],
      '土': ['士', '工', '王'],
      '人': ['入', '大', '天'],
      '末': ['未', '本', '木'],
      '千': ['干', '于', '午'],
      '大': ['太', '犬', '天'],
      '小': ['少', '水', '氷']
    };

    const targetChar = target.character || target.kanji || '';
    if (confusionPairs[targetChar]) {
      const confusedChars = confusionPairs[targetChar];
      for (const kanji of pool) {
        const kanjiChar = kanji.character || kanji.kanji;
        if (confusedChars.includes(kanjiChar)) {
          similar.push(kanji);
        }
      }
    }

    // Find kanji with shared radicals
    if (target.radicals && target.radicals.length > 0) {
      for (const kanji of pool) {
        if (kanji.radicals && kanji.radicals.length > 0) {
          const sharedRadicals = target.radicals.filter(tr =>
            kanji.radicals.some(kr => kr.character === tr.character)
          );
          if (sharedRadicals.length > 0) {
            similar.push(kanji);
          }
        }
      }
    }

    return similar.slice(0, 5); // Return top 5 most similar
  }

  /**
   * Find kanji with similar difficulty level
   */
  private findSimilarDifficulty(target: KanjiContent, pool: KanjiContent[]): KanjiContent[] {
    const targetJlpt = target.jlptLevel || 5;
    const targetStrokes = target.strokeCount || 0;

    return pool
      .filter(kanji => {
        const jlptDiff = Math.abs((kanji.jlptLevel || 5) - targetJlpt);
        const strokeDiff = Math.abs((kanji.strokeCount || 0) - targetStrokes);
        return jlptDiff <= 1 && strokeDiff <= 3; // Similar JLPT and stroke count
      })
      .sort((a, b) => {
        // Sort by similarity
        const aDiff = Math.abs((a.jlptLevel || 5) - targetJlpt) + Math.abs((a.strokeCount || 0) - targetStrokes);
        const bDiff = Math.abs((b.jlptLevel || 5) - targetJlpt) + Math.abs((b.strokeCount || 0) - targetStrokes);
        return aDiff - bDiff;
      })
      .slice(0, 5);
  }

  /**
   * Find semantically similar kanji based on meaning categories
   */
  private findSemanticallySimilar(target: KanjiContent, pool: KanjiContent[]): KanjiContent[] {
    const categories: { [key: string]: string[] } = {
      nature: ['sun', 'moon', 'water', 'fire', 'earth', 'mountain', 'river', 'tree', 'flower', 'rain', 'snow', 'wind', 'sky', 'star'],
      time: ['day', 'month', 'year', 'time', 'hour', 'minute', 'week', 'morning', 'evening', 'night', 'spring', 'summer', 'autumn', 'winter'],
      people: ['person', 'man', 'woman', 'child', 'father', 'mother', 'friend', 'teacher', 'student'],
      numbers: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred', 'thousand'],
      body: ['hand', 'eye', 'mouth', 'ear', 'foot', 'head', 'heart', 'body']
    };

    // Find which categories the target belongs to
    const targetMeanings = target.meanings.map(m => m.toLowerCase());
    const targetCategories: string[] = [];

    for (const [category, words] of Object.entries(categories)) {
      if (words.some(word => targetMeanings.some(meaning => meaning.includes(word)))) {
        targetCategories.push(category);
      }
    }

    // Find kanji in the same categories
    const similar: KanjiContent[] = [];
    for (const kanji of pool) {
      const kanjiMeanings = kanji.meanings.map(m => m.toLowerCase());
      for (const category of targetCategories) {
        if (categories[category].some(word => kanjiMeanings.some(meaning => meaning.includes(word)))) {
          similar.push(kanji);
          break;
        }
      }
    }

    return similar.slice(0, 5);
  }

  /**
   * Prepare content for specific review mode
   */
  prepareForMode(content: ReviewableContent, mode: ReviewMode): ReviewableContent {
    switch (mode) {
      case 'recognition':
        // Show meaning, user selects from kanji characters
        return {
          ...content,
          primaryDisplay: content.primaryDisplay, // Keep the meaning display
          secondaryDisplay: undefined,
          tertiaryDisplay: undefined,
          // The correct answer is the kanji character
          primaryAnswer: content.primaryAnswer,
          alternativeAnswers: content.alternativeAnswers || []
        };

      case 'recall':
        // Show meaning, user types the kanji
        return {
          ...content,
          primaryDisplay: content.primaryDisplay, // Meanings
          secondaryDisplay: content.secondaryDisplay, // Readings
          tertiaryDisplay: undefined,
          primaryAnswer: content.primaryAnswer // Kanji character
        };

      case 'listening':
        // Not typically used for kanji
        return content;

      default:
        return content;
    }
  }

  /**
   * Calculate difficulty based on multiple factors
   */
  calculateDifficulty(kanji: KanjiContent): number {
    const strokeDifficulty = Math.min(kanji.strokeCount / 30, 1);
    const jlptDifficulty = (6 - kanji.jlptLevel) / 5;
    const frequencyDifficulty = kanji.frequency
      ? 1 - (Math.min(kanji.frequency, 2500) / 2500)
      : 0.5;

    return (strokeDifficulty * 0.3 + jlptDifficulty * 0.4 + frequencyDifficulty * 0.3);
  }

  /**
   * Get supported review modes for kanji
   */
  getSupportedModes(): ReviewMode[] {
    return ['recognition', 'recall', 'writing'] as ReviewMode[];
  }

  /**
   * Generate hints for the content (required by base class)
   */
  generateHints(content: ReviewableContent): string[] {
    const hints: string[] = [];
    const metadata = content.metadata as any;

    if (metadata?.strokeCount) {
      hints.push(`This kanji has ${metadata.strokeCount} strokes`);
    }

    if (metadata?.radicals?.length > 0) {
      hints.push(`It contains the radical: ${metadata.radicals[0]?.meaning || 'N/A'}`);
    }

    if (metadata?.onyomi?.length > 0) {
      hints.push(`The on'yomi reading is: ${metadata.onyomi[0]}`);
    }

    if (metadata?.meanings?.length > 0) {
      hints.push(`The first meaning is: ${metadata.meanings[0]}`);
    }

    return hints;
  }

  /**
   * Generate hint for the kanji (legacy method for backward compatibility)
   */
  generateHint(kanji: KanjiContent, level: number = 1): string {
    switch (level) {
      case 1:
        return `This kanji has ${kanji.strokeCount} strokes`;
      case 2:
        return `It contains the radical: ${kanji.radicals[0]?.meaning || 'N/A'}`;
      case 3:
        return `The on'yomi reading is: ${kanji.onyomi[0] || 'N/A'}`;
      default:
        return `The first meaning is: ${kanji.meanings[0]}`;
    }
  }

  /**
   * Format readings for display
   */
  private formatReadings(kanji: KanjiContent | any): string {
    const readings: string[] = [];

    if (kanji.onyomi && kanji.onyomi.length > 0) {
      readings.push(`On: ${kanji.onyomi.join(', ')}`);
    }

    if (kanji.kunyomi && kanji.kunyomi.length > 0) {
      readings.push(`Kun: ${kanji.kunyomi.join(', ')}`);
    }

    return readings.join(' | ');
  }

  /**
   * Generate tags for categorization
   */
  private generateTags(kanji: KanjiContent | any): string[] {
    const tags = ['kanji'];

    // Handle both jlptLevel (number) and jlpt (string like "N5")
    const jlptLevel = kanji.jlptLevel || (kanji.jlpt ? parseInt(kanji.jlpt.replace('N', '')) : null);
    if (jlptLevel) {
      tags.push(`jlpt-n${jlptLevel}`);
    }

    if (kanji.grade) tags.push(`grade-${kanji.grade}`);
    if (kanji.strokeCount) tags.push(`strokes-${kanji.strokeCount}`);

    if (kanji.frequency && kanji.frequency <= 500) {
      tags.push('common');
    } else if (kanji.frequency && kanji.frequency <= 1000) {
      tags.push('frequent');
    }

    return tags;
  }

  /**
   * Generate comprehensive search index
   */
  private generateSearchIndex(kanji: KanjiContent): string {
    const parts = [
      kanji.character,
      ...kanji.meanings,
      ...kanji.onyomi,
      ...kanji.kunyomi,
      ...(kanji.nanori || []),
      ...kanji.radicals.map(r => r.meaning),
      kanji.mnemonics || ''
    ];

    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  /**
   * Find related kanji based on radicals and components
   */
  private findRelatedKanji(kanji: KanjiContent): string[] {
    // In production, this would query a database
    // For now, return empty array
    return [];
  }

  /**
   * Get stroke count range for filtering
   */
  private getStrokeRange(strokes: number): string {
    if (strokes <= 5) return '1-5';
    if (strokes <= 10) return '6-10';
    if (strokes <= 15) return '11-15';
    if (strokes <= 20) return '16-20';
    return '21+';
  }

  /**
   * Get frequency band for categorization
   */
  private getFrequencyBand(frequency: number): string {
    if (frequency <= 500) return 'very-common';
    if (frequency <= 1000) return 'common';
    if (frequency <= 2000) return 'frequent';
    return 'occasional';
  }

  /**
   * Shuffle array for randomization
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

// Export a singleton instance
export const kanjiBrowserAdapter = new KanjiBrowserAdapter();