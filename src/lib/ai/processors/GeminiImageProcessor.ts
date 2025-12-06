/**
 * Gemini Image Processor
 * Handles image generation using Google's Gemini/Imagen API
 *
 * Features:
 * - Character consistency via reference images (up to 5 human refs)
 * - Multi-image input for maintaining appearance across scenes
 * - Support for both standard and pro models
 *
 * Models:
 * - gemini-2.5-flash-image ("Nano Banana") - Fast, free tier
 * - gemini-3-pro-image ("Nano Banana Pro") - Higher quality, better consistency
 */

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
  EnhancedImagePrompt,
  TokenUsage,
} from '../types'

interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
        inlineData?: {
          mimeType: string
          data: string // base64 encoded
        }
      }>
    }
  }>
  error?: {
    code: number
    message: string
  }
}

interface CharacterReference {
  imageData: string // base64 encoded image
  mimeType?: string // default: image/png
  name?: string // optional character name for prompt
}

// Extended request with character references
interface ImageGenerationRequestWithRefs extends ImageGenerationRequest {
  characterReferences?: CharacterReference[]
  useProModel?: boolean // Use Nano Banana Pro for better consistency
}

export class GeminiImageProcessor {
  private apiKey: string
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models'
  private standardModel = 'gemini-2.5-flash-image' // "Nano Banana" - fast
  private proModel = 'gemini-3-pro-image' // "Nano Banana Pro" - better consistency
  private context: ProcessorContext

  constructor(context: ProcessorContext) {
    this.context = context

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new AIServiceError(
        'Gemini API key not configured (GEMINI_API_KEY)',
        'MISSING_API_KEY',
        500
      )
    }
    this.apiKey = apiKey
  }

  /**
   * Process image generation request using Gemini
   * Supports character consistency via reference images
   */
  async process(
    request: ImageGenerationRequestWithRefs,
    config?: TaskConfig
  ): Promise<ProcessorResult<GeneratedImage>> {
    this.validateRequest(request)

    const finalPrompt = this.buildPromptWithConsistency(request)
    const hasCharacterRefs = request.characterReferences && request.characterReferences.length > 0

    // Use Pro model for better character consistency when references provided
    const useProModel = request.useProModel || hasCharacterRefs

    try {
      const response = await this.callGeminiImageAPI(
        finalPrompt,
        request,
        useProModel,
        request.characterReferences
      )

      if (!response.imageData) {
        throw new AIServiceError('No image data returned from Gemini', 'NO_IMAGE_DATA', 500)
      }

      const modelUsed = useProModel ? this.proModel : this.standardModel

      const result: GeneratedImage = {
        imageUrl: `data:image/png;base64,${response.imageData}`,
        revisedPrompt: response.text || finalPrompt,
        provider: 'gemini',
        metadata: {
          prompt: finalPrompt,
          model: modelUsed,
          size: request.size || '1024x1024',
          quality: request.quality || 'standard',
        },
      }

      return {
        data: result,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCost: useProModel ? 0.04 : 0.02,
        },
        metadata: {
          provider: 'gemini',
          model: modelUsed,
          characterRefsUsed: request.characterReferences?.length || 0,
        },
      }
    } catch (error: any) {
      console.error('Gemini image generation error:', error)

      if (error instanceof AIServiceError) {
        throw error
      }

      throw new AIServiceError(
        `Image generation failed: ${error.message}`,
        'IMAGE_GENERATION_FAILED',
        500,
        { originalError: error.message }
      )
    }
  }

  /**
   * Generate image with character consistency
   * Uses reference images to maintain character appearance across multiple generations
   *
   * @param prompt - Scene description
   * @param characterRefs - Array of character reference images (up to 5)
   * @param aspectRatio - Output aspect ratio (e.g., "16:9", "1:1", "9:16")
   */
  async generateWithCharacterConsistency(
    prompt: string,
    characterRefs: CharacterReference[],
    aspectRatio: string = '1:1'
  ): Promise<ProcessorResult<GeneratedImage>> {
    if (characterRefs.length > 5) {
      throw new AIServiceError(
        'Maximum 5 character references allowed for consistency',
        'TOO_MANY_REFS',
        400
      )
    }

    // Build character names into prompt if provided
    const characterNames = characterRefs
      .filter(ref => ref.name)
      .map(ref => ref.name)
      .join(', ')

    const enhancedPrompt = characterNames
      ? `${prompt}. Characters: ${characterNames}. Maintain exact appearance from reference images.`
      : `${prompt}. Maintain exact character appearance from reference images.`

    return this.process({
      prompt: enhancedPrompt,
      characterReferences: characterRefs,
      useProModel: true,
      size: this.aspectRatioToSize(aspectRatio),
    })
  }

  /**
   * Call Gemini Image Generation API
   * Supports reference images via inlineData for character consistency
   */
  private async callGeminiImageAPI(
    prompt: string,
    request: ImageGenerationRequestWithRefs,
    useProModel: boolean = false,
    characterRefs?: CharacterReference[]
  ): Promise<{ imageData?: string; text?: string }> {
    const model = useProModel ? this.proModel : this.standardModel
    const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`

    // Build aspect ratio hint from size
    let aspectRatioHint = ''
    if (request.size === '1792x1024') {
      aspectRatioHint = ' (landscape orientation, 16:9 aspect ratio)'
    } else if (request.size === '1024x1792') {
      aspectRatioHint = ' (portrait orientation, 9:16 aspect ratio)'
    }

    const enhancedPrompt = `${prompt}${aspectRatioHint}. High quality, detailed illustration suitable for a children's story book.`

    // Build parts array with text prompt and optional reference images
    const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
      { text: enhancedPrompt },
    ]

    // Add character reference images for consistency
    if (characterRefs && characterRefs.length > 0) {
      for (const ref of characterRefs) {
        parts.push({
          inline_data: {
            mime_type: ref.mimeType || 'image/png',
            data: ref.imageData,
          },
        })
      }
    }

    const body: any = {
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }

    // Add image config for Pro model
    if (useProModel) {
      body.generationConfig.imageConfig = {
        aspectRatio: this.sizeToAspectRatio(request.size),
        imageSize: '2K',
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error response:', errorText)

      if (response.status === 400) {
        throw new AIServiceError(
          'Image generation rejected - prompt may violate content policy',
          'CONTENT_POLICY_VIOLATION',
          400
        )
      }

      throw new AIServiceError(
        `Gemini API error: ${response.status} - ${errorText}`,
        'API_ERROR',
        response.status
      )
    }

    const data: GeminiImageResponse = await response.json()

    if (data.error) {
      throw new AIServiceError(data.error.message, 'GEMINI_ERROR', data.error.code)
    }

    // Extract image data and text from response
    let imageData: string | undefined
    let text: string | undefined

    const responseParts = data.candidates?.[0]?.content?.parts || []
    for (const part of responseParts) {
      if (part.inlineData) {
        imageData = part.inlineData.data
      }
      if (part.text) {
        text = part.text
      }
    }

    return { imageData, text }
  }

  /**
   * Generate character model sheet using Gemini
   * Creates a reference sheet that can be used for character consistency
   */
  async generateModelSheet(
    request: CharacterModelSheetRequest,
    config?: TaskConfig
  ): Promise<ProcessorResult<GeneratedModelSheet>> {
    const sessionId = Date.now().toString()
    const characterId = `${request.character.name.toLowerCase().replace(/\s+/g, '-')}-${sessionId}`

    const modelSheetPrompt = this.buildModelSheetPrompt(request, characterId)

    try {
      // Use Pro model for model sheets (higher quality reference)
      const response = await this.callGeminiImageAPI(
        modelSheetPrompt,
        { prompt: modelSheetPrompt, size: '1024x1024', quality: 'standard' },
        true // Use Pro model
      )

      if (!response.imageData) {
        throw new AIServiceError('No model sheet data returned from Gemini', 'NO_IMAGE_DATA', 500)
      }

      const characterProfile = this.generateCharacterProfile(request, characterId)

      // Include the base64 image data for use as reference in future generations
      const result: GeneratedModelSheet = {
        imageUrl: `data:image/png;base64,${response.imageData}`,
        characterProfile: {
          ...characterProfile,
          referenceImageData: response.imageData, // Store for character consistency
        },
        sessionId,
        revisedPrompt: response.text,
      }

      return {
        data: result,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCost: 0.04,
        },
        metadata: {
          characterId,
          sessionId,
        },
      }
    } catch (error: any) {
      console.error('Model sheet generation error:', error)
      throw new AIServiceError(
        `Model sheet generation failed: ${error.message}`,
        'MODEL_SHEET_GENERATION_FAILED',
        500,
        { originalError: error.message }
      )
    }
  }

  /**
   * Generate multiple story page images with consistent characters
   */
  async generateStoryPageImages(
    pages: Array<{ pageNumber: number; sceneDescription: string }>,
    characterRefs: CharacterReference[],
    artStyle: string = "children's book illustration"
  ): Promise<Array<ProcessorResult<GeneratedImage>>> {
    const results: Array<ProcessorResult<GeneratedImage>> = []

    for (const page of pages) {
      const prompt = `${artStyle}. Page ${page.pageNumber}: ${page.sceneDescription}`

      try {
        const result = await this.generateWithCharacterConsistency(
          prompt,
          characterRefs,
          '16:9' // Landscape for story pages
        )
        results.push(result)
      } catch (error: any) {
        console.error(`Failed to generate page ${page.pageNumber}:`, error)
        // Continue with other pages even if one fails
        results.push({
          data: null as any,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
          metadata: { error: error.message, pageNumber: page.pageNumber },
        })
      }
    }

    return results
  }

  /**
   * Validate request
   */
  validateRequest(request: ImageGenerationRequest): void {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new AIServiceError('Image prompt is required', 'VALIDATION_ERROR', 400)
    }

    if (request.prompt.length > 4000) {
      throw new AIServiceError(
        'Image prompt is too long (max 4000 characters)',
        'VALIDATION_ERROR',
        400
      )
    }
  }

  /**
   * Build prompt with character consistency
   */
  private buildPromptWithConsistency(request: ImageGenerationRequest): string {
    let finalPrompt = request.prompt

    if (request.characterProfile) {
      const profile = request.characterProfile
      const characterDesc = `${profile.apparentAge} ${profile.gender}, ${profile.hairColor} ${profile.hairStyle} hair, ${profile.eyeColor} eyes, ${profile.skinTone} skin, ${profile.bodyBuild} build, wearing ${profile.primaryOutfit} in ${profile.outfitColors} colors`

      finalPrompt = `${profile.artStyle}. Character: ${characterDesc}. Scene: ${request.prompt}. Style: ${profile.styleModifiers.join(', ')}`
    }

    return finalPrompt
  }

  /**
   * Build model sheet prompt
   */
  private buildModelSheetPrompt(request: CharacterModelSheetRequest, characterId: string): string {
    return `Create a detailed character model sheet for: ${request.character.name}

Character Description: ${request.character.description}
Visual Details: ${request.character.visualDescription}
Art Style: ${request.visualStyle}

IMPORTANT: Show the character in multiple poses and expressions:
- Front view (full body)
- Side view (profile)
- 3/4 view
- Close-up face with different expressions (happy, sad, surprised, determined)

This is a professional character design reference sheet for maintaining consistency across multiple illustrations. Clear, detailed, white background.`
  }

  /**
   * Generate character profile from request
   */
  private generateCharacterProfile(request: CharacterModelSheetRequest, characterId: string): any {
    const description = request.character.visualDescription.toLowerCase()

    return {
      characterId,
      name: request.character.name,
      gender:
        description.includes('boy') || description.includes('male')
          ? 'male'
          : description.includes('girl') || description.includes('female')
            ? 'female'
            : 'non-binary',
      apparentAge:
        description.includes('child') || description.includes('young')
          ? '8-12 years old'
          : '10 years old',
      hairStyle: description.includes('short')
        ? 'short'
        : description.includes('long')
          ? 'long'
          : 'medium length',
      hairColor: description.includes('black')
        ? 'black'
        : description.includes('blonde')
          ? 'blonde'
          : 'brown',
      eyeColor: description.includes('blue')
        ? 'blue'
        : description.includes('green')
          ? 'green'
          : 'brown',
      skinTone: description.includes('fair')
        ? 'fair'
        : description.includes('tan')
          ? 'tan'
          : 'light',
      facialFeatures: 'round face, friendly expression',
      bodyBuild: description.includes('slim')
        ? 'slim'
        : description.includes('athletic')
          ? 'athletic'
          : 'average',
      height: 'average height',
      primaryOutfit: description.includes('school') ? 'school uniform' : 'simple outfit',
      outfitColors: 'neutral colors',
      artStyle: request.visualStyle,
      styleModifiers: ['consistent character depiction', 'maintain exact appearance'],
      // Reference image will be added after generation
      referenceImageData: null as string | null,
    }
  }

  /**
   * Convert size string to aspect ratio
   */
  private sizeToAspectRatio(size?: string): string {
    switch (size) {
      case '1792x1024':
        return '16:9'
      case '1024x1792':
        return '9:16'
      case '1024x1024':
      default:
        return '1:1'
    }
  }

  /**
   * Convert aspect ratio to size string
   */
  private aspectRatioToSize(aspectRatio: string): '1024x1024' | '1792x1024' | '1024x1792' {
    switch (aspectRatio) {
      case '16:9':
        return '1792x1024'
      case '9:16':
        return '1024x1792'
      case '1:1':
      default:
        return '1024x1024'
    }
  }
}
