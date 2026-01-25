"use strict";
/**
 * Kanji Mnemonic Processor
 * Generates memorable mnemonic stories for kanji characters
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KanjiMnemonicProcessor = void 0;
const BaseProcessor_1 = require("./BaseProcessor");
const types_1 = require("../types");
class KanjiMnemonicProcessor extends BaseProcessor_1.BaseProcessor {
    constructor(context) {
        super(context);
    }
    /**
     * Process the request to generate a kanji mnemonic
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
        const parsedResponse = this.parseResponse(content);
        // Build the full mnemonic object, overriding with request-specific values
        const mnemonic = Object.assign(Object.assign({}, parsedResponse), { kanji: request.kanji, meaning: request.meaning || parsedResponse.meaning, provider: 'openai' });
        return {
            data: mnemonic,
            usage,
            metadata: {
                kanji: mnemonic.kanji,
                provider: 'openai'
            }
        };
    }
    /**
     * Validate the request
     */
    validateRequest(request) {
        if (!request.kanji) {
            throw new types_1.AIServiceError('Kanji character is required', 'VALIDATION_ERROR', 400);
        }
        if (typeof request.kanji !== 'string' || request.kanji.trim().length === 0) {
            throw new types_1.AIServiceError('Kanji must be a non-empty string', 'VALIDATION_ERROR', 400);
        }
        // Check that it's a single kanji (or very short string)
        if (request.kanji.length > 4) {
            throw new types_1.AIServiceError('Please provide a single kanji character', 'VALIDATION_ERROR', 400);
        }
    }
    /**
     * Generate the system prompt
     */
    getSystemPrompt(config) {
        return `You are an expert in creating memorable kanji mnemonics for Japanese learners.

Your role is to create vivid, memorable stories that connect a kanji's VISUAL SHAPE to its meaning.

CRITICAL RULES:
1. Focus on what the kanji LOOKS LIKE visually - its overall shape, strokes, and appearance
2. DO NOT invent or guess kanji components/radicals unless they are explicitly provided to you
3. If no components are provided, create a mnemonic based purely on the visual shape
4. Keep stories short (2-3 sentences maximum)
5. Make it vivid and easy to visualize
6. The story should help learners remember both the shape AND the meaning

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "mnemonic": "A short, memorable story connecting the kanji's appearance to its meaning",
  "meaning": "The primary English meaning of the kanji"
}

IMPORTANT:
- DO NOT include a "components" field unless components were explicitly provided in the request
- Never make up or guess what radicals/components a kanji contains
- Focus on creative visual associations, not etymological accuracy
- The mnemonic should work even without knowing Japanese`;
    }
    /**
     * Generate the user prompt
     */
    getUserPrompt(request, config) {
        const { kanji, meaning, components } = request;
        let prompt = `Create a memorable mnemonic for this kanji:\n\nKanji: ${kanji}\n`;
        if (meaning) {
            prompt += `Meaning: ${meaning}\n`;
        }
        if (components && components.length > 0) {
            prompt += `Components: ${components.join(', ')}\n`;
        }
        prompt += `\nCreate a short, vivid mnemonic story that helps learners remember this kanji's shape and meaning. Return as JSON.`;
        return prompt;
    }
    /**
     * Parse the AI response
     * Note: Returns KanjiMnemonic with placeholder values for fields set in process()
     */
    parseResponse(response) {
        const parsed = this.parseJSON(response);
        // Validate required fields
        if (!parsed.mnemonic) {
            throw new types_1.AIServiceError('Missing mnemonic in response', 'INVALID_RESPONSE_FORMAT', 500);
        }
        // Return a KanjiMnemonic with all required fields
        // Some fields will be overwritten in process() with request-specific values
        return {
            kanji: '', // Will be set from request
            meaning: parsed.meaning || '',
            mnemonic: parsed.mnemonic,
            components: parsed.components,
            createdAt: new Date(),
            provider: 'openai',
            version: 1
        };
    }
}
exports.KanjiMnemonicProcessor = KanjiMnemonicProcessor;
//# sourceMappingURL=KanjiMnemonicProcessor.js.map