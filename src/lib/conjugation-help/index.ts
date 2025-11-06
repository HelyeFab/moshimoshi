/**
 * Conjugation Help System - Main Export
 *
 * This module provides the smart error analysis system for conjugation practice.
 */

// Main API
export { ConjugationErrorAnalyzer } from './error-analyzer';

// Components
export { ConjugationErrorClassifier } from './error-classifier';
export { HelpRelevanceScorer } from './relevance-scorer';

// Types
export * from './types';

// Re-export help content from data layer
export {
  HELP_CONTENT,
  getHelpById,
  getHelpByCategory,
  getHelpByWordType,
  getHelpByFormType,
  getHelpByErrorPattern,
  searchHelp,
  type HelpContent,
  type HelpExample,
  type HelpTriggers
} from '@/data/conjugation-help';
