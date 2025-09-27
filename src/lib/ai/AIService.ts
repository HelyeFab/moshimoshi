/**
 * Main AI Service
 * Orchestrates all AI processors and provides a unified interface
 */

import {
  AIRequest,
  AIResponse,
  AIModel,
  AIServiceConfig,
  AITaskType,
  ProcessorContext,
  AIServiceError,
  TaskConfig,
  ReviewQuestionRequest,
  ReviewQuestion,
  GrammarExplanationRequest,
  GrammarExplanation,
  TranscriptProcessRequest,
  ProcessedTranscript,
  ArticleProcessRequest,
  ProcessedArticle,
  StoryGenerationRequest,
  GeneratedStory,
  MoodboardGenerationRequest,
  GeneratedMoodboard
} from './types';

import { ReviewQuestionProcessor } from './processors/ReviewQuestionProcessor';
import { GrammarExplainerProcessor } from './processors/GrammarExplainerProcessor';
import { TranscriptProcessor } from './processors/TranscriptProcessor';
import { StoryProcessor } from './processors/StoryProcessor';
import { MoodboardProcessor } from './processors/MoodboardProcessor';
import { MultiStepStoryProcessor } from './processors/MultiStepStoryProcessor';
// import { ArticleProcessor } from './processors/ArticleProcessor';

import { CacheManager } from './cache/CacheManager';
import { UsageTracker } from './utils/UsageTracker';

export class AIService {
  private static instance: AIService;
  private cacheManager: CacheManager;
  private usageTracker: UsageTracker;
  private defaultConfig: AIServiceConfig;

  private constructor() {
    this.cacheManager = new CacheManager();
    this.usageTracker = new UsageTracker();
    this.defaultConfig = {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 4000,
      timeout: 30000,
      maxRetries: 2,
      stream: false,
      cacheResults: true,
      cacheDuration: 3600
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Main processing method
   */
  async process<T = any>(request: AIRequest): Promise<AIResponse<T>> {
    const startTime = Date.now();

    try {
      // Validate request
      this.validateRequest(request);

      // Check cache if enabled
      if (request.config?.cacheResults !== false) {
        const cached = await this.checkCache(request);
        if (cached) {
          return {
            success: true,
            data: cached.data,
            cached: true,
            processingTime: Date.now() - startTime,
            metadata: cached.metadata
          };
        }
      }

      // Select optimal model
      const model = this.selectModel(request);

      // Create processor context
      const context: ProcessorContext = {
        model,
        config: { ...this.defaultConfig, ...request.config },
        userId: request.metadata?.userId,
        sessionId: request.metadata?.sessionId
      };

      // Route to appropriate processor
      const result = await this.routeToProcessor(request, context);

      // Track usage
      await this.usageTracker.track({
        task: request.task,
        model,
        usage: result.usage,
        userId: request.metadata?.userId,
        timestamp: new Date()
      });

      // Cache result if enabled
      if (request.config?.cacheResults !== false) {
        await this.cacheResult(request, result);
      }

      return {
        success: true,
        data: result.data,
        usage: result.usage,
        cached: false,
        processingTime: Date.now() - startTime,
        metadata: {
          modelUsed: model,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalCost: result.usage.estimatedCost,
          processingSteps: result.metadata?.processingSteps
        }
      };

    } catch (error) {
      console.error('AI Service Error:', error);

      if (error instanceof AIServiceError) {
        return {
          success: false,
          error: error.message,
          processingTime: Date.now() - startTime,
          metadata: {
            errorCode: error.code,
            errorDetails: error.details
          }
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validate the request
   */
  private validateRequest(request: AIRequest): void {
    if (!request.task) {
      throw new AIServiceError(
        'Task type is required',
        'MISSING_TASK',
        400
      );
    }

    const validTasks: AITaskType[] = [
      'generate_review_questions',
      'explain_grammar',
      'clean_transcript',
      'process_article',
      'generate_story',
      'generate_moodboard',
      'analyze_content',
      'suggest_improvements',
      'translate_content',
      'simplify_text',
      'generate_quiz',
      'create_flashcards',
      'fix_transcript',
      'extract_vocabulary'
    ];

    if (!validTasks.includes(request.task)) {
      throw new AIServiceError(
        `Invalid task type: ${request.task}`,
        'INVALID_TASK',
        400
      );
    }

    if (!request.content) {
      throw new AIServiceError(
        'Content is required',
        'MISSING_CONTENT',
        400
      );
    }
  }

  /**
   * Select optimal model based on task and configuration
   */
  private selectModel(request: AIRequest): AIModel {
    // If model explicitly specified, use it
    if (request.config?.model) {
      return request.config.model;
    }

    // Task-specific model selection
    const taskModelMap: Record<AITaskType, AIModel> = {
      'generate_review_questions': 'gpt-4o-mini',
      'explain_grammar': 'gpt-4o-mini',
      'clean_transcript': 'gpt-4o-mini',
      'process_article': 'gpt-4o-mini',
      'generate_story': 'gpt-4o-mini',
      'generate_moodboard': 'gpt-4o-mini',
      'analyze_content': 'gpt-4o',
      'suggest_improvements': 'gpt-4o',
      'translate_content': 'gpt-4o-mini',
      'simplify_text': 'gpt-4o-mini',
      'generate_quiz': 'gpt-4o-mini',
      'create_flashcards': 'gpt-3.5-turbo',
      'fix_transcript': 'gpt-4o-mini',
      'extract_vocabulary': 'gpt-3.5-turbo'
    };

    return taskModelMap[request.task] || 'gpt-4o-mini';
  }

  /**
   * Route request to appropriate processor
   */
  private async routeToProcessor(request: AIRequest, context: ProcessorContext): Promise<any> {
    switch (request.task) {
      case 'generate_review_questions':
        const reviewProcessor = new ReviewQuestionProcessor(context);
        return await reviewProcessor.process(
          request.content as ReviewQuestionRequest,
          request.config
        );

      case 'explain_grammar':
        const grammarProcessor = new GrammarExplainerProcessor(context);
        return await grammarProcessor.process(
          request.content as GrammarExplanationRequest,
          request.config
        );

      case 'clean_transcript':
      case 'fix_transcript':
        const transcriptProcessor = new TranscriptProcessor(context);
        return await transcriptProcessor.process(
          request.content as TranscriptProcessRequest,
          request.config
        );

      case 'generate_story':
        const storyProcessor = new StoryProcessor(context);
        return await storyProcessor.process(
          request.content as StoryGenerationRequest,
          request.config
        );

      case 'generate_moodboard':
        const moodboardProcessor = new MoodboardProcessor(context);
        return await moodboardProcessor.process(
          request.content as MoodboardGenerationRequest,
          request.config
        );

      case 'generate_story_multistep':
        const multiStepProcessor = new MultiStepStoryProcessor(context);
        return await multiStepProcessor.process(
          request.content,
          request.config
        );

      // case 'process_article':
      //   const articleProcessor = new ArticleProcessor(context);
      //   return await articleProcessor.process(
      //     request.content as ArticleProcessRequest,
      //     request.config
      //   );

      default:
        throw new AIServiceError(
          `Processor not implemented for task: ${request.task}`,
          'PROCESSOR_NOT_IMPLEMENTED',
          501
        );
    }
  }

  /**
   * Check cache for existing result
   */
  private async checkCache(request: AIRequest): Promise<any | null> {
    const cacheKey = this.generateCacheKey(request);
    return await this.cacheManager.get(cacheKey);
  }

  /**
   * Cache the result
   */
  private async cacheResult(request: AIRequest, result: any): Promise<void> {
    const cacheKey = this.generateCacheKey(request);
    const duration = request.config?.cacheDuration || this.defaultConfig.cacheDuration || 3600;

    await this.cacheManager.set(cacheKey, result, duration, {
      task: request.task,
      model: result.model || this.defaultConfig.model,
      userId: request.metadata?.userId
    });
  }

  /**
   * Generate cache key from request
   */
  private generateCacheKey(request: AIRequest): string {
    const parts = [
      request.task,
      JSON.stringify(request.content),
      JSON.stringify(request.config || {}),
      request.metadata?.userId || 'anonymous'
    ];

    // Create a simple hash
    const str = parts.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return `ai_cache_${request.task}_${hash}`;
  }

  /**
   * Convenience methods for common tasks
   */

  async generateReviewQuestions(
    content: ReviewQuestionRequest['content'],
    config?: TaskConfig
  ): Promise<AIResponse<ReviewQuestion[]>> {
    return this.process({
      task: 'generate_review_questions',
      content: { content } as ReviewQuestionRequest,
      config
    });
  }

  async explainGrammar(
    text: string,
    config?: TaskConfig
  ): Promise<AIResponse<GrammarExplanation>> {
    return this.process({
      task: 'explain_grammar',
      content: { content: text } as GrammarExplanationRequest,
      config
    });
  }

  // Add more convenience methods as processors are implemented

  /**
   * Batch processing for multiple requests
   */
  async processBatch(requests: AIRequest[]): Promise<AIResponse[]> {
    const results = await Promise.allSettled(
      requests.map(req => this.process(req))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          error: result.reason?.message || 'Processing failed',
          metadata: {
            requestIndex: index,
            originalRequest: requests[index]
          }
        };
      }
    });
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(userId?: string, timeRange?: { start: Date; end: Date }) {
    return this.usageTracker.getStats(userId, timeRange);
  }

  /**
   * Clear cache (admin function)
   */
  async clearCache(pattern?: string): Promise<void> {
    await this.cacheManager.clear(pattern);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    openaiConnected: boolean;
    cacheConnected: boolean;
    processorCount: number;
  }> {
    try {
      // Check OpenAI connection
      const openaiConnected = !!(process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY);

      // Check cache connection
      const cacheConnected = await this.cacheManager.healthCheck();

      // Count available processors
      const processorCount = 2; // Currently ReviewQuestion and GrammarExplainer

      return {
        healthy: openaiConnected && cacheConnected,
        openaiConnected,
        cacheConnected,
        processorCount
      };
    } catch (error) {
      return {
        healthy: false,
        openaiConnected: false,
        cacheConnected: false,
        processorCount: 0
      };
    }
  }
}