"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrammarSentenceProcessor = void 0;
const BaseProcessor_1 = require("./BaseProcessor");
const types_1 = require("../types");
/**
 * Grammar Sentence Processor
 * Provides contextual grammar explanations for specific sentences
 */
class GrammarSentenceProcessor extends BaseProcessor_1.BaseProcessor {
    constructor(context) {
        super(context);
    }
    async process(request, config) {
        this.validateRequest(request);
        const systemPrompt = this.getSystemPrompt(config);
        const userPrompt = this.getUserPrompt(request, config);
        const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
        const explanation = this.parseResponse(content);
        return {
            data: explanation,
            usage,
            metadata: {
                sentence: request.sentence,
                sourceTitle: request.title
            }
        };
    }
    validateRequest(request) {
        if (!request.sentence || request.sentence.trim().length === 0) {
            throw new types_1.AIServiceError('Sentence is required for grammar explanation', 'VALIDATION_ERROR', 400);
        }
        if (request.sentence.length > 500) {
            throw new types_1.AIServiceError('Sentence is too long. Maximum 500 characters.', 'VALIDATION_ERROR', 400);
        }
    }
    getSystemPrompt(config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        return `You are a friendly Japanese language tutor who explains grammar in clear English.

When given a Japanese sentence and optional surrounding context, you must:
1. Identify the key grammar patterns in the target sentence.
2. Explain each pattern in simple, learner-friendly English.
3. Highlight nuance, formality, and usage notes relevant for ${jlptLevel} learners.
4. Provide a few short example sentences (Japanese + furigana + English) that reinforce the explanation.
5. Mention common mistakes learners make with these patterns.

Return a JSON object with this shape:
{
  "pattern": "Concise title summarizing the main pattern",
  "patternRomaji": "Romaji transcription of the title pattern",
  "meaning": "One paragraph describing the overall meaning",
  "structure": "How the pattern is formed",
  "examples": [
    {
      "japanese": "Example sentence",
      "furigana": "Example with furigana",
      "translation": "English translation",
      "notes": "Short usage note"
    }
  ],
  "commonMistakes": ["..."],
  "relatedPatterns": ["..."],
  "jlptLevel": "N5-N1",
  "formality": "casual/formal/both"
}
Do not add extra commentary outside the JSON.`;
    }
    getUserPrompt(request, config) {
        const lines = [];
        lines.push('Explain the grammar of this Japanese sentence:');
        lines.push(request.sentence.trim());
        if (request.context) {
            lines.push('\nBroader context for reference:');
            lines.push(request.context.trim());
        }
        if (request.surroundingSentences && request.surroundingSentences.length > 0) {
            lines.push('\nNearby sentences:');
            request.surroundingSentences.forEach((line, idx) => {
                lines.push(`${idx + 1}. ${line}`);
            });
        }
        if (request.focusQuestion) {
            lines.push('\nLearner question to address:');
            lines.push(request.focusQuestion.trim());
        }
        if (request.title) {
            lines.push(`\nSource: ${request.title}`);
        }
        lines.push('\nPlease produce the JSON response as described.');
        return lines.join('\n');
    }
    parseResponse(response) {
        try {
            const parsed = JSON.parse(response);
            return parsed;
        }
        catch (error) {
            throw new types_1.AIServiceError('Failed to parse grammar explanation response', 'PARSE_ERROR', 500, { response: response.substring(0, 200) });
        }
    }
}
exports.GrammarSentenceProcessor = GrammarSentenceProcessor;
//# sourceMappingURL=GrammarSentenceProcessor.js.map