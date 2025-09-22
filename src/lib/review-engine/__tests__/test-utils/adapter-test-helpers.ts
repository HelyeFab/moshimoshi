/**
 * Helper functions specifically for adapter testing
 */

import { ContentTypeConfig } from '../../core/types';

/**
 * Creates a valid ContentTypeConfig for testing adapters
 */
export function createTestConfig(overrides?: Partial<ContentTypeConfig>): ContentTypeConfig {
  return {
    contentType: 'test',
    availableModes: [
      { mode: 'recognition' },
      { mode: 'recall' }
    ],
    defaultMode: 'recognition',
    validationStrategy: 'fuzzy',
    validationOptions: {
      threshold: 0.8,
      ignoreCase: true
    },
    features: {},
    ...overrides
  };
}

/**
 * Create config for KanaAdapter testing
 */
export function createKanaTestConfig(features?: { displayScript?: 'hiragana' | 'katakana' }): ContentTypeConfig {
  return createTestConfig({
    contentType: 'kana',
    availableModes: [
      { mode: 'recognition' },
      { mode: 'recall' },
      { mode: 'listening' }
    ],
    features: features || { displayScript: 'hiragana' }
  });
}

/**
 * Create config for KanjiAdapter testing
 */
export function createKanjiTestConfig(features?: { 
  displayReading?: 'on' | 'kun' | 'both';
  showStrokeOrder?: boolean;
}): ContentTypeConfig {
  return createTestConfig({
    contentType: 'kanji',
    availableModes: [
      { mode: 'recognition' },
      { mode: 'recall' }
    ],
    validationStrategy: 'exact',
    features: features || { displayReading: 'kun', showStrokeOrder: false }
  });
}

/**
 * Create config for VocabularyAdapter testing
 */
export function createVocabularyTestConfig(features?: any): ContentTypeConfig {
  return createTestConfig({
    contentType: 'vocabulary',
    availableModes: [
      { mode: 'recognition' },
      { mode: 'recall' },
      { mode: 'listening' }
    ],
    features: features || {}
  });
}

/**
 * Create config for SentenceAdapter testing
 */
export function createSentenceTestConfig(features?: any): ContentTypeConfig {
  return createTestConfig({
    contentType: 'sentence',
    availableModes: [
      { mode: 'recognition' },
      { mode: 'listening' }
    ],
    features: features || {}
  });
}

/**
 * Create config for CustomAdapter testing
 */
export function createCustomTestConfig(features?: any): ContentTypeConfig {
  return createTestConfig({
    contentType: 'custom',
    availableModes: [
      { mode: 'recognition' },
      { mode: 'recall' }
    ],
    features: features || {}
  });
}