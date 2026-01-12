"use strict";
/**
 * Prompt Manager
 * Loads and manages prompt templates from JSON config files
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class PromptManager {
    constructor() {
        this.prompts = new Map();
        this.modelConfig = null;
        this.taskConfig = null;
        this.configPath = path_1.default.join(process.cwd(), 'src/lib/ai/config');
        this.loadAllConfigs();
    }
    static getInstance() {
        if (!PromptManager.instance) {
            PromptManager.instance = new PromptManager();
        }
        return PromptManager.instance;
    }
    /**
     * Load all configuration files
     */
    loadAllConfigs() {
        try {
            // Load prompt configs
            const promptsPath = path_1.default.join(this.configPath, 'prompts');
            const promptFiles = this.getJsonFiles(promptsPath);
            for (const file of promptFiles) {
                const content = fs_1.default.readFileSync(path_1.default.join(promptsPath, file), 'utf-8');
                const config = JSON.parse(content);
                const baseName = path_1.default.basename(file, '.json');
                this.prompts.set(baseName, config);
            }
            // Load model config
            const modelConfigPath = path_1.default.join(this.configPath, 'models', 'model-selection.json');
            if (fs_1.default.existsSync(modelConfigPath)) {
                this.modelConfig = JSON.parse(fs_1.default.readFileSync(modelConfigPath, 'utf-8'));
            }
            // Load task config
            const taskConfigPath = path_1.default.join(this.configPath, 'tasks', 'task-config.json');
            if (fs_1.default.existsSync(taskConfigPath)) {
                this.taskConfig = JSON.parse(fs_1.default.readFileSync(taskConfigPath, 'utf-8'));
            }
            console.log(`✅ Loaded ${this.prompts.size} prompt configs`);
        }
        catch (error) {
            console.error('Error loading configs:', error);
            // In production, you might want to throw here
        }
    }
    /**
     * Get JSON files from directory
     */
    getJsonFiles(dir) {
        try {
            if (!fs_1.default.existsSync(dir)) {
                return [];
            }
            return fs_1.default.readdirSync(dir).filter(file => file.endsWith('.json'));
        }
        catch (error) {
            console.error(`Error reading directory ${dir}:`, error);
            return [];
        }
    }
    /**
     * Get prompt template for a specific task
     */
    getPrompt(category, taskName) {
        const categoryConfig = this.prompts.get(category);
        if (!categoryConfig || !categoryConfig[taskName]) {
            console.warn(`Prompt not found: ${category}.${taskName}`);
            return null;
        }
        return categoryConfig[taskName];
    }
    /**
     * Fill template with variables
     */
    fillTemplate(template, variables) {
        let filled = template;
        // Replace all {variable} placeholders
        Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            filled = filled.replace(regex, String(value));
        });
        // Remove any remaining optional placeholders
        filled = filled.replace(/\{[^}]+\}/g, '');
        return filled.trim();
    }
    /**
     * Get system and user prompts for a task
     */
    getPromptsForTask(task, content, config) {
        // Map task to prompt category and name
        const promptMap = {
            'generate_story': { category: 'story-generation', name: 'story_from_moodboard' },
            'generate_moodboard': { category: 'moodboard-generation', name: 'kanji_moodboard' },
            'clean_transcript': { category: 'transcript-processing', name: 'format_transcript' },
            'fix_transcript': { category: 'transcript-processing', name: 'fix_transcript' },
            'extract_vocabulary': { category: 'transcript-processing', name: 'extract_vocabulary' }
        };
        const mapping = promptMap[task];
        if (!mapping) {
            return null;
        }
        const promptTemplate = this.getPrompt(mapping.category, mapping.name);
        if (!promptTemplate) {
            return null;
        }
        // Prepare variables
        const variables = this.prepareVariables(task, content, config);
        // Fill templates
        const system = this.fillTemplate(promptTemplate.system || '', variables);
        const user = this.fillTemplate(promptTemplate.userPrompt || promptTemplate.prompt || '', variables);
        return { system, user };
    }
    /**
     * Prepare variables for template filling
     */
    prepareVariables(task, content, config) {
        var _a, _b;
        const vars = Object.assign(Object.assign(Object.assign({}, content), config), { jlptLevel: (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5', timestamp: new Date().toISOString() });
        // Task-specific variable preparation
        switch (task) {
            case 'generate_story':
                if (content.kanjiList) {
                    vars.kanjiString = content.kanjiList
                        .map((k) => `${k.kanji || k.char}(${k.meaning})`)
                        .join(', ');
                }
                vars.targetChars = vars.targetLength === 'short' ? 500 :
                    vars.targetLength === 'long' ? 2000 : 1000;
                vars.includeDialogue = vars.includeDialogue ? 'Yes' : 'No';
                if (((_a = vars.focusGrammar) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                    vars.grammarFocus = `9. Try to incorporate these grammar points: ${vars.focusGrammar.join(', ')}`;
                }
                break;
            case 'generate_moodboard':
                if (((_b = vars.tags) === null || _b === void 0 ? void 0 : _b.length) > 0) {
                    vars.tagsSection = `Include these tags where relevant: ${vars.tags.join(', ')}`;
                }
                break;
            case 'clean_transcript':
                vars.maxSegmentLength = vars.maxSegmentLength || 20;
                vars.idealMinLength = 8;
                vars.idealMaxLength = 15;
                break;
        }
        return vars;
    }
    /**
     * Get model for task
     */
    getModelForTask(task) {
        var _a, _b;
        if ((_b = (_a = this.modelConfig) === null || _a === void 0 ? void 0 : _a.taskModelMapping) === null || _b === void 0 ? void 0 : _b[task]) {
            return this.modelConfig.taskModelMapping[task];
        }
        return 'gpt-4o-mini'; // Default
    }
    /**
     * Get task configuration
     */
    getTaskConfig(task) {
        var _a, _b;
        return ((_b = (_a = this.taskConfig) === null || _a === void 0 ? void 0 : _a.tasks) === null || _b === void 0 ? void 0 : _b[task]) || null;
    }
    /**
     * Get cache duration for task
     */
    getCacheDuration(task) {
        var _a, _b;
        const taskConfig = this.getTaskConfig(task);
        if (((_a = taskConfig === null || taskConfig === void 0 ? void 0 : taskConfig.cache) === null || _a === void 0 ? void 0 : _a.enabled) === false) {
            return 0;
        }
        return ((_b = taskConfig === null || taskConfig === void 0 ? void 0 : taskConfig.cache) === null || _b === void 0 ? void 0 : _b.duration) || 3600;
    }
    /**
     * Validate request for task
     */
    validateRequest(task, request) {
        var _a;
        const taskConfig = this.getTaskConfig(task);
        const errors = [];
        if (!taskConfig) {
            return { valid: true, errors: [] }; // No validation rules
        }
        const validation = taskConfig.validation || {};
        // Check required fields
        if (validation.required) {
            for (const field of validation.required) {
                if (!request[field]) {
                    errors.push(`Missing required field: ${field}`);
                }
            }
        }
        // Check max/min constraints
        if (validation.maxLength && ((_a = request.content) === null || _a === void 0 ? void 0 : _a.length) > validation.maxLength) {
            errors.push(`Content exceeds maximum length of ${validation.maxLength}`);
        }
        if (validation.maxQuestions && request.questionCount > validation.maxQuestions) {
            errors.push(`Question count exceeds maximum of ${validation.maxQuestions}`);
        }
        if (validation.minQuestions && request.questionCount < validation.minQuestions) {
            errors.push(`Question count below minimum of ${validation.minQuestions}`);
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    /**
     * Estimate cost for task
     */
    estimateCost(task, request) {
        var _a;
        const taskConfig = this.getTaskConfig(task);
        if (!(taskConfig === null || taskConfig === void 0 ? void 0 : taskConfig.costEstimate)) {
            return 0.0005; // Default estimate
        }
        let cost = taskConfig.costEstimate.base || 0;
        // Add per-item costs
        if (taskConfig.costEstimate.perItem && request.count) {
            cost += taskConfig.costEstimate.perItem * request.count;
        }
        if (taskConfig.costEstimate.perPage && request.pageCount) {
            cost += taskConfig.costEstimate.perPage * request.pageCount;
        }
        if (taskConfig.costEstimate.per1000Chars && ((_a = request.content) === null || _a === void 0 ? void 0 : _a.length)) {
            cost += taskConfig.costEstimate.per1000Chars * (request.content.length / 1000);
        }
        return cost;
    }
    /**
     * Reload configurations (useful for development)
     */
    reload() {
        this.prompts.clear();
        this.modelConfig = null;
        this.taskConfig = null;
        this.loadAllConfigs();
    }
    /**
     * Export all configurations (for debugging)
     */
    exportConfigs() {
        return {
            prompts: Object.fromEntries(this.prompts),
            models: this.modelConfig,
            tasks: this.taskConfig
        };
    }
}
exports.PromptManager = PromptManager;
//# sourceMappingURL=PromptManager.js.map