/**
 * Transcript Processor Hybrid
 * Extends TranscriptProcessor with Ollama support
 * Uses Ollama by default (background processing task)
 */

import { TranscriptProcessor } from './TranscriptProcessor';
import { OllamaClient } from '../clients/OllamaClient';
import { getProviderConfig, getOllamaConfig, selectProvider, providerHealth } from '../config/providers';
import type {
  ProcessorContext,
  ProcessorResult,
  TaskConfig,
  TranscriptProcessRequest,
  ProcessedTranscript
} from '../types';

export class TranscriptProcessorHybrid extends TranscriptProcessor {
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
   * Process transcript with provider selection
   */
  async process(
    request: TranscriptProcessRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<ProcessedTranscript>> {
    // Determine which task type this is
    const taskType = this.getTaskType(request);
    const provider = selectProvider(taskType, this.providerConfig);

    console.log(`🤖 Using ${provider} for transcript processing: ${request.content.videoTitle || 'untitled'}`);

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
   * Get task type for routing
   */
  private getTaskType(request: TranscriptProcessRequest): string {
    if (request.fixErrors) {
      return 'fix_transcript';
    } else {
      return 'clean_transcript';
    }
  }

  /**
   * Process with OpenAI (calls parent implementation)
   */
  private async processWithOpenAI(
    request: TranscriptProcessRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<ProcessedTranscript>> {
    return super.process(request, config);
  }

  /**
   * Process with Ollama
   */
  private async processWithOllama(
    request: TranscriptProcessRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<ProcessedTranscript>> {
    if (!this.ollamaClient) {
      throw new Error('Ollama client not initialized');
    }

    const startTime = Date.now();

    // Validate request
    this.validateRequest(request);

    // For large transcripts, use batching (delegate to parent)
    const BATCH_SIZE = 50;
    const segments = request.content.transcript;

    if (segments.length > BATCH_SIZE) {
      console.log(`📦 Large transcript (${segments.length} segments), using parent batching logic`);
      // Fallback to OpenAI for large batches to avoid complexity
      return await this.processWithOpenAI(request, config);
    }

    // Get prompts
    const processingType = this.determineProcessingType(request);
    const systemPrompt = this.getSystemPromptForOllama(config, processingType);
    const userPrompt = this.getUserPromptForOllama(request, config, processingType);

    // Call Ollama
    const response = await this.ollamaClient.generate({
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      format: 'json',
      options: {
        temperature: 0.4, // Lower for accuracy
        num_predict: 1200, // Transcripts can be long
        top_p: 0.9
      }
    });

    // Parse response
    const processed = this.parseResponse(response.response, processingType);

    // Validate segments
    if (!processed.segments || processed.segments.length === 0) {
      console.warn('No segments generated, falling back to OpenAI');
      return await this.processWithOpenAI(request, config);
    }

    // Enhance transcript (replicate parent logic)
    const enhanced = this.enhanceTranscriptLocal(processed, request, config);

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
        processingType,
        segmentCount: enhanced.segments.length,
        language: request.content.language || 'ja',
        videoTitle: request.content.videoTitle
      }
    };
  }

  /**
   * Determine processing type
   */
  private determineProcessingType(request: TranscriptProcessRequest): string {
    if (request.splitForShadowing) {
      return 'shadowing';
    } else if (request.fixErrors) {
      return 'error_correction';
    } else if (request.improveNaturalness) {
      return 'naturalization';
    }
    return 'general';
  }

  /**
   * Get optimized system prompt for Ollama
   */
  private getSystemPromptForOllama(config?: TaskConfig, processingType?: string): string {
    const includeTranslations = !!config?.includeTranslations;

    switch (processingType) {
      case 'shadowing':
        return `Split Japanese text into SHORT segments for shadowing (max 20 chars).

RULES:
1. MAX 20 characters per segment
2. NEVER split です/ます/でした
3. Aim for 8-15 characters (2-3 seconds)
4. Break at: て-form, connectors (から、けど、が)
5. Return JSON array ${includeTranslations ? 'of {"text":"...", "translation":"..."}' : 'of strings'}

${includeTranslations
  ? 'Example: [{"text":"昨日友達と","translation":"Yesterday with friend"},...]'
  : 'Example: ["昨日友達と","映画を見て","楽しかった"]'}`;

      case 'error_correction':
        return `Fix transcription errors in Japanese.

Focus:
1. Correct mishearings
2. Fix grammar
3. Natural flow
4. Preserve intent

Return JSON array${includeTranslations ? ' with "text" and "translation"' : ' of corrected segments'}.`;

      case 'naturalization':
        return `Improve naturalness of Japanese transcript.

Tasks:
1. Fix unnatural phrasing
2. Add missing particles
3. Correct conjugations
4. Proper politeness

Return JSON${includeTranslations ? ' with "text" and "translation"' : ''}.`;

      default:
        return `Process Japanese transcript for ${config?.jlptLevel || 'N5'} learners.

Provide:
1. Clean segments
2. Key vocabulary
3. Grammar patterns${includeTranslations ? '\n4. English translations' : ''}

Return JSON.`;
    }
  }

  /**
   * Get optimized user prompt for Ollama
   */
  private getUserPromptForOllama(
    request: TranscriptProcessRequest,
    config?: TaskConfig,
    processingType?: string
  ): string {
    const { transcript, videoTitle } = request.content;
    const fullText = transcript.map(seg => seg.text).join('');
    const includeTranslations = !!config?.includeTranslations;

    let prompt = '';

    switch (processingType) {
      case 'shadowing':
        const maxLength = request.maxSegmentLength || 20;
        prompt = `Split for shadowing:

${fullText}

Max ${maxLength} chars per segment
${includeTranslations ? 'Include translations' : ''}`;
        break;

      case 'error_correction':
        prompt = `Fix errors:

${fullText}

${videoTitle ? `Video: "${videoTitle}"` : ''}
${includeTranslations ? 'Include translations' : ''}`;
        break;

      default:
        prompt = `Process transcript:

${fullText}

${videoTitle ? `Title: ${videoTitle}` : ''}
JLPT: ${config?.jlptLevel || 'N5'}
${includeTranslations ? 'Include translations' : ''}`;
    }

    return prompt;
  }

  /**
   * Local enhancement method (replicates parent logic)
   */
  private enhanceTranscriptLocal(
    transcript: ProcessedTranscript,
    request: TranscriptProcessRequest,
    config?: TaskConfig
  ): ProcessedTranscript {
    // Ensure all segments have required fields
    transcript.segments = transcript.segments.map((seg, index) => ({
      id: seg.id || `seg_${index + 1}`,
      text: seg.text,
      textWithFurigana: seg.textWithFurigana || seg.text,
      startTime: seg.startTime !== undefined ? seg.startTime : index * 3,
      endTime: seg.endTime !== undefined ? seg.endTime : (index + 1) * 3,
      difficulty: seg.difficulty || 1,
      keyVocabulary: seg.keyVocabulary || [],
      translation: seg.translation
    }));

    // Add summary if missing
    if (!transcript.summary && transcript.segments.length > 0) {
      transcript.summary = `${transcript.segments.length} segments processed`;
    }

    // Ensure vocabulary exists
    if (!transcript.vocabulary || !Array.isArray(transcript.vocabulary)) {
      transcript.vocabulary = [];
    }

    return transcript;
  }
}
