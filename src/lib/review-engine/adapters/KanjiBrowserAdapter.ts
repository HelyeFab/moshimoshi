/**
 * Kanji Browser Adapter
 * Extends the base KanjiAdapter to add browse-specific functionality
 */

import { BaseContentAdapter } from './base.adapter';
import { ReviewableContent } from '../core/interfaces';
import { ReviewMode, ContentTypeConfig } from '../core/types';
import { getCuratedVocabularyCandidates } from '@/data/kanjiVocabularyOverrides';
import type { KanjiExample } from '@/types/kanji';
import type { KanjiStudyCard, KanjiStudySequence, ReadingExample, ReadingMatchPair } from '@/types/kanji-study';

export interface KanjiContent {
  id: string;
  character: string;
  kanji?: string; // Alias for character (alternate data sources)
  meanings: string[];
  meaning?: string; // Single meaning (alternate format)
  onyomi: string[];
  kunyomi: string[];
  nanori?: string[];
  strokeCount: number;
  jlptLevel: number;
  jlpt?: string; // String format like "N5" (alternate data sources)
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

// Default config for kanji browser content type
const KANJI_BROWSER_CONFIG: ContentTypeConfig = {
  contentType: 'kanji',
  availableModes: [
    {
      mode: 'recognition',
      showPrimary: true,      // Show English meaning as prompt
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

export class KanjiBrowserAdapter extends BaseContentAdapter<KanjiContent> {
  constructor(config: ContentTypeConfig = KANJI_BROWSER_CONFIG) {
    super(config);
  }

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

      // Review configuration - recognition and listening only (visual kanji selection)
      supportedModes: ['recognition', 'listening'] as ReviewMode[],
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
        const kanjiChar = kanji.character || kanji.kanji || '';
        if (kanjiChar && confusedChars.includes(kanjiChar)) {
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
    return ['recognition', 'listening'] as ReviewMode[];
  }

  /**
   * Get a random reading for TTS playback in listening mode
   * Randomly selects between on'yomi and kun'yomi readings
   */
  getRandomReading(metadata: any): { reading: string; type: 'onyomi' | 'kunyomi' } | null {
    const readings: Array<{ reading: string; type: 'onyomi' | 'kunyomi' }> = [];

    // Add on'yomi readings
    if (metadata?.onyomi && Array.isArray(metadata.onyomi)) {
      for (const reading of metadata.onyomi) {
        if (reading && reading.trim()) {
          readings.push({ reading: reading.trim(), type: 'onyomi' });
        }
      }
    }

    // Add kun'yomi readings (clean okurigana after .)
    if (metadata?.kunyomi && Array.isArray(metadata.kunyomi)) {
      for (const reading of metadata.kunyomi) {
        if (reading && reading.trim()) {
          // Remove okurigana after '.' (e.g., 'やま.す' -> 'やま')
          const cleanReading = reading.split('.')[0].trim();
          if (cleanReading) {
            readings.push({ reading: cleanReading, type: 'kunyomi' });
          }
        }
      }
    }

    if (readings.length === 0) {
      return null;
    }

    // Random selection
    return readings[Math.floor(Math.random() * readings.length)];
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

  /**
   * Generate vocabulary-first study cards for a kanji
   * Returns a sequence of cards: meaning -> vocabulary cards -> reading summary
   *
   * Performance: Uses indexed lookup, O(m) per reading where m = words containing kanji
   * Caches results to avoid redundant work
   */
  async generateVocabularyFirstCards(kanji: KanjiContent | any): Promise<{
    cards: KanjiStudyCard[]
    sources: { curated: number; jmdict: number; fallback: number }
  }> {
    const {
      findWordsForKanjiReading,
      getBestVocabularyMatch,
      normalizeKana, // Import canonical normalization
    } = await import('@/utils/kanjiVocabularyLookup')
    const { getPrioritizedKanjiReadings } = await import('@/utils/kanjiReadingPriority')
    const { DEFAULT_VOCABULARY_CRITERIA } = await import('@/types/kanji-study')

    const cards: KanjiStudyCard[] = []
    const kanjiChar = kanji.character || kanji.kanji
    const meanings = kanji.meanings || (kanji.meaning ? [kanji.meaning] : [])
    const primaryMeaning = meanings[0] || 'Unknown'

    // Track vocabulary sources for accurate metadata
    let curatedCardCount = 0
    let jmdictCardCount = 0
    let fallbackCardCount = 0

    // 1. Meaning card (always first)
    const meaningCard: KanjiStudyCard = {
      id: `${kanjiChar}-meaning`,
      type: 'meaning',
      kanjiCharacter: kanjiChar,
      primaryMeaning,
      allMeanings: meanings,
      strokeCount: kanji.strokeCount,
      jlptLevel: kanji.jlpt || (kanji.jlptLevel ? `N${kanji.jlptLevel}` : undefined),
    }
    cards.push(meaningCard)

    // 2. Get prioritized readings
    const prioritized = await getPrioritizedKanjiReadings(
      kanjiChar,
      kanji.onyomi || [],
      kanji.kunyomi || []
    )

    const readingsWithExamples: ReadingExample[] = []
    const criteria = { ...DEFAULT_VOCABULARY_CRITERIA }
    const examples = kanji.examples || []
    const coveredReadings = new Set<string>() // Track which readings got cards

    // 3. Generate vocabulary cards for prioritized readings
    // Support mixed-source: JMdict for some readings, fallback for others

    // Try kunyomi first (usually more concrete/beginner-friendly)
    for (const reading of prioritized.kunyomi) {
      const curatedCandidates = getCuratedVocabularyCandidates(kanjiChar, reading, 'kunyomi')
      const curatedCandidate = curatedCandidates[0]
      if (curatedCandidate) {
        curatedCardCount++
        coveredReadings.add(reading)

        const vocabCard: KanjiStudyCard = {
          id: `${kanjiChar}-vocab-kun-curated-${reading}`,
          type: 'vocabulary',
          kanjiCharacter: kanjiChar,
          word: curatedCandidate.word,
          wordReading: curatedCandidate.wordReading,
          wordMeaning: curatedCandidate.meaning,
          targetReading: reading,
          readingType: 'kunyomi',
          isCommonWord: curatedCandidate.isCommonWord ?? true,
          wordTags: ['curated'],
          source: 'curated',
          patternHint: curatedCandidate.word.length === 1
            ? 'This word is just the kanji by itself'
            : undefined,
        }
        cards.push(vocabCard)

        readingsWithExamples.push({
          reading,
          readingType: 'kunyomi',
          exampleWord: curatedCandidate.word,
          exampleReading: curatedCandidate.wordReading,
          exampleMeaning: curatedCandidate.meaning,
        })
        continue
      }

      const result = await findWordsForKanjiReading(
        kanjiChar,
        reading,
        'kunyomi',
        criteria,
        kanji.jlpt
      )

      const bestMatch = getBestVocabularyMatch(result)
      if (bestMatch) {
        jmdictCardCount++ // Track JMdict source
        coveredReadings.add(reading)

        // Create vocabulary card from JMdict
        const vocabCard: KanjiStudyCard = {
          id: `${kanjiChar}-vocab-kun-${reading}`,
          type: 'vocabulary',
          kanjiCharacter: kanjiChar,
          word: bestMatch.word,
          wordReading: bestMatch.wordReading,
          wordMeaning: bestMatch.meaning,
          targetReading: reading,
          readingType: 'kunyomi',
          isCommonWord: bestMatch.isCommon,
          wordTags: bestMatch.tags,
          source: 'jmdict',
          patternHint: bestMatch.word.length === 1
            ? 'This word is just the kanji by itself'
            : undefined,
        }
        cards.push(vocabCard)

        // Track for reading summary
        readingsWithExamples.push({
          reading,
          readingType: 'kunyomi',
          exampleWord: bestMatch.word,
          exampleReading: bestMatch.wordReading,
          exampleMeaning: bestMatch.meaning,
        })
      } else if (examples.length > 0) {
        // Fallback: try to find example for this specific reading
        const matchingExample = examples.find((ex: KanjiExample) =>
          normalizeKana(ex.reading).includes(normalizeKana(reading))
        )
        if (matchingExample) {
          fallbackCardCount++ // Track fallback source
          coveredReadings.add(reading)

          const vocabCard: KanjiStudyCard = {
            id: `${kanjiChar}-vocab-kun-fallback-${reading}`,
            type: 'vocabulary',
            kanjiCharacter: kanjiChar,
            word: matchingExample.word,
            wordReading: matchingExample.reading,
            wordMeaning: matchingExample.meaning,
            targetReading: reading,
            readingType: 'kunyomi',
            isCommonWord: false,
            wordTags: [],
            source: 'fallback',
          }
          cards.push(vocabCard)

          readingsWithExamples.push({
            reading,
            readingType: 'kunyomi',
            exampleWord: matchingExample.word,
            exampleReading: matchingExample.reading,
            exampleMeaning: matchingExample.meaning,
          })
        }
      }
    }

    // Try onyomi
    for (const reading of prioritized.onyomi) {
      const curatedCandidates = getCuratedVocabularyCandidates(kanjiChar, reading, 'onyomi')
      const curatedCandidate = curatedCandidates[0]
      if (curatedCandidate) {
        curatedCardCount++
        coveredReadings.add(reading)

        const vocabCard: KanjiStudyCard = {
          id: `${kanjiChar}-vocab-on-curated-${reading}`,
          type: 'vocabulary',
          kanjiCharacter: kanjiChar,
          word: curatedCandidate.word,
          wordReading: curatedCandidate.wordReading,
          wordMeaning: curatedCandidate.meaning,
          targetReading: reading,
          readingType: 'onyomi',
          isCommonWord: curatedCandidate.isCommonWord ?? true,
          wordTags: ['curated'],
          source: 'curated',
          patternHint: curatedCandidate.word.length > 1
            ? 'On\'yomi readings usually appear in compound words'
            : undefined,
        }
        cards.push(vocabCard)

        readingsWithExamples.push({
          reading,
          readingType: 'onyomi',
          exampleWord: curatedCandidate.word,
          exampleReading: curatedCandidate.wordReading,
          exampleMeaning: curatedCandidate.meaning,
        })
        continue
      }

      const result = await findWordsForKanjiReading(
        kanjiChar,
        reading,
        'onyomi',
        criteria,
        kanji.jlpt
      )

      const bestMatch = getBestVocabularyMatch(result)
      if (bestMatch) {
        jmdictCardCount++ // Track JMdict source
        coveredReadings.add(reading)

        // Create vocabulary card from JMdict
        const vocabCard: KanjiStudyCard = {
          id: `${kanjiChar}-vocab-on-${reading}`,
          type: 'vocabulary',
          kanjiCharacter: kanjiChar,
          word: bestMatch.word,
          wordReading: bestMatch.wordReading,
          wordMeaning: bestMatch.meaning,
          targetReading: reading,
          readingType: 'onyomi',
          isCommonWord: bestMatch.isCommon,
          wordTags: bestMatch.tags,
          source: 'jmdict',
          patternHint: bestMatch.word.length > 1
            ? 'On\'yomi readings usually appear in compound words'
            : undefined,
        }
        cards.push(vocabCard)

        // Track for reading summary
        readingsWithExamples.push({
          reading,
          readingType: 'onyomi',
          exampleWord: bestMatch.word,
          exampleReading: bestMatch.wordReading,
          exampleMeaning: bestMatch.meaning,
        })
      } else if (examples.length > 0) {
        // Fallback: try to find example for this specific reading
        const matchingExample = examples.find((ex: KanjiExample) =>
          normalizeKana(ex.reading).includes(normalizeKana(reading))
        )
        if (matchingExample) {
          fallbackCardCount++ // Track fallback source
          coveredReadings.add(reading)

          const vocabCard: KanjiStudyCard = {
            id: `${kanjiChar}-vocab-on-fallback-${reading}`,
            type: 'vocabulary',
            kanjiCharacter: kanjiChar,
            word: matchingExample.word,
            wordReading: matchingExample.reading,
            wordMeaning: matchingExample.meaning,
            targetReading: reading,
            readingType: 'onyomi',
            isCommonWord: false,
            wordTags: [],
            source: 'fallback',
          }
          cards.push(vocabCard)

          readingsWithExamples.push({
            reading,
            readingType: 'onyomi',
            exampleWord: matchingExample.word,
            exampleReading: matchingExample.reading,
            exampleMeaning: matchingExample.meaning,
          })
        }
      }
    }

    // Final fallback: if NO vocabulary cards at all, use first example
    if (cards.length === 1 && examples.length > 0) {
      fallbackCardCount++
      const firstExample = examples[0]
      const vocabCard: KanjiStudyCard = {
        id: `${kanjiChar}-vocab-fallback-any`,
        type: 'vocabulary',
        kanjiCharacter: kanjiChar,
        word: firstExample.word,
        wordReading: firstExample.reading,
        wordMeaning: firstExample.meaning,
        targetReading: prioritized.primaryReading || '',
        readingType: prioritized.kunyomi.length > 0 ? 'kunyomi' : 'onyomi',
        isCommonWord: false,
        wordTags: [],
        source: 'fallback',
      }
      cards.push(vocabCard)

      readingsWithExamples.push({
        reading: prioritized.primaryReading || '',
        readingType: prioritized.kunyomi.length > 0 ? 'kunyomi' : 'onyomi',
        exampleWord: firstExample.word,
        exampleReading: firstExample.reading,
        exampleMeaning: firstExample.meaning,
      })
    }

    // 4. Reading summary card (always last)
    // Note: Uses canonical normalizeKana imported from kanjiVocabularyLookup
    // for consistent matching behavior between JMdict and fallback paths
    const summaryCard: KanjiStudyCard = {
      id: `${kanjiChar}-summary`,
      type: 'reading-summary',
      kanjiCharacter: kanjiChar,
      onyomi: prioritized.onyomi,
      kunyomi: prioritized.kunyomi,
      primaryReading: prioritized.primaryReading,
      readingsWithExamples,
    }
    cards.push(summaryCard)

    const readingMatchPairs: ReadingMatchPair[] = []
    const seenPairKeys = new Set<string>()
    for (const example of readingsWithExamples) {
      const pairKey = `${example.exampleWord}::${example.exampleReading}`
      if (seenPairKeys.has(pairKey)) continue
      seenPairKeys.add(pairKey)
      readingMatchPairs.push({
        word: example.exampleWord,
        reading: example.exampleReading,
        readingType: example.readingType,
      })
      if (readingMatchPairs.length >= 4) break
    }

    if (readingMatchPairs.length >= 2) {
      cards.push({
        id: `${kanjiChar}-reading-match`,
        type: 'reading-match',
        kanjiCharacter: kanjiChar,
        pairs: readingMatchPairs,
      })
    }

    return {
      cards,
      sources: {
        curated: curatedCardCount,
        jmdict: jmdictCardCount,
        fallback: fallbackCardCount,
      },
    }
  }

  /**
   * Generate a complete study sequence for a kanji
   * Determines source based on actual vocabulary card origins
   */
  async generateStudySequence(kanji: KanjiContent | any): Promise<KanjiStudySequence> {
    const result = await this.generateVocabularyFirstCards(kanji)
    const kanjiChar = kanji.character || kanji.kanji

    // Determine source based on actual card origins
    let source: 'jmdict' | 'fallback' | 'mixed' | 'curated'
    const sourceKinds = [
      result.sources.curated > 0,
      result.sources.jmdict > 0,
      result.sources.fallback > 0,
    ].filter(Boolean).length

    if (result.sources.curated > 0 && sourceKinds === 1) {
      source = 'curated'
    } else if (result.sources.jmdict > 0 && result.sources.fallback === 0 && result.sources.curated === 0) {
      source = 'jmdict'
    } else if (result.sources.fallback > 0 && result.sources.jmdict === 0 && result.sources.curated === 0) {
      source = 'fallback'
    } else if (sourceKinds > 1) {
      source = 'mixed'
    } else {
      source = 'fallback'
    }

    return {
      kanjiCharacter: kanjiChar,
      cards: result.cards,
      totalCards: result.cards.length,
      vocabularyCardCount: result.sources.curated + result.sources.jmdict + result.sources.fallback,
      createdAt: Date.now(),
      source,
    }
  }
}

// Export a singleton instance
export const kanjiBrowserAdapter = new KanjiBrowserAdapter(KANJI_BROWSER_CONFIG);
