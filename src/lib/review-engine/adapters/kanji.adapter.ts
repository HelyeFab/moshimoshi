/**
 * Adapter for transforming kanji content into ReviewableContent
 */

import { BaseContentAdapter } from './base.adapter';
import { ReviewableContent } from '../core/interfaces';
import { ReviewMode } from '../core/types';

export interface KanjiContent {
  id: string;
  character: string;
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
  grade: number;
  jlpt: number;
  strokeCount: number;
  radicals: string[];
  examples: Array<{
    word: string;
    reading: string;
    meaning: string;
  }>;
}

export class KanjiAdapter extends BaseContentAdapter<KanjiContent> {
  // Common confusion pairs based on visual similarity and learning data
  private static readonly CONFUSION_PAIRS: [string, string][] = [
    ['末', '未'],  // end vs not yet
    ['土', '士'],  // earth vs samurai
    ['千', '干'],  // thousand vs dry
    ['大', '犬'],  // big vs dog
    ['人', '入'],  // person vs enter
    ['日', '曰'],  // day vs say
    ['右', '石'],  // right vs stone
    ['木', '本'],  // tree vs book/origin
    ['上', '下'],  // up vs down (opposites but visually similar)
    ['工', '土'],  // craft vs earth
    ['力', '刀'],  // power vs sword
    ['己', '已'],  // self vs already
    ['戸', '戻'],  // door vs return
    ['天', '夫'],  // heaven vs husband
    ['太', '大'],  // thick vs big
  ];

  // Semantic categories for meaning-based grouping
  private static readonly MEANING_CATEGORIES: Record<string, string[]> = {
    'nature': ['water', 'fire', 'earth', 'wind', 'tree', 'mountain', 'river', 'sea', 'rain', 'snow', 'sun', 'moon'],
    'time': ['day', 'month', 'year', 'hour', 'minute', 'time', 'morning', 'evening', 'night', 'week'],
    'people': ['person', 'man', 'woman', 'child', 'friend', 'parent', 'teacher', 'student'],
    'body': ['hand', 'foot', 'eye', 'mouth', 'ear', 'head', 'heart', 'body'],
    'movement': ['go', 'come', 'walk', 'run', 'stop', 'turn', 'enter', 'exit', 'rise', 'fall'],
    'numbers': ['one', 'two', 'three', 'hundred', 'thousand', 'many', 'few'],
    'directions': ['up', 'down', 'left', 'right', 'front', 'back', 'inside', 'outside', 'north', 'south', 'east', 'west'],
  };

  transform(kanji: KanjiContent): ReviewableContent {
    return {
      id: kanji.id,
      contentType: 'kanji',

      primaryDisplay: kanji.character,
      secondaryDisplay: kanji.meanings.join(', '),
      tertiaryDisplay: `音: ${kanji.onyomi.join(', ')} | 訓: ${kanji.kunyomi.join(', ')}`,

      primaryAnswer: kanji.meanings[0], // Primary meaning
      alternativeAnswers: kanji.meanings.slice(1), // Only other meanings, not readings

      imageUrl: `/images/kanji/strokes/${kanji.character}.svg`,

      difficulty: this.calculateDifficulty(kanji),
      tags: [`grade${kanji.grade}`, `jlpt${kanji.jlpt}`, 'kanji'],

      supportedModes: ['recognition', 'recall'],
      preferredMode: 'recognition',

      metadata: {
        strokeCount: kanji.strokeCount,
        radicals: kanji.radicals,
        grade: kanji.grade,
        jlpt: kanji.jlpt,
        examples: kanji.examples
      }
    };
  }

  generateOptions(
    content: ReviewableContent,
    pool: KanjiContent[],
    count: number = 4
  ): ReviewableContent[] {
    const metadata = content.metadata as any;
    const usedIds = new Set<string>([content.id]);
    const options: KanjiContent[] = [];

    // Priority 1: Known confusion pairs
    const confusions = this.getConfusionPairs(content.primaryDisplay, pool);
    this.addOptions(options, confusions, Math.min(1, count - 1), usedIds);

    // Priority 2: Semantic similarity (similar meanings)
    if (options.length < count - 1) {
      const semanticMatches = this.findSimilarByMeaning(content, pool)
        .filter(k => !usedIds.has(k.id));
      this.addOptions(options, semanticMatches, Math.min(2, count - 1 - options.length), usedIds);
    }

    // Priority 3: Structural similarity (shared radicals)
    if (options.length < count - 1 && metadata?.radicals) {
      const structuralMatches = this.findSimilarByRadical(metadata.radicals, pool)
        .filter(k => !usedIds.has(k.id));
      this.addOptions(options, structuralMatches, Math.min(1, count - 1 - options.length), usedIds);
    }

    // Priority 4: Similar stroke count
    if (options.length < count - 1 && metadata?.strokeCount) {
      const strokeMatches = this.findSimilarByStrokes(metadata.strokeCount, pool)
        .filter(k => !usedIds.has(k.id));
      this.addOptions(options, strokeMatches, Math.min(1, count - 1 - options.length), usedIds);
    }

    // Priority 5: Same learning level
    if (options.length < count - 1) {
      const levelMatches = this.findSimilarByLevel(metadata?.jlpt, metadata?.grade, pool)
        .filter(k => !usedIds.has(k.id));
      this.addOptions(options, levelMatches, count - 1 - options.length, usedIds);
    }

    // Fallback: Random selection from pool
    if (options.length < count - 1) {
      const remaining = pool.filter(k => !usedIds.has(k.id));
      this.addRandomOptions(options, remaining, count - 1 - options.length, usedIds);
    }

    return options.map(k => this.transform(k));
  }

  getSupportedModes(): ReviewMode[] {
    return ['recognition', 'recall'];
  }

  prepareForMode(content: ReviewableContent, mode: ReviewMode): ReviewableContent {
    switch (mode) {
      case 'recognition':
        // Show kanji, ask for meaning
        return {
          ...content,
          secondaryDisplay: undefined,  // Hide meaning
          tertiaryDisplay: undefined    // Hide readings
        };

      case 'recall':
        // Show meaning, ask for kanji
        return {
          ...content,
          primaryDisplay: content.secondaryDisplay!, // Show meaning
          secondaryDisplay: undefined,
          tertiaryDisplay: undefined,
          primaryAnswer: content.primaryDisplay  // Expect kanji as answer
        };

      default:
        return content;
    }
  }

  calculateDifficulty(kanji: KanjiContent): number {
    let difficulty = 0.3; // Base difficulty

    // Stroke count factor (more strokes = harder)
    const strokeFactor = Math.min(kanji.strokeCount / 25, 1) * 0.3;
    difficulty += strokeFactor;

    // JLPT level factor (N1 = hardest)
    const jlptFactor = kanji.jlpt ? ((6 - kanji.jlpt) / 5) * 0.3 : 0.15;
    difficulty += jlptFactor;

    // Grade level factor
    const gradeFactor = kanji.grade ? (kanji.grade / 9) * 0.2 : 0.1;
    difficulty += gradeFactor;

    // Multiple readings increase difficulty
    const readingsFactor = Math.min(
      (kanji.onyomi.length + kanji.kunyomi.length) / 10,
      0.2
    );
    difficulty += readingsFactor;

    return Math.min(1.0, difficulty);
  }

  generateHints(content: ReviewableContent): string[] {
    const hints: string[] = [];
    const metadata = content.metadata as any;

    // Hint 1: Stroke count
    if (metadata?.strokeCount) {
      hints.push(`This kanji has ${metadata.strokeCount} strokes`);
    }

    // Hint 2: Radicals
    if (metadata?.radicals && metadata.radicals.length > 0) {
      hints.push(`Contains the radical: ${metadata.radicals[0]}`);
    }

    // Hint 3: Reading hint (first sound)
    if (content.tertiaryDisplay) {
      const readings = content.tertiaryDisplay.split(' | ');
      if (readings[0] && readings[0].includes(':')) {
        const onyomi = readings[0].split(': ')[1];
        if (onyomi && onyomi.length > 0) {
          const firstReading = onyomi.split(', ')[0];
          hints.push(`The on'yomi starts with '${firstReading[0]}'`);
        }
      }
    }

    // Hint 4: Example word
    if (metadata?.examples && metadata.examples.length > 0) {
      const example = metadata.examples[0];
      hints.push(`Used in: ${example.word} (${example.meaning})`);
    }

    // Hint 5: Meaning category
    const category = this.getMeaningCategory(content.primaryAnswer);
    if (category) {
      hints.push(`Related to: ${category}`);
    }

    return hints;
  }

  // Helper methods for distractor generation
  private getConfusionPairs(character: string, pool: KanjiContent[]): KanjiContent[] {
    const pairs = KanjiAdapter.CONFUSION_PAIRS
      .filter(pair => pair.includes(character))
      .flat()
      .filter(k => k !== character);

    return pool.filter(k => pairs.includes(k.character));
  }

  private findSimilarByMeaning(content: ReviewableContent, pool: KanjiContent[]): KanjiContent[] {
    const contentCategories = this.getMeaningCategories(
      content.secondaryDisplay?.split(', ') || []
    );

    if (contentCategories.length === 0) return [];

    return pool.filter(k => {
      const kanjiCategories = this.getMeaningCategories(k.meanings);
      return contentCategories.some(c => kanjiCategories.includes(c));
    }).sort((a, b) => {
      // Sort by how many categories overlap
      const aOverlap = this.getMeaningCategories(a.meanings)
        .filter(c => contentCategories.includes(c)).length;
      const bOverlap = this.getMeaningCategories(b.meanings)
        .filter(c => contentCategories.includes(c)).length;
      return bOverlap - aOverlap;
    });
  }

  private findSimilarByRadical(radicals: string[], pool: KanjiContent[]): KanjiContent[] {
    if (!radicals || radicals.length === 0) return [];

    return pool.filter(k => {
      if (!k.radicals || k.radicals.length === 0) return false;
      return radicals.some(r => k.radicals.includes(r));
    });
  }

  private findSimilarByStrokes(strokeCount: number, pool: KanjiContent[]): KanjiContent[] {
    return pool.filter(k =>
      Math.abs(k.strokeCount - strokeCount) <= 2
    );
  }

  private findSimilarByLevel(jlpt: number | undefined, grade: number | undefined, pool: KanjiContent[]): KanjiContent[] {
    return pool.filter(k => {
      const jlptMatch = jlpt ? k.jlpt === jlpt : false;
      const gradeMatch = grade ? Math.abs(k.grade - grade) <= 1 : false;
      return jlptMatch || gradeMatch;
    });
  }

  private getMeaningCategories(meanings: string[]): string[] {
    const categories = new Set<string>();

    meanings.forEach(meaning => {
      const lower = meaning.toLowerCase();
      Object.entries(KanjiAdapter.MEANING_CATEGORIES).forEach(([category, keywords]) => {
        if (keywords.some(k => lower.includes(k))) {
          categories.add(category);
        }
      });
    });

    return Array.from(categories);
  }

  private getMeaningCategory(meaning: string): string | null {
    const lower = meaning.toLowerCase();

    for (const [category, keywords] of Object.entries(KanjiAdapter.MEANING_CATEGORIES)) {
      if (keywords.some(k => lower.includes(k))) {
        return category;
      }
    }

    return null;
  }

  private addOptions(
    options: KanjiContent[],
    candidates: KanjiContent[],
    maxCount: number,
    usedIds: Set<string>
  ): void {
    const toAdd = candidates.slice(0, maxCount);
    toAdd.forEach(k => {
      if (!usedIds.has(k.id)) {
        options.push(k);
        usedIds.add(k.id);
      }
    });
  }

  private addRandomOptions(
    options: KanjiContent[],
    pool: KanjiContent[],
    count: number,
    usedIds: Set<string>
  ): void {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    let added = 0;

    for (const k of shuffled) {
      if (!usedIds.has(k.id)) {
        options.push(k);
        usedIds.add(k.id);
        added++;
        if (added >= count) break;
      }
    }
  }
}