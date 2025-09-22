/**
 * Adapter for transforming sentence content into ReviewableContent
 */

import { BaseContentAdapter } from './base.adapter';
import { ReviewableContent } from '../core/interfaces';
import { ReviewMode } from '../core/types';

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
      
      supportedModes: this.getSupportedModes(),
      preferredMode: 'recognition',
      
      metadata: {
        grammar: sentence.grammar,
        vocabulary: sentence.vocabulary,
        wordCount: sentence.japanese.length,
        reading: sentence.reading,
        level: sentence.level
      }
    };
  }
  
  generateOptions(
    content: ReviewableContent,
    pool: SentenceContent[],
    count: number = 4
  ): ReviewableContent[] {
    const metadata = content.metadata as any;
    
    // Filter similar sentences for better learning
    const similarSentences = pool.filter(s => {
      // Similar length (within 20% of character count)
      const lengthRatio = s.japanese.length / content.primaryDisplay.length;
      if (lengthRatio >= 0.8 && lengthRatio <= 1.2) return true;
      // Same level
      if (s.level === metadata.level) return true;
      // Share grammar points
      if (s.grammar.some(g => metadata.grammar?.includes(g))) return true;
      // Share vocabulary
      if (s.vocabulary.some(v => metadata.vocabulary?.includes(v))) return true;
      return false;
    });
    
    const options: SentenceContent[] = [];
    const usedIds = new Set([content.id]);
    
    // First, add sentences with similar grammar patterns
    const grammarSimilar = similarSentences.filter(s => 
      !usedIds.has(s.id) && this.shareGrammarPattern(s, content)
    );
    
    grammarSimilar.slice(0, Math.min(2, count - 1)).forEach(s => {
      options.push(s);
      usedIds.add(s.id);
    });
    
    // Then add sentences with similar topics
    const topicSimilar = similarSentences.filter(s => 
      !usedIds.has(s.id) && this.haveSimilarTopic(s, content)
    );
    
    topicSimilar.slice(0, Math.min(1, count - 1 - options.length)).forEach(s => {
      options.push(s);
      usedIds.add(s.id);
    });
    
    // Fill remaining with random sentences
    while (options.length < count - 1) {
      const randomSentence = pool[Math.floor(Math.random() * pool.length)];
      if (!usedIds.has(randomSentence.id)) {
        options.push(randomSentence);
        usedIds.add(randomSentence.id);
      }
    }
    
    return options.map(s => this.transform(s));
  }
  
  getSupportedModes(): ReviewMode[] {
    return ['recognition', 'listening'];
  }
  
  prepareForMode(content: ReviewableContent, mode: ReviewMode): ReviewableContent {
    switch (mode) {
      case 'recognition':
        // Show Japanese, ask for translation
        return {
          ...content,
          tertiaryDisplay: undefined // Hide reading initially
        };
        
      case 'listening':
        // Play audio, ask for translation
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
  
  calculateDifficulty(sentence: SentenceContent): number {
    let difficulty = 0.5; // Base difficulty
    
    // Level-based difficulty
    const levelDifficulty: Record<string, number> = {
      'N5': 0.2,
      'N4': 0.4,
      'N3': 0.6,
      'N2': 0.8,
      'N1': 0.95,
      'beginner': 0.3,
      'intermediate': 0.6,
      'advanced': 0.9
    };
    
    difficulty = levelDifficulty[sentence.level] || 0.5;
    
    // Sentence length affects difficulty
    const charCount = sentence.japanese.length;
    if (charCount > 20) difficulty += 0.1;
    if (charCount > 40) difficulty += 0.1;
    if (charCount > 60) difficulty += 0.1;
    
    // Number of grammar points
    if (sentence.grammar.length > 2) difficulty += 0.1;
    if (sentence.grammar.length > 4) difficulty += 0.1;
    
    // Complex vocabulary
    const complexVocab = sentence.vocabulary.filter(v => v.length > 3);
    if (complexVocab.length > 3) difficulty += 0.1;
    
    return Math.min(1.0, difficulty);
  }
  
  generateHints(content: ReviewableContent): string[] {
    const hints: string[] = [];
    const metadata = content.metadata as any;
    
    // Word count hint
    if (metadata?.wordCount) {
      hints.push(`This sentence has ${metadata.wordCount} characters`);
    }
    
    // Grammar pattern hint
    if (metadata?.grammar && metadata.grammar.length > 0) {
      hints.push(`Uses the grammar pattern: ${metadata.grammar[0]}`);
    }
    
    // Key vocabulary hint
    if (metadata?.vocabulary && metadata.vocabulary.length > 0) {
      const keyWord = metadata.vocabulary[0];
      hints.push(`Contains the word: ${keyWord}`);
    }
    
    // Sentence type hint
    const sentenceType = this.detectSentenceType(content.primaryDisplay);
    if (sentenceType) {
      hints.push(`This is a ${sentenceType} sentence`);
    }
    
    // Partial translation hint
    const partialTranslation = this.getPartialTranslation(content.primaryAnswer);
    if (partialTranslation) {
      hints.push(`Translation starts with: "${partialTranslation}..."`);
    }
    
    // Context hint
    const context = this.inferContext(content);
    if (context) {
      hints.push(`Context: ${context}`);
    }
    
    return hints;
  }
  
  private shareGrammarPattern(sentence: SentenceContent, content: ReviewableContent): boolean {
    const metadata = content.metadata as any;
    if (!metadata?.grammar || !sentence.grammar) return false;
    
    // Check if they share at least one grammar point
    const sharedGrammar = sentence.grammar.filter(g => 
      metadata.grammar.includes(g)
    );
    
    return sharedGrammar.length > 0;
  }
  
  private haveSimilarTopic(sentence: SentenceContent, content: ReviewableContent): boolean {
    // Analyze topics based on vocabulary and content
    const topics = this.extractTopics(sentence.translation);
    const contentTopics = this.extractTopics(content.secondaryDisplay || '');
    
    return topics.some(t => contentTopics.includes(t));
  }
  
  private extractTopics(text: string): string[] {
    const topics: string[] = [];
    const topicKeywords = {
      'food': ['eat', 'drink', 'meal', 'restaurant', 'delicious'],
      'travel': ['go', 'trip', 'visit', 'tourist', 'vacation'],
      'work': ['office', 'job', 'meeting', 'company', 'business'],
      'school': ['student', 'teacher', 'class', 'study', 'homework'],
      'family': ['mother', 'father', 'sister', 'brother', 'family'],
      'time': ['today', 'tomorrow', 'yesterday', 'week', 'month'],
      'weather': ['rain', 'sunny', 'cold', 'hot', 'weather']
    };
    
    const lowerText = text.toLowerCase();
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(k => lowerText.includes(k))) {
        topics.push(topic);
      }
    });
    
    return topics;
  }
  
  private detectSentenceType(japanese: string): string | null {
    // Detect sentence type based on ending particles and patterns
    if (japanese.endsWith('か？') || japanese.endsWith('か。')) {
      return 'question';
    }
    if (japanese.endsWith('ください。') || japanese.endsWith('てください。')) {
      return 'request';
    }
    if (japanese.endsWith('ましょう。') || japanese.endsWith('よう。')) {
      return 'suggestion';
    }
    if (japanese.includes('から') || japanese.includes('ので')) {
      return 'reason/cause';
    }
    if (japanese.includes('たら') || japanese.includes('ば')) {
      return 'conditional';
    }
    if (japanese.endsWith('！')) {
      return 'exclamation';
    }
    
    return 'statement';
  }
  
  private getPartialTranslation(translation: string): string {
    // Return first few words of the translation
    const words = translation.split(' ');
    if (words.length <= 3) return words[0];
    return words.slice(0, 2).join(' ');
  }
  
  private inferContext(content: ReviewableContent): string | null {
    const metadata = content.metadata as any;
    
    // Infer context from vocabulary and grammar
    if (metadata?.vocabulary) {
      const vocabTopics = this.extractTopics(metadata.vocabulary.join(' '));
      if (vocabTopics.length > 0) {
        return vocabTopics[0];
      }
    }
    
    // Check for formal/informal context
    const japanese = content.primaryDisplay;
    if (japanese.includes('です') || japanese.includes('ます')) {
      return 'formal/polite';
    }
    if (japanese.includes('だ') || japanese.includes('る')) {
      return 'casual/informal';
    }
    
    return null;
  }
}