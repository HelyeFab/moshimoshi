/**
 * Image Processor
 * Handles image generation using DALL-E 3 with character consistency
 */

import { BaseProcessor } from './BaseProcessor';
import {
  ProcessorContext,
  ProcessorResult,
  TaskConfig,
  AIServiceError,
  ImageGenerationRequest,
  GeneratedImage,
  CharacterModelSheetRequest,
  GeneratedModelSheet,
  ImagePromptEnhancementRequest,
  EnhancedImagePrompt
} from '../types';
import OpenAI from 'openai';

export class ImageProcessor extends BaseProcessor<ImageGenerationRequest, GeneratedImage> {
  private openai: OpenAI;

  constructor(context: ProcessorContext) {
    super(context);

    if (!process.env.OPEN_AI_API_KEY && !process.env.OPENAI_API_KEY) {
      throw new AIServiceError(
        'OpenAI API key not configured',
        'MISSING_API_KEY',
        500
      );
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY,
      timeout: 60000, // 60 second timeout for image generation
      maxRetries: 2,
    });
  }

  /**
   * Process image generation request
   */
  async process(
    request: ImageGenerationRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<GeneratedImage>> {
    this.validateRequest(request);

    const finalPrompt = this.buildPromptWithConsistency(request);

    try {
      const response = await this.openai.images.generate({
        model: request.model || 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size: request.size || '1024x1024',
        quality: request.quality || 'standard',
        style: request.style || 'vivid',
        response_format: 'url'
      });

      const imageUrl = response.data?.[0]?.url;
      const revisedPrompt = response.data?.[0]?.revised_prompt;

      if (!imageUrl) {
        throw new AIServiceError(
          'No image URL returned from OpenAI',
          'NO_IMAGE_URL',
          500
        );
      }

      const result: GeneratedImage = {
        imageUrl,
        revisedPrompt,
        provider: 'openai',
        metadata: {
          prompt: finalPrompt,
          model: request.model || 'dall-e-3',
          size: request.size || '1024x1024',
          quality: request.quality || 'standard'
        }
      };

      return {
        data: result,
        usage: {
          promptTokens: 0, // DALL-E doesn't return token usage
          completionTokens: 0,
          totalTokens: 0,
          estimatedCost: this.estimateImageCost(request.quality || 'standard', request.size || '1024x1024')
        },
        metadata: {
          provider: 'openai',
          model: request.model || 'dall-e-3'
        }
      };

    } catch (error: any) {
      console.error('DALL-E image generation error:', error);

      if (error.message?.includes('content_policy_violation')) {
        throw new AIServiceError(
          'Image generation rejected due to content policy',
          'CONTENT_POLICY_VIOLATION',
          400,
          { originalError: error.message }
        );
      }

      throw new AIServiceError(
        `Image generation failed: ${error.message}`,
        'IMAGE_GENERATION_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Generate character model sheet
   */
  async generateModelSheet(
    request: CharacterModelSheetRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<GeneratedModelSheet>> {
    const sessionId = Date.now().toString();
    const characterId = `${request.character.name.toLowerCase().replace(/\s+/g, '-')}-${sessionId}`;

    // Create detailed model sheet prompt
    const modelSheetPrompt = this.buildModelSheetPrompt(request, characterId);

    try {
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: modelSheetPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
        response_format: 'url'
      });

      const imageUrl = response.data?.[0]?.url;
      const revisedPrompt = response.data?.[0]?.revised_prompt;

      if (!imageUrl) {
        throw new AIServiceError(
          'No model sheet URL returned from OpenAI',
          'NO_IMAGE_URL',
          500
        );
      }

      // Generate character profile for consistency
      const characterProfile = this.generateCharacterProfile(request, characterId);

      const result: GeneratedModelSheet = {
        imageUrl,
        characterProfile,
        sessionId,
        revisedPrompt
      };

      return {
        data: result,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCost: this.estimateImageCost('standard', '1024x1024')
        },
        metadata: {
          characterId,
          sessionId
        }
      };

    } catch (error: any) {
      console.error('Model sheet generation error:', error);
      throw new AIServiceError(
        `Model sheet generation failed: ${error.message}`,
        'MODEL_SHEET_GENERATION_FAILED',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Enhance image prompt with AI
   */
  async enhancePrompt(
    request: ImagePromptEnhancementRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<EnhancedImagePrompt>> {
    const systemPrompt = `You are an expert at creating detailed image prompts for children's story illustrations.
Given story text, create a comprehensive image prompt that:
1. ALWAYS starts with the character's name and full physical description
2. Describes the specific action or emotion in detail
3. Includes detailed background and setting descriptions
4. Mentions lighting, atmosphere, and mood
5. Adds relevant environmental details (objects, nature, weather)
6. Is vivid and descriptive while appropriate for children

The prompt should be 2-3 sentences long and paint a complete picture.
Return ONLY the enhanced prompt, no explanations.`;

    const userPrompt = `Base prompt: ${request.basePrompt}
${request.pageText ? `Story text: ${request.pageText}` : ''}
${request.pageTranslation ? `Translation: ${request.pageTranslation}` : ''}
${request.characterName ? `Character: ${request.characterName} (${request.characterDescription})` : ''}
${request.theme ? `Theme: ${request.theme}` : ''}
${request.setting ? `Setting: ${request.setting}` : ''}

Create a detailed, descriptive image prompt that MUST include the character's full description.`;

    const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);

    const result: EnhancedImagePrompt = {
      enhancedPrompt: content.trim(),
      originalPrompt: request.basePrompt,
      metadata: {
        characterIncluded: !!request.characterName,
        settingIncluded: !!request.setting,
        visualStyleApplied: true
      }
    };

    return {
      data: result,
      usage,
      metadata: {
        enhancementApplied: true
      }
    };
  }

  /**
   * Validate request
   */
  validateRequest(request: ImageGenerationRequest): void {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new AIServiceError(
        'Image prompt is required',
        'VALIDATION_ERROR',
        400
      );
    }

    if (request.prompt.length > 4000) {
      throw new AIServiceError(
        'Image prompt is too long (max 4000 characters)',
        'VALIDATION_ERROR',
        400
      );
    }
  }

  /**
   * Build prompt with character consistency
   */
  private buildPromptWithConsistency(request: ImageGenerationRequest): string {
    let finalPrompt = request.prompt;

    if (request.characterProfile) {
      const profile = request.characterProfile;
      const characterRef = request.sessionId
        ? `[CHARACTER REF: ${profile.characterId}-${request.sessionId}]`
        : `[CHARACTER REF: ${profile.characterId}]`;

      // Build detailed character description
      const characterDesc = `${profile.apparentAge} ${profile.gender}, ${profile.hairColor} ${profile.hairStyle} hair, ${profile.eyeColor} eyes, ${profile.skinTone} skin, ${profile.bodyBuild} build, wearing ${profile.primaryOutfit} in ${profile.outfitColors} colors`;

      finalPrompt = `${characterRef} ${profile.artStyle}. IMPORTANT: Draw the EXACT SAME character consistently. Character: ${characterDesc}. Scene: ${request.prompt}. Style modifiers: ${profile.styleModifiers.join(', ')}`;
    }

    return finalPrompt;
  }

  /**
   * Build model sheet prompt
   */
  private buildModelSheetPrompt(request: CharacterModelSheetRequest, characterId: string): string {
    return `[CHARACTER MODEL SHEET ${characterId}] Create a detailed character model sheet for: ${request.character.name}

Character Description: ${request.character.description}
Visual Details: ${request.character.visualDescription}
Art Style: ${request.visualStyle}

Show the character in multiple poses and expressions. This will be used as a reference for maintaining consistency across multiple images. Include front view, side view, and various facial expressions. Clear, professional character design sheet.`;
  }

  /**
   * Generate character profile from request
   */
  private generateCharacterProfile(request: CharacterModelSheetRequest, characterId: string): any {
    const description = request.character.visualDescription.toLowerCase();

    return {
      characterId,
      gender: this.extractGender(description),
      apparentAge: this.extractAge(description),
      hairStyle: this.extractHairStyle(description),
      hairColor: this.extractHairColor(description),
      eyeColor: this.extractEyeColor(description),
      skinTone: this.extractSkinTone(description),
      facialFeatures: this.extractFacialFeatures(description),
      bodyBuild: this.extractBodyBuild(description),
      height: this.extractHeight(description),
      primaryOutfit: this.extractOutfit(description),
      outfitColors: this.extractColors(description),
      artStyle: request.visualStyle,
      styleModifiers: [
        'consistent character depiction',
        'maintain exact appearance across all images',
        'character design consistency'
      ]
    };
  }

  // Extraction helper methods
  private extractGender(desc: string): 'male' | 'female' | 'non-binary' {
    if (desc.includes('boy') || desc.includes('male')) return 'male';
    if (desc.includes('girl') || desc.includes('female')) return 'female';
    return 'non-binary';
  }

  private extractAge(desc: string): string {
    if (desc.includes('child') || desc.includes('young')) return '8-12 years old';
    if (desc.includes('teen')) return '13-17 years old';
    if (desc.includes('adult')) return 'adult';
    return '10 years old';
  }

  private extractHairStyle(desc: string): string {
    if (desc.includes('short')) return 'short';
    if (desc.includes('long')) return 'long';
    if (desc.includes('spiky')) return 'spiky';
    return 'medium length';
  }

  private extractHairColor(desc: string): string {
    if (desc.includes('black')) return 'black';
    if (desc.includes('brown')) return 'brown';
    if (desc.includes('blonde')) return 'blonde';
    return 'dark brown';
  }

  private extractEyeColor(desc: string): string {
    if (desc.includes('blue')) return 'blue';
    if (desc.includes('brown')) return 'brown';
    if (desc.includes('green')) return 'green';
    return 'brown';
  }

  private extractSkinTone(desc: string): string {
    if (desc.includes('fair') || desc.includes('light')) return 'fair';
    if (desc.includes('tan')) return 'tan';
    if (desc.includes('dark')) return 'dark';
    return 'light';
  }

  private extractFacialFeatures(desc: string): string {
    return 'round face, friendly expression';
  }

  private extractBodyBuild(desc: string): string {
    if (desc.includes('slim')) return 'slim';
    if (desc.includes('athletic')) return 'athletic';
    return 'average';
  }

  private extractHeight(desc: string): string {
    if (desc.includes('tall')) return 'tall for age';
    if (desc.includes('short')) return 'short for age';
    return 'average height';
  }

  private extractOutfit(desc: string): string {
    if (desc.includes('school')) return 'school uniform';
    if (desc.includes('casual')) return 'casual clothing';
    return 'simple outfit';
  }

  private extractColors(desc: string): string {
    const colors = [];
    if (desc.includes('red')) colors.push('red');
    if (desc.includes('blue')) colors.push('blue');
    if (desc.includes('white')) colors.push('white');
    return colors.length > 0 ? colors.join(', ') : 'neutral colors';
  }

  /**
   * Estimate image generation cost
   */
  private estimateImageCost(quality: string, size: string): number {
    // DALL-E 3 pricing (as of 2024)
    if (quality === 'hd') {
      if (size === '1024x1792' || size === '1792x1024') return 0.120;
      return 0.080; // 1024x1024 HD
    }
    // Standard quality
    if (size === '1024x1792' || size === '1792x1024') return 0.080;
    return 0.040; // 1024x1024 standard
  }

  /**
   * Required by BaseProcessor - not used for image generation
   */
  getSystemPrompt(config?: TaskConfig): string {
    return '';
  }

  /**
   * Required by BaseProcessor - not used for image generation
   */
  getUserPrompt(request: ImageGenerationRequest, config?: TaskConfig): string {
    return request.prompt;
  }

  /**
   * Required by BaseProcessor - not used for image generation
   */
  parseResponse(response: string): GeneratedImage {
    throw new Error('parseResponse not used for image generation');
  }
}