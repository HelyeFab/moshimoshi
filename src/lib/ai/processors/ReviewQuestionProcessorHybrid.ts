/**
 * Review Question Processor Hybrid
 * Extends ReviewQuestionProcessor with Ollama support
 * Uses Ollama by default (background generation task)
 */

import { ReviewQuestionProcessor } from './ReviewQuestionProcessor';
import { OllamaClient } from '../clients/OllamaClient';
import { getProviderConfig, getOllamaConfig, selectProvider, providerHealth } from '../config/providers';
import type {
  ProcessorContext,
  ProcessorResult,
  TaskConfig,
  ReviewQuestionRequest,
  ReviewQuestion
} from '../types';

export class ReviewQuestionProcessorHybrid extends ReviewQuestionProcessor {
  private ollamaClient: OllamaClient | null = null;
  private providerConfig = getProviderConfig();

  constructor(context: ProcessorContext) {
    super(context);

    // Initialize Ollama client if enabled
    if (this.providerConfig.enabled.ollama) {
      const ollamaConfig = getOllamaConfig();
      this.ollamaClient = new OllamaClient(ollamaConfig);
    }
  }

  /**
   * Process review question generation with provider selection
   */
  async process(
    request: ReviewQuestionRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<ReviewQuestion[]>> {
    const provider = selectProvider('generate_review_questions', this.providerConfig);
    const contentTypes = this.getContentTypes(request);
    console.log(`🤖 Using ${provider} for review questions: ${contentTypes.join(', ')}`);

    try {
      if (provider === 'ollama' && this.ollamaClient) {
        return await this.processWithOllama(request, config);
      } else {
        return await this.processWithOpenAI(request, config);
      }
    } catch (error) {
      console.error(`❌ ${provider} failed:`, error);
      providerHealth.markUnhealthy(provider);

      const fallback = this.providerConfig.fallback;
      console.warn(`⚠️ Falling back to ${fallback}`);

      if (fallback === 'openai') {
        return await this.processWithOpenAI(request, config);
      }
      throw error;
    }
  }

  /**
   * Process with OpenAI (calls parent implementation)
   */
  private async processWithOpenAI(
    request: ReviewQuestionRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<ReviewQuestion[]>> {
    return super.process(request, config);
  }

  /**
   * Process with Ollama
   */
  private async processWithOllama(
    request: ReviewQuestionRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<ReviewQuestion[]>> {
    if (!this.ollamaClient) {
      throw new Error('Ollama client not initialized');
    }

    const startTime = Date.now();

    // Validate request
    this.validateRequest(request);

    // Get optimized prompts for Ollama
    const systemPrompt = this.getSystemPromptForOllama(config);
    const userPrompt = this.getUserPromptForOllama(request, config);

    // Call Ollama with JSON mode
    const response = await this.ollamaClient.generate({
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      format: 'json',
      options: {
        temperature: 0.6, // Balanced for varied questions
        num_predict: 1000, // Questions need reasonable space
        top_p: 0.9
      }
    });

    // Parse response
    const questions = this.parseResponse(response.response);

    // Enhance questions (replicate parent logic)
    const enhanced = this.enhanceQuestionsLocal(questions, request, config);

    const duration = Date.now() - startTime;
    providerHealth.markHealthy('ollama');

    return {
      data: enhanced,
      usage: {
        promptTokens: OllamaClient.estimateTokens(systemPrompt + userPrompt),
        completionTokens: OllamaClient.estimateTokens(response.response),
        totalTokens: response.total_duration ? Math.floor(response.total_duration / 1000000) : 0,
        estimatedCost: 0
      },
      metadata: {
        provider: 'ollama',
        model: 'qwen2.5:7b',
        processingTime: duration,
        questionCount: enhanced.length,
        contentTypes: this.getContentTypes(request),
        jlptLevel: config?.jlptLevel
      }
    };
  }

  /**
   * Get optimized system prompt for Ollama
   */
  private getSystemPromptForOllama(config?: TaskConfig): string {
    const jlptLevel = config?.jlptLevel || 'N5';

    return `You are a Japanese teacher creating review questions for ${jlptLevel} students.

TYPES:
- multiple_choice: 4 options, 1 correct
- fill_blank: Missing word/phrase
- true_false: Statement evaluation
- matching: Match items
- ordering: Correct sequence

DIFFICULTY (1-5):
1 = Very Easy (recognition)
2 = Easy (recall)
3 = Medium (application)
4 = Hard (analysis)
5 = Very Hard (complex)

Return JSON array:
[{
  "id": "q1",
  "type": "multiple_choice",
  "question": "English question",
  "questionJa": "日本語質問 (optional)",
  "options": ["opt1", "opt2", "opt3", "opt4"],
  "correctAnswer": 0,
  "explanation": "Why correct",
  "explanationJa": "説明 (optional)",
  "difficulty": 1,
  "tags": ["tag1", "tag2"]
}]

Requirements:
1. Educational for ${jlptLevel}
2. Test understanding, not just memory
3. Mix difficulty levels
4. Clear explanations
5. Natural Japanese
6. SRS best practices`;
  }

  /**
   * Get optimized user prompt for Ollama
   */
  private getUserPromptForOllama(
    request: ReviewQuestionRequest,
    config?: TaskConfig
  ): string {
    const { kanji, vocabulary, grammar, context } = request.content;
    const questionCount = request.questionCount || 5;
    const questionTypes = request.questionTypes || ['multiple_choice', 'fill_blank'];
    const jlptLevel = config?.jlptLevel || 'N5';
    const difficulty = config?.difficulty || 'medium';

    let prompt = 'Create review questions for:\n';

    if (kanji && kanji.length > 0) {
      prompt += `\nKANJI (${kanji.length}): ${kanji.join(', ')}`;
    }

    if (vocabulary && vocabulary.length > 0) {
      prompt += `\nVOCAB (${vocabulary.length}):\n`;
      prompt += vocabulary.map(v => `${v.word}(${v.reading})-${v.meaning}`).join(', ');
    }

    if (grammar && grammar.length > 0) {
      prompt += `\nGRAMMAR: ${grammar.join(', ')}`;
    }

    if (context) {
      prompt += `\nCONTEXT: ${context}`;
    }

    prompt += `\n\nGenerate ${questionCount} questions
Types: ${questionTypes.join(', ')}
Difficulty: ${difficulty}
JLPT: ${jlptLevel}

Requirements:
1. Test different aspects
2. Easy to harder progression
3. Practical examples
4. Clear answers
5. Appropriate for ${jlptLevel}`;

    return prompt;
  }

  /**
   * Local enhancement method (replicates parent logic)
   */
  private enhanceQuestionsLocal(
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
        q.type = 'multiple_choice';
      }

      // Validate difficulty
      if (!q.difficulty || q.difficulty < 1 || q.difficulty > 5) {
        q.difficulty = this.calculateDifficultyLocal(q, config);
      }

      // Add tags if not present
      if (!q.tags || q.tags.length === 0) {
        q.tags = this.generateTagsLocal(q, request, config);
      }

      // Ensure explanation exists
      if (!q.explanation) {
        q.explanation = 'Study this concept carefully.';
      }

      return q;
    });
  }

  /**
   * Calculate difficulty locally
   */
  private calculateDifficultyLocal(question: ReviewQuestion, config?: TaskConfig): number {
    const jlptLevel = config?.jlptLevel || 'N5';
    const baseDifficulty = {
      'N5': 1,
      'N4': 2,
      'N3': 3,
      'N2': 4,
      'N1': 5
    }[jlptLevel] || 3;

    const typeAdjustment = {
      'multiple_choice': 0,
      'true_false': -0.5,
      'fill_blank': 0.5,
      'matching': 0.5,
      'ordering': 1
    }[question.type] || 0;

    const difficulty = Math.max(1, Math.min(5, baseDifficulty + typeAdjustment));
    return Math.round(difficulty);
  }

  /**
   * Generate tags locally
   */
  private generateTagsLocal(
    question: ReviewQuestion,
    request: ReviewQuestionRequest,
    config?: TaskConfig
  ): string[] {
    const tags: string[] = [];

    if (config?.jlptLevel) {
      tags.push(config.jlptLevel.toLowerCase());
    }

    tags.push(question.type);

    if (request.content.kanji?.length) tags.push('kanji');
    if (request.content.vocabulary?.length) tags.push('vocabulary');
    if (request.content.grammar?.length) tags.push('grammar');

    const difficultyLabels = ['very-easy', 'easy', 'medium', 'hard', 'very-hard'];
    tags.push(difficultyLabels[question.difficulty - 1] || 'medium');

    return tags;
  }

  /**
   * Get content types
   */
  private getContentTypes(request: ReviewQuestionRequest): string[] {
    const types: string[] = [];

    if (request.content.kanji?.length) types.push('kanji');
    if (request.content.vocabulary?.length) types.push('vocabulary');
    if (request.content.grammar?.length) types.push('grammar');
    if (request.content.context) types.push('context');

    return types;
  }
}
