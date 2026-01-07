/**
 * Grammar Sentence Processor Hybrid
 * Extends GrammarSentenceProcessor with Ollama support
 * Uses OpenAI by default (real-time interactive feature)
 */

import { GrammarSentenceProcessor } from './GrammarSentenceProcessor';
import { OllamaClient } from '../clients/OllamaClient';
import { getProviderConfig, getOllamaConfig, selectProvider, providerHealth } from '../config/providers';
import type {
  ProcessorContext,
  ProcessorResult,
  TaskConfig,
  GrammarSentenceExplanationRequest,
  GrammarExplanation
} from '../types';

export class GrammarSentenceProcessorHybrid extends GrammarSentenceProcessor {
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
   * Process grammar sentence explanation with provider selection
   */
  async process(
    request: GrammarSentenceExplanationRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<GrammarExplanation>> {
    const provider = selectProvider('explain_grammar_sentence', this.providerConfig);
    console.log(`🤖 Using ${provider} for sentence grammar: ${request.sentence.substring(0, 30)}...`);

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
    request: GrammarSentenceExplanationRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<GrammarExplanation>> {
    return super.process(request, config);
  }

  /**
   * Process with Ollama
   */
  private async processWithOllama(
    request: GrammarSentenceExplanationRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<GrammarExplanation>> {
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
        temperature: 0.5,
        num_predict: 700,
        top_p: 0.9
      }
    });

    // Parse response
    const explanation = this.parseResponse(response.response);

    const duration = Date.now() - startTime;
    providerHealth.markHealthy('ollama');

    return {
      data: explanation,
      usage: {
        promptTokens: OllamaClient.estimateTokens(systemPrompt + userPrompt),
        completionTokens: OllamaClient.estimateTokens(response.response),
        totalTokens: response.total_duration ? Math.floor(response.total_duration / 1000000) : 0,
        estimatedCost: 0
      },
      metadata: {
        provider: 'ollama',
        model: response.model,
        processingTime: duration,
        sentence: request.sentence,
        sourceTitle: request.title
      }
    };
  }

  /**
   * Get optimized system prompt for Ollama
   */
  private getSystemPromptForOllama(config?: TaskConfig): string {
    const jlptLevel = config?.jlptLevel || 'N5';
    return `You are a Japanese tutor. Explain grammar in clear English for ${jlptLevel} learners.

Return JSON:
{
  "pattern": "Main pattern title",
  "patternRomaji": "Romaji",
  "meaning": "One paragraph description",
  "structure": "How formed",
  "examples": [
    {
      "japanese": "Example",
      "furigana": "With furigana",
      "translation": "English",
      "notes": "Usage note"
    }
  ],
  "commonMistakes": ["..."],
  "relatedPatterns": ["..."],
  "jlptLevel": "N5-N1",
  "formality": "casual/formal/both"
}`;
  }

  /**
   * Get optimized user prompt for Ollama
   */
  private getUserPromptForOllama(
    request: GrammarSentenceExplanationRequest,
    config?: TaskConfig
  ): string {
    const lines: string[] = [];
    lines.push(`Explain grammar: ${request.sentence.trim()}`);

    if (request.context) {
      lines.push(`Context: ${request.context.trim()}`);
    }

    if (request.surroundingSentences && request.surroundingSentences.length > 0) {
      lines.push(`Nearby: ${request.surroundingSentences.join('; ')}`);
    }

    if (request.focusQuestion) {
      lines.push(`Question: ${request.focusQuestion.trim()}`);
    }

    if (request.title) {
      lines.push(`Source: ${request.title}`);
    }

    return lines.join('\n');
  }
}
