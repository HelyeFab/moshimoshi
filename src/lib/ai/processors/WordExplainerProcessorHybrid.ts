/**
 * Hybrid Word Explainer Processor
 * Can use either OpenAI or Ollama based on configuration
 *
 * SAFE: Does not modify existing WordExplainerProcessor
 * ROLLBACK: Just don't use this file, use original processor
 */

import { WordExplainerProcessor } from './WordExplainerProcessor';
import { OllamaClient } from '../clients/OllamaClient';
import { getProviderConfig, getOllamaConfig, selectProvider, providerHealth } from '../config/providers';
import type { ProcessorContext, ProcessorResult, TaskConfig, WordExplanationRequest, WordExplanation } from '../types';

export class WordExplainerProcessorHybrid extends WordExplainerProcessor {
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
   * Process request with automatic provider selection and fallback
   */
  async process(
    request: WordExplanationRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<WordExplanation>> {
    // Determine which provider to use
    const provider = selectProvider('explain_word', this.providerConfig);

    console.log(`🤖 Using ${provider} for word explanation: ${request.word}`);

    // Try primary provider
    try {
      if (provider === 'ollama' && this.ollamaClient) {
        return await this.processWithOllama(request, config);
      } else {
        return await this.processWithOpenAI(request, config);
      }
    } catch (error) {
      console.error(`❌ ${provider} failed:`, error);

      // Mark provider as unhealthy
      providerHealth.markUnhealthy(provider);

      // Fallback to alternative provider
      const fallback = this.providerConfig.fallback;
      console.warn(`⚠️ Falling back to ${fallback}`);

      if (fallback === 'openai') {
        return await this.processWithOpenAI(request, config);
      } else if (fallback === 'ollama' && this.ollamaClient) {
        return await this.processWithOllama(request, config);
      }

      // If both fail, re-throw error
      throw error;
    }
  }

  /**
   * Process with OpenAI (uses existing parent class logic)
   */
  private async processWithOpenAI(
    request: WordExplanationRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<WordExplanation>> {
    // Call parent class implementation (existing OpenAI logic)
    return await super.process(request, config);
  }

  /**
   * Process with Ollama (new implementation)
   */
  private async processWithOllama(
    request: WordExplanationRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<WordExplanation>> {
    if (!this.ollamaClient) {
      throw new Error('Ollama client not initialized');
    }

    const startTime = Date.now();

    // Build optimized prompt for Ollama
    const systemPrompt = this.getSystemPromptForOllama(config);
    const userPrompt = this.getUserPromptForOllama(request, config);

    // Call Ollama with JSON mode
    const response = await this.ollamaClient.generate({
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      format: 'json',
      options: {
        temperature: 0.5,  // Lower for factual responses
        num_predict: 300,   // Limit tokens for faster response
        top_p: 0.9
      }
    });

    // Parse response
    const explanation = this.parseResponse(response.response);

    // Mark provider as healthy
    providerHealth.markHealthy('ollama');

    // Calculate usage (estimate for Ollama since it doesn't provide token counts)
    const estimatedPromptTokens = OllamaClient.estimateTokens(systemPrompt + userPrompt);
    const estimatedCompletionTokens = OllamaClient.estimateTokens(response.response);

    return {
      data: explanation,
      usage: {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
        estimatedCost: 0  // Ollama is free!
      },
      metadata: {
        provider: 'ollama',
        model: response.model,
        processingTime: Date.now() - startTime,
        actualDuration: response.total_duration ? response.total_duration / 1e9 : undefined
      }
    };
  }

  /**
   * Get optimized system prompt for Ollama (shorter = faster)
   */
  private getSystemPromptForOllama(config?: TaskConfig): string {
    const jlptLevel = config?.jlptLevel || 'N5';

    return `Japanese dictionary for ${jlptLevel} learners. Return JSON:
{
  "word": "kanji",
  "reading": "hiragana",
  "romaji": "romaji",
  "meaning": "English",
  "partOfSpeech": "type",
  "kanjiBreakdown": [{"kanji":"X","kun":["y"],"on":["Z"],"meaning":"M"}],
  "conjugation": {"type":"verb/i-adj/na-adj","forms":{"present":"x","past":"y"}},
  "pitchAccent": {"pattern":"LH","moraCount":3},
  "relatedWords": {"synonyms":[],"antonyms":[],"compounds":[]},
  "jlptLevel": "N5-N1",
  "examples": [{"japanese":"x","furigana":"y","translation":"z"}]
}`;
  }

  /**
   * Get optimized user prompt for Ollama
   */
  private getUserPromptForOllama(request: WordExplanationRequest, config?: TaskConfig): string {
    const lines: string[] = [`Word: ${request.word}`];

    if (request.context) {
      lines.push(`Context: ${request.context.substring(0, 200)}`);  // Limit context length
    }

    lines.push('Return complete JSON.');
    return lines.join('\n');
  }
}
