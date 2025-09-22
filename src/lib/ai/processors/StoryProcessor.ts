/**
 * Story Processor
 * Generates educational stories from moodboards or themes
 */

import { BaseProcessor } from './BaseProcessor';
import {
  ProcessorContext,
  ProcessorResult,
  TaskConfig,
  StoryGenerationRequest,
  GeneratedStory,
  AIServiceError,
  ReviewQuestion
} from '../types';
import { PromptManager } from '../config/PromptManager';

export class StoryProcessor extends BaseProcessor<StoryGenerationRequest, GeneratedStory> {
  private promptManager: PromptManager;

  constructor(context: ProcessorContext) {
    super(context);
    this.promptManager = PromptManager.getInstance();
  }

  /**
   * Process story generation request
   */
  async process(
    request: StoryGenerationRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<GeneratedStory>> {
    // Validate request
    this.validateRequest(request);

    // Get prompts from config
    const prompts = this.promptManager.getPromptsForTask('generate_story', request, config);
    if (!prompts) {
      // Fallback to hardcoded prompts
      const systemPrompt = this.getSystemPrompt(config);
      const userPrompt = this.getUserPrompt(request, config);

      const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
      const story = this.parseResponse(content);

      return {
        data: this.enhanceStory(story, request, config),
        usage,
        metadata: {
          theme: request.theme,
          pageCount: story.pages.length,
          jlptLevel: config?.jlptLevel
        }
      };
    }

    // Use config-based prompts
    const { content, usage } = await this.callOpenAI(prompts.system, prompts.user);
    const story = this.parseResponse(content);

    return {
      data: this.enhanceStory(story, request, config),
      usage,
      metadata: {
        theme: request.theme,
        pageCount: story.pages.length,
        jlptLevel: config?.jlptLevel
      }
    };
  }

  /**
   * Validate request
   */
  validateRequest(request: StoryGenerationRequest): void {
    if (!request.theme) {
      throw new AIServiceError(
        'Theme is required for story generation',
        'VALIDATION_ERROR',
        400
      );
    }

    if (request.pageCount && (request.pageCount < 1 || request.pageCount > 50)) {
      throw new AIServiceError(
        'Page count must be between 1 and 50',
        'VALIDATION_ERROR',
        400
      );
    }
  }

  /**
   * Get system prompt
   */
  getSystemPrompt(config?: TaskConfig): string {
    const jlptLevel = config?.jlptLevel || 'N5';

    return `You are a Japanese language teacher creating educational stories for ${jlptLevel} level students.

Requirements:
1. Create engaging, educational content appropriate for ${jlptLevel} learners
2. Use vocabulary and grammar patterns suitable for the level
3. Include furigana for ALL kanji using ruby tags: <ruby>漢字<rt>かんじ</rt></ruby>
4. Each page should be 100-200 Japanese characters
5. Include natural dialogue when appropriate
6. Provide English translations for each page
7. Create vocabulary notes for key terms
8. Generate comprehension quiz questions

Content Guidelines:
- NO inappropriate content
- Focus on educational value
- Culturally respectful
- Age-appropriate for all learners

Return ONLY valid JSON in the specified format.`;
  }

  /**
   * Get user prompt
   */
  getUserPrompt(request: StoryGenerationRequest, config?: TaskConfig): string {
    const jlptLevel = config?.jlptLevel || 'N5';
    const pageCount = request.pageCount || 5;
    const targetLength = config?.targetLength || 'medium';

    let prompt = `Create a ${targetLength} educational story.
Theme: ${request.theme}
JLPT Level: ${jlptLevel}
Number of pages: ${pageCount}`;

    // Add character information if provided
    if (request.characters && request.characters.length > 0) {
      prompt += `\n\nCharacters:\n${JSON.stringify(request.characters, null, 2)}`;
    }

    // Add setting information if provided
    if (request.setting) {
      prompt += `\n\nSetting:\n${JSON.stringify(request.setting, null, 2)}`;
    }

    // Add visual style if provided
    if (request.visualStyle) {
      prompt += `\n\nVisual Style: ${request.visualStyle}`;
    }

    prompt += `\n\nGenerate a complete story with:
1. Title in English and Japanese
2. ${pageCount} pages with Japanese text (with furigana), English translation
3. Vocabulary list with key terms
4. 3-5 comprehension quiz questions
5. Consistent narrative flow

Return as JSON with structure:
{
  "title": "English title",
  "titleJa": "Japanese title with furigana",
  "description": "Brief description",
  "pages": [...],
  "vocabulary": [...],
  "quiz": [...]
}`;

    return prompt;
  }

  /**
   * Parse AI response
   */
  parseResponse(response: string): GeneratedStory {
    const parsed = this.parseJSON<GeneratedStory>(response);

    // Validate required fields
    if (!parsed.title || !parsed.titleJa || !parsed.pages) {
      throw new AIServiceError(
        'Invalid story format: missing required fields',
        'INVALID_RESPONSE_FORMAT',
        500
      );
    }

    // Ensure pages is an array
    if (!Array.isArray(parsed.pages)) {
      throw new AIServiceError(
        'Pages must be an array',
        'INVALID_RESPONSE_FORMAT',
        500
      );
    }

    return parsed;
  }

  /**
   * Enhance generated story
   */
  private enhanceStory(
    story: GeneratedStory,
    request: StoryGenerationRequest,
    config?: TaskConfig
  ): GeneratedStory {
    // Add metadata if missing
    if (!story.metadata) {
      story.metadata = {
        theme: request.theme,
        jlptLevel: config?.jlptLevel || 'N5',
        generatedAt: new Date().toISOString(),
        pageCount: story.pages.length
      };
    }

    // Ensure all pages have required fields
    story.pages = story.pages.map((page, index) => ({
      pageNumber: page.pageNumber || index + 1,
      text: page.text || '',
      textWithFurigana: page.textWithFurigana || this.addFurigana(page.text),
      translation: page.translation || '',
      imagePrompt: page.imagePrompt || this.generateImagePrompt(page, story.title),
      vocabularyNotes: page.vocabularyNotes || {},
      grammarNotes: page.grammarNotes || {}
    }));

    // Ensure vocabulary list exists
    if (!story.vocabulary || !Array.isArray(story.vocabulary)) {
      story.vocabulary = this.extractVocabulary(story.pages);
    }

    // Ensure quiz exists
    if (!story.quiz || !Array.isArray(story.quiz)) {
      story.quiz = this.generateDefaultQuiz(story);
    }

    return story;
  }

  /**
   * Add furigana to text (placeholder)
   */
  private addFurigana(text: string): string {
    // In production, use a proper furigana library
    // For now, just return the text as-is
    return text;
  }

  /**
   * Generate image prompt for a page
   */
  private generateImagePrompt(page: any, title: string): string {
    return `Japanese educational story illustration: ${title}, Page ${page.pageNumber}. ${page.translation || page.text}. Style: Soft watercolor, child-friendly, educational.`;
  }

  /**
   * Extract vocabulary from pages
   */
  private extractVocabulary(pages: any[]): any[] {
    const vocabulary: any[] = [];

    // Extract unique vocabulary from all pages
    const vocabSet = new Set<string>();

    pages.forEach(page => {
      if (page.vocabularyNotes) {
        Object.entries(page.vocabularyNotes).forEach(([word, meaning]) => {
          if (!vocabSet.has(word)) {
            vocabSet.add(word);
            vocabulary.push({
              word,
              meaning,
              pageNumber: page.pageNumber
            });
          }
        });
      }
    });

    return vocabulary;
  }

  /**
   * Generate default quiz questions
   */
  private generateDefaultQuiz(story: GeneratedStory): ReviewQuestion[] {
    const quiz: ReviewQuestion[] = [];

    // Add a comprehension question about the title
    quiz.push({
      id: 'q1',
      type: 'multiple_choice',
      question: `What is the story about?`,
      questionJa: 'この物語は何についてですか？',
      options: [
        story.description || story.title,
        'A different story',
        'Something else',
        'None of the above'
      ],
      correctAnswer: 0,
      explanation: `The story is about: ${story.title}`,
      difficulty: 1,
      tags: ['comprehension', 'main-idea']
    });

    // Add a vocabulary question if vocabulary exists
    if (story.vocabulary && story.vocabulary.length > 0) {
      const vocab = story.vocabulary[0];
      quiz.push({
        id: 'q2',
        type: 'multiple_choice',
        question: `What does "${vocab.word}" mean?`,
        questionJa: `「${vocab.word}」の意味は何ですか？`,
        options: [
          vocab.meaning,
          'Something different',
          'Another meaning',
          'None of these'
        ],
        correctAnswer: 0,
        explanation: `${vocab.word} means: ${vocab.meaning}`,
        difficulty: 2,
        tags: ['vocabulary']
      });
    }

    // Add a true/false question
    quiz.push({
      id: 'q3',
      type: 'true_false',
      question: `The story has ${story.pages.length} pages.`,
      questionJa: `この物語は${story.pages.length}ページあります。`,
      correctAnswer: true,
      explanation: `Yes, the story has exactly ${story.pages.length} pages.`,
      difficulty: 1,
      tags: ['factual']
    });

    return quiz;
  }

  /**
   * Generate story from moodboard
   */
  async generateFromMoodboard(
    moodboard: any,
    config?: TaskConfig & { targetLength?: string; genre?: string; includeDialogue?: boolean }
  ): Promise<ProcessorResult<GeneratedStory>> {
    // Prepare kanji string
    const kanjiList = moodboard.kanjiList || moodboard.kanji || [];
    const kanjiString = kanjiList
      .map((k: any) => `${k.kanji || k.char}(${k.meaning})`)
      .join(', ');

    // Prepare request
    const request: StoryGenerationRequest = {
      theme: moodboard.title || moodboard.category || 'General',
      pageCount: this.calculatePageCount(config?.targetLength),
      metadata: {
        moodboardId: moodboard.id,
        kanjiList: kanjiList.map((k: any) => k.kanji || k.char),
        genre: config?.genre || 'slice-of-life',
        includeDialogue: config?.includeDialogue !== false
      }
    };

    // Process with enhanced config
    const enhancedConfig: TaskConfig = {
      ...config,
      jlptLevel: moodboard.jlptLevel || config?.jlptLevel || 'N5',
      customPrompt: `Incorporate these kanji naturally: ${kanjiString}`
    };

    return this.process(request, enhancedConfig);
  }

  /**
   * Calculate page count from target length
   */
  private calculatePageCount(targetLength?: string): number {
    switch (targetLength) {
      case 'short':
        return 3;
      case 'long':
        return 10;
      case 'medium':
      default:
        return 5;
    }
  }
}