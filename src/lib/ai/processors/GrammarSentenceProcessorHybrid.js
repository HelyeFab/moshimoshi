"use strict";
/**
 * Grammar Sentence Processor Hybrid
 * Extends GrammarSentenceProcessor with Ollama support
 * Uses OpenAI by default (real-time interactive feature)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrammarSentenceProcessorHybrid = void 0;
const GrammarSentenceProcessor_1 = require("./GrammarSentenceProcessor");
const OllamaClient_1 = require("../clients/OllamaClient");
const providers_1 = require("../config/providers");
class GrammarSentenceProcessorHybrid extends GrammarSentenceProcessor_1.GrammarSentenceProcessor {
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
     * Process grammar sentence explanation with provider selection
     */
    async process(request, config) {
        const provider = (0, providers_1.selectProvider)('explain_grammar_sentence', this.providerConfig);
        console.log(`🤖 Using ${provider} for sentence grammar: ${request.sentence.substring(0, 30)}...`);
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
                temperature: 0.5,
                num_predict: 700,
                top_p: 0.9
            }
        });
        // Parse response
        const explanation = this.parseResponse(response.response);
        const duration = Date.now() - startTime;
        providers_1.providerHealth.markHealthy('ollama');
        return {
            data: explanation,
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
                sentence: request.sentence,
                sourceTitle: request.title
            }
        };
    }
    /**
     * Get optimized system prompt for Ollama
     */
    getSystemPromptForOllama(config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        return `You are a Japanese tutor. Explain grammar in clear English for ${jlptLevel} learners.

Return JSON:
{
  "pattern": "Main pattern title",
  "patternRomaji": "Romaji",
  "meaning": "One paragraph description",
  "structure": "How formed",
  "examples": [
    {
      "japanese": "Example",
      "furigana": "With furigana",
      "translation": "English",
      "notes": "Usage note"
    }
  ],
  "commonMistakes": ["..."],
  "relatedPatterns": ["..."],
  "jlptLevel": "N5-N1",
  "formality": "casual/formal/both"
}`;
    }
    /**
     * Get optimized user prompt for Ollama
     */
    getUserPromptForOllama(request, config) {
        const lines = [];
        lines.push(`Explain grammar: ${request.sentence.trim()}`);
        if (request.context) {
            lines.push(`Context: ${request.context.trim()}`);
        }
        if (request.surroundingSentences && request.surroundingSentences.length > 0) {
            lines.push(`Nearby: ${request.surroundingSentences.join('; ')}`);
        }
        if (request.focusQuestion) {
            lines.push(`Question: ${request.focusQuestion.trim()}`);
        }
        if (request.title) {
            lines.push(`Source: ${request.title}`);
        }
        return lines.join('\n');
    }
}
exports.GrammarSentenceProcessorHybrid = GrammarSentenceProcessorHybrid;
//# sourceMappingURL=GrammarSentenceProcessorHybrid.js.map