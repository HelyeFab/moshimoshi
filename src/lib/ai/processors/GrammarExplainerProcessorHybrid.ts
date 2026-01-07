/**
 * Grammar Explainer Processor Hybrid
 * Extends GrammarExplainerProcessor with Ollama support
 * Uses OpenAI by default (real-time user task requiring fast response)
 */

import { GrammarExplainerProcessor } from './GrammarExplainerProcessor';
import { OllamaClient } from '../clients/OllamaClient';
import { getProviderConfig, getOllamaConfig, selectProvider, providerHealth } from '../config/providers';
import type {
  ProcessorContext,
  ProcessorResult,
  TaskConfig,
  GrammarExplanationRequest,
  GrammarExplanation
} from '../types';

export class GrammarExplainerProcessorHybrid extends GrammarExplainerProcessor {
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
   * Process grammar explanation with provider selection
   */
  async process(
    request: GrammarExplanationRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<GrammarExplanation>> {
    const provider = selectProvider('explain_grammar', this.providerConfig);
    console.log(`🤖 Using ${provider} for grammar explanation: ${request.content}`);

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
    request: GrammarExplanationRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<GrammarExplanation>> {
    return super.process(request, config);
  }

  /**
   * Process with Ollama
   */
  private async processWithOllama(
    request: GrammarExplanationRequest,
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
        num_predict: 800, // Grammar explanations need more tokens
        top_p: 0.9
      }
    });

    // Parse response
    const explanation = this.parseResponse(response.response);

    // Enhance the explanation
    const enhanced = this.enhanceExplanation(explanation, request, config);

    const duration = Date.now() - startTime;
    providerHealth.markHealthy('ollama');

    return {
      data: enhanced,
      usage: {
        promptTokens: OllamaClient.estimateTokens(systemPrompt + userPrompt),
        completionTokens: OllamaClient.estimateTokens(response.response),
        totalTokens: response.total_duration ? Math.floor(response.total_duration / 1000000) : 0,
        estimatedCost: 0 // Ollama is free!
      },
      metadata: {
        provider: 'ollama',
        model: response.model,
        processingTime: duration,
        grammarPattern: explanation.pattern,
        jlptLevel: explanation.jlptLevel || config?.jlptLevel,
        exampleCount: explanation.examples.length
      }
    };
  }

  /**
   * Get optimized system prompt for Ollama
   */
  private getSystemPromptForOllama(config?: TaskConfig): string {
    const jlptLevel = config?.jlptLevel || 'N5';
    const style = config?.style || 'casual';

    return `You are a Japanese grammar expert. Explain grammar patterns for ${jlptLevel} students.

Return JSON:
{
  "pattern": "Grammar pattern in Japanese",
  "patternRomaji": "Romaji",
  "meaning": "Clear explanation",
  "structure": "How to form (e.g., Verb-て form + います)",
  "examples": [
    {
      "japanese": "Example sentence",
      "furigana": "With furigana",
      "translation": "English",
      "notes": "Usage note"
    }
  ],
  "commonMistakes": ["List of errors"],
  "relatedPatterns": ["Similar patterns"],
  "jlptLevel": "N5/N4/N3/N2/N1",
  "formality": "casual/formal/both"
}`;
  }

  /**
   * Get optimized user prompt for Ollama
   */
  private getUserPromptForOllama(
    request: GrammarExplanationRequest,
    config?: TaskConfig
  ): string {
    const { content, focusPoints, compareWith } = request;
    const jlptLevel = config?.jlptLevel || 'N5';
    const includeExamples = config?.includeExamples !== false;

    let prompt = `Explain: "${content}"\n`;

    if (focusPoints && focusPoints.length > 0) {
      prompt += `Focus: ${focusPoints.join(', ')}\n`;
    }

    if (compareWith && compareWith.length > 0) {
      prompt += `Compare with: ${compareWith.join(', ')}\n`;
    }

    prompt += `JLPT: ${jlptLevel}\nExamples: ${includeExamples ? '3-5' : '1-2'}`;

    return prompt;
  }

  // Note: enhanceExplanation is now protected in parent class - using it directly
}
