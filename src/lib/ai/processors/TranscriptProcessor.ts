/**
 * Transcript Processor
 * Handles YouTube transcript formatting, error correction, and vocabulary extraction
 */

import { BaseProcessor } from './BaseProcessor';
import {
  ProcessorContext,
  ProcessorResult,
  TaskConfig,
  TranscriptProcessRequest,
  ProcessedTranscript,
  AIServiceError
} from '../types';
import { PromptManager } from '../config/PromptManager';

export class TranscriptProcessor extends BaseProcessor<TranscriptProcessRequest, ProcessedTranscript> {
  private promptManager: PromptManager;

  constructor(context: ProcessorContext) {
    super(context);
    this.promptManager = PromptManager.getInstance();
  }

  /**
   * Process transcript request - now with batching for long transcripts
   */
  async process(
    request: TranscriptProcessRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<ProcessedTranscript>> {
    // Validate request
    this.validateRequest(request);

    const BATCH_SIZE = 50; // Process 50 segments at a time
    const segments = request.content.transcript;
    const processingType = this.determineProcessingType(request);

    // Check if we need to batch
    if (segments.length > BATCH_SIZE) {
      console.log(`📦 Processing ${segments.length} segments in batches of ${BATCH_SIZE}...`);
      return await this.processInBatches(request, config, processingType, BATCH_SIZE);
    }

    // Process normally for small transcripts
    return await this.processSingleBatch(request, config, processingType);
  }

  /**
   * Process transcript in batches for large transcripts
   */
  private async processInBatches(
    request: TranscriptProcessRequest,
    config: TaskConfig | undefined,
    processingType: string,
    batchSize: number
  ): Promise<ProcessorResult<ProcessedTranscript>> {
    const segments = request.content.transcript;
    const batches = [];

    // Split into batches
    for (let i = 0; i < segments.length; i += batchSize) {
      batches.push(segments.slice(i, i + batchSize));
    }

    console.log(`🔄 Processing ${batches.length} batches...`);

    const processedBatches: ProcessedTranscript[] = [];
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalCost: 0 };

    // Process each batch with increased timeout
    const batchConfig = {
      ...config,
      timeout: 60000 // Increase timeout to 60 seconds for batch processing
    };

    for (let i = 0; i < batches.length; i++) {
      console.log(`  Processing batch ${i + 1}/${batches.length} (${batches[i].length} segments)...`);

      const batchRequest: TranscriptProcessRequest = {
        ...request,
        content: {
          ...request.content,
          transcript: batches[i]
        }
      };

      try {
        const result = await this.processSingleBatch(batchRequest, batchConfig, processingType);
        processedBatches.push(result.data);

        if (result.usage) {
          totalUsage.promptTokens += result.usage.promptTokens || 0;
          totalUsage.completionTokens += result.usage.completionTokens || 0;
          totalUsage.totalCost = (totalUsage.totalCost || 0) + (result.usage.estimatedCost || 0);
        }
      } catch (error) {
        console.error(`❌ Failed to process batch ${i + 1}:`, error);
        // Continue with other batches even if one fails
      }
    }

    // Combine all processed segments
    const allSegments = processedBatches.flatMap(batch => batch.segments);

    if (allSegments.length === 0) {
      throw new AIServiceError(
        'All batches failed to process',
        'BATCH_PROCESSING_FAILED',
        500
      );
    }

    console.log(`✅ Successfully processed ${allSegments.length} segments across ${batches.length} batches`);

    return {
      data: {
        segments: allSegments,
        metadata: processedBatches[0]?.metadata // Use metadata from first batch
      },
      usage: {
        promptTokens: totalUsage.promptTokens,
        completionTokens: totalUsage.completionTokens,
        totalTokens: totalUsage.promptTokens + totalUsage.completionTokens,
        estimatedCost: totalUsage.totalCost
      },
      metadata: {
        processingType,
        segmentCount: allSegments.length,
        batchCount: batches.length
      }
    };
  }

  /**
   * Process a single batch (original single-batch logic)
   */
  private async processSingleBatch(
    request: TranscriptProcessRequest,
    config: TaskConfig | undefined,
    processingType: string
  ): Promise<ProcessorResult<ProcessedTranscript>> {
    // Get appropriate prompts
    const systemPrompt = this.getSystemPrompt(config, processingType);
    const userPrompt = this.getUserPrompt(request, config, processingType);

    let retries = 0;
    const maxRetries = 2;
    let lastError: any = null;

    while (retries <= maxRetries) {
      try {
        // Call OpenAI with flexible format for transcripts
        const { content, usage } = await this.callOpenAI(
          systemPrompt,
          userPrompt,
          { responseFormat: processingType === 'shadowing' ? 'text' : 'json' }
        );

        // Parse response based on processing type
        const processed = this.parseTranscriptResponse(content, processingType);

        // Validate we have valid segments
        if (!processed.segments || processed.segments.length === 0) {
          throw new AIServiceError(
            'No valid segments generated',
            'NO_SEGMENTS',
            500
          );
        }

        // Validate all segments have text
        const invalidSegments = processed.segments.filter(s => !s || !s.text);
        if (invalidSegments.length > 0) {
          console.warn(`Found ${invalidSegments.length} invalid segments, filtering out`);
          processed.segments = processed.segments.filter(s => s && s.text);
        }

        // Enhance processed transcript
        const enhanced = this.enhanceTranscript(processed, request, config);

        return {
          data: enhanced,
          usage,
          metadata: {
            processingType,
            segmentCount: enhanced.segments.length,
            language: request.content.language || 'ja',
            videoTitle: request.content.videoTitle,
            retries
          }
        };
      } catch (error) {
        lastError = error;
        retries++;

        if (retries <= maxRetries) {
          console.log(`🔄 Retrying transcript processing (attempt ${retries + 1}/${maxRetries + 1})...`);
          // Add slight delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }

    // All retries failed
    throw new AIServiceError(
      `Failed to process transcript after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`,
      'PROCESSING_FAILED',
      500,
      { originalError: lastError }
    );
  }

  /**
   * Validate request
   */
  validateRequest(request: TranscriptProcessRequest): void {
    if (!request.content) {
      throw new AIServiceError(
        'Content is required',
        'VALIDATION_ERROR',
        400
      );
    }

    if (!request.content.transcript || !Array.isArray(request.content.transcript)) {
      throw new AIServiceError(
        'Transcript must be an array of segments',
        'VALIDATION_ERROR',
        400
      );
    }

    if (request.content.transcript.length === 0) {
      throw new AIServiceError(
        'Transcript cannot be empty',
        'VALIDATION_ERROR',
        400
      );
    }

    if (request.maxSegmentLength && (request.maxSegmentLength < 5 || request.maxSegmentLength > 100)) {
      throw new AIServiceError(
        'Max segment length must be between 5 and 100',
        'VALIDATION_ERROR',
        400
      );
    }
  }

  /**
   * Determine processing type based on request flags
   */
  protected determineProcessingType(request: TranscriptProcessRequest): string {
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
   * Get system prompt based on processing type
   */
  getSystemPrompt(config?: TaskConfig, processingType?: string): string {
    const jlptLevel = config?.jlptLevel || 'N5';
    const includeTranslations = !!config?.includeTranslations;

    switch (processingType) {
      case 'shadowing':
        return `You are an expert Japanese language educator. Split this Japanese text into SHORT segments for shadowing practice.

CRITICAL RULES:
1. MAXIMUM 20 characters per segment (essential for comfortable repetition)
2. NEVER split です/ます/でした/ました/だ/だった from their stems
3. Aim for 8-15 characters ideally (2-3 seconds when spoken)
4. Break long sentences at natural points:
   - After て-form (して、見て、食べて)
   - After connectors (から、けど、が、のに、ので)
   - Between clauses
5. Return a JSON array ${includeTranslations ? 'of objects with "text" and "translation" fields' : 'of strings (segment text only)'}
6. Each item must contain actual Japanese text, not empty

${includeTranslations
          ? `Example output:
[
  {"text": "昨日友達と", "translation": "Yesterday with my friend"},
  {"text": "映画を見て", "translation": "we watched a movie"},
  {"text": "楽しかったです", "translation": "and it was fun."}
]`
          : `Example output: ["昨日友達と", "映画を見て", "楽しかったです"]`}

IMPORTANT: ${includeTranslations
          ? 'Return a simple array of objects, each containing "text" (Japanese) and "translation" (natural English). Do not include any commentary outside the JSON array.'
          : 'Return a simple array of strings. Do not include any commentary outside the JSON array.'}`;

      case 'error_correction':
        return `You are an expert in Japanese transcription. Fix errors in auto-generated transcripts while maintaining the original meaning and natural flow.

Focus on:
1. Correcting common mishearings
2. Fixing grammatical errors
3. Ensuring natural Japanese flow
4. Maintaining the speaker's intent
5. Preserving colloquialisms where appropriate

Return corrected segments in JSON format${includeTranslations ? ' and include an English translation ("translation" field) for each segment.' : '.'}`;

      case 'naturalization':
        return `You are a Japanese language expert. Improve the naturalness of this transcript while preserving the original meaning.

Tasks:
1. Fix unnatural phrasing
2. Add appropriate particles if missing
3. Correct verb conjugations
4. Ensure proper politeness levels
5. Maintain conversational tone

Return improved segments in JSON format${includeTranslations ? ' and provide an English translation for each segment in a "translation" field.' : '.'}`;

      default:
        return `You are a Japanese language processing expert. Process this transcript for ${jlptLevel} level learners.

Provide:
1. Clean, formatted segments
2. Identify key vocabulary
3. Note important grammar patterns
4. Prepare for educational use
${includeTranslations ? '5. Provide a natural English translation for each segment ("translation" field)\n' : ''}
Return processed segments in JSON format${includeTranslations ? ' and include the "translation" field where applicable.' : '.'}`;
    }
  }

  /**
   * Get user prompt based on request and processing type
   */
  getUserPrompt(
    request: TranscriptProcessRequest,
    config?: TaskConfig,
    processingType?: string
  ): string {
    const { transcript, videoTitle, language } = request.content;
    const fullText = transcript.map(seg => seg.text).join('');
    const includeTranslations = !!config?.includeTranslations;

    let prompt = '';

    switch (processingType) {
      case 'shadowing':
        const maxLength = request.maxSegmentLength || 20;
        prompt = `Split this Japanese text into segments for shadowing practice:

${fullText}

Requirements:
- Maximum ${maxLength} characters per segment
- Break at natural speech points
- Keep grammatical units together
${request.addFurigana ? '- Add furigana using ruby tags' : ''}
${includeTranslations ? '- Provide a natural English translation for each segment' : ''}

Return as JSON array of ${includeTranslations ? 'objects with "text" and "translation" fields.' : 'segment strings.'}`;
        break;

      case 'error_correction':
        const translationHint = includeTranslations
          ? 'Provide a natural English translation for each segment.\n'
          : '';
        prompt = `Fix transcription errors in this Japanese text:

${fullText}

${videoTitle ? `Context: Video about "${videoTitle}"` : ''}

Correct errors while maintaining natural Japanese.
${translationHint}Return corrected segments in JSON format${includeTranslations ? ' including "translation".' : '.'}`;
        break;

      default:
        prompt = `Process this transcript:

${fullText}

${videoTitle ? `Title: ${videoTitle}` : ''}
Language: ${language || 'Japanese'}
JLPT Level: ${config?.jlptLevel || 'N5'}

Tasks:
${request.splitForShadowing ? '- Split for shadowing practice' : ''}
${request.addFurigana ? '- Add furigana' : ''}
${request.fixErrors ? '- Fix transcription errors' : ''}
${includeTranslations ? '- Provide a natural English translation for each segment' : ''}

Return processed segments with vocabulary in JSON format${includeTranslations ? ' and include each translation in a "translation" field.' : '.'}`;
    }

    return prompt;
  }

  /**
   * Parse AI response (base implementation)
   */
  parseResponse(response: string): ProcessedTranscript {
    return this.parseTranscriptResponse(response, 'default');
  }

  /**
   * Parse AI response based on processing type
   */
  protected parseTranscriptResponse(response: string, processingType: string): ProcessedTranscript {
    let parsed: any;

    try {
      parsed = JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse AI response as JSON:', response.substring(0, 200));
      throw new AIServiceError(
        'Failed to parse AI response as JSON',
        'PARSE_ERROR',
        500,
        { response: response.substring(0, 500) }
      );
    }

    // Handle different response formats
    if (processingType === 'shadowing') {
      // Handle both array of strings and array of objects
      if (Array.isArray(parsed)) {
        return {
          segments: parsed.map((item, index) => {
            // Ensure we always have a text string
            let text = '';
            let translation: string | undefined;
            if (typeof item === 'string') {
              text = item;
            } else if (item && typeof item === 'object') {
              text = item.text || item.segment || item.content || '';
              translation =
                item.translation ||
                item.englishTranslation ||
                item.translation_en ||
                item.english ||
                item.translationEn ||
                item.translationText;
            }

            // Validate text is not empty
            if (!text || text.trim().length === 0) {
              console.warn(`Segment ${index + 1} has empty text, skipping`);
              return null;
            }

            return {
              id: `seg_${index + 1}`,
              text: text,
              textWithFurigana: text,
              startTime: index * 3, // Estimate 3 seconds per segment
              endTime: (index + 1) * 3,
              difficulty: this.calculateDifficulty(text),
              keyVocabulary: [],
              translation
            };
          }).filter(seg => seg !== null) as any[], // Remove null segments
          vocabulary: []
        };
      } else if (parsed.segments && Array.isArray(parsed.segments)) {
        // Handle object with segments array
        return this.parseTranscriptResponse(JSON.stringify(parsed.segments), processingType);
      } else {
        throw new AIServiceError(
          'Invalid response format for shadowing',
          'INVALID_FORMAT',
          500,
          { parsed }
        );
      }
    }

    // Standard format - ensure segments have text
    const segments = (parsed.segments || parsed || []);
    if (Array.isArray(segments)) {
      const validSegments = segments.map((seg, index) => {
        if (typeof seg === 'string') {
          return {
            id: `seg_${index + 1}`,
            text: seg,
            startTime: index * 3,
            endTime: (index + 1) * 3
          };
        } else if (seg && seg.text) {
          return {
            ...seg,
            id: seg.id || `seg_${index + 1}`
          };
        }
        return null;
      }).filter(seg => seg !== null);

      return {
        segments: validSegments,
        summary: parsed.summary,
        keyPoints: parsed.keyPoints,
        vocabulary: parsed.vocabulary || []
      };
    }

    return {
      segments: [],
      vocabulary: parsed.vocabulary || []
    };
  }

  /**
   * Enhance processed transcript
   */
  private enhanceTranscript(
    transcript: ProcessedTranscript,
    request: TranscriptProcessRequest,
    config?: TaskConfig
  ): ProcessedTranscript {
    // Ensure all segments have required fields
    transcript.segments = transcript.segments.map((seg, index) => ({
      id: seg.id || `seg_${index + 1}`,
      text: seg.text,
      textWithFurigana: seg.textWithFurigana || (request.addFurigana ? this.addFurigana(seg.text) : seg.text),
      startTime: seg.startTime !== undefined ? seg.startTime : index * 3,
      endTime: seg.endTime !== undefined ? seg.endTime : (index + 1) * 3,
      difficulty: seg.difficulty || this.calculateDifficulty(seg.text || ''),
      keyVocabulary: seg.keyVocabulary || [],
      translation: seg.translation
    }));

    // Add summary if missing
    if (!transcript.summary && transcript.segments.length > 0) {
      transcript.summary = this.generateSummary(transcript.segments);
    }

    // Extract vocabulary if requested
    if (request.content.transcript.length > 0 && (!transcript.vocabulary || transcript.vocabulary.length === 0)) {
      transcript.vocabulary = this.extractVocabulary(transcript.segments, config?.jlptLevel);
    }

    // Calculate statistics
    const totalText = transcript.segments
      .filter(s => s && s.text)
      .map(s => s.text)
      .join('');
    const avgSegmentLength = transcript.segments.length > 0
      ? totalText.length / transcript.segments.length
      : 0;

    // Check segment lengths for shadowing
    if (request.splitForShadowing) {
      const maxLength = request.maxSegmentLength || 20;
      // Filter out segments with undefined text before checking length
      const validSegments = transcript.segments.filter(s => s && s.text);
      const longSegments = validSegments.filter(s => s.text.length > maxLength);
      if (longSegments.length > 0) {
        console.warn(`Warning: ${longSegments.length} segments exceed ${maxLength} characters`);
      }

      // Also warn if we have invalid segments
      const invalidCount = transcript.segments.length - validSegments.length;
      if (invalidCount > 0) {
        console.warn(`⚠️ [AI] ${invalidCount} segments have undefined or empty text`);
      }
    }

    return transcript;
  }

  /**
   * Calculate difficulty level of text
   */
  private calculateDifficulty(text: string | any): number {
    // Handle various input types safely
    if (typeof text !== 'string') {
      // If it's an object with a text property, use that
      if (text && typeof text === 'object' && 'text' in text) {
        text = text.text || '';
      } else {
        // Otherwise default to empty string
        text = '';
      }
    }

    // Simple difficulty calculation based on:
    // - Length
    // - Kanji density
    // - Complex grammar patterns

    const length = text.length;
    const kanjiCount = (text.match(/[\u4e00-\u9faf]/g) || []).length;
    const kanjiDensity = kanjiCount / Math.max(length, 1);

    let difficulty = 1;

    // Length factor
    if (length > 30) difficulty++;
    if (length > 50) difficulty++;

    // Kanji density factor
    if (kanjiDensity > 0.2) difficulty++;
    if (kanjiDensity > 0.4) difficulty++;

    // Complex patterns
    const complexPatterns = [
      'なければならない',
      'ということ',
      'のではないか',
      'にもかかわらず',
      'ざるを得ない'
    ];

    for (const pattern of complexPatterns) {
      if (text.includes(pattern)) {
        difficulty++;
        break;
      }
    }

    return Math.min(5, Math.max(1, difficulty));
  }

  /**
   * Add furigana to text (placeholder)
   */
  private addFurigana(text: string): string {
    // In production, use a proper furigana library
    // For now, just return the text
    return text;
  }

  /**
   * Generate summary from segments
   */
  private generateSummary(segments: any[]): string {
    const totalText = segments.map(s => s.text).join('');
    const wordCount = totalText.length;
    const segmentCount = segments.length;

    return `Transcript contains ${segmentCount} segments with approximately ${wordCount} characters total.`;
  }

  /**
   * Extract vocabulary from segments
   */
  private extractVocabulary(segments: any[], jlptLevel?: string): any[] {
    const vocabulary: any[] = [];
    const seen = new Set<string>();

    // Extract unique vocabulary items
    for (const segment of segments) {
      if (segment.keyVocabulary && Array.isArray(segment.keyVocabulary)) {
        for (const word of segment.keyVocabulary) {
          if (!seen.has(word)) {
            seen.add(word);
            vocabulary.push({
              word,
              reading: '', // Would need dictionary lookup
              meaning: '', // Would need dictionary lookup
              frequency: 1,
              jlptLevel: jlptLevel || 'N5'
            });
          }
        }
      }
    }

    return vocabulary;
  }

  /**
   * Format transcript for shadowing practice
   */
  async formatForShadowing(
    transcript: Array<{ text: string; startTime?: number; endTime?: number }>,
    maxSegmentLength: number = 20,
    config?: TaskConfig
  ): Promise<ProcessorResult<ProcessedTranscript>> {
    return this.process({
      content: {
        transcript,
        language: 'ja'
      },
      splitForShadowing: true,
      maxSegmentLength,
      addFurigana: false
    }, config);
  }

  /**
   * Fix transcript errors
   */
  async fixTranscriptErrors(
    transcript: Array<{ text: string; startTime?: number; endTime?: number }>,
    videoTitle?: string,
    config?: TaskConfig
  ): Promise<ProcessorResult<ProcessedTranscript>> {
    return this.process({
      content: {
        transcript,
        videoTitle,
        language: 'ja'
      },
      fixErrors: true,
      improveNaturalness: true
    }, config);
  }
}
