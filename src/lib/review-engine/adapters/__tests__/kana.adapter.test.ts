/**
 * KanaAdapter Test Suite
 * Tests kana content transformation, option generation, and mode preparation
 */

import { KanaAdapter, KanaContent } from '../kana.adapter';
import { ReviewableContent } from '../../core/interfaces';
import { ReviewMode } from '../../core/types';
import { MockFactory, createTestScenario } from '../../__tests__/test-utils/mock-factory';
import { 
  TestHelpers, 
  AdapterTestHelpers,
  setupTest,
  teardownTest 
} from '../../__tests__/test-utils/test-helpers';
import { createKanaTestConfig } from '../../__tests__/test-utils/adapter-test-helpers';

describe('KanaAdapter', () => {
  let adapter: KanaAdapter;
  let mockKanaContent: KanaContent;
  let kanaPool: KanaContent[];

  beforeEach(() => {
    setupTest();
    adapter = new KanaAdapter(createKanaTestConfig({ displayScript: 'hiragana' }));
    mockKanaContent = MockFactory.createKanaContent();
    kanaPool = MockFactory.createBulkKanaContent(20);
  });

  afterEach(() => {
    teardownTest();
  });

  describe('transform()', () => {
    it('should transform kana content to ReviewableContent', () => {
      const result = adapter.transform(mockKanaContent);

      TestHelpers.validateContentTransformation(mockKanaContent, result);
      expect(result.contentType).toBe('kana');
      expect(result.primaryDisplay).toBe(mockKanaContent.hiragana);
      expect(result.secondaryDisplay).toBe(mockKanaContent.romaji);
      expect(result.primaryAnswer).toBe(mockKanaContent.romaji);
    });

    it('should use katakana when displayScript is katakana', () => {
      adapter = new KanaAdapter(createKanaTestConfig({ displayScript: 'katakana' }));
      const result = adapter.transform(mockKanaContent);

      expect(result.primaryDisplay).toBe(mockKanaContent.katakana);
      expect(result.metadata?.alternateScript).toBe(mockKanaContent.hiragana);
    });

    it('should include alternative romanizations', () => {
      const shiContent = MockFactory.createKanaContent({
        romaji: 'shi',
        hiragana: 'し',
        katakana: 'シ'
      });
      const result = adapter.transform(shiContent);

      expect(result.alternativeAnswers).toContain('si');
      expect(result.alternativeAnswers).toContain('し');
      expect(result.alternativeAnswers).toContain('シ');
    });

    it('should generate correct audio URL', () => {
      const result = adapter.transform(mockKanaContent);
      expect(result.audioUrl).toBe(`/audio/kana/hiragana/${mockKanaContent.romaji}.mp3`);
    });

    it('should include metadata', () => {
      const result = adapter.transform(mockKanaContent);
      expect(result.metadata).toMatchObject({
        row: mockKanaContent.row,
        column: mockKanaContent.column,
        type: mockKanaContent.type,
        alternateScript: mockKanaContent.katakana
      });
    });

    it('should handle pronunciation field', () => {
      const contentWithPronunciation = MockFactory.createKanaContent({
        pronunciation: 'special pronunciation'
      });
      const result = adapter.transform(contentWithPronunciation);
      expect(result.tertiaryDisplay).toBe('special pronunciation');
    });
  });

  describe('calculateDifficulty()', () => {
    it('should calculate difficulty for vowels', () => {
      const vowel = MockFactory.createKanaContent({ type: 'vowel' });
      const difficulty = adapter.calculateDifficulty(vowel);
      expect(difficulty).toBe(0.1);
    });

    it('should calculate difficulty for consonants', () => {
      const consonant = MockFactory.createKanaContent({ type: 'consonant' });
      const difficulty = adapter.calculateDifficulty(consonant);
      expect(difficulty).toBe(0.3);
    });

    it('should calculate difficulty for digraphs', () => {
      const digraph = MockFactory.createKanaContent({ type: 'digraph' });
      const difficulty = adapter.calculateDifficulty(digraph);
      expect(difficulty).toBe(0.7);
    });

    it('should add difficulty for dakuten marks', () => {
      const dakuten = MockFactory.createKanaContent({ 
        type: 'consonant',
        row: 'g' 
      });
      const difficulty = adapter.calculateDifficulty(dakuten);
      expect(difficulty).toBe(0.4); // 0.3 base + 0.1 dakuten
    });

    it('should add difficulty for handakuten marks', () => {
      const handakuten = MockFactory.createKanaContent({ 
        type: 'consonant',
        row: 'p' 
      });
      const difficulty = adapter.calculateDifficulty(handakuten);
      expect(difficulty).toBe(0.45); // 0.3 base + 0.15 handakuten
    });

    it('should add difficulty for special pronunciation', () => {
      const special = MockFactory.createKanaContent({ 
        type: 'consonant',
        pronunciation: 'special'
      });
      const difficulty = adapter.calculateDifficulty(special);
      expect(difficulty).toBe(0.5); // 0.3 base + 0.2 special
    });

    it('should cap difficulty at 1.0', () => {
      const maxDifficulty = MockFactory.createKanaContent({ 
        type: 'digraph',
        row: 'p',
        pronunciation: 'special'
      });
      const difficulty = adapter.calculateDifficulty(maxDifficulty);
      expect(difficulty).toBe(1.0);
    });
  });

  describe('generateOptions()', () => {
    it('should generate correct number of options', () => {
      const content = adapter.transform(mockKanaContent);
      const options = adapter.generateOptions(content, kanaPool, 4);

      TestHelpers.validateOptionsGeneration(options, content, 4);
    });

    it('should prioritize similar characters from same row', () => {
      const aRowContent = MockFactory.createKanaContent({ row: 'a' });
      const transformed = adapter.transform(aRowContent);
      const options = adapter.generateOptions(transformed, kanaPool, 4);

      const sameRowOptions = options.filter(opt => 
        opt.metadata?.row === 'a'
      );
      expect(sameRowOptions.length).toBeGreaterThan(0);
    });

    it('should include visually similar characters', () => {
      const reContent = MockFactory.createKanaContent({ 
        hiragana: 'れ',
        katakana: 'レ',
        romaji: 're'
      });
      const similarPool = [
        MockFactory.createKanaContent({ hiragana: 'わ' }),
        MockFactory.createKanaContent({ hiragana: 'ね' }),
        ...kanaPool
      ];
      
      const transformed = adapter.transform(reContent);
      const options = adapter.generateOptions(transformed, similarPool, 4);
      
      expect(options.length).toBe(3);
    });

    it('should not include the correct answer in options', () => {
      const content = adapter.transform(mockKanaContent);
      const options = adapter.generateOptions(content, kanaPool, 4);

      const hasCorrectAnswer = options.some(opt => opt.id === content.id);
      expect(hasCorrectAnswer).toBe(false);
    });

    it('should handle small pools gracefully', () => {
      const smallPool = MockFactory.createBulkKanaContent(2);
      const content = adapter.transform(mockKanaContent);
      const options = adapter.generateOptions(content, smallPool, 4);

      expect(options.length).toBeLessThanOrEqual(3);
      AdapterTestHelpers.testOptionsUniqueness(options, content);
    });

    it('should include confusion pairs when available', () => {
      const shiContent = MockFactory.createKanaContent({ 
        id: 'shi',
        romaji: 'shi' 
      });
      const chiContent = MockFactory.createKanaContent({ 
        id: 'chi',
        romaji: 'chi' 
      });
      const poolWithConfusion = [chiContent, ...kanaPool];
      
      const transformed = adapter.transform(shiContent);
      const options = adapter.generateOptions(transformed, poolWithConfusion, 4);
      
      const hasConfusionPair = options.some(opt => opt.id === 'chi');
      expect(hasConfusionPair).toBe(true);
    });
  });

  describe('getSupportedModes()', () => {
    it('should return correct supported modes', () => {
      const modes = adapter.getSupportedModes();
      expect(modes).toEqual(['recognition', 'recall', 'listening']);
    });
  });

  describe('prepareForMode()', () => {
    let content: ReviewableContent;

    beforeEach(() => {
      content = adapter.transform(mockKanaContent);
    });

    describe('recognition mode', () => {
      it('should show kana and hide romaji', () => {
        const prepared = adapter.prepareForMode(content, 'recognition');
        
        expect(prepared.primaryDisplay).toBe(content.primaryDisplay);
        expect(prepared.secondaryDisplay).toBeUndefined();
        expect(prepared.primaryAnswer).toBe(content.primaryAnswer);
      });
    });

    describe('recall mode', () => {
      it('should show romaji and expect kana as answer', () => {
        const prepared = adapter.prepareForMode(content, 'recall');
        
        expect(prepared.primaryDisplay).toBe(mockKanaContent.romaji);
        expect(prepared.secondaryDisplay).toBeUndefined();
        expect(prepared.primaryAnswer).toBe(mockKanaContent.hiragana);
      });
    });

    describe('listening mode', () => {
      it('should hide visual content and show placeholder', () => {
        const prepared = adapter.prepareForMode(content, 'listening');
        
        expect(prepared.primaryDisplay).toBe('?');
        expect(prepared.secondaryDisplay).toBeUndefined();
        expect(prepared.audioUrl).toBe(content.audioUrl);
      });
    });

    describe('unsupported mode', () => {
      it('should return content unchanged', () => {
        const prepared = adapter.prepareForMode(content, 'typing' as ReviewMode);
        expect(prepared).toEqual(content);
      });
    });
  });

  describe('generateHints()', () => {
    it('should generate hints for vowel type', () => {
      const vowelContent = MockFactory.createKanaContent({ type: 'vowel' });
      const transformed = adapter.transform(vowelContent);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('This is one of the five basic vowels');
      AdapterTestHelpers.testHintGeneration(adapter, transformed, 2, 4);
    });

    it('should generate hints for digraph type', () => {
      const digraphContent = MockFactory.createKanaContent({ type: 'digraph' });
      const transformed = adapter.transform(digraphContent);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('This is a combination sound (digraph)');
    });

    it('should include row hint', () => {
      const transformed = adapter.transform(mockKanaContent);
      const hints = adapter.generateHints(transformed);

      const rowHint = hints.find(h => h.includes(`'${mockKanaContent.row}' row`));
      expect(rowHint).toBeDefined();
    });

    it('should include pronunciation hint when available', () => {
      const contentWithPronunciation = MockFactory.createKanaContent({
        pronunciation: 'special sound'
      });
      const transformed = adapter.transform(contentWithPronunciation);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('Special pronunciation: special sound');
    });

    it('should include first letter hint', () => {
      const transformed = adapter.transform(mockKanaContent);
      const hints = adapter.generateHints(transformed);

      const firstLetterHint = hints.find(h => 
        h.includes(`Starts with '${mockKanaContent.romaji[0]}'`)
      );
      expect(firstLetterHint).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should transform content quickly', async () => {
      const { duration } = await TestHelpers.measurePerformance(
        async () => adapter.transform(mockKanaContent),
        10
      );
      expect(duration).toBeLessThan(10);
    });

    it('should generate options efficiently for large pools', async () => {
      const largePool = MockFactory.createBulkKanaContent(1000);
      const content = adapter.transform(mockKanaContent);
      
      const { duration } = await TestHelpers.measurePerformance(
        async () => adapter.generateOptions(content, largePool, 4),
        50
      );
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing optional fields', () => {
      const minimal: KanaContent = {
        id: 'test',
        hiragana: 'あ',
        katakana: 'ア',
        romaji: 'a',
        type: 'vowel',
        row: 'a',
        column: '1'
      };

      const result = adapter.transform(minimal);
      expect(result).toBeDefined();
      expect(result.tertiaryDisplay).toBeUndefined();
    });

    it('should handle empty pools in generateOptions', () => {
      const content = adapter.transform(mockKanaContent);
      const options = adapter.generateOptions(content, [], 4);
      expect(options).toEqual([]);
    });

    it('should handle default config', () => {
      const adapterWithDefaultConfig = new KanaAdapter(createKanaTestConfig());
      const result = adapterWithDefaultConfig.transform(mockKanaContent);
      expect(result.primaryDisplay).toBe(mockKanaContent.hiragana);
    });
  });

  describe('Integration with Base Adapter', () => {
    it('should inherit from BaseContentAdapter', () => {
      expect(adapter).toHaveProperty('transform');
      expect(adapter).toHaveProperty('generateOptions');
      expect(adapter).toHaveProperty('getSupportedModes');
      expect(adapter).toHaveProperty('prepareForMode');
      expect(adapter).toHaveProperty('calculateDifficulty');
      expect(adapter).toHaveProperty('generateHints');
    });

    it('should respect config passed to constructor', () => {
      const customAdapter = new KanaAdapter(createKanaTestConfig({ displayScript: 'katakana' }));
      const result = customAdapter.transform(mockKanaContent);
      
      expect(result.primaryDisplay).toBe(mockKanaContent.katakana);
    });
  });
});