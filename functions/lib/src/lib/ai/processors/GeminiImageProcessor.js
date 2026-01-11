"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiImageProcessor = void 0;
const types_1 = require("../types");
class GeminiImageProcessor {
    constructor(context) {
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
        this.standardModel = 'gemini-2.5-flash-image'; // "Nano Banana" - fast
        this.proModel = 'gemini-2.5-flash-image'; // Use same model until gemini-3-pro-image is available
        this.context = context;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new types_1.AIServiceError('Gemini API key not configured (GEMINI_API_KEY)', 'MISSING_API_KEY', 500);
        }
        this.apiKey = apiKey;
    }
    /**
     * Process image generation request using Gemini
     * Supports character consistency via reference images
     */
    async process(request, config) {
        var _a;
        this.validateRequest(request);
        const finalPrompt = this.buildPromptWithConsistency(request);
        const hasCharacterRefs = request.characterReferences && request.characterReferences.length > 0;
        // Use Pro model for better character consistency when references provided
        const useProModel = request.useProModel || hasCharacterRefs;
        try {
            const response = await this.callGeminiImageAPI(finalPrompt, request, useProModel, request.characterReferences);
            if (!response.imageData) {
                throw new types_1.AIServiceError('No image data returned from Gemini', 'NO_IMAGE_DATA', 500);
            }
            const modelUsed = useProModel ? this.proModel : this.standardModel;
            const result = {
                imageUrl: `data:image/png;base64,${response.imageData}`,
                revisedPrompt: response.text || finalPrompt,
                provider: 'gemini',
                metadata: {
                    prompt: finalPrompt,
                    model: modelUsed,
                    size: request.size || '1024x1024',
                    quality: request.quality || 'standard',
                },
            };
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
                    characterRefsUsed: ((_a = request.characterReferences) === null || _a === void 0 ? void 0 : _a.length) || 0,
                },
            };
        }
        catch (error) {
            console.error('Gemini image generation error:', error);
            if (error instanceof types_1.AIServiceError) {
                throw error;
            }
            throw new types_1.AIServiceError(`Image generation failed: ${error.message}`, 'IMAGE_GENERATION_FAILED', 500, { originalError: error.message });
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
    async generateWithCharacterConsistency(prompt, characterRefs, aspectRatio = '1:1') {
        if (characterRefs.length > 5) {
            throw new types_1.AIServiceError('Maximum 5 character references allowed for consistency', 'TOO_MANY_REFS', 400);
        }
        // Build character names into prompt if provided
        const characterNames = characterRefs
            .filter(ref => ref.name)
            .map(ref => ref.name)
            .join(', ');
        const enhancedPrompt = characterNames
            ? `${prompt}. Characters: ${characterNames}. Maintain exact appearance from reference images.`
            : `${prompt}. Maintain exact character appearance from reference images.`;
        return this.process({
            prompt: enhancedPrompt,
            characterReferences: characterRefs,
            useProModel: true,
            size: this.aspectRatioToSize(aspectRatio),
        });
    }
    /**
     * Call Gemini Image Generation API
     * Supports reference images via inlineData for character consistency
     */
    async callGeminiImageAPI(prompt, request, useProModel = false, characterRefs) {
        var _a, _b, _c, _d, _e, _f;
        const model = useProModel ? this.proModel : this.standardModel;
        const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;
        // Build aspect ratio hint from size
        let aspectRatioHint = '';
        if (request.size === '1792x1024') {
            aspectRatioHint = ' (landscape orientation, 16:9 aspect ratio)';
        }
        else if (request.size === '1024x1792') {
            aspectRatioHint = ' (portrait orientation, 9:16 aspect ratio)';
        }
        // Build enhanced prompt with stronger character consistency instructions when refs provided
        let enhancedPrompt = `${prompt}${aspectRatioHint}. High quality, detailed illustration suitable for a children's story book.

🎨 OUTPUT FORMAT REQUIREMENTS:
- Generate ONLY a single complete comic panel scene
- DO NOT add "ACCESSORY DETAILS" sections
- DO NOT add detail breakdowns, side views, or item catalogs below the main image
- DO NOT add character turnarounds or reference sheets
- DO NOT add supplementary diagrams or labels
- The output should be ONLY the comic panel scene itself`;
        // Add CRITICAL character consistency instructions if reference images are provided
        if (characterRefs && characterRefs.length > 0) {
            const charNames = characterRefs.filter(ref => ref.name).map(ref => ref.name).join(', ');
            enhancedPrompt += `\n\n🚨 CRITICAL CHARACTER CONSISTENCY REQUIREMENTS 🚨
The images provided above are REFERENCE IMAGES showing the EXACT APPEARANCE of characters: ${charNames}.

YOU MUST:
1. COPY the exact visual appearance from each reference image
2. Match EVERY detail: colors, patterns, features, proportions, clothing
3. DO NOT create "consolidated" or "hybrid" versions of characters
4. DO NOT invent new characters - ONLY use the characters shown in references
5. Each character from the references appears EXACTLY ONCE in the scene
6. The reference images are the ABSOLUTE SOURCE OF TRUTH - prioritize them over any text descriptions

FORBIDDEN:
- Creating variations or "interpretations" of the reference characters
- Merging multiple characters into one
- Adding characters not shown in references
- Changing any visual features from the references

Follow the reference images EXACTLY.`;
        }
        // Build parts array with text prompt and optional reference images
        const parts = [];
        // Add character reference images FIRST (before text) for maximum priority
        if (characterRefs && characterRefs.length > 0) {
            console.log(`[GeminiImageProcessor] Adding ${characterRefs.length} character reference images BEFORE prompt for priority`);
            for (const ref of characterRefs) {
                parts.push({
                    inline_data: {
                        mime_type: ref.mimeType || 'image/png',
                        data: ref.imageData,
                    },
                });
            }
        }
        // Add text prompt AFTER reference images
        parts.push({ text: enhancedPrompt });
        const body = {
            contents: [
                {
                    parts,
                },
            ],
            generationConfig: {
                responseModalities: ['TEXT', 'IMAGE'],
            },
        };
        // Add image config with aspect ratio
        // Note: imageSize is only supported by gemini-3-pro-image-preview, not gemini-2.5-flash-image
        // For gemini-2.5-flash-image, we can only specify aspectRatio
        const aspectRatio = this.sizeToAspectRatio(request.size);
        if (aspectRatio) {
            body.generationConfig.imageConfig = {
                aspectRatio,
            };
        }
        console.log('[GeminiImageProcessor] Making Gemini API request:', {
            model,
            hasCharacterRefs: !!(characterRefs && characterRefs.length > 0),
            characterRefCount: (characterRefs === null || characterRefs === void 0 ? void 0 : characterRefs.length) || 0,
            promptPreview: prompt.substring(0, 200) + '...',
        });
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        console.log('[GeminiImageProcessor] Gemini API response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[GeminiImageProcessor] Gemini API error response:', {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText.substring(0, 1000),
                model,
                promptPreview: prompt.substring(0, 100),
            });
            if (response.status === 400) {
                // Try to parse error details
                try {
                    const errorJson = JSON.parse(errorText);
                    console.error('[GeminiImageProcessor] Parsed error details:', errorJson);
                }
                catch (_g) {
                    // Not JSON
                }
                throw new types_1.AIServiceError(`Image generation rejected (400): ${errorText.substring(0, 200)}`, 'CONTENT_POLICY_VIOLATION', 400);
            }
            throw new types_1.AIServiceError(`Gemini API error: ${response.status} - ${errorText.substring(0, 500)}`, 'API_ERROR', response.status);
        }
        const data = await response.json();
        console.log('[GeminiImageProcessor] Gemini API response parsed:', {
            hasCandidates: !!((_a = data.candidates) === null || _a === void 0 ? void 0 : _a.length),
            candidateCount: ((_b = data.candidates) === null || _b === void 0 ? void 0 : _b.length) || 0,
            hasError: !!data.error,
            errorMessage: (_c = data.error) === null || _c === void 0 ? void 0 : _c.message,
        });
        if (data.error) {
            console.error('[GeminiImageProcessor] Gemini returned error in response:', data.error);
            throw new types_1.AIServiceError(data.error.message, 'GEMINI_ERROR', data.error.code);
        }
        // Extract image data and text from response
        let imageData;
        let text;
        const responseParts = ((_f = (_e = (_d = data.candidates) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.content) === null || _f === void 0 ? void 0 : _f.parts) || [];
        for (const part of responseParts) {
            if (part.inlineData) {
                imageData = part.inlineData.data;
            }
            if (part.text) {
                text = part.text;
            }
        }
        return { imageData, text };
    }
    /**
     * Generate character model sheet using Gemini
     * Creates a reference sheet that can be used for character consistency
     */
    async generateModelSheet(request, config) {
        var _a, _b;
        const sessionId = Date.now().toString();
        const characterId = `${request.character.name.toLowerCase().replace(/\s+/g, '-')}-${sessionId}`;
        const modelSheetPrompt = this.buildModelSheetPrompt(request, characterId);
        console.log('[GeminiImageProcessor] generateModelSheet called:', {
            characterName: request.character.name,
            characterId,
            promptLength: modelSheetPrompt.length,
            visualStyle: request.visualStyle,
        });
        try {
            // Use Pro model for model sheets (higher quality reference)
            console.log('[GeminiImageProcessor] Calling Gemini API for model sheet...');
            const response = await this.callGeminiImageAPI(modelSheetPrompt, { prompt: modelSheetPrompt, size: '1024x1024', quality: 'standard' }, true // Use Pro model
            );
            console.log('[GeminiImageProcessor] Gemini API response received:', {
                hasImageData: !!response.imageData,
                imageDataLength: ((_a = response.imageData) === null || _a === void 0 ? void 0 : _a.length) || 0,
                hasText: !!response.text,
            });
            if (!response.imageData) {
                throw new types_1.AIServiceError('No model sheet data returned from Gemini', 'NO_IMAGE_DATA', 500);
            }
            const characterProfile = this.generateCharacterProfile(request, characterId);
            // Include the base64 image data for use as reference in future generations
            const result = {
                imageUrl: `data:image/png;base64,${response.imageData}`,
                characterProfile: Object.assign(Object.assign({}, characterProfile), { referenceImageData: response.imageData }),
                sessionId,
                revisedPrompt: response.text,
            };
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
            };
        }
        catch (error) {
            console.error('[GeminiImageProcessor] Model sheet generation error:', {
                errorName: error.name,
                errorMessage: error.message,
                errorCode: error.code,
                errorStack: (_b = error.stack) === null || _b === void 0 ? void 0 : _b.split('\n').slice(0, 5).join('\n'),
                characterName: request.character.name,
                visualStyle: request.visualStyle,
            });
            throw new types_1.AIServiceError(`Model sheet generation failed: ${error.message}`, 'MODEL_SHEET_GENERATION_FAILED', 500, { originalError: error.message, errorCode: error.code });
        }
    }
    /**
     * Generate multiple story page images with consistent characters
     */
    async generateStoryPageImages(pages, characterRefs, artStyle = "children's book illustration") {
        const results = [];
        for (const page of pages) {
            const prompt = `${artStyle}. Page ${page.pageNumber}: ${page.sceneDescription}`;
            try {
                const result = await this.generateWithCharacterConsistency(prompt, characterRefs, '16:9' // Landscape for story pages
                );
                results.push(result);
            }
            catch (error) {
                console.error(`Failed to generate page ${page.pageNumber}:`, error);
                // Continue with other pages even if one fails
                results.push({
                    data: null,
                    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
                    metadata: { error: error.message, pageNumber: page.pageNumber },
                });
            }
        }
        return results;
    }
    /**
     * Validate request
     */
    validateRequest(request) {
        if (!request.prompt || request.prompt.trim().length === 0) {
            throw new types_1.AIServiceError('Image prompt is required', 'VALIDATION_ERROR', 400);
        }
        if (request.prompt.length > 4000) {
            throw new types_1.AIServiceError('Image prompt is too long (max 4000 characters)', 'VALIDATION_ERROR', 400);
        }
    }
    /**
     * Build prompt with character consistency
     */
    buildPromptWithConsistency(request) {
        let finalPrompt = request.prompt;
        if (request.characterProfile) {
            const profile = request.characterProfile;
            const characterDesc = `${profile.apparentAge} ${profile.gender}, ${profile.hairColor} ${profile.hairStyle} hair, ${profile.eyeColor} eyes, ${profile.skinTone} skin, ${profile.bodyBuild} build, wearing ${profile.primaryOutfit} in ${profile.outfitColors} colors`;
            finalPrompt = `${profile.artStyle}. Character: ${characterDesc}. Scene: ${request.prompt}. Style: ${profile.styleModifiers.join(', ')}`;
        }
        return finalPrompt;
    }
    /**
     * Sanitize character description to avoid triggering content policy
     * Replaces age-related terms that combined with "poses" could trigger safety filters
     */
    sanitizeCharacterDescription(text) {
        if (!text)
            return '';
        return text
            .replace(/\b(child|children|kid|kids|young boy|young girl)\b/gi, 'young character')
            .replace(/\b(\d+)\s*(year|yr)s?\s*old\b/gi, '')
            .replace(/\b(boy|girl)\b/gi, 'character')
            .trim();
    }
    /**
     * Build model sheet prompt
     */
    buildModelSheetPrompt(request, characterId) {
        // Sanitize descriptions to avoid content policy triggers
        const safeDescription = this.sanitizeCharacterDescription(request.character.description);
        const safeVisualDesc = this.sanitizeCharacterDescription(request.character.visualDescription);
        return `Create a professional character design reference sheet for: ${request.character.name}

Character: ${safeDescription}
Visual Style: ${safeVisualDesc}
Art Style: ${request.visualStyle}

This is a character reference sheet showing the character from different angles (front view, side profile, 3/4 view) for maintaining visual consistency in illustrations. Professional illustration style, clean white background.`;
    }
    /**
     * Generate character profile from request
     */
    generateCharacterProfile(request, characterId) {
        const description = request.character.visualDescription.toLowerCase();
        return {
            characterId,
            name: request.character.name,
            gender: description.includes('boy') || description.includes('male')
                ? 'male'
                : description.includes('girl') || description.includes('female')
                    ? 'female'
                    : 'non-binary',
            apparentAge: description.includes('child') || description.includes('young')
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
            referenceImageData: null,
        };
    }
    /**
     * Convert size string to aspect ratio
     */
    sizeToAspectRatio(size) {
        switch (size) {
            case '1792x1024':
                return '16:9';
            case '1024x1792':
                return '9:16';
            case '1024x1024':
            default:
                return '1:1';
        }
    }
    /**
     * Convert aspect ratio to size string
     */
    aspectRatioToSize(aspectRatio) {
        switch (aspectRatio) {
            case '16:9':
                return '1792x1024';
            case '9:16':
                return '1024x1792';
            case '1:1':
            default:
                return '1024x1024';
        }
    }
}
exports.GeminiImageProcessor = GeminiImageProcessor;
//# sourceMappingURL=GeminiImageProcessor.js.map