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
   * Process transcript request
   */
  async process(
    request: TranscriptProcessRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<ProcessedTranscript>> {
    // Validate request
    this.validateRequest(request);

    // Determine processing type
    const processingType = this.determineProcessingType(request);

    // Get appropriate prompts
    const systemPrompt = this.getSystemPrompt(config, processingType);
    const userPrompt = this.getUserPrompt(request, config, processingType);

    // Call OpenAI
    const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);

    // Parse response based on processing type
    const processed = this.parseResponse(content, processingType);

    // Enhance processed transcript
    const enhanced = this.enhanceTranscript(processed, request, config);

    return {
      data: enhanced,
      usage,
      metadata: {
        processingType,
        segmentCount: enhanced.segments.length,
        language: request.content.language || 'ja',
        videoTitle: request.content.videoTitle
      }
    };
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
   * Get system prompt based on processing type
   */
  getSystemPrompt(config?: TaskConfig, processingType?: string): string {
    const jlptLevel = config?.jlptLevel || 'N5';

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
5. Return ONLY a JSON array of strings

Example output: ["昨日友達と", "映画を見て", "楽しかったです"]`;

      case 'error_correction':
        return `You are an expert in Japanese transcription. Fix errors in auto-generated transcripts while maintaining the original meaning and natural flow.

Focus on:
1. Correcting common mishearings
2. Fixing grammatical errors
3. Ensuring natural Japanese flow
4. Maintaining the speaker's intent
5. Preserving colloquialisms where appropriate

Return corrected segments in JSON format.`;

      case 'naturalization':
        return `You are a Japanese language expert. Improve the naturalness of this transcript while preserving the original meaning.

Tasks:
1. Fix unnatural phrasing
2. Add appropriate particles if missing
3. Correct verb conjugations
4. Ensure proper politeness levels
5. Maintain conversational tone

Return improved segments in JSON format.`;

      default:
        return `You are a Japanese language processing expert. Process this transcript for ${jlptLevel} level learners.

Provide:
1. Clean, formatted segments
2. Identify key vocabulary
3. Note important grammar patterns
4. Prepare for educational use

Return processed segments in JSON format.`;
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

Return as JSON array of segment objects.`;
        break;

      case 'error_correction':
        prompt = `Fix transcription errors in this Japanese text:

${fullText}

${videoTitle ? `Context: Video about "${videoTitle}"` : ''}

Correct errors while maintaining natural Japanese.
Return corrected segments in JSON format.`;
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

Return processed segments with vocabulary in JSON format.`;
    }

    return prompt;
  }

  /**
   * Parse AI response based on processing type
   */
  parseResponse(response: string, processingType: string): ProcessedTranscript {
    let parsed: any;

    try {
      parsed = JSON.parse(response);
    } catch (error) {
      throw new AIServiceError(
        'Failed to parse AI response',
        'PARSE_ERROR',
        500
      );
    }

    // Handle different response formats
    if (processingType === 'shadowing' && Array.isArray(parsed)) {
      // Convert array of strings to segments
      return {
        segments: parsed.map((text, index) => ({
          id: `seg_${index + 1}`,
          text: typeof text === 'string' ? text : text.text,
          textWithFurigana: typeof text === 'string' ? text : text.furigana,
          startTime: index * 3, // Estimate 3 seconds per segment
          endTime: (index + 1) * 3,
          difficulty: this.calculateDifficulty(text),
          keyVocabulary: []
        })),
        vocabulary: []
      };
    }

    // Standard format
    return {
      segments: parsed.segments || parsed,
      summary: parsed.summary,
      keyPoints: parsed.keyPoints,
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
      difficulty: seg.difficulty || this.calculateDifficulty(seg.text),
      keyVocabulary: seg.keyVocabulary || []
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
    const totalText = transcript.segments.map(s => s.text).join('');
    const avgSegmentLength = totalText.length / transcript.segments.length;

    // Check segment lengths for shadowing
    if (request.splitForShadowing) {
      const maxLength = request.maxSegmentLength || 20;
      const longSegments = transcript.segments.filter(s => s.text.length > maxLength);
      if (longSegments.length > 0) {
        console.warn(`Warning: ${longSegments.length} segments exceed ${maxLength} characters`);
      }
    }

    return transcript;
  }

  /**
   * Calculate difficulty level of text
   */
  private calculateDifficulty(text: string): number {
    if (typeof text !== 'string') {
      text = text.text || '';
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