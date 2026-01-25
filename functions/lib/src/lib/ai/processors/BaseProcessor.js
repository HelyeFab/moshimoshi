"use strict";
/**
 * Base Processor for AI Tasks
 * Abstract class that all AI task processors extend from
 *
 * Features:
 * - OpenAI Structured Outputs support via zodResponseFormat
 * - Zod schema validation for all providers (OpenAI, Ollama)
 * - Automatic retry and error handling
 * - Token usage tracking and cost calculation
 */
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseProcessor = void 0;
const openai_1 = __importDefault(require("openai"));
const zod_1 = require("openai/helpers/zod");
const types_1 = require("../types");
const schemas_1 = require("../schemas");
class BaseProcessor {
    constructor(context) {
        this.openai = null;
        this.context = context;
        this.defaultConfig = {
            temperature: 0.7,
            maxTokens: 4000,
            timeout: 30000,
            maxRetries: 2,
            stream: false,
            cacheResults: true,
            cacheDuration: 3600 // 1 hour default
        };
        this.initializeOpenAI();
    }
    /**
     * Initialize OpenAI client
     * Note: Does not throw if API key is missing - allows Ollama-only mode
     */
    initializeOpenAI() {
        const apiKey = process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.warn('[BaseProcessor] OpenAI API key not configured - OpenAI calls will fail');
            this.openai = null;
            return;
        }
        this.openai = new openai_1.default({
            apiKey,
            timeout: this.context.config.timeout || this.defaultConfig.timeout,
            maxRetries: this.context.config.maxRetries || this.defaultConfig.maxRetries
        });
    }
    /**
     * Common method to call OpenAI
     */
    async callOpenAI(systemPrompt, userPrompt, config) {
        var _a, _b;
        if (!this.openai) {
            throw new types_1.AIServiceError('OpenAI client not initialized', 'OPENAI_NOT_INITIALIZED', 500);
        }
        const startTime = Date.now();
        const mergedConfig = Object.assign(Object.assign(Object.assign({}, this.defaultConfig), this.context.config), config);
        const responseFormat = (config === null || config === void 0 ? void 0 : config.responseFormat) || 'json';
        try {
            const completionParams = {
                model: this.context.model || 'gpt-4o-mini', // Fallback to gpt-4o-mini if undefined
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: mergedConfig.temperature,
                max_tokens: mergedConfig.maxTokens
            };
            // Only add response_format for models that support it
            // GPT-4 doesn't support json_object response format
            const supportsJsonFormat = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'].includes(this.context.model);
            if (responseFormat === 'json' && supportsJsonFormat && !systemPrompt.includes('shadowing')) {
                completionParams.response_format = { type: 'json_object' };
            }
            const completion = await this.openai.chat.completions.create(completionParams);
            const response = (_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
            if (!response) {
                throw new types_1.AIServiceError('No response from OpenAI', 'EMPTY_RESPONSE', 500);
            }
            // Validate JSON response if expected
            if (responseFormat === 'json' || response.trim().startsWith('[') || response.trim().startsWith('{')) {
                try {
                    JSON.parse(response);
                }
                catch (parseError) {
                    console.error('AI returned invalid JSON:', response.substring(0, 200));
                    // Don't throw here, let the processor handle it
                }
            }
            const usage = this.calculateUsage(completion.usage);
            const processingTime = Date.now() - startTime;
            console.log(`✅ AI Task completed in ${processingTime}ms using ${this.context.model}`);
            console.log(`📊 Tokens: ${usage.totalTokens} | Cost: $${usage.estimatedCost.toFixed(4)}`);
            console.log(`🔑 Request ID: ${completion.id}`);
            return {
                content: response,
                usage,
                requestId: completion.id
            };
        }
        catch (error) {
            if (error instanceof types_1.AIServiceError) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ OpenAI API error:', errorMessage);
            // Handle specific OpenAI errors
            if (error instanceof openai_1.default.APIError) {
                if (error.status === 429) {
                    throw new types_1.AIServiceError('Rate limit exceeded. Please try again later.', 'RATE_LIMIT', 429);
                }
                else if (error.status === 401) {
                    throw new types_1.AIServiceError('Invalid API key', 'AUTH_FAILED', 401);
                }
                else if (error.status === 500) {
                    throw new types_1.AIServiceError('OpenAI service error. Please try again.', 'SERVICE_ERROR', 500);
                }
            }
            throw new types_1.AIServiceError(`Failed to process AI request: ${errorMessage}`, 'PROCESSING_FAILED', 500, { originalError: errorMessage });
        }
    }
    /**
     * Call OpenAI with Structured Outputs (Zod schema validation)
     *
     * This method uses OpenAI's native structured outputs feature which
     * GUARANTEES the response will match the schema. For Ollama, we still
     * use the schema for post-response validation.
     *
     * @param systemPrompt - System instructions
     * @param userPrompt - User query
     * @param schema - Zod schema for response validation
     * @param schemaName - Name for the schema (used in API call)
     * @param config - Optional configuration overrides
     */
    async callOpenAIWithSchema(systemPrompt, userPrompt, schema, schemaName, config) {
        var _a, _b;
        if (!this.openai) {
            throw new types_1.AIServiceError('OpenAI client not initialized', 'OPENAI_NOT_INITIALIZED', 500);
        }
        const startTime = Date.now();
        const mergedConfig = Object.assign(Object.assign(Object.assign({}, this.defaultConfig), this.context.config), config);
        try {
            const completion = await this.openai.chat.completions.create({
                model: this.context.model || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: mergedConfig.temperature,
                max_tokens: mergedConfig.maxTokens,
                response_format: (0, zod_1.zodResponseFormat)(schema, schemaName)
            });
            const response = (_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
            if (!response) {
                throw new types_1.AIServiceError('No response from OpenAI', 'EMPTY_RESPONSE', 500);
            }
            // Parse and validate with Zod
            const parsed = JSON.parse(response);
            const validated = (0, schemas_1.validateAIResponse)(schema, parsed, schemaName);
            const usage = this.calculateUsage(completion.usage);
            const processingTime = Date.now() - startTime;
            console.log(`✅ AI Task (structured) completed in ${processingTime}ms using ${this.context.model}`);
            console.log(`📊 Tokens: ${usage.totalTokens} | Cost: $${usage.estimatedCost.toFixed(4)}`);
            console.log(`🔑 Request ID: ${completion.id}`);
            return {
                data: validated,
                usage,
                requestId: completion.id
            };
        }
        catch (error) {
            if (error instanceof types_1.AIServiceError) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ OpenAI Structured Output error:', errorMessage);
            throw new types_1.AIServiceError(`Failed to process structured AI request: ${errorMessage}`, 'STRUCTURED_OUTPUT_FAILED', 500, { originalError: errorMessage });
        }
    }
    /**
     * Validate a response against a Zod schema
     * Use this for Ollama responses or when not using structured outputs
     */
    validateResponse(response, schema, context) {
        return (0, schemas_1.validateAIResponse)(schema, response, context);
    }
    /**
     * Safely validate a response, returning null on failure
     */
    safeValidateResponse(response, schema, context) {
        return (0, schemas_1.safeValidateAIResponse)(schema, response, context);
    }
    /**
     * Calculate token usage and cost
     */
    calculateUsage(usage) {
        if (!usage) {
            return {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                estimatedCost: 0
            };
        }
        const pricing = types_1.MODEL_PRICING[this.context.model];
        const promptCost = (usage.prompt_tokens / 1000) * pricing.inputCostPer1k;
        const completionCost = (usage.completion_tokens / 1000) * pricing.outputCostPer1k;
        return {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
            estimatedCost: promptCost + completionCost
        };
    }
    /**
     * Stream response (for long-form content)
     */
    async streamOpenAI(systemPrompt, userPrompt, onChunk, config) {
        var _a, e_1, _b, _c;
        var _d, _e;
        if (!this.openai) {
            throw new types_1.AIServiceError('OpenAI client not initialized', 'OPENAI_NOT_INITIALIZED', 500);
        }
        const mergedConfig = Object.assign(Object.assign(Object.assign({}, this.defaultConfig), this.context.config), config);
        let fullContent = '';
        try {
            const stream = await this.openai.chat.completions.create({
                model: this.context.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: mergedConfig.temperature,
                max_tokens: mergedConfig.maxTokens,
                stream: true
            });
            try {
                for (var _f = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = await stream_1.next(), _a = stream_1_1.done, !_a; _f = true) {
                    _c = stream_1_1.value;
                    _f = false;
                    const chunk = _c;
                    const content = ((_e = (_d = chunk.choices[0]) === null || _d === void 0 ? void 0 : _d.delta) === null || _e === void 0 ? void 0 : _e.content) || '';
                    if (content) {
                        fullContent += content;
                        onChunk(content);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = stream_1.return)) await _b.call(stream_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            // Estimate usage for streaming (OpenAI doesn't provide it directly)
            const estimatedTokens = this.estimateTokens(systemPrompt + userPrompt + fullContent);
            const usage = this.calculateUsageFromTokenCount(estimatedTokens);
            return {
                fullContent,
                usage
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new types_1.AIServiceError(`Streaming failed: ${errorMessage}`, 'STREAMING_FAILED', 500);
        }
    }
    /**
     * Estimate token count (rough estimation)
     */
    estimateTokens(text) {
        // Rough estimation: ~4 characters per token for English, ~2 for Japanese
        const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
        const charsPerToken = hasJapanese ? 2 : 4;
        return Math.ceil(text.length / charsPerToken);
    }
    /**
     * Calculate usage from token count
     */
    calculateUsageFromTokenCount(totalTokens) {
        const pricing = types_1.MODEL_PRICING[this.context.model];
        // Assume 60% prompt, 40% completion for estimation
        const promptTokens = Math.floor(totalTokens * 0.6);
        const completionTokens = totalTokens - promptTokens;
        const promptCost = (promptTokens / 1000) * pricing.inputCostPer1k;
        const completionCost = (completionTokens / 1000) * pricing.outputCostPer1k;
        return {
            promptTokens,
            completionTokens,
            totalTokens,
            estimatedCost: promptCost + completionCost
        };
    }
    /**
     * Helper to safely parse JSON response
     */
    parseJSON(response) {
        try {
            return JSON.parse(response);
        }
        catch (error) {
            console.error('Failed to parse AI response as JSON:', response);
            throw new types_1.AIServiceError('Invalid response format from AI', 'INVALID_RESPONSE_FORMAT', 500, { response });
        }
    }
    /**
     * Helper to validate required fields
     */
    validateRequiredFields(obj, fields) {
        const missing = fields.filter(field => !obj[field]);
        if (missing.length > 0) {
            throw new types_1.AIServiceError(`Missing required fields: ${missing.join(', ')}`, 'VALIDATION_ERROR', 400);
        }
    }
    /**
     * Helper to truncate text if needed
     */
    truncateText(text, maxLength) {
        if (text.length <= maxLength)
            return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    /**
     * Helper to split text into chunks for large inputs
     */
    splitIntoChunks(text, maxChunkSize) {
        const chunks = [];
        const sentences = text.split(/[。！？\n]+/);
        let currentChunk = '';
        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > maxChunkSize) {
                if (currentChunk)
                    chunks.push(currentChunk.trim());
                currentChunk = sentence;
            }
            else {
                currentChunk += (currentChunk ? '。' : '') + sentence;
            }
        }
        if (currentChunk)
            chunks.push(currentChunk.trim());
        return chunks;
    }
    /**
     * Get optimal model for task complexity
     */
    selectOptimalModel(complexity, preferredModel) {
        if (preferredModel)
            return preferredModel;
        // Always use GPT-4o-mini for single model approach - cost efficient
        return 'gpt-4o-mini';
    }
}
exports.BaseProcessor = BaseProcessor;
//# sourceMappingURL=BaseProcessor.js.map