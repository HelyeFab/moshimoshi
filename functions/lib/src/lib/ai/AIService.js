"use strict";
/**
 * Main AI Service
 * Orchestrates all AI processors and provides a unified interface
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const types_1 = require("./types");
// Import hybrid processors (with automatic Ollama/OpenAI selection)
const ReviewQuestionProcessorHybrid_1 = require("./processors/ReviewQuestionProcessorHybrid");
const GrammarExplainerProcessorHybrid_1 = require("./processors/GrammarExplainerProcessorHybrid");
const GrammarSentenceProcessorHybrid_1 = require("./processors/GrammarSentenceProcessorHybrid");
const WordExplainerProcessorHybrid_1 = require("./processors/WordExplainerProcessorHybrid");
const TranscriptProcessorHybrid_1 = require("./processors/TranscriptProcessorHybrid");
const StoryProcessorHybrid_1 = require("./processors/StoryProcessorHybrid");
const MoodboardProcessorHybrid_1 = require("./processors/MoodboardProcessorHybrid");
const MultiStepStoryProcessor_1 = require("./processors/MultiStepStoryProcessor");
const GeminiImageProcessor_1 = require("./processors/GeminiImageProcessor");
const ImageStorageProcessor_1 = require("./processors/ImageStorageProcessor");
const TranslationProcessor_1 = require("./processors/TranslationProcessor");
// import { ArticleProcessor } from './processors/ArticleProcessor';
// Note: Smart routing enabled! Set AI_PROVIDER=openai in .env.local to disable Ollama
const PersistentCacheManager_1 = require("./cache/PersistentCacheManager");
const UsageTracker_1 = require("./utils/UsageTracker");
class AIService {
    constructor() {
        this.cacheManager = new PersistentCacheManager_1.PersistentCacheManager();
        this.usageTracker = new UsageTracker_1.UsageTracker();
        this.defaultConfig = {
            model: 'gpt-4o-mini', // Single model - GPT-4o-mini for cost efficiency
            temperature: 0.7,
            maxTokens: 4000,
            timeout: 30000,
            maxRetries: 2,
            stream: false,
            cacheResults: true,
            cacheDuration: 7200, // 2 hours default
        };
        // Schedule periodic cleanup
        if (typeof setInterval !== 'undefined') {
            setInterval(() => {
                this.cacheManager.cleanupExpiredFirestore();
            }, 30 * 60 * 1000); // Every 30 minutes
        }
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }
    /**
     * Main processing method
     */
    async process(request) {
        var _a, _b, _c, _d, _e, _f, _g;
        const startTime = Date.now();
        try {
            // Validate request
            this.validateRequest(request);
            // Check cache if enabled
            if (((_a = request.config) === null || _a === void 0 ? void 0 : _a.cacheResults) !== false) {
                const cached = await this.checkCache(request);
                if (cached) {
                    return {
                        success: true,
                        data: cached.data,
                        cached: true,
                        processingTime: Date.now() - startTime,
                        metadata: cached.metadata,
                    };
                }
            }
            // Select optimal model
            const model = this.selectModel(request);
            // Create processor context
            const context = {
                model,
                config: Object.assign(Object.assign({}, this.defaultConfig), request.config),
                userId: (_b = request.metadata) === null || _b === void 0 ? void 0 : _b.userId,
                sessionId: (_c = request.metadata) === null || _c === void 0 ? void 0 : _c.sessionId,
            };
            // Route to appropriate processor
            const result = await this.routeToProcessor(request, context);
            // Track usage
            await this.usageTracker.track({
                task: request.task,
                model,
                usage: result.usage,
                userId: (_d = request.metadata) === null || _d === void 0 ? void 0 : _d.userId,
                timestamp: new Date(),
            });
            // Cache result if enabled
            if (((_e = request.config) === null || _e === void 0 ? void 0 : _e.cacheResults) !== false) {
                await this.cacheResult(request, result);
            }
            return {
                success: true,
                data: result.data,
                usage: result.usage,
                cached: false,
                processingTime: Date.now() - startTime,
                metadata: {
                    modelUsed: model,
                    promptTokens: result.usage.promptTokens,
                    completionTokens: result.usage.completionTokens,
                    totalCost: result.usage.estimatedCost,
                    processingSteps: (_f = result.metadata) === null || _f === void 0 ? void 0 : _f.processingSteps,
                },
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            const model = this.selectModel(request);
            // Enhanced error logging
            console.error('❌ AI Service Error:', {
                task: request.task,
                error: error instanceof Error ? error.message : String(error),
                code: error instanceof types_1.AIServiceError ? error.code : 'UNKNOWN',
                processingTime: `${processingTime}ms`,
            });
            if (error instanceof types_1.AIServiceError) {
                // Track failed requests
                await this.usageTracker.track({
                    task: request.task,
                    model: model || 'gpt-4o-mini',
                    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
                    userId: (_g = request.metadata) === null || _g === void 0 ? void 0 : _g.userId,
                    timestamp: new Date(),
                });
                return {
                    success: false,
                    error: error.message,
                    processingTime,
                    metadata: {
                        errorCode: error.code,
                        errorDetails: error.details,
                        task: request.task,
                        modelUsed: model,
                    },
                };
            }
            // Map common errors to specific codes
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            if (errorMessage.includes('Rate limit')) {
                errorCode = 'RATE_LIMIT';
            }
            else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
                errorCode = 'TIMEOUT';
            }
            else if (errorMessage.includes('Invalid API key') || errorMessage.includes('401')) {
                errorCode = 'AUTH_FAILED';
            }
            else if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
                errorCode = 'PARSE_ERROR';
            }
            return {
                success: false,
                error: errorMessage,
                processingTime,
                metadata: {
                    errorCode,
                    task: request.task,
                    modelUsed: model,
                    originalError: process.env.NODE_ENV === 'development' ? String(error) : undefined,
                },
            };
        }
    }
    /**
     * Validate the request
     */
    validateRequest(request) {
        if (!request.task) {
            throw new types_1.AIServiceError('Task type is required', 'MISSING_TASK', 400);
        }
        const validTasks = [
            'generate_review_questions',
            'explain_grammar',
            'explain_grammar_sentence',
            'explain_word',
            'clean_transcript',
            'process_article',
            'generate_story',
            'generate_story_multistep',
            'generate_moodboard',
            'generate_image',
            'generate_character_model_sheet',
            'enhance_image_prompt',
            'store_image',
            'analyze_content',
            'suggest_improvements',
            'translate_content',
            'simplify_text',
            'generate_quiz',
            'create_flashcards',
            'fix_transcript',
            'extract_vocabulary',
        ];
        if (!validTasks.includes(request.task)) {
            throw new types_1.AIServiceError(`Invalid task type: ${request.task}`, 'INVALID_TASK', 400);
        }
        if (!request.content) {
            throw new types_1.AIServiceError('Content is required', 'MISSING_CONTENT', 400);
        }
    }
    /**
     * Select optimal model based on task and configuration
     */
    selectModel(request) {
        // ALWAYS use gpt-4o-mini for all tasks - single model for cost efficiency
        return 'gpt-4o-mini';
    }
    /**
     * Route request to appropriate processor
     */
    async routeToProcessor(request, context) {
        switch (request.task) {
            case 'generate_review_questions':
                const reviewProcessor = new ReviewQuestionProcessorHybrid_1.ReviewQuestionProcessorHybrid(context);
                return await reviewProcessor.process(request.content, request.config);
            case 'explain_grammar':
                const grammarProcessor = new GrammarExplainerProcessorHybrid_1.GrammarExplainerProcessorHybrid(context);
                return await grammarProcessor.process(request.content, request.config);
            case 'explain_grammar_sentence':
                const grammarSentenceProcessor = new GrammarSentenceProcessorHybrid_1.GrammarSentenceProcessorHybrid(context);
                return await grammarSentenceProcessor.process(request.content, request.config);
            case 'explain_word':
                const wordProcessor = new WordExplainerProcessorHybrid_1.WordExplainerProcessorHybrid(context);
                return await wordProcessor.process(request.content, request.config);
            case 'clean_transcript':
            case 'fix_transcript':
                const transcriptProcessor = new TranscriptProcessorHybrid_1.TranscriptProcessorHybrid(context);
                return await transcriptProcessor.process(request.content, request.config);
            case 'generate_story':
                const storyProcessor = new StoryProcessorHybrid_1.StoryProcessorHybrid(context);
                return await storyProcessor.process(request.content, request.config);
            case 'generate_moodboard':
                const moodboardProcessor = new MoodboardProcessorHybrid_1.MoodboardProcessorHybrid(context);
                return await moodboardProcessor.process(request.content, request.config);
            case 'generate_story_multistep':
                const multiStepProcessor = new MultiStepStoryProcessor_1.MultiStepStoryProcessor(context);
                return await multiStepProcessor.process(request.content, request.config);
            case 'generate_image':
                // Using Gemini/Imagen for image generation (free tier + better quality)
                const imageProcessor = new GeminiImageProcessor_1.GeminiImageProcessor(context);
                return await imageProcessor.process(request.content, request.config);
            case 'generate_character_model_sheet':
                // Using Gemini/Imagen for model sheets
                const modelSheetProcessor = new GeminiImageProcessor_1.GeminiImageProcessor(context);
                return await modelSheetProcessor.generateModelSheet(request.content, request.config);
            case 'enhance_image_prompt':
                // Prompt enhancement uses text AI (routed via normal task processing)
                // For now, return the original prompt - enhancement can be done client-side
                const enhanceRequest = request.content;
                return {
                    data: {
                        enhancedPrompt: enhanceRequest.basePrompt,
                        originalPrompt: enhanceRequest.basePrompt,
                        metadata: {
                            characterIncluded: false,
                            settingIncluded: false,
                            visualStyleApplied: false,
                        },
                    },
                    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
                    metadata: { enhancementApplied: false },
                };
            case 'store_image':
                const storageProcessor = new ImageStorageProcessor_1.ImageStorageProcessor(context);
                return await storageProcessor.process(request.content, request.config);
            case 'translate_content':
                const translationProcessor = new TranslationProcessor_1.TranslationProcessor(context);
                return await translationProcessor.process(request.content, request.config);
            // case 'process_article':
            //   const articleProcessor = new ArticleProcessor(context);
            //   return await articleProcessor.process(
            //     request.content as ArticleProcessRequest,
            //     request.config
            //   );
            default:
                throw new types_1.AIServiceError(`Processor not implemented for task: ${request.task}`, 'PROCESSOR_NOT_IMPLEMENTED', 501);
        }
    }
    /**
     * Check cache for existing result
     */
    async checkCache(request) {
        const cacheKey = this.generateCacheKey(request);
        return await this.cacheManager.get(cacheKey);
    }
    /**
     * Cache the result with intelligent duration
     */
    async cacheResult(request, result) {
        var _a, _b, _c;
        const cacheKey = this.generateCacheKey(request);
        // Intelligent cache duration based on task type
        let duration = (_a = request.config) === null || _a === void 0 ? void 0 : _a.cacheDuration;
        if (!duration) {
            switch (request.task) {
                case 'clean_transcript':
                case 'fix_transcript':
                    duration = 86400; // 24 hours for transcripts
                    break;
                case 'explain_grammar':
                case 'explain_word':
                    duration = 604800; // 7 days for grammar/word (rarely changes)
                    break;
                case 'translate_content':
                    duration = 259200; // 3 days for translations (semi-static)
                    break;
                case 'generate_story':
                case 'generate_moodboard':
                    duration = 43200; // 12 hours for generated content
                    break;
                case 'generate_review_questions':
                case 'generate_quiz':
                    duration = 3600; // 1 hour for dynamic content
                    break;
                default:
                    duration = this.defaultConfig.cacheDuration || 7200;
            }
        }
        await this.cacheManager.set(cacheKey, result, duration, {
            task: request.task,
            model: result.model || this.defaultConfig.model,
            userId: (_b = request.metadata) === null || _b === void 0 ? void 0 : _b.userId,
            cost: ((_c = result.usage) === null || _c === void 0 ? void 0 : _c.estimatedCost) || 0,
        });
        console.log(`💾 Cached for ${duration}s: ${request.task}`);
    }
    /**
     * Generate cache key from request
     */
    generateCacheKey(request) {
        var _a;
        const parts = [
            request.task,
            JSON.stringify(request.content),
            JSON.stringify(request.config || {}),
            ((_a = request.metadata) === null || _a === void 0 ? void 0 : _a.userId) || 'anonymous',
        ];
        // Create a simple hash
        const str = parts.join('|');
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `ai_cache_${request.task}_${hash}`;
    }
    /**
     * Convenience methods for common tasks
     */
    async generateReviewQuestions(content, config) {
        return this.process({
            task: 'generate_review_questions',
            content: { content },
            config,
        });
    }
    async explainGrammar(text, config) {
        return this.process({
            task: 'explain_grammar',
            content: { content: text },
            config,
        });
    }
    async explainGrammarSentence(request, config) {
        return this.process({
            task: 'explain_grammar_sentence',
            content: request,
            config,
        });
    }
    async explainWord(request, config) {
        return this.process({
            task: 'explain_word',
            content: request,
            config,
        });
    }
    async processTranscript(request, config) {
        const task = request.fixErrors || request.improveNaturalness ? 'fix_transcript' : 'clean_transcript';
        const mergedConfig = request.includeTranslations !== undefined || config
            ? Object.assign(Object.assign({}, (config || {})), (request.includeTranslations !== undefined
                ? { includeTranslations: request.includeTranslations }
                : {})) : undefined;
        const requestWithDefaults = request.includeTranslations === undefined && (mergedConfig === null || mergedConfig === void 0 ? void 0 : mergedConfig.includeTranslations) !== undefined
            ? Object.assign(Object.assign({}, request), { includeTranslations: mergedConfig.includeTranslations }) : request;
        return this.process({
            task,
            content: requestWithDefaults,
            config: mergedConfig,
        });
    }
    async translate(request, config) {
        return this.process({
            task: 'translate_content',
            content: request,
            config,
        });
    }
    async translateText(text, mode = 'learning', config) {
        return this.translate({ text, mode }, config);
    }
    async getTranslationHints(text, config) {
        var _a, _b;
        const result = await this.translate({ text, mode: 'hints' }, config);
        return ((_b = (_a = result.data) === null || _a === void 0 ? void 0 : _a.hints) === null || _b === void 0 ? void 0 : _b.map(hint => hint.explanation)) || [];
    }
    // Add more convenience methods as processors are implemented
    /**
     * Batch processing for multiple requests
     */
    async processBatch(requests) {
        const results = await Promise.allSettled(requests.map(req => this.process(req)));
        return results.map((result, index) => {
            var _a;
            if (result.status === 'fulfilled') {
                return result.value;
            }
            else {
                return {
                    success: false,
                    error: ((_a = result.reason) === null || _a === void 0 ? void 0 : _a.message) || 'Processing failed',
                    metadata: {
                        modelUsed: 'gpt-4o-mini',
                        errorCode: 'BATCH_ITEM_FAILED',
                        requestIndex: index,
                        originalRequest: requests[index],
                    },
                };
            }
        });
    }
    /**
     * Get usage statistics
     */
    async getUsageStats(userId, timeRange) {
        return this.usageTracker.getStats(userId, timeRange);
    }
    /**
     * Clear cache (admin function)
     */
    async clearCache(pattern) {
        await this.cacheManager.clear(pattern);
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            // Check OpenAI connection
            const openaiConnected = !!(process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY);
            // Check cache connection
            const cacheConnected = await this.cacheManager.healthCheck();
            // Count available processors
            const processorCount = 2; // Currently ReviewQuestion and GrammarExplainer
            return {
                healthy: openaiConnected && cacheConnected,
                openaiConnected,
                cacheConnected,
                processorCount,
            };
        }
        catch (error) {
            return {
                healthy: false,
                openaiConnected: false,
                cacheConnected: false,
                processorCount: 0,
            };
        }
    }
}
exports.AIService = AIService;
//# sourceMappingURL=AIService.js.map