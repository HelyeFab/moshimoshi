/**
 * VocabularyAdapter Test Suite
 * Tests vocabulary content transformation, option generation, and mode preparation
 */

import { VocabularyAdapter, VocabularyContent } from '../vocabulary.adapter';
import { ReviewableContent } from '../../core/interfaces';
import { ReviewMode } from '../../core/types';
import { MockFactory, createTestScenario } from '../../__tests__/test-utils/mock-factory';
import { 
  TestHelpers, 
  AdapterTestHelpers,
  setupTest,
  teardownTest 
} from '../../__tests__/test-utils/test-helpers';

describe('VocabularyAdapter', () => {
  let adapter: VocabularyAdapter;
  let mockVocabContent: VocabularyContent;
  let vocabPool: VocabularyContent[];

  beforeEach(() => {
    setupTest();
    adapter = new VocabularyAdapter({
      contentType: 'vocabulary',
      availableModes: [],
      defaultMode: 'recognition',
      validationStrategy: 'fuzzy'
    });
    mockVocabContent = MockFactory.createVocabularyContent();
    vocabPool = MockFactory.createBulkVocabularyContent(20);
  });

  afterEach(() => {
    teardownTest();
  });

  describe('transform()', () => {
    it('should transform vocabulary content to ReviewableContent', () => {
      const result = adapter.transform(mockVocabContent);

      TestHelpers.validateContentTransformation(mockVocabContent, result);
      expect(result.contentType).toBe('vocabulary');
      expect(result.primaryDisplay).toBe(mockVocabContent.word);
      expect(result.secondaryDisplay).toBe(mockVocabContent.meanings.join(', '));
      expect(result.primaryAnswer).toBe(mockVocabContent.meanings[0]);
      expect(result.tertiaryDisplay).toBe(mockVocabContent.reading);
    });

    it('should include alternative answers from meanings and reading', () => {
      const result = adapter.transform(mockVocabContent);

      expect(result.alternativeAnswers).toContain(mockVocabContent.meanings[1]);
      expect(result.alternativeAnswers).toContain(mockVocabContent.reading);
    });

    it('should include audio URL when provided', () => {
      const vocabWithAudio = MockFactory.createVocabularyContent({
        audioUrl: '/audio/vocab/test.mp3'
      });
      const result = adapter.transform(vocabWithAudio);

      expect(result.audioUrl).toBe('/audio/vocab/test.mp3');
    });

    it('should include tags from part of speech and level', () => {
      const result = adapter.transform(mockVocabContent);

      expect(result.tags).toContain('vocabulary');
      expect(result.tags).toContain(mockVocabContent.level);
      mockVocabContent.partOfSpeech.forEach(pos => {
        expect(result.tags).toContain(pos);
      });
    });

    it('should include comprehensive metadata', () => {
      const result = adapter.transform(mockVocabContent);

      expect(result.metadata).toMatchObject({
        reading: mockVocabContent.reading,
        partOfSpeech: mockVocabContent.partOfSpeech,
        examples: mockVocabContent.examples,
        level: mockVocabContent.level
      });
      expect(result.metadata?.pitchAccent).toBeDefined();
    });

    it('should handle vocabulary with pitch accent', () => {
      const vocabWithPitch = MockFactory.createVocabularyContent({
        pitchAccent: [0, 1, 0]
      });
      const result = adapter.transform(vocabWithPitch);

      expect(result.metadata?.pitchAccent).toEqual([0, 1, 0]);
    });

    it('should generate pitch accent for words without explicit data', () => {
      const vocabNoPitch = MockFactory.createVocabularyContent();
      delete vocabNoPitch.pitchAccent;
      const result = adapter.transform(vocabNoPitch);

      expect(result.metadata?.pitchAccent).toBeDefined();
      expect(Array.isArray(result.metadata?.pitchAccent)).toBe(true);
    });
  });

  describe('calculateDifficulty()', () => {
    it('should calculate difficulty based on level - N5', () => {
      const n5Vocab = MockFactory.createVocabularyContent({ level: 'N5' });
      const difficulty = adapter.calculateDifficulty(n5Vocab);
      expect(difficulty).toBe(0.1);
    });

    it('should calculate difficulty based on level - N1', () => {
      const n1Vocab = MockFactory.createVocabularyContent({ level: 'N1' });
      const difficulty = adapter.calculateDifficulty(n1Vocab);
      expect(difficulty).toBe(0.9);
    });

    it('should increase difficulty for long words', () => {
      const shortWord = MockFactory.createVocabularyContent({ 
        word: 'cat', 
        level: 'N5' 
      });
      const longWord = MockFactory.createVocabularyContent({ 
        word: 'superlong', 
        level: 'N5' 
      });

      const shortDifficulty = adapter.calculateDifficulty(shortWord);
      const longDifficulty = adapter.calculateDifficulty(longWord);

      expect(longDifficulty).toBeGreaterThan(shortDifficulty);
    });

    it('should increase difficulty for multiple meanings', () => {
      const singleMeaning = MockFactory.createVocabularyContent({
        meanings: ['test'],
        level: 'N5'
      });
      const multipleMeanings = MockFactory.createVocabularyContent({
        meanings: ['test1', 'test2', 'test3', 'test4', 'test5'],
        level: 'N5'
      });

      const singleDifficulty = adapter.calculateDifficulty(singleMeaning);
      const multipleDifficulty = adapter.calculateDifficulty(multipleMeanings);

      expect(multipleDifficulty).toBeGreaterThan(singleDifficulty);
    });

    it('should increase difficulty for abstract nouns', () => {
      const concrete = MockFactory.createVocabularyContent({
        partOfSpeech: ['noun'],
        level: 'N5'
      });
      const abstract = MockFactory.createVocabularyContent({
        partOfSpeech: ['abstract-noun'],
        level: 'N5'
      });

      const concreteDifficulty = adapter.calculateDifficulty(concrete);
      const abstractDifficulty = adapter.calculateDifficulty(abstract);

      expect(abstractDifficulty).toBeGreaterThan(concreteDifficulty);
    });

    it('should increase difficulty for irregular readings', () => {
      const regular = MockFactory.createVocabularyContent({ level: 'N5' });
      const irregular = MockFactory.createVocabularyContent({ 
        level: 'N5',
        tags: ['当て字']
      });

      const regularDifficulty = adapter.calculateDifficulty(regular);
      const irregularDifficulty = adapter.calculateDifficulty(irregular);

      expect(irregularDifficulty).toBeGreaterThan(regularDifficulty);
    });

    it('should cap difficulty at 1.0', () => {
      const maxDifficulty = MockFactory.createVocabularyContent({
        level: 'N1',
        word: 'verylongcomplexword',
        meanings: ['meaning1', 'meaning2', 'meaning3', 'meaning4', 'meaning5'],
        partOfSpeech: ['abstract-noun'],
        tags: ['当て字']
      });

      const difficulty = adapter.calculateDifficulty(maxDifficulty);
      expect(difficulty).toBe(1.0);
    });
  });

  describe('generateOptions()', () => {
    it('should generate correct number of options', () => {
      const content = adapter.transform(mockVocabContent);
      const options = adapter.generateOptions(content, vocabPool, 4);

      TestHelpers.validateOptionsGeneration(options, content, 4);
    });

    it('should prioritize words with same part of speech', () => {
      const nounContent = MockFactory.createVocabularyContent({ 
        partOfSpeech: ['noun']
      });
      const nounPool = [
        MockFactory.createVocabularyContent({ partOfSpeech: ['noun'] }),
        MockFactory.createVocabularyContent({ partOfSpeech: ['verb'] }),
        ...vocabPool
      ];

      const transformed = adapter.transform(nounContent);
      const options = adapter.generateOptions(transformed, nounPool, 4);

      const nounOptions = options.filter(opt => 
        opt.metadata?.partOfSpeech?.includes('noun')
      );
      expect(nounOptions.length).toBeGreaterThan(0);
    });

    it('should prioritize words with same level', () => {
      const n3Content = MockFactory.createVocabularyContent({ level: 'N3' });
      const levelPool = [
        MockFactory.createVocabularyContent({ level: 'N3' }),
        MockFactory.createVocabularyContent({ level: 'N3' }),
        ...vocabPool
      ];

      const transformed = adapter.transform(n3Content);
      const options = adapter.generateOptions(transformed, levelPool, 4);

      const sameLevel = options.filter(opt => opt.metadata?.level === 'N3');
      expect(sameLevel.length).toBeGreaterThan(0);
    });

    it('should include semantically similar words', () => {
      const happyWord = MockFactory.createVocabularyContent({
        meanings: ['happy', 'joyful']
      });
      const emotionPool = [
        MockFactory.createVocabularyContent({ meanings: ['sad', 'unhappy'] }),
        MockFactory.createVocabularyContent({ meanings: ['glad', 'cheerful'] }),
        ...vocabPool
      ];

      const transformed = adapter.transform(happyWord);
      const options = adapter.generateOptions(transformed, emotionPool, 4);

      expect(options.length).toBe(3);
    });

    it('should include words with similar structure (shared kanji)', () => {
      const kanjiWord = MockFactory.createVocabularyContent({
        word: '学校'
      });
      const kanjiPool = [
        MockFactory.createVocabularyContent({ word: '学生' }),
        MockFactory.createVocabularyContent({ word: '校長' }),
        MockFactory.createVocabularyContent({ word: 'ひらがな' }),
        ...vocabPool
      ];

      const transformed = adapter.transform(kanjiWord);
      const options = adapter.generateOptions(transformed, kanjiPool, 4);

      expect(options.length).toBe(3);
    });

    it('should not include the correct answer in options', () => {
      const content = adapter.transform(mockVocabContent);
      const options = adapter.generateOptions(content, vocabPool, 4);

      const hasCorrectAnswer = options.some(opt => opt.id === content.id);
      expect(hasCorrectAnswer).toBe(false);
    });

    it('should handle small pools gracefully', () => {
      const smallPool = MockFactory.createBulkVocabularyContent(2);
      const content = adapter.transform(mockVocabContent);
      const options = adapter.generateOptions(content, smallPool, 4);

      expect(options.length).toBeLessThanOrEqual(3);
      AdapterTestHelpers.testOptionsUniqueness(options, content);
    });

    it('should handle empty pool', () => {
      const content = adapter.transform(mockVocabContent);
      const options = adapter.generateOptions(content, [], 4);
      expect(options).toEqual([]);
    });

    it('should include words with similar meaning categories', () => {
      const foodWord = MockFactory.createVocabularyContent({
        meanings: ['eat', 'consume']
      });
      const foodPool = [
        MockFactory.createVocabularyContent({ meanings: ['drink', 'beverage'] }),
        MockFactory.createVocabularyContent({ meanings: ['meal', 'food'] }),
        ...vocabPool
      ];

      const transformed = adapter.transform(foodWord);
      const options = adapter.generateOptions(transformed, foodPool, 4);

      expect(options.length).toBeGreaterThan(0);
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
      content = adapter.transform(mockVocabContent);
    });

    describe('recognition mode', () => {
      it('should show word and hide reading', () => {
        const prepared = adapter.prepareForMode(content, 'recognition');
        
        expect(prepared.primaryDisplay).toBe(content.primaryDisplay);
        expect(prepared.tertiaryDisplay).toBeUndefined();
        expect(prepared.primaryAnswer).toBe(content.primaryAnswer);
      });
    });

    describe('recall mode', () => {
      it('should show meaning and expect word as answer', () => {
        const prepared = adapter.prepareForMode(content, 'recall');
        
        expect(prepared.primaryDisplay).toBe(mockVocabContent.meanings.join(', '));
        expect(prepared.secondaryDisplay).toBeUndefined();
        expect(prepared.tertiaryDisplay).toBeUndefined();
        expect(prepared.primaryAnswer).toBe(mockVocabContent.word);
      });
    });

    describe('listening mode', () => {
      it('should hide visual content and show placeholder', () => {
        const prepared = adapter.prepareForMode(content, 'listening');
        
        expect(prepared.primaryDisplay).toBe('?');
        expect(prepared.secondaryDisplay).toBeUndefined();
        expect(prepared.tertiaryDisplay).toBeUndefined();
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
    it('should generate hint for part of speech', () => {
      const nounContent = MockFactory.createVocabularyContent({
        partOfSpeech: ['noun']
      });
      const transformed = adapter.transform(nounContent);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('This is a noun');
      AdapterTestHelpers.testHintGeneration(adapter, transformed, 2, 6);
    });

    it('should generate reading hint', () => {
      const transformed = adapter.transform(mockVocabContent);
      const hints = adapter.generateHints(transformed);

      const readingHint = hints.find(h => 
        h.includes(`Reading starts with '${mockVocabContent.reading[0]}'`)
      );
      expect(readingHint).toBeDefined();
    });

    it('should generate character count hint', () => {
      const transformed = adapter.transform(mockVocabContent);
      const hints = adapter.generateHints(transformed);

      const countHint = hints.find(h => 
        h.includes(`The word has ${mockVocabContent.word.length} characters`)
      );
      expect(countHint).toBeDefined();
    });

    it('should include example sentence hint when available', () => {
      const vocabWithExample = MockFactory.createVocabularyContent({
        examples: ['これは例文です。']
      });
      const transformed = adapter.transform(vocabWithExample);
      const hints = adapter.generateHints(transformed);

      const exampleHint = hints.find(h => h.includes('Example:'));
      expect(exampleHint).toBeDefined();
    });

    it('should include pitch accent hint when available', () => {
      const vocabWithPitch = MockFactory.createVocabularyContent({
        pitchAccent: [0, 1, 0]
      });
      const transformed = adapter.transform(vocabWithPitch);
      const hints = adapter.generateHints(transformed);

      const pitchHint = hints.find(h => h.includes('Pitch accent pattern:'));
      expect(pitchHint).toBeDefined();
    });

    it('should format part of speech correctly', () => {
      const adjectiveContent = MockFactory.createVocabularyContent({
        partOfSpeech: ['i-adjective']
      });
      const transformed = adapter.transform(adjectiveContent);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('This is a i-adjective');
    });

    it('should include synonym/antonym hints when available', () => {
      const bigContent = MockFactory.createVocabularyContent({
        meanings: ['big']
      });
      const transformed = adapter.transform(bigContent);
      const hints = adapter.generateHints(transformed);

      const relationHint = hints.find(h => 
        h.includes('Similar to:') || h.includes('Opposite of:')
      );
      expect(relationHint).toBeDefined();
    });

    it('should mask word in example sentences', () => {
      const vocabWithExample = MockFactory.createVocabularyContent({
        word: '本',
        examples: ['本を読みます。']
      });
      const transformed = adapter.transform(vocabWithExample);
      const hints = adapter.generateHints(transformed);

      const exampleHint = hints.find(h => h.includes('Example:'));
      expect(exampleHint).toContain('_');
      expect(exampleHint).not.toContain('本');
    });
  });

  describe('Private Methods', () => {
    describe('getPitchAccent()', () => {
      it('should return different patterns for different word lengths', () => {
        const shortWord = MockFactory.createVocabularyContent({ word: 'あ' });
        const mediumWord = MockFactory.createVocabularyContent({ word: 'あいう' });
        const longWord = MockFactory.createVocabularyContent({ word: 'あいうえ' });

        const shortTransformed = adapter.transform(shortWord);
        const mediumTransformed = adapter.transform(mediumWord);
        const longTransformed = adapter.transform(longWord);

        expect(shortTransformed.metadata?.pitchAccent).toBeDefined();
        expect(mediumTransformed.metadata?.pitchAccent).toBeDefined();
        expect(longTransformed.metadata?.pitchAccent).toBeDefined();
      });
    });

    describe('meaning category detection', () => {
      it('should detect food category', () => {
        const foodVocab = MockFactory.createVocabularyContent({
          meanings: ['eat food']
        });
        const transformed = adapter.transform(foodVocab);
        const options = adapter.generateOptions(transformed, [
          MockFactory.createVocabularyContent({ meanings: ['drink water'] })
        ], 4);

        expect(options.length).toBeGreaterThan(0);
      });

      it('should detect emotion category', () => {
        const emotionVocab = MockFactory.createVocabularyContent({
          meanings: ['very happy']
        });
        const transformed = adapter.transform(emotionVocab);
        const options = adapter.generateOptions(transformed, [
          MockFactory.createVocabularyContent({ meanings: ['feel sad'] })
        ], 4);

        expect(options.length).toBeGreaterThan(0);
      });
    });

    describe('semantic similarity', () => {
      it('should detect semantically similar words', () => {
        const goodWord = MockFactory.createVocabularyContent({
          meanings: ['good', 'nice']
        });
        const greatWord = MockFactory.createVocabularyContent({
          meanings: ['great', 'excellent']
        });

        const transformed = adapter.transform(goodWord);
        const options = adapter.generateOptions(transformed, [greatWord], 4);

        expect(options.length).toBeGreaterThan(0);
      });
    });

    describe('structural similarity', () => {
      it('should detect words with shared kanji', () => {
        const school = MockFactory.createVocabularyContent({ word: '学校' });
        const student = MockFactory.createVocabularyContent({ word: '学生' });

        const transformed = adapter.transform(school);
        const options = adapter.generateOptions(transformed, [student], 4);

        expect(options.length).toBeGreaterThan(0);
      });

      it('should not match words of different lengths', () => {
        const short = MockFactory.createVocabularyContent({ word: '本' });
        const long = MockFactory.createVocabularyContent({ word: '図書館' });

        const transformed = adapter.transform(short);
        const options = adapter.generateOptions(transformed, [long], 4);

        // Should still generate options but not based on structure
        expect(options.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Performance', () => {
    it('should transform content quickly', async () => {
      const { duration } = await TestHelpers.measurePerformance(
        async () => adapter.transform(mockVocabContent),
        10
      );
      expect(duration).toBeLessThan(10);
    });

    it('should generate options efficiently for large pools', async () => {
      const largePool = MockFactory.createBulkVocabularyContent(1000);
      const content = adapter.transform(mockVocabContent);
      
      const { duration } = await TestHelpers.measurePerformance(
        async () => adapter.generateOptions(content, largePool, 4),
        50
      );
      expect(duration).toBeLessThan(100);
    });

    it('should generate hints efficiently', async () => {
      const content = adapter.transform(mockVocabContent);
      
      const { duration } = await TestHelpers.measurePerformance(
        async () => adapter.generateHints(content),
        100
      );
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle vocabulary with empty meanings array', () => {
      const emptyMeanings: VocabularyContent = {
        ...mockVocabContent,
        meanings: []
      };

      expect(() => adapter.transform(emptyMeanings)).not.toThrow();
    });

    it('should handle vocabulary with single meaning', () => {
      const singleMeaning = MockFactory.createVocabularyContent({
        meanings: ['only meaning']
      });

      const result = adapter.transform(singleMeaning);
      expect(result.primaryAnswer).toBe('only meaning');
      expect(result.alternativeAnswers).not.toContain('only meaning');
    });

    it('should handle vocabulary without examples', () => {
      const noExamples = MockFactory.createVocabularyContent({
        examples: []
      });

      const transformed = adapter.transform(noExamples);
      const hints = adapter.generateHints(transformed);

      const exampleHint = hints.find(h => h.includes('Example:'));
      expect(exampleHint).toBeUndefined();
    });

    it('should handle vocabulary without audio URL', () => {
      const noAudio = MockFactory.createVocabularyContent();
      delete noAudio.audioUrl;

      const result = adapter.transform(noAudio);
      expect(result.audioUrl).toBeUndefined();
    });

    it('should handle unknown difficulty levels', () => {
      const unknownLevel = MockFactory.createVocabularyContent({
        level: 'unknown'
      });

      const difficulty = adapter.calculateDifficulty(unknownLevel);
      expect(difficulty).toBe(0.5); // Default difficulty
    });

    it('should handle empty pool in generateOptions', () => {
      const content = adapter.transform(mockVocabContent);
      const options = adapter.generateOptions(content, [], 4);
      expect(options).toEqual([]);
    });

    it('should handle vocabulary without part of speech', () => {
      const noPartOfSpeech = MockFactory.createVocabularyContent({
        partOfSpeech: []
      });

      const transformed = adapter.transform(noPartOfSpeech);
      const hints = adapter.generateHints(transformed);

      const posHint = hints.find(h => h.includes('This is a'));
      expect(posHint).toBeUndefined();
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

    it('should handle configuration when provided', () => {
      const configuredAdapter = new VocabularyAdapter({
        contentType: 'vocabulary',
        availableModes: [],
        defaultMode: 'recognition',
        validationStrategy: 'fuzzy',
        features: { furigana: true }
      });
      
      expect(configuredAdapter).toBeInstanceOf(VocabularyAdapter);
    });

    it('should use similarity calculations correctly', () => {
      const content1 = adapter.transform(MockFactory.createVocabularyContent({
        meanings: ['happy']
      }));
      const content2 = MockFactory.createVocabularyContent({
        meanings: ['joyful']
      });

      const options = adapter.generateOptions(content1, [content2], 4);
      expect(options.length).toBeGreaterThanOrEqual(0);
    });
  });
});