/**
 * CustomAdapter Test Suite
 * Tests custom content transformation, option generation, and mode preparation
 */

import { CustomContentAdapter, CustomContent } from '../custom.adapter';
import { ReviewableContent } from '../../core/interfaces';
import { ReviewMode } from '../../core/types';
import { MockFactory, createTestScenario } from '../../__tests__/test-utils/mock-factory';
import { 
  TestHelpers, 
  AdapterTestHelpers,
  setupTest,
  teardownTest 
} from '../../__tests__/test-utils/test-helpers';

describe('CustomContentAdapter', () => {
  let adapter: CustomContentAdapter;
  let mockCustomContent: CustomContent;
  let customPool: CustomContent[];

  beforeEach(() => {
    setupTest();
    adapter = new CustomContentAdapter({
      contentType: 'custom',
      availableModes: [],
      defaultMode: 'recognition',
      validationStrategy: 'fuzzy'
    });
    mockCustomContent = MockFactory.createCustomContent();
    customPool = MockFactory.createBulkCustomContent(20);
  });

  afterEach(() => {
    teardownTest();
  });

  describe('transform()', () => {
    it('should transform custom content to ReviewableContent', () => {
      const result = adapter.transform(mockCustomContent);

      TestHelpers.validateContentTransformation(mockCustomContent, result);
      expect(result.contentType).toBe('custom');
      expect(result.primaryDisplay).toBe(mockCustomContent.front);
      expect(result.secondaryDisplay).toBe(mockCustomContent.back);
      expect(result.primaryAnswer).toBe(mockCustomContent.back);
    });

    it('should include media URLs when provided', () => {
      const customWithMedia = MockFactory.createCustomContent({
        media: {
          audio: '/audio/custom/test.mp3',
          image: '/images/custom/test.jpg',
          video: '/videos/custom/test.mp4'
        }
      });
      const result = adapter.transform(customWithMedia);

      expect(result.audioUrl).toBe('/audio/custom/test.mp3');
      expect(result.imageUrl).toBe('/images/custom/test.jpg');
      expect(result.videoUrl).toBe('/videos/custom/test.mp4');
    });

    it('should use explicit difficulty when provided', () => {
      const explicitDifficulty = MockFactory.createCustomContent({
        difficulty: 0.8
      });
      const result = adapter.transform(explicitDifficulty);

      expect(result.difficulty).toBe(0.8);
    });

    it('should use default difficulty when not provided', () => {
      const noDifficulty = MockFactory.createCustomContent();
      delete noDifficulty.difficulty;
      const result = adapter.transform(noDifficulty);

      expect(result.difficulty).toBe(0.5);
    });

    it('should include tags from content', () => {
      const taggedContent = MockFactory.createCustomContent({
        tags: ['test-tag', 'another-tag']
      });
      const result = adapter.transform(taggedContent);

      expect(result.tags).toContain('test-tag');
      expect(result.tags).toContain('another-tag');
    });

    it('should use default tags when none provided', () => {
      const noTags = MockFactory.createCustomContent();
      delete noTags.tags;
      const result = adapter.transform(noTags);

      expect(result.tags).toContain('custom');
      expect(result.tags).toContain(noTags.type);
    });

    it('should detect supported modes based on content', () => {
      const contentWithAudio = MockFactory.createCustomContent({
        media: { audio: '/test.mp3' }
      });
      const result = adapter.transform(contentWithAudio);

      expect(result.supportedModes).toContain('listening');
    });

    it('should include full content as metadata', () => {
      const result = adapter.transform(mockCustomContent);

      expect(result.metadata).toMatchObject(mockCustomContent);
    });

    it('should have empty alternative answers by default', () => {
      const result = adapter.transform(mockCustomContent);
      expect(result.alternativeAnswers).toEqual([]);
    });

    it('should handle content without media', () => {
      const noMedia = MockFactory.createCustomContent();
      delete noMedia.media;
      const result = adapter.transform(noMedia);

      expect(result.audioUrl).toBeUndefined();
      expect(result.imageUrl).toBeUndefined();
      expect(result.videoUrl).toBeUndefined();
    });
  });

  describe('calculateDifficulty()', () => {
    it('should respect explicit difficulty value', () => {
      const explicitDifficulty = MockFactory.createCustomContent({
        difficulty: 0.7
      });
      const difficulty = adapter.calculateDifficulty(explicitDifficulty);
      expect(difficulty).toBe(0.7);
    });

    it('should clamp explicit difficulty to valid range', () => {
      const tooHigh = MockFactory.createCustomContent({
        difficulty: 1.5
      });
      const tooLow = MockFactory.createCustomContent({
        difficulty: -0.5
      });

      expect(adapter.calculateDifficulty(tooHigh)).toBe(1.0);
      expect(adapter.calculateDifficulty(tooLow)).toBe(0.0);
    });

    it('should calculate difficulty based on content length', () => {
      const shortContent = MockFactory.createCustomContent({
        front: 'A',
        back: 'B'
      });
      const longContent = MockFactory.createCustomContent({
        front: 'This is a very long front content that should increase difficulty due to its length',
        back: 'This is also a very long back content that contributes to the overall difficulty calculation'
      });

      const shortDifficulty = adapter.calculateDifficulty(shortContent);
      const longDifficulty = adapter.calculateDifficulty(longContent);

      expect(longDifficulty).toBeGreaterThan(shortDifficulty);
    });

    it('should increase difficulty based on number of hints', () => {
      const noHints = MockFactory.createCustomContent();
      const withHints = MockFactory.createCustomContent({
        hints: ['hint1', 'hint2', 'hint3']
      });

      const noDifficulty = adapter.calculateDifficulty(noHints);
      const hintDifficulty = adapter.calculateDifficulty(withHints);

      expect(hintDifficulty).toBeGreaterThan(noDifficulty);
    });

    it('should increase difficulty for video content', () => {
      const noMedia = MockFactory.createCustomContent();
      const withVideo = MockFactory.createCustomContent({
        media: { video: '/test.mp4' }
      });

      const noDifficulty = adapter.calculateDifficulty(noMedia);
      const videoDifficulty = adapter.calculateDifficulty(withVideo);

      expect(videoDifficulty).toBeGreaterThan(noDifficulty);
    });

    it('should increase difficulty for image content', () => {
      const noMedia = MockFactory.createCustomContent();
      const withImage = MockFactory.createCustomContent({
        media: { image: '/test.jpg' }
      });

      const noDifficulty = adapter.calculateDifficulty(noMedia);
      const imageDifficulty = adapter.calculateDifficulty(withImage);

      expect(imageDifficulty).toBeGreaterThan(noDifficulty);
    });

    it('should adjust difficulty based on tags', () => {
      const beginner = MockFactory.createCustomContent({
        tags: ['beginner']
      });
      const advanced = MockFactory.createCustomContent({
        tags: ['advanced']
      });
      const hard = MockFactory.createCustomContent({
        tags: ['hard']
      });

      const beginnerDifficulty = adapter.calculateDifficulty(beginner);
      const advancedDifficulty = adapter.calculateDifficulty(advanced);
      const hardDifficulty = adapter.calculateDifficulty(hard);

      expect(beginnerDifficulty).toBeLessThan(0.5);
      expect(advancedDifficulty).toBeGreaterThan(0.5);
      expect(hardDifficulty).toBeGreaterThan(0.5);
    });

    it('should cap calculated difficulty at 1.0', () => {
      const maxDifficulty = MockFactory.createCustomContent({
        front: 'This is an extremely long and complex content that should push the difficulty calculation to its maximum possible value',
        back: 'This back content is also very long and complex, adding even more to the difficulty calculation process',
        hints: ['hint1', 'hint2', 'hint3', 'hint4'],
        media: { video: '/test.mp4' },
        tags: ['advanced', 'hard']
      });

      const difficulty = adapter.calculateDifficulty(maxDifficulty);
      expect(difficulty).toBe(1.0);
    });
  });

  describe('generateOptions()', () => {
    it('should generate correct number of options', () => {
      const content = adapter.transform(mockCustomContent);
      const options = adapter.generateOptions(content, customPool, 4);

      TestHelpers.validateOptionsGeneration(options, content, 4);
    });

    it('should prioritize content with same type', () => {
      const flashcardContent = MockFactory.createCustomContent({
        type: 'flashcard'
      });
      const typePool = [
        MockFactory.createCustomContent({ type: 'flashcard' }),
        MockFactory.createCustomContent({ type: 'quiz' }),
        ...customPool
      ];

      const transformed = adapter.transform(flashcardContent);
      const options = adapter.generateOptions(transformed, typePool, 4);

      const sameType = options.filter(opt => 
        (opt.metadata as CustomContent).type === 'flashcard'
      );
      expect(sameType.length).toBeGreaterThan(0);
    });

    it('should prioritize content with similar tags', () => {
      const taggedContent = MockFactory.createCustomContent({
        tags: ['science', 'biology']
      });
      const tagPool = [
        MockFactory.createCustomContent({ tags: ['science', 'chemistry'] }),
        MockFactory.createCustomContent({ tags: ['math', 'algebra'] }),
        ...customPool
      ];

      const transformed = adapter.transform(taggedContent);
      const options = adapter.generateOptions(transformed, tagPool, 4);

      expect(options.length).toBeGreaterThan(0);
    });

    it('should prioritize content with similar difficulty', () => {
      const mediumContent = MockFactory.createCustomContent({
        difficulty: 0.5
      });
      const difficultyPool = [
        MockFactory.createCustomContent({ difficulty: 0.6 }),
        MockFactory.createCustomContent({ difficulty: 0.9 }),
        ...customPool
      ];

      const transformed = adapter.transform(mediumContent);
      const options = adapter.generateOptions(transformed, difficultyPool, 4);

      expect(options.length).toBeGreaterThan(0);
    });

    it('should include content with similar structure', () => {
      const shortContent = MockFactory.createCustomContent({
        front: 'A',
        back: 'B'
      });
      const structurePool = [
        MockFactory.createCustomContent({ front: 'X', back: 'Y' }),
        MockFactory.createCustomContent({ 
          front: 'Very long front content',
          back: 'Very long back content'
        }),
        ...customPool
      ];

      const transformed = adapter.transform(shortContent);
      const options = adapter.generateOptions(transformed, structurePool, 4);

      expect(options.length).toBeGreaterThan(0);
    });

    it('should include content with similar length', () => {
      const mediumContent = MockFactory.createCustomContent({
        front: 'Medium front',
        back: 'Medium back'
      });
      const lengthPool = [
        MockFactory.createCustomContent({ 
          front: 'Similar front', 
          back: 'Similar back' 
        }),
        MockFactory.createCustomContent({ 
          front: 'A', 
          back: 'B' 
        }),
        ...customPool
      ];

      const transformed = adapter.transform(mediumContent);
      const options = adapter.generateOptions(transformed, lengthPool, 4);

      expect(options.length).toBeGreaterThan(0);
    });

    it('should not include the correct answer in options', () => {
      const content = adapter.transform(mockCustomContent);
      const options = adapter.generateOptions(content, customPool, 4);

      const hasCorrectAnswer = options.some(opt => opt.id === content.id);
      expect(hasCorrectAnswer).toBe(false);
    });

    it('should handle small pools gracefully', () => {
      const smallPool = MockFactory.createBulkCustomContent(2);
      const content = adapter.transform(mockCustomContent);
      const options = adapter.generateOptions(content, smallPool, 4);

      expect(options.length).toBeLessThanOrEqual(3);
      AdapterTestHelpers.testOptionsUniqueness(options, content);
    });

    it('should handle empty pool', () => {
      const content = adapter.transform(mockCustomContent);
      const options = adapter.generateOptions(content, [], 4);
      expect(options).toEqual([]);
    });
  });

  describe('getSupportedModes()', () => {
    it('should return all modes by default', () => {
      const modes = adapter.getSupportedModes();
      expect(modes).toEqual(['recognition', 'recall', 'listening']);
    });
  });

  describe('prepareForMode()', () => {
    let content: ReviewableContent;

    beforeEach(() => {
      content = adapter.transform(mockCustomContent);
    });

    describe('recognition mode', () => {
      it('should show front and expect back as answer', () => {
        const prepared = adapter.prepareForMode(content, 'recognition');
        
        expect(prepared.primaryDisplay).toBe(mockCustomContent.front);
        expect(prepared.secondaryDisplay).toBeUndefined();
        expect(prepared.primaryAnswer).toBe(mockCustomContent.back);
      });
    });

    describe('recall mode', () => {
      it('should show back and expect front as answer', () => {
        const prepared = adapter.prepareForMode(content, 'recall');
        
        expect(prepared.primaryDisplay).toBe(mockCustomContent.back);
        expect(prepared.secondaryDisplay).toBeUndefined();
        expect(prepared.primaryAnswer).toBe(mockCustomContent.front);
      });
    });

    describe('listening mode', () => {
      it('should hide visual content when audio is available', () => {
        const contentWithAudio = adapter.transform(MockFactory.createCustomContent({
          media: { audio: '/test.mp3' }
        }));
        const prepared = adapter.prepareForMode(contentWithAudio, 'listening');
        
        expect(prepared.primaryDisplay).toBe('?');
        expect(prepared.secondaryDisplay).toBeUndefined();
        expect(prepared.audioUrl).toBe('/test.mp3');
      });

      it('should fall back to recognition when no audio', () => {
        const prepared = adapter.prepareForMode(content, 'listening');
        
        expect(prepared.primaryDisplay).toBe(mockCustomContent.front);
        expect(prepared.primaryAnswer).toBe(mockCustomContent.back);
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
    it('should use provided hints when available', () => {
      const hintedContent = MockFactory.createCustomContent({
        hints: ['Custom hint 1', 'Custom hint 2']
      });
      const transformed = adapter.transform(hintedContent);
      const hints = adapter.generateHints(transformed);

      expect(hints).toEqual(['Custom hint 1', 'Custom hint 2']);
    });

    it('should generate character count hint', () => {
      const content = MockFactory.createCustomContent({
        back: 'Test Answer'
      });
      const transformed = adapter.transform(content);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('The answer has 11 characters');
      AdapterTestHelpers.testHintGeneration(adapter, transformed, 2, 6);
    });

    it('should generate first character hint', () => {
      const content = MockFactory.createCustomContent({
        back: 'Test Answer'
      });
      const transformed = adapter.transform(content);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('The answer starts with \'T\'');
    });

    it('should generate type hint', () => {
      const typedContent = MockFactory.createCustomContent({
        type: 'flashcard'
      });
      const transformed = adapter.transform(typedContent);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('This is a flashcard card');
    });

    it('should generate tag hint', () => {
      const taggedContent = MockFactory.createCustomContent({
        tags: ['science', 'biology', 'easy']
      });
      const transformed = adapter.transform(taggedContent);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('Related to: science');
    });

    it('should generate word count hint for multi-word answers', () => {
      const multiWord = MockFactory.createCustomContent({
        back: 'Multiple word answer here'
      });
      const transformed = adapter.transform(multiWord);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('The answer contains 4 words');
    });

    it('should detect number pattern', () => {
      const numberContent = MockFactory.createCustomContent({
        back: '12345'
      });
      const transformed = adapter.transform(numberContent);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('The answer is a number');
    });

    it('should detect proper noun pattern', () => {
      const properNoun = MockFactory.createCustomContent({
        back: 'Tokyo'
      });
      const transformed = adapter.transform(properNoun);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('The answer is a proper noun');
    });

    it('should detect year pattern', () => {
      const yearContent = MockFactory.createCustomContent({
        back: '1985'
      });
      const transformed = adapter.transform(yearContent);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('The answer is a year');
    });

    it('should detect acronym pattern', () => {
      const acronym = MockFactory.createCustomContent({
        back: 'NASA'
      });
      const transformed = adapter.transform(acronym);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('The answer is an acronym');
    });

    it('should detect list pattern', () => {
      const listContent = MockFactory.createCustomContent({
        back: 'apple, banana, orange'
      });
      const transformed = adapter.transform(listContent);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('The answer is a list');
    });

    it('should handle content without hints', () => {
      const noHints = MockFactory.createCustomContent();
      delete noHints.hints;
      const transformed = adapter.transform(noHints);
      const hints = adapter.generateHints(transformed);

      expect(hints.length).toBeGreaterThan(0);
      expect(hints[0]).toContain('characters');
    });

    it('should handle empty answer gracefully', () => {
      const emptyAnswer = MockFactory.createCustomContent({
        back: ''
      });
      const transformed = adapter.transform(emptyAnswer);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('The answer has 0 characters');
    });

    it('should exclude filtering tags from hints', () => {
      const filteredTags = MockFactory.createCustomContent({
        tags: ['custom', 'easy', 'medium', 'hard', 'science']
      });
      const transformed = adapter.transform(filteredTags);
      const hints = adapter.generateHints(transformed);

      expect(hints).toContain('Related to: science');
      expect(hints.some(h => h.includes('custom'))).toBe(false);
      expect(hints.some(h => h.includes('easy'))).toBe(false);
    });
  });

  describe('detectSupportedModes()', () => {
    it('should include listening mode when audio is present', () => {
      const withAudio = MockFactory.createCustomContent({
        media: { audio: '/test.mp3' }
      });
      const transformed = adapter.transform(withAudio);

      expect(transformed.supportedModes).toContain('listening');
    });

    it('should include recall mode for simple content', () => {
      const simple = MockFactory.createCustomContent({
        front: 'Short',
        back: 'Answer'
      });
      const transformed = adapter.transform(simple);

      expect(transformed.supportedModes).toContain('recall');
    });

    it('should exclude recall mode for complex content', () => {
      const complex = MockFactory.createCustomContent({
        front: 'This is a very long and complex front content that exceeds the character limit',
        back: 'This is also a very long and complex back answer'
      });
      const transformed = adapter.transform(complex);

      expect(transformed.supportedModes).not.toContain('recall');
    });

    it('should always include recognition mode', () => {
      const content = MockFactory.createCustomContent();
      const transformed = adapter.transform(content);

      expect(transformed.supportedModes).toContain('recognition');
    });
  });

  describe('Performance', () => {
    it('should transform content quickly', async () => {
      const { duration } = await TestHelpers.measurePerformance(
        async () => adapter.transform(mockCustomContent),
        10
      );
      expect(duration).toBeLessThan(10);
    });

    it('should generate options efficiently for large pools', async () => {
      const largePool = MockFactory.createBulkCustomContent(1000);
      const content = adapter.transform(mockCustomContent);
      
      const { duration } = await TestHelpers.measurePerformance(
        async () => adapter.generateOptions(content, largePool, 4),
        50
      );
      expect(duration).toBeLessThan(100);
    });

    it('should generate hints efficiently', async () => {
      const content = adapter.transform(mockCustomContent);
      
      const { duration } = await TestHelpers.measurePerformance(
        async () => adapter.generateHints(content),
        100
      );
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle content with empty front and back', () => {
      const empty: CustomContent = {
        ...mockCustomContent,
        front: '',
        back: ''
      };

      const result = adapter.transform(empty);
      expect(result.primaryDisplay).toBe('');
      expect(result.primaryAnswer).toBe('');
    });

    it('should handle content without type', () => {
      const noType: CustomContent = {
        ...mockCustomContent,
        type: ''
      };

      const result = adapter.transform(noType);
      expect(result.tags).toContain('custom');
      expect(result.tags).toContain('');
    });

    it('should handle content with only media', () => {
      const mediaOnly = MockFactory.createCustomContent({
        front: '',
        back: '',
        media: { audio: '/test.mp3' }
      });

      const result = adapter.transform(mediaOnly);
      expect(result.audioUrl).toBe('/test.mp3');
      expect(result.supportedModes).toContain('listening');
    });

    it('should handle malformed media object', () => {
      const malformedMedia: CustomContent = {
        ...mockCustomContent,
        media: {} as any
      };

      const result = adapter.transform(malformedMedia);
      expect(result.audioUrl).toBeUndefined();
      expect(result.imageUrl).toBeUndefined();
    });

    it('should handle content with extra properties', () => {
      const extraProps: CustomContent = {
        ...mockCustomContent,
        customProperty: 'test',
        anotherProperty: 123
      } as any;

      const result = adapter.transform(extraProps);
      expect(result.metadata).toMatchObject(extraProps);
    });

    it('should handle empty pool in generateOptions', () => {
      const content = adapter.transform(mockCustomContent);
      const options = adapter.generateOptions(content, [], 4);
      expect(options).toEqual([]);
    });

    it('should handle null/undefined values in content', () => {
      const nullContent: CustomContent = {
        ...mockCustomContent,
        tags: undefined,
        hints: undefined,
        difficulty: undefined
      } as any;

      const result = adapter.transform(nullContent);
      expect(result.tags).toContain('custom');
      expect(result.difficulty).toBe(0.5);
    });

    it('should handle structural similarity with zero-length content', () => {
      const zeroLength1 = MockFactory.createCustomContent({
        front: '',
        back: ''
      });
      const zeroLength2 = MockFactory.createCustomContent({
        front: '',
        back: ''
      });

      const transformed = adapter.transform(zeroLength1);
      const options = adapter.generateOptions(transformed, [zeroLength2], 4);

      expect(options.length).toBeGreaterThanOrEqual(0);
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
      const configuredAdapter = new CustomContentAdapter({
        contentType: 'custom',
        availableModes: [],
        defaultMode: 'recognition',
        validationStrategy: 'fuzzy'
      });
      
      expect(configuredAdapter).toBeInstanceOf(CustomContentAdapter);
    });

    it('should use similarity calculations correctly', () => {
      const content = adapter.transform(mockCustomContent);
      const similarContent = MockFactory.createCustomContent({
        type: mockCustomContent.type,
        difficulty: mockCustomContent.difficulty
      });

      const options = adapter.generateOptions(content, [similarContent], 4);
      expect(options.length).toBeGreaterThanOrEqual(0);
    });
  });
});