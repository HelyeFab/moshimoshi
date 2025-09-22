/**
 * Adapter for transforming vocabulary content into ReviewableContent
 */

import { BaseContentAdapter } from './base.adapter';
import { ReviewableContent } from '../core/interfaces';
import { ReviewMode } from '../core/types';

export interface VocabularyContent {
  id: string;
  word: string;
  reading: string;
  meanings: string[];
  partOfSpeech: string[];
  level: string;
  examples: string[];
  audioUrl?: string;
  pitchAccent?: number[];
  tags?: string[];
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
      
      supportedModes: this.getSupportedModes(),
      preferredMode: 'recognition',
      
      metadata: {
        reading: vocab.reading,
        partOfSpeech: vocab.partOfSpeech,
        examples: vocab.examples,
        pitchAccent: vocab.pitchAccent || this.getPitchAccent(vocab.word),
        level: vocab.level
      }
    };
  }
  
  generateOptions(
    content: ReviewableContent,
    pool: VocabularyContent[],
    count: number = 4
  ): ReviewableContent[] {
    const metadata = content.metadata as any;
    
    // Filter similar vocabulary for better learning
    const similarWords = pool.filter(v => {
      // Same part of speech
      if (v.partOfSpeech.some(pos => metadata.partOfSpeech?.includes(pos))) return true;
      // Same level
      if (v.level === metadata.level) return true;
      // Similar meaning categories
      if (this.hasSimilarMeaningCategory(v, content)) return true;
      // Similar word length
      if (Math.abs(v.word.length - content.primaryDisplay.length) <= 1) return true;
      return false;
    });
    
    const options: VocabularyContent[] = [];
    const usedIds = new Set([content.id]);
    
    // First, add words with similar meanings (synonyms/antonyms)
    const semanticallySimilar = similarWords.filter(v => 
      !usedIds.has(v.id) && this.areSemanticallySimilar(v, content)
    );
    
    semanticallySimilar.slice(0, Math.min(2, count - 1)).forEach(v => {
      options.push(v);
      usedIds.add(v.id);
    });
    
    // Then add words with similar structure
    const structurallySimilar = similarWords.filter(v => 
      !usedIds.has(v.id) && this.hasSimilarStructure(v, content)
    );
    
    structurallySimilar.slice(0, Math.min(1, count - 1 - options.length)).forEach(v => {
      options.push(v);
      usedIds.add(v.id);
    });
    
    // Fill remaining with random vocabulary
    while (options.length < count - 1) {
      const randomVocab = pool[Math.floor(Math.random() * pool.length)];
      if (!usedIds.has(randomVocab.id)) {
        options.push(randomVocab);
        usedIds.add(randomVocab.id);
      }
    }
    
    return options.map(v => this.transform(v));
  }
  
  getSupportedModes(): ReviewMode[] {
    return ['recognition', 'recall', 'listening'];
  }
  
  prepareForMode(content: ReviewableContent, mode: ReviewMode): ReviewableContent {
    switch (mode) {
      case 'recognition':
        // Show word, ask for meaning
        return {
          ...content,
          tertiaryDisplay: undefined // Hide reading initially
        };
        
      case 'recall':
        // Show meaning, ask for word
        return {
          ...content,
          primaryDisplay: content.secondaryDisplay!, // Show meaning
          secondaryDisplay: undefined,
          tertiaryDisplay: undefined,
          primaryAnswer: content.primaryDisplay // Expect word as answer
        };
        
      case 'listening':
        // Play audio, ask for meaning or word
        return {
          ...content,
          primaryDisplay: '?',
          secondaryDisplay: undefined,
          tertiaryDisplay: undefined
        };
        
      default:
        return content;
    }
  }
  
  calculateDifficulty(vocab: VocabularyContent): number {
    let difficulty = 0.5; // Base difficulty
    
    // Level-based difficulty
    const levelDifficulty: Record<string, number> = {
      'N5': 0.1,
      'N4': 0.3,
      'N3': 0.5,
      'N2': 0.7,
      'N1': 0.9,
      'beginner': 0.2,
      'intermediate': 0.5,
      'advanced': 0.8
    };
    
    difficulty = levelDifficulty[vocab.level] || 0.5;
    
    // Word length affects difficulty
    if (vocab.word.length > 4) difficulty += 0.1;
    if (vocab.word.length > 6) difficulty += 0.1;
    
    // Multiple meanings increase difficulty
    if (vocab.meanings.length > 3) difficulty += 0.1;
    
    // Irregular readings are harder
    if (this.hasIrregularReading(vocab)) difficulty += 0.15;
    
    // Abstract concepts are harder
    if (vocab.partOfSpeech.includes('abstract-noun')) difficulty += 0.1;
    
    return Math.min(1.0, difficulty);
  }
  
  generateHints(content: ReviewableContent): string[] {
    const hints: string[] = [];
    const metadata = content.metadata as any;
    
    // Part of speech hint
    if (metadata?.partOfSpeech && metadata.partOfSpeech.length > 0) {
      hints.push(`This is a ${this.formatPartOfSpeech(metadata.partOfSpeech[0])}`);
    }
    
    // Reading hint (partial)
    if (metadata?.reading) {
      const reading = metadata.reading;
      hints.push(`Reading starts with '${reading[0]}'`);
    }
    
    // Character count hint
    hints.push(`The word has ${content.primaryDisplay.length} characters`);
    
    // Example sentence hint (partial)
    if (metadata?.examples && metadata.examples.length > 0) {
      const example = metadata.examples[0];
      const maskedExample = this.maskWordInExample(example, content.primaryDisplay);
      hints.push(`Example: ${maskedExample}`);
    }
    
    // Pitch accent hint
    if (metadata?.pitchAccent && metadata.pitchAccent.length > 0) {
      hints.push(`Pitch accent pattern: ${this.describePitchAccent(metadata.pitchAccent)}`);
    }
    
    // Synonym/antonym hint
    const relationHint = this.getRelationHint(content);
    if (relationHint) {
      hints.push(relationHint);
    }
    
    return hints;
  }
  
  private getPitchAccent(word: string): number[] {
    // Simplified pitch accent lookup
    // In production, this would query a pitch accent dictionary
    const patterns: Record<number, number[]> = {
      2: [0, 1], // 平板型 (heiban)
      3: [0, 1, 0], // 頭高型 (atamadaka)
      4: [0, 1, 2, 0] // 中高型 (nakadaka)
    };
    
    return patterns[word.length] || [];
  }
  
  private hasSimilarMeaningCategory(vocab: VocabularyContent, content: ReviewableContent): boolean {
    const categories = this.getMeaningCategories(vocab.meanings);
    const contentCategories = this.getMeaningCategories(
      content.secondaryDisplay?.split(', ') || []
    );
    
    return categories.some(c => contentCategories.includes(c));
  }
  
  private getMeaningCategories(meanings: string[]): string[] {
    const categories: string[] = [];
    
    const categoryKeywords = {
      'motion': ['go', 'come', 'walk', 'run', 'move'],
      'emotion': ['happy', 'sad', 'angry', 'love', 'hate'],
      'food': ['eat', 'drink', 'food', 'meal', 'taste'],
      'time': ['time', 'day', 'week', 'month', 'year'],
      'place': ['place', 'location', 'here', 'there', 'where']
    };
    
    meanings.forEach(meaning => {
      const lower = meaning.toLowerCase();
      Object.entries(categoryKeywords).forEach(([category, keywords]) => {
        if (keywords.some(k => lower.includes(k))) {
          categories.push(category);
        }
      });
    });
    
    return Array.from(new Set(categories));
  }
  
  private areSemanticallySimilar(vocab: VocabularyContent, content: ReviewableContent): boolean {
    const contentMeanings = content.secondaryDisplay?.toLowerCase().split(', ') || [];
    const vocabMeanings = vocab.meanings.map(m => m.toLowerCase());
    
    // Check for overlapping meanings or high similarity
    return vocabMeanings.some(vm => 
      contentMeanings.some(cm => 
        this.calculateStringSimilarity(vm, cm) > 0.6
      )
    );
  }
  
  private hasSimilarStructure(vocab: VocabularyContent, content: ReviewableContent): boolean {
    // Check if words share kanji or have similar structure
    const contentWord = content.primaryDisplay;
    const vocabWord = vocab.word;
    
    // Same length
    if (contentWord.length !== vocabWord.length) return false;
    
    // Share at least one kanji
    const contentKanji: string[] = contentWord.match(/[\u4e00-\u9faf]/g) || [];
    const vocabKanji: string[] = vocabWord.match(/[\u4e00-\u9faf]/g) || [];
    
    return contentKanji.some(k => vocabKanji.includes(k));
  }
  
  private hasIrregularReading(vocab: VocabularyContent): boolean {
    // Simple heuristic for irregular readings
    // In production, this would use a database of irregular readings
    const irregularPatterns = ['当て字', '熟字訓', '特殊'];
    return vocab.tags?.some(tag => irregularPatterns.includes(tag)) || false;
  }
  
  private formatPartOfSpeech(pos: string): string {
    const formatted: Record<string, string> = {
      'noun': 'noun',
      'verb': 'verb',
      'i-adjective': 'i-adjective',
      'na-adjective': 'na-adjective',
      'adverb': 'adverb',
      'particle': 'particle',
      'conjunction': 'conjunction',
      'interjection': 'interjection'
    };
    
    return formatted[pos] || pos;
  }
  
  private maskWordInExample(example: string, word: string): string {
    // Replace the word with underscores in the example
    const masked = example.replace(word, '_'.repeat(word.length));
    return masked;
  }
  
  private describePitchAccent(pattern: number[]): string {
    if (pattern.length === 0) return 'flat';
    
    const maxAccent = Math.max(...pattern);
    if (maxAccent === 0) return 'flat (平板型)';
    if (pattern[0] === maxAccent) return 'falling (頭高型)';
    if (pattern[pattern.length - 1] === maxAccent) return 'rising (尾高型)';
    return 'middle-high (中高型)';
  }
  
  private getRelationHint(content: ReviewableContent): string | null {
    // Provide hints about synonyms or antonyms
    // In production, this would use a thesaurus database
    const commonRelations: Record<string, { synonyms: string[], antonyms: string[] }> = {
      'big': { synonyms: ['large', 'huge'], antonyms: ['small', 'tiny'] },
      'good': { synonyms: ['nice', 'great'], antonyms: ['bad', 'poor'] },
      'fast': { synonyms: ['quick', 'rapid'], antonyms: ['slow', 'sluggish'] }
    };
    
    const meaning = content.primaryAnswer.toLowerCase();
    if (commonRelations[meaning]) {
      const relations = commonRelations[meaning];
      if (relations.synonyms.length > 0) {
        return `Similar to: ${relations.synonyms[0]}`;
      }
      if (relations.antonyms.length > 0) {
        return `Opposite of: ${relations.antonyms[0]}`;
      }
    }
    
    return null;
  }
  
  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}