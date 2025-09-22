/**
 * Prompt Manager
 * Loads and manages prompt templates from JSON config files
 */

import fs from 'fs';
import path from 'path';
import { AITaskType, TaskConfig, JLPTLevel } from '../types';

interface PromptTemplate {
  system: string;
  userPrompt?: string;
  prompt?: string;
  variables?: Record<string, any>;
  outputFormat?: string;
  responseStructure?: any;
  postProcessing?: any;
}

interface PromptConfig {
  [key: string]: PromptTemplate | any;
}

export class PromptManager {
  private static instance: PromptManager;
  private prompts: Map<string, PromptConfig> = new Map();
  private modelConfig: any = null;
  private taskConfig: any = null;
  private configPath: string;

  private constructor() {
    this.configPath = path.join(process.cwd(), 'src/lib/ai/config');
    this.loadAllConfigs();
  }

  static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  /**
   * Load all configuration files
   */
  private loadAllConfigs(): void {
    try {
      // Load prompt configs
      const promptsPath = path.join(this.configPath, 'prompts');
      const promptFiles = this.getJsonFiles(promptsPath);

      for (const file of promptFiles) {
        const content = fs.readFileSync(path.join(promptsPath, file), 'utf-8');
        const config = JSON.parse(content);
        const baseName = path.basename(file, '.json');
        this.prompts.set(baseName, config);
      }

      // Load model config
      const modelConfigPath = path.join(this.configPath, 'models', 'model-selection.json');
      if (fs.existsSync(modelConfigPath)) {
        this.modelConfig = JSON.parse(fs.readFileSync(modelConfigPath, 'utf-8'));
      }

      // Load task config
      const taskConfigPath = path.join(this.configPath, 'tasks', 'task-config.json');
      if (fs.existsSync(taskConfigPath)) {
        this.taskConfig = JSON.parse(fs.readFileSync(taskConfigPath, 'utf-8'));
      }

      console.log(`✅ Loaded ${this.prompts.size} prompt configs`);
    } catch (error) {
      console.error('Error loading configs:', error);
      // In production, you might want to throw here
    }
  }

  /**
   * Get JSON files from directory
   */
  private getJsonFiles(dir: string): string[] {
    try {
      if (!fs.existsSync(dir)) {
        return [];
      }
      return fs.readdirSync(dir).filter(file => file.endsWith('.json'));
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
      return [];
    }
  }

  /**
   * Get prompt template for a specific task
   */
  getPrompt(category: string, taskName: string): PromptTemplate | null {
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
  fillTemplate(template: string, variables: Record<string, any>): string {
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
  getPromptsForTask(
    task: AITaskType,
    content: any,
    config?: TaskConfig
  ): { system: string; user: string } | null {
    // Map task to prompt category and name
    const promptMap: Record<string, { category: string; name: string }> = {
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
    const user = this.fillTemplate(
      promptTemplate.userPrompt || promptTemplate.prompt || '',
      variables
    );

    return { system, user };
  }

  /**
   * Prepare variables for template filling
   */
  private prepareVariables(
    task: AITaskType,
    content: any,
    config?: TaskConfig
  ): Record<string, any> {
    const vars: Record<string, any> = {
      ...content,
      ...config,
      jlptLevel: config?.jlptLevel || 'N5',
      timestamp: new Date().toISOString()
    };

    // Task-specific variable preparation
    switch (task) {
      case 'generate_story':
        if (content.kanjiList) {
          vars.kanjiString = content.kanjiList
            .map((k: any) => `${k.kanji || k.char}(${k.meaning})`)
            .join(', ');
        }
        vars.targetChars = vars.targetLength === 'short' ? 500 :
                           vars.targetLength === 'long' ? 2000 : 1000;
        vars.includeDialogue = vars.includeDialogue ? 'Yes' : 'No';
        if (vars.focusGrammar?.length > 0) {
          vars.grammarFocus = `9. Try to incorporate these grammar points: ${vars.focusGrammar.join(', ')}`;
        }
        break;

      case 'generate_moodboard':
        if (vars.tags?.length > 0) {
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
  getModelForTask(task: AITaskType): string {
    if (this.modelConfig?.taskModelMapping?.[task]) {
      return this.modelConfig.taskModelMapping[task];
    }
    return 'gpt-4o-mini'; // Default
  }

  /**
   * Get task configuration
   */
  getTaskConfig(task: AITaskType): any {
    return this.taskConfig?.tasks?.[task] || null;
  }

  /**
   * Get cache duration for task
   */
  getCacheDuration(task: AITaskType): number {
    const taskConfig = this.getTaskConfig(task);
    if (taskConfig?.cache?.enabled === false) {
      return 0;
    }
    return taskConfig?.cache?.duration || 3600;
  }

  /**
   * Validate request for task
   */
  validateRequest(task: AITaskType, request: any): { valid: boolean; errors: string[] } {
    const taskConfig = this.getTaskConfig(task);
    const errors: string[] = [];

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
    if (validation.maxLength && request.content?.length > validation.maxLength) {
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
  estimateCost(task: AITaskType, request: any): number {
    const taskConfig = this.getTaskConfig(task);
    if (!taskConfig?.costEstimate) {
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

    if (taskConfig.costEstimate.per1000Chars && request.content?.length) {
      cost += taskConfig.costEstimate.per1000Chars * (request.content.length / 1000);
    }

    return cost;
  }

  /**
   * Reload configurations (useful for development)
   */
  reload(): void {
    this.prompts.clear();
    this.modelConfig = null;
    this.taskConfig = null;
    this.loadAllConfigs();
  }

  /**
   * Export all configurations (for debugging)
   */
  exportConfigs(): any {
    return {
      prompts: Object.fromEntries(this.prompts),
      models: this.modelConfig,
      tasks: this.taskConfig
    };
  }
}