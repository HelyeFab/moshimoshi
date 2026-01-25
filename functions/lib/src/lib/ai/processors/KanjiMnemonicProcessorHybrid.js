"use strict";
/**
 * Hybrid Kanji Mnemonic Processor
 * Uses Ollama (Qwen) as primary provider with OpenAI fallback
 *
 * SAFE: Does not modify existing KanjiMnemonicProcessor
 * ROLLBACK: Just don't use this file, use original processor
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KanjiMnemonicProcessorHybrid = void 0;
const KanjiMnemonicProcessor_1 = require("./KanjiMnemonicProcessor");
const OllamaClient_1 = require("../clients/OllamaClient");
const providers_1 = require("../config/providers");
class KanjiMnemonicProcessorHybrid extends KanjiMnemonicProcessor_1.KanjiMnemonicProcessor {
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
        // Validate request first
        this.validateRequest(request);
        // Determine which provider to use
        const provider = (0, providers_1.selectProvider)('generate_kanji_mnemonic', this.providerConfig);
        console.log(`🤖 Using ${provider} for kanji mnemonic: ${request.kanji}`);
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
     * Process with Ollama (optimized implementation)
     */
    async processWithOllama(request, config) {
        if (!this.ollamaClient) {
            throw new Error('Ollama client not initialized');
        }
        const startTime = Date.now();
        // Build optimized prompt for Ollama
        const systemPrompt = this.getSystemPromptForOllama();
        const userPrompt = this.getUserPromptForOllama(request);
        // Call Ollama with JSON mode
        const response = await this.ollamaClient.generate({
            prompt: `${systemPrompt}\n\n${userPrompt}`,
            format: 'json',
            options: {
                temperature: 0.6, // Slightly creative for memorable stories
                num_predict: 400, // Mnemonic + components
                top_p: 0.9
            }
        });
        // Parse response
        const parsedResponse = this.parseResponse(response.response);
        // Build full mnemonic object, overriding with request-specific values
        const mnemonic = Object.assign(Object.assign({}, parsedResponse), { kanji: request.kanji, meaning: request.meaning || parsedResponse.meaning, provider: 'ollama' });
        // Mark provider as healthy
        providers_1.providerHealth.markHealthy('ollama');
        // Calculate usage (estimate for Ollama)
        const estimatedPromptTokens = OllamaClient_1.OllamaClient.estimateTokens(systemPrompt + userPrompt);
        const estimatedCompletionTokens = OllamaClient_1.OllamaClient.estimateTokens(response.response);
        return {
            data: mnemonic,
            usage: {
                promptTokens: estimatedPromptTokens,
                completionTokens: estimatedCompletionTokens,
                totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
                estimatedCost: 0 // Ollama is free!
            },
            metadata: {
                provider: 'ollama',
                model: response.model,
                kanji: mnemonic.kanji,
                processingTime: Date.now() - startTime,
                actualDuration: response.total_duration ? response.total_duration / 1e9 : undefined
            }
        };
    }
    /**
     * Get optimized system prompt for Ollama (shorter = faster)
     */
    getSystemPromptForOllama() {
        return `Create memorable kanji mnemonics for Japanese learners.

CRITICAL RULES:
1. Focus on the VISUAL SHAPE of the kanji and how it connects to the meaning
2. DO NOT invent or guess kanji components/radicals - only use components if explicitly provided
3. Create a vivid, memorable story (2-3 sentences) based on what the kanji LOOKS LIKE
4. The story should help remember both the shape AND the meaning

Return JSON: {"mnemonic":"story","meaning":"English meaning"}
Do NOT include "components" field unless components were provided in the request.`;
    }
    /**
     * Get optimized user prompt for Ollama
     */
    getUserPromptForOllama(request) {
        const lines = [`Kanji: ${request.kanji}`];
        if (request.meaning) {
            lines.push(`Meaning: ${request.meaning}`);
        }
        if (request.components && request.components.length > 0) {
            lines.push(`Components: ${request.components.join(', ')}`);
        }
        lines.push('Create mnemonic. Return JSON.');
        return lines.join('\n');
    }
}
exports.KanjiMnemonicProcessorHybrid = KanjiMnemonicProcessorHybrid;
//# sourceMappingURL=KanjiMnemonicProcessorHybrid.js.map