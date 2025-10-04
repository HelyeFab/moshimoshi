# Module 2: Content Adapters

**Status**: 🔴 Not Started  
**Priority**: HIGH  
**Owner**: Agent 2  
**Dependencies**: Core Interfaces (Module 1)  
**Estimated Time**: 4-5 hours  

## Overview
Create adapter classes that transform various content types (kana, kanji, vocabulary, sentences) into the standard ReviewableContent interface. Each adapter handles the specific needs and quirks of its content type.

## Deliverables

### 1. Base Adapter Class

```typescript
// lib/review-engine/adapters/base.adapter.ts

import { ReviewableContent, ReviewMode, ContentTypeConfig } from '../core/interfaces';

export abstract class BaseContentAdapter<T = any> {
  protected config: ContentTypeConfig;
  
  constructor(config: ContentTypeConfig) {
    this.config = config;
  }
  
  /**
   * Transform raw content into ReviewableContent
   */
  abstract transform(rawContent: T): ReviewableContent;
  
  /**
   * Generate multiple choice options for recognition mode
   */
  abstract generateOptions(
    content: ReviewableContent, 
    pool: T[], 
    count: number
  ): ReviewableContent[];
  
  /**
   * Determine which review modes are supported
   */
  abstract getSupportedModes(): ReviewMode[];
  
  /**
   * Prepare content for specific review mode
   */
  abstract prepareForMode(
    content: ReviewableContent, 
    mode: ReviewMode
  ): ReviewableContent;
  
  /**
   * Calculate difficulty based on content characteristics
   */
  abstract calculateDifficulty(content: T): number;
  
  /**
   * Generate hints for the content
   */
  abstract generateHints(content: ReviewableContent): string[];
  
  /**
   * Validate if raw content can be adapted
   */
  protected validate(content: T): boolean {
    return content !== null && content !== undefined;
  }
  
  /**
   * Common utility for similarity scoring
   */
  protected calculateSimilarity(a: string, b: string): number {
    // Levenshtein distance or similar algorithm
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    return 1 - (distance / maxLength);
  }
}
```

### 2. Kana Adapter

```typescript
// lib/review-engine/adapters/kana.adapter.ts

import { BaseContentAdapter } from './base.adapter';
import { ReviewableContent, ReviewMode } from '../core/interfaces';

export interface KanaContent {
  id: string;
  hiragana: string;
  katakana: string;
  romaji: string;
  type: 'vowel' | 'consonant' | 'digraph';
  row: string;
  column: string;
  pronunciation?: string;
}

export class KanaAdapter extends BaseContentAdapter<KanaContent> {
  transform(kana: KanaContent): ReviewableContent {
    const displayScript = this.config.features?.displayScript || 'hiragana';
    
    return {
      id: kana.id,
      contentType: 'kana',
      
      // Display fields
      primaryDisplay: displayScript === 'hiragana' ? kana.hiragana : kana.katakana,
      secondaryDisplay: kana.romaji,
      tertiaryDisplay: kana.pronunciation,
      
      // Answer fields
      primaryAnswer: kana.romaji,
      alternativeAnswers: [
        kana.hiragana,
        kana.katakana,
        // Handle special cases like 'shi' vs 'si'
        ...this.getAlternativeRomanizations(kana.romaji)
      ],
      
      // Media
      audioUrl: `/audio/kana/${displayScript}/${kana.id}.mp3`,
      
      // Metadata
      difficulty: this.calculateDifficulty(kana),
      tags: [kana.type, kana.row, 'kana', displayScript],
      
      // Modes
      supportedModes: this.getSupportedModes(),
      preferredMode: 'recognition',
      
      // Additional metadata
      metadata: {
        row: kana.row,
        column: kana.column,
        type: kana.type,
        alternateScript: displayScript === 'hiragana' ? kana.katakana : kana.hiragana
      }
    };
  }
  
  generateOptions(
    content: ReviewableContent, 
    pool: KanaContent[], 
    count: number = 4
  ): ReviewableContent[] {
    // Filter similar characters for better learning
    const similarChars = pool.filter(k => {
      // Same row (e.g., all 'ka' row)
      if (k.row === content.metadata?.row) return true;
      // Similar appearance
      if (this.calculateVisualSimilarity(k, content)) return true;
      // Common confusion pairs
      if (this.isConfusionPair(k.id, content.id)) return true;
      return false;
    });
    
    // If not enough similar chars, add random ones
    const options = similarChars.slice(0, count - 1);
    while (options.length < count - 1) {
      const randomKana = pool[Math.floor(Math.random() * pool.length)];
      if (!options.includes(randomKana) && randomKana.id !== content.id) {
        options.push(randomKana);
      }
    }
    
    return options.map(k => this.transform(k));
  }
  
  getSupportedModes(): ReviewMode[] {
    return ['recognition', 'recall', 'listening'];
  }
  
  prepareForMode(content: ReviewableContent, mode: ReviewMode): ReviewableContent {
    switch (mode) {
      case 'recognition':
        // Show kana, hide romaji
        return {
          ...content,
          secondaryDisplay: undefined
        };
        
      case 'recall':
        // Show romaji, hide kana
        return {
          ...content,
          primaryDisplay: content.secondaryDisplay!, // Show romaji
          secondaryDisplay: undefined,
          primaryAnswer: content.primaryDisplay // Expect kana as answer
        };
        
      case 'listening':
        // Hide everything except audio
        return {
          ...content,
          primaryDisplay: '?',
          secondaryDisplay: undefined
        };
        
      default:
        return content;
    }
  }
  
  calculateDifficulty(kana: KanaContent): number {
    let difficulty = 0.3; // Base difficulty
    
    // Vowels are easiest
    if (kana.type === 'vowel') difficulty = 0.1;
    
    // Digraphs are harder
    if (kana.type === 'digraph') difficulty = 0.7;
    
    // Special pronunciations are harder
    if (kana.pronunciation) difficulty += 0.2;
    
    // Dakuten/handakuten marks
    if (kana.row === 'g' || kana.row === 'z' || kana.row === 'd' || kana.row === 'b') {
      difficulty += 0.1;
    }
    if (kana.row === 'p') difficulty += 0.15;
    
    return Math.min(1.0, difficulty);
  }
  
  generateHints(content: ReviewableContent): string[] {
    const hints: string[] = [];
    const metadata = content.metadata as any;
    
    // Row hint
    if (metadata?.row) {
      hints.push(`This character is from the '${metadata.row}' row`);
    }
    
    // Type hint
    if (metadata?.type === 'vowel') {
      hints.push('This is one of the five basic vowels');
    } else if (metadata?.type === 'digraph') {
      hints.push('This is a combination sound (digraph)');
    }
    
    // Pronunciation hint
    if (content.tertiaryDisplay) {
      hints.push(`Special pronunciation: ${content.tertiaryDisplay}`);
    }
    
    // First letter hint
    if (content.primaryAnswer) {
      hints.push(`Starts with '${content.primaryAnswer[0]}'`);
    }
    
    return hints;
  }
  
  private getAlternativeRomanizations(romaji: string): string[] {
    const alternatives: Record<string, string[]> = {
      'shi': ['si'],
      'chi': ['ti'],
      'tsu': ['tu'],
      'fu': ['hu'],
      'ji': ['zi', 'di'],
      'zu': ['du'],
      // Add more as needed
    };
    
    return alternatives[romaji] || [];
  }
  
  private calculateVisualSimilarity(a: KanaContent, b: ReviewableContent): boolean {
    // Simple heuristic for visual similarity
    const similar = [
      ['れ', 'わ'], ['ね', 'れ', 'わ'],
      ['は', 'ほ'], ['ま', 'も'],
      ['ち', 'ら'], ['さ', 'き'],
      // Add more confusion pairs
    ];
    
    return similar.some(group => 
      group.includes(a.hiragana) && group.includes(b.primaryDisplay)
    );
  }
  
  private isConfusionPair(id1: string, id2: string): boolean {
    const pairs = [
      ['shi', 'chi'], ['tsu', 'su'],
      ['n', 'so'], ['ru', 'ro'],
      // Add more confusion pairs
    ];
    
    return pairs.some(pair => 
      (pair[0] === id1 && pair[1] === id2) ||
      (pair[1] === id1 && pair[0] === id2)
    );
  }
}
```

### 3. Kanji Adapter

```typescript
// lib/review-engine/adapters/kanji.adapter.ts

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
  transform(kanji: KanjiContent): ReviewableContent {
    return {
      id: kanji.id,
      contentType: 'kanji',
      
      primaryDisplay: kanji.character,
      secondaryDisplay: kanji.meanings.join(', '),
      tertiaryDisplay: `音: ${kanji.onyomi.join(', ')} | 訓: ${kanji.kunyomi.join(', ')}`,
      
      primaryAnswer: kanji.meanings[0], // Primary meaning
      alternativeAnswers: [
        ...kanji.meanings.slice(1),
        ...kanji.onyomi,
        ...kanji.kunyomi
      ],
      
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
  
  // ... implement other required methods
}
```

### 4. Vocabulary Adapter

```typescript
// lib/review-engine/adapters/vocabulary.adapter.ts

export interface VocabularyContent {
  id: string;
  word: string;
  reading: string;
  meanings: string[];
  partOfSpeech: string[];
  level: string;
  examples: string[];
  audioUrl?: string;
}

export class VocabularyAdapter extends BaseContentAdapter<VocabularyContent> {
  transform(vocab: VocabularyContent): ReviewableContent {
    return {
      id: vocab.id,
      contentType: 'vocabulary',
      
      primaryDisplay: vocab.word,
      secondaryDisplay: vocab.meanings.join(', '),
      tertiaryDisplay: vocab.reading,
      
      primaryAnswer: vocab.meanings[0],
      alternativeAnswers: [
        ...vocab.meanings.slice(1),
        vocab.reading
      ],
      
      audioUrl: vocab.audioUrl,
      
      difficulty: this.calculateDifficulty(vocab),
      tags: [...vocab.partOfSpeech, vocab.level, 'vocabulary'],
      
      supportedModes: ['recognition', 'recall', 'listening'],
      preferredMode: 'recognition',
      
      metadata: {
        reading: vocab.reading,
        partOfSpeech: vocab.partOfSpeech,
        examples: vocab.examples,
        pitchAccent: this.getPitchAccent(vocab.word)
      }
    };
  }
  
  private getPitchAccent(word: string): number[] {
    // Implement pitch accent lookup
    return [];
  }
  
  // ... implement other required methods
}
```

### 5. Sentence Adapter

```typescript
// lib/review-engine/adapters/sentence.adapter.ts

export interface SentenceContent {
  id: string;
  japanese: string;
  translation: string;
  reading?: string;
  grammar: string[];
  vocabulary: string[];
  level: string;
  audioUrl?: string;
}

export class SentenceAdapter extends BaseContentAdapter<SentenceContent> {
  transform(sentence: SentenceContent): ReviewableContent {
    return {
      id: sentence.id,
      contentType: 'sentence',
      
      primaryDisplay: sentence.japanese,
      secondaryDisplay: sentence.translation,
      tertiaryDisplay: sentence.reading,
      
      primaryAnswer: sentence.translation,
      alternativeAnswers: [], // Sentences typically need fuzzy matching
      
      audioUrl: sentence.audioUrl,
      
      difficulty: this.calculateDifficulty(sentence),
      tags: [...sentence.grammar, sentence.level, 'sentence'],
      
      supportedModes: ['recognition', 'listening'],
      preferredMode: 'recognition',
      
      metadata: {
        grammar: sentence.grammar,
        vocabulary: sentence.vocabulary,
        wordCount: sentence.japanese.length,
        reading: sentence.reading
      }
    };
  }
  
  // ... implement other required methods
}
```

### 6. Custom Content Adapter

```typescript
// lib/review-engine/adapters/custom.adapter.ts

export interface CustomContent {
  id: string;
  front: string;
  back: string;
  type: string;
  media?: {
    audio?: string;
    image?: string;
    video?: string;
  };
  tags?: string[];
  [key: string]: any;
}

export class CustomContentAdapter extends BaseContentAdapter<CustomContent> {
  transform(custom: CustomContent): ReviewableContent {
    return {
      id: custom.id,
      contentType: 'custom',
      
      primaryDisplay: custom.front,
      secondaryDisplay: custom.back,
      
      primaryAnswer: custom.back,
      alternativeAnswers: [],
      
      audioUrl: custom.media?.audio,
      imageUrl: custom.media?.image,
      videoUrl: custom.media?.video,
      
      difficulty: 0.5, // Default medium difficulty
      tags: custom.tags || ['custom', custom.type],
      
      supportedModes: this.detectSupportedModes(custom),
      preferredMode: 'recognition',
      
      metadata: { ...custom }
    };
  }
  
  private detectSupportedModes(content: CustomContent): ReviewMode[] {
    const modes: ReviewMode[] = ['recognition'];
    
    if (content.media?.audio) {
      modes.push('listening');
    }
    
    // Only add recall if content is simple enough
    if (content.back.length < 50) {
      modes.push('recall');
    }
    
    return modes;
  }
  
  // ... implement other required methods
}
```

## Adapter Registry

```typescript
// lib/review-engine/adapters/registry.ts

import { BaseContentAdapter } from './base.adapter';
import { KanaAdapter } from './kana.adapter';
import { KanjiAdapter } from './kanji.adapter';
import { VocabularyAdapter } from './vocabulary.adapter';
import { SentenceAdapter } from './sentence.adapter';
import { CustomContentAdapter } from './custom.adapter';

export class AdapterRegistry {
  private static adapters = new Map<string, BaseContentAdapter>();
  
  static initialize(config: Record<string, ContentTypeConfig>) {
    this.adapters.set('kana', new KanaAdapter(config.kana));
    this.adapters.set('kanji', new KanjiAdapter(config.kanji));
    this.adapters.set('vocabulary', new VocabularyAdapter(config.vocabulary));
    this.adapters.set('sentence', new SentenceAdapter(config.sentence));
    this.adapters.set('custom', new CustomContentAdapter(config.custom));
  }
  
  static getAdapter(contentType: string): BaseContentAdapter {
    const adapter = this.adapters.get(contentType);
    if (!adapter) {
      throw new Error(`No adapter found for content type: ${contentType}`);
    }
    return adapter;
  }
  
  static registerAdapter(type: string, adapter: BaseContentAdapter) {
    this.adapters.set(type, adapter);
  }
}
```

## Testing Requirements

```typescript
// __tests__/adapters/kana.adapter.test.ts

describe('KanaAdapter', () => {
  let adapter: KanaAdapter;
  
  beforeEach(() => {
    adapter = new KanaAdapter(defaultConfig);
  });
  
  describe('transform', () => {
    it('should transform hiragana correctly');
    it('should transform katakana correctly');
    it('should handle special pronunciations');
  });
  
  describe('generateOptions', () => {
    it('should generate similar options');
    it('should avoid duplicates');
    it('should include confusion pairs');
  });
  
  describe('difficulty calculation', () => {
    it('should rate vowels as easy');
    it('should rate digraphs as hard');
    it('should consider special marks');
  });
});
```

## Acceptance Criteria

- [ ] All adapters implement BaseContentAdapter
- [ ] Each adapter handles its content type's quirks
- [ ] Options generation creates educationally valuable choices
- [ ] Difficulty calculation is consistent and meaningful
- [ ] Hints are helpful but not giving away answers
- [ ] 90% test coverage for each adapter
- [ ] Performance: <10ms transformation time

## Dependencies

- Core Interfaces (Module 1) must be complete
- Access to content data sources
- Audio file paths must be defined
- Image/SVG assets for kanji strokes