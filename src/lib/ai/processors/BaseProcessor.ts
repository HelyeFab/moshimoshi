/**
 * Base Processor for AI Tasks
 * Abstract class that all AI task processors extend from
 */

import OpenAI from 'openai';
import {
  AIModel,
  AIServiceConfig,
  ProcessorContext,
  ProcessorResult,
  TaskConfig,
  TokenUsage,
  AIServiceError,
  MODEL_PRICING
} from '../types';

export abstract class BaseProcessor<TRequest = any, TResponse = any> {
  protected context: ProcessorContext;
  protected openai: OpenAI | null = null;
  protected defaultConfig: AIServiceConfig;

  constructor(context: ProcessorContext) {
    this.context = context;
    this.defaultConfig = {
      temperature: 0.7,
      maxTokens: 4000,
      timeout: 30000,
      maxRetries: 2,
      stream: false,
      cacheResults: true,
      cacheDuration: 3600 // 1 hour default
    };

    this.initializeOpenAI();
  }

  /**
   * Initialize OpenAI client
   */
  private initializeOpenAI(): void {
    const apiKey = process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AIServiceError(
        'OpenAI API key not configured',
        'OPENAI_NOT_CONFIGURED',
        500
      );
    }

    this.openai = new OpenAI({
      apiKey,
      timeout: this.context.config.timeout || this.defaultConfig.timeout,
      maxRetries: this.context.config.maxRetries || this.defaultConfig.maxRetries
    });
  }

  /**
   * Main processing method - must be implemented by subclasses
   */
  abstract process(request: TRequest, config?: TaskConfig): Promise<ProcessorResult<TResponse>>;

  /**
   * Validate the request - must be implemented by subclasses
   */
  abstract validateRequest(request: TRequest): void;

  /**
   * Generate the prompt for OpenAI - must be implemented by subclasses
   */
  abstract getSystemPrompt(config?: TaskConfig): string;
  abstract getUserPrompt(request: TRequest, config?: TaskConfig): string;

  /**
   * Parse the AI response - must be implemented by subclasses
   */
  abstract parseResponse(response: string): TResponse;

  /**
   * Common method to call OpenAI
   */
  protected async callOpenAI(
    systemPrompt: string,
    userPrompt: string,
    config?: Partial<AIServiceConfig>
  ): Promise<{
    content: string;
    usage: TokenUsage;
  }> {
    if (!this.openai) {
      throw new AIServiceError(
        'OpenAI client not initialized',
        'OPENAI_NOT_INITIALIZED',
        500
      );
    }

    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...this.context.config, ...config };

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.context.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: mergedConfig.temperature,
        max_tokens: mergedConfig.maxTokens,
        response_format: { type: 'json_object' } // Most of our responses are JSON
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new AIServiceError(
          'No response from OpenAI',
          'EMPTY_RESPONSE',
          500
        );
      }

      const usage = this.calculateUsage(completion.usage);
      const processingTime = Date.now() - startTime;

      console.log(`✅ AI Task completed in ${processingTime}ms using ${this.context.model}`);
      console.log(`📊 Tokens: ${usage.totalTokens} | Cost: $${usage.estimatedCost.toFixed(4)}`);

      return {
        content: response,
        usage
      };
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ OpenAI API error:', errorMessage);

      // Handle specific OpenAI errors
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) {
          throw new AIServiceError(
            'Rate limit exceeded. Please try again later.',
            'RATE_LIMIT',
            429
          );
        } else if (error.status === 401) {
          throw new AIServiceError(
            'Invalid API key',
            'AUTH_FAILED',
            401
          );
        } else if (error.status === 500) {
          throw new AIServiceError(
            'OpenAI service error. Please try again.',
            'SERVICE_ERROR',
            500
          );
        }
      }

      throw new AIServiceError(
        `Failed to process AI request: ${errorMessage}`,
        'PROCESSING_FAILED',
        500,
        { originalError: errorMessage }
      );
    }
  }

  /**
   * Calculate token usage and cost
   */
  protected calculateUsage(usage?: OpenAI.CompletionUsage): TokenUsage {
    if (!usage) {
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      };
    }

    const pricing = MODEL_PRICING[this.context.model];
    const promptCost = (usage.prompt_tokens / 1000) * pricing.inputCostPer1k;
    const completionCost = (usage.completion_tokens / 1000) * pricing.outputCostPer1k;

    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      estimatedCost: promptCost + completionCost
    };
  }

  /**
   * Stream response (for long-form content)
   */
  protected async streamOpenAI(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    config?: Partial<AIServiceConfig>
  ): Promise<{
    fullContent: string;
    usage: TokenUsage;
  }> {
    if (!this.openai) {
      throw new AIServiceError(
        'OpenAI client not initialized',
        'OPENAI_NOT_INITIALIZED',
        500
      );
    }

    const mergedConfig = { ...this.defaultConfig, ...this.context.config, ...config };
    let fullContent = '';

    try {
      const stream = await this.openai.chat.completions.create({
        model: this.context.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: mergedConfig.temperature,
        max_tokens: mergedConfig.maxTokens,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          onChunk(content);
        }
      }

      // Estimate usage for streaming (OpenAI doesn't provide it directly)
      const estimatedTokens = this.estimateTokens(systemPrompt + userPrompt + fullContent);
      const usage = this.calculateUsageFromTokenCount(estimatedTokens);

      return {
        fullContent,
        usage
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AIServiceError(
        `Streaming failed: ${errorMessage}`,
        'STREAMING_FAILED',
        500
      );
    }
  }

  /**
   * Estimate token count (rough estimation)
   */
  protected estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English, ~2 for Japanese
    const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
    const charsPerToken = hasJapanese ? 2 : 4;
    return Math.ceil(text.length / charsPerToken);
  }

  /**
   * Calculate usage from token count
   */
  protected calculateUsageFromTokenCount(totalTokens: number): TokenUsage {
    const pricing = MODEL_PRICING[this.context.model];
    // Assume 60% prompt, 40% completion for estimation
    const promptTokens = Math.floor(totalTokens * 0.6);
    const completionTokens = totalTokens - promptTokens;

    const promptCost = (promptTokens / 1000) * pricing.inputCostPer1k;
    const completionCost = (completionTokens / 1000) * pricing.outputCostPer1k;

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost: promptCost + completionCost
    };
  }

  /**
   * Helper to safely parse JSON response
   */
  protected parseJSON<T>(response: string): T {
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse AI response as JSON:', response);
      throw new AIServiceError(
        'Invalid response format from AI',
        'INVALID_RESPONSE_FORMAT',
        500,
        { response }
      );
    }
  }

  /**
   * Helper to validate required fields
   */
  protected validateRequiredFields(obj: any, fields: string[]): void {
    const missing = fields.filter(field => !obj[field]);
    if (missing.length > 0) {
      throw new AIServiceError(
        `Missing required fields: ${missing.join(', ')}`,
        'VALIDATION_ERROR',
        400
      );
    }
  }

  /**
   * Helper to truncate text if needed
   */
  protected truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Helper to split text into chunks for large inputs
   */
  protected splitIntoChunks(text: string, maxChunkSize: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[。！？\n]+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChunkSize) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '。' : '') + sentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  }

  /**
   * Get optimal model for task complexity
   */
  protected selectOptimalModel(
    complexity: 'low' | 'medium' | 'high',
    preferredModel?: AIModel
  ): AIModel {
    if (preferredModel) return preferredModel;

    switch (complexity) {
      case 'low':
        return 'gpt-3.5-turbo';
      case 'medium':
        return 'gpt-4o-mini';
      case 'high':
        return 'gpt-4o';
      default:
        return 'gpt-4o-mini';
    }
  }
}