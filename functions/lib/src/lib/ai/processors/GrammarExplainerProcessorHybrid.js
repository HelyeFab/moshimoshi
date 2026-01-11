"use strict";
/**
 * Grammar Explainer Processor Hybrid
 * Extends GrammarExplainerProcessor with Ollama support
 * Uses OpenAI by default (real-time user task requiring fast response)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrammarExplainerProcessorHybrid = void 0;
const GrammarExplainerProcessor_1 = require("./GrammarExplainerProcessor");
const OllamaClient_1 = require("../clients/OllamaClient");
const providers_1 = require("../config/providers");
class GrammarExplainerProcessorHybrid extends GrammarExplainerProcessor_1.GrammarExplainerProcessor {
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
     * Process grammar explanation with provider selection
     */
    async process(request, config) {
        const provider = (0, providers_1.selectProvider)('explain_grammar', this.providerConfig);
        console.log(`🤖 Using ${provider} for grammar explanation: ${request.content}`);
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
                num_predict: 800, // Grammar explanations need more tokens
                top_p: 0.9
            }
        });
        // Parse response
        const explanation = this.parseResponse(response.response);
        // Enhance the explanation
        const enhanced = this.enhanceExplanation(explanation, request, config);
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
                grammarPattern: explanation.pattern,
                jlptLevel: explanation.jlptLevel || (config === null || config === void 0 ? void 0 : config.jlptLevel),
                exampleCount: explanation.examples.length
            }
        };
    }
    /**
     * Get optimized system prompt for Ollama
     */
    getSystemPromptForOllama(config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        const style = (config === null || config === void 0 ? void 0 : config.style) || 'casual';
        return `You are a Japanese grammar expert. Explain grammar patterns for ${jlptLevel} students.

Return JSON:
{
  "pattern": "Grammar pattern in Japanese",
  "patternRomaji": "Romaji",
  "meaning": "Clear explanation",
  "structure": "How to form (e.g., Verb-て form + います)",
  "examples": [
    {
      "japanese": "Example sentence",
      "furigana": "With furigana",
      "translation": "English",
      "notes": "Usage note"
    }
  ],
  "commonMistakes": ["List of errors"],
  "relatedPatterns": ["Similar patterns"],
  "jlptLevel": "N5/N4/N3/N2/N1",
  "formality": "casual/formal/both"
}`;
    }
    /**
     * Get optimized user prompt for Ollama
     */
    getUserPromptForOllama(request, config) {
        const { content, focusPoints, compareWith } = request;
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        const includeExamples = (config === null || config === void 0 ? void 0 : config.includeExamples) !== false;
        let prompt = `Explain: "${content}"\n`;
        if (focusPoints && focusPoints.length > 0) {
            prompt += `Focus: ${focusPoints.join(', ')}\n`;
        }
        if (compareWith && compareWith.length > 0) {
            prompt += `Compare with: ${compareWith.join(', ')}\n`;
        }
        prompt += `JLPT: ${jlptLevel}\nExamples: ${includeExamples ? '3-5' : '1-2'}`;
        return prompt;
    }
}
exports.GrammarExplainerProcessorHybrid = GrammarExplainerProcessorHybrid;
//# sourceMappingURL=GrammarExplainerProcessorHybrid.js.map