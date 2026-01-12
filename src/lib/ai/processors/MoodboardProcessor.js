"use strict";
/**
 * Moodboard Processor
 * Generates themed kanji collections for educational purposes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoodboardProcessor = void 0;
const BaseProcessor_1 = require("./BaseProcessor");
const types_1 = require("../types");
const PromptManager_1 = require("../config/PromptManager");
class MoodboardProcessor extends BaseProcessor_1.BaseProcessor {
    constructor(context) {
        super(context);
        this.promptManager = PromptManager_1.PromptManager.getInstance();
    }
    /**
     * Process moodboard generation request
     */
    async process(request, config) {
        // Validate request
        this.validateRequest(request);
        // Get prompts from config
        const prompts = this.promptManager.getPromptsForTask('generate_moodboard', request, config);
        let systemPrompt;
        let userPrompt;
        if (prompts) {
            systemPrompt = prompts.system;
            userPrompt = prompts.user;
        }
        else {
            // Fallback to hardcoded prompts
            systemPrompt = this.getSystemPrompt(config);
            userPrompt = this.getUserPrompt(request, config);
        }
        // Call OpenAI
        const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
        // Parse response
        const moodboard = this.parseResponse(content);
        // Enhance and validate moodboard
        const enhanced = this.enhanceMoodboard(moodboard, request, config);
        return {
            data: enhanced,
            usage,
            metadata: {
                theme: request.theme,
                kanjiCount: enhanced.kanjiList.length,
                jlptLevel: (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5'
            }
        };
    }
    /**
     * Validate request
     */
    validateRequest(request) {
        if (!request.theme) {
            throw new types_1.AIServiceError('Theme is required for moodboard generation', 'VALIDATION_ERROR', 400);
        }
        if (request.kanjiCount) {
            if (request.kanjiCount < 5 || request.kanjiCount > 30) {
                throw new types_1.AIServiceError('Kanji count must be between 5 and 30', 'VALIDATION_ERROR', 400);
            }
        }
        if (request.theme.length > 100) {
            throw new types_1.AIServiceError('Theme must be 100 characters or less', 'VALIDATION_ERROR', 400);
        }
    }
    /**
     * Get system prompt
     */
    getSystemPrompt(config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        return `You are a Japanese language expert creating educational kanji mood boards. Generate a list of kanji related to the given theme.

Rules:
1. Include both common and less common kanji for the theme
2. For family members, include both formal and informal terms (e.g., 兄/お兄さん, 姉/お姉さん)
3. CRITICAL: You MUST include kanji from ${jlptLevel} level specifically, not just N5!
4. Each kanji should have accurate readings and meanings
5. Provide stroke count and relevant tags
6. Generate exactly the requested number of kanji entries
7. IMPORTANT: Each kanji character must be unique - no duplicates allowed
8. IMPORTANT: The majority of kanji should be from the ${jlptLevel} level

Return your response as valid json in this exact format:
{
  "title": "Theme Name in English",
  "description": "Brief description of the theme",
  "themeColor": "#hexcolor",
  "emoji": "appropriate emoji",
  "kanjiList": [
    {
      "kanji": "漢",
      "meaning": "English meaning",
      "onyomi": ["カン"],
      "kunyomi": ["から"],
      "jlptLevel": "N5",
      "strokeCount": 13,
      "tags": ["tag1", "tag2"],
      "examples": [
        "漢字を書く。",
        "漢字は難しい。"
      ]
    }
  ]
}

IMPORTANT:
- onyomi must be an array of katakana readings
- kunyomi must be an array of hiragana readings
- examples must be an array of exactly 2 Japanese sentences`;
    }
    /**
     * Get user prompt
     */
    getUserPrompt(request, config) {
        const { theme, kanjiCount = 15, tags = [], focusAreas = [] } = request;
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        let prompt = `Generate a kanji mood board for the theme: "${theme}"`;
        if (tags.length > 0) {
            prompt += `\nInclude these tags where relevant: ${tags.join(', ')}`;
        }
        if (focusAreas.length > 0) {
            prompt += `\nFocus on these areas: ${focusAreas.join(', ')}`;
        }
        prompt += `\nJLPT Level: ${jlptLevel}`;
        prompt += `\nNumber of kanji: ${kanjiCount}`;
        prompt += `\n\nIMPORTANT:
- Include a mix of difficulty levels appropriate for ${jlptLevel}
- Ensure kanji are relevant to the theme "${theme}"
- Provide practical, commonly used examples
- Each kanji must be unique`;
        return prompt;
    }
    /**
     * Parse AI response
     */
    parseResponse(response) {
        var _a;
        let parsed;
        try {
            parsed = this.parseJSON(response);
        }
        catch (error) {
            console.error('Failed to parse moodboard response:', response.substring(0, 500));
            throw error;
        }
        // Log what we got for debugging
        console.log('Parsed moodboard response:', {
            hasTitle: !!parsed.title,
            hasKanjiList: !!parsed.kanjiList,
            kanjiListIsArray: Array.isArray(parsed.kanjiList),
            kanjiCount: ((_a = parsed.kanjiList) === null || _a === void 0 ? void 0 : _a.length) || 0
        });
        // Validate required fields
        if (!parsed.title || !parsed.kanjiList) {
            console.error('Missing fields. Parsed object:', JSON.stringify(parsed, null, 2).substring(0, 500));
            throw new types_1.AIServiceError(`Invalid moodboard format: missing required fields (title: ${!!parsed.title}, kanjiList: ${!!parsed.kanjiList})`, 'INVALID_RESPONSE_FORMAT', 500);
        }
        if (!Array.isArray(parsed.kanjiList)) {
            throw new types_1.AIServiceError('Kanji list must be an array', 'INVALID_RESPONSE_FORMAT', 500);
        }
        return parsed;
    }
    /**
     * Enhance and validate moodboard
     */
    enhanceMoodboard(moodboard, request, config) {
        // Ensure all required fields
        if (!moodboard.description) {
            moodboard.description = `A collection of kanji related to ${request.theme}`;
        }
        if (!moodboard.themeColor) {
            moodboard.themeColor = this.generateThemeColor(request.theme);
        }
        if (!moodboard.emoji) {
            moodboard.emoji = this.selectEmoji(request.theme);
        }
        // Validate and enhance kanji list
        const uniqueKanji = new Set();
        moodboard.kanjiList = moodboard.kanjiList
            .filter(item => {
            // Remove duplicates
            if (uniqueKanji.has(item.kanji)) {
                console.warn(`Duplicate kanji removed: ${item.kanji}`);
                return false;
            }
            uniqueKanji.add(item.kanji);
            return true;
        })
            .map(item => this.enhanceKanjiItem(item, config === null || config === void 0 ? void 0 : config.jlptLevel));
        // Sort by JLPT level and stroke count
        moodboard.kanjiList.sort((a, b) => {
            const levelOrder = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
            const aLevel = levelOrder[a.jlptLevel] || 6;
            const bLevel = levelOrder[b.jlptLevel] || 6;
            if (aLevel !== bLevel)
                return aLevel - bLevel;
            return a.strokeCount - b.strokeCount;
        });
        return moodboard;
    }
    /**
     * Enhance individual kanji item
     */
    enhanceKanjiItem(item, jlptLevel) {
        // Ensure arrays
        if (!Array.isArray(item.onyomi)) {
            item.onyomi = item.onyomi ? [item.onyomi] : [];
        }
        if (!Array.isArray(item.kunyomi)) {
            item.kunyomi = item.kunyomi ? [item.kunyomi] : [];
        }
        if (!Array.isArray(item.examples)) {
            item.examples = [];
        }
        // Ensure JLPT level
        if (!item.jlptLevel) {
            item.jlptLevel = jlptLevel || 'N5';
        }
        // Ensure stroke count
        if (!item.strokeCount || item.strokeCount < 1) {
            item.strokeCount = this.estimateStrokeCount(item.kanji);
        }
        // Convert examples to proper format
        item.examples = item.examples.map((ex) => {
            if (typeof ex === 'string') {
                return {
                    sentence: ex,
                    translation: ''
                };
            }
            return ex;
        });
        // Add default tags if missing
        if (!Array.isArray(item.tags)) {
            item.tags = [item.jlptLevel.toLowerCase()];
        }
        // Add meaning if missing
        if (!item.meaning) {
            item.meaning = 'Unknown meaning';
        }
        return item;
    }
    /**
     * Generate theme color based on theme
     */
    generateThemeColor(theme) {
        const colors = {
            'nature': '#4CAF50',
            'family': '#FF6B6B',
            'food': '#FFA500',
            'school': '#2196F3',
            'work': '#9C27B0',
            'travel': '#00BCD4',
            'time': '#FF9800',
            'weather': '#87CEEB',
            'emotions': '#E91E63',
            'body': '#795548'
        };
        // Check if theme matches any key
        const lowerTheme = theme.toLowerCase();
        for (const [key, color] of Object.entries(colors)) {
            if (lowerTheme.includes(key)) {
                return color;
            }
        }
        // Default color
        return '#6B46C1'; // Purple
    }
    /**
     * Select appropriate emoji for theme
     */
    selectEmoji(theme) {
        const emojiMap = {
            'family': '👨‍👩‍👧‍👦',
            'food': '🍱',
            'nature': '🌸',
            'school': '🎓',
            'work': '💼',
            'travel': '✈️',
            'time': '⏰',
            'weather': '☀️',
            'emotions': '😊',
            'body': '👤',
            'animals': '🐾',
            'colors': '🎨',
            'numbers': '🔢',
            'sports': '⚽',
            'music': '🎵'
        };
        const lowerTheme = theme.toLowerCase();
        for (const [key, emoji] of Object.entries(emojiMap)) {
            if (lowerTheme.includes(key)) {
                return emoji;
            }
        }
        return '📚'; // Default book emoji
    }
    /**
     * Estimate stroke count for a kanji
     */
    estimateStrokeCount(kanji) {
        // This is a simplified estimation
        // In production, use a proper kanji database
        const basicKanji = {
            '一': 1, '二': 2, '三': 3, '四': 5, '五': 4,
            '六': 4, '七': 2, '八': 2, '九': 2, '十': 2,
            '日': 4, '月': 4, '火': 4, '水': 4, '木': 4,
            '金': 8, '土': 3, '人': 2, '子': 3, '女': 3,
            '男': 7, '父': 4, '母': 5, '兄': 5, '姉': 8,
            '弟': 7, '妹': 8, '友': 4, '本': 5, '学': 8,
            '校': 10, '先': 6, '生': 5, '年': 6, '時': 10
        };
        return basicKanji[kanji] || 10; // Default to 10 strokes
    }
}
exports.MoodboardProcessor = MoodboardProcessor;
//# sourceMappingURL=MoodboardProcessor.js.map