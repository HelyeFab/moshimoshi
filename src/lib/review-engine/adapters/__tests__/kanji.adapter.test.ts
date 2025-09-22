/**
 * KanjiAdapter Test Suite
 * Tests kanji content transformation, option generation, and mode preparation
 */

import { KanjiAdapter, KanjiContent } from '../kanji.adapter';
import { ReviewableContent } from '../../core/interfaces';
import { ReviewMode } from '../../core/types';
import { MockFactory } from '../../__tests__/test-utils/mock-factory';
import { 
  TestHelpers, 
  AdapterTestHelpers,
  setupTest,
  teardownTest 
} from '../../__tests__/test-utils/test-helpers';

describe('KanjiAdapter', () => {
  let adapter: KanjiAdapter;
  let mockKanjiContent: KanjiContent;
  let kanjiPool: KanjiContent[];

  beforeEach(() => {
    setupTest();
    adapter = new KanjiAdapter({
      features: { 
        displayReading: 'kun',
        showStrokeOrder: true 
      }
    });
    mockKanjiContent = MockFactory.createKanjiContent();
    kanjiPool = Array.from({ length: 20 }, () => MockFactory.createKanjiContent());
  });

  afterEach(() => {
    teardownTest();
  });

  describe('transform()', () => {
    it('should transform kanji content to ReviewableContent', () => {
      const result = adapter.transform(mockKanjiContent);

      TestHelpers.validateContentTransformation(mockKanjiContent, result);
      expect(result.contentType).toBe('kanji');
      expect(result.primaryDisplay).toBe(mockKanjiContent.character);
      expect(result.secondaryDisplay).toBe(mockKanjiContent.meanings.join(', '));
      expect(result.primaryAnswer).toBe(mockKanjiContent.meanings[0]);
    });

    it('should include all meanings as alternative answers', () => {
      const multiMeaningKanji = MockFactory.createKanjiContent({
        meanings: ['sun', 'day', 'Japan']
      });
      const result = adapter.transform(multiMeaningKanji);

      expect(result.alternativeAnswers).toContain('day');
      expect(result.alternativeAnswers).toContain('Japan');
    });

    it('should include readings as alternative answers', () => {
      const result = adapter.transform(mockKanjiContent);

      mockKanjiContent.readings.on.forEach(reading => {
        expect(result.alternativeAnswers).toContain(reading);
      });
      mockKanjiContent.readings.kun.forEach(reading => {
        expect(result.alternativeAnswers).toContain(reading);
      });
    });

    it('should use kun reading when specified', () => {
      const result = adapter.transform(mockKanjiContent);
      expect(result.tertiaryDisplay).toBe(
        `kun: ${mockKanjiContent.readings.kun.join(', ')}`
      );
    });

    it('should use on reading when specified', () => {
      adapter = new KanjiAdapter({
        features: { displayReading: 'on' }
      });
      const result = adapter.transform(mockKanjiContent);
      expect(result.tertiaryDisplay).toBe(
        `on: ${mockKanjiContent.readings.on.join(', ')}`
      );
    });

    it('should include media URLs when showStrokeOrder is true', () => {
      const result = adapter.transform(mockKanjiContent);
      expect(result.imageUrl).toBe(`/kanji/strokes/${mockKanjiContent.character}.svg`);
      expect(result.videoUrl).toBe(`/kanji/animations/${mockKanjiContent.character}.mp4`);
    });

    it('should include metadata', () => {
      const result = adapter.transform(mockKanjiContent);
      expect(result.metadata).toMatchObject({
        level: mockKanjiContent.level,
        strokes: mockKanjiContent.strokes,
        radicals: mockKanjiContent.radicals,
        allReadings: {
          on: mockKanjiContent.readings.on,
          kun: mockKanjiContent.readings.kun
        }
      });
    });

    it('should include tags based on level and stroke count', () => {
      const result = adapter.transform(mockKanjiContent);
      expect(result.tags).toContain('kanji');
      expect(result.tags).toContain(mockKanjiContent.level);
      expect(result.tags).toContain(`${mockKanjiContent.strokes}-strokes`);
    });
  });

  describe('calculateDifficulty()', () => {
    it('should calculate difficulty based on JLPT level', () => {
      const n5Kanji = MockFactory.createKanjiContent({ level: 'N5', strokes: 4 });
      const n1Kanji = MockFactory.createKanjiContent({ level: 'N1', strokes: 4 });
      
      const n5Difficulty = adapter.calculateDifficulty(n5Kanji);
      const n1Difficulty = adapter.calculateDifficulty(n1Kanji);
      
      expect(n5Difficulty).toBeLessThan(n1Difficulty);
      expect(n5Difficulty).toBeCloseTo(0.2, 1);
      expect(n1Difficulty).toBeCloseTo(1.0, 1);
    });

    it('should increase difficulty with stroke count', () => {
      const simple = MockFactory.createKanjiContent({ level: 'N5', strokes: 3 });
      const complex = MockFactory.createKanjiContent({ level: 'N5', strokes: 20 });
      
      const simpleDifficulty = adapter.calculateDifficulty(simple);
      const complexDifficulty = adapter.calculateDifficulty(complex);
      
      expect(simpleDifficulty).toBeLessThan(complexDifficulty);
    });

    it('should increase difficulty with multiple meanings', () => {
      const single = MockFactory.createKanjiContent({ 
        meanings: ['one'],
        level: 'N5',
        strokes: 5
      });
      const multiple = MockFactory.createKanjiContent({ 
        meanings: ['one', 'two', 'three', 'four'],
        level: 'N5',
        strokes: 5
      });
      
      const singleDifficulty = adapter.calculateDifficulty(single);
      const multipleDifficulty = adapter.calculateDifficulty(multiple);
      
      expect(singleDifficulty).toBeLessThan(multipleDifficulty);
    });

    it('should cap difficulty at 1.0', () => {
      const veryHard = MockFactory.createKanjiContent({ 
        level: 'N1',
        strokes: 30,
        meanings: Array(10).fill('meaning')
      });
      
      const difficulty = adapter.calculateDifficulty(veryHard);
      expect(difficulty).toBe(1.0);
    });
  });

  describe('generateOptions()', () => {
    it('should generate correct number of options', () => {
      const content = adapter.transform(mockKanjiContent);
      const options = adapter.generateOptions(content, kanjiPool, 4);

      TestHelpers.validateOptionsGeneration(options, content, 4);
    });

    it('should prioritize kanji with similar stroke counts', () => {
      const targetKanji = MockFactory.createKanjiContent({ strokes: 10 });
      const similarStrokeKanji = [
        MockFactory.createKanjiContent({ strokes: 9 }),
        MockFactory.createKanjiContent({ strokes: 10 }),
        MockFactory.createKanjiContent({ strokes: 11 }),
      ];
      const pool = [...similarStrokeKanji, ...kanjiPool];
      
      const transformed = adapter.transform(targetKanji);
      const options = adapter.generateOptions(transformed, pool, 4);
      
      const similarStrokeOptions = options.filter(opt => {
        const strokes = opt.metadata?.strokes as number;
        return strokes >= 9 && strokes <= 11;
      });
      
      expect(similarStrokeOptions.length).toBeGreaterThan(0);
    });

    it('should prioritize kanji from same level', () => {
      const n3Kanji = MockFactory.createKanjiContent({ level: 'N3' });
      const n3Pool = Array.from({ length: 5 }, () => 
        MockFactory.createKanjiContent({ level: 'N3' })
      );
      const mixedPool = [...n3Pool, ...kanjiPool];
      
      const transformed = adapter.transform(n3Kanji);
      const options = adapter.generateOptions(transformed, mixedPool, 4);
      
      const sameLevelOptions = options.filter(opt => 
        opt.metadata?.level === 'N3'
      );
      
      expect(sameLevelOptions.length).toBeGreaterThan(0);
    });

    it('should include kanji with shared radicals', () => {
      const waterRadicalKanji = MockFactory.createKanjiContent({ 
        radicals: ['氵', '水'] 
      });
      const similarRadicalPool = [
        MockFactory.createKanjiContent({ radicals: ['氵'] }),
        MockFactory.createKanjiContent({ radicals: ['水'] }),
      ];
      const pool = [...similarRadicalPool, ...kanjiPool];
      
      const transformed = adapter.transform(waterRadicalKanji);
      const options = adapter.generateOptions(transformed, pool, 4);
      
      expect(options.length).toBeGreaterThan(0);
    });
  });

  describe('getSupportedModes()', () => {
    it('should return correct supported modes', () => {
      const modes = adapter.getSupportedModes();
      expect(modes).toEqual(['recognition', 'recall', 'writing']);
    });
  });

  describe('prepareForMode()', () => {
    let content: ReviewableContent;

    beforeEach(() => {
      content = adapter.transform(mockKanjiContent);
    });

    describe('recognition mode', () => {
      it('should show kanji and hide meanings', () => {
        const prepared = adapter.prepareForMode(content, 'recognition');
        
        expect(prepared.primaryDisplay).toBe(mockKanjiContent.character);
        expect(prepared.secondaryDisplay).toBeUndefined();
        expect(prepared.tertiaryDisplay).toBeUndefined();
      });
    });

    describe('recall mode', () => {
      it('should show meanings and expect kanji', () => {
        const prepared = adapter.prepareForMode(content, 'recall');
        
        expect(prepared.primaryDisplay).toBe(mockKanjiContent.meanings.join(', '));
        expect(prepared.secondaryDisplay).toBeUndefined();
        expect(prepared.primaryAnswer).toBe(mockKanjiContent.character);
      });
    });

    describe('writing mode', () => {
      it('should show meanings and stroke guide', () => {
        const prepared = adapter.prepareForMode(content, 'writing');
        
        expect(prepared.primaryDisplay).toBe(mockKanjiContent.meanings.join(', '));
        expect(prepared.secondaryDisplay).toBe(`${mockKanjiContent.strokes} strokes`);
        expect(prepared.primaryAnswer).toBe(mockKanjiContent.character);
        expect(prepared.imageUrl).toBeDefined();
      });
    });
  });

  describe('generateHints()', () => {
    it('should generate stroke count hint', () => {
      const transformed = adapter.transform(mockKanjiContent);
      const hints = adapter.generateHints(transformed);

      const strokeHint = hints.find(h => 
        h.includes(`${mockKanjiContent.strokes} strokes`)
      );
      expect(strokeHint).toBeDefined();
    });

    it('should generate JLPT level hint', () => {
      const transformed = adapter.transform(mockKanjiContent);
      const hints = adapter.generateHints(transformed);

      const levelHint = hints.find(h => 
        h.includes(`JLPT ${mockKanjiContent.level}`)
      );
      expect(levelHint).toBeDefined();
    });

    it('should generate radical hint', () => {
      const transformed = adapter.transform(mockKanjiContent);
      const hints = adapter.generateHints(transformed);

      const radicalHint = hints.find(h => h.includes('Contains'));
      expect(radicalHint).toBeDefined();
    });

    it('should generate reading type hint', () => {
      const transformed = adapter.transform(mockKanjiContent);
      const hints = adapter.generateHints(transformed);

      const readingHint = hints.find(h => 
        h.includes('on reading') || h.includes('kun reading')
      );
      expect(readingHint).toBeDefined();
    });

    it('should generate first letter hint for meaning', () => {
      const transformed = adapter.transform(mockKanjiContent);
      const hints = adapter.generateHints(transformed);

      const firstLetterHint = hints.find(h => 
        h.includes(`Meaning starts with`)
      );
      expect(firstLetterHint).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should transform content quickly', async () => {
      const { duration } = await TestHelpers.measurePerformance(
        async () => adapter.transform(mockKanjiContent),
        10
      );
      expect(duration).toBeLessThan(10);
    });

    it('should handle large pools efficiently', async () => {
      const largePool = Array.from({ length: 1000 }, () => 
        MockFactory.createKanjiContent()
      );
      const content = adapter.transform(mockKanjiContent);
      
      const { duration } = await TestHelpers.measurePerformance(
        async () => adapter.generateOptions(content, largePool, 4),
        100
      );
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle kanji with no kun readings', () => {
      const onlyOnKanji = MockFactory.createKanjiContent({
        readings: { on: ['オン'], kun: [] }
      });
      
      const result = adapter.transform(onlyOnKanji);
      expect(result.tertiaryDisplay).toBe('kun: (none)');
    });

    it('should handle kanji with no on readings', () => {
      const onlyKunKanji = MockFactory.createKanjiContent({
        readings: { on: [], kun: ['くん'] }
      });
      
      adapter = new KanjiAdapter({
        features: { displayReading: 'on' }
      });
      const result = adapter.transform(onlyKunKanji);
      expect(result.tertiaryDisplay).toBe('on: (none)');
    });

    it('should handle kanji with single meaning', () => {
      const singleMeaning = MockFactory.createKanjiContent({
        meanings: ['only']
      });
      
      const result = adapter.transform(singleMeaning);
      expect(result.secondaryDisplay).toBe('only');
      expect(result.primaryAnswer).toBe('only');
    });

    it('should handle empty pools gracefully', () => {
      const content = adapter.transform(mockKanjiContent);
      const options = adapter.generateOptions(content, [], 4);
      expect(options).toEqual([]);
    });

    it('should handle missing features config', () => {
      const basicAdapter = new KanjiAdapter();
      const result = basicAdapter.transform(mockKanjiContent);
      
      expect(result).toBeDefined();
      expect(result.tertiaryDisplay).toBeDefined();
    });
  });

  describe('Integration', () => {
    it('should work with different kanji complexities', () => {
      const simpleKanji = MockFactory.createKanjiContent({
        character: '一',
        strokes: 1,
        level: 'N5'
      });
      
      const complexKanji = MockFactory.createKanjiContent({
        character: '鬱',
        strokes: 29,
        level: 'N1'
      });
      
      const simpleResult = adapter.transform(simpleKanji);
      const complexResult = adapter.transform(complexKanji);
      
      expect(simpleResult.difficulty).toBeLessThan(complexResult.difficulty);
      expect(simpleResult).toBeDefined();
      expect(complexResult).toBeDefined();
    });
  });
});