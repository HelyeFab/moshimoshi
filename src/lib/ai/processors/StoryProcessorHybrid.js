"use strict";
/**
 * Story Processor Hybrid
 * Extends StoryProcessor with Ollama support
 * Uses Ollama by default (admin background task, 30-60s acceptable)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoryProcessorHybrid = void 0;
const StoryProcessor_1 = require("./StoryProcessor");
const OllamaClient_1 = require("../clients/OllamaClient");
const providers_1 = require("../config/providers");
class StoryProcessorHybrid extends StoryProcessor_1.StoryProcessor {
    constructor(context) {
        super(context);
        this.ollamaClient = null;
        this.providerConfig = (0, providers_1.getProviderConfig)();
        // Initialize Ollama client if enabled
        if (this.providerConfig.enabled.ollama) {
            const ollamaConfig = (0, providers_1.getOllamaConfig)();
            this.ollamaClient = new OllamaClient_1.OllamaClient(ollamaConfig);
        }
    }
    /**
     * Process story generation with provider selection
     */
    async process(request, config) {
        const provider = (0, providers_1.selectProvider)('generate_story', this.providerConfig);
        console.log(`🤖 Using ${provider} for story generation: ${request.theme}`);
        try {
            if (provider === 'ollama' && this.ollamaClient) {
                return await this.processWithOllama(request, config);
            }
            else {
                return await this.processWithOpenAI(request, config);
            }
        }
        catch (error) {
            console.error(`❌ ${provider} failed:`, error);
            providers_1.providerHealth.markUnhealthy(provider);
            const fallback = this.providerConfig.fallback;
            console.warn(`⚠️ Falling back to ${fallback}`);
            if (fallback === 'openai') {
                return await this.processWithOpenAI(request, config);
            }
            throw error;
        }
    }
    /**
     * Process with OpenAI (calls parent implementation)
     */
    async processWithOpenAI(request, config) {
        return super.process(request, config);
    }
    /**
     * Process with Ollama
     */
    async processWithOllama(request, config) {
        if (!this.ollamaClient) {
            throw new Error('Ollama client not initialized');
        }
        const startTime = Date.now();
        // Validate request
        this.validateRequest(request);
        // Get optimized prompts for Ollama
        const systemPrompt = this.getSystemPromptForOllama(config);
        const userPrompt = this.getUserPromptForOllama(request, config);
        // Call Ollama with JSON mode and longer context for stories
        const response = await this.ollamaClient.generate({
            prompt: `${systemPrompt}\n\n${userPrompt}`,
            format: 'json',
            options: {
                temperature: 0.7, // More creative for stories
                num_predict: 2000, // Stories need many tokens
                top_p: 0.9
            }
        });
        // Parse response
        const story = this.parseResponse(response.response);
        // Enhance story (using parent's private method logic)
        const enhanced = this.enhanceStoryLocal(story, request, config);
        const duration = Date.now() - startTime;
        providers_1.providerHealth.markHealthy('ollama');
        return {
            data: enhanced,
            usage: {
                promptTokens: OllamaClient_1.OllamaClient.estimateTokens(systemPrompt + userPrompt),
                completionTokens: OllamaClient_1.OllamaClient.estimateTokens(response.response),
                totalTokens: response.total_duration ? Math.floor(response.total_duration / 1000000) : 0,
                estimatedCost: 0 // Ollama is free!
            },
            metadata: {
                provider: 'ollama',
                model: response.model,
                processingTime: duration,
                theme: request.theme,
                pageCount: enhanced.pages.length,
                jlptLevel: config === null || config === void 0 ? void 0 : config.jlptLevel
            }
        };
    }
    /**
     * Get optimized system prompt for Ollama
     */
    getSystemPromptForOllama(config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        return `You are a Japanese teacher creating educational stories for ${jlptLevel} students.

Requirements:
1. Engaging content for ${jlptLevel} learners
2. Appropriate vocabulary and grammar
3. Furigana for ALL kanji: <ruby>漢字<rt>かんじ</rt></ruby>
4. 100-200 characters per page
5. Natural dialogue
6. English translations
7. Vocabulary notes
8. Quiz questions

Return JSON:
{
  "title": "English title",
  "titleJa": "日本語タイトル with furigana",
  "description": "Brief description",
  "pages": [{
    "pageNumber": 1,
    "text": "Japanese text",
    "textWithFurigana": "Text with ruby tags",
    "translation": "English",
    "imagePrompt": "Image description",
    "vocabularyNotes": {},
    "grammarNotes": {}
  }],
  "vocabulary": [{
    "word": "単語",
    "meaning": "meaning",
    "reading": "たんご"
  }],
  "quiz": [{
    "id": "q1",
    "type": "multiple_choice",
    "question": "Question",
    "options": ["..."],
    "correctAnswer": 0,
    "explanation": "...",
    "difficulty": 1
  }]
}`;
    }
    /**
     * Get optimized user prompt for Ollama
     */
    getUserPromptForOllama(request, config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        const pageCount = request.pageCount || 5;
        const targetLength = (config === null || config === void 0 ? void 0 : config.targetLength) || 'medium';
        let prompt = `Create ${targetLength} educational story:
Theme: ${request.theme}
JLPT: ${jlptLevel}
Pages: ${pageCount}`;
        if (request.characters && request.characters.length > 0) {
            prompt += `\nCharacters: ${JSON.stringify(request.characters)}`;
        }
        if (request.setting) {
            prompt += `\nSetting: ${JSON.stringify(request.setting)}`;
        }
        if (request.visualStyle) {
            prompt += `\nStyle: ${request.visualStyle}`;
        }
        prompt += `\n\nInclude:
- Title (English & Japanese)
- ${pageCount} pages with furigana
- Vocabulary list
- 3-5 quiz questions
- Consistent narrative`;
        return prompt;
    }
    /**
     * Local enhancement method (replicates parent's private enhanceStory)
     */
    enhanceStoryLocal(story, request, config) {
        // Add metadata if missing
        if (!story.metadata) {
            story.metadata = {
                theme: request.theme,
                jlptLevel: (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5',
                generatedAt: new Date().toISOString(),
                pageCount: story.pages.length
            };
        }
        // Ensure all pages have required fields
        story.pages = story.pages.map((page, index) => ({
            pageNumber: page.pageNumber || index + 1,
            text: page.text || '',
            textWithFurigana: page.textWithFurigana || page.text,
            translation: page.translation || '',
            imagePrompt: page.imagePrompt || `Japanese story: ${story.title}, Page ${index + 1}`,
            vocabularyNotes: page.vocabularyNotes || {},
            grammarNotes: page.grammarNotes || {}
        }));
        // Ensure vocabulary list exists
        if (!story.vocabulary || !Array.isArray(story.vocabulary)) {
            story.vocabulary = [];
        }
        // Ensure quiz exists
        if (!story.quiz || !Array.isArray(story.quiz)) {
            story.quiz = [];
        }
        return story;
    }
}
exports.StoryProcessorHybrid = StoryProcessorHybrid;
//# sourceMappingURL=StoryProcessorHybrid.js.map