/**
 * Review Question Processor
 * Generates custom review questions for kanji, vocabulary, and grammar
 */

import { BaseProcessor } from './BaseProcessor';
import {
  ProcessorContext,
  ProcessorResult,
  TaskConfig,
  ReviewQuestionRequest,
  ReviewQuestion,
  AIServiceError
} from '../types';

export class ReviewQuestionProcessor extends BaseProcessor<ReviewQuestionRequest, ReviewQuestion[]> {
  constructor(context: ProcessorContext) {
    super(context);
  }

  /**
   * Process the request to generate review questions
   */
  async process(
    request: ReviewQuestionRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<ReviewQuestion[]>> {
    // Validate the request
    this.validateRequest(request);

    // Generate prompts
    const systemPrompt = this.getSystemPrompt(config);
    const userPrompt = this.getUserPrompt(request, config);

    // Call OpenAI
    const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);

    // Parse the response
    const questions = this.parseResponse(content);

    // Validate and enhance questions
    const enhancedQuestions = this.enhanceQuestions(questions, request, config);

    return {
      data: enhancedQuestions,
      usage,
      metadata: {
        questionCount: enhancedQuestions.length,
        contentTypes: this.getContentTypes(request),
        jlptLevel: config?.jlptLevel
      }
    };
  }

  /**
   * Validate the request
   */
  validateRequest(request: ReviewQuestionRequest): void {
    if (!request.content) {
      throw new AIServiceError(
        'Content is required',
        'VALIDATION_ERROR',
        400
      );
    }

    const { kanji, vocabulary, grammar, context } = request.content;

    if (!kanji && !vocabulary && !grammar && !context) {
      throw new AIServiceError(
        'At least one content type (kanji, vocabulary, grammar, or context) is required',
        'VALIDATION_ERROR',
        400
      );
    }

    // Validate question count
    const questionCount = request.questionCount || 5;
    if (questionCount < 1 || questionCount > 50) {
      throw new AIServiceError(
        'Question count must be between 1 and 50',
        'VALIDATION_ERROR',
        400
      );
    }
  }

  /**
   * Generate the system prompt
   */
  getSystemPrompt(config?: TaskConfig): string {
    const jlptLevel = config?.jlptLevel || 'N5';

    return `You are an expert Japanese language teacher creating review questions for students.

REQUIREMENTS:
1. Generate educational questions appropriate for ${jlptLevel} level students
2. Questions should test understanding, not just memorization
3. Include a mix of difficulty levels (easy, medium, hard)
4. Provide clear explanations for correct answers
5. Use natural, contextual Japanese where appropriate
6. Follow SRS (Spaced Repetition System) best practices

QUESTION TYPES:
- multiple_choice: 4 options with one correct answer
- fill_blank: Sentence with missing word/phrase
- true_false: Statement to evaluate
- matching: Match items between two lists
- ordering: Put items in correct sequence

DIFFICULTY SCORING (1-5):
1 = Very Easy (basic recognition)
2 = Easy (simple recall)
3 = Medium (application)
4 = Hard (analysis/synthesis)
5 = Very Hard (complex application)

OUTPUT FORMAT:
Return a JSON array of question objects. Each question must have:
- id: Unique identifier (q1, q2, etc.)
- type: Question type
- question: Question text in English
- questionJa: Question in Japanese (optional, for higher levels)
- options: Array of options (for multiple choice)
- correctAnswer: The correct answer (string, number, or boolean)
- explanation: Why this answer is correct
- explanationJa: Explanation in Japanese (optional)
- difficulty: Number 1-5
- tags: Array of relevant tags`;
  }

  /**
   * Generate the user prompt
   */
  getUserPrompt(request: ReviewQuestionRequest, config?: TaskConfig): string {
    const { kanji, vocabulary, grammar, context } = request.content;
    const questionCount = request.questionCount || 5;
    const questionTypes = request.questionTypes || ['multiple_choice', 'fill_blank'];
    const jlptLevel = config?.jlptLevel || 'N5';
    const difficulty = config?.difficulty || 'medium';

    let contentDescription = 'Create review questions for:\n';

    if (kanji && kanji.length > 0) {
      contentDescription += `\nKANJI (${kanji.length} characters):\n`;
      contentDescription += kanji.map(k => `- ${k}`).join('\n');
    }

    if (vocabulary && vocabulary.length > 0) {
      contentDescription += `\n\nVOCABULARY (${vocabulary.length} words):\n`;
      contentDescription += vocabulary.map(v =>
        `- ${v.word} (${v.reading}) - ${v.meaning}`
      ).join('\n');
    }

    if (grammar && grammar.length > 0) {
      contentDescription += `\n\nGRAMMAR POINTS:\n`;
      contentDescription += grammar.map(g => `- ${g}`).join('\n');
    }

    if (context) {
      contentDescription += `\n\nCONTEXT:\n${context}`;
    }

    return `${contentDescription}

Generate exactly ${questionCount} questions.
Use these question types: ${questionTypes.join(', ')}
Target difficulty: ${difficulty}
JLPT Level: ${jlptLevel}

Ensure questions:
1. Test different aspects of the content
2. Progress from easier to harder
3. Include practical usage examples
4. Are appropriate for ${jlptLevel} learners
5. Have clear, unambiguous correct answers

Return ONLY a valid JSON array of question objects.`;
  }

  /**
   * Parse the AI response
   */
  parseResponse(response: string): ReviewQuestion[] {
    const parsed = this.parseJSON<ReviewQuestion[]>(response);

    if (!Array.isArray(parsed)) {
      throw new AIServiceError(
        'Response must be an array of questions',
        'INVALID_RESPONSE_FORMAT',
        500
      );
    }

    return parsed;
  }

  /**
   * Enhance and validate generated questions
   */
  private enhanceQuestions(
    questions: ReviewQuestion[],
    request: ReviewQuestionRequest,
    config?: TaskConfig
  ): ReviewQuestion[] {
    return questions.map((q, index) => {
      // Ensure ID
      if (!q.id) {
        q.id = `q${index + 1}`;
      }

      // Validate question type
      const validTypes = ['multiple_choice', 'fill_blank', 'true_false', 'matching', 'ordering'];
      if (!validTypes.includes(q.type)) {
        q.type = 'multiple_choice'; // Default to multiple choice
      }

      // Validate difficulty
      if (!q.difficulty || q.difficulty < 1 || q.difficulty > 5) {
        q.difficulty = this.calculateDifficulty(q, config);
      }

      // Add tags if not present
      if (!q.tags || q.tags.length === 0) {
        q.tags = this.generateTags(q, request, config);
      }

      // Validate multiple choice options
      if (q.type === 'multiple_choice' && (!q.options || q.options.length < 2)) {
        throw new AIServiceError(
          `Multiple choice question ${q.id} must have at least 2 options`,
          'INVALID_QUESTION',
          500
        );
      }

      // Ensure explanation exists
      if (!q.explanation) {
        q.explanation = 'Study this concept carefully for better understanding.';
      }

      return q;
    });
  }

  /**
   * Calculate question difficulty based on content
   */
  private calculateDifficulty(question: ReviewQuestion, config?: TaskConfig): number {
    const jlptLevel = config?.jlptLevel || 'N5';
    const baseDifficulty = {
      'N5': 1,
      'N4': 2,
      'N3': 3,
      'N2': 4,
      'N1': 5
    }[jlptLevel] || 3;

    // Adjust based on question type
    const typeAdjustment = {
      'multiple_choice': 0,
      'true_false': -0.5,
      'fill_blank': 0.5,
      'matching': 0.5,
      'ordering': 1
    }[question.type] || 0;

    // Calculate final difficulty
    const difficulty = Math.max(1, Math.min(5, baseDifficulty + typeAdjustment));
    return Math.round(difficulty);
  }

  /**
   * Generate tags for a question
   */
  private generateTags(
    question: ReviewQuestion,
    request: ReviewQuestionRequest,
    config?: TaskConfig
  ): string[] {
    const tags: string[] = [];

    // Add JLPT level
    if (config?.jlptLevel) {
      tags.push(config.jlptLevel.toLowerCase());
    }

    // Add question type
    tags.push(question.type);

    // Add content type tags
    if (request.content.kanji?.length) {
      tags.push('kanji');
    }
    if (request.content.vocabulary?.length) {
      tags.push('vocabulary');
    }
    if (request.content.grammar?.length) {
      tags.push('grammar');
    }

    // Add difficulty tag
    const difficultyLabels = ['very-easy', 'easy', 'medium', 'hard', 'very-hard'];
    tags.push(difficultyLabels[question.difficulty - 1] || 'medium');

    return tags;
  }

  /**
   * Get content types from request
   */
  private getContentTypes(request: ReviewQuestionRequest): string[] {
    const types: string[] = [];

    if (request.content.kanji?.length) types.push('kanji');
    if (request.content.vocabulary?.length) types.push('vocabulary');
    if (request.content.grammar?.length) types.push('grammar');
    if (request.content.context) types.push('context');

    return types;
  }

  /**
   * Generate questions for specific kanji
   */
  async generateKanjiQuestions(
    kanji: string[],
    config?: TaskConfig
  ): Promise<ProcessorResult<ReviewQuestion[]>> {
    return this.process({
      content: { kanji },
      questionCount: config?.difficulty === 'hard' ? 10 : 5,
      questionTypes: ['multiple_choice', 'fill_blank', 'matching']
    }, config);
  }

  /**
   * Generate vocabulary questions
   */
  async generateVocabularyQuestions(
    vocabulary: Array<{ word: string; reading: string; meaning: string }>,
    config?: TaskConfig
  ): Promise<ProcessorResult<ReviewQuestion[]>> {
    return this.process({
      content: { vocabulary },
      questionCount: Math.min(vocabulary.length * 2, 20),
      questionTypes: ['multiple_choice', 'fill_blank', 'true_false']
    }, config);
  }

  /**
   * Generate grammar questions
   */
  async generateGrammarQuestions(
    grammar: string[],
    context?: string,
    config?: TaskConfig
  ): Promise<ProcessorResult<ReviewQuestion[]>> {
    return this.process({
      content: { grammar, context },
      questionCount: grammar.length * 3,
      questionTypes: ['multiple_choice', 'fill_blank', 'ordering']
    }, config);
  }
}