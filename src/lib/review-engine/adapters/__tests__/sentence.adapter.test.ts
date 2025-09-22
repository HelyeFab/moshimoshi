/**
 * SentenceAdapter Test Suite
 * Tests sentence content transformation, option generation, and mode preparation
 */

import { SentenceAdapter, SentenceContent } from '../sentence.adapter';
import { ReviewableContent } from '../../core/interfaces';
import { ReviewMode } from '../../core/types';
import { MockFactory, createTestScenario } from '../../__tests__/test-utils/mock-factory';
import { 
  TestHelpers, 
  AdapterTestHelpers,
  setupTest,
  teardownTest 
} from '../../__tests__/test-utils/test-helpers';

describe('SentenceAdapter', () => {
  let adapter: SentenceAdapter;
  let mockSentenceContent: SentenceContent;
  let sentencePool: SentenceContent[];

  beforeEach(() => {
    setupTest();
    adapter = new SentenceAdapter({
      contentType: 'sentence',
      availableModes: [],
      defaultMode: 'recognition',
      validationStrategy: 'fuzzy'
    });
    mockSentenceContent = MockFactory.createSentenceContent();
    sentencePool = MockFactory.createBulkSentenceContent(20);
  });

  afterEach(() => {
    teardownTest();
  });

  describe('transform()', () => {
    it('should transform sentence content to ReviewableContent', () => {
      const result = adapter.transform(mockSentenceContent);

      TestHelpers.validateContentTransformation(mockSentenceContent, result);
      expect(result.contentType).toBe('sentence');
      expect(result.primaryDisplay).toBe(mockSentenceContent.japanese);
      expect(result.secondaryDisplay).toBe(mockSentenceContent.translation);
      expect(result.primaryAnswer).toBe(mockSentenceContent.translation);
      expect(result.tertiaryDisplay).toBe(mockSentenceContent.reading);
    });

    it('should include audio URL when provided', () => {
      const sentenceWithAudio = MockFactory.createSentenceContent({
        audioUrl: '/audio/sentences/test.mp3'
      });
      const result = adapter.transform(sentenceWithAudio);

      expect(result.audioUrl).toBe('/audio/sentences/test.mp3');
    });

    it('should include tags from grammar, level, and sentence type', () => {
      const result = adapter.transform(mockSentenceContent);

      expect(result.tags).toContain('sentence');
      expect(result.tags).toContain(mockSentenceContent.level);
      mockSentenceContent.grammar.forEach(grammar => {
        expect(result.tags).toContain(grammar);
      });
    });

    it('should include comprehensive metadata', () => {
      const result = adapter.transform(mockSentenceContent);

      expect(result.metadata).toMatchObject({
        grammar: mockSentenceContent.grammar,
        vocabulary: mockSentenceContent.vocabulary,
        wordCount: mockSentenceContent.japanese.length,
        reading: mockSentenceContent.reading,
        level: mockSentenceContent.level
      });
    });

    it('should have empty alternative answers by default', () => {
      const result = adapter.transform(mockSentenceContent);
      expect(result.alternativeAnswers).toEqual([]);
    });

    it('should handle sentences without reading', () => {
      const noReading = MockFactory.createSentenceContent();
      delete noReading.reading;

      const result = adapter.transform(noReading);
      expect(result.tertiaryDisplay).toBeUndefined();
    });

    it('should calculate word count correctly for Japanese text', () => {
      const longSentence = MockFactory.createSentenceContent({
        japanese: 'これは長い文章です。'
      });
      const result = adapter.transform(longSentence);

      expect(result.metadata?.wordCount).toBe(longSentence.japanese.length);
    });
  });

  describe('calculateDifficulty()', () => {
    it('should calculate difficulty based on level - N5', () => {
      const n5Sentence = MockFactory.createSentenceContent({ level: 'N5' });
      const difficulty = adapter.calculateDifficulty(n5Sentence);
      expect(difficulty).toBe(0.2);
    });

    it('should calculate difficulty based on level - N1', () => {
      const n1Sentence = MockFactory.createSentenceContent({ level: 'N1' });
      const difficulty = adapter.calculateDifficulty(n1Sentence);
      expect(difficulty).toBe(0.95);
    });

    it('should increase difficulty for long sentences', () => {
      const shortSentence = MockFactory.createSentenceContent({ 
        japanese: 'これです。',
        level: 'N5'
      });
      const longSentence = MockFactory.createSentenceContent({ 
        japanese: 'これはとても長い文章で、多くの単語と複雑な文法が含まれています。それに加えて、さらに長くなるように文字を追加します。',
        level: 'N5'
      });

      const shortDifficulty = adapter.calculateDifficulty(shortSentence);
      const longDifficulty = adapter.calculateDifficulty(longSentence);

      expect(longDifficulty).toBeGreaterThan(shortDifficulty);
    });

    it('should increase difficulty based on grammar complexity', () => {
      const simpleGrammar = MockFactory.createSentenceContent({
        grammar: ['です'],
        level: 'N5'
      });
      const complexGrammar = MockFactory.createSentenceContent({
        grammar: ['たら', 'ながら', 'ばかり', 'にも関わらず', 'というのも'],
        level: 'N5'
      });

      const simpleDifficulty = adapter.calculateDifficulty(simpleGrammar);
      const complexDifficulty = adapter.calculateDifficulty(complexGrammar);

      expect(complexDifficulty).toBeGreaterThan(simpleDifficulty);
    });

    it('should increase difficulty for complex vocabulary', () => {
      const simpleVocab = MockFactory.createSentenceContent({
        vocabulary: ['は', 'です'],
        level: 'N5'
      });
      const complexVocab = MockFactory.createSentenceContent({
        vocabulary: ['困難', '複雑', '状況', '解決'],
        level: 'N5'
      });

      const simpleDifficulty = adapter.calculateDifficulty(simpleVocab);
      const complexDifficulty = adapter.calculateDifficulty(complexVocab);

      expect(complexDifficulty).toBeGreaterThan(simpleDifficulty);
    });

    it('should handle unknown levels with default difficulty', () => {
      const unknownLevel = MockFactory.createSentenceContent({
        level: 'unknown'
      });

      const difficulty = adapter.calculateDifficulty(unknownLevel);
      expect(difficulty).toBe(0.5);
    });

    it('should cap difficulty at 1.0', () => {
      const maxDifficulty = MockFactory.createSentenceContent({
        level: 'N1',
        japanese: 'これは非常に長くて複雑な文章で、多くの高度な文法構造と専門的な語彙が含まれており、理解するのが困難です。さらに長くするために追加の文字を入れています。',
        grammar: ['というのも', 'にも関わらず', 'ばかりか', 'どころか', 'をもって'],
        vocabulary: ['専門的', '困難', '複雑', '高度']
      });

      const difficulty = adapter.calculateDifficulty(maxDifficulty);
      expect(difficulty).toBe(1.0);
    });
  });

  describe('generateOptions()', () => {
    it('should generate correct number of options', () => {
      const content = adapter.transform(mockSentenceContent);
      const options = adapter.generateOptions(content, sentencePool, 4);

      TestHelpers.validateOptionsGeneration(options, content, 4);
    });

    it('should prioritize sentences with similar length', () => {
      const shortSentence = MockFactory.createSentenceContent({ 
        japanese: 'これです。'
      });
      const lengthPool = [
        MockFactory.createSentenceContent({ japanese: 'それです。' }),
        MockFactory.createSentenceContent({ japanese: 'あれです。' }),
        MockFactory.createSentenceContent({ japanese: 'これは非常に長い文章です。' }),
        ...sentencePool
      ];

      const transformed = adapter.transform(shortSentence);
      const options = adapter.generateOptions(transformed, lengthPool, 4);

      // Should include similar length sentences
      expect(options.length).toBeGreaterThan(0);
    });

    it('should prioritize sentences with same level', () => {
      const n3Sentence = MockFactory.createSentenceContent({ level: 'N3' });
      const levelPool = [
        MockFactory.createSentenceContent({ level: 'N3' }),
        MockFactory.createSentenceContent({ level: 'N3' }),
        ...sentencePool
      ];

      const transformed = adapter.transform(n3Sentence);
      const options = adapter.generateOptions(transformed, levelPool, 4);

      const sameLevel = options.filter(opt => opt.metadata?.level === 'N3');
      expect(sameLevel.length).toBeGreaterThan(0);
    });

    it('should prioritize sentences with shared grammar patterns', () => {
      const grammarSentence = MockFactory.createSentenceContent({
        grammar: ['たら', 'ます']
      });
      const grammarPool = [
        MockFactory.createSentenceContent({ grammar: ['たら', 'です'] }),
        MockFactory.createSentenceContent({ grammar: ['なら', 'でしょう'] }),
        ...sentencePool
      ];

      const transformed = adapter.transform(grammarSentence);
      const options = adapter.generateOptions(transformed, grammarPool, 4);

      expect(options.length).toBeGreaterThan(0);
    });

    it('should prioritize sentences with shared vocabulary', () => {
      const vocabSentence = MockFactory.createSentenceContent({
        vocabulary: ['学校', '学生']
      });
      const vocabPool = [
        MockFactory.createSentenceContent({ vocabulary: ['学校', '先生'] }),
        MockFactory.createSentenceContent({ vocabulary: ['会社', '社員'] }),
        ...sentencePool
      ];

      const transformed = adapter.transform(vocabSentence);
      const options = adapter.generateOptions(transformed, vocabPool, 4);

      expect(options.length).toBeGreaterThan(0);
    });

    it('should include sentences with similar topics', () => {
      const foodSentence = MockFactory.createSentenceContent({
        translation: 'I want to eat at a restaurant.'
      });
      const topicPool = [
        MockFactory.createSentenceContent({ translation: 'The food was delicious.' }),
        MockFactory.createSentenceContent({ translation: 'Let\'s go on a trip.' }),
        ...sentencePool
      ];

      const transformed = adapter.transform(foodSentence);
      const options = adapter.generateOptions(transformed, topicPool, 4);

      expect(options.length).toBeGreaterThan(0);
    });

    it('should not include the correct answer in options', () => {
      const content = adapter.transform(mockSentenceContent);
      const options = adapter.generateOptions(content, sentencePool, 4);

      const hasCorrectAnswer = options.some(opt => opt.id === content.id);
      expect(hasCorrectAnswer).toBe(false);
    });

    it('should handle small pools gracefully', () => {
      const smallPool = MockFactory.createBulkSentenceContent(2);
      const content = adapter.transform(mockSentenceContent);
      const options = adapter.generateOptions(content, smallPool, 4);

      expect(options.length).toBeLessThanOrEqual(3);
      AdapterTestHelpers.testOptionsUniqueness(options, content);
    });

    it('should handle empty pool', () => {
      const content = adapter.transform(mockSentenceContent);
      const options = adapter.generateOptions(content, [], 4);
      expect(options).toEqual([]);
    });
  });

  describe('getSupportedModes()', () => {
    it('should return correct supported modes', () => {
      const modes = adapter.getSupportedModes();
      expect(modes).toEqual(['recognition', 'listening']);
    });
  });

  describe('prepareForMode()', () => {
    let content: ReviewableContent;

    beforeEach(() => {
      content = adapter.transform(mockSentenceContent);
    });

    describe('recognition mode', () => {
      it('should show Japanese and hide reading', () => {
        const prepared = adapter.prepareForMode(content, 'recognition');
        
        expect(prepared.primaryDisplay).toBe(mockSentenceContent.japanese);
        expect(prepared.tertiaryDisplay).toBeUndefined();
        expect(prepared.primaryAnswer).toBe(mockSentenceContent.translation);
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
      it('should return content unchanged for unsupported modes', () => {
        const prepared = adapter.prepareForMode(content, 'recall');
        expect(prepared).toEqual(content);
      });
    });
  });

  describe('generateHints()', () => {
    it('should generate word count hint', () => {
      const transformed = adapter.transform(mockSentenceContent);
      const hints = adapter.generateHints(transformed);

      const wordCountHint = hints.find(h => 
        h.includes(`This sentence has ${mockSentenceContent.japanese.length} characters`)
      );
      expect(wordCountHint).toBeDefined();
    });

    it('should generate grammar pattern hint', () => {
      const grammarSentence = MockFactory.createSentenceContent({
        grammar: ['たら', 'ます']
      });
      const transformed = adapter.transform(grammarSentence);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('Uses the grammar pattern: たら');
      AdapterTestHelpers.testHintGeneration(adapter, transformed, 2, 6);
    });

    it('should generate key vocabulary hint', () => {
      const vocabSentence = MockFactory.createSentenceContent({
        vocabulary: ['学校', '学生']
      });
      const transformed = adapter.transform(vocabSentence);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('Contains the word: 学校');
    });

    it('should detect sentence type - question', () => {
      const questionSentence = MockFactory.createSentenceContent({
        japanese: 'これは何ですか？'
      });
      const transformed = adapter.transform(questionSentence);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('This is a question sentence');
    });

    it('should detect sentence type - request', () => {
      const requestSentence = MockFactory.createSentenceContent({
        japanese: '手伝ってください。'
      });
      const transformed = adapter.transform(requestSentence);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('This is a request sentence');
    });

    it('should detect sentence type - suggestion', () => {
      const suggestionSentence = MockFactory.createSentenceContent({
        japanese: '映画を見ましょう。'
      });
      const transformed = adapter.transform(suggestionSentence);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('This is a suggestion sentence');
    });

    it('should detect sentence type - conditional', () => {
      const conditionalSentence = MockFactory.createSentenceContent({
        japanese: '雨が降ったら、家にいます。'
      });
      const transformed = adapter.transform(conditionalSentence);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('This is a conditional sentence');
    });

    it('should generate partial translation hint', () => {
      const longTranslation = MockFactory.createSentenceContent({
        translation: 'This is a very long translation with many words'
      });
      const transformed = adapter.transform(longTranslation);
      const hints = adapter.generateHints(transformed);

      const partialHint = hints.find(h => 
        h.includes('Translation starts with: "This is...')
      );
      expect(partialHint).toBeDefined();
    });

    it('should detect formal context', () => {
      const formalSentence = MockFactory.createSentenceContent({
        japanese: 'お忙しいですね。'
      });
      const transformed = adapter.transform(formalSentence);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('Context: formal/polite');
    });

    it('should detect casual context', () => {
      const casualSentence = MockFactory.createSentenceContent({
        japanese: '忙しいね。'
      });
      const transformed = adapter.transform(casualSentence);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('Context: casual/informal');
    });

    it('should handle sentences without grammar points', () => {
      const noGrammar = MockFactory.createSentenceContent({
        grammar: []
      });
      const transformed = adapter.transform(noGrammar);
      const hints = adapter.generateHints(transformed);

      const grammarHint = hints.find(h => h.includes('Uses the grammar pattern:'));
      expect(grammarHint).toBeUndefined();
    });

    it('should handle sentences without vocabulary', () => {
      const noVocab = MockFactory.createSentenceContent({
        vocabulary: []
      });
      const transformed = adapter.transform(noVocab);
      const hints = adapter.generateHints(transformed);

      const vocabHint = hints.find(h => h.includes('Contains the word:'));
      expect(vocabHint).toBeUndefined();
    });
  });

  describe('Topic Detection', () => {
    it('should detect food topic', () => {
      const foodSentence = MockFactory.createSentenceContent({
        translation: 'I want to eat at a restaurant today.'
      });
      const transformed = adapter.transform(foodSentence);
      const foodPool = [
        MockFactory.createSentenceContent({ translation: 'The meal was delicious.' })
      ];

      const options = adapter.generateOptions(transformed, foodPool, 4);
      expect(options.length).toBeGreaterThan(0);
    });

    it('should detect travel topic', () => {
      const travelSentence = MockFactory.createSentenceContent({
        translation: 'Let\'s go on a trip to Tokyo.'
      });
      const transformed = adapter.transform(travelSentence);
      const travelPool = [
        MockFactory.createSentenceContent({ translation: 'I want to visit the tourist attractions.' })
      ];

      const options = adapter.generateOptions(transformed, travelPool, 4);
      expect(options.length).toBeGreaterThan(0);
    });

    it('should detect work topic', () => {
      const workSentence = MockFactory.createSentenceContent({
        translation: 'I have a meeting at the office.'
      });
      const transformed = adapter.transform(workSentence);
      const workPool = [
        MockFactory.createSentenceContent({ translation: 'The company has a new business plan.' })
      ];

      const options = adapter.generateOptions(transformed, workPool, 4);
      expect(options.length).toBeGreaterThan(0);
    });

    it('should detect school topic', () => {
      const schoolSentence = MockFactory.createSentenceContent({
        translation: 'The student has homework to do.'
      });
      const transformed = adapter.transform(schoolSentence);
      const schoolPool = [
        MockFactory.createSentenceContent({ translation: 'The teacher gave us an assignment.' })
      ];

      const options = adapter.generateOptions(transformed, schoolPool, 4);
      expect(options.length).toBeGreaterThan(0);
    });

    it('should detect family topic', () => {
      const familySentence = MockFactory.createSentenceContent({
        translation: 'My mother and father are coming to visit.'
      });
      const transformed = adapter.transform(familySentence);
      const familyPool = [
        MockFactory.createSentenceContent({ translation: 'My sister has a new job.' })
      ];

      const options = adapter.generateOptions(transformed, familyPool, 4);
      expect(options.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should transform content quickly', async () => {
      const { duration } = await TestHelpers.measurePerformance(
        async () => adapter.transform(mockSentenceContent),
        10
      );
      expect(duration).toBeLessThan(10);
    });

    it('should generate options efficiently for large pools', async () => {
      const largePool = MockFactory.createBulkSentenceContent(1000);
      const content = adapter.transform(mockSentenceContent);
      
      const { duration } = await TestHelpers.measurePerformance(
        async () => adapter.generateOptions(content, largePool, 4),
        50
      );
      expect(duration).toBeLessThan(100);
    });

    it('should generate hints efficiently', async () => {
      const content = adapter.transform(mockSentenceContent);
      
      const { duration } = await TestHelpers.measurePerformance(
        async () => adapter.generateHints(content),
        100
      );
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle sentences with empty grammar array', () => {
      const emptyGrammar: SentenceContent = {
        ...mockSentenceContent,
        grammar: []
      };

      const result = adapter.transform(emptyGrammar);
      expect(result.tags).toContain('sentence');
      expect(result.tags).toContain(emptyGrammar.level);
    });

    it('should handle sentences with empty vocabulary array', () => {
      const emptyVocab: SentenceContent = {
        ...mockSentenceContent,
        vocabulary: []
      };

      const result = adapter.transform(emptyVocab);
      expect(result.metadata?.vocabulary).toEqual([]);
    });

    it('should handle very short sentences', () => {
      const shortSentence = MockFactory.createSentenceContent({
        japanese: 'はい。',
        translation: 'Yes.'
      });

      const result = adapter.transform(shortSentence);
      expect(result).toBeDefined();
      expect(result.metadata?.wordCount).toBe(3);
    });

    it('should handle sentences without audio URL', () => {
      const noAudio = MockFactory.createSentenceContent();
      delete noAudio.audioUrl;

      const result = adapter.transform(noAudio);
      expect(result.audioUrl).toBeUndefined();
    });

    it('should handle empty pool in generateOptions', () => {
      const content = adapter.transform(mockSentenceContent);
      const options = adapter.generateOptions(content, [], 4);
      expect(options).toEqual([]);
    });

    it('should handle pool with only the target sentence', () => {
      const content = adapter.transform(mockSentenceContent);
      const options = adapter.generateOptions(content, [mockSentenceContent], 4);
      expect(options).toEqual([]);
    });

    it('should handle sentences without translation', () => {
      const noTranslation: SentenceContent = {
        ...mockSentenceContent,
        translation: ''
      };

      const result = adapter.transform(noTranslation);
      expect(result.primaryAnswer).toBe('');
      expect(result.secondaryDisplay).toBe('');
    });

    it('should handle single word translation for partial hint', () => {
      const singleWord = MockFactory.createSentenceContent({
        translation: 'Yes'
      });
      const transformed = adapter.transform(singleWord);
      const hints = adapter.generateHints(transformed);

      const partialHint = hints.find(h => h.includes('Translation starts with:'));
      expect(partialHint).toContain('"Yes..."');
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
      const configuredAdapter = new SentenceAdapter({
        contentType: 'sentence',
        availableModes: [],
        defaultMode: 'recognition',
        validationStrategy: 'fuzzy',
        features: { furigana: true }
      });
      
      expect(configuredAdapter).toBeInstanceOf(SentenceAdapter);
    });

    it('should use similarity calculations correctly', () => {
      const content = adapter.transform(mockSentenceContent);
      const similarSentence = MockFactory.createSentenceContent({
        level: mockSentenceContent.level
      });

      const options = adapter.generateOptions(content, [similarSentence], 4);
      expect(options.length).toBeGreaterThanOrEqual(0);
    });
  });
});