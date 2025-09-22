/**
 * Multi-Step Story Processor
 * Handles the multi-step story generation process with character sheets, outlines, pages, and quizzes
 */

import { BaseProcessor } from './BaseProcessor';
import {
  ProcessorContext,
  ProcessorResult,
  TaskConfig,
  AIServiceError,
  ReviewQuestion
} from '../types';

// Multi-step story generation types
export interface MultiStepStoryRequest {
  step: 'character_sheet' | 'outline' | 'generate_page' | 'generate_quiz';
  theme?: string;
  jlptLevel?: string;
  pageCount?: number;
  draftId?: string;
  pageNumber?: number;
  characterSheet?: any;
  outline?: any;
  pages?: any[];
}

export interface CharacterSheet {
  mainCharacter: {
    name: string;
    nameJa: string;
    description: string;
    visualDescription: string;
    personality: string;
  };
  supportingCharacters: Array<{
    name: string;
    nameJa: string;
    description: string;
    visualDescription: string;
    role: string;
  }>;
  setting: {
    location: string;
    locationJa: string;
    time: string;
    atmosphere: string;
    visualStyle: string;
  };
  visualStyle: string;
  colorPalette: string[];
  moodKeywords: string[];
}

export interface StoryOutline {
  title: string;
  titleJa: string;
  description: string;
  descriptionJa: string;
  pages: Array<{
    pageNumber: number;
    summary: string;
    summaryJa: string;
    imagePrompt: string;
    keyVocabulary: string[];
    grammarPoints: string[];
  }>;
  targetVocabulary: string[];
  targetGrammar: string[];
}

export interface StoryPage {
  pageNumber: number;
  text: string;
  textWithFurigana: string;
  translation: string;
  vocabularyNotes: Record<string, string>;
  grammarNotes: Record<string, string>;
  imagePrompt: string;
}

export class MultiStepStoryProcessor extends BaseProcessor<MultiStepStoryRequest, any> {
  private contentGuidelines = `
IMPORTANT CONTENT GUIDELINES:
- NO sexual content or innuendo
- NO violence or graphic descriptions
- NO racial, gender, or cultural stereotypes
- NO political or controversial topics
- NO religious content
- Focus on educational, wholesome, and culturally respectful content
- Suitable for all ages`;

  private jlptGuidelines: Record<string, string> = {
    N5: 'Use only basic vocabulary and simple sentence structures. Present tense mainly, very simple past tense. Basic particles (は、が、を、に、で、と、も、の). Maximum 10-15 words per sentence.',
    N4: 'Use elementary vocabulary and grammar. Can use past tense, て-form, basic adjective conjugations. Sentences up to 15-20 words.',
    N3: 'Use intermediate vocabulary and grammar. Can use passive, causative, conditional forms. More complex sentence structures. Sentences up to 20-25 words.',
    N2: 'Use upper-intermediate vocabulary and grammar. Complex sentence patterns, keigo, nuanced expressions. Natural flowing text.',
    N1: 'Use advanced vocabulary and grammar. Literary expressions, complex kanji, sophisticated sentence structures. No restrictions.'
  };

  constructor(context: ProcessorContext) {
    super(context);
  }

  /**
   * Process multi-step story generation request
   */
  async process(
    request: MultiStepStoryRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<any>> {
    // Validate request
    this.validateRequest(request);

    switch (request.step) {
      case 'character_sheet':
        return this.generateCharacterSheet(request, config);
      case 'outline':
        return this.generateOutline(request, config);
      case 'generate_page':
        return this.generatePage(request, config);
      case 'generate_quiz':
        return this.generateQuiz(request, config);
      default:
        throw new AIServiceError(
          `Invalid step: ${request.step}`,
          'INVALID_STEP',
          400
        );
    }
  }

  /**
   * Validate request
   */
  validateRequest(request: MultiStepStoryRequest): void {
    if (!request.step) {
      throw new AIServiceError(
        'Step is required',
        'VALIDATION_ERROR',
        400
      );
    }

    switch (request.step) {
      case 'character_sheet':
        if (!request.theme) {
          throw new AIServiceError(
            'Theme is required for character sheet generation',
            'VALIDATION_ERROR',
            400
          );
        }
        break;
      case 'outline':
        if (!request.draftId && !request.characterSheet) {
          throw new AIServiceError(
            'Draft ID or character sheet is required for outline generation',
            'VALIDATION_ERROR',
            400
          );
        }
        break;
      case 'generate_page':
        if (!request.pageNumber) {
          throw new AIServiceError(
            'Page number is required for page generation',
            'VALIDATION_ERROR',
            400
          );
        }
        break;
      case 'generate_quiz':
        if (!request.draftId && !request.pages) {
          throw new AIServiceError(
            'Draft ID or pages are required for quiz generation',
            'VALIDATION_ERROR',
            400
          );
        }
        break;
    }
  }

  /**
   * Generate character sheet
   */
  private async generateCharacterSheet(
    request: MultiStepStoryRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<CharacterSheet>> {
    const jlptLevel = request.jlptLevel || config?.jlptLevel || 'N5';
    const pageCount = request.pageCount || 5;

    const systemPrompt = 'You are an expert in creating educational Japanese stories for language learners. You understand JLPT levels and create culturally appropriate content.';

    const userPrompt = `Create a character sheet for a Japanese learning story with the following requirements:

Theme: ${request.theme}
JLPT Level: ${jlptLevel}
Story Length: ${pageCount} pages

${this.contentGuidelines}

Create a detailed character sheet in JSON format with:
1. A main character (with name in English and Japanese)
2. 1-2 supporting characters
3. Setting details (location, time period, atmosphere)
4. Visual style description for consistency

The characters should be:
- Age-appropriate and relatable for language learners
- Culturally authentic but not stereotypical
- Interesting but not overly complex

Response format (JSON only):
{
  "mainCharacter": {
    "name": "English name",
    "nameJa": "Japanese name with kanji/kana",
    "description": "Character personality and role",
    "visualDescription": "Physical appearance for image generation",
    "personality": "Key personality traits"
  },
  "supportingCharacters": [...],
  "setting": {...},
  "visualStyle": "Overall visual style",
  "colorPalette": ["#hex1", "#hex2", "#hex3"],
  "moodKeywords": ["keyword1", "keyword2", "keyword3"]
}`;

    const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
    const characterSheet = this.parseJSON<CharacterSheet>(content);

    return {
      data: characterSheet,
      usage,
      metadata: {
        step: 'character_sheet',
        theme: request.theme,
        jlptLevel
      }
    };
  }

  /**
   * Generate story outline
   */
  private async generateOutline(
    request: MultiStepStoryRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<StoryOutline>> {
    const jlptLevel = request.jlptLevel || config?.jlptLevel || 'N5';
    const pageCount = request.pageCount || 5;
    const characterSheet = request.characterSheet;

    const systemPrompt = 'You are an expert in creating educational Japanese stories for language learners.';

    const userPrompt = `Create a story outline for a Japanese learning story:

Theme: ${request.theme}
JLPT Level: ${jlptLevel}
Number of pages: ${pageCount}

Character Sheet:
${JSON.stringify(characterSheet, null, 2)}

${this.contentGuidelines}
${this.jlptGuidelines[jlptLevel]}

Create a page-by-page outline that:
1. Tells a complete, engaging story
2. Uses vocabulary and grammar appropriate for ${jlptLevel}
3. Introduces concepts gradually
4. Includes repetition of key vocabulary
5. Has a clear beginning, middle, and end

Response format (JSON only):
{
  "title": "Story title in English",
  "titleJa": "Story title in Japanese",
  "description": "Brief story description",
  "descriptionJa": "Description in Japanese",
  "pages": [...],
  "targetVocabulary": [...],
  "targetGrammar": [...]
}`;

    const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
    const outline = this.parseJSON<StoryOutline>(content);

    return {
      data: outline,
      usage,
      metadata: {
        step: 'outline',
        theme: request.theme,
        jlptLevel,
        pageCount
      }
    };
  }

  /**
   * Generate individual page
   */
  private async generatePage(
    request: MultiStepStoryRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<StoryPage>> {
    const jlptLevel = request.jlptLevel || config?.jlptLevel || 'N5';
    const pageNumber = request.pageNumber!;
    const characterSheet = request.characterSheet;
    const outline = request.outline;

    const systemPrompt = 'You are an expert in writing Japanese learning materials. You create natural, engaging text appropriate for specific JLPT levels.';

    const userPrompt = `Generate page ${pageNumber} of the Japanese learning story:

Character Sheet:
${JSON.stringify(characterSheet, null, 2)}

Page Outline:
${JSON.stringify(outline.pages[pageNumber - 1], null, 2)}

JLPT Level: ${jlptLevel}
${this.jlptGuidelines[jlptLevel]}

Generate the actual story text for this page following these requirements:
1. Japanese text with natural flow
2. Use vocabulary and grammar appropriate for ${jlptLevel}
3. Make it engaging and educational
4. Include the key vocabulary and grammar points from the outline
5. Text should be 3-5 sentences for N5, 4-6 for N4, 5-8 for N3+

Response format (JSON only):
{
  "pageNumber": ${pageNumber},
  "text": "Japanese text for the page (plain text, no furigana)",
  "textWithFurigana": "Same text but with furigana in HTML ruby tags <ruby>漢字<rt>かんじ</rt></ruby>",
  "translation": "Natural English translation",
  "vocabularyNotes": {
    "word1": "explanation",
    "word2": "explanation"
  },
  "grammarNotes": {
    "pattern1": "explanation",
    "pattern2": "explanation"
  },
  "imagePrompt": "Detailed prompt for DALL-E including character descriptions and visual style"
}`;

    const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
    const page = this.parseJSON<StoryPage>(content);

    return {
      data: page,
      usage,
      metadata: {
        step: 'generate_page',
        pageNumber,
        jlptLevel
      }
    };
  }

  /**
   * Generate quiz
   */
  private async generateQuiz(
    request: MultiStepStoryRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<ReviewQuestion[]>> {
    const jlptLevel = request.jlptLevel || config?.jlptLevel || 'N5';
    const outline = request.outline;
    const pages = request.pages;

    const systemPrompt = 'You are an expert in creating educational assessments for Japanese language learners.';

    const userPrompt = `Create a comprehension quiz for this Japanese story:

Story Title: ${outline?.title} / ${outline?.titleJa}
Story Pages: ${JSON.stringify(pages?.map((p: any) => ({
  text: p.text,
  translation: p.translation
})), null, 2)}

JLPT Level: ${jlptLevel}

Create 5-8 multiple choice questions that test:
1. Reading comprehension
2. Vocabulary understanding
3. Grammar recognition
4. Story sequence
5. Character understanding

Questions should be appropriate for ${jlptLevel} learners.

Response format (JSON only):
{
  "questions": [
    {
      "id": "q1",
      "question": "Question in English",
      "questionJa": "Question in Japanese (optional for higher levels)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct",
      "explanationJa": "Explanation in Japanese"
    }
  ]
}`;

    const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
    const response = this.parseJSON<{ questions: ReviewQuestion[] }>(content);

    // Map to ReviewQuestion type
    const questions = response.questions.map(q => ({
      ...q,
      type: 'multiple_choice' as const,
      correctAnswer: q.correctIndex,
      difficulty: this.calculateQuestionDifficulty(jlptLevel),
      tags: ['story-comprehension', jlptLevel.toLowerCase()]
    }));

    return {
      data: questions,
      usage,
      metadata: {
        step: 'generate_quiz',
        questionCount: questions.length,
        jlptLevel
      }
    };
  }

  /**
   * Get system prompt - required by base class
   */
  getSystemPrompt(config?: TaskConfig): string {
    return 'You are an expert in creating educational Japanese stories for language learners.';
  }

  /**
   * Get user prompt - required by base class
   */
  getUserPrompt(request: MultiStepStoryRequest, config?: TaskConfig): string {
    // This is handled in individual step methods
    return '';
  }

  /**
   * Parse response - required by base class
   */
  parseResponse(response: string): any {
    return this.parseJSON(response);
  }

  /**
   * Calculate question difficulty based on JLPT level
   */
  private calculateQuestionDifficulty(jlptLevel: string): number {
    const levelMap: Record<string, number> = {
      N5: 1,
      N4: 2,
      N3: 3,
      N2: 4,
      N1: 5
    };
    return levelMap[jlptLevel] || 3;
  }
}