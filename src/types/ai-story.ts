import { JLPTLevel } from './kanji';
import { StoryPage } from './story';

export type { JLPTLevel };

export interface AICharacterSheet {
  mainCharacter: {
    name: string;
    nameJa: string;
    description: string;
    visualDescription: string;
    personality?: string;
    referenceImage?: string; // URL or base64 of character reference image
  };
  supportingCharacters: Array<{
    name: string;
    nameJa: string;
    description: string;
    visualDescription: string;
    role?: string;
    referenceImage?: string; // URL or base64 of character reference image
  }>;
  setting: {
    location: string;
    time: string;
    atmosphere: string;
    visualDetails?: string;
  };
  visualStyle: string;
  saveForReuse?: boolean; // Flag to save character sheet for future stories
}

export interface AIStoryOutline {
  pageNumber: number;
  summary: string;
  imagePrompt: string;
  keyVocabulary?: string[];
  grammarPoints?: string[];
}

export interface AIStoryGenerationRequest {
  theme: string;
  jlptLevel: JLPTLevel;
  pages: number;
  useExistingCharacterSheet?: string; // ID of saved character sheet
  moodBoardId?: string; // Use kanji from moodboard
  includeQuiz?: boolean;
  includeAudio?: boolean;
  customPrompt?: string;
}

// Draft generation step tracking for checkpoint/resume
export type DraftGenerationStep =
  | 'character_sheet'
  | 'outline'
  | 'pages'
  | 'quiz'
  | 'model_sheet'
  | 'page_images'
  | 'audio'
  | 'sentences'
  | 'complete';

// Draft status including pending states for incomplete generations
export type DraftStatus =
  | 'generating'
  | 'draft'
  | 'review'
  | 'published'
  | 'failed'
  | 'pending_images'    // Images failed, needs retry
  | 'pending_audio'     // Audio failed, needs retry
  | 'pending_sentences'; // Sentence pre-gen failed, needs retry

// Checkpoint data for resuming incomplete story generation
export interface DraftCheckpoint {
  lastCompletedStep: DraftGenerationStep;
  lastCompletedIndex?: number;  // For loops (e.g., which page image)
  failedAttempts: number;       // Track retry count
  lastAttemptAt: Date;
  lastError?: string;           // Last error message for debugging
}

export interface AIStoryDraft {
  id: string;
  title: string;
  titleJa: string;
  description: string;
  theme: string;
  jlptLevel: JLPTLevel;
  characterSheet: AICharacterSheet;
  outline: AIStoryOutline[];
  pages: StoryPage[];
  generationPrompts: {
    characterPrompt?: string;
    outlinePrompt?: string;
    pagePrompts?: Record<number, string>;
  };
  metadata: {
    generatedAt: Date;
    generatedBy: string; // admin user ID
    openAiModel: string;
    totalTokensUsed?: number;
    totalCost?: number;
    isAIGenerated: boolean;
    generationTime?: number; // in seconds
  };
  status: DraftStatus;
  currentGenerationStep?: number;
  totalGenerationSteps?: number;
  error?: string;
  // Checkpoint fields for resume capability
  checkpoint?: DraftCheckpoint;
}

export interface AIGenerationProgress {
  step: 'character_sheet' | 'outline' | 'pages' | 'images' | 'quiz' | 'audio' | 'complete';
  currentPage?: number;
  totalPages?: number;
  message: string;
  error?: string;
  progress?: number; // 0-100
}

export interface SavedCharacterSheet {
  id: string;
  name: string; // Display name for the character sheet
  characterSheet: AICharacterSheet;
  usedInStories: string[]; // Story IDs
  createdAt: Date;
  createdBy: string;
  tags?: string[];
  referenceImages?: {
    mainCharacter?: string;
    supportingCharacters?: Record<string, string>; // name -> image URL mapping
  };
}

// Multi-step generation configuration
export interface StoryGenerationConfig {
  theme: string;
  jlptLevel: JLPTLevel;
  pageCount: number;
  generateImages: boolean;
  imageStyle?: string;
  includeQuiz: boolean;
  includeAudio: boolean;
  targetVocabulary?: string[];
  targetGrammar?: string[];
  sessionId?: string; // For maintaining character consistency
}

// Image generation request
export interface StoryImageGenerationRequest {
  prompt: string;
  style: string;
  characterProfile?: any; // Character consistency data
  sessionId?: string;
  pageNumber: number;
  storyId: string;
}

// Character model sheet for consistency
export interface CharacterModelSheet {
  id: string;
  storyId: string;
  character: {
    name: string;
    profile: any; // Character profile data
    modelSheetUrl: string;
    referenceUrls: string[];
  };
  sessionId: string;
  createdAt: Date;
}