/**
 * Adapter for transforming kana content into ReviewableContent
 */

import { BaseContentAdapter } from './base.adapter';
import { ReviewableContent } from '../core/interfaces';
import { ReviewMode } from '../core/types';

export interface KanaContent {
  id: string;
  hiragana: string;
  katakana: string;
  romaji: string;
  type: 'vowel' | 'consonant' | 'digraph' | 'y-consonant' | 'dakuten' | 'handakuten';
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
      audioUrl: `/audio/kana/${displayScript}/${kana.romaji}.mp3`,
      
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