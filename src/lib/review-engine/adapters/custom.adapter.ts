/**
 * Adapter for transforming custom content into ReviewableContent
 */

import { BaseContentAdapter } from './base.adapter';
import { ReviewableContent } from '../core/interfaces';
import { ReviewMode } from '../core/types';

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
  difficulty?: number;
  hints?: string[];
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
      
      difficulty: custom.difficulty || 0.5, // Default medium difficulty
      tags: custom.tags || ['custom', custom.type],
      
      supportedModes: this.detectSupportedModes(custom),
      preferredMode: 'recognition',
      
      metadata: { ...custom }
    };
  }
  
  generateOptions(
    content: ReviewableContent,
    pool: CustomContent[],
    count: number = 4
  ): ReviewableContent[] {
    const metadata = content.metadata as CustomContent;
    
    // Filter similar custom content
    const similarContent = pool.filter(c => {
      // Same type
      if (c.type === metadata.type) return true;
      // Similar tags
      if (c.tags && metadata.tags) {
        const sharedTags = c.tags.filter(t => metadata.tags!.includes(t));
        if (sharedTags.length > 0) return true;
      }
      // Similar difficulty
      const diffDiff = Math.abs((c.difficulty || 0.5) - (metadata.difficulty || 0.5));
      if (diffDiff <= 0.2) return true;
      return false;
    });
    
    const options: CustomContent[] = [];
    const usedIds = new Set([content.id]);
    
    // First, add content with similar structure
    const structurallySimilar = similarContent.filter(c => 
      !usedIds.has(c.id) && this.hasSimilarStructure(c, content)
    );
    
    structurallySimilar.slice(0, Math.min(2, count - 1)).forEach(c => {
      options.push(c);
      usedIds.add(c.id);
    });
    
    // Then add content with similar length
    const lengthSimilar = similarContent.filter(c => 
      !usedIds.has(c.id) && this.hasSimilarLength(c, content)
    );
    
    lengthSimilar.slice(0, Math.min(1, count - 1 - options.length)).forEach(c => {
      options.push(c);
      usedIds.add(c.id);
    });
    
    // Fill remaining with random custom content
    while (options.length < count - 1) {
      const randomContent = pool[Math.floor(Math.random() * pool.length)];
      if (!usedIds.has(randomContent.id)) {
        options.push(randomContent);
        usedIds.add(randomContent.id);
      }
    }
    
    return options.map(c => this.transform(c));
  }
  
  getSupportedModes(): ReviewMode[] {
    // Custom content supports all modes by default
    return ['recognition', 'recall', 'listening'];
  }
  
  prepareForMode(content: ReviewableContent, mode: ReviewMode): ReviewableContent {
    const metadata = content.metadata as CustomContent;
    
    switch (mode) {
      case 'recognition':
        // Show front, ask for back
        return {
          ...content,
          primaryDisplay: metadata.front,
          secondaryDisplay: undefined,
          primaryAnswer: metadata.back
        };
        
      case 'recall':
        // Show back, ask for front
        return {
          ...content,
          primaryDisplay: metadata.back,
          secondaryDisplay: undefined,
          primaryAnswer: metadata.front
        };
        
      case 'listening':
        // Only available if audio is present
        if (content.audioUrl) {
          return {
            ...content,
            primaryDisplay: '?',
            secondaryDisplay: undefined
          };
        }
        // Fall back to recognition if no audio
        return this.prepareForMode(content, 'recognition');
        
      default:
        return content;
    }
  }
  
  calculateDifficulty(custom: CustomContent): number {
    // If difficulty is explicitly set, use it
    if (custom.difficulty !== undefined) {
      return Math.max(0, Math.min(1, custom.difficulty));
    }
    
    // Otherwise, calculate based on content characteristics
    let difficulty = 0.5; // Base difficulty
    
    // Length of content affects difficulty
    const frontLength = custom.front.length;
    const backLength = custom.back.length;
    const totalLength = frontLength + backLength;
    
    if (totalLength > 50) difficulty += 0.1;
    if (totalLength > 100) difficulty += 0.1;
    if (totalLength > 200) difficulty += 0.1;
    
    // Number of hints suggests complexity
    if (custom.hints && custom.hints.length > 0) {
      difficulty += 0.05 * Math.min(3, custom.hints.length);
    }
    
    // Media presence might indicate complexity
    if (custom.media) {
      if (custom.media.video) difficulty += 0.1;
      if (custom.media.image) difficulty += 0.05;
    }
    
    // Tag-based difficulty adjustment
    if (custom.tags) {
      if (custom.tags.includes('advanced')) difficulty += 0.2;
      if (custom.tags.includes('intermediate')) difficulty += 0.1;
      if (custom.tags.includes('beginner')) difficulty -= 0.2;
      if (custom.tags.includes('easy')) difficulty -= 0.1;
      if (custom.tags.includes('hard')) difficulty += 0.1;
    }
    
    return Math.max(0, Math.min(1, difficulty));
  }
  
  generateHints(content: ReviewableContent): string[] {
    const metadata = content.metadata as CustomContent;
    
    // Use provided hints if available
    if (metadata.hints && metadata.hints.length > 0) {
      return metadata.hints;
    }
    
    // Otherwise, generate generic hints
    const hints: string[] = [];
    
    // Length hint
    if (content.primaryAnswer) {
      hints.push(`The answer has ${content.primaryAnswer.length} characters`);
    }
    
    // First character hint
    if (content.primaryAnswer && content.primaryAnswer.length > 0) {
      hints.push(`The answer starts with '${content.primaryAnswer[0]}'`);
    }
    
    // Type hint
    if (metadata.type) {
      hints.push(`This is a ${metadata.type} card`);
    }
    
    // Tag hint
    if (metadata.tags && metadata.tags.length > 0) {
      const relevantTag = metadata.tags.find(t => 
        !['custom', 'easy', 'medium', 'hard'].includes(t)
      );
      if (relevantTag) {
        hints.push(`Related to: ${relevantTag}`);
      }
    }
    
    // Word count hint
    const wordCount = content.primaryAnswer.split(/\s+/).length;
    if (wordCount > 1) {
      hints.push(`The answer contains ${wordCount} words`);
    }
    
    // Pattern hint
    const pattern = this.detectPattern(content.primaryAnswer);
    if (pattern) {
      hints.push(`The answer ${pattern}`);
    }
    
    return hints;
  }
  
  private detectSupportedModes(content: CustomContent): ReviewMode[] {
    const modes: ReviewMode[] = ['recognition'];
    
    if (content.media?.audio) {
      modes.push('listening');
    }
    
    // Only add recall if content is simple enough
    if (content.back.length < 50 && content.front.length < 50) {
      modes.push('recall');
    }
    
    return modes;
  }
  
  private hasSimilarStructure(c1: CustomContent, content: ReviewableContent): boolean {
    const metadata = content.metadata as CustomContent;
    
    // Check if both have similar media types
    const c1HasMedia = !!(c1.media?.audio || c1.media?.image || c1.media?.video);
    const c2HasMedia = !!(metadata.media?.audio || metadata.media?.image || metadata.media?.video);
    
    if (c1HasMedia !== c2HasMedia) return false;
    
    // Check if front/back ratio is similar
    const c1Ratio = c1.front.length / (c1.back.length || 1);
    const c2Ratio = metadata.front.length / (metadata.back.length || 1);
    
    return Math.abs(c1Ratio - c2Ratio) < 0.5;
  }
  
  private hasSimilarLength(c1: CustomContent, content: ReviewableContent): boolean {
    const metadata = content.metadata as CustomContent;
    
    const c1Length = c1.front.length + c1.back.length;
    const c2Length = metadata.front.length + metadata.back.length;
    
    const ratio = c1Length / (c2Length || 1);
    return ratio >= 0.7 && ratio <= 1.3;
  }
  
  private detectPattern(text: string): string | null {
    // Detect common patterns in the answer
    if (/^\d+$/.test(text)) {
      return 'is a number';
    }
    if (/^[A-Z][a-z]+$/.test(text)) {
      return 'is a proper noun';
    }
    if (/^\d{4}$/.test(text)) {
      return 'is a year';
    }
    if (/^\d+\s*[a-zA-Z]+$/.test(text)) {
      return 'contains a number and text';
    }
    if (/^[A-Z]{2,}$/.test(text)) {
      return 'is an acronym';
    }
    if (text.includes(',')) {
      return 'is a list';
    }
    
    return null;
  }
}