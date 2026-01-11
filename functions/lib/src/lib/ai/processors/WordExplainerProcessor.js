"use strict";
/**
 * Word Explainer Processor
 * Generates comprehensive word explanations with kanji breakdown, conjugation, pitch accent, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordExplainerProcessor = void 0;
const BaseProcessor_1 = require("./BaseProcessor");
const types_1 = require("../types");
class WordExplainerProcessor extends BaseProcessor_1.BaseProcessor {
    constructor(context) {
        super(context);
    }
    /**
     * Process the request to generate word explanation
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
        const explanation = this.parseResponse(content);
        // Enhance the explanation
        const enhancedExplanation = this.enhanceExplanation(explanation, request, config);
        return {
            data: enhancedExplanation,
            usage,
            metadata: {
                word: explanation.word,
                partOfSpeech: explanation.partOfSpeech,
                jlptLevel: explanation.jlptLevel || (config === null || config === void 0 ? void 0 : config.jlptLevel)
            }
        };
    }
    /**
     * Validate the request
     */
    validateRequest(request) {
        if (!request.word) {
            throw new types_1.AIServiceError('Word is required for explanation', 'VALIDATION_ERROR', 400);
        }
        if (typeof request.word !== 'string' || request.word.trim().length === 0) {
            throw new types_1.AIServiceError('Word must be a non-empty string', 'VALIDATION_ERROR', 400);
        }
        // Check word length (should be relatively short for a word)
        if (request.word.length > 100) {
            throw new types_1.AIServiceError('Word too long. Maximum 100 characters.', 'VALIDATION_ERROR', 400);
        }
    }
    /**
     * Generate the system prompt
     */
    getSystemPrompt(config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        return `You are an expert Japanese language dictionary and teacher specializing in comprehensive word explanations.

Your role is to provide detailed, educational word explanations for ${jlptLevel} level students.

EXPLANATION REQUIREMENTS:
1. Basic Definition: Clear translation and meaning
2. Kanji Breakdown: For words with kanji, break down each character with kun/on readings
3. Conjugation Table: For verbs and adjectives, provide full conjugation patterns
4. Pitch Accent: Include pitch accent pattern and notation
5. Related Words: Synonyms, antonyms, compounds, and related expressions
6. JLPT Level: Classify the word's JLPT level
7. Usage Notes: Explain when and how to use the word
8. Examples: Provide 2-3 example sentences showing the word in context

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "word": "The original Japanese word",
  "reading": "Hiragana reading",
  "romaji": "Romanized pronunciation",
  "meaning": "Clear English definition",
  "partOfSpeech": "noun/verb/adjective/particle/etc.",

  "kanjiBreakdown": [
    {
      "kanji": "Single kanji character",
      "meaning": "Kanji meaning",
      "kunYomi": ["kun readings"],
      "onYomi": ["on readings"]
    }
  ],

  "conjugation": {
    "dictionary": "Dictionary form",
    "present": "Present/non-past form",
    "past": "Past form",
    "negative": "Negative form",
    "teForm": "Te-form",
    "potential": "Potential form",
    "passive": "Passive form",
    "causative": "Causative form",
    "imperative": "Imperative form",
    "volitional": "Volitional form"
  },

  "pitchAccent": {
    "pattern": "Pattern like LHL, HLL, etc.",
    "notation": "こ↑んば↓んは style notation"
  },

  "relatedWords": {
    "synonyms": ["Similar words"],
    "antonyms": ["Opposite words"],
    "compounds": ["Compound words using this"],
    "relatedExpressions": ["Related phrases"]
  },

  "jlptLevel": "N5/N4/N3/N2/N1",
  "formality": "casual/formal/neutral/both",
  "usageNotes": "When and how to use this word",

  "examples": [
    {
      "japanese": "Example sentence",
      "furigana": "With furigana",
      "translation": "English translation",
      "notes": "Context note"
    }
  ]
}

IMPORTANT:
- Always include kanjiBreakdown if the word contains any kanji
- Always include conjugation for verbs and adjectives
- Provide pitch accent when possible
- Include at least 2-3 examples
- Make explanations appropriate for ${jlptLevel} learners`;
    }
    /**
     * Generate the user prompt
     */
    getUserPrompt(request, config) {
        const { word, context } = request;
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        let prompt = `Provide a comprehensive explanation for this Japanese word:\n\n"${word}"\n\n`;
        if (context) {
            prompt += `Context where this word appears:\n"${context}"\n\n`;
        }
        prompt += `Requirements:
- Target JLPT Level: ${jlptLevel}
- Include kanji breakdown if word contains kanji
- Include conjugation table if word is verb or adjective
- Provide pitch accent pattern
- List related words (synonyms, antonyms, compounds)
- Provide 2-3 clear example sentences
- Explain usage notes and formality level

Return your response as a valid JSON object as specified in the system prompt.`;
        return prompt;
    }
    /**
     * Parse the AI response
     */
    parseResponse(response) {
        const parsed = this.parseJSON(response);
        // Validate required fields
        if (!parsed.word || !parsed.meaning || !parsed.reading) {
            throw new types_1.AIServiceError('Missing required fields in word explanation', 'INVALID_RESPONSE_FORMAT', 500);
        }
        // Validate examples array
        if (!Array.isArray(parsed.examples)) {
            parsed.examples = [];
        }
        // Ensure formality has a value
        if (!parsed.formality) {
            parsed.formality = 'neutral';
        }
        return parsed;
    }
    /**
     * Enhance the word explanation with additional processing
     */
    enhanceExplanation(explanation, request, config) {
        // Ensure JLPT level is set
        if (!explanation.jlptLevel && (config === null || config === void 0 ? void 0 : config.jlptLevel)) {
            explanation.jlptLevel = config.jlptLevel;
        }
        // Ensure romaji is present
        if (!explanation.romaji && explanation.reading) {
            explanation.romaji = this.generateRomaji(explanation.reading);
        }
        // Ensure examples have furigana
        explanation.examples = explanation.examples.map(example => {
            if (!example.furigana && example.japanese) {
                example.furigana = example.japanese; // Fallback to japanese if furigana missing
            }
            return example;
        });
        return explanation;
    }
    /**
     * Generate romaji for Japanese text (simplified)
     */
    generateRomaji(hiragana) {
        // Basic hiragana to romaji mapping
        const romajiMap = {
            'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
            'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
            'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
            'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
            'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
            'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
            'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
            'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
            'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
            'わ': 'wa', 'を': 'wo', 'ん': 'n'
        };
        let romaji = '';
        for (const char of hiragana) {
            romaji += romajiMap[char] || char;
        }
        return romaji;
    }
    /**
     * Explain multiple words for comparison
     */
    async explainMultipleWords(words, config) {
        const results = [];
        for (const word of words) {
            const result = await this.process({ word }, config);
            results.push(result.data);
        }
        return {
            data: results,
            usage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                estimatedCost: 0
            }
        };
    }
}
exports.WordExplainerProcessor = WordExplainerProcessor;
//# sourceMappingURL=WordExplainerProcessor.js.map