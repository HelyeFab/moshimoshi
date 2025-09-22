/**
 * AdapterRegistry Test Suite
 * Tests adapter registration, retrieval, and management functionality
 */

import { AdapterRegistry, createDefaultAdapterConfigs, initializeAdapterRegistry } from '../registry';
import { BaseContentAdapter } from '../base.adapter';
import { KanaAdapter } from '../kana.adapter';
import { KanjiAdapter } from '../kanji.adapter';
import { VocabularyAdapter } from '../vocabulary.adapter';
import { SentenceAdapter } from '../sentence.adapter';
import { CustomContentAdapter } from '../custom.adapter';
import { ContentTypeConfig, ReviewMode } from '../../core/types';
import { ReviewableContent } from '../../core/interfaces';
import { MockFactory } from '../../__tests__/test-utils/mock-factory';
import { 
  TestHelpers, 
  AdapterTestHelpers,
  setupTest,
  teardownTest 
} from '../../__tests__/test-utils/test-helpers';

// Mock adapter for testing
class MockAdapter extends BaseContentAdapter {
  constructor() {
    super({
      contentType: 'test',
      availableModes: [],
      defaultMode: 'recognition',
      validationStrategy: 'exact'
    });
  }

  transform(content: any): ReviewableContent {
    return MockFactory.createReviewableContent();
  }

  generateOptions(content: ReviewableContent, pool: any[], count: number): ReviewableContent[] {
    return [];
  }

  getSupportedModes(): ReviewMode[] {
    return ['recognition'];
  }

  prepareForMode(content: ReviewableContent, mode: ReviewMode): ReviewableContent {
    return content;
  }

  calculateDifficulty(content: any): number {
    return 0.5;
  }

  generateHints(content: ReviewableContent): string[] {
    return ['Test hint'];
  }
}

describe('AdapterRegistry', () => {
  let defaultConfigs: Record<string, ContentTypeConfig>;

  beforeEach(() => {
    setupTest();
    AdapterRegistry.reset();
    defaultConfigs = createDefaultAdapterConfigs();
  });

  afterEach(() => {
    teardownTest();
    AdapterRegistry.reset();
  });

  describe('initialize()', () => {
    it('should initialize with default adapters', () => {
      AdapterRegistry.initialize(defaultConfigs);

      expect(AdapterRegistry.hasAdapter('kana')).toBe(true);
      expect(AdapterRegistry.hasAdapter('kanji')).toBe(true);
      expect(AdapterRegistry.hasAdapter('vocabulary')).toBe(true);
      expect(AdapterRegistry.hasAdapter('sentence')).toBe(true);
      expect(AdapterRegistry.hasAdapter('custom')).toBe(true);
    });

    it('should register correct adapter types', () => {
      AdapterRegistry.initialize(defaultConfigs);

      expect(AdapterRegistry.getAdapter('kana')).toBeInstanceOf(KanaAdapter);
      expect(AdapterRegistry.getAdapter('kanji')).toBeInstanceOf(KanjiAdapter);
      expect(AdapterRegistry.getAdapter('vocabulary')).toBeInstanceOf(VocabularyAdapter);
      expect(AdapterRegistry.getAdapter('sentence')).toBeInstanceOf(SentenceAdapter);
      expect(AdapterRegistry.getAdapter('custom')).toBeInstanceOf(CustomContentAdapter);
    });

    it('should not reinitialize if already initialized', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      AdapterRegistry.initialize(defaultConfigs);
      AdapterRegistry.initialize(defaultConfigs); // Second call

      expect(consoleSpy).toHaveBeenCalledWith('AdapterRegistry already initialized');
      consoleSpy.mockRestore();
    });

    it('should pass configuration to adapters', () => {
      const customConfig = {
        ...defaultConfigs,
        kana: {
          ...defaultConfigs.kana,
          features: { displayScript: 'katakana' as const }
        }
      };

      AdapterRegistry.initialize(customConfig);
      const kanaAdapter = AdapterRegistry.getAdapter('kana');

      expect(kanaAdapter).toBeInstanceOf(KanaAdapter);
    });

    it('should create default custom config when not provided', () => {
      const configWithoutCustom = { ...defaultConfigs };
      delete configWithoutCustom.custom;

      AdapterRegistry.initialize(configWithoutCustom);

      expect(AdapterRegistry.hasAdapter('custom')).toBe(true);
    });
  });

  describe('getAdapter()', () => {
    beforeEach(() => {
      AdapterRegistry.initialize(defaultConfigs);
    });

    it('should return correct adapter for registered types', () => {
      expect(AdapterRegistry.getAdapter('kana')).toBeInstanceOf(KanaAdapter);
      expect(AdapterRegistry.getAdapter('kanji')).toBeInstanceOf(KanjiAdapter);
      expect(AdapterRegistry.getAdapter('vocabulary')).toBeInstanceOf(VocabularyAdapter);
      expect(AdapterRegistry.getAdapter('sentence')).toBeInstanceOf(SentenceAdapter);
      expect(AdapterRegistry.getAdapter('custom')).toBeInstanceOf(CustomContentAdapter);
    });

    it('should return same adapter instance for repeated calls', () => {
      const adapter1 = AdapterRegistry.getAdapter('kana');
      const adapter2 = AdapterRegistry.getAdapter('kana');

      expect(adapter1).toBe(adapter2);
    });

    it('should fall back to custom adapter for unknown types', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const unknownAdapter = AdapterRegistry.getAdapter('unknown-type');

      expect(unknownAdapter).toBeInstanceOf(CustomContentAdapter);
      expect(consoleSpy).toHaveBeenCalledWith(
        'No specific adapter for content type: unknown-type, using custom adapter'
      );
      
      consoleSpy.mockRestore();
    });

    it('should throw error when not initialized', () => {
      AdapterRegistry.reset();

      expect(() => AdapterRegistry.getAdapter('kana')).toThrow(
        'AdapterRegistry not initialized. Call initialize() first.'
      );
    });
  });

  describe('registerAdapter()', () => {
    beforeEach(() => {
      AdapterRegistry.initialize(defaultConfigs);
    });

    it('should register new custom adapter', () => {
      const mockAdapter = new MockAdapter();

      AdapterRegistry.registerAdapter('test', mockAdapter);

      expect(AdapterRegistry.hasAdapter('test')).toBe(true);
      expect(AdapterRegistry.getAdapter('test')).toBe(mockAdapter);
    });

    it('should overwrite existing adapter with warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockAdapter = new MockAdapter();

      AdapterRegistry.registerAdapter('kana', mockAdapter);

      expect(consoleSpy).toHaveBeenCalledWith('Overwriting existing adapter for type: kana');
      expect(AdapterRegistry.getAdapter('kana')).toBe(mockAdapter);
      
      consoleSpy.mockRestore();
    });

    it('should throw error when not initialized', () => {
      AdapterRegistry.reset();
      const mockAdapter = new MockAdapter();

      expect(() => AdapterRegistry.registerAdapter('test', mockAdapter)).toThrow(
        'AdapterRegistry not initialized. Call initialize() first.'
      );
    });

    it('should update registered types list', () => {
      const mockAdapter = new MockAdapter();
      const initialTypes = AdapterRegistry.getRegisteredTypes();

      AdapterRegistry.registerAdapter('test', mockAdapter);

      const newTypes = AdapterRegistry.getRegisteredTypes();
      expect(newTypes).toContain('test');
      expect(newTypes.length).toBe(initialTypes.length + 1);
    });
  });

  describe('unregisterAdapter()', () => {
    beforeEach(() => {
      AdapterRegistry.initialize(defaultConfigs);
    });

    it('should unregister custom adapter', () => {
      const mockAdapter = new MockAdapter();
      AdapterRegistry.registerAdapter('test', mockAdapter);

      const result = AdapterRegistry.unregisterAdapter('test');

      expect(result).toBe(true);
      expect(AdapterRegistry.hasAdapter('test')).toBe(false);
    });

    it('should not unregister core adapters', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = AdapterRegistry.unregisterAdapter('kana');

      expect(result).toBe(false);
      expect(AdapterRegistry.hasAdapter('kana')).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Cannot unregister core adapter: kana');
      
      consoleErrorSpy.mockRestore();
    });

    it('should return false for non-existent adapter', () => {
      const result = AdapterRegistry.unregisterAdapter('non-existent');

      expect(result).toBe(false);
    });

    it('should throw error when not initialized', () => {
      AdapterRegistry.reset();

      expect(() => AdapterRegistry.unregisterAdapter('test')).toThrow(
        'AdapterRegistry not initialized. Call initialize() first.'
      );
    });

    it('should update registered types list', () => {
      const mockAdapter = new MockAdapter();
      AdapterRegistry.registerAdapter('test', mockAdapter);
      const initialCount = AdapterRegistry.getRegisteredTypes().length;

      AdapterRegistry.unregisterAdapter('test');

      const newTypes = AdapterRegistry.getRegisteredTypes();
      expect(newTypes).not.toContain('test');
      expect(newTypes.length).toBe(initialCount - 1);
    });

    it('should prevent unregistering all core adapters', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const coreAdapters = ['kana', 'kanji', 'vocabulary', 'sentence', 'custom'];

      coreAdapters.forEach(type => {
        expect(AdapterRegistry.unregisterAdapter(type)).toBe(false);
        expect(AdapterRegistry.hasAdapter(type)).toBe(true);
      });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(5);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getRegisteredTypes()', () => {
    it('should return empty array when not initialized', () => {
      const types = AdapterRegistry.getRegisteredTypes();
      expect(types).toEqual([]);
    });

    it('should return all registered types', () => {
      AdapterRegistry.initialize(defaultConfigs);

      const types = AdapterRegistry.getRegisteredTypes();

      expect(types).toContain('kana');
      expect(types).toContain('kanji');
      expect(types).toContain('vocabulary');
      expect(types).toContain('sentence');
      expect(types).toContain('custom');
      expect(types.length).toBe(5);
    });

    it('should include custom registered types', () => {
      AdapterRegistry.initialize(defaultConfigs);
      const mockAdapter = new MockAdapter();
      AdapterRegistry.registerAdapter('test', mockAdapter);

      const types = AdapterRegistry.getRegisteredTypes();

      expect(types).toContain('test');
      expect(types.length).toBe(6);
    });

    it('should reflect changes when adapters are unregistered', () => {
      AdapterRegistry.initialize(defaultConfigs);
      const mockAdapter = new MockAdapter();
      AdapterRegistry.registerAdapter('test', mockAdapter);

      let types = AdapterRegistry.getRegisteredTypes();
      expect(types).toContain('test');

      AdapterRegistry.unregisterAdapter('test');
      types = AdapterRegistry.getRegisteredTypes();
      expect(types).not.toContain('test');
    });
  });

  describe('hasAdapter()', () => {
    beforeEach(() => {
      AdapterRegistry.initialize(defaultConfigs);
    });

    it('should return true for registered adapters', () => {
      expect(AdapterRegistry.hasAdapter('kana')).toBe(true);
      expect(AdapterRegistry.hasAdapter('kanji')).toBe(true);
      expect(AdapterRegistry.hasAdapter('vocabulary')).toBe(true);
      expect(AdapterRegistry.hasAdapter('sentence')).toBe(true);
      expect(AdapterRegistry.hasAdapter('custom')).toBe(true);
    });

    it('should return false for unregistered adapters', () => {
      expect(AdapterRegistry.hasAdapter('unknown')).toBe(false);
      expect(AdapterRegistry.hasAdapter('non-existent')).toBe(false);
    });

    it('should return false when not initialized', () => {
      AdapterRegistry.reset();
      expect(AdapterRegistry.hasAdapter('kana')).toBe(false);
    });

    it('should reflect registration changes', () => {
      const mockAdapter = new MockAdapter();

      expect(AdapterRegistry.hasAdapter('test')).toBe(false);

      AdapterRegistry.registerAdapter('test', mockAdapter);
      expect(AdapterRegistry.hasAdapter('test')).toBe(true);

      AdapterRegistry.unregisterAdapter('test');
      expect(AdapterRegistry.hasAdapter('test')).toBe(false);
    });
  });

  describe('reset()', () => {
    it('should clear all adapters and reset initialization state', () => {
      AdapterRegistry.initialize(defaultConfigs);
      expect(AdapterRegistry.getRegisteredTypes().length).toBe(5);

      AdapterRegistry.reset();

      expect(AdapterRegistry.getRegisteredTypes()).toEqual([]);
      expect(() => AdapterRegistry.getAdapter('kana')).toThrow(
        'AdapterRegistry not initialized'
      );
    });

    it('should allow reinitialization after reset', () => {
      AdapterRegistry.initialize(defaultConfigs);
      AdapterRegistry.reset();

      AdapterRegistry.initialize(defaultConfigs);
      expect(AdapterRegistry.hasAdapter('kana')).toBe(true);
    });
  });

  describe('createDefaultAdapterConfigs()', () => {
    it('should create configurations for all core content types', () => {
      const configs = createDefaultAdapterConfigs();

      expect(configs).toHaveProperty('kana');
      expect(configs).toHaveProperty('kanji');
      expect(configs).toHaveProperty('vocabulary');
      expect(configs).toHaveProperty('sentence');
      expect(configs).toHaveProperty('custom');
    });

    it('should have correct content type for each config', () => {
      const configs = createDefaultAdapterConfigs();

      expect(configs.kana.contentType).toBe('kana');
      expect(configs.kanji.contentType).toBe('kanji');
      expect(configs.vocabulary.contentType).toBe('vocabulary');
      expect(configs.sentence.contentType).toBe('sentence');
      expect(configs.custom.contentType).toBe('custom');
    });

    it('should include available modes for each content type', () => {
      const configs = createDefaultAdapterConfigs();

      Object.values(configs).forEach(config => {
        expect(config.availableModes).toBeInstanceOf(Array);
        expect(config.availableModes.length).toBeGreaterThan(0);
      });
    });

    it('should have appropriate default modes', () => {
      const configs = createDefaultAdapterConfigs();

      expect(configs.kana.defaultMode).toBe('recognition');
      expect(configs.kanji.defaultMode).toBe('recognition');
      expect(configs.vocabulary.defaultMode).toBe('recognition');
      expect(configs.sentence.defaultMode).toBe('recognition');
      expect(configs.custom.defaultMode).toBe('recognition');
    });

    it('should include validation strategies', () => {
      const configs = createDefaultAdapterConfigs();

      expect(configs.kana.validationStrategy).toBe('exact');
      expect(configs.kanji.validationStrategy).toBe('fuzzy');
      expect(configs.vocabulary.validationStrategy).toBe('fuzzy');
      expect(configs.sentence.validationStrategy).toBe('fuzzy');
      expect(configs.custom.validationStrategy).toBe('fuzzy');
    });

    it('should include feature configurations', () => {
      const configs = createDefaultAdapterConfigs();

      expect(configs.kana.features).toHaveProperty('displayScript');
      expect(configs.kanji.features).toHaveProperty('strokeOrder');
      expect(configs.vocabulary.features).toHaveProperty('furigana');
      expect(configs.sentence.features).toHaveProperty('furigana');
    });

    it('should include font size configurations', () => {
      const configs = createDefaultAdapterConfigs();

      expect(configs.kana.fontSize).toBe('large');
      expect(configs.kanji.fontSize).toBe('extra-large');
      expect(configs.vocabulary.fontSize).toBe('medium');
      expect(configs.sentence.fontSize).toBe('medium');
      expect(configs.custom.fontSize).toBe('medium');
    });
  });

  describe('initializeAdapterRegistry()', () => {
    it('should initialize with default configurations', () => {
      initializeAdapterRegistry();

      expect(AdapterRegistry.hasAdapter('kana')).toBe(true);
      expect(AdapterRegistry.hasAdapter('kanji')).toBe(true);
      expect(AdapterRegistry.hasAdapter('vocabulary')).toBe(true);
      expect(AdapterRegistry.hasAdapter('sentence')).toBe(true);
      expect(AdapterRegistry.hasAdapter('custom')).toBe(true);
    });

    it('should merge custom configurations with defaults', () => {
      const customConfig = {
        kana: {
          ...defaultConfigs.kana,
          features: { displayScript: 'katakana' as const }
        }
      };

      initializeAdapterRegistry(customConfig);

      expect(AdapterRegistry.hasAdapter('kana')).toBe(true);
      // All other adapters should still be registered with defaults
      expect(AdapterRegistry.hasAdapter('vocabulary')).toBe(true);
    });

    it('should handle partial custom configurations', () => {
      const partialConfig = {
        vocabulary: {
          ...defaultConfigs.vocabulary,
          fontSize: 'large' as const
        }
      };

      initializeAdapterRegistry(partialConfig);

      // Should still have all core adapters
      expect(AdapterRegistry.getRegisteredTypes()).toContain('kana');
      expect(AdapterRegistry.getRegisteredTypes()).toContain('kanji');
      expect(AdapterRegistry.getRegisteredTypes()).toContain('vocabulary');
      expect(AdapterRegistry.getRegisteredTypes()).toContain('sentence');
      expect(AdapterRegistry.getRegisteredTypes()).toContain('custom');
    });
  });

  describe('Default Configuration Details', () => {
    let configs: Record<string, ContentTypeConfig>;

    beforeEach(() => {
      configs = createDefaultAdapterConfigs();
    });

    it('should have appropriate mode configurations for kana', () => {
      const kanaConfig = configs.kana;
      const recognitionMode = kanaConfig.availableModes.find(m => m.mode === 'recognition');
      const listeningMode = kanaConfig.availableModes.find(m => m.mode === 'listening');

      expect(recognitionMode?.showPrimary).toBe(true);
      expect(recognitionMode?.inputType).toBe('multiple-choice');
      expect(listeningMode?.autoPlayAudio).toBe(true);
    });

    it('should have appropriate mode configurations for kanji', () => {
      const kanjiConfig = configs.kanji;
      const recognitionMode = kanjiConfig.availableModes.find(m => m.mode === 'recognition');

      expect(recognitionMode?.showMedia).toBe(true);
      expect(recognitionMode?.optionSource).toBe('similar');
    });

    it('should have appropriate validation options for vocabulary', () => {
      const vocabConfig = configs.vocabulary;

      expect(vocabConfig.validationOptions?.threshold).toBe(0.85);
      expect(vocabConfig.validationOptions?.ignoreCase).toBe(true);
      expect(vocabConfig.validationOptions?.ignoreWhitespace).toBe(true);
    });

    it('should have appropriate validation options for sentences', () => {
      const sentenceConfig = configs.sentence;

      expect(sentenceConfig.validationOptions?.threshold).toBe(0.7);
      expect(sentenceConfig.validationOptions?.ignorePunctuation).toBe(true);
    });

    it('should have hint configurations for all modes', () => {
      Object.values(configs).forEach(config => {
        config.availableModes.forEach(mode => {
          if (mode.allowHints) {
            expect(mode.hintPenalty).toBeGreaterThan(0);
            expect(mode.hintPenalty).toBeLessThanOrEqual(1);
          }
        });
      });
    });

    it('should have reasonable option counts for multiple choice modes', () => {
      Object.values(configs).forEach(config => {
        config.availableModes.forEach(mode => {
          if (mode.inputType === 'multiple-choice') {
            expect(mode.optionCount).toBeGreaterThanOrEqual(2);
            expect(mode.optionCount).toBeLessThanOrEqual(6);
          }
        });
      });
    });
  });

  describe('Performance', () => {
    it('should initialize quickly', async () => {
      AdapterRegistry.reset();

      const { duration } = await TestHelpers.measurePerformance(
        async () => AdapterRegistry.initialize(defaultConfigs),
        1
      );

      expect(duration).toBeLessThan(100);
    });

    it('should retrieve adapters quickly', async () => {
      AdapterRegistry.initialize(defaultConfigs);

      const { duration } = await TestHelpers.measurePerformance(
        async () => {
          AdapterRegistry.getAdapter('kana');
          AdapterRegistry.getAdapter('kanji');
          AdapterRegistry.getAdapter('vocabulary');
          AdapterRegistry.getAdapter('sentence');
          AdapterRegistry.getAdapter('custom');
        },
        1000
      );

      expect(duration).toBeLessThan(10);
    });

    it('should handle many custom adapter registrations efficiently', async () => {
      AdapterRegistry.initialize(defaultConfigs);

      const { duration } = await TestHelpers.measurePerformance(
        async () => {
          for (let i = 0; i < 100; i++) {
            AdapterRegistry.registerAdapter(`test-${i}`, new MockAdapter());
          }
        },
        1
      );

      expect(duration).toBeLessThan(50);
      expect(AdapterRegistry.getRegisteredTypes().length).toBe(105); // 5 core + 100 custom
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined configurations gracefully', () => {
      expect(() => {
        AdapterRegistry.initialize(null as any);
      }).not.toThrow();
    });

    it('should handle empty configurations', () => {
      AdapterRegistry.initialize({});

      // Should still create custom adapter with defaults
      expect(AdapterRegistry.hasAdapter('custom')).toBe(true);
    });

    it('should handle duplicate adapter registration', () => {
      AdapterRegistry.initialize(defaultConfigs);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const adapter1 = new MockAdapter();
      const adapter2 = new MockAdapter();

      AdapterRegistry.registerAdapter('duplicate', adapter1);
      AdapterRegistry.registerAdapter('duplicate', adapter2);

      expect(AdapterRegistry.getAdapter('duplicate')).toBe(adapter2);
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      
      consoleSpy.mockRestore();
    });

    it('should handle case-sensitive adapter names', () => {
      AdapterRegistry.initialize(defaultConfigs);

      expect(AdapterRegistry.hasAdapter('KANA')).toBe(false);
      expect(AdapterRegistry.hasAdapter('Kana')).toBe(false);
      expect(AdapterRegistry.hasAdapter('kana')).toBe(true);
    });

    it('should handle empty string adapter names', () => {
      AdapterRegistry.initialize(defaultConfigs);
      const mockAdapter = new MockAdapter();

      AdapterRegistry.registerAdapter('', mockAdapter);
      expect(AdapterRegistry.hasAdapter('')).toBe(true);
      expect(AdapterRegistry.getAdapter('')).toBe(mockAdapter);
    });

    it('should handle special character adapter names', () => {
      AdapterRegistry.initialize(defaultConfigs);
      const mockAdapter = new MockAdapter();
      const specialName = 'test-adapter_123!';

      AdapterRegistry.registerAdapter(specialName, mockAdapter);
      expect(AdapterRegistry.hasAdapter(specialName)).toBe(true);
      expect(AdapterRegistry.getAdapter(specialName)).toBe(mockAdapter);
    });

    it('should maintain adapter state after multiple resets and initializations', () => {
      for (let i = 0; i < 5; i++) {
        AdapterRegistry.reset();
        AdapterRegistry.initialize(defaultConfigs);
        expect(AdapterRegistry.getRegisteredTypes().length).toBe(5);
      }
    });
  });

  describe('Integration Tests', () => {
    it('should work with actual content transformation', () => {
      AdapterRegistry.initialize(defaultConfigs);
      
      const kanaAdapter = AdapterRegistry.getAdapter('kana');
      const kanaContent = MockFactory.createKanaContent();
      
      const transformed = kanaAdapter.transform(kanaContent);
      expect(transformed).toBeDefined();
      expect(transformed.contentType).toBe('kana');
    });

    it('should maintain adapter configurations across operations', () => {
      const customConfig = {
        ...defaultConfigs,
        kana: {
          ...defaultConfigs.kana,
          features: { displayScript: 'katakana' as const }
        }
      };

      AdapterRegistry.initialize(customConfig);
      
      // Perform various operations
      const kanaAdapter = AdapterRegistry.getAdapter('kana');
      AdapterRegistry.registerAdapter('test', new MockAdapter());
      AdapterRegistry.unregisterAdapter('test');
      
      // Should still maintain original configuration
      expect(kanaAdapter).toBeInstanceOf(KanaAdapter);
    });

    it('should handle concurrent access to registry', () => {
      AdapterRegistry.initialize(defaultConfigs);
      
      const promises = [];
      
      // Simulate concurrent access
      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve().then(() => {
          AdapterRegistry.getAdapter('kana');
          AdapterRegistry.hasAdapter('vocabulary');
          AdapterRegistry.getRegisteredTypes();
        }));
      }
      
      return Promise.all(promises).then(() => {
        expect(AdapterRegistry.getRegisteredTypes().length).toBe(5);
      });
    });
  });
});