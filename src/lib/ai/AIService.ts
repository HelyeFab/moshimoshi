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
  GrammarSentenceExplanationRequest,
  WordExplanationRequest,
  WordExplanation,
  TranscriptProcessRequest,
  ProcessedTranscript,
  ArticleProcessRequest,
  ProcessedArticle,
  StoryGenerationRequest,
  GeneratedStory,
  MoodboardGenerationRequest,
  GeneratedMoodboard,
  ImageGenerationRequest,
  GeneratedImage,
  CharacterModelSheetRequest,
  GeneratedModelSheet,
  ImagePromptEnhancementRequest,
  EnhancedImagePrompt,
  ImageStorageRequest,
  StoredImage
} from './types';

import { ReviewQuestionProcessor } from './processors/ReviewQuestionProcessor';
import { GrammarExplainerProcessor } from './processors/GrammarExplainerProcessor';
import { GrammarSentenceProcessor } from './processors/GrammarSentenceProcessor';
import { WordExplainerProcessor } from './processors/WordExplainerProcessor';
import { TranscriptProcessor } from './processors/TranscriptProcessor';
import { StoryProcessor } from './processors/StoryProcessor';
import { MoodboardProcessor } from './processors/MoodboardProcessor';
import { MultiStepStoryProcessor } from './processors/MultiStepStoryProcessor';
import { ImageProcessor } from './processors/ImageProcessor';
import { ImageStorageProcessor } from './processors/ImageStorageProcessor';
// import { ArticleProcessor } from './processors/ArticleProcessor';

import { PersistentCacheManager } from './cache/PersistentCacheManager';
import { UsageTracker } from './utils/UsageTracker';

export class AIService {
  private static instance: AIService;
  private cacheManager: PersistentCacheManager;
  private usageTracker: UsageTracker;
  private defaultConfig: AIServiceConfig;

  private constructor() {
    this.cacheManager = new PersistentCacheManager();
    this.usageTracker = new UsageTracker();
    this.defaultConfig = {
      model: 'gpt-4o-mini' as AIModel, // Single model - GPT-4o-mini for cost efficiency
      temperature: 0.7,
      maxTokens: 4000,
      timeout: 30000,
      maxRetries: 2,
      stream: false,
      cacheResults: true,
      cacheDuration: 7200 // 2 hours default
    };

    // Schedule periodic cleanup
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        this.cacheManager.cleanupExpiredFirestore();
      }, 30 * 60 * 1000); // Every 30 minutes
    }
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
      const processingTime = Date.now() - startTime;
      const model = this.selectModel(request);

      // Enhanced error logging
      console.error('❌ AI Service Error:', {
        task: request.task,
        error: error instanceof Error ? error.message : String(error),
        code: error instanceof AIServiceError ? error.code : 'UNKNOWN',
        processingTime: `${processingTime}ms`
      });

      if (error instanceof AIServiceError) {
        // Track failed requests
        await this.usageTracker.track({
          task: request.task,
          model: model || 'gpt-4o-mini',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
          userId: request.metadata?.userId,
          timestamp: new Date()
        });

        return {
          success: false,
          error: error.message,
          processingTime,
          metadata: {
            errorCode: error.code,
            errorDetails: error.details,
            task: request.task,
            modelUsed: model
          }
        };
      }

      // Map common errors to specific codes
      let errorCode = 'UNKNOWN_ERROR';
      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      if (errorMessage.includes('Rate limit')) {
        errorCode = 'RATE_LIMIT';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        errorCode = 'TIMEOUT';
      } else if (errorMessage.includes('Invalid API key') || errorMessage.includes('401')) {
        errorCode = 'AUTH_FAILED';
      } else if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
        errorCode = 'PARSE_ERROR';
      }

      return {
        success: false,
        error: errorMessage,
        processingTime,
        metadata: {
          errorCode,
          task: request.task,
          modelUsed: model,
          originalError: process.env.NODE_ENV === 'development' ? String(error) : undefined
        }
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
      'explain_grammar_sentence',
      'explain_word',
      'clean_transcript',
      'process_article',
      'generate_story',
      'generate_story_multistep',
      'generate_moodboard',
      'generate_image',
      'generate_character_model_sheet',
      'enhance_image_prompt',
      'store_image',
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
    // ALWAYS use gpt-4o-mini for all tasks - single model for cost efficiency
    return 'gpt-4o-mini';
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

      case 'explain_grammar_sentence':
        const grammarSentenceProcessor = new GrammarSentenceProcessor(context);
        return await grammarSentenceProcessor.process(
          request.content as GrammarSentenceExplanationRequest,
          request.config
        );

      case 'explain_word':
        const wordProcessor = new WordExplainerProcessor(context);
        return await wordProcessor.process(
          request.content as WordExplanationRequest,
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

      case 'generate_image':
        const imageProcessor = new ImageProcessor(context);
        return await imageProcessor.process(
          request.content as ImageGenerationRequest,
          request.config
        );

      case 'generate_character_model_sheet':
        const modelSheetProcessor = new ImageProcessor(context);
        return await modelSheetProcessor.generateModelSheet(
          request.content as CharacterModelSheetRequest,
          request.config
        );

      case 'enhance_image_prompt':
        const promptEnhancer = new ImageProcessor(context);
        return await promptEnhancer.enhancePrompt(
          request.content as ImagePromptEnhancementRequest,
          request.config
        );

      case 'store_image':
        const storageProcessor = new ImageStorageProcessor(context);
        return await storageProcessor.process(
          request.content as ImageStorageRequest,
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
   * Cache the result with intelligent duration
   */
  private async cacheResult(request: AIRequest, result: any): Promise<void> {
    const cacheKey = this.generateCacheKey(request);

    // Intelligent cache duration based on task type
    let duration = request.config?.cacheDuration;
    if (!duration) {
      switch (request.task) {
        case 'clean_transcript':
        case 'fix_transcript':
          duration = 86400; // 24 hours for transcripts
          break;
        case 'explain_grammar':
        case 'explain_word':
          duration = 604800; // 7 days for grammar/word (rarely changes)
          break;
        case 'generate_story':
        case 'generate_moodboard':
          duration = 43200; // 12 hours for generated content
          break;
        case 'generate_review_questions':
        case 'generate_quiz':
          duration = 3600; // 1 hour for dynamic content
          break;
        default:
          duration = this.defaultConfig.cacheDuration || 7200;
      }
    }

    await this.cacheManager.set(cacheKey, result, duration, {
      task: request.task,
      model: result.model || this.defaultConfig.model,
      userId: request.metadata?.userId,
      cost: result.usage?.estimatedCost || 0
    });

    console.log(`💾 Cached for ${duration}s: ${request.task}`);
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

  async explainGrammarSentence(
    request: GrammarSentenceExplanationRequest,
    config?: TaskConfig
  ): Promise<AIResponse<GrammarExplanation>> {
    return this.process({
      task: 'explain_grammar_sentence',
      content: request,
      config
    });
  }

  async explainWord(
    request: WordExplanationRequest,
    config?: TaskConfig
  ): Promise<AIResponse<WordExplanation>> {
    return this.process({
      task: 'explain_word',
      content: request,
      config
    });
  }

  async processTranscript(
    request: TranscriptProcessRequest,
    config?: TaskConfig
  ): Promise<AIResponse<ProcessedTranscript>> {
    const task: AITaskType =
      request.fixErrors || request.improveNaturalness ? 'fix_transcript' : 'clean_transcript';

    const mergedConfig: TaskConfig | undefined =
      request.includeTranslations !== undefined || config
        ? {
            ...(config || {}),
            ...(request.includeTranslations !== undefined
              ? { includeTranslations: request.includeTranslations }
              : {})
          }
        : undefined;

    const requestWithDefaults =
      request.includeTranslations === undefined && mergedConfig?.includeTranslations !== undefined
        ? { ...request, includeTranslations: mergedConfig.includeTranslations as boolean }
        : request;

    return this.process<ProcessedTranscript>({
      task,
      content: requestWithDefaults,
      config: mergedConfig
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
