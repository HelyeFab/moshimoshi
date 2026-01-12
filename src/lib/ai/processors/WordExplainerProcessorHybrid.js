"use strict";
/**
 * Hybrid Word Explainer Processor
 * Can use either OpenAI or Ollama based on configuration
 *
 * SAFE: Does not modify existing WordExplainerProcessor
 * ROLLBACK: Just don't use this file, use original processor
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordExplainerProcessorHybrid = void 0;
const WordExplainerProcessor_1 = require("./WordExplainerProcessor");
const OllamaClient_1 = require("../clients/OllamaClient");
const providers_1 = require("../config/providers");
class WordExplainerProcessorHybrid extends WordExplainerProcessor_1.WordExplainerProcessor {
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
     * Process request with automatic provider selection and fallback
     */
    async process(request, config) {
        // Determine which provider to use
        const provider = (0, providers_1.selectProvider)('explain_word', this.providerConfig);
        console.log(`🤖 Using ${provider} for word explanation: ${request.word}`);
        // Try primary provider
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
            // Mark provider as unhealthy
            providers_1.providerHealth.markUnhealthy(provider);
            // Fallback to alternative provider
            const fallback = this.providerConfig.fallback;
            console.warn(`⚠️ Falling back to ${fallback}`);
            if (fallback === 'openai') {
                return await this.processWithOpenAI(request, config);
            }
            else if (fallback === 'ollama' && this.ollamaClient) {
                return await this.processWithOllama(request, config);
            }
            // If both fail, re-throw error
            throw error;
        }
    }
    /**
     * Process with OpenAI (uses existing parent class logic)
     */
    async processWithOpenAI(request, config) {
        // Call parent class implementation (existing OpenAI logic)
        return await super.process(request, config);
    }
    /**
     * Process with Ollama (new implementation)
     */
    async processWithOllama(request, config) {
        if (!this.ollamaClient) {
            throw new Error('Ollama client not initialized');
        }
        const startTime = Date.now();
        // Build optimized prompt for Ollama
        const systemPrompt = this.getSystemPromptForOllama(config);
        const userPrompt = this.getUserPromptForOllama(request, config);
        // Call Ollama with JSON mode
        const response = await this.ollamaClient.generate({
            prompt: `${systemPrompt}\n\n${userPrompt}`,
            format: 'json',
            options: {
                temperature: 0.5, // Lower for factual responses
                num_predict: 300, // Limit tokens for faster response
                top_p: 0.9
            }
        });
        // Parse response
        const explanation = this.parseResponse(response.response);
        // Mark provider as healthy
        providers_1.providerHealth.markHealthy('ollama');
        // Calculate usage (estimate for Ollama since it doesn't provide token counts)
        const estimatedPromptTokens = OllamaClient_1.OllamaClient.estimateTokens(systemPrompt + userPrompt);
        const estimatedCompletionTokens = OllamaClient_1.OllamaClient.estimateTokens(response.response);
        return {
            data: explanation,
            usage: {
                promptTokens: estimatedPromptTokens,
                completionTokens: estimatedCompletionTokens,
                totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
                estimatedCost: 0 // Ollama is free!
            },
            metadata: {
                provider: 'ollama',
                model: response.model,
                processingTime: Date.now() - startTime,
                actualDuration: response.total_duration ? response.total_duration / 1e9 : undefined
            }
        };
    }
    /**
     * Get optimized system prompt for Ollama (shorter = faster)
     */
    getSystemPromptForOllama(config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        return `Japanese dictionary for ${jlptLevel} learners. Return JSON:
{
  "word": "kanji",
  "reading": "hiragana",
  "romaji": "romaji",
  "meaning": "English",
  "partOfSpeech": "type",
  "kanjiBreakdown": [{"kanji":"X","kun":["y"],"on":["Z"],"meaning":"M"}],
  "conjugation": {"type":"verb/i-adj/na-adj","forms":{"present":"x","past":"y"}},
  "pitchAccent": {"pattern":"LH","moraCount":3},
  "relatedWords": {"synonyms":[],"antonyms":[],"compounds":[]},
  "jlptLevel": "N5-N1",
  "examples": [{"japanese":"x","furigana":"y","translation":"z"}]
}`;
    }
    /**
     * Get optimized user prompt for Ollama
     */
    getUserPromptForOllama(request, config) {
        const lines = [`Word: ${request.word}`];
        if (request.context) {
            lines.push(`Context: ${request.context.substring(0, 200)}`); // Limit context length
        }
        lines.push('Return complete JSON.');
        return lines.join('\n');
    }
}
exports.WordExplainerProcessorHybrid = WordExplainerProcessorHybrid;
//# sourceMappingURL=WordExplainerProcessorHybrid.js.map