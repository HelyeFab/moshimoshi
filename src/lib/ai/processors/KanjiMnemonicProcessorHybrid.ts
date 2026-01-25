/**
 * Hybrid Kanji Mnemonic Processor
 * Uses Ollama (Qwen) as primary provider with OpenAI fallback
 *
 * SAFE: Does not modify existing KanjiMnemonicProcessor
 * ROLLBACK: Just don't use this file, use original processor
 */

import { KanjiMnemonicProcessor } from './KanjiMnemonicProcessor';
import { OllamaClient } from '../clients/OllamaClient';
import { getProviderConfig, getOllamaConfig, selectProvider, providerHealth } from '../config/providers';
import type { ProcessorContext, ProcessorResult, TaskConfig, KanjiMnemonicRequest, KanjiMnemonic } from '../types';

export class KanjiMnemonicProcessorHybrid extends KanjiMnemonicProcessor {
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
    request: KanjiMnemonicRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<KanjiMnemonic>> {
    // Validate request first
    this.validateRequest(request);

    // Determine which provider to use
    const provider = selectProvider('generate_kanji_mnemonic', this.providerConfig);

    console.log(`🤖 Using ${provider} for kanji mnemonic: ${request.kanji}`);

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
    request: KanjiMnemonicRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<KanjiMnemonic>> {
    // Call parent class implementation (existing OpenAI logic)
    return await super.process(request, config);
  }

  /**
   * Process with Ollama (optimized implementation)
   */
  private async processWithOllama(
    request: KanjiMnemonicRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<KanjiMnemonic>> {
    if (!this.ollamaClient) {
      throw new Error('Ollama client not initialized');
    }

    const startTime = Date.now();

    // Build optimized prompt for Ollama
    const systemPrompt = this.getSystemPromptForOllama();
    const userPrompt = this.getUserPromptForOllama(request);

    // Call Ollama with JSON mode
    const response = await this.ollamaClient.generate({
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      format: 'json',
      options: {
        temperature: 0.6,  // Slightly creative for memorable stories
        num_predict: 400,  // Mnemonic + components
        top_p: 0.9
      }
    });

    // Parse response
    const parsedResponse = this.parseResponse(response.response);

    // Build full mnemonic object, overriding with request-specific values
    const mnemonic: KanjiMnemonic = {
      ...parsedResponse,
      kanji: request.kanji,
      meaning: request.meaning || parsedResponse.meaning,
      provider: 'ollama'
    };

    // Mark provider as healthy
    providerHealth.markHealthy('ollama');

    // Calculate usage (estimate for Ollama)
    const estimatedPromptTokens = OllamaClient.estimateTokens(systemPrompt + userPrompt);
    const estimatedCompletionTokens = OllamaClient.estimateTokens(response.response);

    return {
      data: mnemonic,
      usage: {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
        estimatedCost: 0  // Ollama is free!
      },
      metadata: {
        provider: 'ollama',
        model: response.model,
        kanji: mnemonic.kanji,
        processingTime: Date.now() - startTime,
        actualDuration: response.total_duration ? response.total_duration / 1e9 : undefined
      }
    };
  }

  /**
   * Get optimized system prompt for Ollama (shorter = faster)
   */
  private getSystemPromptForOllama(): string {
    return `Create memorable kanji mnemonics for Japanese learners.

CRITICAL RULES:
1. Focus on the VISUAL SHAPE of the kanji and how it connects to the meaning
2. DO NOT invent or guess kanji components/radicals - only use components if explicitly provided
3. Create a vivid, memorable story (2-3 sentences) based on what the kanji LOOKS LIKE
4. The story should help remember both the shape AND the meaning

Return JSON: {"mnemonic":"story","meaning":"English meaning"}
Do NOT include "components" field unless components were provided in the request.`;
  }

  /**
   * Get optimized user prompt for Ollama
   */
  private getUserPromptForOllama(request: KanjiMnemonicRequest): string {
    const lines: string[] = [`Kanji: ${request.kanji}`];

    if (request.meaning) {
      lines.push(`Meaning: ${request.meaning}`);
    }

    if (request.components && request.components.length > 0) {
      lines.push(`Components: ${request.components.join(', ')}`);
    }

    lines.push('Create mnemonic. Return JSON.');
    return lines.join('\n');
  }
}
