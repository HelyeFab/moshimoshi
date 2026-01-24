"use strict";
/**
 * Translation Processor
 * Learning-focused Japanese-English translation with progressive assistance modes
 *
 * Features:
 * - Zod schema validation for reliable structured outputs
 * - Firebase caching for cost optimization
 * - Multiple translation modes (hints, partial, full, learning)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationProcessor = void 0;
const BaseProcessor_1 = require("./BaseProcessor");
const types_1 = require("../types");
const translations_1 = require("@/lib/firebase/collections/translations");
const schemas_1 = require("../schemas");
class TranslationProcessor extends BaseProcessor_1.BaseProcessor {
    constructor(context) {
        super(context);
    }
    /**
     * Process the translation request
     */
    async process(request, config) {
        // Validate the request
        this.validateRequest(request);
        // Set defaults
        const normalizedRequest = this.normalizeRequest(request, config);
        const startTime = Date.now();
        let cached = false;
        let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };
        try {
            // 🔍 STEP 1: Check Firebase cache first
            console.log(`🔍 Checking Firebase cache for: "${normalizedRequest.text.substring(0, 50)}..." (${normalizedRequest.mode})`);
            if (!translations_1.translationCache ||
                typeof translations_1.translationCache.getCachedTranslation !== 'function') {
                console.warn('⚠️ Translation cache not initialized; skipping cache read');
            }
            else {
                const cachedResult = await translations_1.translationCache.getCachedTranslation(normalizedRequest.text, normalizedRequest.mode, normalizedRequest.userLevel, {
                    includeGrammarNotes: normalizedRequest.includeGrammarNotes,
                    preserveGrammarStructure: normalizedRequest.preserveGrammarStructure
                });
                if (cachedResult) {
                    console.log(`✅ Cache HIT! Using cached translation (${Date.now() - startTime}ms)`);
                    cached = true;
                    return {
                        data: cachedResult,
                        usage, // Zero cost for cached results
                        metadata: {
                            mode: normalizedRequest.mode,
                            sourceLang: normalizedRequest.sourceLang,
                            targetLang: normalizedRequest.targetLang,
                            userLevel: normalizedRequest.userLevel,
                            cached: true,
                            cacheHit: true
                        }
                    };
                }
            }
            console.log(`❌ Cache MISS. Proceeding with AI translation...`);
        }
        catch (cacheError) {
            console.error('⚠️ Firebase cache error (proceeding with AI):', cacheError);
            // Continue with AI translation if cache fails
        }
        // 🤖 STEP 2: Generate with AI (cache miss or cache error)
        try {
            // Generate prompts based on mode
            const systemPrompt = this.getSystemPrompt(config);
            const userPrompt = this.getUserPrompt(normalizedRequest, config);
            // Call OpenAI
            const { content, usage: aiUsage } = await this.callOpenAI(systemPrompt, userPrompt);
            usage = aiUsage;
            // Parse the response
            const result = this.parseResponse(content);
            // Enhance the result with metadata
            const enhancedResult = this.enhanceTranslationResult(result, normalizedRequest, config);
            // 💾 STEP 3: Store in Firebase cache for future use
            try {
                const costInfo = {
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    estimatedCost: usage.estimatedCost
                };
                const context = (config === null || config === void 0 ? void 0 : config.source) ? {
                    source: config.source,
                    articleId: config.articleId,
                    articleTitle: config.articleTitle
                } : undefined;
                if (!translations_1.translationCache ||
                    typeof translations_1.translationCache.storeTranslation !== 'function') {
                    console.warn('⚠️ Translation cache not initialized; skipping cache write');
                }
                else {
                    await translations_1.translationCache.storeTranslation(normalizedRequest.text, normalizedRequest.mode, normalizedRequest.userLevel, enhancedResult, costInfo, context, {
                        includeGrammarNotes: normalizedRequest.includeGrammarNotes,
                        preserveGrammarStructure: normalizedRequest.preserveGrammarStructure
                    });
                }
                console.log(`💾 Stored translation in Firebase cache (${Date.now() - startTime}ms total)`);
            }
            catch (storeError) {
                console.error('⚠️ Failed to store translation in Firebase cache:', storeError);
                // Don't fail the translation if cache storage fails
            }
            return {
                data: enhancedResult,
                usage,
                metadata: {
                    mode: normalizedRequest.mode,
                    sourceLang: normalizedRequest.sourceLang,
                    targetLang: normalizedRequest.targetLang,
                    userLevel: normalizedRequest.userLevel,
                    cached: false,
                    cacheHit: false,
                    processingTime: Date.now() - startTime
                }
            };
        }
        catch (aiError) {
            console.error('❌ AI translation failed:', aiError);
            throw aiError;
        }
    }
    /**
     * Validate the translation request
     */
    validateRequest(request) {
        if (!request.text) {
            throw new types_1.AIServiceError('Text is required for translation', 'VALIDATION_ERROR', 400);
        }
        if (typeof request.text !== 'string' || request.text.trim().length === 0) {
            throw new types_1.AIServiceError('Text must be a non-empty string', 'VALIDATION_ERROR', 400);
        }
        // Check text length (reasonable limit for translation)
        if (request.text.length > 5000) {
            throw new types_1.AIServiceError('Text too long. Maximum 5000 characters for translation.', 'VALIDATION_ERROR', 400);
        }
        // Validate mode if provided
        const validModes = ['hints', 'partial', 'full', 'learning'];
        if (request.mode && !validModes.includes(request.mode)) {
            throw new types_1.AIServiceError(`Invalid translation mode. Must be one of: ${validModes.join(', ')}`, 'VALIDATION_ERROR', 400);
        }
    }
    /**
     * Normalize request with defaults
     */
    normalizeRequest(request, config) {
        var _a, _b;
        return {
            text: request.text,
            mode: request.mode || 'learning',
            sourceLang: request.sourceLang || 'ja',
            targetLang: request.targetLang || 'en',
            context: request.context || '',
            preserveGrammarStructure: (_a = request.preserveGrammarStructure) !== null && _a !== void 0 ? _a : true,
            includeGrammarNotes: (_b = request.includeGrammarNotes) !== null && _b !== void 0 ? _b : true,
            userLevel: request.userLevel || (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5'
        };
    }
    /**
     * Generate the system prompt for translation
     */
    getSystemPrompt(config) {
        return `You are an expert Japanese-English translation system specialized for Japanese language learners.

Your role is to provide educational translations that support learning rather than just direct conversion.

CORE PRINCIPLES:
1. Learning-Focused: Translations should teach, not just convert
2. Progressive Assistance: Different modes provide different levels of help
3. Grammar-Aware: Understand and explain Japanese grammar patterns
4. Context-Sensitive: Consider the learning context and user level
5. Encouraging: Help users build confidence in their comprehension

TRANSLATION MODES:

1. HINTS MODE:
   - Provide grammar structure hints instead of direct translation
   - Explain sentence patterns and particle usage
   - Point out key grammar constructions
   - Encourage comprehension attempts

2. PARTIAL MODE:
   - Translate key difficult phrases only
   - Leave familiar/learnable parts in Japanese
   - Focus on words above user's current level
   - Provide scaffolding for comprehension

3. FULL MODE:
   - Complete translation with explanatory notes
   - Include alternative phrasings
   - Explain nuances and cultural context
   - Highlight learning opportunities

4. LEARNING MODE (Default):
   - Comprehensive translation with full educational support
   - Grammar breakdowns and explanations
   - Vocabulary extraction and difficulty assessment
   - Study recommendations and next steps

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "originalText": "Original Japanese text",
  "translatedText": "Full English translation",
  "mode": "Mode used for this translation",
  "confidence": 0.95,

  "hints": [
    {
      "type": "grammar|structure|particle|verb|noun|adjective",
      "explanation": "Educational hint about this aspect",
      "position": 0
    }
  ],

  "partialTranslation": {
    "original": "Original text",
    "partial": "Mixed translation with [brackets] for untranslated parts",
    "translatedParts": [
      {
        "originalText": "Difficult part in Japanese",
        "translation": "Its translation",
        "position": 0,
        "type": "key_phrase|difficult_word|grammar_pattern"
      }
    ],
    "remainingJapanese": ["Parts left in Japanese for learning"]
  },

  "grammarNotes": [
    {
      "pattern": "Grammar pattern like ～ている",
      "explanation": "How this pattern works",
      "example": "Additional example"
    }
  ],

  "keyVocabulary": [
    {
      "word": "Japanese word",
      "reading": "Hiragana reading",
      "meaning": "English meaning",
      "jlptLevel": "N3",
      "difficulty": "medium"
    }
  ],

  "alternatives": ["Alternative translation options"],
  "learningPoints": ["What this text teaches"],
  "nextSteps": ["Study recommendations based on this text"]
}

IMPORTANT GUIDELINES:
- For hints mode: Focus on grammar structure, don't give full translation
- For partial mode: Only translate words above the user's level
- For learning mode: Include comprehensive educational content
- Always consider the user's JLPT level for difficulty assessment
- Encourage active learning and pattern recognition
- Use clear, educational explanations appropriate for language learners`;
    }
    /**
     * Generate the user prompt for translation
     */
    getUserPrompt(request, config) {
        const { text, mode, sourceLang, targetLang, context, userLevel } = request;
        let prompt = `Translate this ${sourceLang === 'ja' ? 'Japanese' : 'English'} text using ${mode} mode:\n\n"${text}"\n\n`;
        // Add context if provided
        if (context) {
            prompt += `Context: ${context}\n\n`;
        }
        // Add user level information
        prompt += `User Level: ${userLevel}\n`;
        prompt += `Translation Mode: ${mode}\n`;
        prompt += `Source Language: ${sourceLang}\n`;
        prompt += `Target Language: ${targetLang}\n\n`;
        // Mode-specific instructions
        switch (mode) {
            case 'hints':
                prompt += `HINTS MODE REQUIREMENTS:
- Do NOT provide a full translation
- Focus on grammar structure explanations
- Point out key particles and their functions
- Explain sentence patterns and constructions
- Provide hints that guide understanding without giving away the meaning
- Encourage the user to attempt comprehension`;
                break;
            case 'partial':
                prompt += `PARTIAL MODE REQUIREMENTS:
- Translate only words/phrases above ${userLevel} level
- Leave familiar vocabulary in Japanese
- Focus on helping with the most challenging parts
- Provide just enough help to make the text comprehensible
- Create a mixed Japanese-English result`;
                break;
            case 'full':
                prompt += `FULL MODE REQUIREMENTS:
- Provide complete translation
- Include cultural context and nuances
- Offer alternative translations where appropriate
- Explain any idiomatic expressions
- Maintain natural English flow`;
                break;
            case 'learning':
                prompt += `LEARNING MODE REQUIREMENTS:
- Provide comprehensive educational translation
- Include detailed grammar analysis
- Extract key vocabulary with difficulty levels
- Provide learning recommendations
- Focus on teaching opportunities in this text`;
                break;
        }
        prompt += `\n\nReturn your response as a valid JSON object as specified in the system prompt.`;
        return prompt;
    }
    /**
     * Parse the AI response with Zod schema validation
     */
    parseResponse(response) {
        const parsed = this.parseJSON(response);
        // Try Zod schema validation first for better error messages
        const validated = (0, schemas_1.safeValidateAIResponse)(schemas_1.TranslationResultSchema, parsed, 'TranslationResult');
        if (validated) {
            console.log('✅ [Translation] Zod schema validation passed');
            // Cast back to our local TranslationResult type
            return validated;
        }
        // Fallback: Manual validation for backwards compatibility
        console.warn('⚠️ [Translation] Zod validation failed, using fallback validation');
        // Validate required fields
        if (!parsed.originalText || !parsed.translatedText || !parsed.mode) {
            throw new types_1.AIServiceError('Missing required fields in translation result', 'INVALID_RESPONSE_FORMAT', 500);
        }
        // Set default values for optional fields
        if (typeof parsed.confidence !== 'number') {
            parsed.confidence = 0.8; // Default confidence
        }
        // Ensure arrays are properly initialized
        if (!Array.isArray(parsed.hints)) {
            parsed.hints = [];
        }
        if (!Array.isArray(parsed.grammarNotes)) {
            parsed.grammarNotes = [];
        }
        if (!Array.isArray(parsed.keyVocabulary)) {
            parsed.keyVocabulary = [];
        }
        if (!Array.isArray(parsed.alternatives)) {
            parsed.alternatives = [];
        }
        if (!Array.isArray(parsed.learningPoints)) {
            parsed.learningPoints = [];
        }
        if (!Array.isArray(parsed.nextSteps)) {
            parsed.nextSteps = [];
        }
        return parsed;
    }
    /**
     * Enhance the translation result with additional processing
     */
    enhanceTranslationResult(result, request, config) {
        // Ensure confidence is within valid range
        result.confidence = Math.max(0, Math.min(1, result.confidence));
        // Add mode-specific enhancements
        switch (request.mode) {
            case 'hints':
                // For hints mode, ensure we don't accidentally provide full translation
                if (result.translatedText && result.translatedText.length > result.originalText.length * 0.3) {
                    // Translation seems too complete for hints mode, clear it
                    result.translatedText = 'Translation hints provided above - try to understand the text first!';
                }
                break;
            case 'partial':
                // Ensure partial translation exists
                if (!result.partialTranslation) {
                    result.partialTranslation = {
                        original: request.text,
                        partial: result.translatedText,
                        translatedParts: [],
                        remainingJapanese: []
                    };
                }
                break;
        }
        // Add text analysis metadata
        const textLength = request.text.length;
        const hasKanji = /[\u4e00-\u9faf]/.test(request.text);
        const hasHiragana = /[\u3040-\u309f]/.test(request.text);
        const hasKatakana = /[\u30a0-\u30ff]/.test(request.text);
        // Add complexity assessment to learning points
        if (request.mode === 'learning') {
            const complexityNotes = [];
            if (textLength > 100)
                complexityNotes.push('Long text - good for reading practice');
            if (hasKanji)
                complexityNotes.push('Contains kanji - focus on character recognition');
            if (hasHiragana && hasKatakana)
                complexityNotes.push('Mixed scripts - practice script recognition');
            result.learningPoints = [...(result.learningPoints || []), ...complexityNotes];
        }
        return result;
    }
    /**
     * Batch translate multiple sentences
     */
    async translateBatch(texts, mode = 'learning', config) {
        const results = [];
        let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };
        for (const text of texts) {
            const result = await this.process({ text, mode }, config);
            results.push(result.data);
            // Accumulate usage
            totalUsage.promptTokens += result.usage.promptTokens;
            totalUsage.completionTokens += result.usage.completionTokens;
            totalUsage.totalTokens += result.usage.totalTokens;
            totalUsage.estimatedCost += result.usage.estimatedCost;
        }
        return {
            data: results,
            usage: totalUsage,
            metadata: {
                batchSize: texts.length,
                mode,
                totalTexts: texts.length
            }
        };
    }
    /**
     * Quick hint translation for immediate assistance
     */
    async quickHint(text, config) {
        var _a;
        const result = await this.process({ text, mode: 'hints' }, Object.assign(Object.assign({}, config), { temperature: 0.3 }));
        return ((_a = result.data.hints) === null || _a === void 0 ? void 0 : _a.map(hint => hint.explanation)) || [];
    }
}
exports.TranslationProcessor = TranslationProcessor;
//# sourceMappingURL=TranslationProcessor.js.map
