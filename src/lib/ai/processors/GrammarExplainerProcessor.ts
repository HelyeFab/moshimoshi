/**
 * Grammar Explainer Processor
 * Generates detailed grammar explanations with examples
 */

import { BaseProcessor } from './BaseProcessor';
import {
  ProcessorContext,
  ProcessorResult,
  TaskConfig,
  GrammarExplanationRequest,
  GrammarExplanation,
  AIServiceError
} from '../types';

export class GrammarExplainerProcessor extends BaseProcessor<GrammarExplanationRequest, GrammarExplanation> {
  constructor(context: ProcessorContext) {
    super(context);
  }

  /**
   * Process the request to generate grammar explanation
   */
  async process(
    request: GrammarExplanationRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<GrammarExplanation>> {
    // Validate the request
    this.validateRequest(request);

    // Generate prompts
    const systemPrompt = this.getSystemPrompt(config);
    const userPrompt = this.getUserPrompt(request, config);

    // Call OpenAI
    const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);

    // Parse the response
    const explanation = this.parseResponse(content);

    // Enhance the explanation
    const enhancedExplanation = this.enhanceExplanation(explanation, request, config);

    return {
      data: enhancedExplanation,
      usage,
      metadata: {
        grammarPattern: explanation.pattern,
        jlptLevel: explanation.jlptLevel || config?.jlptLevel,
        exampleCount: explanation.examples.length
      }
    };
  }

  /**
   * Validate the request
   */
  validateRequest(request: GrammarExplanationRequest): void {
    if (!request.content) {
      throw new AIServiceError(
        'Content is required for grammar explanation',
        'VALIDATION_ERROR',
        400
      );
    }

    if (typeof request.content !== 'string' || request.content.trim().length === 0) {
      throw new AIServiceError(
        'Content must be a non-empty string',
        'VALIDATION_ERROR',
        400
      );
    }

    // Check content length
    if (request.content.length > 1000) {
      throw new AIServiceError(
        'Content too long. Maximum 1000 characters.',
        'VALIDATION_ERROR',
        400
      );
    }
  }

  /**
   * Generate the system prompt
   */
  getSystemPrompt(config?: TaskConfig): string {
    const jlptLevel = config?.jlptLevel || 'N5';
    const style = config?.style || 'casual';

    return `You are an expert Japanese language teacher specializing in grammar explanations.

Your role is to explain Japanese grammar patterns clearly and comprehensively for ${jlptLevel} level students.

EXPLANATION REQUIREMENTS:
1. Break down the grammar structure clearly
2. Explain the meaning and usage in simple terms
3. Provide multiple contextual examples
4. Note common mistakes learners make
5. Compare with similar patterns when relevant
6. Use appropriate formality level: ${style}

EXAMPLE FORMAT:
- Each example must include:
  * Japanese sentence (with the pattern highlighted if possible)
  * Furigana for kanji (in parentheses or ruby tags)
  * Natural English translation
  * Brief notes explaining the usage

OUTPUT FORMAT:
Return a JSON object with:
{
  "pattern": "The grammar pattern in Japanese",
  "patternRomaji": "Romanized version",
  "meaning": "Clear explanation of what it means",
  "structure": "How to form this pattern (e.g., Verb-て form + います)",
  "examples": [
    {
      "japanese": "Example sentence",
      "furigana": "Sentence with furigana",
      "translation": "English translation",
      "notes": "Usage notes"
    }
  ],
  "commonMistakes": ["List of common errors"],
  "relatedPatterns": ["Similar grammar patterns"],
  "jlptLevel": "N5/N4/N3/N2/N1",
  "formality": "casual/formal/both"
}

Make explanations clear and accessible for language learners.`;
  }

  /**
   * Generate the user prompt
   */
  getUserPrompt(request: GrammarExplanationRequest, config?: TaskConfig): string {
    const { content, focusPoints, compareWith } = request;
    const jlptLevel = config?.jlptLevel || 'N5';
    const includeExamples = config?.includeExamples !== false;

    let prompt = `Explain this Japanese grammar pattern or sentence:\n\n"${content}"\n\n`;

    if (focusPoints && focusPoints.length > 0) {
      prompt += `\nFocus especially on these points:\n`;
      prompt += focusPoints.map(point => `- ${point}`).join('\n');
      prompt += '\n';
    }

    if (compareWith && compareWith.length > 0) {
      prompt += `\nCompare and contrast with these patterns:\n`;
      prompt += compareWith.map(pattern => `- ${pattern}`).join('\n');
      prompt += '\n';
    }

    prompt += `\nRequirements:
- Target JLPT Level: ${jlptLevel}
- Provide ${includeExamples ? 'at least 3-5' : '1-2'} clear examples
- Explain in a way that ${jlptLevel} students can understand
- Include common mistakes to avoid
- Note the formality level of the pattern

Return ONLY a valid JSON object as specified.`;

    return prompt;
  }

  /**
   * Parse the AI response
   */
  parseResponse(response: string): GrammarExplanation {
    const parsed = this.parseJSON<GrammarExplanation>(response);

    // Validate required fields
    if (!parsed.pattern || !parsed.meaning || !parsed.structure) {
      throw new AIServiceError(
        'Missing required fields in grammar explanation',
        'INVALID_RESPONSE_FORMAT',
        500
      );
    }

    // Validate examples array
    if (!Array.isArray(parsed.examples)) {
      parsed.examples = [];
    }

    return parsed;
  }

  /**
   * Enhance the grammar explanation
   */
  private enhanceExplanation(
    explanation: GrammarExplanation,
    request: GrammarExplanationRequest,
    config?: TaskConfig
  ): GrammarExplanation {
    // Add furigana to examples if missing
    explanation.examples = explanation.examples.map(example => {
      if (!example.furigana && example.japanese) {
        example.furigana = this.addFuriganaMarkers(example.japanese);
      }
      return example;
    });

    // Ensure JLPT level is set
    if (!explanation.jlptLevel && config?.jlptLevel) {
      explanation.jlptLevel = config.jlptLevel;
    }

    // Add default common mistakes if none provided
    if (!explanation.commonMistakes || explanation.commonMistakes.length === 0) {
      explanation.commonMistakes = this.generateCommonMistakes(explanation.pattern);
    }

    // Add pattern romaji if missing
    if (!explanation.patternRomaji) {
      explanation.patternRomaji = this.generateRomaji(explanation.pattern);
    }

    // Ensure formality is set
    if (!explanation.formality) {
      explanation.formality = this.detectFormality(explanation.pattern);
    }

    return explanation;
  }

  /**
   * Add furigana markers to Japanese text
   */
  private addFuriganaMarkers(japanese: string): string {
    // This is a placeholder - in production, you'd use a proper furigana library
    // For now, just return the original text
    return japanese;
  }

  /**
   * Generate common mistakes for a pattern
   */
  private generateCommonMistakes(pattern: string): string[] {
    const mistakes: string[] = [];

    // Check for common patterns and add relevant mistakes
    if (pattern.includes('ている') || pattern.includes('ています')) {
      mistakes.push('Confusing ている with simple present tense');
      mistakes.push('Forgetting to use て-form before いる');
    }

    if (pattern.includes('たい') || pattern.includes('たがる')) {
      mistakes.push('Using たい for third person desires (use たがる instead)');
      mistakes.push('Incorrect verb stem formation before たい');
    }

    if (pattern.includes('なければ')) {
      mistakes.push('Mixing up なければならない with なければいけない');
      mistakes.push('Using wrong negative form before なければ');
    }

    if (pattern.includes('そう')) {
      mistakes.push('Confusing そうだ (hearsay) with そうだ (appearance)');
      mistakes.push('Incorrect adjective stem before そう');
    }

    // Default mistakes if no specific ones found
    if (mistakes.length === 0) {
      mistakes.push('Incorrect word order');
      mistakes.push('Wrong particle usage');
      mistakes.push('Mixing formal and casual forms');
    }

    return mistakes;
  }

  /**
   * Generate romaji for Japanese text
   */
  private generateRomaji(japanese: string): string {
    // Placeholder - in production, use a proper romaji conversion library
    // For now, return a simplified version
    const romajiMap: { [key: string]: string } = {
      'ている': 'te iru',
      'ています': 'te imasu',
      'たい': 'tai',
      'なければならない': 'nakereba naranai',
      'そうだ': 'sou da',
      'でしょう': 'deshou',
      'かもしれない': 'kamoshirenai'
    };

    for (const [jp, romaji] of Object.entries(romajiMap)) {
      if (japanese.includes(jp)) {
        return romaji;
      }
    }

    return ''; // Return empty if no match
  }

  /**
   * Detect formality level of a pattern
   */
  private detectFormality(pattern: string): 'casual' | 'formal' | 'both' {
    const formalMarkers = ['ます', 'です', 'ございます', 'いたします', 'おります'];
    const casualMarkers = ['だ', 'だよ', 'だね', 'じゃない', 'んだ'];

    const hasFormal = formalMarkers.some(marker => pattern.includes(marker));
    const hasCasual = casualMarkers.some(marker => pattern.includes(marker));

    if (hasFormal && !hasCasual) return 'formal';
    if (hasCasual && !hasFormal) return 'casual';
    return 'both';
  }

  /**
   * Explain a specific grammar pattern with comparison
   */
  async explainWithComparison(
    pattern: string,
    comparePatterns: string[],
    config?: TaskConfig
  ): Promise<ProcessorResult<GrammarExplanation>> {
    return this.process({
      content: pattern,
      compareWith: comparePatterns
    }, config);
  }

  /**
   * Extract and explain grammar from a sentence
   */
  async explainFromSentence(
    sentence: string,
    config?: TaskConfig
  ): Promise<ProcessorResult<GrammarExplanation>> {
    return this.process({
      content: sentence,
      focusPoints: ['Identify main grammar patterns', 'Explain sentence structure']
    }, config);
  }
}