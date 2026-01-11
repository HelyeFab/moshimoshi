"use strict";
/**
 * Moodboard Processor Hybrid
 * Extends MoodboardProcessor with Ollama support
 * Uses Ollama by default (admin task, 30s acceptable)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoodboardProcessorHybrid = void 0;
const MoodboardProcessor_1 = require("./MoodboardProcessor");
const OllamaClient_1 = require("../clients/OllamaClient");
const providers_1 = require("../config/providers");
class MoodboardProcessorHybrid extends MoodboardProcessor_1.MoodboardProcessor {
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
     * Process moodboard generation with provider selection
     */
    async process(request, config) {
        const provider = (0, providers_1.selectProvider)('generate_moodboard', this.providerConfig);
        console.log(`🤖 Using ${provider} for moodboard generation: ${request.theme}`);
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
        // Call Ollama with JSON mode
        const response = await this.ollamaClient.generate({
            prompt: `${systemPrompt}\n\n${userPrompt}`,
            format: 'json',
            options: {
                temperature: 0.6,
                num_predict: 1500, // Moodboards need substantial tokens for kanji lists
                top_p: 0.9
            }
        });
        // Parse response
        const moodboard = this.parseResponse(response.response);
        // Enhance moodboard (parent's private method replicated locally)
        const enhanced = this.enhanceMoodboardLocal(moodboard, request, config);
        const duration = Date.now() - startTime;
        providers_1.providerHealth.markHealthy('ollama');
        return {
            data: enhanced,
            usage: {
                promptTokens: OllamaClient_1.OllamaClient.estimateTokens(systemPrompt + userPrompt),
                completionTokens: OllamaClient_1.OllamaClient.estimateTokens(response.response),
                totalTokens: response.total_duration ? Math.floor(response.total_duration / 1000000) : 0,
                estimatedCost: 0
            },
            metadata: {
                provider: 'ollama',
                model: response.model,
                processingTime: duration,
                theme: request.theme,
                kanjiCount: enhanced.kanjiList.length,
                jlptLevel: (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5'
            }
        };
    }
    /**
     * Get optimized system prompt for Ollama
     */
    getSystemPromptForOllama(config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        return `You are a Japanese expert creating kanji moodboards for ${jlptLevel} students.

Rules:
1. Common and less common kanji for theme
2. For family: both formal/informal (兄/お兄さん, 姉/お姉さん)
3. CRITICAL: Include ${jlptLevel} level kanji specifically
4. Accurate readings and meanings
5. Stroke count and tags
6. Exact requested number
7. NO duplicates
8. Majority from ${jlptLevel} level

Return JSON:
{
  "title": "Theme in English",
  "description": "Brief description",
  "themeColor": "#hexcolor",
  "emoji": "emoji",
  "kanjiList": [{
    "kanji": "漢",
    "meaning": "English",
    "onyomi": ["カン"],
    "kunyomi": ["から"],
    "jlptLevel": "N5",
    "strokeCount": 13,
    "tags": ["tag1", "tag2"],
    "examples": [
      "漢字を書く。",
      "漢字は難しい。"
    ]
  }]
}

IMPORTANT:
- onyomi: katakana array
- kunyomi: hiragana array
- examples: exactly 2 Japanese sentences`;
    }
    /**
     * Get optimized user prompt for Ollama
     */
    getUserPromptForOllama(request, config) {
        const { theme, kanjiCount = 15, tags = [], focusAreas = [] } = request;
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        let prompt = `Generate kanji moodboard: "${theme}"`;
        if (tags.length > 0) {
            prompt += `\nTags: ${tags.join(', ')}`;
        }
        if (focusAreas.length > 0) {
            prompt += `\nFocus: ${focusAreas.join(', ')}`;
        }
        prompt += `\nJLPT: ${jlptLevel}
Count: ${kanjiCount}

IMPORTANT:
- Mix difficulty for ${jlptLevel}
- Relevant to "${theme}"
- Practical examples
- Each kanji unique`;
        return prompt;
    }
    /**
     * Local enhancement method (replicates parent's private enhanceMoodboard)
     */
    enhanceMoodboardLocal(moodboard, request, config) {
        // Ensure required fields
        if (!moodboard.description) {
            moodboard.description = `Kanji related to ${request.theme}`;
        }
        if (!moodboard.themeColor) {
            moodboard.themeColor = '#6B46C1';
        }
        if (!moodboard.emoji) {
            moodboard.emoji = '📚';
        }
        // Remove duplicates and enhance kanji list
        const uniqueKanji = new Set();
        moodboard.kanjiList = moodboard.kanjiList
            .filter(item => {
            if (uniqueKanji.has(item.kanji)) {
                console.warn(`Duplicate kanji removed: ${item.kanji}`);
                return false;
            }
            uniqueKanji.add(item.kanji);
            return true;
        })
            .map(item => {
            var _a;
            // Ensure arrays
            if (!Array.isArray(item.onyomi)) {
                item.onyomi = item.onyomi ? [item.onyomi] : [];
            }
            if (!Array.isArray(item.kunyomi)) {
                item.kunyomi = item.kunyomi ? [item.kunyomi] : [];
            }
            if (!Array.isArray(item.examples)) {
                item.examples = [];
            }
            if (!Array.isArray(item.tags)) {
                item.tags = [((_a = item.jlptLevel) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || 'n5'];
            }
            // Ensure JLPT level
            if (!item.jlptLevel) {
                item.jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
            }
            // Ensure stroke count
            if (!item.strokeCount || item.strokeCount < 1) {
                item.strokeCount = 10; // Default
            }
            return item;
        });
        // Sort by JLPT level and stroke count
        moodboard.kanjiList.sort((a, b) => {
            const levelOrder = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
            const aLevel = levelOrder[a.jlptLevel] || 6;
            const bLevel = levelOrder[b.jlptLevel] || 6;
            if (aLevel !== bLevel)
                return aLevel - bLevel;
            return a.strokeCount - b.strokeCount;
        });
        return moodboard;
    }
}
exports.MoodboardProcessorHybrid = MoodboardProcessorHybrid;
//# sourceMappingURL=MoodboardProcessorHybrid.js.map