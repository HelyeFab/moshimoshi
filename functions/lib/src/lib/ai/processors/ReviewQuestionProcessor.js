"use strict";
/**
 * Review Question Processor
 * Generates custom review questions for kanji, vocabulary, and grammar
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewQuestionProcessor = void 0;
const BaseProcessor_1 = require("./BaseProcessor");
const types_1 = require("../types");
class ReviewQuestionProcessor extends BaseProcessor_1.BaseProcessor {
    constructor(context) {
        super(context);
    }
    /**
     * Process the request to generate review questions
     */
    async process(request, config) {
        // Validate the request
        this.validateRequest(request);
        // Generate prompts
        const systemPrompt = this.getSystemPrompt(config);
        const userPrompt = this.getUserPrompt(request, config);
        // Call OpenAI
        const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
        // Parse the response
        const questions = this.parseResponse(content);
        // Validate and enhance questions
        const enhancedQuestions = this.enhanceQuestions(questions, request, config);
        return {
            data: enhancedQuestions,
            usage,
            metadata: {
                questionCount: enhancedQuestions.length,
                contentTypes: this.getContentTypes(request),
                jlptLevel: config === null || config === void 0 ? void 0 : config.jlptLevel
            }
        };
    }
    /**
     * Validate the request
     */
    validateRequest(request) {
        if (!request.content) {
            throw new types_1.AIServiceError('Content is required', 'VALIDATION_ERROR', 400);
        }
        const { kanji, vocabulary, grammar, context } = request.content;
        if (!kanji && !vocabulary && !grammar && !context) {
            throw new types_1.AIServiceError('At least one content type (kanji, vocabulary, grammar, or context) is required', 'VALIDATION_ERROR', 400);
        }
        // Validate question count
        const questionCount = request.questionCount || 5;
        if (questionCount < 1 || questionCount > 50) {
            throw new types_1.AIServiceError('Question count must be between 1 and 50', 'VALIDATION_ERROR', 400);
        }
    }
    /**
     * Generate the system prompt
     */
    getSystemPrompt(config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        return `You are an expert Japanese language teacher creating review questions for students.

REQUIREMENTS:
1. Generate educational questions appropriate for ${jlptLevel} level students
2. Questions should test understanding, not just memorization
3. Include a mix of difficulty levels (easy, medium, hard)
4. Provide clear explanations for correct answers
5. Use natural, contextual Japanese where appropriate
6. Follow SRS (Spaced Repetition System) best practices

QUESTION TYPES:
- multiple_choice: 4 options with one correct answer
- fill_blank: Sentence with missing word/phrase
- true_false: Statement to evaluate
- matching: Match items between two lists
- ordering: Put items in correct sequence

DIFFICULTY SCORING (1-5):
1 = Very Easy (basic recognition)
2 = Easy (simple recall)
3 = Medium (application)
4 = Hard (analysis/synthesis)
5 = Very Hard (complex application)

OUTPUT FORMAT:
Return a JSON array of question objects. Each question must have:
- id: Unique identifier (q1, q2, etc.)
- type: Question type
- question: Question text in English
- questionJa: Question in Japanese (optional, for higher levels)
- options: Array of options (for multiple choice)
- correctAnswer: The correct answer (string, number, or boolean)
- explanation: Why this answer is correct
- explanationJa: Explanation in Japanese (optional)
- difficulty: Number 1-5
- tags: Array of relevant tags`;
    }
    /**
     * Generate the user prompt
     */
    getUserPrompt(request, config) {
        const { kanji, vocabulary, grammar, context } = request.content;
        const questionCount = request.questionCount || 5;
        const questionTypes = request.questionTypes || ['multiple_choice', 'fill_blank'];
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        const difficulty = (config === null || config === void 0 ? void 0 : config.difficulty) || 'medium';
        let contentDescription = 'Create review questions for:\n';
        if (kanji && kanji.length > 0) {
            contentDescription += `\nKANJI (${kanji.length} characters):\n`;
            contentDescription += kanji.map(k => `- ${k}`).join('\n');
        }
        if (vocabulary && vocabulary.length > 0) {
            contentDescription += `\n\nVOCABULARY (${vocabulary.length} words):\n`;
            contentDescription += vocabulary.map(v => `- ${v.word} (${v.reading}) - ${v.meaning}`).join('\n');
        }
        if (grammar && grammar.length > 0) {
            contentDescription += `\n\nGRAMMAR POINTS:\n`;
            contentDescription += grammar.map(g => `- ${g}`).join('\n');
        }
        if (context) {
            contentDescription += `\n\nCONTEXT:\n${context}`;
        }
        return `${contentDescription}

Generate exactly ${questionCount} questions.
Use these question types: ${questionTypes.join(', ')}
Target difficulty: ${difficulty}
JLPT Level: ${jlptLevel}

Ensure questions:
1. Test different aspects of the content
2. Progress from easier to harder
3. Include practical usage examples
4. Are appropriate for ${jlptLevel} learners
5. Have clear, unambiguous correct answers

Return your response as a valid json array of question objects.`;
    }
    /**
     * Parse the AI response
     */
    parseResponse(response) {
        const parsed = this.parseJSON(response);
        if (!Array.isArray(parsed)) {
            throw new types_1.AIServiceError('Response must be an array of questions', 'INVALID_RESPONSE_FORMAT', 500);
        }
        return parsed;
    }
    /**
     * Enhance and validate generated questions
     */
    enhanceQuestions(questions, request, config) {
        return questions.map((q, index) => {
            // Ensure ID
            if (!q.id) {
                q.id = `q${index + 1}`;
            }
            // Validate question type
            const validTypes = ['multiple_choice', 'fill_blank', 'true_false', 'matching', 'ordering'];
            if (!validTypes.includes(q.type)) {
                q.type = 'multiple_choice'; // Default to multiple choice
            }
            // Validate difficulty
            if (!q.difficulty || q.difficulty < 1 || q.difficulty > 5) {
                q.difficulty = this.calculateDifficulty(q, config);
            }
            // Add tags if not present
            if (!q.tags || q.tags.length === 0) {
                q.tags = this.generateTags(q, request, config);
            }
            // Validate multiple choice options
            if (q.type === 'multiple_choice' && (!q.options || q.options.length < 2)) {
                throw new types_1.AIServiceError(`Multiple choice question ${q.id} must have at least 2 options`, 'INVALID_QUESTION', 500);
            }
            // Ensure explanation exists
            if (!q.explanation) {
                q.explanation = 'Study this concept carefully for better understanding.';
            }
            return q;
        });
    }
    /**
     * Calculate question difficulty based on content
     */
    calculateDifficulty(question, config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        const baseDifficultyMap = {
            'N5': 1,
            'N4': 2,
            'N3': 3,
            'N2': 4,
            'N1': 5
        };
        const baseDifficulty = baseDifficultyMap[jlptLevel] || 3;
        // Adjust based on question type
        const typeAdjustment = {
            'multiple_choice': 0,
            'true_false': -0.5,
            'fill_blank': 0.5,
            'matching': 0.5,
            'ordering': 1
        }[question.type] || 0;
        // Calculate final difficulty
        const difficulty = Math.max(1, Math.min(5, baseDifficulty + typeAdjustment));
        return Math.round(difficulty);
    }
    /**
     * Generate tags for a question
     */
    generateTags(question, request, config) {
        var _a, _b, _c;
        const tags = [];
        // Add JLPT level
        if (config === null || config === void 0 ? void 0 : config.jlptLevel) {
            tags.push(config.jlptLevel.toLowerCase());
        }
        // Add question type
        tags.push(question.type);
        // Add content type tags
        if ((_a = request.content.kanji) === null || _a === void 0 ? void 0 : _a.length) {
            tags.push('kanji');
        }
        if ((_b = request.content.vocabulary) === null || _b === void 0 ? void 0 : _b.length) {
            tags.push('vocabulary');
        }
        if ((_c = request.content.grammar) === null || _c === void 0 ? void 0 : _c.length) {
            tags.push('grammar');
        }
        // Add difficulty tag
        const difficultyLabels = ['very-easy', 'easy', 'medium', 'hard', 'very-hard'];
        tags.push(difficultyLabels[question.difficulty - 1] || 'medium');
        return tags;
    }
    /**
     * Get content types from request
     */
    getContentTypes(request) {
        var _a, _b, _c;
        const types = [];
        if ((_a = request.content.kanji) === null || _a === void 0 ? void 0 : _a.length)
            types.push('kanji');
        if ((_b = request.content.vocabulary) === null || _b === void 0 ? void 0 : _b.length)
            types.push('vocabulary');
        if ((_c = request.content.grammar) === null || _c === void 0 ? void 0 : _c.length)
            types.push('grammar');
        if (request.content.context)
            types.push('context');
        return types;
    }
    /**
     * Generate questions for specific kanji
     */
    async generateKanjiQuestions(kanji, config) {
        return this.process({
            content: { kanji },
            questionCount: (config === null || config === void 0 ? void 0 : config.difficulty) === 'hard' ? 10 : 5,
            questionTypes: ['multiple_choice', 'fill_blank', 'matching']
        }, config);
    }
    /**
     * Generate vocabulary questions
     */
    async generateVocabularyQuestions(vocabulary, config) {
        return this.process({
            content: { vocabulary },
            questionCount: Math.min(vocabulary.length * 2, 20),
            questionTypes: ['multiple_choice', 'fill_blank', 'true_false']
        }, config);
    }
    /**
     * Generate grammar questions
     */
    async generateGrammarQuestions(grammar, context, config) {
        return this.process({
            content: { grammar, context },
            questionCount: grammar.length * 3,
            questionTypes: ['multiple_choice', 'fill_blank', 'ordering']
        }, config);
    }
}
exports.ReviewQuestionProcessor = ReviewQuestionProcessor;
//# sourceMappingURL=ReviewQuestionProcessor.js.map