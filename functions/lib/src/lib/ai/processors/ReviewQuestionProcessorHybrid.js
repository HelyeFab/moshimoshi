"use strict";
/**
 * Review Question Processor Hybrid
 * Extends ReviewQuestionProcessor with Ollama support
 * Uses Ollama by default (background generation task)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewQuestionProcessorHybrid = void 0;
const ReviewQuestionProcessor_1 = require("./ReviewQuestionProcessor");
const OllamaClient_1 = require("../clients/OllamaClient");
const providers_1 = require("../config/providers");
class ReviewQuestionProcessorHybrid extends ReviewQuestionProcessor_1.ReviewQuestionProcessor {
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
     * Process review question generation with provider selection
     */
    async process(request, config) {
        const provider = (0, providers_1.selectProvider)('generate_review_questions', this.providerConfig);
        const contentTypes = this.getContentTypes(request);
        console.log(`🤖 Using ${provider} for review questions: ${contentTypes.join(', ')}`);
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
                temperature: 0.6, // Balanced for varied questions
                num_predict: 1000, // Questions need reasonable space
                top_p: 0.9
            }
        });
        // Parse response
        const questions = this.parseResponse(response.response);
        // Enhance questions (replicate parent logic)
        const enhanced = this.enhanceQuestionsLocal(questions, request, config);
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
                questionCount: enhanced.length,
                contentTypes: this.getContentTypes(request),
                jlptLevel: config === null || config === void 0 ? void 0 : config.jlptLevel
            }
        };
    }
    /**
     * Get optimized system prompt for Ollama
     */
    getSystemPromptForOllama(config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        return `You are a Japanese teacher creating review questions for ${jlptLevel} students.

TYPES:
- multiple_choice: 4 options, 1 correct
- fill_blank: Missing word/phrase
- true_false: Statement evaluation
- matching: Match items
- ordering: Correct sequence

DIFFICULTY (1-5):
1 = Very Easy (recognition)
2 = Easy (recall)
3 = Medium (application)
4 = Hard (analysis)
5 = Very Hard (complex)

Return JSON array:
[{
  "id": "q1",
  "type": "multiple_choice",
  "question": "English question",
  "questionJa": "日本語質問 (optional)",
  "options": ["opt1", "opt2", "opt3", "opt4"],
  "correctAnswer": 0,
  "explanation": "Why correct",
  "explanationJa": "説明 (optional)",
  "difficulty": 1,
  "tags": ["tag1", "tag2"]
}]

Requirements:
1. Educational for ${jlptLevel}
2. Test understanding, not just memory
3. Mix difficulty levels
4. Clear explanations
5. Natural Japanese
6. SRS best practices`;
    }
    /**
     * Get optimized user prompt for Ollama
     */
    getUserPromptForOllama(request, config) {
        const { kanji, vocabulary, grammar, context } = request.content;
        const questionCount = request.questionCount || 5;
        const questionTypes = request.questionTypes || ['multiple_choice', 'fill_blank'];
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        const difficulty = (config === null || config === void 0 ? void 0 : config.difficulty) || 'medium';
        let prompt = 'Create review questions for:\n';
        if (kanji && kanji.length > 0) {
            prompt += `\nKANJI (${kanji.length}): ${kanji.join(', ')}`;
        }
        if (vocabulary && vocabulary.length > 0) {
            prompt += `\nVOCAB (${vocabulary.length}):\n`;
            prompt += vocabulary.map(v => `${v.word}(${v.reading})-${v.meaning}`).join(', ');
        }
        if (grammar && grammar.length > 0) {
            prompt += `\nGRAMMAR: ${grammar.join(', ')}`;
        }
        if (context) {
            prompt += `\nCONTEXT: ${context}`;
        }
        prompt += `\n\nGenerate ${questionCount} questions
Types: ${questionTypes.join(', ')}
Difficulty: ${difficulty}
JLPT: ${jlptLevel}

Requirements:
1. Test different aspects
2. Easy to harder progression
3. Practical examples
4. Clear answers
5. Appropriate for ${jlptLevel}`;
        return prompt;
    }
    /**
     * Local enhancement method (replicates parent logic)
     */
    enhanceQuestionsLocal(questions, request, config) {
        return questions.map((q, index) => {
            // Ensure ID
            if (!q.id) {
                q.id = `q${index + 1}`;
            }
            // Validate question type
            const validTypes = ['multiple_choice', 'fill_blank', 'true_false', 'matching', 'ordering'];
            if (!validTypes.includes(q.type)) {
                q.type = 'multiple_choice';
            }
            // Validate difficulty
            if (!q.difficulty || q.difficulty < 1 || q.difficulty > 5) {
                q.difficulty = this.calculateDifficultyLocal(q, config);
            }
            // Add tags if not present
            if (!q.tags || q.tags.length === 0) {
                q.tags = this.generateTagsLocal(q, request, config);
            }
            // Ensure explanation exists
            if (!q.explanation) {
                q.explanation = 'Study this concept carefully.';
            }
            return q;
        });
    }
    /**
     * Calculate difficulty locally
     */
    calculateDifficultyLocal(question, config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        const baseDifficultyMap = {
            'N5': 1,
            'N4': 2,
            'N3': 3,
            'N2': 4,
            'N1': 5
        };
        const baseDifficulty = baseDifficultyMap[jlptLevel] || 3;
        const typeAdjustment = {
            'multiple_choice': 0,
            'true_false': -0.5,
            'fill_blank': 0.5,
            'matching': 0.5,
            'ordering': 1
        }[question.type] || 0;
        const difficulty = Math.max(1, Math.min(5, baseDifficulty + typeAdjustment));
        return Math.round(difficulty);
    }
    /**
     * Generate tags locally
     */
    generateTagsLocal(question, request, config) {
        var _a, _b, _c;
        const tags = [];
        if (config === null || config === void 0 ? void 0 : config.jlptLevel) {
            tags.push(config.jlptLevel.toLowerCase());
        }
        tags.push(question.type);
        if ((_a = request.content.kanji) === null || _a === void 0 ? void 0 : _a.length)
            tags.push('kanji');
        if ((_b = request.content.vocabulary) === null || _b === void 0 ? void 0 : _b.length)
            tags.push('vocabulary');
        if ((_c = request.content.grammar) === null || _c === void 0 ? void 0 : _c.length)
            tags.push('grammar');
        const difficultyLabels = ['very-easy', 'easy', 'medium', 'hard', 'very-hard'];
        tags.push(difficultyLabels[question.difficulty - 1] || 'medium');
        return tags;
    }
}
exports.ReviewQuestionProcessorHybrid = ReviewQuestionProcessorHybrid;
//# sourceMappingURL=ReviewQuestionProcessorHybrid.js.map