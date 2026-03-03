/**
 * Hybrid Drill Word Resolver Processor
 * Uses Ollama (Qwen) as primary, OpenAI as fallback.
 *
 * SAFE: Does not modify DrillWordResolverProcessor
 * ROLLBACK: Just use the original processor instead
 */

import { DrillWordResolverProcessor } from './DrillWordResolverProcessor';
import { OllamaClient } from '../clients/OllamaClient';
import { getProviderConfig, getOllamaConfig, selectProvider, providerHealth } from '../config/providers';
import {
  DrillWordResolverResultLenientSchema,
  type DrillWordResolverRequest,
  type DrillWordResolverResult,
} from '../schemas/drill-word-resolver.schema';
import { safeValidateAIResponse } from '../schemas';
import type { ProcessorContext, ProcessorResult, TaskConfig } from '../types';

export class DrillWordResolverProcessorHybrid extends DrillWordResolverProcessor {
  private ollamaClient: OllamaClient | null = null;
  private providerConfig = getProviderConfig();

  constructor(context: ProcessorContext) {
    super(context);

    if (this.providerConfig.enabled.ollama) {
      const ollamaConfig = getOllamaConfig();
      this.ollamaClient = new OllamaClient(ollamaConfig);
    }
  }

  /**
   * Process with automatic provider selection and fallback
   */
  async process(
    request: DrillWordResolverRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<DrillWordResolverResult>> {
    const provider = selectProvider('resolve_drill_word', this.providerConfig);

    console.log(`[DrillWordResolver] Using ${provider} for: ${request.word}`);

    try {
      if (provider === 'ollama' && this.ollamaClient) {
        return await this.processWithOllama(request, config);
      } else {
        return await this.processWithOpenAI(request, config);
      }
    } catch (error) {
      console.error(`[DrillWordResolver] ${provider} failed:`, error);
      providerHealth.markUnhealthy(provider);

      const fallback = this.providerConfig.fallback;
      console.warn(`[DrillWordResolver] Falling back to ${fallback}`);

      if (fallback === 'openai') {
        return await this.processWithOpenAI(request, config);
      } else if (fallback === 'ollama' && this.ollamaClient) {
        return await this.processWithOllama(request, config);
      }

      throw error;
    }
  }

  /**
   * Process with OpenAI (delegates to parent)
   */
  private async processWithOpenAI(
    request: DrillWordResolverRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<DrillWordResolverResult>> {
    return await super.process(request, config);
  }

  /**
   * Process with Ollama (Qwen)
   */
  private async processWithOllama(
    request: DrillWordResolverRequest,
    _config?: TaskConfig
  ): Promise<ProcessorResult<DrillWordResolverResult>> {
    if (!this.ollamaClient) {
      throw new Error('Ollama client not initialized');
    }

    const startTime = Date.now();

    const systemPrompt = this.getSystemPromptForOllama();
    const userPrompt = this.getUserPromptForOllama(request);

    const response = await this.ollamaClient.generate({
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      format: 'json',
      options: {
        temperature: 0.3,
        num_predict: 300,
        top_p: 0.9,
      },
    });

    // Parse and validate
    const parsed = JSON.parse(response.response);
    const validated = safeValidateAIResponse(
      DrillWordResolverResultLenientSchema,
      parsed,
      'drill_word_resolver_ollama'
    );

    if (!validated) {
      throw new Error(
        `Ollama response failed schema validation: ${JSON.stringify(parsed).substring(0, 200)}`
      );
    }

    // Normalize nullish → null to match the strict schema type (nullable, not optional)
    const data: DrillWordResolverResult = {
      surface: validated.surface,
      lemma: validated.lemma,
      reading: validated.reading,
      meaning: validated.meaning ?? null,
      partOfSpeech: validated.partOfSpeech,
      conjugationType: validated.conjugationType ?? null,
      confidence: validated.confidence,
      alternatives: validated.alternatives ?? null,
      notes: validated.notes ?? null,
    };

    providerHealth.markHealthy('ollama');

    const estimatedPromptTokens = OllamaClient.estimateTokens(systemPrompt + userPrompt);
    const estimatedCompletionTokens = OllamaClient.estimateTokens(response.response);

    return {
      data,
      usage: {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
        estimatedCost: 0,
      },
      metadata: {
        provider: 'ollama',
        model: response.model,
        processingTime: Date.now() - startTime,
        actualDuration: response.total_duration ? response.total_duration / 1e9 : undefined,
      },
    };
  }

  /**
   * Optimized system prompt for Ollama (shorter = faster)
   */
  private getSystemPromptForOllama(): string {
    return `Japanese word resolver. Classify the word for a conjugation drill. Return JSON:
{
  "surface": "input form",
  "lemma": "dictionary form",
  "reading": "hiragana of lemma",
  "meaning": "English meaning",
  "partOfSpeech": "verb|i-adjective|na-adjective|noun|adverb|particle|other",
  "conjugationType": "Ichidan|Godan|Irregular|i-adjective|na-adjective",
  "confidence": "high|medium|low",
  "alternatives": [],
  "notes": "optional note"
}
Rules: conjugationType required for verbs/adjectives only. Do NOT conjugate.`;
  }

  /**
   * Optimized user prompt for Ollama
   */
  private getUserPromptForOllama(request: DrillWordResolverRequest): string {
    const lines: string[] = [`Word: ${request.word}`];
    if (request.context) {
      lines.push(`Context: ${request.context.substring(0, 200)}`);
    }
    lines.push('Return JSON.');
    return lines.join('\n');
  }
}
