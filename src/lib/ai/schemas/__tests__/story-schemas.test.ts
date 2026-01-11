/**
 * Zod Schema Tests for Story Generation
 * Tests that schemas properly validate story data
 */

import { describe, it, expect } from '@jest/globals';
import {
  StoryPageSchema,
  GeneratedStorySchema,
  CharacterSheetSchema,
  StoryOutlineSchema,
  QuizQuestionsResponseSchema,
} from '../story-schemas';

describe('StoryPageSchema', () => {
  it('should validate a valid story page', () => {
    const validPage = {
      pageNumber: 1,
      text: '今日は海に行きました。',
      textWithFurigana: '<ruby>今日<rt>きょう</rt></ruby>は<ruby>海<rt>うみ</rt></ruby>に<ruby>行<rt>い</rt></ruby>きました。',
      translation: 'Today, I went to the beach.',
      vocabularyNotes: {
        '今日': 'today',
        '海': 'sea, beach',
      },
      grammarNotes: {
        'に行く': 'to go to (location)',
      },
    };

    const result = StoryPageSchema.safeParse(validPage);
    expect(result.success).toBe(true);
  });

  it('should reject page with missing required fields', () => {
    const invalidPage = {
      pageNumber: 1,
      text: '今日は海に行きました。',
      // Missing textWithFurigana and translation
    };

    const result = StoryPageSchema.safeParse(invalidPage);
    expect(result.success).toBe(false);
  });

  it('should allow optional fields to be missing', () => {
    const minimalPage = {
      pageNumber: 1,
      text: '今日は海に行きました。',
      textWithFurigana: '<ruby>今日<rt>きょう</rt></ruby>は<ruby>海<rt>うみ</rt></ruby>に行きました。',
      translation: 'Today, I went to the beach.',
    };

    const result = StoryPageSchema.safeParse(minimalPage);
    expect(result.success).toBe(true);
  });

  it('should allow extra fields with passthrough', () => {
    const pageWithExtra = {
      pageNumber: 1,
      text: '今日は海に行きました。',
      textWithFurigana: '<ruby>今日<rt>きょう</rt></ruby>は<ruby>海<rt>うみ</rt></ruby>に行きました。',
      translation: 'Today, I went to the beach.',
      extraField: 'this should be allowed',
    };

    const result = StoryPageSchema.safeParse(pageWithExtra);
    expect(result.success).toBe(true);
  });
});

describe('GeneratedStorySchema', () => {
  it('should validate a complete story', () => {
    const validStory = {
      title: 'A Day at the Beach',
      titleJa: 'ビーチでの一日',
      description: 'A simple story about spending a day at the beach',
      pages: [
        {
          pageNumber: 1,
          text: '今日は海に行きました。',
          textWithFurigana: '<ruby>今日<rt>きょう</rt></ruby>は<ruby>海<rt>うみ</rt></ruby>に行きました。',
          translation: 'Today, I went to the beach.',
        },
      ],
    };

    const result = GeneratedStorySchema.safeParse(validStory);
    expect(result.success).toBe(true);
  });

  it('should reject story with no pages', () => {
    const invalidStory = {
      title: 'A Day at the Beach',
      titleJa: 'ビーチでの一日',
      description: 'A simple story',
      pages: [], // Empty pages array
    };

    const result = GeneratedStorySchema.safeParse(invalidStory);
    expect(result.success).toBe(false);
  });
});

describe('CharacterSheetSchema', () => {
  it('should validate a complete character sheet', () => {
    const validSheet = {
      mainCharacter: {
        name: 'Yuki',
        nameJa: 'ゆき',
        description: 'A curious student',
        visualDescription: 'A young person with short black hair',
        personality: 'Friendly and adventurous',
      },
      supportingCharacters: [
        {
          name: 'Sensei',
          nameJa: '先生',
          description: 'A kind teacher',
          visualDescription: 'Middle-aged with glasses',
          role: 'Teacher',
        },
      ],
      setting: {
        location: 'Tokyo',
        time: 'Present day',
        atmosphere: 'Cheerful and bright',
      },
      visualStyle: 'Anime illustration style',
    };

    const result = CharacterSheetSchema.safeParse(validSheet);
    expect(result.success).toBe(true);
  });
});

describe('StoryOutlineSchema', () => {
  it('should validate a story outline', () => {
    const validOutline = {
      title: 'A Day at the Beach',
      titleJa: 'ビーチでの一日',
      description: 'A story about the beach',
      pages: [
        {
          pageNumber: 1,
          summary: 'Going to the beach',
          imagePrompt: 'A person walking to a sunny beach',
        },
      ],
    };

    const result = StoryOutlineSchema.safeParse(validOutline);
    expect(result.success).toBe(true);
  });
});

describe('QuizQuestionsResponseSchema', () => {
  it('should validate quiz questions', () => {
    const validQuiz = {
      questions: [
        {
          id: 'q1',
          question: 'Where did they go?',
          options: ['beach', 'mountain', 'park', 'school'],
          correctIndex: 0,
          explanation: 'They went to the beach',
        },
      ],
    };

    const result = QuizQuestionsResponseSchema.safeParse(validQuiz);
    expect(result.success).toBe(true);
  });

  it('should reject quiz with negative correctIndex', () => {
    const invalidQuiz = {
      questions: [
        {
          id: 'q1',
          question: 'Where did they go?',
          options: ['beach', 'mountain'],
          correctIndex: -1, // Invalid
        },
      ],
    };

    const result = QuizQuestionsResponseSchema.safeParse(invalidQuiz);
    expect(result.success).toBe(false);
  });
});
