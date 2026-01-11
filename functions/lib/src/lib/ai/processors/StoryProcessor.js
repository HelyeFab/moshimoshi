"use strict";
/**
 * Story Processor
 * Generates educational stories from moodboards or themes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoryProcessor = void 0;
const BaseProcessor_1 = require("./BaseProcessor");
const types_1 = require("../types");
const PromptManager_1 = require("../config/PromptManager");
class StoryProcessor extends BaseProcessor_1.BaseProcessor {
    constructor(context) {
        super(context);
        this.promptManager = PromptManager_1.PromptManager.getInstance();
    }
    /**
     * Process story generation request
     */
    async process(request, config) {
        // Validate request
        this.validateRequest(request);
        // Get prompts from config
        const prompts = this.promptManager.getPromptsForTask('generate_story', request, config);
        if (!prompts) {
            // Fallback to hardcoded prompts
            const systemPrompt = this.getSystemPrompt(config);
            const userPrompt = this.getUserPrompt(request, config);
            const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
            const story = this.parseResponse(content);
            return {
                data: this.enhanceStory(story, request, config),
                usage,
                metadata: {
                    theme: request.theme,
                    pageCount: story.pages.length,
                    jlptLevel: config === null || config === void 0 ? void 0 : config.jlptLevel
                }
            };
        }
        // Use config-based prompts
        const { content, usage } = await this.callOpenAI(prompts.system, prompts.user);
        const story = this.parseResponse(content);
        return {
            data: this.enhanceStory(story, request, config),
            usage,
            metadata: {
                theme: request.theme,
                pageCount: story.pages.length,
                jlptLevel: config === null || config === void 0 ? void 0 : config.jlptLevel
            }
        };
    }
    /**
     * Validate request
     */
    validateRequest(request) {
        if (!request.theme) {
            throw new types_1.AIServiceError('Theme is required for story generation', 'VALIDATION_ERROR', 400);
        }
        if (request.pageCount && (request.pageCount < 1 || request.pageCount > 50)) {
            throw new types_1.AIServiceError('Page count must be between 1 and 50', 'VALIDATION_ERROR', 400);
        }
    }
    /**
     * Get system prompt
     */
    getSystemPrompt(config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        return `You are a Japanese language teacher creating educational stories for ${jlptLevel} level students.

Requirements:
1. Create engaging, educational content appropriate for ${jlptLevel} learners
2. Use vocabulary and grammar patterns suitable for the level
3. Include furigana for ALL kanji using ruby tags: <ruby>漢字<rt>かんじ</rt></ruby>
4. Each page should be 100-200 Japanese characters
5. Include natural dialogue when appropriate
6. Provide English translations for each page
7. Create vocabulary notes for key terms
8. Generate comprehension quiz questions

Content Guidelines:
- NO inappropriate content
- Focus on educational value
- Culturally respectful
- Age-appropriate for all learners

Return your response as valid json in the specified format.`;
    }
    /**
     * Get user prompt
     */
    getUserPrompt(request, config) {
        const jlptLevel = (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        const pageCount = request.pageCount || 5;
        const targetLength = (config === null || config === void 0 ? void 0 : config.targetLength) || 'medium';
        let prompt = `Create a ${targetLength} educational story.
Theme: ${request.theme}
JLPT Level: ${jlptLevel}
Number of pages: ${pageCount}`;
        // Add character information if provided
        if (request.characters && request.characters.length > 0) {
            prompt += `\n\nCharacters:\n${JSON.stringify(request.characters, null, 2)}`;
        }
        // Add setting information if provided
        if (request.setting) {
            prompt += `\n\nSetting:\n${JSON.stringify(request.setting, null, 2)}`;
        }
        // Add visual style if provided
        if (request.visualStyle) {
            prompt += `\n\nVisual Style: ${request.visualStyle}`;
        }
        prompt += `\n\nGenerate a complete story with:
1. Title in English and Japanese
2. ${pageCount} pages with Japanese text (with furigana), English translation
3. Vocabulary list with key terms
4. 3-5 comprehension quiz questions
5. Consistent narrative flow

Return as JSON with structure:
{
  "title": "English title",
  "titleJa": "Japanese title with furigana",
  "description": "Brief description",
  "pages": [...],
  "vocabulary": [...],
  "quiz": [...]
}`;
        return prompt;
    }
    /**
     * Parse AI response
     */
    parseResponse(response) {
        const parsed = this.parseJSON(response);
        // Validate required fields
        if (!parsed.title || !parsed.titleJa || !parsed.pages) {
            throw new types_1.AIServiceError('Invalid story format: missing required fields', 'INVALID_RESPONSE_FORMAT', 500);
        }
        // Ensure pages is an array
        if (!Array.isArray(parsed.pages)) {
            throw new types_1.AIServiceError('Pages must be an array', 'INVALID_RESPONSE_FORMAT', 500);
        }
        return parsed;
    }
    /**
     * Enhance generated story
     */
    enhanceStory(story, request, config) {
        // Add metadata if missing
        if (!story.metadata) {
            story.metadata = {
                theme: request.theme,
                jlptLevel: (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5',
                generatedAt: new Date().toISOString(),
                pageCount: story.pages.length
            };
        }
        // Ensure all pages have required fields
        story.pages = story.pages.map((page, index) => ({
            pageNumber: page.pageNumber || index + 1,
            text: page.text || '',
            textWithFurigana: page.textWithFurigana || this.addFurigana(page.text),
            translation: page.translation || '',
            imagePrompt: page.imagePrompt || this.generateImagePrompt(page, story.title),
            vocabularyNotes: page.vocabularyNotes || {},
            grammarNotes: page.grammarNotes || {}
        }));
        // Ensure vocabulary list exists
        if (!story.vocabulary || !Array.isArray(story.vocabulary)) {
            story.vocabulary = this.extractVocabulary(story.pages);
        }
        // Ensure quiz exists
        if (!story.quiz || !Array.isArray(story.quiz)) {
            story.quiz = this.generateDefaultQuiz(story);
        }
        return story;
    }
    /**
     * Add furigana to text (placeholder)
     */
    addFurigana(text) {
        // In production, use a proper furigana library
        // For now, just return the text as-is
        return text;
    }
    /**
     * Generate image prompt for a page
     */
    generateImagePrompt(page, title) {
        return `Japanese educational story illustration: ${title}, Page ${page.pageNumber}. ${page.translation || page.text}. Style: Soft watercolor, child-friendly, educational.`;
    }
    /**
     * Extract vocabulary from pages
     */
    extractVocabulary(pages) {
        const vocabulary = [];
        // Extract unique vocabulary from all pages
        const vocabSet = new Set();
        pages.forEach(page => {
            if (page.vocabularyNotes) {
                Object.entries(page.vocabularyNotes).forEach(([word, meaning]) => {
                    if (!vocabSet.has(word)) {
                        vocabSet.add(word);
                        vocabulary.push({
                            word,
                            meaning,
                            pageNumber: page.pageNumber
                        });
                    }
                });
            }
        });
        return vocabulary;
    }
    /**
     * Generate default quiz questions
     */
    generateDefaultQuiz(story) {
        const quiz = [];
        // Add a comprehension question about the title
        quiz.push({
            id: 'q1',
            type: 'multiple_choice',
            question: `What is the story about?`,
            questionJa: 'この物語は何についてですか？',
            options: [
                story.description || story.title,
                'A different story',
                'Something else',
                'None of the above'
            ],
            correctAnswer: 0,
            explanation: `The story is about: ${story.title}`,
            difficulty: 1,
            tags: ['comprehension', 'main-idea']
        });
        // Add a vocabulary question if vocabulary exists
        if (story.vocabulary && story.vocabulary.length > 0) {
            const vocab = story.vocabulary[0];
            quiz.push({
                id: 'q2',
                type: 'multiple_choice',
                question: `What does "${vocab.word}" mean?`,
                questionJa: `「${vocab.word}」の意味は何ですか？`,
                options: [
                    vocab.meaning,
                    'Something different',
                    'Another meaning',
                    'None of these'
                ],
                correctAnswer: 0,
                explanation: `${vocab.word} means: ${vocab.meaning}`,
                difficulty: 2,
                tags: ['vocabulary']
            });
        }
        // Add a true/false question
        quiz.push({
            id: 'q3',
            type: 'true_false',
            question: `The story has ${story.pages.length} pages.`,
            questionJa: `この物語は${story.pages.length}ページあります。`,
            correctAnswer: true,
            explanation: `Yes, the story has exactly ${story.pages.length} pages.`,
            difficulty: 1,
            tags: ['factual']
        });
        return quiz;
    }
    /**
     * Generate story from moodboard
     */
    async generateFromMoodboard(moodboard, config) {
        // Prepare kanji string
        const kanjiList = moodboard.kanjiList || moodboard.kanji || [];
        const kanjiString = kanjiList
            .map((k) => `${k.kanji || k.char}(${k.meaning})`)
            .join(', ');
        // Prepare request
        const request = {
            theme: moodboard.title || moodboard.category || 'General',
            pageCount: this.calculatePageCount(config === null || config === void 0 ? void 0 : config.targetLength),
            metadata: {
                moodboardId: moodboard.id,
                kanjiList: kanjiList.map((k) => k.kanji || k.char),
                genre: (config === null || config === void 0 ? void 0 : config.genre) || 'slice-of-life',
                includeDialogue: (config === null || config === void 0 ? void 0 : config.includeDialogue) !== false
            }
        };
        // Process with enhanced config
        const enhancedConfig = Object.assign(Object.assign({}, config), { jlptLevel: moodboard.jlptLevel || (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5', customPrompt: `Incorporate these kanji naturally: ${kanjiString}` });
        return this.process(request, enhancedConfig);
    }
    /**
     * Calculate page count from target length
     */
    calculatePageCount(targetLength) {
        switch (targetLength) {
            case 'short':
                return 3;
            case 'long':
                return 10;
            case 'medium':
            default:
                return 5;
        }
    }
}
exports.StoryProcessor = StoryProcessor;
//# sourceMappingURL=StoryProcessor.js.map