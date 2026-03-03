/**
 * Drill Word Resolver Processor (OpenAI)
 *
 * Resolves unknown/uncertain Focus Word inputs into drill-ready metadata.
 * Does NOT generate conjugation forms — only identifies the word type
 * and conjugation classification so downstream code can conjugate.
 *
 * Output: surface, lemma, reading, meaning, partOfSpeech, conjugationType, confidence
 */

import { BaseProcessor } from './BaseProcessor';
import {
  DrillWordResolverResultSchema,
  type DrillWordResolverRequest,
  type DrillWordResolverResult,
} from '../schemas/drill-word-resolver.schema';
import type { ProcessorResult, TaskConfig } from '../types';
import { AIServiceError } from '../types';

export class DrillWordResolverProcessor extends BaseProcessor<
  DrillWordResolverRequest,
  DrillWordResolverResult
> {
  /**
   * Process a word resolution request via OpenAI
   */
  async process(
    request: DrillWordResolverRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<DrillWordResolverResult>> {
    this.validateRequest(request);

    const systemPrompt = this.getSystemPrompt(config);
    const userPrompt = this.getUserPrompt(request, config);

    // Use structured outputs for guaranteed schema compliance
    const { data, usage, requestId } = await this.callOpenAIWithSchema(
      systemPrompt,
      userPrompt,
      DrillWordResolverResultSchema,
      'drill_word_resolver',
      {
        temperature: 0.3, // Low temperature for factual word resolution
        maxTokens: 500,   // Small output — just metadata
      }
    );

    return {
      data,
      usage,
      metadata: {
        provider: 'openai',
        requestId,
      },
    };
  }

  /**
   * Validate the incoming request
   */
  validateRequest(request: DrillWordResolverRequest): void {
    if (!request.word || typeof request.word !== 'string') {
      throw new AIServiceError(
        'Word is required and must be a string',
        'VALIDATION_ERROR',
        400
      );
    }

    const trimmed = request.word.trim();
    if (trimmed.length === 0) {
      throw new AIServiceError(
        'Word cannot be empty',
        'VALIDATION_ERROR',
        400
      );
    }

    if (trimmed.length > 100) {
      throw new AIServiceError(
        'Word must be 100 characters or fewer',
        'VALIDATION_ERROR',
        400
      );
    }
  }

  /**
   * System prompt for word resolution
   */
  getSystemPrompt(_config?: TaskConfig): string {
    return `You are a Japanese language word resolver for a conjugation drill system.

Given a Japanese word (which may be in any form — dictionary, conjugated, kanji, kana, or romaji), resolve it to its drill-ready metadata.

Rules:
- "surface" is the input as given (or lightly normalized)
- "lemma" is the dictionary/base form (e.g., 食べる not 食べて)
- "reading" is the hiragana reading of the lemma
- "meaning" is a concise English meaning (optional if unsure)
- "partOfSpeech" must be one of: verb, i-adjective, na-adjective, noun, adverb, particle, other
- "conjugationType" is required for verbs and adjectives:
    - Verbs: Ichidan, Godan, or Irregular
    - Adjectives: i-adjective or na-adjective
    - Omit for nouns, adverbs, particles, other
- "confidence" is how certain you are: high, medium, or low
- "alternatives" is an array of other possible interpretations (if ambiguous)
- "notes" is a brief note (e.g., "suru-verb", "irregular godan", "ru-ending godan")

Do NOT generate conjugation forms. Only classify the word.

Return valid JSON matching the schema exactly.`;
  }

  /**
   * User prompt with the word to resolve
   */
  getUserPrompt(request: DrillWordResolverRequest, _config?: TaskConfig): string {
    const lines: string[] = [`Resolve this Japanese word: ${request.word}`];

    if (request.context) {
      lines.push(`Context: ${request.context}`);
    }

    return lines.join('\n');
  }

  /**
   * Parse a raw JSON string response into DrillWordResolverResult
   */
  parseResponse(response: string): DrillWordResolverResult {
    const parsed = this.parseJSON<unknown>(response);
    return this.validateResponse(parsed, DrillWordResolverResultSchema, 'drill_word_resolver');
  }
}
