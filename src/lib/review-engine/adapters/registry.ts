/**
 * Registry for managing content adapters
 */

import { BaseContentAdapter } from './base.adapter';
import { KanaAdapter } from './kana.adapter';
import { KanjiAdapter } from './kanji.adapter';
import { VocabularyAdapter } from './vocabulary.adapter';
import { SentenceAdapter } from './sentence.adapter';
import { CustomContentAdapter } from './custom.adapter';
import { MoodBoardAdapter } from './MoodBoardAdapter';
import { ContentTypeConfig } from '../core/types';
import { reviewLogger } from '@/lib/monitoring/logger';

/**
 * Central registry for all content adapters
 */
export class AdapterRegistry {
  private static adapters = new Map<string, BaseContentAdapter>();
  private static initialized = false;
  
  /**
   * Initialize the registry with default adapters
   */
  static initialize(config: Record<string, ContentTypeConfig>) {
    if (this.initialized) {
      reviewLogger.warn('AdapterRegistry already initialized');
      return;
    }
    
    // Register default adapters
    this.adapters.set('kana', new KanaAdapter(config.kana));
    this.adapters.set('kanji', new KanjiAdapter(config.kanji));
    this.adapters.set('vocabulary', new VocabularyAdapter(config.vocabulary));
    this.adapters.set('sentence', new SentenceAdapter(config.sentence));
    this.adapters.set('custom', new CustomContentAdapter(config.custom || this.getDefaultCustomConfig()));
    this.adapters.set('moodboard', new MoodBoardAdapter());
    
    this.initialized = true;
  }
  
  /**
   * Get an adapter for a specific content type
   */
  static getAdapter(contentType: string): BaseContentAdapter {
    if (!this.initialized) {
      throw new Error('AdapterRegistry not initialized. Call initialize() first.');
    }
    
    const adapter = this.adapters.get(contentType);
    if (!adapter) {
      // Fall back to custom adapter for unknown types
      reviewLogger.warn(`No specific adapter for content type: ${contentType}, using custom adapter`);
      return this.adapters.get('custom')!;
    }
    return adapter;
  }
  
  /**
   * Register a custom adapter
   */
  static registerAdapter(type: string, adapter: BaseContentAdapter) {
    if (!this.initialized) {
      throw new Error('AdapterRegistry not initialized. Call initialize() first.');
    }
    
    if (this.adapters.has(type)) {
      reviewLogger.warn(`Overwriting existing adapter for type: ${type}`);
    }
    
    this.adapters.set(type, adapter);
  }
  
  /**
   * Unregister an adapter
   */
  static unregisterAdapter(type: string): boolean {
    if (!this.initialized) {
      throw new Error('AdapterRegistry not initialized. Call initialize() first.');
    }
    
    // Prevent removing core adapters
    const coreAdapters = ['kana', 'kanji', 'vocabulary', 'sentence', 'custom'];
    if (coreAdapters.includes(type)) {
      reviewLogger.error(`Cannot unregister core adapter: ${type}`);
      return false;
    }
    
    return this.adapters.delete(type);
  }
  
  /**
   * Get all registered adapter types
   */
  static getRegisteredTypes(): string[] {
    if (!this.initialized) {
      return [];
    }
    
    return Array.from(this.adapters.keys());
  }
  
  /**
   * Check if an adapter is registered
   */
  static hasAdapter(type: string): boolean {
    return this.adapters.has(type);
  }
  
  /**
   * Reset the registry (mainly for testing)
   */
  static reset() {
    this.adapters.clear();
    this.initialized = false;
  }
  
  /**
   * Get default configuration for custom content
   */
  private static getDefaultCustomConfig(): ContentTypeConfig {
    return {
      contentType: 'custom',
      availableModes: [
        {
          mode: 'recognition',
          showPrimary: true,
          showSecondary: false,
          showTertiary: false,
          showMedia: true,
          inputType: 'multiple-choice',
          optionCount: 4,
          allowHints: true,
          hintPenalty: 0.1
        },
        {
          mode: 'recall',
          showPrimary: false,
          showSecondary: true,
          showTertiary: false,
          showMedia: false,
          inputType: 'text',
          allowHints: true,
          hintPenalty: 0.2
        },
        {
          mode: 'listening',
          showPrimary: false,
          showSecondary: false,
          showTertiary: false,
          showMedia: false,
          inputType: 'multiple-choice',
          optionCount: 4,
          allowHints: false,
          autoPlayAudio: true,
          repeatLimit: 3
        }
      ],
      defaultMode: 'recognition',
      validationStrategy: 'fuzzy',
      validationOptions: {
        threshold: 0.8,
        ignoreCase: true,
        ignoreWhitespace: true
      }
    };
  }
}

/**
 * Factory function to create default configurations for all content types
 */
export function createDefaultAdapterConfigs(): Record<string, ContentTypeConfig> {
  return {
    kana: {
      contentType: 'kana',
      availableModes: [
        {
          mode: 'recognition',
          showPrimary: true,
          showSecondary: false,
          showTertiary: false,
          showMedia: false,
          inputType: 'multiple-choice',
          optionCount: 4,
          optionSource: 'similar',
          allowHints: true,
          hintPenalty: 0.1
        },
        {
          mode: 'recall',
          showPrimary: true,
          showSecondary: false,
          showTertiary: false,
          showMedia: false,
          inputType: 'text',
          allowHints: true,
          hintPenalty: 0.2
        },
        {
          mode: 'listening',
          showPrimary: false,
          showSecondary: false,
          showTertiary: false,
          showMedia: false,
          inputType: 'multiple-choice',
          optionCount: 4,
          autoPlayAudio: true,
          repeatLimit: 3,
          allowHints: false
        }
      ],
      defaultMode: 'recognition',
      validationStrategy: 'exact',
      validationOptions: {
        ignoreCase: false
      },
      fontSize: 'large',
      features: {
        displayScript: 'hiragana'
      }
    },
    
    kanji: {
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
          hintPenalty: 0.15
        },
        {
          mode: 'recall',
          showPrimary: false,
          showSecondary: true,
          showTertiary: true,
          showMedia: false,
          inputType: 'text',
          allowHints: true,
          hintPenalty: 0.25
        }
      ],
      defaultMode: 'recognition',
      validationStrategy: 'fuzzy',
      validationOptions: {
        threshold: 0.8,
        ignoreCase: true
      },
      fontSize: 'extra-large',
      features: {
        strokeOrder: true,
        variants: true
      }
    },
    
    vocabulary: {
      contentType: 'vocabulary',
      availableModes: [
        {
          mode: 'recognition',
          showPrimary: true,
          showSecondary: false,
          showTertiary: false,
          showMedia: false,
          inputType: 'multiple-choice',
          optionCount: 4,
          optionSource: 'similar',
          allowHints: true,
          hintPenalty: 0.1
        },
        {
          mode: 'recall',
          showPrimary: false,
          showSecondary: true,
          showTertiary: false,
          showMedia: false,
          inputType: 'text',
          allowHints: true,
          hintPenalty: 0.2
        },
        {
          mode: 'listening',
          showPrimary: false,
          showSecondary: false,
          showTertiary: false,
          showMedia: false,
          inputType: 'multiple-choice',
          optionCount: 4,
          autoPlayAudio: true,
          repeatLimit: 3,
          allowHints: false
        }
      ],
      defaultMode: 'recognition',
      validationStrategy: 'fuzzy',
      validationOptions: {
        threshold: 0.85,
        ignoreCase: true,
        ignoreWhitespace: true
      },
      fontSize: 'medium',
      features: {
        furigana: true,
        pitch: true
      }
    },
    
    sentence: {
      contentType: 'sentence',
      availableModes: [
        {
          mode: 'recognition',
          showPrimary: true,
          showSecondary: false,
          showTertiary: false,
          showMedia: false,
          inputType: 'multiple-choice',
          optionCount: 4,
          optionSource: 'similar',
          allowHints: true,
          hintPenalty: 0.15
        },
        {
          mode: 'listening',
          showPrimary: false,
          showSecondary: false,
          showTertiary: false,
          showMedia: false,
          inputType: 'multiple-choice',
          optionCount: 4,
          autoPlayAudio: true,
          repeatLimit: 3,
          allowHints: true,
          hintPenalty: 0.1
        }
      ],
      defaultMode: 'recognition',
      validationStrategy: 'fuzzy',
      validationOptions: {
        threshold: 0.7,
        ignoreCase: true,
        ignoreWhitespace: true,
        ignorePunctuation: true
      },
      fontSize: 'medium',
      features: {
        furigana: true
      }
    },
    
    custom: {
      contentType: 'custom',
      availableModes: [
        {
          mode: 'recognition',
          showPrimary: true,
          showSecondary: false,
          showTertiary: false,
          showMedia: true,
          inputType: 'multiple-choice',
          optionCount: 4,
          allowHints: true,
          hintPenalty: 0.1
        },
        {
          mode: 'recall',
          showPrimary: false,
          showSecondary: true,
          showTertiary: false,
          showMedia: false,
          inputType: 'text',
          allowHints: true,
          hintPenalty: 0.2
        }
      ],
      defaultMode: 'recognition',
      validationStrategy: 'fuzzy',
      validationOptions: {
        threshold: 0.8,
        ignoreCase: true,
        ignoreWhitespace: true
      },
      fontSize: 'medium'
    }
  };
}

// Export a convenience function to initialize with defaults
export function initializeAdapterRegistry(customConfig?: Partial<Record<string, ContentTypeConfig>>) {
  const defaultConfigs = createDefaultAdapterConfigs();
  const finalConfig = { ...defaultConfigs, ...customConfig };
  AdapterRegistry.initialize(finalConfig as Record<string, ContentTypeConfig>);
}