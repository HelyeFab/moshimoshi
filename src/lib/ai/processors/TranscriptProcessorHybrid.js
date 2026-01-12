"use strict";
/**
 * Transcript Processor Hybrid
 * Extends TranscriptProcessor with Ollama support
 * Uses Ollama by default (background processing task)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptProcessorHybrid = void 0;
const TranscriptProcessor_1 = require("./TranscriptProcessor");
const OllamaClient_1 = require("../clients/OllamaClient");
const providers_1 = require("../config/providers");
class TranscriptProcessorHybrid extends TranscriptProcessor_1.TranscriptProcessor {
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
     * Process transcript with provider selection
     */
    async process(request, config) {
        // Determine which task type this is
        const taskType = this.getTaskType(request);
        const provider = (0, providers_1.selectProvider)(taskType, this.providerConfig);
        console.log(`🤖 Using ${provider} for transcript processing: ${request.content.videoTitle || 'untitled'}`);
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
     * Get task type for routing
     */
    getTaskType(request) {
        if (request.fixErrors) {
            return 'fix_transcript';
        }
        else {
            return 'clean_transcript';
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
        // For large transcripts, use batching (delegate to parent)
        const BATCH_SIZE = 50;
        const segments = request.content.transcript;
        if (segments.length > BATCH_SIZE) {
            console.log(`📦 Large transcript (${segments.length} segments), using parent batching logic`);
            // Fallback to OpenAI for large batches to avoid complexity
            return await this.processWithOpenAI(request, config);
        }
        // Get prompts
        const processingType = this.determineProcessingType(request);
        const systemPrompt = this.getSystemPromptForOllama(config, processingType);
        const userPrompt = this.getUserPromptForOllama(request, config, processingType);
        // Call Ollama
        const response = await this.ollamaClient.generate({
            prompt: `${systemPrompt}\n\n${userPrompt}`,
            format: 'json',
            options: {
                temperature: 0.4, // Lower for accuracy
                num_predict: 1200, // Transcripts can be long
                top_p: 0.9
            }
        });
        // Parse response
        const processed = this.parseTranscriptResponse(response.response, processingType);
        // Validate segments
        if (!processed.segments || processed.segments.length === 0) {
            console.warn('No segments generated, falling back to OpenAI');
            return await this.processWithOpenAI(request, config);
        }
        // Enhance transcript (replicate parent logic)
        const enhanced = this.enhanceTranscriptLocal(processed, request, config);
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
                processingType,
                segmentCount: enhanced.segments.length,
                language: request.content.language || 'ja',
                videoTitle: request.content.videoTitle
            }
        };
    }
    // Note: determineProcessingType is now protected in parent class - using it directly
    /**
     * Get optimized system prompt for Ollama
     */
    getSystemPromptForOllama(config, processingType) {
        const includeTranslations = !!(config === null || config === void 0 ? void 0 : config.includeTranslations);
        switch (processingType) {
            case 'shadowing':
                return `Split Japanese text into SHORT segments for shadowing (max 20 chars).

RULES:
1. MAX 20 characters per segment
2. NEVER split です/ます/でした
3. Aim for 8-15 characters (2-3 seconds)
4. Break at: て-form, connectors (から、けど、が)
5. Return JSON array ${includeTranslations ? 'of {"text":"...", "translation":"..."}' : 'of strings'}

${includeTranslations
                    ? 'Example: [{"text":"昨日友達と","translation":"Yesterday with friend"},...]'
                    : 'Example: ["昨日友達と","映画を見て","楽しかった"]'}`;
            case 'error_correction':
                return `Fix transcription errors in Japanese.

Focus:
1. Correct mishearings
2. Fix grammar
3. Natural flow
4. Preserve intent

Return JSON array${includeTranslations ? ' with "text" and "translation"' : ' of corrected segments'}.`;
            case 'naturalization':
                return `Improve naturalness of Japanese transcript.

Tasks:
1. Fix unnatural phrasing
2. Add missing particles
3. Correct conjugations
4. Proper politeness

Return JSON${includeTranslations ? ' with "text" and "translation"' : ''}.`;
            default:
                return `Process Japanese transcript for ${(config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5'} learners.

Provide:
1. Clean segments
2. Key vocabulary
3. Grammar patterns${includeTranslations ? '\n4. English translations' : ''}

Return JSON.`;
        }
    }
    /**
     * Get optimized user prompt for Ollama
     */
    getUserPromptForOllama(request, config, processingType) {
        const { transcript, videoTitle } = request.content;
        const fullText = transcript.map(seg => seg.text).join('');
        const includeTranslations = !!(config === null || config === void 0 ? void 0 : config.includeTranslations);
        let prompt = '';
        switch (processingType) {
            case 'shadowing':
                const maxLength = request.maxSegmentLength || 20;
                prompt = `Split for shadowing:

${fullText}

Max ${maxLength} chars per segment
${includeTranslations ? 'Include translations' : ''}`;
                break;
            case 'error_correction':
                prompt = `Fix errors:

${fullText}

${videoTitle ? `Video: "${videoTitle}"` : ''}
${includeTranslations ? 'Include translations' : ''}`;
                break;
            default:
                prompt = `Process transcript:

${fullText}

${videoTitle ? `Title: ${videoTitle}` : ''}
JLPT: ${(config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5'}
${includeTranslations ? 'Include translations' : ''}`;
        }
        return prompt;
    }
    /**
     * Local enhancement method (replicates parent logic)
     */
    enhanceTranscriptLocal(transcript, request, config) {
        // Ensure all segments have required fields
        transcript.segments = transcript.segments.map((seg, index) => ({
            id: seg.id || `seg_${index + 1}`,
            text: seg.text,
            textWithFurigana: seg.textWithFurigana || seg.text,
            startTime: seg.startTime !== undefined ? seg.startTime : index * 3,
            endTime: seg.endTime !== undefined ? seg.endTime : (index + 1) * 3,
            difficulty: seg.difficulty || 1,
            keyVocabulary: seg.keyVocabulary || [],
            translation: seg.translation
        }));
        // Add summary if missing
        if (!transcript.summary && transcript.segments.length > 0) {
            transcript.summary = `${transcript.segments.length} segments processed`;
        }
        // Ensure vocabulary exists
        if (!transcript.vocabulary || !Array.isArray(transcript.vocabulary)) {
            transcript.vocabulary = [];
        }
        return transcript;
    }
}
exports.TranscriptProcessorHybrid = TranscriptProcessorHybrid;
//# sourceMappingURL=TranscriptProcessorHybrid.js.map